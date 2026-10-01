#!/usr/bin/env python3
"""01 IPC / AI 视觉 · 百炼事件理解参考 demo

模拟一台家用看护摄像头（IPC）的云端 AI 链路：
  事件抓拍（JPG 文件或摄像头定时抓帧）
  → 事件理解：qwen3.7-flash 看图，JSON 输出结构化事件卡（标题 / 对象 / 动作 / 事件类型 / 风险等级 / 描述）
  → 自然语言检索：在事件列表里找「昨晚宠物跳沙发那段」，返回匹配的事件和理由
  → 看护日报：流式生成 Markdown
  → 手机 App：out/events.json + out/daily.md；中高风险事件由设备联动录像和告警

一条命令：
  python3 run.py           有 DASHSCOPE_API_KEY 就真跑；没有就自动 mock
  python3 run.py --mock    强制离线 mock（CI 冒烟用）

只用标准库（--camera 需要 opencv-python）。接口以官方文档为准：https://help.aliyun.com/zh/model-studio/vision
"""
from __future__ import annotations

import argparse
import base64
import datetime as dt
import json
import re
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Iterator

import demo_kit as kit

DEMO_DIR = Path(__file__).resolve().parent
VISION_MODEL = "qwen3.7-flash"   # 看图出事件卡
TEXT_MODEL = "qwen3.7-flash"     # 检索 + 日报；文字质量优先时可换 qwen3.8-flash
SAMPLES = DEMO_DIR / "samples"
MANIFEST = SAMPLES / "events.json"
DEFAULT_ASK = "找昨晚宠物跳沙发那段"
MIME = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp"}
MAX_DATA_URI = 20 * 1024 * 1024  # 官方：Qwen3.x 系列 Base64 Data URI ≤20 MB
TIME_FMT = "%Y-%m-%d %H:%M:%S"
RISK = {"low": "低", "medium": "中", "high": "高"}

# 元 / 百万 Token，按单次请求的输入 Token 数分档：(档位上限, 输入, 输出)。查证 2026-10-01：
#   qwen3.7-flash：https://help.aliyun.com/zh/model-studio/qwen3-7-flash
#   qwen3.8-flash：https://help.aliyun.com/zh/model-studio/model-pricing
PRICES = {
    "qwen3.7-flash": {
        "cn-beijing": [(32_000, 0.2, 0.8), (256_000, 0.6, 2.4), (1_000_000, 1.2, 4.8)],
        "ap-southeast-1": [(32_000, 0.225, 0.974), (256_000, 0.749, 2.998), (1_000_000, 1.499, 5.995)],
    },
    "qwen3.8-flash": {
        "cn-beijing": [(1_000_000, 0.8, 2.7)],
        "ap-southeast-1": [(1_000_000, 1.094, 3.427)],
    },
}

# Qwen3.x 视觉理解建议把指令放进 user 消息、不设 system 消息（官方「视觉理解」文档）
EVENT_PROMPT = """你是家用看护摄像头的事件分析模块。上面是一帧事件抓拍，抓拍信息：{meta}。
只依据画面输出一个 JSON 对象，不要输出其他文字：
{{"title": "15 字以内的事件标题",
 "objects": ["画面中的主要对象"],
 "actions": ["正在发生的动作"],
 "event": "宠物活动 / 快递包裹 / 用火用电 / 人员活动 / 环境异常 / 无异常 之一",
 "risk_level": "low / medium / high",
 "description": "一两句客观描述"}}
规则：
- 只写看得见的内容；看不清就写「无法确认」，不要编造
- 不识别、不猜测人的身份、年龄、性别等特征；有人时只写「有人」和动作
- 明火或电器无人看管、烟雾、漏水、有人倒地为 medium 或 high；宠物、包裹、日常活动为 low"""

ASK_PROMPT = """你是家用看护摄像头 App 的检索助手。现在时间：{now}。
「昨晚」指昨天 18:00 到今天 06:00，「今早」指今天 06:00 到 12:00。
事件列表（JSON）：
{events}
问题：{question}
只从列表里找，按相关度排序，最多 3 条。输出一个 JSON 对象，不要输出其他文字：
{{"matches": [{{"id": 事件 id, "reason": "一句话说明为什么匹配"}}], "answer": "一句话回答，没有匹配就说没找到"}}"""

DAILY_PROMPT = """你是家用看护摄像头的日报助手。现在时间：{now}。
根据下面的事件列表（JSON）给家人写一份看护日报，Markdown 格式，300 字以内：
# 家庭看护日报 · 日期
一句话总览
## 需要留意
- 中高风险事件：时间、位置、建议；没有就写「- 无」
## 时间线
- HH:MM 位置 · 事件标题
## 小结
一两句话
只依据事件列表，不编造，不推测人物身份。
事件列表：
{events}"""


@dataclass
class Frame:
    data: bytes
    mime: str
    time: dt.datetime
    camera: str
    trigger: str
    image: str  # App 里引用的图片路径（相对 demo 目录）


@dataclass
class Call:
    model: str
    first_ms: float | None = None  # 发出请求 → 首个 token
    prompt: int = 0
    completion: int = 0

    def cost(self, region: str) -> float:
        tiers = PRICES[self.model][region]
        _, price_in, price_out = next((t for t in tiers if self.prompt <= t[0]), tiers[-1])
        return (self.prompt * price_in + self.completion * price_out) / 1e6


class Camera:
    """IPC 本体的本地联动。量产时把 react() 换成固件里的录像、声光告警和推送调用。"""

    def react(self, event: dict) -> None:
        level = event.get("risk_level")
        if level == "high":
            kit.say("设备", "高风险 → 声光告警 · 录制 60 秒云存片段 · App 电话提醒")
        elif level == "medium":
            kit.say("设备", "中风险 → 录制 30 秒云存片段 · App 强提醒")


# ───────────────────────── 云端调用 ─────────────────────────

def chat(http, cfg: kit.Config, model: str, content, *, json_mode: bool, echo=None) -> tuple[str, Call]:
    """OpenAI 兼容 Chat Completions 流式调用，返回（全文, 用量与首字耗时）。"""
    payload = {
        "model": model,
        "messages": [{"role": "user", "content": content}],
        "stream": True,
        "stream_options": {"include_usage": True},
        "enable_thinking": False,  # Qwen3.5 及以后的系列默认开思考，硬件交互一律关闭
    }
    if json_mode:
        payload["response_format"] = {"type": "json_object"}
    call, chunks, t0 = Call(model), [], kit.now_ms()
    for event in http.sse(f"{cfg.compatible_base()}/chat/completions", cfg.headers(), payload):
        for choice in event.get("choices") or []:
            delta = (choice.get("delta") or {}).get("content") or ""
            if delta and call.first_ms is None:
                call.first_ms = kit.now_ms() - t0
            if delta and echo:
                echo(delta)
            chunks.append(delta)
        if event.get("usage"):
            call.prompt = int(event["usage"].get("prompt_tokens") or 0)
            call.completion = int(event["usage"].get("completion_tokens") or 0)
    return "".join(chunks), call


def parse_json(text: str, what: str) -> dict:
    text = re.sub(r"^```(?:json)?\s*|\s*```$", "", text.strip())
    try:
        return json.loads(text)
    except json.JSONDecodeError as exc:
        raise kit.HttpError(f"{what}不是合法 JSON（{exc}）：{text[:200]}") from None


def describe(http, cfg: kit.Config, frame: Frame) -> tuple[dict, Call]:
    data_uri = f"data:{frame.mime};base64,{base64.b64encode(frame.data).decode()}"
    if len(data_uri) > MAX_DATA_URI:
        sys.exit("图片 Base64 后超过 20 MB，先缩到 1280×720 以内")
    meta = f"时间 {frame.time.strftime(TIME_FMT)}；位置 {frame.camera}；触发 {frame.trigger}"
    content = [{"type": "image_url", "image_url": {"url": data_uri}},
               {"type": "text", "text": EVENT_PROMPT.format(meta=meta)}]
    text, call = chat(http, cfg, VISION_MODEL, content, json_mode=True)
    card = parse_json(text, "事件卡")
    level = str(card.get("risk_level") or "low").strip().lower()
    card["risk_level"] = {"低": "low", "中": "medium", "高": "high"}.get(level, level)
    return card, call


def brief(events: list[dict]) -> str:
    keys = ("id", "time", "camera", "title", "objects", "actions", "event", "risk_level", "description")
    return json.dumps([{k: e.get(k) for k in keys} for e in events], ensure_ascii=False, indent=1)


def search(http, cfg: kit.Config, events: list[dict], question: str, now: dt.datetime) -> Call:
    kit.say("App", f"检索「{question}」")
    kit.say("云端", f"检索 {TEXT_MODEL}（{len(events)} 个事件 · JSON）……")
    prompt = ASK_PROMPT.format(now=now.strftime("%Y-%m-%d %H:%M"), events=brief(events), question=question)
    text, call = chat(http, cfg, TEXT_MODEL, prompt, json_mode=True)
    result = parse_json(text, "检索结果")
    by_id = {e["id"]: e for e in events}
    kit.say("App", result.get("answer") or "（模型没有给出回答）")
    for match in result.get("matches") or []:
        try:
            event = by_id[int(match.get("id"))]
        except (AttributeError, KeyError, TypeError, ValueError):
            continue
        print(f"        #{event['id']} {event['time'][5:16]} · {event['camera']} · {event.get('title', '')}"
              f" → {event['image']}")
        print(f"            理由：{match.get('reason', '')}")
    return call


def indented_echo(prefix: str = "        "):
    """流式打印时给每行加缩进；空行不留尾随空格。"""
    at_line_start = True

    def echo(text: str) -> None:
        nonlocal at_line_start
        out = []
        for ch in text:
            if at_line_start and ch != "\n":
                out.append(prefix)
            out.append(ch)
            at_line_start = ch == "\n"
        print("".join(out), end="", flush=True)
    return echo


def daily(http, cfg: kit.Config, events: list[dict], now: dt.datetime) -> tuple[str, Call]:
    kit.say("云端", f"日报 {TEXT_MODEL}（流式 Markdown）……")
    prompt = DAILY_PROMPT.format(now=now.strftime("%Y-%m-%d %H:%M"), events=brief(events))
    text, call = chat(http, cfg, TEXT_MODEL, prompt, json_mode=False, echo=indented_echo())
    print()
    return text.strip() + "\n", call


# ───────────────────────── 设备模拟 ─────────────────────────

def sample_frames() -> tuple[list[Frame], dt.datetime]:
    """samples/events.json：每帧的时间、位置、触发方式；now 让「昨晚」「今早」有固定参照。"""
    meta = json.loads(MANIFEST.read_text(encoding="utf-8"))
    frames = [Frame((SAMPLES / f["file"]).read_bytes(), "image/jpeg", dt.datetime.strptime(f["time"], TIME_FMT),
                    f["camera"], f["trigger"], f"samples/{f['file']}") for f in meta["frames"]]
    return frames, dt.datetime.strptime(meta["now"], "%Y-%m-%d %H:%M")


def file_frames(paths: list[Path]) -> list[Frame]:
    frames = []
    for path in paths:
        if path.suffix.lower() not in MIME:
            sys.exit(f"{path.name}：只演示 {' / '.join(MIME)} 图片")
        frames.append(Frame(path.read_bytes(), MIME[path.suffix.lower()],
                            dt.datetime.fromtimestamp(path.stat().st_mtime).replace(microsecond=0),
                            "本地图片", "文件", str(path)))
    return frames


def camera_frames(count: int, interval: float) -> Iterator[Frame]:
    """电脑摄像头模拟 IPC：每隔 interval 秒抓一帧，存到 out/frames/。"""
    out = DEMO_DIR / "out" / "frames"
    out.mkdir(parents=True, exist_ok=True)
    for index in range(1, count + 1):
        if index > 1:
            kit.say("设备", f"等待 {interval:g} 秒后抓下一帧（Ctrl+C 结束）")
            time.sleep(interval)
        data = kit.capture_jpeg(width=640, height=360)
        path = out / f"cam_{index}.jpg"
        path.write_bytes(data)
        yield Frame(data, "image/jpeg", dt.datetime.now().replace(microsecond=0), "电脑摄像头",
                    f"定时抓帧（每 {interval:g} 秒）", str(path.relative_to(DEMO_DIR)))


def show_card(event: dict) -> None:
    risk = RISK.get(event.get("risk_level"), event.get("risk_level"))
    kit.say("App", f"事件卡 #{event['id']} · {event['time'][5:16]} · {event['camera']} · 风险：{risk}")
    print(f"        {event.get('title', '')} ｜ {event.get('event', '')}")
    print(f"        对象：{'、'.join(event.get('objects') or [])} · 动作：{'、'.join(event.get('actions') or [])}")
    print(f"        {event.get('description', '')}")


def fmt_ms(cfg: kit.Config, value: float | None) -> str:
    return f"{value:.0f} ms" if cfg.live and value is not None else "—（mock 不计时）"


def main() -> None:
    ap = argparse.ArgumentParser(description="01 IPC / AI 视觉 · 百炼事件理解参考 demo")
    kit.add_standard_args(ap)
    ap.add_argument("--images", type=Path, nargs="+", help="换成自己的事件帧（JPG / PNG / WEBP）")
    ap.add_argument("--camera", action="store_true", help="用电脑摄像头定时抓帧（需 pip install -r requirements-device.txt）")
    ap.add_argument("--interval", type=float, default=5, help="--camera 的抓帧间隔（秒）")
    ap.add_argument("--frames", type=int, default=3, help="--camera 抓几帧")
    ap.add_argument("--ask", default=DEFAULT_ASK, help="App 里的自然语言检索；传空字符串跳过")
    ap.add_argument("--no-daily", action="store_true", help="不生成看护日报")
    args = ap.parse_args()

    cfg = kit.resolve(args, DEMO_DIR)
    models = list(dict.fromkeys([VISION_MODEL] + ([TEXT_MODEL] if args.ask or not args.no_daily else [])))
    kit.banner("01 IPC / AI 视觉 · 百炼事件理解参考 demo", cfg, models)
    if cfg.live:
        http = kit.HttpTransport()
        if not cfg.workspace_id:
            kit.say("提示", "未填 DASHSCOPE_WORKSPACE_ID，使用通用域名；官方推荐业务空间专属域名")
    else:
        from mock import MockHttp
        http = MockHttp(SAMPLES)
        kit.say("设备", "连接本地 mock 云端（按官方流式响应结构回放，不联网）")

    if args.camera:
        frames, now, source = camera_frames(args.frames, args.interval), None, "摄像头"
    elif args.images:
        frames, now, source = file_frames(args.images), None, "本地图片"
    else:
        frames, now = sample_frames()
        source = "samples/events"

    camera, events, calls = Camera(), [], []
    try:
        for index, frame in enumerate(frames, 1):
            kit.say("设备", f"{frame.camera} · {frame.trigger} → 抓拍 1 帧（{len(frame.data) // 1024} KB）· 上传云端")
            kit.say("云端", f"事件理解 {VISION_MODEL}（看图 · JSON）……")
            card, call = describe(http, cfg, frame)
            event = {"id": index, "time": frame.time.strftime(TIME_FMT), "camera": frame.camera,
                     "trigger": frame.trigger, "image": frame.image, **card}
            events.append(event)
            calls.append(call)
            show_card(event)
            camera.react(event)
            kit.say("统计", f"抓拍完成 → 事件卡首字 {fmt_ms(cfg, call.first_ms)} · ¥{kit.fmt_cny(call.cost(cfg.region))}"
                            f"（输入 {call.prompt} / 输出 {call.completion} Token）")
    except KeyboardInterrupt:
        print()
    if not events:
        return
    out = DEMO_DIR / "out"
    out.mkdir(exist_ok=True)
    now = now or dt.datetime.now().replace(second=0, microsecond=0)
    (out / "events.json").write_text(json.dumps({"now": now.strftime("%Y-%m-%d %H:%M"), "events": events},
                                                ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    kit.say("App", f"事件列表 → out/events.json（{len(events)} 条）")

    extras = []
    if args.ask:
        asked = search(http, cfg, events, args.ask, now)
        kit.say("统计", f"检索首字 {fmt_ms(cfg, asked.first_ms)} · ¥{kit.fmt_cny(asked.cost(cfg.region))}")
        extras.append(("检索", asked.cost(cfg.region)))
    if not args.no_daily:
        markdown, report = daily(http, cfg, events, now)
        (out / "daily.md").write_text(markdown, encoding="utf-8")
        kit.say("App", "推送看护日报 → out/daily.md")
        kit.say("统计", f"日报首字 {fmt_ms(cfg, report.first_ms)} · ¥{kit.fmt_cny(report.cost(cfg.region))}")
        extras.append(("日报", report.cost(cfg.region)))

    per_event = sum(c.cost(cfg.region) for c in calls) / len(calls)
    firsts = [c.first_ms for c in calls if c.first_ms is not None]
    extra_text = "".join(f" · {name} ¥{kit.fmt_cny(value)}" for name, value in extras)
    kit.say("统计", f"{len(calls)} 个事件合计 ¥{kit.fmt_cny(per_event * len(calls))}{extra_text}")
    kit.finish(cfg, args, DEMO_DIR, models=models, first_ms=sum(firsts) / len(firsts) if firsts else None,
               cost=per_event, sample=f"{len(calls)} 帧事件（{source}）",
               note=f"首字=抓拍完成→事件卡首字，{len(calls)} 帧均值；单次成本=每个事件" + extra_text.replace(" · ", "；"))


if __name__ == "__main__":
    try:
        main()
    except kit.HttpError as exc:
        sys.exit(f"[云端] {exc}")
