# 验证记录 · 02 AI 眼镜 · 百炼

状态：**待真 Key 验证**。2026-10-01 只通过 mock 冒烟（CI `demo-smoke`），尚无真实调用记录。

口径：

- **首字延迟**：松开镜腿 → 首包语音。默认模式从提问上传开始，到收到 TTS 第一个音频帧，包含 `qwen3.8-omni-flash` 首字和 TTS 首包；`--realtime` 从 `input_audio_buffer.commit` 到首个 `response.audio.delta`
- **单次成本**：一问的 `usage` × 表中地域的模型单价。默认模式 = 看图听问 Token + TTS 计费字符（`usage.characters`）；`--realtime` = 一轮 `response.done.usage`，「备注」写明模式与 `representation_compact`
- **新增记录**：`python3 run.py --record`（或 `--realtime --record`）真跑成功后自动在下表末尾追加一行；提交前补「验证人」，在「备注」写网络环境

待实测（真 Key 时逐项写进「备注」）：

- [ ] **首包延迟**：默认模式的 `[统计]` 分别打印看图听问首字和 TTS 首包，记下两段；`--realtime` 记首包音频。官方没有可引用的数字
- [ ] **TTS 计费字符**：`usage.characters` 是否按价格页口径「一个汉字 2 个字符」返回（样本回答约 45 个字，应在 90 左右），还是像官方事件示例那样一字一计
- [ ] **Token 折算**：用 `usage` 核对官方口径
  - `qwen3.8-omni-flash` 的输入 ≈ 图片 300 Token（640×480）+ 提问秒数 × 7 + 指令
  - `--realtime` 输入音频 ≈ 提问秒数 × 7，输出音频 ≈ 回答秒数 × 12.5
- [ ] **画面聚合**：同一输入分别跑 `--realtime` 和 `--realtime --compact none`，对比 `input_tokens`，看 `normal` 是否约为 `none` 的 1/4（`usage` 不单列画面 Token）
- [ ] **新加坡**：TTS WebSocket 和音色 `longanhuan_v3.6` 在新加坡能否用

| 日期 | 地域 | 模型 | 首字延迟 | 单次成本（元） | 输入 | 环境 | 验证人 | 备注 |
|---|---|---|---|---|---|---|---|---|
