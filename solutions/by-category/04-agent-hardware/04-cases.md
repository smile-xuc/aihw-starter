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

### 案例：Muse Gadgets 与 Muse Home Link（Meta）— 平台开放外设

- **公开信息源**：[Muse Gadgets 官网](https://gadgets.muse.ai/) · [Muse Home Link 页](https://gadgets.muse.ai/home-link) · [Gadget SDK Token 条款](https://gadgets.muse.ai/sdk-terms) · [GitHub：facebookincubator/muse-gadget-sdk（commit 3e1d890）](https://github.com/facebookincubator/muse-gadget-sdk/tree/3e1d89073d7cdf4750b3f9a326bc4c76411a23b5) · [Meta 新闻稿：Muse（2026-09-08）](https://about.fb.com/news/2026/09/introducing-muse-personal-ai-agent/) · [Meta 帮助中心：Muse 订阅](https://www.meta.com/help/subscriptions/1021145227643680/)（均查证 2026-10-03）
- **形态**：开源外设 SDK（ESP32 固件 / Linux）＋ Meta 自制家庭网关 Home Link
- **亮点**：外设 SDK 与固件以 Apache 2.0 开源；Home Link 对美国 Muse 订阅用户免费、每人限一台

#### 事实概要

- **开源范围**：Meta 发布 ESP32 Device SDK（固件）与 Linux Device SDK（[Muse Gadgets 官网](https://gadgets.muse.ai/)）；代码在 GitHub 仓库 facebookincubator/muse-gadget-sdk，分 `esp32`、`linux`、`skills` 三个目录（[仓库](https://github.com/facebookincubator/muse-gadget-sdk/tree/3e1d89073d7cdf4750b3f9a326bc4c76411a23b5)）。官网原文 "The device SDKs and firmware are open source under the Apache 2.0 license and provided as-is, without warranty."（[Muse Gadgets 官网](https://gadgets.muse.ai/)）。minimp3 头文件（CC0-1.0）与 `pixel_font.c`（BSD-2-Clause）保留上游许可，Jollybot 头像不在 Apache 许可范围内（[仓库 README](https://github.com/facebookincubator/muse-gadget-sdk/blob/3e1d89073d7cdf4750b3f9a326bc4c76411a23b5/README.md)）
- **仓库时间**：首次提交时间为 2026-10-03 02:21（UTC+8）（[首次提交](https://github.com/facebookincubator/muse-gadget-sdk/commit/7e7123e2815d3e7e3c0f2ca330f576290ae6a6a9)）；截至 commit 3e1d890（2026-10-03 10:18，UTC+8）共 5 个提交（[提交记录](https://github.com/facebookincubator/muse-gadget-sdk/commits/3e1d89073d7cdf4750b3f9a326bc4c76411a23b5)）
- **ESP32 固件**：基于 ESP-IDF v6.0.1（原文 "Other versions aren't supported."），默认目标板 ESP32-C5 DevKitC-1；板卡表另列 ideaspark、Seeed SenseCAP Indicator / SenseCAP Watcher、Seeed reTerminal E1001、Home Assistant Voice Preview Edition、Waveshare AMOLED 圆屏、AIPI Lite、M5Stack StickS3 / StickC Plus2 等；无 PSRAM 的板（经典 ESP32、ESP32-C6）不带家庭网络隧道（[ESP32 README](https://github.com/facebookincubator/muse-gadget-sdk/blob/3e1d89073d7cdf4750b3f9a326bc4c76411a23b5/esp32/README.md)）
- **Linux SDK**：支持带蓝牙的 Raspberry Pi 3B+、4、5、Zero 2 W，以及带 Bluetooth LE 的其他 Linux 电脑；系统为 Raspberry Pi OS Bullseye 及以上、Debian 11 及以上或 Ubuntu 22.04 及以上。配对后 Muse 可在该机器上执行 `system.run`、`file.read`、`file.write`、`device.health` 四类命令，权限与安装时选定的账户相同（[Linux README](https://github.com/facebookincubator/muse-gadget-sdk/blob/3e1d89073d7cdf4750b3f9a326bc4c76411a23b5/linux/README.md)）
- **官方参考形态**（官网 Project Ideas，设备由第三方生产销售）：Raspberry Pi 5（接 Home Assistant 等 Linux 应用）；彩色电子墨水屏（晨报、提醒、购物清单）；插电视 HDMI 口的棒状设备「Muse on your TV」（标 "Coming soon"）；Waveshare ESP32-S3-Touch-AMOLED-1.75C 1.75″ 圆形触屏（按键说话、扬声器与麦克风、电池）；另有 M5Stack StickS3、AiPi Lite、ideaspark 1.9″ 屏、Home Assistant Voice Preview Edition（[Muse Gadgets 官网](https://gadgets.muse.ai/)）。页面不一致：官网电子墨水屏项目写 Seeed reTerminal E1002（彩色）（[Muse Gadgets 官网](https://gadgets.muse.ai/)），仓库板卡表写 Seeed reTerminal E1001（7.5″ 黑白电子纸）（[ESP32 README](https://github.com/facebookincubator/muse-gadget-sdk/blob/3e1d89073d7cdf4750b3f9a326bc4c76411a23b5/esp32/README.md)）
- **SDK Token**：官网与仓库称其为 SDK token，在 gadgets.muse.ai 的 SDK tokens 页申领（[SDK tokens 页](https://gadgets.muse.ai/settings/sdk-tokens)）；原文 "Every gadget needs a token to pair."（[仓库 README](https://github.com/facebookincubator/muse-gadget-sdk/blob/3e1d89073d7cdf4750b3f9a326bc4c76411a23b5/README.md)）。Token 条款写明仅限个人、非商业使用；同一 Token 最多嵌入 50 台提供给他人的设备、最多关联 50 台设备；不得嵌入任何出售、公开上架或用于促销的设备，原文 "You may not embed it in any device that you sell for any payment or other consideration, that you advertise, offer, or list publicly or through any marketplace or application store, or that you provide in connection with any promotion, incentive, or reward."；Meta 可随时暂停或撤回 Token；原文 "The source code license does not grant any right to Gadget SDK Tokens." 与 "Any other distribution requires Meta’s prior written permission."（[Token 条款](https://gadgets.muse.ai/sdk-terms)）
- **Muse Home Link**：Meta 自制的 USB-C 设备，基于 Espressif ESP32-C5（RISC-V 240 MHz），8 MB PSRAM、8 MB flash，Wi-Fi 6（2.4 / 5 GHz），尺寸 35 × 42 × 10 mm。供电：原文 "Connect Home Link to any USB-C or USB-A power source near your router."；通过 Bluetooth LE 在 Muse App 中配网。固件基于开源 ESP32 Device SDK，但原文 "Muse Home Link itself only runs official firmware and can’t be reflashed."（[Home Link 页](https://gadgets.muse.ai/home-link)）
- **Home Link 能控制什么**：接入家庭 Wi-Fi 后，Muse 可访问用户已有的兼容设备，或自建的带本地 HTTP API 的设备；官网称社区技能可让 Muse "turn on a light, control your TV, send a document to a printer, and more, depending on your setup."，列举的集成包括 Philips Hue、Sonos、Apple TV、Google Nest 音箱、Samsung 电视；官网原文 "Skills are built by the community, so they can change or break."，并写不要用于家庭安防、紧急或医疗等安全关键场景（[Home Link 页](https://gadgets.muse.ai/home-link)）
- **社区技能**：仓库 `skills` 目录原文 "Community-sourced skills for using devices with Muse Gadgets. These are not official integrations."；技能是 Markdown 文件，用法是把仓库链接或 `SKILL.md` 发到 Muse 对话中，原文 "Keep skills Markdown-only."（[skills README](https://github.com/facebookincubator/muse-gadget-sdk/blob/3e1d89073d7cdf4750b3f9a326bc4c76411a23b5/skills/README.md)）
- **Home Link 领取条件**：原文 "Free with an active Muse subscription in the United States only, limit one per subscriber. Ships in October, first come, first served."（月份原文，年份待核实）；领取只是排队，原文 "Claiming holds your place in line; it isn’t an order."（[Home Link 页](https://gadgets.muse.ai/home-link)）
- **Home Link 首批数量**：待核实
- **Home Link 状态**：接受领取登记，官网写可发货时再通知（gadgets.muse.ai Home Link 页，查证 2026-10-03）（[Home Link 页](https://gadgets.muse.ai/home-link)）

#### 技术路线

- **连接方式（Agent 与数据在云端 VM）**：Meta 新闻稿（2026-09-08）写 Muse 由 Muse Spark 模型驱动，运行在 Muse Secure VM，原文 "a dedicated, virtual machine (VM) that houses both the agent and a person’s data"，并写 "Muse runs on its own dedicated computer in the cloud"（[Meta 新闻稿：Muse](https://about.fb.com/news/2026/09/introducing-muse-personal-ai-agent/)）。外设一侧，Linux 设备 "holds an encrypted Noise session to the user's Muse VM and runs the commands Muse sends it."（[linux/AGENTS.md](https://github.com/facebookincubator/muse-gadget-sdk/blob/3e1d89073d7cdf4750b3f9a326bc4c76411a23b5/linux/AGENTS.md)）；ESP32 固件 "holds an encrypted Noise session to a VM, with an optional home-network tunnel"（[esp32/AGENTS.md](https://github.com/facebookincubator/muse-gadget-sdk/blob/3e1d89073d7cdf4750b3f9a326bc4c76411a23b5/esp32/AGENTS.md)）
- **配对**：外设通过 Bluetooth LE 与手机上的 Muse App 配对；ESP32 板需按设备上的按键确认（[ESP32 README](https://github.com/facebookincubator/muse-gadget-sdk/blob/3e1d89073d7cdf4750b3f9a326bc4c76411a23b5/esp32/README.md)），Linux 机器由 App 内确认代替（树莓派无按键）（[linux/AGENTS.md](https://github.com/facebookincubator/muse-gadget-sdk/blob/3e1d89073d7cdf4750b3f9a326bc4c76411a23b5/linux/AGENTS.md)）。每次配对新建加密会话；社区设备没有厂商校验，无法防止主动中间人攻击，官方建议在可信网络中配对（[ESP32 README](https://github.com/facebookincubator/muse-gadget-sdk/blob/3e1d89073d7cdf4750b3f9a326bc4c76411a23b5/esp32/README.md)）
- **鉴权**：构建或安装时写入 SDK token（`mgst_` 前缀）（[esp32/AGENTS.md](https://github.com/facebookincubator/muse-gadget-sdk/blob/3e1d89073d7cdf4750b3f9a326bc4c76411a23b5/esp32/AGENTS.md)）；配对后设备保存设备 token，连接时在 `Authorization` 头里带每台 VM 的 bearer 凭据，升级被拒（401 / 403）时须重新获取 VM 凭据（[linux/AGENTS.md](https://github.com/facebookincubator/muse-gadget-sdk/blob/3e1d89073d7cdf4750b3f9a326bc4c76411a23b5/linux/AGENTS.md)）。Token 随固件发出，应视为标识而非密码，官方建议开启 NVS 加密（[ESP32 README](https://github.com/facebookincubator/muse-gadget-sdk/blob/3e1d89073d7cdf4750b3f9a326bc4c76411a23b5/esp32/README.md)）
- **传输**：连接 `wss://<noise_host>/v1/noise?vm_id=<vm_id>`，完成 Noise XX 握手后，打开长连接 `POST /link-control`，双向传 JSON 消息（每条前加 little-endian u32 长度）：设备发 `link.register`，对每个 `link.invoke` 回 `link.result`；设备主动发给 Muse 的消息走同一会话上的 `POST /chat/stream`；VM 单条消息上限 256 KB（[linux/AGENTS.md](https://github.com/facebookincubator/muse-gadget-sdk/blob/3e1d89073d7cdf4750b3f9a326bc4c76411a23b5/linux/AGENTS.md)）
- **用 AI 编程助手开发**：仓库在 `esp32/`、`linux/` 和 `esp32/devices/` 提供供编程 Agent 读取的 `AGENTS.md`（[esp32/AGENTS.md](https://github.com/facebookincubator/muse-gadget-sdk/blob/3e1d89073d7cdf4750b3f9a326bc4c76411a23b5/esp32/AGENTS.md) · [linux/AGENTS.md](https://github.com/facebookincubator/muse-gadget-sdk/blob/3e1d89073d7cdf4750b3f9a326bc4c76411a23b5/linux/AGENTS.md) · [esp32/devices/AGENTS.md](https://github.com/facebookincubator/muse-gadget-sdk/blob/3e1d89073d7cdf4750b3f9a326bc4c76411a23b5/esp32/devices/AGENTS.md)）。页面不一致：README 原文 "Each directory has a `README.md` to get started and an `AGENTS.md` for coding agents"（[仓库 README](https://github.com/facebookincubator/muse-gadget-sdk/blob/3e1d89073d7cdf4750b3f9a326bc4c76411a23b5/README.md)），`skills/` 目录下没有 `AGENTS.md`（[skills 目录](https://github.com/facebookincubator/muse-gadget-sdk/tree/3e1d89073d7cdf4750b3f9a326bc4c76411a23b5/skills)）。官方称 Muse Code 读取 `AGENTS.md` 后可完成工具链安装、为目标板编译、烧录和读日志，并以「为我的板子加支持」作为示例指令；原文 "Any agent that reads `AGENTS.md` can build and flash from this repository."（[ESP32 README](https://github.com/facebookincubator/muse-gadget-sdk/blob/3e1d89073d7cdf4750b3f9a326bc4c76411a23b5/esp32/README.md)）。「让 AI 编程助手读协议并生成驱动」：官方文档未见此表述，待核实

#### 商业模式

- **分工**：Muse（Agent 与模型）由 Meta 提供；外设 SDK 与固件以 Apache 2.0 开源，开发者自行选板、做外设（[Muse Gadgets 官网](https://gadgets.muse.ai/)）。Token 条款限定个人、非商业使用，不得把 Token 嵌入出售的设备（[Token 条款](https://gadgets.muse.ai/sdk-terms)）
- **订阅与地区**：Muse 免费使用有额度上限；付费方案为 Power（$20/月，每周 500M Muse tokens）与 Maximum（$100/月，每周 3B Muse tokens）；Muse 与订阅仍在 "limited testing"，未在所有地区开放（[Meta 帮助中心：Muse 订阅](https://www.meta.com/help/subscriptions/1021145227643680/)）。Meta 新闻稿（2026-09-29）称 Muse 是 "a personal AI agent available in the US and Canada"（[Meta 新闻稿：Muse for Small Business](https://about.fb.com/news/2026/09/introducing-muse-small-business/)）
- **Home Link**：仅对美国有效 Muse 订阅用户免费，每位订阅用户限领一台（[Home Link 页](https://gadgets.muse.ai/home-link)）；官方未写单独售价
- **对照：Humane**：HP 新闻稿（2025-02-18）写 HP 与 Humane 签署最终协议，收购其 AI 平台 Cosmos、技术团队与 300 余项专利及专利申请，原文 "The $116 million transaction is expected to close at the end of this month."（[HP 新闻稿](https://www.hp.com/us-en/newsroom/press-releases/2025/hp-accelerates-ai-software-investments-to-transform-the-future-of-work.html)）。商业产品卡见 [Humane AI Pin][hw]

#### 可借鉴点：对国内团队的借鉴（分析（编者））

- **分工反转**：Muse 由平台提供 Agent 与模型、开源外设 SDK，外设形态交给开发者决定；硬件团队不必自研整机也能接入现成 Agent。国内团队可以选两种位置：做平台方，开放自家 Agent 的外设协议；或做外设方，基于已有平台快速出形态
- **外设轻量化**：ESP32 外设主要负责配对、鉴权和传输，Linux SDK 另可执行平台下发的命令；Agent 运行在云端 VM，ESP32 级别的主控也能成为 Agent 入口；代价是体验依赖网络和平台服务
- **面向编程 Agent 的文档**：仓库提供 `AGENTS.md`，适配新板卡可以交给编程 Agent 完成。国内团队开放 SDK 时，可以同时提供这类给编程 Agent 读的说明，降低第三方适配成本
- **官方外设与订阅绑定**：Home Link 只对订阅用户免费发放。编者推断，其作用是把订阅延伸到家庭设备控制场景（官方未说明动机）；采用「订阅送硬件」时，需要测算硬件成本由订阅收入摊销的周期
- **技能层承载集成**：设备集成写成社区技能，不写进固件，新增集成不需要改硬件；官方同时声明这些技能不是官方集成、可能失效，可见这一层的质量责任需要事先界定
- **与 AI Pin 的路线对照**：AI Pin 的形态是「胸针可穿戴，投影 + 语音」（见 [Humane AI Pin 商业产品卡][hw]）；Muse 先有 Agent 和订阅，再开放外设、由开发者决定形态。两条路线的差别在于硬件投入和风险由谁承担

#### 风险（分析（编者））

- **平台依赖**：Token 条款限个人、非商业使用，Meta 可随时暂停或撤回 Token；按现行条款，出售嵌入 Token 的设备被明确禁止；条款规定的其他分发需事先取得 Meta 书面许可
- **网络与延迟**：Agent 在云端 VM，外设离线时能做什么取决于固件本身；控制家电时需要考虑断网降级
- **数据合规**：设备指令和数据经用户的云端 VM 处理；在国内面向用户提供服务时，数据出境需要按相关法规评估
- **地区可用性**：官方写 Muse 在美国和加拿大可用，未列中国大陆（待核实）；国内团队现阶段以借鉴架构为主，不直接接入
- **许可边界**：源码采用 Apache 2.0，不等于可以把 Muse 服务接入商业产品；Token 使用权由单独条款约束，部分第三方文件和 Jollybot 形象不在 Apache 许可范围内
- **上游变动**：仓库首次提交为 2026-10-03（UTC+8），当天就有多次更新；接口和支持的板卡可能变化，本案例按查证时的 commit 引用

#### 来源

- Muse Gadgets 官网：[gadgets.muse.ai](https://gadgets.muse.ai/) · 查证 2026-10-03
- Muse Home Link 页：[gadgets.muse.ai/home-link](https://gadgets.muse.ai/home-link) · 查证 2026-10-03
- Muse Gadget SDK Token Terms of Use：[gadgets.muse.ai/sdk-terms](https://gadgets.muse.ai/sdk-terms) · 查证 2026-10-03
- SDK tokens 页：[gadgets.muse.ai/settings/sdk-tokens](https://gadgets.muse.ai/settings/sdk-tokens) · 查证 2026-10-03
- GitHub 仓库 facebookincubator/muse-gadget-sdk（commit 3e1d890）：[仓库](https://github.com/facebookincubator/muse-gadget-sdk/tree/3e1d89073d7cdf4750b3f9a326bc4c76411a23b5) · 查证 2026-10-03
- 仓库首次提交：[commit 7e7123e](https://github.com/facebookincubator/muse-gadget-sdk/commit/7e7123e2815d3e7e3c0f2ca330f576290ae6a6a9) · 查证 2026-10-03
- 仓库提交记录（截至 commit 3e1d890）：[commits](https://github.com/facebookincubator/muse-gadget-sdk/commits/3e1d89073d7cdf4750b3f9a326bc4c76411a23b5) · 查证 2026-10-03
- 仓库 README：[README.md](https://github.com/facebookincubator/muse-gadget-sdk/blob/3e1d89073d7cdf4750b3f9a326bc4c76411a23b5/README.md) · 查证 2026-10-03
- ESP32 Device SDK README：[esp32/README.md](https://github.com/facebookincubator/muse-gadget-sdk/blob/3e1d89073d7cdf4750b3f9a326bc4c76411a23b5/esp32/README.md) · 查证 2026-10-03
- ESP32 AGENTS.md：[esp32/AGENTS.md](https://github.com/facebookincubator/muse-gadget-sdk/blob/3e1d89073d7cdf4750b3f9a326bc4c76411a23b5/esp32/AGENTS.md) · 查证 2026-10-03
- ESP32 板卡 AGENTS.md：[esp32/devices/AGENTS.md](https://github.com/facebookincubator/muse-gadget-sdk/blob/3e1d89073d7cdf4750b3f9a326bc4c76411a23b5/esp32/devices/AGENTS.md) · 查证 2026-10-03
- Linux Device SDK README：[linux/README.md](https://github.com/facebookincubator/muse-gadget-sdk/blob/3e1d89073d7cdf4750b3f9a326bc4c76411a23b5/linux/README.md) · 查证 2026-10-03
- Linux AGENTS.md：[linux/AGENTS.md](https://github.com/facebookincubator/muse-gadget-sdk/blob/3e1d89073d7cdf4750b3f9a326bc4c76411a23b5/linux/AGENTS.md) · 查证 2026-10-03
- 社区技能目录：[skills/](https://github.com/facebookincubator/muse-gadget-sdk/tree/3e1d89073d7cdf4750b3f9a326bc4c76411a23b5/skills) · 查证 2026-10-03
- 社区技能说明：[skills/README.md](https://github.com/facebookincubator/muse-gadget-sdk/blob/3e1d89073d7cdf4750b3f9a326bc4c76411a23b5/skills/README.md) · 查证 2026-10-03
- Meta 新闻稿 Introducing Muse（2026-09-08）：[about.fb.com](https://about.fb.com/news/2026/09/introducing-muse-personal-ai-agent/) · 查证 2026-10-03
- Meta 新闻稿 Muse for Small Business（2026-09-29）：[about.fb.com](https://about.fb.com/news/2026/09/introducing-muse-small-business/) · 查证 2026-10-03
- Meta 帮助中心 About Muse subscriptions：[meta.com/help](https://www.meta.com/help/subscriptions/1021145227643680/) · 查证 2026-10-03
- HP 新闻稿 HP Accelerates AI Software Investments to Transform the Future of Work（2025-02-18）：[hp.com](https://www.hp.com/us-en/newsroom/press-releases/2025/hp-accelerates-ai-software-investments-to-transform-the-future-of-work.html) · 查证 2026-10-03

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
