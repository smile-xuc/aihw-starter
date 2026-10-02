"""mock.py — 离线假百炼 HTTP 接口

与 demo_kit.HttpTransport 同接口（sse），按官方响应结构回放：
- 看图规划 chat/completions 流式：每轮一个技能调用，按官方格式分块（首块带 id 和 name，后续块只带 arguments 片段），
  finish_reason=tool_calls；技能结果回传后给出下一步；最后一轮输出 content；每轮末尾一条带 usage
剧本只覆盖默认的两条上云指令（放螺丝、用力抓零件），其他指令回一句固定说明；用量为示意值，
图片按 640×480 → 302 Token 计（官方规则：每 32×32 像素 1 Token，另加 2 个）。
"""
from __future__ import annotations

import json
import re

from demo_kit import HttpError

IMAGE_TOKENS = 302


def _plan(text: str) -> tuple[list[tuple[str, dict]], str]:
    """返回（技能序列, 完成后的汇报模板）。"""
    if "螺丝" in text:
        target = "左边的蓝色盒子" if "左" in text else "右边的灰色盒子"
        return ([("locate", {"object": "螺丝"}), ("locate", {"object": target}),
                 ("grasp", {"object": "螺丝", "max_force_n": 8}), ("place", {"target": target})],
                f"螺丝已经放进{target}。")
    if "零件" in text:
        m = re.search(r"(\d+(?:\.\d+)?)\s*牛", text)
        force = float(m.group(1)) if m else 12
        return ([("locate", {"object": "黑色零件"}), ("grasp", {"object": "黑色零件", "max_force_n": force})],
                "已抓住黑色零件，夹持力按安全门上限 {force} 牛执行，等待下一步指令。")
    return [], "（mock）这条指令没有预设剧本；填入 Key 后由模型看图实时规划。"


class MockHttp:
    def __init__(self) -> None:
        self.call_seq = 0

    def sse(self, url: str, headers: dict, payload: dict, timeout: float = 120):
        if not url.endswith("/chat/completions") or not payload.get("stream"):
            raise HttpError(f"mock：未模拟的流式接口 {url}")
        if payload.get("enable_thinking") is not False:
            raise HttpError("mock：规划请求应显式传 enable_thinking=false（Qwen3.5–3.8 默认开思考）")
        if not payload.get("tools"):
            raise HttpError("mock：规划请求需要 tools")
        messages = payload["messages"]
        parts = next(m["content"] for m in messages if m["role"] == "user")
        if not any(p.get("type") == "image_url" and p["image_url"]["url"].startswith("data:image/") for p in parts):
            raise HttpError("mock：用户消息里需要 Base64 Data URI 形式的 image_url")
        text = next(p["text"] for p in parts if p.get("type") == "text")
        plan, report = _plan(text)
        done = sum(len(m.get("tool_calls") or []) for m in messages if m["role"] == "assistant")
        results = [json.loads(m["content"]) for m in messages if m["role"] == "tool"]
        prompt = len(json.dumps([m for m in messages if m["role"] != "user"] + [text, payload["tools"]],
                                ensure_ascii=False)) // 3 + IMAGE_TOKENS
        if done < len(plan):
            name, args = plan[done]
            self.call_seq += 1
            arguments = json.dumps(args, ensure_ascii=False)
            head, rest = arguments[:8], arguments[8:]
            yield {"choices": [{"index": 0, "finish_reason": None, "delta": {"content": None, "tool_calls": [
                {"index": 0, "id": f"call_mock_{self.call_seq}", "type": "function",
                 "function": {"name": name, "arguments": head}}]}}]}
            for i in range(0, len(rest), 10):
                yield {"choices": [{"index": 0, "finish_reason": None, "delta": {"tool_calls": [
                    {"index": 0, "id": "", "type": "function", "function": {"name": None, "arguments": rest[i:i + 10]}}]}}]}
            yield {"choices": [{"index": 0, "delta": {}, "finish_reason": "tool_calls"}]}
            yield {"choices": [], "usage": {"prompt_tokens": prompt, "completion_tokens": len(arguments)}}
            return
        grasped = next((r for r in reversed(results) if "max_force_n" in r), {})
        reply = report.format(force=f"{grasped.get('max_force_n', 0):g}")
        for i in range(0, len(reply), 8):
            yield {"choices": [{"index": 0, "delta": {"content": reply[i:i + 8]}, "finish_reason": None}]}
        yield {"choices": [{"index": 0, "delta": {}, "finish_reason": "stop"}]}
        yield {"choices": [], "usage": {"prompt_tokens": prompt, "completion_tokens": len(reply)}}
