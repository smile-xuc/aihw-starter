# 千问具身智能方案（Qwen-Robot Suite）

> 阿里通义千问大模型家族的具身智能模型系列。
>
> Qwen-Robot Suite 包含 Qwen-RobotNav、Qwen-RobotManip、Qwen-RobotWorld。三款可以单独使用，也可以组合成机器人通用底座（[新京报 2026-06-16](https://m.bjnews.com.cn/detail/1781590837129774.html)，查证 2026-09-30）。智能体框架 Qwen-RobotClaw 把这几个模型串起来（[知乎 2026-06-16](https://zhuanlan.zhihu.com/p/2050195778107450150)，查证 2026-09-30）。
>
> 官方博客：<https://qwen.ai/blog?id=qwen-robotsuite>

## 1. 三模型矩阵

Qwen-Robot Suite 由三个专用基础模型组成，可以单独使用，也可以组合使用。「语言优先接口」的表述待核实。

| 模型 | 定位 | 核心设计 |
|---|---|---|
| **Qwen-RobotNav** | 导航 | 1,560 万样本训练。EXPRESS-Bench 提升 15.4%，导航步数减少 77%。指令跟随、点/目标导航、目标追踪、自动驾驶等任务划分待核实 |
| **Qwen-RobotManip** | 操作 | 基于 Qwen3.5-4B VL，训练数据超过 38,100 小时。状态-动作空间、相机坐标系增量位姿，以及「完全由开源数据构建」待核实 |
| **Qwen-RobotWorld** | 世界模型 | 覆盖 20 多种本体、500 多种动作，860 万视频-文本对。跨机器人操作、自动驾驶与室内导航（[arXiv 2606.17030](https://arxiv.org/abs/2606.17030)；[阿里云博客](https://www.alibabacloud.com/blog/qwen-robot-suite-a-foundation-model-suite-for-physical-world-intelligence_603262)） |

## 2. 技术架构

```
┌───────────────── 上层智能体 ─────────────────┐
│  Qwen-Omni（角色待核实）                       │
│       ↓                                       │
│  Qwen-3.5（是否为上层规划器，待核实）           │
│       ↓                                       │
│  ┌──────────────────────────────────────────┐ │
│  │         Qwen-RobotClaw 框架              │ │
│  │   把 Qwen-Robot Suite 各模型串起来        │ │
│  └──────────────────────────────────────────┘ │
└───────────────────┬───────────────────────────┘
                    │ 接口待核实
        ┌───────────┼───────────┐
        ▼           ▼           ▼
┌──────────┐ ┌──────────┐ ┌──────────┐
│ RobotNav │ │RobotManip│ │RobotWorld│
│  导航     │ │  操作    │ │ 世界模型  │
│           │ │          │ │          │
│ 骨干待核实 │ │Qwen3.5-  │ │骨干待核实 │
│           │ │4B VL     │ │           │
│           │ │          │ │           │
└─────┬────┘ └────┬─────┘ └────┬─────┘
      │            │            │
      ▼            ▼            ▼
┌─────────────────────────────────────────────┐
│           物理世界执行层                       │
│  四足 / 机械臂 / 人形 / 无人车                │
│  20+ 本体形态 · 80 维动作表征待核实           │
└─────────────────────────────────────────────┘
```

## 3. 各模型技术细节

### 3.1 Qwen-RobotManip（操作）

- **骨干**：Qwen3.5-4B VL。流匹配 DiT 动作头待核实
- **统一表示**：80 维状态-动作空间、相机坐标系下末端执行器增量位姿待核实
- **训练数据**：超过 38,100 小时。11,320 / 1,933 / 24,808 小时的拆分，以及跨 15 种本体，待核实
- **关键特性**：相对位置操作、不依赖绝对坐标、跨本体共享动作空间，均待核实
- **基准成绩**：RoboChallenge Table30 v1 的 45% SR 与排名待核实

### 3.2 Qwen-RobotNav（导航）

- **骨干**：是否基于 Qwen3-VL、是否不改架构，待核实
- **参数规模**：2B ~ 8B 待核实
- **训练数据**：1,560 万条样本
- **任务划分**：指令跟随、点导航、目标搜索、目标追踪、自动驾驶，待核实
- **任务自适应观察机制**：视觉 token 预算、时间衰减、帧采样，待核实
- **基准成绩**：EXPRESS-Bench 提升 15.4%，导航步数减少 77%。VLN-CE RxR 76.5% SR、HM3Dv2 目标搜索 75.6% SR 待核实

### 3.3 Qwen-RobotWorld（世界模型）

- **骨干**：60 层双流 MMDiT 待核实
- **动作编码器**：是否为 Qwen2.5-VL，待核实
- **训练数据**：860 万视频-文本对。逾 2 亿帧待核实
- **覆盖范围**：20 多种本体、500 多种动作
- **核心用途**：预测下一时刻、合成训练视频、预演轨迹，待核实
- **基准成绩**：EWMBench、DreamGen Bench 的排名待核实

## 4. 品类适配

| 场景 | 本体形态 | 推荐模型组合 | 典型任务 |
|---|---|---|---|
| 家庭服务 | 四足 / 轮式 | RobotNav + RobotManip | 寻物跑腿、取快递、收拾桌面 |
| 工业装配 | 机械臂 | RobotManip + RobotWorld | 衣服收纳、精密装配、插线 |
| 仓储物流 | 四足 / AGV | RobotNav | 仓内导航、目标追踪 |
| 自动驾驶辅助 | 无人车 | RobotNav | 低速园区配送 |
| 研发仿真 | 通用 | RobotWorld | 合成训练数据、动作轨迹预演 |

## 5. 落地

- **宇树 Go2 四足机器人**：零样本部署、单低分辨率相机寻物导航，待核实
- **RoboChallenge Table30 v1**：Lira/Atlas 名次，以及拧水龙头、插网线、双臂倒薯条等任务，待核实

## 6. 与 Qwen 模型家族的关系

```
Qwen 模型家族
├── Qwen3.5（是否担任上层规划器，待核实）
├── Qwen-VL / Qwen3-VL（是否为 RobotNav 骨干，待核实）
├── Qwen2.5-VL（RobotWorld 动作编码器为 Qwen2.5-VL，[arXiv 2606.17030](https://arxiv.org/abs/2606.17030)；[阿里云博客](https://www.alibabacloud.com/blog/qwen-robot-suite-a-foundation-model-suite-for-physical-world-intelligence_603262)）
├── Qwen-Omni（是否负责任务评判，待核实）
└── Qwen-Robot Suite ← 本页
    ├── RobotManip（Qwen3.5-4B VL 骨干）
    ├── RobotNav（1,560 万样本；骨干规模待核实）
    └── RobotWorld（860 万视频-文本对；60 层双流 MMDiT，动作编码器为 Qwen2.5-VL，[arXiv 2606.17030](https://arxiv.org/abs/2606.17030)；[阿里云博客](https://www.alibabacloud.com/blog/qwen-robot-suite-a-foundation-model-suite-for-physical-world-intelligence_603262)）
```

## 7. 开放资源

- 官方博客：<https://qwen.ai/blog?id=qwen-robotsuite>
- 技术来源：[知乎 · 千问官方解读（2026-06-16）](https://zhuanlan.zhihu.com/p/2050195778107450150)（查证 2026-09-30）
- 相关报道：[新京报（2026-06-16）](https://m.bjnews.com.cn/detail/1781590837129774.html)（查证 2026-09-30） · [新浪财经](https://finance.sina.com.cn/wm/2026-06-16/doc-inicqsxv4438421.shtml)

---

> 回到 [方案总览](./README.md) · 切到 [按品类](../by-category/) 视角
