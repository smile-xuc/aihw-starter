"""mock.py — 离线假百炼 HTTP 接口

与 demo_kit.HttpTransport 同接口（json / sse / get_bytes），按官方响应结构回放：
- 日报 chat/completions 流式：choices[].delta.content 分块输出 JSON，最后一条 choices 为空、带 usage
- 抬腕播报 audio/tts/SpeechSynthesizer 非流式：output.audio.url + usage.characters，再按 url 下载 WAV
日报内容按请求里的指标套固定规则生成（示意），真跑时由模型生成；播报音频是一段提示音。
"""
from __future__ import annotations

import io
import json
import math
import wave
from array import array

from demo_kit import HttpError

DISCLAIMER = "以上为 AI 健康参考，不替代专业医疗意见。"
TTS_URL = "mock://tts/speak.wav"


def _report(user: dict) -> dict:
    day, reds = user["今日指标"], user["本地红线"]
    alerts = []
    if day["spo2_min"] < 94:
        alerts.append({"metric": "spo2", "text": f"夜间血氧最低 {day['spo2_min']:g}%，低于 94% 参考值"})
    gap = day["rhr"] - day["rhr_avg7"]
    if gap >= 8:
        alerts.append({"metric": "rhr", "text": f"静息心率 {day['rhr']}，比 7 日均值高 {gap}"})
    if day["total_sleep_min"] < 360:
        hours, minutes = divmod(int(day["total_sleep_min"]), 60)
        alerts.append({"metric": "sleep", "text": f"总睡眠 {hours} 小时 {minutes} 分，不足 6 小时"})
    elif day["deep_sleep_min"] < 60:
        alerts.append({"metric": "sleep", "text": f"深睡 {day['deep_sleep_min']} 分钟，偏少"})
    if reds != "无":
        summary, advice = "血氧触发红线，今天多休息", ["今天避免剧烈运动和饮酒", "红线反复出现请咨询医生"]
    elif alerts:
        summary, advice = "恢复偏慢，今晚早点睡", ["今晚提前 30 分钟上床", "白天补 20 分钟轻松步行"]
    else:
        summary, advice = "状态平稳，保持节奏", ["保持今天的活动量"]
    return {"summary": summary, "alerts": alerts[:3], "advice": advice, "disclaimer": DISCLAIMER}


def _billing_chars(text: str) -> int:
    """官方计费口径：一个汉字算 2 个字符，其他字符算 1 个。"""
    return sum(2 if "\u4e00" <= ch <= "\u9fff" else 1 for ch in text)


def _chime_wav(rate: int = 24000) -> bytes:
    """「叮咚」两声提示音，代替真实合成语音。"""
    samples = array("h")
    for freq, seconds in ((880.0, 0.18), (660.0, 0.32)):
        n = int(rate * seconds)
        samples.extend(int(6000 * math.sin(2 * math.pi * freq * i / rate) * math.sin(math.pi * i / n))
                       for i in range(n))
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(rate)
        w.writeframes(samples.tobytes())
    return buf.getvalue()


class MockHttp:
    def sse(self, url: str, headers: dict, payload: dict, timeout: float = 120):
        if not url.endswith("/chat/completions") or not payload.get("stream"):
            raise HttpError(f"mock：未模拟的流式接口 {url}")
        if payload.get("enable_thinking") is not False:
            raise HttpError("mock：日报请求应显式传 enable_thinking=false（Qwen3.5 及以后默认开思考）")
        if (payload.get("response_format") or {}).get("type") not in ("json_schema", "json_object"):
            raise HttpError("mock：日报请求需要 response_format 结构化输出")
        user = json.loads(payload["messages"][-1]["content"])
        text = json.dumps(_report(user), ensure_ascii=False)
        for i in range(0, len(text), 24):
            yield {"choices": [{"index": 0, "delta": {"content": text[i:i + 24]}, "finish_reason": None}]}
        yield {"choices": [{"index": 0, "delta": {}, "finish_reason": "stop"}]}
        prompt = sum(len(m.get("content") or "") for m in payload["messages"])
        yield {"choices": [], "usage": {"prompt_tokens": prompt, "completion_tokens": len(text),
                                        "total_tokens": prompt + len(text)}}

    def json(self, method: str, url: str, headers: dict | None = None, payload: dict | None = None,
             timeout: float = 60) -> dict:
        if not url.endswith("/services/audio/tts/SpeechSynthesizer"):
            raise HttpError(f"mock：未模拟的接口 {method} {url}")
        tts_input = (payload or {}).get("input") or {}
        if not (payload or {}).get("model") or not tts_input.get("text") or not tts_input.get("voice"):
            raise HttpError("mock：语音合成需要 model、input.text 和 input.voice")
        return {"request_id": "mock-tts",
                "output": {"finish_reason": "stop",
                           "audio": {"data": "", "url": TTS_URL, "id": "audio_mock", "expires_at": 0}},
                "usage": {"characters": _billing_chars(tts_input["text"])}}

    def get_bytes(self, url: str, timeout: float = 60) -> bytes:
        if url != TTS_URL:
            raise HttpError(f"mock：未模拟的下载 {url}")
        return _chime_wav()
