<!-- HERO:START -->
<div align="center">

<sub><a href="../../../README.md">🏠 aihw-starter</a> &nbsp;›&nbsp; <a href="README.md">🪴 桌宠</a> &nbsp;›&nbsp; <b>📦 公开案例</b></sub>

# 📦 桌宠 / 毛绒 公开案例

`🪴 桌宠` · `公开案例`

</div>

---
<!-- HERO:END -->

## 1. 产品横评对比

| 产品 | 厂商 | 形态 | 大模型方案 | 核心交互 | 参考价 |
|------|------|------|-----------|----------|--------|
| **Looi** | Looi Robotics | 充电头机器人 (手机作屏) | ChatGPT API | 语音对话 + 肢体动作 + 手机屏表情 | $199 (众筹) |
| **EMO** | Living.AI | 桌面双足机器人 | 自研 + GPT 接入 | 表情屏 + 语音 + 自主巡游 + 面部识别 | $299 |
| **Vector 2.0** | Digital Dream Labs | 履带式桌面机器人 | 云端 NLP (自研) | 语音指令 + 触摸 + 悬崖检测 + 自主探索 | $349 |
| **Eilik** | Energize Lab | 桌面情感机器人 | 本地规则 (无 LLM) | 触摸感应 + 表情 + 多机互动 | $149 |
| **小智 AI** | 开源社区 | ESP32 + 屏幕 + 舵机 | 千问/DeepSeek/ChatGPT 可选 | 语音对话 + 表情屏 + 舵机动作 | BOM ~80 元 |

## 2. 形态与路线图谱

```
         轻硬件                          重硬件
  (低 BOM / 情感优先)              (高自由度 / 技术驱动)
           │                              │
   ┌───────┼───────┐              ┌───────┼───────┐
   │       │       │              │       │       │
  Looi   Eilik  小智 AI          EMO   Vector   Cozmo
   │       │       │              │       │       │
   └───┬───┘       │              └───┬───┘       │
       ▼           ▼                  ▼           ▼
  手机复用屏   DIY/开源          独立屏+动力    多传感融合
```

## 3. 关键案例速览

### 3.1 Looi — "充电头上的灵魂"

- **亮点**：把手机变成机器人的脸，硬件极简 (仅舵机+结构)
- **模型**：云端 ChatGPT，对话 + 情感驱动表情动画
- **启示**：轻 BOM 路线下，软件体验 > 硬件堆料

### 3.2 EMO — 桌面情感宠物标杆

- **亮点**：1000+ 表情动画、自主探索桌面、多模态感知
- **模型**：自研情感引擎 + GPT 对话；本地处理表情/动作
- **启示**：表情丰富度是桌宠的核心竞争力

### 3.3 小智 AI — 开源全栈方案

- **亮点**：完整开源 (固件 + 服务端 + 3D 外壳)，社区活跃
- **模型**：支持千问 / DeepSeek / ChatGPT 等多模型热切换
- **启示**：验证了 ESP32-S3 + 云端大模型的可行性与低成本

## 4. 开源替代方案

| 项目 | 主控 | 特点 | 地址 |
|------|------|------|------|
| 小智 AI (xiaozhi-esp32) | ESP32-S3 | 全栈开源，中文社区活跃 | GitHub |
| ESP-AI | ESP32 系列 | 阿里云/百度接入，Arduino 友好 | GitHub |
| Wukong Robot | 树莓派 | Python 生态，插件丰富 | GitHub |
| Claude Desktop Buddy | ESP32-S3 | 极简桌面伴侣，Anthropic API | GitHub |

> 开源方案适合快速验证 MVP，量产前需关注固件稳定性与云端成本控制。

---

**版本**：千问大模型方案 v1.0
**更新日期**：2025-07

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
