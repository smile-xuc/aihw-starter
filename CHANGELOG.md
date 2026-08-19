# Changelog

本仓库的所有重要变更记录于此。
格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [SemVer](https://semver.org/lang/zh-CN/)。

## [2.1.0] - 2026-08-19

### 新增

#### `solutions/by-solution/omni-realtime/` — Omni 实时端到端方案 · Runtime Host 中间层

千问方案的子形态：用 Qwen-Omni-Realtime 做端到端实时语音，配一层自建宿主（Runtime Host）把模型接到硬件上。适合桌面 / 伴随机器人等对首字延迟和拟人度要求高的高价值单品。内容基于真实项目配置快照做架构反推，已脱敏。

- `README.md` — 15 节方案主文档：链路总览、能力核对清单、六类职责、三条落地路径、三个执行语义、`session.update` 时机与四条硬约束、首包成本对照、成本结构、三阶段落地、三个坑、合规提示
- `session.update.template.json` — 脱敏首包模板，含三类前缀的代表性工具与全部占位槽
- `instructions.template.md` — 提示词骨架：章节顺序 + 六个动态槽位 + 各段写法
- `harness_skeleton.py` — Runtime Host 最小可运行骨架（MIT）：建连、装配、前缀路由、`function_call_output` 回传、事件注入、会话滚动、打断
- `.env.example` — 环境变量样例

#### `docs/omni-runtime-host.html` — 交互式架构页

Runtime Host 架构的可视化版本，含搜索、分类标签过滤、折叠区块，风格与门面页一致。

### 变更

- `solutions/by-solution/01-qwen.md` 新增 1.3 节「端到端实时语音：Qwen-Omni-Realtime + Runtime Host 中间层」，能力地图补充 Realtime 指向
- `solutions/by-solution/README.md`、根 `README.md`、`docs/index.html` 增加新方案入口

### 修复

- 修正 `01-qwen.md` 品类适配表三个失效链接：桌宠 `04→05-desktop-pet`、AI 耳机 `05→06-ai-earphone`、录音卡 `06→07-recorder`

## [2.0.0] - 2026-06-24

### ⚠️ BREAKING CHANGE：仓库定位重构

仓库定位从**「AI 硬件 starter kit / 项目目录」**整体转向**「AI 硬件行业热门品类的商业化最佳实践案例库」**。
不是 API 文档镜像，不是开源项目导航，而是从「这门生意能不能做、怎么搭、怎么算账」出发的工程化案例集。

仓库定位**客观中立**：

- **示例方案**：以**千问大模型**作为示例方案进行端到端演示
- **后续会补充**：豆包 / Kimi / 智谱 / DeepSeek / OpenAI 等主流方案；优秀方案商的端到端方案；端侧/混合方案
- **欢迎贡献**：参见 `CONTRIBUTING.md`

### 新增

#### `solutions/` — 6 个热门品类的商业化方案（核心内容）

每个品类目录下统一结构：`README.md` + `01-business.md` + `02-solution.md` + `03-cost.md` + `04-cases.md` + `05-faq.md` + `demo/`。

- `01-toys-companion/` AI 玩具 / 陪伴 / 儿童伴学（**完整版**）
  - 自定义对话角色 + 声音克隆，IP 与儿童陪伴双线
  - 订阅制目前**未跑通**，多数处于第一年免费送阶段
- `02-desktop-pet/` 桌宠 / 毛绒（**占位版**）
  - 动作 / 情绪标签 + 情感 TTS，三路同步驱动表情、动作、语音
- `03-recorder/` 录音卡 / 会议盒子（**占位版**）
  - ASR + 纪要 Agent，2–5 分钟出结构化纪要
- `04-ai-earphone/` AI 耳机（**占位版**）
  - 实时翻译 / 对话 / 听记多用途；白牌 AI 化已成卖点，订阅化极度受限
- `05-ipc/` IPC / AI 视觉（**完整版**）
  - 视频以文搜图 + 摘要订阅
  - **唯一已知跑通**的 AI 硬件订阅样板间（Ring / Nest / Arlo / 萤石云 / TP-LINK）
- `06-ai-glasses/` AI 眼镜（**占位版**）
  - 多模态交互套件，端到端打包

#### `awesome/` — 生态资源索引（精选样板的全集补充）

- `awesome/open-source/` 开源项目索引（含 `ai-hardware-projects.html` 交互式目录页），按 6 大品类分类
- `awesome/commercial-products/` 在售商业化产品案例索引，含官网 / 形态 / 定价 / 目标市场 / AI 能力 / 公开数据 / 商业模式等结构化字段

#### `future/` — 路线图（待晋升的早期方向）

- `lobster.md` 具身智能 / 桌面服务机器人方向（含 VLA 端云协同、数据成本、商业化路径分析）
- `watch.md` 智能手表 / 健康可穿戴 AI 化方向（含 Whoop / Oura 订阅样板）
- `README.md` 收录原则与晋升至 `solutions/` 的判定标准

#### 其他根目录文件

- `faq.md` 跨品类通用 FAQ（Q1–Q28，覆盖商业模式 / 选型 / 形态 / 架构 / 合规 / 计费 / 账号 7 章）
- `CONTRIBUTING.md` 贡献指南（含「新增其他大模型方案」「新增方案商端到端方案」「新增品类」「新增开源项目」四类贡献路径）
- `docs/index.html` GitHub Pages 单文件门面页（暗色主题，Hero + 站位声明 + 6 品类卡片 + 角色入口 + 生态索引 + 路线图）
- `docs/README.md` GitHub Pages 启用说明

### 移除

#### 旧版仓库整体下线（v1.x 内容已不再适用新定位）

- `bom/`：5 份 BOM 清单（esp32-voice / quadruped / robot-arm / smart-glasses / vision-rover）
- `catalog/`：v1.1.0 重建后的 9 个端侧 AI 硬件主题目录（voice-ai / vision-ai / wearable / robot / toys / autonomous / edge-inference / dev-board / awesome-lists）
- `getting-started/`：10 篇 hands-on 教程（ESP32 Voice、SO-ARM100、OpenCat、OpenGlass、JetBot、Ollama、Home Assistant、Open_Duck_Mini、Klipper + Obico、ArduPilot）
- `docs/llm-integration-guide.md` / `docs/supply-chain-guide.md`
- `CATALOG.md`：旧根目录索引页

旧内容如需查阅，可在 git 历史中检出 `v1.1.0` tag 或 `68ed1e2` 之前的提交。

### 站位与脱敏原则

- 所有内容客观中立，不为单一厂商背书
- 严格脱敏：不包含具体客户名称、ARPU、转化率、合同金额；所有量级数据使用「个位数 / 十位数 / 百万级」等区间表达
- 订阅可行性统一使用「**已知跑通 / 未跑通**」框架描述

### License

- 内容采用 [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) 协议
- 代码采用 [MIT](./LICENSE) 协议

---

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

[2.0.0]: https://github.com/smile-xuc/aihw-starter/compare/v1.1.0...v2.0.0
[1.1.0]: https://github.com/smile-xuc/aihw-starter/compare/5c8583a...cf399ee
[1.0.2]: https://github.com/smile-xuc/aihw-starter/compare/e8279cc...5c8583a
[1.0.1]: https://github.com/smile-xuc/aihw-starter/compare/762d811...e8279cc
[1.0.0]: https://github.com/smile-xuc/aihw-starter/commit/762d811
