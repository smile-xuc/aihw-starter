"""方案 3：Qwen-Omni 端到端（语音进语音出）

链路：wav → qwen-omni-turbo-realtime（同一模型直接吐出文字+音频）
首包延迟 = 从上传到收到首个音频块的时间
端到端 = 首个到最后一个音频块
使用 OpenAI 兼容协议 (chat.completions) 流式调用。
"""
import base64
import json
import sys
from pathlib import Path

from openai import OpenAI

sys.path.insert(0, str(Path(__file__).parent))
from common import get_api_key, mask_key, now_ms, SAMPLES

API_KEY = get_api_key()
print(f"[方案3-Omni] 使用 key {mask_key(API_KEY)}")


def run_one(sample_id: str) -> dict:
    wav_path = Path(__file__).parent.parent / "samples" / f"{sample_id}.wav"
    audio_b64 = base64.b64encode(wav_path.read_bytes()).decode()

    client = OpenAI(api_key=API_KEY, base_url="https://dashscope.aliyuncs.com/compatible-mode/v1")

    t0 = now_ms()
    first_text_ms = None
    first_audio_ms = None
    last_audio_ms = None
    text_out = ""
    audio_bytes = 0

    completion = client.chat.completions.create(
        model="qwen-omni-turbo",
        messages=[
            {"role": "system", "content": [{"type": "text", "text": "你是儿童陪伴AI，回答简短亲切，不超过40字。"}]},
            {
                "role": "user",
                "content": [
                    {"type": "input_audio", "input_audio": {"data": f"data:audio/wav;base64,{audio_b64}", "format": "wav"}},
                ],
            },
        ],
        modalities=["text", "audio"],
        audio={"voice": "Cherry", "format": "wav"},
        stream=True,
        stream_options={"include_usage": True},
    )

    for chunk in completion:
        if not chunk.choices:
            continue
        delta = chunk.choices[0].delta
        # 文本增量
        if hasattr(delta, "content") and delta.content:
            if first_text_ms is None:
                first_text_ms = now_ms() - t0
            text_out += delta.content
        # audio 字段（Qwen-Omni: delta.audio 是 dict，含 data/transcript）
        audio_field = getattr(delta, "audio", None)
        if audio_field:
            data_b64 = audio_field.get("data") if isinstance(audio_field, dict) else None
            transcript = audio_field.get("transcript") if isinstance(audio_field, dict) else None
            if data_b64:
                if first_audio_ms is None:
                    first_audio_ms = now_ms() - t0
                last_audio_ms = now_ms() - t0
                try:
                    audio_bytes += len(base64.b64decode(data_b64))
                except Exception:
                    pass
            if transcript:
                if first_text_ms is None:
                    first_text_ms = now_ms() - t0
                text_out += transcript

    total = now_ms() - t0
    print(f"  first_text: {first_text_ms}ms, first_audio: {first_audio_ms}ms, last_audio: {last_audio_ms}ms")
    print(f"  text_out: {text_out}")
    print(f"  audio_bytes: {audio_bytes}, total: {total:.0f}ms")

    return {
        "sample": sample_id,
        "first_text_ms": round(first_text_ms) if first_text_ms else None,
        "first_audio_ms": round(first_audio_ms) if first_audio_ms else None,
        "last_audio_ms": round(last_audio_ms) if last_audio_ms else None,
        "first_pkt_ms": round(first_audio_ms) if first_audio_ms else round(first_text_ms or total),
        "e2e_ms": round(last_audio_ms) if last_audio_ms else round(total),
        "audio_bytes": audio_bytes,
        "text_out": text_out,
    }


def main():
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

    print("\n" + "=" * 70)
    print(f"{'级别':<6}{'首text':<10}{'首audio':<10}{'末audio':<10}{'首包':<8}{'端到端':<8}")
    for r in results:
        if "error" in r:
            print(f"{r['level']:<6}FAIL: {r['error'][:50]}")
        else:
            print(f"{r['level']:<6}{str(r['first_text_ms']):<10}{str(r['first_audio_ms']):<10}{str(r['last_audio_ms']):<10}{r['first_pkt_ms']:<8}{r['e2e_ms']:<8}")


if __name__ == "__main__":
    main()
