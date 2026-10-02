"""mock.py — 离线假 Livetranslate 服务端

与 WsTransport 同接口（send / recv / close），按 qwen3.8-livetranslate-flash-realtime 的官方服务端事件回放：
  session.created → session.updated → 随推流进度：
  input_audio_buffer.speech_started（带 speaker_id）→ 原文识别增量 → response.created →
  conversation.item.created（previous_item_id 指向原文）→ response.audio_transcript.delta（只出字幕时为
  response.text.delta）+ response.audio.delta → 原文识别完成 → response.done（含 usage）→
  收到 session.finish 后补完最后一句，再发 session.finished。
句子与时间轴取自 samples/expo_guide_zh.json（与 WAV 同时合成）；英文译文、提示音和用量为固定示意。
"""
from __future__ import annotations

import base64
import json
import math
import queue
from array import array
from pathlib import Path

SCRIPT = Path(__file__).resolve().parent / "samples" / "expo_guide_zh.json"
TRANSLATIONS = [
    "Hello everyone, and welcome to the earphone production line.",
    "This is the acoustic test area. Every pair of earphones goes through three noise-cancellation checks "
    "before it leaves the factory.",
    "After the tour, trial units are available at the front desk.",
]
BYTES_PER_MS = 32                     # 16 kHz / 16 bit / 单声道
SILENCE_MS = 800                      # 句尾静音多久判定这句说完（示意）
# 用量折算（使用指南「计费说明」）：输入音频 7 Token / 秒，输出音频 12.5 Token / 秒；
# 英文按每词约 1.3 Token、语速每秒 2.5 词估算
AUDIO_IN_TPS, AUDIO_OUT_TPS = 7, 12.5


def _chime(index: int, rate: int = 24000, seconds: float = 0.25) -> bytes:
    """每段译文一个轻柔提示音，代替真实合成语音。"""
    freq = (523.25, 659.25, 783.99)[index % 3]
    n = int(rate * seconds)
    samples = array("h", (int(4000 * math.sin(2 * math.pi * freq * i / rate) * math.sin(math.pi * i / n))
                          for i in range(n)))
    return samples.tobytes()


def _halves(words: list[str]) -> tuple[list[str], list[str]]:
    cut = max(1, len(words) // 2)
    return words[:cut], words[cut:]


class MockLiveTranslate:
    def __init__(self):
        meta = json.loads(SCRIPT.read_text(encoding="utf-8"))
        self.duration_ms = int(meta["duration_ms"])
        self.sentences = meta["sentences"]
        self.queue: queue.Queue[dict] = queue.Queue()
        self.audio_ms = 0.0
        self.stage = [0] * len(self.sentences)   # 0 未开始 / 1 已开口 / 2 已出半句 / 3 已完成
        self.text_only = False
        self.configured = False
        self._seq = 0
        self._emit("session.created", session=self._session(["text", "audio"], "en"))

    # ── 事件工具 ──
    def _emit(self, kind: str, **fields) -> None:
        self._seq += 1
        self.queue.put({"event_id": f"event_mock_{self._seq}", "type": kind, **fields})

    @staticmethod
    def _session(modalities: list[str], language: str) -> dict:
        return {"id": "sess_mock", "object": "realtime.session", "model": "qwen3.8-livetranslate-flash-realtime",
                "input_modalities": ["audio"], "output_modalities": modalities,
                "audio": {"input": {"format": {"type": "pcm", "sample_rate": 16000},
                                    "turn_detection": {"type": "speaker_detection", "threshold": 0.5,
                                                       "silence_duration_ms": 1000}},
                          "output": {"format": {"type": "pcm", "sample_rate": 24000}, "voice": "Tina"}},
                "translation": {"language": language}}

    # ── 客户端事件 ──
    def send(self, event: dict) -> None:
        kind = event.get("type")
        if kind == "session.update":
            session = event.get("session") or {}
            modalities = session.get("output_modalities")
            if "modalities" in session or modalities not in (["text"], ["text", "audio"]):
                self._emit("error", error={"type": "invalid_request_error", "code": "invalid_value",
                                           "message": "mock：qwen3.8-livetranslate 用 output_modalities，"
                                                      "取值 ['text'] 或 ['text', 'audio']",
                                           "param": "session.output_modalities"})
                return
            self.text_only = modalities == ["text"]
            self.configured = True
            translation = session.get("translation") or {}
            updated = self._session(modalities, translation.get("language", "en"))
            if translation.get("corpus"):
                updated["translation"]["corpus"] = translation["corpus"]
            self._emit("session.updated", session=updated)
        elif kind == "input_audio_buffer.append":
            if not self.configured:
                self._emit("error", error={"type": "invalid_request_error", "code": "invalid_order",
                                           "message": "mock：先发 session.update"})
                return
            self.audio_ms += len(base64.b64decode(event.get("audio", ""))) / BYTES_PER_MS
            self._advance(self.audio_ms)
        elif kind == "session.finish":
            for i in range(len(self.sentences)):  # 只补完已经开口的句子
                if self.stage[i]:
                    self._to_stage(i, 3)
            self._emit("session.finished")
        else:
            self._emit("error", error={"type": "invalid_request_error", "code": "unknown_event",
                                       "message": str(kind)})

    # ── 按推流进度回放 ──
    def _advance(self, audio_ms: float) -> None:
        for i, s in enumerate(self.sentences):
            begin, end = s["begin_time"], s["end_time"]
            if audio_ms >= end + SILENCE_MS:
                self._to_stage(i, 3)
            elif audio_ms >= (begin + end) / 2:
                self._to_stage(i, 2)
            elif audio_ms >= begin + 300:
                self._to_stage(i, 1)

    def _to_stage(self, i: int, target: int) -> None:
        while self.stage[i] < target:
            self.stage[i] += 1
            (self._started, self._half, self._done)[self.stage[i] - 1](i)

    def _started(self, i: int) -> None:
        s = self.sentences[i]
        self._emit("input_audio_buffer.speech_started", audio_start_ms=s["begin_time"], item_id=f"item_asr_{i}",
                   speaker_id=s.get("speaker_id", 0))

    def _half(self, i: int) -> None:
        text, words = self.sentences[i]["text"], self._words(i)
        rid, tid = f"resp_{i}", f"item_tr_{i}"
        self._emit("conversation.item.input_audio_transcription.delta", item_id=f"item_asr_{i}", content_index=0,
                   delta=text[:len(text) // 2])
        self._emit("response.created", response={"id": rid, "object": "realtime.response", "status": "in_progress",
                                                  "modalities": self._modalities(), "output": []})
        self._emit("conversation.item.created", previous_item_id=f"item_asr_{i}",
                   item={"id": tid, "object": "realtime.item", "type": "message", "status": "in_progress",
                         "role": "assistant", "content": []})
        self._deltas(i, _halves(words)[0], first=True)

    def _done(self, i: int) -> None:
        s, words = self.sentences[i], self._words(i)
        rid, tid = f"resp_{i}", f"item_tr_{i}"
        self._emit("input_audio_buffer.speech_stopped", audio_end_ms=s["end_time"], item_id=f"item_asr_{i}")
        self._emit("conversation.item.input_audio_transcription.delta", item_id=f"item_asr_{i}", content_index=0,
                   delta=s["text"][len(s["text"]) // 2:])
        self._emit("conversation.item.input_audio_transcription.completed", item_id=f"item_asr_{i}",
                   content_index=0, transcript=s["text"])
        self._deltas(i, _halves(words)[1], first=False)
        translation = " ".join(words)
        if self.text_only:
            self._emit("response.text.done", response_id=rid, item_id=tid, output_index=0, content_index=0,
                       text=translation)
            content = {"type": "text", "text": translation}
        else:
            self._emit("response.audio_transcript.done", response_id=rid, item_id=tid, output_index=0,
                       content_index=0, transcript=translation)
            self._emit("response.audio.done", response_id=rid, item_id=tid, output_index=0, content_index=0)
            content = {"type": "audio", "transcript": translation}
        self._emit("response.done", response={
            "id": rid, "object": "realtime.response", "status": "completed", "modalities": self._modalities(),
            "output": [{"id": tid, "object": "realtime.item", "type": "message", "status": "completed",
                        "role": "assistant", "content": [content]}],
            "usage": self._usage(i, words)})

    def _deltas(self, i: int, words: list[str], first: bool) -> None:
        kind = "response.text.delta" if self.text_only else "response.audio_transcript.delta"
        for j in range(0, len(words), 3):
            piece = ("" if first and j == 0 else " ") + " ".join(words[j:j + 3])
            self._emit(kind, response_id=f"resp_{i}", item_id=f"item_tr_{i}", output_index=0, content_index=0,
                       delta=piece)
            if not self.text_only:
                self._emit("response.audio.delta", response_id=f"resp_{i}", item_id=f"item_tr_{i}", output_index=0,
                           content_index=0, delta=base64.b64encode(_chime(i)).decode())

    def _words(self, i: int) -> list[str]:
        return (TRANSLATIONS[i] if i < len(TRANSLATIONS) else "(translation)").split()

    def _modalities(self) -> list[str]:
        return ["text"] if self.text_only else ["text", "audio"]

    def _usage(self, i: int, words: list[str]) -> dict:
        """本句用量（示意）：上一句结束到本句结束这段音频 + 本句译文；最后一句算到音频末尾。"""
        start = self.sentences[i - 1]["end_time"] if i else 0
        end = self.duration_ms if i == len(self.sentences) - 1 else self.sentences[i]["end_time"]
        audio_in = math.ceil((end - start) / 1000 * AUDIO_IN_TPS)
        text_out = math.ceil(len(words) * 1.3)
        audio_out = 0 if self.text_only else math.ceil(len(words) / 2.5 * AUDIO_OUT_TPS)
        return {"total_tokens": audio_in + text_out + audio_out, "input_tokens": audio_in,
                "output_tokens": text_out + audio_out,
                "input_tokens_details": {"text_tokens": 0, "audio_tokens": audio_in},
                "output_tokens_details": {"text_tokens": text_out, "audio_tokens": audio_out}}

    # ── 传输接口 ──
    def recv(self, timeout: float = 1.0) -> dict | None:
        try:
            return self.queue.get(timeout=timeout)
        except queue.Empty:
            return None

    def close(self) -> None:
        pass
