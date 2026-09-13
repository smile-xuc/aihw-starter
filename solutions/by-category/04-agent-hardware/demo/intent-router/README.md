# intent-router — Agent 硬件端侧意图分发

三分法：`local` / `cloud` / `hybrid`，对应 [`02-solution.md`](../../02-solution.md) 第五节。

## 运行

```bash
python3 intent_router.py
python3 intent_router.py --text "把客厅灯关掉"
python3 intent_router.py --offline --text "解释一下量子纠缠"
python3 intent_router.py --json --text "查明天航班然后设个闹钟"
```

标准库即可，无需安装依赖，无需 API Key。

## 预期输出

- 「关灯」→ `route=local`，`tool=light.off`
- 「解释量子纠缠」→ `route=cloud`（在线）或离线拒答话术
- 「查航班然后设闹钟」→ `route=hybrid`；`--offline` 时降级提示

## 关键点

- 量产应用**规则优先 + 小模型兜底**；本 demo 只用关键词规则演示分流
- 离线时不得静默丢任务，须给可理解话术
- 危险工具（门锁 / 支付）需二次确认——本 demo 未实现，量产必补

> ⚠️ AI 生成代码，仅作接入参考。
