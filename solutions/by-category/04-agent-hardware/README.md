<!-- HERO:START -->
<div align="center">

<sub><a href="../../../README.md">🏠 aihw-starter</a> &nbsp;›&nbsp; <a href="README.md">🤖 Agent 硬件</a> &nbsp;›&nbsp; <b>📖 品类概述</b></sub>

# 📖 Agent 硬件（Agent Hardware）

`🤖 Agent 硬件` · `品类概述`

</div>

---
<!-- HERO:END -->

## 品类概述

**本地运行 / 调度多个 AI Agent 的独立硬件**（口袋助手、桌面盒子、家庭中枢），提供意图路由、工具调用与自动化。客单价常见 500–3000 元（海外约 $99–$499）。代表能力：端侧意图分发 + 云端旗舰推理 + 离线降级。

## 商业化现状（公开信息观察）

- **卖的是「能办事的入口」，不是聊天玩具**：用户为「少掏手机、少点 App」付硬件溢价。
- **订阅已知难跑通**：Humane AI Pin 曾要求约 $24/月，2025-02 停售并被 HP 收购资产；Rabbit R1 公开坚持 **$199 / 无订阅**。
- **壁垒在路由与工具生态**：意图分流、可恢复的工具调用、本地隐私，比堆模型档位更决定留存。

> 📊 详细市场判断 → 见 [01-business.md](./01-business.md)

## 推荐架构（千问大模型版本）

**端侧小模型（意图分发 + 离线兜底）+ 云端旗舰模型（复杂推理）**：

- 端侧规则 / 0.5B 级分类：本地执行 / 上云 / 混合
- 简单任务（定时、设备控制、话术）本地完成
- 复杂推理上云调用 Qwen-Plus / Max，保证质量

> 🛠️ 完整接入步骤 → 见 [02-solution.md](./02-solution.md)

## 成本与计费

- **BOM**：约 150–600 元（SoC + RAM + 存储 + 外设，视量级）
- **云端**：典型用户约 8–15 元/台/月（端云协同后）
- **结论**：毛利敏感点在渠道与云费失控；高频意图必须留端

> 💰 详细测算 → 见 [03-cost.md](./03-cost.md)

## 公开案例与对标

Rabbit R1 / Humane AI Pin / Limitless Pendant / 铠盒 AIBOX-A1 等公开产品。

> 📦 案例清单 → 见 [04-cases.md](./04-cases.md)

## 客户高频问答

- 离线时 Agent 能力降级到什么程度？
- 多 Agent 并发怎么控延迟？
- 订阅为什么难跑通？
- 隐私数据如何不出端？

> ❓ 全部 FAQ → 见 [05-faq.md](./05-faq.md)

## Demo

可运行的意图路由器（离线、无需 API Key）：

> 🧪 [`demo/intent-router/`](./demo/intent-router/) → 见 [demo/README.md](./demo/README.md)

---

**版本**：千问大模型方案（完整版）
**说明**：README + 商业 + 方案 + 算账 + 案例 + FAQ + 可跑 demo。欢迎 PR 补工具 Agent / 离线兜底等后续 demo。

<!-- FOOTER:START -->

---

<table width="100%">
<tr>
<td align="left" width="33%">

<sub>（首篇）</sub>

</td>
<td align="center" width="34%">

<a href="README.md">↑ 返回品类首页</a> · <a href="../../../README.md">🏠 仓库首页</a>

</td>
<td align="right" width="33%">

<a href="01-business.md">💼 商业化分析 →</a>

</td>
</tr>
</table>
<!-- FOOTER:END -->
