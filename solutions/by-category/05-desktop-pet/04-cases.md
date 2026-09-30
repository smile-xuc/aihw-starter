<!-- HERO:START -->
<div align="center">

<sub><a href="../../../README.md">🏠 aihw-starter</a> &nbsp;›&nbsp; <a href="README.md">🪴 桌宠</a> &nbsp;›&nbsp; <b>📦 公开案例</b></sub>

# 📦 桌宠 / 毛绒 公开案例

`🪴 桌宠` · `公开案例`

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

| 产品 | 厂商 | 形态 | 大模型（公开） | 核心交互 | 参考价（公开） |
|---|---|---|---|---|---|
| **Looi** | TangibleFuture | 充电头机器人，手机作屏 | App 集成 LLM / GPT 向对话（公开表述） | 语音 + 肢体 + 手机屏表情 | 众筹早鸟首发价 US$119；现价 LOOI Solo US$239（划线价 US$259）、LOOI Twins US$468（划线价 US$518，查证 2026-09-30） |
| **EMO** | Living.AI | 桌面双足 | 自研情感引擎 + GPT 对话（公开表述） | 表情屏 + 语音 + 自主巡游 + 面部识别 | 现价标准套装 [US$279](https://living.ai/product/emo/)、EMO White [US$289](https://living.ai/product/emo-white/)（查证 2026-09-30）；首发价待核实 |
| **Vector 2.0** | Digital Dream Labs | 履带桌面机器人 | 云端 NLP（自研栈为主） | 语音指令 + 触摸 + 悬崖检测 + 自主探索 | 现价 [US$249.99](https://anki.bot/products/vector-robot) 起（官方店，查证 2026-09-30）；订阅价待核实；首发价待核实 |
| **Eilik** | Energize Lab | 桌面情感机器人 | 本地规则为主（无 LLM 亦可成立） | 触摸 + 表情 + 多机互动 | 现价 [US$139.99](https://store.energizelab.com/products/eilik)（划线价 US$149.99，查证 2026-09-30） |
| **小智 AI** | 开源社区 | ESP32 + 屏 + 舵机 | 千问 / DeepSeek / ChatGPT 等可选 | 语音 + 表情屏 + 舵机 | BOM 约数十元级 |

### 形态路线图

```
         轻硬件                          重硬件
  (低 BOM / 软件定义)              (高自由度 / 传感驱动)
           │                              │
   ┌───────┼───────┐              ┌───────┼───────┐
   │       │       │              │       │       │
  Looi   Eilik  小智 AI          EMO   Vector   Cozmo 系
   │       │       │              │       │       │
   └───┬───┘       │              └───┬───┘       │
       ▼           ▼                  ▼           ▼
  手机复用屏   DIY/开源          独立屏+动力    多传感融合
```

---

## 三、关键案例速览

### 案例：Looi（TangibleFuture）— 充电头上的灵魂

- **公开信息源**：[LOOI 官网商店](https://looirobot.com/products/looi-robot) · [服务条款](https://looirobot.com/policies/terms-of-service) · [Kickstarter](https://www.kickstarter.com/projects/tangiblefuture/looi-robot-turn-your-smartphone-into-a-desktop-robot) · [Hackster](https://www.hackster.io/news/tangiblefuture-s-looi-turns-smartphones-into-ambulatory-companion-robots-with-chatgpt-support-fddc772c62b2)（查证 2026-09-30）
- **亮点**：硬件极简，体验由软件与手机屏定义
- **可借鉴点**：轻 BOM 下「软件 > 堆料」；Realtime 适合作为高体验旗舰选项，而不是白牌标配
- **另见**：[LOOI 商业产品卡][pet]

### 案例：EMO（Living.AI）— 桌面情感宠物标杆

- **公开信息源**：[Living.AI 官网](https://living.ai/emo/) · [EMO 产品页](https://living.ai/product/emo/) · [EMO White](https://living.ai/product/emo-white/)（查证 2026-09-30）
- **技术路线**：本地驱动表情 / 动作 + 云端对话（公开表述含 GPT）
- **亮点**：大量表情动画、桌面自主探索、多模态感知
- **可借鉴点**：表情丰富度与自主行为是桌宠口碑的核心，不是模型参数量
- **另见**：[EMO 商业产品卡][pet]

### 案例：Vector / Cozmo 系（Digital Dream Labs）— 重硬件收藏向

- **公开信息源**：[anki.bot · Vector](https://anki.bot/products/vector-robot) · [Digital Dream Labs](https://www.digitaldreamlabs.com/products/vector-robot)（查证 2026-09-30）。订阅价格待核实
- **亮点**：传感、悬崖检测、自主探索成熟
- **可借鉴点**：重硬件路线 LLM 往往是后装能力；先把物理互动做稳，再叠加云端对话
- **另见**：[Vector 商业产品卡][pet]

### 案例：Eilik（Energize Lab）— 无 LLM 也能成立的情感硬件

- **公开信息源**：[Energize Lab 官方商店](https://store.energizelab.com/products/eilik)（查证 2026-09-30）
- **亮点**：触摸、表情、多机互动，规则引擎即可跑通基础陪伴
- **可借鉴点**：验证「桌宠 ≠ 必须先上大模型」；大模型是增强项，三路反馈才是品类门槛
- **另见**：[Eilik 商业产品卡][pet]

### 案例：小智 AI（开源社区）— 开源全栈参考

- **公开信息源**：[小智仓库](https://github.com/78/xiaozhi-esp32)
- **亮点**：固件 + 服务端 + 社区活跃，支持多家大模型路由
- **可借鉴点**：ESP32-S3 + 云端大模型是桌宠 MVP 的低成本验证路径；量产仍需自建动作表、安全策略与云端成本管控

---

## 四、开源替代（快速验证）

| 项目 | 主控 | 特点 | 链接 |
|---|---|---|---|
| 小智 AI | ESP32-S3 | 中文社区活跃，多模型路由 | [小智仓库](https://github.com/78/xiaozhi-esp32) |
| ESP-AI | ESP32 系列 | Arduino 友好，多云接入 | [esp-ai](https://github.com/wangzongming/esp-ai)（查证 2026-09-30） |
| Talk-to-Fengge | — | WebRTC + 声音克隆架构启发 | 见仓库 [`by-solution/04-talk-to-fengge.md`](../../by-solution/04-talk-to-fengge.md) |

开源适合 2–4 周跑通「会说会动」；量产前须补：动作表与冷却、内容安全、记忆日记后端、BOM 与认证。

---

## 五、待补充清单（欢迎 PR）

- [ ] 国内工位桌宠 / 潮玩品牌公开 SKU（须附官网或媒体链接）
- [ ] 企业定制工位伴侣案例（仅公开可查）
- [ ] 带屏毛绒（IP 向）量产案例

补充位置：本品类本页，或 [awesome/commercial-products/by-category/05-desktop-pet.md][pet]。

---

[pet]: ../../../awesome/commercial-products/by-category/05-desktop-pet.md

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
