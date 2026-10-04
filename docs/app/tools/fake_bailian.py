#!/usr/bin/env python3
"""冒烟测试用的本地假百炼：把网页 APP 的真跑请求交给对应 demo 的 mock.py（和 CI 跑 --mock 是同一份假接口）。

只给 smoke.mjs 用：Playwright 把发往百炼域名的请求转到这里，页面代码和 CSP 都不用改。
  python3 docs/app/tools/fake_bailian.py --port 8790
路径：/<方案 id>/compatible-mode/v1/...（SSE）· /<方案 id>/api/v1/...（JSON）· /<方案 id>/reset（重置 mock 状态）
只用标准库。
"""
from __future__ import annotations

import argparse
import base64
import json
import sys
from email.parser import BytesParser
from email.policy import default
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from urllib.parse import urlsplit

sys.path.insert(0, str(Path(__file__).resolve().parent))
from build import REPO, load_module  # noqa: E402

KEY = "sk-apptest0000000001"
MOCK_ARGS = {
    "01-ipc.bailian": lambda d: (d / "samples",),
    "02-ai-glasses.bailian": lambda d: (),
    "04-agent-hardware.bailian": lambda d: (d / "samples",),
    "07-recorder.bailian": lambda d: (d / "samples" / "meeting.json",),
    "08-smart-watch.bailian": lambda d: (),
    "09-embodied.bailian": lambda d: (),
}
# 02 在设备上用 WebSocket 播报；浏览器版改走非实时 HTTP 合成，借 08 的 mock（同一个接口）
BORROW = {("02-ai-glasses.bailian", "/api/v1/services/audio/tts/SpeechSynthesizer"): "08-smart-watch.bailian"}
_mocks: dict[str, object] = {}
FILE_HOST = "https://dashscope-file-mock.oss-cn-beijing.aliyuncs.com"
RESULT_URL = "https://dashscope-result.oss-cn-beijing.aliyuncs.com/transcription.json?token=temporary-transcription"


def demo_dir(sol_id: str) -> Path:
    category, stack = sol_id.split(".")
    return REPO / "solutions" / "by-category" / category / "demo" / stack


def mock_for(sol_id: str):
    if sol_id not in _mocks:
        module = load_module(demo_dir(sol_id), "mock")
        _mocks[sol_id] = module.MockHttp(*MOCK_ARGS[sol_id](demo_dir(sol_id)))
    return _mocks[sol_id]


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args) -> None:
        pass

    def reply(self, status: int, body: bytes, kind: str = "application/json") -> None:
        self.send_response(status)
        self.send_header("Content-Type", kind)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def error(self, status: int, code: str, message: str) -> None:
        self.reply(status, json.dumps({"code": code, "message": message}, ensure_ascii=False).encode())

    def do_GET(self) -> None:  # noqa: N802
        try:
            _, sol_id, rest = self.path.split("/", 2)
            rest = "/" + rest
            if sol_id != "07-recorder.bailian":
                return self.error(404, "NotFound", "GET is only mocked for file transcription")
            mock = mock_for(sol_id)
            if urlsplit(rest).path == "/__oss/result":
                if self.headers.get("Authorization"):
                    raise ValueError("transcription result download must not send Authorization")
                data = json.loads(mock.get_bytes("mock://transcription.json"))
                data["file_url"] = getattr(mock, "uploaded_url", "")
            else:
                if self.headers.get("Authorization") != f"Bearer {KEY}":
                    return self.error(401, "InvalidApiKey", "Invalid API-key provided.")
                data = mock.json("GET", "https://fake.invalid" + rest, dict(self.headers.items()))
                if rest.startswith("/api/v1/uploads?"):
                    data["data"]["upload_host"] = FILE_HOST
                if "/tasks/" in rest:
                    data["request_id"] = "smoke-task-poll-response"
                    for result in data.get("output", {}).get("results", []):
                        result["transcription_url"] = RESULT_URL
                        result["file_url"] = getattr(mock, "uploaded_url", "")
            return self.reply(200, json.dumps(data, ensure_ascii=False).encode())
        except Exception as exc:  # noqa: BLE001
            return self.error(400, "MockRejected", str(exc))

    def upload(self, sol_id: str, raw: bytes) -> None:
        if sol_id != "07-recorder.bailian" or self.headers.get("Authorization"):
            raise ValueError("OSS upload must not send Authorization")
        message = BytesParser(policy=default).parsebytes(
            ("Content-Type: " + self.headers.get("Content-Type", "") + "\r\nMIME-Version: 1.0\r\n\r\n").encode() + raw
        )
        if not message.is_multipart():
            raise ValueError("OSS upload must be multipart/form-data")
        parts = list(message.iter_parts())
        if not parts or parts[-1].get_param("name", header="content-disposition") != "file":
            raise ValueError("OSS file must be the last form field")
        fields = {}
        for part in parts[:-1]:
            name = part.get_param("name", header="content-disposition")
            if not name or name == "file" or name in fields:
                raise ValueError("OSS form contains a duplicate or unnamed field")
            fields[name] = part.get_payload(decode=True).decode()
        audio = parts[-1].get_payload(decode=True)
        if not audio or len(audio) > 7 * 1024 * 1024:
            raise ValueError("OSS fixture requires nonempty audio up to 7 MiB")
        if fields.get("x-oss-object-acl") != "private" or fields.get("x-oss-forbid-overwrite") != "true":
            raise ValueError("OSS upload must preserve private ACL and forbid overwrite")
        mock = mock_for(sol_id)
        status = mock.multipart("mock://dashscope-file-mock.oss-cn-beijing.aliyuncs.com", fields, "file", parts[-1].get_filename(), audio)
        mock.uploaded_url = "oss://" + fields["key"]
        return self.reply(status, b"")

    def do_POST(self) -> None:  # noqa: N802
        _, sol_id, rest = self.path.split("/", 2)
        rest = "/" + rest
        length = int(self.headers.get("Content-Length") or 0)
        raw = self.rfile.read(length) if length else b""
        if rest == "/reset":
            _mocks.pop(sol_id, None)
            return self.reply(204, b"")
        if sol_id not in MOCK_ARGS:
            return self.error(404, "NotFound", f"没有 {sol_id} 的 mock")
        if rest == "/__oss/upload":
            try:
                return self.upload(sol_id, raw)
            except Exception as exc:  # noqa: BLE001
                return self.error(400, "MockRejected", str(exc))
        if self.headers.get("Authorization") != f"Bearer {KEY}":
            return self.error(401, "InvalidApiKey", "Invalid API-key provided.")
        payload = json.loads(raw or b"{}")
        if sol_id == "07-recorder.bailian" and rest.endswith("/generation") and payload.get("parameters", {}).get("format") == "wav":
            # Official ASR HTTP contract requires sample_rate as a string.
            rate = payload.get("parameters", {}).get("sample_rate")
            if not isinstance(rate, str) or not rate.isdigit():
                return self.error(400, "MockRejected", "WAV sample_rate must be a string")
        headers = dict(self.headers.items())
        for name in ("X-DashScope-Async", "X-DashScope-OssResourceResolve"):
            if self.headers.get(name) is not None:
                headers[name] = self.headers.get(name)
        url = "https://fake.invalid" + rest
        try:
            if rest.startswith("/compatible-mode/"):
                content = payload.get("messages", [{}])[-1].get("content", [])
                custom_image = sol_id == "02-ai-glasses.bailian" and isinstance(content, list) and not any(p.get("type") == "input_audio" for p in content)
                if custom_image:
                    # Additive browser-only fixture. Bundled photo+audio still goes through original demo mock.
                    parts = {p.get("type"): p for p in content}
                    image = parts.get("image_url", {}).get("image_url", {}).get("url", "")
                    question = parts.get("text", {}).get("text", "")
                    if not image.startswith(("data:image/jpeg;base64,", "data:image/png;base64,", "data:image/webp;base64,")) or not base64.b64decode(image.split(",", 1)[1], validate=True) or not question.strip() or len(question) > 2000 or payload.get("reasoning_effort") != "none":
                        raise ValueError("custom image fixture requires supported image and text question")
                    events = [{"choices": [{"delta": {"content": "这是自选照片的 mock 回答，仅用于验证界面流程。"}}]}, {"choices": [], "usage": {"prompt_tokens": 80, "completion_tokens": 30}}]
                else:
                    events = list(mock_for(sol_id).sse(url, headers, payload))
                body = "".join(f"data: {json.dumps(e, ensure_ascii=False)}\n\n" for e in events) + "data: [DONE]\n\n"
                return self.reply(200, body.encode(), "text/event-stream")
            target = BORROW.get((sol_id, rest), sol_id)
            if sol_id == "07-recorder.bailian" and rest.endswith("/services/audio/asr/transcription"):
                mock = mock_for(sol_id)
                if payload.get("input", {}).get("file_urls") != [getattr(mock, "uploaded_url", None)]:
                    raise ValueError("filetrans must submit the exact uploaded OSS object")
                mock.polls = 0
            data = mock_for(target).json("POST", url, headers, payload)
            if sol_id == "07-recorder.bailian" and rest.endswith("/services/audio/asr/transcription"):
                data["request_id"] = "smoke-asr-request-123"
            return self.reply(200, json.dumps(data, ensure_ascii=False).encode())
        except Exception as exc:  # noqa: BLE001 — mock 的校验失败原样回给页面
            return self.error(400, "MockRejected", str(exc))


def main() -> None:
    ap = argparse.ArgumentParser(description="网页 APP 冒烟测试用的本地假百炼")
    ap.add_argument("--port", type=int, default=8790)
    args = ap.parse_args()
    server = HTTPServer(("127.0.0.1", args.port), Handler)  # 单线程：mock 有会话状态，导入时还要改 sys.path
    print(f"fake bailian on 127.0.0.1:{server.server_port}", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
