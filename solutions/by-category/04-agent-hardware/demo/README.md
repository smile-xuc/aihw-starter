<!-- HERO:START -->
<div align="center">

<sub><a href="../../../../README.md">🏠 aihw-starter</a> &nbsp;›&nbsp; <a href="../README.md">🤖 Agent 硬件</a> &nbsp;›&nbsp; <b>🧪 Demo</b></sub>

# 🧪 Demo · Agent 硬件

`🤖 Agent 硬件` · `Demo`

</div>

---
<!-- HERO:END -->

> 本目录存放 Agent 硬件可运行示例。对应技术方案：[`02-solution.md`](../02-solution.md) 意图路由。

## 已提供

### [`intent-router/`](./intent-router/) — 端侧意图分发（离线可跑）

把用户话术分成 `local` / `cloud` / `hybrid`，并演示断网降级话术。

```bash
cd intent-router
python3 intent_router.py
python3 intent_router.py --offline
python3 intent_router.py --text "把客厅灯关掉"
```

无需 API Key。

## 计划中（欢迎 PR）

- [ ] **`tool-agent/`** — Function Calling 调度骨架
- [ ] **`offline-fallback/`** — 更完整的离线话术与本地日历
- [ ] **`audit-log/`** — 工具调用审计日志示例

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
