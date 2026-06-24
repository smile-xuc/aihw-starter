# Demo · 玩具/陪伴

> 本目录用于存放玩具/陪伴品类的可运行示例代码。
> 当前为占位版，欢迎社区贡献最小可运行 demo。

## 计划包含的 demo

- [ ] **`minimal-companion/`** — 最小陪伴对话 demo（ASR + qwen-plus + CosyVoice，约 100 行 Python）
- [ ] **`voice-clone/`** — 一句话声音复刻完整流程
- [ ] **`emotion-tts/`** — 情感 TTS 切换示例
- [ ] **`role-play/`** — 多角色切换 demo（小熊/老师/护士长等）
- [ ] **`safety-prompt/`** — 6 条儿童安全红线的系统提示词验证
- [ ] **`offline-fallback/`** — 离线兜底语料示例

## 贡献指引

每个 demo 子目录建议包含：
- `README.md`：说明 demo 用途、运行方式、依赖
- `requirements.txt` 或 `package.json`：依赖清单
- 主程序文件（< 500 行，易于阅读）
- 测试音频/示例输入（小尺寸）

详见根目录 [`CONTRIBUTING.md`](../../../CONTRIBUTING.md)。
