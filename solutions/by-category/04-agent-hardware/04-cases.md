<!-- HERO:START -->
<div align="center">

<sub><a href="../../../README.md">🏠 aihw-starter</a> &nbsp;›&nbsp; <a href="README.md">🤖 Agent 硬件</a> &nbsp;›&nbsp; <b>📦 公开案例</b></sub>

# 📦 Agent 硬件 公开案例

`🤖 Agent 硬件` · `公开案例`

</div>

---
<!-- HERO:END -->

> 收录已在公开渠道披露过形态与技术路线的代表性产品。
> 不涉及任何客户内部信息。价格与销量均为公开报道量级。

---

## 一、收录原则

- **只写公开信息**：名称仅在官网 / 众筹页 / 媒体报道已披露时出现
- **客观陈述**：不评价优劣，只记形态、路线、可观察事实
- **拒绝营销话术**：不写「全球首款」「业界领先」

---

## 二、产品横评

| 产品 | 厂商 | 形态 | 大模型 / Agent（公开） | 核心交互 | 参考价（公开） | 状态（公开） |
|---|---|---|---|---|---|---|
| **Rabbit R1** | rabbit inc. | 口袋助手 | rabbitOS / LAM + 第三方 Agent | 语音 + 触屏 + 推送说话 | **$199 / 无订阅** | 在售（官网） |
| **Humane AI Pin** | Humane | 胸针可穿戴 | CosmOS + 云端 AI | 投影 + 语音 | 约 $499 + ~$24/月 | **2025-02 停售** |
| **Limitless Pendant** | Limitless（Meta 收购） | 记忆挂件 | 云端转录 / 记忆 | 常开麦 | 曾约 $99 + 订阅 | **2025-12 停售新客** |
| **铠盒 AIBOX-A1** | 铠盒智能 | 桌面 Agent 盒 | 本地轻量 + 云端千问等 | 常开盒子 / OpenClaw | 约 **¥999** | 公开在售页 |

### 形态路线图

```
     口袋入口                    常开中枢                 记忆挂件
  (轻硬件 / 无订阅叙事)      (NPU 盒 / 本地优先)      (极简麦 / 订阅或收购风险)
         │                         │                        │
      Rabbit R1               铠盒 A1 等              Humane / Limitless
```

---

## 三、关键案例速览

### 3.1 Rabbit R1 — 无订阅口袋助手

- **公开信息源**：[rabbit.tech](https://www.rabbit.tech/)；第三方评测（2026）仍报 $199 / no subscription
- **亮点**：Teenage Engineering 工业设计；语音入口；后续加入第三方 Agent / DLAM 等能力
- **可借鉴点**：「硬件买断 + 无聊天月费」是本品类少数仍在公开售卖的清晰叙事；进阶能力可 BYOK

### 3.2 Humane AI Pin — 强制订阅失败样本

- **公开信息源**：[Reuters](https://www.reuters.com/markets/deals/ai-startup-humane-wind-down-wearable-pin-business-sell-assets-hp-2025-02-19/)、[The Verge](https://www.theverge.com/news/614883/humane-ai-hp-acquisition-pin-shutdown)、[TechCrunch](https://techcrunch.com/2025/02/18/humanes-ai-pin-is-dead-as-hp-buys-startups-assets-for-116m/)
- **事实**：2025-02 停售；资产约 $116M 售予 HP；设备云服务关闭后核心 AI 能力不可用
- **可借鉴点**：高客单 + 强制月费 + 云依赖，断服即变砖；做 Agent 硬件必须设计离线降级与退出策略

### 3.3 Limitless Pendant — 品类被大厂吸收

- **公开信息源**：[TechCrunch](https://techcrunch.com/2025/12/05/meta-acquires-ai-device-startup-limitless/)、[limitless.ai](https://www.limitless.ai/)
- **事实**：2025-12 Meta 收购；停售新客；存量免费 Unlimited；多地区服务收缩
- **可借鉴点**：记忆挂件赛道收购风险高；方案商勿把「唯一云」绑死在单一初创后端

### 3.4 铠盒 AIBOX-A1 — 国内桌面盒公开 SKU

- **公开信息源**：[agentaibox.com/products/a1](https://agentaibox.com/products/a1)
- **亮点**：RK3576、约 6 TOPS、4GB/64GB、宣传零售 ¥999；本地轻量模型 + 云端大模型；常开低功耗
- **可借鉴点**：桌面中枢叙事（7×24、隐私、开箱即用）比「替代手机」更容易落地

---

## 四、开源 / 自建验证

| 项目 | 特点 | 链接 |
|---|---|---|
| 意图路由 demo（本仓） | 离线可跑的 local/cloud/hybrid 分流 | [`demo/intent-router/`](./demo/intent-router/) |
| 小智 AI | ESP32 语音入口，多模型路由（偏玩具/桌宠，可作入口参考） | https://github.com/78/xiaozhi-esp32 |

开源适合 2–4 周跑通「会路由、会调工具」；量产前须补：工具审计、二次确认、云费管控、断服降级。

---

## 五、待补充清单（欢迎 PR）

- [ ] 更多国内桌面 Agent 盒公开 SKU（须附官网价）
- [ ] 车载外挂盒公开方案
- [ ] DFRobot AI 智能体盒子正式定价后补卡

补充位置：本品类本页，或 [`awesome/commercial-products/by-category/04-agent-hardware.md`](../../../awesome/commercial-products/by-category/04-agent-hardware.md)。

---

**版本**：千问大模型方案
**更新日期**：2026-09

<!-- FOOTER:START -->

---

<table width="100%">
<tr>
<td align="left" width="33%">

<a href="03-cost.md">← 💰 成本与计费</a>

</td>
<td align="center" width="34%">

<a href="README.md">↑ 返回品类首页</a> · <a href="../../../README.md">🏠 仓库首页</a>

</td>
<td align="right" width="33%">

<a href="05-faq.md">❓ 常见问答 →</a>

</td>
</tr>
</table>
<!-- FOOTER:END -->
