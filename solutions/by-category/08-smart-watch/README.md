<!-- HERO:START -->
<div align="center">

<sub><a href="../../../README.md">🏠 aihw-starter</a> &nbsp;›&nbsp; <a href="README.md">⌚ 智能手表</a> &nbsp;›&nbsp; <b>📖 品类概述</b></sub>

# 📖 智能手表 / 健康可穿戴（Smart Watch & Wearable Health）

`⌚ 智能手表` · `品类概述`

</div>

---
<!-- HERO:END -->

## 品类概述

带传感器（心率 / 血氧 / 加速度 / 体温等）的腕上或指环设备，结合大模型做**健康数据解读**与**个性化建议**。客单价常见 300–5000 元（海外约 $199–$799+）。

## 商业化现状（公开信息观察）

- **硬件仍是主收入**；订阅在海外部分品牌已跑通（Oura / WHOOP），国内多为会员增值（华为活力人生）。
- **壁垒在传感器基线 + 可信解读**，不是堆更大模型。
- **医疗宣称有红线**：输出须标注非诊疗建议。

> 📊 详细市场判断 → 见 [01-business.md](./01-business.md)

## 推荐架构（千问大模型版本）

传感器 → App 聚合指标 JSON → `qwen-flash` / `plus` 生成日报 / 告警 / 月报；危险阈值输出 `[ALERT]`，文末免责声明。

> 🛠️ 完整接入步骤 → 见 [02-solution.md](./02-solution.md)

## 成本与计费

- **BOM（手环 / 入门表）**：约 80–200 元量级
- **云端**：日报级约 **0.15 元/用户/月** 量级（flash/plus）
- **订阅锚点（公开）**：Oura $5.99/月；WHOOP $199–$359/年；华为活力人生连续包月 15 元

> 💰 详细测算 → 见 [03-cost.md](./03-cost.md)

## 公开案例与对标

Oura / WHOOP / 华为 WATCH / Apple Watch 等。

> 📦 案例清单 → 见 [04-cases.md](./04-cases.md)

## Demo

可运行的指标解读 mock（离线、无需 API Key）：

> 🧪 [`demo/metrics-prompt/`](./demo/metrics-prompt/) → 见 [demo/README.md](./demo/README.md)

---

**版本**：千问大模型方案（完整版）
**说明**：README + 商业 + 方案 + 算账 + 案例 + FAQ + 可跑 demo。

<!-- FOOTER:START -->

---

<table width="100%">
<tr>
<td align="left" width="33%"><sub>（首篇）</sub></td>
<td align="center" width="34%"><a href="README.md">↑ 返回品类首页</a> · <a href="../../../README.md">🏠 仓库首页</a></td>
<td align="right" width="33%"><a href="01-business.md">💼 商业化分析 →</a></td>
</tr>
</table>
<!-- FOOTER:END -->
