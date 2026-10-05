"""会议纪要离线回归；不读取凭证、不调用网络。"""
from __future__ import annotations

import contextlib
import copy
import io
import json
import shutil
import tempfile
import unittest
import wave
from pathlib import Path
from unittest.mock import patch

import demo_kit as kit
import mock as provider
import run


class RecorderTests(unittest.TestCase):
    def invoke(self, args=(), http_class=provider.MockHttp, fail=False):
        with tempfile.TemporaryDirectory() as folder:
            directory = Path(folder)
            (directory / "samples").mkdir()
            shutil.copyfile(run.DEMO_DIR / "samples" / "meeting.json", directory / "samples" / "meeting.json")
            (directory / "out").mkdir()
            for name in ("minutes.json", "minutes.md"):
                (directory / "out" / name).write_text("旧纪要", encoding="utf-8")
            config = kit.Config("mock", "offline test", "cn-beijing")
            output = io.StringIO()
            with patch.object(run, "DEMO_DIR", directory), patch.object(kit, "resolve", return_value=config), \
                    patch.object(kit, "finish") as finish, patch.object(provider, "MockHttp", http_class), \
                    patch("sys.argv", ["run.py", "--mock", *args]), contextlib.redirect_stdout(output):
                if fail:
                    with self.assertRaises(SystemExit):
                        run.main()
                else:
                    run.main()
            files = {p.name: p.read_text(encoding="utf-8") for p in (directory / "out").iterdir()}
            return files, output.getvalue(), finish

    def test_default_and_compatibility_aliases_use_filetrans_and_38(self):
        calls = []

        class Tracking(provider.MockHttp):
            def json(self, method, url, headers=None, payload=None, timeout=60):
                calls.append((url, payload))
                return super().json(method, url, headers, payload, timeout)

            def sse(self, url, headers, payload, timeout=120):
                calls.append((url, payload))
                yield from super().sse(url, headers, payload, timeout)

        for args in ((), ("--long",), ("--quality",)):
            with self.subTest(args=args):
                calls.clear()
                files, _, finish = self.invoke(args, Tracking)
                self.assertTrue(any("/uploads?action=getPolicy" in url for url, _ in calls))
                models = [payload["model"] for _, payload in calls if payload and "model" in payload]
                self.assertEqual(models, ["qwen-audio-3.1-asr-flash-filetrans", "qwen3.8-flash"])
                self.assertEqual(set(files), {"transcript.txt", "transcript.json", "minutes.json", "minutes.md"})
                sources = json.loads(files["transcript.json"])["sentences"]
                self.assertEqual(sources[0]["id"], "s001")
                self.assertEqual(sources[0]["begin_ms"], 0)
                request = calls[-1][1]
                self.assertTrue(request["response_format"]["json_schema"]["strict"])
                self.assertEqual(request["response_format"]["json_schema"]["schema"]["properties"]["action_items"]["items"]["properties"]["source_ids"]["items"]["enum"], [s["id"] for s in sources])
                self.assertEqual(json.loads(files["minutes.json"])["decisions"][0]["owner"], "")
                self.assertIn("负责人：待确认", files["minutes.md"])
                self.assertEqual(finish.call_args.kwargs["models"], models)

    def test_public_url_skips_upload(self):
        class NoUpload(provider.MockHttp):
            def multipart(self, *args, **kwargs):
                raise AssertionError("public URL must not upload")

        files, _, finish = self.invoke(("--audio-url", "https://example.com/meeting.mp3", "--channels", "1"), NoUpload)
        self.assertIn("minutes.json", files)
        self.assertEqual(finish.call_args.kwargs["models"][0], run.ASR_FILE_MODEL)

    def test_sync_is_only_an_explicit_comparison(self):
        files, _, finish = self.invoke(("--sync",))
        self.assertIn("minutes.json", files)
        self.assertEqual(finish.call_args.kwargs["models"], [run.ASR_MODEL, "qwen3.8-flash"])

    def test_summary_error_keeps_new_transcript_and_clears_old_minutes(self):
        class FailedSummary(provider.MockHttp):
            def sse(self, *args, **kwargs):
                raise kit.HttpError("模拟总结服务超时")

        files, output, finish = self.invoke(http_class=FailedSummary, fail=True)
        self.assertEqual(set(files), {"transcript.txt", "transcript.json"})
        self.assertIn("[00:00] 说话人1", files["transcript.txt"])
        self.assertIn("转写已保存", output)
        finish.assert_not_called()

    def test_invalid_summary_shape_keeps_transcript(self):
        class InvalidSummary(provider.MockHttp):
            def sse(self, *args, **kwargs):
                yield {"choices": [{"delta": {"content": "[]"}}]}

        files, _, _ = self.invoke(http_class=InvalidSummary, fail=True)
        self.assertEqual(set(files), {"transcript.txt", "transcript.json"})

    def test_missing_summary_usage_is_not_free(self):
        class NoUsage(provider.MockHttp):
            def sse(self, *args, **kwargs):
                for event in super().sse(*args, **kwargs):
                    event.pop("usage", None)
                    yield event

        _, output, finish = self.invoke(http_class=NoUsage)
        self.assertIsNone(finish.call_args.kwargs["cost"])
        self.assertIn("纪要用量未知", output)
        self.assertIn("纪要 未知", output)

    def test_explicit_zero_usage_is_known(self):
        stats = run.Stats()
        run.record_asr_usage(stats, {"input_tokens": 0, "output_tokens": 0}, 55, 200)
        self.assertEqual(stats.asr_tokens, (0, 0))
        self.assertEqual(stats.asr_cost("cn-beijing"), (0, 0))
        stats.llm_tokens = run.token_usage({"prompt_tokens": 0, "completion_tokens": 0}, "prompt_tokens", "completion_tokens")
        self.assertEqual(stats.llm_cost("cn-beijing"), 0)

    def test_partial_or_invalid_usage_is_unknown(self):
        for usage in ({}, {"input_tokens": 0}, {"input_tokens": -1, "output_tokens": 1},
                      {"input_tokens": None, "output_tokens": 0}, {"input_tokens": True, "output_tokens": 0},
                      {"input_tokens": float("nan"), "output_tokens": 0}):
            with self.subTest(usage=usage):
                stats = run.Stats()
                run.record_asr_usage(stats, usage, 0, 200)
                self.assertIsNone(stats.asr_cost("cn-beijing"))
                self.assertIsNone(stats.llm_cost("cn-beijing"))

    def test_duration_only_asr_is_unknown(self):
        stats = run.Stats()
        run.record_asr_usage(stats, {"duration": 55}, 55, 200)
        self.assertIsNone(stats.asr_cost("cn-beijing"))
        _, output, finish = self.invoke()
        self.assertIsNone(finish.call_args.kwargs["cost"])
        self.assertIn("总费用未知", output)
        self.assertNotIn("每秒", output)

    def test_channel_detection_and_explicit_declarations(self):
        self.assertEqual(run.audio_channels(run.SAMPLE_AUDIO), 1)
        with tempfile.TemporaryDirectory() as folder:
            for count in (1, 2, 3):
                path = Path(folder) / f"{count}.wav"
                with wave.open(str(path), "wb") as audio:
                    audio.setnchannels(count)
                    audio.setsampwidth(2)
                    audio.setframerate(16000)
                    audio.writeframes(b"\0" * count * 32)
                if count < 3:
                    self.assertEqual(run.audio_channels(path), count)
                    with self.assertRaises(kit.HttpError):
                        run.audio_channels(path, 3-count)
                else:
                    with self.assertRaises(kit.HttpError):
                        run.audio_channels(path)
        for path in (None, Path("meeting.flac")):
            with self.assertRaises(kit.HttpError):
                run.audio_channels(path)
            self.assertEqual(run.audio_channels(path, 2), 2)

    def test_stereo_merges_both_tracks_and_preserves_original_duration(self):
        calls = []
        class Stereo(provider.MockHttp):
            def json(self, method, url, headers=None, payload=None, timeout=60):
                if payload:
                    calls.append(payload)
                return super().json(method, url, headers, payload, timeout)
            def get_bytes(self, *args, **kwargs):
                return json.dumps({"properties":{"original_duration_in_milliseconds":60000},"transcripts":[
                    {"channel_id":1,"sentences":[{"begin_time":5000,"end_time":10000,"text":"右声道","speaker_id":0}]},
                    {"channel_id":0,"sentences":[{"begin_time":0,"end_time":60000,"text":"左声道","speaker_id":0}]}
                ]}).encode()
            def sse(self, *args, **kwargs):
                minutes = {"title":"双声道测试", "summary":"左右声道识别完成", "agenda":[], "decisions":[], "action_items":[], "open_questions":[], "risks":[]}
                yield {"choices":[{"delta":{"content":json.dumps(minutes)}}]}
        files, _, _ = self.invoke(("--audio-url","https://example.com/stereo.wav","--channels","2"), Stereo)
        self.assertEqual(calls[0]["parameters"], {"channel_id":[0,1],"diarization_enabled":False})
        self.assertLess(files["transcript.txt"].index("声道1"), files["transcript.txt"].index("声道2"))
        self.assertIn("录音 60 秒", files["minutes.md"])
        self.assertIn("双声道 · 未分离说话人", files["minutes.md"])
        with self.assertRaises(kit.HttpError):
            run.transcribe_url(provider.MockHttp(run.DEMO_DIR/"samples"/"meeting.json"), kit.Config("mock","test","cn-beijing"), "https://example.com/a.wav", None, run.Stats(), 2)

    def test_invalid_source_reference_keeps_both_transcript_outputs(self):
        class BadReference(provider.MockHttp):
            def sse(self, *args, **kwargs):
                minutes = copy.deepcopy(provider.MINUTES)
                minutes["action_items"][0]["source_ids"] = ["s999"]
                yield {"choices":[{"delta":{"content":json.dumps(minutes)}}]}
        files, _, _ = self.invoke(http_class=BadReference, fail=True)
        self.assertEqual(set(files), {"transcript.txt", "transcript.json"})

    def test_missing_time_is_not_fabricated_as_zero(self):
        sentences = run.to_sentences([{"text":"日期还没定。", "speaker_id":0}])
        self.assertIsNone(sentences[0].begin_ms)
        self.assertIsNone(sentences[0].end_ms)
        self.assertIn("时间未提供", sentences[0].line())
        with self.assertRaises(kit.HttpError):
            run.to_sentences([{"text":"坏时间", "begin_time":100, "end_time":99}])

    def test_sse_error_after_json_is_failure_and_keeps_transcript(self):
        class LateFailure(provider.MockHttp):
            def sse(self, *args, **kwargs):
                yield from super().sse(*args, **kwargs)
                yield {"error":{"code":"InternalError","message":"untrusted details"}}
        files, output, finish = self.invoke(http_class=LateFailure, fail=True)
        self.assertEqual(set(files), {"transcript.txt", "transcript.json"})
        finish.assert_not_called()

    def test_unidentified_speaker_does_not_claim_known_person_count(self):
        class UnknownSpeaker(provider.MockHttp):
            def get_bytes(self, *args, **kwargs):
                result=json.loads(super().get_bytes(*args, **kwargs))
                for sentence in result["transcripts"][0]["sentences"]:
                    sentence.pop("speaker_id",None)
                return json.dumps(result).encode()
        files, _, _ = self.invoke(http_class=UnknownSpeaker)
        self.assertNotIn("1 位说话人", files["minutes.md"])
        self.assertIn("不代表已确认人数", files["minutes.md"])

    def test_unknown_owner_and_due_stay_empty_in_json(self):
        minutes = copy.deepcopy(provider.MINUTES)
        minutes["action_items"] = [{"task": "确认交期", "owner": "", "due": ""}]
        run.validate_minutes(minutes)
        markdown = run.render(minutes, 3, 55, [run.ASR_FILE_MODEL, run.LLM_MODEL])
        self.assertIn("负责人：待确认 · 期限：待确认", markdown)
        self.assertEqual(minutes["action_items"][0]["due"], "")

    def test_38_price_does_not_use_37_tiers(self):
        stats = run.Stats(llm_tokens=(10_000, 2_000))
        self.assertAlmostEqual(stats.llm_cost("cn-beijing"), 0.0134)
        self.assertAlmostEqual(stats.llm_cost("ap-southeast-1"), 0.017794)


if __name__ == "__main__":
    unittest.main()
