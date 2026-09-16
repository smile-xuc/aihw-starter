# 主流大模型方案对照（豆包 / Kimi / 智谱 / DeepSeek / OpenAI）

> 本仓库默认演示路径是 [千问 / 百炼](./01-qwen/README.md)。硬件团队常需要**第二供应商**做比价、容灾或海外合规——本页按同一横切结构，汇总五家公开可查的接入要点。
>
> 客观中立：不排名、不背书；价格与模型名以各厂商控制台最新公布为准。欢迎 PR 补充实测与品类侧 `02-solution-<厂商>.md`。

## 0. 一张表选型

| 方案 | 文档 / 入口 | 硬件相关强项 | 常见缺口 | 接入形态 |
|---|---|---|---|---|
| **豆包（火山方舟）** | [火山引擎 · 豆包](https://www.volcengine.com/product/doubao) | 端到端实时语音（含全双工 3.0 / Seeduplex）、声音复刻、语音合成与同传 | 实时语音能力以邀测 / 区域开放节奏为准 | OpenAPI / WebSocket Realtime |
| **Kimi（月之暗面）** | [Moonshot API](https://platform.moonshot.cn/) | 长上下文、中文对话；OpenAI 兼容 Chat | 原生端到端 Realtime 语音链不如语音云厂商完整 | OpenAI 兼容 HTTP |
| **智谱 GLM** | [开放平台](https://open.bigmodel.cn/) | 中文理解、多模态；免费档利于 POC；常作小智默认 LLM | 全双工硬件 SDK 需自拼 ASR/TTS | OpenAI 兼容 + 专属 SDK |
| **DeepSeek** | [API Docs](https://api-docs.deepseek.com/) | 推理性价比；OpenAI / Anthropic 兼容 | 无原厂端到端语音 Realtime；需外挂 ASR/TTS | OpenAI 兼容 HTTP |
| **OpenAI** | [Realtime](https://developers.openai.com/api/docs/guides/realtime) | `gpt-realtime` 系双工语音、WebRTC / WebSocket、工具调用 | 中国大陆直连与计费合规需自行评估 | Realtime + Chat Completions |

与本仓库其他页的关系：

- 端侧唤醒 / 协议壳可用 [小智](./02-xiaozhi.md)，后端 LLM 换成上表任一家
- 低延迟语音横评仍以 [benchmark/](../benchmark/) 的千问链路为可复现基线；其他厂商需自建对照实验

---

## 1. 豆包（火山引擎）

### 1.1 能力地图

| 能力 | 公开能力（摘要） | 硬件场景 |
|---|---|---|
| 文本 / Agent | Seed / Evolving / Turbo 等方舟模型 | 角色对话、意图、工具调用 |
| 端到端实时语音 | Realtime API（WebSocket）；全双工 3.0（Seeduplex）面向座舱 / 硬件 / 客服 | 玩具、耳机、车机、音箱 |
| TTS / 声音复刻 | 语音合成 2.0、声音复刻 2.0 | IP 角色、亲情声线 |
| ASR | 流式识别 / 录音文件识别 | 耳机听记、录音卡 |
| 同声传译 | 同传模型（控制台产品线） | AI 耳机 / 眼镜 |

Realtime 接入要点（以[官方文档](https://www.volcengine.com/docs/6561/1594356)为准）：WebSocket 流式；客户端推 16 kHz 单声道 PCM，收流式 TTS；鉴权头含 App-ID / Access-Key / Resource-Id 等。全双工版本强调抗干扰、动态判停与对话中工具调用。

### 1.2 品类适配

| 品类 | 适配提示 |
|---|---|
| 玩具 / 桌宠 | 人设字段 + 声音复刻；严格审核开关需产品侧评估 |
| AI 耳机 | 同传 / 实时对话；关注首包与弱网 |
| Agent 硬件 | 工具调用 + 本地执行桥（类似 Runtime Host） |
| 录音卡 | 录音文件 ASR + 文本模型出纪要 |

### 1.3 BOM / 计费

硬件 BOM 与模型无关。云费见火山公开价目（文本按百万 tokens，语音按字符 / 小时等）。POC 常有免费额度；量产按 QPS 与并发单独评估。

---

## 2. Kimi（月之暗面）

### 2.1 能力地图

| 能力 | 要点 |
|---|---|
| Chat Completions | OpenAI 兼容，`https://api.moonshot.cn/v1`（以平台文档为准） |
| 长上下文 | 适合知识库、长会议转写后的二次理解 |
| 多模态 | 视平台当前开放模型而定（图文等） |
| 语音 | 通常 **自建 ASR → Kimi → TTS**；或接到小智 server 作 LLM 后端 |

### 2.2 品类适配

| 品类 | 适配提示 |
|---|---|
| 录音卡 / Agent 盒 | 长文本摘要、待办抽取 |
| 玩具陪伴 | 可做角色 LLM；延迟取决于外挂 ASR/TTS |
| IPC / 眼镜 | 视觉能力需确认当前多模态模型是否满足 |

### 2.3 BOM / 计费

按 tokens 计费；适合「文本大脑」位，语音体验预算另算在 ASR/TTS 供应商。

---

## 3. 智谱 GLM

### 3.1 能力地图

| 能力 | 要点 |
|---|---|
| Chat / 多模态 | `https://open.bigmodel.cn/api/paas/v4`；OpenAI 兼容 + 官方 SDK |
| 免费档 | 如 glm-4-flash 等（需注册 Key；以控制台为准） | 适合小智 / DIY POC |
| 视觉 | GLM-4V 等 | 玩具看图问答、简单视觉 Agent |
| 语音 | 需组合第三方或自建 ASR/TTS |

社区自建小智 server 常把 **ChatGLM 作为默认 LLM**，门槛低。

### 3.2 品类适配

| 品类 | 适配提示 |
|---|---|
| 玩具 / 桌宠 | POC 默认大脑；上线前压测限流与内容安全 |
| Agent 硬件 | Function Calling / 工具协议按官方文档对齐 |
| IPC | 轻量看图；重视觉检索仍看专用 VL 方案 |

### 3.3 BOM / 计费

免费档适合打通链路；量产切换付费档或混部（闲聊 flash、复杂任务旗舰）。

---

## 4. DeepSeek

### 4.1 能力地图

| 能力 | 要点 |
|---|---|
| Chat / 推理 | `https://api.deepseek.com`；兼容 OpenAI SDK；可开 thinking / reasoner |
| 性价比 | 适合云端「重推理、轻语音」环节 |
| 语音 / 多模态实时 | **无原厂 S2S Realtime**；硬件需 ASR + TTS 外挂 |

### 4.2 品类适配

| 品类 | 适配提示 |
|---|---|
| Agent 硬件 | 规划、代码式工具选择、复杂问答 |
| 录音卡 | 纪要润色、待办抽取（上游 ASR 另选） |
| 实时陪伴玩具 | 可作 LLM，但首字延迟取决于整条语音链 |

### 4.3 BOM / 计费

按官方价目；常见模式是「DeepSeek 做脑 + 国内语音云做嘴耳」。

---

## 5. OpenAI

### 5.1 能力地图

| 能力 | 要点 |
|---|---|
| Realtime | `/v1/realtime`：WebRTC（浏览器 / 移动）或 WebSocket（服务端 / 设备网关）；语音 Agent、翻译、转写会话类型 |
| 工具调用 | 可驱动设备动作（需自建执行桥，类比千问 Runtime Host） |
| Chat / 多模态 | GPT 系文本与视觉；海外产品线常用 |
| 会话约束 | 单会话时长等上限以官方文档为准（曾公布约 60 分钟量级） |

### 5.2 品类适配

| 品类 | 适配提示 |
|---|---|
| 海外耳机 / 眼镜 / 桌宠 | Realtime + 本地工具 |
| 国内量产 | 网络、备案、数据出境与计费主体需法务评估 |
| Agent 硬件 | WebRTC 适合 App 中继；纯 MCU 设备多经自有网关转 WebSocket |

### 5.3 BOM / 计费

音频 token / 分钟成本通常显著高于三段式；适合高客单、体验优先 SKU。定价见 OpenAI 官方 Billing。

---

## 6. 统一接入建议（硬件团队）

```
                    ┌─ 豆包 Realtime / OpenAI Realtime / 千问 Omni Realtime
用户语音 ──► 网关 ──┼─ 或 ASR →（OpenAI 兼容 Chat：Kimi / 智谱 / DeepSeek / 千问）→ TTS
                    └─ 端侧：唤醒 / VAD / 本地指令（小智 · ESP-SR · 自研）
```

1. **协议层与模型层解耦**：设备只认一种上行协议（或小智协议），LLM 在网关热切换。
2. **POC 用免费档，量产锁 SLA**：智谱 flash / 各家免费额度只验证体验；合同与限流另签。
3. **语音体验单独选型**：有原厂 Realtime 的（豆包 / OpenAI / 千问）优先对标；纯 Chat 厂商必须配齐 ASR/TTS。
4. **合规**：儿童、录音、跨境、拟人化互动——先看根目录 [faq.md](../../faq.md)，再选供应商地域。

## 7. 开放资源

| 方案 | 链接 |
|---|---|
| 豆包产品 | <https://www.volcengine.com/product/doubao> |
| 豆包实时语音文档 | <https://www.volcengine.com/docs/6561/1594356> |
| Moonshot 平台 | <https://platform.moonshot.cn/> |
| 智谱开放平台 | <https://open.bigmodel.cn/> |
| DeepSeek API | <https://api-docs.deepseek.com/> |
| OpenAI Realtime | <https://developers.openai.com/api/docs/guides/realtime> |
| 本仓库主示例 | [01-qwen](./01-qwen/README.md) |

---

> 回到 [方案总览](./README.md) · 切到 [按品类](../by-category/) 视角
