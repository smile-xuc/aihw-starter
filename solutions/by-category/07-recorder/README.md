<!-- HERO:START -->
<div align="center">

<sub><a href="../../../README.md">🏠 aihw-starter</a> &nbsp;›&nbsp; <a href="README.md">🎙️ 录音卡 / 会议盒子</a> &nbsp;›&nbsp; <b>📖 品类概述</b></sub>

# 📖 录音卡（Recorder）

`🎙️ 录音卡 / 会议盒子` · `品类概述`

</div>

---
<!-- HERO:END -->

## 品类概述

**便携式录音设备 + AI 转写 + AI 摘要** 的工作工具品类，面向会议、访谈、课堂、销售拜访等场景。形态：挂绳录音卡、笔形录音、夹式录音、桌面会议盒子。客单价常见 200–2500 元，叠加云端时长 / 订阅服务。

## 商业化现状（公开信息观察）

- **是 AI 硬件少数已有清晰付费场景的品类**：用户愿为「音频转可读纪要」付钱。
- **付费模式偏向「硬件 + 按时长 / 按月套餐」**——公开标杆如 Plaud Note（$159，含 Starter 300 min/mo）已跑通硬件低价铺货 + 云端订阅。
- **AI 摘要质量是核心竞争力**——单纯转写已红海，能不能抽出决策 / 待办、自动归档才是差异化。

> 📊 详细市场判断 → 见 [01-business.md](./01-business.md)

## 推荐架构（千问大模型版本）

录音文件 → OSS 上传 → Paraformer / FunASR 高精度转写 → CAM++ 说话人分离 → 千问 LLM 做 Map-Reduce 摘要（先分段抽要点 + 再总段汇总） → 输出可读纪要 + 决策待办清单。

> 🛠️ 完整接入步骤 → 见 [02-solution.md](./02-solution.md)

## 成本与计费

- **BOM 增量**：约 30–80 元（录音 IC + 麦克风 + 4G/Wi-Fi 模组，视形态）
- **每小时音频处理**：约 1–4 元量级（ASR + 说话人分离 + LLM 摘要；以官方计费页为准）
- **报价口径**：硬件 + 套餐订阅（按月 / 按时长）；海外标杆 Pro ~$8.33/mo 年付、Unlimited ~$19.99/mo 年付

> 💰 详细测算 → 见 [03-cost.md](./03-cost.md)

## 公开案例与对标

Plaud Note / Note Pro、Notta Memo、讯飞录音笔、Limitless Pendant、通义听悟 / 钉钉听记等公开产品与 SaaS 参考。

> 📦 案例清单 → 见 [04-cases.md](./04-cases.md)

## 客户高频问答

- 1 小时音频成本能压到多少？
- 多说话人会议怎么处理？
- 转写准确率能保证吗？
- 订阅套餐怎么对标海外定价？

> ❓ 全部 FAQ → 见 [05-faq.md](./05-faq.md)

## Demo

可运行的长会议 Map-Reduce 摘要（离线 mock 优先，可选 DashScope）：

> 🧪 [`demo/map-reduce-summary/`](./demo/map-reduce-summary/) → 见 [demo/README.md](./demo/README.md)

---

**版本**：千问大模型方案（完整版）
**说明**：README + 商业 + 方案 + 算账 + 案例 + FAQ + 可跑 demo。欢迎 PR 补实时 ASR / OSS 上传等后续 demo。

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
