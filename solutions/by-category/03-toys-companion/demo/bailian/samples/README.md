# samples · 模拟设备输入

| 文件 | 模拟 | 内容 | 来源 |
|---|---|---|---|
| `kid_ask_story.wav` | 玩具麦克风 | 「帮我讲一个关于恐龙的小故事」，2.3 s，16 kHz 单声道 | 由本仓 [`benchmark/samples/q2_medium.wav`](../../../../../benchmark/samples/) 转码（`ffmpeg -ar 16000 -ac 1`） |
| `toy_cam.jpg` | 玩具眼睛摄像头 | 孩子双手举着绿色剑龙玩具（不含人脸），640×480，约 30 KB | AI 生成图片，2026-10-01 |

换成自己的输入：`python3 run.py --audio my.wav --image my.jpg`。需要新录音样本时，可用 [`make_speech_sample.py`](../../../../../demo-standard/tools/make_speech_sample.py) 离线合成。
