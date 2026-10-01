"""mock.py — 离线假 Realtime 服务端

与 WsTransport 同接口（send / recv / close），按官方服务端事件顺序回放：
session.created → session.updated → input_audio_buffer.committed → 转写 →
（toy_action 函数调用 → 续答）→ 流式文本 + 音频 → response.done（含 usage）。
不联网、不需要 Key；内容为固定回放，用于 CI 冒烟和快速体验。
"""
from __future__ import annotations

import base64
import json
import math
from array import array
from collections import deque

TRANSCRIPT = "帮我讲一个关于恐龙的小故事。"
REPLY = [
    "哇，小手里举着一只绿色的剑龙呀！",
    "它背上那排橙色的骨板，像一串小帆。",
    "从前，有只小剑龙叫阿绿，每天早上背着骨板去晒太阳。",
    "有一天，它听见草丛里有小三角龙在哭，原来是找不到妈妈了。",
    "阿绿让小三角龙跟着自己骨板上的光，一起找到了妈妈。",
    "小朋友觉得阿绿勇敢吗？",
]
TOOL_ARGS = {"motion": "wave", "light": "rainbow"}
# 用量为示意值（按一轮约 2 秒提问 + 1 张 640×480 画面 + 约 10 秒回答估算），仅用于演示成本计算
USAGE_TOOL = {"input_tokens": 980, "output_tokens": 18,
              "input_tokens_details": {"text_tokens": 920, "audio_tokens": 60},
              "output_tokens_details": {"text_tokens": 18}}
USAGE_REPLY = {"input_tokens": 1010, "output_tokens": 260,
               "input_tokens_details": {"text_tokens": 950, "audio_tokens": 60},
               "output_tokens_details": {"text_tokens": 120, "audio_tokens": 140}}


def _chime(index: int, rate: int = 24000, seconds: float = 0.35) -> bytes:
    """每句一个轻柔提示音，代替真实合成语音。"""
    freq = (523.25, 587.33, 659.25, 783.99)[index % 4]
    n = int(rate * seconds)
    samples = array("h", (int(5000 * math.sin(2 * math.pi * freq * i / rate) * math.sin(math.pi * i / n))
                          for i in range(n)))
    return samples.tobytes()


class MockRealtime:
    def __init__(self, tools: bool = True):
        self.tools = tools
        self.queue: deque[dict] = deque()
        self.audio_bytes = 0
        self.images = 0
        self.tool_called = False
        self._seq = 0
        self._emit("session.created", session={"id": "sess_mock", "model": "qwen3.8-omni-flash-realtime"})

    def _emit(self, kind: str, **fields) -> None:
        self._seq += 1
        self.queue.append({"event_id": f"event_mock_{self._seq}", "type": kind, **fields})

    def send(self, event: dict) -> None:
        kind = event.get("type")
        if kind == "session.update":
            self._emit("session.updated", session=event.get("session", {}))
        elif kind == "input_audio_buffer.append":
            self.audio_bytes += len(base64.b64decode(event.get("audio", "")))
        elif kind == "input_image_buffer.append":
            if not self.audio_bytes:
                self._emit("error", error={"code": "InvalidOrder", "message": "image before audio"})
            self.images += 1
        elif kind == "input_audio_buffer.commit":
            self._emit("input_audio_buffer.committed", item_id="item_user")
            self._emit("conversation.item.created", item={"id": "item_user", "type": "message", "role": "user"})
            self._emit("conversation.item.input_audio_transcription.completed",
                       item_id="item_user", content_index=0, transcript=TRANSCRIPT)
        elif kind == "conversation.item.create":
            self._emit("conversation.item.created", item=event.get("item", {}))
        elif kind == "response.create":
            if self.tools and not self.tool_called:
                self._tool_call()
            else:
                self._reply()
        elif kind == "session.finish":
            self.queue.clear()
        else:
            self._emit("error", error={"code": "UnknownEvent", "message": str(kind)})

    def _tool_call(self) -> None:
        self.tool_called = True
        call = {"id": "item_call", "object": "realtime.item", "type": "function_call", "status": "completed",
                "call_id": "call_mock_1", "name": "toy_action", "arguments": json.dumps(TOOL_ARGS)}
        self._emit("response.created", response={"id": "resp_1", "status": "in_progress", "output": []})
        self._emit("response.output_item.added", response_id="resp_1", output_index=0, item={**call, "arguments": ""})
        self._emit("response.function_call_arguments.done", response_id="resp_1", item_id="item_call",
                   output_index=0, call_id="call_mock_1", name="toy_action", arguments=call["arguments"])
        self._emit("response.output_item.done", response_id="resp_1", output_index=0, item=call)
        self._emit("response.done", response={"id": "resp_1", "status": "completed", "output": [call],
                                              "usage": USAGE_TOOL})

    def _reply(self) -> None:
        self._emit("response.created", response={"id": "resp_2", "status": "in_progress", "output": []})
        for i, sentence in enumerate(REPLY):
            self._emit("response.audio_transcript.delta", response_id="resp_2", delta=sentence)
            self._emit("response.audio.delta", response_id="resp_2", delta=base64.b64encode(_chime(i)).decode())
        text = "".join(REPLY)
        self._emit("response.audio_transcript.done", response_id="resp_2", transcript=text)
        self._emit("response.audio.done", response_id="resp_2")
        message = {"id": "item_reply", "object": "realtime.item", "type": "message", "status": "completed",
                   "role": "assistant", "content": [{"type": "audio", "transcript": text}]}
        self._emit("response.done", response={"id": "resp_2", "status": "completed", "output": [message],
                                              "usage": USAGE_REPLY})
        self.tool_called = False

    def recv(self) -> dict:
        if not self.queue:
            raise RuntimeError("mock：客户端在等待一个不会到来的事件（检查调用顺序）")
        return self.queue.popleft()

    def close(self) -> None:
        self.queue.clear()
