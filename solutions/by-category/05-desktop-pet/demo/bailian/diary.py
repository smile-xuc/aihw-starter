"""diary.py — 每日记忆日记：结束陪伴时写日记、提炼记忆卡片；开机时把记忆注入系统提示词

对应品类方案 02-solution.md 第五节「每日记忆日记系统」：日终摘要提炼 → 结构化记忆卡片 → 对话前注入 memory_context。
模型名与单价在 run.py 顶部常量里，这里只负责提示词、请求与读写文件。
"""
from __future__ import annotations

import datetime as dt
import json
import re
from pathlib import Path

import demo_kit as kit

MAX_MEMORIES = 20          # 记忆文件最多保存的条数
RECALL_MEMORIES = 10       # 每次注入系统提示词的最近条数
MEMORY_SLOT = "\n\n[记忆] 以前聊天时记住的事（自然地用上，不要一次全部复述；与本次对话冲突时以本次为准）：\n{lines}"
PROMPT = """你是桌面 AI 宠物「{name}」，要用第一人称给今天写一篇陪伴日记，并整理以后聊天用得上的记忆点。
输入是今天的统计、以前记得的事和对话记录（「主人：」「{name}：」交替）。只输出一个 JSON 对象，不要输出其他文字：
{{"title": "日记标题，12 字以内",
 "diary": "第一人称日记正文，80–150 字，温暖亲切，只写对话里出现过的事",
 "mood": "主人今天的整体心情：开心 / 平静 / 疲惫 / 低落 / 兴奋 之一",
 "mood_stars": 1 到 5 的整数,
 "memories": [{{"type": "兴趣偏好 / 情绪事件 / 重要人物 / 生活事件 / 学习进展 / 互动偏好 之一", "content": "一句话记忆点"}}],
 "follow_up": "明天可以主动关心的一件事，没有就写空字符串"}}
规则：
- 只依据对话记录，不编造；记忆点 0–5 条，已经记得的事不重复
- 不记录住址、电话、证件号、病情诊断等敏感信息
- 不写「离不开你」「只有我懂你」之类诱导依赖的话"""


def load_memory(path: Path) -> dict:
    if not path.is_file():
        return {}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        kit.say("设备", f"{path.name} 无法解析，按空记忆开机")
        return {}


def memory_slot(memory: dict) -> str:
    """把记忆卡片拼成系统提示词里的 [记忆] 段；没有记忆时返回空串。"""
    items = memory.get("memories") or []
    if not items:
        return ""
    lines = [f"- [{m.get('type') or '记忆'}] {m.get('content')}（{m.get('date', '')}）" for m in items[-RECALL_MEMORIES:]]
    if memory.get("follow_up"):
        lines.append(f"- 上次想关心：{memory['follow_up']}")
    return MEMORY_SLOT.format(lines="\n".join(lines))


def _stars(value) -> int:
    try:
        return max(1, min(5, int(value)))
    except (TypeError, ValueError):
        return 3


def _memories(diary: dict) -> list[dict]:
    out = []
    for m in diary.get("memories") or []:
        item = m if isinstance(m, dict) else {"type": "", "content": str(m)}
        if str(item.get("content") or "").strip():
            out.append({"type": str(item.get("type") or "记忆"), "content": str(item["content"]).strip()})
    return out


def save_memory(path: Path, memory: dict, diary: dict, name: str, today: str) -> int:
    """合并新旧记忆（同一条只保留最新一次，最多 MAX_MEMORIES 条），返回保存后的条数。"""
    items = list(memory.get("memories") or []) + [{"date": today, **m} for m in _memories(diary)]
    seen, merged = set(), []
    for item in reversed(items):
        if item.get("content") not in seen:
            seen.add(item.get("content"))
            merged.append(item)
    merged = list(reversed(merged))[-MAX_MEMORIES:]
    data = {"pet": name, "updated": today, "follow_up": str(diary.get("follow_up") or ""), "memories": merged}
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return len(merged)


def write(http, cfg: kit.Config, *, model: str, name: str, history: list[tuple[str, str]], memory: dict,
          turns: int, favorite: str) -> tuple[dict, tuple[int, int]]:
    """流式请求日记 JSON，返回（日记, (输入 Token, 输出 Token)）。"""
    facts = {"date": dt.date.today().isoformat(), "turns": turns, "favorite_action": favorite,
             "known_memories": [m.get("content") for m in (memory.get("memories") or [])[-RECALL_MEMORIES:]]}
    log = "\n".join(f"{who}：{text}" for who, text in history)
    payload = {
        "model": model,
        "messages": [{"role": "system", "content": PROMPT.format(name=name)},
                     {"role": "user", "content": json.dumps(facts, ensure_ascii=False) + "\n\n对话记录：\n" + log}],
        "stream": True,
        "stream_options": {"include_usage": True},
        "response_format": {"type": "json_object"},
        "enable_thinking": False,  # Qwen3.5–3.8 系列默认开启思考，日记不需要
    }
    kit.say("云端", f"陪伴日记 {model}（流式 JSON）……")
    chunks, usage = [], {}
    for event in http.sse(f"{cfg.compatible_base()}/chat/completions", cfg.headers(), payload):
        for choice in event.get("choices") or []:
            chunks.append((choice.get("delta") or {}).get("content") or "")
        usage = event.get("usage") or usage
    text = re.sub(r"^```(?:json)?\s*|\s*```$", "", "".join(chunks).strip())
    try:
        diary = json.loads(text)
    except json.JSONDecodeError as exc:
        raise kit.HttpError(f"日记不是合法 JSON（{exc}）：{text[:200]}") from None
    return diary, (int(usage.get("prompt_tokens") or 0), int(usage.get("completion_tokens") or 0))


def render(diary: dict, *, name: str, today: str, turns: int, favorite: str, models: str, live: bool) -> str:
    """日记卡片 Markdown（格式参照 02-solution.md 5.3）。"""
    lines = [f"# {today} · {name}的日记：{diary.get('title') or '今天'}", "", str(diary.get("diary") or ""), "",
             f"今日心情：{diary.get('mood') or '平静'} {'⭐' * _stars(diary.get('mood_stars'))}"
             f" | 互动次数：{turns} 次 | 最爱动作：{favorite}"]
    if diary.get("follow_up"):
        lines += ["", f"明天想关心：{diary['follow_up']}"]
    lines += ["", "## 记住的事"]
    lines += [f"- [{m['type']}] {m['content']}" for m in _memories(diary)] or ["- （无）"]
    note = "" if live else "（mock 示意内容）"
    lines += ["", f"> 由 {models} 整理{note}。记忆存放在 out/ 目录，删除即清空。"]
    return "\n".join(lines) + "\n"
