#!/usr/bin/env python3
"""make_speech_sample.py — 离线合成「模拟设备输入」用的中文语音样本（开发者工具）

demo 运行不需要本脚本；只在新增 / 更新 samples/ 时用。离线合成，不调用任何云端 API。

引擎：Kokoro-82M（Apache-2.0，https://huggingface.co/hexgrad/Kokoro-82M），中文音色
zf_xiaobei / zf_xiaoni / zf_xiaoxiao / zf_xiaoyi / zm_yunjian / zm_yunxi / zm_yunxia / zm_yunyang。

用法：
  pip install "kokoro>=0.9.4" "misaki[zh]>=0.9.4" soundfile   # 另需 ffmpeg
  python3 make_speech_sample.py script.txt out.mp3 \\
      --voice 说话人1=zm_yunjian --voice 说话人2=zf_xiaoxiao --voice 说话人3=zf_xiaoyi

script.txt 每行一句：「说话人：台词」。没有「：」的行用第一个音色。
输出：
  out.mp3（或 .wav）— 16 kHz 单声道
  out.json           — 每句的说话人、起止毫秒、文本，可直接当 mock 的标准答案
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
import tempfile
from pathlib import Path

SAMPLE_RATE = 24000  # Kokoro 输出采样率
GAP_S = 0.45         # 句间停顿


def parse_script(path: Path) -> list[tuple[str, str]]:
    lines = []
    for raw in path.read_text(encoding="utf-8").splitlines():
        raw = raw.strip()
        if not raw or raw.startswith("#"):
            continue
        if "：" in raw:
            who, text = raw.split("：", 1)
        else:
            who, text = "", raw
        lines.append((who.strip(), text.strip()))
    return lines


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("script", type=Path)
    ap.add_argument("output", type=Path, help=".mp3 或 .wav")
    ap.add_argument("--voice", action="append", default=[], metavar="说话人=音色")
    ap.add_argument("--speed", type=float, default=1.0)
    args = ap.parse_args()

    try:
        import numpy as np
        import soundfile as sf
        from kokoro import KPipeline
    except ImportError:
        sys.exit('缺少依赖：pip install "kokoro>=0.9.4" "misaki[zh]>=0.9.4" soundfile')

    voices = dict(v.split("=", 1) for v in args.voice)
    default_voice = next(iter(voices.values()), "zf_xiaoxiao")
    lines = parse_script(args.script)
    if not lines:
        sys.exit(f"{args.script} 里没有台词")

    pipe = KPipeline(lang_code="z", repo_id="hexgrad/Kokoro-82M")
    gap = np.zeros(int(GAP_S * SAMPLE_RATE), dtype=np.float32)
    pieces, sentences, cursor = [], [], 0
    speaker_ids: dict[str, int] = {}
    for who, text in lines:
        voice = voices.get(who, default_voice)
        audio = np.concatenate([np.asarray(a, dtype=np.float32) for _, _, a in pipe(text, voice=voice, speed=args.speed)])
        begin = cursor
        cursor += len(audio)
        sentences.append({
            "speaker": who,
            "speaker_id": speaker_ids.setdefault(who, len(speaker_ids)),
            "voice": voice,
            "begin_time": round(begin * 1000 / SAMPLE_RATE),
            "end_time": round(cursor * 1000 / SAMPLE_RATE),
            "text": text,
        })
        pieces += [audio, gap]
        cursor += len(gap)
        print(f"{sentences[-1]['begin_time']:>6} ms  {who or '-'}（{voice}）{text}")

    with tempfile.TemporaryDirectory() as tmp:
        raw = Path(tmp) / "raw.wav"
        sf.write(raw, np.concatenate(pieces), SAMPLE_RATE)
        codec = ["-b:a", "32k"] if args.output.suffix == ".mp3" else ["-sample_fmt", "s16"]
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(raw), "-ac", "1", "-ar", "16000", *codec, str(args.output)], check=True)

    meta = {
        "engine": "Kokoro-82M (Apache-2.0)",
        "duration_ms": round(cursor * 1000 / SAMPLE_RATE),
        "sentences": sentences,
    }
    args.output.with_suffix(".json").write_text(json.dumps(meta, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"→ {args.output}（{meta['duration_ms'] / 1000:.1f} s）+ {args.output.with_suffix('.json').name}")


if __name__ == "__main__":
    main()
