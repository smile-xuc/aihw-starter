<!-- HERO:START -->
<div align="center">

<sub><a href="../../README.md">🏠 aihw-starter</a> &nbsp;›&nbsp; <a href="README.md">🪴 桌宠</a> &nbsp;›&nbsp; <b>❓ 常见问答</b></sub>

# ❓ 桌宠 / 毛绒 常见问题（占位版）

`🪴 桌宠` · `常见问答`

</div>

---
<!-- HERO:END -->

> **占位说明**：本页只收录最高频的几个问题，详细 FAQ 待后续版本补充。
> 通用问题见根目录 [`faq.md`](../../faq.md)。

## A. 商业模式

**Q1：桌宠订阅能跑通吗？**
A：截至当前版本，公开市场未见跑通的桌宠 AI 订阅案例。建议把 AI 能力含在硬件价格里（300–1500 元单价已能覆盖云端成本），订阅作为可选增值。

**Q2：桌宠和玩具/陪伴的区别？**
A：判断标准是"是否有动作/表情输出"。纯语音的毛绒走 [`03-toys-companion`](../03-toys-companion/README.md)；带屏幕表情或舵机动作的走桌宠方案，多一层"动作情绪标签"能力。

## B. 技术架构

**Q3：动作和说话能同步吗？**
A：可以。LLM 流式输出后，端侧标签解析器在收到完整标签时触发动作，剩余文本送 TTS。详见 [`02-solution.md`](./02-solution.md) 第 5.3 节"流式标签解析"。

**Q4：标签太多会不会乱？**
A：建议每次回复最多 1 个 emoji + 1 个 action。系统提示词里明确这个约束，否则 LLM 倾向于堆叠标签，端侧动作排队执行体验差。

**Q5：动作堵转怎么处理？**
A：固件层为每个 action 设置最大执行时长，到时强制归位。同一动作设置最小冷却（默认 1 秒）防抖动。

## C. 待补充

- [ ] 不同硬件平台（ESP32、RK 系列、移动 SoC）的动作精度差异
- [ ] 声音克隆在桌宠场景的应用（IP 角色音色）
- [ ] 屏幕表情设计规范与素材生产
- [ ] 多角色切换的端侧实现
- [ ] 离线兜底语料的设计

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

<a href="README.md">↑ 返回品类首页</a> · <a href="../../README.md">🏠 仓库首页</a>

</td>
<td align="right" width="33%">

<a href="demo/README.md">🧪 Demo →</a>

</td>
</tr>
</table>
<!-- FOOTER:END -->
