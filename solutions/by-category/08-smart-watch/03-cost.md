<!-- HERO:START -->
<div align="center">

<sub><a href="../../../README.md">🏠 aihw-starter</a> &nbsp;›&nbsp; <a href="README.md">⌚ 智能手表</a> &nbsp;›&nbsp; <b>💰 成本测算</b></sub>

# 💰 智能手表 成本与计费

`⌚ 智能手表` · `成本测算`

</div>

---
<!-- HERO:END -->

> 数字为公开口径量级；订阅价格来自官网支持页 / 产品页。

---

## 一、硬件 BOM（入门表 / 手环，1k 量级）

| 模组 | 参考成本（元） |
|------|----------:|
| PPG 心率/血氧 | 8–15 |
| 6 轴 IMU | 3–8 |
| 主控 + BLE | 15–40 |
| AMOLED 屏 | 25–60 |
| 电池 | 5–10 |
| 结构 + 表带 | 15–30 |
| PCBA + 组装 | 10–20 |
| **合计** | **约 83–188** |

医疗级 ECG / 连续血糖另计。

## 二、云端 AI（千问量级）

| 场景 | 单次成本量级 | 频次 | 日成本 / 用户 |
|------|-----------:|------|------------:|
| 日报 | ~0.002 元 | 1/天 | 0.002 |
| 异常告警 | ~0.001 元 | 0–3/天 | ~0.003 |
| 月报 | ~0.01 元 | 1/月 | ~0.0003 |
| **合计** | — | — | **~0.005 → 约 0.15 元/月** |

相对 Oura $5.99/月、华为会员 15 元/月，**token 不是毛利瓶颈**。

## 三、公开订阅锚点

| 产品 | 公开价格 | 来源 |
|---|---|---|
| Oura Membership | $5.99/月或 $69.99/年 | [ouraring.com/membership](https://ouraring.com/membership) |
| WHOOP One / Peak / Life | $199 / $239 / $359 年 | [whoop.com/membership](https://www.whoop.com/us/en/membership/) |
| 华为活力人生 | 连续包月 15 元；年卡 208 元 | [华为支持](https://consumer.huawei.com/cn/support/content/zh-cn15839131/) |
| Apple Fitness+ | $9.99/月或 $79.99/年 | [Apple Fitness+](https://www.apple.com/apple-fitness-plus/) |

### 空白模板

```
硬件 BOM：__________ 元
目标零售：__________ 元
日均 LLM 次数：__________
月云端预提：__________ 元
订阅档位：__________ 元/月（是否强制：是/否）
```

---

**版本**：千问大模型方案
**更新日期**：2026-09

<!-- FOOTER:START -->

---

<table width="100%">
<tr>
<td align="left" width="33%"><a href="02-solution.md">← 🛠️ 技术方案</a></td>
<td align="center" width="34%"><a href="README.md">↑ 返回品类首页</a> · <a href="../../../README.md">🏠 仓库首页</a></td>
<td align="right" width="33%"><a href="04-cases.md">📦 案例清单 →</a></td>
</tr>
</table>
<!-- FOOTER:END -->
