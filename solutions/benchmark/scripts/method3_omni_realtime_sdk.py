"""方案 3b：Qwen-Omni Realtime（qwen3.5-omni-flash-realtime，WebSocket 双工）

链路：PCM 音频 → WebSocket → qwen3.5-omni-flash-realtime → 流式音频输出
体感延迟 = 从 VAD 检测到说话结束到收到第一个 response.audio.delta

协议：server_vad 模式（服务端自动检测语音结束并触发响应）。
音频格式：输入 PCM 16kHz/16bit/mono，输出 PCM 24kHz/16bit/mono。

环境变量：
  - DASHSCOPE_API_KEY: 百炼 API Key
  - DASHSCOPE_WORKSPACE_ID: 业务空间 ID（用于拼接 WebSocket URL）
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

import websocket

sys.path.insert(0, str(Path(__file__).parent))
from common import ensure_env, now_ms, SAMPLES

ensure_env()

API_KEY = os.environ["DASHSCOPE_API_KEY"]
WORKSPACE_ID = os.environ.get("DASHSCOPE_WORKSPACE_ID", "")
if not WORKSPACE_ID:
    raise RuntimeError(
        "DASHSCOPE_WORKSPACE_ID 未设置。"
        "请在 benchmark/.env 中添加 DASHSCOPE_WORKSPACE_ID=<your-workspace-id>"
    )

WS_URL = (
    f"wss://{WORKSPACE_ID}.cn-beijing.maas.aliyuncs.com"
    f"/api-ws/v1/realtime?model=qwen3.5-omni-flash-realtime"
)


def wav_to_pcm16k(wav_path: Path) -> bytes:
    """将 wav 文件转为 16kHz/16bit/mono PCM。"""
    with wave.open(str(wav_path), "rb") as wf:
        assert wf.getnchannels() == 1, "需要单声道"
        assert wf.getsampwidth() == 2, "需要 16bit"
        sr = wf.getframerate()
        raw = wf.readframes(wf.getnframes())
    if sr == 16000:
        return raw
    samples = struct.unpack(f"<{len(raw) // 2}h", raw)
    ratio = 16000 / sr
    new_len = int(len(samples) * ratio)
    resampled = [samples[min(int(i / ratio), len(samples) - 1)] for i in range(new_len)]
    return struct.pack(f"<{new_len}h", *resampled)


def run_one(sample_id: str) -> dict:
    wav_path = Path(__file__).parent.parent / "samples" / f"{sample_id}.wav"
    pcm_data = wav_to_pcm16k(wav_path)
    # 追加 1 秒静音让 server_vad 能检测到说话结束
    pcm_data += b"\x00" * 32000

    result = {
        "sample": sample_id,
        "first_audio_ms": None,
        "last_audio_ms": None,
        "audio_bytes": 0,
        "transcript": "",
        "error": None,
    }

    t_vad_stop = [0.0]
    t_send_done = [0.0]
    session_ok = threading.Event()
    session_updated = threading.Event()
    done = threading.Event()

    def on_message(ws, message):
        data = json.loads(message)
        evt = data.get("type", "")

        if evt == "session.created":
            # 配置 session：加 instructions
            ws.send(json.dumps({
                "type": "session.update",
                "session": {
                    "modalities": ["text", "audio"],
                    "instructions": "你是儿童陪伴AI，回答简短亲切，不超过40字。",
                },
            }))
            session_ok.set()

        elif evt == "session.updated":
            session_updated.set()

        elif evt == "input_audio_buffer.speech_stopped":
            t_vad_stop[0] = now_ms()

        elif evt == "response.audio.delta":
            base_t = t_vad_stop[0] if t_vad_stop[0] > 0 else t_send_done[0]
            if result["first_audio_ms"] is None and base_t > 0:
                result["first_audio_ms"] = now_ms() - base_t
            if base_t > 0:
                result["last_audio_ms"] = now_ms() - base_t
            try:
                result["audio_bytes"] += len(base64.b64decode(data.get("delta", "")))
            except Exception:
                pass

        elif evt == "response.audio_transcript.delta":
            result["transcript"] += data.get("delta", "")

        elif evt == "response.done":
            done.set()

        elif evt == "error":
            result["error"] = data.get("error", {}).get("message", str(data))
            done.set()

    def on_error(ws, error):
        result["error"] = str(error)
        session_ok.set()
        session_updated.set()
        done.set()

    def on_close(ws, close_status_code, close_msg):
        if not done.is_set():
            result["error"] = result.get("error") or f"closed: {close_status_code} {close_msg}"
        session_ok.set()
        session_updated.set()
        done.set()

    ws = websocket.WebSocketApp(
        WS_URL,
        header=[f"Authorization: Bearer {API_KEY}"],
        on_open=lambda ws: None,
        on_message=on_message,
        on_error=on_error,
        on_close=on_close,
    )

    wst = threading.Thread(target=ws.run_forever, daemon=True)
    wst.start()

    # 等待 session 建立 + update 完成
    session_ok.wait(timeout=10)
    session_updated.wait(timeout=5)
    if result["error"]:
        return result
    time.sleep(0.2)

    # 分片发送音频（100ms/片 @ 16kHz/16bit = 3200 bytes）
    chunk_size = 3200
    for i in range(0, len(pcm_data), chunk_size):
        try:
            ws.send(json.dumps({
                "type": "input_audio_buffer.append",
                "audio": base64.b64encode(pcm_data[i : i + chunk_size]).decode(),
            }))
        except Exception as e:
            result["error"] = str(e)
            return result
        time.sleep(0.02)

    t_send_done[0] = now_ms()

    # 等待 VAD 触发响应并完成
    done.wait(timeout=25)
    ws.close()
    return result


def main():
    print(f"[方案3b-Omni Realtime] 模型: qwen3.5-omni-flash-realtime")
    print(f"协议: WebSocket (server_vad)\n")

    results = []
    for s in SAMPLES:
        print(f"=== [{s['level']}] {s['text']} ===")
        try:
            r = run_one(s["id"])
            r["level"] = s["level"]
            results.append(r)
            if r["error"]:
                print(f"  ERROR: {r['error'][:80]}")
            elif r["first_audio_ms"] is not None:
                print(f"  体感延迟: {r['first_audio_ms']:.0f}ms (last_audio: {r['last_audio_ms']:.0f}ms)")
                print(f"  transcript: {r['transcript'][:60]}")
            else:
                print("  No audio received")
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
        elif r["first_audio_ms"] is not None:
            print(f"{r['level']:<6}{r['first_audio_ms']:.0f}")
        else:
            print(f"{r['level']:<6}N/A")


if __name__ == "__main__":
    main()
