<!-- HERO:START -->
<div align="center">

<sub><a href="../../../README.md">🏠 aihw-starter</a> &nbsp;›&nbsp; <a href="README.md">🎧 AI 耳机</a> &nbsp;›&nbsp; <b>❓ 常见问答</b></sub>

# ❓ AI 耳机 常见问题（占位版）

`🎧 AI 耳机` · `常见问答`

</div>

---
<!-- HERO:END -->

> **占位说明**：本页只收录最高频的几个问题，详细 FAQ 待后续版本补充。
> 通用问题见根目录 [`faq.md`](../../../faq.md)。

## A. 翻译耳机

**Q1：Livetranslate 比拼接方案慢，为什么还要用？**
A：Livetranslate 是端到端模型，需要积累足够语义上下文才输出，能保证翻译连贯性。拼接方案"听到一句翻一句"，体感快但容易丢上下文。专业同传选 Livetranslate；日常对讲可以用拼接。

**Q2：粤语客户怎么办？**
A：粤语在 Livetranslate 上仅支持文本输出。AR 眼镜场景关 TTS 走字幕；强需求语音输出切到 `Qwen3-Livetranslate` 或 `Qwen3.5-Omni`。

**Q3：能让翻译保持商务正式风格吗？**
A：Livetranslate 是端到端模型，不支持自定义系统提示词。如需风格控制建议走"ASR + qwen-plus 翻译 + TTS"拼接方案。

## B. AI 对话耳机

**Q4：能做"按住说话"的简单交互吗？**
A：能。最小可用版本就是 ASR + LLM + TTS 串行调用。但用户期待的"AI 耳机"通常需要全双工，建议直接走 Qwen-Omni-Realtime。

**Q5：耳机断网怎么办？**
A：当前架构都需要联网，无网络时无法 AI 对话。可以做"离线兜底语料"（预录的常用回复），但智能能力大幅降低。

## C. 录音耳机

参考 [`07-recorder/05-faq.md`](../07-recorder/05-faq.md)。

## D. 通用

**Q6：耳机端 BLE 协议要做哪些适配？**
A：需要传输双向音频流（PCM 16k 或 Opus）。BLE 5.x + LC3 编码是趋势。具体协议设计取决于 SoC 平台。

**Q7：耳机算力限制下能做端侧 ASR 吗？**
A：当前蓝牙耳机 SoC 算力难以跑实用级端侧 ASR。VAD、唤醒词检测可以端侧做，正经 ASR 要送到手机或云端。

## E. 待补充

- [ ] 蓝牙音频协议（A2DP / LE Audio / LC3）的 AI 适配
- [ ] 多设备同步（左右耳 + 手机）的工程实践
- [ ] 续航优化（VAD + 唤醒 + 按需联网）
- [ ] 入耳检测、佩戴检测等 AI 辅助场景

---

**版本**：千问大模型方案 · 占位版
**更新日期**：2026-06

<!-- FOOTER:START -->

---

<table width="100%">
<tr>
<td align="left" width="33%">

<a href="04-cases.md">← 📦 公开案例</a>

</td>
<td align="center" width="34%">

<a href="README.md">↑ 返回品类首页</a> · <a href="../../../README.md">🏠 仓库首页</a>

</td>
<td align="right" width="33%">

<a href="demo/README.md">🧪 Demo →</a>

</td>
</tr>
</table>
<!-- FOOTER:END -->
