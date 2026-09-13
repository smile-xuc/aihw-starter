<!-- HERO:START -->
<div align="center">

<sub><a href="../../../README.md">🏠 aihw-starter</a> &nbsp;›&nbsp; <a href="README.md">🎧 AI 耳机</a> &nbsp;›&nbsp; <b>📖 品类概述</b></sub>

# 📖 AI 耳机（AI Earphone）

`🎧 AI 耳机` · `品类概述`

</div>

---
<!-- HERO:END -->

## 品类概述

**带 AI 能力的无线耳机**——覆盖三个细分场景：

1. **AI 翻译耳机**：实时多语种同传、跨境商务 / 旅行
2. **AI 对话耳机**：语音助手、智能问答、信息查询
3. **AI 转写耳机**：会议录音 + 实时字幕（与 [`07-recorder`](../07-recorder/) 边界见商业分析）

客单价常见 300–2500 元。TWS 白牌年出货可达千万级；**真正带深度 AI（同传 / 助手）的功能款**量级更小，但单价与毛利空间更高。

## 商业化现状（公开信息观察）

- **走量靠白牌、品牌靠体验**：白牌把 AI 当卖点，激活率不一定高；垂类翻译品牌把同传做深才能抗白牌。
- **翻译场景已被验证**：时空壶、讯飞等公开 SKU 已跑通「硬件溢价 +（可选）时长 / 离线包」；见 [`04-cases.md`](./04-cases.md)。
- **真无线 SoC 算力有限**——音频处理大头在云端或手机 App，端侧只做唤醒、降噪、传输。

> 📊 详细市场判断 → 见 [01-business.md](./01-business.md)

## 推荐架构（千问大模型版本）

耳机端 SoC（唤醒 / 降噪 / 语音传输）→ 配套 App / 网关 → **Qwen3.5-Livetranslate** 多语种实时翻译 **或** ASR+LLM+TTS 三段式对话 → TTS / 译文音频流式回播。

> 🛠️ 完整接入步骤 → 见 [02-solution.md](./02-solution.md)

## 成本与计费

- **BOM 增量**：约 5–40 元（麦阵 / 天线 / 骨传导等）
- **翻译场景**：Livetranslate 按音频 token（约「秒级消耗」）计费，见 [`03-cost.md`](./03-cost.md)
- **对话场景**：三段式按 ASR 时长 + LLM token + TTS 字符

> 💰 详细测算 → 见 [03-cost.md](./03-cost.md)

## 公开案例与对标

时空壶 WT2 Edge / M3 / W4、科大讯飞 AI 翻译耳机、以及品牌 TWS「翻译卖点」路线。

> 📦 案例清单 → 见 [04-cases.md](./04-cases.md)

## 客户高频问答

- 翻译延迟能压到多少？
- 双向对讲怎么接？
- 粤语 / 方言怎么处理？
- 与 AI 眼镜同传有何差异？

> ❓ 全部 FAQ → 见 [05-faq.md](./05-faq.md)

## Demo

可运行的 Livetranslate WebSocket 最小示例（支持 mock 离线模式）：

> 🧪 [`demo/livetranslate-ws/`](./demo/livetranslate-ws/) → 见 [demo/README.md](./demo/README.md)

---

**版本**：千问大模型方案（完整版）
**说明**：README + 商业 + 方案 + 算账 + 案例 + FAQ + 可跑 demo。欢迎 PR 补双向对讲 / BLE bridge 等后续 demo。

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
