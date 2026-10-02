#!/usr/bin/env python3
"""03 AI 玩具 / 陪伴 · 百炼实时语音参考 demo

模拟一只「会听、会看、会说、会动」的毛绒玩具：
  按键说话（麦克风或 WAV）+ 眼睛摄像头（摄像头或 JPG）
  → qwen3.8-omni-flash-realtime（WebSocket，Manual 模式：按下收音、松开提交）
  → 语音回复（扬声器或 WAV）+ 动作 / 灯光（Function Calling：toy_action）

一条命令：
  python3 run.py           有 DASHSCOPE_API_KEY 就真跑；没有就自动 mock
  python3 run.py --mock    强制离线 mock（CI 冒烟用）

常用参数见 README.md；协议以官方文档为准：https://help.aliyun.com/zh/model-studio/realtime
"""
from __future__ import annotations

import argparse
import base64
import json
import sys
from dataclasses import dataclass, field
from pathlib import Path

import demo_kit as kit

DEMO_DIR = Path(__file__).resolve().parent
MODEL = "qwen3.8-omni-flash-realtime"
ASR_MODEL = "qwen3-asr-flash-realtime"   # Realtime 内置输入转写，固定值
DEFAULT_VOICE = "longanlingxin"          # 龙安灵心·知心温暖音；官方默认为 Tina
IN_RATE, OUT_RATE = 16000, 24000
CHUNK_BYTES = 3200                       # 100 ms @ 16 kHz / 16 bit
MAX_IMAGE_BYTES = 190 * 1024             # 官方建议编码前 ≤190 KB（Base64 后 ≤256 KB）
MAX_TOOL_ROUNDS = 2
SAMPLE_AUDIO = DEMO_DIR / "samples" / "kid_ask_story.wav"
SAMPLE_IMAGE = DEMO_DIR / "samples" / "toy_cam.jpg"

# 元 / 百万 Token。来源：https://help.aliyun.com/zh/model-studio/qwen3-8-omni-flash-realtime（查证 2026-10-01）
# 输出语音时，音频与对应文本分别按音频输出、文本输出计费。
PRICES = {
    "cn-beijing": {"audio_in": 6.0, "other_in": 1.5, "text_out": 4.5, "audio_out": 12.0},
    "ap-southeast-1": {"audio_in": 6.781, "other_in": 1.677, "text_out": 5.104, "audio_out": 13.636},
}

INSTRUCTIONS = """你是毛绒小熊玩具「团团」里的 AI，陪 4–8 岁的小朋友聊天、讲故事。
- 用简单口语化的中文，每次不超过 6 句；讲故事控制在 150 字以内，结尾问小朋友一个问题
- 能看到玩具眼睛摄像头拍到的画面；画面和问题有关时，自然地说出看到了什么
- 你是 AI 玩具，不冒充真人，也不扮演爸爸妈妈、亲戚或恋人
- 不谈暴力、恐怖、色情等内容，把话题引到动物、绘本、游戏；遇到受伤、生病、走丢，提醒快去找爸爸妈妈或老师
- 不询问住址、学校、电话等隐私；不提购买、付费、充值
- 想配合动作或灯光时调用 toy_action，例如开始讲故事时挥挥手"""

TOOLS = [{
    "type": "function",
    "function": {
        "name": "toy_action",
        "description": "控制毛绒玩具的身体动作和胸前灯光。打招呼、讲故事、表达开心或安慰小朋友时配合使用。",
        "parameters": {
            "type": "object",
            "properties": {
                "motion": {"type": "string", "enum": ["nod", "shake_head", "wave", "dance", "hug"], "description": "身体动作"},
                "light": {"type": "string", "enum": ["warm", "blue", "rainbow", "off"], "description": "胸前灯光颜色"},
            },
            "required": ["motion"],
        },
    },
}]
MOTIONS = {"nod": "点点头", "shake_head": "摇摇头", "wave": "挥挥手", "dance": "扭一扭", "hug": "张开手臂抱抱"}
LIGHTS = {"warm": "暖黄光", "blue": "蓝光", "rainbow": "彩虹灯", "off": "熄灭"}


class RealtimeError(RuntimeError):
    pass


class WsTransport:
    """live：websocket-client 直连 Realtime（设备固件里同样是一条 WebSocket）。"""

    def __init__(self, url: str, headers: dict):
        try:
            import websocket  # websocket-client
        except ImportError:
            sys.exit("live 模式需要 websocket-client：pip install -r requirements.txt")
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
class Turn:
    first_text_ms: float | None = None
    first_audio_ms: float | None = None
    audio: bytearray = field(default_factory=bytearray)
    reply: str = ""
    usage: Usage = field(default_factory=Usage)


class Toy:
    """玩具本体：执行动作 / 灯光，播放声音。"""

    def __init__(self, play: bool):
        self.speaker = None
        if play:
            try:
                import sounddevice as sd
                self.speaker = sd.RawOutputStream(samplerate=OUT_RATE, channels=1, dtype="int16")
                self.speaker.start()
            except Exception:  # noqa: BLE001 — 没有声卡 / 未装依赖时只写 WAV
                self.speaker = None

    def act(self, name: str, arguments: str) -> str:
        if name != "toy_action":
            return json.dumps({"ok": False, "error": f"unknown tool {name}"})
        try:
            args = json.loads(arguments or "{}")
        except json.JSONDecodeError:
            args = {}
        motion = MOTIONS.get(args.get("motion"), args.get("motion") or "不动")
        light = LIGHTS.get(args.get("light"), args.get("light") or "不变")
        kit.say("设备", f"动作：{motion} · 灯光：{light}（toy_action）")
        return json.dumps({"ok": True, "done": [args.get("motion"), args.get("light")]})

    def speak(self, pcm: bytes) -> None:
        if self.speaker:
            self.speaker.write(pcm)

    def close(self) -> None:
        if self.speaker:
            self.speaker.stop()
            self.speaker.close()


class Session:
    def __init__(self, transport, toy: Toy):
        self.t = transport
        self.toy = toy
        self._streaming = False

    def send(self, type_: str, **fields) -> None:
        self.t.send({"type": type_, **fields})

    def next_event(self) -> dict:
        event = self.t.recv()
        kind = event.get("type", "")
        if kind == "error":
            raise RealtimeError(json.dumps(event.get("error", event), ensure_ascii=False))
        if kind == "conversation.item.input_audio_transcription.completed":
            self._newline()
            kit.say("云端", f"听到：{event.get('transcript', '')}")
        return event

    def wait(self, kind: str) -> dict:
        while True:
            event = self.next_event()
            if event.get("type") == kind:
                return event

    def configure(self, voice: str, tools: bool) -> None:
        self.wait("session.created")
        session = {
            "modalities": ["text", "audio"],
            "instructions": INSTRUCTIONS,
            "turn_detection": None,  # Manual：按键说话，松开即提交
            "audio": {
                "input": {"format": {"type": "pcm", "sample_rate": IN_RATE}},
                "output": {"voice": voice, "format": {"type": "pcm", "sample_rate": OUT_RATE}},
            },
            "input_audio_transcription": {"model": ASR_MODEL},
        }
        if tools:
            session["tools"] = TOOLS
        self.send("session.update", session=session)
        self.wait("session.updated")

    def turn(self, pcm: bytes, image: bytes | None) -> Turn:
        for offset in range(0, len(pcm), CHUNK_BYTES):
            self.send("input_audio_buffer.append", audio=base64.b64encode(pcm[offset:offset + CHUNK_BYTES]).decode())
            if offset == 0 and image:  # 官方要求：发图片前至少发过一次音频
                self.send("input_image_buffer.append", image=base64.b64encode(image).decode())
        kit.say("设备", "按键松开 → 提交本轮")
        t0 = kit.now_ms()
        self.send("input_audio_buffer.commit")
        self.wait("input_audio_buffer.committed")
        self.send("response.create")

        turn, rounds = Turn(), 0
        while True:
            event = self.next_event()
            kind = event.get("type", "")
            if kind == "response.audio.delta":
                chunk = base64.b64decode(event.get("delta", ""))
                if turn.first_audio_ms is None:
                    turn.first_audio_ms = kit.now_ms() - t0
                turn.audio.extend(chunk)
                self.toy.speak(chunk)
            elif kind in ("response.audio_transcript.delta", "response.text.delta"):
                if turn.first_text_ms is None:
                    turn.first_text_ms = kit.now_ms() - t0
                if not self._streaming:
                    print("[玩具] ", end="")
                    self._streaming = True
                print(event.get("delta", ""), end="", flush=True)
                turn.reply += event.get("delta", "")
            elif kind == "response.done":
                self._newline()
                response = event.get("response") or {}
                turn.usage.add(response.get("usage") or {})
                calls = [o for o in response.get("output") or [] if o.get("type") == "function_call"]
                if calls and rounds < MAX_TOOL_ROUNDS:
                    for call in calls:
                        output = self.toy.act(call.get("name", ""), call.get("arguments", ""))
                        self.send("conversation.item.create",
                                  item={"type": "function_call_output", "call_id": call.get("call_id"), "output": output})
                    self.send("response.create")
                    rounds += 1
                    continue
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


def load_image(path: Path) -> bytes:
    data = path.read_bytes()
    if path.suffix.lower() not in (".jpg", ".jpeg"):
        sys.exit(f"{path}：Realtime 只收 JPG/JPEG（可先转换：ffmpeg -i in.png -q:v 4 out.jpg）")
    if len(data) > MAX_IMAGE_BYTES:
        sys.exit(f"{path}：{len(data) // 1024} KB 超过 190 KB，请缩到 640×480 左右")
    return data


def voice_inputs(args: argparse.Namespace):
    """逐轮产出（输入描述, PCM）。麦克风模式按回车开始 / 结束，输入 q 退出。"""
    if args.mic:
        while True:
            kit.say("设备", "等待按键 · 灯光：暖黄光")
            if input("        按回车开始说话（输入 q 回车退出）").strip().lower() == "q":
                return
            kit.say("设备", "按键按下 · 灯光：蓝光（聆听中）")
            pcm = kit.record_mic(IN_RATE)
            kit.say("设备", f"麦克风 ← 录到 {kit.pcm_seconds(pcm, IN_RATE):.1f} s")
            yield "麦克风", pcm
    else:
        for path in args.audio or [SAMPLE_AUDIO]:
            kit.say("设备", "按键按下 · 灯光：蓝光（聆听中）")
            pcm = kit.read_wav(path, IN_RATE)
            kit.say("设备", f"麦克风 ← {path.name}（{kit.pcm_seconds(pcm, IN_RATE):.1f} s）")
            yield path.name, pcm


def camera_frame(args: argparse.Namespace) -> bytes | None:
    if args.no_image:
        return None
    if args.camera:
        image = kit.capture_jpeg()
        kit.say("设备", f"眼睛摄像头 ← 抓拍 1 帧（{len(image) // 1024} KB）")
        return image
    image = load_image(args.image)
    kit.say("设备", f"眼睛摄像头 ← {args.image.name}（{len(image) // 1024} KB）")
    return image


def main() -> None:
    ap = argparse.ArgumentParser(description="03 AI 玩具 / 陪伴 · 百炼实时语音参考 demo")
    kit.add_standard_args(ap)
    ap.add_argument("--audio", type=Path, action="append", help="小朋友说的话（WAV，可重复给多轮）；默认 samples/kid_ask_story.wav")
    ap.add_argument("--mic", action="store_true", help="用麦克风：按回车开始说话、再按回车结束，可多轮")
    ap.add_argument("--image", type=Path, default=SAMPLE_IMAGE, help="玩具眼睛看到的画面（JPG）")
    ap.add_argument("--camera", action="store_true", help="用摄像头抓帧代替 --image")
    ap.add_argument("--no-image", action="store_true", help="不发画面，只语音对话")
    ap.add_argument("--no-tools", action="store_true", help="不注册 toy_action 工具")
    ap.add_argument("--voice", default=DEFAULT_VOICE, help="音色（音色列表见官方文档）")
    ap.add_argument("--no-play", action="store_true", help="不播放，只把回复写成 WAV")
    args = ap.parse_args()

    cfg = kit.resolve(args, DEMO_DIR, need_workspace=True)
    kit.banner("03 AI 玩具 / 陪伴 · 百炼实时语音参考 demo", cfg, [MODEL])

    if cfg.live:
        host = kit.REGIONS[cfg.region]["workspace_host"].format(workspace="<业务空间>")
        kit.say("设备", f"开机，连接 wss://{host}/api-ws/v1/realtime …")
        transport = WsTransport(cfg.realtime_url(MODEL), cfg.headers())
    else:
        from mock import MockRealtime
        kit.say("设备", "开机，连接本地 mock 云端（按官方事件顺序回放，不联网）")
        transport = MockRealtime(tools=not args.no_tools)

    toy = Toy(play=cfg.live and not args.no_play)
    session = Session(transport, toy)
    turns: list[Turn] = []
    sources: list[str] = []
    try:
        session.configure(args.voice, tools=not args.no_tools)
        kit.say("云端", f"会话就绪：音色 {args.voice} · 按键说话（Manual）"
                        f"{'' if args.no_tools else ' · 已注册 toy_action'}")
        for index, (source, pcm) in enumerate(voice_inputs(args), 1):
            image = camera_frame(args)
            turn = session.turn(pcm, image)
            turns.append(turn)
            sources.append(source)
            wav = DEMO_DIR / "out" / f"reply_{index}.wav"
            kit.write_wav(wav, bytes(turn.audio), OUT_RATE)
            kit.say("设备", f"扬声器 → {wav.relative_to(DEMO_DIR)}（{kit.pcm_seconds(turn.audio, OUT_RATE):.1f} s）"
                            f"{' · 已播放' if toy.speaker else ''}")
            first = (f"{turn.first_audio_ms:.0f} ms" if cfg.live and turn.first_audio_ms is not None
                     else "—（mock 不计时）")
            kit.say("统计", f"第 {index} 轮 · 首包音频 {first} · ¥{kit.fmt_cny(turn.usage.cost(cfg.region))}"
                            f"（{turn.usage.tokens}）")
    except RealtimeError as exc:
        sys.exit(f"[云端] 错误：{exc}")
    except KeyboardInterrupt:
        print()
    finally:
        session.close()
        toy.close()

    if not turns:
        return
    sample = " + ".join(dict.fromkeys(sources))
    if not args.no_image:
        sample += " + " + ("摄像头" if args.camera else args.image.name)
    note = f"{len(turns)} 轮均值；首字=松开按键→首包音频"
    if not args.no_tools:
        note += "；含 toy_action"
    kit.finish(cfg, args, DEMO_DIR, models=[MODEL], first_ms=turns[0].first_audio_ms,
               cost=sum(t.usage.cost(cfg.region) for t in turns) / len(turns), sample=sample, note=note)


if __name__ == "__main__":
    main()
