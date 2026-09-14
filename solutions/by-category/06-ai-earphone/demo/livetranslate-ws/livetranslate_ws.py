"""
livetranslate_ws.py — AI 耳机同传最小 demo

默认 mock 模式：不连云、不需 API Key，演示「推音频帧 → 收 translation.text / translation.audio 事件」的回调节奏。
可选 live 模式：设置 DASHSCOPE_API_KEY 后走真实 qwen3.5-livetranslate-flash-realtime。

用法：
  # 离线 mock（推荐 CI / 快速验收）
  python3 livetranslate_ws.py
  python3 livetranslate_ws.py --mode mock --seconds 3

  # 真实 WebSocket（需 dashscope + API Key + 可选 wav）
  python3 livetranslate_ws.py --mode live --audio sample.wav

⚠️ AI 生成代码，仅作接入参考。SDK 类名与事件字段以官方文档为准：
   https://help.aliyun.com/zh/model-studio/qwen3-5-livetranslate-flash-realtime
"""

from __future__ import annotations

import argparse
import os
import sys
import time
import wave
from dataclasses import dataclass, field


MODEL = "qwen3.5-livetranslate-flash-realtime-2026-05-19"
CHUNK_MS = 100


@dataclass
class MockEvent:
    type: str
    text: str = ""
    audio: bytes = b""


@dataclass
class SessionStats:
    frames_sent: int = 0
    text_events: int = 0
    audio_events: int = 0
    texts: list[str] = field(default_factory=list)


def run_mock(seconds: float, source: str, target: str) -> SessionStats:
    """模拟独立线程推帧 + 流式回调（字幕先于整段 done）。"""
    stats = SessionStats()
    frames = max(1, int(seconds * 1000 / CHUNK_MS))
    print(f"[mock] model={MODEL} {source}->{target} frames={frames} chunk={CHUNK_MS}ms")
    print("[mock] connection opened")

    # 假装语义积累后开始出译
    pending = [
        "你好，",
        "欢迎来到",
        "会议。",
    ]
    if target.startswith("en"):
        pending = ["Hello, ", "welcome to ", "the meeting."]

    for i in range(frames):
        stats.frames_sent += 1
        # 前几帧仅「听」，随后吐字幕增量
        if i >= 5 and pending:
            piece = pending.pop(0)
            stats.text_events += 1
            stats.texts.append(piece)
            print(f"[translation.text] {piece}")
            # 同步给一段假 PCM（静音）代表 translation.audio
            stats.audio_events += 1
            pcm = b"\x00\x00" * 160  # 10ms @16k 占位
            print(f"[translation.audio] bytes={len(pcm)}")
        time.sleep(CHUNK_MS / 1000.0)

    print("[mock] connection closed")
    print(
        f"[stats] frames={stats.frames_sent} text_events={stats.text_events} "
        f"audio_events={stats.audio_events} subtitle={''.join(stats.texts)!r}"
    )
    return stats


def run_live(audio_path: str | None, source: str, target: str) -> SessionStats:
    try:
        import dashscope
        from dashscope.audio.qwen_translator import (
            TranslationRealtime,
            TranslationRealtimeCallback,
        )
    except ImportError as e:
        print("live 模式需要安装 dashscope：pip install -r requirements.txt", file=sys.stderr)
        raise SystemExit(1) from e

    api_key = os.getenv("DASHSCOPE_API_KEY")
    if not api_key:
        print("请设置环境变量 DASHSCOPE_API_KEY（见 .env.example）", file=sys.stderr)
        raise SystemExit(1)
    dashscope.api_key = api_key

    stats = SessionStats()

    class Cb(TranslationRealtimeCallback):
        def on_open(self):
            print("[live] connection opened")

        def on_event(self, response):
            # SDK 可能返回对象或 dict，做兼容
            rtype = getattr(response, "type", None) or (
                response.get("type") if isinstance(response, dict) else ""
            )
            if rtype == "translation.text":
                text = getattr(response, "text", None) or (
                    response.get("text") if isinstance(response, dict) else ""
                )
                stats.text_events += 1
                stats.texts.append(str(text))
                print(f"[translation.text] {text}")
            elif rtype == "translation.audio":
                audio = getattr(response, "audio", None) or b""
                stats.audio_events += 1
                print(f"[translation.audio] bytes={len(audio) if audio else 0}")

        def on_close(self):
            print("[live] connection closed")

    translator = TranslationRealtime(
        model=MODEL,
        source_language=source,
        target_language=target,
        callback=Cb(),
    )
    translator.start()

    try:
        if audio_path:
            with wave.open(audio_path, "rb") as wf:
                assert wf.getnchannels() == 1 and wf.getsampwidth() == 2
                rate = wf.getframerate()
                frames_per_chunk = int(rate * CHUNK_MS / 1000)
                while True:
                    data = wf.readframes(frames_per_chunk)
                    if not data:
                        break
                    translator.send_audio_frame(data)
                    stats.frames_sent += 1
                    time.sleep(CHUNK_MS / 1000.0)
        else:
            # 无文件：推送约 2 秒静音，仅验证握手
            silence = b"\x00\x00" * 1600  # 100ms @16k
            for _ in range(20):
                translator.send_audio_frame(silence)
                stats.frames_sent += 1
                time.sleep(CHUNK_MS / 1000.0)
            print("[live] 未提供 --audio，已推送静音帧用于握手验证")
    finally:
        translator.stop()

    print(
        f"[stats] frames={stats.frames_sent} text_events={stats.text_events} "
        f"audio_events={stats.audio_events}"
    )
    return stats


def main() -> None:
    parser = argparse.ArgumentParser(description="AI 耳机 Livetranslate WebSocket demo")
    parser.add_argument("--mode", choices=("mock", "live"), default="mock")
    parser.add_argument("--seconds", type=float, default=2.0, help="mock 推流时长")
    parser.add_argument("--audio", help="live 模式 16k mono wav")
    parser.add_argument("--source", default="zh")
    parser.add_argument("--target", default="en")
    args = parser.parse_args()

    if args.mode == "mock":
        run_mock(args.seconds, args.source, args.target)
    else:
        run_live(args.audio, args.source, args.target)


if __name__ == "__main__":
    main()
