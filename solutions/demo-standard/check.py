#!/usr/bin/env python3
"""check.py — demo 标准自检（CI 与本地共用）

  python3 solutions/demo-standard/check.py            # 依次跑下面三项
  python3 solutions/demo-standard/check.py secrets    # 密钥扫描：git 跟踪的文件 + 未忽略的新文件
  python3 solutions/demo-standard/check.py manifests  # solution.yaml、目录结构、公共件与模板一致
  python3 solutions/demo-standard/check.py smoke      # 全部 demo 的 mock 冒烟（子进程不带 DASHSCOPE_* 变量）
  python3 solutions/demo-standard/check.py sync       # 改完模板公共件后，同步到同一栈的全部 demo

manifests 需要 PyYAML，装了 jsonschema 时做完整 schema 校验：pip install pyyaml jsonschema
"""
from __future__ import annotations

import json
import os
import re
import shlex
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
STD = ROOT / "solutions" / "demo-standard"
CATEGORIES = ROOT / "solutions" / "by-category"
TEMPLATE = STD / "templates" / "bailian"
VERIFY_HEADER = "| 日期 | 地域 | 模型 | 首字延迟 | 单次成本（元） | 输入 | 环境 | 验证人 | 备注 |"
SHARED_FILES = {"bailian": ("demo_kit.py", ".env.example")}

# 还没迁到「品类 × 栈」目录的旧 demo：(目录, mock 命令)。迁移后从这里删除。
LEGACY = [
    ("01-ipc/demo/physical-sense", "python3 test_physical_sense.py --mock"),
    ("02-ai-glasses/demo/kit-chat", "python3 glasses_kit_chat.py --mock"),
    ("02-ai-glasses/demo/omni-realtime", "python3 glasses_omni_realtime.py --mock"),
    ("03-toys-companion/demo/voice-clone", "python3 voice_clone_story.py --mock"),
    ("04-agent-hardware/demo/intent-router", "python3 intent_router.py"),
    ("05-desktop-pet/demo/stream-tag-parser", "python3 stream_tag_parser.py"),
    ("06-ai-earphone/demo/livetranslate-ws", "python3 livetranslate_ws.py --mode mock --seconds 1"),
    ("07-recorder/demo/map-reduce-summary", "python3 map_reduce_summary.py"),
    ("08-smart-watch/demo/metrics-prompt", "python3 health_metrics_prompt.py --metrics sample_day.json"),
    ("09-embodied/demo/vla-intent-router", "python3 vla_intent_router.py"),
]

SECRET_PATTERNS = [
    ("sk- 形态 API Key", re.compile(r"\bsk-[A-Za-z0-9]{20,}")),
    ("阿里云 AccessKey ID", re.compile(r"\bLTAI[A-Za-z0-9]{12,30}\b")),
    ("AWS Access Key", re.compile(r"\bAKIA[0-9A-Z]{16}\b")),
    ("GitHub Token", re.compile(r"\b(?:gh[pousr]_[A-Za-z0-9]{36}|github_pat_[A-Za-z0-9_]{50,})")),
    ("私钥", re.compile(r"-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----")),
    ("Bearer Token", re.compile(r"Bearer\s+([A-Za-z0-9_\-.]{30,})")),
]


def _placeholder(token: str) -> bool:
    """sk-xxxx…、sk-your-key 之类的占位符：不含数字，或几乎全是同一个字符。"""
    body = re.sub(r"^(sk-|Bearer\s+)", "", token)
    return not re.search(r"\d", body) or len(set(body.lower())) <= 3


def _git_files() -> list[Path]:
    out = subprocess.run(["git", "ls-files", "-z", "--cached", "--others", "--exclude-standard"],
                         cwd=ROOT, capture_output=True, check=True).stdout
    return [ROOT / p for p in out.decode().split("\0") if p]


def check_secrets() -> bool:
    findings, scanned = [], 0
    for path in _git_files():
        rel = path.relative_to(ROOT).as_posix()
        if re.fullmatch(r"(.*/)?\.env(\..+)?", rel) and not rel.endswith(".env.example"):
            findings.append(f"{rel}: 不应提交 .env 文件")
        if not path.is_file() or path.stat().st_size > 2_000_000:
            continue
        data = path.read_bytes()
        if b"\0" in data[:8192]:
            continue
        scanned += 1
        for lineno, line in enumerate(data.decode("utf-8", "replace").splitlines(), 1):
            for label, pattern in SECRET_PATTERNS:
                for match in pattern.finditer(line):
                    if not _placeholder(match.group(0)):
                        findings.append(f"{rel}:{lineno}: 疑似{label} {match.group(0)[:8]}…")
    print(f"== secrets == 扫描 {scanned} 个文本文件")
    for item in findings:
        print(f"  FAIL {item}")
    if not findings:
        print("  OK 未发现疑似密钥或 .env 文件")
    return not findings


def _manifests() -> list[Path]:
    return sorted(CATEGORIES.glob("*/demo/*/solution.yaml"))


def _load_yaml(path: Path) -> dict:
    try:
        import yaml
    except ImportError:
        sys.exit("manifests 检查需要 PyYAML：pip install pyyaml jsonschema")
    # 日期等非 JSON 类型统一转成字符串，再交给 JSON Schema
    return json.loads(json.dumps(yaml.safe_load(path.read_text(encoding="utf-8")), default=str))


def _verify_rows(text: str) -> list[str] | None:
    """返回 VERIFY.md 标准表格里的记录行；没有标准表头时返回 None。"""
    lines = text.splitlines()
    if VERIFY_HEADER not in lines:
        return None
    start = lines.index(VERIFY_HEADER) + 2  # 跳过表头与分隔行
    return [ln for ln in lines[start:] if ln.startswith("|")]


def check_manifests() -> bool:
    schema = json.loads((STD / "solution.schema.json").read_text(encoding="utf-8"))
    try:
        import jsonschema
    except ImportError:
        jsonschema = None
    ok = True
    paths = _manifests()
    print(f"== manifests == {len(paths)} 个方案清单" + ("" if jsonschema else "（未装 jsonschema，只查必填字段）"))
    for path in paths:
        demo_dir = path.parent
        rel = demo_dir.relative_to(ROOT).as_posix()
        category, _, stack = demo_dir.relative_to(CATEGORIES).parts
        errors = []
        data = _load_yaml(path)
        if jsonschema:
            validator = jsonschema.Draft202012Validator(schema)
            errors += [f"schema: {'/'.join(map(str, e.path)) or '(根)'} {e.message}" for e in validator.iter_errors(data)]
        else:
            errors += [f"缺少字段 {k}" for k in schema["required"] if k not in data]
        if data.get("category") != category or data.get("stack") != stack:
            errors.append(f"目录应为 by-category/{data.get('category')}/demo/{data.get('stack')}/")
        if data.get("id") != f"{category}.{stack}":
            errors.append(f"id 应为 {category}.{stack}")
        for name in ("README.md", "VERIFY.md", ".env.example", "requirements.txt"):
            if not (demo_dir / name).is_file():
                errors.append(f"缺少 {name}")
        readme = demo_dir / "README.md"
        if readme.is_file() and "三步跑通" not in readme.read_text(encoding="utf-8"):
            errors.append("README.md 缺少「三步跑通」一节")
        verification = data.get("verification") or {}
        verify = demo_dir / str(verification.get("record", "VERIFY.md"))
        if verify.is_file():
            rows = _verify_rows(verify.read_text(encoding="utf-8"))
            if rows is None:
                errors.append(f"{verify.name} 缺少标准表头")
            elif verification.get("status") == "live-verified" and not rows:
                errors.append("status 为 live-verified，但 VERIFY.md 没有记录")
        else:
            errors.append(f"缺少验证记录文件 {verify.name}")
        mock_cmd = shlex.split(str((data.get("run") or {}).get("mock", "")))
        if len(mock_cmd) < 2 or not (demo_dir / mock_cmd[1]).is_file():
            errors.append("run.mock 指向的入口脚本不存在")
        for name in SHARED_FILES.get(stack, ()):
            copy = demo_dir / name
            if not copy.is_file() or copy.read_bytes() != (TEMPLATE / name).read_bytes():
                errors.append(f"{name} 与模板 templates/{stack}/{name} 不一致（改模板后再同步）")
        print(f"  {'OK  ' if not errors else 'FAIL'} {rel}")
        for err in errors:
            print(f"       - {err}")
        ok &= not errors
    return ok


def _run(cwd: Path, command: str, timeout: int = 180) -> tuple[int, str, float]:
    argv = shlex.split(command)
    if argv[0] in ("python3", "python"):
        argv[0] = sys.executable
    env = {k: v for k, v in os.environ.items() if not k.startswith("DASHSCOPE_")}
    env.update(PYTHONDONTWRITEBYTECODE="1", PYTHONIOENCODING="utf-8")
    start = time.monotonic()
    try:
        proc = subprocess.run(argv, cwd=cwd, env=env, stdin=subprocess.DEVNULL, capture_output=True,
                              text=True, encoding="utf-8", errors="replace", timeout=timeout)
        return proc.returncode, proc.stdout + proc.stderr, time.monotonic() - start
    except subprocess.TimeoutExpired:
        return 124, f"超时（>{timeout}s）", time.monotonic() - start


def check_smoke() -> bool:
    jobs = [(TEMPLATE, "python3 run.py --mock", True)]
    for path in _manifests():
        command = str(_load_yaml(path)["run"]["mock"])
        jobs.append((path.parent, command, True))
    jobs += [(CATEGORIES / rel, command, False) for rel, command in LEGACY]
    print(f"== smoke == {len(jobs)} 个 demo（mock / 离线模式，无 Key）")
    ok = True
    for cwd, command, standard in jobs:
        code, output, seconds = _run(cwd, command)
        problems = []
        if code != 0:
            problems.append(f"退出码 {code}")
        if standard and "MOCK" not in output:
            problems.append("输出里没有 MOCK 模式标识")
        if standard and VERIFY_HEADER not in output:
            problems.append("输出里没有验证记录")
        rel = cwd.relative_to(ROOT).as_posix()
        print(f"  {'OK  ' if not problems else 'FAIL'} {rel:<58} {command}  ({seconds:.1f}s)")
        if problems:
            ok = False
            print("       - " + "；".join(problems))
            print("\n".join("       | " + ln for ln in output.strip().splitlines()[-25:]))
    return ok


def sync_shared() -> bool:
    """把模板里的公共件复制到同一栈的全部 demo（改完模板后运行）。"""
    for path in _manifests():
        stack = path.parent.name
        for name in SHARED_FILES.get(stack, ()):
            target = path.parent / name
            source = ROOT / "solutions" / "demo-standard" / "templates" / stack / name
            if not target.is_file() or target.read_bytes() != source.read_bytes():
                target.write_bytes(source.read_bytes())
                print(f"  synced {target.relative_to(ROOT).as_posix()}")
    return True


def main() -> None:
    steps = {"secrets": check_secrets, "manifests": check_manifests, "smoke": check_smoke}
    if sys.argv[1:] == ["sync"]:
        sys.exit(0 if sync_shared() else 1)
    chosen = sys.argv[1:] or list(steps)
    unknown = [c for c in chosen if c not in steps]
    if unknown:
        sys.exit(f"未知检查项 {unknown}，可选：{' / '.join(steps)} / sync")
    results = [steps[name]() for name in chosen]
    sys.exit(0 if all(results) else 1)


if __name__ == "__main__":
    main()
