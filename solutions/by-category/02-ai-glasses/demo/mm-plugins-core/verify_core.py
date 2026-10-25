"""不经编程 Agent，直接以 MCP stdio 调 qwen-mm-plugins-core 的 visualize 读 fixtures/sample.pdf。

只用标准库。子进程环境里剔除 DASHSCOPE_* / QWEN_MM_* / OPENAI_*，证明 core 在默认 native 模式下不需要云端 Key。
通过时退出码 0，产物写到 out/。
"""

from __future__ import annotations

import argparse
import base64
import json
import os
import queue
import shlex
import subprocess
import sys
import threading
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
FIXTURE = HERE / "fixtures" / "sample.pdf"
OUT = HERE / "out"

CORE_TAG = "qwen-mm-plugins-core-v1.3.0"
# 与上游 src/capabilities/core/.mcp.json 一致，harness 安装后跑的就是这条命令
DEFAULT_SERVER = [
    "uvx",
    "--from",
    f"qwen-mm-plugins[core] @ git+https://github.com/QwenLM/Qwen-MM-Plugins.git@{CORE_TAG}",
    "qwen-mm-plugins-core",
]
PROTOCOL = "2025-06-18"
STRIP_PREFIXES = ("DASHSCOPE_", "QWEN_MM_", "OPENAI_")

PAGE1_EXPECT = {
    "标题": "AIHW Fixture Sheet 01",
    "校验码": "MMP-7Q4",
    "物料表": "Microphone",
}
PAGE2_CODE = "MMP-2B8"


class McpClient:
    def __init__(self, cmd: list[str], env: dict[str, str], stderr_path: Path):
        self._stderr = stderr_path.open("wb")
        self.proc = subprocess.Popen(
            cmd, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=self._stderr, env=env
        )
        self._lines: queue.Queue[bytes | None] = queue.Queue()
        threading.Thread(target=self._pump, daemon=True).start()
        self._next_id = 0

    def _pump(self) -> None:
        for line in self.proc.stdout:
            self._lines.put(line)
        self._lines.put(None)

    def _send(self, msg: dict) -> None:
        self.proc.stdin.write((json.dumps(msg, ensure_ascii=False) + "\n").encode("utf-8"))
        self.proc.stdin.flush()

    def notify(self, method: str, params: dict | None = None) -> None:
        self._send({"jsonrpc": "2.0", "method": method, **({"params": params} if params else {})})

    def request(self, method: str, params: dict, timeout: float) -> dict:
        self._next_id += 1
        rid = self._next_id
        self._send({"jsonrpc": "2.0", "id": rid, "method": method, "params": params})
        deadline = time.monotonic() + timeout
        while True:
            left = deadline - time.monotonic()
            if left <= 0:
                raise TimeoutError(f"{method} 超过 {timeout:.0f} 秒没有响应")
            try:
                line = self._lines.get(timeout=left)
            except queue.Empty:
                continue
            if line is None:
                raise RuntimeError(f"服务进程已退出（退出码 {self.proc.poll()}），见 {self._stderr.name}")
            try:
                msg = json.loads(line)
            except json.JSONDecodeError:
                continue
            if msg.get("id") == rid:
                if "error" in msg:
                    raise RuntimeError(f"{method} 返回错误：{msg['error']}")
                return msg["result"]

    def close(self) -> None:
        try:
            self.proc.stdin.close()
            self.proc.wait(timeout=10)
        except Exception:
            self.proc.kill()
        self._stderr.close()


def _texts(content: list[dict]) -> str:
    return "\n".join(b.get("text", "") for b in content if b.get("type") == "text")


def _images(content: list[dict]) -> list[dict]:
    return [b for b in content if b.get("type") == "image"]


def _redact(content: list[dict]) -> list[dict]:
    return [
        {**b, "data": f"<base64 {len(b.get('data', ''))} 字符>"} if b.get("type") == "image" else b
        for b in content
    ]


def main() -> int:
    ap = argparse.ArgumentParser(description="以 MCP stdio 直连 qwen-mm-plugins-core 读 fixture PDF")
    ap.add_argument("--server-cmd", help="替换启动命令，例如本地源码：'python3 -m qwen_mm_plugins_core'")
    ap.add_argument("--timeout", type=float, default=900, help="首次启动含依赖安装的等待秒数（默认 900）")
    args = ap.parse_args()
    sys.stdout.reconfigure(line_buffering=True)

    cmd = shlex.split(args.server_cmd) if args.server_cmd else DEFAULT_SERVER
    env = {k: v for k, v in os.environ.items() if not k.startswith(STRIP_PREFIXES)}
    OUT.mkdir(exist_ok=True)
    failures: list[str] = []

    label = "uvx，固定 " + CORE_TAG if not args.server_cmd else args.server_cmd
    print(f"[MCP] 启动 qwen-mm-plugins-core（{label}）；首次会下载依赖，约几分钟")
    print(f"[MCP] 子进程已剔除 {' / '.join(p + '*' for p in STRIP_PREFIXES)}，不带任何云端 Key")
    try:
        client = McpClient(cmd, env, OUT / "server.stderr.log")
    except FileNotFoundError:
        print(f"[MCP] 找不到 {cmd[0]}：先装 uv（https://docs.astral.sh/uv/getting-started/installation/）", file=sys.stderr)
        return 2

    try:
        t0 = time.monotonic()
        init = client.request(
            "initialize",
            {"protocolVersion": PROTOCOL, "capabilities": {}, "clientInfo": {"name": "aihw-verify-core", "version": "1"}},
            args.timeout,
        )
        client.notify("notifications/initialized")
        info = init.get("serverInfo", {})
        tools = [t["name"] for t in client.request("tools/list", {}, 60).get("tools", [])]
        print(
            f"[MCP] 已连接（{time.monotonic() - t0:.1f} 秒）：{info.get('name')} {info.get('version', '')}"
            f" · 协议 {init.get('protocolVersion')} · 工具 {len(tools)} 个"
        )
        if "visualize" not in tools:
            print(f"[检查] 工具列表里没有 visualize：{tools}", file=sys.stderr)
            return 1

        p1 = client.request(
            "tools/call",
            {"name": "visualize", "arguments": {"file_path": str(FIXTURE), "pages": "1", "budget": "small"}},
            120,
        )
        c1 = p1.get("content", [])
        (OUT / "visualize-page1.json").write_text(
            json.dumps({**p1, "content": _redact(c1)}, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        text1, imgs1 = _texts(c1), _images(c1)
        print(f"[MCP] visualize sample.pdf pages=1 → 文本块 {len(c1) - len(imgs1)} · 图片 {len(imgs1)}")
        if p1.get("isError"):
            failures.append(f"visualize 返回 isError：{text1[:200]}")
        if "Total pages: 2" not in text1:
            failures.append("没有读到总页数 2")
        for name, want in PAGE1_EXPECT.items():
            ok = want in text1
            print(f"[检查] 第 1 页{name}「{want}」：{'通过' if ok else '未命中'}")
            if not ok:
                failures.append(f"第 1 页缺少 {want}")
        if PAGE2_CODE in text1:
            failures.append(f"pages=1 混入了第 2 页的 {PAGE2_CODE}")
        if imgs1:
            img = imgs1[0]
            ext = (img.get("mimeType") or "image/png").split("/")[-1]
            (OUT / f"page1.{ext}").write_bytes(base64.b64decode(img.get("data", "")))
            print(f"[检查] 第 1 页渲染图：{img.get('mimeType')} → out/page1.{ext}")
        else:
            failures.append("没有返回页面图片块")

        p2 = client.request(
            "tools/call",
            {"name": "visualize", "arguments": {"file_path": str(FIXTURE), "pages": "2", "budget": "small"}},
            120,
        )
        ok2 = PAGE2_CODE in _texts(p2.get("content", []))
        print(f"[检查] 第 2 页校验码「{PAGE2_CODE}」：{'通过' if ok2 else '未命中'}")
        if not ok2:
            failures.append(f"pages=2 没有读到 {PAGE2_CODE}")
    except (TimeoutError, RuntimeError) as exc:
        print(f"[MCP] {exc}", file=sys.stderr)
        return 1
    finally:
        client.close()

    if failures:
        print("失败：" + "；".join(failures), file=sys.stderr)
        return 1
    print("通过：core 在本地读出 fixture 的标题、校验码和表格，未用任何云端 Key。产物在 out/")
    return 0


if __name__ == "__main__":
    sys.exit(main())
