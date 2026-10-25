# Qwen-Live-Harness 开源实时音视频桌面 harness 导读

> ⚠️ **仅 macOS 12+**：上游完整桌面体验目前只支持 macOS 12+（Apple Silicon 与 Intel），Windows、Linux 标为「正在进行」。本仓 Linux CI 不验收本项目，体验中心也不把它放进默认试用入口；下文 [Demo E](#附录demo-e--看屏解说macos) 只作 Mac 开发者的高级案例。

> [Qwen-Live-Harness](https://github.com/QwenLM/Qwen-Live-Harness) 是 Qwen 团队以 Apache-2.0 开源的桌面 harness，围绕 Qwen Omni Realtime API 构建：在 Mac 上用语音加屏幕或摄像头画面和模型实时对话，复杂任务委托给 Qwen Code、Codex、Claude Code 等后台 Harness，另有主动提醒（Proactive）和长期记忆。2026-09-21 随 Qwen3.8 Omni Flash Realtime 发布 v1.0.0。
>
> 本页是**可用导读**（跨品类横切），不是官方商业方案，客观中立，不做项目背书，也不把它当作硬件方案。版本以 npm `qwen-live-harness@1.0.0`（2026-09-21 发布，Host tag [`qwen-live-harness-host-v1.0.0`](https://github.com/QwenLM/Qwen-Live-Harness/releases/tag/qwen-live-harness-host-v1.0.0)）和 main `b2d17b8`（2026-10-15）为准，查证 2026-10-25。

## 1. 项目速览

| 项 | 内容 |
|---|---|
| **许可** | Apache-2.0 |
| **维护活跃度** | v1.0.0 于 2026-09-21 发布；main 最近提交 `b2d17b8`（2026-10-15，前台长对话摘要）；GitHub Star 约 230（查证 2026-10-25） |
| **支持的模型与价格口径** | 默认前台 `qwen3.8-omni-flash-realtime`，可在配置里换成控制台提供的其他 Realtime 模型 ID；记忆整理与长对话摘要默认 `qwen3.7-plus`，另计费。音频单价与同口径对照见 [08 第 5.2 节](./08-qwen-audio-agent.md#52-同口径对照)；看屏、摄像头画面另按图片 Token 计，本仓未实测，价格以控制台为准 |
| **端云部署形态** | 本机两个进程：Node.js daemon（≥ 22.13，调度对话、工具、后台 Harness、Proactive、Memory）+ Electron Host（UI、系统权限、音视频采集与播放），经本机 WebSocket 通信。推理全部在百炼云端；记忆库存本地，但整理与向量化会把相关内容发给配置的模型 API |
| **硬件接入方式** | 不接外部设备，只用 Mac 自带或外接的麦克风、扬声器、显示器和摄像头。不提供设备协议或固件，不是量产硬件方案 |

## 2. 能力地图

| 能力 | 项目里的实现 | 要点 / 边界 |
|---|---|---|
| **实时音视频对话** | 前台接 Omni Realtime；视觉来源可选显示器或摄像头 | **On Demand** 按需截图，由独立的「画面分析」子智能体看图后把结论交回主对话；**Live Feed** 持续给主模型送画面，默认 1 FPS、720p。截屏采集的是所选显示器的完整画面，不只当前窗口 |
| **任务委托** | 后台 Harness：Qwen Code（Live 托管的 Serve 或 `qwen --acp`）、Qoder CLI（`qodercli --acp`）、Codex 与 Claude Code（ACP 适配器）、Gemini CLI（`gemini --experimental-acp`） | 后台可选；文件修改、命令执行等需要已安装并登录的后台 Harness，能力和权限取决于该后端 |
| **主动交互（Proactive）** | Monitor 按音频、画面或时间条件触发提醒，固定 1 FPS、每轮 2 秒观察 | 上游明确写有延迟、可能误判，不应作为安全关键场景的报警 |
| **长期记忆** | 多个本地记忆库，可创建、切换、重命名 | 本地存储不等于离线推理 |
| **联网搜索** | 搜索子智能体复用主模型、地址与 Key | 能否联网取决于服务端是否支持所选模型 |

> 能力摘自 [README](https://github.com/QwenLM/Qwen-Live-Harness/blob/main/README_ZH.md) 与[配置指南](https://github.com/QwenLM/Qwen-Live-Harness/blob/main/docs/configuration_ZH.md)（`b2d17b8`）。ACP 协议见 [Agent Client Protocol](https://agentclientprotocol.com/get-started/introduction)。

## 3. 与 qwen-audio-agent 的分工

| 维度 | Qwen-Live-Harness | [qwen-audio-agent（08）](./08-qwen-audio-agent.md) |
|---|---|---|
| 定位 | Mac 桌面伴侣：看屏、看摄像头、语音对话 | 跨平台实时语音 Gateway：前台语音 + 后台委派 |
| 平台 | macOS 12+ | Node.js Gateway 跨平台；客户端有 WebUI、TUI、桌面悬浮球 |
| 默认前台 | `qwen3.8-omni-flash-realtime`（看图） | npm 2.0.1 为 `qwen-audio-3.0-realtime-plus`（纯语音，看图需换 Omni 前台） |
| 设备接入 | 无，只用本机外设 | Gateway Client Protocol，参考设备 AI Passport（ESP32-C3，半双工） |
| 适合 | 桌面开发者助手、画面解说、看屏提醒 | Agent 盒子、桌面助理、局域网瘦终端原型 |

## 4. 品类适配

| 品类 | 适配度 | 说明 |
|---|:-:|---|
| 🤖 [Agent 硬件](../by-category/04-agent-hardware/) | ⭐⭐ | 桌面形态的「边看边聊、后台办事」交互参考；设备本身要能跑 macOS 才能直接用，独立硬件需参考其架构自建 |
| 👓 [AI 眼镜](../by-category/02-ai-glasses/) | ⭐ | Omni 实时看画面的交互节奏可参考；眼镜端采集与传输链路要另做，见 [眼镜方案](../by-category/02-ai-glasses/02-solution.md) |
| 其他品类 | — | 不适用 |

## 5. 能力边界与待核实

- **平台**：只支持 macOS；Windows、Linux 进行中，本仓不在 Linux CI 验收。
- **接入地址**：上游初始化默认填通用地址 `wss://dashscope.aliyuncs.com/api-ws/v1/realtime`（新加坡为 `dashscope-intl`）。本仓 [demo 标准](../demo-standard/README.md)与 [08 页](./08-qwen-audio-agent.md)记 `qwen3.8-omni-flash-realtime` 需走业务空间专属域名；两者在真 Key 下是否都可用待核实。遇到「API key 或模型不可用」时，先查 Key 与地址是否同一地域，再试专属域名。
- **地域**：北京与新加坡的 Key 不能混用。
- **费用**：Live Feed 持续送画面，用量明显高于纯语音；看屏 1 分钟的实际 Token 本仓未实测。
- **隐私**：截屏会采集整块显示器，含其他窗口内容；Debug 日志可能保存音视频，提交 Issue 前要脱敏。

## 6. 开放资源

- [GitHub 仓库](https://github.com/QwenLM/Qwen-Live-Harness) · [中文 README](https://github.com/QwenLM/Qwen-Live-Harness/blob/main/README_ZH.md) · [配置指南](https://github.com/QwenLM/Qwen-Live-Harness/blob/main/docs/configuration_ZH.md) · [Host v1.0.0 Release](https://github.com/QwenLM/Qwen-Live-Harness/releases/tag/qwen-live-harness-host-v1.0.0)
- [Qwen3.8-Omni-Flash-Realtime 模型页](https://help.aliyun.com/zh/model-studio/qwen3-8-omni-flash-realtime) · [Qwen-Omni-Realtime](https://help.aliyun.com/zh/model-studio/realtime) · [获取 API Key](https://help.aliyun.com/zh/model-studio/get-api-key) · [地域与接入地址](https://help.aliyun.com/zh/model-studio/regions)（均查证 2026-10-25）

---

## 附录：Demo E · 看屏解说（macOS）

`live-harness-screen-narrate`：Mac 开发者让 Omni 看屏并解说一块已知界面。**不进体验中心默认试用入口，Linux CI 不验收。** 本附录只给步骤和验收口径，本仓尚无运行记录。

**前置**：macOS 12+；Node.js ≥ 22.13（`node --version`）；在百炼控制台所选地域创建的 API Key，且有权调用 `qwen3.8-omni-flash-realtime`。

**已知界面（fixture）**：本仓体验中心首页。在仓库根目录起一个本地静态服务，浏览器打开 `http://127.0.0.1:8000/app/` 并全屏到主显示器：

```bash
python3 -m http.server 8000 --bind 127.0.0.1 -d docs
```

首页固定元素：标题「从一次体验开始。」、两张精选卡「一看即懂」「会议纪要」、「商业化品类」列表 9 项。

**步骤**：

1. `npm install -g qwen-live-harness@1.0.0`
2. `qwen-live-harness init`：后台 Harness 选不接入；填入 API Key（只在向导里粘贴，不写进任何仓库文件）；Realtime 模型保持 `qwen3.8-omni-flash-realtime`；地域与 Key 一致。
3. `qwen-live-harness` 启动 Host，按提示授予麦克风权限，并在「系统设置 → 隐私与安全性」授予屏幕录制权限（不同 macOS 版本名称略有差异）。
4. 设置 → 视觉：视频来源选主显示器，采集模式选 **On Demand / 按需截图**。
5. 开始通话（Command + E），说：「对当前画面进行一个详细的解说」。

**验收**：

- [ ] **连接**：Host 显示通话已连接，能听到回答
- [ ] **看屏**：「子智能体」面板出现一次画面分析，并正常结束
- [ ] **内容**：解说提到「从一次体验开始」以及「一看即懂」「会议纪要」中的至少一个；不编造页面上没有的入口
- [ ] **记录**：按下表格式记一行；首字延迟从说完到听到第一个字计

| 日期 | 地域 | 模型 | 首字延迟 | 单次成本（元） | 输入 | 环境 | 验证人 | 备注 |
|---|---|---|---|---|---|---|---|---|

**失败态**：提示 Key 或模型不可用时，先查 Key 与地址是否同一地域，再按第 5 节换业务空间专属域名重试；画面全黑或无画面分析，多半是屏幕录制权限没给，授权后需重启 Host。

> 欢迎补充 Mac 上的运行记录与 Windows / Linux 进展。提 PR 时请保持客观中立。

---

> 另见[跨能力实验室与固定源码开发路径](./12-agent-capabilities.md#visual)：浏览器演练为无模型交互样本，不替代本文的真实服务 / 平台验收。

> 回到 [方案总览](./README.md) · 切到 [按品类](../by-category/) 视角
