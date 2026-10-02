# 端侧 / 混合方案（端云协同）

> AI 硬件很少「纯云」或「纯端」一刀切。量产常见形态是：**端侧负责唤醒、前端音频、低功耗常听与本地快指令；云端（或家庭 NAS）负责 ASR/LLM/TTS 与重推理**。
>
> 切分原则通识见 [primer/06 · 端云协同基础](../../primer/06-edge-cloud.md)；芯片与参数量直觉见 [primer/02 · 模型规格与芯片载体](../../primer/02-model-size-chips.md)。开源落地可参考 [小智](./02-xiaozhi.md) 与乐鑫 [LLM 方案](https://www.espressif.com/zh-hans/ecosystem/largelanguagemodel)。

## 1. 能力地图：端做什么、云做什么

| 层次 | 典型职责 | 常见载体 |
|---|---|---|
| **端侧感知** | 麦 / 摄采集、AEC/NS/VAD、离线唤醒、本地命令词（约数十～数百条） | ESP32-S3/P4 + [ESP-SR](https://github.com/espressif/esp-sr)；手机 / 穿戴 NPU |
| **端侧轻推理** | 意图预筛、敏感词、表情 / 动作标签、0.5B–4B 小模型兜底 | 音频 SoC NPU、手机 SoC、边缘盒 |
| **传输** | 唤醒后开流；WebSocket / MQTT+UDP / WebRTC；断线缓冲 | Wi-Fi / 4G / BLE→手机中继 |
| **云 / 边推理** | 流式 ASR、旗舰 LLM、TTS、RAG、多模态、Agent 规划 | 公有云 API 或家庭 NAS / 私有化 |
| **本地执行** | GPIO、舵机、灯效、家居指令；MCP / Function Calling 回执 | MCU 固件、手机 App、网关 |

```
┌──────── 端侧（始终在线、低功耗）────────┐
│  唤醒词 · AFE · 本地命令词 · 安全兜底    │
│  可选：小模型意图分类 / 离线话术        │
└────────────────┬───────────────────────┘
                 │ 仅会话期上行音频 / 特征
                 ▼
┌──────── 边或云（按量付费）──────────────┐
│  ASR → LLM / Realtime → TTS            │
│  工具调用结果 ←→ 业务 API / 知识库       │
└────────────────┬───────────────────────┘
                 │ 音频流 + 动作指令
                 ▼
┌──────── 端侧执行 ──────────────────────┐
│  播报 · 屏显 · 舵机 / 灯 · 家居控制     │
└────────────────────────────────────────┘
```

## 2. 三种混合档位

| 档位 | 端侧 | 云 / 边 | 适合 |
|---|---|---|---|
| **A. 薄终端** | 唤醒 + 编码 + 播放；几乎无本地 LLM | 全链路云 Realtime 或 ASR-LLM-TTS | 低成本玩具、桌宠 POC；依赖网络 |
| **B. 经典混合（主流）** | 唤醒 + AFE + 本地命令词 + MCP 执行 | 云端对话与生成 | 大多数 AI 玩具 / 耳机 / 音箱 |
| **C. 厚边缘** | 端或 NAS 跑 ASR/小 LLM；云只打旗舰或高峰 | 家庭 NAS / 边缘盒私有化 | 隐私敏感、弱网、客单高的 Agent 盒 |

乐鑫公开表述与实践：**ESP 芯片是 LLM 体验的入口，而非在 MCU 上直接跑大模型**——端侧做采集、唤醒与执行，LLM 在云或私有化智能体平台。

### 2.1 端侧统一推理调度层

C 档设备（Agent 盒、AI PC、家庭中枢）常在本地同时跑 LLM、ASR、TTS、Embedding 等多个模型，每类模型又可能落在不同的推理引擎和计算单元（CPU / GPU / NPU）上。这时需要一层本地推理调度服务：对上给 Agent 框架一个统一 API，对下管理引擎、模型与内存。开源参考是 [Lemonade](https://github.com/lemonade-sdk/lemonade)（Apache-2.0，项目 README 称由 AMD 赞助），开源卡见 [awesome · 04 Agent 硬件](../../awesome/open-source/by-category/04-agent-hardware.md#lemonade)。

它可以理解为「端侧的 [new-api](https://github.com/QuantumNous/new-api)」：两者都对调用方暴露统一的 OpenAI 兼容接口，并按模型名或策略路由请求；区别在于调度对象。

| 维度 | new-api（云端模型 API 网关） | Lemonade（端侧推理调度） |
|---|---|---|
| 运行位置 | 服务器，多用户 / 多租户 | 单台设备，本机或局域网访问 |
| 下游对象 | 多家供应商的渠道与 API Key（也可把 Ollama、vLLM 等自建服务接为渠道） | 本机的推理引擎进程与计算单元 |
| 主要难点 | 渠道权重与重试、额度计费、协议转换 | 硬件探测、后端选择与引擎安装、模型格式（GGUF / ONNX / FLM）与下载、加载 / 卸载、内存约束、NPU 独占 |

Lemonade 文档与源码中和端侧调度直接相关的机制（main 分支，查证 2026-10-02）：

- **按硬件选后端**：探测 CPU、AMD / NVIDIA GPU、Apple Metal、AMD XDNA2 NPU 后选择后端，加载模型时按需下载引擎；除从磁盘流式加载的后端外，模型大于「本机最大内存池」与「80% 系统内存」两者中的较大值时，不出现在可用列表
- **多模型并存**：LLM、Embedding、Reranking、语音转写、图像生成各自独立 LRU，`max_loaded_models` 默认每类 1 个；NPU 上 FastFlowLM、Ryzen AI LLM、whisper.cpp 三类后端互斥
- **统一接口**：OpenAI 兼容（含 `/realtime` 实时转写 WebSocket）、Ollama 兼容、Anthropic `/v1/messages`、MCP 网关，默认端口 `13305`
- **端云路由**：可把 OpenAI 兼容的云服务注册为候选模型（文档标注为实验性，已验证 Fireworks、OpenAI、OpenRouter、Together），再用路由策略把标记为隐私的请求留在本地、把编程或长文本请求发往云端
- **可嵌入**：Embeddable Lemonade 是可随应用安装包分发的 `lemond` 便携版

适用档位：主要对应 C 档；B 档里手机 SoC / 边缘盒只跑 0.5B–4B 意图模型时，单一推理引擎通常够用；A 档和 ESP32 类 MCU 终端不需要这一层。

选型边界：

- NPU 后端只覆盖 AMD XDNA2；Qualcomm QNN、Intel OpenVINO 在项目跨厂商路线图中尚未勾选，也未见瑞芯微 RKNN 等国产 SoC NPU 后端，RK3576 / RK3588 类盒子只能用 llama.cpp 的 CPU 等通用后端
- 云端卸载为实验特性；百炼 OpenAI 兼容模式不在其已验证列表中，作为云端候选待核实
- 可与 new-api 叠加：Lemonade 对外是 OpenAI 兼容服务，可接为 new-api 的上游渠道；new-api 也可作为 Lemonade 的云端候选（两种组合均待核实）

## 3. 品类适配

| 品类 | 推荐档位 | 端侧重点 | 云侧重点 |
|---|---|---|---|
| 🧸 玩具 / 陪伴 | B | 唤醒误触、儿童语速、本地「停止 / 音量」 | 角色 LLM、TTS 音色、内容安全 |
| 🪴 桌宠 | B | 动作队列与插队停止；屏表情与语音同步 | 情绪标签 / 流式文本 |
| 🎧 AI 耳机 | B（部分 C） | 低功耗常听、双麦 AEC、手机中继 | 同传 / 实时对话低时延 |
| 🤖 Agent 硬件 | B→C | 本地意图分流，避免事事打旗舰 | 多步规划、工具调用 |
| 🎙️ 录音卡 | A/B | 端上存储与按键；可本地 VAD 切片 | 批量 ASR + 纪要 Agent |
| 📷 IPC / 👓 眼镜 | B/C | 端上检测触发上行，省流量 | VL / Agent；事件检索 |
| ⌚ 手表 | B | 极致功耗；复杂推理上手机或云 | 健康解读文本 |
| 🦾 具身 | C+ | 端上控制回路实时；模型推理可边上 | VLA / 规划见 [05-qwen-robot](./05-qwen-robot.md) |

## 4. 延迟与成本直觉

| 策略 | 体感影响 | 成本影响 |
|---|---|---|
| 本地唤醒，未唤醒不上云 | 待机功耗↓ | 云费↓ |
| 本地命令词（开灯、停止） | 指令类接近即时 | 云费↓ |
| 流式 ASR-LLM-TTS | 首字秒级 | 中 |
| 端到端 Realtime（云） | 首字可到百毫秒级 | 音频 token 贵 |
| 端侧小模型兜底（断网话术） | 弱网可用 | 硬件 BOM↑ |
| NAS 私有化 ASR/LLM | 局域网低时延、隐私好 | 电费 / 设备折旧，无按量 API |

本仓库 [benchmark/](../benchmark/) 给出千问链路可复现延迟；换混合架构时应用同一「体感延迟」定义对比。

## 5. 典型 BOM 增量（量级）

| 增量 | 大约 | 备注 |
|---|---|---|
| 支持唤醒的音频 SoC / ESP32-S3 模组 | 已含或 +10–40 元 | 相对无麦方案 |
| 双麦 + 更好功放 | +10–50 元 | AEC 效果相关 |
| 手机 SoC / 边缘 NPU（厚终端） | +几十～数百元 | 能跑 0.8B–4B 级 |
| 家庭 NAS / 边缘盒（C 档） | 一次性硬件 | 密钥不出家 |

云费仍按所选 [01-qwen](./01-qwen/README.md) / [03 主流大模型](./03-mainstream-llms.md) 计费；混合的价值是**减少无效上云**与**断网降级**。

## 6. 落地检查清单

- [ ] 唤醒词 False Accept / False Reject 在目标噪声下测过
- [ ] 播放时回声不会二次唤醒；有「停止」本地快路径
- [ ] 会话超时与免唤醒连问窗口（如 20–30 s）产品可解释
- [ ] 密钥不在固件；设备只有 Token；OTA 可吊销
- [ ] 断网行为：明确提示 vs 本地话术 vs 仅命令词
- [ ] 工具调用：派发收据 ≠ 执行完成；要停动作需清队
- [ ] 隐私：录音是否落盘、是否出境、儿童场景合规

## 7. 开放资源与参考实现

| 资源 | 链接 |
|---|---|
| ESP-SR（唤醒 / AFE / MultiNet） | <https://github.com/espressif/esp-sr> |
| 乐鑫 LLM 方案总览 | <https://www.espressif.com/zh-hans/ecosystem/largelanguagemodel> |
| ESP-Techpedia LLM 介绍 | <https://docs.espressif.com/projects/esp-techpedia/zh_CN/latest/esp-friends/solution-introduction/ai/llm-solution.html> |
| 小智开源方案（薄终端 + 云） | [02-xiaozhi.md](./02-xiaozhi.md) |
| 千问 Omni + Runtime Host | [01-qwen/omni-realtime/](./01-qwen/omni-realtime/) |
| 模型规格 × 芯片 | [primer/02](../../primer/02-model-size-chips.md) |
| 端云切分原则 | [primer/06 · 端云协同基础](../../primer/06-edge-cloud.md) |
| 端侧小模型 / 蒸馏边界 | [primer/05 · 蒸馏](../../primer/05-distillation.md) |
| 端侧统一推理调度（见 §2.1） | [lemonade-sdk/lemonade](https://github.com/lemonade-sdk/lemonade) |

> 欢迎补充各品类实测的「本地命令命中率 / 上云占比 / 断网体验」数据。

---

> 回到 [方案总览](./README.md) · 切到 [按品类](../by-category/) 视角
