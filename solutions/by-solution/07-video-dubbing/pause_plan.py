"""pause_plan.py — ③ 时间轴骨架：按停顿把词级时间戳切成小节，并给每个小节算目标语言的音节预算。

ASR 的词级时间戳是时间的唯一来源：小节的起止全部取自词的 begin_time / end_time，后续翻译、配音、混音都不改它。

用法（单独运行）：
  python3 pause_plan.py work/<视频名>/words.json -o plan.json --target en

只依赖标准库。
"""
from __future__ import annotations

import argparse
import json
import math
import re
import sys
from pathlib import Path

PAUSE_MS = 300          # 词间停顿 ≥ 这个值就切开
MAX_SEGMENT_MS = 8000   # 单个小节超过这个长度，在最大的内部停顿 / 逗号处再切
MIN_SEGMENT_MS = 600    # 短于这个长度的小节并入同一说话人的相邻小节
MERGE_GAP_MS = 600      # 并入时允许的最大间隔
END_PUNCT = "。！？!?.…"
SOFT_PUNCT = "，、；：,;:"

# 配音语速（音节 / 秒）。按朗读语速的约七成取值：配音要留出情绪和换气，太满听起来像赶稿。
# 日语按假名（mora）计；中文、韩语按字计。可用 --rate 覆盖。
RATES = {"en": 4.3, "es": 5.5, "fr": 5.0, "de": 4.2, "it": 4.9, "pt": 5.0, "ru": 4.6,
         "ja": 5.5, "ko": 5.0, "zh": 3.6, "id": 5.0, "vi": 4.0, "th": 4.2}
DEFAULT_RATE = 4.5

_CJK = re.compile(r"[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]")
_KANA = re.compile(r"[\u3041-\u3096\u30a1-\u30fa\u30fc]")
_SMALL_KANA = set("ゃゅょぁぃぅぇぉャュョァィゥェォ")
_HANGUL = re.compile(r"[\uac00-\ud7a3]")
_WORD = re.compile(r"[A-Za-zÀ-ÖØ-öø-ÿ']+")
_VOWELS = re.compile(r"[aeiouyàâäéèêëîïôöùûüáíóúãõåæø]+", re.I)


def _english_syllables(word: str) -> int:
    w = word.lower().strip("'")
    if not w:
        return 0
    if len(w) <= 3:
        return 1
    w = re.sub(r"(?:[^laeiouy]es|ed|[^laeiouy]e)$", "", w)
    w = re.sub(r"^y", "", w)
    return max(1, len(re.findall(r"[aeiouy]{1,2}", w)))


def count_syllables(text: str, lang: str) -> int:
    """估算一段文字的音节数，只用来和预算比较，不追求逐字精确。数字按每位一个音节粗算。"""
    total = len(_CJK.findall(text)) * (2 if lang == "ja" else 1)
    total += len([c for c in _KANA.findall(text) if c not in _SMALL_KANA])
    total += len(_HANGUL.findall(text))
    total += len(re.findall(r"\d", text))
    for word in _WORD.findall(text):
        total += _english_syllables(word) if lang == "en" else max(1, len(_VOWELS.findall(word)))
    return total


def _ends_sentence(word: dict) -> bool:
    punct = (word.get("punct") or "").strip()
    return bool(punct) and punct[-1] in END_PUNCT


def _speaker_runs(words: list[dict]) -> list[list[dict]]:
    """连续同一说话人、且停顿小于 PAUSE_MS、没有遇到句末标点的词归成一段。"""
    runs: list[list[dict]] = []
    for w in words:
        prev = runs[-1][-1] if runs else None
        if (prev is None or w["speaker"] != prev["speaker"] or w["start"] - prev["end"] >= PAUSE_MS
                or _ends_sentence(prev)):
            runs.append([w])
        else:
            runs[-1].append(w)
    return runs


def _split_long(run: list[dict]) -> list[list[dict]]:
    if len(run) < 2 or run[-1]["end"] - run[0]["start"] <= MAX_SEGMENT_MS:
        return [run]

    def score(i: int) -> tuple:
        punct = (run[i].get("punct") or "").strip()
        gap = run[i + 1]["start"] - run[i]["end"]
        balance = -abs((run[i]["end"] - run[0]["start"]) - (run[-1]["end"] - run[i + 1]["start"]))
        return (bool(punct and punct[-1] in SOFT_PUNCT + END_PUNCT), gap, balance)

    cut = max(range(len(run) - 1), key=score)
    return _split_long(run[:cut + 1]) + _split_long(run[cut + 1:])


def _merge_short(runs: list[list[dict]]) -> list[list[dict]]:
    out: list[list[dict]] = []
    for run in runs:
        if out and out[-1][-1]["speaker"] == run[0]["speaker"] and run[0]["start"] - out[-1][-1]["end"] < MERGE_GAP_MS:
            short = (run[-1]["end"] - run[0]["start"] < MIN_SEGMENT_MS
                     or out[-1][-1]["end"] - out[-1][0]["start"] < MIN_SEGMENT_MS)
            if short and run[-1]["end"] - out[-1][0]["start"] <= MAX_SEGMENT_MS:
                out[-1] = out[-1] + run
                continue
        out.append(run)
    return out


def _text(run: list[dict]) -> str:
    return "".join(w["text"] + (w.get("punct") or "") for w in run).strip()


def build_plan(words: list[dict], target: str, duration_ms: int, rate: float | None = None) -> list[dict]:
    """words：[{start, end, text, punct, speaker}]，按时间排序。返回小节列表。"""
    words = sorted((w for w in words if w["end"] > w["start"]), key=lambda w: w["start"])
    runs = _merge_short([piece for run in _speaker_runs(words) for piece in _split_long(run)])
    per_second = rate or RATES.get(target, DEFAULT_RATE)
    plan = []
    for i, run in enumerate(runs):
        start, end = run[0]["start"], run[-1]["end"]
        next_start = runs[i + 1][0]["start"] if i + 1 < len(runs) else max(duration_ms, end)
        seconds = (end - start) / 1000
        plan.append({
            "id": i + 1,
            "speaker": run[0]["speaker"],
            "start_ms": start,
            "end_ms": end,
            "slot_ms": max(end, next_start) - start,   # 到下一个小节开始前的全部可用时长
            "source": _text(run),
            "source_syllables": count_syllables(_text(run), "zh"),
            "budget": max(2, math.floor(seconds * per_second)),
            "budget_max": max(3, math.floor((max(end, next_start) - start) / 1000 * per_second)),
        })
    return plan


def main() -> None:
    parser = argparse.ArgumentParser(description="按停顿切小节 + 音节预算")
    parser.add_argument("words", type=Path, help="词级时间戳 JSON：{duration_ms, words: [...]}")
    parser.add_argument("-o", "--output", type=Path, default=Path("plan.json"))
    parser.add_argument("--target", default="en", help="目标语言代码，决定每秒音节数")
    parser.add_argument("--rate", type=float, help="覆盖每秒音节数")
    args = parser.parse_args()
    data = json.loads(args.words.read_text(encoding="utf-8"))
    plan = build_plan(data["words"], args.target, int(data.get("duration_ms") or 0), args.rate)
    args.output.write_text(json.dumps({"target": args.target, "segments": plan}, ensure_ascii=False, indent=2),
                           encoding="utf-8")
    print(f"{len(plan)} 个小节 → {args.output}", file=sys.stderr)


if __name__ == "__main__":
    main()
