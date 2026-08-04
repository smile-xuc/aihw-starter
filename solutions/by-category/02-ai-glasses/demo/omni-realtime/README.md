# 🧪 omni-realtime — 「给 AI 打电话」实时链路（高性能路线）

qwen3.5-omni-flash-realtime 的眼镜场景示例：**连续音频流 + 摄像头帧 → 全双工实时对话**。

- **定位**：高性能路线——亚秒级响应、原生可打断、AI 实时看你所见；按时长计费，成本高于套件基础对话一个数量级，适合旗舰档产品
- **对应文档**：[`02-solution.md` 第三节 · 附加项 B](../../02-solution.md)
- **与 kit-chat 的关系**：kit-chat 是「拍照单帧 + 按次调用」的性价比路线；本 demo 是「视频流 + 按时长」的高性能路线，两者按产品档位选用

## 运行

```bash
pip install -r requirements.txt
export DASHSCOPE_API_KEY=sk-xxxx   # 或复制 .env.example 为 .env

# 音频提问 + 一帧摄像头画面（模拟"边看边问"）
python glasses_omni_realtime.py --audio question.wav --frame view.jpg

# 纯语音通话
python glasses_omni_realtime.py --audio question.wav
```

输入要求：wav 为 16k 采样、16bit、单声道。输出：终端实时打印识别与回复文本，回复音频存为 `omni_reply.pcm`（24k）。

## 要点

- **帧率即成本**：视频帧按约 1 fps 推送已可支撑「看见你所见」，帧率翻倍成本近似翻倍
- **会话时长即成本**：产品交互用「按住通话/通话计时」明示用户，避免无感长连接
- **服务端 VAD**：`enable_turn_detection` 开启后自动断句，端侧无需自行判停

> ⚠️ AI 生成代码，仅作接入参考。realtime 协议与 SDK 接口以 [官方文档](https://help.aliyun.com/zh/model-studio/omni-realtime) 为准。
