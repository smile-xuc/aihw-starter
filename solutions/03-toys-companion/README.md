<!-- HERO:START -->
<div align="center">

<sub><a href="../../README.md">🏠 aihw-starter</a> &nbsp;›&nbsp; <a href="README.md">🧸 AI 玩具 / 陪伴</a> &nbsp;›&nbsp; <b>📖 品类概述</b></sub>

# 📖 玩具陪伴（Toys & Companion）

`🧸 AI 玩具 / 陪伴` · `品类概述`

</div>

---
<!-- HERO:END -->

## 品类概述

**毛绒玩具、桌面陪聊娃娃、卡通儿童伴学机** 这一类 200–500 元价位、面向儿童与情感陪伴场景的 AI 硬件。核心特征：以语音对话为主交互、有 IP 形象、续航/无线优先。

## 商业化现状（公开信息观察）

- **AI 渗透率持续上升**，主流毛绒玩具品牌都在加 AI 模块；儿童伴学机已在天猫/抖音形成稳定品类。
- **订阅制目前未跑通**——多数厂商仍在「第一年免费送」或「还没开始正经收费」阶段。
- **硬件 BOM 增量约 20–50 元**（语音 SoC + 麦克风阵列 + 网络模组），整机零售加价 50–100 元属于市场可接受区间。

> 📊 详细市场判断 → 见 [01-business.md](./01-business.md)

## 推荐架构（千问大模型版本）

端侧设备 → 千问全双工对话引擎（多模态交互开发套件） → 业务后端（首次激活认证 / 订阅鉴权 / 内容审核日志拉取）。**业务推理交给客户自己的 Agent**，对话交互层走千问标准链路，双方解耦。

> 🛠️ 完整接入步骤 → 见 [02-solution.md](./02-solution.md)

## 成本与计费

- **BOM 增量**：20–50 元（取决于 SoC 选型与是否带屏）
- **Token 成本**：1000 次完整对话 ≈ 5 元（千问旗舰目录价；轻量模型可压到 1/5）
- **报价口径**：按量付费 / Credit 包 / 畅享包 三选一

> 💰 详细测算 → 见 [03-cost.md](./03-cost.md)

## 公开案例与对标

收录已公开披露技术路线的代表性玩具/陪伴硬件项目，覆盖毛绒陪伴、儿童伴学机、桌面陪聊娃娃三种形态。

> 📦 案例清单 → 见 [04-cases.md](./04-cases.md)

## 客户高频问答

- 没屏幕的纯陪聊玩具还能做吗？
- 毛绒类客单价低，AI 模型成本能覆盖吗？
- 儿童内容安全怎么做？
- 长记忆怎么做才能让陪伴「像真人」？

> ❓ 全部 FAQ → 见 [05-faq.md](./05-faq.md)

## Demo

最小可运行的端侧对话 demo（占位中，后续开放）。

> 🧪 Demo 说明 → 见 [demo/README.md](./demo/README.md)

---

**版本**：千问大模型方案
**期待补充**：豆包、Kimi、智谱、其他模型方案 PR 欢迎，参考 [CONTRIBUTING.md](../../CONTRIBUTING.md) 第一章。

<!-- FOOTER:START -->

---

<table width="100%">
<tr>
<td align="left" width="33%">

<sub>（首篇）</sub>

</td>
<td align="center" width="34%">

<a href="README.md">↑ 返回品类首页</a> · <a href="../../README.md">🏠 仓库首页</a>

</td>
<td align="right" width="33%">

<a href="01-business.md">💼 商业化分析 →</a>

</td>
</tr>
</table>
<!-- FOOTER:END -->
