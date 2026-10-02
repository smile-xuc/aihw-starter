<!-- HERO:START -->
<div align="center">

<sub><a href="../../../README.md">🏠 aihw-starter</a> &nbsp;›&nbsp; <a href="README.md">🤖 Agent 硬件</a> &nbsp;›&nbsp; <b>🛠️ 技术方案</b></sub>

# 🛠️ Agent 硬件 技术方案

`🤖 Agent 硬件` · `技术方案`

</div>

---
<!-- HERO:END -->

> 本文给出千问路径下的端云协同 Agent 硬件骨架。可跑的意图路由 demo 见 [`demo/intent-router/`](./demo/intent-router/)。

---

## 一、方案总览

| 维度 | 纯云端 | 端云协同（推荐） | 纯端侧 |
|------|--------|-----------------|--------|
| 延迟 | 200–500ms | 50–200ms | <50ms |
| 离线能力 | 无 | 基础任务可用 | 完全可用 |
| 推理能力 | 旗舰级 | 旗舰 + 轻量组合 | 受限 |
| 隐私 | 数据上云 | 敏感数据留端 | 完全本地 |
| 成本 | 低硬件 + 高云费 | 中等均衡 | 高硬件 + 零云费 |
| 适用 | 轻量试水 | 量产首选 | 高隐私 / 大批量 |

## 二、推荐架构：端云协同

```
┌─────────────────────────────────────────────┐
│              端侧（ARM SoC / NPU）            │
│  ┌──────────┐  ┌──────────┐  ┌───────────┐ │
│  │ 意图分类  │  │ 本地 SLM │  │ Agent调度  │ │
│  │(规则/0.5B)│  │(离线兜底) │  │   框架    │ │
│  └─────┬────┘  └────┬─────┘  └─────┬─────┘ │
└────────┼────────────┼───────────────┼───────┘
         │            │               │
    ═════╪════════════╪═══════════════╪═══ 网络
         │            │               │
┌────────┼────────────┼───────────────┼───────┐
│        ▼            ▼               ▼       │
│   [Qwen-Plus/Max] [工具调用 API]  [知识库/RAG] │
│              云端（百炼平台）                 │
└─────────────────────────────────────────────┘
```

## 三、关键设计要点

| 要点 | 说明 |
|------|------|
| 意图分发 | 端侧 3-class：`local` / `cloud` / `hybrid`；规则优先，模型兜底 |
| 离线兜底 | 网络断开时自动降级到本地 SLM / 固定话术，覆盖高频指令 |
| Agent 隔离 | 每个 Agent 独立沙箱，崩溃不影响主调度器 |
| 流式响应 | 云端首 token 目标 <200ms，端侧 TTS 边推理边播报 |
| 工具可恢复 | 多步任务写审计日志；失败可重试，不静默丢结果 |

## 四、Agent 调度框架选型

| 框架 | 优点 | 缺点 | 适用 |
|------|------|------|------|
| ReAct | 实现简单、推理链透明 | 多轮调用延迟叠加 | 单任务对话 |
| Plan-Execute | 复杂任务拆解能力强 | 规划阶段耗时 | 多步自动化 |
| Custom Router | 延迟最低、可硬编码热路径 | 开发成本高 | 量产优化 |

**推荐**：量产阶段采用 **Custom Router + ReAct 混合**——高频意图走硬编码快速路径，长尾任务走 ReAct 通用链路。

## 五、意图路由（与 demo 对齐）

```python
# 端侧意图分类 → 路由分发（示意；可跑版见 demo/intent-router）
intent = classify(user_input)  # rule / 0.5B, <30ms

if intent.route == "local":
    result = tool_agent.execute(user_input)      # 本地直接执行
elif intent.route == "cloud":
    result = await cloud_agent.chat(user_input)  # 上云推理
else:
    result = await hybrid_agent.run(user_input)  # 端侧规划 + 云端执行
```

### 5.1 建议的本地热路径

| 意图 | 示例 | 路由 |
|---|---|---|
| 设备控制 | 「把客厅灯关掉」 | `local` |
| 定时提醒 | 「10 分钟后叫我」 | `local` |
| 简单事实问答 | 「今天星期几」 | `local` 或本地日历 |
| 开放域问答 | 「解释一下量子纠缠」 | `cloud` |
| 多步任务 | 「查明天航班并设闹钟」 | `hybrid` |

## 六、千问接入要点

| 环节 | 建议 |
|---|---|
| 对话 | `qwen-plus` 主流；低频 / 控成本用 `qwen-flash` |
| 工具调用 | 使用 Function Calling；工具 schema 保持短、参数强校验 |
| ASR / TTS | 语音入口三段式；Realtime 仅高客单评估 |
| 计费 | 以官方目录价为准：https://help.aliyun.com/zh/model-studio/model-pricing |

## 七、安全与隐私

| 约束 | 实现 |
|---|---|
| 敏感指令确认 | 控门锁 / 支付类二次确认 |
| 数据最小化 | 本地执行路径不上云原文 |
| 审计 | 工具调用写本地日志，可导出 |
| 内容安全 | 云端走平台安全策略；端侧保留拒答表 |

## 八、与相邻方案的关系

- Omni Realtime 全双工：见 [`../../by-solution/01-qwen/omni-realtime/`](../../by-solution/01-qwen/omni-realtime/)
- 开源实时语音 harness（Realtime 前台对话 + 后台 Agent 异步办事，Gateway 自托管）：见 [`../../by-solution/08-qwen-audio-agent.md`](../../by-solution/08-qwen-audio-agent.md)
- 延迟横评：见 [`../../benchmark/`](../../benchmark/)
- 具身 / 机器人调度：见 [`../../by-solution/05-qwen-robot.md`](../../by-solution/05-qwen-robot.md)（勿与本品类混为一谈）

## 九、接入步骤

本仓可跑的是端侧规则分流，不发起真实模型请求。文件：[`demo/intent-router/`](./demo/intent-router/)。

1. 运行 `python3 intent_router.py`，或带 `--text` 传入一句话。标准库即可，不需要 API Key。
2. `classify()` 按关键词分成三条路由，与第五节一致：
   - `local`：设备控制、定时、简单事实，端侧直接给出工具名
   - `cloud`：开放域问答。在线时标为上云；`--offline` 时返回拒答话术
   - `hybrid`：句子里有多步线索。`--offline` 时降级为可理解话术，不静默丢任务
3. 第六节建议云端对话用 `qwen-plus`，控成本用 `qwen-flash`，工具走 Function Calling。本 demo 没有真实请求代码，调用参数待核实。
4. 门锁、支付类二次确认：demo README 写明未实现。
5. 真实请求体见百炼参考 demo [`demo/bailian/`](./demo/bailian/)：端侧规则 + `qwen3.8-flash` Function Calling 多轮编排 + 断网降级，无 Key 时自动 mock。

## 十、能力边界

- **能做（本仓 demo）**：关键词三分法；离线时给出话术而不是空结果
- **不能做（本仓 demo）**：真实云端推理；门锁 / 支付二次确认
- **待核实**：`qwen-plus` / `qwen-flash` 在桌面盒子上的时延与配额。第六节没有摘录官方 SLA

## 十一、官方文档与 SDK 链接

- [Function Calling](https://help.aliyun.com/zh/model-studio/qwen-function-calling)（查证 2026-09-30）
- [文本生成](https://help.aliyun.com/zh/model-studio/text-generation)（查证 2026-09-30）
- [首次调用千问 API](https://help.aliyun.com/zh/model-studio/first-api-call-to-qwen)（查证 2026-09-30）
- [安装百炼 SDK](https://help.aliyun.com/zh/model-studio/install-sdk)（查证 2026-09-30）
- [模型价格](https://help.aliyun.com/zh/model-studio/model-pricing)（查证 2026-09-30）

---

**版本**：千问大模型方案
**更新日期**：2026-09

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
