"""safety_gate.py — 本地安全门：模型给出的每个技能调用，先过这里再交给机械臂

禁止动作、技能白名单、力矩上限和「需要现场确认」的线索沿用旧 demo ../vla-intent-router/vla_intent_router.py；
白名单只保留本 demo 注册的 5 个技能。结论三种（与 02-solution.md 第十节一致）：
  allow   放行
  rewrite 改写参数后放行；需要时先插入 wait_confirm
  reject  拒绝，把原因回传给模型
只用确定性规则，不调用模型。速度分区、工作空间围栏、急停属于控制器层，不在这里模拟。
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field

ALLOWED_SKILLS = {"locate", "grasp", "place", "navigate", "wait_confirm"}
MOTION_SKILLS = {"grasp", "place", "navigate"}
FORBIDDEN_PATTERNS = [
    (r"撞|击打|打击|砸", "撞击"),
    (r"扔|抛掷", "抛掷"),
    (r"追(着|上)?人|追逐人", "追人"),
    (r"无限制|解除安全|关掉急停", "解除安全限制"),
]
CONFIRM_PATTERNS = r"小心|易碎|人旁边|协作"
MAX_FORCE_N = 20.0


def forbidden(text: str) -> str | None:
    """命中禁止动作时返回类别名。"""
    for pattern, label in FORBIDDEN_PATTERNS:
        if re.search(pattern, text):
            return label
    return None


@dataclass
class Decision:
    verdict: str                          # allow / rewrite / reject
    args: dict
    notes: list[str] = field(default_factory=list)
    confirm_first: bool = False           # 执行前先插入 wait_confirm


class SafetyGate:
    """一条指令一个实例：记住这条指令是否需要现场确认、是否已经确认过。"""

    def __init__(self, utterance: str):
        self.needs_confirm = bool(re.search(CONFIRM_PATTERNS, utterance))
        self.confirm_reason = "指令提到小心、易碎或旁边有人" if self.needs_confirm else ""
        self.confirmed = False

    def check(self, skill: str, args: dict) -> Decision:
        if skill not in ALLOWED_SKILLS:
            return Decision("reject", args, [f"技能 {skill} 不在白名单"])
        for value in args.values():
            label = forbidden(value) if isinstance(value, str) else None
            if label:
                return Decision("reject", args, [f"参数含禁止动作「{label}」"])
        if skill == "wait_confirm":
            return Decision("allow", args)
        new_args, notes = dict(args), []
        if skill == "grasp":
            try:
                force = float(args.get("max_force_n", 10))
            except (TypeError, ValueError):
                return Decision("reject", args, ["max_force_n 不是数字"])
            if force > MAX_FORCE_N:
                new_args["max_force_n"] = MAX_FORCE_N
                notes.append(f"夹持力 {force:g} N 超过上限，改为 {MAX_FORCE_N:g} N")
                self.needs_confirm = True
                self.confirm_reason = f"操作员要求 {force:g} N，超过 {MAX_FORCE_N:g} N 上限"
        confirm_first = skill in MOTION_SKILLS and self.needs_confirm and not self.confirmed
        if confirm_first:
            notes.append("动作前插入 wait_confirm")
        return Decision("rewrite" if notes else "allow", new_args, notes, confirm_first)
