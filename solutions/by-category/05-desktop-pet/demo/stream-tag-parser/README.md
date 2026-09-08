# stream-tag-parser — 桌宠流式标签解析

「语音 + 表情 + 动作」三路同步的端侧核心：在 token 流上解析 `<M>…</M>` / `[emoji-xx]` / `[action-xx]`。

对应文档：[`02-solution.md`](../../02-solution.md) 第八节、第十节。

## 运行

```bash
python3 stream_tag_parser.py
python3 stream_tag_parser.py --chunk-size 1
python3 stream_tag_parser.py --text '<M>happy</M>[emoji-01][action-04]太棒啦！'
```

标准库即可，无需安装依赖，无需 API Key。

## 关键点

- 标签可能跨多个 token，**未闭合前不得触发舵机 / 表情**
- 每轮建议最多 1 emoji + 1 action；demo 超限会打印 WARN
- 坏标签在 `finish()` 时当纯文本丢掉，避免误动作

> ⚠️ AI 生成代码，仅作接入参考。
