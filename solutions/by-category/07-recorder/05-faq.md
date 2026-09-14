<!-- HERO:START -->
<div align="center">

<sub><a href="../../../README.md">🏠 aihw-starter</a> &nbsp;›&nbsp; <a href="README.md">🎙️ 录音卡 / 会议盒子</a> &nbsp;›&nbsp; <b>❓ 常见问答</b></sub>

# ❓ 录音卡 / 会议盒子 常见问题

`🎙️ 录音卡 / 会议盒子` · `常见问答`

</div>

---
<!-- HERO:END -->

> 本品类高频问题。通用问题（账号、API-KEY、跨境等）见根目录 [`faq.md`](../../../faq.md)。

---

## A. 商业模式与订阅

**Q1：录音笔 / 会议盒子订阅能跑通吗？**
A：能。海外公开标杆如 Plaud：硬件 [$159](https://www.plaud.ai/products/plaud-note-ai-voice-recorder) 含 Starter 300 min/mo，Pro / Unlimited 年付折月约 [$8.33 / $19.99](https://www.plaud.ai/pages/plaud-ai-plan-pricing)。国内多见「硬件 + 听见时长包 / 会员」。订阅包装建议：转写分钟 + 高级摘要模板 + 多端同步 + 工作流，而不是「多一点准确率」。详见 [`01-business.md`](./01-business.md)。

**Q2：硬件卖完就完事，还是必须做订阅？**
A：卡片机（低 BOM）几乎必须靠订阅；高客单录音笔（¥1000+）可以「硬件溢价 + 包年时长」并存。完全不做云端服务，很难做出「AI 录音卡」差异化。

**Q3：怎么对标海外套餐定价？**
A：先按 [`03-cost.md`](./03-cost.md) 测算「月均小时 ×（ASR+LLM）」；中度用户（~20h）应对齐公开 Pro 档量级；Unlimited 必须有 VAD / 分级摘要，否则云端会吃掉毛利。

**Q4：用户「录完即弃」怎么办？**
A：产品侧拉回：待办提醒、日历 / 飞书钉钉同步、跨会议 Ask 检索。技术侧保证决策 / 待办字段稳定可勾选——见 Map-Reduce demo。

---

## B. 模型与链路选型

**Q5：本地 mp3 能直接传 Paraformer-v2 吗？**
A：不行，**文件版只支持公网 URL**。先上传 OSS（STS 签名 URL）或用 bailian-cli 自动上传。详见 [`02-solution.md`](./02-solution.md)。

**Q6：1 小时录音要手动切片吗？**
A：ASR 文件版一般不需要手动切。但 **LLM 摘要建议 Map-Reduce 切段**，避免超长 context 贵且不稳。见 [`demo/map-reduce-summary/`](./demo/map-reduce-summary/)。

**Q7：文件转写还是实时流式？**
A：录完回看 → 文件转写（成本低、准确率通常更好）；边录边看字幕 → 实时流式。可组合：实时出字幕，结束后再跑一遍文件版出最终纪要。

**Q8：1 小时端到端大概多少钱？**
A：公开量级约 **¥1–4 / 小时**（ASR + 摘要）。以 [Model Studio 计费](https://help.aliyun.com/zh/model-studio/billing-of-model-studio) 与实测为准。详见 [`03-cost.md`](./03-cost.md)。

**Q9：默认用 qwen-plus 还是 max？**
A：Map 用 flash、Reduce 用 plus 通常够用。max 留给用户主动要的「深度分析」或强专业文档，不要作为每场会默认。

---

## C. 说话人分离与准确率

**Q10：多说话人会议怎么处理？**
A：文件版开 diarization（或 CAM++ 后处理），输出带 `speaker_id` 的句子后再进纪要 Agent。2–5 人、音质尚可的会议一般「速记可用」。

**Q11：转写准确率能保证吗？**
A：不能写死保证。普通话清晰会议公开宣传常到很高准确率；方言、强口音、重叠发言、远场噪音会明显下降。应用层应提供热词、纠错回流与「跳转到音频时间点」。

**Q12：中英混合会议怎么办？**
A：选支持多语种 / language hints 的 ASR（Paraformer、fun-asr、SenseVoice 等），并在摘要 prompt 中允许中英专有名词保留。先小样本实测再承诺。

---

## D. 隐私与合规

**Q13：如何减少云端留存风险？**
A：① 合同与控制台确认数据留存策略；② 转写后限期删除 OSS 原音频；③ 高敏感场景评估 fun-asr 等开源私有化；④ 设备端本地可播，云端只留文本纪要。

**Q14：会议含商业机密怎么办？**
A：私有化 ASR + 本地 / 专有云 LLM；或仅内网可达的文件转写链路。完全端侧长音频高精度转写在消费级 BOM 下仍困难。

**Q15：可穿戴持续录音要注意什么？**
A：告知同意、区域合规、停录控制与数据导出删除。Limitless 等公开案例说明该形态商业与合规压力都大，见 [`04-cases.md`](./04-cases.md)。

---

## E. 产品与工程

**Q16：长会议（3 小时+）内存会爆吗？**
A：ASR 走文件版由服务端处理；端侧 / 服务编排不要把全文一次性塞进 LLM——固定 chunk Map，再 Reduce。demo 即此模式。

**Q17：纪要卡片应包含哪些字段？**
A：建议最少：议程摘要、决策、待办（责任人 / 期限）、未决问题、可展开逐字稿。prompt 模板见 [`02-solution.md`](./02-solution.md) 4.3 节。

**Q18：和 Apple 语音备忘录比有什么必要？**
A：系统转写适合个人备忘；独立录音卡胜在双模式采集（通话/现场）、跨平台、专业模板、订阅级摘要与工作流。可用系统录音作补充导入源，而不是竞品替代全部场景。

---

**版本**：千问大模型方案
**更新日期**：2026-09

<!-- FOOTER:START -->

---

<table width="100%">
<tr>
<td align="left" width="33%">

<a href="04-cases.md">← 📦 公开案例</a>

</td>
<td align="center" width="34%">

<a href="README.md">↑ 返回品类首页</a> · <a href="../../../README.md">🏠 仓库首页</a>

</td>
<td align="right" width="33%">

<a href="demo/README.md">🧪 Demo →</a>

</td>
</tr>
</table>
<!-- FOOTER:END -->
