<!-- HERO:START -->
<div align="center">

<sub><a href="../../../README.md">🏠 aihw-starter</a> &nbsp;›&nbsp; <a href="README.md">🤖 Agent 硬件</a> &nbsp;›&nbsp; <b>📖 品类概述</b></sub>

# 📖 Agent 硬件（Agent Hardware）

`🤖 Agent 硬件` · `品类概述`

</div>

---
<!-- HERO:END -->

## 品类概述

**本地运行多个 AI Agent 的独立硬件盒子**，提供家庭/办公自动化中枢能力。客单价 500–3000 元。

### 细分形态

| 形态 | 代表产品 | 特点 |
|------|----------|------|
| 桌面 AI 盒子 | Rabbit R1, Humane Pin | 便携、语音交互为主 |
| 家庭中枢 | 带屏幕的 AI Hub | 多模态、全屋联动 |
| 车载 AI 盒子 | 车机外挂盒 | 离线优先、低延迟 |

### 核心架构

```
[语音/触屏/手势] → [端侧 Agent 调度器]
                         │
         ┌───────────────┼───────────────┐
         ▼               ▼               ▼
   [工具 Agent]    [对话 Agent]    [自动化 Agent]
         │               │               │
         └───────────────┼───────────────┘
                         ▼
              [云端 LLM / 本地 SLM]
```

## 推荐架构（千问大模型版本）

**端侧小模型（意图分发 + 离线兜底）+ 云端旗舰模型（复杂推理）**：
- 端侧 Qwen-0.5B 做意图分类，<50ms 响应
- 简单任务本地 SLM 直接完成（定时器、设备控制）
- 复杂推理上云调用 Qwen-Max，保证质量

> 🛠️ 完整技术方案 → 见 [02-solution.md](./02-solution.md)

## 成本与计费

- **硬件 BOM**：150–600 元（SoC + RAM + 存储 + 外设）
- **云端 Token**：单次 Agent 调用约 0.01–0.05 元
- **月均云费用**：轻度用户 5 元，重度用户 30 元

> 💰 详细测算 → 见 [03-cost.md](./03-cost.md)

## 公开案例与对标

> 📦 案例清单 → 见 [04-cases.md](./04-cases.md)

## 客户高频问答

- 离线时 Agent 能力降级到什么程度？
- 多 Agent 并发调度如何保证响应延迟？
- 如何保护用户隐私数据不出端侧？

> ❓ 全部 FAQ → 见 [05-faq.md](./05-faq.md)

---

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
