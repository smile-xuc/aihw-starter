"""
map_reduce_summary.py — 录音卡「长会议 Map-Reduce 纪要」最小 demo

流程：
  ① 将带说话人的长中文逐字稿按字数切成多个 chunk（Map 输入）
  ② 每个 chunk 抽取：议程要点 / 决策 / 待办 / 未决问题
  ③ Reduce：去重合并为结构化会议纪要（Markdown + JSON）

用法：
  # 离线：内置样例逐字稿 + 规则/模板 mock（无需 API Key）
  python map_reduce_summary.py

  # 自定义逐字稿文件
  python map_reduce_summary.py --transcript sample_transcript.txt

  # 在线：调用千问做真正的 Map-Reduce（需 DASHSCOPE_API_KEY）
  python map_reduce_summary.py --live

  # 调整切段大小
  python map_reduce_summary.py --chunk-chars 280

对应文档：../../02-solution.md 第三节 / 4.3 节

⚠️ AI 生成代码，仅作接入参考。生产请补重试、鉴权与字段校验。
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from dataclasses import asdict, dataclass, field
from pathlib import Path

DEFAULT_MODEL = "qwen-plus"
DEFAULT_CHUNK_CHARS = 320

SAMPLE_TRANSCRIPT = """\
[00:00] 说话人A：大家好，今天议程有三块：一是 Q3 销售复盘，二是新品发布排期，三是下周客户拜访分工。
[00:45] 说话人B：我先说销售。华东本月完成 820 万，同比上周增长 12%，但华南掉到了 310 万，主要是渠道库存积压。
[01:30] 说话人A：华南的问题我们确认一下，是不是把促销预算从 50 万追加到 80 万？
[02:10] 说话人C：我同意追加到 80 万，但要求渠道本周五前提交清库存计划，否则预算冻结。
[02:40] 说话人A：那就这么定：华南促销预算追加到 80 万，责任人是说话人C，周五前要清库存计划。
[03:20] 说话人B：新品方面，录音卡 Pro 的模具已经签字，预计 10 月 12 日试产，10 月 28 日小批量。
[04:00] 说话人A：发布会能不能定在 11 月 5 日？需要市场部确认场地。
[04:25] 说话人D：场地我去盯，明天中午前给确认邮件。另外包装文案还缺德语版，翻译供应商还没定。
[05:05] 说话人A：德语翻译待定，先记为未决。待办：说话人D 明天确认发布会场地；说话人B 同步试产节点到项目群。
[05:50] 说话人C：客户拜访——下周二拜访星云科技，我带方案，说话人B 负责报价单，说话人A 做纪要。
[06:30] 说话人A：好，星云科技拜访敲定下周二，目标是推进 200 台试点订单。还有没有风险要说？
[07:00] 说话人B：有一个风险：供应商麦阵列交期可能晚一周，如果属实，试产要顺延。
[07:35] 说话人A：这个先列为风险跟踪，说话人B 周三前给出交期确认。今天就这些，散会。
"""


@dataclass
class ChunkExtraction:
    chunk_id: int
    agenda: list[str] = field(default_factory=list)
    decisions: list[dict] = field(default_factory=list)
    action_items: list[dict] = field(default_factory=list)
    open_questions: list[str] = field(default_factory=list)
    risks: list[str] = field(default_factory=list)


@dataclass
class MeetingNotes:
    title: str
    agenda: list[str]
    decisions: list[dict]
    action_items: list[dict]
    open_questions: list[str]
    risks: list[str]
    source_chunks: int


def split_transcript(text: str, chunk_chars: int) -> list[str]:
    """按行累加到接近 chunk_chars，避免把单行从中间切开。"""
    if chunk_chars < 80:
        raise ValueError("chunk-chars 建议 >= 80")
    lines = [ln for ln in text.strip().splitlines() if ln.strip()]
    chunks: list[str] = []
    buf: list[str] = []
    size = 0
    for ln in lines:
        ln_len = len(ln) + 1
        if buf and size + ln_len > chunk_chars:
            chunks.append("\n".join(buf))
            buf = [ln]
            size = ln_len
        else:
            buf.append(ln)
            size += ln_len
    if buf:
        chunks.append("\n".join(buf))
    return chunks


def _uniq_keep_order(items: list[str]) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for x in items:
        key = re.sub(r"\s+", "", x)
        if key and key not in seen:
            seen.add(key)
            out.append(x)
    return out


def mock_map_chunk(chunk_id: int, chunk: str) -> ChunkExtraction:
    """离线 mock：用简单规则从中文会议逐字稿抽字段（演示用，非生产 NLP）。"""
    ext = ChunkExtraction(chunk_id=chunk_id)

    if "议程" in chunk or "三块" in chunk:
        for part in re.findall(r"[一二三四五]、([^，。；\n]+)", chunk):
            ext.agenda.append(part.strip())
        if not ext.agenda and "议程有三块" in chunk:
            ext.agenda = ["Q3 销售复盘", "新品发布排期", "客户拜访分工"]

    for m in re.finditer(
        r"那就这么定[:：]?(?P<body>[^。\n]+)|敲定(?P<body2>[^。\n]+)",
        chunk,
    ):
        body = (m.group("body") or m.group("body2") or "").strip(" ，,")
        # 过滤问句，避免把「是不是…」误判为决策
        if body and not body.endswith("？") and "是不是" not in body:
            owner = ""
            om = re.search(r"责任人是(?P<o>说话人[A-Z])", chunk[max(0, m.start() - 80) : m.end() + 80])
            if om:
                owner = om.group("o")
            ext.decisions.append(
                {"content": body, "owner": owner or "未指定", "timestamp": _guess_ts(chunk, m.start())}
            )

    # 「追加到 80 万」类强承诺
    if "追加到 80 万" in chunk and not any("80 万" in d["content"] for d in ext.decisions):
        if "同意追加" in chunk or "那就这么定" in chunk:
            ext.decisions.append(
                {
                    "content": "华南促销预算追加到 80 万",
                    "owner": "说话人C" if "说话人C" in chunk else "未指定",
                    "timestamp": _first_ts(chunk),
                }
            )

    for m in re.finditer(
        r"待办[:：]\s*(?P<body>[^。\n]+)|(?P<who>说话人[A-Z])\s*(?P<task>(?:明天|周三前|周五前|负责|同步|带方案|做纪要)[^。\n]*)",
        chunk,
    ):
        if m.groupdict().get("body"):
            body = m.group("body").strip()
            # 可能含多个分号待办
            for piece in re.split(r"[；;]", body):
                piece = piece.strip()
                if piece:
                    owner = _extract_owner(piece) or "未指定"
                    due = _extract_due(piece)
                    ext.action_items.append(
                        {"task": piece, "owner": owner, "due": due, "priority": "M"}
                    )
        else:
            who = m.group("who")
            task = m.group("task").strip()
            if len(task) >= 4:
                ext.action_items.append(
                    {
                        "task": f"{who}{task}",
                        "owner": who,
                        "due": _extract_due(task),
                        "priority": "H" if any(x in task for x in ("明天", "周五", "周三")) else "M",
                    }
                )

    if "待定" in chunk or "还没定" in chunk or "未决" in chunk:
        for m in re.finditer(r"([^。\n]*(?:待定|还没定|未决)[^。\n]*)", chunk):
            ext.open_questions.append(m.group(1).strip())

    if "风险" in chunk or "可能晚" in chunk or "顺延" in chunk:
        for m in re.finditer(r"([^。\n]*(?:风险|可能晚|顺延)[^。\n]*)", chunk):
            line = m.group(1).strip()
            # 过滤主持人追问「还有没有风险」
            if "还有没有风险" in line or line.endswith("？"):
                continue
            ext.risks.append(line)

    # 议程补漏：销售/新品/拜访关键词段落
    if "销售" in chunk and "华东" in chunk:
        ext.agenda.append("Q3 销售复盘（华东/华南数据）")
    if "新品" in chunk or "试产" in chunk:
        ext.agenda.append("新品发布与试产排期")
    if "拜访" in chunk:
        ext.agenda.append("客户拜访分工")

    ext.agenda = _uniq_keep_order(ext.agenda)
    ext.open_questions = _uniq_keep_order(ext.open_questions)
    ext.risks = _uniq_keep_order(ext.risks)
    return ext


def _first_ts(chunk: str) -> str:
    m = re.search(r"\[(\d{2}:\d{2})\]", chunk)
    return m.group(1) if m else ""


def _guess_ts(chunk: str, pos: int) -> str:
    last = ""
    for m in re.finditer(r"\[(\d{2}:\d{2})\]", chunk):
        if m.start() <= pos:
            last = m.group(1)
        else:
            break
    return last


def _extract_owner(text: str) -> str:
    m = re.search(r"说话人[A-Z]", text)
    return m.group(0) if m else ""


def _extract_due(text: str) -> str:
    for key in ("明天中午前", "明天", "本周五前", "周五前", "周三前", "下周二"):
        if key in text:
            return key
    return ""


def mock_reduce(extractions: list[ChunkExtraction]) -> MeetingNotes:
    agenda: list[str] = []
    decisions: list[dict] = []
    actions: list[dict] = []
    questions: list[str] = []
    risks: list[str] = []

    for e in extractions:
        agenda.extend(e.agenda)
        decisions.extend(e.decisions)
        actions.extend(e.action_items)
        questions.extend(e.open_questions)
        risks.extend(e.risks)

    # 决策 / 待办按 content/task 去重
    def dedupe_dicts(items: list[dict], key: str) -> list[dict]:
        seen: set[str] = set()
        out: list[dict] = []
        for it in items:
            k = re.sub(r"\s+", "", str(it.get(key, "")))
            if k and k not in seen:
                seen.add(k)
                out.append(it)
        return out

    return MeetingNotes(
        title="周会纪要（Map-Reduce demo）",
        agenda=_uniq_keep_order(agenda),
        decisions=dedupe_dicts(decisions, "content"),
        action_items=dedupe_dicts(actions, "task"),
        open_questions=_uniq_keep_order(questions),
        risks=_uniq_keep_order(risks),
        source_chunks=len(extractions),
    )


MAP_PROMPT = """你是会议纪要分析师。基于带时间戳和说话人的会议片段，严格输出 JSON（不要 Markdown）：
{
  "agenda": ["..."],
  "decisions": [{"content":"", "owner":"", "timestamp":""}],
  "action_items": [{"task":"", "owner":"", "due":"", "priority":"H/M/L"}],
  "open_questions": [],
  "risks": []
}
判定规则：
- 决策：出现"我们就这么定/确认/拍板/敲定"等强承诺语义
- 待办：动词 + 责任人 + （隐含）时间
- 未决：待确认、待定、还没定
- 风险：可能延期、不确定供应等
输入片段：
"""

REDUCE_PROMPT = """你是会议纪要总编。将多个分段抽取结果合并去重，输出严格 JSON：
{
  "title": "",
  "agenda": [],
  "decisions": [{"content":"", "owner":"", "timestamp":""}],
  "action_items": [{"task":"", "owner":"", "due":"", "priority":"H/M/L"}],
  "open_questions": [],
  "risks": []
}
要求：合并语义重复项；保留责任人与期限；不要发明原文没有的事实。
分段结果：
"""


def _dashscope_chat(model: str, prompt: str) -> str:
    try:
        import dashscope
        from dashscope import Generation
    except ImportError as exc:
        raise SystemExit(
            "未安装 dashscope。请先: pip install -r requirements.txt"
        ) from exc

    api_key = os.getenv("DASHSCOPE_API_KEY")
    if not api_key:
        raise SystemExit("请设置环境变量 DASHSCOPE_API_KEY（见 .env.example）")
    dashscope.api_key = api_key

    resp = Generation.call(model=model, prompt=prompt, result_format="message")
    if resp.status_code != 200:
        raise RuntimeError(f"DashScope 调用失败: {resp.code} {resp.message}")
    return resp.output.choices[0].message.content


def _extract_json(text: str) -> dict:
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)
    return json.loads(text)


def live_map_chunk(chunk_id: int, chunk: str, model: str) -> ChunkExtraction:
    raw = _dashscope_chat(model, MAP_PROMPT + chunk)
    data = _extract_json(raw)
    return ChunkExtraction(
        chunk_id=chunk_id,
        agenda=list(data.get("agenda") or []),
        decisions=list(data.get("decisions") or []),
        action_items=list(data.get("action_items") or []),
        open_questions=list(data.get("open_questions") or []),
        risks=list(data.get("risks") or []),
    )


def live_reduce(extractions: list[ChunkExtraction], model: str) -> MeetingNotes:
    payload = json.dumps([asdict(e) for e in extractions], ensure_ascii=False, indent=2)
    raw = _dashscope_chat(model, REDUCE_PROMPT + payload)
    data = _extract_json(raw)
    return MeetingNotes(
        title=str(data.get("title") or "会议纪要"),
        agenda=list(data.get("agenda") or []),
        decisions=list(data.get("decisions") or []),
        action_items=list(data.get("action_items") or []),
        open_questions=list(data.get("open_questions") or []),
        risks=list(data.get("risks") or []),
        source_chunks=len(extractions),
    )


def render_markdown(notes: MeetingNotes) -> str:
    lines = [
        f"# {notes.title}",
        "",
        f"> 来源分段：{notes.source_chunks}",
        "",
        "## 议程",
    ]
    if notes.agenda:
        lines.extend(f"- {a}" for a in notes.agenda)
    else:
        lines.append("- （无）")
    lines += ["", "## 决策"]
    if notes.decisions:
        for d in notes.decisions:
            ts = f" @{d.get('timestamp')}" if d.get("timestamp") else ""
            lines.append(f"- {d.get('content', '')}（责任人：{d.get('owner', '未指定')}{ts}）")
    else:
        lines.append("- （无）")
    lines += ["", "## 待办"]
    if notes.action_items:
        for a in notes.action_items:
            due = f"，期限：{a['due']}" if a.get("due") else ""
            pri = a.get("priority") or "M"
            lines.append(f"- [{pri}] {a.get('task', '')}（{a.get('owner', '未指定')}{due}）")
    else:
        lines.append("- （无）")
    lines += ["", "## 未决问题"]
    lines.extend(f"- {q}" for q in notes.open_questions) if notes.open_questions else lines.append("- （无）")
    lines += ["", "## 风险"]
    lines.extend(f"- {r}" for r in notes.risks) if notes.risks else lines.append("- （无）")
    lines.append("")
    return "\n".join(lines)


def run(transcript: str, chunk_chars: int, live: bool, model: str) -> MeetingNotes:
    chunks = split_transcript(transcript, chunk_chars)
    print(f"=== Map：{len(chunks)} 个 chunk（chunk_chars={chunk_chars}） mode={'live' if live else 'mock'} ===")
    extractions: list[ChunkExtraction] = []
    for i, chunk in enumerate(chunks, 1):
        print(f"\n--- chunk {i}/{len(chunks)} ({len(chunk)} chars) ---")
        print(chunk[:120].replace("\n", " ") + ("…" if len(chunk) > 120 else ""))
        if live:
            ext = live_map_chunk(i, chunk, model)
        else:
            ext = mock_map_chunk(i, chunk)
        extractions.append(ext)
        print(
            f"  map → agenda={len(ext.agenda)} decisions={len(ext.decisions)} "
            f"todos={len(ext.action_items)} open={len(ext.open_questions)} risks={len(ext.risks)}"
        )

    print("\n=== Reduce：合并去重 ===")
    if live:
        notes = live_reduce(extractions, model)
    else:
        notes = mock_reduce(extractions)

    md = render_markdown(notes)
    print(md)
    print("=== JSON ===")
    print(json.dumps(asdict(notes), ensure_ascii=False, indent=2))
    return notes


def main() -> None:
    ap = argparse.ArgumentParser(description="长会议 Map-Reduce 纪要 demo")
    ap.add_argument(
        "--transcript",
        type=Path,
        help="逐字稿文本路径；默认使用内置中文会议样例",
    )
    ap.add_argument("--chunk-chars", type=int, default=DEFAULT_CHUNK_CHARS, help="切段目标字数")
    ap.add_argument("--live", action="store_true", help="调用 DashScope 千问（需 API Key）")
    ap.add_argument("--model", default=DEFAULT_MODEL, help="直播模式下的 LLM 模型名")
    ap.add_argument(
        "--write-sample",
        action="store_true",
        help="将内置样例写入 sample_transcript.txt 后退出",
    )
    args = ap.parse_args()

    if args.write_sample:
        out = Path("sample_transcript.txt")
        out.write_text(SAMPLE_TRANSCRIPT, encoding="utf-8")
        print(f"已写入 {out.resolve()}")
        return

    if args.transcript:
        transcript = args.transcript.read_text(encoding="utf-8")
    else:
        transcript = SAMPLE_TRANSCRIPT

    try:
        run(transcript, args.chunk_chars, args.live, args.model)
    except Exception as exc:  # noqa: BLE001 — demo 入口统一打印
        print(f"ERROR: {exc}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
