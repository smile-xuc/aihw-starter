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

- **只写公开信息**：产品与客户名仅在官网 / 官方商店 / 官方公众号 / 媒体报道已披露时出现
- **客观陈述**：不评价优劣，只记形态、技术路线、可观察事实；不写「首个 / 最强 / 唯一」
- **数字有出处**：价格、销量等用公开口径，附链接与查证日期；查不到标「待核实」；不写转化率 / ARPU / 私下报价
- **与 awesome 的关系**：有商业产品卡的案例用「另见」互链；提交规范见 [CONTRIBUTING.md](../../../CONTRIBUTING.md)

---

## 二、产品横评

| 产品 | 厂商 | 形态 | 大模型 / Agent（公开） | 核心交互 | 参考价（公开） | 状态（公开） |
|---|---|---|---|---|---|---|
| **Rabbit R1** | rabbit inc. | 口袋助手 | rabbitOS / LAM + 第三方 Agent | 语音 + 触屏 + 推送说话 | **$199 / 无订阅** | 在售（官网） |
| **Humane AI Pin** | Humane | 胸针可穿戴 | CosmOS + 云端 AI | 投影 + 语音 | 首发价 US$699（2024-04）→ 2024-10 降至 US$499（Eclipse）+ US$24/月 | **2025-02 停售** |
| **Limitless Pendant** | Limitless（Meta 收购） | 记忆挂件 | 云端转录 / 记忆 | 常开麦 | 硬件加订阅，另见 [Limitless 主卡][pendant] | **2025-12 停售新客** |
| **铠盒 AIBOX-A1** | 铠盒智能 | 桌面 Agent 盒 | 本地轻量 + 云端千问等 | 常开盒子 / OpenClaw | **¥1,199 CNY** · [产品页](https://agentaibox.com/products/a1) · 查证 2026-09-30 | 公开在售页 |
| **SwitchBot AI Hub** | SwitchBot | 桌面家庭中枢 | 商品页写 Vision Language Model，未写模型名 | 摄像头理解后联动设备 | **$259.99 USD** · [美国商品页](https://us.switch-bot.com/products/switchbot-ai-hub) · 查证 2026-09-30 | 在售（美国官方商店、欧盟官方商店、英国官方商店，查证 2026-09-30） |
| **Sandbar Stream** | Sandbar | 语音戒指 | 未公开 | 按住说话 | 预购价 **$249 USD** · [官方商店](https://shop.sandbar.com/) · 查证 2026-09-30 | 预售（官方商店，查证 2026-09-30） |
| **Pebble Index 01** | Core Devices / Pebble | 语音备忘戒指 | 博客写端侧大模型，未写模型名 | 一键录音，手机上选动作 | 预购价 **$75 USD** · [产品页](https://repebble.com/index) · 查证 2026-09-30 | 预售（官网；新订单 1–2 个月发货，查证 2026-10-01） |

### 形态路线图

```
     口袋入口                    常开中枢                 记忆挂件
  (轻硬件 / 无订阅叙事)      (NPU 盒 / 本地优先)      (极简麦 / 订阅或收购风险)
         │                         │                        │
      Rabbit R1               铠盒 A1 等              Humane / Limitless
```

---

## 三、关键案例速览

### 案例：Rabbit R1（rabbit inc.）— 无订阅口袋助手

- **公开信息源**：[Rabbit R1](https://www.rabbit.tech/rabbit-r1) · [2024 Q1 更新](https://www.rabbit.tech/newsroom/quarterly-update-2024-q1)（查证 2026-09-30）。产品页写 $199、no subscription。Q1 更新写售出超过 10 万台
- **亮点**：Teenage Engineering 工业设计；语音入口；后续加入第三方 Agent / DLAM 等能力
- **可借鉴点**：「硬件买断 + 无聊天月费」是本品类少数仍在公开售卖的清晰叙事；进阶能力可 BYOK
- **另见**：[Rabbit 商业产品卡][hw]

### 案例：Humane AI Pin（Humane）— 强制订阅失败样本〔已停售〕

- **公开信息源**：[The Verge](https://www.theverge.com/news/614883/humane-ai-hp-acquisition-pin-shutdown)、[TechCrunch](https://techcrunch.com/2025/02/18/humanes-ai-pin-is-dead-as-hp-buys-startups-assets-for-116m/)
- **亮点**：2025-02 停售；资产约 $116M 售予 HP；设备云服务关闭后核心 AI 能力不可用
- **可借鉴点**：高客单 + 强制月费 + 云依赖，断服即变砖；做 Agent 硬件必须设计离线降级与退出策略
- **另见**：[Humane 商业产品卡][hw]

### 案例：Limitless Pendant（Limitless → Meta）— 品类被大厂吸收〔另见 07〕〔已停售〕

- **公开信息源**：[TechCrunch](https://techcrunch.com/2025/12/05/meta-acquires-ai-device-startup-limitless/)、[limitless.ai](https://www.limitless.ai/)
- **亮点**：2025-12 Meta 收购；停售新客；存量免费 Unlimited；多地区服务收缩
- **可借鉴点**：记忆挂件赛道收购风险高；方案商勿把「唯一云」绑死在单一初创后端
- **另见**：[Limitless 商业产品卡][pendant]

### 案例：铠盒 AIBOX-A1（铠盒智能）— 国内桌面盒公开 SKU

- **公开信息源**：[产品页](https://agentaibox.com/products/a1)（查证 2026-09-30）
- **亮点**：RK3576、约 6 TOPS、4GB/64GB、零售 ¥1,199 CNY（[产品页](https://agentaibox.com/products/a1)，查证 2026-09-30）；本地轻量模型 + 云端大模型；常开低功耗
- **可借鉴点**：桌面中枢叙事（7×24、隐私、开箱即用）比「替代手机」更容易落地
- **另见**：[铠盒商业产品卡][hw]

### 案例：SwitchBot AI Hub（SwitchBot）— 家庭 Agent 中枢

- **公开信息源**：[美国商品页](https://us.switch-bot.com/products/switchbot-ai-hub) · [欧盟商品页](https://eu.switch-bot.com/products/switchbot-ai-hub) · [英国商品页](https://uk.switch-bot.com/products/switchbot-ai-hub) · [AI+ 服务协议](https://us.switch-bot.com/pages/ai-plus-user-agreement)（查证 2026-09-30）
- **形态**：桌面中枢。商品页写可接 SwitchBot 摄像头、门铃和第三方 RTSP，并写兼容 Frigate
- **技术路线**：商品页原文 "Powered by a Vision Language Model (VLM)"，规格写 "6T local computing power" 与 "local VLM automation"。协议写触发事件时摄像机会把部分图像加密上传云端。未写具体模型名
- **亮点**：可在设备上安装 Home Assistant，并带 Matter Bridge。VLM 服务 1 个月免费，之后 $4.99 USD/月
- **公开数据**：美国 $259.99 USD，欧盟 €259.99 EUR，英国 £259.99 GBP（查证 2026-09-30）。首发价与 MSRP 待核实。未见公开销量
- **可借鉴点**：摄像头理解与设备联动放在同一中枢，VLM 服务和硬件价分开标
- **另见**：[SwitchBot AI Hub 商业产品卡][hw]

### 案例：Pebble Index 01（Core Devices / Pebble）— 端侧意图路由

- **公开信息源**：[产品页](https://repebble.com/index) · [发布博客](https://repebble.com/blog/meet-pebble-index-01-external-memory-for-your-brain)（查证 2026-09-30） · [量产博客](https://repebble.com/blog/index-01-is-in-mass-production)（查证 2026-10-01）
- **形态**：戒指，一个按键加麦克风。产品页写电池可用数年、不用充电，防水 1 m
- **技术路线**：博客写录音传到手机后，用开源语音转文字，再由端侧大模型选择动作（建笔记、加提醒等）。另有可选云端语音转文字。博客写 Pebble App 开源
- **亮点**：博客写支持 iPhone 与 Android。产品页写 no subscription
- **公开数据**：产品页写预购价 $75 USD，并写 "After pre-orders, price will go up to $99"。规格表写 "Starts shipping March 2026"。产品页写 "New orders ship in 1-2 months"。已开始发货。官方博客写首批订单 2026-07 底发货 · [量产博客](https://repebble.com/blog/index-01-is-in-mass-production)（查证 2026-10-01）
- **可借鉴点**：动作选择放在手机端侧。本仓 [`demo/intent-router/`](./demo/intent-router/) 是离线分流示例
- **另见**：[Pebble Index 01 商业产品卡][hw]

---

## 四、开源 / 自建验证

| 项目 | 特点 | 链接 |
|---|---|---|
| 意图路由 demo（本仓） | 离线可跑的 local/cloud/hybrid 分流 | [`demo/intent-router/`](./demo/intent-router/) |
| 小智 AI | ESP32 语音入口，多模型路由（偏玩具/桌宠，可作入口参考） | [小智仓库](https://github.com/78/xiaozhi-esp32) |

开源适合 2–4 周跑通「会路由、会调工具」；量产前须补：工具审计、二次确认、云费管控、断服降级。

---

## 五、待补充清单（欢迎 PR）

- [ ] 更多国内桌面 Agent 盒公开 SKU（须附官网价）
- [ ] 车载外挂盒公开方案
- [ ] DFRobot AI 智能体盒子正式定价后补卡
- [ ] Muse Charm（Meta）：2026-09-23 在 Meta Connect 2026 发布，未开售；正式定价或开售后补卡 · 官方来源 [The Biggest News From Connect 2026（2026-09-24）](https://about.fb.com/news/2026/09/the-biggest-news-from-connect-2026/)（查证 2026-10-02）
- [x] SwitchBot AI Hub（出海公开价）
- [x] Pebble Index 01（端侧意图路由）

补充位置：本品类本页，或 [awesome/commercial-products/by-category/04-agent-hardware.md][hw]。

---

[hw]: ../../../awesome/commercial-products/by-category/04-agent-hardware.md
[pendant]: ../../../awesome/commercial-products/by-category/07-recorder.md

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
