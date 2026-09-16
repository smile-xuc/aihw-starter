# 开源项目 · 玩具/陪伴方向

> 本页收录玩具/陪伴方向的开源 AI 硬件项目。
> 完整索引见 [`../ai-hardware-projects.html`](../ai-hardware-projects.html)。
> 对应方案：[`solutions/by-category/03-toys-companion/`](../../../solutions/by-category/03-toys-companion/)

## 推荐参考项目

### xiaozhi-esp32（小智 AI）

- **仓库**：https://github.com/78/xiaozhi-esp32
- **Star**：以 HTML 大盘为准
- **License**：MIT
- **框架**：ESP32-S3（ESP-IDF）
- **状态**：活跃
- **简介**：基于 MCP 协议的 AI 语音聊天机器人，国内最常见的开源 AI 硬件玩具参考。
- **关键特性**：语音唤醒；ASR/TTS；多 LLM 集成；MCP 协议；设备端交互
- **依赖模型**：多模型可选
- **HTML 品类**：语音 AI

### xiaozhi-esp32-server

- **仓库**：https://github.com/xinnan-tech/xiaozhi-esp32-server
- **Star**：以 HTML 大盘为准
- **License**：MIT
- **框架**：Python Server + ESP32
- **状态**：活跃
- **简介**：小智 ESP32 配套后端，支持快速部署设备管控与语音编排服务。
- **关键特性**：ASR/TTS；LLM 编排；设备管理；声纹识别
- **HTML 品类**：语音 AI

### FoloToy Server

- **仓库**：https://github.com/FoloToy/folotoy-server-self-hosting
- **Star**：以 HTML 大盘为准
- **License**：GPL-3.0
- **框架**：ESP32（FoloToy Core）+ 自托管服务
- **状态**：活跃
- **简介**：AI 大模型玩具自托管服务器，适合卡片机/毛绒机类产品参考。
- **关键特性**：多 LLM/STT/TTS；语音交互；角色扮演
- **HTML 品类**：语音 AI

### ElatoAI

- **仓库**：https://github.com/akdeb/ElatoAI
- **Star**：以 HTML 大盘为准
- **License**：待核
- **框架**：ESP32-S3（Arduino）
- **状态**：活跃
- **简介**：基于 Arduino ESP32 的实时语音 AI，对接 OpenAI Realtime 等模型。
- **关键特性**：Realtime API；WebSocket；多语音模型
- **HTML 品类**：语音 AI

### ESP32_AI_LLM

- **仓库**：https://github.com/Explorerlowi/ESP32_AI_LLM
- **Star**：以 HTML 大盘为准
- **License**：GPL-3.0
- **框架**：ESP32 / ESP32-S3
- **状态**：活跃
- **简介**：语音助手支持 15+ 种大模型（GPT/Claude/DeepSeek 等）。
- **关键特性**：多模型 LLM；STT/TTS；语音交互
- **HTML 品类**：语音 AI

### wukong-robot（悟空机器人）

- **仓库**：https://github.com/wzpan/wukong-robot
- **Star**：以 HTML 大盘为准
- **License**：MIT
- **框架**：Raspberry Pi
- **状态**：维护中
- **简介**：中文语音对话机器人/智能音箱项目，技能插件可扩展，适合陪伴音箱形态。
- **关键特性**：语音唤醒；ASR/TTS；ChatGPT；技能插件
- **HTML 品类**：语音 AI

### esp-ai

- **仓库**：https://github.com/wangzongming/esp-ai
- **Star**：以 HTML 大盘为准
- **License**：MIT
- **框架**：ESP32-S3/C3
- **状态**：活跃
- **简介**：偏「低成本完整对话」的硬件接入 AI 方案，适合玩具类快速原型。
- **关键特性**：完整 AI 对话；STT/TTS；LLM 集成；插件系统
- **HTML 品类**：语音 AI

> Agent 桌面盒子类项目（Open Interpreter 01、ESP-Claw、Willow 等）主落 [`04-agent-hardware.md`](./04-agent-hardware.md)；录音可穿戴（Omi）主落 [`07-recorder.md`](./07-recorder.md)。

## 贡献指引

详见根目录 [`CONTRIBUTING.md`](../../../CONTRIBUTING.md)。
