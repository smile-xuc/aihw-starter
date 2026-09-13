<!-- HERO:START -->
<div align="center">

<sub><a href="../../../README.md">🏠 aihw-starter</a> &nbsp;›&nbsp; <a href="README.md">⌚ 智能手表</a> &nbsp;›&nbsp; <b>🛠️ 技术方案</b></sub>

# 🛠️ 智能手表 技术方案

`⌚ 智能手表` · `技术方案`

</div>

---
<!-- HERO:END -->

> 可跑 demo：[`demo/metrics-prompt/`](./demo/metrics-prompt/)（离线 mock，不发起真实 API）。

---

## 一、两种集成模式

| 维度 | Prompt 模式（快速 / 推荐 MVP） | RAG + Agent 模式（深度） |
|------|---------------------|--------------------------|
| 输入 | 结构化指标 JSON | 指标 + 历史 + 知识库 |
| 输出 | 单次文本解读 | 多轮 + 行动计划 + 报告 |
| 成本 | ~0.002 元/次量级 | ~0.02 元/次量级 |
| 适用 | 日报推送 | 付费深度健康管理 |

## 二、数据管线

```
[手表传感器] → [蓝牙同步 App] → [指标聚合 JSON]
                                      │
                            [Qwen LLM 解读]
                           ├─ 日报
                           ├─ [ALERT] 异常
                           └─ 周报 / 月报
```

## 三、Prompt 模板（与 demo 对齐）

见 demo 中 `build_prompt()`；关键约束：

- 不做医疗诊断
- 危险阈值首行 `[ALERT]`
- 文末固定免责声明

## 四、千问选型

| 场景 | 模型 | 说明 |
|---|---|---|
| 日报 | qwen-flash | 成本优先 |
| 深度周报 | qwen-plus | 更稳的结构化输出 |
| 实时陪练语音 | 可选 Realtime | 仅高客单；非本 demo 范围 |

计费：https://help.aliyun.com/zh/model-studio/billing-of-model-studio

## 五、安全约束

| 约束 | 实现 |
|---|---|
| 隐私 | 仅传聚合指标，不传原始波形 |
| 免责 | System + 输出后缀双保险 |
| 延迟 | 日报异步 <5s；告警队列 <30s |

---

**版本**：千问大模型方案
**更新日期**：2026-09

<!-- FOOTER:START -->

---

<table width="100%">
<tr>
<td align="left" width="33%"><a href="01-business.md">← 💼 商业化分析</a></td>
<td align="center" width="34%"><a href="README.md">↑ 返回品类首页</a> · <a href="../../../README.md">🏠 仓库首页</a></td>
<td align="right" width="33%"><a href="03-cost.md">💰 成本测算 →</a></td>
</tr>
</table>
<!-- FOOTER:END -->
