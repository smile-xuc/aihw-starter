<!-- HERO:START -->
<div align="center">

<sub><a href="../../../README.md">🏠 aihw-starter</a> &nbsp;›&nbsp; <a href="README.md">⌚ 智能手表</a> &nbsp;›&nbsp; <b>❓ 常见问答</b></sub>

# ❓ 智能手表 常见问题

`⌚ 智能手表` · `常见问答`

</div>

---
<!-- HERO:END -->

> 通用问题见根目录 [`faq.md`](../../../faq.md)。

---

## A. 商业与订阅

**Q1：健康建议能不能当医嘱？**
A：不能。必须标注非诊疗建议；异常只建议就医。见 [`02-solution.md`](./02-solution.md)。

**Q2：订阅能跑通吗？**
A：海外 Oura / WHOOP 有公开跑通样本；国内多见硬件主收 + 会员增值（华为活力人生 15 元/月）。强制「不订阅就不能看基础数据」在国内需谨慎。见 [`01-business.md`](./01-business.md)。

**Q3：和 Agent 硬件怎么选？**
A：主价值是体征监测与解读 → 本品类；主价值是办事 / 控设备 → [`04-agent-hardware`](../04-agent-hardware/)。

**Q4：日报免费 + 深度报告付费行不行？**
A：可行，且与 token 成本匹配（月云端约毛毛钱）。关键是报告是否真有增量洞察。

---

## B. 链路与成本

**Q5：用 flash 还是 plus？**
A：日报 flash；深度周报 plus。见 [`03-cost.md`](./03-cost.md)。

**Q6：要不要把原始 PPG 波形送给 LLM？**
A：不要。只传聚合指标，降隐私与 token 成本。

**Q7：告警延迟要求？**
A：日报可异步；危险告警建议队列秒～三十秒级，并本地先阈值判断再上云润色。

**Q8：demo 如何跑？**
A：`cd demo/metrics-prompt && python3 health_metrics_prompt.py --metrics sample_day.json`

---

## C. 合规

**Q9：能写「诊断房颤」吗？**
A：未获相应器械与宣传资质前，不能。即使用了 ECG，文案也只能走合规后的官方表述。

**Q10：未成年人数据？**
A：健康数据属敏感个人信息，需监护同意与最小化；多数研究功能公开声明不适用于未满 18 岁。

**Q11：跨境存储？**
A：国内用户健康数据优先国内云；详见根 faq 跨境条款。

**Q12：Fitness+ 算不算 AI 健康订阅？**
A：它是课程生态订阅，不是「解锁传感器」。对标时不要混为一谈。

---

**版本**：千问大模型方案
**更新日期**：2026-09

<!-- FOOTER:START -->

---

<table width="100%">
<tr>
<td align="left" width="33%"><a href="04-cases.md">← 📦 公开案例</a></td>
<td align="center" width="34%"><a href="README.md">↑ 返回品类首页</a> · <a href="../../../README.md">🏠 仓库首页</a></td>
<td align="right" width="33%"><a href="demo/README.md">🧪 Demo →</a></td>
</tr>
</table>
<!-- FOOTER:END -->
