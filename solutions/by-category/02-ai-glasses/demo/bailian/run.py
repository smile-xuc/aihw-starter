#!/usr/bin/env python3
"""02 AI 眼镜 · 百炼「一看即懂」参考 demo

模拟一副带摄像头和耳机的 AI 眼镜：按住镜腿拍照并提问，松开后耳机播报回答。
默认（拍照即问）：
  照片（JPG 或摄像头）+ 提问（WAV 或麦克风）
  → qwen3.8-omni-flash（OpenAI 兼容 Chat Completions：图片 + 音频一次输入，流式文字，关闭思考）
  → qwen-audio-3.0-tts-flash（实时语音合成 WebSocket：边收文字边合成）
  → 耳机（扬声器或 out/reply_N.wav）
--realtime（给 AI 打电话）：
  qwen3.8-omni-flash-realtime（WebSocket，按住说话，画面 1 帧/秒，语音直接回复）；
  session.video.input.representation_compact=normal 时画面 Token 约为 none 的 1/4

一条命令：
  python3 run.py           有 DASHSCOPE_API_KEY 就真跑；没有就自动 mock
  python3 run.py --mock    强制离线 mock（CI 冒烟用）

协议以官方文档为准：Qwen-Omni https://help.aliyun.com/zh/model-studio/qwen-omni ·
实时语音合成 https://help.aliyun.com/zh/model-studio/cosyvoice-websocket-api ·
Realtime https://help.aliyun.com/zh/model-studio/realtime
"""
from __future__ import annotations

import argparse
import base64
import io
import json
import sys
import threading
import uuid
import wave
from dataclasses import dataclass, field
from pathlib import Path

import demo_kit as kit

DEMO_DIR = Path(__file__).resolve().parent
OMNI_MODEL = "qwen3.8-omni-flash"
TTS_MODEL = "qwen-audio-3.0-tts-flash"
REALTIME_MODEL = "qwen3.8-omni-flash-realtime"
ASR_MODEL = "qwen3-asr-flash-realtime"   # Realtime 内置输入转写，固定值
TTS_VOICE = "longanhuan_v3.6"            # qwen-audio-3.0-tts-flash 系统音色（中文普通话、英文）
REALTIME_VOICE = "Tina"                  # qwen3.8-omni-flash-realtime 默认音色
IN_RATE, OUT_RATE = 16000, 24000
CHUNK_BYTES = 3200                       # 100 ms @ 16 kHz / 16 bit
FRAME_EVERY = 10                         # --realtime：每 10 包音频（1 秒）推 1 帧画面
MAX_FRAME_BYTES = 190 * 1024             # Realtime：JPG 编码前 ≤190 KB（Base64 后 ≤256 KB）
MAX_PHOTO_BYTES = 7 * 1024 * 1024        # 拍照即问：保证 Base64 后 <10 MB
MAX_AUDIO_BASE64 = 10 * 1024 * 1024      # qwen3.8-omni-flash：音频 Base64 后 <10 MB
SAMPLE_IMAGE = DEMO_DIR / "samples" / "dish.jpg"
SAMPLE_AUDIO = DEMO_DIR / "samples" / "ask_dish.wav"

# 单价，查证 2026-10-01：
#   qwen3.8-omni-flash（元 / 百万 Token，文本、图片、音频输入同价）：https://help.aliyun.com/zh/model-studio/model-pricing
#   qwen-audio-3.0-tts-flash（元 / 万字符，一个汉字计 2 个字符）：同上「语音合成」一节
#   qwen3.8-omni-flash-realtime（元 / 百万 Token）：https://help.aliyun.com/zh/model-studio/qwen3-8-omni-flash-realtime
PRICES = {
    "cn-beijing": {"omni_in": 0.8, "omni_out": 2.7, "tts_per_10k_chars": 1.0,
                   "rt_audio_in": 6.0, "rt_other_in": 1.5, "rt_text_out": 4.5, "rt_audio_out": 12.0},
    "ap-southeast-1": {"omni_in": 1.094, "omni_out": 3.427, "tts_per_10k_chars": 1.12413,
                       "rt_audio_in": 6.781, "rt_other_in": 1.677, "rt_text_out": 5.104, "rt_audio_out": 13.636},
}

ASK_PROMPT = """你是一副 AI 眼镜的语音助手。用户按住镜腿拍下眼前的画面，并用语音提问（问题在音频里）。
结合画面回答：口语化中文，两三句话，先给结论，适合耳机播报；不用列表、Markdown 和表情符号。
画面里有人时不识别身份；看不清就直说，不要编造。"""

REALTIME_INSTRUCTIONS = """你是一副 AI 眼镜里的语音助手，能实时看到镜腿摄像头的画面（约 1 帧/秒）。
用口语化中文回答，每次两三句话，先给结论；画面和问题有关时结合画面回答。
不识别画面中人的身份；看不清就直说，不要编造。"""


class CloudError(RuntimeError):
    pass


def b64(data: bytes) -> str:
    return base64.b64encode(data).decode()


def tts_chars(text: str) -> int:
    """按价格页口径计费字符：一个汉字计 2 个字符，其他字符计 1 个。"""
    return sum(2 if "\u4e00" <= ch <= "\u9fff" else 1 for ch in text)


def need_websocket():
    try:
        import websocket  # websocket-client
    except ImportError:
        sys.exit("live 模式需要 websocket-client：pip install -r requirements.txt")
    return websocket


# ───────────────────────── 眼镜本体 ─────────────────────────

class Glasses:
    """眼镜本体：耳机放音。量产时把 speak() 换成蓝牙 / 开放式耳机的音频输出。"""

    def __init__(self, play: bool):
        self.speaker = None
        if play:
            try:
                import sounddevice as sd
                self.speaker = sd.RawOutputStream(samplerate=OUT_RATE, channels=1, dtype="int16")
                self.speaker.start()
            except Exception:  # noqa: BLE001 — 没有声卡 / 未装依赖时只写 WAV
                self.speaker = None

    def speak(self, pcm: bytes) -> None:
        if self.speaker:
            self.speaker.write(pcm)

    def close(self) -> None:
        if self.speaker:
            self.speaker.stop()
            self.speaker.close()


def load_jpeg(path: Path, limit: int) -> bytes:
    if path.suffix.lower() not in (".jpg", ".jpeg"):
        sys.exit(f"{path}：只收 JPG / JPEG（转换：ffmpeg -i in.png -q:v 4 out.jpg）")
    data = path.read_bytes()
    if len(data) > limit:
        sys.exit(f"{path}：{len(data) // 1024} KB 超过 {limit // 1024} KB，请缩到 640×480 左右")
    return data


def frame_source(args: argparse.Namespace, limit: int):
    """返回一个「拍一帧」的函数：摄像头每次现拍，文件模式每次返回同一张图（眼镜盯着同一处）。"""
    if args.camera:
        def grab() -> bytes:
            image = kit.capture_jpeg()
            kit.say("设备", f"镜腿摄像头 ← 拍 1 帧（{len(image) // 1024} KB）")
            return image
        return grab
    image = load_jpeg(args.image, limit)

    def same() -> bytes:
        return image
    return same


def questions(args: argparse.Namespace):
    """逐次产出（来源, 16 kHz PCM）。麦克风模式回车开始 / 结束，输入 q 退出。"""
    if args.mic:
        while True:
            if input("        回车开始说话（模拟按住镜腿；输入 q 回车退出）").strip().lower() == "q":
                return
            kit.say("设备", "按住镜腿 · 拍照 + 收音")
            pcm = kit.record_mic(IN_RATE)
            kit.say("设备", f"麦克风 ← 录到 {kit.pcm_seconds(pcm, IN_RATE):.1f} s")
            yield "麦克风", pcm
    else:
        for path in args.audio or [SAMPLE_AUDIO]:
            kit.say("设备", "按住镜腿 · 拍照 + 收音")
            pcm = kit.read_wav(path, IN_RATE)
            kit.say("设备", f"麦克风 ← {path.name}（{kit.pcm_seconds(pcm, IN_RATE):.1f} s）")
            yield path.name, pcm


def wav_bytes(pcm: bytes, rate: int) -> bytes:
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(rate)
        w.writeframes(pcm)
    return buf.getvalue()


# ───────────────────────── 默认：拍照即问 ─────────────────────────

@dataclass
class OmniCall:
    first_at: float | None = None  # 首个文字到达的时刻（kit.now_ms 时间轴）
    prompt: int = 0
    completion: int = 0


def ask_omni(http, cfg: kit.Config, image: bytes, wav: bytes, on_text) -> tuple[str, OmniCall]:
    """图片 + 提问音频一次交给 qwen3.8-omni-flash，流式收文字。"""
    audio = b64(wav)
    if len(audio) >= MAX_AUDIO_BASE64:
        sys.exit("提问音频 Base64 后超过 10 MB，请缩短到 1 分钟以内")
    content = [
        {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{b64(image)}"}},
        {"type": "input_audio", "input_audio": {"data": f"data:;base64,{audio}", "format": "wav"}},
        {"type": "text", "text": ASK_PROMPT},
    ]
    payload = {
        "model": OMNI_MODEL,
        "messages": [{"role": "user", "content": content}],
        "modalities": ["text"],
        "stream": True,
        "stream_options": {"include_usage": True},
        "reasoning_effort": "none",  # 默认 xhigh 深度思考；拍照即问要的是快，关闭
    }
    call, chunks = OmniCall(), []
    for event in http.sse(f"{cfg.compatible_base()}/chat/completions", cfg.headers(), payload):
        for choice in event.get("choices") or []:
            delta = (choice.get("delta") or {}).get("content") or ""
            if delta:
                if call.first_at is None:
                    call.first_at = kit.now_ms()
                chunks.append(delta)
                on_text(delta)
        if event.get("usage"):
            call.prompt = int(event["usage"].get("prompt_tokens") or 0)
            call.completion = int(event["usage"].get("completion_tokens") or 0)
    return "".join(chunks), call


def tts_url(cfg: kit.Config) -> str:
    """实时语音合成 WebSocket；官方只给了业务空间专属域名的地址。"""
    host = kit.REGIONS[cfg.region]["workspace_host"].format(workspace=cfg.workspace_id)
    return f"wss://{host}/api-ws/v1/inference"


class TtsWs:
    """live：websocket-client 连实时语音合成。文本帧是 JSON 事件，二进制帧是音频。"""

    def __init__(self, url: str, headers: dict):
        import websocket  # websocket-client
        self.websocket = websocket
        self.ws = websocket.create_connection(url, header=[f"{k}: {v}" for k, v in headers.items()], timeout=30)

    def send(self, message: dict) -> None:
        self.ws.send(json.dumps(message, ensure_ascii=False))

    def recv(self) -> tuple[bool, object]:
        opcode, data = self.ws.recv_data()
        if opcode == self.websocket.ABNF.OPCODE_BINARY:
            return True, data
        if opcode != self.websocket.ABNF.OPCODE_TEXT:
            raise CloudError(f"语音合成连接已关闭（opcode {opcode}）")
        return False, json.loads(data.decode("utf-8"))

    def close(self) -> None:
        try:
            self.ws.close(timeout=1)
        except Exception:  # noqa: BLE001 — 关连接失败不影响结果
            pass


class TtsStream:
    """qwen-audio-3.0-tts-flash 流式合成：run-task → continue-task ×N → finish-task。

    后台线程负责连接、收音频和事件；主线程收到模型文字就 continue-task，服务端自动分句、
    句子完整即合成。一次任务的三类指令必须用同一个 task_id。
    """

    def __init__(self, connect, voice: str, on_audio):
        self.task_id = uuid.uuid4().hex
        self.voice, self.on_audio = voice, on_audio
        self.audio = bytearray()
        self.first_audio_at: float | None = None
        self.characters = 0
        self.error = ""
        self.t = None
        self.ready, self.done = threading.Event(), threading.Event()
        threading.Thread(target=self._run, args=(connect,), daemon=True).start()

    def _header(self, action: str) -> dict:
        return {"action": action, "task_id": self.task_id, "streaming": "duplex"}

    def _run(self, connect) -> None:
        try:
            self.t = connect()
            self.t.send({"header": self._header("run-task"), "payload": {
                "task_group": "audio", "task": "tts", "function": "SpeechSynthesizer", "model": TTS_MODEL,
                "parameters": {"text_type": "PlainText", "voice": self.voice, "format": "pcm",
                               "sample_rate": OUT_RATE},
                "input": {}}})
            while True:
                binary, message = self.t.recv()
                if binary:
                    if self.first_audio_at is None:
                        self.first_audio_at = kit.now_ms()
                    self.audio.extend(message)
                    self.on_audio(message)
                    continue
                header = message.get("header") or {}
                usage = (message.get("payload") or {}).get("usage") or {}
                self.characters = int(usage.get("characters") or self.characters)
                event = header.get("event")
                if event == "task-started":
                    self.ready.set()
                elif event == "task-finished":
                    return
                elif event == "task-failed":
                    self.error = f"{header.get('error_code', '')} {header.get('error_message', '')}".strip()
                    return
        except Exception as exc:  # noqa: BLE001 — 连接、读写失败都交给主线程报错
            self.error = self.error or str(exc) or type(exc).__name__
        finally:
            self.ready.set()
            self.done.set()

    def _wait(self, event: threading.Event, what: str, timeout: float) -> None:
        if not event.wait(timeout):
            raise CloudError(f"语音合成{what}超时")
        if self.error:
            raise CloudError(f"语音合成失败：{self.error}")

    def say(self, text: str) -> None:
        self._wait(self.ready, "启动", 15)
        self.t.send({"header": self._header("continue-task"), "payload": {"input": {"text": text}}})

    def finish(self) -> None:
        self._wait(self.ready, "启动", 15)
        self.t.send({"header": self._header("finish-task"), "payload": {"input": {}}})
        self._wait(self.done, "结束", 60)

    def close(self) -> None:
        if self.t:
            self.t.close()


def ask_once(http, connect, cfg: kit.Config, glasses: Glasses, voice: str, image: bytes, pcm: bytes,
             index: int) -> dict:
    kit.say("设备", "松开镜腿 → 上传照片和提问，同时连好播报通道")
    t0 = kit.now_ms()
    tts = TtsStream(connect, voice, glasses.speak)
    kit.say("云端", f"看图听问 {OMNI_MODEL}（流式文字）→ 播报 {TTS_MODEL}（WebSocket · {voice}）")
    print("[眼镜] ", end="", flush=True)

    def on_text(delta: str) -> None:
        print(delta, end="", flush=True)
        tts.say(delta)

    try:
        answer, call = ask_omni(http, cfg, image, wav_bytes(pcm, IN_RATE), on_text)
        print(flush=True)
        tts.finish()
    finally:
        tts.close()

    wav = DEMO_DIR / "out" / f"reply_{index}.wav"
    kit.write_wav(wav, bytes(tts.audio), OUT_RATE)
    kit.say("设备", f"耳机 → {wav.relative_to(DEMO_DIR)}（{kit.pcm_seconds(tts.audio, OUT_RATE):.1f} s）"
                    f"{' · 已播放' if glasses.speaker else ''}")
    p = PRICES[cfg.region]
    estimated = not tts.characters
    chars = tts.characters or tts_chars(answer)
    omni_cost = (call.prompt * p["omni_in"] + call.completion * p["omni_out"]) / 1e6
    tts_cost = chars * p["tts_per_10k_chars"] / 1e4
    first_audio = None if tts.first_audio_at is None else tts.first_audio_at - t0
    first_text = None if call.first_at is None else call.first_at - t0

    def ms(value):
        return f"{value:.0f} ms" if cfg.live and value is not None else "—（mock 不计时）"

    kit.say("统计", f"第 {index} 问 · 松开镜腿 → 首字 {ms(first_text)} · 首包语音 {ms(first_audio)} · "
                    f"¥{kit.fmt_cny(omni_cost + tts_cost)}（看图听问 ¥{kit.fmt_cny(omni_cost)}：输入 {call.prompt} / "
                    f"输出 {call.completion} Token；播报 ¥{kit.fmt_cny(tts_cost)}：{chars} 字符"
                    f"{'，按文字估算' if estimated else ''}）")
    return {"first_audio": first_audio, "omni": omni_cost, "tts": tts_cost}


def run_ask(args: argparse.Namespace, cfg: kit.Config) -> None:
    models = [OMNI_MODEL, TTS_MODEL]
    kit.banner("02 AI 眼镜 · 百炼「一看即懂」参考 demo（拍照即问）", cfg, models)
    voice = args.voice or TTS_VOICE
    if cfg.live:
        http = kit.HttpTransport()
        url, headers = tts_url(cfg), cfg.headers()

        def connect():
            return TtsWs(url, headers)
        kit.say("设备", "开机，云端走业务空间专属域名：HTTP 看图听问 + WebSocket 播报")
    else:
        from mock import MockHttp, MockTts
        http, connect = MockHttp(), MockTts
        kit.say("设备", "开机，连接本地 mock 云端（按官方响应与事件顺序回放，不联网）")

    glasses = Glasses(play=cfg.live and not args.no_play)
    photo = frame_source(args, MAX_PHOTO_BYTES)
    results, sources = [], []
    try:
        for index, (source, pcm) in enumerate(questions(args), 1):
            image = photo()
            if not args.camera:
                kit.say("设备", f"镜腿摄像头 ← {args.image.name}（{len(image) // 1024} KB）")
            results.append(ask_once(http, connect, cfg, glasses, voice, image, pcm, index))
            sources.append(source)
    except (kit.HttpError, CloudError) as exc:
        sys.exit(f"\n[云端] {exc}")
    except KeyboardInterrupt:
        print()
    finally:
        glasses.close()
    if not results:
        return
    sample = " + ".join(dict.fromkeys(sources)) + " + " + ("摄像头" if args.camera else args.image.name)
    omni = sum(r["omni"] for r in results) / len(results)
    tts = sum(r["tts"] for r in results) / len(results)
    kit.finish(cfg, args, DEMO_DIR, models=models, first_ms=results[0]["first_audio"], cost=omni + tts,
               sample=sample, note=f"{len(results)} 问均值；首字=松开镜腿→首包语音；"
                                   f"看图听问 ¥{kit.fmt_cny(omni)} + 播报 ¥{kit.fmt_cny(tts)}")


# ───────────────────────── --realtime：给 AI 打电话 ─────────────────────────

class WsTransport:
    """live：websocket-client 直连 Realtime（眼镜固件里同样是一条 WebSocket）。"""

    def __init__(self, url: str, headers: dict):
        import websocket  # websocket-client
        self.ws = websocket.create_connection(url, header=[f"{k}: {v}" for k, v in headers.items()], timeout=30)

    def send(self, event: dict) -> None:
        self.ws.send(json.dumps(event, ensure_ascii=False))

    def recv(self) -> dict:
        return json.loads(self.ws.recv())

    def close(self) -> None:
        try:
            self.ws.close(timeout=1)
        except Exception:  # noqa: BLE001 — 关连接失败不影响结果
            pass


@dataclass
class Usage:
    audio_in: int = 0
    other_in: int = 0   # 文本、图片（画面）输入
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
        return (self.audio_in * p["rt_audio_in"] + self.other_in * p["rt_other_in"]
                + self.text_out * p["rt_text_out"] + self.audio_out * p["rt_audio_out"]) / 1e6

    @property
    def tokens(self) -> str:
        return f"输入 {self.audio_in + self.other_in}（音频 {self.audio_in}）/ 输出 {self.text_out + self.audio_out} Token"


@dataclass
class Turn:
    first_audio_ms: float | None = None
    audio: bytearray = field(default_factory=bytearray)
    frames: int = 0
    usage: Usage = field(default_factory=Usage)


class Session:
    def __init__(self, transport, glasses: Glasses):
        self.t = transport
        self.glasses = glasses
        self._streaming = False

    def send(self, type_: str, **fields) -> None:
        self.t.send({"type": type_, **fields})

    def next_event(self) -> dict:
        event = self.t.recv()
        kind = event.get("type", "")
        if kind == "error":
            raise CloudError(json.dumps(event.get("error", event), ensure_ascii=False))
        if kind == "conversation.item.input_audio_transcription.completed":
            self._newline()
            kit.say("云端", f"听到：{event.get('transcript', '')}")
        return event

    def wait(self, kind: str) -> dict:
        while True:
            event = self.next_event()
            if event.get("type") == kind:
                return event

    def configure(self, voice: str, compact: str) -> None:
        self.wait("session.created")
        self.send("session.update", session={
            "modalities": ["text", "audio"],
            "instructions": REALTIME_INSTRUCTIONS,
            "turn_detection": None,  # Manual：按住镜腿说话，松开即提交
            "audio": {
                "input": {"format": {"type": "pcm", "sample_rate": IN_RATE}},
                "output": {"voice": voice, "format": {"type": "pcm", "sample_rate": OUT_RATE}},
            },
            "input_audio_transcription": {"model": ASR_MODEL},
            # 画面表征聚合：必须在首段音频之前设置；normal 时同样画面的 Token 约为 none 的 1/4
            "video": {"input": {"representation_compact": compact}},
        })
        self.wait("session.updated")

    def turn(self, pcm: bytes, grab) -> Turn:
        turn = Turn()
        for i, offset in enumerate(range(0, len(pcm), CHUNK_BYTES)):
            self.send("input_audio_buffer.append", audio=b64(pcm[offset:offset + CHUNK_BYTES]))
            if i % FRAME_EVERY == 0:  # 官方要求先发过音频再发图片，建议 1 帧/秒
                self.send("input_image_buffer.append", image=b64(grab()))
                turn.frames += 1
        kit.say("设备", f"松开镜腿 → 提交本轮（{kit.pcm_seconds(pcm, IN_RATE):.1f} s 语音 + {turn.frames} 帧画面）")
        t0 = kit.now_ms()
        self.send("input_audio_buffer.commit")
        self.wait("input_audio_buffer.committed")
        self.send("response.create")
        while True:
            event = self.next_event()
            kind = event.get("type", "")
            if kind == "response.audio.delta":
                chunk = base64.b64decode(event.get("delta", ""))
                if turn.first_audio_ms is None:
                    turn.first_audio_ms = kit.now_ms() - t0
                turn.audio.extend(chunk)
                self.glasses.speak(chunk)
            elif kind in ("response.audio_transcript.delta", "response.text.delta"):
                if not self._streaming:
                    print("[眼镜] ", end="")
                    self._streaming = True
                print(event.get("delta", ""), end="", flush=True)
            elif kind == "response.done":
                self._newline()
                response = event.get("response") or {}
                turn.usage.add(response.get("usage") or {})
                if response.get("status") not in (None, "completed"):
                    kit.say("云端", f"本轮状态：{response.get('status')}")
                return turn

    def close(self) -> None:
        try:
            self.send("session.finish")
        except Exception:  # noqa: BLE001
            pass
        self.t.close()

    def _newline(self) -> None:
        if self._streaming:
            print(flush=True)
            self._streaming = False


def run_realtime(args: argparse.Namespace, cfg: kit.Config) -> None:
    kit.banner("02 AI 眼镜 · 百炼「给 AI 打电话」参考 demo（--realtime）", cfg, [REALTIME_MODEL])
    voice = args.voice or REALTIME_VOICE
    grab = frame_source(args, MAX_FRAME_BYTES)
    if cfg.live:
        host = kit.REGIONS[cfg.region]["workspace_host"].format(workspace="<业务空间>")
        kit.say("设备", f"开机，连接 wss://{host}/api-ws/v1/realtime …")
        transport = WsTransport(cfg.realtime_url(REALTIME_MODEL), cfg.headers())
    else:
        from mock import MockRealtime
        kit.say("设备", "开机，连接本地 mock 云端（按官方事件顺序回放，不联网）")
        transport = MockRealtime()

    glasses = Glasses(play=cfg.live and not args.no_play)
    session = Session(transport, glasses)
    turns, sources = [], []
    try:
        session.configure(voice, args.compact)
        kit.say("云端", f"会话就绪：音色 {voice} · 按住镜腿说话（Manual）· 画面 1 帧/秒 · "
                        f"representation_compact={args.compact}")
        if not args.camera:
            kit.say("设备", f"镜腿摄像头 ← {args.image.name}（每秒推 1 帧，模拟一直看着同一处）")
        for index, (source, pcm) in enumerate(questions(args), 1):
            turn = session.turn(pcm, grab)
            turns.append(turn)
            sources.append(source)
            wav = DEMO_DIR / "out" / f"realtime_reply_{index}.wav"
            kit.write_wav(wav, bytes(turn.audio), OUT_RATE)
            kit.say("设备", f"耳机 → {wav.relative_to(DEMO_DIR)}（{kit.pcm_seconds(turn.audio, OUT_RATE):.1f} s）"
                            f"{' · 已播放' if glasses.speaker else ''}")
            first = (f"{turn.first_audio_ms:.0f} ms" if cfg.live and turn.first_audio_ms is not None
                     else "—（mock 不计时）")
            kit.say("统计", f"第 {index} 轮 · 松开镜腿 → 首包语音 {first} · ¥{kit.fmt_cny(turn.usage.cost(cfg.region))}"
                            f"（{turn.usage.tokens}；画面 {turn.frames} 帧，聚合 {args.compact}）")
    except CloudError as exc:
        sys.exit(f"[云端] 错误：{exc}")
    except KeyboardInterrupt:
        print()
    finally:
        session.close()
        glasses.close()
    if not turns:
        return
    sample = " + ".join(dict.fromkeys(sources)) + " + " + ("摄像头" if args.camera else args.image.name)
    kit.finish(cfg, args, DEMO_DIR, models=[REALTIME_MODEL], first_ms=turns[0].first_audio_ms,
               cost=sum(t.usage.cost(cfg.region) for t in turns) / len(turns), sample=sample,
               note=f"--realtime；{len(turns)} 轮均值；首字=松开镜腿→首包音频；representation_compact={args.compact}")


def main() -> None:
    ap = argparse.ArgumentParser(description="02 AI 眼镜 · 百炼「一看即懂」参考 demo")
    kit.add_standard_args(ap)
    ap.add_argument("--realtime", action="store_true",
                    help="给 AI 打电话：qwen3.8-omni-flash-realtime，语音直接回复，画面 1 帧/秒")
    ap.add_argument("--audio", type=Path, action="append", help="提问 WAV（可重复给多问）；默认 samples/ask_dish.wav")
    ap.add_argument("--mic", action="store_true", help="用麦克风：回车开始说话、再按回车结束，可连续多问")
    ap.add_argument("--image", type=Path, default=SAMPLE_IMAGE, help="眼镜拍到的画面（JPG）")
    ap.add_argument("--camera", action="store_true", help="用摄像头拍照代替 --image（--realtime 时每秒拍 1 帧）")
    ap.add_argument("--voice", help=f"音色；默认播报用 {TTS_VOICE}，--realtime 用 {REALTIME_VOICE}")
    ap.add_argument("--compact", choices=["normal", "none"], default="normal",
                    help="--realtime 的画面表征聚合：normal 省 Token（约 1/4），none 保留细节")
    ap.add_argument("--no-play", action="store_true", help="不播放，只写 WAV")
    args = ap.parse_args()

    cfg = kit.resolve(args, DEMO_DIR, need_workspace=True)
    if cfg.live:
        need_websocket()
    if args.realtime:
        run_realtime(args, cfg)
    else:
        run_ask(args, cfg)


if __name__ == "__main__":
    main()
