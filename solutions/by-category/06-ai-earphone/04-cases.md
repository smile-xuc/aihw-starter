<!-- HERO:START -->
<div align="center">

<sub><a href="../../../README.md">🏠 aihw-starter</a> &nbsp;›&nbsp; <a href="README.md">🎧 AI 耳机</a> &nbsp;›&nbsp; <b>📦 公开案例</b></sub>

# 📦 AI 耳机 公开案例

`🎧 AI 耳机` · `公开案例`

</div>

---
<!-- HERO:END -->

> 收录已在公开渠道披露过形态与技术路线的代表性产品。
> 不涉及任何客户内部信息。价格与销量为公开报道 / 官网标价量级（2026-09 核对）。

---

## 一、收录原则

- **只写公开信息**：产品与客户名仅在官网 / 官方商店 / 官方公众号 / 媒体报道已披露时出现
- **客观陈述**：不评价优劣，只记形态、技术路线、可观察事实；不写「首个 / 最强 / 唯一」
- **数字有出处**：价格、销量等用公开口径，附链接与查证日期；查不到标「待核实」；不写转化率 / ARPU / 私下报价
- **与 awesome 的关系**：有商业产品卡的案例用「另见」互链；提交规范见 [CONTRIBUTING.md](../../../CONTRIBUTING.md)

---

## 二、产品横评

| 产品 | 厂商 | 形态 | 核心交互（公开） | 参考价（公开） |
|---|---|---|---|---|
| **WT2 Edge / W3** | Timekettle 时空壶 | 入耳同传 | 双向同时翻译；最多 6 人双语；43 语在线 + 13 对离线 | 官网约 $279.99（常标原价 $349.99） |
| **M3** | Timekettle | 旅行翻译耳机 | 轮流对话翻译 + 音乐 / 通话；25h 续航宣称 | 官网约 $119.99（常标原价 $149.99） |
| **W4 / W4 Pro** | Timekettle | AI Interpreter | Babel OS、通话 / 视频翻译、AI Memo 等（以官网为准） | W4 现价 $279.20（划线 $349）；W4 Pro $449（查证 2026-09-30） |
| **AI 翻译耳机 AIH-2541** | 科大讯飞 | 开放式耳挂 | 60 语同传、骨导 + 气导、声音复刻（证券时报） | 国内价待核实（查证 2026-09-30） |
| **品牌 TWS + 翻译卖点** | 华为 / 三星 / Apple 等 | 成熟声学 TWS | 系统级实时翻译或助手（能力随系统版本变化） | 随声学旗舰定价 |

### 形态路线图

```
         旅行轻量                          商务同传
  (音乐+轮流翻译)                    (双向/通话/专业词库)
           │                              │
   ┌───────┼───────┐              ┌───────┼───────┐
   │       │       │              │       │       │
  M3   白牌AI款  品牌TWS+AI     WT2 Edge  W4系列  讯飞旗舰
```

---

## 三、关键案例速览

### 案例：Timekettle WT2 Edge / W3（时空壶）— 双向同传标杆

- **公开信息源**：[时空壶产品页](https://www.timekettle.co/products/wt2-edge-online-voice-language-translator-earbuds)
- **亮点**：公开主打双向同时翻译、免提、多人双语模式
- **可借鉴点**：把「两人各戴一耳」做成明确交互范式；离线语言对可单独包装
- **另见**：[时空壶同传商业产品卡][ear]

### 案例：Timekettle M3（时空壶）— 旅行档走量

- **公开信息源**：[时空壶旅行款产品页](https://www.timekettle.co/products/m3-travel-translator-earbuds)
- **亮点**：翻译 + 音乐 + 通话一体；轮流对话（HyperComm 1.0 公开表述）；可选离线包
- **可借鉴点**：客单下探到约 $120 档，用「旅行刚需」而非「专业同传」心智
- **另见**：[时空壶旅行款商业产品卡][ear]

### 案例：科大讯飞 AI 翻译耳机（科大讯飞）— 国内旗舰开放式

- **公开信息源**：[证券时报](https://stcn.com/article/detail/3381881.html)（60 种语言、骨导 + 气导、声音复刻；正文没有 2499 / 2999，查证 2026-09-30）。国内官方价待核实。下列旧链接未在本批打开核对价格：
  - [新浪转载预售报道](https://finance.sina.com.cn/tech/digi/2025-11-19/doc-infxxwtt3492426.shtml)
  - [量子位发布会报道](https://www.qbitai.com/2025/10/341663.html)
  - [讯飞商城 · AI 翻译耳机](https://www.xunfei.cn/goods?goodsId=2381)
- **亮点**：通话翻译、面对面无按键、旁听同传、专业词库、音色克隆播报（公开宣称）
- **可借鉴点**：开放式佩戴适配「长时间会议」；把通话场景做成差异化，而不只做面对面
- **另见**：[讯飞翻译耳机商业产品卡][ear]

### 案例：品牌 TWS 系统级翻译（华为 / 三星 / Apple）

- **公开信息源**：各品牌系统更新说明 / 产品页（随版本变化，引用时核对当期文档）（**待补链接**）
- **亮点**：待核实
- **可借鉴点**：AI 是声学旗舰的附件能力；云端成本通常被生态账号吸收，不适合白牌直接复制「无限用」承诺

---

## 四、开源 / 方案参考

| 项目 | 说明 | 链接 |
|---|---|---|
| 千问 Livetranslate | 端到端 S2S 同传 | 本品类 [`02-solution.md`](./02-solution.md) |
| 眼镜同传 / Omni demo | 可复用实时音频推流经验 | [`../02-ai-glasses/demo/`](../02-ai-glasses/demo/) |
| 录音纪要 | 会后结构化输出 | [`../07-recorder/`](../07-recorder/) |

---

## 五、待补充清单（欢迎 PR）

- [ ] Anker / Soundcore 等出海 AI 翻译耳机当期 SKU 与订阅条款
- [ ] 白牌亚马逊高销量「Translator Earbuds」拆解（须附 listing 链接）
- [ ] 车载 / 运动场景 AI 耳机公开案例

补充位置：本品类本页，或 [awesome/commercial-products/by-category/06-ai-earphone.md][ear]。

---

[ear]: ../../../awesome/commercial-products/by-category/06-ai-earphone.md

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
