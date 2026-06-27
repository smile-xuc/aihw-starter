# 千问大模型方案（Qwen / 百炼）

> 阿里通义千问开源大模型 + 百炼应用接入平台，本仓库 `solutions/by-category/0X-xxx/02-solution.md` 中默认使用此方案做端到端演示。

## 1. 两类接入模式

百炼平台为 AI 硬件提供两种接入粒度，适合不同阶段和团队：

| | 成套产品 | 原子能力 |
|---|---|---|
| 代表 | **百炼 · 多模态交互开发套件** | **百炼 CLI + DashScope API** |
| 定位 | 端到端打包，低代码上线 | 按需组合，灵活度最高 |
| 适合 | 快速 POC / 品牌商 / 算法资源有限的团队 | 自研栈成熟、需精细调优的开发者 |
| 交付物 | 端侧 SDK + 云端全链路 + 可视化管理平台 | 单个 API / CLI 命令 |
| 典型周期 | 1–2 周跑通 demo | 数天到数周（取决于集成深度） |

---

### 1.1 成套产品：百炼 · 多模态交互开发套件

> 文档入口：<https://help.aliyun.com/zh/model-studio/multimodal-products-overview>

一句话：**把 ASR → LLM → TTS 全流式链路打包成一个端到端产品**，端侧提供多平台 SDK，云端提供可视化配置管理，开发者只需关注业务逻辑。

**架构总览：**

```
┌──────────────────── 端侧 ────────────────────┐
│  麦克风 / 摄像头                              │
│       ↓                                       │
│  ┌────────────────────────────────────┐       │
│  │          端侧 SDK                  │       │
│  │  ┌─────┐  ┌────────┐  ┌────────┐  │       │
│  │  │ VAD │  │回声消除 │  │语音唤醒 │  │       │
│  │  └─────┘  └────────┘  └────────┘  │       │
│  └────────────────┬───────────────────┘       │
│  支持：Android / iOS / Linux / RTOS           │
└───────────────────┼───────────────────────────┘
                    │ 全双工流式通信
                    ▼
┌──────────────────── 云端 ────────────────────┐
│                                               │
│  ┌─── 端到端全流式系统 ───────────────────┐   │
│  │                                        │   │
│  │   ASR ──→ LLM（通义大模型）──→ TTS    │   │
│  │            │                           │   │
│  │    ┌───────┼───────┐                   │   │
│  │    ▼       ▼       ▼                   │   │
│  │ 视觉理解 文本理解 语音理解             │   │
│  └────────────────────────────────────────┘   │
│                                               │
│  ┌─── 可视化配置管理平台 ─────────────────┐   │
│  │ 模型 │ 提示词 │ 知识库 │ Agent │ 插件  │   │
│  │                      │ 设备指令        │   │
│  └────────────────────────────────────────┘   │
└───────────────────────────────────────────────┘
```

**关键特性：**

- **全双工对话** — 用户可随时打断，系统即时调整（非 turn-based）
- **超低延迟** — 行业领先的视频与语音首包时延
- **声音克隆** — 一句话即可复刻音色，适合玩具 / 陪伴类 IP 角色
- **模型可替换** — 底层 LLM / TTS / ASR 可按需切换百炼平台上的任意模型
- **多端适配** — Android / iOS / Linux / RTOS，覆盖从手机到 MCU 的全形态

**开源 Demo：**

```bash
# 百炼语音 SDK 示例（多模态对话）
git clone https://github.com/aliyun/alibabacloud-bailian-speech-demo.git
cd samples/conversation/multimodal_dialog
```

---

### 1.2 原子能力接入：百炼 CLI + DashScope API

> CLI 入口：<https://bailian.console.aliyun.com/cli>
> API 文档：<https://help.aliyun.com/zh/model-studio/developer-reference/>

一句话：**一行命令调用百炼全模态 AI 能力**，适合自研栈成熟的开发者按需组合。

**百炼 CLI（`bl` 命令）** 是官方开源命令行工具，免费安装、按模型调用量计费。安装后即可在终端或 Agent 环境中直接调用文本生成、语音识别、语音合成、图像生成、视频生成、联网搜索等 10+ 项能力。

**安装：**

```bash
npm i -g @alibaba/bailian-cli
```

**常用命令速览：**

| 子命令 | 能力 | 典型硬件场景 |
|---|---|---|
| `bl speech recognize` | ASR（语音识别） | 录音卡纪要、AI 耳机听写 |
| `bl speech synthesize` | TTS（语音合成） | 玩具对话、陪伴角色 |
| `bl omni` | 全模态对话 | 实时语音交互 |
| `bl vision describe` | 图像理解 | IPC 画面分析、AI 眼镜 |
| `bl image generate` | 图像生成 | 桌宠表情包、展示素材 |
| `bl search` | 联网搜索 | 信息查询、时效性回答 |
| `bl knowledge retrieve` | 知识库检索 | 产品 FAQ、用户手册 |

**DashScope SDK** 提供 Python / Node / Java / Go 多语言支持，适合嵌入到产品后端服务中做深度集成。两者能力完全等价，CLI 适合快速验证和 Agent 编排，SDK 适合生产部署。

---

## 2. 能力地图

| 能力 | 模型 / 接口 | 适用场景 | 接入方式 |
|---|---|---|---|
| **文本对话 / 推理** | Qwen-Max / Qwen-Plus / Qwen-Turbo | 角色对话、摘要、规划 | DashScope Chat API / `bl` CLI |
| **视觉理解** | Qwen-VL（图像）/ Qwen-VL-Video（视频） | IPC 摘要 / 以文搜图 / 户外告警 | DashScope 多模态接口 |
| **全模态对话** | Qwen-Omni | 实时语音对话、端到端低时延 | 多模态交互开发套件 / `bl omni` |
| **TTS / 情感语音** | Qwen-TTS / CosyVoice | 角色音色、声音克隆、情感合成 | DashScope 语音接口 / `bl speech synthesize` |
| **ASR / 语音识别** | Paraformer 系列 | 录音卡纪要、AI 耳机听写 | DashScope ASR / `bl speech recognize` |
| **Function Calling** | Qwen Chat + tools | Agent 调度（设备控制 / 检索 / 翻译） | DashScope 通用工具调用 |
| **内容感知（OSS）** | 阿里云 OSS AI 媒资处理 | IPC 云存量数据上 AI 不动现有架构 | OSS 内容感知开关 |
| **应用编排** | 百炼应用 / 工作流 | 无代码搭建对话流、知识库、RAG | 百炼控制台 |

## 3. 品类适配

> 链接到各品类目录下的 `02-solution.md`，那里有详细的推荐架构与代码示例。

| 品类 | 对应方案文档 | 推荐接入模式 |
|---|---|---|
| 📷 [IPC / AI 视觉](../by-category/01-ipc/02-solution.md) | 双版本：百炼物理世界感知 Agent / OSS AI 内容感知 | 原子能力（Qwen-VL + OSS） |
| 👓 [AI 眼镜](../by-category/02-ai-glasses/02-solution.md) | 多模态交互套件端到端打包 | **成套产品**（开发套件直接对接） |
| 🧸 [AI 玩具 / 陪伴](../by-category/03-toys-companion/02-solution.md) | 角色对话 + 声音克隆 | 成套产品 或 原子能力均可 |
| 🪴 [桌宠](../by-category/04-desktop-pet/02-solution.md) | 动作 / 情绪标签 + 情感 TTS 三路同步 | 原子能力（精细控制动作同步） |
| 🎧 [AI 耳机](../by-category/05-ai-earphone/02-solution.md) | 实时翻译 / 听记 / 对话多用途 | 成套产品（低延迟全双工） |
| 🎙️ [录音卡 / 会议盒子](../by-category/06-recorder/02-solution.md) | ASR + 纪要 Agent | 原子能力（`bl speech recognize`） |

## 4. 典型 BOM 与计费量级

- **硬件 BOM 增量**：依品类而异，最低可至 0（IPC 直接软件升级），最高 20–50 元（玩具新增语音 SoC + 麦克风阵列）
- **云端按量计费**：百炼 / DashScope 公开 token / 时长 / 次计价，详见 [百炼定价页](https://help.aliyun.com/zh/model-studio/billing-of-model-studio)
- **典型用户单价**：在 IPC 品类已能跑通 5–10 元/月 AI 订阅（见 [01-ipc/03-cost.md](../by-category/01-ipc/03-cost.md)）

## 5. 接入路径

```
成套产品路径（推荐品牌商 / 快速 POC）：
   百炼控制台 → 多模态交互开发套件 → 集成端侧 SDK → 上线
                       ↓
            可视化配置：模型 / 提示词 / 知识库 / Agent

原子能力路径（开发者 / 精细化）：
   安装 bl CLI → 快速验证各能力 → DashScope SDK 生产集成 → 各品类 demo/ 改造
```

## 6. 替代 / 互补方案

| 场景 | 替代或补充方案 |
|---|---|
| 端侧离线唤醒 | 见 [小智开源方案](./02-xiaozhi.md) |
| 海外模型成本对比 | OpenAI / Gemini / Claude（欢迎 PR） |
| 端侧推理 | Qwen 开源系列 + Hugging Face / Ollama |
| 开源全栈参考 | 见 [Talk-to-Fengge 架构启发](./04-talk-to-fengge.md) |

---

> 回到 [方案总览](./README.md) · 切到 [按品类](../by-category/) 视角
