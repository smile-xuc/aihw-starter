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

- **只写公开信息**：产品与客户名仅在官网 / 官方商店 / 官方公众号 / 媒体报道已披露时出现
- **客观陈述**：不评价优劣，只记形态、技术路线、可观察事实；不写「首个 / 最强 / 唯一」
- **数字有出处**：价格、销量等用公开口径，附链接与查证日期；查不到标「待核实」；不写转化率 / ARPU / 私下报价
- **与 awesome 的关系**：有商业产品卡的案例用「另见」互链；提交规范见 [CONTRIBUTING.md](../../../CONTRIBUTING.md)

---

## 二、产品 / 方案横评

| 名称 | 厂商 / 方 | 形态 | 大模型（公开） | 核心能力 | 参考价（公开） |
|---|---|---|---|---|---|
| **Go2** | 宇树 | 四足 | 可部署 Qwen-RobotNav（公开演示） | 运动控制 + 寻物导航 | 官网 from $1,600；商店 Air $1,600 / $1,850，Pro $2,800 / $3,050，X $4,500（查证 2026-09-30） |
| **G1** | 宇树 | 人形 | UnifoLM 等公开表述 | 仿生运动 / 科研二次开发 | 首发价 US$16K（2024-05）→ 现价 US$13,500（查证 2026-09-30）；基础版不支持二次开发，EDU 询价 |
| **UR e-Series** | Universal Robots | 协作臂 | 多为第三方视觉 / VLA 集成 | 产线抓取装配生态 | 2025-05-12 更名 UR7e；经销商约 $38k+（第三方，官方不公开统一标价） |
| **AUBO-i5 级** | 遨博 | 协作臂 | 方案商集成 | 性价比协作抓取 | 臂展 886.5 mm；价格为估算约 $6k–$10k |
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

### 案例：宇树 Go2 × Qwen-RobotNav（宇树）

- **公开信息源**：[Unitree Go2](https://www.unitree.com/go2/) · [Qwen-RobotNav 博客](https://www.alibabacloud.com/blog/qwen-robotnav-a-scalable-navigation-model-designed-for-an-agentic-navigation-system_603266)（查证 2026-09-30）
- **亮点**：公开材料称零样本部署 Nav，单低分辨率相机完成寻物导航
- **可借鉴点**：移动场景先打通「语言 → 导航技能」，载荷与站点运维另算
- **另见**：[宇树四足商业产品卡][emb]

### 案例：宇树 G1（宇树）

- **公开信息源**：[Unitree 产品页](https://www.unitree.com/g1/)
- **亮点**：可购消费/科研人形入口；商店说明基础版不支持二次开发，二次开发需选 EDU 版；首发价 US$16K（2024-05）→ 现价 US$13,500（查证 2026-09-30，未含税运）。来源：[Unitree G1](https://www.unitree.com/g1/) · [官方商店](https://shop.unitree.com/products/unitree-g1) · [PR Newswire 2024-05-15](https://www.prnewswire.com/news-releases/unitree-robotics-introduces-g1-humanoid-agent-ai-avatar-302146198.html)
- **可借鉴点**：人形适合演示与算法平台，不宜默认当作已跑通的家庭管家 SKU
- **另见**：[宇树人形商业产品卡][emb]

### 案例：协作臂语言抓取（Universal Robots / 遨博）

- **公开信息源**：[UR 新闻稿（2025-05-12）](https://www.universal-robots.com/news-and-media/news-center/universal-robots-introduces-its-fastest-ever-cobot-to-enable-unprecedented-performance-in-collaborative-automation/) · [UR7e-920](https://www.universal-robots.com/products/ur7e-920/) · [AUBO-i5 规格页](https://www.aubo-cobot.com/public/iproduct3)（查证 2026-09-30）。集成商公开案例待核实
- **亮点**：ISO 协作约束清晰；第三方视觉 / VLA 可插拔
- **可借鉴点**：商业上仍是「臂 + 集成」；大模型卖的是换型效率，不是替代 PLC
- **另见**：[协作臂商业产品卡][emb] · [遨博协作臂商业产品卡][emb]

### 案例：Qwen-RobotManip（阿里通义）— 公开基准

- **公开信息源**：[Qwen-RobotManip 博客](https://www.alibabacloud.com/blog/qwen-robotmanip-alignment-unlocks-scale-for-robotic-manipulation-foundation-models_603267) · [Qwen-Robot Suite](https://www.alibabacloud.com/blog/qwen-robot-suite-a-foundation-model-suite-for-physical-world-intelligence_603262) · [品类解读](../../by-solution/05-qwen-robot.md)（查证 2026-09-30）
- **亮点**：博客写 RoboChallenge Table30 v1 成功率 45%，排名第一
- **可借鉴点**：用公开基准选模型，仍要用自有工位回归；Safety Gate 不可省

---

## 四、开源替代（快速验证）

| 项目 | 特点 | 链接 |
|---|---|---|
| LeRobot | HF 机器人学习框架 | [LeRobot](https://github.com/huggingface/lerobot) |
| SO-ARM100 | 低成本开源臂 | [开源臂仓库](https://github.com/TheRobotStudio/SO-ARM100) |
| OpenCat | 开源四足 | [OpenCat](https://github.com/PetoiCamp/OpenCat-Quadruped-Robot) |

开源适合 2–6 周验证「语言 → 技能」；量产前须补：安全认证、运控限位、数据闭环与维保。

---

## 五、待补充清单（欢迎 PR）

- [ ] 国内工业四足巡检公开标案（须附信源）
- [ ] Figure / Apptronik 等海外人形试点公开合同细节
- [ ] 开源臂 + 千问实机抓取复现报告

---

商业产品全集见 [awesome/commercial-products/by-category/09-embodied.md][emb]。

[emb]: ../../../awesome/commercial-products/by-category/09-embodied.md

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
