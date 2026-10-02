"""selftest.py — 离线自检：不联网、不需要 Key 和 ffmpeg，只验证流水线里的纯逻辑。

  python3 selftest.py

覆盖：音节计数、③ 切小节与预算、② 重标注与同音字采纳、⑥ 参考音频选段、⑧ 零重叠放置、⑨ 泄漏检查与门禁。
"""
from __future__ import annotations

import unittest

import bailian
import dub
import pause_plan
import smooth_dub


def w(start, end, text, speaker="S0", punct="", sid=1):
    return {"start": start, "end": end, "text": text, "punct": punct, "speaker": speaker, "sid": sid}


class Syllables(unittest.TestCase):
    def test_english(self):
        self.assertEqual(pause_plan.count_syllables("Hello world", "en"), 3)
        self.assertEqual(pause_plan.count_syllables("We'll see you tomorrow.", "en"), 6)

    def test_cjk_and_kana(self):
        self.assertEqual(pause_plan.count_syllables("今天天气不错", "zh"), 6)
        self.assertEqual(pause_plan.count_syllables("きょうは", "ja"), 3)     # 拗音「ょ」不单独算
        self.assertEqual(pause_plan.count_syllables("안녕하세요", "ko"), 5)


class Plan(unittest.TestCase):
    def setUp(self):
        self.words = [
            w(0, 300, "大家"), w(300, 600, "好", punct="，"), w(620, 1000, "欢迎"), w(1000, 1400, "收看", punct="。"),
            w(2000, 2400, "今天", "S1", sid=2), w(2400, 2900, "聊聊", "S1", sid=2), w(2900, 3500, "新品", "S1", "。", 2),
            w(3550, 3800, "好", "S0", "。", 3),
        ]

    def test_split_by_pause_speaker_and_sentence_end(self):
        plan = pause_plan.build_plan(self.words, "en", 5000)
        self.assertEqual([s["speaker"] for s in plan], ["S0", "S1", "S0"])
        self.assertEqual(plan[0]["source"], "大家好，欢迎收看。")
        self.assertEqual((plan[1]["start_ms"], plan[1]["end_ms"]), (2000, 3500))

    def test_budget_follows_duration_and_slot(self):
        plan = pause_plan.build_plan(self.words, "en", 5000)
        self.assertEqual(plan[0]["budget"], int(1.4 * pause_plan.RATES["en"]))
        self.assertEqual(plan[0]["slot_ms"], 2000)          # 到下一句开始
        self.assertGreaterEqual(plan[0]["budget_max"], plan[0]["budget"])

    def test_long_run_is_split(self):
        words = [w(i * 500, i * 500 + 450, "字", punct="，" if i == 9 else "") for i in range(20)]
        plan = pause_plan.build_plan(words, "en", 12000)
        self.assertEqual(len(plan), 2)
        self.assertTrue(all(s["end_ms"] - s["start_ms"] <= pause_plan.MAX_SEGMENT_MS for s in plan))


class Align(unittest.TestCase):
    def test_relabel_keeps_timestamps_and_applies_fixes(self):
        words = [w(0, 500, "我们"), w(500, 900, "在", sid=1), w(900, 1400, "见", punct="。")]
        align = {"sentences": [{"sid": 1, "speaker": "B", "emotion": "开心", "instruction": "语气轻快",
                                "fixes": [{"from": "在见", "to": "再见"}, {"from": "不存在", "to": "x"}]}]}
        relabeled, cards = dub.apply_align(words, align)
        self.assertEqual([x["speaker"] for x in relabeled], ["B", "B", "B"])
        self.assertEqual([(x["start"], x["end"]) for x in relabeled], [(0, 500), (500, 900), (900, 1400)])
        plan = pause_plan.build_plan(relabeled, "en", 2000)
        dub.attach_cards(plan, relabeled, cards)
        self.assertEqual(plan[0]["source"], "我们再见。")
        self.assertEqual(plan[0]["source_asr"], "我们在见。")
        self.assertEqual(plan[0]["emotion"], "开心")


class Reference(unittest.TestCase):
    def test_picks_longest_clean_spans_up_to_limit(self):
        plan = [{"speaker": "A", "start_ms": i * 9000, "end_ms": i * 9000 + 8000} for i in range(4)]
        plan.append({"speaker": "B", "start_ms": 27500, "end_ms": 28000})   # 与 A 的第 4 段重叠
        spans = dub.reference_spans(plan, "A")
        self.assertEqual(spans, [(0, 8000), (9000, 17000)])
        self.assertLessEqual(sum(b - a for a, b in spans) / 1000, dub.REF_MAX_S)


class Placement(unittest.TestCase):
    def check_invariants(self, placed):
        for a, b in zip(placed, placed[1:]):
            self.assertGreaterEqual(b["at_ms"], a["at_ms"] + a["dur_ms"] + smooth_dub.GAP_MS)
        self.assertTrue(all(1.0 <= p["speed"] <= smooth_dub.MAX_SPEED for p in placed))

    def test_fits_without_change(self):
        segs = [{"id": 1, "start_ms": 1000, "end_ms": 2000}, {"id": 2, "start_ms": 3000, "end_ms": 4000}]
        placed = smooth_dub.place(segs, {1: 900, 2: 900}, 5000)
        self.assertEqual([(p["at_ms"], p["speed"], p["overflow_ms"]) for p in placed], [(1000, 1.0, 0), (3000, 1.0, 0)])

    def test_speeds_up_then_overflows_without_overlap(self):
        segs = [{"id": i, "start_ms": i * 1000, "end_ms": i * 1000 + 800} for i in range(1, 5)]
        placed = smooth_dub.place(segs, {1: 1100, 2: 2000, 3: 700, 4: 700}, 6000)
        self.check_invariants(placed)
        self.assertGreater(placed[0]["speed"], 1.0)
        self.assertEqual(placed[1]["speed"], smooth_dub.MAX_SPEED)
        self.assertGreater(placed[1]["overflow_ms"], 0)
        self.assertGreater(placed[2]["at_ms"], 3000)          # 被前一句顺延

    def test_leads_slightly_when_tight(self):
        segs = [{"id": 1, "start_ms": 1000, "end_ms": 2000}, {"id": 2, "start_ms": 2100, "end_ms": 3000}]
        placed = smooth_dub.place(segs, {1: 1100, 2: 500}, 4000)
        self.assertEqual(placed[0]["at_ms"], 1000 - smooth_dub.LEAD_MS)
        self.check_invariants(placed)


class Quality(unittest.TestCase):
    def test_leak_check(self):
        heard = [w(1000, 1300, "Hello"), w(1300, 1600, "朋友们"), w(3000, 3400, "Bye")]
        placed = [{"id": 1, "at_ms": 1000, "dur_ms": 800}, {"id": 2, "at_ms": 3000, "dur_ms": 600}]
        self.assertEqual([x["id"] for x in dub.leak_check(heard, placed, "en")], [1])
        self.assertEqual(dub.leak_check(heard, placed, "zh"), [])

    def test_gate(self):
        placed = [{"overflow_ms": 120}]
        good = {"leaks": [], "blind": {"scores": {"timbre": 4, "pace": 4, "overlap": 5, "naturalness": 4}}}
        self.assertTrue(dub.gate(good, placed)["passed"])
        bad = {"leaks": [{"id": 1}], "blind": {"scores": {"timbre": 2, "pace": 4, "overlap": 5, "naturalness": 4}}}
        result = dub.gate(bad, [{"overflow_ms": 500}])
        self.assertFalse(result["passed"])
        self.assertEqual(len(result["reasons"]), 3)


class Helpers(unittest.TestCase):
    def test_instruction_limit_counts_cjk_double(self):
        self.assertEqual(bailian.tts_chars("开心ok"), 6)
        self.assertEqual(len(bailian.trim_instruction("啊" * 80)), 50)

    def test_parse_json_tolerates_fences(self):
        self.assertEqual(bailian.parse_json('好的：```json\n{"a": 1}\n```'), {"a": 1})


if __name__ == "__main__":
    unittest.main(verbosity=2)
