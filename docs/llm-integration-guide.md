# 🧠 大模型接入指南 | LLM Integration Guide

> 如何为你的 AI 硬件项目选择和接入大语言模型

---

## 📊 三层方案对比 | Three-Layer Comparison

| 方案 Approach | 延迟 Latency | 成本 Cost | 隐私 Privacy | 适合 Suitable For |
|-------------|------------|----------|------------|------------------|
| ☁️ 云端 API | 200-2000ms | 按 token 付费 | 数据上传 | 快速原型、复杂对话 |
| 🖥️ 本地部署 | 50-500ms | 电费+硬件 | 100% 本地 | 隐私敏感、离线场景 |
| 🔌 端侧推理 | 10-200ms | 一次性硬件 | 100% 设备端 | ESP32/MCU 极低延迟 |

---

## ☁️ 方案一：云端 API | Cloud API

### 推荐模型 | Recommended Models

| 模型 Model | API | 价格 Price | 中文 Chinese | 特点 Feature |
|-----------|-----|----------|------------|-------------|
| **DeepSeek V3** | `api.deepseek.com` | ¥1-2/百万 token | ⭐⭐⭐⭐⭐ | 性价比之王、中文最强 |
| **通义千问 Qwen** | `dashscope.aliyun.com` | ¥0.8-4/百万 token | ⭐⭐⭐⭐⭐ | 阿里云、免费额度 |
| **GLM-4 Flash** | `open.bigmodel.cn` | 免费（有额度） | ⭐⭐⭐⭐ | 智谱 AI、免费额度大 |
| **GPT-4o mini** | `api.openai.com` | $0.15-0.6/百万 token | ⭐⭐⭐⭐ | OpenAI、全球可用 |
| **Claude 3.5 Haiku** | `api.anthropic.com` | $0.25-1.25/百万 token | ⭐⭐⭐ | Anthropic、长文本 |

### 快速接入代码 | Quick Integration

#### Python（通用 | Universal）

```python
import requests

# DeepSeek API 示例 | DeepSeek API Example
def chat_with_llm(message: str) -> str:
    response = requests.post(
        "https://api.deepseek.com/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {YOUR_API_KEY}",
            "Content-Type": "application/json"
        },
        json={
            "model": "deepseek-chat",
            "messages": [{"role": "user", "content": message}],
            "max_tokens": 512,
        }
    )
    return response.json()["choices"][0]["message"]["content"]

# 使用 | Usage
reply = chat_with_llm("你好，请介绍一下你自己")
print(reply)
```

#### 裸协议接入：Fun-ASR + Qwen3 + CosyVoice（阿里云 | Aliyun）

> 如果你不想用 xiaozhi 这类封装好的框架，而是想自己用 **ASR + LLM + TTS** 三段式管线搭一个语音助手，阿里云百炼（DashScope）是最完整的「裸协议」方案：组件齐全、OpenAI 兼容、有免费额度、国内延迟低。适合 AI 眼镜、桌面机器人、学习机、智能音箱等需要「说话→理解→回答」的硬件。
>
> 官方文档：
> - [通义多模态交互开发套件总览](https://help.aliyun.com/zh/model-studio/multimodal-products-overview)
> - [千问云开放平台（OpenAI 兼容）](https://platform.qianwenai.com/docs/developer-guides/getting-started/introduction)

**三段式语音管线 | Three-Stage Voice Pipeline**

```
麦克风 Mic ──▶ ① Fun-ASR（语音转文字）──▶ ② Qwen3（理解 + 生成）──▶ ③ CosyVoice（文字转语音）──▶ 扬声器 Speaker
                    paraformer-v2             qwen-plus                  cosyvoice-v3-flash
```

| 环节 Stage | 推荐模型 Model | 说明 |
|-----------|---------------|------|
| ① 语音识别 ASR | `paraformer-v2`（Fun-ASR 系列） | 中英混说、流式可选、低延迟 |
| ② 大模型对话 LLM | `qwen-plus`（Qwen3 系列） | OpenAI 兼容、支持 function calling |
| ③ 语音合成 TTS | `cosyvoice-v3-flash` | 流式合成、首包延迟低、音色可克隆 |

**步骤 1：获取 API Key**

注册阿里云百炼 → [bailian.console.aliyun.com](https://bailian.console.aliyun.com) → 创建 API Key（`sk-xxx`）。三个组件共用同一个 Key，无需分别申请。

**步骤 2：Python 网关（跑在 PC/树莓派/Jetson 上）**

ESP32 算力和 TLS 栈有限，推荐用一个 Python 网关把三段串起来，硬件只负责录音和放音：

```python
# voice_gateway.py — 裸协议三段式语音网关
# 依赖：pip install openai pyaudio dashscope sounddevice numpy
import io, json, base64, pyaudio
from openai import OpenAI
import dashscope
from dashscope.audio.asr import Recognition, RecognitionCallback, RecognitionResult
from dashscope.audio.tts_v2 import SpeechSynthesizer, ResultCallback, AudioFormat

API_KEY = "sk-your-aliyun-key"

# ② LLM —— 走 OpenAI 兼容协议（千问云 / DashScope 均可）
llm = OpenAI(
    api_key=API_KEY,
    base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",  # OpenAI 兼容入口
)

def ask_llm(user_text: str, history: list) -> str:
    history.append({"role": "user", "content": user_text})
    resp = llm.chat.completions.create(
        model="qwen-plus",          # Qwen3 系列，也可换 qwen-turbo / qwen-max
        messages=history,
        stream=False,
    )
    reply = resp.choices[0].message.content
    history.append({"role": "assistant", "content": reply})
    return reply

# ① ASR —— Fun-ASR 流式识别
def recognize_mic(on_text):
    class Cb(RecognitionCallback):
        def on_complete(self): pass
        def on_error(self, r): print("ASR error", r)
        def on_event(self, r: RecognitionResult):
            if r.is_sentence_end:          # 一句话说完
                on_text(r.get_sentence())  # 回调把文字喂给 LLM
    rec = Recognition(
        model="paraformer-v2",
        format="pcm", sample_rate=16000,
        callback=Cb(),
    )
    rec.start()
    # 这里把麦克风 PCM 流持续喂给 rec.send_audio_frame(buf)
    # ...（用 pyaudio/sounddevice 抓 16k 单声道）

# ③ TTS —— CosyVoice 流式合成
def speak(text: str, on_pcm):
    class Cb(ResultCallback):
        def on_open(self): pass
        def on_complete(self): pass
        def on_error(self, e): print("TTS error", e)
        def on_data(self, data: bytes): on_pcm(data)  # PCM 喧给扬声器
    synth = SpeechSynthesizer(
        model="cosyvoice-v3-flash",
        voice="longxiaochun",            # 内置音色，也可上传样本克隆
        format=AudioFormat.PCM_22050HZ_MONO_16BIT,
        callback=Cb(),
    )
    synth.streaming_call(text)
    synth.streaming_complete()

# 主循环 | Main loop
history = [{"role": "system", "content": "你是一个简洁的语音助手，回答控制在两句以内。"}]
def on_user_text(t):
    print("用户:", t)
    reply = ask_llm(t, history)
    print("助手:", reply)
    speak(reply, on_pcm=lambda pcm: play_audio(pcm))  # 喇叭放音
recognize_mic(on_user_text)
```

**步骤 3：ESP32 只做「录音 + 放音」**

ESP32 通过 Wi-Fi 把 16kHz PCM 流推给上面的 Python 网关（WebSocket/UDP/HTTP 均可），网关回传合成好的 PCM。这样硬件逻辑极简：

```cpp
// ESP32 端伪代码（录音 → 推流 → 播放回传 PCM）
// 完整示例参考 getting-started/01-esp32-voice-assistant.md
WiFiClient client;
const char* gateway = "192.168.1.10:8080";  // Python 网关地址

void loop() {
    auto pcm = i2s_read_16k_mono();          // I2S MEMS 麦克风
    websocket_send(pcm);                      // 推给网关做 ASR+LLM+TTS
    // 网关回传的 PCM 自动进 I2S 扬声器播放
}
```

**成本估算 | Cost Estimate**（阿里云百炼零售价）

| 环节 | 单价 | 一次对话（约 10s 语音） |
|------|------|----------------------|
| Fun-ASR paraformer-v2 | ¥0.4 / 小时音频 | ≈ ¥0.001 |
| Qwen-plus | ¥0.8 / 百万 input token | ≈ ¥0.001 |
| CosyVoice-v3-flash | ¥0.2 / 万字符 | ≈ ¥0.002 |
| **合计** | | **≈ ¥0.004 / 次对话** |

> 也可以用 [千问云 platform.qianwenai.com](https://platform.qianwenai.com) 的 OpenAI 兼容接口替换 LLM 段，调用方式完全一致，只需改 `base_url` 和 `model`。

#### ESP32 + xiaozhi（C++ | Arduino）

```cpp
// xiaozhi-esp32 已内置云端 LLM 接入
// 只需在 Web 配置页填入 API Key 即可
// xiaozhi-esp32 has built-in cloud LLM integration
// Just enter your API Key in the web config page

// 自定义接入 | Custom integration
#include <HTTPClient.h>

String callLLM(String prompt) {
    HTTPClient http;
    http.begin("https://api.deepseek.com/v1/chat/completions");
    http.addHeader("Authorization", "Bearer " + apiKey);
    http.addHeader("Content-Type", "application/json");

    String body = "{\"model\":\"deepseek-chat\",\"messages\":[{\"role\":\"user\",\"content\":\"" + prompt + "\"}]}";

    int code = http.POST(body);
    if (code > 0) {
        String response = http.getString();
        // 解析 JSON 响应 | Parse JSON response
        // ...
    }
    http.end();
}
```

### 如何获取 API Key | How to Get API Keys

| 平台 Platform | 注册链接 | 免费额度 Free Tier |
|-------------|---------|------------------|
| **阿里云百炼** | [bailian.console.aliyun.com](https://bailian.console.aliyun.com) | Qwen/Fun-ASR/CosyVoice 均有免费额度，ASR+LLM+TTS 一站式 |
| **千问云** | [platform.qianwenai.com](https://platform.qianwenai.com) | OpenAI 兼容，新用户送额度 |
| DeepSeek | [platform.deepseek.com](https://platform.deepseek.com) | 注册送 ¥10 |
| 通义千问 | [dashscope.console.aliyun.com](https://dashscope.console.aliyun.com) | Qwen-Turbo 免费 100 万 token |
| 智谱 GLM | [open.bigmodel.cn](https://open.bigmodel.cn) | GLM-4 Flash 持续免费 |
| OpenAI | [platform.openai.com](https://platform.openai.com) | 无免费额度（需绑卡） |

---

## 🖥️ 方案二：本地部署 | Local Deployment

### 推荐工具 | Recommended Tools

| 工具 Tool | 适合模型 | 硬件要求 | 特点 |
|----------|---------|---------|------|
| **[Ollama](https://ollama.ai)** | Llama/Qwen/DeepSeek | 8GB+ RAM | 最简单的一键部署 |
| **[llama.cpp](https://github.com/ggerganov/llama.cpp)** | GGUF 模型 | 4GB+ RAM | 轻量、跨平台、量化推理 |
| **[vLLM](https://github.com/vllm-project/vllm)** | 全部 HF 模型 | NVIDIA GPU | 高吞吐、生产级 |

### Ollama 快速开始 | Ollama Quick Start

```bash
# 安装 | Install
curl -fsSL https://ollama.ai/install.sh | sh

# 运行 Qwen 2.5 (7B) | Run Qwen 2.5
ollama run qwen2.5:7b

# 运行 DeepSeek-R1 (7B 蒸馏) | Run DeepSeek-R1
ollama run deepseek-r1:7b

# API 模式（与 OpenAI 兼容）| API mode (OpenAI-compatible)
ollama serve  # 默认 localhost:11434
```

```python
# Python 调用本地 Ollama | Call local Ollama
import requests

response = requests.post(
    "http://localhost:11434/api/chat",
    json={
        "model": "qwen2.5:7b",
        "messages": [{"role": "user", "content": "你好"}],
        "stream": False
    }
)
print(response.json()["message"]["content"])
```

### ESP32 连接本地 Ollama | ESP32 → Local Ollama

```cpp
// ESP32 连接局域网内的 Ollama | ESP32 → LAN Ollama
HTTPClient http;
http.begin("http://192.168.1.100:11434/api/chat");
http.addHeader("Content-Type", "application/json");

String body = R"({"model":"qwen2.5:7b","messages":[{"role":"user","content":"你好"}],"stream":false})";
http.POST(body);
```

---

## 🔌 方案三：端侧推理 | On-Device Inference

### 适用场景 | Use Cases

| 平台 Platform | 框架 Framework | 模型大小 Model Size | 场景 |
|-------------|---------------|-------------------|------|
| ESP32-S3 | **ESP-SR** (乐鑫官方) | 唤醒词/命令词 | 语音唤醒、离线命令 |
| ESP32-S3 | **ESP-DR** | 人脸检测 | 离线人脸识别 |
| RP2040 | **TensorFlow Lite Micro** | <1MB | TinyML 传感器分类 |
| STM32 | **X-CUBE-AI** | <2MB | 工业边缘推理 |
| Jetson | **TensorRT** | 任意 | GPU 加速视觉 |
| K210 | **Kendryte KPU** | <6MB | 人脸/物体检测 |

### ESP32-S3 语音唤醒示例 | ESP32-S3 Wake Word

```cpp
// 使用乐鑫 ESP-SR 离线唤醒词 | Use Espressif ESP-SR offline wake word
#include "esp_afe_sr_models.h"
#include "esp_process_sdkconfig.h"

// "Hi 乐鑫" 唤醒词（内置）| "Hi Lexin" wake word (built-in)
// 无需网络，完全离线 | No network, fully offline
// 响应时间 <200ms
```

---

## 🎯 选型决策树 | Decision Tree

```
你的项目需要 LLM？
├── 是 → 需要联网吗？
│   ├── 是（有 Wi-Fi）→
│   │   ├── 预算敏感 → DeepSeek API（¥1/百万 token）
│   │   ├── 需要隐私 → 本地 Ollama + Qwen 2.5
│   │   └── 要求最高 → GPT-4o / Claude API
│   └── 否（离线/低延迟）→
│       ├── ESP32 → ESP-SR（唤醒词/命令词）
│       ├── Jetson → TensorRT + 本地模型
│       └── Pi → Ollama + 小模型（1.5B-7B）
└── 否（仅传感器/运动控制）→ 不需要 LLM
```

---

## 🔗 更多资源 | More Resources

- [Ollama 模型库](https://ollama.ai/library) — 所有可用模型
- [HuggingFace Models](https://huggingface.co/models) — 开源模型仓库
- [ESP-SR 文档](https://github.com/espressif/esp-sr) — ESP32 语音识别
- [TinyML Book](https://www.oreilly.com/library/view/tinyml/9781492052036/) — MCU 上运行 ML

---

*最后更新：2026-06-21*
