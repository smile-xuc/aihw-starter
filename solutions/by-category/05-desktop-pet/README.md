<!-- HERO:START -->
<div align="center">

<sub><a href="../../../README.md">🏠 aihw-starter</a> &nbsp;›&nbsp; <a href="README.md">🪴 桌宠</a> &nbsp;›&nbsp; <b>📖 品类概述</b></sub>

# 📖 桌宠（Desktop Pet）

`🪴 桌宠` · `品类概述`

</div>

---
<!-- HERO:END -->

## 品类概述

**带屏幕情绪表达 + 舵机肢体动作 + AI 对话** 的桌面陪伴设备。客单价常见 199–2000 元，面向工位 / 床头 / 潮玩场景。代表能力：表情屏 + 舵机摆头挥手 + 语音播报三路同步。

## 商业化现状（公开信息观察）

- **卖的是摆件体验，不是 AI 功能包**：购买心智接近工艺品 / IP 周边 / 工位礼品。
- **壁垒在交互细节**：动作表情情绪三路同步与表情素材，比堆模型档位更决定口碑。
- **订阅已知未跑通**——主流是硬件买断，云端成本摊进售价；记忆日记是下一阶段黏性方向。

> ⚖️ **合规提示**：2026 年 7 月 15 日起施行的《人工智能拟人化互动服务管理暂行办法》将「持续性情感互动服务」纳入监管，桌宠直接适用。核心义务：算法备案 + 上线前安全评估、AI 身份标识、超 2 小时使用提醒、不得以诱导沉迷依赖为服务目标；面向未成年人另有虚拟亲密关系禁令与未成年人模式。详见 [05-faq.md](./05-faq.md) E 节与根目录 [faq.md](../../../faq.md) Q22.1。

> 📊 详细市场判断 → 见 [01-business.md](./01-business.md)

## 推荐架构（千问大模型版本）

LLM 一次推理同时输出 **文字回复 + 情绪标签 + 动作标签**（如 `<M>happy</M>[emoji-01][action-04]太棒啦！`），端侧流式解析后并行驱动屏幕表情、舵机动作、TTS 播报。

> 🛠️ 完整接入步骤 → 见 [02-solution.md](./02-solution.md)

## 成本与计费

- **BOM**：约 70–200 元（屏 + 舵机 + 麦 + 主控，视量级）
- **云端**：中度互动约 1–4 元/台/月量级（三段式 flash/plus）；Realtime 仅高客单评估
- **结论**：毛利敏感点在渠道与开模，不在 token

> 💰 详细测算 → 见 [03-cost.md](./03-cost.md)

## 公开案例与对标

Looi / EMO / Vector / Eilik / 小智 AI 等公开产品与开源参考。

> 📦 案例清单 → 见 [04-cases.md](./04-cases.md)

## 客户高频问答

- 订阅能不能跑通？
- 动作 + 情绪 + TTS 三路怎么同步？
- 要不要上 Realtime？
- 拟人化互动新规怎么适用？

> ❓ 全部 FAQ → 见 [05-faq.md](./05-faq.md)

## Demo

可运行的流式标签解析器（离线、无需 API Key）：

> 🧪 [`demo/stream-tag-parser/`](./demo/stream-tag-parser/) → 见 [demo/README.md](./demo/README.md)

---

**版本**：千问大模型方案（完整版）
**说明**：README + 商业 + 方案 + 算账 + 案例 + FAQ + 可跑 demo。欢迎 PR 补表情映射 / 舵机驱动等后续 demo。

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
