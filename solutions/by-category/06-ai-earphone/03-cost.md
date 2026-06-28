<!-- HERO:START -->
<div align="center">

<sub><a href="../../../README.md">🏠 aihw-starter</a> &nbsp;›&nbsp; <a href="README.md">🎧 AI 耳机</a> &nbsp;›&nbsp; <b>💰 成本与计费</b></sub>

# 💰 AI 耳机 成本与计费（占位版）

`🎧 AI 耳机` · `成本与计费`

</div>

---
<!-- HERO:END -->

> **占位说明**：本品类成本测算为简版，详细数据将在后续版本补充。
> 完整接入方案请见 [`02-solution.md`](./02-solution.md)。

## 1. 翻译耳机成本

### 1.1 不同方案的成本对比（参考量级）

| 方案 | 1 小时双向通话 | 适用 |
|---|---|---|
| Gummy 实时 ASR + qwen-plus 翻译 | 较低 | 仅需文字翻译 |
| Qwen3.5-Livetranslate | 中等 | 同传质量、低延迟 |
| Qwen3.5-Omni-Realtime | 较高 | 多模态全双工 |

### 1.2 成本量级估算

- Gummy 单价约 0.00015 元/秒 → 1 小时单向约 0.54 元
- Livetranslate 比 Gummy 高 5–6 倍量级 → 1 小时单向约 3 元
- Omni-Realtime 按 token 计费 → 取决于对话密度

具体数字以官方计费为准。

## 2. AI 对话耳机成本

| 模型 | 适用 | 月成本量级 |
|---|---|---|
| Qwen-Omni-Flash | 入门对话耳机 | 个位数元/月 |
| Qwen3.5-Omni-Realtime | 全双工对话 | 十位数元/月 |
| Qwen-VL（看图问答） | 多模态耳机 + 摄像头 | 按调用 |

## 3. 录音耳机成本

参考 [`06-recorder/03-cost.md`](../06-recorder/03-cost.md)，1 小时端到端约 ¥1–4。

## 4. 待补充

- [ ] BOM 成本结构（蓝牙芯片 + 主控 + Mic + 电池）
- [ ] 不同体量出货量的批发成本
- [ ] 翻译时长包的定价测算
- [ ] 出海市场的多语言成本叠加

---

**版本**：千问大模型方案 · 占位版
**更新日期**：2026-06

<!-- FOOTER:START -->

---

<table width="100%">
<tr>
<td align="left" width="33%">

<a href="02-solution.md">← 🛠️ 技术方案</a>

</td>
<td align="center" width="34%">

<a href="README.md">↑ 返回品类首页</a> · <a href="../../../README.md">🏠 仓库首页</a>

</td>
<td align="right" width="33%">

<a href="04-cases.md">📦 公开案例 →</a>

</td>
</tr>
</table>
<!-- FOOTER:END -->
