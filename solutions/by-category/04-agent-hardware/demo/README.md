<!-- HERO:START -->
<div align="center">

<sub><a href="../../../../README.md">🏠 aihw-starter</a> &nbsp;›&nbsp; <a href="../README.md">🤖 Agent 硬件</a> &nbsp;›&nbsp; <b>🧪 Demo</b></sub>

# 🧪 Demo · Agent 硬件

`🤖 Agent 硬件` · `Demo`

</div>

---
<!-- HERO:END -->

> 本目录存放 Agent 硬件可运行示例。对应技术方案：[`02-solution.md`](../02-solution.md) 意图路由。

## 参考 demo（品类 × 栈）

按 [demo 统一标准](../../../demo-standard/README.md) 组织：每个栈一个目录，三步跑通，无 Key 自动 mock。

| 栈 | 目录 | 场景 | 状态 |
|---|---|---|---|
| 百炼 | [`bailian/`](./bailian/) | 桌面 AI 盒子：端侧规则先执行能做的 → `qwen3.8-flash` Function Calling 多轮编排本地设备与云端服务；语音指令经 `qwen-audio-3.1-asr-flash` 转写；断网降级 | 待真 Key 验证 |

## 专题 demo

### [`bailian-cli/`](./bailian-cli/) — 百炼 CLI 安装、鉴权与一次调用冒烟

用官方 `bl` 跑通「`--version` → `auth status` → 一次文本调用（可选一张图）」，产物写到 `out/`。导读见 [09 百炼 CLI](../../../by-solution/09-bailian-cli.md)。

```bash
cd bailian-cli
npm i -g bailian-cli@2.5.1
bash run.sh            # 没有 Key 时停在鉴权，不发请求
bash run.sh --mock     # 只看 --dry-run 请求体（CI 跑这一档）
```

需要 Node.js 18.17+；真跑需要 `DASHSCOPE_API_KEY` 或 `bl auth login`。待真 Key 验证。

### [`qwen-audio-agent/`](./qwen-audio-agent/) — 开源语音 Gateway：仅前台语音回合 + 语音委派后台改文件

钉 `qwen-audio-agent@2.0.1`。Demo C 只开 Realtime 前台（`AGENT_PROTOCOL=none`），说「你好」验证全双工回合；[Demo D `acp-edit/`](./qwen-audio-agent/acp-edit/) 接 Qwen Code 后台，用语音让它改 fixture 文件。导读见 [08 Qwen Audio Agent](../../../by-solution/08-qwen-audio-agent.md)。

```bash
cd qwen-audio-agent
npm i -g qwen-audio-agent@2.0.1
export DASHSCOPE_API_KEY=sk-xxxx
bash run.sh            # 预检 + 独立配置；没有 Key 时停在凭证
bash run.sh gateway    # 终端 1
bash run.sh webui      # 终端 2，允许麦克风后说「你好」
```

需要 Node.js ^22.22.2 / ^24.15.0 / >=26、麦克风和扬声器；本仓 CI 不跑。待真 Key 验证。

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
