<!-- HERO:START -->
<div align="center">

<sub><a href="../../../README.md">🏠 aihw-starter</a> &nbsp;›&nbsp; <a href="README.md">🤖 Agent 硬件</a> &nbsp;›&nbsp; <b>💼 商业化分析</b></sub>

# 💼 Agent 硬件 商业化分析

`🤖 Agent 硬件` · `商业化分析`

</div>

---
<!-- HERO:END -->

> **范围**：口袋 AI 助手、桌面 Agent 盒子、家庭 / 办公自动化中枢、车载外挂盒。
> **不含**：纯对话桌宠 → 见 [`05-desktop-pet`](../05-desktop-pet/)；录音纪要专用硬件 → 见 [`07-recorder`](../07-recorder/)；腕上健康解读 → 见 [`08-smart-watch`](../08-smart-watch/)。
>
> 本文档基于公开市场信息整理。所有数据为公开可查口径量级，不涉及任何客户内部信息。

---

## 一、品类利润逻辑

### 1.1 卖的是「办事入口」，不是「聊天功能包」

Agent 硬件的购买心智是：**少掏手机、少切 App、把重复任务交给一个常在线入口**。AI 对话只是入口，真正溢价来自「能调用工具、能跨步执行」。

| 路线 | 加价逻辑 | 谁在做（公开） | 备注 |
|---|---|---|---|
| **轻硬件口袋助手** | BOM 低 → 零售约 $199 | Rabbit R1 | 公开 **无订阅**；靠软件与 Agent 生态迭代 |
| **高客单可穿戴 Pin** | BOM + 设计溢价，高定价加订阅没卖动，另见 [Humane 主卡][pin] | Humane AI Pin（已停售） | 订阅心智失败的反面教材 |
| **桌面 / 家庭 Agent 盒** | SoC + NPU → ¥1,199 CNY 起 | 铠盒 AIBOX-A1 等 | 本地模型 + 云端 FC；卖 7×24 在线 |
| **记忆型挂件** | 极简麦，硬件加订阅，另见 [Limitless 主卡][pendant] | Limitless Pendant（停售新客） | 被大厂收购后停售，品类风险高 |

对方案商 / 品牌商的含义：

- **没有工具生态** → 不要做 Agent 硬件，做聊天玩具或桌宠即可
- **有本地调度 + 可验证工具链** → 才有资格卖「中枢」溢价
- **不要默认上聊天月费**：公开失败案例已给出信号（见第三节）

### 1.2 当前阶段：硬件买断 + 云端内嵌（或 BYOK）

公开市场观察：

```
高频意图（设备控制 / 定时 / 话术）→ 端侧完成，几乎零云费
长尾复杂推理 → 云端 LLM / Function Calling
进阶 Agent（控电脑等）→ 部分产品改为用户自带 API Key（BYOK）
```

用户接受「买盒子」；对「还要月费才能聊天」极敏感。Rabbit 官网公开定价为 **$199 USD / no subscription**（见 [rabbit.tech](https://www.rabbit.tech/)）。

### 1.3 下一阶段：可恢复任务与本地隐私才是黏性

| 能力 | 作用 | 现状 |
|---|---|---|
| **意图路由** | 本地 / 上云分流，控延迟与成本 | 技术方案成熟，见 [`02-solution.md`](./02-solution.md) |
| **工具调用可恢复** | 多步任务失败可重试、可审计 | 头部产品在做；是差异化主战场 |
| **离线降级** | 断网仍能控灯 / 定时 / 本地问答 | 工程成本可控，适合作为卖点 |
| **本地知识库** | 家庭 / 小微资料不出端 | 桌面盒路线主战场 |

**逻辑链**：路由保底线 → 工具可恢复做活人感 → 本地隐私做信任 → 才可能谈「备份 / 多设备同步」类年费。在此之前推「聊天月费」，公开市场已有失败样本。

### 1.4 维护者判断（2026-10）：端侧推理产品的放量窗口

> 本节是本仓库维护者在 2026-10 的观点记录，不是已核实的市场事实。下表公开信息只用来说明判断依据和反向信号，建议 2027-07 前后复盘。

**观点**（维护者原话）：「随着 200B 以下的模型越来越强，这类端侧推理产品预计会在明年（2027 年）中旬爆发」。「这类产品」指以本地统一推理调度为核心、与 Agent 硬件契合的端侧推理产品；调度层的位置见 [`06-edge-hybrid.md` §2.1](../../by-solution/06-edge-hybrid.md#21-端侧统一推理调度层)，开源参考见 [Lemonade 主卡](../../../awesome/open-source/by-category/04-agent-hardware.md#lemonade)。

| 类型 | 公开信息（厂商或机构自述，查证 2026-10-02） | 与判断的关系 |
|---|---|---|
| 模型 | OpenAI gpt-oss-120b（总参 116.8B、激活 5.1B）开放权重，厂商称准确率接近 o4-mini，MXFP4 量化后单张 80 GB GPU 可运行；gpt-oss-20b 可在 16 GB 内存的设备上运行（[模型卡](https://arxiv.org/abs/2508.10925)，2025-08-08） | 支撑：100B 级开放权重模型进入单机可跑范围 |
| 模型 | Qwen3.6-35B-A3B（总参 35B、激活 3B）开放权重，厂商称其编程 Agent 能力可与 Qwen3.5-27B、Gemma4-31B 等稠密模型相当（[官方博客](https://www.alibabacloud.com/blog/603043)，2026-04-17） | 支撑：小激活 MoE 降低端侧算力门槛 |
| 硬件 | NVIDIA DGX Spark 配 128 GB 统一内存，厂商称可在本地推理最高 200B 参数的模型（[新闻稿](https://nvidianews.nvidia.com/news/nvidia-dgx-spark-arrives-for-worlds-ai-developers)，2025-10-13） | 支撑：「200B 以下」与桌面级设备的内存上限吻合 |
| 硬件 | AMD Ryzen AI Max+ 395（128 GB），厂商称可运行最高 128B 参数的 4-bit 模型（[AMD 博客](https://www.amd.com/en/blogs/2025/faqs-amd-variable-graphics-memory-vram-ai-model-sizes-quantization-mcp-more.html)，2025-07-29） | 支撑：x86 AI PC / Mini PC 同样进入该区间 |
| 市场 | Gartner 预计到 2026 年底 DRAM 与 SSD 合计涨价约 130%，2026 年 PC 出货下降 10.4%，AI PC 普及放缓至 2027 年，50% 渗透率推迟到 2028 年（[新闻稿](https://www.gartner.com/en/newsroom/press-releases/2026-02-26-gartner-says-surging-memory-costs-will-reduce-global-pc-and-smartphone-shipments-in-2026)，2026-02-26） | 反向信号：大内存是端侧推理的主要成本，内存涨价可能推迟放量 |

不确定性：

- 模型能力数据均为厂商自测；端侧实际速度受内存带宽约束（见 [primer/02](../../../primer/02-model-size-chips.md)），128 GB 设备跑 100B 以上模型通常要 4-bit 量化，留给上下文的余量有限
- 端侧 NPU 生态仍分散：Lemonade 的 NPU 后端只覆盖 AMD XDNA2，Qualcomm、Intel 方向尚未完成，也未覆盖瑞芯微等国产 SoC。本品类常见的 RK 级桌面盒（BOM 150–400 元）内存装不下 100B 级模型，判断即使成立，也更可能先体现在 AI PC、Mini PC、家庭中枢等大内存形态
- 「爆发」没有量化口径。复盘时建议看三项：64 GB 以上统一内存设备的价格带、主流端侧推理运行时的 NPU 覆盖、内存价格走势

---

## 二、形态与客户画像

### 2.1 四种形态

| 形态 | 典型 BOM 量级 | 客单参考（公开） | 关键卖点 |
|---|---|---|---|
| 口袋助手（屏 + 麦 + 推送说话） | 中低 | Rabbit R1 ≈ $199 | 语音入口、无订阅 |
| 桌面 Agent 盒（RK/NPU） | 150–400 元 | 铠盒 A1 ¥1,199 CNY（[产品页](https://agentaibox.com/products/a1)，查证 2026-09-30） | 常开、本地轻量模型 |
| 家庭中枢（带屏 Hub） | 300–600 元 | 视 SKU | 多模态 + 全屋联动 |
| 记忆挂件（仅麦） | 极低 | 另见 [Limitless 主卡][pendant] | 对话记忆；品类收购风险高 |

### 2.2 三类客户

| 类型 | 特征 | 适合路线 |
|---|---|---|
| 一人公司 / 极客 | 要 7×24 Agent、愿折腾或要开箱即用 | 桌面盒 + 本地 + 云端 FC |
| 消费电子创业团队 | 强工业设计，缺调度栈 | 轻硬件口袋助手，重路由与工具 |
| 智能家居 / 渠道商 | 有设备矩阵，缺自然语言入口 | Hub 形态，工具 Agent 对接存量协议 |

### 2.3 与相邻品类的边界

| 判断维度 | 走桌宠 [`05`](../05-desktop-pet/) | 走录音纪要 [`07`](../07-recorder/) | 走 Agent 硬件（本品类） |
|---|---|---|---|
| 核心价值 | 表情 / 动作陪伴 | 转写 + 纪要 | 意图路由 + 工具执行 |
| 输出通道 | 屏 / 舵机 / TTS | 文本 / 摘要 | 动作结果 + 可选语音 |
| 订阅心智 | 已知未跑通 | 功能包可尝试 | 「聊天月费」已知高风险 |

---

## 三、订阅可行性：聊天月费已知高风险

**结论：截至当前版本，公开市场未见跑通的「Agent 硬件聊天月费」样板；失败与停售案例明确。**

已知尝试与观察：

1. **Humane AI Pin**：高定价加订阅没卖动；2025-02 停售，资产以约 $116M 售予 HP，设备云服务关闭（[The Verge 停售](https://www.theverge.com/news/614883/humane-ai-hp-acquisition-pin-shutdown)，查证 2026-09-30）。另见 [Humane 主卡][pin]
2. **Rabbit R1**：公开坚持 **$199 / 无订阅**；部分进阶能力改为用户自带 API Key
3. **Limitless Pendant**：曾硬件 + 订阅；2025-12 Meta 收购后**停售新客**，存量免费 Unlimited（[TechCrunch](https://techcrunch.com/2025/12/05/meta-acquires-ai-device-startup-limitless/)）
4. **国内桌面盒**：多见硬件买断 + 本地模型「零 Token」叙事，云端按需自配 Key

**建议**：

- 不押注「聊天月费」ARPU；云端成本按「端侧分流 60–80%」后摊进售价（见 [`03-cost.md`](./03-cost.md)）
- 若做订阅，宜包装为「云备份 / 家庭多设备同步 / 高级工具额度」，而不是「才能对话」

---

## 四、毛利结构（量级）

成本项为行业一般性估算，非厂商数据：

```
示意，按官方零售价 ¥1,199 CNY 计算。

桌面 Agent 盒（零售约 ¥1,199 CNY 档）：

  零售价：              ¥1,199 CNY
  - 渠道与营销：        ¥150–¥250 CNY
  - 硬件 BOM + 组装：   ¥200–¥400 CNY
  - 首年云端 AI 摊销：  ¥50–¥150 CNY
  - 认证 / 售后预提：   ¥30–¥60 CNY
  ─────────────────────────────
  品牌侧毛利空间：      ¥339–¥769 CNY（强依赖渠道与云费管控）
```

三个结论：

1. 云端若不分流，会直接吃掉毛利——高频意图必须留端
2. 真正吃毛利的是渠道与 SoC 选型；盲目上 12 TOPS+ 会抬高 BOM
3. BYOK（用户自带 Key）可降低厂商云费，但会削弱「开箱即用」叙事

---

## 五、决策树：要不要做 Agent 硬件

```
有没有可演示的「工具调用」闭环（控设备 / 查知识库 / 多步任务）？
  ├─ 没有 → 做桌宠或玩具，不要硬上 Agent 硬件
  └─ 有
       ├─ 目标是口袋入口还是常开中枢？
       │    ├─ 口袋 → 轻硬件 + 无订阅叙事，客单压在 $150–250
       │    └─ 中枢 → 桌面盒，强调本地隐私与 7×24
       └─ 是否依赖强制聊天月费？
            ├─ 是 → 公开失败风险高，重新设计收入
            └─ 否 → 云端成本内嵌或 BYOK，可进入样机验证
```

---

## 六、品类适配速查

| 问题 | 建议 |
|---|---|
| 只要会聊天会动 | 选桌宠，不是 Agent 硬件 |
| 要自然语言控全家 / 办公工具 | 选 Agent 硬件，Custom Router + FC |
| 只要录音纪要 | 选 [`07-recorder`](../07-recorder/) |
| 要腕上健康解读 | 选 [`08-smart-watch`](../08-smart-watch/) |

---

**版本**：千问大模型方案
**更新日期**：2026-09
**贡献欢迎**：补充公开定价与案例，见 [`CONTRIBUTING.md`](../../../CONTRIBUTING.md)

[pin]: ../../../awesome/commercial-products/by-category/04-agent-hardware.md
[pendant]: ../../../awesome/commercial-products/by-category/07-recorder.md

<!-- FOOTER:START -->

---

<table width="100%">
<tr>
<td align="left" width="33%">

<a href="README.md">← 📖 品类概述</a>

</td>
<td align="center" width="34%">

<a href="README.md">↑ 返回品类首页</a> · <a href="../../../README.md">🏠 仓库首页</a>

</td>
<td align="right" width="33%">

<a href="02-solution.md">🛠️ 技术方案 →</a>

</td>
</tr>
</table>
<!-- FOOTER:END -->
