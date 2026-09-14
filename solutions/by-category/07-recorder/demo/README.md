<!-- HERO:START -->
<div align="center">

<sub><a href="../../../../README.md">🏠 aihw-starter</a> &nbsp;›&nbsp; <a href="../README.md">🎙️ 录音卡 / 会议盒子</a> &nbsp;›&nbsp; <b>🧪 Demo</b></sub>

# 🧪 Demo · 录音卡 / 会议盒子

`🎙️ 录音卡 / 会议盒子` · `Demo`

</div>

---
<!-- HERO:END -->

> 本目录存放录音 / 纪要品类可运行示例。对应技术方案：[`02-solution.md`](../02-solution.md) 第三节纪要 Agent（Map-Reduce）。

## 已提供

### [`map-reduce-summary/`](./map-reduce-summary/) — 长会议 Map-Reduce 摘要（离线可跑）

把带说话人的长中文逐字稿切成 chunk → 每段 Map 抽取议程 / 决策 / 待办 → Reduce 合并为结构化会议纪要。

```bash
cd map-reduce-summary
python3 map_reduce_summary.py          # 默认离线 mock，无需 API Key
python3 map_reduce_summary.py --live   # 需 DASHSCOPE_API_KEY
```

## 计划中（欢迎 PR）

- [ ] **`paraformer-file/`** — Paraformer-v2 文件转写 + 说话人分离
- [ ] **`fun-asr-realtime/`** — fun-asr 实时流式 demo
- [ ] **`oss-upload/`** — OSS STS 签名 URL 生成
- [ ] **`bailian-cli-asr/`** — bailian-cli 本地 mp3 一键转写
- [ ] **`meeting-card/`** — 纪要卡片 UI（Markdown / HTML）

## 贡献指引

详见根目录 [`CONTRIBUTING.md`](../../../../CONTRIBUTING.md)。

<!-- FOOTER:START -->

---

<table width="100%">
<tr>
<td align="left" width="33%">

<a href="../05-faq.md">← ❓ 常见问答</a>

</td>
<td align="center" width="34%">

<a href="../README.md">↑ 返回品类首页</a> · <a href="../../../../README.md">🏠 仓库首页</a>

</td>
<td align="right" width="33%">

<sub>（末篇）</sub>

</td>
</tr>
</table>
<!-- FOOTER:END -->
