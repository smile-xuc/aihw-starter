#!/usr/bin/env python3
"""docs/app 的数据构建：把网页 APP 要读的文件放进 docs/app/data/（不入库，Pages workflow 每次部署前重新生成）。

  python3 docs/app/tools/build.py           生成 data/
  python3 docs/app/tools/build.py --check   生成并自检（CI 用）

data/ 里有什么：
  registry.json、traces/   方案注册表与回放轨迹。正式注册表上线前，从 sample-data/（临时样例）复制
  demos/<方案 id>/samples/  各 demo 的样本图片、录音（回放展示，浏览器真跑时作为模拟设备输入）
  live/<方案 id>.json       浏览器真跑要用的模型 ID、提示词、工具定义、单价，直接从 demo 的 run.py 导入，不在 JS 里另抄一份
  build.json               构建时间、提交、数据来源

本地预览：生成后在仓库根目录运行 python3 -m http.server -d docs 8000，打开 http://localhost:8000/app/
只用标准库。
"""
from __future__ import annotations

import argparse
import datetime as dt
import importlib.util
import json
import math
import shutil
import subprocess
import sys
from pathlib import Path

APP = Path(__file__).resolve().parents[1]
REPO = APP.parents[1]
DATA = APP / "data"
SAMPLE_DATA = APP / "sample-data"

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


def git_commit() -> str:
    try:
        out = subprocess.run(["git", "-C", str(REPO), "rev-parse", "--short", "HEAD"],
                             capture_output=True, text=True, check=True)
        return out.stdout.strip()
    except (OSError, subprocess.CalledProcessError):
        return ""


def build_registry() -> tuple[dict, str]:
    """注册表与回放轨迹。正式注册表上线前用 sample-data/ 里的临时样例。"""
    shutil.copytree(SAMPLE_DATA / "traces", DATA / "traces")
    shutil.copy2(SAMPLE_DATA / "registry.json", DATA / "registry.json")
    return json.loads((DATA / "registry.json").read_text(encoding="utf-8")), "sample-data（临时样例）"


def copy_demo_assets(registry: dict) -> None:
    for sol in registry["solutions"]:
        samples = REPO / sol["path"] / "samples"
        if samples.is_dir():
            shutil.copytree(samples, DATA / "demos" / sol["id"] / "samples")


def load_module(demo_dir: Path, name: str):
    """按 demo 自己的 sys.path 导入模块（各 demo 都有同名的 demo_kit / mock，导入前先清掉上一个 demo 的）。"""
    for dep in DEMO_SHARED_MODULES:
        sys.modules.pop(dep, None)
    unique = f"aihw_app_{demo_dir.parent.parent.name}_{name}".replace("-", "_")
    spec = importlib.util.spec_from_file_location(unique, demo_dir / f"{name}.py")
    module = importlib.util.module_from_spec(spec)
    sys.modules[unique] = module  # dataclass 在模块执行期间要能从 sys.modules 找到自己
    sys.path.insert(0, str(demo_dir))
    try:
        spec.loader.exec_module(module)
    finally:
        sys.path.remove(str(demo_dir))
        sys.modules.pop(unique, None)
    return module


def plain(value, demo_dir: Path):
    """常量转成 JSON：Path → 相对 demo 目录的路径，集合 → 排序列表，inf → null（单价档位不封顶）。"""
    if isinstance(value, float) and math.isinf(value):
        return None
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    if isinstance(value, Path):
        return value.relative_to(demo_dir).as_posix()
    if isinstance(value, dict):
        return {str(k): plain(v, demo_dir) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [plain(v, demo_dir) for v in value]
    if isinstance(value, (set, frozenset)):
        return sorted(plain(v, demo_dir) for v in value)
    raise BuildError(f"无法转成 JSON：{type(value).__name__}")


def dump_live(registry: dict) -> list[str]:
    by_id = {s["id"]: s for s in registry["solutions"]}
    (DATA / "live").mkdir(parents=True)
    done = []
    for sol_id, modules in LIVE.items():
        if sol_id not in by_id:
            raise BuildError(f"LIVE 里的 {sol_id} 不在注册表里")
        demo_dir = REPO / by_id[sol_id]["path"]
        out = {"solution": sol_id, "source": by_id[sol_id]["path"]}
        for module_name, names in modules.items():
            module = load_module(demo_dir, module_name)
            for name in names:
                if not hasattr(module, name):
                    raise BuildError(f"{demo_dir.relative_to(REPO)}/{module_name}.py 没有 {name}："
                                     "浏览器真跑要读这个常量；改了常量名就同步改 docs/app/tools/build.py 的 LIVE")
                out[name] = plain(getattr(module, name), demo_dir)
        (DATA / "live" / f"{sol_id}.json").write_text(json.dumps(out, ensure_ascii=False, indent=1) + "\n",
                                                      encoding="utf-8")
        done.append(sol_id)
    for dep in DEMO_SHARED_MODULES:
        sys.modules.pop(dep, None)
    return done


def check(registry: dict) -> list[str]:
    problems = []
    cats = {c["id"] for c in registry["categories"]}
    for sol in registry["solutions"]:
        if sol["category"] not in cats:
            problems.append(f"{sol['id']}：品类 {sol['category']} 不在注册表里")
        trace_path = (sol.get("experience") or {}).get("trace")
        if not trace_path:
            continue
        trace_file = DATA / trace_path
        if not trace_file.is_file():
            problems.append(f"{sol['id']}：缺回放轨迹 {trace_path}")
            continue
        trace = json.loads(trace_file.read_text(encoding="utf-8"))
        if not trace.get("events"):
            problems.append(f"{sol['id']}：回放轨迹没有事件")
        for item in trace.get("inputs", []):
            if not (DATA / "demos" / sol["id"] / item["path"]).is_file():
                problems.append(f"{sol['id']}：回放引用的 {item['path']} 不在 data/demos/ 里")
    for sol_id in LIVE:
        live = json.loads((DATA / "live" / f"{sol_id}.json").read_text(encoding="utf-8"))
        for key, value in live.items():
            if isinstance(value, str) and value.startswith("samples/") and \
                    not (DATA / "demos" / sol_id / value).is_file():
                problems.append(f"{sol_id}：真跑要读的 {key}={value} 不在 data/demos/ 里")
    return problems


def main() -> None:
    ap = argparse.ArgumentParser(description="生成 docs/app/data/")
    ap.add_argument("--check", action="store_true", help="生成后检查引用是否齐全（CI 用）")
    args = ap.parse_args()

    if DATA.exists():
        shutil.rmtree(DATA)
    DATA.mkdir()
    try:
        registry, source = build_registry()
        copy_demo_assets(registry)
        live = dump_live(registry)
    except BuildError as exc:
        sys.exit(f"docs/app 构建失败：{exc}")
    info = {"built_at": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"), "commit": git_commit(),
            "registry": source, "live": live}
    (DATA / "build.json").write_text(json.dumps(info, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    size = sum(f.stat().st_size for f in DATA.rglob("*") if f.is_file())
    print(f"docs/app/data：{len(registry['solutions'])} 个方案 · 真跑常量 {len(live)} 个 · {size / 1024:.0f} KB · 注册表来源 {source}")
    if args.check:
        problems = check(registry)
        if problems:
            sys.exit("docs/app 自检失败：\n" + "\n".join(f"- {p}" for p in problems))
        print("docs/app 自检通过")


if __name__ == "__main__":
    main()
