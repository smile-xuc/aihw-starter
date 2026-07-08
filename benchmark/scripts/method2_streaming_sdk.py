"""方案 2：裸模型串接 - 流式（ASR 一次性 + LLM 流式 + TTS 流式）

链路：wav → ASR → LLM(stream) → 首字达到即启动 TTS(stream)
首包延迟 = ASR + LLM 首字 + TTS 首音频块
端到端 = ASR + LLM 完整 + 最后一个 TTS 音频块
"""
import json
import sys
import threading
import time
from pathlib import Path

import dashscope
from dashscope.audio.tts_v2 import SpeechSynthesizer, AudioFormat, ResultCallback
from dashscope.audio.asr import Recognition
from openai import OpenAI

sys.path.insert(0, str(Path(__file__).parent))
from common import get_api_key, mask_key, now_ms, SAMPLES

API_KEY = get_api_key()
dashscope.api_key = API_KEY
print(f"[方案2-流式] 使用 key {mask_key(API_KEY)}")


class TTSCallback(ResultCallback):
    def __init__(self):
        self.first_audio_ms = None
        self.last_audio_ms = None
        self.total_bytes = 0
        self._start = now_ms()

    def on_data(self, data: bytes) -> None:
        if self.first_audio_ms is None:
            self.first_audio_ms = now_ms() - self._start
        self.last_audio_ms = now_ms() - self._start
        self.total_bytes += len(data)

    def on_complete(self):
        pass

    def on_error(self, message):
        print(f"    TTS error: {message}")

    def on_close(self):
        pass


def run_one(sample_id: str) -> dict:
    wav_path = Path(__file__).parent.parent / "samples" / f"{sample_id}.wav"

    # ---------- Step 1: ASR ----------
    t0 = now_ms()
    recognition = Recognition(model="paraformer-realtime-v2", format="wav", sample_rate=22050, callback=None)
    result = recognition.call(str(wav_path))
    asr_ms = now_ms() - t0
    text = ""
    if hasattr(result, "output") and result.output:
        sentences = result.output.get("sentence") or []
        if isinstance(sentences, list):
            text = "".join(s.get("text", "") for s in sentences)
    text = text or "今天天气怎么样"
    print(f"  ASR({asr_ms:.0f}ms) → {text}")

    # ---------- Step 2+3: LLM stream 边生成边送 TTS ----------
    client = OpenAI(api_key=API_KEY, base_url="https://dashscope.aliyuncs.com/compatible-mode/v1")

    tts_cb = TTSCallback()
    synthesizer = SpeechSynthesizer(
        model="cosyvoice-v2",
        voice="longwan_v2",
        format=AudioFormat.PCM_22050HZ_MONO_16BIT,
        callback=tts_cb,
    )

    t_pipe_start = now_ms()
    tts_cb._start = t_pipe_start

    llm_first_token_ms = None
    llm_full_text = ""
    stream = client.chat.completions.create(
        model="qwen-plus",
        messages=[
            {"role": "system", "content": "你是儿童陪伴AI，回答简短亲切，不超过40字。"},
            {"role": "user", "content": text},
        ],
        stream=True,
    )
    buffer = ""
    for chunk in stream:
        delta = chunk.choices[0].delta.content or ""
        if not delta:
            continue
        if llm_first_token_ms is None:
            llm_first_token_ms = now_ms() - t_pipe_start
        buffer += delta
        llm_full_text += delta
        # 每积累到标点或 8 个字符送一次到 TTS
        while len(buffer) >= 8 or any(p in buffer for p in "。！？，,.!?"):
            # 找一个断点
            cut = -1
            for i, ch in enumerate(buffer):
                if ch in "。！？，,.!?":
                    cut = i + 1
                    break
            if cut < 0 and len(buffer) >= 8:
                cut = len(buffer)
            if cut < 0:
                break
            piece, buffer = buffer[:cut], buffer[cut:]
            synthesizer.streaming_call(piece)
    if buffer:
        synthesizer.streaming_call(buffer)
    synthesizer.streaming_complete()

    # 等 TTS 播完
    for _ in range(200):
        if tts_cb.last_audio_ms is not None:
            time.sleep(0.05)
            # 停止条件：500ms 内没有新音频
            last = tts_cb.last_audio_ms
            time.sleep(0.5)
            if tts_cb.last_audio_ms == last:
                break
        else:
            time.sleep(0.05)

    llm_ms = now_ms() - t_pipe_start
    print(f"  LLM 首token: {llm_first_token_ms:.0f}ms, LLM 完成: {llm_ms:.0f}ms → {llm_full_text}")
    print(f"  TTS 首字节: {tts_cb.first_audio_ms}ms, 最后一块: {tts_cb.last_audio_ms}ms, 总 {tts_cb.total_bytes} bytes")

    first_pkt = asr_ms + (tts_cb.first_audio_ms or 0)
    e2e = asr_ms + (tts_cb.last_audio_ms or llm_ms)

    return {
        "sample": sample_id,
        "asr_ms": round(asr_ms),
        "llm_first_token_ms": round(llm_first_token_ms or 0),
        "llm_full_ms": round(llm_ms),
        "tts_first_audio_ms": round(tts_cb.first_audio_ms or 0),
        "tts_last_audio_ms": round(tts_cb.last_audio_ms or 0),
        "first_pkt_ms": round(first_pkt),
        "e2e_ms": round(e2e),
        "asr_text": text,
        "llm_reply": llm_full_text,
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

    out = Path(__file__).parent.parent / "results" / "method2_streaming.json"
    out.parent.mkdir(exist_ok=True)
    out.write_text(json.dumps(results, ensure_ascii=False, indent=2))
    print(f"\n结果写入 {out}")

    print("\n" + "=" * 70)
    print(f"{'级别':<6}{'ASR':<8}{'LLM首token':<12}{'TTS首字节':<12}{'首包':<8}{'端到端':<8}")
    for r in results:
        if "error" in r:
            print(f"{r['level']:<6}FAIL: {r['error'][:50]}")
        else:
            print(f"{r['level']:<6}{r['asr_ms']:<8}{r['llm_first_token_ms']:<12}{r['tts_first_audio_ms']:<12}{r['first_pkt_ms']:<8}{r['e2e_ms']:<8}")


if __name__ == "__main__":
    main()
