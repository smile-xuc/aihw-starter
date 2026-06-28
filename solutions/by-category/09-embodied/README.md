<!-- HERO:START -->
<div align="center">

<sub><a href="../../../README.md">🏠 aihw-starter</a> &nbsp;›&nbsp; <a href="README.md">🦾 具身智能</a> &nbsp;›&nbsp; <b>📖 品类概述</b></sub>

# 📖 具身智能（Embodied Intelligence）

`🦾 具身智能` · `品类概述`

</div>

---
<!-- HERO:END -->

## 品类定义

具备**物理交互能力**的 AI 系统——机械臂、四足机器人、人形机器人、AGV 等。核心特征：感知真实世界 → 理解意图 → 输出物理动作。

**关键洞察**：大模型在具身中的角色是 **"语言→动作"的桥梁**，即 VLA（Vision-Language-Action）范式——用视觉语言模型直接输出可执行的运动序列。

## 三大形态对比

| 形态 | 代表 | 自由度 | 大模型切入点 | 商业化阶段 |
|------|------|--------|-------------|-----------|
| 机械臂 | 协作臂（UR/遨博） | 6–7 DOF | 语言指令→抓取规划 | ⭐⭐⭐ 已规模落地 |
| 四足 | 巡检犬（宇树 Go2） | 12+ DOF | 语言→导航+巡检 | ⭐⭐ 场景验证中 |
| 人形 | 通用服务（Figure/优必选） | 30+ DOF | 全任务泛化 | ⭐ 早期探索 |

## 技术架构概览（Qwen-Robot Suite）

```
[自然语言指令]
       │
       ▼
┌──────────────────────────┐
│     VLA 基础模型层        │
│  Nav + Manip + World     │
└──────────┬───────────────┘
           │
    ┌──────┼──────┐
    ▼      ▼      ▼
 [导航]  [操作]  [世界模型]
    │      │      │
    └──────┼──────┘
           ▼
    [物理执行层/运控]
```

> 🛠️ 完整模型细节 → 见 [02-solution.md](./02-solution.md) 及 [Qwen-Robot Suite 方案](../../by-solution/05-qwen-robot.md)

## 商业化观察

- **工业场景先落地**：分拣、码垛、巡检——ROI 可算、环境可控
- **消费级仍在早期**：家庭服务机器人受限于安全性和成本
- **Sim-to-Real 仍是瓶颈**：仿真到实机的迁移成功率决定部署速度

## 子文件导航

| 文件 | 内容 |
|------|------|
| [01-business.md](./01-business.md) | 商业化分析与市场判断 |
| [02-solution.md](./02-solution.md) | 技术方案（VLA + 运控 + 感知融合） |
| [03-cost.md](./03-cost.md) | 成本模型与 ROI 测算 |
| [04-cases.md](./04-cases.md) | 公开案例 |
| [05-faq.md](./05-faq.md) | 高频问答 |

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
