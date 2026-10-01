<!-- HERO:START -->
<div align="center">

<sub><a href="../../../../README.md">🏠 aihw-starter</a> &nbsp;›&nbsp; <a href="../README.md">🦾 具身智能</a> &nbsp;›&nbsp; <b>🧪 Demo</b></sub>

# 🧪 Demo · 具身智能

`🦾 具身智能` · `Demo`

</div>

---
<!-- HERO:END -->

可运行示例（完整版）：

## 参考 demo（品类 × 栈）

按 [demo 统一标准](../../../demo-standard/README.md) 组织：每个栈一个目录，三步跑通，无 Key 自动 mock。

| 栈 | 目录 | 场景 | 状态 |
|---|---|---|---|
| 百炼 | [`bailian/`](./bailian/) | 桌面机械臂腕部相机画面 + 指令 → `qwen3.7-flash` 看图后逐步调用技能 → 每次调用先过本地安全门 → 模拟执行 | 待真 Key 验证 |

## 专题 demo

### [`vla-intent-router/`](./vla-intent-router/)

语言指令 → 结构化技能计划 + Safety Gate（离线、无 API Key）。

```bash
cd vla-intent-router
python3 vla_intent_router.py
```

## 后续可贡献

- [ ] `safety-gate/` 与真实臂 SDK 的力矩限位对接骨架
- [x] 接千问 Function Calling 的规划器：见 [`bailian/`](./bailian/)

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
