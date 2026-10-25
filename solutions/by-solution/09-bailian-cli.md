# 百炼 CLI（Model Studio CLI）开发者工具导读

> [Model Studio CLI](https://github.com/modelstudioai/cli) 是阿里云百炼以 Apache-2.0 开源的命令行工具，npm 包名 `bailian-cli`，命令为 `bl`（别名 `bailian`）。它在终端里直接调用百炼的文本、全模态、图像、视频、视觉理解、应用、记忆与知识库接口，也可以把百炼 Key 写进 Claude Code、Qwen Code、Codex 等编程 Agent 的配置。[官方文档](https://docs.bailian.console.aliyun.com/zh/model-studio/cli/overview)。
>
> 本页是**开发者工具导读**（跨品类横切），不是官方商业方案，客观中立，不做项目背书。版本以 npm `bailian-cli@2.5.1`（2026-10-23 发布，对应 tag [`v2.5.1`](https://github.com/modelstudioai/cli/releases/tag/v2.5.1)，main `3c8031f`）为准，查证 2026-10-25。本仓可跑示例：[`04-agent-hardware/demo/bailian-cli/`](../by-category/04-agent-hardware/demo/bailian-cli/)。

## 1. 项目速览

| 项 | 内容 |
|---|---|
| **许可** | Apache-2.0，无授权费 |
| **维护活跃度** | v2.5.1 于 2026-10-23 发布（[CHANGELOG](https://github.com/modelstudioai/cli/blob/main/CHANGELOG.zh.md)）；main 最近提交 `3c8031f`（2026-10-23）；GitHub Star 约 360（查证 2026-10-25） |
| **支持的模型与价格口径** | 各命令有默认模型，均可用 `--model` 换：`bl text chat` 默认 `qwen3.8-max`，`bl omni` 默认 `qwen3.5-omni-plus`，`bl image generate` 默认 `qwen-image-3.0`，`bl vision describe` 默认 `qwen3-vl-plus`。CLI 本身不收费，调用按所选模型的百炼目录价计费，以控制台为准 |
| **端云部署形态** | 本机命令行：npm 安装需 Node.js ≥ 18.17.0，另有不依赖 Node.js 的二进制安装脚本（macOS / Linux / Windows）。推理全部在云端，CLI 不做端侧推理 |
| **硬件接入方式** | 不直接接设备。用途是在开发机或 CI 上先验证 Key、地域、模型和请求体，再把同样的请求搬进设备固件、App 或 Gateway 代码 |

## 2. 能力地图

| 命令 | 做什么 | 对 AI 硬件开发的用处 |
|---|---|---|
| `bl auth login` / `bl auth status` | 三种鉴权并存：模型 API Key、控制台浏览器登录、OpenAPI AK/SK；`status` 输出脱敏 Key、来源（环境变量或配置文件）和接入地址 | 量产前先确认 Key 属于哪个地域、是否能调到目标模型 |
| `bl text chat` | OpenAI 兼容的文本对话（`--api chat` 或 `responses`），支持工具定义、思考模式、流式 | 对照设备侧 Function Calling 请求体；挑选控成本的小模型 |
| `bl omni` | Qwen-Omni 文本＋音频输出，可带图片、音频、视频 | 不写代码先听一遍音色和回答风格 |
| `bl image generate` / `image edit` | 文生图、图像编辑（Qwen-Image、万相） | 生成产品示意图、测试素材 |
| `bl vision describe` | 用 Qwen-VL 描述图片或视频 | 用样张验证眼镜、IPC 的看图提示词 |
| `bl video generate` 等 | 视频生成、编辑、任务查询 | 营销素材，非设备主链路 |
| `bl app call` / `knowledge` / `memory` | 调用百炼应用、知识库检索、长期记忆 | 对照应用编排或记忆服务的效果 |
| `bl config agent` | 把百炼接入地址、Key、默认模型写进编程 Agent 配置（`claude-code`、`qwen-code`、`opencode`、`openclaw`、`hermes`、`codex`、`pi`） | 让编程 Agent 用百炼模型写固件、跑本仓 demo |
| 全局 `--dry-run` / `--output json` | 只打印请求体不发请求；JSON 输出便于脚本解析 | 无 Key 也能在 CI 检查请求体结构 |

> 命令与默认模型摘自 `bl 2.5.1 --help` 实际输出（2026-10-25）。完整命令清单见[官方文档](https://docs.bailian.console.aliyun.com/zh/model-studio/cli/overview)，文本、图像、视觉分别见[文本对话](https://docs.bailian.console.aliyun.com/zh/model-studio/cli/text-chat)、[图像](https://docs.bailian.console.aliyun.com/zh/model-studio/cli/image)、[视觉理解](https://docs.bailian.console.aliyun.com/zh/model-studio/cli/vision)。

## 3. 安装与鉴权（最短路径）

```bash
npm install -g bailian-cli          # 官方要求用 npm，不要改用 pnpm / yarn
bl --version                        # 期望 bl 2.5.1
bl auth login --api-key "$DASHSCOPE_API_KEY"   # 会校验后保存到 ~/.bailian/config.json
bl auth status --output json        # 看 api_key.masked、source、base_url
bl text chat --model qwen3.7-flash --message "用一句话介绍 AI 硬件" --output json
```

- **不落盘**：CI 或一次性环境只设 `DASHSCOPE_API_KEY` 即可，`auth status` 会显示 `source: env`。Key 通过密钥管理注入，不写进脚本或仓库。
- **地域**：默认北京 `https://dashscope.aliyuncs.com`；新加坡用 `--base-url https://dashscope-intl.aliyuncs.com`。北京和新加坡的 Key 不能混用。
- **无 Node.js**：`curl -fsSL https://bailian.aliyun.com/cli/install.sh | bash`（Windows 用 `install.ps1`），步骤见[安装文档](https://docs.bailian.console.aliyun.com/zh/model-studio/cli/installation)。
- **遥测**：默认开启，设 `DO_NOT_TRACK=1` 关闭（2.5.1 源码 `packages/core/src/config/loader.ts`）。

本仓 [Demo A](../by-category/04-agent-hardware/demo/bailian-cli/) 把上面几步写成 `run.sh`：没有 Key 时停在 `auth status` 并输出 `--dry-run` 请求体，退出码 0；有 Key 时真跑一条文本（可选一张图），产物写到 `out/`。

## 4. 品类适配

| 品类 | 适配度 | 用法 |
|---|:-:|---|
| 🤖 [Agent 硬件](../by-category/04-agent-hardware/) | ⭐⭐⭐ | 盒子或宿主机上的脚本可直接调 `bl`；`--output json` 便于把结果喂给本地编排；`bl config agent` 给编程 Agent 配模型 |
| 👓 [AI 眼镜](../by-category/02-ai-glasses/) / 📷 [IPC](../by-category/01-ipc/) | ⭐⭐ | 用 `bl vision describe` 拿样张验证看图提示词，再落到端侧 SDK |
| 🧸 [AI 玩具](../by-category/03-toys-companion/) / 🪴 [桌宠](../by-category/05-desktop-pet/) / 🎧 [耳机](../by-category/06-ai-earphone/) | ⭐⭐ | `bl omni` 试音色和人设回答；实时语音仍走 Realtime 接口，CLI 不覆盖 |
| 其他品类 | ⭐ | 只作开发期工具，不进设备主链路 |

## 5. 计费与边界

- **计费**：CLI 免费；每条命令按所调模型计费，图像、视频按张或按秒，价格以[模型价格](https://help.aliyun.com/zh/model-studio/model-pricing)和控制台为准。
- **Token Plan Key**：`sk-sp-` 开头的 Key 只能用于编程工具，调普通模型接口会被拒绝（本仓体验中心「我的」页同样提示）；`bl config agent --region` 只适用于 Token Plan。
- **不是端侧方案**：不提供离线推理、唤醒或音频流处理；实时语音、全双工打断要用 Realtime 接口或 [08 Qwen Audio Agent](./08-qwen-audio-agent.md)。

## 6. 能力边界与待核实

- **接入地址环境变量**：[安装文档](https://docs.bailian.console.aliyun.com/zh/model-studio/cli/installation)写「接入地址可通过 `BAILIAN_BASE_URL` 覆盖」，但 2.5.1 源码只读取 `DASHSCOPE_BASE_URL`（优先级：`--base-url` > `DASHSCOPE_BASE_URL` > 配置文件 > 默认北京）。本仓 demo 显式传 `--base-url`，两种写法哪个是最终口径待上游确认。
- **鉴权校验**：`bl auth login --api-key` 会先校验再保存；`DASHSCOPE_API_KEY` 环境变量不校验，`auth status` 显示已鉴权不代表 Key 可用，真跑一次才算数（2026-10-25 用无效占位 Key 实测：`auth status` 显示已鉴权，调用返回 HTTP 401）。
- **思考模式**：`bl text chat` 只有 `--enable-thinking` 开关，不会发送 `enable_thinking=false`；`qwen3.7-flash` 这类混合思考模型按模型默认值决定是否思考，成本以返回的 `usage` 为准。
- **真 Key 结果**：本仓尚无真实调用记录，首字延迟、单次成本待实测（见 Demo A 的 VERIFY）。

## 7. 开放资源

- [GitHub 仓库](https://github.com/modelstudioai/cli) · [v2.5.1 Release](https://github.com/modelstudioai/cli/releases/tag/v2.5.1) · [CHANGELOG](https://github.com/modelstudioai/cli/blob/main/CHANGELOG.zh.md)
- 官方文档：[概览](https://docs.bailian.console.aliyun.com/zh/model-studio/cli/overview) · [安装](https://docs.bailian.console.aliyun.com/zh/model-studio/cli/installation) · [快速开始](https://docs.bailian.console.aliyun.com/zh/model-studio/cli/quickstart)
- [获取 API Key](https://help.aliyun.com/zh/model-studio/get-api-key) · [地域与接入地址](https://help.aliyun.com/zh/model-studio/regions)（均查证 2026-10-25）

> 欢迎补充真 Key 下的验证记录与 CI 用法。提 PR 时请保持客观中立。

---

> 回到 [方案总览](./README.md) · 切到 [按品类](../by-category/) 视角
