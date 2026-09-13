# metrics-prompt — 健康指标 → 自然语言解读

离线 mock：读结构化指标 JSON，生成日报文本 + `[ALERT]` 标签，并打印可送入 LLM 的 prompt 模板。

对应文档：[`02-solution.md`](../../02-solution.md)。

## 运行

```bash
python3 health_metrics_prompt.py
python3 health_metrics_prompt.py --metrics sample_day.json
python3 health_metrics_prompt.py --show-prompt
python3 health_metrics_prompt.py --json --metrics sample_day.json
```

标准库即可，无需 API Key。接入真实链路时：把 `--show-prompt` 的文本发给 `qwen-flash` / `qwen-plus`，保留末尾免责声明。

## 预期输出

- 默认样例：无严重告警或轻度提示
- `sample_day.json`：心率偏高 + 血氧最低偏低 + 睡眠不足 → 含 `[ALERT]`
- 文末固定：`以上为AI健康参考，不替代专业医疗意见。`

> ⚠️ AI 生成代码，仅作接入参考。**不做医疗诊断。**
