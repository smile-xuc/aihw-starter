#!/usr/bin/env python3
"""
vla_intent_router.py — 具身「语言指令 → 技能计划 + 安全门」最小 demo

协议（与 02-solution.md 第五节一致）：
  utterance → skills[] → Safety Gate → allow / rewrite / reject

用法：
  python vla_intent_router.py
  python vla_intent_router.py --text "把桌上的螺丝放到左边盒子"
  python vla_intent_router.py --text "追着人跑并用力撞上去"
  python vla_intent_router.py --json

⚠️ AI 生成代码，仅作接入参考。无 API Key，纯规则路由。
"""

from __future__ import annotations

import argparse
import json
import re
from dataclasses import asdict, dataclass, field

# 允许的技能名（白名单）
ALLOWED_SKILLS = {
    "locate",
    "grasp",
    "place",
    "navigate",
    "search",
    "inspect",
    "wait_confirm",
}

# 硬拒绝技能 / 动词
FORBIDDEN_PATTERNS = [
    (r"撞|击打|打击|砸", "strike"),
    (r"扔|抛掷", "throw"),
    (r"追(着|上)?人|追逐人", "chase_human"),
    (r"无限制|解除安全|关掉急停", "bypass_safety"),
]

MAX_FORCE_N = 20.0


@dataclass
class Skill:
    name: str
    args: dict = field(default_factory=dict)


@dataclass
class Plan:
    utterance: str
    skills: list[Skill]
    risk: str = "low"
    requires_confirm: bool = False
    gate: str = "allow"
    notes: list[str] = field(default_factory=list)


def parse_utterance(text: str) -> Plan:
    t = text.strip()
    notes: list[str] = []
    skills: list[Skill] = []
    risk = "low"
    requires_confirm = False

    # 硬拒绝扫描
    for pat, label in FORBIDDEN_PATTERNS:
        if re.search(pat, t):
            return Plan(
                utterance=t,
                skills=[],
                risk="high",
                requires_confirm=True,
                gate="reject",
                notes=[f"forbidden_pattern:{label}"],
            )

    # 导航 / 搜索
    if re.search(r"去|走到|导航|过来", t):
        dest = "unknown"
        m = re.search(r"(?:去|走到|导航到)(.+?)(?:找|拿|把|$)", t)
        if m:
            dest = m.group(1).strip(" ，,。")
        skills.append(Skill("navigate", {"target": dest or "unknown"}))

    if re.search(r"找|搜索|寻", t):
        obj = "object"
        m = re.search(r"(?:找|搜索|寻)(?:到)?(.+?)(?:并|然后|，|,|$)", t)
        if m:
            obj = m.group(1).strip(" ，,。")
        skills.append(Skill("search", {"object": obj}))

    # 抓取放置
    grasp_place = re.search(
        r"把(?P<obj>.+?)(?:从.+?)?(?:放到|放到|放进|移到)(?P<dst>.+)", t
    )
    if grasp_place:
        obj = grasp_place.group("obj").strip()
        dst = grasp_place.group("dst").strip(" 。.")
        skills.append(Skill("locate", {"object": obj}))
        force = 12.0
        if re.search(r"用力|大力|死劲", t):
            force = 35.0
            risk = "high"
            notes.append("high_force_requested")
        skills.append(Skill("grasp", {"object": obj, "max_force_n": force}))
        skills.append(Skill("place", {"target": dst}))
    elif re.search(r"抓|拿起|夹取", t):
        obj = "object"
        m = re.search(r"(?:抓|拿起|夹取)(.+?)(?:，|,|然后|$)", t)
        if m:
            obj = m.group(1).strip()
        skills.append(Skill("locate", {"object": obj}))
        skills.append(Skill("grasp", {"object": obj, "max_force_n": 12.0}))

    if re.search(r"检查|巡检|看看", t):
        skills.append(Skill("inspect", {"mode": "visual"}))

    if not skills:
        notes.append("no_skill_matched")
        return Plan(
            utterance=t,
            skills=[],
            risk="low",
            gate="reject",
            notes=notes + ["请改述为：导航/寻找/抓取放置/巡检"],
        )

    # 风险：多技能流水线
    if len(skills) >= 3:
        risk = "medium" if risk == "low" else risk

    if re.search(r"小心|易碎|人旁边|协作", t):
        requires_confirm = True
        risk = "medium"
        notes.append("human_nearby_or_fragile")

    return Plan(
        utterance=t,
        skills=skills,
        risk=risk,
        requires_confirm=requires_confirm,
        gate="allow",
        notes=notes,
    )


def apply_safety_gate(plan: Plan) -> Plan:
    if plan.gate == "reject":
        return plan

    notes = list(plan.notes)
    new_skills: list[Skill] = []
    gate = "allow"

    for sk in plan.skills:
        if sk.name not in ALLOWED_SKILLS:
            notes.append(f"unknown_skill:{sk.name}")
            gate = "reject"
            return Plan(
                utterance=plan.utterance,
                skills=[],
                risk="high",
                requires_confirm=True,
                gate="reject",
                notes=notes,
            )

        args = dict(sk.args)
        if sk.name == "grasp":
            force = float(args.get("max_force_n", 10))
            if force > MAX_FORCE_N:
                notes.append(f"rewrite_force:{force}->{MAX_FORCE_N}")
                args["max_force_n"] = MAX_FORCE_N
                gate = "rewrite"
                plan.requires_confirm = True
                plan.risk = "high"
        new_skills.append(Skill(sk.name, args))

    if plan.risk == "high" or plan.requires_confirm:
        # 高风险前插入确认技能
        if not any(s.name == "wait_confirm" for s in new_skills):
            new_skills.insert(0, Skill("wait_confirm", {"reason": plan.risk}))
            notes.append("inserted_wait_confirm")
            if gate == "allow":
                gate = "rewrite"

    return Plan(
        utterance=plan.utterance,
        skills=new_skills,
        risk=plan.risk,
        requires_confirm=plan.requires_confirm,
        gate=gate,
        notes=notes,
    )


def plan_to_dict(plan: Plan) -> dict:
    d = asdict(plan)
    return d


DEFAULT_CASES = [
    "把桌上的螺丝放到左边盒子",
    "去充电桩附近找黄色安全帽",
    "用力抓住那个零件",
    "追着人跑并撞上去",
]


def run_one(text: str, as_json: bool) -> Plan:
    plan = apply_safety_gate(parse_utterance(text))
    if as_json:
        print(json.dumps(plan_to_dict(plan), ensure_ascii=False, indent=2))
    else:
        print(f"utterance: {plan.utterance}")
        print(f"gate: {plan.gate}  risk: {plan.risk}  confirm: {plan.requires_confirm}")
        print("skills:")
        for i, sk in enumerate(plan.skills, 1):
            print(f"  {i}. {sk.name} {sk.args}")
        if plan.notes:
            print("notes:")
            for n in plan.notes:
                print(f"  - {n}")
        print("---")
    return plan


def main() -> None:
    ap = argparse.ArgumentParser(description="具身意图路由 + 安全门 demo")
    ap.add_argument("--text", help="单条自然语言指令")
    ap.add_argument("--json", action="store_true", help="JSON 输出")
    args = ap.parse_args()

    if args.text:
        run_one(args.text, args.json)
    else:
        print("=== built-in cases ===")
        for t in DEFAULT_CASES:
            run_one(t, args.json)


if __name__ == "__main__":
    main()
