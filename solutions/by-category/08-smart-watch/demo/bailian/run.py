#!/usr/bin/env python3
"""08 智能手表 · 百炼健康日报参考 demo

模拟一块健康手表的每日日报：
  一天的聚合指标（JSON，手表 → 手机 App 同步）
  → 本地红线规则（夜间血氧最低 < 90%、静息心率 > 100 或 < 40）：命中立即震动提醒，不等云端、不依赖模型
  → qwen3.7-flash（默认档；--quality 换质量档 qwen3.8-flash。OpenAI 兼容，流式，JSON Schema 结构化输出）
    输出 summary / alerts / advice / disclaimer
  → 表盘窄卡片（控制台）+ App 日报 out/report_<样本名>.json
  → 可选 --speak：qwen-audio-3.0-tts-flash 抬腕播报 → out/speak_<样本名>.wav

一条命令：
  python3 run.py           有 DASHSCOPE_API_KEY 就真跑；没有就自动 mock
  python3 run.py --mock    强制离线 mock（CI 冒烟用）

只用标准库。不做医疗诊断。接口以官方文档为准：
  结构化输出  https://help.aliyun.com/zh/model-studio/json-mode
  非实时语音合成  https://help.aliyun.com/zh/model-studio/non-realtime-tts-user-guide
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import unicodedata
import wave
from dataclasses import dataclass, field
from pathlib import Path

import demo_kit as kit

DEMO_DIR = Path(__file__).resolve().parent
LLM_MODEL = "qwen3.7-flash"         # 默认档
QUALITY_MODEL = "qwen3.8-flash"     # 质量档：--quality
TTS_MODEL = "qwen-audio-3.0-tts-flash"
DEFAULT_VOICE = "longanhuan_v3.6"   # 官方示例音色；其他音色见 Qwen-Audio-TTS 音色列表
TTS_RATE = 24000
SAMPLES = [DEMO_DIR / "samples" / "day_normal.json", DEMO_DIR / "samples" / "day_alert.json"]
FIELDS = ("gender", "age", "bmi", "rhr", "rhr_avg7", "spo2", "spo2_min",
          "deep_sleep_min", "total_sleep_min", "steps", "cal")
CARD_WIDTH = 26                     # 表盘一行的显示宽度：半角算 1，汉字算 2

# 元 / 百万 Token，按单次请求的输入 Token 分档：(档位上限, 输入, 输出)。查证 2026-10-01：
#   https://help.aliyun.com/zh/model-studio/qwen3-7-flash
#   https://help.aliyun.com/zh/model-studio/qwen3-8-flash
LLM_PRICES = {
    LLM_MODEL: {
        "cn-beijing": [(32_000, 0.2, 0.8), (256_000, 0.6, 2.4), (1_000_000, 1.2, 4.8)],
        "ap-southeast-1": [(32_000, 0.225, 0.974), (256_000, 0.749, 2.998), (1_000_000, 1.499, 5.995)],
    },
    QUALITY_MODEL: {
        "cn-beijing": [(1_000_000, 0.8, 2.7)],
        "ap-southeast-1": [(1_000_000, 1.094, 3.427)],
    },
}
# 元 / 万字符，汉字按 2 个字符计。来源：https://help.aliyun.com/zh/model-studio/model-pricing（查证 2026-10-01）
# Qwen-Audio-TTS 的非实时 HTTP 合成仅北京可用：https://help.aliyun.com/zh/model-studio/non-realtime-tts-user-guide
TTS_PRICES = {"cn-beijing": 1.0}

DISCLAIMER = "以上为 AI 健康参考，不替代专业医疗意见。"
SYSTEM = f"""角色：智能手表的健康日报助手。输入是手表经手机 App 同步的一天聚合指标，以及手表本地规则已判定的红线。
字段：gender 性别，age 年龄，bmi，rhr 静息心率（次/分），rhr_avg7 近 7 日静息心率均值，spo2 血氧均值（%），
spo2_min 夜间血氧最低（%），deep_sleep_min 深睡（分钟），total_sleep_min 总睡眠（分钟），steps 步数，cal 活动热量（千卡）。
按给定的 JSON Schema 输出一个 JSON 对象：
- summary：表盘上的一句话总结，不超过 16 个汉字
- alerts：需要关注的指标，最多 3 条；metric 取 spo2 / rhr / sleep / activity / other；text 不超过 24 个汉字，写出数值和参考值
- advice：今天能做到的建议，最多 2 条，每条不超过 20 个汉字
- disclaimer：固定为「{DISCLAIMER}」
规则：
- 只做健康参考，不做诊断：不写病名，不推荐药物或剂量，不说「没事」「完全正常」之类的保证
- 本地红线已触发时，summary 要提到它，advice 里包含「及时咨询医生」
- 只依据输入数据，不编造没有的指标；静息心率和 7 日均值比较时写出差值
- 语气平和，不制造恐慌"""

REPORT_SCHEMA = {
    "type": "object",
    "properties": {
        "summary": {"type": "string", "description": "表盘一句话总结，不超过 16 个汉字"},
        "alerts": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "metric": {"type": "string", "enum": ["spo2", "rhr", "sleep", "activity", "other"]},
                    "text": {"type": "string"},
                },
                "required": ["metric", "text"],
                "additionalProperties": False,
            },
        },
        "advice": {"type": "array", "items": {"type": "string"}},
        "disclaimer": {"type": "string"},
    },
    "required": ["summary", "alerts", "advice", "disclaimer"],
    "additionalProperties": False,
}


@dataclass
class DayResult:
    name: str
    model: str
    report: dict = field(default_factory=dict)
    first_ms: float | None = None      # 数据同步完成 → 日报首个 token
    tokens: tuple[int, int] = (0, 0)
    tts_chars: int = 0

    def cost(self, region: str) -> float:
        prompt, completion = self.tokens
        price_in, price_out = llm_price(self.model, region, prompt)
        return (prompt * price_in + completion * price_out) / 1e6 + self.tts_chars * TTS_PRICES.get(region, 0) / 1e4


def llm_price(model: str, region: str, prompt_tokens: int) -> tuple[float, float]:
    tiers = LLM_PRICES[model][region]
    for limit, price_in, price_out in tiers:
        if prompt_tokens <= limit:
            return price_in, price_out
    return tiers[-1][1], tiers[-1][2]


# ───────────────────────── 手表本地 ─────────────────────────

def load_day(path: Path) -> dict:
    try:
        day = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        sys.exit(f"读取 {path} 失败：{exc}")
    missing = [k for k in FIELDS if k not in day]
    if missing:
        sys.exit(f"{path.name} 缺少字段：{', '.join(missing)}（字段说明见 samples/README.md）")
    return day


def red_lines(day: dict) -> list[dict]:
    """手表 / App 端的确定性红线：命中就提醒，不等云端，也不交给模型判断。

    阈值是演示用的常见参考值；量产前按产品定位与医学顾问意见确定。
    """
    found = []
    if day["spo2_min"] < 90:
        found.append({"metric": "spo2", "text": f"血氧最低 {day['spo2_min']:g}%，低于 90%"})
    if day["rhr"] > 100:
        found.append({"metric": "rhr", "text": f"静息心率 {day['rhr']} 次/分，高于 100"})
    elif day["rhr"] < 40:
        found.append({"metric": "rhr", "text": f"静息心率 {day['rhr']} 次/分，低于 40"})
    return found


def merge(model: dict, reds: list[dict]) -> dict:
    """红线只认本地规则；模型的同类提醒不重复显示；免责声明由代码固定。"""
    red_metrics = {r["metric"] for r in reds}
    alerts = [{"level": "red", **r} for r in reds]
    for item in model.get("alerts") or []:
        if isinstance(item, dict) and item.get("text") and item.get("metric") not in red_metrics:
            alerts.append({"level": "yellow", "metric": item.get("metric") or "other", "text": str(item["text"])})
    return {
        "summary": str(model.get("summary") or "今日数据已同步"),
        "alerts": alerts[:4],
        "advice": [str(a) for a in model.get("advice") or [] if a][:3],
        "disclaimer": DISCLAIMER,
    }


def _width(text: str) -> int:
    return sum(2 if unicodedata.east_asian_width(c) in "WF" else 1 for c in text)


def _wrap(text: str, width: int) -> list[str]:
    lines, line = [], ""
    for ch in text:
        if _width(line + ch) > width:
            lines.append(line)
            line = ""
        line += ch
    return lines + [line] if line else lines


def watch_card(report: dict) -> list[str]:
    """表盘窄卡片。量产时把这里换成表盘 UI 的渲染调用。"""
    rows: list[str] = []

    def add(text: str, prefix: str = "") -> None:
        for i, piece in enumerate(_wrap(text, CARD_WIDTH - _width(prefix))):
            rows.append((prefix if i == 0 else " " * _width(prefix)) + piece)

    reds = [a for a in report["alerts"] if a["level"] == "red"]
    status = "红线提醒" if reds else "需关注" if report["alerts"] else "平稳"
    rows.append("今日健康" + " " * (CARD_WIDTH - _width("今日健康" + status)) + status)
    add(report["summary"])
    rows.append("─" * CARD_WIDTH)
    for alert in report["alerts"]:
        add(alert["text"], "红 " if alert["level"] == "red" else "黄 ")
    if not report["alerts"]:
        add("暂无需要关注的指标")
    for tip in report["advice"][:2]:
        add(tip, "> ")
    rows.append("─" * CARD_WIDTH)
    add(report["disclaimer"])
    return (["╭" + "─" * (CARD_WIDTH + 2) + "╮"]
            + ["│ " + r + " " * (CARD_WIDTH - _width(r)) + " │" for r in rows]
            + ["╰" + "─" * (CARD_WIDTH + 2) + "╯"])


def speech_text(report: dict) -> str:
    parts = [report["summary"]] + [a["text"] for a in report["alerts"] if a["level"] == "red"] + report["advice"][:1]
    return "。".join(p.rstrip("。") for p in parts if p) + "。"


def play_wav(path: Path) -> bool:
    try:
        with wave.open(str(path), "rb") as w:
            if w.getsampwidth() != 2 or w.getnchannels() != 1:
                return False
            return kit.play_pcm(w.readframes(w.getnframes()), w.getframerate())
    except Exception:  # noqa: BLE001 — 没有声卡或文件头不完整时只保留 WAV
        return False


# ───────────────────────── 云端 ─────────────────────────

def interpret(http, cfg: kit.Config, model: str, day: dict,
              reds: list[dict]) -> tuple[dict, float | None, tuple[int, int]]:
    """返回（模型 JSON, 首个 token 到达时刻, (输入, 输出) Token）。"""
    user = {"今日指标": day, "本地红线": [r["text"] for r in reds] or "无"}
    payload = {
        "model": model,
        "messages": [{"role": "system", "content": SYSTEM},
                     {"role": "user", "content": json.dumps(user, ensure_ascii=False)}],
        "stream": True,
        "stream_options": {"include_usage": True},
        "response_format": {"type": "json_schema",
                            "json_schema": {"name": "watch_daily_report", "strict": True, "schema": REPORT_SCHEMA}},
        "enable_thinking": False,   # Qwen3.5–3.8 默认开思考，必须显式关闭
    }
    first_at, chunks, tokens = None, [], (0, 0)
    for event in http.sse(f"{cfg.compatible_base()}/chat/completions", cfg.headers(), payload):
        for choice in event.get("choices") or []:
            delta = (choice.get("delta") or {}).get("content") or ""
            if delta and first_at is None:
                first_at = kit.now_ms()
            chunks.append(delta)
        if event.get("usage"):
            usage = event["usage"]
            tokens = (int(usage.get("prompt_tokens") or 0), int(usage.get("completion_tokens") or 0))
    text = re.sub(r"^```(?:json)?\s*|\s*```$", "", "".join(chunks).strip())
    try:
        return json.loads(text), first_at, tokens
    except json.JSONDecodeError as exc:
        raise kit.HttpError(f"日报不是合法 JSON（{exc}）：{text[:200]}") from None


def synthesize(http, cfg: kit.Config, text: str, voice: str) -> tuple[bytes, int]:
    """非实时语音合成（非流式）：返回音频 URL（24 小时有效）后下载。返回（WAV 字节, 计费字符数）。"""
    payload = {"model": TTS_MODEL,
               "input": {"text": text, "voice": voice, "format": "wav", "sample_rate": TTS_RATE}}
    resp = http.json("POST", f"{cfg.api_base()}/services/audio/tts/SpeechSynthesizer", cfg.headers(), payload)
    url = ((resp.get("output") or {}).get("audio") or {}).get("url")
    if not url:
        raise kit.HttpError(f"语音合成没有返回音频地址：{json.dumps(resp, ensure_ascii=False)[:300]}")
    return http.get_bytes(url), int((resp.get("usage") or {}).get("characters") or 0)


# ───────────────────────── 主流程 ─────────────────────────

def run_day(http, cfg: kit.Config, args: argparse.Namespace, path: Path, model: str, speak: bool) -> DayResult:
    result = DayResult(path.name, model)
    day = load_day(path)
    kit.say("设备", f"手表 → 手机 App 同步完成：{path.name}（{len(day)} 项聚合指标，不含原始波形）")
    t_sync = kit.now_ms()
    reds = red_lines(day)
    if reds:
        kit.say("设备", f"本地红线 ×{len(reds)} → 震动 2 次 + 表盘弹窗：{'；'.join(r['text'] for r in reds)}")
    else:
        kit.say("设备", "本地红线：未触发")
    kit.say("云端", f"日报 {model}（流式 · JSON Schema）……")
    reply, first_at, result.tokens = interpret(http, cfg, model, day, reds)
    result.first_ms = None if first_at is None else first_at - t_sync
    result.report = merge(reply, reds)

    out = DEMO_DIR / "out"
    out.mkdir(exist_ok=True)
    report_path = out / f"report_{path.stem}.json"
    report_path.write_text(json.dumps({"model": model, "input": day, "local_red_lines": reds,
                                       "report": result.report}, ensure_ascii=False, indent=2) + "\n",
                           encoding="utf-8")
    kit.say("手表", "表盘卡片：")
    print("\n".join("        " + line for line in watch_card(result.report)))
    kit.say("App", f"推送日报 → {report_path.relative_to(DEMO_DIR)}")

    if speak:
        text = speech_text(result.report)
        kit.say("云端", f"播报 {TTS_MODEL}（音色 {args.voice}）：{text}")
        audio, result.tts_chars = synthesize(http, cfg, text, args.voice)
        wav = out / f"speak_{path.stem}.wav"
        wav.write_bytes(audio)
        played = cfg.live and not args.no_play and play_wav(wav)
        kit.say("设备", f"抬腕播报 → {wav.relative_to(DEMO_DIR)}（{len(audio) // 1024} KB）{' · 已播放' if played else ''}")

    first = f"{result.first_ms:.0f} ms" if cfg.live and result.first_ms is not None else "—（mock 不计时）"
    tts = f" + 播报 {result.tts_chars} 字符" if speak else ""
    kit.say("统计", f"{path.name} · 同步完成 → 首字 {first} · ¥{kit.fmt_cny(result.cost(cfg.region))}"
                    f"（输入 {result.tokens[0]} / 输出 {result.tokens[1]} Token{tts}）")
    return result


def main() -> None:
    ap = argparse.ArgumentParser(description="08 智能手表 · 百炼健康日报参考 demo")
    kit.add_standard_args(ap)
    ap.add_argument("--day", type=Path, action="append",
                    help="一天的聚合指标 JSON，可重复；默认 samples/day_normal.json 和 day_alert.json")
    ap.add_argument("--quality", action="store_true", help=f"日报改用质量档 {QUALITY_MODEL}（默认 {LLM_MODEL}）")
    ap.add_argument("--speak", action="store_true", help=f"抬腕播报：{TTS_MODEL} 合成语音（非实时 HTTP 合成仅北京）")
    ap.add_argument("--voice", default=DEFAULT_VOICE, help="播报音色")
    ap.add_argument("--no-play", action="store_true", help="只写 WAV，不播放")
    args = ap.parse_args()

    cfg = kit.resolve(args, DEMO_DIR)
    model = QUALITY_MODEL if args.quality else LLM_MODEL
    speak = args.speak and cfg.region in TTS_PRICES
    models = [model] + ([TTS_MODEL] if speak else [])
    kit.banner("08 智能手表 · 百炼健康日报参考 demo", cfg, models)
    if args.speak and not speak:
        kit.say("提示", f"{TTS_MODEL} 的非实时 HTTP 合成仅北京地域可用，本次跳过 --speak")
    if cfg.live:
        http = kit.HttpTransport()
        if not cfg.workspace_id:
            kit.say("提示", "未填 DASHSCOPE_WORKSPACE_ID，使用通用域名；官方推荐业务空间专属域名")
    else:
        from mock import MockHttp
        http = MockHttp()
        kit.say("设备", "连接本地 mock 云端（按官方响应结构回放，不联网）")

    results: list[DayResult] = []
    try:
        for path in args.day or SAMPLES:
            results.append(run_day(http, cfg, args, path, model, speak))
    except kit.HttpError as exc:
        sys.exit(f"[云端] {exc}")
    except KeyboardInterrupt:
        sys.exit(1)

    note = f"{len(results)} 份日报均值；首字=数据同步完成→日报首个 token"
    if speak:
        note += "；含抬腕播报"
    kit.finish(cfg, args, DEMO_DIR, models=models, first_ms=results[0].first_ms,
               cost=sum(r.cost(cfg.region) for r in results) / len(results),
               sample=" + ".join(r.name for r in results), note=note)


if __name__ == "__main__":
    main()
