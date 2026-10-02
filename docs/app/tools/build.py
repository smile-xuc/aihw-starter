#!/usr/bin/env python3
"""docs/app 的构建与自检。只用标准库。

  python3 docs/app/tools/build.py            重新生成 live-data/（改了被导入的 run.py 常量后运行，并提交）
  python3 docs/app/tools/build.py --check    CI：live-data/ 与 run.py 一致、注册表与轨迹的引用齐全

live-data/<方案 id>.json：浏览器真跑要用的模型 ID、提示词、工具定义、单价，直接从各 demo 的 run.py 导入，JS 里不另抄一份。
data/ 是注册表与回放轨迹（aihw/registry@0.1、aihw/trace@0.1），由 solutions/demo-standard/build_registry.py 生成并入库，这里只读、不写。
本地预览：python3 -m http.server 8000 -d docs，打开 http://localhost:8000/app/
"""
from __future__ import annotations

import argparse
import importlib.util
import json
import math
import sys
from pathlib import Path

APP = Path(__file__).resolve().parents[1]
REPO = APP.parents[1]
DATA = APP / "data"
LIVE_DATA = APP / "live-data"

# 浏览器真跑读取的常量：{方案 id: {模块名: [常量名]}}。demo 改了这些常量的名字，这里同步改
LIVE = {
    "01-ipc.bailian": {
        "run": ["MODEL", "QUALITY_MODEL", "EVENT_PROMPT", "ASK_PROMPT", "DAILY_PROMPT", "PRICES", "DEFAULT_ASK",
                "RISK", "MANIFEST"],
    },
    "02-ai-glasses.bailian": {
        "run": ["OMNI_MODEL", "TTS_MODEL", "TTS_VOICE", "ASK_PROMPT", "PRICES", "SAMPLE_IMAGE", "SAMPLE_AUDIO",
                "OUT_RATE"],
    },
    "04-agent-hardware.bailian": {
        "run": ["LLM_MODEL", "CHEAP_MODEL", "ASR_MODEL", "MAX_ROUNDS", "SYSTEM", "TOOLS", "PRICES", "WEEKDAYS",
                "DEFAULT_SESSION"],
        "local_rules": ["LOCAL_PATTERNS", "HYBRID_PATTERNS", "ROOMS"],
    },
    "07-recorder.bailian": {
        "run": ["ASR_MODEL", "LLM_MODEL", "LLM_QUALITY_MODEL", "MINUTES_PROMPT", "ASR_PRICES", "LLM_TIERS",
                "TOKENS_PER_SECOND_RANGE", "SAMPLE_AUDIO"],
    },
    "08-smart-watch.bailian": {
        "run": ["LLM_MODEL", "QUALITY_MODEL", "SYSTEM", "REPORT_SCHEMA", "LLM_PRICES", "DISCLAIMER", "FIELDS",
                "SAMPLES", "CARD_WIDTH"],
    },
    "09-embodied.bailian": {
        "run": ["LLM_MODEL", "CHEAP_MODEL", "MAX_ROUNDS", "SYSTEM", "TOOLS", "SCENE", "PRICES", "DEFAULT_COMMANDS",
                "SAMPLE_IMAGE"],
        "safety_gate": ["ALLOWED_SKILLS", "MOTION_SKILLS", "FORBIDDEN_PATTERNS", "CONFIRM_PATTERNS", "MAX_FORCE_N"],
    },
}
DEMO_SHARED_MODULES = ("demo_kit", "mock", "local_rules", "safety_gate", "diary")


class BuildError(RuntimeError):
    pass


def demo_dir(sol_id: str) -> Path:
    category, stack = sol_id.split(".")
    return REPO / "solutions" / "by-category" / category / "demo" / stack


def load_module(directory: Path, name: str):
    """按 demo 自己的 sys.path 导入模块（各 demo 都有同名的 demo_kit / mock，导入前先清掉上一个 demo 的）。"""
    for dep in DEMO_SHARED_MODULES:
        sys.modules.pop(dep, None)
    unique = f"aihw_app_{directory.parent.parent.name}_{name}".replace("-", "_")
    spec = importlib.util.spec_from_file_location(unique, directory / f"{name}.py")
    module = importlib.util.module_from_spec(spec)
    sys.modules[unique] = module  # dataclass 在模块执行期间要能从 sys.modules 找到自己
    sys.path.insert(0, str(directory))
    try:
        spec.loader.exec_module(module)
    finally:
        sys.path.remove(str(directory))
        sys.modules.pop(unique, None)
    return module


def plain(value, directory: Path):
    """常量转成 JSON：Path → 相对 demo 目录的路径，集合 → 排序列表，inf → null（单价档位不封顶）。"""
    if isinstance(value, float) and math.isinf(value):
        return None
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    if isinstance(value, Path):
        return value.relative_to(directory).as_posix()
    if isinstance(value, dict):
        return {str(k): plain(v, directory) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [plain(v, directory) for v in value]
    if isinstance(value, (set, frozenset)):
        return sorted(plain(v, directory) for v in value)
    raise BuildError(f"无法转成 JSON：{type(value).__name__}")


def live_files() -> dict[str, str]:
    out = {}
    for sol_id, modules in LIVE.items():
        directory = demo_dir(sol_id)
        doc = {"solution": sol_id, "source": directory.relative_to(REPO).as_posix()}
        for module_name, names in modules.items():
            module = load_module(directory, module_name)
            for name in names:
                if not hasattr(module, name):
                    raise BuildError(f"{directory.relative_to(REPO)}/{module_name}.py 没有 {name}："
                                     "浏览器真跑要读这个常量；改了常量名就同步改 docs/app/tools/build.py 的 LIVE")
                doc[name] = plain(getattr(module, name), directory)
        out[f"{sol_id}.json"] = json.dumps(doc, ensure_ascii=False, indent=1) + "\n"
    for dep in DEMO_SHARED_MODULES:
        sys.modules.pop(dep, None)
    return out


def check_data(files: dict[str, str]) -> list[str]:
    """页面要读的引用都在：注册表里的轨迹和样本文件存在，真跑要读的样本在注册表的 samples 里。"""
    if not (DATA / "registry.json").is_file():
        return ["docs/app/data/registry.json 不存在：注册表由 solutions/demo-standard/build_registry.py 生成（demo 标准 v0.3）"]
    problems = []
    registry = json.loads((DATA / "registry.json").read_text(encoding="utf-8"))
    if not str(registry.get("schema", "")).startswith("aihw/registry@0."):
        return [f"docs/app/data/registry.json 不是 aihw/registry@0.x：{registry.get('schema')}"]
    by_id = {s["id"]: s for s in registry.get("solutions", [])}
    for sol in registry.get("solutions", []):
        for variant in (sol.get("experience") or {}).get("variants", []):
            path = variant.get("trace")
            if path and not (DATA / path).is_file():
                problems.append(f"{sol['id']}：缺回放轨迹 {path}")
        for sample in sol.get("samples", []):
            if sample.get("asset") and not (DATA / sample["asset"]).is_file():
                problems.append(f"{sol['id']}：缺样本文件 {sample['asset']}")
    for name, text in files.items():
        sol_id = name[:-5]
        sol = by_id.get(sol_id)
        if not sol:
            problems.append(f"live-data 的 {sol_id} 不在注册表里")
            continue
        have = {s["path"] for s in sol.get("samples", [])}
        for key, value in json.loads(text).items():
            values = value if isinstance(value, list) else [value]
            for v in values:
                path = v[-1] if isinstance(v, list) and v and isinstance(v[-1], str) else v
                if isinstance(path, str) and path.startswith("samples/") and path not in have:
                    problems.append(f"{sol_id}：真跑要读的 {key} → {path} 不在注册表的 samples 里")
    return problems


def main() -> None:
    ap = argparse.ArgumentParser(description="docs/app 的构建与自检")
    ap.add_argument("--check", action="store_true", help="检查 live-data/ 是否最新、数据引用是否齐全（CI 用）")
    args = ap.parse_args()
    try:
        files = live_files()
        if args.check:
            stale = [n for n, t in files.items() if not (LIVE_DATA / n).is_file() or (LIVE_DATA / n).read_text(encoding="utf-8") != t]
            extra = sorted(p.name for p in LIVE_DATA.glob("*.json") if p.name not in files)
            problems = [f"live-data/{n} 与 run.py 不一致：运行 python3 docs/app/tools/build.py 后提交" for n in stale]
            problems += [f"live-data/{n} 没有对应的 LIVE 条目，删除它" for n in extra]
            problems += check_data(files)
            if problems:
                sys.exit("docs/app 自检失败：\n" + "\n".join(f"- {p}" for p in problems))
            print(f"docs/app 自检通过（live-data {len(files)} 个，注册表引用齐全）")
            return
        LIVE_DATA.mkdir(exist_ok=True)
        for old in LIVE_DATA.glob("*.json"):
            if old.name not in files:
                old.unlink()
        for name, text in files.items():
            (LIVE_DATA / name).write_text(text, encoding="utf-8")
        print(f"docs/app/live-data：{len(files)} 个方案")
    except BuildError as exc:
        sys.exit(f"docs/app 构建失败：{exc}")


if __name__ == "__main__":
    main()
