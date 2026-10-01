"""mock.py — 离线假百炼接口（02 AI 眼镜）

- MockHttp：与 demo_kit.HttpTransport 同接口（sse），回放 qwen3.8-omni-flash 的 OpenAI 兼容流式响应
- MockTts：与 TtsWs 同接口（send / recv / close），按实时语音合成的 run-task 协议回放：
  task-started → result-generated（sentence-begin / sentence-synthesis + 二进制音频 / sentence-end）→ task-finished
- MockRealtime：与 WsTransport 同接口，按 Realtime 服务端事件顺序回放（Manual 模式 + 画面帧）
不联网、不需要 Key。回答和提示音是固定示意内容，用量按官方折算规则估算。
"""
from __future__ import annotations

import base64
import io
import math
import queue
import re
import wave
from array import array
from collections import deque

from demo_kit import HttpError

TRANSCRIPT = "这是什么菜？辣不辣？"
ANSWER = ["这是宫保鸡丁，", "鸡丁配花生米、干辣椒和葱段，", "微辣带一点甜。", "怕辣的话把干辣椒拨到一边，", "配米饭正好。"]
FRAME_TOKENS = 300        # 640×480 一帧：每 32×32 像素 1 Token
INSTRUCTION_TOKENS = 120  # Realtime 系统指令（示意）


def _chime(index: int, rate: int = 24000, seconds: float = 0.35) -> bytes:
    """每句一个轻柔提示音，代替真实合成语音。"""
    freq = (523.25, 587.33, 659.25, 783.99)[index % 4]
    n = int(rate * seconds)
    samples = array("h", (int(5000 * math.sin(2 * math.pi * freq * i / rate) * math.sin(math.pi * i / n))
                          for i in range(n)))
    return samples.tobytes()


def _billing_chars(text: str) -> int:
    return sum(2 if "\u4e00" <= ch <= "\u9fff" else 1 for ch in text)


class MockHttp:
    def sse(self, url: str, headers: dict, payload: dict, timeout: float = 120):
        if not url.endswith("/chat/completions") or not payload.get("stream"):
            raise HttpError(f"mock：未模拟的接口 {url}")
        if payload.get("reasoning_effort") != "none":
            raise HttpError("mock：qwen3.8-omni-flash 默认 xhigh 深度思考，拍照即问要传 reasoning_effort=none")
        parts = {part.get("type"): part for part in payload["messages"][-1]["content"]}
        image = (parts.get("image_url") or {}).get("image_url", {}).get("url", "")
        audio = (parts.get("input_audio") or {}).get("input_audio", {})
        if not image.startswith("data:image/jpeg;base64,") or audio.get("format") != "wav" \
                or not str(audio.get("data", "")).startswith("data:;base64,"):
            raise HttpError("mock：需要图片 Data URI 和 WAV 音频（data:;base64,…，format=wav）")
        with wave.open(io.BytesIO(base64.b64decode(audio["data"].split(",", 1)[1]))) as w:
            seconds = w.getnframes() / w.getframerate()
        for piece in ANSWER:
            yield {"choices": [{"index": 0, "delta": {"content": piece}}]}
        text = "".join(ANSWER)
        # 图片每 32×32 像素 1 Token；音频每秒 7 Token；文字约 1 字 1 Token
        prompt = FRAME_TOKENS + math.ceil(seconds * 7) + len((parts.get("text") or {}).get("text", ""))
        yield {"choices": [], "usage": {"prompt_tokens": prompt, "completion_tokens": len(text),
                                        "total_tokens": prompt + len(text)}}


class MockTts:
    """服务端按句号、问号等自动分句：句子完整才合成，finish-task 时把剩下的也合成。"""

    def __init__(self):
        self.queue: queue.Queue = queue.Queue()
        self.task_id = None
        self.buffer = ""
        self.characters = 0
        self.sentences = 0

    def _event(self, event: str, payload: dict | None = None, **header) -> None:
        self.queue.put((False, {"header": {"task_id": self.task_id, "event": event, "attributes": {}, **header},
                                "payload": payload or {}}))

    def send(self, message: dict) -> None:
        header = message.get("header") or {}
        action = header.get("action")
        if action == "run-task":
            self.task_id = header.get("task_id")
            params = (message.get("payload") or {}).get("parameters") or {}
            if params.get("format") != "pcm" or not params.get("voice"):
                self._event("task-failed", error_code="InvalidParameter", error_message="mock：需要 voice 和 format=pcm")
            else:
                self._event("task-started")
        elif header.get("task_id") != self.task_id:
            self._event("task-failed", error_code="InvalidParameter", error_message="mock：task_id 要与 run-task 一致")
        elif action == "continue-task":
            self.buffer += ((message.get("payload") or {}).get("input") or {}).get("text", "")
            *complete, self.buffer = re.split(r"(?<=[。！？!?；;])", self.buffer)
            for sentence in complete:
                self._synthesize(sentence)
        elif action == "finish-task":
            self._synthesize(self.buffer)
            self.buffer = ""
            self._event("task-finished", {"usage": {"characters": self.characters}})

    def _synthesize(self, sentence: str) -> None:
        if not sentence.strip():
            return
        info = {"index": self.sentences, "words": []}
        self._event("result-generated", {"output": {"type": "sentence-begin", "sentence": info,
                                                    "original_text": sentence}})
        self._event("result-generated", {"output": {"type": "sentence-synthesis", "sentence": info}})
        self.queue.put((True, _chime(self.sentences)))
        self.characters += _billing_chars(sentence)
        self._event("result-generated", {"output": {"type": "sentence-end", "sentence": info, "original_text": sentence},
                                         "usage": {"characters": self.characters}})
        self.sentences += 1

    def recv(self) -> tuple[bool, object]:
        try:
            return self.queue.get(timeout=10)
        except queue.Empty:
            raise RuntimeError("mock：语音合成在等一个不会到来的事件（检查指令顺序）") from None

    def close(self) -> None:
        pass


class MockRealtime:
    def __init__(self):
        self.queue: deque[dict] = deque()
        self.audio_started = False
        self.audio_bytes = 0
        self.frames = 0
        self.compact = "none"
        self._seq = 0
        self._emit("session.created", session={"id": "sess_mock", "model": "qwen3.8-omni-flash-realtime"})

    def _emit(self, kind: str, **fields) -> None:
        self._seq += 1
        self.queue.append({"event_id": f"event_mock_{self._seq}", "type": kind, **fields})

    def _error(self, code: str, message: str) -> None:
        self._emit("error", error={"code": code, "message": message})

    def send(self, event: dict) -> None:
        kind = event.get("type")
        if kind == "session.update":
            session = event.get("session") or {}
            compact = ((session.get("video") or {}).get("input") or {}).get("representation_compact", "none")
            if self.audio_started:
                self._error("InvalidOrder", "representation_compact must be set before audio input")
            elif compact not in ("none", "normal"):
                self._error("InvalidParameter", f"representation_compact={compact}")
            else:
                self.compact = compact
                self._emit("session.updated", session=session)
        elif kind == "input_audio_buffer.append":
            self.audio_started = True
            self.audio_bytes += len(base64.b64decode(event.get("audio", "")))
        elif kind == "input_image_buffer.append":
            if not self.audio_bytes:
                self._error("InvalidOrder", "image before audio")
            self.frames += 1
        elif kind == "input_audio_buffer.commit":
            self._emit("input_audio_buffer.committed", item_id="item_user")
            self._emit("conversation.item.created", item={"id": "item_user", "type": "message", "role": "user"})
            self._emit("conversation.item.input_audio_transcription.completed",
                       item_id="item_user", content_index=0, transcript=TRANSCRIPT)
        elif kind == "response.create":
            self._reply()
        elif kind == "session.finish":
            self.queue.clear()
        else:
            self._error("UnknownEvent", str(kind))

    def _reply(self) -> None:
        self._emit("response.created", response={"id": "resp_1", "status": "in_progress", "output": []})
        for i, sentence in enumerate(ANSWER):
            self._emit("response.audio_transcript.delta", response_id="resp_1", delta=sentence)
            self._emit("response.audio.delta", response_id="resp_1", delta=base64.b64encode(_chime(i)).decode())
        text = "".join(ANSWER)
        self._emit("response.audio_transcript.done", response_id="resp_1", transcript=text)
        self._emit("response.audio.done", response_id="resp_1")
        # 官方折算：输入音频每秒 7 Token、输出音频每秒 12.5 Token；1 帧/秒时每 2 秒计一帧，normal 聚合约 1/4。
        # 回答时长按每秒约 4.5 个字估算（提示音只是占位，不代表真实语音长度）
        video = FRAME_TOKENS * math.ceil(self.frames / 2) // (4 if self.compact == "normal" else 1)
        audio_in = math.ceil(self.audio_bytes / 32000 * 7)
        text_in = INSTRUCTION_TOKENS + video
        audio_out = round(len(text) / 4.5 * 12.5)
        usage = {"input_tokens": audio_in + text_in, "output_tokens": len(text) + audio_out,
                 "input_tokens_details": {"text_tokens": text_in, "audio_tokens": audio_in},
                 "output_tokens_details": {"text_tokens": len(text), "audio_tokens": audio_out}}
        message = {"id": "item_reply", "object": "realtime.item", "type": "message", "status": "completed",
                   "role": "assistant", "content": [{"type": "audio", "transcript": text}]}
        self._emit("response.done", response={"id": "resp_1", "status": "completed", "output": [message],
                                              "usage": usage})
        self.audio_bytes = self.frames = 0

    def recv(self) -> dict:
        if not self.queue:
            raise RuntimeError("mock：客户端在等待一个不会到来的事件（检查调用顺序）")
        return self.queue.popleft()

    def close(self) -> None:
        self.queue.clear()
