#!/usr/bin/env python3
"""build_registry.py — 生成配套网页 APP 读取的方案注册表、回放轨迹与资源副本（demo 标准 v0.3）

  python3 solutions/demo-standard/build_registry.py           # 重新生成 docs/app/data/
  python3 solutions/demo-standard/build_registry.py --check   # 只比对，与仓库里的不一致时退出 1（CI 用）

数据源：各 solution.yaml、各玩法 run.py --mock 的输出（--trace）、samples/、VERIFY.md、
solutions/by-category/README.md 的两张品类表、stacks/*.yaml、vocab.yaml。
格式：registry.schema.json、trace.schema.json、stack.schema.json，字段说明见 README.md「APP 数据」一节。
生成结果是确定的：不含时间戳和机器信息，mock 里的日期固定，Python 3.9 与 3.12 的输出逐字节相同。
依赖 PyYAML；装了 jsonschema 时顺带校验生成结果。
"""
from __future__ import annotations

import argparse
import json
import os
import re
import shlex
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
STD = ROOT / "solutions" / "demo-standard"
CATEGORIES = ROOT / "solutions" / "by-category"
DATA = ROOT / "docs" / "app" / "data"
OWNED = ("registry.json", "traces", "assets")  # data/ 下由本工具生成的部分；其余文件不碰
REPO = {"url": "https://github.com/smile-xuc/aihw-starter", "branch": "master",
        "blob_base": "https://github.com/smile-xuc/aihw-starter/blob/master/",
        "tree_base": "https://github.com/smile-xuc/aihw-starter/tree/master/"}
STANDARD_VERSION = "0.3"
STACKS = ("bailian", "xiaozhi", "tuyaopen", "volcengine", "agora", "tencent")
STATUS_LABELS = {"pending-live": "待真 Key 验证", "live-verified": "已真 Key 验证"}
VERIFY_HEADER = "| 日期 | 地域 | 模型 | 首字延迟 | 单次成本（元） | 输入 | 环境 | 验证人 | 备注 |"
CATEGORY_DOCS = {"readme": "README.md", "business": "01-business.md", "solution": "02-solution.md",
                 "cost": "03-cost.md", "cases": "04-cases.md", "faq": "05-faq.md"}
MEDIA_TYPES = {".wav": "audio/wav", ".mp3": "audio/mpeg", ".m4a": "audio/mp4", ".jpg": "image/jpeg",
               ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".md": "text/markdown",
               ".txt": "text/plain", ".json": "application/json", ".csv": "text/csv"}


class BuildError(RuntimeError):
    pass


def _yaml(path: Path):
    import yaml
    return json.loads(json.dumps(yaml.safe_load(path.read_text(encoding="utf-8")), default=str))


def _rel(path: Path) -> str:
    return path.relative_to(ROOT).as_posix()


def _dump(data) -> str:
    return json.dumps(data, ensure_ascii=False, indent=1) + "\n"


def _media_type(path: Path) -> str:
    return MEDIA_TYPES.get(path.suffix.lower(), "application/octet-stream")


# ───────────────────────── 品类表（solutions/by-category/README.md） ─────────────────────────

def _table(markdown: str, heading: str) -> list[dict]:
    """取「## heading」一节里的第一张表，返回 {表头: 单元格} 列表。"""
    section = re.search(rf"^## {re.escape(heading)}\s*$(.*?)(?=^## |\Z)", markdown, re.M | re.S)
    if not section:
        return []
    rows = [ln for ln in section.group(1).splitlines() if ln.startswith("|")]
    if len(rows) < 2:
        return []
    cells = [[c.strip() for c in row.strip().strip("|").split("|")] for row in rows]
    header = cells[0]
    return [dict(zip(header, row)) for row in cells[2:] if len(row) == len(header)]


def _link(cell: str) -> tuple[str, str | None]:
    m = re.fullmatch(r"\[(.+?)\]\((\S+?)\)", cell.strip())
    return (m.group(1), m.group(2)) if m else (cell.strip(), None)


def _split_emoji(name: str) -> tuple[str | None, str]:
    head, _, rest = name.partition(" ")
    if rest and head and not re.search(r"[\w（(]", head):
        return head, rest.strip()
    return None, name.strip()


def _first_heading(readme: Path) -> str | None:
    if not readme.is_file():
        return None
    m = re.search(r"^#\s+(.+)$", readme.read_text(encoding="utf-8"), re.M)
    return m.group(1).strip() if m else None


def build_categories(solutions: list[dict]) -> list[dict]:
    index = (CATEGORIES / "README.md").read_text(encoding="utf-8")
    industry = {row.get("#"): row for row in _table(index, "行业速览")}
    overview = {row.get("#"): row for row in _table(index, "品类总览")}
    out = []
    for folder in sorted(p for p in CATEGORIES.iterdir() if p.is_dir() and re.match(r"0[1-9]-", p.name)):
        no = folder.name[:2]
        row = overview.get(no, {})
        name_cell, _ = _link(row.get("品类", "")) if row else (folder.name, None)
        emoji, name = _split_emoji(name_cell)
        ind = industry.get(no)
        source_text, source_url = _link(ind.get("来源", "")) if ind else ("", None)
        topic = []
        demo_root = folder / "demo"
        if demo_root.is_dir():
            for sub in sorted(p for p in demo_root.iterdir() if p.is_dir() and p.name not in STACKS):
                if (sub / "README.md").is_file():
                    topic.append({"path": _rel(sub), "title": _first_heading(sub / "README.md") or sub.name})
        out.append({
            "id": folder.name, "no": no, "name": name, "emoji": emoji,
            "capabilities": row.get("核心能力") or None, "scenes": row.get("代表场景") or None,
            "industry": None if not ind else {
                "shipments": ind.get("年出货（万台/年）"), "revenue": ind.get("总营收（亿元/年）"),
                "ai_share": ind.get("AI 增量营收占比"), "trend": ind.get("趋势"),
                "source": {"text": source_text, "url": source_url}},
            "industry_units": {"shipments": "万台/年", "revenue": "亿元/年"},
            "docs": {k: (_rel(folder / f) if (folder / f).is_file() else None) for k, f in CATEGORY_DOCS.items()},
            "solutions": [s["id"] for s in solutions if s["category"] == folder.name],
            "topic_demos": topic,
        })
    return out


# ───────────────────────── VERIFY.md ─────────────────────────

def _numbers(text: str) -> list[float]:
    return [float(x) for x in re.findall(r"\d+(?:\.\d+)?", text)]


def verify_info(path: Path) -> dict:
    text = path.read_text(encoding="utf-8") if path.is_file() else ""
    lines = text.splitlines()
    rows = []
    if VERIFY_HEADER in lines:
        start = lines.index(VERIFY_HEADER) + 2
        for line in lines[start:]:
            if line.startswith("|"):
                cells = [c.strip() for c in line.strip().strip("|").split("|")]
                if len(cells) == 9:
                    rows.append(cells)
    pending = re.findall(r"^- \[ \] \*\*(.+?)\*\*", text, re.M)
    latest = None
    if rows:
        date, region, models, first, cost, _sample, _env, _who, note = rows[-1]
        nums = _numbers(cost)
        ms = _numbers(first) if "ms" in first else []
        latest = {"date": date, "region": region, "models": models, "first_token": first,
                  "first_token_ms": int(ms[0]) if ms else None, "cost_text": cost,
                  "low": nums[0] if nums else None, "high": nums[-1] if nums else None, "note": note}
    return {"rows": len(rows), "latest": latest, "pending": pending}


# ───────────────────────── 回放轨迹 ─────────────────────────

def run_variant(demo_dir: Path, mock_command: str, args: list[str], workdir: Path) -> tuple[dict, Path]:
    """在 demo 目录的干净副本里跑一次 mock（带 --trace），返回（轨迹, 副本目录）。"""
    work = workdir / "demo"
    shutil.copytree(demo_dir, work, ignore=shutil.ignore_patterns("out", ".env", "__pycache__"))
    argv = shlex.split(mock_command)
    if argv and argv[0] in ("python3", "python"):
        argv[0] = sys.executable
    trace_path = workdir / "trace.json"
    env = {k: v for k, v in os.environ.items() if not k.startswith("DASHSCOPE_")}
    env.update(PYTHONDONTWRITEBYTECODE="1", PYTHONIOENCODING="utf-8")
    proc = subprocess.run([*argv, *args, "--trace", str(trace_path)], cwd=work, env=env, stdin=subprocess.DEVNULL,
                          capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=300)
    if proc.returncode != 0 or not trace_path.is_file():
        tail = "\n".join((proc.stdout + proc.stderr).strip().splitlines()[-15:])
        raise BuildError(f"{_rel(demo_dir)} {' '.join(args) or '默认玩法'} 运行失败（退出码 {proc.returncode}）：\n{tail}")
    trace = json.loads(trace_path.read_text(encoding="utf-8"))
    if trace.get("result") is None:
        raise BuildError(f"{_rel(demo_dir)} {' '.join(args) or '默认玩法'} 没有调用 demo_kit.finish()：{trace.get('error')}")
    return trace, work


def publish_trace(trace: dict, solution_id: str, variant_id: str, work: Path, out: Path) -> dict:
    trace["variant"] = variant_id
    for item in trace["inputs"]:
        item["asset"] = f"assets/{solution_id}/{item['path']}"
    for item in trace["outputs"]:
        if item.get("text") is None:
            inner = Path(item["path"]).relative_to("out").as_posix()
            asset = f"assets/{solution_id}/outputs/{variant_id}/{inner}"
            target = out / asset
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(work / item["path"], target)
            item["asset"] = asset
    return trace


# ───────────────────────── 方案 ─────────────────────────

def _browser(services: list[str], stack: dict | None) -> dict:
    flags = {s["id"]: s["browser"] for s in (stack or {}).get("endpoints", {}).get("services", [])}
    blocked = [s for s in services if flags.get(s) != "ok"]
    return {"direct": bool(services) and not blocked, "blocked_by": blocked}


def build_solution(path: Path, vocab: dict, stacks: dict, out: Path) -> dict:
    demo_dir = path.parent
    data = _yaml(path)
    sid = data["id"]
    stack = stacks.get(data["stack"])
    field_keys = [f["key"] for f in (stack or {}).get("fields", [])]
    required = list(data.get("env") or [])

    def credentials(env: list[str]) -> dict:
        return {"required": env, "optional": [k for k in field_keys if k not in env]}

    samples = []
    sample_root = demo_dir / "samples"
    if sample_root.is_dir():
        for p in sorted(x for x in sample_root.rglob("*") if x.is_file() and x.name != "README.md"):
            rel = p.relative_to(demo_dir).as_posix()
            asset = f"assets/{sid}/{rel}"
            (out / asset).parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(p, out / asset)
            samples.append({"path": rel, "asset": asset, "media_type": _media_type(p), "bytes": p.stat().st_size})

    experience = data.get("experience") or {}
    variants = []
    kit_version = None
    used_inputs: set[str] = set()
    run_info = data.get("run") or {}
    for variant in experience.get("variants") or []:
        vid = variant["id"]
        args = list(variant.get("args") or [])
        services = list(variant.get("services") or [])
        mock = " ".join([str(run_info.get("mock", "")), *args]).strip()
        live = " ".join([str(run_info.get("live", "")), *args]).strip()
        with tempfile.TemporaryDirectory(prefix="aihw-trace-") as tmp:
            trace, work = run_variant(demo_dir, str(run_info.get("mock", "")), args, Path(tmp))
            trace = publish_trace(trace, sid, vid, work, out)
        kit_version = trace.get("kit")
        used_inputs.update(item["path"] for item in trace["inputs"])
        trace_path = f"traces/{sid}/{vid}.json"
        (out / trace_path).parent.mkdir(parents=True, exist_ok=True)
        (out / trace_path).write_text(_dump(trace), encoding="utf-8")
        variants.append({
            "id": vid, "title": variant["title"],
            "archetype": variant.get("archetype") or experience.get("archetype"),
            "args": args, "mock_command": mock, "live_command": live, "services": services,
            "browser": _browser(services, stack),
            "credentials": credentials(list(variant.get("env") or required)),
            "trace": trace_path, "cost": (trace.get("result") or {}).get("cost"),
        })

    # 轨迹只认日志里提到的文件：图片、音频样本一个都没被任何玩法提到，多半是 run.py 没打印文件名
    unused = [s["path"] for s in samples if s["media_type"].startswith(("image/", "audio/"))
              and s["path"] not in used_inputs]
    if variants and unused:
        raise BuildError(f"{_rel(demo_dir)}：样本 {', '.join(unused)} 没出现在任何玩法的回放轨迹里。"
                         "让 run.py 在用到它时把文件名打印出来（如「抓拍 1 帧 xxx.jpg」），或从 samples/ 删掉")

    modes = []
    if variants:
        modes.append("replay")
    if data.get("kind") == "reference":
        modes.append("local-run")
    if any(v["browser"]["direct"] for v in variants):
        modes.append("browser-run")

    verification = data.get("verification") or {}
    record = demo_dir / str(verification.get("record") or "VERIFY.md")
    info = verify_info(record)
    latest = info["latest"]
    default = variants[0] if variants else None
    metrics = data.get("metrics") or {}
    cover = experience.get("cover")
    compliance = {c["id"]: c for c in vocab.get("compliance", [])}
    category_dir = CATEGORIES / data["category"]
    faq = category_dir / "05-faq.md"
    docs = {"readme": demo_dir / "README.md", "verify": record, "category": category_dir / "README.md",
            "solution": category_dir / "02-solution.md", "cost": category_dir / "03-cost.md", "faq": faq}
    part_labels = {p["id"]: p["label"] for p in vocab.get("parts", [])}

    return {
        "id": sid, "category": data["category"], "stack": data["stack"], "kind": data["kind"],
        "title": data["title"], "summary": data["summary"], "path": _rel(demo_dir),
        "upstream": data.get("upstream"), "license": data.get("license"), "maintainers": data.get("maintainers", []),
        "regions": data.get("regions", []),
        "models": [{"id": m["id"], "role": m["role"], "regions": m.get("regions")} for m in data.get("models", [])],
        "features": data.get("features", []),
        "experience": {
            "archetype": experience.get("archetype"),
            "cover": f"assets/{sid}/{cover}" if cover else None,
            "modes": modes, "variants": variants,
        },
        "cost": {
            "unit": metrics.get("unit"), "basis": metrics.get("cost"),
            "estimate": None if not default or not default["cost"] else {
                **default["cost"], "source": "mock", "variant": default["id"], "note": "mock 用量为示意值"},
            "measured": None if not latest else {
                "date": latest["date"], "region": latest["region"], "models": latest["models"],
                "low": latest["low"], "high": latest["high"], "text": latest["cost_text"], "note": latest["note"]},
        },
        "latency": {
            "first_token": metrics.get("first_token"),
            "measured": None if not latest or latest["first_token_ms"] is None else {
                "date": latest["date"], "region": latest["region"], "ms": latest["first_token_ms"],
                "text": latest["first_token"]},
        },
        "hardware": {
            "parts": [{"part": p["part"], "label": part_labels.get(p["part"], p["part"]), "role": p["role"],
                       "simulated_by": p.get("simulated_by")} for p in (data.get("hardware") or {}).get("parts", [])],
            "chips": (data.get("hardware") or {}).get("chips", []),
            "boards": (data.get("hardware") or {}).get("boards", []),
        },
        "device": data.get("device", {}),
        "credentials": {"stack": data["stack"], **credentials(required)},
        "compliance": [{"tag": tag, "label": compliance.get(tag, {}).get("label", tag),
                        "obligation": compliance.get(tag, {}).get("obligation"),
                        "readme_must_cover": compliance.get(tag, {}).get("readme_must_cover", []),
                        "doc": _rel(faq) if faq.is_file() else None} for tag in data.get("compliance_tags") or []],
        "verification": {
            "status": verification.get("status"), "label": STATUS_LABELS.get(verification.get("status"), ""),
            "last_verified": verification.get("last_verified"), "level": verification.get("level"),
            "evidence": verification.get("evidence", []), "record": _rel(record),
            "live_records": info["rows"], "pending_checks": info["pending"],
        },
        "run": {"cwd": _rel(demo_dir), "setup": run_info.get("setup"), "live": run_info.get("live"),
                "mock": run_info.get("mock")},
        "samples": samples,
        "docs": {k: (_rel(v) if v.is_file() else None) for k, v in docs.items()},
        "_kit": kit_version,
    }


# ───────────────────────── 组装与比对 ─────────────────────────

def build(out: Path) -> None:
    vocab = _yaml(STD / "vocab.yaml")
    stacks = {s["id"]: s for s in (_yaml(p) for p in sorted((STD / "stacks").glob("*.yaml")))}
    solutions = [build_solution(p, vocab, stacks, out) for p in sorted(CATEGORIES.glob("*/demo/*/solution.yaml"))]
    kits = {s.pop("_kit") for s in solutions} - {None}
    if len(kits) > 1:
        raise BuildError(f"各 demo 的 demo_kit 版本不一致：{sorted(kits)}（先运行 check.py sync）")
    registry = {
        "schema": "aihw/registry@0.1", "standard": STANDARD_VERSION, "kit": kits.pop() if kits else None,
        "repo": REPO, "currency": "CNY", "vocab": vocab, "stacks": list(stacks.values()),
        "categories": build_categories(solutions), "solutions": solutions,
    }
    (out / "registry.json").write_text(_dump(registry), encoding="utf-8")
    validate(out)


def validate(out: Path) -> None:
    try:
        import jsonschema
    except ImportError:
        return
    problems = []
    for name, files in (("registry", [out / "registry.json"]), ("trace", sorted((out / "traces").rglob("*.json")))):
        schema = json.loads((STD / f"{name}.schema.json").read_text(encoding="utf-8"))
        validator = jsonschema.Draft202012Validator(schema)
        for f in files:
            for e in validator.iter_errors(json.loads(f.read_text(encoding="utf-8"))):
                problems.append(f"{f.relative_to(out).as_posix()}: {'/'.join(map(str, e.path)) or '(根)'} {e.message}")
    if problems:
        raise BuildError("生成结果不符合 schema：\n" + "\n".join(problems[:20]))


def _owned_files(root: Path) -> dict[str, Path]:
    files = {}
    for name in OWNED:
        base = root / name
        if base.is_file():
            files[name] = base
        elif base.is_dir():
            files.update({p.relative_to(root).as_posix(): p for p in base.rglob("*") if p.is_file()})
    return files


def compare(fresh: Path, current: Path) -> list[str]:
    new, old = _owned_files(fresh), _owned_files(current)
    diffs = [f"缺少 {k}" for k in sorted(set(new) - set(old))]
    diffs += [f"多余 {k}" for k in sorted(set(old) - set(new))]
    diffs += [f"内容不同 {k}" for k in sorted(set(new) & set(old)) if new[k].read_bytes() != old[k].read_bytes()]
    return diffs


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="生成 docs/app/data/：方案注册表、回放轨迹、资源副本")
    ap.add_argument("--check", action="store_true", help="只比对，不写文件；不一致时退出 1")
    ap.add_argument("--out", type=Path, default=DATA, help="输出目录（默认 docs/app/data）")
    args = ap.parse_args(argv)
    with tempfile.TemporaryDirectory(prefix="aihw-registry-") as tmp:
        fresh = Path(tmp)
        try:
            build(fresh)
        except BuildError as exc:
            print(f"  FAIL {exc}")
            return 1
        if args.check:
            diffs = compare(fresh, args.out)
            if diffs:
                print(f"  FAIL {_rel(args.out) if args.out.is_relative_to(ROOT) else args.out} 与源文件不一致"
                      "，运行 python3 solutions/demo-standard/build_registry.py 后提交：")
                for item in diffs[:30]:
                    print(f"       - {item}")
                return 1
            count = len(_owned_files(fresh))
            print(f"  OK   docs/app/data 与源文件一致（{count} 个文件）")
            return 0
        args.out.mkdir(parents=True, exist_ok=True)
        for name in OWNED:
            target = args.out / name
            if target.is_dir():
                shutil.rmtree(target)
            elif target.exists():
                target.unlink()
        for rel, src in _owned_files(fresh).items():
            dst = args.out / rel
            dst.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(src, dst)
        print(f"已生成 {args.out}：{len(_owned_files(args.out))} 个文件")
    return 0


if __name__ == "__main__":
    sys.exit(main())
