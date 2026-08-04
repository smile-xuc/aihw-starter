"""
glasses_omni_realtime.py — AI 眼镜「给 AI 打电话」实时链路（高性能路线）

qwen3.5-omni-flash-realtime：连续音频流 + 视频帧的全双工实时交互。
模拟眼镜「按住镜腿通话」场景：
  ① 建立 realtime 会话（WebSocket）
  ② 持续推送麦克风音频（本 demo 用 wav 文件分块模拟）
  ③ 按约 1 fps 推送摄像头画面（本 demo 用图片文件模拟视频帧）
  ④ 实时接收 AI 的语音回复流并落盘

定位：高性能路线——亚秒级响应、原生可打断、AI 实时看你所见；
按时长计费，成本高于套件基础对话一个数量级，适合旗舰档体验。

用法：
  python glasses_omni_realtime.py --audio question.wav --frame view.jpg

⚠️ AI 生成代码，仅作接入参考。realtime 协议与 SDK 接口以官方文档为准：
   https://help.aliyun.com/zh/model-studio/omni-realtime
"""

import argparse
import base64
import os
import sys
import time

import dashscope
from dashscope.audio.qwen_omni import (
    AudioFormat,
    MultiModality,
    OmniRealtimeCallback,
    OmniRealtimeConversation,
)

MODEL = "qwen3.5-omni-flash-realtime"
CHUNK_MS = 100          # 音频分块时长（模拟实时采集节奏）
FRAME_INTERVAL_S = 1.0  # 视频帧间隔：约 1 fps 已可支撑「看见你所见」，帧率翻倍成本近似翻倍


class GlassesCallback(OmniRealtimeCallback):
    """接收云端事件：转写文本、回复文本、回复音频流。"""

    def __init__(self, output_audio: str):
        self.output_audio = output_audio
        self._audio = bytearray()

    def on_open(self) -> None:
        print("[会话] 已连接")

    def on_event(self, response: dict) -> None:
        event_type = response.get("type", "")
        if event_type == "conversation.item.input_audio_transcription.completed":
            print(f"[识别] {response.get('transcript', '')}")
        elif event_type == "response.audio_transcript.delta":
            print(response.get("delta", ""), end="", flush=True)
        elif event_type == "response.audio.delta":
            self._audio.extend(base64.b64decode(response.get("delta", "")))
        elif event_type == "response.done":
            print("\n[回复] 完成")

    def on_close(self, close_status_code, close_msg) -> None:
        if self._audio:
            with open(self.output_audio, "wb") as f:
                f.write(self._audio)
            print(f"[会话] 已关闭，回复音频 → {self.output_audio}（24k PCM）")


def stream_audio(conversation: OmniRealtimeConversation, wav_path: str) -> None:
    """按实时节奏分块推送音频（模拟眼镜麦克风流）。"""
    chunk_bytes = int(16000 * 2 * CHUNK_MS / 1000)  # 16k 16bit 单声道
    with open(wav_path, "rb") as f:
        f.seek(44)  # 跳过 wav 头
        while chunk := f.read(chunk_bytes):
            conversation.append_audio(base64.b64encode(chunk).decode("utf-8"))
            time.sleep(CHUNK_MS / 1000)


def send_frame(conversation: OmniRealtimeConversation, image_path: str) -> None:
    """推送一帧摄像头画面（模拟约 1 fps 视频流中的一帧）。"""
    with open(image_path, "rb") as f:
        frame_b64 = base64.b64encode(f.read()).decode("utf-8")
    conversation.append_video(frame_b64)


def main() -> None:
    parser = argparse.ArgumentParser(description="AI 眼镜 omni 实时链路 demo")
    parser.add_argument("--audio", required=True, help="用户提问音频（wav，16k 单声道）")
    parser.add_argument("--frame", help="摄像头画面（jpg/png），模拟视频帧")
    parser.add_argument("--output", default="omni_reply.pcm", help="AI 回复音频输出")
    args = parser.parse_args()

    api_key = os.getenv("DASHSCOPE_API_KEY")
    if not api_key:
        print("请先设置环境变量 DASHSCOPE_API_KEY（见 .env.example）", file=sys.stderr)
        sys.exit(1)
    dashscope.api_key = api_key

    callback = GlassesCallback(args.output)
    conversation = OmniRealtimeConversation(model=MODEL, callback=callback)
    conversation.connect()
    conversation.update_session(
        output_modalities=[MultiModality.AUDIO, MultiModality.TEXT],
        input_audio_format=AudioFormat.PCM_16000HZ_MONO_16BIT,
        output_audio_format=AudioFormat.PCM_24000HZ_MONO_16BIT,
        enable_input_audio_transcription=True,
        enable_turn_detection=True,   # 服务端 VAD 自动断句
    )

    if args.frame:
        send_frame(conversation, args.frame)   # AI「看见」眼前画面
    stream_audio(conversation, args.audio)     # 用户开口提问

    time.sleep(8)  # 等待回复流结束（生产环境以 response.done 事件驱动）
    conversation.close()


if __name__ == "__main__":
    main()
