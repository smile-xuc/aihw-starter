"""
stream_tag_parser.py — 桌宠「标签嵌入式」流式解析最小 demo

协议（与 02-solution.md 方案 C 一致）：
  <M>happy</M>[emoji-01][action-04]太棒啦！一起去玩吧～

硬约束：
  - 标签可能跨多个 token，必须等完整闭合后再触发
  - 每轮建议最多 1 个 emoji + 1 个 action（本 demo 会统计超限）

用法：
  # 离线：用内置假 token 流验证解析（无需 API Key）
  python stream_tag_parser.py

  # 自定义整段模型输出，按字符切片模拟流式
  python stream_tag_parser.py --text '<M>happy</M>[emoji-01][action-04]太棒啦！'

  # 自定义切片大小（模拟更碎的 token）
  python stream_tag_parser.py --chunk-size 1

⚠️ AI 生成代码，仅作接入参考。嵌入式移植时用同样的「缓冲 + 只删完整标签」逻辑即可。
"""

from __future__ import annotations

import argparse
import re
from dataclasses import dataclass, field

TAG_PAT = re.compile(r"\[(emoji|action)-(\d{2})\]")
EMOTION_PAT = re.compile(r"<M>(\w+)</M>")

DEFAULT_REPLY = "<M>happy</M>[emoji-01][action-04]太棒啦！一起去玩吧～"


@dataclass
class ParseResult:
    emotion: str = "neutral"
    events: list[tuple[str, str]] = field(default_factory=list)
    speech: str = ""
    emoji_count: int = 0
    action_count: int = 0


def _pending_leading_emotion(buf: str) -> bool:
    """buf 开头是否像未写完的 <M>…</M>（协议要求情绪标在最前）。"""
    if not buf.startswith("<"):
        return False
    if EMOTION_PAT.match(buf):
        return False
    return bool(
        re.match(r"^<M?>?$", buf)
        or re.match(r"^<M>\w*$", buf)
        or re.match(r"^<M>\w*<$", buf)  # 「happy<」——下一截才是 /M>
        or re.match(r"^<M>\w*</$", buf)
        or re.match(r"^<M>\w*</M?$", buf)
    )


def _hold_incomplete_tag_suffix(buf: str) -> int:
    """返回应暂扣的尾部长度（未闭合的 [emoji|action-xx] 前缀）。"""
    i = buf.rfind("[")
    if i < 0:
        return 0
    frag = buf[i:]
    if TAG_PAT.fullmatch(frag):
        return 0
    if "]" not in frag:
        return len(frag)
    # 有 ] 但不是合法标签：当普通文本，不暂扣
    return 0


class StreamTagParser:
    """正确处理跨 token 标签：不完整片段留在 buf，绝不提前触发。"""

    def __init__(self) -> None:
        self.buf = ""
        self.emotion = "neutral"
        self.emotion_set = False
        self.events: list[tuple[str, str]] = []
        self.speech_parts: list[str] = []
        self.emoji_count = 0
        self.action_count = 0

    def feed(self, token: str) -> None:
        self.buf += token

        if not self.emotion_set:
            m = EMOTION_PAT.match(self.buf)
            if m:
                self.emotion = m.group(1)
                self.emotion_set = True
                self.events.append(("emotion", self.emotion))
                self.buf = self.buf[m.end() :]
            elif _pending_leading_emotion(self.buf):
                return
            else:
                # 开头不是情绪标签，按默认 emotion 继续
                self.emotion_set = True

        while True:
            m = TAG_PAT.search(self.buf)
            if not m:
                break
            before = self.buf[: m.start()]
            if before:
                self.speech_parts.append(before)
            kind, code = m.group(1), m.group(2)
            self.events.append((kind, code))
            if kind == "emoji":
                self.emoji_count += 1
            else:
                self.action_count += 1
            self.buf = self.buf[m.end() :]

        hold = _hold_incomplete_tag_suffix(self.buf)
        flush_len = len(self.buf) - hold
        if flush_len > 0:
            self.speech_parts.append(self.buf[:flush_len])
            self.buf = self.buf[flush_len:]

    def finish(self) -> ParseResult:
        if self.buf:
            cleaned = TAG_PAT.sub("", EMOTION_PAT.sub("", self.buf))
            if cleaned:
                self.speech_parts.append(cleaned)
            self.buf = ""
        return ParseResult(
            emotion=self.emotion,
            events=list(self.events),
            speech="".join(self.speech_parts),
            emoji_count=self.emoji_count,
            action_count=self.action_count,
        )


def chunk_text(text: str, size: int) -> list[str]:
    if size <= 0:
        raise ValueError("chunk-size must be >= 1")
    return [text[i : i + size] for i in range(0, len(text), size)]


def run(text: str, chunk_size: int) -> ParseResult:
    parser = StreamTagParser()
    print("--- token stream ---")
    for i, tok in enumerate(chunk_text(text, chunk_size), 1):
        print(f"  [{i:02d}] {tok!r}")
        parser.feed(tok)
    result = parser.finish()
    print("--- events (in order) ---")
    for kind, val in result.events:
        if kind == "emotion":
            print(f"  emotion -> {val}   # TTS set_emotion")
        elif kind == "emoji":
            print(f"  emoji   -> screen.play('emoji_{val}')")
        else:
            print(f"  action  -> motor.enqueue('action_{val}')")
    print("--- speech for TTS ---")
    print(f"  {result.speech!r}")
    print("--- checks ---")
    print(f"  emotion={result.emotion}")
    print(f"  emoji_count={result.emoji_count} action_count={result.action_count}")
    if result.emoji_count > 1 or result.action_count > 1:
        print("  WARN: 超过「每轮 1 emoji + 1 action」建议，端侧会动作排队")
    else:
        print("  OK: 标签数量在建议范围内")
    if "<M>" in result.speech or "[emoji-" in result.speech or "[action-" in result.speech:
        print("  WARN: speech 仍含标签残片，解析有误")
    else:
        print("  OK: speech 已去标签")
    return result


def main() -> None:
    ap = argparse.ArgumentParser(description="桌宠流式标签解析 demo")
    ap.add_argument("--text", default=DEFAULT_REPLY, help="一整段模型输出")
    ap.add_argument("--chunk-size", type=int, default=3, help="模拟流式切片长度")
    args = ap.parse_args()
    run(args.text, args.chunk_size)


if __name__ == "__main__":
    main()
