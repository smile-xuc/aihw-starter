# acp-edit — 语音委派后台 Agent 改 fixture 文件（Demo D）

本目录交付：**开发者参考实现**，用于学习和验证对应能力。该标签仅描述本仓代码；品类的商业化方向与上游项目的产品状态独立判断。商业集成时，按所选模型服务、素材／组件许可和具体产品的交付要求分别评估。

在 [Demo C](../) 的语音前台上接一个后台编程 Agent：边聊边说「把 target.txt 改成 hello-aihw」，前台把任务交给后台异步执行，WebUI 出现工作卡片，完成后用语音回报，文件内容可以用脚本核对。版本同 Demo C，钉 `qwen-audio-agent@2.0.1`；架构见 [08 导读](../../../../../by-solution/08-qwen-audio-agent.md)。

> **状态：待真 Key 验证**。2026-10-25 在 Linux 上验证了脚本的工作区重置、配置生成、后台只读检查与文件核对；后台缺失时 Gateway 仍能启动、`doctor` 报「后台 Agent 尚未就绪」。尚无真实语音委派记录，见 [VERIFY.md](./VERIFY.md)。

## 前置

- Demo C 已跑通：`bash ../run.sh doctor` 输出「通过」
- 一个 2.0.1 文档列出的后台，已在它**自己的终端里**登录并跑通过一次。默认 Qwen Code（`AGENT_PROTOCOL=qwen`，原生 ACP，2.0.1 要求 ≥ 0.21.6）；换后台用 `BACKEND=opencode`、`openclaw`、`codex`、`claude` 等，完整列表见上游[后台列表](https://github.com/QwenAudio/qwen-audio-agent/blob/v2.0.1/docs/backends/overview.zh.md)
- 后台缺组件时可用 `qwenaudio install qwen` 补齐；装好后仍要按后台自己的方式完成登录与模型配置

## 最短路径

```bash
cd solutions/by-category/04-agent-hardware/demo/qwen-audio-agent/acp-edit
export DASHSCOPE_API_KEY=sk-xxxx
bash run.sh            # 重置工作区、生成独立配置（AGENT_PROTOCOL=qwen）、只读检查后台
bash run.sh gateway    # 终端 1：Gateway + 后台，保持运行
bash run.sh webui      # 终端 2：打开 WebUI，允许麦克风
bash run.sh doctor     # 终端 2：页面开着时跑，通过：后台 Agent 已就绪，语音服务已连接
```

在 WebUI 里说（或打字）：

```text
请后台把工作区里的 target.txt 改成只有一行 hello-aihw。
```

后台请求写文件权限时，回答「允许此任务」。听到完成的语音回报后：

```bash
bash run.sh check      # 通过：…/out/acp-workspace/target.txt 的内容是 hello-aihw
```

## 脚本做了什么

| 步骤 | 内容 |
|---|---|
| 工作区 | 把 [`fixture/target.txt`](./fixture/target.txt) 复制到 `../out/acp-workspace/`，设为 `QWAUDIO_WORKSPACE`。仓库里的 fixture 不会被改；每次 `bash run.sh` 都重置副本 |
| 配置 | 独立目录 `../out/qwaudio-acp/`（与 Demo C 的 `out/qwaudio/` 分开），写入 `AGENT_PROTOCOL=$BACKEND` 与工作区路径；Key 只从环境变量读 |
| 后台检查 | `qwenaudio setup --backend $BACKEND --json`，只读，不安装、不登录、不验证额度；结果在 `../out/setup-<后台>.json` |
| 诊断 | `doctor` 读本配置目录对应的 Gateway，`backend` 与 `realtime.connection` 都为 `ok` 才算通过；结果在 `../out/doctor-acp.json` |
| 权限 | 保持默认 `native`：是否请求授权由后台决定，Gateway 转发真实的权限请求，由人在 WebUI 里确认。本示例不开 `full`；上游说明 Pi 没有审批环节，始终等效 `full` |

上游说明[工作区是项目目录，不是沙箱](https://github.com/QwenAudio/qwen-audio-agent/blob/v2.0.1/docs/configuration/backend.zh.md)，后台能访问工作区之外的文件，所以示例只把一份副本交给它，不指向本仓目录。

## 验收

- [ ] `bash run.sh` 显示后台「已就绪」；Gateway 与 WebUI 都开着时 `bash run.sh doctor` 输出「通过」
- [ ] 说完指令后，WebUI 出现这项任务的工作卡片，状态经过「执行中」（需要授权时显示待确认）
- [ ] 前台不等任务结束就能继续聊天；任务完成后用语音回报
- [ ] `bash run.sh check` 输出「通过」
- [ ] [VERIFY.md](./VERIFY.md) 追加一行，写明后台名称与版本、从说完指令到语音回报的耗时

## 失败态

| 现象 | 原因与处理 |
|---|---|
| `停在后台：…未找到 Qwen Code` | 后台没装；`qwenaudio install qwen` 补齐后，在它自己的终端里登录 |
| `未就绪：Qwen Code … 低于最低版本 0.21.6` | 升级 Qwen Code |
| `doctor` 报 `backend：后台 Agent 尚未就绪`，Gateway 日志 `acp.initialization_failed` 带 `spawn … ENOENT` | 后台可执行文件不在启动 Gateway 的终端的 `PATH` 里 |
| `doctor` 报 `backend：后台 Agent 尚未就绪`，`acp.initialization_failed` 是其他原因 | 后台进程起来了但没完成 ACP 握手：核对后台版本，先在它自己的终端里跑通一次。完整日志在 `../out/qwaudio-acp/state/logs/gateway.log` |
| `doctor` 报 `backend：仅前台模式`；前台回答「无法执行」，没有工作卡片 | 连上的是仅前台模式的 Gateway（多为 Demo C 的 Gateway 还开着，两者都默认 3101 端口）；关掉它，用本目录的 `bash run.sh gateway` 启动 |
| `doctor` 报 `realtime.connection` 为 `warning` 或 `error` | 同 Demo C：没打开 WebUI，或 Key／地域不对，见[上一级 README](../README.md)「失败态」 |
| 卡片停在「等待授权」 | 在 WebUI 里允许，或说「允许此任务」；授权只在当前 Gateway 进程内有效，重启后要重新确认 |
| 卡片显示失败 | 看卡片里的错误：多为后台未登录、模型额度不足或工具环境不全；先在后台自己的终端里跑同样的请求 |
| `check` 未通过，内容多了别的行 | 后台追加而不是替换；重跑 `bash run.sh` 重置后，把指令说成「改成只有一行」 |

## 关键点

- **两份凭证**：前台 Realtime 用 `DASHSCOPE_API_KEY`；后台 Agent 用它自己的登录和模型（Qwen Code、OpenCode 等各自计费），本示例不替后台配 Key
- **不绑定单一后台**：`BACKEND` 只接受 2.0.1 文档列出的后台；`acp` 为通用 ACP，需另设 `ACP_COMMAND` 与 `ACP_ARGS`
- **不进本仓 CI**：需要真 Key、麦克风和已登录的后台

> ⚠️ AI 生成代码，仅作接入参考。
