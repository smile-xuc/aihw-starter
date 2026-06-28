<!-- HERO:START -->
<div align="center">

<sub><a href="../../../README.md">🏠 aihw-starter</a> &nbsp;›&nbsp; <a href="README.md">🤖 Agent 硬件</a> &nbsp;›&nbsp; <b>🛠️ 技术方案</b></sub>

# 🛠️ 技术方案（Technical Solution）

`🤖 Agent 硬件` · `技术方案`

</div>

---
<!-- HERO:END -->

## 方案总览

| 维度 | 纯云端 | 端云协同（推荐） | 纯端侧 |
|------|--------|-----------------|--------|
| 延迟 | 200–500ms | 50–200ms | <50ms |
| 离线能力 | 无 | 基础任务可用 | 完全可用 |
| 推理能力 | 旗舰级 | 旗舰+轻量组合 | 受限 |
| 隐私 | 数据上云 | 敏感数据留端 | 完全本地 |
| 成本 | 低硬件+高云费 | 中等均衡 | 高硬件+零云费 |
| 适用 | 轻量试水 | 量产首选 | 高隐私场景 |

## 推荐方案：端云协同架构

```
┌─────────────────────────────────────────────┐
│              端侧（ARM SoC）                 │
│  ┌──────────┐  ┌──────────┐  ┌───────────┐ │
│  │ 意图分类  │  │ 本地 SLM │  │ Agent调度  │ │
│  │(Qwen-0.5B)│  │(离线兜底) │  │   框架    │ │
│  └─────┬────┘  └────┬─────┘  └─────┬─────┘ │
└────────┼────────────┼───────────────┼───────┘
         │            │               │
    ═════╪════════════╪═══════════════╪═══ 网络
         │            │               │
┌────────┼────────────┼───────────────┼───────┐
│        ▼            ▼               ▼       │
│   [Qwen-Max]  [工具调用API]   [知识库/RAG]  │
│              云端（百炼平台）                 │
└─────────────────────────────────────────────┘
```

## 关键设计要点

| 要点 | 说明 |
|------|------|
| 意图分发 | 端侧 0.5B 模型 3-class 分类：本地执行 / 云端推理 / 混合 |
| 离线兜底 | 网络断开时自动降级到本地 1.5B SLM，覆盖 80% 高频指令 |
| Agent 隔离 | 每个 Agent 独立沙箱，崩溃不影响主调度器 |
| 流式响应 | 云端首 token <200ms，端侧 TTS 边推理边播报 |

## Agent 调度框架选型

| 框架 | 优点 | 缺点 | 适用 |
|------|------|------|------|
| ReAct | 实现简单、推理链透明 | 多轮调用延迟叠加 | 单任务对话 |
| Plan-Execute | 复杂任务拆解能力强 | 规划阶段耗时 | 多步自动化 |
| Custom Router | 延迟最低、可硬编码热路径 | 开发成本高 | 量产优化 |

**推荐**：量产阶段采用 Custom Router + ReAct 混合——高频意图走硬编码快速路径，长尾任务走 ReAct 通用链路。

## 意图路由示例

```python
# 端侧意图分类 → 路由分发（伪代码）
intent = local_classifier(user_input)  # Qwen-0.5B, <30ms

if intent == "device_control":
    result = tool_agent.execute(user_input)      # 本地直接执行
elif intent == "complex_qa":
    result = await cloud_agent.chat(user_input)  # 上云推理
else:
    result = await hybrid_agent.run(user_input)  # 端侧规划+云端执行
```

---

<!-- FOOTER:START -->

---

<table width="100%">
<tr>
<td align="left" width="33%">

<a href="01-business.md">← 💼 商业化分析</a>

</td>
<td align="center" width="34%">

<a href="README.md">↑ 返回品类首页</a> · <a href="../../../README.md">🏠 仓库首页</a>

</td>
<td align="right" width="33%">

<a href="03-cost.md">💰 成本与计费 →</a>

</td>
</tr>
</table>
<!-- FOOTER:END -->
