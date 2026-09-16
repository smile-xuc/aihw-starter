# 小智（XiaoZhi）开源方案

> [小智 AI 聊天机器人](https://github.com/78/xiaozhi-esp32) 是社区活跃的开源 AI 硬件项目，以 **ESP32 + 端云结合的语音对话栈**著称。固件侧已支持数十种开发板；乐鑫亦将双向流式对话能力沉淀为 [`espressif/esp_xiaozhi`](https://components.espressif.com/components/espressif/esp_xiaozhi) 组件，可对接 [xiaozhi.me](https://xiaozhi.me) 或自建服务端。
>
> 本页是**可用导读**（跨品类横切），不是某一家模型的官方商业方案。小智本身**模型无关**——后端可路由到千问、豆包、智谱、DeepSeek、OpenAI 等。客观中立，不做项目背书。

## 1. 能力地图

| 能力 | 在小智生态中的位置 | 要点 |
|---|---|---|
| **端侧唤醒** | ESP-SR WakeNet / 应用层上报唤醒词 | 离线常听；ESP32-S3 / P4 推荐（AI 指令加速）；C3/C5 可跑轻量唤醒 |
| **音频前端** | AFE（AEC / VAD / NS 等）+ OPUS / G.711 / PCM | 拾音质量决定后续 ASR 上限；扬声器回声需隔离 |
| **实时对话编排** | 固件协议层 ↔ 云端 / 自建 server | 流式 ASR → LLM → TTS；支持语义打断取决于链路与服务端实现 |
| **传输协议** | WebSocket 或 MQTT+UDP | 官方组件侧：服务端同时提供时优先 MQTT+UDP |
| **设备控制（MCP）** | 端侧 MCP / JSON-RPC 工具 | 音量、亮度、GPIO、舵机、LED 等本地工具；适合玩具 / 桌宠动作 |
| **角色与人格** | 服务端 system prompt / 角色配置 | 适合陪伴、IP 角色、儿童场景话术 |
| **多模型路由** | server `selected_module` / 云服务配置 | LLM / ASR / TTS / VLLM 可分别替换 |
| **OTA / 设备信息** | 服务端下发 | 量产需自建鉴权、版本通道与密钥托管 |

**典型链路：**

```
麦克风 → 端侧 AFE / 唤醒 → 编码音频
        ↓
   WebSocket 或 MQTT+UDP
        ↓
  云端 xiaozhi.me  或  自建 xiaozhi-esp32-server
        ↓
  ASR → LLM（可换）→ TTS（可换）→ 下行音频
        ↓
  扬声器播放；MCP 工具触发本地动作（灯 / 舵机 / 屏）
```

## 2. 仓库与部署形态

| 层次 | 代表仓库 / 组件 | 说明 |
|---|---|---|
| **端侧固件** | [78/xiaozhi-esp32](https://github.com/78/xiaozhi-esp32) | 社区主线固件；Board 抽象 + 工厂注册，适配多种 ESP32 板型 |
| **乐鑫组件** | [`espressif/esp_xiaozhi`](https://components.espressif.com/components/espressif/esp_xiaozhi) + [文档](https://docs.espressif.com/projects/esp-iot-solution/en/latest/ai/xiaozhi.html) | 双向流式对话组件；可嵌入自有固件 |
| **托管云** | [xiaozhi.me](https://xiaozhi.me) | 开箱对话服务；适合 POC / 个人项目 |
| **自建后端** | [xinnan-tech/xiaozhi-esp32-server](https://github.com/xinnan-tech/xiaozhi-esp32-server) 等社区 fork | Docker 可部署；ASR/LLM/TTS/记忆/意图可插拔 |

自建后端的常见起步配置（概念示意，以各仓库最新文档为准）：

- **入门全免费组合**：本地 FunASR（SenseVoiceSmall）+ 智谱 `glm-4-flash` + EdgeTTS
- **流式体验组合**：云端流式 ASR + 百炼 / 豆包等流式 LLM + 火山双向流式 TTS
- 密钥只放在服务端；设备侧仅保留 Wi-Fi、服务地址与设备 Token

## 3. 品类适配

| 品类 | 适配度 | 怎么用 |
|---|:-:|---|
| 🧸 [AI 玩具 / 陪伴](../by-category/03-toys-companion/) | ⭐⭐⭐⭐⭐ | 开源生态最活跃方向；角色 prompt + 声音克隆 / 情感 TTS；注意未成年人合规（见根目录 faq） |
| 🪴 [桌宠](../by-category/05-desktop-pet/) | ⭐⭐⭐⭐ | ESP32 + 屏 / 舵机典型组合；用 MCP 把情绪词映射到动作 ID |
| 🎧 [AI 耳机](../by-category/06-ai-earphone/) | ⭐⭐⭐ | 需低功耗与佩戴形态优化；可参考协议与双工思路，硬件 BOM 另算 |
| 🤖 [Agent 硬件](../by-category/04-agent-hardware/) | ⭐⭐⭐ | MCP / Function Calling 做本地工具；复杂规划仍建议云端旗舰模型 |
| 📷 [IPC](../by-category/01-ipc/) / 👓 [眼镜](../by-category/02-ai-glasses/) | ⭐⭐ | 固件主线偏语音；视觉需接 VLLM / 摄像头组件，工作量大 |

详细业务与算账仍以各品类 `02-solution.md` / `03-cost.md` 为准；本页回答「小智这条技术栈怎么横切过去」。

## 4. 典型 BOM 与成本量级

| 项 | 量级（参考） | 说明 |
|---|---|---|
| **主控** | ESP32-S3 模组约十余元～数十元 | 玩具 / 桌宠常见；需 PSRAM 时选对应规格 |
| **音频外设** | 麦 + 功放喇叭约 10–40 元 | 阵列麦与 AEC 会抬高成本与调试量 |
| **屏 / 舵机（可选）** | 屏 10–50 元；舵机数元～十余元 | 桌宠表情与动作 |
| **云端** | 按所选 ASR/LLM/TTS 计费 | 全本地 ASR + 免费档 LLM + EdgeTTS 可压到接近 0 云费（体验与并发受限） |
| **自建服务器** | 家用 NAS / 小云主机起 | 密钥、并发、录音合规与带宽需自行承担 |

> 数字为公开生态常见量级，非报价。量产需重新询价与认证（射频、电池、儿童产品等）。

## 5. 与千问方案的关系

小智与 [千问大模型方案](./01-qwen/README.md) **不是互斥**：

```
小智 ESP32 端 ─┬─► 自建 / 托管 server（路由）─┬─► 千问（百炼 / DashScope）
              │                              ├─► 豆包 / 智谱 / DeepSeek / OpenAI …
              │                              └─► 本地 Ollama / 私有化
              └─► 唤醒 / AFE / MCP 本地执行
```

选型直觉：

| 诉求 | 更偏向 |
|---|---|
| 快速做出可对话的 ESP 玩具 / 桌宠 | 小智固件 + 托管或自建 server |
| 要百炼成套 SDK、Omni Realtime、官方 SLA | 直接走 [01-qwen](./01-qwen/README.md) |
| 要端云分层与离线兜底 | 见 [06 端侧 / 混合](./06-edge-hybrid.md) |
| 只要架构灵感（WebRTC + 声音克隆） | 见 [04 Talk-to-Fengge](./04-talk-to-fengge.md) |

## 6. 落地检查清单

- [ ] 板型是否在固件 / 组件 `boards` 支持列表；音频 codec 与 I2S 引脚对齐
- [ ] 唤醒词误触与回声：播放时是否误唤醒；VAD 尾音是否截断
- [ ] 协议选型：WebSocket 调试方便 vs MQTT+UDP 省电 / 弱网
- [ ] LLM / TTS 延迟：三段式阻塞 vs 流式；是否需要全双工
- [ ] MCP 工具：动作是否幂等；失败是否有语音回馈
- [ ] 密钥与合规：Key 不进固件；儿童 / 录音场景走合规评估
- [ ] OTA 与鉴权：量产设备身份、吊销与日志留存

## 7. 开放资源

- 固件：<https://github.com/78/xiaozhi-esp32>
- 乐鑫组件与文档：<https://components.espressif.com/components/espressif/esp_xiaozhi> · <https://docs.espressif.com/projects/esp-iot-solution/en/latest/ai/xiaozhi.html>
- 自建服务端（社区常用）：<https://github.com/xinnan-tech/xiaozhi-esp32-server>
- 托管服务：<https://xiaozhi.me>
- 端侧唤醒 / AFE：<https://github.com/espressif/esp-sr>
- 芯片规格直觉：[primer/02 · 模型规格与芯片载体](../../primer/02-model-size-chips.md)

> 欢迎补充实测延迟、量产 BOM 与合规案例。提 PR 时请保持客观中立。

---

> 回到 [方案总览](./README.md) · 切到 [按品类](../by-category/) 视角
