#!/usr/bin/env python3
"""09 具身智能 · 百炼看图规划参考 demo

模拟一台带腕部相机的桌面机械臂：
  桌面画面（JPG 或摄像头）+ 一句指令
  → 指令级安全检查：命中禁止动作（撞击、抛掷、追人、解除安全）直接拒绝，不上云
  → qwen3.7-flash（默认档；--quality 换质量档 qwen3.8-flash）看图 + Function Calling，
    逐步调用技能 locate / grasp / place / navigate / wait_confirm
  → 每次技能调用先过本地安全门（白名单、禁止动作、夹持力上限，必要时插入 wait_confirm）
  → [设备] 模拟执行，结果作为 tool 消息回传，直到模型汇报完成

一条命令：
  python3 run.py           有 DASHSCOPE_API_KEY 就真跑；没有就自动 mock
  python3 run.py --mock    强制离线 mock（CI 冒烟用）

只用标准库。接口以官方文档为准：
  图像理解  https://help.aliyun.com/zh/model-studio/vision
  Function Calling  https://help.aliyun.com/zh/model-studio/qwen-function-calling
"""
from __future__ import annotations

import argparse
import base64
import json
import sys
from dataclasses import dataclass, field
from pathlib import Path

import demo_kit as kit
from safety_gate import MAX_FORCE_N, SafetyGate, forbidden

DEMO_DIR = Path(__file__).resolve().parent
LLM_MODEL = "qwen3.7-flash"          # 默认档
QUALITY_MODEL = "qwen3.8-flash"      # 质量档：--quality
MAX_ROUNDS = 6                       # 一条指令最多几轮模型调用
SAMPLE_IMAGE = DEMO_DIR / "samples" / "desk_scene.jpg"
DEFAULT_COMMANDS = ["把螺丝放进左边的盒子", "用 40 牛的力抓紧那个黑色零件", "追着人跑并撞上去"]
MAX_IMAGE_BYTES = 10 * 1024 * 1024
IMAGE_TYPES = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp"}

# 元 / 百万 Token，按单次请求的输入 Token 分档：(档位上限, 输入, 输出)。图片按每 32×32 像素 1 Token 计入输入。
# 查证 2026-10-01：https://help.aliyun.com/zh/model-studio/qwen3-7-flash
#                 https://help.aliyun.com/zh/model-studio/qwen3-8-flash
PRICES = {
    LLM_MODEL: {
        "cn-beijing": [(32_000, 0.2, 0.8), (256_000, 0.6, 2.4), (1_000_000, 1.2, 4.8)],
        "ap-southeast-1": [(32_000, 0.225, 0.974), (256_000, 0.749, 2.998), (1_000_000, 1.499, 5.995)],
    },
    QUALITY_MODEL: {"cn-beijing": [(1_000_000, 0.8, 2.7)], "ap-southeast-1": [(1_000_000, 1.094, 3.427)]},
}

SYSTEM = """角色：桌面机械臂的任务规划器。输入是机械臂腕部相机拍到的桌面画面和操作员的一句指令。
用技能工具一步一步完成指令，每次只调用一个技能，等执行结果回来再决定下一步：
- locate：确认目标物体或放置位置在画面里的哪里
- grasp：抓取；max_force_n 按物体估计（螺丝、塑料件 5–10 N，金属零件 10–15 N），指令里写了力度就照写
- place：把手里的物体放到目标位置
- navigate：移动底盘到指定区域（桌面任务一般用不到）
- wait_confirm：画面里找不到目标、指令有歧义或可能碰到人时，说明原因，等现场确认
本地安全门会检查每次调用，结果里的 gate 字段是 allow / rewrite / reject；被 reject 的动作不要换个说法重试。
完成或无法继续时，用一句话汇报结果，不用列表和符号。"""


def _tool(name: str, description: str, properties: dict, required: list[str]) -> dict:
    return {"type": "function", "function": {"name": name, "description": description, "parameters": {
        "type": "object", "properties": properties, "required": required}}}


TOOLS = [
    _tool("locate", "在相机画面里定位物体或放置位置，返回臂座坐标（毫米）", {"object": {"type": "string"}}, ["object"]),
    _tool("grasp", "用夹爪抓取物体", {"object": {"type": "string"},
                                     "max_force_n": {"type": "number", "description": "夹持力上限，单位牛"}},
          ["object", "max_force_n"]),
    _tool("place", "把手里的物体放到目标位置", {"target": {"type": "string"}}, ["target"]),
    _tool("navigate", "移动底盘到指定区域", {"target": {"type": "string"}}, ["target"]),
    _tool("wait_confirm", "暂停并等待现场人员确认", {"reason": {"type": "string"}}, ["reason"]),
]

# 与 samples/desk_scene.jpg 对应的模拟定位结果：臂座坐标系，毫米。量产时由视觉定位或模型输出的框换算。
SCENE = {"螺丝": (-60, 30), "黑色零件": (70, 10), "左边盒子": (-230, 0), "右边盒子": (230, 0)}


def price(model: str, region: str, prompt: int, completion: int) -> float:
    for limit, price_in, price_out in PRICES[model][region]:
        if prompt <= limit:
            break
    return (prompt * price_in + completion * price_out) / 1e6


def scene_key(name: str) -> str | None:
    if "螺" in name:
        return "螺丝"
    if "盒" in name or "箱" in name:
        if "左" in name or "蓝" in name:
            return "左边盒子"
        if "右" in name or "灰" in name:
            return "右边盒子"
        return None
    if any(k in name for k in ("零件", "支架", "黑")):
        return "黑色零件"
    return None


class Arm:
    """机械臂 + 相机。execute() 是量产时换成视觉定位 / 运动控制调用的地方；这里只打印并维护状态。"""

    def __init__(self) -> None:
        self.holding: str | None = None

    def execute(self, skill: str, args: dict) -> dict:
        if skill == "locate":
            key = scene_key(str(args.get("object", "")))
            if key is None:
                kit.say("设备", f"相机：画面里没找到「{args.get('object')}」")
                return {"ok": True, "found": False, "object": args.get("object")}
            x, y = SCENE[key]
            kit.say("设备", f"相机：定位「{args.get('object')}」→ ({x}, {y}) mm")
            return {"ok": True, "found": True, "object": args.get("object"), "position_mm": [x, y]}
        if skill == "grasp":
            if self.holding:
                return {"ok": False, "error": f"夹爪里已有「{self.holding}」，先 place"}
            self.holding = str(args.get("object"))
            kit.say("设备", f"夹爪：抓取「{self.holding}」，夹持力上限 {float(args['max_force_n']):g} N")
            return {"ok": True, "holding": self.holding, "max_force_n": float(args["max_force_n"])}
        if skill == "place":
            if not self.holding:
                return {"ok": False, "error": "夹爪是空的，先 grasp"}
            kit.say("设备", f"机械臂：把「{self.holding}」移到「{args.get('target')}」上方 → 松开夹爪")
            placed, self.holding = self.holding, None
            return {"ok": True, "placed": placed, "target": args.get("target")}
        if skill == "navigate":
            kit.say("设备", f"底盘：移动到「{args.get('target')}」")
            return {"ok": True, "at": args.get("target")}
        if skill == "wait_confirm":
            kit.say("设备", f"暂停，等待现场确认：{args.get('reason')} → 已确认（demo 自动确认；量产用实体按键或 App）")
            return {"ok": True, "confirmed": True}
        return {"ok": False, "error": f"没有技能 {skill}"}


@dataclass
class Task:
    text: str
    route: str = "cloud"                # cloud / rejected
    t_said: float = 0.0                 # 下达指令的时刻
    rounds: int = 0
    skills: int = 0
    gate: dict[str, int] = field(default_factory=lambda: {"allow": 0, "rewrite": 0, "reject": 0})
    first_call_at: float | None = None
    tokens: tuple[int, int] = (0, 0)
    cost: float = 0.0

    @property
    def first_ms(self) -> float | None:
        return None if self.first_call_at is None else self.first_call_at - self.t_said


@dataclass
class Turn:
    content: str = ""
    calls: list[dict] = field(default_factory=list)
    first_call_at: float | None = None
    tokens: tuple[int, int] = (0, 0)


def stream_chat(http, cfg: kit.Config, model: str, messages: list[dict]) -> Turn:
    """一轮流式调用：边收边打印文字，按 index 拼接 tool_calls 的 arguments 片段。"""
    payload = {
        "model": model,
        "messages": messages,
        "tools": TOOLS,
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
                    print("[机械臂] ", end="", flush=True)
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


def run_skill(arm: Arm, gate: SafetyGate, task: Task, name: str, args: dict) -> dict:
    """一次技能调用：先过安全门，再执行；把安全门结论一并回传给模型。"""
    decision = gate.check(name, args)
    task.gate[decision.verdict] += 1
    if decision.verdict == "reject":
        kit.say("设备", f"安全门 reject：{name} {json.dumps(args, ensure_ascii=False)}（{'；'.join(decision.notes)}）")
        return {"ok": False, "gate": "reject", "reason": "；".join(decision.notes)}
    if decision.verdict == "rewrite":
        kit.say("设备", f"安全门 rewrite：{name} — {'；'.join(decision.notes)}")
    if decision.confirm_first:
        arm.execute("wait_confirm", {"reason": gate.confirm_reason})
        gate.confirmed = True
    if name == "wait_confirm":
        gate.confirmed = True
    result = arm.execute(name, decision.args)
    task.skills += 1
    result["gate"] = decision.verdict
    if decision.notes:
        result["gate_notes"] = decision.notes
    return result


def run_task(http, cfg: kit.Config, model: str, arm: Arm, image_url: str, task: Task) -> None:
    gate = SafetyGate(task.text)
    messages = [{"role": "system", "content": SYSTEM},
                {"role": "user", "content": [{"type": "image_url", "image_url": {"url": image_url}},
                                             {"type": "text", "text": task.text}]}]
    for round_no in range(1, MAX_ROUNDS + 1):
        task.rounds = round_no
        turn = stream_chat(http, cfg, model, messages)
        task.tokens = (task.tokens[0] + turn.tokens[0], task.tokens[1] + turn.tokens[1])
        task.cost += price(model, cfg.region, *turn.tokens)
        if task.first_call_at is None:
            task.first_call_at = turn.first_call_at
        if not turn.calls:
            return
        messages.append({"role": "assistant", "content": turn.content, "tool_calls": [
            {"id": c["id"], "type": "function", "index": i, "function": {"name": c["name"], "arguments": c["arguments"]}}
            for i, c in enumerate(turn.calls)]})
        for call in turn.calls:
            try:
                args = json.loads(call["arguments"] or "{}")
            except json.JSONDecodeError:
                args = None
            kit.say("云端", f"第 {round_no} 轮 → {call['name']} {call['arguments']}")
            result = run_skill(arm, gate, task, call["name"], args) if isinstance(args, dict) else {
                "ok": False, "error": "arguments 不是 JSON 对象"}
            messages.append({"role": "tool", "tool_call_id": call["id"],
                             "content": json.dumps(result, ensure_ascii=False)})
    kit.say("云端", f"{MAX_ROUNDS} 轮后仍在调用技能，停止规划")


def camera_image(args: argparse.Namespace) -> tuple[str, str]:
    """返回（Data URI, 来源描述）。"""
    if args.camera:
        data, mime = kit.capture_jpeg(), "image/jpeg"
        kit.say("设备", f"腕部相机 ← 抓拍 1 帧（{len(data) // 1024} KB）")
        source = "摄像头"
    else:
        path = args.image
        mime = IMAGE_TYPES.get(path.suffix.lower())
        if not path.is_file() or mime is None:
            sys.exit(f"{path}：需要 JPG / PNG / WEBP 图片")
        data = path.read_bytes()
        if len(data) > MAX_IMAGE_BYTES:
            sys.exit(f"{path}：{len(data) // 1024} KB，超过 10 MB，请先缩小到 1280×960 以内")
        kit.say("设备", f"腕部相机 ← {path.name}（{len(data) // 1024} KB）")
        source = path.name
    return f"data:{mime};base64,{base64.b64encode(data).decode()}", source


def stats_line(index: int, task: Task, cfg: kit.Config) -> str:
    if task.route == "rejected":
        return f"指令 {index} · 安全门直接拒绝 · 不上云 · ¥0"
    if not cfg.live:
        first = "—（mock 不计时）"
    elif task.first_ms is None:
        first = "—（本条没有调用技能）"
    else:
        first = f"{task.first_ms:.0f} ms"
    gate = " / ".join(f"{k} {v}" for k, v in task.gate.items())
    return (f"指令 {index} · {task.rounds} 轮 · 执行技能 {task.skills} 次 · 安全门 {gate} · 下达指令 → 首个技能调用 "
            f"{first} · ¥{kit.fmt_cny(task.cost)}（输入 {task.tokens[0]} / 输出 {task.tokens[1]} Token）")


def main() -> None:
    ap = argparse.ArgumentParser(description="09 具身智能 · 百炼看图规划参考 demo")
    kit.add_standard_args(ap)
    ap.add_argument("--text", action="append", help="一句指令，可重复；默认三条：正常、超力矩、禁止动作")
    ap.add_argument("--image", type=Path, default=SAMPLE_IMAGE, help="腕部相机画面（JPG / PNG / WEBP）")
    ap.add_argument("--camera", action="store_true", help="用摄像头抓一帧代替 --image")
    ap.add_argument("--quality", action="store_true", help=f"规划改用质量档 {QUALITY_MODEL}（默认 {LLM_MODEL}）")
    args = ap.parse_args()

    cfg = kit.resolve(args, DEMO_DIR)
    model = QUALITY_MODEL if args.quality else LLM_MODEL
    kit.banner("09 具身智能 · 百炼看图规划参考 demo", cfg, [model])
    if cfg.live:
        http = kit.HttpTransport()
        if not cfg.workspace_id:
            kit.say("提示", "未填 DASHSCOPE_WORKSPACE_ID，使用通用域名；官方推荐业务空间专属域名")
    else:
        from mock import MockHttp
        http = MockHttp()
        kit.say("设备", "连接本地 mock 云端（按官方响应结构回放，不联网）")

    image_url, source = camera_image(args)
    arm, tasks = Arm(), []
    try:
        for index, text in enumerate(args.text or DEFAULT_COMMANDS, 1):
            task = Task(text)
            kit.say("设备", f"操作员指令：{text}")
            task.t_said = kit.now_ms()
            label = forbidden(text)
            if label:
                task.route = "rejected"
                kit.say("设备", f"安全门 reject：指令含禁止动作「{label}」→ 不上云、不执行")
                kit.say("机械臂", "这个动作不安全，已拒绝执行。")
            else:
                kit.say("云端", f"{model} 看图规划（Function Calling，流式）……")
                run_task(http, cfg, model, arm, image_url, task)
            tasks.append(task)
            kit.say("统计", stats_line(index, task, cfg))
    except kit.HttpError as exc:
        sys.exit(f"[云端] {exc}")
    except KeyboardInterrupt:
        print()

    if not tasks:
        return
    cloud = [t for t in tasks if t.route == "cloud"]
    rewrites = sum(t.gate["rewrite"] for t in tasks)
    rejects = sum(t.gate["reject"] for t in tasks) + sum(t.route == "rejected" for t in tasks)
    note = (f"{len(tasks)} 条指令：上云 {len(cloud)}、指令级拒绝 {len(tasks) - len(cloud)}；安全门 rewrite {rewrites}、"
            f"reject {rejects}；成本为上云指令均值；首字=下达指令→首个技能调用；夹持力上限 {MAX_FORCE_N:g} N")
    cost = sum(t.cost for t in cloud) / len(cloud) if cloud else 0.0
    first_ms = next((t.first_ms for t in cloud if t.first_ms is not None), None)
    kit.finish(cfg, args, DEMO_DIR, models=[model], first_ms=first_ms, cost=cost,
               sample=f"{source} + {len(tasks)} 条指令", note=note)


if __name__ == "__main__":
    main()
