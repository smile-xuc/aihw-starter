<!-- HERO:START -->
<div align="center">

<sub><a href="../../../README.md">🏠 aihw-starter</a> &nbsp;›&nbsp; <a href="README.md">🎧 AI 耳机</a> &nbsp;›&nbsp; <b>❓ 常见问答</b></sub>

# ❓ AI 耳机 常见问题

`🎧 AI 耳机` · `常见问答`

</div>

---
<!-- HERO:END -->

> 本品类高频问题。通用问题（账号、API-KEY、跨境等）见根目录 [`faq.md`](../../../faq.md)。

---

## A. 商业模式与形态

**Q1：翻译耳机订阅能跑通吗？**
A：公开市场里，**翻译时长包 / 离线语言包**比「AI 聊天月费」更常见、也更好向用户解释。对话向助手多数仍把云端摊进硬件。详见 [`01-business.md`](./01-business.md) 第三节。

**Q2：和录音卡怎么选？**
A：主体验是「佩戴听译 / 对讲」→ 耳机；主体验是「会后纪要 / SaaS 分钟数」→ [`07-recorder`](../07-recorder/)。耳机可附带轻量转写，但不要用录音卡的订阅模型硬套同传。

**Q3：白牌 199 元能不能做无限同传？**
A：按 Livetranslate 公开计费量级，日均数十分钟双向同传的年成本就可能吃掉毛利。白牌必须**硬封顶分钟**或引导时长包。测算见 [`03-cost.md`](./03-cost.md)。

**Q4：和 AI 眼镜同传有什么差异？**
A：眼镜可做「一看即懂」+ 屏显字幕；耳机优势是双手解放与双耳分戴对讲。链路都可走 Livetranslate，但交互与续航约束不同。眼镜方案见 [`02-ai-glasses`](../02-ai-glasses/)。

---

## B. 模型与链路

**Q5：Livetranslate 比三段式慢，为什么还要用？**
A：端到端模型要积累语义再出译，延迟大约 ~3 秒量级，但连贯性更好。日常对讲可用 ASR+翻译 LLM+TTS；专业同传优先 Livetranslate。见 [`02-solution.md`](./02-solution.md)。

**Q6：粤语客户怎么办？**
A：Livetranslate 上粤语等多仅文本输出。AR / App 走字幕；强需求粤语音频输出可评估切 `Qwen3-Livetranslate` 或 Omni，并以官方语言表为准。

**Q7：能控制商务正式语气吗？**
A：Livetranslate 不支持自定义系统提示词。要风格控制走「ASR + qwen-plus 翻译 + TTS」拼接。

**Q8：要不要上 Omni-Realtime 做助手耳机？**
A：需要全双工打断、多模态（看图）且客单吃得下时再上。否则三段式 flash/plus 足够。

---

## C. 延迟、双端与工程

**Q9：双向对讲怎么接？**
A：两路 `TranslationRealtime`（A→B、B→A），用 VAD 判断说话侧并路由音频。见 [`02-solution.md`](./02-solution.md) 第五节伪代码与 [`demo/livetranslate-ws/`](./demo/livetranslate-ws/)。

**Q10：为什么必须独立线程采音？**
A：采音阻塞 WebSocket 回调会导致卡顿与丢事件；官方接入亦强调独立线程推帧。

**Q11：对端静音还要不要推空帧？**
A：不要持续发空帧，浪费配额。用 VAD：无人声则停传或降频心跳（按产品协议设计）。

**Q12：字幕为什么有时慢于声音？**
A：客户端须监听 `translation.text` 流式事件并即时上屏；只等 `.done` 会出现「字慢于声」的错觉。

---

## D. 续航、BLE 与端侧

**Q13：耳机 SoC 能跑端侧 ASR 吗？**
A：消费级 TWS 算力通常只够 VAD / 唤醒 / 降噪；实用级 ASR 送手机或云端。

**Q14：BLE 要传什么？**
A：双向音频（PCM 16k 或 Opus / LC3）。带宽与双发策略决定同传能否稳。具体取决于 SoC 与是否经手机中继。

**Q15：断网怎么办？**
A：在线同传不可用。产品侧可卖离线语言包（垂类品牌已有公开形态）；离线质量与语种覆盖通常弱于云端。

---

## E. 合规与隐私

**Q16：通话翻译要提示对方吗？**
A：涉及录音与转写时，应按当地法律与应用商店政策做告知 / 同意；会议场景建议默认提示「正在翻译 / 转写」。

**Q17：音色克隆播报有什么风险？**
A：需获得音色权利人授权；面向未成年人与公众人物另有合规限制。不要把「克隆他人声音」做成默认无感能力。

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
