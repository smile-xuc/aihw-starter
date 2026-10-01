"""mock.py — 离线假百炼 HTTP 接口

与 demo_kit.HttpTransport 同接口（json / sse），按官方响应结构回放：
- 编排 chat/completions 流式：工具调用按官方格式分块（首块带 id 和 name，后续块只带 arguments 片段），
  finish_reason=tool_calls；工具结果回传后给出下一轮；最后一轮输出 content；每轮末尾一条带 usage
- 语音指令 multimodal-generation（qwen-audio-3.1-asr-flash 同步转写）：output.text + usage
剧本只覆盖样本里的两类指令（查天气 + 闹钟、记日程），其他指令回一句固定说明；用量为示意值。
"""
from __future__ import annotations

import base64
import json
import re
from pathlib import Path

from demo_kit import HttpError

CITIES = ("北京", "上海", "杭州", "深圳", "广州", "成都", "新加坡")


def _calls(messages: list[dict]) -> list[str]:
    return [c["function"]["name"] for m in messages if m.get("role") == "assistant" for c in m.get("tool_calls") or []]


def _next_step(messages: list[dict]) -> dict:
    """返回 {"calls": [(工具名, 参数)]} 或 {"text": 回复}。"""
    user = next(m["content"] for m in messages if m["role"] == "user")
    called = _calls(messages)
    results = [json.loads(m["content"]) for m in messages if m["role"] == "tool"]
    if "天气" in user:
        city = next((c for c in CITIES if c in user), "杭州")
        if "get_weather" not in called:
            return {"calls": [("get_weather", {"city": city, "date": "明天"})]}
        weather = next(r for r in results if "weather" in r)
        rainy = "雨" in weather.get("weather", "")
        if "set_alarm" not in called and ("叫我" in user or "闹钟" in user):
            time = "06:30" if rainy and "提前" in user else "07:00"
            return {"calls": [("set_alarm", {"time": time, "date": "明天", "label": "起床"})]}
        alarm = next((r for r in results if r.get("time")), None)
        tail = f"闹钟已改到明早 {alarm['time']}，" if alarm else ""
        return {"text": f"{city}明天{weather['weather']}，{weather['temp_c']} 度。{tail}出门记得带伞。"}
    if "日程" in user or "开会" in user:
        if "add_calendar" not in called:
            m = re.search(r"和(.+?)开会", user)
            title = f"和{m.group(1)}开会" if m else "会议"
            return {"calls": [("add_calendar", {"title": title, "start": "2026-10-07 15:00", "minutes": 60})]}
        return {"text": "已记到日程：10 月 7 日下午三点，开会一小时。"}
    return {"text": "（mock）这条指令没有预设剧本；填入 Key 后由模型实时编排。"}


class MockHttp:
    def __init__(self, samples_dir: Path):
        self.transcripts: dict[bytes, tuple[str, int]] = {}
        for wav in samples_dir.glob("*.wav"):
            meta = wav.with_suffix(".json")
            if meta.is_file():
                info = json.loads(meta.read_text(encoding="utf-8"))
                self.transcripts[wav.read_bytes()] = ("".join(s["text"] for s in info["sentences"]),
                                                      int(info["duration_ms"]))
        self.call_seq = 0

    def json(self, method: str, url: str, headers: dict | None = None, payload: dict | None = None,
             timeout: float = 60) -> dict:
        if not url.endswith("/services/aigc/multimodal-generation/generation"):
            raise HttpError(f"mock：未模拟的接口 {method} {url}")
        payload = payload or {}
        content = payload["input"]["messages"][-1]["content"]
        audio = next((c["input_audio"]["data"] for c in content if c.get("type") == "input_audio"), "")
        if not (payload.get("parameters") or {}).get("format") or not audio.startswith("data:audio/"):
            raise HttpError("mock：转写需要 parameters.format 和 Base64 Data URI 形式的 input_audio")
        text, duration_ms = self.transcripts.get(base64.b64decode(audio.split(",", 1)[1]),
                                                 ("（mock）这段录音没有附带台词。", 3000))
        seconds = max(1, round(duration_ms / 1000))
        return {"request_id": "mock-asr",
                "output": {"text": text, "sentence": {"sentence_id": 1, "sentence_end": True, "begin_time": 0,
                                                      "end_time": duration_ms, "text": text, "channel_id": 0,
                                                      "speaker_id": None, "words": []}},
                "usage": {"duration": seconds, "input_tokens": seconds * 25, "output_tokens": len(text),
                          "total_tokens": seconds * 25 + len(text)}}

    def sse(self, url: str, headers: dict, payload: dict, timeout: float = 120):
        if not url.endswith("/chat/completions") or not payload.get("stream"):
            raise HttpError(f"mock：未模拟的流式接口 {url}")
        if payload.get("enable_thinking") is not False:
            raise HttpError("mock：编排请求应显式传 enable_thinking=false（Qwen3.5–3.8 默认开思考）")
        if not payload.get("tools"):
            raise HttpError("mock：编排请求需要 tools")
        step = _next_step(payload["messages"])
        prompt = len(json.dumps([payload["messages"], payload["tools"]], ensure_ascii=False)) // 3
        if "text" in step:
            text = step["text"]
            for i in range(0, len(text), 8):
                yield {"choices": [{"index": 0, "delta": {"content": text[i:i + 8]}, "finish_reason": None}]}
            yield {"choices": [{"index": 0, "delta": {}, "finish_reason": "stop"}]}
            yield {"choices": [], "usage": {"prompt_tokens": prompt, "completion_tokens": len(text)}}
            return
        completion = 0
        for index, (name, args) in enumerate(step["calls"]):
            self.call_seq += 1
            arguments = json.dumps(args, ensure_ascii=False)
            completion += len(arguments)
            head, rest = arguments[:10], arguments[10:]
            yield {"choices": [{"index": 0, "finish_reason": None, "delta": {"content": None, "tool_calls": [
                {"index": index, "id": f"call_mock_{self.call_seq}", "type": "function",
                 "function": {"name": name, "arguments": head}}]}}]}
            for i in range(0, len(rest), 12):
                yield {"choices": [{"index": 0, "finish_reason": None, "delta": {"tool_calls": [
                    {"index": index, "id": "", "type": "function",
                     "function": {"name": None, "arguments": rest[i:i + 12]}}]}}]}
        yield {"choices": [{"index": 0, "delta": {}, "finish_reason": "tool_calls"}]}
        yield {"choices": [], "usage": {"prompt_tokens": prompt, "completion_tokens": completion}}
