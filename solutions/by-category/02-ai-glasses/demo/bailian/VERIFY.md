# 验证记录 · 02 AI 眼镜 · 百炼

状态：**待真 Key 验证**。2026-10-01 只通过 mock 冒烟（CI `demo-smoke`），尚无真实调用记录。

口径：

- **首字延迟**：松开镜腿 → 首包语音。默认模式从提问上传开始，到收到 TTS 第一个音频帧，包含 `qwen3.8-omni-flash` 首字和 TTS 首包；`--realtime` 从 `input_audio_buffer.commit` 到首个 `response.audio.delta`
- **单次成本**：一问的 `usage` × 表中地域的模型单价。默认模式 = 看图听问 Token + TTS 计费字符（`usage.characters`）；`--realtime` = 一轮 `response.done.usage`，「备注」写明模式与 `representation_compact`
- **新增记录**：`python3 run.py --record`（或 `--realtime --record`）真跑成功后自动在下表末尾追加一行；提交前补「验证人」，在「备注」写网络环境

待实测（真 Key 时逐项写进「备注」）：

- [ ] **首包延迟**：默认模式的 `[统计]` 分别打印看图听问首字和 TTS 首包，记下两段；`--realtime` 记首包音频。官方没有可引用的数字
- [ ] **图片与音频 Token 折算**：用 `usage` 核对官方口径
  - `qwen3.8-omni-flash` 的输入 ≈ 图片 300 Token（640×480）+ 提问秒数 × 7 + 指令
  - `--realtime` 输入音频 ≈ 提问秒数 × 7，输出音频 ≈ 回答秒数 × 12.5
  - 画面聚合：同一输入分别跑 `--realtime` 和 `--realtime --compact none`，对比 `input_tokens`，看 `normal` 是否约为 `none` 的 1/4（`usage` 不单列画面 Token）
- [ ] **单次成本**：拍照即问是否在 README 估算的 ¥0.01 / 问左右，`--realtime` 首轮是否在 ¥0.002–0.003
  - TTS 的 `usage.characters` 是否按价格页口径「一个汉字 2 个字符」返回：样本回答约 45 个字，应在 90 左右；官方事件示例看起来是一字一计
- [ ] **专属域名连通性**：三条地址都只走业务空间专属域名，逐一确认能连上：看图听问 `…/compatible-mode/v1`、TTS WebSocket `…/api-ws/v1/inference`、Realtime `…/api-ws/v1/realtime`
  - 北京、新加坡各跑一遍，确认 TTS 音色 `longanhuan_v3.6` 在新加坡也能用
- [ ] **实时模式稳定性**：`--realtime` 用两段以上 `--audio` 或 `--mic` 连续多轮
  - 会话不中途断开，上下文能保留，后续轮次的输入 Token 随历史增长、费用相应变高
  - 默认模式连续跑 20 次以上，确认播报连接（单线程交替收发）在真实网络上不再偶发断连

| 日期 | 地域 | 模型 | 首字延迟 | 单次成本（元） | 输入 | 环境 | 验证人 | 备注 |
|---|---|---|---|---|---|---|---|---|
