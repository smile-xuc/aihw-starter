# 验证记录 · 02 AI 眼镜 · 百炼

状态：**待真 Key 验证**。2026-10-01 只通过 mock 冒烟（CI `demo-smoke`），尚无真实调用记录。

口径：

- **首字延迟**：松开镜腿 → 首包语音。默认模式从提问上传开始，到收到 TTS 第一个音频帧，包含 `qwen3.8-omni-flash` 首字和 TTS 首包；`--realtime` 从 `input_audio_buffer.commit` 到首个 `response.audio.delta`
- **单次成本**：一问的 `usage` × 表中地域的模型单价。默认模式 = 看图听问 Token + TTS 计费字符（`usage.characters`）；`--realtime` = 一轮 `response.done.usage`，「备注」写明模式与 `representation_compact`
- **新增记录**：`python3 run.py --record`（或 `--realtime --record`）真跑成功后自动在下表末尾追加一行；提交前补「验证人」，在「备注」写网络环境

| 日期 | 地域 | 模型 | 首字延迟 | 单次成本（元） | 输入 | 环境 | 验证人 | 备注 |
|---|---|---|---|---|---|---|---|---|
