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
