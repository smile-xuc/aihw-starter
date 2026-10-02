#!/usr/bin/env python3
"""check.py — demo 标准自检（CI 与本地共用）

  python3 solutions/demo-standard/check.py            # 依次跑下面四项
  python3 solutions/demo-standard/check.py secrets    # 密钥扫描：git 跟踪的文件 + 未忽略的新文件
  python3 solutions/demo-standard/check.py manifests  # solution.yaml、词表、栈声明、公共件与模板一致、模型名与接入地址
  python3 solutions/demo-standard/check.py smoke      # 全部 demo 的 mock 冒烟（子进程不带 DASHSCOPE_* 变量）
  python3 solutions/demo-standard/check.py registry   # docs/app/data/ 的注册表与回放轨迹与源文件一致
  python3 solutions/demo-standard/check.py sync       # 改完模板公共件后，同步到同一栈的全部 demo

manifests、registry 需要 PyYAML，装了 jsonschema 时做完整 schema 校验：pip install pyyaml jsonschema
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

# 2026-10-10 下线、与 AI 硬件 demo 相关的模型（阿里云公告 118177 / 118331 / 118332 / 118344 / 118345 / 118434）。
# 只列主线名；带日期的快照由 SNAPSHOT 规则统一拦下。
DEPRECATED_MODELS = {
    "qwen-turbo", "qwen-turbo-realtime", "qwen-vl-max", "qwen-vl-plus", "qwq-plus", "qvq-max", "qvq-plus",
    "qwen-coder-turbo", "qwen-coder-plus", "qwen-math-turbo", "qwen-math-plus",
    "qwen3-max", "qwen3-max-preview", "qwen3.6-max-preview", "qwen3-vl-flash", "qwen3-coder-plus",
    "qwen-tts", "qwen-tts-realtime", "qwen-voice-design", "gummy-chat-v1", "gummy-realtime-v1",
    "paraformer-v1", "paraformer-8k-v1", "paraformer-mtl-v1", "paraformer-realtime-v1", "paraformer-realtime-8k-v1",
    "cosyvoice-v1", "cosyvoice-v3", "cosyvoice-clone-v1", "sensevoice-v1", "fun-asr-mtl", "fun-asr-mtl-realtime",
    "qwen-omni-turbo", "qwen-omni-turbo-realtime", "qwen3-omni-flash-realtime",
    "qwen3-livetranslate-flash-realtime", "qwen-mt-turbo", "qwen-image", "qwen-image-edit",
}
DEPRECATED_PREFIXES = ("qwen3-tts-", "qwen-omni-turbo-", "qwen-long-")
SNAPSHOT = re.compile(r"-(?:\d{4}-\d{2}-\d{2}|\d{4}|latest)$")
MODEL_LITERAL = re.compile(r"""["']((?:qwen|qwq|qvq|cosyvoice|paraformer|fun-asr|gummy|sensevoice)[a-z0-9.\-]*)["']""")
HARDCODED_HOST = re.compile(r"dashscope(?:-intl)?\.aliyuncs\.com|maas\.aliyuncs\.com")

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


def _model_problems(model_id: str, snapshot_ok: bool = False) -> list[str]:
    problems = []
    if model_id in DEPRECATED_MODELS or model_id.startswith(DEPRECATED_PREFIXES):
        problems.append(f"{model_id} 在 2026-10-10 下线清单里，换成扫描文档推荐的替代")
    if not snapshot_ok and SNAPSHOT.search(model_id):
        problems.append(f"{model_id} 是带日期的快照或 latest 别名，改用主线名")
    return problems


def _py_sources(demo_dir: Path) -> dict[Path, str]:
    """demo 目录里除公共件外的 Python 源码（不含 out/ 等运行产物）。"""
    return {p: p.read_text(encoding="utf-8") for p in sorted(demo_dir.rglob("*.py"))
            if p.name != "demo_kit.py" and "out" not in p.relative_to(demo_dir).parts}


def _verify_rows(text: str) -> list[str] | None:
    """返回 VERIFY.md 标准表格里的记录行；没有标准表头时返回 None。"""
    lines = text.splitlines()
    if VERIFY_HEADER not in lines:
        return None
    start = lines.index(VERIFY_HEADER) + 2  # 跳过表头与分隔行
    return [ln for ln in lines[start:] if ln.startswith("|")]


def _vocab() -> dict[str, set[str]]:
    data = _load_yaml(STD / "vocab.yaml")
    return {name: {item["id"] for item in data.get(name) or []}
            for name in ("archetypes", "parts", "features", "compliance")}


def _stacks() -> dict[str, dict]:
    return {p.stem: _load_yaml(p) for p in sorted((STD / "stacks").glob("*.yaml"))}


def _vocab_problems(data: dict, demo_dir: Path, vocab: dict[str, set[str]], stack: dict | None) -> list[str]:
    """v0.3：词表、玩法、凭证与接入点要和 vocab.yaml、stacks/<栈>.yaml 对得上。"""
    errors = []

    def unknown(kind: str, values, where: str) -> None:
        for value in values or []:
            if value not in vocab[kind]:
                errors.append(f"{where} 的 {value} 不在 vocab.yaml 的 {kind} 里")

    unknown("features", data.get("features"), "features")
    unknown("compliance", data.get("compliance_tags"), "compliance_tags")
    unknown("parts", [p.get("part") for p in (data.get("hardware") or {}).get("parts") or []], "hardware.parts")
    experience = data.get("experience") or {}
    variants = experience.get("variants") or []
    unknown("archetypes", [experience.get("archetype")] if experience else [], "experience.archetype")
    unknown("archetypes", [v.get("archetype") for v in variants if v.get("archetype")], "variants[].archetype")
    if variants and (variants[0].get("id") != "default" or variants[0].get("args")):
        errors.append("experience.variants 的第一个必须是 id 为 default、args 为空的默认玩法")
    ids = [v.get("id") for v in variants]
    if len(ids) != len(set(ids)):
        errors.append("experience.variants 的 id 重复")
    cover = experience.get("cover")
    if cover and not (demo_dir / cover).is_file():
        errors.append(f"experience.cover 指向的 {cover} 不存在")
    regions = set(data.get("regions") or [])
    for model in data.get("models") or []:
        extra = set(model.get("regions") or []) - regions
        if extra:
            errors.append(f"models 里 {model.get('id')} 的 regions {sorted(extra)} 不在方案的 regions 里")
    if stack:
        keys = {f["key"] for f in stack.get("fields") or []}
        services = {s["id"] for s in (stack.get("endpoints") or {}).get("services") or []}
        envs = [data.get("env") or []] + [v.get("env") for v in variants if v.get("env")]
        for env in envs:
            errors += [f"env 里的 {k} 不在 stacks/{stack['id']}.yaml 的 fields 里" for k in env if k not in keys]
        for variant in variants:
            errors += [f"玩法 {variant.get('id')} 的接入点 {s} 不在 stacks/{stack['id']}.yaml 的 services 里"
                       for s in variant.get("services") or [] if s not in services]
    return errors


def check_stacks() -> bool:
    """栈声明过 schema；百炼的 .env.example 变量名和 demo_kit 地址表要与声明一致。"""
    schema = json.loads((STD / "stack.schema.json").read_text(encoding="utf-8"))
    try:
        import jsonschema
    except ImportError:
        jsonschema = None
    ok = True
    for name, stack in _stacks().items():
        errors = []
        if jsonschema:
            validator = jsonschema.Draft202012Validator(schema)
            errors += [f"schema: {'/'.join(map(str, e.path)) or '(根)'} {e.message}" for e in validator.iter_errors(stack)]
        if stack.get("id") != name:
            errors.append(f"id 应为 {name}（与文件名一致）")
        template = STD / "templates" / name
        env_example = template / ".env.example"
        if env_example.is_file():
            declared = {f["key"] for f in stack.get("fields") or []}
            listed = {m.group(1) for m in re.finditer(r"^([A-Z][A-Z0-9_]+)=", env_example.read_text(encoding="utf-8"), re.M)}
            listed = {k for k in listed if not k.startswith("AIHW_")}
            if listed != declared:
                errors.append(f"templates/{name}/.env.example 的变量 {sorted(listed)} 与声明的 fields {sorted(declared)} 不一致")
        if name == "bailian":
            errors += _bailian_endpoint_problems(stack, template)
        print(f"  {'OK  ' if not errors else 'FAIL'} 栈声明 stacks/{name}.yaml")
        for err in errors:
            print(f"       - {err}")
        ok &= not errors
    return ok


def _bailian_endpoint_problems(stack: dict, template: Path) -> list[str]:
    """按声明推导出的地址，要与 demo_kit.Config 算出的地址逐个相同。"""
    import importlib.util
    spec = importlib.util.spec_from_file_location("_kit_for_check", template / "demo_kit.py")
    kit = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = kit  # dataclass 处理字符串注解时要能在 sys.modules 里找到模块
    spec.loader.exec_module(kit)
    region_field = next((f for f in stack["fields"] if f["key"] == "DASHSCOPE_API_REGION"), None)
    regions = [o["value"] for o in (region_field or {}).get("options") or []]
    errors = []
    if sorted(regions) != sorted(kit.REGIONS):
        errors.append(f"声明的地域 {sorted(regions)} 与 demo_kit.REGIONS {sorted(kit.REGIONS)} 不一致")
    for region in regions:
        for workspace in ("llm-check", ""):
            values = {"DASHSCOPE_API_REGION": region, "DASHSCOPE_WORKSPACE_ID": workspace}
            root = next((r for r in stack["endpoints"]["roots"]
                         if all((values.get(k, "") != "") if v == "*" else values.get(k) == v
                                for k, v in r["when"].items())), None)
            if root is None:
                errors.append(f"{region}{' + 业务空间' if workspace else ''} 没有匹配的 endpoints.roots")
                continue
            render = {key: (tpl or "").format(**values) for key, tpl in (("http", root["http"]), ("ws", root["ws"]))}
            cfg = kit.Config("live", "", region, "sk-check", workspace)
            if render["http"] != cfg.http_root() or render["ws"] != cfg.ws_root():
                errors.append(f"{region}{' + 业务空间' if workspace else ''}：声明推导出 {render}，"
                              f"demo_kit 是 http={cfg.http_root()} ws={cfg.ws_root()}")
    return errors


def check_manifests() -> bool:
    schema = json.loads((STD / "solution.schema.json").read_text(encoding="utf-8"))
    try:
        import jsonschema
    except ImportError:
        jsonschema = None
    ok = True
    paths = _manifests()
    vocab, stacks = _vocab(), _stacks()
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
        errors += _vocab_problems(data, demo_dir, vocab, stacks.get(stack))
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
        sources = _py_sources(demo_dir)
        code = "\n".join(sources.values())
        for model in data.get("models") or []:
            model_id = str(model.get("id", ""))
            errors += _model_problems(model_id)
            if f'"{model_id}"' not in code and f"'{model_id}'" not in code:
                errors.append(f"solution.yaml 的模型 {model_id} 没出现在代码里（run.py 常量与清单要一致）")
        for file, text in sources.items():
            for lineno, line in enumerate(text.splitlines(), 1):
                if HARDCODED_HOST.search(line):
                    errors.append(f"{file.relative_to(demo_dir)}:{lineno} 写死了百炼域名，地址请用 demo_kit.Config 的方法")
                for literal in MODEL_LITERAL.findall(line):
                    errors += [f"{file.relative_to(demo_dir)}:{lineno} {p}" for p in _model_problems(literal)]
        print(f"  {'OK  ' if not errors else 'FAIL'} {rel}")
        for err in errors:
            print(f"       - {err}")
        ok &= not errors
    stacks_ok = check_stacks()
    return check_legacy_models() and stacks_ok and ok


def check_legacy_models() -> bool:
    """旧 demo 不强制主线名，但不能再用 2026-10-10 下线的模型。"""
    findings = []
    for rel, _ in LEGACY:
        demo_dir = CATEGORIES / rel
        for file, text in _py_sources(demo_dir).items():
            for lineno, line in enumerate(text.splitlines(), 1):
                for literal in MODEL_LITERAL.findall(line):
                    findings += [f"{file.relative_to(ROOT).as_posix()}:{lineno} {p}"
                                 for p in _model_problems(literal, snapshot_ok=True)]
    print(f"  {'OK  ' if not findings else 'FAIL'} 旧 demo（{len(LEGACY)} 个）未使用下线模型")
    for item in findings:
        print(f"       - {item}")
    return not findings


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


def check_registry() -> bool:
    """docs/app/data/ 是 build_registry.py 的生成物：重新生成一遍，必须与仓库里的逐字节相同。"""
    print("== registry == 重新生成注册表与回放轨迹并比对")
    sys.path.insert(0, str(STD))
    import build_registry
    return build_registry.main(["--check"]) == 0


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
    steps = {"secrets": check_secrets, "manifests": check_manifests, "smoke": check_smoke, "registry": check_registry}
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
