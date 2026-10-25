# qwen-audio-agent — 仅前台的全双工语音回合（钉 npm 2.0.1）

本目录交付：**开发者参考实现**，用于学习和验证对应能力。该标签仅描述本仓代码；品类的商业化方向与上游项目的产品状态独立判断。商业集成时，按所选模型服务、素材／组件许可和具体产品的交付要求分别评估。

先只开语音前台：自托管 [qwen-audio-agent](https://github.com/QwenAudio/qwen-audio-agent) 的 Gateway，`AGENT_PROTOCOL=none` 不接后台 Agent，在浏览器里说一句「你好」，确认能看到转写并听到回答。前台通了再按 [Demo D](./acp-edit/) 接编程后台。项目定位、前后台架构和计费见 [08 Qwen Audio Agent 导读](../../../../by-solution/08-qwen-audio-agent.md)。

> **状态：待真 Key 验证**。2026-10-25 在 Linux（Node v22.23.4、`qwen-audio-agent@2.0.1`）上跑通无 Key 预检、Gateway 启动、WebUI 连接，以及占位 Key 下的 401 失败态；真 Key 记录见 [VERIFY.md](./VERIFY.md)。

版本针脚：npm `qwen-audio-agent@2.0.1`（[v2.0.1 Release](https://github.com/QwenAudio/qwen-audio-agent/releases/tag/v2.0.1)，tag = `a73bcbc`，查证 2026-10-25）。main 未发版的改动把默认前台换成 `qwen-audio-3.1-realtime-plus`、Key 变量换成 `QWEN_AUDIO_REALTIME_API_KEY`；按 main 文档操作时以那边为准。

## 最短路径（官方命令）

```bash
npm i -g qwen-audio-agent@2.0.1      # Node.js ^22.22.2 || ^24.15.0 || >=26
qwenaudio config                     # 打印 config.env 路径，默认 ~/.config/qwaudio/config.env
```

在 `config.env` 里写（2.0.1 快速开始的仅前台配置）：

```dotenv
QWEN_AUDIO_REALTIME_PROVIDER=dashscope
DASHSCOPE_API_KEY=sk-xxxx
QWEN_AUDIO_REALTIME_MODEL=qwen-audio-3.0-realtime-plus
AGENT_PROTOCOL=none
```

```bash
qwenaudio            # 终端 1：前台运行 Gateway，http://127.0.0.1:3101
qwenaudio webui      # 终端 2：打开浏览器客户端，允许麦克风后说「你好」
```

## 一键脚本（不改全局配置）

`run.sh` 把配置放在本目录的 `out/qwaudio/`（`QWAUDIO_CONFIG_DIR`，已在 `.gitignore`），Key 只从环境变量 `DASHSCOPE_API_KEY` 读取，不写进 `config.env`。

```bash
export DASHSCOPE_API_KEY=sk-xxxx
bash run.sh            # 检查 Node 与 qwenaudio 版本，生成独立配置（AGENT_PROTOCOL=none），跑 doctor
bash run.sh gateway    # 终端 1：前台运行 Gateway（--backend none），保持运行
bash run.sh webui      # 终端 2：打开 WebUI；--no-open 只打印地址
bash run.sh doctor     # WebUI 保持打开时运行，确认语音服务已连接
```

- 找 `qwenaudio` 的顺序：环境变量 `QWENAUDIO`，否则 `PATH`
- 3101 端口已被全局 Gateway 占用时，先停掉它，或用 `QAA_URL=http://127.0.0.1:3111 bash run.sh gateway`（`webui`、`doctor` 用同一个 `QAA_URL`）
- 没有 Key 时 `bash run.sh` 停在「凭证」一步，退出码 0；`gateway` 拒绝启动，退出码 2

## 预期输出

`bash run.sh gateway`：

```text
[gateway] 仅前台模式（--backend none），配置目录 …/out/qwaudio；Ctrl+C 退出
Gateway 已启动：http://127.0.0.1:3101
WebUI：http://127.0.0.1:3101/
Realtime：Qwen Audio 3.0 Realtime Plus · 仅前台聊天模式
```

WebUI 顶栏显示「仅前台聊天」和「Qwen Audio 3.0 Plus」，右侧是语音服务的连接状态。WebUI 保持打开时，`bash run.sh doctor` 的关键几行：

```text
      [ok] gateway：Gateway 可达
      [skipped] backend：仅前台模式
      [ok] realtime.connection：语音服务已连接
通过：Gateway 与语音前台已连接（仅前台模式）。在 WebUI 里说「你好」，确认看到转写并听到回答。
```

`realtime.connection` 由 Gateway 的 `/api/health` 给出，是「语音服务确实连上了」的依据；`realtime.configuration` 只检查本终端的环境变量有没有 Key，不校验 Key。

## 验收

- [ ] `bash run.sh` 显示 `qwen-audio-agent 2.0.1`，Node 版本满足要求
- [ ] Gateway 启动日志有 `仅前台聊天模式`；WebUI 顶栏显示「仅前台聊天」
- [ ] WebUI 保持打开时 `bash run.sh doctor` 输出「通过」，`realtime.connection` 为 `ok`
- [ ] 说「你好」后，WebUI 出现这句话的转写，并能听到语音回答
- [ ] [VERIFY.md](./VERIFY.md) 追加一行：日期、地域、首字延迟（说完 → 听到回答第一个字）

## 失败态

| 现象 | 原因与处理 |
|---|---|
| `[qwenaudio] 没找到 qwenaudio`，退出码 2 | `npm i -g qwen-audio-agent@2.0.1`，或 `QWENAUDIO=/路径/qwenaudio bash run.sh` |
| `Node … 不满足 ^22.22.2 …`，退出码 3 | 升级 Node；2.0.1 不支持 Node 20 和 22.22.2 以下 |
| `停在配置：没有 DASHSCOPE_API_KEY` | 在启动 Gateway 的终端 `export DASHSCOPE_API_KEY=…` |
| WebUI 提示 `Unexpected server response: 401`；`doctor` 报 `realtime.connection：语音服务连接异常（Unexpected server response: 401）` | Key 无效，或 Key 与接入地域不符（默认北京 `wss://dashscope.aliyuncs.com/api-ws/v1/realtime`）；`sk-sp-` 开头的 Token Plan Key 不能用于 Realtime |
| `realtime.connection` 一直是 `warning` | 没有活动的语音会话：WebUI 未打开、已关闭，或被同一用户的新客户端接管（每个用户只保留一个活动客户端） |
| `gateway：无法读取 Gateway 状态` | Gateway 没在运行，或 `QAA_URL` 与 Gateway 端口不一致 |
| 浏览器不弹麦克风授权、听不到声音 | 只在 `http://127.0.0.1` 或 `localhost` 打开（浏览器只在安全来源给麦克风）；检查系统输入输出设备。**没有麦克风时**在输入框打字「你好」，回答仍以语音播放，可以先验证前台和扬声器 |
| 回答被自己的声音打断 | 外放时回声进了麦克风；戴耳机，或换有回声消除的设备 |

更多见上游[故障排查](https://github.com/QwenAudio/qwen-audio-agent/blob/v2.0.1/docs/operations/troubleshooting.zh.md)。本仓 CI 不跑本示例：语音回合需要真 Key、麦克风和扬声器。

## 关键点

- **只开前台**：`AGENT_PROTOCOL=none` 与 `--backend none` 都表示不启动后台 Agent，聊天和已启用的前台工具仍可用
- **国际站**：设 `QWEN_AUDIO_REALTIME_URL=wss://dashscope-intl.aliyuncs.com/api-ws/v1/realtime` 并用新加坡 Key；该地域是否提供 `qwen-audio-3.0-realtime-plus` 待实测
- **计费**：Realtime 按音频时长与 Token 计费，口径见 [08 导读](../../../../by-solution/08-qwen-audio-agent.md)第 5 节，价格以控制台为准；Gateway 本身免费
- **硬件**：本示例在电脑上跑，不涉及设备烧录；独立硬件终端参考上游 [AI Passport 示例](https://github.com/QwenAudio/qwen-audio-agent/tree/v2.0.1/examples/ai-passport)（ESP32-C3，半双工），本仓不烧录

> ⚠️ AI 生成代码，仅作接入参考。
