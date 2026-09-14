"""
intent_router.py — Agent 硬件端侧意图路由最小 demo

三分法（与 02-solution.md 一致）：
  local  — 设备控制 / 定时 / 简单事实，端侧直接执行
  cloud  — 开放域问答，上云 LLM
  hybrid — 多步任务，端侧规划 + 云端执行

用法：
  python3 intent_router.py
  python3 intent_router.py --text "把客厅灯关掉"
  python3 intent_router.py --offline --text "解释一下量子纠缠"

标准库即可，无需 API Key。

⚠️ AI 生成代码，仅作接入参考。
"""

from __future__ import annotations

import argparse
import json
from dataclasses import asdict, dataclass

LOCAL_PATTERNS = (
    ("关灯", "device_control", "light.off"),
    ("开灯", "device_control", "light.on"),
    ("关掉", "device_control", "device.off"),
    ("打开空调", "device_control", "ac.on"),
    ("关闭空调", "device_control", "ac.off"),
    ("分钟后", "timer", "timer.set"),
    ("提醒我", "timer", "timer.set"),
    ("设个闹钟", "timer", "alarm.set"),
    ("星期几", "local_fact", "calendar.weekday"),
    ("几点了", "local_fact", "clock.now"),
)

HYBRID_PATTERNS = (
    "然后",
    "并且",
    "同时",
    "查一下",
    "帮我订",
    "设闹钟",
    "发邮件",
    "汇总",
)


@dataclass
class RouteResult:
    route: str
    intent: str
    tool: str | None
    reason: str
    offline_ok: bool
    speech: str


def classify(text: str, offline: bool = False) -> RouteResult:
    t = text.strip()
    low = t.lower()

    # 多步线索优先于单点本地关键词（避免「查航班然后设闹钟」误判为纯 timer）
    if any(k in t for k in HYBRID_PATTERNS):
        if offline:
            return RouteResult(
                route="local",
                intent="offline_degraded",
                tool=None,
                reason="hybrid requested but offline → degrade",
                offline_ok=True,
                speech="[offline] 网络不可用，多步任务暂无法完成。请联网后重试。",
            )
        return RouteResult(
            route="hybrid",
            intent="multi_step",
            tool="planner+fc",
            reason="matched hybrid cue",
            offline_ok=False,
            speech="[hybrid] 端侧规划中，复杂步骤将上云执行…",
        )

    for keyword, intent, tool in LOCAL_PATTERNS:
        if keyword in t or keyword.lower() in low:
            return RouteResult(
                route="local",
                intent=intent,
                tool=tool,
                reason=f"matched local keyword: {keyword}",
                offline_ok=True,
                speech=f"[local] 已执行 {tool}",
            )

    if offline:
        return RouteResult(
            route="local",
            intent="offline_degraded",
            tool=None,
            reason="cloud intent but offline → refuse",
            offline_ok=True,
            speech="[offline] 当前离线，开放域问答不可用。可试：开灯 / 关灯 / 设闹钟。",
        )

    return RouteResult(
        route="cloud",
        intent="open_domain_qa",
        tool="qwen.chat",
        reason="no local/hybrid match → cloud",
        offline_ok=False,
        speech="[cloud] 已路由至云端 LLM（此处为 mock，不发起真实请求）",
    )


DEFAULT_CASES = [
    "把客厅灯关掉",
    "10 分钟后提醒我开会",
    "今天星期几",
    "解释一下量子纠缠",
    "查明天航班然后设个闹钟",
]


def run_cases(offline: bool) -> None:
    print(f"=== intent-router demo (offline={offline}) ===")
    for text in DEFAULT_CASES:
        result = classify(text, offline=offline)
        print(f"\nIN : {text}")
        print(f"OUT: {json.dumps(asdict(result), ensure_ascii=False)}")
        print(f"TTS: {result.speech}")


def main() -> None:
    ap = argparse.ArgumentParser(description="Agent 硬件意图路由 demo")
    ap.add_argument("--text", help="单条用户输入；省略则跑内置用例集")
    ap.add_argument("--offline", action="store_true", help="模拟断网降级")
    ap.add_argument("--json", action="store_true", help="仅输出 JSON")
    args = ap.parse_args()

    if args.text:
        result = classify(args.text, offline=args.offline)
        if args.json:
            print(json.dumps(asdict(result), ensure_ascii=False, indent=2))
        else:
            print(json.dumps(asdict(result), ensure_ascii=False, indent=2))
            print(result.speech)
        return

    run_cases(offline=args.offline)


if __name__ == "__main__":
    main()
