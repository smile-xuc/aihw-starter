# livetranslate-ws — AI 耳机同传最小 demo

演示「音频帧 → `translation.text` / `translation.audio`」回调节奏。

对应文档：[`02-solution.md`](../../02-solution.md)。

## 运行

```bash
# 离线 mock（无需 API Key，标准库即可）
python3 livetranslate_ws.py
python3 livetranslate_ws.py --mode mock --seconds 3 --target en

# 真实链路（可选）
pip install -r requirements.txt
cp .env.example .env   # 填入 DASHSCOPE_API_KEY
python3 livetranslate_ws.py --mode live --audio /path/to/16k_mono.wav
```

### 预期输出（mock）

- 打印 `[mock] connection opened`
- 若干 `[translation.text]` 增量字幕
- 配套 `[translation.audio]` 占位字节数
- 末尾 `[stats] frames=... text_events=...`

## 关键点

- 采音应在独立线程，避免阻塞 WebSocket 回调（本 demo 用同步 sleep 模拟节奏）
- 生产环境监听流式 `translation.text`，不要只等整段 done
- 对端无声时停传，节省配额

> ⚠️ AI 生成代码，仅作接入参考。live 模式 SDK 接口以官方文档为准。
