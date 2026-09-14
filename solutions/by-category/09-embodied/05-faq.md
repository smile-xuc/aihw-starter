<!-- HERO:START -->
<div align="center">

<sub><a href="../../../README.md">🏠 aihw-starter</a> &nbsp;›&nbsp; <a href="README.md">🦾 具身智能</a> &nbsp;›&nbsp; <b>❓ 常见问答</b></sub>

# ❓ 具身智能 常见问题

`🦾 具身智能` · `常见问答`

</div>

---
<!-- HERO:END -->

> 本品类高频问题。通用问题见根目录 [`faq.md`](../../../faq.md)。

---

## A. 商业模式

**Q1：具身能不能靠 AI 月费赚钱？**
A：公开市场**未见跑通**的消费向「机器人聊天月费」。工业是项目 + 维保；云 Token 宜摊进交付。见 [`01-business.md`](./01-business.md) 第三节。

**Q2：先做协作臂还是先做人形？**
A：要现金流与 ROI → 先协作臂固定工位。人形适合演示 / 科研 / 融资叙事，不宜作为第一个量产 SKU。

**Q3：和桌宠怎么选？**
A：只要表情舵机陪伴 → [`05-desktop-pet`](../05-desktop-pet/)。需要移动、抓取、力矩级交互 → 具身。

**Q4：订阅做什么包装才可能成立？**
A：远程运维、地图/策略更新、备件包——设备保养心智，而不是 token 账单。

---

## B. 模型与链路

**Q5：VLA 能不能直接上产线？**
A：不建议黑箱直驱关节。推荐混合：VLA/LLM 出技能或位姿目标，底层 Safety Gate 限速限矩。见 [`02-solution.md`](./02-solution.md)。

**Q6：一定要用 Qwen-Robot Suite 三件套吗？**
A：不必。MVP 可用规则路由 + 传统视觉；再按需替换 Nav/Manip。World 适合预演与合成数据，不是第一天上线项。

**Q7：边缘还是云端？**
A：抓取闭环偏边缘（Orin 级）；低频规划 / World 可上云。厂区影像外传要单独做合规。

**Q8：延迟多少算合格？**
A：抓取伺服回路常要求百毫秒内；语言规划允许秒级。把「聊天延迟」和「控制周期」分开设计。

---

## C. 安全与工程

**Q9：Safety Gate 最少做什么？**
A：速度分区、力矩上限、工作空间围栏、急停硬件、未知技能拒绝。demo 见 [`demo/vla-intent-router/`](./demo/vla-intent-router/)。

**Q10：Sim-to-Real 失败怎么办？**
A：接受衰减；用 Domain Randomization、实机失败回放、World 预演过滤高风险动作。不要承诺仿真成功率=实机。

**Q11：多本体怎么复用策略？**
A：统一动作表征 + 每本体标定/残余策略；不要假设一份 checkpoint 零成本迁移。

---

## D. 合规与数据

**Q12：厂区数据能否上传云端训练？**
A：默认按客户合同与等保要求；优先边缘推理与脱敏。涉及人脸/工位影像需单独授权。

**Q13：协作臂要哪些安全标准？**
A：常见讨论 ISO 10218、ISO/TS 15066 等；以目标市场认证清单为准，预留月份级周期。

---

## E. 与千问方案关系

**Q14：品类文档和 `05-qwen-robot.md` 重复吗？**
A：方案文写模型细节与基准；本品类写商业、集成、算账、案例与可跑路由 demo。两者互补。

**Q15：Go2 公开演示是否等于可量产交钥匙？**
A：不等于。演示验证导航可行性；量产还要站点地图、运维、载荷与失效预案。

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
