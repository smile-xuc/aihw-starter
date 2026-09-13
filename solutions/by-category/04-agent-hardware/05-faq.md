<!-- HERO:START -->
<div align="center">

<sub><a href="../../../README.md">🏠 aihw-starter</a> &nbsp;›&nbsp; <a href="README.md">🤖 Agent 硬件</a> &nbsp;›&nbsp; <b>❓ 常见问答</b></sub>

# ❓ Agent 硬件 常见问题

`🤖 Agent 硬件` · `常见问答`

</div>

---
<!-- HERO:END -->

> 本品类高频问题。通用问题（账号、API-KEY、跨境等）见根目录 [`faq.md`](../../../faq.md)。

---

## A. 商业模式与订阅

**Q1：Agent 硬件能靠聊天月费跑通吗？**
A：公开市场**高风险**。Humane AI Pin（约 $499 + ~$24/月）已于 2025-02 停售；Rabbit R1 公开坚持 $199 / 无订阅。建议云端成本内嵌或 BYOK；若做订阅，包装为备份 / 多设备同步 / 高级工具额度。详见 [`01-business.md`](./01-business.md) 第三节。

**Q2：和桌宠怎么选？**
A：要表情 / 动作陪伴 → [`05-desktop-pet`](../05-desktop-pet/)；要自然语言办事、控设备、多步工具 → 本品类。

**Q3：没有工具生态能不能做？**
A：不建议。没有可演示的工具闭环，用户会觉得「就是个贵聊天壳」。决策树见 [`01-business.md`](./01-business.md) 第五节。

**Q4：BYOK 好不好？**
A：能降厂商云费，适合极客向；渠道礼品款仍需「开箱即用」的内嵌额度。

---

## B. 模型与链路

**Q5：默认用 flash 还是 plus？**
A：本地热路径用规则 / 小模型；上云开放域用 `qwen-plus`，控成本用 `qwen-flash`。不要默认 max。测算见 [`03-cost.md`](./03-cost.md)。

**Q6：要不要上 Realtime？**
A：只有语音是主体验、客单吃得下音频时长成本时再评估。多数 Agent 盒以「意图 → 工具结果」为主，三段式足够。

**Q7：多 Agent 并发延迟怎么控？**
A：高频意图硬编码快速路径；长尾再走 ReAct。限制并行工具数，避免规划阶段叠延迟。见 [`02-solution.md`](./02-solution.md)。

---

## C. 端侧与离线

**Q8：离线时能力降级到什么程度？**
A：设备控制、定时、本地话术 / 轻量问答应可用；开放域复杂推理不可用，须明确提示用户。见 demo [`intent-router`](./demo/intent-router/)。

**Q9：意图路由用规则还是小模型？**
A：量产建议**规则优先 + 小模型兜底**：热路径零延迟、可测试；长尾再分类。本仓 demo 用关键词规则演示三分法。

**Q10：隐私数据如何不出端？**
A：`local` 路径不上云原文；云端只传完成任务所需的最小上下文；工具审计日志留本地。

---

## D. 安全与合规

**Q11：控门锁 / 支付类指令怎么处理？**
A：必须二次确认；危险工具默认关闭或白名单。不要让 LLM 直接执行不可逆动作。

**Q12：云服务停了设备会变砖吗？**
A：Humane / Limitless 公开事件表明会。量产必须保留离线降级与数据导出；合同与售后话术要写清断服策略。

**Q13：和录音挂件是一类吗？**
A：记忆挂件偏 [`07-recorder`](../07-recorder/) 边界；若主价值是「常开麦 → 回忆」，不要硬标 Agent 中枢。

---

**版本**：千问大模型方案
**更新日期**：2026-09

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
