<!-- HERO:START -->
<div align="center">

<sub><a href="../README.md">🏠 aihw-starter</a> &nbsp;›&nbsp; <b>📚 AI 通识</b></sub>

# 📚 AI 通识（Primer）

`AI 通识` · `板块索引`

</div>

---
<!-- HERO:END -->

> 本板块不从属于任何硬件品类，收录**做 AI 硬件之前应该搞清楚的基础概念**——它们决定你能不能看懂方案、算对账、谈对合同。
>
> 与其他板块的关系：[`solutions/`](../solutions/README.md) 回答「怎么做」，[`awesome/`](../awesome/) 回答「生态里有什么」，本板块回答「**这些概念到底是什么**」。

## 篇目

| # | 篇名 | 回答什么问题 |
|---|---|---|
| 01 | [开放权重与模型授权](./01-open-weights.md) | 「开源模型」到底开放了什么？为什么厂商愿意开放？License 有哪些坑？端模型授权是怎么回事？ |
| 02 | [模型规格与芯片载体](./02-model-size-chips.md) | 4B / 9B / 27B / 35B-A3B MoE 分别需要什么样的芯片才能跑？为什么瓶颈是内存带宽而不是算力？ |
| 03 | [KV Cache 量化](./03-kv-cache-quantization.md) | 为什么聊得越久显存占得越多？量化压的是什么？巨值为什么让「直接粗存」翻车、旋转怎么救回来？另配 [交互式学习页](https://smile-xuc.github.io/aihw-starter/kv-cache-quantization.html) |

## 计划篇目（欢迎 PR）

- [ ] Token 与计费：一次对话到底花多少钱，输入/输出/缓存怎么算
- [ ] 蒸馏：小模型是怎么「学」大模型的（量化基础见 03 篇）
- [ ] 端云协同基础：什么任务适合端、什么必须上云
- [ ] 上下文与记忆：context window、长记忆的工程本质（KV cache 基础见 03 篇）

## 写作约定

- **读者假设**：硬件/供应链背景的从业者，不要求 AI 技术基础
- **允许比喻，拒绝营销**：可以用生活化类比解释概念，但结论必须客观、可验证
- **数字用量级**：具体单价/性能数字随时间失效，正文用量级区间 + 指向官方来源
- **与品类联动**：每篇给出「对做硬件意味着什么」的落点，并交叉引用相关品类目录

<!-- FOOTER:START -->

---

<table width="100%">
<tr>
<td align="left" width="33%">

<sub>（板块首页）</sub>

</td>
<td align="center" width="34%">

<a href="../README.md">🏠 仓库首页</a>

</td>
<td align="right" width="33%">

<a href="./01-open-weights.md">01 开放权重与模型授权 →</a>

</td>
</tr>
</table>
<!-- FOOTER:END -->
