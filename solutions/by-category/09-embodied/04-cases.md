<!-- HERO:START -->
<div align="center">

<sub><a href="../../../README.md">🏠 aihw-starter</a> &nbsp;›&nbsp; <a href="README.md">🦾 具身智能</a> &nbsp;›&nbsp; <b>📦 公开案例</b></sub>

# 📦 具身智能 公开案例

`🦾 具身智能` · `公开案例`

</div>

---
<!-- HERO:END -->

> 收录已在公开渠道披露过形态与技术路线的代表性产品 / 方案。
> 不涉及任何客户内部信息。价格与销量均为公开报道量级。

---

## 一、收录原则

- **只写公开信息**：官网 / 博客 / 媒体已披露
- **客观陈述**：不写「全球首款」「业界领先」
- **品类横评 vs 商业卡**：本页精选；全集见 [`awesome/commercial-products/by-category/09-embodied.md`](../../../awesome/commercial-products/by-category/09-embodied.md)

---

## 二、产品 / 方案横评

| 名称 | 厂商 / 方 | 形态 | 大模型（公开） | 核心能力 | 参考价（公开） |
|---|---|---|---|---|---|
| **Go2** | 宇树 | 四足 | 可部署 Qwen-RobotNav（公开演示） | 运动控制 + 寻物导航 | $1,600–$4,500 档起 |
| **G1** | 宇树 | 人形 | UnifoLM 等公开表述 | 仿生运动 / 科研二次开发 | $13,500 起；EDU 报价 |
| **UR e-Series** | Universal Robots | 协作臂 | 多为第三方视觉 / VLA 集成 | 产线抓取装配生态 | UR7e 经销商约 $38k+ |
| **AUBO-i5 级** | 遨博 | 协作臂 | 方案商集成 | 性价比协作抓取 | 公开估算约 $6k–$10k |
| **Qwen-Robot Suite** | 阿里通义 | 模型套件 | RobotNav / Manip / World | 语言优先工具接口 | 以官方发布为准 |

### 形态路线图

```
        工业结构化                         移动 / 泛化
              │                                │
     ┌────────┼────────┐              ┌────────┼────────┐
     │        │        │              │        │        │
   UR系    遨博等    开源臂           Go2     工业四足    G1/人形
     │        │        │              │        │        │
     └────┬───┘        │              └────┬───┘        │
          ▼            ▼                   ▼            ▼
     语言抓取落地   算法验证            巡检导航      早期探索
```

---

## 三、关键案例速览

### 3.1 宇树 Go2 × Qwen-RobotNav

- **公开信息源**：Unitree 产品页；Qwen-Robot 官方解读 / 博客
- **亮点**：公开材料称零样本部署 Nav，单低分辨率相机完成寻物导航
- **可借鉴点**：移动场景先打通「语言 → 导航技能」，载荷与站点运维另算

### 3.2 宇树 G1

- **公开信息源**：https://www.unitree.com/g1/
- **亮点**：可购消费/科研人形入口；EDU 支持二次开发；官网标价约 $13.5K 起
- **可借鉴点**：人形适合演示与算法平台，不宜默认当作已跑通的家庭管家 SKU

### 3.3 协作臂语言抓取（UR / 遨博路线）

- **公开信息源**：厂商产品页与集成商公开案例
- **亮点**：ISO 协作约束清晰；第三方视觉 / VLA 可插拔
- **可借鉴点**：商业上仍是「臂 + 集成」；大模型卖的是换型效率，不是替代 PLC

### 3.4 Qwen-RobotManip 公开基准

- **公开信息源**：[`05-qwen-robot.md`](../../by-solution/05-qwen-robot.md)
- **亮点**：公开材料称 RoboChallenge Table30 等任务赛道成绩靠前（拧龙头、插网线等）
- **可借鉴点**：用公开基准选模型，仍要用自有工位回归；Safety Gate 不可省

---

## 四、开源替代（快速验证）

| 项目 | 特点 | 链接 |
|---|---|---|
| LeRobot | HF 机器人学习框架 | https://github.com/huggingface/lerobot |
| SO-ARM100 | 低成本开源臂 | https://github.com/TheRobotStudio/SO-ARM100 |
| OpenCat | 开源四足 | https://github.com/PetoiCamp/OpenCat-Quadruped-Robot |

开源适合 2–6 周验证「语言 → 技能」；量产前须补：安全认证、运控限位、数据闭环与维保。

---

## 五、待补充清单（欢迎 PR）

- [ ] 国内工业四足巡检公开标案（须附信源）
- [ ] Figure / Apptronik 等海外人形试点公开合同细节
- [ ] 开源臂 + 千问实机抓取复现报告

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
