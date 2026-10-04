"""mock.py — 离线假百炼 HTTP 接口

与 demo_kit.HttpTransport 同接口（json / sse / multipart / get_bytes），按官方响应结构回放：
- 同步转写 multimodal-generation：output.sentences（带 speaker_id）+ usage
- 临时存储 uploads?action=getPolicy → OSS 表单上传 → oss:// 地址
- 异步转写 transcription → tasks/{task_id} → transcription_url 指向的 JSON
- 纪要 chat/completions 流式：choices[].delta.content，末尾一条带 usage
句子与时间轴取自 samples/meeting.json（与 meeting.mp3 同时生成，内容一致）。纪要为固定示意内容。
"""
from __future__ import annotations

import json
from pathlib import Path

from demo_kit import HttpError

MINUTES = {
    "title": "新款录音卡试产排期与客户拜访",
    "summary": "新款录音卡十月十二号按计划试产、二十八号小批量；星云科技下周二拜访由销售牵头。"
               "麦克风阵列交期可能晚一周，列为风险跟进；德语包装文案的翻译供应商待定。",
    "agenda": ["新款录音卡试产排期", "下周星云科技客户拜访"],
    "decisions": [
        {"content": "十月十二号按计划试产", "owner": ""},
        {"content": "星云科技拜访由销售牵头", "owner": "销售"},
    ],
    "action_items": [
        {"task": "准备星云科技报价单，发给说话人1", "owner": "说话人2", "due": "周五前"},
        {"task": "与麦克风阵列供应商确认交期", "owner": "说话人3", "due": "周三前"},
    ],
    "open_questions": ["德语包装文案的翻译供应商待定，下次再议"],
    "risks": ["麦克风阵列供应商交期可能晚一周，影响试产"],
}


class MockHttp:
    def __init__(self, meta_path: Path):
        meta = json.loads(meta_path.read_text(encoding="utf-8"))
        self.duration_ms = int(meta["duration_ms"])
        self.sentences = [
            {"sentence_id": i, "sentence_end": True, "channel_id": 0, "speaker_id": s["speaker_id"],
             "begin_time": s["begin_time"], "end_time": s["end_time"], "text": s["text"]}
            for i, s in enumerate(meta["sentences"], 1)
        ]
        self.text = "".join(s["text"] for s in self.sentences)
        self.polls = 0
        self.uploaded = False

    def json(self, method: str, url: str, headers: dict | None = None, payload: dict | None = None,
             timeout: float = 60) -> dict:
        headers = headers or {}
        seconds = round(self.duration_ms / 1000)
        if url.endswith("/services/aigc/multimodal-generation/generation"):
            params = (payload or {}).get("parameters") or {}
            if not params.get("speaker_diarization_enabled") or not params.get("format"):
                raise HttpError("mock：同步转写需要 format 和 speaker_diarization_enabled")
            # 3.1 ASR 的音频 Token 折算率官方未公布，这里取 run.py 估算区间的上限（每秒 25 Token），仅作示意
            return {"request_id": "mock-asr",
                    "output": {"text": self.text, "sentence": self.sentences[-1], "sentences": self.sentences},
                    "usage": {"duration": seconds, "input_tokens": seconds * 25, "output_tokens": len(self.text)}}
        if "/uploads?action=getPolicy" in url:
            if "model=qwen-audio-3.1-asr-flash-filetrans" not in url:
                raise HttpError("mock：临时上传必须申请 filetrans 对应的凭证")
            return {"request_id": "mock-policy", "data": {
                "policy": "mock-policy", "signature": "mock-signature", "upload_dir": "dashscope-instant/mock/2026-10-01",
                "upload_host": "mock://dashscope-file-mock.oss-cn-beijing.aliyuncs.com", "expire_in_seconds": 300,
                "max_file_size_mb": 100, "capacity_limit_mb": 999999999, "oss_access_key_id": "mock-access-key-id",
                "x_oss_object_acl": "private", "x_oss_forbid_overwrite": "true"}}
        if url.endswith("/services/audio/asr/transcription"):
            if (payload or {}).get("model") != "qwen-audio-3.1-asr-flash-filetrans":
                raise HttpError("mock：文件识别必须使用 qwen-audio-3.1-asr-flash-filetrans")
            params = (payload or {}).get("parameters") or {}
            channels = params.get("channel_id")
            if channels not in ([0], [0, 1]) or params.get("diarization_enabled") is not (channels == [0]):
                raise HttpError("mock：文件识别需选择声道并启用说话人分离")
            if headers.get("X-DashScope-Async") != "enable":
                raise HttpError("mock：异步转写需要请求头 X-DashScope-Async: enable")
            file_url = ((payload or {}).get("input") or {}).get("file_urls", [""])[0]
            if file_url.startswith("oss://") and headers.get("X-DashScope-OssResourceResolve") != "enable":
                raise HttpError("mock：oss:// 地址需要请求头 X-DashScope-OssResourceResolve: enable")
            if file_url.startswith("oss://") and not self.uploaded:
                raise HttpError("mock：提交临时文件前应已完成上传")
            return {"request_id": "mock-submit", "output": {"task_id": "mock-task-1", "task_status": "PENDING"}}
        if url.endswith("/tasks/mock-task-1"):
            self.polls += 1
            if self.polls < 2:
                return {"output": {"task_id": "mock-task-1", "task_status": "RUNNING"}}
            return {"output": {"task_id": "mock-task-1", "task_status": "SUCCEEDED",
                               "results": [{"file_url": "https://example.com/meeting.mp3",
                                            "transcription_url": "mock://transcription.json",
                                            "subtask_status": "SUCCEEDED"}]},
                    "usage": {"duration": seconds}}
        raise HttpError(f"mock：未模拟的接口 {method} {url}")

    def sse(self, url: str, headers: dict, payload: dict, timeout: float = 120):
        if not url.endswith("/chat/completions") or not payload.get("stream"):
            raise HttpError(f"mock：未模拟的流式接口 {url}")
        if payload.get("model") != "qwen3.8-flash":
            raise HttpError("mock：纪要必须使用 qwen3.8-flash")
        text = json.dumps(MINUTES, ensure_ascii=False)
        for i in range(0, len(text), 32):
            yield {"choices": [{"index": 0, "delta": {"content": text[i:i + 32]}}]}
        prompt = sum(len(m.get("content") or "") for m in payload.get("messages") or [])
        yield {"choices": [], "usage": {"prompt_tokens": prompt, "completion_tokens": len(text),
                                        "total_tokens": prompt + len(text)}}

    def multipart(self, url: str, fields: dict, file_field: str, filename: str, content: bytes,
                  timeout: float = 120) -> int:
        required = ("OSSAccessKeyId", "Signature", "policy", "key", "success_action_status")
        if not url.startswith("mock://") or any(not fields.get(k) for k in required) or not content:
            raise HttpError("mock：OSS 表单上传缺少字段")
        self.uploaded = True
        return 200

    def get_bytes(self, url: str, timeout: float = 60) -> bytes:
        if url != "mock://transcription.json":
            raise HttpError(f"mock：未模拟的下载 {url}")
        result = {"file_url": "https://example.com/meeting.mp3",
                  "properties": {"original_duration_in_milliseconds": self.duration_ms, "channels": [0]},
                  "transcripts": [{"channel_id": 0, "text": self.text, "sentences": self.sentences}]}
        return json.dumps(result, ensure_ascii=False).encode("utf-8")
