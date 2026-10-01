#!/usr/bin/env python3
"""06 AI 耳机 · 百炼实时同传参考 demo

模拟一副同传耳机：外宾戴着耳机听中文讲解，耳机边听边出英文字幕和英文译音。
  耳机麦克风收到的中文讲话（WAV 按 100 ms 一包、按实时节奏推流，或电脑麦克风）
  → qwen3.8-livetranslate-flash-realtime（WebSocket，业务空间专属域名；默认 speaker_detection 断句并区分说话人）
  → 英文字幕增量 + 英文译音（扬声器或 WAV）；原文识别结果同步返回

一条命令：
  python3 run.py           有 DASHSCOPE_API_KEY 就真跑；没有就自动 mock
  python3 run.py --mock    强制离线 mock（CI 冒烟用）

常用参数见 README.md；协议以官方文档为准：https://help.aliyun.com/zh/model-studio/qwen3-5-livetranslate-flash-realtime
"""
from __future__ import annotations

import argparse
import base64
import json
import queue
import sys
import threading
import time
from dataclasses import dataclass, field
from pathlib import Path

import demo_kit as kit

DEMO_DIR = Path(__file__).resolve().parent
OUT_DIR = DEMO_DIR / "out"
MODEL = "qwen3.8-livetranslate-flash-realtime"
IN_RATE = 16000                          # 官方默认输入：16 kHz 单声道 PCM
DEFAULT_OUT_RATE = 24000                 # 官方默认输出：24 kHz PCM，以 session.updated 返回为准
CHUNK_MS = 100
CHUNK_BYTES = IN_RATE * 2 * CHUNK_MS // 1000
MOCK_SPEEDUP = 10                        # mock 不必等实时节奏，10 倍速推流
FINISH_TIMEOUT = 30                      # 发出 session.finish 后最多等多久（秒）
SAMPLE_AUDIO = DEMO_DIR / "samples" / "expo_guide_zh.wav"
# 支持「音频 + 文本」输出的目标语种；其余语种只能出字幕（使用指南「支持的语种」）
AUDIO_LANGS = {"zh", "en", "ar", "de", "fr", "es", "pt", "id", "it", "ko", "ru", "th", "vi", "ja", "tr", "hi", "ms",
               "nl", "ur", "nb", "sv", "da", "he", "fi", "pl", "is", "cs", "fil", "fa"}

# 元 / 百万 Token（查证 2026-10-01）：https://help.aliyun.com/zh/model-studio/qwen3-8-livetranslate-flash-realtime
# 音频按输入 7、输出 12.5 Token / 秒折算（使用指南「计费说明」）；模型页没有文本输入单价，非音频输入按图片输入单价计。
PRICES = {
    "cn-beijing": {"audio_in": 40.0, "other_in": 3.3, "text_out": 100.0, "audio_out": 160.0},
    "ap-southeast-1": {"audio_in": 54.688, "other_in": 4.01, "text_out": 145.835, "audio_out": 218.752},
}


class RealtimeError(RuntimeError):
    pass


class WsTransport:
    """live：websocket-client 直连 Realtime（耳机或手机 App 里同样是一条 WebSocket）。"""

    def __init__(self, url: str, headers: dict):
        try:
            import websocket  # websocket-client
        except ImportError:
            sys.exit("live 模式需要 websocket-client：pip install -r requirements.txt")
        self._timeout = websocket.WebSocketTimeoutException
        try:
            self.ws = websocket.create_connection(url, header=[f"{k}: {v}" for k, v in headers.items()], timeout=30)
        except (websocket.WebSocketException, OSError) as exc:
            sys.exit(f"[云端] 连接失败：{exc}（401 / 403 多为 Key、业务空间与地域不一致）")

    def send(self, event: dict) -> None:
        self.ws.send(json.dumps(event, ensure_ascii=False))

    def recv(self, timeout: float = 1.0) -> dict | None:
        """收一条服务端事件；timeout 秒内没有消息返回 None（推流期间允许长时间安静）。"""
        self.ws.settimeout(timeout)
        try:
            return json.loads(self.ws.recv())
        except self._timeout:
            return None

    def close(self) -> None:
        try:
            self.ws.close(timeout=1)
        except Exception:  # noqa: BLE001 — 关连接失败不影响结果
            pass


@dataclass
class Usage:
    audio_in: int = 0
    other_in: int = 0
    text_out: int = 0
    audio_out: int = 0

    def add(self, usage: dict) -> None:
        din = usage.get("input_tokens_details") or {}
        dout = usage.get("output_tokens_details") or {}
        audio_in = int(din.get("audio_tokens") or 0)
        self.audio_in += audio_in
        self.other_in += int(usage.get("input_tokens") or 0) - audio_in
        self.text_out += int(dout.get("text_tokens") or 0)
        self.audio_out += int(dout.get("audio_tokens") or 0)

    def cost(self, region: str) -> float:
        p = PRICES[region]
        return (self.audio_in * p["audio_in"] + self.other_in * p["other_in"]
                + self.text_out * p["text_out"] + self.audio_out * p["audio_out"]) / 1e6

    @property
    def tokens(self) -> str:
        return f"输入 {self.audio_in + self.other_in} / 输出 {self.text_out + self.audio_out} Token"


@dataclass
class Segment:
    """一句话：原文识别项（item_id）与它对应的译文项（previous_item_id 指回原文）。"""
    speaker: str = ""
    start_ms: int | None = None
    source: str = ""
    translation: str = ""
    first_at: float | None = None        # 该句首个译文到达的时刻（kit.now_ms 时间轴）


@dataclass
class Stats:
    first_text_ms: float | None = None   # 首包音频发出 → 首条译文字幕
    first_audio_ms: float | None = None  # 首包音频发出 → 首包译音
    responses: int = 0
    audio: bytearray = field(default_factory=bytearray)
    usage: Usage = field(default_factory=Usage)


class Earphone:
    """耳机本体：播放译音（独立线程写声卡，不拖慢收发）。量产时把 play() 换成蓝牙 / I2S 音频输出。"""

    def __init__(self, play: bool, rate: int):
        self.speaker = None
        self._pending: queue.Queue[bytes | None] = queue.Queue()
        self._thread: threading.Thread | None = None
        if play:
            try:
                import sounddevice as sd
                self.speaker = sd.RawOutputStream(samplerate=rate, channels=1, dtype="int16")
                self.speaker.start()
            except Exception:  # noqa: BLE001 — 没有声卡 / 未装依赖时只写 WAV
                self.speaker = None
                return
            self._thread = threading.Thread(target=self._drain, daemon=True)
            self._thread.start()

    def _drain(self) -> None:
        while (pcm := self._pending.get()) is not None:
            self.speaker.write(pcm)

    def play(self, pcm: bytes) -> None:
        if self.speaker:
            self._pending.put(pcm)

    def close(self) -> None:
        if self.speaker:
            self._pending.put(None)
            self._thread.join(timeout=30)  # 等已收到的译音播完
            self.speaker.stop()
            self.speaker.close()


class FileSource:
    """WAV 文件当耳机麦克风：按实时节奏（mock 时加速）每 100 ms 放出一包。"""

    def __init__(self, pcm: bytes, pace: float):
        self.chunks = [pcm[offset:offset + CHUNK_BYTES] for offset in range(0, len(pcm), CHUNK_BYTES)]
        self.step = CHUNK_MS / 1000 * pace
        self.index = 0
        self.due: float | None = None

    def poll(self) -> bytes | None:
        """到点返回下一包；没到点返回 None；放完返回 b""。"""
        now = time.perf_counter()
        if self.due is None:
            self.due = now
        if self.index >= len(self.chunks):
            return b""
        if now < self.due:
            return None
        self.index += 1
        self.due += self.step
        return self.chunks[self.index - 1]

    def wait(self) -> float:
        return max(0.0, (self.due or 0.0) - time.perf_counter())

    def close(self) -> None:
        pass


class MicSource:
    """电脑麦克风当耳机麦克风：声卡回调每 100 ms 放一包进队列；按回车或到 seconds 结束。"""

    def __init__(self, seconds: float | None):
        try:
            import sounddevice as sd
        except ImportError:
            sys.exit("麦克风需要可选依赖 sounddevice：pip install -r requirements-device.txt")
        self.blocks: queue.Queue[bytes] = queue.Queue()
        self.stop = threading.Event()
        self.deadline = time.monotonic() + seconds if seconds else None
        if not seconds:
            threading.Thread(target=lambda: (input(), self.stop.set()), daemon=True).start()
        self.stream = sd.RawInputStream(samplerate=IN_RATE, channels=1, dtype="int16", blocksize=CHUNK_BYTES // 2,
                                        callback=lambda data, frames, t, status: self.blocks.put(bytes(data)))
        self.stream.start()

    def poll(self) -> bytes | None:
        ended = self.stop.is_set() or (self.deadline is not None and time.monotonic() >= self.deadline)
        try:
            return self.blocks.get_nowait()
        except queue.Empty:
            if ended:
                self.close()
                return b""
            return None

    def wait(self) -> float:
        return 0.02

    def close(self) -> None:
        if self.stream.active:
            self.stream.stop()
        self.stream.close()


class Listener:
    """收发都在这一个线程里，按 100 ms 节拍交替：到点发一包音频，其余时间收服务端事件。
    同一条 TLS 连接不能一个线程收、另一个线程同时发（OpenSSL 连接对象不是线程安全的）。"""

    def __init__(self, transport, earphone: Earphone):
        self.t = transport
        self.earphone = earphone
        self.stats = Stats()
        self.segments: dict[str, Segment] = {}
        self.translation_of: dict[str, str] = {}   # 译文项 id → 原文项 id
        self.speakers: dict[object, str] = {}
        self.t0: float | None = None               # 首包音频发出的时刻
        self.sent_ms = 0.0
        self.finished_at: float | None = None
        self._line: str | None = None              # 正在打印的字幕属于哪个译文项

    def _newline(self) -> None:
        if self._line is not None:
            print(flush=True)
            self._line = None

    def _label(self, seg: Segment) -> str:
        return f"（{seg.speaker}）" if seg.speaker else ""

    def _segment_for(self, item_id: str) -> Segment:
        source_id = self.translation_of.get(item_id) or item_id
        return self.segments.setdefault(source_id, Segment())

    def run(self, source) -> Stats:
        try:
            while True:
                if self.finished_at is None:
                    self._push(source)
                # 收事件的等待时间就是离下一包到点还有多久，推流节奏因此不受收事件影响
                event = self.t.recv(max(0.005, source.wait()) if self.finished_at is None else 1.0)
                if event is None:
                    if self.finished_at and time.monotonic() - self.finished_at > FINISH_TIMEOUT:
                        raise RealtimeError(f"发出 session.finish 后 {FINISH_TIMEOUT} 秒仍未收到 session.finished")
                    continue
                if self.handle(event):
                    return self.stats
        finally:
            source.close()

    def _push(self, source) -> None:
        """把已经到点的音频包发出去；讲完时发 session.finish。"""
        while (chunk := source.poll()) is not None:
            if not chunk:
                self.t.send({"type": "session.finish"})  # 不发它，最后一句的识别和翻译会丢
                self.finished_at = time.monotonic()
                self._newline()
                kit.say("设备", f"讲话结束（共推流 {self.sent_ms / 1000:.1f} s）→ session.finish，等待最后一句")
                return
            self.t.send({"type": "input_audio_buffer.append", "audio": base64.b64encode(chunk).decode()})
            if self.t0 is None:
                self.t0 = kit.now_ms()
            self.sent_ms += len(chunk) / (IN_RATE * 2 / 1000)

    def handle(self, event: dict) -> bool:
        kind = event.get("type", "")
        if kind == "error":
            self._newline()
            raise RealtimeError(json.dumps(event.get("error", event), ensure_ascii=False))
        if kind == "input_audio_buffer.speech_started":
            seg = self.segments.setdefault(event.get("item_id", ""), Segment())
            seg.start_ms = event.get("audio_start_ms")
            if event.get("speaker_id") is not None:  # speaker_detection 模式下返回
                seg.speaker = self.speakers.setdefault(event["speaker_id"], f"说话人{len(self.speakers) + 1}")
        elif kind == "conversation.item.input_audio_transcription.completed":
            seg = self.segments.setdefault(event.get("item_id", ""), Segment())
            seg.source = event.get("transcript", "")
            self._newline()
            kit.say("云端", f"原文{self._label(seg)}：{seg.source}")
        elif kind == "conversation.item.input_audio_transcription.failed":
            self._newline()
            kit.say("云端", f"原文识别失败：{json.dumps(event.get('error'), ensure_ascii=False)}")
        elif kind == "conversation.item.created":
            item = event.get("item") or {}
            if item.get("role") == "assistant" and event.get("previous_item_id"):
                self.translation_of[item.get("id", "")] = event["previous_item_id"]
        elif kind in ("response.audio_transcript.delta", "response.text.delta"):
            now, item_id, delta = kit.now_ms(), event.get("item_id", ""), event.get("delta", "")
            seg = self._segment_for(item_id)
            if self.stats.first_text_ms is None and self.t0 is not None:
                self.stats.first_text_ms = now - self.t0
            if seg.first_at is None:
                seg.first_at = now
            if self._line != item_id:
                self._newline()
                print(f"[耳机] 字幕{self._label(seg)}：{'…' if seg.translation else ''}", end="")
                self._line = item_id
                if seg.translation:  # 被原文插行打断后的续接
                    delta = delta.lstrip()
            print(delta, end="", flush=True)
            seg.translation += delta
        elif kind == "response.audio.delta":
            pcm = base64.b64decode(event.get("delta", ""))
            if self.stats.first_audio_ms is None and self.t0 is not None:
                self.stats.first_audio_ms = kit.now_ms() - self.t0
            self.stats.audio.extend(pcm)
            self.earphone.play(pcm)
        elif kind == "response.done":
            self._newline()
            response = event.get("response") or {}
            self.stats.usage.add(response.get("usage") or {})
            self.stats.responses += 1
            if response.get("status") not in (None, "completed"):
                kit.say("云端", f"本句状态：{response.get('status')}")
        elif kind == "session.finished":
            self._newline()
            return True
        return False

    def lags(self) -> list[float]:
        """同传时延：该句开口（audio_start_ms 对应的推流时刻）→ 该句首个译文。"""
        t0 = self.t0
        return [s.first_at - (t0 + s.start_ms) for s in self.segments.values()
                if t0 is not None and s.first_at is not None and s.start_ms is not None]


# ───────────────────────── 会话 ─────────────────────────

def configure(transport, target: str, text_only: bool, phrases: dict) -> dict:
    while True:
        event = transport.recv(30)
        if event is None:
            raise RealtimeError("30 秒内没有收到 session.created")
        if event.get("type") == "error":
            raise RealtimeError(json.dumps(event.get("error", event), ensure_ascii=False))
        if event.get("type") == "session.created":
            break
    translation: dict = {"language": target}
    if phrases:
        translation["corpus"] = {"phrases": phrases}
    transport.send({"type": "session.update", "session": {
        "output_modalities": ["text"] if text_only else ["text", "audio"],
        "translation": translation,
    }})
    while True:
        event = transport.recv(30)
        if event is None:
            raise RealtimeError("30 秒内没有收到 session.updated")
        if event.get("type") == "error":
            raise RealtimeError(json.dumps(event.get("error", event), ensure_ascii=False))
        if event.get("type") == "session.updated":
            return event.get("session") or {}


def write_subtitles(path: Path, segments: dict[str, Segment]) -> int:
    rows = [s for s in segments.values() if s.source or s.translation]
    rows.sort(key=lambda s: s.start_ms if s.start_ms is not None else 1 << 30)
    lines = []
    for seg in rows:
        m, s = divmod((seg.start_ms or 0) // 1000, 60)
        lines += [f"[{m:02d}:{s:02d}] {seg.speaker or '说话人'}", seg.source, seg.translation.strip(), ""]
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("\n".join(lines), encoding="utf-8")
    return len(rows)


def main() -> None:
    ap = argparse.ArgumentParser(description="06 AI 耳机 · 百炼实时同传参考 demo")
    kit.add_standard_args(ap)
    ap.add_argument("--audio", type=Path, default=SAMPLE_AUDIO, help="耳机听到的讲话（WAV）；默认 samples/expo_guide_zh.wav")
    ap.add_argument("--mic", action="store_true", help="用麦克风边说边译；回车结束，或配合 --seconds")
    ap.add_argument("--seconds", type=float, help="--mic 时的收音时长")
    ap.add_argument("--target", default="en", help="目标语种代码，默认 en；可选值见 README")
    ap.add_argument("--text-only", action="store_true", help="只出字幕、不要译音（更省钱）")
    ap.add_argument("--phrase", action="append", default=[], metavar="源词=译词",
                    help="热词，可重复，如 --phrase 降噪=noise cancellation")
    ap.add_argument("--no-play", action="store_true", help="不播放，只把译音写成 WAV")
    args = ap.parse_args()
    phrases = dict(p.split("=", 1) for p in args.phrase if "=" in p)

    cfg = kit.resolve(args, DEMO_DIR, need_workspace=True)
    kit.banner("06 AI 耳机 · 百炼实时同传参考 demo", cfg, [MODEL])
    text_only = args.text_only
    if not text_only and args.target not in AUDIO_LANGS:
        text_only = True
        kit.say("设备", f"目标语种 {args.target} 只支持文字输出，自动切换为只出字幕")

    pcm = b""
    if args.mic:
        sample = "麦克风"
        start_note = "耳机麦克风开始收音，边说边译" + ("" if args.seconds else "（按回车结束）")
    else:
        pcm = kit.read_wav(args.audio, IN_RATE)
        sample = f"{args.audio.name}（{kit.pcm_seconds(pcm, IN_RATE):.0f} s）"
        start_note = (f"耳机麦克风 ← {args.audio.name}（{kit.pcm_seconds(pcm, IN_RATE):.1f} s），"
                      f"按 {CHUNK_MS} ms 一包{'实时' if cfg.live else f' {MOCK_SPEEDUP} 倍速'}推流")

    if cfg.live:
        host = kit.REGIONS[cfg.region]["workspace_host"].format(workspace="<业务空间>")
        kit.say("设备", f"连接 wss://{host}/api-ws/v1/realtime …")
        transport = WsTransport(cfg.realtime_url(MODEL), cfg.headers())
    else:
        from mock import MockLiveTranslate
        kit.say("设备", "连接本地 mock 云端（按官方事件顺序回放，不联网）")
        transport = MockLiveTranslate()

    earphone = None
    try:
        session = configure(transport, args.target, text_only, phrases)
        audio_cfg = session.get("audio") or {}
        out_rate = int(((audio_cfg.get("output") or {}).get("format") or {}).get("sample_rate") or DEFAULT_OUT_RATE)
        detection = ((audio_cfg.get("input") or {}).get("turn_detection") or {}).get("type") or "默认"
        voice = (audio_cfg.get("output") or {}).get("voice") or "默认"
        mode = "只出字幕" if text_only else f"字幕 + 译音（{out_rate // 1000} kHz · 音色 {voice}）"
        kit.say("云端", f"会话就绪：自动识别源语种 → {args.target} · {mode} · 断句 {detection}"
                        f"{f' · 热词 {len(phrases)} 个' if phrases else ''}")
        earphone = Earphone(play=cfg.live and not args.no_play and not text_only, rate=out_rate)
        listener = Listener(transport, earphone)
        kit.say("设备", start_note)
        source = MicSource(args.seconds) if args.mic else FileSource(pcm, 1.0 if cfg.live else 1 / MOCK_SPEEDUP)
        stats = listener.run(source)
    except RealtimeError as exc:
        sys.exit(f"[云端] 错误：{exc}")
    except KeyboardInterrupt:
        sys.exit(1)
    finally:
        transport.close()
        if earphone:
            earphone.close()

    count = write_subtitles(OUT_DIR / "subtitles.txt", listener.segments)
    kit.say("App", f"双语字幕 → out/subtitles.txt（{count} 句）")
    if stats.audio:
        wav = OUT_DIR / "translation.wav"
        kit.write_wav(wav, bytes(stats.audio), out_rate)
        kit.say("设备", f"耳机扬声器 → out/translation.wav（{kit.pcm_seconds(stats.audio, out_rate):.1f} s）"
                        f"{' · 已播放' if earphone and earphone.speaker else ''}")

    cost = stats.usage.cost(cfg.region)
    seconds = listener.sent_ms / 1000
    per_minute = cost / seconds * 60 if seconds else 0.0
    lags = listener.lags()
    if cfg.live:
        timing = (f"首条字幕 {stats.first_text_ms:.0f} ms" if stats.first_text_ms is not None else "首条字幕 —")
        if stats.first_audio_ms is not None:
            timing += f" · 首包译音 {stats.first_audio_ms:.0f} ms"
        if lags:
            timing += f" · 同传时延均值 {sum(lags) / len(lags) / 1000:.1f} s"
    else:
        timing = "时延 —（mock 不计时）"
    kit.say("统计", f"{timing} · {stats.responses} 句 · ¥{kit.fmt_cny(cost)}（{stats.usage.tokens}）"
                    f" · 折合每分钟 ¥{kit.fmt_cny(per_minute)}")
    note = f"首字=首包音频发出→首条译文字幕；{stats.responses} 句；折合每分钟 ¥{kit.fmt_cny(per_minute)}"
    if cfg.live and stats.first_audio_ms is not None:
        note += f"；首包译音 {stats.first_audio_ms:.0f} ms"
    if cfg.live and lags:
        note += f"；同传时延均值 {sum(lags) / len(lags) / 1000:.1f} s"
    if text_only:
        note += "；只出字幕"
    kit.finish(cfg, args, DEMO_DIR, models=[MODEL], first_ms=stats.first_text_ms, cost=cost,
               sample=sample, note=note)


if __name__ == "__main__":
    main()
