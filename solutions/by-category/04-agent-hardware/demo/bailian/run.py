#!/usr/bin/env python3
"""04 Agent 硬件 · 百炼工具编排参考 demo

模拟一台桌面 AI 盒子：
  指令（文本 / WAV / 麦克风；语音先经 qwen-audio-3.1-asr-flash 转写）
  → 端侧规则（复制自旧 intent-router）：本地能完成的直接执行，不上云
  → 其余交给 qwen3.8-flash（工具调用首选；--cheap 换省钱档 qwen3.7-flash）做 Function Calling 多轮编排
       本地工具 set_light / set_alarm / set_volume → [设备]
       云端工具 get_weather / add_calendar → demo 内的固定示例数据
  → --offline：断网降级，只用端侧规则，做不了的部分明确告诉用户

一条命令：
  python3 run.py           有 DASHSCOPE_API_KEY 就真跑；没有就自动 mock
  python3 run.py --mock    强制离线 mock（CI 冒烟用）

只用标准库。接口以官方文档为准：https://help.aliyun.com/zh/model-studio/qwen-function-calling
"""
from __future__ import annotations

import argparse
import base64
import datetime as dt
import json
import re
import sys
import wave
from dataclasses import dataclass, field
from pathlib import Path

import demo_kit as kit
from local_rules import ROOMS, classify, local_actions, offline_split

DEMO_DIR = Path(__file__).resolve().parent
LLM_MODEL = "qwen3.8-flash"          # 默认：工具调用 / 多轮编排首选
CHEAP_MODEL = "qwen3.7-flash"        # 省钱档：--cheap
ASR_MODEL = "qwen-audio-3.1-asr-flash"
MAX_ROUNDS = 4                       # 一条指令最多几轮模型调用
SAMPLE_AUDIO = DEMO_DIR / "samples" / "cmd_morning.wav"
DEFAULT_SESSION = [("text", "把客厅灯关掉"), ("audio", SAMPLE_AUDIO)]
WEEKDAYS = "一二三四五六日"

# 元 / 百万 Token，按单次请求的输入 Token 分档：(档位上限, 输入, 输出)。查证 2026-10-01：
#   https://help.aliyun.com/zh/model-studio/qwen3-7-flash
#   https://help.aliyun.com/zh/model-studio/qwen3-8-flash
#   https://help.aliyun.com/zh/model-studio/model-pricing（qwen-audio-3.1-asr-flash）
PRICES = {
    LLM_MODEL: {"cn-beijing": [(1_000_000, 0.8, 2.7)], "ap-southeast-1": [(1_000_000, 1.094, 3.427)]},
    CHEAP_MODEL: {
        "cn-beijing": [(32_000, 0.2, 0.8), (256_000, 0.6, 2.4), (1_000_000, 1.2, 4.8)],
        "ap-southeast-1": [(32_000, 0.225, 0.974), (256_000, 0.749, 2.998), (1_000_000, 1.499, 5.995)],
    },
    ASR_MODEL: {"cn-beijing": [(1_000_000, 0.8, 2.7)], "ap-southeast-1": [(1_000_000, 1.094, 3.427)]},
}

SYSTEM = """角色：桌面 AI 盒子的语音助手，用工具完成用户的一句话指令。
- 本地设备：set_light 开关灯，set_alarm 设闹钟，set_volume 调音量；云端服务：get_weather 查天气，add_calendar 记日程
- 需要先查信息再决定的（例如「要是下雨就提前」），先调用查询工具，拿到结果再操作设备
- 时间一律用 24 小时制 HH:MM；日期写「今天」「明天」或 YYYY-MM-DD
- 工具返回 ok=false 时按 error 修正参数再试一次；门锁、支付、删除这类操作没有对应工具，说明需要在手机 App 上确认
- 全部完成后用一两句口语回复，适合语音播报，不用列表和符号
当前时间：{now}"""


def _tool(name: str, description: str, properties: dict, required: list[str]) -> dict:
    return {"type": "function", "function": {"name": name, "description": description, "parameters": {
        "type": "object", "properties": properties, "required": required}}}


TOOLS = [
    _tool("set_light", "开关指定房间的灯（本地设备）",
          {"room": {"type": "string", "enum": list(ROOMS)}, "on": {"type": "boolean"}}, ["room", "on"]),
    _tool("set_alarm", "设置闹钟（本地设备）；同一 label 再次设置会覆盖",
          {"time": {"type": "string", "description": "24 小时制 HH:MM"},
           "date": {"type": "string", "description": "今天 / 明天 / YYYY-MM-DD"},
           "label": {"type": "string"}}, ["time"]),
    _tool("set_volume", "调节盒子音量（本地设备）",
          {"level": {"type": "integer", "description": "0–100"}}, ["level"]),
    _tool("get_weather", "查询城市天气（云端服务）",
          {"city": {"type": "string"}, "date": {"type": "string", "description": "今天 / 明天 / YYYY-MM-DD"}},
          ["city"]),
    _tool("add_calendar", "在日程里添加一项（云端服务）",
          {"title": {"type": "string"}, "start": {"type": "string", "description": "YYYY-MM-DD HH:MM"},
           "minutes": {"type": "integer"}}, ["title", "start"]),
]


def price(model: str, region: str, prompt: int, completion: int) -> float:
    for limit, price_in, price_out in PRICES[model][region]:
        if prompt <= limit:
            break
    return (prompt * price_in + completion * price_out) / 1e6


class Box:
    """盒子本体。本地工具在这里驱动硬件（量产时换成驱动调用）；云端工具返回 demo 内的固定示例数据。

    参数在宿主侧校验：不合法时返回 ok=false + error，让模型在下一轮自己修正。
    """

    def __init__(self) -> None:
        self.lights: dict[str, bool] = {}
        self.alarms: dict[str, str] = {}
        self.volume = 40

    def act(self, name: str, args: dict) -> dict:
        handler = getattr(self, f"tool_{name}", None)
        if handler is None:
            return {"ok": False, "error": f"没有工具 {name}"}
        try:
            return handler(**args)
        except (TypeError, ValueError) as exc:
            return {"ok": False, "error": f"{name} 参数无效：{exc}"}

    def tool_set_light(self, room: str, on: bool) -> dict:
        if room not in ROOMS:
            raise ValueError(f"room 只能是 {' / '.join(ROOMS)}")
        self.lights[room] = bool(on)
        kit.say("设备", f"灯光：{room} → {'开' if on else '关'}")
        return {"ok": True, "room": room, "on": bool(on)}

    def tool_set_alarm(self, time: str, date: str = "今天", label: str = "闹钟") -> dict:
        if not re.fullmatch(r"([01]\d|2[0-3]):[0-5]\d", str(time)):
            raise ValueError("time 必须是 24 小时制 HH:MM")
        self.alarms[label] = f"{date} {time}"
        kit.say("设备", f"闹钟：{date} {time}「{label}」")
        return {"ok": True, "time": time, "date": date, "label": label}

    def tool_set_volume(self, level: int) -> dict:
        if not 0 <= int(level) <= 100:
            raise ValueError("level 范围 0–100")
        self.volume = int(level)
        kit.say("设备", f"音量 → {self.volume}")
        return {"ok": True, "level": self.volume}

    def tool_get_weather(self, city: str, date: str = "今天") -> dict:
        kit.say("云端", f"天气服务（示例数据）：{city} {date} 小雨 18–23℃，降水概率 70%")
        return {"ok": True, "city": city, "date": date, "weather": "小雨", "temp_c": "18–23",
                "rain_probability": 0.7, "note": "demo 示例数据，不是真实天气"}

    def tool_add_calendar(self, title: str, start: str, minutes: int = 60) -> dict:
        kit.say("云端", f"日程服务（示例数据）：{start}「{title}」{int(minutes)} 分钟")
        return {"ok": True, "event_id": "evt_demo_001", "title": title, "start": start, "minutes": int(minutes),
                "note": "demo 示例数据，没有写入真实日历"}

    def summary(self) -> str:
        lights = "、".join(f"{room}{'开' if on else '关'}" for room, on in self.lights.items()) or "未操作"
        alarms = "、".join(f"「{label}」{when}" for label, when in self.alarms.items()) or "无"
        return f"灯 {lights} · 闹钟 {alarms} · 音量 {self.volume}"


@dataclass
class Task:
    source: str
    text: str = ""
    route: str = ""                     # local / cloud / offline
    t_said: float = 0.0                 # 说完指令（松开按键 / 提交文本）的时刻
    asr_ms: float | None = None
    asr_tokens: tuple[int, int] = (0, 0)
    asr_estimated: bool = False
    rounds: int = 0
    tool_calls: int = 0
    pending: list[str] = field(default_factory=list)
    first_call_at: float | None = None
    llm_tokens: tuple[int, int] = (0, 0)
    llm_cost: float = 0.0

    @property
    def first_ms(self) -> float | None:
        return None if self.first_call_at is None else self.first_call_at - self.t_said

    def asr_cost(self, region: str) -> float:
        return price(ASR_MODEL, region, *self.asr_tokens) if any(self.asr_tokens) else 0.0


@dataclass
class Turn:
    content: str = ""
    calls: list[dict] = field(default_factory=list)
    first_call_at: float | None = None
    tokens: tuple[int, int] = (0, 0)


# ───────────────────────── 云端 ─────────────────────────

def transcribe(http, cfg: kit.Config, path: Path, task: Task) -> str:
    """短语音同步转写：WAV 转 Base64 Data URI，不开说话人分离。"""
    with wave.open(str(path), "rb") as w:
        rate = w.getframerate()
    data = base64.b64encode(path.read_bytes()).decode()
    payload = {
        "model": ASR_MODEL,
        "input": {"messages": [{"role": "user", "content": [
            {"type": "input_audio", "input_audio": {"data": f"data:audio/wav;base64,{data}"}}]}]},
        "parameters": {"format": "wav", "sample_rate": str(rate)},
    }
    t0 = kit.now_ms()
    resp = http.json("POST", f"{cfg.api_base()}/services/aigc/multimodal-generation/generation",
                     cfg.headers(**{"X-DashScope-SSE": "disable"}), payload)
    task.asr_ms = kit.now_ms() - t0
    output = resp.get("output") or {}
    text = (output.get("text") or (output.get("sentence") or {}).get("text") or "").strip()
    usage = resp.get("usage") or {}
    task.asr_tokens = (int(usage.get("input_tokens") or 0), int(usage.get("output_tokens") or 0))
    if not any(task.asr_tokens):
        task.asr_tokens = (int(usage.get("duration") or 0) * 25, len(text))
        task.asr_estimated = True
    return text


def stream_chat(http, cfg: kit.Config, model: str, messages: list[dict]) -> Turn:
    """一轮流式调用：边收边播报文字，按 index 拼接 tool_calls 的 arguments 片段。"""
    payload = {
        "model": model,
        "messages": messages,
        "tools": TOOLS,
        "parallel_tool_calls": True,
        "stream": True,
        "stream_options": {"include_usage": True},
        "enable_thinking": False,      # Qwen3.5–3.8 默认开思考，必须显式关闭
    }
    turn, calls, speaking = Turn(), {}, False
    for event in http.sse(f"{cfg.compatible_base()}/chat/completions", cfg.headers(), payload):
        for choice in event.get("choices") or []:
            delta = choice.get("delta") or {}
            text = delta.get("content") or ""
            if text:
                if not speaking:
                    print("[盒子] ", end="", flush=True)
                    speaking = True
                print(text, end="", flush=True)
                turn.content += text
            for part in delta.get("tool_calls") or []:
                slot = calls.setdefault(part.get("index", 0), {"id": "", "name": "", "arguments": ""})
                function = part.get("function") or {}
                slot["id"] = part.get("id") or slot["id"]          # 只有首块带 id 和 name
                slot["name"] = function.get("name") or slot["name"]
                slot["arguments"] += function.get("arguments") or ""
                if turn.first_call_at is None and slot["name"]:
                    turn.first_call_at = kit.now_ms()
        if event.get("usage"):
            usage = event["usage"]
            turn.tokens = (int(usage.get("prompt_tokens") or 0), int(usage.get("completion_tokens") or 0))
    if speaking:
        print(flush=True)
    turn.calls = [calls[i] for i in sorted(calls)]
    return turn


def run_cloud(http, cfg: kit.Config, model: str, box: Box, task: Task, now: dt.datetime) -> None:
    clock = f"{now:%Y-%m-%d %H:%M} 星期{WEEKDAYS[now.weekday()]}"
    messages = [{"role": "system", "content": SYSTEM.format(now=clock)}, {"role": "user", "content": task.text}]
    for round_no in range(1, MAX_ROUNDS + 1):
        task.rounds = round_no
        turn = stream_chat(http, cfg, model, messages)
        task.llm_tokens = (task.llm_tokens[0] + turn.tokens[0], task.llm_tokens[1] + turn.tokens[1])
        task.llm_cost += price(model, cfg.region, *turn.tokens)
        if task.first_call_at is None:
            task.first_call_at = turn.first_call_at
        if not turn.calls:
            return
        kit.say("云端", f"第 {task.rounds} 轮 → 调用 {'、'.join(c['name'] for c in turn.calls)}")
        messages.append({"role": "assistant", "content": turn.content, "tool_calls": [
            {"id": c["id"], "type": "function", "index": i, "function": {"name": c["name"], "arguments": c["arguments"]}}
            for i, c in enumerate(turn.calls)]})
        for call in turn.calls:
            try:
                args = json.loads(call["arguments"] or "{}")
            except json.JSONDecodeError:
                args = None
            result = box.act(call["name"], args) if isinstance(args, dict) else {
                "ok": False, "error": "arguments 不是 JSON 对象"}
            if not result.get("ok"):
                kit.say("设备", f"拒绝 {call['name']}（{call['arguments']}）：{result.get('error')} → 回传给模型修正")
            task.tool_calls += 1
            messages.append({"role": "tool", "tool_call_id": call["id"],
                             "content": json.dumps(result, ensure_ascii=False)})
    kit.say("云端", f"{MAX_ROUNDS} 轮后仍在调用工具，停止编排")


# ───────────────────────── 端侧 ─────────────────────────

def confirm(name: str, args: dict) -> str:
    if name == "set_light":
        return f"{args['room']}的灯已{'打开' if args['on'] else '关闭'}。"
    if name == "set_alarm":
        return f"已设好{args['date']} {args['time']} 的闹钟。"
    if name == "set_volume":
        return f"音量调到 {args['level']}。"
    return ""


def run_local(box: Box, actions: list[tuple[str, dict]], task: Task) -> str:
    """执行端侧动作，返回要播报的确认语。"""
    phrases = []
    for name, args in actions:
        if name == "say":
            phrases.append(args["text"])
            continue
        result = box.act(name, args)
        task.tool_calls += 1
        phrases.append(confirm(name, args) if result.get("ok") else f"没能完成：{result.get('error')}。")
    return "".join(phrases)


def offline_transcript(path: Path) -> str | None:
    """断网时没有云端转写。样本自带台词（samples/*.json），用它模拟端侧离线识别。"""
    meta = path.with_suffix(".json")
    if not meta.is_file():
        return None
    return "".join(s["text"] for s in json.loads(meta.read_text(encoding="utf-8"))["sentences"])


# ───────────────────────── 主流程 ─────────────────────────

def commands(args: argparse.Namespace):
    """逐条产出（类型, 内容）。麦克风模式按回车开始 / 结束，输入 q 退出。"""
    if args.mic:
        index = 0
        while True:
            kit.say("设备", "等待按键 · 灯环：白色呼吸")
            if input("        按回车开始说话（输入 q 回车退出）").strip().lower() == "q":
                return
            pcm = kit.record_mic(16000)
            index += 1
            path = DEMO_DIR / "out" / f"mic_{index}.wav"
            kit.write_wav(path, pcm, 16000)
            yield "audio", path
    elif args.text or args.audio:
        for text in args.text or []:
            yield "text", text
        for path in args.audio or []:
            yield "audio", path
    else:
        yield from DEFAULT_SESSION


def hear(http, cfg: kit.Config, args: argparse.Namespace, path: Path, task: Task) -> str | None:
    if not path.is_file() or path.suffix.lower() != ".wav":
        sys.exit(f"{path}：需要 WAV 文件（转换：ffmpeg -i in.m4a -ac 1 -ar 16000 -sample_fmt s16 out.wav）")
    with wave.open(str(path), "rb") as w:
        seconds = w.getnframes() / w.getframerate()
    kit.say("设备", f"麦克风 ← {path.name}（{seconds:.1f} s）· 松开按键")
    task.t_said = kit.now_ms()
    if args.offline:
        text = offline_transcript(path)
        if text is None:
            kit.say("设备", "断网：语音指令需要端侧离线识别，本 demo 只给样本附带了台词，跳过这一条")
            return None
        kit.say("设备", f"断网 → 端侧离线识别（模拟：读取 {path.with_suffix('.json').name}）：{text}")
        return text
    kit.say("云端", f"转写 {ASR_MODEL}……")
    text = transcribe(http, cfg, path, task)
    took = f"{task.asr_ms:.0f} ms" if cfg.live else "mock 不计时"
    kit.say("云端", f"听到：{text}（{took}）")
    return text


def main() -> None:
    ap = argparse.ArgumentParser(description="04 Agent 硬件 · 百炼工具编排参考 demo")
    kit.add_standard_args(ap)
    ap.add_argument("--text", action="append", help="一句文本指令，可重复")
    ap.add_argument("--audio", type=Path, action="append", help="一条语音指令（WAV），可重复")
    ap.add_argument("--mic", action="store_true", help="用麦克风：回车开始说话、再回车结束，可多条")
    ap.add_argument("--offline", action="store_true", help="模拟断网：只用端侧规则，演示降级")
    ap.add_argument("--cheap", action="store_true", help=f"编排改用省钱档 {CHEAP_MODEL}（默认 {LLM_MODEL}）")
    args = ap.parse_args()

    cfg = kit.resolve(args, DEMO_DIR)
    model = CHEAP_MODEL if args.cheap else LLM_MODEL
    uses_voice = args.mic or bool(args.audio) or not args.text
    planned = ["端侧规则（断网）"] if args.offline else [model] + ([ASR_MODEL] if uses_voice else [])
    kit.banner("04 Agent 硬件 · 百炼工具编排参考 demo", cfg, planned)
    if args.offline:
        http = None
        kit.say("设备", "断网模式：不连云端，只用端侧规则")
    elif cfg.live:
        http = kit.HttpTransport()
        if not cfg.workspace_id:
            kit.say("提示", "未填 DASHSCOPE_WORKSPACE_ID，使用通用域名；官方推荐业务空间专属域名")
    else:
        from mock import MockHttp
        http = MockHttp(DEMO_DIR / "samples")
        kit.say("设备", "连接本地 mock 云端（按官方响应结构回放，不联网）")

    box, tasks, now = Box(), [], dt.datetime.now()
    try:
        for index, (kind, value) in enumerate(commands(args), 1):
            task = Task(source=Path(value).name if kind == "audio" else f"文本「{value}」")
            if kind == "audio":
                text = hear(http, cfg, args, Path(value), task)
                if not text:
                    continue
            else:
                kit.say("设备", f"指令（文本）：{value}")
                task.t_said, text = kit.now_ms(), value
            task.text = text
            route = classify(text)
            actions = local_actions(text, now) if route.route == "local" else None
            if actions:
                task.route = "local"
                kit.say("设备", f"端侧规则：{route.reason} → 本地执行，不上云")
                kit.say("盒子", "好的，" + run_local(box, actions, task))
            elif args.offline:
                task.route = "offline"
                done, task.pending = offline_split(text, now)
                kit.say("设备", f"断网：{route.reason}，拆成小句降级到端侧规则")
                said = run_local(box, done, task)
                todo = "".join(f"「{p}」" for p in task.pending)
                kit.say("盒子", "网络不可用。" + (said if said else "")
                        + (f"{todo}需要联网，恢复网络后再说一次。" if todo else ""))
            else:
                task.route = "cloud"
                kit.say("云端", f"{route.reason} → {model} 编排（Function Calling，流式）")
                run_cloud(http, cfg, model, box, task, now)
            tasks.append(task)
            kit.say("统计", stats_line(index, task, cfg, model))
    except kit.HttpError as exc:
        sys.exit(f"[云端] {exc}")
    except KeyboardInterrupt:
        print()

    if not tasks:
        return
    kit.say("设备", f"盒子状态：{box.summary()}")
    cloud = [t for t in tasks if t.route == "cloud"]
    models = ([ASR_MODEL] if any(any(t.asr_tokens) for t in tasks) else []) + ([model] if cloud else [])
    counts = {r: sum(t.route == r for t in tasks) for r in ("local", "cloud", "offline")}
    note = (f"{len(tasks)} 条指令：端侧 {counts['local']}、云端 {counts['cloud']}、断网降级 {counts['offline']}；"
            "成本为云端任务均值；首字=说完指令→首个工具调用（含转写）")
    cost = sum(t.llm_cost + t.asr_cost(cfg.region) for t in cloud) / len(cloud) if cloud else 0.0
    first_ms = next((t.first_ms for t in cloud if t.first_ms is not None), None)
    kit.finish(cfg, args, DEMO_DIR, models=models or ["（只用端侧规则）"], first_ms=first_ms, cost=cost,
               sample=" + ".join(t.source for t in tasks), note=note)


def stats_line(index: int, task: Task, cfg: kit.Config, model: str) -> str:
    if task.route == "local":
        return f"指令 {index} · 端侧执行 · 工具 {task.tool_calls} 次 · 不上云 · ¥0"
    if task.route == "offline":
        return f"指令 {index} · 断网降级 · 本地完成 {task.tool_calls} 项、{len(task.pending)} 项待联网 · ¥0"
    asr_cost = task.asr_cost(cfg.region)
    if not cfg.live:
        first = "—（mock 不计时）"
    elif task.first_ms is None:
        first = "—（本条没有调用工具）"
    else:
        first = f"{task.first_ms:.0f} ms" + (f"（含转写 {task.asr_ms:.0f} ms）" if task.asr_ms is not None else "")
    split = f"转写 ¥{kit.fmt_cny(asr_cost)} + 编排 ¥{kit.fmt_cny(task.llm_cost)}；" if asr_cost else ""
    estimated = "；转写用量按时长估算" if task.asr_estimated else ""
    return (f"指令 {index} · 云端 {task.rounds} 轮 · 工具 {task.tool_calls} 次 · 说完指令 → 首个工具调用 {first}"
            f" · ¥{kit.fmt_cny(task.llm_cost + asr_cost)}（{split}编排共 {task.llm_tokens[0]} / "
            f"{task.llm_tokens[1]} Token{estimated}）")


if __name__ == "__main__":
    main()
