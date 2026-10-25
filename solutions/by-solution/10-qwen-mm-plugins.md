# Qwen-MM-Plugins 开源多模态插件导读

> [Qwen-MM-Plugins](https://github.com/QwenLM/Qwen-MM-Plugins) 是 Qwen 团队以 Apache-2.0 开源的多模态插件集，给 Claude Code、Codex、Qwen Code 等编程 Agent（项目称 Agent Harness）补上读图、看视频、看文档的能力。每个能力是一个 **Skill + 可选 MCP server**，按需单独安装。其中 `core` 在本机把 PDF、Office、表格、代码、3D 模型等渲染成图片和文字交给 Agent 的主模型，默认原生模式不调用任何云端 API。
>
> 本页是**可用导读**（跨品类横切），不是官方商业方案，客观中立，不做项目背书。版本以 main `d7ca19a`（2026-10-23）、`core` 发布 tag [`qwen-mm-plugins-core-v1.3.0`](https://github.com/QwenLM/Qwen-MM-Plugins/releases/tag/qwen-mm-plugins-core-v1.3.0) 为准，查证 2026-10-25。本仓可跑示例：[`02-ai-glasses/demo/mm-plugins-core/`](../by-category/02-ai-glasses/demo/mm-plugins-core/)。

## 1. 项目速览

| 项 | 内容 |
|---|---|
| **许可** | Apache-2.0；Blender、FreeCAD 集成另有第三方署名（见仓库 NOTICE） |
| **维护活跃度** | 2026-08-03 首次发布；main 最近提交 `d7ca19a`（2026-10-23）；各插件独立打 tag，`plugin-versions.json` 记分发版本 1.2.0、`core` 1.3.0；GitHub Star 约 3,100（查证 2026-10-25） |
| **支持的模型与价格口径** | 插件跑在 Agent 侧，模型由所用 Harness 决定。`core` 默认原生模式本身不调模型、不计费，但要求 Harness 的主模型能看图（项目建议 Qwen VL 系列，如 Qwen3.8-Max、Qwen3.7-Plus），主模型费用按该 Harness 的计费方式。`api`、`video-memory`、`omni-*` 等插件调 DashScope，按百炼目录价计费，以控制台为准 |
| **端云部署形态** | 全部在开发机本地：Skill 装进 Harness，MCP server 由 `uvx` 在本机按需拉起（Python ≥ 3.10）。macOS、Linux 原生；Windows 只支持 Ubuntu WSL2 |
| **硬件接入方式** | `mhs` 插件按 Model Hardware Standard 经 adapter 读写真实设备（摄像头、传感器、灯、机械臂），主机侧强制安全限位并提供紧急停止，adapter 由硬件方自己运行。上游自带模拟摄像头和台灯的 mock adapter；本仓**未**验证 MHS，也不把它当作量产硬件方案 |

## 2. 能力地图

| 插件 | 用途 | 需要云端 Key |
|---|---|:-:|
| `core` | 本地读图、读视频帧；`visualize` 把 PDF、Office、CSV/XLSX、代码、SVG、DrawIO、3D、GIS 等渲染成图片＋文字；`media_info`、`crop`、`draw_bbox`、`save_view` | 否（原生模式） |
| `api` | 调 Qwen-VL / Omni 做视觉问答、OCR、定位、转写、说话人区分，另有 ASR、SAM3 分割 | 是 |
| `search` | 网页搜索、页面抽取、反向图搜（Serper、Exa、Tavily、Serply） | 是（搜索服务） |
| `video-memory` / `omni-memory` | 长视频分层记忆、音视频记忆，之后的提问直接从记忆回答 | 是 |
| `video-edit` / `omni-chatcut` / `omni-video2note` | 媒体生成与剪辑、MV 与解说、教程视频转图文 PDF | 是 |
| `video-spatio` | 图片和视频里的 3D 空间问答，几何工具本地运行 | 感知需模型 |
| `blender` / `freecad` | 驱动本机运行中的 Blender、FreeCAD 建模、CAD | 否 |
| `mhs` | 按 Model Hardware Standard 操作真实硬件，带安全限位与急停 | 否 |
| `nifti` / `edu-agent` / `omni-skill-creator` / `omnidr` | 医学影像切片、数理讲解视频、演示视频转 Skill、深度调研 | 视插件 |

> 插件清单摘自 [README](https://github.com/QwenLM/Qwen-MM-Plugins) 与 `plugin-versions.json`（`d7ca19a`）。每个插件的示例视频与交互案例见 [Plugin Hub](https://qwenlm.github.io/qwen-mm-plugins-hub/)，`core` 见 [Cookbook](https://qwenlm.github.io/qwen-mm-plugins-hub/plugins/core/cookbook/)。

**支持的 Harness**：安装器内置 Claude Code、CodeBuddy、Codex、Qoder、OpenClaw、Qwen Code、Gemini CLI；DeepSeek Harness、Hermes Agent、opencode、pi、QwenPaw 走[手动安装](https://github.com/QwenLM/Qwen-MM-Plugins/blob/main/docs/zh/manual_harnesses.md)。

## 3. 安装（只装 `core`）

前置：本机已装好并登录一个上面列出的 Harness，且装有 [`uv`](https://docs.astral.sh/uv/)（提供 `uvx`）。

```bash
git clone https://github.com/QwenLM/Qwen-MM-Plugins.git && cd Qwen-MM-Plugins
bash install.sh install --plugin core --harness qwen-code --dry-run   # 先看会执行哪些命令
bash install.sh install --plugin core --harness qwen-code             # 按已发布 tag 安装
bash install.sh verify --plugin core                                  # 检查依赖与 MCP 启动
```

- `--harness` 可选 `claude` / `codebuddy` / `codex` / `qoder` / `openclaw` / `qwen-code` / `gemini`。不带参数运行 `install.sh` 是交互式向导，选择 Harness 与插件后效果相同。
- 一行安装：`curl -fsSL https://raw.githubusercontent.com/QwenLM/Qwen-MM-Plugins/main/install.sh | bash`（交互式）。
- 共享配置在 `~/.qwen-mm-plugins/config`；云端插件的 Key 用 `bash install.sh configure DASHSCOPE_API_KEY=…` 写入，不写进仓库。
- 详细步骤、版本回退和 WSL2 说明见[安装文档](https://github.com/QwenLM/Qwen-MM-Plugins/blob/main/docs/zh/installation.md)。

装好后在 Harness 里引用文件提问即可，Skill 会选对应的 MCP 工具，例如 `@report.pdf 总结第 3 页，并提取其中的表格`。本仓 [Demo B](../by-category/02-ai-glasses/demo/mm-plugins-core/) 提供固定的 fixture PDF 和不依赖 Harness 的 `visualize` 自检脚本。

## 4. 品类适配

本项目面向**开发期的编程 Agent**，不是设备端 SDK。对 AI 硬件团队的价值在于让写固件、写 App 的 Agent 能直接看懂规格书、原理图 PDF、测试截图和样机视频。

| 品类 | 适配度 | 说明 |
|---|:-:|---|
| 👓 [AI 眼镜](../by-category/02-ai-glasses/) / 📷 [IPC](../by-category/01-ipc/) | ⭐⭐⭐ | 「看图 / 看视频」的提示词与样张可以先在 Agent 里用 `core` + `api` 调通，再落到设备侧 VL 链路；`video-memory` 可参考长视频检索思路 |
| 🤖 [Agent 硬件](../by-category/04-agent-hardware/) | ⭐⭐ | 桌面盒子上的 Agent 可直接装插件读本地文件；`mhs` 是设备控制协议的一种参考，本仓未验证 |
| 🦾 [具身智能](../by-category/09-embodied/) | ⭐ | `mhs` 有机械臂、实验设备的接入思路，只有 mock adapter 可直接试；真机安全与验收需另做 |
| 其他品类 | ⭐ | 只作开发期工具 |

## 5. 计费与边界

- **`core` 本身免费**：原生模式下工具返回图片和文字，由 Harness 主模型自己看，不额外调云端；设 `QWEN_MM_NATIVE_MODE=0` 时改为调 VL 接口生成文字描述，需要 Key 并计费。
- **主模型要能看图**：纯文本主模型拿到的只有 `visualize` 抽出的文字层（PDF 有文字层时），看不到图片内容。
- **系统依赖**：Office 渲染需要 LibreOffice，视频需要 ffmpeg，HTML 截图需要 Playwright 浏览器；PDF、SVG 用内置的 pypdfium2、resvg。
- **交互式安装难进 CI**：本仓 Demo B 用非交互参数安装，可自动化的部分限定为 `visualize` 自检脚本（不经 Harness、不需要 Key）；Harness 回答这一步需要人工或 Harness 自己的凭证。

## 6. 能力边界与待核实

- **已实测（2026-10-25，Linux）**：`install.sh install --plugin core --harness <name> --dry-run` 不进交互菜单，直接打印该 Harness 的安装命令；`verify --plugin core` 通过，未配 Key 时提示 `DASHSCOPE_API_KEY not set`，对 `core` 可忽略；剔除全部 `DASHSCOPE_*` 环境变量后 `visualize` 仍读出 fixture PDF 的标题、表格与分页。
- `mhs` 真机环、Blender / FreeCAD 联动本仓未跑，后续迭代再评估。
- Harness 主模型看图的效果、图片 Token 用量随 Harness 和模型不同，本仓没有横向实测。
- Windows 原生不支持，只能 WSL2；仓库须克隆在 WSL 用户目录下，不要放在 `/mnt/c`。

## 7. 开放资源

- [GitHub 仓库](https://github.com/QwenLM/Qwen-MM-Plugins) · [`core` v1.3.0 Release](https://github.com/QwenLM/Qwen-MM-Plugins/releases/tag/qwen-mm-plugins-core-v1.3.0) · [安装文档](https://github.com/QwenLM/Qwen-MM-Plugins/blob/main/docs/zh/installation.md)
- [Plugin Hub](https://qwenlm.github.io/qwen-mm-plugins-hub/) · [`core` Cookbook](https://qwenlm.github.io/qwen-mm-plugins-hub/plugins/core/cookbook/) · [`mhs` Cookbook](https://qwenlm.github.io/qwen-mm-plugins-hub/plugins/mhs/cookbook/)（均查证 2026-10-25）

> 欢迎补充不同 Harness 下的实测与硬件侧 MHS adapter 案例。提 PR 时请保持客观中立。

---

> 回到 [方案总览](./README.md) · 切到 [按品类](../by-category/) 视角
