# map-reduce-summary — 长会议 Map-Reduce 纪要

把带说话人的长中文逐字稿切段 → Map 抽取议程 / 决策 / 待办 → Reduce 合并为结构化纪要。

对应文档：[`02-solution.md`](../../02-solution.md) 第三节、4.3 节。

## 运行（离线优先）

标准库即可，**无需 API Key**：

```bash
python3 map_reduce_summary.py
python3 map_reduce_summary.py --chunk-chars 280
python3 map_reduce_summary.py --write-sample   # 导出内置样例到 sample_transcript.txt
python3 map_reduce_summary.py --transcript sample_transcript.txt
```

## 可选：在线千问

```bash
pip install -r requirements.txt
cp .env.example .env
# 编辑 .env，填入 DASHSCOPE_API_KEY
export $(grep -v '^#' .env | xargs)   # 或手动 export
python3 map_reduce_summary.py --live
python3 map_reduce_summary.py --live --model qwen-plus
```

## 预期输出（离线 mock）

应看到类似结构（具体条数随切段变化）：

```text
=== Map：N 个 chunk ... mode=mock ===
...
=== Reduce：合并去重 ===
# 周会纪要（Map-Reduce demo）

## 议程
- Q3 销售复盘
- 新品发布排期
- 客户拜访分工
...

## 决策
- 华南促销预算追加到 80 万（责任人：说话人C ...）
...

## 待办
- [H] ...（说话人D，期限：明天...）
...

## 未决问题 / 风险
...
=== JSON ===
{ "title": "...", "agenda": [...], "decisions": [...], ... }
```

## 关键点

- **先切段再摘要**：不要把 1–3 小时全文一次性塞进 LLM
- **Map 便宜、Reduce 认真**：生产可将 Map 用 qwen-flash、Reduce 用 qwen-plus
- **离线 mock 只为演示字段结构**：规则抽取不能替代模型；接真模型用 `--live`

## 文件清单

| 文件 | 说明 |
|---|---|
| `map_reduce_summary.py` | 主脚本（mock / live 双模式） |
| `requirements.txt` | live 模式依赖 |
| `.env.example` | API Key 示例 |

> ⚠️ AI 生成代码，仅作接入参考。
