"""方案 4：百炼多模态交互开发套件（全双工套件方案）

链路：PCM 音频 → WebSocket (push2talk) → multimodal-dialog → 流式音频输出
体感延迟 = 从 StopSpeech 发出到收到第一帧 TTS 音频 binary 的时间

协议：百炼多模态交互 WebSocket 协议
  wss://dashscope.aliyuncs.com/api-ws/v1/inference
音频格式：输入 PCM 16kHz/16bit/mono，输出 PCM 24kHz/16bit/mono

环境变量：
  - DASHSCOPE_API_KEY: 百炼 API Key
  - DASHSCOPE_WORKSPACE_ID: 业务空间 ID
  - DASHSCOPE_APP_ID: 多模态交互应用 ID
"""
import base64
import json
import os
import struct
import sys
import threading
import time
import uuid
import wave
from pathlib import Path

import websocket

sys.path.insert(0, str(Path(__file__).parent))
from common import ensure_env, now_ms, SAMPLES

ensure_env()

API_KEY = os.environ["DASHSCOPE_API_KEY"]
WORKSPACE_ID = os.environ.get("DASHSCOPE_WORKSPACE_ID", "")
APP_ID = os.environ.get("DASHSCOPE_APP_ID", "")

if not WORKSPACE_ID or not APP_ID:
    raise RuntimeError(
        "请设置 DASHSCOPE_WORKSPACE_ID 和 DASHSCOPE_APP_ID 环境变量"
    )

WS_URL = "wss://dashscope.aliyuncs.com/api-ws/v1/inference"


def wav_to_pcm16k(wav_path: Path) -> bytes:
    """将 wav 文件转为 16kHz/16bit/mono PCM。"""
    with wave.open(str(wav_path), "rb") as wf:
        assert wf.getnchannels() == 1, "需要单声道"
        assert wf.getsampwidth() == 2, "需要 16bit"
        sr = wf.getframerate()
        raw = wf.readframes(wf.getnframes())
    if sr == 16000:
        return raw
    # 最近邻重采样
    samples = struct.unpack(f"<{len(raw) // 2}h", raw)
    ratio = 16000 / sr
    new_len = int(len(samples) * ratio)
    resampled = [samples[min(int(i / ratio), len(samples) - 1)] for i in range(new_len)]
    return struct.pack(f"<{new_len}h", *resampled)


def run_one(sample_id: str) -> dict:
    wav_path = Path(__file__).parent.parent / "samples" / f"{sample_id}.wav"
    pcm_data = wav_to_pcm16k(wav_path)

    task_id = str(uuid.uuid4())
    result = {
        "sample": sample_id,
        "first_audio_ms": None,
        "last_audio_ms": None,
        "audio_bytes": 0,
        "transcript": "",
        "error": None,
    }

    t_stop_speech = [0.0]
    listening_ready = threading.Event()
    responding_done = threading.Event()
    dialog_id = [None]

    def on_message(ws, message):
        # 文本消息 = JSON 事件，二进制消息 = 音频数据
        if isinstance(message, bytes):
            # 收到 TTS 音频
            t_now = now_ms()
            if result["first_audio_ms"] is None and t_stop_speech[0] > 0:
                result["first_audio_ms"] = t_now - t_stop_speech[0]
            if t_stop_speech[0] > 0:
                result["last_audio_ms"] = t_now - t_stop_speech[0]
            result["audio_bytes"] += len(message)
            return

        # JSON 事件
        data = json.loads(message)
        payload = data.get("payload", {})
        output = payload.get("output", {})
        event = output.get("event", "")

        if event == "Started":
            dialog_id[0] = output.get("dialog_id")

        elif event == "DialogStateChanged":
            state = output.get("state", "")
            if state == "Listening":
                listening_ready.set()

        elif event == "RespondingStarted":
            pass

        elif event == "RespondingContent":
            # LLM 回复文本
            text = output.get("text", "")
            if text:
                result["transcript"] = text

        elif event == "RespondingEnded":
            responding_done.set()

        elif event == "SpeechContent":
            # ASR 识别结果
            pass

        # 检查错误
        header = data.get("header", {})
        if header.get("event") == "task-failed":
            result["error"] = output.get("message", str(data))
            listening_ready.set()
            responding_done.set()

    def on_error(ws, error):
        result["error"] = str(error)
        listening_ready.set()
        responding_done.set()

    def on_close(ws, code, msg):
        listening_ready.set()
        responding_done.set()

    ws = websocket.WebSocketApp(
        WS_URL,
        header=[f"Authorization: Bearer {API_KEY}"],
        on_message=on_message,
        on_error=on_error,
        on_close=on_close,
    )

    wst = threading.Thread(target=ws.run_forever, daemon=True)
    wst.start()
    time.sleep(0.5)

    # 1. 发送 run-task（Start）
    start_msg = {
        "header": {
            "action": "run-task",
            "task_id": task_id,
            "streaming": "duplex",
        },
        "payload": {
            "task_group": "aigc",
            "task": "multimodal-generation",
            "function": "generation",
            "model": "multimodal-dialog",
            "input": {
                "directive": "Start",
                "workspace_id": WORKSPACE_ID,
                "app_id": APP_ID,
            },
            "parameters": {
                "upstream": {
                    "type": "AudioOnly",
                    "mode": "push2talk",
                    "audio_format": "pcm",
                    "sample_rate": 16000,
                },
                "downstream": {
                    "voice": "longanhuan",
                    "sample_rate": 24000,
                    "audio_format": "pcm",
                    "intermediate_text": "transcript,dialog",
                },
                "client_info": {
                    "user_id": "benchmark",
                    "device": {"uuid": "benchmark_device"},
                },
            },
        },
    }
    ws.send(json.dumps(start_msg))

    # 2. 等待 Listening 状态
    if not listening_ready.wait(timeout=10):
        result["error"] = "listening timeout"
        ws.close()
        return result
    if result["error"]:
        ws.close()
        return result

    # 3. SendSpeech
    send_speech_msg = {
        "header": {
            "action": "continue-task",
            "task_id": task_id,
            "streaming": "duplex",
        },
        "payload": {
            "input": {"directive": "SendSpeech"},
        },
    }
    ws.send(json.dumps(send_speech_msg))
    time.sleep(0.1)

    # 4. 流式发送音频 binary（3200 bytes / 50ms）
    chunk_size = 3200
    for i in range(0, len(pcm_data), chunk_size):
        chunk = pcm_data[i : i + chunk_size]
        ws.send(chunk, opcode=websocket.ABNF.OPCODE_BINARY)
        time.sleep(0.05)

    # 5. StopSpeech（计时起点）
    t_stop_speech[0] = now_ms()
    stop_speech_msg = {
        "header": {
            "action": "continue-task",
            "task_id": task_id,
            "streaming": "duplex",
        },
        "payload": {
            "input": {"directive": "StopSpeech"},
        },
    }
    ws.send(json.dumps(stop_speech_msg))

    # 6. 等待回复完成
    if not responding_done.wait(timeout=60):
        result["error"] = "response timeout"

    # 7. LocalRespondingEnded + Stop
    try:
        ws.send(json.dumps({
            "header": {"action": "continue-task", "task_id": task_id, "streaming": "duplex"},
            "payload": {"input": {"directive": "LocalRespondingEnded"}},
        }))
        time.sleep(0.2)
        ws.send(json.dumps({
            "header": {"action": "finish-task", "task_id": task_id, "streaming": "duplex"},
            "payload": {"input": {"directive": "Stop", "dialog_id": dialog_id[0] or ""}},
        }))
    except Exception:
        pass

    time.sleep(0.5)
    ws.close()
    return result


def main():
    print("[方案4] 百炼多模态交互开发套件（push2talk）")
    print(f"协议: WebSocket ({WS_URL})\n")

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
    out = Path(__file__).parent.parent / "results" / "method4_duplex.json"
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
