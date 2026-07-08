"""方案 3：Qwen-Omni 端到端（qwen3.5-omni-flash，语音进语音出）

链路：wav → qwen3.5-omni-flash（OpenAI 兼容 HTTP stream）→ 流式音频输出
体感延迟 = 从请求发出到收到第一个 audio delta 的时间

注：该模型也有 WebSocket 实时版本 qwen3.5-omni-flash-realtime，
支持连续对话和语义打断，体感延迟预计更低。此处用 HTTP 接口便于跨网络环境复现。
"""
import base64
import json
import sys
import time
from pathlib import Path

from openai import OpenAI

sys.path.insert(0, str(Path(__file__).parent))
from common import ensure_env, now_ms, SAMPLES

ensure_env()


def run_one(sample_id: str) -> dict:
    wav_path = Path(__file__).parent.parent / "samples" / f"{sample_id}.wav"
    audio_b64 = base64.b64encode(wav_path.read_bytes()).decode()

    client = OpenAI(base_url="https://dashscope.aliyuncs.com/compatible-mode/v1")

    t0 = now_ms()
    first_audio_ms = None
    last_audio_ms = None
    transcript = ""
    audio_bytes = 0

    completion = client.chat.completions.create(
        model="qwen3.5-omni-flash",
        messages=[
            {
                "role": "system",
                "content": [{"type": "text", "text": "你是儿童陪伴AI，回答简短亲切，不超过40字。"}],
            },
            {
                "role": "user",
                "content": [
                    {
                        "type": "input_audio",
                        "input_audio": {
                            "data": f"data:audio/wav;base64,{audio_b64}",
                            "format": "wav",
                        },
                    },
                ],
            },
        ],
        modalities=["text", "audio"],
        audio={"voice": "Ethan", "format": "wav"},
        stream=True,
        stream_options={"include_usage": True},
    )

    for chunk in completion:
        if not chunk.choices:
            continue
        delta = chunk.choices[0].delta
        audio_field = getattr(delta, "audio", None)
        if audio_field and isinstance(audio_field, dict):
            data_b64 = audio_field.get("data")
            if data_b64:
                if first_audio_ms is None:
                    first_audio_ms = now_ms() - t0
                last_audio_ms = now_ms() - t0
                try:
                    audio_bytes += len(base64.b64decode(data_b64))
                except Exception:
                    pass
            t = audio_field.get("transcript")
            if t:
                transcript += t

    print(f"  first_audio: {first_audio_ms:.0f}ms, last_audio: {last_audio_ms:.0f}ms")
    print(f"  transcript: {transcript[:60]}")
    print(f"  audio_bytes: {audio_bytes}")

    return {
        "sample": sample_id,
        "first_audio_ms": round(first_audio_ms) if first_audio_ms else None,
        "last_audio_ms": round(last_audio_ms) if last_audio_ms else None,
        "first_pkt_ms": round(first_audio_ms) if first_audio_ms else None,
        "audio_bytes": audio_bytes,
        "transcript": transcript,
    }


def main():
    print("[方案3-Omni] 模型: qwen3.5-omni-flash")

    results = []
    for s in SAMPLES:
        print(f"\n=== [{s['level']}] {s['text']} ===")
        try:
            r = run_one(s["id"])
            r["level"] = s["level"]
            results.append(r)
        except Exception as e:
            import traceback
            traceback.print_exc()
            results.append({"sample": s["id"], "level": s["level"], "error": str(e)})

    out = Path(__file__).parent.parent / "results" / "method3_omni.json"
    out.parent.mkdir(exist_ok=True)
    out.write_text(json.dumps(results, ensure_ascii=False, indent=2))
    print(f"\n结果写入 {out}")

    print("\n" + "=" * 60)
    print(f"{'级别':<6}{'体感延迟(ms)':<14}")
    for r in results:
        if "error" in r:
            print(f"{r['level']:<6}FAIL: {r['error'][:50]}")
        else:
            print(f"{r['level']:<6}{str(r['first_pkt_ms']):<14}")


if __name__ == "__main__":
    main()
