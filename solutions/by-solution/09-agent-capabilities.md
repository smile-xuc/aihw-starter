# 从工具调用到持续办事：四组 Agent 能力的开发路线

查证：2026-10-25。本文对应独立的[体验中心能力实验室](https://smile-xuc.github.io/aihw-starter/app/#/lab)，不是某篇文章的附属示例。所有浏览器演练无 Key、无模型调用；下面另给真实上游的开发入口。上游源码已核对，付费接口、声学效果、桌面 Host 和硬件尚未实测。

## 能力地图

| 能力 | 解决什么问题 | 不承担什么职责 | 适合的硬件方向 |
|---|---|---|---|
| Bailian CLI | 将文字、图片、转写、合成等服务变成可脚本调用的工具 | 本身不保证持续对话、任务权限或业务交付 | 录音卡素材处理、设备说明卡、批量开发测试 |
| Qwen-MM-Plugins | 给宿主 Agent 可调用的媒体读取、抽帧、裁图与专门推理工具 | core 不等于另一个视觉模型；抽样不能证明整个视频无事件 | IPC 证据定位、眼镜图片检查、教程转文档 |
| qwen-audio-agent | 语音前台持续交流，后台异步工作，运行时处理任务和结果交付 | 未配置后台时不能声称已执行文件或系统操作 | 语音盒子、耳机伴随宿主、桌面助理 |
| Qwen-Live-Harness | 语音加授权的屏幕 / 摄像头上下文、主动观察、记忆与任务委托 | 看见画面不等于拥有控制权限，Monitor 不会代替用户操作应用 | 带相机桌面终端、视觉辅助工作台 |

四者可以组合，但不存在“全部安装即可自动成为一个完整产品”的默认链路。宿主负责选工具，工具负责返回事实，运行时负责将事实归到正确任务。以下以“把设备巡检素材整理为可核对的本地草稿”为共同开发任务。

<a id="cli"></a>
## 1. Bailian CLI：把素材处理变成明确的输入输出

**结构**：用户任务 → shell 参数 → `bl` 的命令路由 / 认证 / 服务请求 → 模型服务 → 文件或结构化结果。CLI 适合批处理和供 Agent 调用；它不会因为出现在终端里就变成离线推理。

[命令生成器](https://smile-xuc.github.io/aihw-starter/app/#/lab/cli)提供文字、图片、ASR、TTS 四个模板，拒绝空输入、控制字符和无效音频路径，以 POSIX 单引号转义用户内容。生成器不执行命令，不读取文件，也不验证账户权限。PowerShell 需要按其自身语法转换。

### 最小本地路径

Node.js ≥18.17、npm；在单独的测试目录安装固定包，不要求全局安装：

```bash
mkdir aihw-cli-lab
cd aihw-cli-lab
npm install --no-save bailian-cli@2.5.1
./node_modules/.bin/bl --version
./node_modules/.bin/bl text chat --help
./node_modules/.bin/bl speech recognize --help
```

上面只核对程序与参数。真实调用前，按[认证说明](https://github.com/modelstudioai/cli/blob/3c8031f4d994c30820eb4d145d9404ba4a0acd39/README.zh.md#认证方式)在本机配置对应地域凭据；不要把 Key 放入生成器或提交到仓库。控制台登录、普通 API Key、订阅计划和 OpenAPI AK/SK 的权限不相同。

以下是**会调用模型、可能计费**的手动运行示例；在同一目录执行，输入文件需自行准备，先确认输出路径未被重要文件占用：

```bash
./node_modules/.bin/bl text chat --message '将巡检观察分为事实、未知、待办，不补充未提供的信息。' --output json
./node_modules/.bin/bl image generate --prompt '简洁的设备巡检说明卡插图，不含文字' --out-dir ./out/
./node_modules/.bin/bl speech recognize --url ./inspection.wav --out ./transcript.json
./node_modules/.bin/bl speech synthesize --text '草稿已完成，请先核对证据。' --out ./brief.mp3
```

**验收**：检查退出码、转写文字及时间信息、实际输出文件能否打开、请求 ID 与账单；生成图片不能替代真实设备照片。录音本地路径可由 CLI 自动上传 DashScope 临时 OSS（48 小时）；它不是生产存储方案。异步任务的本机等待终止不等于服务端取消，手动重试前核对任务是否已创建。模型默认值、地域可用性和价格取决于所选配置，本文不承诺零费用。

来源：[CLI 概述](https://docs.bailian.console.aliyun.com/zh/model-studio/cli/overview)、[文字命令定义](https://github.com/modelstudioai/cli/blob/3c8031f4d994c30820eb4d145d9404ba4a0acd39/skills/bailian-cli/reference/text.md)、[图像](https://github.com/modelstudioai/cli/blob/3c8031f4d994c30820eb4d145d9404ba4a0acd39/skills/bailian-gen/reference/image.md)、[语音](https://github.com/modelstudioai/cli/blob/3c8031f4d994c30820eb4d145d9404ba4a0acd39/skills/bailian-gen/reference/speech.md)、[媒体上传约定](https://github.com/modelstudioai/cli/blob/3c8031f4d994c30820eb4d145d9404ba4a0acd39/skills/bailian-gen/SKILL.md)。

<a id="media"></a>
## 2. Qwen-MM-Plugins：先找证据，再做判断

**结构**：Skill 提供任务策略，MCP server 暴露工具，宿主模型决定调用顺序。视频先 `media_info` 读时长、帧率、旋转和音轨，再 `read_video` 选择时间窗抽帧；需要细节时 `save_view` 导出关键帧、`crop` 看局部。返回的图像交给宿主多模态模型推理。core 原生模式没有额外模型请求，宿主处理图像仍可能走云端并计费；关闭原生模式的 caption fallback 还会另调 VL 服务。

[浏览器演练](https://smile-xuc.github.io/aihw-starter/app/#/lab/media)包含人工编写的巡检教程证据时间线，以及独立的仓内照片局部检查。两份素材不伪装成同一视频；网页放大不是 OCR 或目标检测。真实开发应保存 `asset_id + 时间窗 + 帧时间 + 裁剪坐标 + 模型结论`，而不是只留一段摘要。

### 最小本地路径

Python ≥3.10；视频另需 `ffmpeg` / `ffprobe`。从源码运行 core，不修改宿主的持久 MCP 配置：

```bash
git clone https://github.com/QwenLM/Qwen-MM-Plugins.git
cd Qwen-MM-Plugins
git checkout d7ca19a9c8b60f02a86350706ff5e19095c33850
python3 -m venv .venv
.venv/bin/python -m pip install -e '.[core]'
.venv/bin/python src/capabilities/core/qwen_mm_plugins_core --version
.venv/bin/python src/capabilities/core/qwen_mm_plugins_core --check-system
printf '%s\n' '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' | .venv/bin/python src/capabilities/core/qwen_mm_plugins_core
```

预期：版本 / 系统依赖报告和 MCP 工具 schema；缺少 LibreOffice、Blender 等只影响相应文件类型，不应把它们当成视频已处理成功。接入宿主时，将 MCP stdio command 指向该虚拟环境 Python、args 指向上述 server 的**绝对路径**；按返回的 schema 调用，不猜参数。

用有权处理的短视频执行以下任务提示：

```text
先读取 inspection.mp4 的 media_info。
仅分析 0–30 秒，用 read_video 找到设备标识与接口的证据帧。
对不清楚的区域保存原帧并裁图，输出时间戳、直接观察、无法确认项。
不要根据静态帧推断整个视频没有异常；不要操作真实设备。
```

本仓还提供可执行的 MCP 客户端，实际调用 core 的读取、裁图及可选视频抽帧，不调用宿主模型。假设两个仓库是同级目录，在 Qwen-MM-Plugins 目录执行：

```bash
.venv/bin/python ../aihw-starter/solutions/by-solution/agent-capability-lab/inspect_media.py \
  --source . \
  --image ../aihw-starter/docs/app/data/assets/02-ai-glasses.bailian/samples/dish.jpg \
  --output ./inspection-output
# 要检查视频，另加 --video /absolute/path/inspection.mp4（只读取前 3 秒，最多 3 帧）
```

预期生成 `inspection-crop.png` 与 `inspection-report.json`；已有输出会拒绝覆盖。报告中的 `mode: local-tools` 表示真实本地媒体处理，`modelCalls: 0` 表示没有语义推理。与网页脚本样本不同，这里会实际读取指定文件。

只检查图片时可用本仓 `docs/app/data/assets/02-ai-glasses.bailian/samples/dish.jpg`，先 `read_image` 再 `crop`；工具裁剪采用显示图像的 0–1000 坐标并处理 EXIF 方向。视频抽样会遗漏短事件，时间戳也受可变帧率和旋转影响。

**扩展**：`api` 承担 VL / Omni / ASR 等服务调用；`omni-video2note` 用音视频理解形成图文 PDF，需要服务凭据与 ffmpeg。`dry_run=true` 只校验输入和配置，不产出 PDF，不可记为完成。实际产物验收须打开 PDF、核对关键帧 / 原话 / 页码，并保留失败重跑的范围。

来源：[core Skill 与工具策略](https://github.com/QwenLM/Qwen-MM-Plugins/blob/d7ca19a9c8b60f02a86350706ff5e19095c33850/src/capabilities/core/skill/SKILL.md)、[本地开发](https://github.com/QwenLM/Qwen-MM-Plugins/blob/d7ca19a9c8b60f02a86350706ff5e19095c33850/docs/zh/local_development.md)、[video2note dry run](https://github.com/QwenLM/Qwen-MM-Plugins/blob/d7ca19a9c8b60f02a86350706ff5e19095c33850/src/capabilities/omni-video2note/qwen_mm_plugins_omni_video2note/pipeline/runner.py)、[官方 Cookbook](https://qwenlm.github.io/qwen-mm-plugins-hub/plugins/core/cookbook/)。

<a id="voice"></a>
## 3. qwen-audio-agent：纯语音前台与后台执行分开验收

**结构**：WebUI / TUI / 桌面客户端采音 → Gateway 内的实时语音前台 → 编排运行时创建任务 → 后台适配器（ACP / A2A 等）执行 → 结果交付队列 → 当前会话播放回执。Gateway 是服务宿主，编排是逻辑职责，不要把两者混成一种模型协议。

[纯语音任务演练](https://smile-xuc.github.io/aihw-starter/app/#/lab/voice)用文字按钮代替说话：开始巡检草稿、停止播报、改要求、等待批准、失败重试、确认取消、接收旧结果、等用户说完再交付。它运行真实的本地状态逻辑，但后台结果是样本，不是上游 Gateway 的协议兼容实现。

### 最小本地路径

源码支持 Node.js ^22.22.2、^24.15.0 或 ≥26，npm ≥10。先检出同一批 Gateway 与客户端：

```bash
git clone https://github.com/QwenAudio/qwen-audio-agent.git
cd qwen-audio-agent
git checkout d2a8dc45b9b49d560c876eb7ed449eb9b90df1b9
npm ci
npm run build
npm run cli -- config
```

最后一条会显示本机配置文件位置。在本机编辑，选择语音 Provider、模型与匹配地域的凭据；纯语音示例可以选 `qwen-audio-3.1-realtime-plus`。先设 `AGENT_PROTOCOL=none` 验证前台连接，**这一步只验证聊天，不执行后台工作**。

```bash
npm run gateway
# 另一终端（同一源码目录）
npm run cli -- webui
```

保持默认回环监听。用启动日志报告的本机端口访问 `GET /api/health`，检查 `protocolVersion`、`capabilities`、`voiceConfigured`、`backend`；健康成功不等于语音服务或后台任务成功。固定源码的产品包版本是 **2.0.1**，health contract 是 **5.10.0**，WebSocket GCP wire 是 **7.0.0**；客户端按 capability 和 `session.hello` 协商，不能按包版本猜字段。

要实际生成草稿，先安装、登录并确认一个支持的后台（如 Qwen Code），再改 `AGENT_PROTOCOL=qwen`，后台模型留空可沿用其配置，重启 Gateway。测试目录放入一份非敏感 `inspection.txt`，打开麦克风后说“把 inspection.txt 中的观察整理成 inspection.md，只在当前目录写草稿，不发送”。观察任务卡、后台权限请求、实际文件和语音回执。停止播报后检查任务仍运行；取消要等确认，不能凭前台一句“好的”认定终止。

**失败与限制**：语音前台、后台认证、MCP 工具和文件权限分别检查。重连不应把旧会话结果交给另一个用户；重试前检查已有文件和任务 ID。取消无法撤销已发送邮件等外部副作用。本文不会提供公网网关；没有真实语音、付费模型或整机验证。

来源：[源码安装](https://github.com/QwenAudio/qwen-audio-agent/blob/d2a8dc45b9b49d560c876eb7ed449eb9b90df1b9/docs/getting-started/install.zh.md)、[快速开始](https://github.com/QwenAudio/qwen-audio-agent/blob/d2a8dc45b9b49d560c876eb7ed449eb9b90df1b9/docs/getting-started/quickstart.zh.md)、[health contract](https://github.com/QwenAudio/qwen-audio-agent/blob/d2a8dc45b9b49d560c876eb7ed449eb9b90df1b9/docs/contract.md)、[GCP wire](https://github.com/QwenAudio/qwen-audio-agent/blob/d2a8dc45b9b49d560c876eb7ed449eb9b90df1b9/shared/protocol/gateway-client-protocol.mjs)、[任务与交付机制](https://github.com/QwenAudio/qwen-audio-agent/blob/d2a8dc45b9b49d560c876eb7ed449eb9b90df1b9/docs/architecture/deep-dive.zh.md)。

<a id="visual"></a>
## 4. Qwen-Live-Harness：视觉上下文不是永久事实

**结构**：Electron Host 管理设备权限、采集和播放 → 本机 WebSocket → Node daemon 管理对话 / 工具 / 记忆 → Omni Realtime 与可选后台 Harness。On Demand 将所选显示器或摄像头截图交给独立视觉子智能体；Live Feed 持续给主模型送图。后台文件修改、命令执行仍需已安装并登录的 Harness。

[视觉上下文演练](https://smile-xuc.github.io/aihw-starter/app/#/lab/visual)展示“这里”的指代风险：从铭牌 A 换到接口 B 后，旧画面授权不能用于新内容，旧结果不能覆盖新需求。本站使用两张手绘 SVG 示意图，显示来源、frame ID、场景取样时间与年龄；15 秒新鲜度阈值仅为教学假设。模拟过期后暂停并清除旧授权 / 结果，重新核对或切换画面后才能继续。不读取实际屏幕，也未连接 Live Harness。

### 最小本地路径

完整桌面体验目前要求 **macOS 12+**（Apple Silicon / Intel）、Node.js ≥22.13，源码构建另需 Xcode 命令行工具和可用 Node headers。Linux 上通过脚本测试不代表 Electron Host 可用。

```bash
git clone https://github.com/QwenLM/Qwen-Live-Harness.git
cd Qwen-Live-Harness
git checkout b2d17b8706b226ff7792683ecd8f050f18f9752e
npm ci
npm ci --prefix packages/qwen-live-harness-host
npm run init
npm start
```

初始化会写本机配置；在向导中选择地域、API Key、模型及可选后台。开始前退出已有实例，Host / daemon 必须配套。仅按需要授予麦克风和视觉来源权限。

可复现任务：打开非敏感的巡检照片 → 选择 On Demand 和明确显示器 → 问“列出这张照片能直接确认的事实与看不清的地方” → 切换到接口照片 → 追问“只使用新画面，生成待核对清单” → 需要文件时才委托已配置后台写入测试目录。核对截图来源、任务授权、结果文件；断开视觉输入后，不应继续声称能看见当前画面。

**模式取舍**：按需截图降低持续采集负担，但画面可能很快过期；Live Feed 默认 1 FPS、720p，适合持续语境，但增加数据与模型负担，也可能漏掉短事件。Proactive Monitor 独立按 1 FPS、每轮 2 秒观察，通知等对话与播放结束再排队播报；不是安全关键报警器。记忆存在本地，不代表记忆整理和向量化离线。后台能力、图像传递和授权行为取决于适配器及版本。

来源：[固定 README / 架构与开发](https://github.com/QwenLM/Qwen-Live-Harness/blob/b2d17b8706b226ff7792683ecd8f050f18f9752e/README_ZH.md)、[配置与模式](https://github.com/QwenLM/Qwen-Live-Harness/blob/b2d17b8706b226ff7792683ecd8f050f18f9752e/docs/configuration_ZH.md)、[daemon 开发](https://github.com/QwenLM/Qwen-Live-Harness/blob/b2d17b8706b226ff7792683ecd8f050f18f9752e/packages/qwen-live-harness/README_ZH.md)。

## 本仓无 Key 开发演练

本仓 Node.js 22+ 即可运行，无第三方依赖，不启动 Gateway：

```bash
node solutions/by-solution/agent-capability-lab/run.mjs voice
node solutions/by-solution/agent-capability-lab/run.mjs visual
node solutions/by-solution/agent-capability-lab/run.mjs cli
node solutions/by-solution/agent-capability-lab/run.mjs media
node --test docs/app/tools/agent-lab.test.mjs
python3 -m http.server 8000 --bind 127.0.0.1 -d docs
```

输出 `mode: mock`、`providerCalls: 0`；voice / visual 运行与网页共用的状态模型，cli 只输出命令，media 输出证据样本。真实上游路径见各节，不把这个演练 runner 冒充服务集成。

## 品类、BOM 与计费

录音卡侧重 CLI 转写与语音任务，IPC 侧重 MM 证据链，眼镜侧重图像上下文与宿主协同，桌面助理侧重语音 / 视觉编排。开发原型先用现有电脑、麦克风和可选相机；MCU 不能直接替代 Node / Electron 宿主。迁移到耳机、眼镜或桌宠需单独设计设备身份、回声消除、网络中断和动作回执。

成本分成采集 / 编码、前台音频 / 图像 Token、后台任务 Token 与工具费、存储和宿主资源。没有实测用量或有效价格时保持未知；开源许可证不免除模型账单。四个上游均为 Apache-2.0，第三方组件、模型与服务条款分别适用。本轮未进行付费请求、使用真实凭据、公开部署网关或修改持久安全配置。

<a id="sources"></a>
## 固定来源与复核记录

| 项目 | 2026-10-25 读取的 commit | 本次核对的核心事实 |
|---|---|---|
| [Bailian CLI](https://github.com/modelstudioai/cli/tree/3c8031f4d994c30820eb4d145d9404ba4a0acd39) | `3c8031f4d994c30820eb4d145d9404ba4a0acd39` | package 2.5.1；四类命令、临时上传 |
| [Qwen-MM-Plugins](https://github.com/QwenLM/Qwen-MM-Plugins/tree/d7ca19a9c8b60f02a86350706ff5e19095c33850) | `d7ca19a9c8b60f02a86350706ff5e19095c33850` | core 原生与 fallback；video2note dry_run |
| [Qwen-Live-Harness](https://github.com/QwenLM/Qwen-Live-Harness/tree/b2d17b8706b226ff7792683ecd8f050f18f9752e) | `b2d17b8706b226ff7792683ecd8f050f18f9752e` | package 1.0.0；macOS / Node；三种视觉路径 |
| [qwen-audio-agent](https://github.com/QwenAudio/qwen-audio-agent/tree/d2a8dc45b9b49d560c876eb7ed449eb9b90df1b9) | `d2a8dc45b9b49d560c876eb7ed449eb9b90df1b9` | package 2.0.1；health 5.10.0；wire 7.0.0；none 边界 |

源码快照可复查，npm 包与该 commit 不保证逐字相同。依赖安装或模型可用性变化时先核对版本，再记录实际失败，不用切换到不明网关绕过问题。工作流审计与独立验收见[能力更新审计](../../docs/app/CAPABILITY_AUDIT.md)。

## 原理阅读

[从语音聊天到语音 Agent：真正缺的是哪一层？](../../docs/voice-agent-runtime.html)：独立文章，用同一巡检任务解释编排机制与工程取舍。
