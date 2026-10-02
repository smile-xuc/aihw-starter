"""mock.py — 离线假百炼接口

MockRealtime：与 WsTransport 同接口（send / recv / close），按官方服务端事件顺序回放三轮对话：
  session.created → session.updated → input_audio_buffer.committed → 转写 →
  pet_expression 函数调用 → 续答：流式文本 + 音频 → response.done（含 usage）
MockHttp：与 demo_kit.HttpTransport 同接口（sse），回放 qwen3.7-flash 的流式 JSON 日记。
不联网、不需要 Key；内容为固定回放，用于 CI 冒烟和快速体验。
"""
from __future__ import annotations

import base64
import json
import math
from array import array
from collections import deque
from dataclasses import dataclass

from demo_kit import HttpError

TURNS = [
    {"transcript": "豆豆，方案终于交上去啦！", "tool": {"emotion": "laugh", "action": "jump"},
     "reply": ["哇，交上去啦！", "这几天熬夜辛苦了，必须跳一下庆祝！", "今晚早点休息吧。"]},
    {"transcript": "不过老板说下周还要大改，有点累。", "tool": {"emotion": "sad", "action": "hug"},
     "reply": ["先抱抱主人。", "改稿确实磨人，不过底子已经打好了。", "明天先列个修改清单，一条条来会轻松很多。"]},
    {"transcript": "好啦，先下班了，明天见。", "tool": {"emotion": "smile", "action": "nod"},
     "reply": ["好呀，路上注意安全，", "明天见！"]},
]
# 用量为示意值，仅用于演示成本计算：
# 音频按官方计费说明折算（输入 7、输出 12.5 Token / 秒），回答按每秒约 4.5 个汉字、每 Token 约 1.4 个汉字估算；
# 系统提示词 + 工具定义约 700 Token；之前各轮的提问音频与文字每轮重复计入输入
INSTRUCTION_TOKENS = 700
AUDIO_IN_TPS, AUDIO_OUT_TPS = 7, 12.5
BYTES_PER_SECOND = 32000  # 16 kHz / 16 bit / 单声道


@dataclass
class _History:
    audio: int = 0
    text: int = 0


def _usage(text_in: int, audio_in: int, text_out: int, audio_out: int = 0) -> dict:
    return {"input_tokens": text_in + audio_in, "output_tokens": text_out + audio_out,
            "input_tokens_details": {"text_tokens": text_in, "audio_tokens": audio_in},
            "output_tokens_details": {"text_tokens": text_out, "audio_tokens": audio_out}}

DIARY = {
    "title": "方案交上去的一天",
    "diary": "今天主人把熬了好几天的方案交上去了，我跳了一下帮主人庆祝！不过老板说下周还要大改，主人有点累，"
             "我抱了抱主人，建议先列个修改清单。傍晚主人下班了，说了明天见。希望主人今晚睡个好觉。",
    "mood": "疲惫",
    "mood_stars": 3,
    "memories": [
        {"type": "生活事件", "content": "主人的方案已经提交，下周要按老板意见大改"},
        {"type": "情绪事件", "content": "连续熬夜改方案，主人有点累"},
    ],
    "follow_up": "问问修改清单列好了没有",
}


def _chime(index: int, rate: int = 24000, seconds: float = 0.3) -> bytes:
    """每句一个轻柔提示音，代替真实合成语音。"""
    freq = (659.25, 783.99, 880.0, 987.77)[index % 4]
    n = int(rate * seconds)
    samples = array("h", (int(5000 * math.sin(2 * math.pi * freq * i / rate) * math.sin(math.pi * i / n))
                          for i in range(n)))
    return samples.tobytes()


class MockRealtime:
    def __init__(self):
        self.queue: deque[dict] = deque()
        self.audio_bytes = 0
        self.audio_tokens = 0
        self.turn_index = -1
        self.tool_called = False
        self.history = _History()
        self._seq = 0
        self._emit("session.created", session={"id": "sess_mock", "model": "qwen3.8-omni-flash-realtime"})

    @property
    def script(self) -> dict:
        return TURNS[self.turn_index % len(TURNS)]

    def _emit(self, kind: str, **fields) -> None:
        self._seq += 1
        self.queue.append({"event_id": f"event_mock_{self._seq}", "type": kind, **fields})

    def send(self, event: dict) -> None:
        kind = event.get("type")
        if kind == "session.update":
            session = event.get("session", {})
            if session.get("turn_detection", "absent") is not None:
                self._emit("error", error={"code": "InvalidParameter", "message": "mock：本 demo 应使用 Manual 模式"})
            self._emit("session.updated", session=session)
        elif kind == "input_audio_buffer.append":
            self.audio_bytes += len(base64.b64decode(event.get("audio", "")))
        elif kind == "input_audio_buffer.commit":
            if not self.audio_bytes:
                self._emit("error", error={"code": "InvalidOrder", "message": "commit before audio"})
                return
            self.audio_tokens = math.ceil(self.audio_bytes / BYTES_PER_SECOND * AUDIO_IN_TPS)
            self.audio_bytes = 0
            self.turn_index += 1
            item = f"item_user_{self.turn_index}"
            self._emit("input_audio_buffer.committed", item_id=item)
            self._emit("conversation.item.created", item={"id": item, "type": "message", "role": "user"})
            self._emit("conversation.item.input_audio_transcription.completed",
                       item_id=item, content_index=0, transcript=self.script["transcript"])
        elif kind == "conversation.item.create":
            self._emit("conversation.item.created", item=event.get("item", {}))
        elif kind == "response.create":
            if not self.tool_called:
                self._tool_call()
            else:
                self._reply()
        elif kind == "session.finish":
            self.queue.clear()
        else:
            self._emit("error", error={"code": "UnknownEvent", "message": str(kind)})

    def _tool_call(self) -> None:
        self.tool_called = True
        rid, cid = f"resp_{self.turn_index}_tool", f"call_mock_{self.turn_index}"
        call = {"id": f"item_call_{self.turn_index}", "object": "realtime.item", "type": "function_call",
                "status": "completed", "call_id": cid, "name": "pet_expression",
                "arguments": json.dumps(self.script["tool"])}
        self._emit("response.created", response={"id": rid, "status": "in_progress", "output": []})
        self._emit("response.output_item.added", response_id=rid, output_index=0, item={**call, "arguments": ""})
        self._emit("response.function_call_arguments.done", response_id=rid, item_id=call["id"],
                   output_index=0, call_id=cid, name="pet_expression", arguments=call["arguments"])
        self._emit("response.output_item.done", response_id=rid, output_index=0, item=call)
        usage = _usage(INSTRUCTION_TOKENS + self.history.text, self.audio_tokens + self.history.audio, 20)
        self._emit("response.done", response={"id": rid, "status": "completed", "output": [call], "usage": usage})

    def _reply(self) -> None:
        rid = f"resp_{self.turn_index}_reply"
        self._emit("response.created", response={"id": rid, "status": "in_progress", "output": []})
        for i, sentence in enumerate(self.script["reply"]):
            self._emit("response.audio_transcript.delta", response_id=rid, delta=sentence)
            self._emit("response.audio.delta", response_id=rid, delta=base64.b64encode(_chime(i)).decode())
        text = "".join(self.script["reply"])
        self._emit("response.audio_transcript.done", response_id=rid, transcript=text)
        self._emit("response.audio.done", response_id=rid)
        message = {"id": f"item_reply_{self.turn_index}", "object": "realtime.item", "type": "message",
                   "status": "completed", "role": "assistant", "content": [{"type": "audio", "transcript": text}]}
        text_out = math.ceil(len(text) / 1.4)
        usage = _usage(INSTRUCTION_TOKENS + self.history.text + 40, self.audio_tokens + self.history.audio,
                       text_out, math.ceil(len(text) / 4.5 * AUDIO_OUT_TPS))
        self._emit("response.done", response={"id": rid, "status": "completed", "output": [message], "usage": usage})
        self.history.audio += self.audio_tokens
        self.history.text += text_out + math.ceil(len(self.script["transcript"]) / 1.4)
        self.tool_called = False

    def recv(self) -> dict:
        if not self.queue:
            raise RuntimeError("mock：客户端在等待一个不会到来的事件（检查调用顺序）")
        return self.queue.popleft()

    def close(self) -> None:
        self.queue.clear()


class MockHttp:
    """qwen3.7-flash 日记：OpenAI 兼容流式，choices[].delta.content，末尾一条带 usage。"""

    def sse(self, url: str, headers: dict, payload: dict, timeout: float = 120):
        if not url.endswith("/chat/completions") or not payload.get("stream"):
            raise HttpError(f"mock：未模拟的流式接口 {url}")
        if payload.get("enable_thinking") is not False:
            raise HttpError("mock：qwen3.7-flash 默认开启思考，日记请求应显式传 enable_thinking=false")
        text = json.dumps(DIARY, ensure_ascii=False)
        for i in range(0, len(text), 24):
            yield {"choices": [{"index": 0, "delta": {"content": text[i:i + 24]}}]}
        prompt = math.ceil(sum(len(m.get("content") or "") for m in payload.get("messages") or []) / 1.4)
        completion = math.ceil(len(text) / 1.4)
        yield {"choices": [], "usage": {"prompt_tokens": prompt, "completion_tokens": completion,
                                        "total_tokens": prompt + completion}}
