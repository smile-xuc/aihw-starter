"""mock.py — 离线假百炼接口（OpenAI 兼容 chat/completions 流式）

与 demo_kit.HttpTransport 同接口（sse），按官方流式响应结构回放：
choices[].delta.content 分片 → 最后一条 choices 为空、带 usage。
- 看图请求：按图片内容（SHA-1）回放 samples/events/ 对应的固定事件卡；其他图片回放一张示意卡
- 检索请求：在请求带来的事件列表上做「时间段 + 关键词」匹配
- 日报请求：按请求带来的事件列表拼一份示意日报
用量按官方口径估算（图片每 32×32 像素 1 Token，文字约 1 字 1 Token），仅为示意值。
"""
from __future__ import annotations

import base64
import datetime as dt
import hashlib
import json
import re
from pathlib import Path

from demo_kit import HttpError

CARDS = {
    "01_door_package.jpg": {
        "title": "门口有快递包裹", "objects": ["快递纸箱", "门垫", "入户门"], "actions": ["包裹放在门口"],
        "event": "快递包裹", "risk_level": "low",
        "description": "入户门前的门垫上放着一个贴有面单的纸箱，门关着，画面里没有人。"},
    "02_cat_sofa_night.jpg": {
        "title": "猫跳上客厅沙发", "objects": ["橘猫", "布艺沙发", "茶几", "落地灯"], "actions": ["跳跃", "跳上沙发"],
        "event": "宠物活动", "risk_level": "low",
        "description": "夜间客厅只开着落地灯，一只橘猫正从地面跃上灰色布艺沙发，周围没有人。"},
    "03_kitchen_kettle.jpg": {
        "title": "燃气灶开着火，厨房无人", "objects": ["燃气灶", "水壶", "蓝色火焰", "蒸汽"], "actions": ["烧水冒蒸汽"],
        "event": "用火用电", "risk_level": "medium",
        "description": "燃气灶开着火在烧水，壶嘴冒出蒸汽，厨房里没有人，建议确认有人照看。"},
    "04_vacuum_dog_morning.jpg": {
        "title": "扫地机器人清扫，柯基趴着", "objects": ["扫地机器人", "柯基犬", "地毯"],
        "actions": ["扫地机器人清扫", "狗趴在地毯上"], "event": "宠物活动", "risk_level": "low",
        "description": "白天客厅光线充足，扫地机器人在木地板上清扫，一只柯基趴在地毯上看着它，画面无异常。"},
}
UNKNOWN_CARD = {
    "title": "画面无明显异常", "objects": ["无法确认"], "actions": ["无法确认"], "event": "无异常", "risk_level": "low",
    "description": "（mock 示意）这张图不在样本里，离线模式只回放示意事件卡；填 Key 后由模型真实分析。"}
# 时间词 → 相对「今天 0 点」的小时区间，与 run.py 检索提示词里的定义一致
WINDOWS = {"昨晚": (-6, 6), "今早": (6, 12), "早上": (6, 12), "昨天": (-24, 0), "今天": (0, 24)}


def _image_tokens(data: bytes) -> int:
    """解析 JPEG 尺寸，按每 32×32 像素 1 Token 估算；解析不了按 640×480。"""
    width, height, i = 640, 480, 2
    while data[:2] == b"\xff\xd8" and i + 9 < len(data) and data[i] == 0xFF:
        marker, length = data[i + 1], int.from_bytes(data[i + 2:i + 4], "big")
        if marker in (0xC0, 0xC1, 0xC2):
            height, width = int.from_bytes(data[i + 5:i + 7], "big"), int.from_bytes(data[i + 7:i + 9], "big")
            break
        i += 2 + length
    return max(4, round(width / 32) * round(height / 32))


def _bigrams(text: str) -> set[str]:
    words = re.sub(r"[^\u4e00-\u9fff]", " ", text).split()
    return {w[i:i + 2] for w in words for i in range(len(w) - 1)}


def _parse(prompt: str) -> tuple[dt.datetime, list[dict]]:
    now = re.search(r"现在时间：(\d{4}-\d{2}-\d{2} \d{2}:\d{2})", prompt)
    start = prompt.find("[", prompt.find("事件列表"))
    if not now or start < 0:
        raise HttpError("mock：请求里没有「现在时间」或事件列表")
    events, _ = json.JSONDecoder().raw_decode(prompt, start)
    return dt.datetime.strptime(now.group(1), "%Y-%m-%d %H:%M"), events


class MockHttp:
    def __init__(self, samples_dir: Path):
        self.cards = {}
        for name, card in CARDS.items():
            path = samples_dir / "events" / name
            if path.is_file():
                self.cards[hashlib.sha1(path.read_bytes()).hexdigest()] = card

    def sse(self, url: str, headers: dict, payload: dict, timeout: float = 120):
        if not url.endswith("/chat/completions") or not payload.get("stream"):
            raise HttpError(f"mock：未模拟的接口 {url}")
        if payload.get("enable_thinking") is not False:
            raise HttpError("mock：Qwen3.x 默认开思考，硬件交互要显式传 enable_thinking=false")
        content = payload["messages"][-1]["content"]
        if isinstance(content, list):
            text, prompt = self._vision(content)
        elif (payload.get("response_format") or {}).get("type") == "json_object":
            text, prompt = self._ask(content), len(content)
        else:
            text, prompt = self._daily(content), len(content)
        for i in range(0, len(text), 24):
            yield {"choices": [{"index": 0, "delta": {"content": text[i:i + 24]}}]}
        yield {"choices": [], "usage": {"prompt_tokens": prompt, "completion_tokens": len(text),
                                        "total_tokens": prompt + len(text)}}

    def _vision(self, content: list) -> tuple[str, int]:
        image = next(part["image_url"]["url"] for part in content if part.get("type") == "image_url")
        data = base64.b64decode(image.split(",", 1)[1])
        card = self.cards.get(hashlib.sha1(data).hexdigest(), UNKNOWN_CARD)
        prompt = _image_tokens(data) + sum(len(part.get("text") or "") for part in content)
        return json.dumps(card, ensure_ascii=False), prompt

    @staticmethod
    def _ask(prompt: str) -> str:
        now, events = _parse(prompt)
        match = re.search(r"问题：(.*)", prompt)
        question = match.group(1) if match else ""
        label = next((w for w in WINDOWS if w in question), None)
        midnight = now.replace(hour=0, minute=0)
        scored = []
        for event in events:
            when = dt.datetime.strptime(event["time"], "%Y-%m-%d %H:%M:%S")
            if label and not (dt.timedelta(hours=WINDOWS[label][0]) <= when - midnight
                              < dt.timedelta(hours=WINDOWS[label][1])):
                continue
            # 只看标题、类型、位置、对象和动作：描述里常有「没有人」之类的否定句，会造成误命中
            text = " ".join([str(event.get(k, "")) for k in ("title", "event", "camera")]
                            + list(event.get("objects") or []) + list(event.get("actions") or []))
            hits = sorted(_bigrams(question) & _bigrams(text))
            if hits:
                scored.append((len(hits), event, hits))
        scored.sort(key=lambda item: -item[0])
        when_text = f"时间在{label}，" if label else ""
        matches = [{"id": e["id"], "reason": f"（mock 关键词匹配）{when_text}命中「{'、'.join(hits)}」"}
                   for _, e, hits in scored[:3]]
        if matches:
            top = scored[0][1]
            answer = f"找到 {len(matches)} 段，最相关的是 {top['time'][5:16]} {top['camera']}：{top['title']}。"
        else:
            answer = "没找到相关事件。"
        return json.dumps({"matches": matches, "answer": answer}, ensure_ascii=False)

    @staticmethod
    def _daily(prompt: str) -> str:
        now, events = _parse(prompt)
        attention = [e for e in events if e.get("risk_level") in ("medium", "high")]
        lines = [f"# 家庭看护日报 · {now:%Y-%m-%d}", "",
                 f"最近一天记录 {len(events)} 个事件，{len(attention)} 个需要留意。", "", "## 需要留意"]
        lines += [f"- {e['time'][11:16]} {e['camera']} · {e['title']}：请确认现场情况" for e in attention] or ["- 无"]
        lines += ["", "## 时间线"] + [f"- {e['time'][11:16]} {e['camera']} · {e['title']}" for e in events]
        lines += ["", "## 小结", "（mock 示意）离线模式按事件列表拼出日报；填 Key 后由模型撰写。"]
        return "\n".join(lines)
