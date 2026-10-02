# Qwen Audio Agent 开源方案（实时语音 harness）

> [qwen-audio-agent](https://github.com/QwenAudio/qwen-audio-agent) 是 QwenAudio 组织以 Apache-2.0 开源的实时语音 Agent 运行框架。[技术报告](https://arxiv.org/abs/2609.25195)（署名 Alibaba Token Foundry, Alibaba Group）称其为 "a harness that combines full-duplex voice interaction with asynchronous task execution"：Realtime 模型在前台持续对话，需要工具、文件或长时间处理的任务异步交给后台 Agent，结果再回到当前对话。默认前台模型是百炼 `qwen-audio-3.0-realtime-plus`。
>
> 本页是**可用导读**（跨品类横切），不是官方商业方案，客观中立，不做项目背书。项目信息以 main 分支 `f6dd0e3`（2026-09-28）和 v2.0.1（2026-09-26）为准，价格为北京地域目录价，均查证 2026-10-02。

## 1. 项目速览

| 项 | 内容 |
|---|---|
| **组成** | Gateway（Node.js 服务，承载前台 Agent、编排运行时和后台接入）+ 参考客户端：WebUI、终端 TUI、桌面悬浮球（macOS / Windows / Linux）；iOS / Android 目前只有开发构建，未上架应用商店 |
| **安装** | `npm install -g qwen-audio-agent`，命令为 `qwenaudio`；需要 Node.js 22.22.2+ 或 24.15.0+ |
| **三层分工** | 前台 Agent：Realtime 模型 + 提示词 + 工具，负责对话和即时操作；编排运行时：任务状态、授权确认、结果投递时机；后台 Agent：经 ACP、A2A 或自定义 Adapter 接入的执行环境，也可以不接（仅前台模式） |
| **许可** | Apache-2.0 |
| **维护** | 2026-07-28 开源（v0.9.0）；2026-09-23 发布 v2.0.0，重构编排运行时、统一客户端协议；2026-09-26 发布 v2.0.1。main 约 810 次提交，GitHub Star 约 2,800 |

「云端 / 本地都能跑」的准确含义：

- **宿主自托管**：Gateway 跑在本机、家用电脑 / NAS 或自有服务器上，项目不提供托管服务。
- **语音前台可云可本地**：云端可接百炼、OpenAI、Google、火山引擎、StepFun 的 Realtime 服务；本地可接 Hugging Face Speech-to-Speech（STT / LLM / TTS 可配置的本地服务）或 MiniCPM-o 4.5（本地或云端兼容服务，不支持工具调用）。
- **设备是瘦终端**：设备只负责收音、播放和展示，经 Gateway 客户端协议接入；项目不含 MCU 端侧推理。

## 2. 能力地图

| 能力 | 项目里的实现 | 要点 / 边界 |
|---|---|---|
| **实时对话前台** | 可替换的 Realtime Provider。百炼可选 `qwen-audio-3.0-realtime-plus`（默认）/ `-flash`、`qwen3.5-omni-plus-realtime` / `qwen3.5-omni-flash-realtime`、`qwen3.8-omni-flash-realtime`（需业务空间专属地址）；另有 GPT-Live、Gemini Live、豆包 Seeduplex 3.0、StepAudio 3 和两种本地前台 | 一个 Gateway 同时只用一个前台模型。`qwen-audio-3.1-realtime-plus` 不在 `f6dd0e3` 的模型目录里，填入会被拒绝。看图要选 Omni、Gemini Live 或 MiniCPM-o 前台 |
| **后台任务委派** | 前台用 `spawn_thinking` 工具把任务交给后台 Agent；任务与对话轮次解耦，可并行多个任务，可追问进度、取消 | 后台经 ACP 接 Qwen Code、OpenCode、OpenClaw、Qoder、Kimi Code、Codex、Claude Code 等（README 按集成验证程度打星），也可走 A2A 或自定义 Adapter |
| **判停与打断** | 全双工打断；Qwen Audio 前台固定用 `smart_turn` 语义轮次，Omni 前台用 `semantic_vad` | [百炼文档](https://help.aliyun.com/zh/model-studio/qwen-audio-realtime-user-guides)称 `smart_turn` 下「嗯」「啊」这类附和声不会打断对话；项目不暴露 `server_vad` 手动调参 |
| **打断不丢任务** | [架构文档](https://qwenaudio.github.io/qwen-audio-agent/zh/architecture/deep-dive)称静音、语音打断、休眠和前台断连都不取消已受理的后台工作；结果在用户说话时等待安全窗口再播报，已开始播放的结果不因打断而反复重播 | 「打断说话」和「取消任务」是两个动作，设备按键语义要分开设计 |
| **人格与记忆** | 会话音色可配（Qwen Audio 默认 `longanqian`）；`ASSISTANT.md` 写助理名称与人格，`USER.md`、`MEMORY.md` 存长期偏好和事实；提醒、笔记、知识库；记忆与知识库可换外部 Provider | 模型侧的声音复刻音色、说话人增强（锁定目标说话人、屏蔽旁人声），项目文档未写接入方式（待核实） |
| **客户端协议** | [Gateway Client Protocol](https://qwenaudio.github.io/qwen-audio-agent/zh/gateway-protocol)（GCP，Stable 7.0）：每个客户端一条 WebSocket，JSON 事件 + base64 PCM（上行 16 kHz、下行 24 kHz）；客户端可上报环境事件、注册客户端工具（每连接最多 32 个） | 可选 WebRTC 传输为实验性 0.1，只覆盖客户端到 Gateway 一段 |
| **硬件接入示例** | [AI Passport](https://qwenaudio.github.io/qwen-audio-agent/zh/scenarios/ai-passport)：ESP32-C3 卡片运行外部固件「千问语音豆」，经局域网连到电脑上的设备转发器 `device-relay.mjs`，再转成 GCP 接入本机 Gateway | 目前只开放半双工：播放时暂停上传，无回声消除，靠按键打断；明文 WebSocket 只用于可信局域网 |
| **唤醒与常驻** | 桌面版本地唤醒词（首次启用下载约 33 MB 的 sherpa-onnx 模型，检测在本机进行，不上传唤醒词音频）、空闲休眠；Gateway 可装成用户服务常驻 | 唤醒在桌面客户端里，不在 MCU 上 |
| **访问控制** | 默认只监听本机回环地址；`--lan` 面向可信局域网，`--tailnet` 走 Tailscale；远程设备用可撤销的配对凭据 | 文档要求不直接暴露到公网，远程访问走 VPN 或 HTTPS/WSS 反向代理。同一 Gateway 下每个用户同一时刻只有一个活动客户端，新设备需接管 |

### 实时性与拟人化：设计与公开数据

- **链路**：前台是端到端 Realtime 模型（音频进、音频出），不走 ASR → LLM → TTS 三段。本仓 [benchmark](../benchmark/README.md) 中同走 Realtime 协议的 `qwen3.5-omni-flash-realtime` 体感延迟为 347 / 375 / 433 ms（轻 / 复杂 / 搜索），多模态交互开发套件全双工为 997 / 1058 / 1660 ms；Qwen-Audio-Realtime 和本项目尚未纳入实测，项目也未公布首包时延。
- **对话节奏**：`smart_turn` 结合声学与语义判断轮次，用户插话即停止播报；慢任务交给后台，前台不冷场，结果等用户说完再合并播报。
- **人格一致**：音色、人格文件和长期记忆跨会话保留。Qwen-Audio-3.0-Realtime-Plus 的第三方榜单成绩见 [千问方案第 6 节](./01-qwen/README.md)。
- **项目自测**（[技术报告](https://arxiv.org/abs/2609.25195)，本仓未复现）：自建座舱基准 134 例、41 个业务工具，前台 Qwen Audio 3.0 Realtime Plus、后台 `qwen3.8-max`。前台直连与后台委派混合执行的任务成功率为 91.04%，只用前台直连为 72.39%，全部委派为 80.60%；前台直连在 48 个多步任务中只完成 14 个。在 80 个所有配置都成功的轮次上，混合执行的平均任务执行时延为 4.729 s，比前台直连低 26.73%，比全部委派低 30.91%（从用户说完计到任务完成，不含回复生成与播放）。

## 3. 部署形态与硬件接入

```
设备（瘦终端：麦克风 / 扬声器 / 按键 / 屏）
   │  GCP over WebSocket（局域网，或 VPN / HTTPS 反代后的 WSS）
   │  参考设备 AI Passport 经 device-relay 转发
   ▼
Gateway（自托管：本机 / 家用电脑 / NAS / 自有服务器，Node.js 22+）
   ├─► 语音前台：云端 Realtime（百炼等）或本地推理服务
   └─► 后台 Agent：ACP / A2A / 自定义 Adapter（Qwen Code、OpenClaw、Codex …）
```

| 形态 | Gateway 在哪 | 设备侧 | 适合 |
|---|---|---|---|
| 一体机 | 设备本身（PC、桌面盒子、车机，需能跑 Node.js 22+） | 本机麦克风、扬声器、屏幕 | Agent 盒子、桌面助理、座舱 |
| 局域网中继 | 同一局域网的电脑、NAS 或边缘盒子 | ESP32 等瘦终端，参考 AI Passport | 家用玩具、桌宠、语音卡片 |
| 本地前台 | 本机 + 本地推理服务 | 同上 | 隐私优先、能自备算力 |
| 自有服务器 | 云主机，经 VPN 或 HTTPS/WSS 反向代理 | 设备经公网连自建入口 | 远程访问；量产多设备需每个用户一个 Gateway 实例或自建多租户层，项目未提供 |

## 4. 品类适配

上游已提供的示例：桌面办公、智能座舱、X-Omni 视觉对话、AI Passport、零售与航空客服；具身智能、直播助手为「规划中」（见[项目 README](https://github.com/QwenAudio/qwen-audio-agent) 与[示例索引](https://qwenaudio.github.io/qwen-audio-agent/zh/scenarios/)）。其中独立硬件终端只有 AI Passport（ESP32-C3，半双工）。本仓各品类目前没有基于本项目的 demo，下表是适配判断，不是已落地案例。

| 品类 | 适配度 | 说明 |
|---|:-:|---|
| 🤖 [Agent 硬件](../by-category/04-agent-hardware/) | ⭐⭐⭐⭐ | 「前台对话 + 后台办事」与品类定位一致；桌面悬浮球、智能座舱可直接参考；盒子要能常驻 Gateway |
| 🪴 [桌宠](../by-category/05-desktop-pet/) / 🧸 [AI 玩具 / 陪伴](../by-category/03-toys-companion/) | ⭐⭐⭐ | 人格文件、长期记忆、提醒可复用，动作可做成客户端工具；参考设备是半双工，全双工需设备侧回声消除；默认 Plus 档单价偏高，量产多设备要自建多租户 |
| 👓 [AI 眼镜](../by-category/02-ai-glasses/) / 🎧 [AI 耳机](../by-category/06-ai-earphone/) | ⭐⭐ | 设备本身跑不了 Gateway，要靠手机或云端宿主，移动端仍是开发构建；看图需 Omni 前台（X-Omni 示例用 WebUI 摄像头，不是眼镜硬件） |
| 🦾 [具身智能](../by-category/09-embodied/) | ⭐⭐ | 上游列为规划中，暂无示例；机器人调度见 [Qwen-Robot Suite](./05-qwen-robot.md) |
| 📷 [IPC](../by-category/01-ipc/) / 🎙️ [录音卡](../by-category/07-recorder/) / ⌚ [手表](../by-category/08-smart-watch/) | ⭐ | 主需求不是实时对话，或功耗与常驻宿主条件不匹配 |

## 5. 典型 BOM 与计费

### 5.1 费用构成

- **软件**：Apache-2.0，无授权费。
- **前台 Realtime 模型**：按 Token 计费；音频按时长折算 Token，多轮对话的历史每轮重新计入输入。
- **后台 Agent**：委派任务时另计，取决于所接 Agent 和模型（技术报告的座舱基准用 `qwen3.8-max`），下表不含。
- **宿主与设备**：Gateway 常驻的电脑、盒子或云主机；ESP32 类瘦终端的 BOM 量级可参考 [小智方案第 4 节](./02-xiaozhi.md)。
- **第三方前台**（OpenAI、Google、火山引擎、StepFun）按各家价格，本页未核实。

### 5.2 同口径对照

口径：每轮用户说 5 秒、AI 回复约 10 秒语音（回复文本约 40 Token）；系统提示与工具定义按 1,000 Token 计；10 轮约 2.5 分钟。按官方多轮计费规则，用户音频和模型输出文本计入上下文，此后每轮作为输入重算；instructions 每轮按文本计一次；模型输出音频只在输出时计一次。音频折算：Qwen-Audio Realtime 输入、输出均为每秒 12.5 Token；Omni Realtime 输入每秒 7 Token、输出每秒 12.5 Token。多模态交互开发套件按交互轮次计费（元/千次），与上下文长度无关。

| 方案 · 模型或配置 | 首轮 | 10 轮累计 | 折合每分钟 |
|---|--:|--:|--:|
| 多模态交互开发套件 · 轻量语音闲聊（2.3 元/千次） | ¥0.0023 | ¥0.023 | ¥0.009 |
| 多模态交互开发套件 · 标准语音闲聊（5.45 元/千次） | ¥0.0055 | ¥0.055 | ¥0.022 |
| 多模态交互开发套件 · 升级模型组合（12.55 元/千次）¹ | ¥0.013 | ¥0.13 | ¥0.050 |
| qwen-audio-agent · `qwen-audio-3.0-realtime-flash` | ¥0.0034 | ¥0.053 | ¥0.021 |
| **qwen-audio-agent · `qwen-audio-3.0-realtime-plus`（默认）** | **¥0.026** | **¥0.38** | **¥0.15** |
| Omni Realtime · `qwen3.8-omni-flash-realtime` | ¥0.0034 | ¥0.046 | ¥0.018 |
| Omni Realtime · `qwen3.5-omni-flash-realtime`（本仓 benchmark 所用） | ¥0.018 | ¥0.22 | ¥0.090 |
| Omni Realtime · `qwen3.5-omni-plus-realtime` | ¥0.050 | ¥0.65 | ¥0.26 |

¹ Fun-ASR（3 倍计次）+ 意图识别 + qwen3-tts / qwen-audio-3.0-tts（3 倍）+ qwen3.7-plus 对话（2 倍）：2.25 + 0.8 + 5.1 + 4.4。

单价（元/百万 Token，北京）：`qwen-audio-3.0-realtime-plus` 文本输入 5、音频输入 40、音频输出 150（输出文本不计费）；`qwen-audio-3.0-realtime-flash` 为 1.5 / 6 / 12；`qwen3.8-omni-flash-realtime` 为 1.5 / 6 / 12，另计输出文本 4.5；`qwen3.5-omni-flash-realtime` 为 3.3 / 27 / 107；`qwen3.5-omni-plus-realtime` 为 10 / 80 / 300。`qwen-audio-3.1-realtime-plus` 与 3.0 Plus 同价，但项目暂不支持。Qwen-Audio Realtime 与 `qwen3.8-omni-flash-realtime` 的新加坡地域单价约为北京的 1.1–1.2 倍。

**价格定位**：

- 默认 Plus 档 10 轮累计约为套件标准语音闲聊的 7 倍、轻量语音闲聊的 17 倍、升级模型组合的 3 倍；首轮约为标准语音闲聊的 5 倍。
- 换 Flash 档后与套件标准语音闲聊同一量级（10 轮 ¥0.053 对 ¥0.055）。
- 对照 Omni Realtime：Plus 档约为 `qwen3.5-omni-plus-realtime` 的 0.6 倍，但约为 `qwen3.5-omni-flash-realtime` 的 1.7 倍、`qwen3.8-omni-flash-realtime` 的 8 倍。「高于套件、低于 Omni」只在默认 Plus 档对照 3.5-Omni-Plus 时成立。
- 套件按轮计费，不随上下文增长；Realtime 按 Token 计费，历史每轮重算，聊得越久差距越大。可调的是前台档位、`max_history_turns`（默认 20 轮）和会话滚动。

**口径之外还要算的**：

- harness 自带的前台提示词约 2,900 字符、6 个默认工具定义约 3,100 字符（JSON，`f6dd0e3` 实测），再加人格、记忆和客户端工具，每轮都计入输入。按比上表多 1,000–2,000 Token 估，10 轮 Plus 档约多 ¥0.05–0.10，Flash 档约多 ¥0.015–0.03。
- 限流：`qwen-audio-3.0-realtime-plus` / `-flash` 默认 RPM 60、TPM 100,000，`qwen3.8-omni-flash-realtime` 为 RPM 60、TPM 2,000,000。按每路对话每分钟 7,000–15,000 Token 估，100,000 TPM 约支撑 7–14 路同时对话（估算，以控制台配额为准）。
- 套件另有设备订阅（2 / 5 / 10 元/台/年三档，100 台起购，购买后得到共享资源池）和节省计划折扣，上表只按后付费对照。

> 来源：[模型价格（含实时语音对话 Token 折算与多轮计费规则）](https://help.aliyun.com/zh/model-studio/model-pricing) · [qwen-audio-3.0-realtime-plus](https://help.aliyun.com/zh/model-studio/qwen-audio-3-0-realtime-plus) · [qwen-audio-3.0-realtime-flash](https://help.aliyun.com/zh/model-studio/qwen-audio-3-0-realtime-flash) · [qwen-audio-3.1-realtime-plus](https://help.aliyun.com/zh/model-studio/qwen-audio-3-1-realtime-plus) · [qwen3.8-omni-flash-realtime](https://help.aliyun.com/zh/model-studio/qwen3-8-omni-flash-realtime) · [Qwen-Omni-Realtime 计费与音频折算](https://help.aliyun.com/zh/model-studio/realtime) · [Qwen-Audio 实时语音对话](https://help.aliyun.com/zh/model-studio/qwen-audio-realtime-user-guides) · [多模态交互开发套件产品计费](https://help.aliyun.com/zh/model-studio/product-billing)（均查证 2026-10-02）

## 6. 与千问方案、多模态交互开发套件的关系

qwen-audio-agent 用的仍是千问 Realtime 模型，补的是模型与设备之间的宿主层。三条路径的边界：

| 维度 | 百炼多模态交互开发套件 | 直连 Realtime + 自建 Runtime Host | qwen-audio-agent |
|---|---|---|---|
| **本仓文档** | [千问方案第 1.1 节](./01-qwen/README.md) | [omni-realtime](./01-qwen/omni-realtime/) | 本页 |
| **交付形态** | 云端托管链路 + 端侧 SDK（Android / iOS / Linux / RTOS）+ 控制台配置 | 只有模型 API，宿主自己写 | 开源宿主（Gateway）+ 参考客户端，自己部署运维 |
| **对话链路** | 流式 ASR → LLM → TTS，对话模型可换（含 Omni） | Omni / Audio Realtime 端到端 | Realtime 端到端，前台可换（含 Omni、第三方、本地） |
| **办事能力** | 控制台配置 Agent、插件、知识库 | 自己实现工具路由 | 前台直连工具 + 后台 Agent 异步委派，可追问、可取消 |
| **设备端** | 官方 SDK，含端侧 VAD、回声消除、唤醒 | 自己做 | 按 GCP 自写客户端；参考设备半双工 |
| **计费** | 按交互轮次计次，或设备订阅 | 模型 Token | 前台模型 Token + 后台 Agent 费用 + 宿主 |
| **多设备量产** | 平台托管 | 自建 | 宿主按个人助理设计，需自建多租户 |

[omni-realtime 第 4 节](./01-qwen/omni-realtime/README.md#4-runtime-host-六类职责)把自建宿主拆成六类职责，qwen-audio-agent 的对应实现可作对照：

| Runtime Host 职责 | qwen-audio-agent 中的对应 |
|---|---|
| 装配器 | 前台提示词 + `ASSISTANT.md` / `USER.md` / `MEMORY.md` + 工具目录 |
| 路由器 | 前台直连工具、客户端工具、`spawn_thinking` 后台委派 |
| 状态机 | 客户端租约与接管、静音、休眠 / 唤醒 |
| 注入器 | 客户端上报的环境事件；后台结果在安全窗口合并投递 |
| 设备桥 | GCP 客户端工具，客户端回报动作是否执行成功 |
| 记忆管道 | 长期记忆文件 + 可换的 Memory Provider |

选型直觉：

| 诉求 | 更偏向 |
|---|---|
| 量产设备，要官方 RTOS / Android SDK 和可预测的按次计费 | 多模态交互开发套件 |
| 高价值单品，要自己掌控动作同步与每轮成本 | 直连 Omni Realtime + 自建 Runtime Host |
| 对话中要真正办事（文件、代码、业务系统），设备侧有可常驻的宿主（PC、盒子、车机） | qwen-audio-agent |
| 想先拿一套完整的开源宿主做原型，再决定是否自建 | qwen-audio-agent，再对照 omni-realtime 补设备侧细节 |

> 命名：阿里云开发者社区 2026-09-16 的一篇[百炼 Agent Studio 介绍](https://developer.aliyun.com/article/1763850)把面向硬件的部分写作 Agent Studio for Hardware，所述能力（Android / iOS / Linux / RTOS SDK、全双工语音）与多模态交互开发套件一致；帮助中心、产品页和计费页截至 2026-10-02 仍用「多模态交互开发套件」，改名待核实，本页沿用帮助中心名称。

## 7. 能力边界与待核实

- `qwen-audio-3.1-realtime-plus`（2026-09-20 上架）尚未进入项目模型目录。
- 首包音频时延：项目未公布，本仓 benchmark 待补 Qwen-Audio-Realtime 实测。
- 声音复刻音色、说话人增强：模型支持，项目是否可配待核实。
- 硬件示例只有 AI Passport 一款，半双工；全双工设备端（回声消除、语音打断）需自行实现。
- WebRTC 传输为实验性；移动端只有开发构建。
- 第三方前台的价格与限流未核实。

## 8. 落地检查清单

- [ ] 前台档位：Plus / Flash / Omni 按单价与实测效果选；确认所选模型在项目模型目录里
- [ ] 每轮输入体积：harness 提示词、人格、记忆、客户端工具加起来多少 Token；`max_history_turns` 与会话滚动策略
- [ ] 限流与并发：按 TPM 估同时在线路数，提前申请配额
- [ ] 设备端：按 GCP 写客户端；半双工还是全双工（全双工需回声消除）；打断键与取消任务键分开
- [ ] 宿主：每个用户一个 Gateway 还是自建多租户；常驻、升级、日志；远程访问走 VPN 或 HTTPS/WSS 反代，不直接暴露公网
- [ ] 后台 Agent：写操作授权、权限范围、费用上限
- [ ] 合规：录音、儿童与拟人化互动场景，见根目录 [faq](../../faq.md)

## 9. 开放资源

- [GitHub 仓库](https://github.com/QwenAudio/qwen-audio-agent) · [Releases](https://github.com/QwenAudio/qwen-audio-agent/releases) · [用户手册](https://qwenaudio.github.io/qwen-audio-agent/zh/)
- [技术报告 arXiv 2609.25195](https://arxiv.org/abs/2609.25195)
- [架构深入](https://qwenaudio.github.io/qwen-audio-agent/zh/architecture/deep-dive) · [Gateway 客户端协议](https://qwenaudio.github.io/qwen-audio-agent/zh/gateway-protocol) · [远程连接与配对](https://qwenaudio.github.io/qwen-audio-agent/zh/operations/remote-access)
- AI Passport：[接入文档](https://qwenaudio.github.io/qwen-audio-agent/zh/scenarios/ai-passport)（含 FoloToy 社区固件分发入口） · [千问语音豆固件源码](https://github.com/liutaocode/esp32demo)（`examples/qwen-voice-bean` 目录）
- 开源项目卡：[awesome · Agent 硬件](../../awesome/open-source/by-category/04-agent-hardware.md)

> 欢迎补充 Qwen-Audio-Realtime 体感延迟实测、全双工设备端与量产部署案例。提 PR 时请保持客观中立。

---

> 回到 [方案总览](./README.md) · 切到 [按品类](../by-category/) 视角
