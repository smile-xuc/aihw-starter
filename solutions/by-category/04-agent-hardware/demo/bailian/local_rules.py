"""local_rules.py — 端侧规则：意图三分 + 本地指令解析

classify() 和关键词表复制自旧 demo ../intent-router/intent_router.py（三分法与 02-solution.md 第五节一致），
本 demo 补了「叫我」「闹钟」「音量」「顺便」，并把「设闹钟」从多步线索挪到本地闹钟。
local_actions() 把能在本地完成的一句话解析成工具调用；offline_split() 在断网时把多步指令拆成小句逐句处理。
量产时这一层跑在设备上（规则或 0.5B 级小模型），命中就直接执行，不上云。
"""
from __future__ import annotations

import datetime as dt
import re
from dataclasses import dataclass

LOCAL_PATTERNS = (
    ("关灯", "device_control"),
    ("开灯", "device_control"),
    ("关掉", "device_control"),
    ("打开空调", "device_control"),
    ("关闭空调", "device_control"),
    ("分钟后", "timer"),
    ("提醒我", "timer"),
    ("设个闹钟", "timer"),
    ("星期几", "local_fact"),
    ("几点了", "local_fact"),
    ("叫我", "timer"),
    ("闹钟", "timer"),
    ("音量", "device_control"),
)
HYBRID_PATTERNS = ("然后", "并且", "同时", "查一下", "帮我订", "发邮件", "汇总", "顺便")

ROOMS = ("客厅", "卧室", "书房", "厨房", "全部")
_CN_DIGITS = {"零": 0, "一": 1, "二": 2, "两": 2, "三": 3, "四": 4, "五": 5, "六": 6, "七": 7, "八": 8, "九": 9}
_NUM = r"(\d{1,2}|[一二两三四五六七八九十]{1,3})"


@dataclass
class Route:
    route: str      # local / cloud / hybrid
    intent: str
    reason: str


def classify(text: str) -> Route:
    """多步线索优先于单点本地关键词（避免「查天气然后设闹钟」被当成纯闹钟）。"""
    t = text.strip()
    for keyword in HYBRID_PATTERNS:
        if keyword in t:
            return Route("hybrid", "multi_step", f"多步线索「{keyword}」")
    for keyword, intent in LOCAL_PATTERNS:
        if keyword in t:
            return Route("local", intent, f"本地关键词「{keyword}」")
    return Route("cloud", "open_domain_qa", "没有命中本地规则")


def _number(token: str) -> int | None:
    if token.isdigit():
        return int(token)
    if token == "十":
        return 10
    if "十" in token:
        tens, _, ones = token.partition("十")
        return _CN_DIGITS.get(tens, 1) * 10 + (_CN_DIGITS.get(ones, 0) if ones else 0)
    return _CN_DIGITS.get(token)


def parse_time(text: str, now: dt.datetime) -> tuple[str, str] | None:
    """「10 分钟后」「明早七点」「晚上八点半」→（HH:MM, 今天 / 明天）。解析不了返回 None。"""
    m = re.search(_NUM + r"\s*分钟后", text)
    if m and _number(m.group(1)) is not None:
        when = now + dt.timedelta(minutes=_number(m.group(1)))
        return when.strftime("%H:%M"), "今天" if when.date() == now.date() else "明天"
    m = re.search(r"(明早|明天早上|明天上午|明天下午|明晚|明天晚上|明天|今晚|早上|上午|下午|晚上)?\s*"
                  + _NUM + r"\s*[点:：]\s*(半|\d{1,2}|[一二三四五六七八九十]{1,3})?", text)
    if not m:
        return None
    period, hour, minute = m.groups()
    h = _number(hour)
    mi = 30 if minute == "半" else (_number(minute) if minute else 0)
    if h is None or mi is None:
        return None
    if period and ("下午" in period or "晚" in period) and h < 12:
        h += 12
    if not (0 <= h < 24 and 0 <= mi < 60):
        return None
    return f"{h:02d}:{mi:02d}", "明天" if period and period.startswith("明") else "今天"


def local_actions(text: str, now: dt.datetime) -> list[tuple[str, dict]] | None:
    """一句本地指令 → [(工具名, 参数)]；「say」表示直接播报。解析不了返回 None，在线时交给云端。"""
    t = text.strip()
    if "灯" in t:
        room = next((r for r in ROOMS if r in t), "全部")
        return [("set_light", {"room": room, "on": not any(k in t for k in ("关", "灭"))})]
    if "音量" in t:
        m = re.search(r"(\d{1,3})", t)
        return [("set_volume", {"level": int(m.group(1))})] if m else None
    if any(k in t for k in ("叫我", "闹钟", "提醒我", "分钟后")):
        parsed = parse_time(t, now)
        if not parsed:
            return None
        m = re.search(r"提醒我(.+)", t)
        label = m.group(1).strip("，,。 ") if m else "起床" if "叫我" in t else "闹钟"
        return [("set_alarm", {"time": parsed[0], "date": parsed[1], "label": label or "提醒"})]
    if "星期几" in t:
        return [("say", {"text": f"今天是星期{'一二三四五六日'[now.weekday()]}。"})]
    if "几点了" in t:
        return [("say", {"text": f"现在是 {now:%H:%M}。"})]
    return None


def offline_split(text: str, now: dt.datetime) -> tuple[list[tuple[str, dict]], list[str]]:
    """断网降级：拆成小句，能本地解析的照做（不再要求命中关键词），其余返回给调用方提示「需要联网」。"""
    done: list[tuple[str, dict]] = []
    pending: list[str] = []
    for clause in re.split(r"[，,。；;！!？?]|顺便|然后|并且|同时", text):
        clause = clause.strip()
        if not clause:
            continue
        actions = local_actions(clause, now)
        if actions:
            done += actions
        else:
            pending.append(clause)
    return done, pending
