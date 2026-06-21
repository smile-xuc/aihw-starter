# 🎙️ ESP32 AI 语音助手入门 | ESP32 AI Voice Assistant

> 基于 [xiaozhi-esp32](https://github.com/78/xiaozhi-esp32) 构建，¥300 / $42、2 小时从零到对话

---

## 📋 项目简介 | Overview

xiaozhi-esp32（小智 AI）是 GitHub 上最热门的开源 ESP32 AI 语音助手项目。它让一个 ¥30 的 ESP32 开发板拥有了类似智能音箱的能力：语音唤醒、语音识别、大模型对话、语音合成——全部通过一个麦 _克风_ + 扬声器 + ESP32 实现。

**你会学到 | You'll Learn**：
- ESP32-S3 开发环境搭建
- I2S 音频（麦克风+扬声器）接线
- 云端大模型 API 接入（DeepSeek/通义千问）
- 语音唤醒 + STT + TTS 全链路

**适合人群 | Who It's For**：有 Arduino 基础的开发者，想快速拥有一个 AI 语音助手

---

## 🛒 BOM 物料清单 | Bill of Materials

> 详细价格和采购链接见 [ESP32 语音助手 BOM](../bom/esp32-voice-bom.md)

| 元件 Component | 型号 Model | 数量 Qty | 参考价 Price |
|---------------|-----------|---------|------------|
| 主控 MCU | ESP32-S3-DevKitC-1（N16R8） | 1 | ¥35 |
| 麦克风 Mic | INMP441 (I2S) | 1 | ¥10 |
| 扬声器功放 | MAX98357A (I2S) | 1 | ¥8 |
| 喇叭 Speaker | 4Ω 3W 小喇叭 | 1 | ¥5 |
| 按钮 Button | 微动按钮 | 1 | ¥1 |
| 杜邦线 Wires | 母对母 20cm | 10 | ¥3 |
| USB-C 数据线 | 编程+供电 | 1 | ¥10 |
| **合计 Total** | | | **~¥72** |

> 💡 **省钱技巧**：在淘宝搜"ESP32-S3 AI 语音助手套件"有 ¥60-100 的成套配件。

---

## 🔧 硬件组装 | Hardware Assembly

### 接线图 | Wiring

```
ESP32-S3-DevKitC          INMP441 (麦克风)
┌─────────────┐          ┌──────────┐
│         3V3 ├─────────→│ VDD      │
│         GND ├─────────→│ GND      │
│       GPIO4 ├─────────→│ WS (LRCL)│
│       GPIO5 ├─────────→│ SCK      │
│       GPIO6 ├─────────→│ SD (DOUT)│
│             │          │ L/R→GND  │
└─────────────┘          └──────────┘

ESP32-S3-DevKitC          MAX98357A (功放)
┌─────────────┐          ┌──────────┐
│         VIN ├─────────→│ VIN      │
│         GND ├─────────→│ GND      │
│      GPIO15 ├─────────→│ DIN      │
│      GPIO16 ├─────────→│ BCLK     │
│       GPIO7 ├─────────→│ LRC      │
│             │          │  speaker │──→ 喇叭
└─────────────┘          └──────────┘

ESP32-S3-DevKitC          按钮 Button
│       GPIO0 ├─────────→ [按钮] ──→ GND
```

### 组装步骤 | Steps

1. **焊接排针**：给 ESP32-S3 焊接排针（或直接买已焊好的）
2. **连接麦克风**：按接线图连接 INMP441（注意 L/R 接 GND）
3. **连接功放**：按接线图连接 MAX98357A + 喇叭
4. **连接按钮**：GPIO0 → 按钮 → GND（用于手动触发对话）
5. **插入 USB**：连接电脑，准备刷固件

---

## 💻 软件环境 | Software Setup

### 方法一：Web 刷固件（推荐新手）| Method 1: Web Flash (Recommended)

1. 用 USB-C 线连接 ESP32-S3 到电脑
2. 打开浏览器访问 [xiaozhi-esp32 官方刷机页](https://xiaozhi.me/)
3. 选择你的开发板型号
4. 点击"连接" → 选择 COM 端口 → 自动刷写
5. 刷写完成后，ESP32 会进入配置模式

### 方法二：源码编译 | Method 2: Build from Source

```bash
# 安装 ESP-IDF v5.1+ | Install ESP-IDF
git clone --recursive https://github.com/espressif/esp-idf.git
cd esp-idf && ./install.sh && source export.sh

# 克隆 xiaozhi-esp32 | Clone
git clone https://github.com/78/xiaozhi-esp32.git
cd xiaozhi-esp32

# 配置 | Configure
idf.py menuconfig  # 选择开发板型号、配置 Wi-Fi

# 编译刷写 | Build & Flash
idf.py build
idf.py flash monitor
```

### 配置 Wi-Fi 和大模型 | Configure Wi-Fi & LLM

1. 刷写后，ESP32 进入 AP 模式，手机连接 `xiaozhi-xxxxxx` 热点
2. 打开浏览器访问 `192.168.4.1`
3. 填入：
   - **Wi-Fi SSID + 密码**
   - **大模型 API**（推荐 DeepSeek，见下方）
4. 保存重启

---

## 🧠 大模型接入 | LLM Integration

### 推荐配置 | Recommended Config

| 配置项 | 推荐值 | 说明 |
|-------|-------|------|
| LLM Provider | DeepSeek | 性价比最高（¥1/百万 token） |
| API URL | `https://api.deepseek.com/v1/chat/completions` | |
| API Key | 在 [platform.deepseek.com](https://platform.deepseek.com) 注册获取 | 注册送 ¥10 |
| Model | `deepseek-chat` | DeepSeek V3 |
| TTS | xiaozhi 内置 | 支持多种音色 |
| STT | xiaozhi 内置 | 基于 ESP-SR |

### 替代模型 | Alternative Models

<details>
<summary>使用通义千问 Qwen（点击展开）</summary>

```
API URL: https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions
API Key: 在 dashscope.console.aliyun.com 获取
Model: qwen-turbo
```
Qwen-Turbo 有 100 万 token 免费额度，适合体验。
</details>

<details>
<summary>使用本地 Ollama（完全离线）</summary>

```bash
# 在电脑或树莓派上运行 Ollama
ollama run qwen2.5:7b

# 在 xiaozhi 配置页填入：
API URL: http://你的电脑IP:11434/api/chat
Model: qwen2.5:7b
```
完全离线，无需 API Key，但需要一台 8GB+ RAM 的电脑。
</details>

---

## ✅ 快速验证 | Quick Test

1. **上电**：USB-C 供电，ESP32 启动后会播报"小智已上线"
2. **唤醒**：说"小智小智"或按下按钮
3. **对话**：听到提示音后说话，例如"今天天气怎么样"
4. **响应**：小智通过大模型生成回复，TTS 播报

> 🎉 **恭喜！你刚完成了第一个 AI 硬件项目！**

---

## 🚀 进阶玩法 | Next Steps

- [ ] 添加 OLED 屏幕显示对话文本
- [ ] 添加摄像头实现视觉问答（VLM）
- [ ] 接入 Home Assistant 控制智能家居
- [ ] 3D 打印外壳做成桌面伴侣
- [ ] 自定义唤醒词

### 相关项目 | Related Projects

| 项目 Project | 说明 Description |
|-------------|----------------|
| [xiaozhi-esp32-server](https://github.com/xinnan-tech/xiaozhi-esp32-server) | 自建后端服务（支持本地 LLM） |
| [py-xiaozhi](https://github.com/huangjunsen0406/py-xiaozhi) | Python 版客户端 |
| [xiaozhi-esphome](https://github.com/Josiah-EG/xiaozhi-esphome) | ESPHome 集成版 |

---

## ❓ 常见问题 | FAQ

<details>
<summary><b>Q: 为什么麦克风没有声音？</b></summary>

检查 INMP441 接线：L/R 引脚必须接 GND（选右声道）。确认 WS/SCK/SD 引脚对应正确。
</details>

<details>
<summary><b>Q: 扬声器声音很小/有杂音？</b></summary>

1. 确认 MAX98357A 的 VIN 接 5V（不是 3.3V）
2. 喇叭阻抗建议 4Ω，功率 ≥3W
3. 增益引脚（GAIN）悬空 = 9dB，接 GND = 12dB，接 VIN = 15dB
</details>

<details>
<summary><b>Q: 对话延迟很高？</b></summary>

1. 确认 Wi-Fi 信号良好
2. 使用国内 API（DeepSeek/通义千问）替代 OpenAI
3. 或使用本地 Ollama 消除网络延迟
4. 在配置中减小 `max_tokens`（如 256）
</details>

<details>
<summary><b>Q: 可以不用云端 API 吗？</b></summary>

可以！使用本地 Ollama 部署 Qwen2.5 7B，完全离线运行。详见[大模型接入指南](../docs/llm-integration-guide.md#方案二本地部署--local-deployment)。
</details>

---

*最后更新：2026-06-21 | 基于 xiaozhi-esp32 最新版本*
