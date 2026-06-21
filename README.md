<div align="center">

# 🤖 aihw-starter

### 帮助你快速进行 AI 硬件项目的起步 | Jumpstart Your AI Hardware Project

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![中文](https://img.shields.io/badge/README-中文-red)](README.zh-CN.md)
[![English](https://img.shields.io/badge/README-English-blue)](README.md)

</div>

---

## 📖 项目简介 | Introduction

**中文**：aihw-starter 是一个开源教程项目，帮助你从零开始构建 AI 硬件。我们精选了 5 个最具代表性的 AI 硬件赛道，每个赛道提供完整的入门教程——从 BOM 采购、硬件组装、软件环境搭建到大模型接入，手把手带你跑通第一个项目。

**English**: aihw-starter is an open-source tutorial project that helps you build AI hardware from scratch. We've curated 5 representative AI hardware tracks, each with a complete getting-started guide — from BOM sourcing, hardware assembly, software setup to LLM integration.

---

## 🏁 5 大赛道 | 5 Tracks

| # | 赛道 Track | 项目 Project | 成本 Cost | 难度 | 教程 Tutorial |
|---|-----------|-------------|----------|------|--------------|
| 1 | 🎙️ 语音助手 Voice Assistant | [xiaozhi-esp32](https://github.com/78/xiaozhi-esp32) | ~¥72 / $10 | ⭐⭐ | [开始 →](getting-started/01-esp32-voice-assistant.md) |
| 2 | 🦾 桌面机械臂 Robot Arm | [SO-ARM100](https://github.com/TheRobotStudio/SO-ARM100) | ~¥615 / $85 | ⭐⭐ | [开始 →](getting-started/02-desktop-robot-arm.md) |
| 3 | 🐕 四足机器人 Quadruped | [OpenCat](https://github.com/PetoiCamp/OpenCat-Quadruped-Robot) | ~¥578 / $80 | ⭐⭐⭐ | [开始 →](getting-started/03-quadruped-robot.md) |
| 4 | 🕶️ AI 智能眼镜 Smart Glasses | [OpenGlass](https://github.com/BasedHardware/OpenGlass) | ~¥101 / $14 | ⭐⭐⭐ | [开始 →](getting-started/04-ai-smart-glasses.md) |
| 5 | 🚗 视觉移动机器人 Vision Rover | [JetBot](https://github.com/NVIDIA-AI-IOT/jetbot) | ~¥1,445 / $200 | ⭐⭐ | [开始 →](getting-started/05-vision-rover.md) |
| 6 | 🖥️ 本地 LLM 部署 Local LLM | [Ollama](https://ollama.ai) | ¥0 (现有硬件) | ⭐⭐ | [开始 →](getting-started/06-ollama-local-llm.md) |
| 7 | 🏠 智能家居 AI Smart Home | [Home Assistant](https://www.home-assistant.io/) + ESP32 | ~¥465 / $65 | ⭐⭐ | [开始 →](getting-started/07-home-assistant-ai.md) |
| 8 | 🦆 双足机器人 Bipedal Robot | [Open_Duck_Mini](https://github.com/apirrone/Open_Duck_Mini) | ~¥1,805 / $250 | ⭐⭐⭐⭐ | [开始 →](getting-started/08-open-duck-mini.md) |
| 9 | 🖨️ AI 3D 打印 3D Printing | [Klipper](https://github.com/Klipper3d/klipper) + Obico | ~¥300 / $42 | ⭐⭐ | [开始 →](getting-started/09-3d-printer-ai.md) |
| 10 | 🚁 自主无人机 Autonomous Drone | [ArduPilot](https://github.com/ArduPilot/ardupilot) | ~¥1,045 / $145 | ⭐⭐⭐⭐ | [开始 →](getting-started/10-drone-autonomous.md) |

---

## 🚀 快速开始 | Quick Start

### 第一步：选择赛道 | Step 1: Choose a Track

**新手推荐 / Recommended for beginners**：
- 预算有限 → **ESP32 语音助手**（¥300，2 小时搞定）
- 想玩机器人 → **SO-ARM100 机械臂**（¥250，HuggingFace LeRobot 支持）
- 有 NVIDIA Jetson → **JetBot 视觉机器人**（教育级 AI 视觉）

### 第二步：采购物料 | Step 2: Source Your Parts

参考 [采购指南 | Supply Chain Guide](docs/supply-chain-guide.md)，包含中国/国际渠道对比。

### 第三步：接入大模型 | Step 3: Connect an LLM

参考 [大模型接入指南 | LLM Integration Guide](docs/llm-integration-guide.md)，了解云端 API、本地部署、端侧推理三种方案。

### 第四步：跟着教程做 | Step 4: Follow the Tutorial

点击上方赛道链接，跟着教程一步步完成。

---

## 📚 文档导航 | Documentation

| 文档 Document | 说明 Description |
|--------------|----------------|
| [📖 项目目录 Project Catalog](CATALOG.md) | 908 个 AI 硬件项目分类索引（按赛道+星标排序） |
| [📦 采购指南](docs/supply-chain-guide.md) | 元器件采购渠道、价格参考、替代方案 |
| [🧠 大模型接入指南](docs/llm-integration-guide.md) | 云端 API / 本地部署 / 端侧推理选型 |
| [📂 分类浏览 Browse by Category](catalog/) | 按分类浏览全部项目 |

---

## 🔗 关联项目 | Related Projects

- [AI-Hardware-KB](https://github.com/yourusername/AI-Hardware-KB) — AI 硬件知识库（908 个项目的深度分析）
- [xiaozhi-esp32](https://github.com/78/xiaozhi-esp32) — ESP32 AI 语音助手（小智 AI）
- [SO-ARM100](https://github.com/TheRobotStudio/SO-ARM100) — 低成本开源机械臂
- [LeRobot](https://github.com/huggingface/lerobot) — HuggingFace 机器人学习平台

---

## 🤝 贡献 | Contributing

欢迎提交 Issue 和 PR！无论是修正错误、补充教程、还是新增赛道，都非常欢迎。

Welcome to submit Issues and PRs! Whether it's fixing errors, adding tutorials, or new tracks — all contributions are welcome.

---

## 📄 License

[MIT](LICENSE)

---

<div align="center">

🐻 Made with ❤️ by the AI Hardware community

</div>
