# 验证记录 · 04 Agent 硬件 · qwen-audio-agent 仅前台语音回合

状态：**待真 Key 验证**。2026-10-25 在 Linux（Node v22.23.4、`qwen-audio-agent@2.0.1`）上跑通不计费的部分，尚无真实语音回合记录：

- 无 Key：`bash run.sh` 生成 `out/qwaudio/config.env`（`AGENT_PROTOCOL=none`），停在「凭证」，退出码 0；`bash run.sh gateway` 拒绝启动，退出码 2
- 占位 Key：Gateway 以「仅前台聊天模式」启动；无头 Chrome 打开 WebUI 后，前台连接北京端点被拒，WebUI 显示 `Unexpected server response: 401`，`bash run.sh doctor` 报 `realtime.connection` 为 `error` 并带出同一原因
- WebUI 未打开时 `doctor` 的 `realtime.connection` 为 `warning`（没有语音会话），`backend` 为 `skipped`（仅前台模式）

口径：

- **首字延迟**：说完「你好」→ 听到回答第一个字，手动计时或录屏读帧；打字输入时写「文字输入」并单独记
- **单次成本**：一轮「你好」对话的音频输入／输出时长与 Token × 表中地域 `qwen-audio-3.0-realtime-plus` 的目录价；价格以控制台为准
- **新增记录**：每次真跑在下表末尾追加一行，在「环境」写系统、浏览器与是否戴耳机，在「备注」写 `doctor` 的 `realtime.connection` 结果

待实测（真 Key 时逐项写进「备注」，有结论后更新 README）：

- [ ] **连接与转写**：`realtime.connection` 是否为 `ok`；「你好」的转写是否准确
- [ ] **首字延迟**：北京地域说完到听到回答的时间，外放与耳机各一次
- [ ] **打断**：回答过程中插话能否打断（WebUI 全双工）；外放时是否被自己的回声打断
- [ ] **无麦路径**：只打字「你好」时，回答是否以语音播放
- [ ] **国际站**：`QWEN_AUDIO_REALTIME_URL` 指向新加坡时，`qwen-audio-3.0-realtime-plus` 是否可用

| 日期 | 地域 | 模型 | 首字延迟 | 单次成本（元） | 输入 | 环境 | 验证人 | 备注 |
|---|---|---|---|---|---|---|---|---|
