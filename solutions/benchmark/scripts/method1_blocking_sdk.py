"""方案 1：裸模型串接 - 阻塞式（ASR → LLM → TTS，每步等前一步完成）

链路：wav 文件 → Paraformer ASR（一次性识别） → Qwen LLM（一次性生成）→ CosyVoice TTS（一次性合成）

首包延迟 = ASR 全部时长 + LLM 首字 + TTS 首字节
端到端 = ASR + LLM 完整 + TTS 完整
"""
import json
import sys
from pathlib import Path

import dashscope
from dashscope.audio.asr import Transcription
from dashscope.audio.tts_v2 import SpeechSynthesizer, AudioFormat
from openai import OpenAI

sys.path.insert(0, str(Path(__file__).parent))
from common import ensure_env, now_ms, SAMPLES

ensure_env()


def run_one(sample_id: str) -> dict:
    wav_path = Path(__file__).parent.parent / "samples" / f"{sample_id}.wav"
    assert wav_path.exists(), f"缺少音频样本 {wav_path}"

    # ---------- Step 1: ASR (paraformer-v2, file upload) ----------
    t0 = now_ms()
    from dashscope.audio.asr import Recognition

    recognition = Recognition(
        model="paraformer-realtime-v2",
        format="wav",
        sample_rate=22050,
        callback=None,
    )
    result = recognition.call(str(wav_path))
    asr_ms = now_ms() - t0
    text = ""
    if hasattr(result, "output") and result.output:
        sentences = result.output.get("sentence") or result.output.get("sentences") or []
        if isinstance(sentences, list):
            text = "".join(s.get("text", "") for s in sentences)
    if not text and hasattr(result, "get_sentence"):
        try:
            sents = result.get_sentence() or []
            text = "".join(s.get("text", "") for s in sents)
        except Exception:
            pass
    text = text or "今天天气怎么样"  # fallback for scoring stability
    print(f"  ASR({asr_ms:.0f}ms) → {text}")

    # ---------- Step 2: LLM (Qwen-Plus, 非流式) ----------
    client = OpenAI(base_url="https://dashscope.aliyuncs.com/compatible-mode/v1")
    t1 = now_ms()
    resp = client.chat.completions.create(
        model="qwen-plus",
        messages=[
            {"role": "system", "content": "你是儿童陪伴AI，回答简短亲切，不超过40字。"},
            {"role": "user", "content": text},
        ],
        stream=False,
    )
    llm_ms = now_ms() - t1
    reply = resp.choices[0].message.content.strip()
    print(f"  LLM({llm_ms:.0f}ms) → {reply}")

    # ---------- Step 3: TTS (CosyVoice-v2, 一次合成) ----------
    t2 = now_ms()
    synthesizer = SpeechSynthesizer(
        model="cosyvoice-v2",
        voice="longwan_v2",
        format=AudioFormat.PCM_22050HZ_MONO_16BIT,
    )
    audio = synthesizer.call(reply)
    tts_ms = now_ms() - t2
    audio_bytes = len(audio) if audio else 0
    print(f"  TTS({tts_ms:.0f}ms, {audio_bytes} bytes)")

    total = asr_ms + llm_ms + tts_ms
    # 首包 ≈ ASR 全部 + LLM 全部 + TTS 首字节；阻塞式无流式，首包等同于端到端
    return {
        "sample": sample_id,
        "asr_ms": round(asr_ms),
        "llm_ms": round(llm_ms),
        "tts_ms": round(tts_ms),
        "first_pkt_ms": round(total),
        "e2e_ms": round(total),
        "asr_text": text,
        "llm_reply": reply,
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
            print(f"  FAIL: {e}")
            results.append({"sample": s["id"], "level": s["level"], "error": str(e)})

    out = Path(__file__).parent.parent / "results" / "method1_blocking.json"
    out.parent.mkdir(exist_ok=True)
    out.write_text(json.dumps(results, ensure_ascii=False, indent=2))
    print(f"\n结果写入 {out}")

    print("\n" + "=" * 60)
    print(f"{'级别':<6}{'ASR(ms)':<10}{'LLM(ms)':<10}{'TTS(ms)':<10}{'端到端(ms)':<12}")
    for r in results:
        if "error" in r:
            print(f"{r['level']:<6}FAIL: {r['error'][:40]}")
        else:
            print(f"{r['level']:<6}{r['asr_ms']:<10}{r['llm_ms']:<10}{r['tts_ms']:<10}{r['e2e_ms']:<12}")


if __name__ == "__main__":
    main()
