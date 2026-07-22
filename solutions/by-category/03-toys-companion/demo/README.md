<!-- HERO:START -->
<div align="center">

<sub><a href="../../../../README.md">🏠 aihw-starter</a> &nbsp;›&nbsp; <a href="../README.md">🧸 AI 玩具 / 陪伴 / 儿童伴学</a> &nbsp;›&nbsp; <b>🧪 Demo</b></sub>

# 🧪 Demo · 玩具陪伴 & 儿童伴学

`🧸 AI 玩具 / 陪伴 / 儿童伴学` · `Demo`

</div>

---
<!-- HERO:END -->

> 本目录存放玩具/陪伴/伴学品类的可运行示例代码，与 [`02-solution.md`](../02-solution.md) 的三大场景包一一对应。

## 已有 demo

- ✅ [**`voice-clone/`**](./voice-clone/) — ❤️ 亲情包 · 爸妈声音陪伴最小闭环：20 秒录音 → 克隆音色 → 用爸妈声音讲睡前故事

## 计划包含的 demo（欢迎贡献）

- [ ] **`minimal-companion/`** — 最小陪伴对话 demo（ASR + qwen-flash + CosyVoice，约 100 行 Python）
- [ ] **`photo-qa/`** — 📖 伴学包 · 拍照问答 demo（Qwen-VL 引导式讲题，不直接给答案）
- [ ] **`daily-report/`** — 📖 伴学包 · 学情日报 demo（对话+做题数据 → 每日总结）
- [ ] **`oral-practice/`** — 🌍 成长包 · 口语陪练 demo（翻译智能体 + 变量切换语种）
- [ ] **`memory-layer/`** — 长记忆分层架构 demo（每日摘要 + 用户画像注入）
- [ ] **`safety-prompt/`** — 6 条儿童安全红线的系统提示词验证
- [ ] **`offline-fallback/`** — 离线兜底语料示例

## 贡献指引

每个 demo 子目录建议包含：
- `README.md`：说明 demo 用途、运行方式、依赖
- `requirements.txt` 或 `package.json`：依赖清单
- 主程序文件（< 500 行，易于阅读）
- 测试音频/示例输入（小尺寸）

详见根目录 [`CONTRIBUTING.md`](../../../../CONTRIBUTING.md)。

<!-- FOOTER:START -->

---

<table width="100%">
<tr>
<td align="left" width="33%">

<a href="../05-faq.md">← ❓ 常见问答</a>

</td>
<td align="center" width="34%">

<a href="../README.md">↑ 返回品类首页</a> · <a href="../../../../README.md">🏠 仓库首页</a>

</td>
<td align="right" width="33%">

<sub>（末篇）</sub>

</td>
</tr>
</table>
<!-- FOOTER:END -->
