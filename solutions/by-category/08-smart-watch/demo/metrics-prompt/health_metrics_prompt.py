"""
health_metrics_prompt.py — 智能手表健康指标 → 自然语言解读（离线 mock）

对应 02-solution.md Prompt 模式：结构化 JSON → 日报文本。
本 demo 不调用真实 LLM，用确定性模板生成，便于 CI / 离线验收。

用法：
  python3 health_metrics_prompt.py
  python3 health_metrics_prompt.py --metrics sample_day.json
  python3 health_metrics_prompt.py --json

⚠️ AI 生成代码，仅作接入参考。不做医疗诊断。
"""

from __future__ import annotations

import argparse
import json
from dataclasses import dataclass
from pathlib import Path

DISCLAIMER = "以上为AI健康参考，不替代专业医疗意见。"


@dataclass
class DayMetrics:
    gender: str
    age: int
    bmi: float
    rhr: int
    rhr_avg7: int
    spo2: float
    spo2_min: float
    deep_sleep_min: int
    total_sleep_min: int
    steps: int
    cal: int


DEFAULT = DayMetrics(
    gender="女",
    age=32,
    bmi=21.5,
    rhr=68,
    rhr_avg7=62,
    spo2=97.0,
    spo2_min=94.0,
    deep_sleep_min=55,
    total_sleep_min=390,
    steps=6200,
    cal=1850,
)


def load_metrics(path: Path | None) -> DayMetrics:
    if path is None:
        return DEFAULT
    data = json.loads(path.read_text(encoding="utf-8"))
    return DayMetrics(**data)


def build_prompt(m: DayMetrics) -> str:
    return f"""角色设定：专业健康顾问。根据以下用户今日健康数据，给出简洁的健康解读和建议。

## 用户画像
- 性别: {m.gender}, 年龄: {m.age}, BMI: {m.bmi}

## 今日数据
- 静息心率: {m.rhr} bpm（7日均值: {m.rhr_avg7}）
- 血氧: {m.spo2}%（最低: {m.spo2_min}%）
- 深睡时长: {m.deep_sleep_min} min / 总睡眠: {m.total_sleep_min} min
- 步数: {m.steps}, 活动热量: {m.cal} kcal

## 输出要求
1. 一句话总结今日状态（≤20字）
2. 需关注项（如有异常）
3. 一条可执行建议

注意：不做医疗诊断，异常指标建议就医。
"""


def mock_interpret(m: DayMetrics) -> dict:
    alerts: list[str] = []
    tags: list[str] = []

    if m.rhr - m.rhr_avg7 >= 8:
        alerts.append(f"静息心率较 7 日均值偏高 {m.rhr - m.rhr_avg7} bpm")
        tags.append("[ALERT]")
    if m.spo2_min < 94:
        alerts.append(f"血氧最低 {m.spo2_min}% ，低于常见关注阈值")
        tags.append("[ALERT]")
    if m.total_sleep_min < 360:
        alerts.append("总睡眠不足 6 小时")
    if m.deep_sleep_min < 60:
        alerts.append("深睡偏少")

    if alerts:
        summary = "今日需关注恢复与睡眠"
        advice = "今晚提前 30 分钟入睡，避免咖啡因；若心率持续偏高请就医。"
    else:
        summary = "整体平稳，保持节奏"
        advice = "维持今日步数区间，睡前减少屏幕时间。"

    body_lines = [
        f"1. 总结：{summary}",
        "2. 关注：" + ("；".join(alerts) if alerts else "无明显异常项"),
        f"3. 建议：{advice}",
        DISCLAIMER,
    ]
    if tags:
        body_lines.insert(0, " ".join(dict.fromkeys(tags)))

    return {
        "summary": summary,
        "alerts": alerts,
        "advice": advice,
        "text": "\n".join(body_lines),
        "prompt_chars": len(build_prompt(m)),
    }


def main() -> None:
    ap = argparse.ArgumentParser(description="智能手表健康指标解读 demo（离线 mock）")
    ap.add_argument("--metrics", type=Path, help="指标 JSON 路径")
    ap.add_argument("--json", action="store_true", help="输出结构化 JSON")
    ap.add_argument("--show-prompt", action="store_true", help="同时打印将送入 LLM 的 prompt")
    args = ap.parse_args()

    m = load_metrics(args.metrics)
    result = mock_interpret(m)

    if args.show_prompt:
        print("--- prompt ---")
        print(build_prompt(m))
        print("--- interpretation ---")

    if args.json:
        print(json.dumps(result, ensure_ascii=False, indent=2))
    else:
        print(result["text"])
        print(f"(prompt ≈ {result['prompt_chars']} chars; mock, no API call)")


if __name__ == "__main__":
    main()
