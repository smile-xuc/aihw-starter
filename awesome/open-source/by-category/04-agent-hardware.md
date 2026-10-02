# 开源项目 · Agent 硬件 / 桌面盒子

> 本页收录 Agent 硬件、桌面盒子与本地语音 Agent 方向的开源项目。
> 完整索引见 [`../ai-hardware-projects.html`](../ai-hardware-projects.html)。
> 对应方案：[`solutions/by-category/04-agent-hardware/`](../../../solutions/by-category/04-agent-hardware/)
>
> **主品类纪律**：小智全文主落 [`03-toys-companion.md`](./03-toys-companion.md)，本页不重复。

## 推荐参考项目

### Open Interpreter 01

- **仓库**：<https://github.com/openinterpreter/01>
- **Star**：以 HTML 大盘为准
- **License**：AGPL-3.0
- **框架**：ESP32-S3 / RPi / Desktop
- **状态**：活跃
- **简介**：开源语音接口与 Agent 硬件参考，偏「桌面盒子 / 语音操控电脑」形态。
- **关键特性**：语音控制；代码执行；LLM Agent；多模态
- **HTML 品类**：语音 AI

### Qwen Audio Agent

- **仓库**：<https://github.com/QwenAudio/qwen-audio-agent>
- **Star**：以仓库为准（2026-10-02 核验；HTML 大盘未收录）
- **License**：Apache-2.0
- **框架**：Node.js Gateway（桌面 / 服务器）；ESP32-C3 参考终端经局域网转发接入
- **状态**：活跃
- **简介**：实时语音 Agent 运行框架：Realtime 模型在前台对话，需要工具或长时间处理的任务异步交给后台 Agent，默认前台为百炼 `qwen-audio-3.0-realtime-plus`。
- **关键特性**：全双工打断；`smart_turn` 语义轮次；后台委派（ACP / A2A / 自定义 Adapter）；单 WebSocket 客户端协议；人格与长期记忆；可选本地语音前台
- **HTML 品类**：—（外链补录，已核验）
- **另见**：选型、计费对照见 [`solutions/by-solution/08-qwen-audio-agent.md`](../../../solutions/by-solution/08-qwen-audio-agent.md)

### ESP-Claw

- **仓库**：<https://github.com/espressif/esp-claw>
- **Star**：以 HTML 大盘为准
- **License**：Apache-2.0
- **框架**：ESP32-S3/P4/C5
- **状态**：活跃
- **简介**：乐鑫官方 IoT AI Agent 框架，MCP + Function Calling。
- **关键特性**：MCP 协议；Function Calling；自主任务执行
- **HTML 品类**：语音 AI

### Willow

- **仓库**：<https://github.com/HeyWillow/willow>
- **Star**：以 HTML 大盘为准
- **License**：Apache-2.0
- **框架**：ESP32-S3（ESP-BOX）
- **状态**：活跃
- **简介**：开源本地自托管语音助手，可作家庭 Agent 盒子参考。
- **关键特性**：本地 ASR/TTS；Home Assistant；隐私优先；自托管
- **HTML 品类**：语音 AI

### OpenEmbodied（机智云）

- **仓库**：<https://github.com/gizwits/OpenEmbodied>
- **Star**：以 HTML 大盘为准
- **License**：MIT
- **框架**：ESP32-S3
- **状态**：活跃
- **简介**：可量产向 AI 硬件方案（机智云 + Coze），偏 Agent 设备落地。
- **关键特性**：Coze LLM 集成；语音交互；量产级参考
- **HTML 品类**：语音 AI

### WireClaw

- **仓库**：<https://github.com/M64GitHub/WireClaw>
- **Star**：以 HTML 大盘为准
- **License**：待核实
- **框架**：ESP32-C6/S3/C3
- **状态**：活跃
- **简介**：低成本 ESP32 上的自主 AI Agent，带持久记忆。
- **关键特性**：持久记忆；NTP 同步；Telegram；自主行动
- **HTML 品类**：语音 AI

### Satellite1-ESPHome

- **仓库**：<https://github.com/FutureProofHomes/Satellite1-ESPHome>
- **Star**：以 HTML 大盘为准
- **License**：待核实
- **框架**：ESP32-S3（ESPHome）
- **状态**：活跃
- **简介**：开源 AI 语音助手与多传感器卫星节点，适合家庭 Agent 外设。
- **关键特性**：私有 AI 语音；唤醒词；本地处理
- **HTML 品类**：语音 AI

## 贡献指引

详见根目录 [`CONTRIBUTING.md`](../../../CONTRIBUTING.md)。
