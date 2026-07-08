"""方案 3b：Qwen-Omni Realtime（qwen3.5-omni-flash-realtime，WebSocket 双工）

链路：PCM 音频 → WebSocket → qwen3.5-omni-flash-realtime → 流式音频输出
体感延迟 = 从音频发送完毕（VAD 判定说话结束）到收到第一个 response.audio.delta

使用 DashScope SDK OmniRealtimeConversation，server_vad 模式。
音频格式：输入 PCM 16kHz/16bit/mono，输出 PCM 24kHz/16bit/mono。

注意：此脚本需要在国内网络环境下运行。海外出口可能因 WebSocket 中间代理
导致 "Invalid close frame" 错误（服务端发送了超过 125 字节的 close frame）。
"""
import base64
import json
import os
import struct
import sys
import threading
import time
import wave
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from common import ensure_env, now_ms, SAMPLES

ensure_env()

import dashscope
from dashscope.audio.qwen_omni import (
    MultiModality,
    OmniRealtimeCallback,
    OmniRealtimeConversation,
)

dashscope.api_key = os.environ["DASHSCOPE_API_KEY"]

MODEL = "qwen3.5-omni-flash-realtime"


def wav_to_pcm16k(wav_path: Path) -> bytes:
    """将 wav 文件转为 16kHz/16bit/mono PCM。"""
    with wave.open(str(wav_path), "rb") as wf:
        assert wf.getnchannels() == 1, "需要单声道"
        assert wf.getsampwidth() == 2, "需要 16bit"
        sr = wf.getframerate()
        raw = wf.readframes(wf.getnframes())
    if sr == 16000:
        return raw
    # 简单最近邻重采样
    samples = struct.unpack(f"<{len(raw) // 2}h", raw)
    ratio = 16000 / sr
    new_len = int(len(samples) * ratio)
    resampled = [samples[min(int(i / ratio), len(samples) - 1)] for i in range(new_len)]
    return struct.pack(f"<{new_len}h", *resampled)


def run_one(sample_id: str) -> dict:
    wav_path = Path(__file__).parent.parent / "samples" / f"{sample_id}.wav"
    pcm_data = wav_to_pcm16k(wav_path)

    result = {
        "sample": sample_id,
        "first_audio_ms": None,
        "last_audio_ms": None,
        "audio_bytes": 0,
        "transcript": "",
        "error": None,
    }

    # 计时：从 VAD 检测到说话结束开始计时（最贴近用户体感）
    t_vad_stop = [0.0]
    response_done = threading.Event()

    class Callback(OmniRealtimeCallback):
        def on_open(self):
            pass

        def on_close(self, close_status_code, close_msg):
            if not response_done.is_set():
                result["error"] = f"连接关闭: {close_status_code} {close_msg}"
                response_done.set()

        def on_event(self, message):
            data = json.loads(message) if isinstance(message, str) else message
            evt = data.get("type", "")

            if evt == "input_audio_buffer.speech_stopped":
                t_vad_stop[0] = now_ms()

            elif evt == "response.audio.delta":
                t_now = now_ms()
                if result["first_audio_ms"] is None:
                    # 如果 VAD 未触发（手动模式），用发送结束时间
                    base_t = t_vad_stop[0] if t_vad_stop[0] > 0 else t_vad_stop[0]
                    result["first_audio_ms"] = t_now - base_t if base_t > 0 else None
                result["last_audio_ms"] = t_now - t_vad_stop[0] if t_vad_stop[0] > 0 else None
                try:
                    result["audio_bytes"] += len(base64.b64decode(data.get("delta", "")))
                except Exception:
                    pass

            elif evt == "response.audio_transcript.delta":
                result["transcript"] += data.get("delta", "")

            elif evt == "response.done":
                response_done.set()

            elif evt == "error":
                result["error"] = data.get("error", {}).get("message", str(data))
                response_done.set()

    cb = Callback()
    conv = OmniRealtimeConversation(model=MODEL, callback=cb)

    try:
        conv.connect()
        time.sleep(1)

        # 使用 server_vad 默认配置，voice=Tina（默认）
        conv.update_session(
            output_modalities=[MultiModality.AUDIO, MultiModality.TEXT],
        )
        time.sleep(0.5)

        if result["error"]:
            return result

        # 分片发送音频（100ms/片 @ 16kHz/16bit = 3200 bytes）
        chunk_size = 3200
        for i in range(0, len(pcm_data), chunk_size):
            chunk = pcm_data[i : i + chunk_size]
            conv.append_audio(base64.b64encode(chunk).decode())
            time.sleep(0.05)  # 模拟实时速率

        # VAD 模式下等待自动触发响应
        response_done.wait(timeout=25)

    except Exception as e:
        result["error"] = str(e)
    finally:
        try:
            conv.close()
        except Exception:
            pass

    # 如果 SDK 提供了内置延迟
    sdk_delay = conv.get_last_first_audio_delay()
    if sdk_delay and result["first_audio_ms"] is None:
        result["first_audio_ms"] = sdk_delay

    return result


def main():
    print(f"[方案3b-Omni Realtime] 模型: {MODEL}")
    print(f"协议: WebSocket (server_vad)\n")

    results = []
    for s in SAMPLES:
        print(f"=== [{s['level']}] {s['text']} ===")
        try:
            r = run_one(s["id"])
            r["level"] = s["level"]
            results.append(r)
            if r["error"]:
                print(f"  ERROR: {r['error']}")
            else:
                print(f"  first_audio: {r['first_audio_ms']:.0f}ms, last_audio: {r['last_audio_ms']:.0f}ms")
                print(f"  transcript: {r['transcript'][:60]}")
        except Exception as e:
            import traceback

            traceback.print_exc()
            results.append({"sample": s["id"], "level": s["level"], "error": str(e)})
        print()

    # 保存结果
    out = Path(__file__).parent.parent / "results" / "method3_omni_realtime.json"
    out.parent.mkdir(exist_ok=True)
    out.write_text(json.dumps(results, ensure_ascii=False, indent=2))
    print(f"结果写入 {out}")

    # 汇总表
    print("\n" + "=" * 60)
    print(f"{'级别':<6}{'体感延迟(ms)':<14}")
    for r in results:
        if r.get("error"):
            print(f"{r['level']:<6}FAIL: {r['error'][:50]}")
        else:
            print(f"{r['level']:<6}{str(r['first_audio_ms']):<14}")


if __name__ == "__main__":
    main()
