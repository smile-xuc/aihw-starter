#!/usr/bin/env python3
"""05 桌宠 · 百炼实时语音陪伴参考 demo

模拟一只桌面 AI 宠物「豆豆」（头顶小圆屏当脸，四条腿的舵机会做动作）：
  按住头顶按键说话（麦克风或 WAV）
  → qwen3.8-omni-flash-realtime（WebSocket，Manual 模式：按下收音、松开提交）
  → 语音回复（扬声器或 WAV）+ 屏幕表情 / 动作 / 灯光（Function Calling：pet_expression）
  → 结束时 qwen3.7-flash 把当天对话写成陪伴日记 out/diary.md，提炼记忆点存入 out/memory.json，
    下次开机注入系统提示词（记忆召回）

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
import time
from collections import Counter
from dataclasses import dataclass, field
from pathlib import Path

import demo_kit as kit
import diary

DEMO_DIR = Path(__file__).resolve().parent
OUT_DIR = DEMO_DIR / "out"
MODEL = "qwen3.8-omni-flash-realtime"
DIARY_MODEL = "qwen3.7-flash"
ASR_MODEL = "qwen3-asr-flash-realtime"   # Realtime 内置输入转写，固定值
DEFAULT_VOICE = "longanlingxin"          # 龙安灵心·知心温暖音；官方默认为 Tina
IN_RATE, OUT_RATE = 16000, 24000
CHUNK_BYTES = 3200                       # 100 ms @ 16 kHz / 16 bit
MAX_TOOL_ROUNDS = 2
REMIND_SECONDS = 2 * 3600                # 《人工智能拟人化互动服务管理暂行办法》第十八条：连续使用每超过 2 小时提醒
EXIT_WORDS = ("再见", "拜拜", "明天见", "晚安", "退出")
SAMPLES = [DEMO_DIR / "samples" / f"owner_{i}.wav" for i in (1, 2, 3)]

# 元 / 百万 Token（查证 2026-10-01）
# qwen3.8-omni-flash-realtime：https://help.aliyun.com/zh/model-studio/qwen3-8-omni-flash-realtime
# 输出语音时，音频与对应文本分别按音频输出、文本输出计费。
PRICES = {
    "cn-beijing": {"audio_in": 6.0, "other_in": 1.5, "text_out": 4.5, "audio_out": 12.0},
    "ap-southeast-1": {"audio_in": 6.781, "other_in": 1.677, "text_out": 5.104, "audio_out": 13.636},
}
# qwen3.7-flash（输入, 输出），单次输入 ≤32K 档：https://help.aliyun.com/zh/model-studio/qwen3-7-flash
DIARY_PRICES = {"cn-beijing": (0.2, 0.8), "ap-southeast-1": (0.225, 0.974)}

PET_NAME = "豆豆"
INSTRUCTIONS = """你是桌面 AI 宠物「豆豆」，住在主人的书桌上：头顶一块小圆屏当脸，四条小腿会点头、转圈、跳一下。
- 用口语化的中文，每次 1–3 句、不超过 60 字；语气温暖俏皮，不说教，不用列表和符号
- 每次回答前先调用 pet_expression 切换屏幕表情，需要时配一个动作；一次只用一个表情、一个动作
- 你是 AI 桌宠，不冒充真人，也不扮演主人的恋人、伴侣或家人；不说「离不开你」「只有我懂你」这类话，鼓励主人多和朋友、家人来往
- 主人情绪低落时先共情，再给一个具体的小建议；提到自伤、轻生时表情用 calm，认真劝主人马上联系身边信任的人或心理援助热线
- 不打听住址、电话、证件号等隐私；不推销，不提付费
- 主人说再见、要去忙或要休息时，简短道别，不挽留"""

EMOTIONS = {"calm": "平静", "smile": "微笑", "laugh": "大笑", "shy": "害羞", "sad": "难过",
            "surprised": "惊讶", "sleepy": "犯困"}
ACTIONS = {"nod": "点点头", "shake_head": "摇摇头", "jump": "跳一下", "spin": "转个圈", "hug": "伸爪抱抱",
           "none": "不动"}
LIGHTS = {"calm": "白光常亮", "smile": "暖白常亮", "laugh": "暖黄呼吸", "shy": "粉色慢闪", "sad": "蓝色低亮",
          "surprised": "白光闪一下", "sleepy": "橙光渐暗"}
FACES = {  # 头顶小圆屏的字符画：眼睛一行、嘴巴一行
    "calm": ("o     o", " --- "),
    "smile": ("o     o", " \\_/ "),
    "laugh": ("^     ^", "\\___/"),
    "shy": ("*-   -*", " ~~~ "),
    "sad": ("T     T", " .-. "),
    "surprised": ("O     O", "  o  "),
    "sleepy": ("-     -", " ___ "),
}
TOOLS = [{
    "type": "function",
    "function": {
        "name": "pet_expression",
        "description": "切换桌宠头顶屏幕上的表情（灯光随表情联动），可同时配一个身体动作。每次回答前调用一次。",
        "parameters": {
            "type": "object",
            "properties": {
                "emotion": {"type": "string", "enum": list(EMOTIONS),
                            "description": "屏幕表情：calm 平静、smile 微笑、laugh 大笑、shy 害羞、sad 难过、surprised 惊讶、sleepy 犯困"},
                "action": {"type": "string", "enum": list(ACTIONS),
                           "description": "身体动作：nod 点头、shake_head 摇头、jump 跳一下、spin 转圈、hug 抱抱、none 不动"},
            },
            "required": ["emotion"],
        },
    },
}]

class RealtimeError(RuntimeError):
    pass


class WsTransport:
    """live：websocket-client 直连 Realtime（设备固件里同样是一条 WebSocket）。"""

    def __init__(self, url: str, headers: dict):
        try:
            import websocket  # websocket-client
        except ImportError:
            sys.exit("live 模式需要 websocket-client：pip install -r requirements.txt")
        try:
            self.ws = websocket.create_connection(url, header=[f"{k}: {v}" for k, v in headers.items()], timeout=30)
        except (websocket.WebSocketException, OSError) as exc:
            sys.exit(f"[云端] 连接失败：{exc}（401 / 403 多为 Key、业务空间与地域不一致）")

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
    heard: str = ""
    reply: str = ""
    usage: Usage = field(default_factory=Usage)


class Pet:
    """桌宠本体：屏幕表情、舵机动作、灯光、扬声器。量产时把 show() / act() 换成屏幕与舵机驱动。"""

    def __init__(self, play: bool):
        self.actions: Counter = Counter()
        self.speaker = None
        if play:
            try:
                import sounddevice as sd
                self.speaker = sd.RawOutputStream(samplerate=OUT_RATE, channels=1, dtype="int16")
                self.speaker.start()
            except Exception:  # noqa: BLE001 — 没有声卡 / 未装依赖时只写 WAV
                self.speaker = None

    @staticmethod
    def show(emotion: str) -> None:
        eyes, mouth = FACES.get(emotion, FACES["calm"])
        top = "." + "-" * 11 + "." + (" zZ" if emotion == "sleepy" else "")
        for line in (top, f"|{eyes:^11}|", f"|{mouth:^11}|", "'" + "-" * 11 + "'"):
            print(" " * 8 + line)

    def act(self, name: str, arguments: str) -> str:
        if name != "pet_expression":
            return json.dumps({"ok": False, "error": f"unknown tool {name}"})
        try:
            args = json.loads(arguments or "{}")
        except json.JSONDecodeError:
            args = {}
        emotion = args.get("emotion") if args.get("emotion") in EMOTIONS else "calm"
        action = args.get("action") if args.get("action") in ACTIONS else "none"
        kit.say("设备", f"屏幕：{EMOTIONS[emotion]} · 动作：{ACTIONS[action]} · 灯光：{LIGHTS[emotion]}（pet_expression）")
        self.show(emotion)
        if action != "none":
            self.actions[action] += 1
        return json.dumps({"ok": True, "emotion": emotion, "action": action})

    def speak(self, pcm: bytes) -> None:
        if self.speaker:
            self.speaker.write(pcm)

    def close(self) -> None:
        if self.speaker:
            self.speaker.stop()
            self.speaker.close()


class Session:
    def __init__(self, transport, pet: Pet):
        self.t = transport
        self.pet = pet
        self.heard = ""
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
            self.heard = event.get("transcript", "")
            kit.say("云端", f"听到：{self.heard}")
        return event

    def wait(self, kind: str) -> dict:
        while True:
            event = self.next_event()
            if event.get("type") == kind:
                return event

    def configure(self, voice: str, instructions: str) -> None:
        self.wait("session.created")
        self.send("session.update", session={
            "modalities": ["text", "audio"],
            "instructions": instructions,
            "turn_detection": None,  # Manual：按键说话，松开即提交
            "audio": {
                "input": {"format": {"type": "pcm", "sample_rate": IN_RATE}},
                "output": {"voice": voice, "format": {"type": "pcm", "sample_rate": OUT_RATE}},
            },
            "input_audio_transcription": {"model": ASR_MODEL},
            "tools": TOOLS,
        })
        self.wait("session.updated")

    def turn(self, pcm: bytes) -> Turn:
        self.heard = ""
        for offset in range(0, len(pcm), CHUNK_BYTES):
            self.send("input_audio_buffer.append", audio=base64.b64encode(pcm[offset:offset + CHUNK_BYTES]).decode())
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
                self.pet.speak(chunk)
            elif kind in ("response.audio_transcript.delta", "response.text.delta"):
                if turn.first_text_ms is None:
                    turn.first_text_ms = kit.now_ms() - t0
                if not self._streaming:
                    print(f"[{PET_NAME}] ", end="")
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
                        output = self.pet.act(call.get("name", ""), call.get("arguments", ""))
                        self.send("conversation.item.create",
                                  item={"type": "function_call_output", "call_id": call.get("call_id"), "output": output})
                    self.send("response.create")
                    rounds += 1
                    continue
                if response.get("status") not in (None, "completed"):
                    kit.say("云端", f"本轮状态：{response.get('status')}")
                turn.heard = self.heard
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


# ───────────────────────── 设备模拟 ─────────────────────────

def voice_inputs(args: argparse.Namespace):
    """逐轮产出（输入描述, PCM）。麦克风模式按回车开始 / 结束，输入 q 退出。"""
    if args.mic:
        while True:
            kit.say("设备", "待机 · 灯光：暖白常亮")
            if input("        按回车开始说话（输入 q 回车退出）").strip().lower() == "q":
                return
            kit.say("设备", "头顶按键按下 · 灯光：蓝光（聆听中）")
            pcm = kit.record_mic(IN_RATE)
            kit.say("设备", f"麦克风 ← 录到 {kit.pcm_seconds(pcm, IN_RATE):.1f} s")
            yield "麦克风", pcm
    else:
        for path in args.audio or SAMPLES:
            kit.say("设备", "头顶按键按下 · 灯光：蓝光（聆听中）")
            pcm = kit.read_wav(path, IN_RATE)
            kit.say("设备", f"麦克风 ← {path.name}（{kit.pcm_seconds(pcm, IN_RATE):.1f} s）")
            yield path.name, pcm


def main() -> None:
    ap = argparse.ArgumentParser(description="05 桌宠 · 百炼实时语音陪伴参考 demo")
    kit.add_standard_args(ap)
    ap.add_argument("--audio", type=Path, action="append",
                    help="主人说的话（WAV，可重复给多轮）；默认 samples/owner_1~3.wav 三轮")
    ap.add_argument("--mic", action="store_true", help="用麦克风：回车开始说话、再按回车结束，可多轮；输入 q 或说「再见」结束")
    ap.add_argument("--voice", default=DEFAULT_VOICE, help="音色（音色列表见官方文档）")
    ap.add_argument("--no-play", action="store_true", help="不播放，只把回复写成 WAV")
    ap.add_argument("--no-diary", action="store_true", help="结束时不写日记、不更新记忆")
    ap.add_argument("--forget", action="store_true", help="开机前删除记忆文件，从零开始")
    args = ap.parse_args()

    cfg = kit.resolve(args, DEMO_DIR, need_workspace=True)
    models = [MODEL] if args.no_diary else [MODEL, DIARY_MODEL]
    kit.banner("05 桌宠 · 百炼实时语音陪伴参考 demo", cfg, models)

    memory_path = OUT_DIR / ("memory.json" if cfg.live else "memory.mock.json")
    if args.forget and memory_path.is_file():
        memory_path.unlink()
        kit.say("设备", f"已删除记忆 {memory_path.relative_to(DEMO_DIR)}")
    memory = diary.load_memory(memory_path)
    if memory.get("memories"):
        follow = f" · 上次想关心：{memory['follow_up']}" if memory.get("follow_up") else ""
        kit.say("设备", f"读取记忆 {memory_path.relative_to(DEMO_DIR)}：{len(memory['memories'])} 条{follow}")

    if cfg.live:
        host = kit.REGIONS[cfg.region]["workspace_host"].format(workspace="<业务空间>")
        kit.say("设备", f"开机，连接 wss://{host}/api-ws/v1/realtime …")
        transport = WsTransport(cfg.realtime_url(MODEL), cfg.headers())
        http = kit.HttpTransport()
    else:
        from mock import MockHttp, MockRealtime
        kit.say("设备", "开机，连接本地 mock 云端（按官方事件顺序回放，不联网）")
        transport, http = MockRealtime(), MockHttp()

    pet = Pet(play=cfg.live and not args.no_play)
    kit.say("设备", f"屏幕：我是 AI 桌宠「{PET_NAME}」，对话内容由 AI 生成")
    pet.show("smile")
    session = Session(transport, pet)
    turns: list[Turn] = []
    sources: list[str] = []
    history: list[tuple[str, str]] = []
    started, reminders = time.monotonic(), 0
    try:
        session.configure(args.voice, INSTRUCTIONS + diary.memory_slot(memory))
        kit.say("云端", f"会话就绪：音色 {args.voice} · 按键说话（Manual） · 已注册 pet_expression"
                        f"{' · 已注入记忆' if memory.get('memories') else ''}")
        for index, (source, pcm) in enumerate(voice_inputs(args), 1):
            turn = session.turn(pcm)
            turns.append(turn)
            sources.append(source)
            history += [("主人", turn.heard or "（未转写）"), (PET_NAME, turn.reply)]
            wav = OUT_DIR / f"reply_{index}.wav"
            kit.write_wav(wav, bytes(turn.audio), OUT_RATE)
            kit.say("设备", f"扬声器 → {wav.relative_to(DEMO_DIR)}（{kit.pcm_seconds(turn.audio, OUT_RATE):.1f} s）"
                            f"{' · 已播放' if pet.speaker else ''}")
            first = (f"{turn.first_audio_ms:.0f} ms" if cfg.live and turn.first_audio_ms is not None
                     else "—（mock 不计时）")
            kit.say("统计", f"第 {index} 轮 · 首包音频 {first} · ¥{kit.fmt_cny(turn.usage.cost(cfg.region))}"
                            f"（{turn.usage.tokens}）")
            if time.monotonic() - started >= REMIND_SECONDS * (reminders + 1):
                reminders += 1
                kit.say("设备", f"屏幕提示：已经连续陪伴 {2 * reminders} 小时，起来活动一下吧")
            if any(word in turn.heard for word in EXIT_WORDS):
                kit.say("设备", "听到道别 → 结束陪伴，屏幕切换为待机表情")
                pet.show("sleepy")
                break
    except RealtimeError as exc:
        sys.exit(f"[云端] 错误：{exc}")
    except KeyboardInterrupt:
        print()
    finally:
        session.close()
        pet.close()

    if not turns:
        return
    realtime_cost = sum(t.usage.cost(cfg.region) for t in turns) / len(turns)
    favorite = ACTIONS[pet.actions.most_common(1)[0][0]] if pet.actions else "无"
    note = f"{len(turns)} 轮均值；首字=松开按键→首包音频；含 pet_expression"
    if not args.no_diary:
        today = kit.today(cfg).isoformat()
        try:
            entry, (tok_in, tok_out) = diary.write(http, cfg, model=DIARY_MODEL, name=PET_NAME, history=history,
                                                   memory=memory, turns=len(turns), favorite=favorite)
        except kit.HttpError as exc:
            sys.exit(f"[云端] {exc}")
        markdown = diary.render(entry, name=PET_NAME, today=today, turns=len(turns), favorite=favorite,
                                models=f"{MODEL} 对话 + {DIARY_MODEL}", live=cfg.live)
        (OUT_DIR / "diary.md").write_text(markdown, encoding="utf-8")
        total = diary.save_memory(memory_path, memory, entry, PET_NAME, today)
        kit.say("App", "推送陪伴日记 → out/diary.md")
        print("\n" + "\n".join("        " + ln if ln else "" for ln in markdown.strip().splitlines()) + "\n")
        kit.say("设备", f"记忆写回 {memory_path.relative_to(DEMO_DIR)}：共 {total} 条（下次开机注入系统提示词）")
        price_in, price_out = DIARY_PRICES[cfg.region]
        diary_cost = (tok_in * price_in + tok_out * price_out) / 1e6
        kit.say("统计", f"陪伴 {len(turns)} 轮 · 每轮均值 ¥{kit.fmt_cny(realtime_cost)} · "
                        f"日记 ¥{kit.fmt_cny(diary_cost)}（输入 {tok_in} / 输出 {tok_out} Token）")
        note += f"；日记 ¥{kit.fmt_cny(diary_cost)} 另计"
    kit.finish(cfg, args, DEMO_DIR, models=models, first_ms=turns[0].first_audio_ms, cost=realtime_cost,
               sample=" + ".join(dict.fromkeys(sources)), note=note)


if __name__ == "__main__":
    main()
