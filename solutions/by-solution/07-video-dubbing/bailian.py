"""bailian.py — 流水线里所有百炼接口调用：临时存储上传、异步转写、omni 校正 / 盲测、翻译、声音复刻、语音合成。

接口与参数以官方文档为准（查证 2026-10-02）：
  录音文件识别 HTTP API  https://help.aliyun.com/zh/model-studio/fun-asr-recorded-speech-recognition-http-api
  Qwen-Omni             https://help.aliyun.com/zh/model-studio/qwen-omni
  声音复刻 HTTP API      https://help.aliyun.com/zh/model-studio/cosyvoice-clone-design-api
  非实时语音合成         https://help.aliyun.com/zh/model-studio/non-realtime-tts-user-guide
地址一律从 demo_kit.Config 取，不写死域名。
"""
from __future__ import annotations

import base64
import json
import re
import time
from dataclasses import dataclass, field
from pathlib import Path

import demo_kit as kit

ASR_MODEL = "qwen-audio-3.0-asr-flash-filetrans"   # 词级时间戳 + 说话人分离；时间戳的唯一来源
OMNI_MODEL = "qwen3.8-omni-flash"                  # 听原声 + 读转写稿：说话人重标注、身份、情绪卡、同音字建议；成片盲测
TRANSLATE_MODEL = "qwen3.8-flash"                  # 口语化翻译 + 音节预算
TRANSLATE_MODEL_CHEAP = "qwen3.7-flash"            # --cheap
TTS_MODEL = "qwen-audio-3.0-tts-plus"              # 声音复刻音色 + instruction 情绪控制
ENROLL_MODEL = "voice-enrollment"                  # Qwen-Audio-TTS / CosyVoice 声音复刻
FALLBACK_VOICE = "longanhuan_v3.6"                 # 没有授权或参考音频不足时用的系统音色
MAX_AUDIO_BASE64 = 10 * 1024 * 1024                # qwen3.8-omni-flash：音频 Base64 后 <10 MB
POLL_SECONDS, POLL_TIMEOUT = 3, 1800

# 单价（查证 2026-10-02，https://help.aliyun.com/zh/model-studio/model-pricing）
#   转写按音频时长（元 / 秒）；omni、翻译按 Token（元 / 百万 Token）；合成按字符（元 / 万字符，一个汉字算 2 个字符）
#   声音复刻的单价官方价格页未单列 voice-enrollment，按 0 计，待实测核对（见 README「待实测」）
PRICES = {
    "cn-beijing": {"asr_per_s": 0.00022, "omni_in": 0.8, "omni_out": 2.7, "qwen3.8-flash": (0.8, 2.7),
                   "qwen3.7-flash": (0.2, 0.8), "tts_per_10k": 1.4},
    "ap-southeast-1": {"asr_per_s": 0.00026, "omni_in": 1.094, "omni_out": 3.427, "qwen3.8-flash": (1.094, 3.427),
                       "qwen3.7-flash": (0.225, 0.974), "tts_per_10k": None},
}


@dataclass
class Usage:
    asr_seconds: float = 0
    omni_tokens: list = field(default_factory=lambda: [0, 0])
    llm_tokens: list = field(default_factory=lambda: [0, 0])
    tts_chars: int = 0
    voices: int = 0

    def cost(self, region: str, llm_model: str) -> dict:
        p = PRICES[region]
        llm_in, llm_out = p[llm_model]
        items = {
            "asr": self.asr_seconds * p["asr_per_s"],
            "omni": (self.omni_tokens[0] * p["omni_in"] + self.omni_tokens[1] * p["omni_out"]) / 1e6,
            "translate": (self.llm_tokens[0] * llm_in + self.llm_tokens[1] * llm_out) / 1e6,
            "tts": self.tts_chars * (p["tts_per_10k"] or 0) / 1e4,
        }
        items["total"] = sum(items.values())
        return {k: round(v, 4) for k, v in items.items()}


class Client:
    def __init__(self, cfg: kit.Config, llm_model: str = TRANSLATE_MODEL):
        self.cfg, self.http, self.usage, self.llm_model = cfg, kit.HttpTransport(), Usage(), llm_model

    # ───────────── 临时存储（oss://，48 小时；官方注明不用于生产） ─────────────

    def upload_temp(self, path: Path, model: str) -> str:
        query = f"/uploads?action=getPolicy&model={model}"
        try:
            resp = self.http.json("GET", self.cfg.api_base() + query, self.cfg.headers())
        except kit.HttpError as exc:
            if exc.status != 404 or not self.cfg.workspace_id:
                raise
            kit.say("提示", "业务空间专属域名没有上传凭证接口（404），改用通用域名获取")
            resp = self.http.json("GET", self.cfg.shared_api_base() + query, self.cfg.headers())
        policy = resp.get("data") or {}
        if not policy.get("upload_host"):
            raise kit.HttpError(f"获取上传凭证失败：{json.dumps(policy, ensure_ascii=False)[:200]}")
        key = f"{policy['upload_dir']}/{int(time.time() * 1000)}{path.suffix.lower()}"
        fields = {  # 字段顺序与官方示例一致；file 必须是最后一个字段
            "OSSAccessKeyId": policy["oss_access_key_id"], "Signature": policy["signature"],
            "policy": policy["policy"], "x-oss-object-acl": policy["x_oss_object_acl"],
            "x-oss-forbid-overwrite": policy["x_oss_forbid_overwrite"], "key": key, "success_action_status": "200",
        }
        self.http.multipart(policy["upload_host"], fields, "file", key.rsplit("/", 1)[-1], path.read_bytes())
        return f"oss://{key}"

    @staticmethod
    def _oss_headers(url: str, **extra: str) -> dict:
        if url.startswith("oss://"):
            extra["X-DashScope-OssResourceResolve"] = "enable"   # 不带这个头，服务端解析不了 oss:// 地址
        return extra

    # ───────────── ① 多说话人转写 ─────────────

    def transcribe(self, url: str, language: str | None, speakers: int | None) -> dict:
        parameters: dict = {"channel_id": [0], "diarization_enabled": True}
        if speakers:
            parameters["speaker_count"] = speakers
        if language:
            parameters["language_hints"] = [language]
        payload = {"model": ASR_MODEL, "input": {"file_urls": [url]}, "parameters": parameters}
        submit = self.http.json("POST", f"{self.cfg.api_base()}/services/audio/asr/transcription",
                                self.cfg.headers(**self._oss_headers(url, **{"X-DashScope-Async": "enable"})), payload)
        task_id = (submit.get("output") or {}).get("task_id")
        if not task_id:
            raise kit.HttpError(f"提交转写任务失败：{json.dumps(submit, ensure_ascii=False)[:300]}")
        kit.say("云端", f"转写任务 {task_id} 已提交，轮询中")
        deadline = time.monotonic() + POLL_TIMEOUT
        while True:
            task = self.http.json("GET", f"{self.cfg.api_base()}/tasks/{task_id}", self.cfg.headers())
            output = task.get("output") or {}
            status = output.get("task_status")
            if status == "SUCCEEDED":
                break
            if status in ("FAILED", "UNKNOWN", "CANCELED") or time.monotonic() > deadline:
                raise kit.HttpError(f"转写任务 {status or '超时'}：{json.dumps(output, ensure_ascii=False)[:300]}")
            time.sleep(POLL_SECONDS)
        results = output.get("results") or []
        if not results or results[0].get("subtask_status") != "SUCCEEDED":
            raise kit.HttpError(f"子任务失败：{json.dumps(results, ensure_ascii=False)[:300]}")
        result = json.loads(self.http.get_bytes(results[0]["transcription_url"]).decode("utf-8"))
        self.usage.asr_seconds += float((task.get("usage") or {}).get("duration") or 0)
        return result

    # ───────────── OpenAI 兼容：omni 与翻译 ─────────────

    def _chat(self, model: str, messages: list, *, omni: bool) -> str:
        payload: dict = {"model": model, "messages": messages, "stream": True,
                         "stream_options": {"include_usage": True}}
        if omni:
            payload.update({"modalities": ["text"], "reasoning_effort": "none"})
        else:
            payload.update({"enable_thinking": False, "response_format": {"type": "json_object"}})
        text, usage = [], {}
        for chunk in self.http.sse(f"{self.cfg.compatible_base()}/chat/completions", self.cfg.headers(), payload,
                                   timeout=600):
            for choice in chunk.get("choices") or []:
                text.append((choice.get("delta") or {}).get("content") or "")
            usage = chunk.get("usage") or usage
        bucket = self.usage.omni_tokens if omni else self.usage.llm_tokens
        bucket[0] += int(usage.get("prompt_tokens") or 0)
        bucket[1] += int(usage.get("completion_tokens") or 0)
        return "".join(text)

    def omni_json(self, mp3: Path, prompt: str) -> dict:
        audio = base64.b64encode(mp3.read_bytes()).decode()
        if len(audio) >= MAX_AUDIO_BASE64:
            raise kit.HttpError(f"{mp3.name} Base64 后 {len(audio) / 1e6:.1f} MB，超过 omni 的 10 MB 上限；"
                                "请先剪短视频，或调低 media.to_mp3 的码率")
        content = [{"type": "input_audio", "input_audio": {"data": f"data:;base64,{audio}", "format": "mp3"}},
                   {"type": "text", "text": prompt}]
        return parse_json(self._chat(OMNI_MODEL, [{"role": "user", "content": content}], omni=True))

    def llm_json(self, system: str, user: str) -> dict:
        return parse_json(self._chat(self.llm_model, [{"role": "system", "content": system},
                                                      {"role": "user", "content": user}], omni=False))

    # ───────────── ⑦ 声音复刻 + 语音合成 ─────────────

    def enroll(self, ref_url: str, prefix: str, ref_seconds: float) -> str:
        payload = {"model": ENROLL_MODEL, "input": {
            "action": "create_voice", "target_model": TTS_MODEL, "prefix": prefix, "url": ref_url,
            "language_hints": ["zh"], "max_prompt_audio_length": min(30.0, max(3.0, round(ref_seconds, 1))),
            "enable_preprocess": True}}
        resp = self.http.json("POST", f"{self.cfg.api_base()}/services/audio/tts/customization",
                              self.cfg.headers(**self._oss_headers(ref_url)), payload, timeout=120)
        voice = (resp.get("output") or {}).get("voice_id")
        if not voice:
            raise kit.HttpError(f"创建复刻音色失败：{json.dumps(resp, ensure_ascii=False)[:300]}")
        self.usage.voices += 1
        return voice

    def delete_voice(self, voice_id: str) -> None:
        payload = {"model": ENROLL_MODEL, "input": {"action": "delete_voice", "voice_id": voice_id}}
        self.http.json("POST", f"{self.cfg.api_base()}/services/audio/tts/customization", self.cfg.headers(), payload)

    def synthesize(self, text: str, voice: str, language: str, instruction: str | None, rate: float) -> bytes:
        body: dict = {"text": text, "voice": voice, "format": "wav", "sample_rate": 24000,
                      "rate": round(min(2.0, max(0.5, rate)), 2), "language_hints": [language],
                      "enable_aigc_tag": True}   # 在音频里写入 AIGC 隐性标识
        if instruction:
            body["instruction"] = instruction
        resp = self.http.json("POST", f"{self.cfg.api_base()}/services/audio/tts/SpeechSynthesizer",
                              self.cfg.headers(), {"model": TTS_MODEL, "input": body}, timeout=120)
        url = ((resp.get("output") or {}).get("audio") or {}).get("url")
        if not url:
            raise kit.HttpError(f"合成失败：{json.dumps(resp, ensure_ascii=False)[:300]}")
        self.usage.tts_chars += int((resp.get("usage") or {}).get("characters") or tts_chars(text))
        return self.http.get_bytes(url, timeout=120)


def tts_chars(text: str) -> int:
    """按官方口径估算计费字符：汉字（含日文汉字、韩文）算 2 个，其余算 1 个。"""
    return sum(2 if re.match(r"[\u3400-\u9fff\uf900-\ufaff\uac00-\ud7a3]", c) else 1 for c in text)


def trim_instruction(text: str, limit: int = 100) -> str:
    """instruction 不超过 100 字符（汉字算 2 个）。"""
    out, used = [], 0
    for c in text.strip():
        used += tts_chars(c)
        if used > limit:
            break
        out.append(c)
    return "".join(out)


def parse_json(text: str) -> dict:
    """模型偶尔会把 JSON 包在 ```json 代码块里，或前后带一句话；取最外层的花括号。"""
    start, end = text.find("{"), text.rfind("}")
    if start < 0 or end <= start:
        raise kit.HttpError(f"模型没有返回 JSON：{text[:200]}")
    return json.loads(text[start:end + 1])
