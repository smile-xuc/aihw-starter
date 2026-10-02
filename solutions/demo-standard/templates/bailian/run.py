#!/usr/bin/env python3
"""百炼参考 demo 模板：复制本目录到 solutions/by-category/<品类>/demo/bailian/ 后改成自己的场景

最小链路：设备发来一句话（已转成文字）→ qwen3.7-flash 流式回答 → 设备播报
保留四件事：--mock 回退、[设备]/[云端] 日志、首字延迟、按 usage 算单次成本（kit.finish 打印验证记录）
模型名用主线名，不用带日期的快照（快照下线只提前 30 天通知）。

一条命令：
  python3 run.py           有 DASHSCOPE_API_KEY 就真跑；没有就自动 mock
  python3 run.py --mock    强制离线 mock（CI 冒烟用）
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

import demo_kit as kit

DEMO_DIR = Path(__file__).resolve().parent
MODEL = "qwen3.7-flash"
# 元 / 百万 Token，单次输入 ≤32K 档。来源：https://help.aliyun.com/zh/model-studio/model-pricing（查证 2026-10-01）
PRICES = {"cn-beijing": (0.2, 0.8), "ap-southeast-1": (0.225, 0.974)}
SYSTEM = "你是一台 AI 硬件的语音助手。用口语化中文回答，两句话以内，不用列表和符号。"
MOCK_REPLY = ["现在是", "模拟回答：", "设备已经连上云端，", "换成真 Key 就能听到模型的回答。"]


class MockHttp:
    """与 kit.HttpTransport 同接口的离线假实现。"""

    def sse(self, url: str, headers: dict, payload: dict, timeout: float = 120):
        for piece in MOCK_REPLY:
            yield {"choices": [{"index": 0, "delta": {"content": piece}}]}
        yield {"choices": [], "usage": {"prompt_tokens": 40, "completion_tokens": 24}}


def main() -> None:
    ap = argparse.ArgumentParser(description="百炼参考 demo 模板")
    kit.add_standard_args(ap)
    ap.add_argument("--text", default="今天适合出门跑步吗？", help="设备收到的一句话（模拟语音转写结果）")
    args = ap.parse_args()

    cfg = kit.resolve(args, DEMO_DIR)
    kit.banner("百炼参考 demo 模板", cfg, [MODEL])
    http = kit.HttpTransport() if cfg.live else MockHttp()

    kit.say("设备", f"用户说：{args.text}")
    payload = {
        "model": MODEL,
        "messages": [{"role": "system", "content": SYSTEM}, {"role": "user", "content": args.text}],
        "stream": True,
        "stream_options": {"include_usage": True},
        "enable_thinking": False,
    }
    t0, first_ms, usage = kit.now_ms(), None, {}
    print("[设备] 播报：", end="", flush=True)
    try:
        for event in http.sse(f"{cfg.compatible_base()}/chat/completions", cfg.headers(), payload):
            for choice in event.get("choices") or []:
                delta = (choice.get("delta") or {}).get("content") or ""
                if delta and first_ms is None:
                    first_ms = kit.now_ms() - t0
                print(delta, end="", flush=True)
            usage = event.get("usage") or usage
    except kit.HttpError as exc:
        sys.exit(f"\n[云端] {exc}")
    print()

    price_in, price_out = PRICES[cfg.region]
    cost = (int(usage.get("prompt_tokens") or 0) * price_in + int(usage.get("completion_tokens") or 0) * price_out) / 1e6
    kit.finish(cfg, args, DEMO_DIR, models=[MODEL], first_ms=first_ms, cost=cost,
               sample=f"文本「{args.text}」", note="首字=发出请求→首个 token")


if __name__ == "__main__":
    main()
