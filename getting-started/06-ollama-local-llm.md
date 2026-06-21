# 🖥️ 本地 LLM 部署入门 | Local LLM Deployment

> 基于 [Ollama](https://ollama.ai)，在你的电脑/树莓派/Jetson 上运行大模型

---

## 📋 项目简介 | Overview

Ollama 是最简单的一键本地大模型部署工具。无需 GPU（有更好），在普通笔记本上就能运行 Llama/Qwen/DeepSeek 等开源大模型。本教程教你从零部署，并连接到硬件项目。

**你会学到 | You'll Learn**：
- Ollama 安装与模型下载
- OpenAI 兼容 API 本地部署
- 连接 ESP32/树莓派/Jetson 硬件
- 量化模型选择（内存优化）

**适合人群 | Who It's For**：想在硬件项目中使用 AI 但不依赖云 API 的开发者

---

## 🛒 硬件需求 | Hardware Requirements

| 设备 Device | 推荐模型 Model | 内存 RAM | 体验 Experience |
|------------|--------------|---------|----------------|
| 笔记本 (M1/M2 Mac) | Qwen2.5:7B | 8GB+ | ⭐⭐⭐⭐ 流畅 |
| 笔记本 (Intel/AMD) | Qwen2.5:3B | 8GB+ | ⭐⭐⭐ 可用 |
| 树莓派 5 (8GB) | Qwen2.5:1.5B | 8GB | ⭐⭐ 较慢 |
| Jetson Orin Nano | Qwen2.5:7B | 8GB | ⭐⭐⭐ 可用 |
| 工作站 (RTX 4090) | DeepSeek-R1:32B | 32GB+ | ⭐⭐⭐⭐⭐ 极速 |

---

## 💻 安装 | Installation

### macOS / Linux

```bash
curl -fsSL https://ollama.ai/install.sh | sh
```

### Windows

下载 [OllamaSetup.exe](https://ollama.ai/download/windows)

### 验证安装 | Verify

```bash
ollama --version
# Ollama version 0.x.x
```

---

## 🚀 运行模型 | Run Models

### 中文最佳模型 | Best for Chinese

```bash
# 通义千问 2.5 (7B) - 中文最强开源
ollama run qwen2.5:7b

# DeepSeek-R1 蒸馏版 (7B) - 推理能力强
ollama run deepseek-r1:7b

# 小模型 (1.5B) - 树莓派可跑
ollama run qwen2.5:1.5b
```

### API 模式 | API Mode

```bash
# Ollama 默认在 localhost:11434 提供 OpenAI 兼容 API
ollama serve  # 前台运行（或已自动后台运行）

# 测试 API | Test API
curl http://localhost:11434/api/chat -d '{
  "model": "qwen2.5:7b",
  "messages": [{"role": "user", "content": "你好"}],
  "stream": false
}'
```

---

## 🔌 连接硬件 | Connect to Hardware

### Python 调用 | Python Client

```python
import requests

class LocalLLM:
    def __init__(self, host="localhost", port=11434):
        self.url = f"http://{host}:{port}/api/chat"

    def chat(self, message, model="qwen2.5:7b"):
        resp = requests.post(self.url, json={
            "model": model,
            "messages": [{"role": "user", "content": message}],
            "stream": False
        })
        return resp.json()["message"]["content"]

# 使用 | Usage
llm = LocalLLM()
reply = llm.chat("用一句话介绍 ESP32")
print(reply)
```

### ESP32 连接局域网 Ollama | ESP32 → LAN Ollama

```cpp
#include <WiFi.h>
#include <HTTPClient.h>

const char* OLLAMA_HOST = "http://192.168.1.100:11434";  // 运行 Ollama 的电脑 IP

String askLocalLLM(String question) {
    HTTPClient http;
    http.begin(String(OLLAMA_HOST) + "/api/chat");
    http.addHeader("Content-Type", "application/json");

    String body = "{\"model\":\"qwen2.5:7b\",\"messages\":[{\"role\":\"user\",\"content\":\"" + question + "\"}],\"stream\":false}";

    int code = http.POST(body);
    String response = "";
    if (code > 0) {
        response = http.getString();
        // 简单解析 | Simple JSON parse
        int idx = response.indexOf("\"content\":\"");
        if (idx > 0) {
            int end = response.indexOf("\"", idx + 11);
            response = response.substring(idx + 11, end);
        }
    }
    http.end();
    return response;
}
```

### 树莓派直接运行 | Raspberry Pi Native

```bash
# 在树莓派 5 (8GB) 上
ollama run qwen2.5:1.5b  # 1.5B 模型，树莓派可跑

# 或通过 API 服务其他设备
ollama serve  # 树莓派变成局域网 AI 服务器
```

---

## ✅ 快速验证 | Quick Test

```bash
# 安装后立即测试 | Test immediately after install
ollama run qwen2.5:7b "用一句话介绍你自己"

# 预期输出 | Expected: 类似 "我是通义千问，由阿里巴巴开发的开源大语言模型..."
```

---

## 🚀 进阶玩法 | Next Steps

- [ ] 使用 Modelfile 自定义系统提示词
- [ ] 部署 DeepSeek-R1 增强推理能力
- [ ] 用 GPU 加速（NVIDIA CUDA / Apple Metal）
- [ ] 搭配 xiaozhi-esp32 实现完全离线语音助手

---

## ❓ 常见问题 | FAQ

<details>
<summary><b>Q: 内存不够？</b></summary>

使用更小的模型：`qwen2.5:1.5b`（需 3GB RAM）或 `qwen2.5:0.5b`（需 1GB RAM）。
</details>

<details>
<summary><b>Q: 响应很慢？</b></summary>

1. 首次运行需下载模型（7B 约 4.5GB），之后从本地加载
2. 无 GPU 时 CPU 推理较慢，7B 模型约 5-15 tokens/s
3. 有 NVIDIA GPU 时自动启用 CUDA 加速
</details>

---

*最后更新：2026-06-21 | 基于 Ollama 最新版本*
