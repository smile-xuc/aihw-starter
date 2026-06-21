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

#### 通义多模态交互开发套件（阿里云百炼 | Aliyun）

> ⚠️ 注意：**这不是「分别调三个 API」**。阿里云把它打包成了一个完整产品——**通义多模态交互开发套件**，你只需要**一条 WebSocket**，就能跑通「听 → 想 → 说」的全双工实时对话，ASR/LLM/TTS 在云端串成一条管线，设备端不再分别调用、不再自己拼中间结果。适合 AI 眼镜、学习机、桌面机器人、智能音箱等需要自然对话的硬件。
>
> 这就是 xiaozhi 背后那类「语音助手后端」的官方版本，而且**模型和算力都在阿里云**，你的硬件只要会录音、放音、连 Wi-Fi 就行。
>
> 官方文档树（**这是一整棵文档，不要只看首页**）：
> - 🏠 [产品总览](https://help.aliyun.com/zh/model-studio/multimodal-products-overview) — 适合什么硬件、能做什么
> - 📚 [文档目录](https://help.aliyun.com/zh/model-studio/multimodal-products/) — 含产品计费 / 使用指南 / SDK 安装 / API 参考 / 最佳实践 / FAQ
> - ⚡ [实时多模态交互协议（WebSocket）](https://help.aliyun.com/zh/model-studio/multimodal-interaction-protocol) — **核心接入方式**，延迟最低、资源占用最少
> - 📡 [客户端事件](https://help.aliyun.com/zh/model-studio/client-events) — `session.update` / `input_audio_buffer.append` 等事件定义
> - 🤖 [Realtime 模型（qwen-omni-turbo-realtime）](https://help.aliyun.com/zh/model-studio/realtime)
> - 📱 [Android SDK](https://help.aliyun.com/zh/model-studio/multimodal-sdk-android) / [Linux C++ SDK](https://help.aliyun.com/zh/model-studio/multimodal-sdk-linux) / [服务端 Python SDK](https://help.aliyun.com/zh/model-studio/multimodal-sdk-python)
> - 💰 [产品计费](https://help.aliyun.com/zh/model-studio/product-billing)

**一条 WebSocket，跑通「听→想→说」**

```
        ┌──────────────────────── 阿里云百炼（一条 WebSocket 全双工）────────────────────────┐
        │                                                                              │
ESP32 ──┼──▶ 上行 PCM 音频流（16kHz/单声道/16bit）──▶ Fun-ASR 语音识别（paraformer 系列）     │
设备    │                                              │                                       │
        │                                              ▼                                       │
        │                                         Qwen 大模型（qwen-plus / qwen3）理解+生成  │
        │                                              │                                       │
        │                                              ▼                                       │
   ◀──┼── 下行 PCM 音频流（流式 TTS）◀── CosyVoice 语音合成（cosyvoice-v3-flash）            │
        └──────────────────────────────────────────────────────────────────────────────┘
```

> 关键点：**识别、思考、合成在云端同一条连接里并发完成**，边听边想边说，全双工、可打断——不是「录完一段→转文字→请求LLM→合成」的串行三步。

**核心模型与组件 | Models & Components**

| 角色 | 模型 / 组件 | 说明 |
|------|------------|------|
| 实时对话主模型 | `qwen-omni-turbo-realtime` | 一条 WebSocket 完成听/看/想/说，OpenAI Realtime 风格事件流 |
| ASR（语音识别） | Fun-ASR（paraformer 系列） | 中英混说、流式、VAD 可配 |
| LLM（对话大脑） | `qwen-plus`（Qwen3 系列） | 理解 + 生成，支持 function calling / MCP / Agent |
| TTS（语音合成） | `cosyvoice-v3-flash` | 流式合成、首包低延迟、音色可克隆 |
| 视觉（可选） | Qwen-VL / 万相 | 「看懂」能力，眼镜/机器人可传图像帧 |

**接入协议 | Protocol**

套件首选 **WebSocket** 接入（低延迟、全双工、资源占用少），也可用官方 SDK 封装。事件流是 OpenAI Realtime API 风格：

| 方向 | 事件 Event | 作用 |
|------|-----------|------|
| 客户端→服务端 | `session.update` | 建连后先发，配置音频格式 / 音色 / 模式 / 指令 |
| 客户端→服务端 | `input_audio_buffer.append` | 持续上传 PCM 音频帧（**16kHz / 单声道 / 16bit / little-endian**） |
| 客户端→服务端 | `input_audio_buffer.commit` | 提交一句话结束，触发模型响应 |
| 服务端→客户端 | `session.updated` | 确认配置生效 |
| 服务端→客户端 | `response.audio.delta` | 流式返回合成语音 PCM（边生成边播） |
| 服务端→客户端 | `response.text.delta` | 流式返回文字（可选，用于显示字幕） |

**步骤 1：在百炼控制台创建应用 + 拿 API Key**

1. 注册阿里云 → 进入 [百炼控制台 bailian.console.aliyun.com](https://bailian.console.aliyun.com)
2. 创建 API Key（`sk-xxx`），**整套件共用一个 Key**
3. 在「多模态交互开发套件」里新建一个应用，选好 ASR / LLM / TTS 组件和音色，拿到 **App ID**
4. 默认限流 10 QPS（每分钟 600 通新会话），调试足够

**步骤 2：Python 直连（PC / 树莓派 / Jetson 网关）**

用官方 `dashscope` SDK 最省事；也可以直接裸 WebSocket。下面是裸 WebSocket 的最小骨架（适合嵌入到自己的网关里）：

```python
# ali_realtime_gateway.py — 通义多模态交互套件 · WebSocket 裸协议最小骨架
# 依赖：pip install websockets pyaudio
# 文档：https://help.aliyun.com/zh/model-studio/multimodal-interaction-protocol
import asyncio, json, websockets, pyaudio

API_KEY = "sk-your-aliyun-key"
# endpoint 以百炼控制台/文档为准，下面是典型形态：
WSS_URL = "wss://dashscope.aliyuncs.com/api-ws/v1/inference/"  # 携带 model / app_id 等参数

async def run():
    headers = {"Authorization": f"bearer {API_KEY}"}
    async with websockets.connect(WSS_URL, additional_headers=headers) as ws:
        # ① 建连后先配会话：音频格式、音色、系统指令 | Configure session after connect
        await ws.send(json.dumps({
            "action": "start",                 # 或 session.update（视协议版本）
            "model": "qwen-omni-turbo-realtime",
            "input": {
                "audio_format": "pcm",          # 上行：16k/单声道/16bit PCM
                "sample_rate": 16000,
            },
            "parameters": {
                "voice": "longxiaochun",        # CosyVoice 音色
                "output_audio_format": "pcm",   # 下行：流式 PCM
                "instructions": "你是一个简洁的语音助手，回答控制在两句以内。",
            }
        }))

        # ② 上行：持续把麦克风 PCM 推上去 | Upstream: stream mic PCM
        async def mic_stream():
            pa = pyaudio.PyAudio()
            stream = pa.open(format=pyaudio.paInt16, channels=1, rate=16000,
                             input=True, frames_per_buffer=3200)
            while True:
                await ws.send(stream.read(3200))   # 二进制 PCM 帧
                await asyncio.sleep(0.1)           # ~100ms 一帧

        # ③ 下行：收 response.audio.delta，喂给扬声器 | Downstream: play TTS PCM
        async def speaker_loop():
            pa = pyaudio.PyAudio()
            out = pa.open(format=pyaudio.paInt16, channels=1, rate=24000, output=True)
            async for msg in ws:
                if isinstance(msg, bytes):         # 二进制 = 合成好的 PCM
                    out.write(msg)
                else:                              # 文本事件（字幕/状态）
                    evt = json.loads(msg)
                    print("event:", evt.get("event") or evt.get("type"))

        await asyncio.gather(mic_stream(), speaker_loop())

asyncio.run(run())
```

> 如果不想自己处理事件流，直接用官方 SDK：
> - Python：[multimodal-sdk-python](https://help.aliyun.com/zh/model-studio/multimodal-sdk-python)
> - Android：[multimodal-sdk-android](https://help.aliyun.com/zh/model-studio/multimodal-sdk-android)（`MultiModalDialog SDK`，音视频端到端实时交互）
> - Linux C++：[multimodal-sdk-linux](https://help.aliyun.com/zh/model-studio/multimodal-sdk-linux)

**步骤 3：ESP32 只做「录音 + 放音」**

ESP32-S3 算力和 TLS 栈有限，**不建议直接连阿里云 WebSocket**。推荐架构：ESP32 走局域网把 PCM 推给上面那个 Python 网关，网关负责鉴权和事件流，回传 PCM 给 ESP32 播放。硬件逻辑极简：

```cpp
// ESP32 端：只负责 I2S 录音 + 播放，PCM 透传给局域网网关
// 完整示例参考 getting-started/01-esp32-voice-assistant.md
const char* gateway = "ws://192.168.1.10:8080";   // 你的 Python 网关

void loop() {
    // 上行：I2S MEMS 麦克风读 16k/单声道 PCM，通过 WebSocket 推给网关
    size_t n = i2s_read_16k_mono(pcm_buf, 3200);
    ws_client.sendBinary(pcm_buf, n);
    // 下行：网关回传的 PCM 自动写进 I2S 扬声器
}
```

**为什么用套件而不是自己拼三段 API？**

| 对比项 | 自己拼 ASR+LLM+TTS | 通义多模态交互套件 |
|--------|--------------------|--------------------|
| 网络往返 | 3 次（识别→对话→合成） | **1 条 WebSocket 全双工** |
| 全双工 / 可打断 | ❌ 难（要自己做状态机） | ✅ 原生支持 |
| 首字延迟 | 高（串行） | 低（管线并发） |
| 多模态（看+听） | 要自己再接视觉 | 一个模型同时听+看 |
| 鉴权 / 计费 | 3 套 | 1 套 |

**计费 | Pricing**

套件按 **Token（文本 + 音频 + 图像统一折算）** 计费，支持后付费（按量）和预付费（设备订阅，按台/年）。语音对话类负载一般用「设备订阅」更划算。详见 [产品计费](https://help.aliyun.com/zh/model-studio/product-billing)，精确单价以 [百炼控制台](https://bailian.console.aliyun.com) 显示为准。

> 💡 **另一个选择**：如果只要纯文本 LLM（不要语音），直接用 [千问云 platform.qianwenai.com](https://platform.qianwenai.com) 的 OpenAI 兼容接口即可——`base_url` 换成千问云、`model` 用 `qwen-plus`，调用方式与上面 DeepSeek 示例完全一致。

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
