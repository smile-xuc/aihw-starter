#!/usr/bin/env python3
"""07 录音卡 / 会议盒子 · 百炼录音纪要参考 demo

模拟一张 AI 录音卡：会后把录音交给云端，拿回「谁说了什么」和结构化纪要。
  录音（WAV / MP3 文件或麦克风）
  → 转写 + 说话人分离：qwen-audio-3.1-asr-flash（同步，≤5 分钟本地文件）
                       或 qwen-audio-3.1-asr-flash-filetrans（异步，公网 URL，≤12 小时）
  → 纪要：qwen3.8-flash（OpenAI 兼容，流式 JSON）
  → 手机 App 纪要卡片：out/minutes.md + out/minutes.json + out/transcript.txt

一条命令：
  python3 run.py           有 DASHSCOPE_API_KEY 就真跑；没有就自动 mock
  python3 run.py --mock    强制离线 mock（CI 冒烟用）

只用标准库。接口以官方文档为准：https://help.aliyun.com/zh/model-studio/non-realtime-speech-recognition-user-guide
"""
from __future__ import annotations

import argparse
import base64
import json
import re
import sys
import time
import wave
from dataclasses import dataclass, field
from pathlib import Path

import demo_kit as kit

DEMO_DIR = Path(__file__).resolve().parent
ASR_MODEL = "qwen-audio-3.1-asr-flash"                  # 同步：本地文件 Base64，≤5 分钟，编码后 ≤10 MB
ASR_FILE_MODEL = "qwen-audio-3.1-asr-flash-filetrans"   # 异步：公网 URL，≤12 小时
LLM_MODEL = "qwen3.8-flash"
SAMPLE_AUDIO = DEMO_DIR / "samples" / "meeting.mp3"
MAX_BASE64_BYTES = 10 * 1024 * 1024
AUDIO_TYPES = {".wav": ("wav", "audio/wav"), ".mp3": ("mp3", "audio/mpeg")}
POLL_SECONDS, POLL_TIMEOUT = 2, 600

# 元 / 百万 Token。来源：https://help.aliyun.com/zh/model-studio/model-pricing（查证 2026-10-01）
# qwen-audio-3.1-asr-flash(-filetrans) 与 qwen3.8-flash 同价；音频按每秒 25 Token 折算。
PRICES = {
    "cn-beijing": {"in": 0.8, "out": 2.7},
    "ap-southeast-1": {"in": 1.094, "out": 3.427},
}

MINUTES_PROMPT = """你是会议纪要助手。输入是录音转写稿，每行格式为「[分:秒] 说话人N：内容」。
只依据转写稿，输出一个 JSON 对象，不要输出其他文字：
{"title": "会议主题，20 字以内",
 "summary": "两三句话的会议摘要",
 "agenda": ["议题"],
 "decisions": [{"content": "已拍板的事项", "owner": "说话人N 或 未指定"}],
 "action_items": [{"task": "待办", "owner": "说话人N", "due": "期限，没有就写空字符串"}],
 "open_questions": ["待定 / 未决事项"],
 "risks": ["风险"]}
规则：
- 决策只收「定了 / 敲定 / 就这么办」这类明确结论；问句和建议不算
- 待办要有动作和责任人；期限照抄原话（如「周五前」），不要换算成日期
- 不编造转写稿里没有的人名、数字和日期；转写有明显错字时按上下文理解，但不改数字"""


@dataclass
class Sentence:
    begin_ms: int
    end_ms: int
    speaker: str
    text: str

    def line(self) -> str:
        m, s = divmod(self.begin_ms // 1000, 60)
        return f"[{m:02d}:{s:02d}] {self.speaker}：{self.text}"


@dataclass
class Stats:
    asr_ms: float = 0.0
    llm_first_ms: float | None = None   # 发出纪要请求 → 首个 token
    llm_first_at: float | None = None   # 首个 token 到达的时刻（kit.now_ms 时间轴）
    asr_tokens: tuple[int, int] = (0, 0)
    llm_tokens: tuple[int, int] = (0, 0)
    asr_estimated: bool = False
    notes: list[str] = field(default_factory=list)

    def cost(self, region: str) -> tuple[float, float]:
        p = PRICES[region]
        asr = (self.asr_tokens[0] * p["in"] + self.asr_tokens[1] * p["out"]) / 1e6
        llm = (self.llm_tokens[0] * p["in"] + self.llm_tokens[1] * p["out"]) / 1e6
        return asr, llm


def speaker_label(raw) -> str:
    return "说话人" if raw is None else f"说话人{int(raw) + 1}"


def to_sentences(items: list[dict]) -> list[Sentence]:
    out = []
    for item in items:
        text = (item.get("text") or "").strip()
        if text:
            out.append(Sentence(int(item.get("begin_time") or 0), int(item.get("end_time") or 0),
                                speaker_label(item.get("speaker_id")), text))
    return out


# ───────────────────────── 转写 ─────────────────────────

def transcribe_local(http, cfg: kit.Config, audio: Path, stats: Stats) -> list[Sentence]:
    """同步转写：本地文件转 Base64 Data URI，开启说话人分离。"""
    suffix = audio.suffix.lower()
    if suffix not in AUDIO_TYPES:
        sys.exit(f"{audio.name}：同步转写只演示 WAV / MP3。转换：ffmpeg -i in{suffix} -ac 1 -ar 16000 out.mp3")
    fmt, mime = AUDIO_TYPES[suffix]
    data = base64.b64encode(audio.read_bytes()).decode()
    if len(data) > MAX_BASE64_BYTES:
        sys.exit(f"{audio.name}：Base64 后超过 10 MB。长录音请上传到 OSS 等公网地址，改用 --audio-url")
    parameters = {"format": fmt, "speaker_diarization_enabled": True}
    if fmt == "wav":
        with wave.open(str(audio), "rb") as w:
            parameters["sample_rate"] = str(w.getframerate())
    payload = {
        "model": ASR_MODEL,
        "input": {"messages": [{"role": "user", "content": [
            {"type": "input_audio", "input_audio": {"data": f"data:{mime};base64,{data}"}}]}]},
        "parameters": parameters,
    }
    kit.say("云端", f"转写 {ASR_MODEL}（同步 · 说话人分离）……")
    t0 = kit.now_ms()
    resp = http.json("POST", f"{cfg.api_base()}/services/aigc/multimodal-generation/generation",
                     cfg.headers(**{"X-DashScope-SSE": "disable"}), payload, timeout=300)
    stats.asr_ms = kit.now_ms() - t0
    output = resp.get("output") or {}
    if "sentences" not in output and isinstance(output.get("output"), dict):
        output = output["output"]  # 官方指南提到的另一种嵌套结构
    items = output.get("sentences") or ([output["sentence"]] if output.get("sentence") else [])
    usage = resp.get("usage") or {}
    stats.asr_tokens = (int(usage.get("input_tokens") or 0), int(usage.get("output_tokens") or 0))
    if not any(stats.asr_tokens):
        stats.asr_tokens = (int(usage.get("duration") or 0) * 25, len(output.get("text") or ""))
        stats.asr_estimated = True
    return to_sentences(items)


def transcribe_url(http, cfg: kit.Config, url: str, speakers: int | None, stats: Stats) -> list[Sentence]:
    """异步转写：公网 URL → 提交任务 → 轮询 → 下载 transcription_url。"""
    parameters: dict = {"channel_id": [0], "diarization_enabled": True}
    if speakers:
        parameters["speaker_count"] = speakers
    payload = {"model": ASR_FILE_MODEL, "input": {"file_urls": [url]}, "parameters": parameters}
    kit.say("云端", f"转写 {ASR_FILE_MODEL}（异步任务 · 说话人分离）……")
    t0 = kit.now_ms()
    submit = http.json("POST", f"{cfg.api_base()}/services/audio/asr/transcription",
                       cfg.headers(**{"X-DashScope-Async": "enable"}), payload)
    task_id = (submit.get("output") or {}).get("task_id")
    if not task_id:
        raise kit.HttpError(f"提交转写任务失败：{json.dumps(submit, ensure_ascii=False)[:300]}")
    kit.say("云端", f"任务 {task_id} 已提交，轮询中")
    deadline = time.monotonic() + POLL_TIMEOUT
    while True:
        task = http.json("GET", f"{cfg.api_base()}/tasks/{task_id}", cfg.headers())
        output = task.get("output") or {}
        status = output.get("task_status")
        if status == "SUCCEEDED":
            break
        if status in ("FAILED", "UNKNOWN", "CANCELED") or time.monotonic() > deadline:
            raise kit.HttpError(f"转写任务 {status or '超时'}：{json.dumps(output, ensure_ascii=False)[:300]}")
        time.sleep(POLL_SECONDS if cfg.live else 0)
    results = output.get("results") or ([output["result"]] if output.get("result") else [])
    if not results or results[0].get("subtask_status", "SUCCEEDED") != "SUCCEEDED":
        raise kit.HttpError(f"子任务失败：{json.dumps(results, ensure_ascii=False)[:300]}")
    result = json.loads(http.get_bytes(results[0]["transcription_url"]).decode("utf-8"))
    stats.asr_ms = kit.now_ms() - t0
    items = [s for t in result.get("transcripts") or [] for s in t.get("sentences") or []]
    usage = task.get("usage") or {}
    stats.asr_tokens = (int(usage.get("input_tokens") or 0), int(usage.get("output_tokens") or 0))
    if not any(stats.asr_tokens):
        duration_ms = int((result.get("properties") or {}).get("original_duration_in_milliseconds") or 0)
        stats.asr_tokens = (duration_ms * 25 // 1000, sum(len(s.get("text") or "") for s in items))
        stats.asr_estimated = True
    return to_sentences(items)


# ───────────────────────── 纪要 ─────────────────────────

def summarize(http, cfg: kit.Config, transcript: str, stats: Stats) -> dict:
    payload = {
        "model": LLM_MODEL,
        "messages": [{"role": "system", "content": MINUTES_PROMPT}, {"role": "user", "content": transcript}],
        "stream": True,
        "stream_options": {"include_usage": True},
        "response_format": {"type": "json_object"},
        "enable_thinking": False,
    }
    kit.say("云端", f"纪要 {LLM_MODEL}（流式）……")
    t0 = kit.now_ms()
    chunks: list[str] = []
    for event in http.sse(f"{cfg.compatible_base()}/chat/completions", cfg.headers(), payload):
        for choice in event.get("choices") or []:
            delta = (choice.get("delta") or {}).get("content") or ""
            if delta and stats.llm_first_at is None:
                stats.llm_first_at = kit.now_ms()
                stats.llm_first_ms = stats.llm_first_at - t0
            chunks.append(delta)
        if event.get("usage"):
            u = event["usage"]
            stats.llm_tokens = (int(u.get("prompt_tokens") or 0), int(u.get("completion_tokens") or 0))
    text = "".join(chunks).strip()
    text = re.sub(r"^```(?:json)?\s*|\s*```$", "", text)
    try:
        return json.loads(text)
    except json.JSONDecodeError as exc:
        raise kit.HttpError(f"纪要不是合法 JSON（{exc}）：{text[:200]}") from None


def render(minutes: dict, speakers: int, seconds: float) -> str:
    def bullet(items, fmt):
        return [f"- {fmt(i)}" for i in items] or ["- （无）"]

    lines = [f"# {minutes.get('title') or '会议纪要'}", "",
             f"> 录音 {seconds:.0f} 秒 · {speakers} 位说话人 · 由 {ASR_MODEL} + {LLM_MODEL} 生成，请人工核对", "",
             minutes.get("summary") or "", "", "## 议题"]
    lines += bullet(minutes.get("agenda") or [], str)
    lines += ["", "## 决策"]
    lines += bullet(minutes.get("decisions") or [], lambda d: f"{d.get('content', '')}（{d.get('owner') or '未指定'}）")
    lines += ["", "## 待办"]
    lines += bullet(minutes.get("action_items") or [],
                    lambda a: f"[ ] {a.get('task', '')} · {a.get('owner') or '未指定'}"
                              + (f" · {a['due']}" if a.get("due") else ""))
    lines += ["", "## 待定"]
    lines += bullet(minutes.get("open_questions") or [], str)
    lines += ["", "## 风险"]
    lines += bullet(minutes.get("risks") or [], str)
    return "\n".join(lines) + "\n"


# ───────────────────────── 设备模拟 ─────────────────────────

def capture(args: argparse.Namespace) -> tuple[Path | None, str, float]:
    """返回（本地音频路径或 None, 输入描述, 时长秒）。"""
    if args.audio_url:
        kit.say("设备", "录音卡已把录音传到公网存储（--audio-url），只把地址交给云端")
        return None, "公网 URL", 0.0
    if args.mic:
        kit.say("设备", "录音卡 · 按下录音键（灯光：红色呼吸）")
        if args.seconds:
            kit.say("设备", f"录音 {args.seconds:.0f} 秒……")
        pcm = kit.record_mic(16000, args.seconds)
        path = DEMO_DIR / "out" / "mic.wav"
        kit.write_wav(path, pcm, 16000)
        seconds = kit.pcm_seconds(pcm, 16000)
        kit.say("设备", f"录音结束 → {path.relative_to(DEMO_DIR)}（{seconds:.1f} s）")
        return path, "麦克风", seconds
    path = args.audio
    if not path.is_file():
        sys.exit(f"找不到录音文件：{path}")
    seconds = 0.0
    meta = path.with_suffix(".json")
    if path.suffix.lower() == ".wav":
        with wave.open(str(path), "rb") as w:
            seconds = w.getnframes() / w.getframerate()
    elif meta.is_file():
        seconds = json.loads(meta.read_text(encoding="utf-8")).get("duration_ms", 0) / 1000
    kit.say("设备", f"录音卡 · 会议录音 ← {path.name}（{seconds:.1f} s，{path.stat().st_size // 1024} KB）")
    kit.say("设备", "录音结束 → 经手机 App 上传云端")
    return path, path.name, seconds


def main() -> None:
    ap = argparse.ArgumentParser(description="07 录音卡 / 会议盒子 · 百炼录音纪要参考 demo")
    kit.add_standard_args(ap)
    ap.add_argument("--audio", type=Path, default=SAMPLE_AUDIO, help="本地录音（WAV / MP3，≤5 分钟）")
    ap.add_argument("--audio-url", help="公网可访问的录音 URL（长录音，走异步 filetrans）")
    ap.add_argument("--mic", action="store_true", help="用麦克风录一段（回车结束，或配合 --seconds）")
    ap.add_argument("--seconds", type=float, help="--mic 时的录音时长")
    ap.add_argument("--speakers", type=int, help="说话人数量参考值（仅 --audio-url，2–100）")
    args = ap.parse_args()

    cfg = kit.resolve(args, DEMO_DIR)
    models = [ASR_FILE_MODEL if args.audio_url else ASR_MODEL, LLM_MODEL]
    kit.banner("07 录音卡 / 会议盒子 · 百炼录音纪要参考 demo", cfg, models)
    if cfg.live:
        http = kit.HttpTransport()
        if not cfg.workspace_id:
            kit.say("提示", "未填 DASHSCOPE_WORKSPACE_ID，使用通用域名；官方推荐业务空间专属域名")
    else:
        from mock import MockHttp
        http = MockHttp(DEMO_DIR / "samples" / "meeting.json")
        kit.say("设备", "连接本地 mock 云端（回放 samples/meeting.json，不联网）")

    stats = Stats()
    try:
        path, source, seconds = capture(args)
        t_end = kit.now_ms()
        if path is None:
            sentences = transcribe_url(http, cfg, args.audio_url, args.speakers, stats)
        else:
            sentences = transcribe_local(http, cfg, path, stats)
        if not sentences:
            sys.exit("[云端] 转写结果为空：检查录音是否有人声")
        speakers = len({s.speaker for s in sentences})
        asr_time = f"{stats.asr_ms / 1000:.1f} s" if cfg.live else "mock 不计时"
        kit.say("云端", f"转写完成 · {len(sentences)} 句 · {speakers} 位说话人 · {asr_time}")
        for sentence in sentences:
            print("        " + sentence.line())
        transcript = "\n".join(s.line() for s in sentences)
        seconds = seconds or sentences[-1].end_ms / 1000
        minutes = summarize(http, cfg, transcript, stats)
        first_ms = None if stats.llm_first_at is None else stats.llm_first_at - t_end
    except kit.HttpError as exc:
        sys.exit(f"[云端] {exc}")
    except KeyboardInterrupt:
        sys.exit(1)

    out = DEMO_DIR / "out"
    out.mkdir(exist_ok=True)
    markdown = render(minutes, speakers, seconds)
    (out / "transcript.txt").write_text(transcript + "\n", encoding="utf-8")
    (out / "minutes.json").write_text(json.dumps(minutes, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (out / "minutes.md").write_text(markdown, encoding="utf-8")
    llm_first = f"{stats.llm_first_ms:.0f} ms" if cfg.live and stats.llm_first_ms is not None else "—（mock 不计时）"
    kit.say("云端", f"纪要完成 · 首字 {llm_first} · {len(minutes.get('action_items') or [])} 条待办")
    kit.say("App", "推送纪要卡片 → out/minutes.md（另存 minutes.json、transcript.txt）")
    print("\n" + "\n".join("        " + ln if ln else "" for ln in markdown.strip().splitlines()) + "\n")

    asr_cost, llm_cost = stats.cost(cfg.region)
    estimated = "（转写用量按时长估算）" if stats.asr_estimated else ""
    total = f"{first_ms / 1000:.1f} s" if cfg.live and first_ms is not None else "—（mock 不计时）"
    kit.say("统计", f"录音结束 → 纪要首字 {total} · ¥{kit.fmt_cny(asr_cost + llm_cost)}"
                    f"（转写 ¥{kit.fmt_cny(asr_cost)} + 纪要 ¥{kit.fmt_cny(llm_cost)}）{estimated}")
    note = "首字=录音结束→纪要首字"
    if cfg.live:
        note += f"；转写 {stats.asr_ms / 1000:.1f} s"
    kit.finish(cfg, args, DEMO_DIR, models=models, first_ms=first_ms, cost=asr_cost + llm_cost,
               sample=f"{source}（{seconds:.0f} s）", note=note + estimated)


if __name__ == "__main__":
    main()
