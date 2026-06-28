<!-- HERO:START -->
<div align="center">

<sub><a href="../../../README.md">🏠 aihw-starter</a> &nbsp;›&nbsp; <a href="README.md">🦾 具身智能</a> &nbsp;›&nbsp; <b>🛠️ 技术方案</b></sub>

# 🛠️ 具身智能技术方案

`🦾 具身智能` · `技术方案`

</div>

---
<!-- HERO:END -->

## 核心洞察

具身智能的技术栈 = **VLA 模型** + **运动控制** + **感知融合**

传统方案依赖手工规划管线（SLAM → 路径规划 → PID 控制），而 VLA 端到端方案用一个模型直接从视觉+语言输出动作序列。当前最优解是**混合方案**：VLA 做高层决策，底层运控保留安全约束。

## 技术路线对比

| 维度 | 传统规划（SLAM+路径规划） | VLA 端到端 | 混合方案（推荐） |
|------|------------------------|-----------|----------------|
| 泛化能力 | 低，需逐场景调参 | 高，语言驱动零样本 | 高 |
| 部署难度 | 中，需点云/地图 | 高，需大算力推理 | 中 |
| 安全性 | 高，边界明确 | 低，黑箱行为 | 高，底层兜底 |
| 适用 | 固定产线 | 研究/仿真 | 工业+服务 |

## Qwen-Robot Suite 三模型速览

| 模型 | 定位 | 输入→输出 |
|------|------|----------|
| **Qwen-RobotNav** | 行动入口 | 语言指令 → 导航轨迹（支持指令跟随/目标搜索/追踪） |
| **Qwen-RobotManip** | 交互基石 | 语言+视觉 → 操作动作（80 维统一动作空间） |
| **Qwen-RobotWorld** | 无限世界 | 语言+视觉 → 物理世界预测（合成数据/轨迹预演） |

> 详细技术参数、训练数据、基准成绩 → [`../../by-solution/05-qwen-robot.md`](../../by-solution/05-qwen-robot.md)

## 典型场景集成（工业分拣）

```
[语音指令"把红色零件放到B区"]
       │
       ▼
 Qwen-LLM（意图解析 + 任务分解）
       │
       ▼
 RobotManip（视觉定位 + 抓取规划）
       │
       ▼
 运控层（关节角度序列 + 力矩控制）
       │
       ▼
 执行 + 力传感反馈 → 闭环修正
```

## 关键约束

| 约束 | 说明 | 应对 |
|------|------|------|
| 安全围栏 | 协作臂需满足 ISO 10218 | 力矩限制 + 速度分区 |
| 延迟要求 | 抓取闭环 <100ms | 边缘推理（Jetson/RK3588） |
| Sim-to-Real Gap | 仿真策略迁移实机衰减 | Domain Randomization + RobotWorld 合成数据 |
| 多本体适配 | 不同机械结构动作空间不同 | 统一 80 维表征（RobotManip） |

<!-- FOOTER:START -->

---

<table width="100%">
<tr>
<td align="left" width="33%">

<a href="01-business.md">← 💼 商业化分析</a>

</td>
<td align="center" width="34%">

<a href="README.md">↑ 返回品类首页</a> · <a href="../../../README.md">🏠 仓库首页</a>

</td>
<td align="right" width="33%">

<a href="03-cost.md">💰 成本模型 →</a>

</td>
</tr>
</table>
<!-- FOOTER:END -->
