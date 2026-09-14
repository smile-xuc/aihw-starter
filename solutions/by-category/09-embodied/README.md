<!-- HERO:START -->
<div align="center">

<sub><a href="../../../README.md">🏠 aihw-starter</a> &nbsp;›&nbsp; <a href="README.md">🦾 具身智能</a> &nbsp;›&nbsp; <b>📖 品类概述</b></sub>

# 📖 具身智能（Embodied Intelligence）

`🦾 具身智能` · `品类概述`

</div>

---
<!-- HERO:END -->

## 品类概述

具备**物理交互能力**的 AI 系统——协作臂、四足、人形、AGV 等。核心链路：感知真实世界 → 理解意图 → 输出可执行动作。大模型在具身中的角色是 **「语言 → 动作」桥梁**（VLA / 混合规划），而不是单独的聊天 SKU。

## 商业化现状（公开信息观察）

- **工业先落地**：分拣、码垛、巡检——ROI 可算、环境可控；协作臂仍是量产主力。
- **四足进入场景验证**：巡检 / 安防 / 科研演示可卖，家庭消费仍偏早。
- **人形早期探索**：可买到的消费/科研 SKU 已出现，但全任务泛化与安全边界仍未跑通。
- **订阅已知未跑通**：卖的是本体 + 集成交付；云端 VLA 推理多摊进项目或边缘算力，少见「月费聊天」。

> 📊 详细市场判断 → 见 [01-business.md](./01-business.md)

## 推荐架构（千问大模型版本）

**混合方案**：上层语言规划（Qwen / Omni）→ VLA 工具层（RobotNav / RobotManip / RobotWorld）→ 底层运控安全门（力矩 / 速度 / 围栏）。VLA 不做黑箱直驱关节。

```
自然语言指令
    → 意图解析 / 任务分解
    → Nav | Manip | World（按工具调用）
    → Safety Gate（限速 / 禁区 / 力矩）
    → 物理执行 + 传感闭环
```

> 🛠️ 完整接入步骤 → 见 [02-solution.md](./02-solution.md) · 模型细节 → [Qwen-Robot Suite](../../by-solution/05-qwen-robot.md)

## 成本与计费

- **本体**：协作臂单元约数万～数十万；四足约 $1.6k–$4.5k 起；人形 G1 官宣约 $13.5k 起（未含税运）
- **边缘算力**：RK3588～Jetson Orin 量级；云端抓取规划约元级/百次
- **结论**：回本看工位替代与运转时长，不看 token

> 💰 详细测算 → 见 [03-cost.md](./03-cost.md)

## 公开案例与对标

协作臂语言抓取 / 宇树 Go2 / 宇树 G1 / Qwen-Robot 零样本导航等公开路径。

> 📦 案例清单 → 见 [04-cases.md](./04-cases.md)

## 客户高频问答

- VLA 能不能直接上产线？
- 先做臂还是先做人形？
- Sim-to-Real 怎么控成本？
- 安全认证要多久？

> ❓ 全部 FAQ → 见 [05-faq.md](./05-faq.md)

## Demo

可运行的「语言指令 → 结构化动作计划 + 安全门」离线 demo（无需 API Key）：

> 🧪 [`demo/vla-intent-router/`](./demo/vla-intent-router/) → 见 [demo/README.md](./demo/README.md)

---

**版本**：千问大模型方案（完整版）
**说明**：README + 商业 + 方案 + 算账 + 案例 + FAQ + 可跑 demo。欢迎 PR 补实机驱动 / Sim 对接。

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
