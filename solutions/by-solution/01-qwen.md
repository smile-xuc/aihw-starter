# 千问大模型方案（Qwen / 百炼）

> 阿里通义千问开源大模型 + 百炼应用接入平台，本仓库 `solutions/0X-xxx/02-solution.md` 中默认使用此方案做端到端演示。

## 1. 能力地图

| 能力 | 模型 / 接口 | 适用场景 | 接入方式 |
|---|---|---|---|
| **文本对话 / 推理** | Qwen-Max / Qwen-Plus / Qwen-Turbo | 角色对话、摘要、规划 | DashScope / 百炼 Chat API |
| **视觉理解** | Qwen-VL（图像）/ Qwen-VL-Video（视频） | IPC 摘要 / 以文搜图 / 户外告警二次确认 | DashScope 多模态接口 |
| **全模态对话** | Qwen-Omni | 实时语音对话、端到端低时延 | 百炼实时通话 |
| **TTS / 情感语音** | Qwen-TTS / CosyVoice | 角色音色、声音克隆、情感合成 | DashScope 语音接口 |
| **ASR / 语音识别** | Paraformer 系列 | 录音卡纪要、AI 耳机听写 | DashScope 实时 / 离线 ASR |
| **Function Calling** | Qwen Chat + tools | Agent 调度（设备控制 / 检索 / 翻译） | DashScope 通用工具调用 |
| **内容感知（OSS）** | 阿里云 OSS AI 媒资处理 | IPC 云存量数据上 AI 不动现有架构 | OSS 内容感知开关 |
| **应用编排** | 百炼应用 / 工作流 | 无代码搭建对话流、知识库、RAG | 百炼控制台 |

## 2. 品类适配

> 链接到各品类目录下的 `02-solution.md`，那里有详细的推荐架构与代码示例。

| 品类 | 对应方案文档 | 推荐能力组合 |
|---|---|---|
| 📷 [IPC / AI 视觉](../by-category/01-ipc/02-solution.md) | 双版本：百炼 物理世界感知 Agent / OSS AI 内容感知 | Qwen-VL + OSS 内容感知 |
| 👓 [AI 眼镜](../by-category/02-ai-glasses/02-solution.md) | 多模态交互套件端到端打包 | Qwen-Omni + Qwen-VL + TTS |
| 🧸 [AI 玩具 / 陪伴](../by-category/03-toys-companion/02-solution.md) | 角色对话 + 声音克隆 | Qwen-Max + CosyVoice + Function Call |
| 🪴 [桌宠](../by-category/04-desktop-pet/02-solution.md) | 动作 / 情绪标签 + 情感 TTS 三路同步 | Qwen-Max + Qwen-TTS |
| 🎧 [AI 耳机](../by-category/05-ai-earphone/02-solution.md) | 实时翻译 / 听记 / 对话多用途 | Qwen-Omni + Paraformer |
| 🎙️ [录音卡 / 会议盒子](../by-category/06-recorder/02-solution.md) | ASR + 纪要 Agent | Paraformer + Qwen-Max |

## 3. 典型 BOM 与计费量级

- **硬件 BOM 增量**：依品类而异，最低可至 0（IPC 直接软件升级），最高 20–50 元（玩具新增语音 SoC + 麦克风阵列）
- **云端按量计费**：百炼 / DashScope 公开 token / 时长 / 次计价，详见 [百炼定价页](https://help.aliyun.com/zh/model-studio/billing-of-model-studio)
- **典型用户单价**：在 IPC 品类已能跑通 5–10 元/月 AI 订阅（见 [01-ipc/03-cost.md](../by-category/01-ipc/03-cost.md)）

## 4. 接入路径

```
最快路径（推荐）：
   品牌商 ──► 百炼应用 / 工作流（无代码搭建）──► 各品类 02-solution.md
                       │
                       └──► 上线后再切到 DashScope 原生 API 做精细化

代码路径（开发者）：
   开发者 ──► DashScope SDK（Python / Node / Java / Go）──► 跑 demo/ 改造
```

## 5. 替代 / 互补方案

| 场景 | 替代或补充方案 |
|---|---|
| 端侧离线唤醒 | 见 [小智开源方案](./02-xiaozhi.md) |
| 海外模型成本对比 | OpenAI / Gemini / Claude（欢迎 PR） |
| 端侧推理 | Qwen 开源系列 + Hugging Face / Ollama |

---

> 回到 [方案总览](./README.md) · 切到 [按品类](../by-category/) 视角
