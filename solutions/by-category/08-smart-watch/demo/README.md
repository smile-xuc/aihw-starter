<!-- HERO:START -->
<div align="center">

<sub><a href="../../../../README.md">🏠 aihw-starter</a> &nbsp;›&nbsp; <a href="../README.md">⌚ 智能手表</a> &nbsp;›&nbsp; <b>🧪 Demo</b></sub>

# 🧪 Demo · 智能手表

`⌚ 智能手表` · `Demo`

</div>

---
<!-- HERO:END -->

> 对应技术方案：[`02-solution.md`](../02-solution.md) Prompt 模式。

## 已提供

### [`metrics-prompt/`](./metrics-prompt/) — 指标 JSON → 自然语言解读（离线 mock）

```bash
cd metrics-prompt
python3 health_metrics_prompt.py
python3 health_metrics_prompt.py --metrics sample_day.json --show-prompt
```

无需 API Key。真实接入时把 prompt 发给 qwen-flash/plus。

## 计划中

- [ ] **`weekly-report/`** — 周报生成骨架

## 贡献指引

详见根目录 [`CONTRIBUTING.md`](../../../../CONTRIBUTING.md)。

<!-- FOOTER:START -->

---

<table width="100%">
<tr>
<td align="left" width="33%"><a href="../05-faq.md">← ❓ 常见问答</a></td>
<td align="center" width="34%"><a href="../README.md">↑ 返回品类首页</a> · <a href="../../../../README.md">🏠 仓库首页</a></td>
<td align="right" width="33%"><sub>（末篇）</sub></td>
</tr>
</table>
<!-- FOOTER:END -->
