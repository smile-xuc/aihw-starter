# Changelog

本仓库的所有重要变更记录于此。
格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [SemVer](https://semver.org/lang/zh-CN/)。

## [1.1.0] - 2026-06-22

### 重大变更：分类体系重建（严格 AI + 硬件双重过滤）

- 项目总数从 **908** 精简至 **194**（其中 176 个实际硬件项目 + 18 个 Awesome 参考合集）
- 分类从原先 9 个语义混乱的目录重建为 9 个端侧 AI 硬件主题：
  - 🎙️ `voice-ai.md` 语音对话 AI（26）
  - 👁️ `vision-ai.md` 视觉 AI / 相机（22）
  - 👓 `wearable.md` AI 可穿戴（17）
  - 🤖 `robot.md` AI 机器人（26）
  - 🧸 `toys.md` AI 玩具 / 桌宠（15）
  - 🚗 `autonomous.md` 自动驾驶 / 无人机（24）
  - ⚡ `edge-inference.md` 边缘推理 / TinyML（26）
  - 🔌 `dev-board.md` 开发板 / 参考硬件（20）
  - 📚 `awesome-lists.md` Awesome 合集（18）

### 新增

- `CHANGELOG.md`：版本变更记录
- `catalog/` 下 9 个新主题文件，统一模板：H1 + 筛选标准 + 项目表格（# / Project / ⭐ / Lang / Cost / Diff / Description / Link）+ 选型建议
- `README.md` 新增"精选项目全景"区块，附 8 个分类预览表
- `README.md` 新增 5 步 Quick Start：选赛道 → 看 BOM → 选开发板 → 接 LLM → 跑教程

### 变更

- `CATALOG.md` 重建为 9 段索引，每段显示 3 个代表项目
- `README.md` 文档导航更新为"200+ AI 硬件项目"
- 仓库可见性：private → **public**

### 移除

- 旧分类文件已移入回收站（保留备份）：
  - `catalog/ai-interact.md`
  - `catalog/ai-software.md`
  - `catalog/ai-vision.md`
  - `catalog/kids.md`
  - `catalog/maker.md`
  - `catalog/other.md`
  - `catalog/smart-home.md`
- 删除非 AI 类项目（约 714 条）：
  - 纯固件 / 嵌入式工具：ESP32Marauder、urh、nodemcu-firmware、platformio-core 等
  - 纯软件 / 与硬件无关：AutoGPT、VPN 脚本、Ubuntu 配置脚本、amazon-sagemaker-examples 等
  - 误分类：Embedded-Engineering-Roadmap、Meshtastic（LoRa mesh）、BCN3D-Moveo 等
  - 重复条目：OpenArm、AirSim、lidar-slam-detection 等

### 筛选标准

> AI 模型组件 + 硬件实现 + 公开仓库或完整教程 — 三者必须同时满足

---

## [1.0.2] - 2026-06-22

### 变更

- 索引页（`CATALOG.md`）每个分类显示 3 个代表项目
- 重新归类被误判为软件的硬件项目（360 → 249）
- 文档：`docs/llm-integration-guide.md` 重写阿里云通义多模态实时交互章节，新增千问 AI raw-protocol 方案
- 分类调整：消费电子 → 其他消费电子

### 新增

- 8 个硬件分类 + AI 软件 + 消费电子的结构

---

## [1.0.1] - 2026-06-21

### 变更

- 将 10 个 getting-started 教程按 3 个主题重组：Robotics / AI Apps / Tools
- 合并 Tools 到 AI Applications 区块
- 移除私有知识库引用，补充关联项目

---

## [1.0.0] - 2026-06-21

### 初始发布

- 10 个 getting-started 教程：ESP32 Voice Assistant、SO-ARM100、OpenCat、OpenGlass、JetBot、Ollama、Home Assistant、Open_Duck_Mini、Klipper + Obico、ArduPilot
- 908 个项目目录（catalog/）
- 5 份 BOM 清单（bom/）
- 文档：`docs/llm-integration-guide.md`、`docs/supply-chain-guide.md`
- MIT License、中英双语 README

[1.1.0]: https://github.com/smile-xuc/aihw-starter/compare/5c8583a...cf399ee
[1.0.2]: https://github.com/smile-xuc/aihw-starter/compare/e8279cc...5c8583a
[1.0.1]: https://github.com/smile-xuc/aihw-starter/compare/762d811...e8279cc
[1.0.0]: https://github.com/smile-xuc/aihw-starter/commit/762d811
