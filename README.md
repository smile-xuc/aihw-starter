<div align="center">

# 🤖 aihw-starter

### 帮助你快速进行 AI 硬件项目的起步 | Jumpstart Your AI Hardware Project

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Stars](https://img.shields.io/github/stars/smile-xuc/aihw-starter?style=social)](https://github.com/smile-xuc/aihw-starter/stargazers)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

</div>

---

## 📖 项目简介 | Introduction

**中文**：aihw-starter 是一个开源的 AI 硬件起步资源库。我们精选 10 个**手把手入门教程**（从语音助手到机械臂），并维护一份**严格筛选**的 AI 硬件项目目录（约 200+ 项），覆盖语音、视觉、机器人、可穿戴、自动驾驶、玩具/桌宠、边缘推理等 9 大方向。一站式解决"我想做 AI 硬件，但不知道从哪开始"。

**English**: aihw-starter is a curated open-source resource for AI hardware. It pairs **10 hands-on tutorials** (from voice assistants to robot arms) with a **strictly filtered** catalog of ~200 AI-hardware projects across 9 categories — voice, vision, robotics, wearables, autonomous, toys, edge inference, and more. One-stop kickoff for "I want to build AI hardware, but don't know where to start".

---

## 🏁 入门教程 | 10 Tutorials

### 🤖 机器人 | Robotics

| # | 项目 Project | 成本 Cost | 难度 | 教程 |
|---|-------------|----------|------|------|
| 1 | 🦾 桌面机械臂 — [SO-ARM100](https://github.com/TheRobotStudio/SO-ARM100) | ~¥615 / $85 | ⭐⭐ | [→](getting-started/02-desktop-robot-arm.md) |
| 2 | 🐕 四足机器人 — [OpenCat](https://github.com/PetoiCamp/OpenCat-Quadruped-Robot) | ~¥578 / $80 | ⭐⭐⭐ | [→](getting-started/03-quadruped-robot.md) |
| 3 | 🦆 双足机器人 — [Open_Duck_Mini](https://github.com/apirrone/Open_Duck_Mini) | ~¥1,805 / $250 | ⭐⭐⭐⭐ | [→](getting-started/08-open-duck-mini.md) |
| 4 | 🚗 视觉机器人 — [JetBot](https://github.com/NVIDIA-AI-IOT/jetbot) | ~¥1,445 / $200 | ⭐⭐ | [→](getting-started/05-vision-rover.md) |
| 5 | 🚁 自主无人机 — [ArduPilot](https://github.com/ArduPilot/ardupilot) | ~¥1,045 / $145 | ⭐⭐⭐⭐ | [→](getting-started/10-drone-autonomous.md) |

### 🧠 AI 应用 | AI Applications

| # | 项目 Project | 成本 Cost | 难度 | 教程 |
|---|-------------|----------|------|------|
| 6 | 🎙️ 语音助手 — [xiaozhi-esp32](https://github.com/78/xiaozhi-esp32) | ~¥72 / $10 | ⭐⭐ | [→](getting-started/01-esp32-voice-assistant.md) |
| 7 | 🕶️ AI 智能眼镜 — [OpenGlass](https://github.com/BasedHardware/OpenGlass) | ~¥101 / $14 | ⭐⭐⭐ | [→](getting-started/04-ai-smart-glasses.md) |
| 8 | 🖥️ 本地 LLM — [Ollama](https://ollama.ai) | ¥0 | ⭐⭐ | [→](getting-started/06-ollama-local-llm.md) |
| 9 | 🏠 智能家居 AI — [Home Assistant](https://www.home-assistant.io/) + ESP32 | ~¥465 / $65 | ⭐⭐ | [→](getting-started/07-home-assistant-ai.md) |
| 10 | 🖨️ AI 3D 打印 — [Klipper](https://github.com/Klipper3d/klipper) + Obico | ~¥300 / $42 | ⭐⭐ | [→](getting-started/09-3d-printer-ai.md) |

---

## 🌟 精选项目全景 | Highlights at a Glance

> 严格筛选：必须**含 AI 模型 + 真实硬件实现**才会收录。完整 200+ 项目目录见 **[CATALOG.md](CATALOG.md)**。

### 🎙️ 语音对话 AI · [全部 →](catalog/voice-ai.md)

| 项目 | ⭐ | 简介 |
|------|--:|------|
| [xiaozhi-esp32](https://github.com/78/xiaozhi-esp32) | 27.4k | 国内最火 ESP32 AI 语音助手 |
| [Omi](https://github.com/BasedHardware/omi) | 12.8k | 开源 AI 项链/胸牌 |
| [xiaozhi-esp32-server](https://github.com/xinnan-tech/xiaozhi-esp32-server) | 9.8k | 小智配套服务端 |
| [wukong-robot](https://github.com/wzpan/wukong-robot) | 7.1k | 中文语音交互机器人 |
| [Willow](https://github.com/toverainc/willow) | 3.0k | ESP32 离线语音助手 |

### 👁️ 视觉 AI / 相机 · [全部 →](catalog/vision-ai.md)

| 项目 | ⭐ | 简介 |
|------|--:|------|
| [openpilot](https://github.com/commaai/openpilot) | 61.4k | comma.ai 端到端 ADAS |
| [Ultralytics YOLO](https://github.com/ultralytics/ultralytics) | 58.5k | 主流目标检测 |
| [Frigate](https://github.com/blakeblackshear/frigate) | 33.9k | 本地 NVR + AI |
| [AI-on-the-edge-device](https://github.com/jomjol/AI-on-the-edge-device) | 8.5k | ESP32-CAM 抄表器 |
| [ESP-WHO](https://github.com/espressif/esp-who) | 2.1k | ESP32 人脸识别 |

### 👓 AI 可穿戴 · [全部 →](catalog/wearable.md)

| 项目 | ⭐ | 简介 |
|------|--:|------|
| [Omi](https://github.com/BasedHardware/omi) | 12.8k | AI 项链/胸牌 |
| [OpenGlass](https://github.com/BasedHardware/OpenGlass) | 4.1k | XIAO ESP32S3 AI 眼镜 |
| [ADeus](https://github.com/adamcohenhillel/ADeus) | 3.4k | 24/7 个人 AI 项链 |
| [MentraOS](https://github.com/Mentra-Community/MentraOS) | 1.9k | 智能眼镜 OS |
| [OpenBCI](https://github.com/OpenBCI/OpenBCI_GUI) | 929 | 开源脑机接口 |

### 🤖 AI 机器人 · [全部 →](catalog/robot.md)

| 项目 | ⭐ | 简介 |
|------|--:|------|
| [LeRobot](https://github.com/huggingface/lerobot) | 25.1k | HuggingFace 具身智能 |
| [OpenMower](https://github.com/ClemensElflein/OpenMower) | 6.6k | 开源智能割草机 |
| [SO-ARM100](https://github.com/TheRobotStudio/SO-ARM100) | 6.6k | LeRobot 御用机械臂 |
| [OpenCat](https://github.com/PetoiCamp/OpenCat-Quadruped-Robot) | 4.9k | Petoi 开源四足 |
| [Reachy Mini](https://github.com/pollen-robotics/reachy_mini) | 1.3k | Pollen 桌面人形 |

### 🧸 AI 玩具 / 桌宠 · [全部 →](catalog/toys.md)

| 项目 | ⭐ | 简介 |
|------|--:|------|
| [ElatoAI](https://github.com/akdeb/ElatoAI) | 1.8k | ESP32 + Supabase 对话玩偶 |
| [StackChan](https://github.com/meganetaaan/stack-chan) | 893 | 日本国民桌宠 |
| [Starmoon](https://github.com/StarmoonAI/Starmoon) | 547 | ESP32 AI 玩偶平台 |
| [DAZI-AI](https://github.com/Dazhi-AI/Dazhi) | 107 | "AI 搭子"桌面陪伴 |

### 🚗 自动驾驶 / 无人机 · [全部 →](catalog/autonomous.md)

| 项目 | ⭐ | 简介 |
|------|--:|------|
| [openpilot](https://github.com/commaai/openpilot) | 61.4k | comma.ai 端到端 |
| [Apollo](https://github.com/ApolloAuto/apollo) | 25.4k | 百度 L4 平台 |
| [ardupilot](https://github.com/ArduPilot/ardupilot) | 15.3k | 开源飞控 |
| [betaflight](https://github.com/betaflight/betaflight) | 11.1k | 穿越机飞控 |
| [donkeycar](https://github.com/autorope/donkeycar) | 3.5k | 自动驾驶 RC 小车 |

### ⚡ 边缘推理 / TinyML · [全部 →](catalog/edge-inference.md)

| 项目 | ⭐ | 简介 |
|------|--:|------|
| [ollama](https://github.com/ollama/ollama) | 174.6k | 一键本地 LLM |
| [llama.cpp](https://github.com/ggerganov/llama.cpp) | 117.5k | CPU/ARM 量化推理 |
| [whisper.cpp](https://github.com/ggerganov/whisper.cpp) | 50.9k | 端侧语音识别 |
| [ncnn](https://github.com/Tencent/ncnn) | 23.4k | 腾讯端侧推理 |
| [sherpa-onnx](https://github.com/k2-fsa/sherpa-onnx) | 13.1k | 端侧 ASR/TTS |

### 🛠️ 开发板 / 参考硬件 · [全部 →](catalog/dev-board.md)

| 项目 | ⭐ | 简介 |
|------|--:|------|
| [esp-idf](https://github.com/espressif/esp-idf) | 14.8k | ESP32 全家桶 |
| [esp-box](https://github.com/espressif/esp-box) | 1.3k | 乐鑫 AI 语音盒 |
| [Sipeed MaixPy](https://github.com/sipeed/MaixPy) | 765 | K210 + KPU |
| [Hailo RPi5 Examples](https://github.com/hailo-ai/hailo-rpi5-examples) | 925 | RPi5 + 26TOPS NPU |

### 📚 Awesome 合集 · [全部 →](catalog/awesome-lists.md)

| 项目 | ⭐ | 简介 |
|------|--:|------|
| [awesome-robotics](https://github.com/kiloreux/awesome-robotics) | 6.7k | 机器人资源大全 |
| [Awesome-Embodied-AI](https://github.com/zchoi/Awesome-Embodied-Robotics-and-Agent) | 4.7k | 具身 AI 论文+代码 |
| [Awesome-Efficient-LLM](https://github.com/horseee/Awesome-Efficient-LLM) | 3.0k | 端侧 LLM 论文 |

---

## 🚀 快速开始 | Quick Start

### 第一步：选赛道 | Step 1: Choose a Track

**新手推荐**：
- 💰 预算有限 → **ESP32 语音助手**（¥72，2 小时跑通）
- 🦾 想玩机器人 → **SO-ARM100 机械臂**（¥615，HuggingFace LeRobot 支持）
- 👁️ 玩端侧视觉 → **AI-on-the-edge-device**（ESP32-CAM 抄表器，¥100）

### 第二步：采购物料 | Step 2: Source Your Parts

参考 [📦 采购指南](docs/supply-chain-guide.md)：含国内 / 国际渠道、价格对比、替代方案。

### 第三步：选好板子 | Step 3: Pick Your Board

参考 [🛠️ 开发板选型](catalog/dev-board.md)：ESP32 / K210 / Jetson / RPi+Hailo 全梯度对比。

### 第四步：接入大模型 | Step 4: Connect an LLM

参考 [🧠 大模型接入指南](docs/llm-integration-guide.md)：云端 API / 本地部署 / 端侧推理三套方案。

### 第五步：跟着教程做 | Step 5: Follow the Tutorial

点击上方表格中的教程链接，跟着一步步做。

---

## 📚 文档导航 | Documentation

| 文档 | 说明 |
|------|------|
| [📖 项目目录 CATALOG.md](CATALOG.md) | 200+ AI 硬件项目按 9 大方向索引 |
| [📦 采购指南](docs/supply-chain-guide.md) | 元器件采购渠道、价格、替代方案 |
| [🧠 大模型接入指南](docs/llm-integration-guide.md) | 云端 API / 本地部署 / 端侧推理 |
| [📂 分类浏览](catalog/) | 直接进入 9 个分类目录 |
| [🛒 BOM 物料清单](bom/) | 教程对应的物料表 CSV |

---

## 🤝 贡献 | Contributing

欢迎提交 Issue 和 PR：
- 修正错误数据（星数、链接、描述）
- 补充入门教程
- 推荐遗漏的高质量项目（**必须含 AI + 硬件**）
- 翻译/校对中英文

Welcome to submit Issues and PRs! Whether it's fixing data, adding tutorials, suggesting projects, or translating — all contributions are welcome.

---

## 📄 License

[MIT](LICENSE)

---

<div align="center">

🐻 Made with ❤️ by the AI Hardware community

如果这个仓库帮到了你，请给个 ⭐ — 这是最大的鼓励！
If this repo helps you, please give it a ⭐ — that's the best encouragement!

</div>
