# 验证记录 · 04 Agent 硬件 · qwen-audio-agent 语音委派后台改 fixture（Demo D）

状态：**待真 Key 验证**。2026-10-25 在 Linux（Node v22.23.4、`qwen-audio-agent@2.0.1`）上跑通了不计费的部分，但还没有真实语音委派的记录：

- 后台未安装：`bash run.sh` 重置工作区并生成 `../out/qwaudio-acp/config.env`（`AGENT_PROTOCOL=qwen`），`setup` 报「未找到 Qwen Code」，停在「后台」，退出码 0
- 后台版本：用只打印版本号的替身 `qwen` 测，0.0.0 报「低于最低版本 0.21.6」；0.21.6 显示「已就绪」，无 Key 时停在「凭证」，退出码 0
- Gateway：后台不在 `PATH` 里时，占位 Key 下 Gateway 仍能启动，终端记 `acp.initialization_failed`（「Qwen Code ACP 进程启动失败（spawn qwen ENOENT）」）。替身 `qwen` 启动即退出时，同一事件带 `write EPIPE`。两种情况 `bash run.sh doctor` 都报 `backend` 为 `warning`（「后台 Agent 尚未就绪」），退出码 1
- 端口冲突：Demo C 的仅前台 Gateway 占着 3101 时，`bash run.sh doctor` 报 `backend` 为 `skipped`，提示换用本目录的 Gateway
- 文件核对：`bash run.sh check` 对未改动的副本报「未通过」（退出码 1），副本内容为 `hello-aihw` 时报「通过」；仓库里的 [`fixture/target.txt`](./fixture/target.txt) 未被改动

口径：

- **首字延迟**：这里记的是**委派往返**，即说完指令到听到「完成」语音回报的第一个字，用手动计时或录屏读帧；打字下达时写「文字输入」并单独记。前台对指令本身的即时应答另记在「备注」
- **单次成本**：只算前台 `qwen-audio-3.0-realtime-plus` 这一轮的音频输入／输出时长与 Token × 表中地域的目录价，价格以控制台为准；后台 Agent 的模型费用按后台自己的计费单独写进「备注」，不并入
- **新增记录**：每次真跑在下表末尾追加一行。「环境」写系统、浏览器、后台名称与版本；「备注」写 `doctor` 结果、是否经过授权、`check` 结果

待实测（真 Key 时逐项写进「备注」，有结论后更新 README）：

- [ ] **工作卡片**：说完指令后是否出现任务卡片，状态如何流转（执行中、待授权、完成）
- [ ] **授权**：`native` 模式下该后台改文件前是否发出权限请求（由后台决定）；说「允许此任务」与在 WebUI 里点允许是否都生效
- [ ] **前台不阻塞**：任务执行期间能否继续和前台对话
- [ ] **语音回报**：任务完成后是否主动语音回报，回报内容是否与文件实际状态一致
- [ ] **文件结果**：`check` 是否通过；后台是替换整份文件还是追加
- [ ] **其他后台**：`BACKEND=opencode`、`codex`、`claude` 等至少再跑一种，记下差异

| 日期 | 地域 | 模型 | 首字延迟 | 单次成本（元） | 输入 | 环境 | 验证人 | 备注 |
|---|---|---|---|---|---|---|---|---|
