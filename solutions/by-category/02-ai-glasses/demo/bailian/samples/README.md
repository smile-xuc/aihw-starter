# samples · 模拟设备输入

| 文件 | 模拟 | 内容 | 来源 |
|---|---|---|---|
| `dish.jpg` | 镜腿摄像头 | 餐桌上的一盘宫保鸡丁、一碗米饭和筷子，第一视角，无人物、无可读文字，640×480，约 54 KB | AI 生成图片，2026-10-01 |
| `ask_dish.wav` | 镜腿麦克风 | 「这是什么菜？辣不辣？」，3.1 s，16 kHz 单声道 | 离线合成（Kokoro-82M，Apache-2.0，音色 `zf_xiaoxiao`），2026-10-01 |
| `ask_dish.txt` | — | 上面录音的台词 | 本仓编写 |
| `ask_dish.json` | — | 合成时记录的台词与起止毫秒 | 合成时自动生成 |

重新生成提问音频（需 ffmpeg 与 Kokoro，demo 运行不需要）：

```bash
python3 ../../../../../demo-standard/tools/make_speech_sample.py ask_dish.txt ask_dish.wav --voice 用户=zf_xiaoxiao
```

换成自己的输入：`python3 run.py --audio my.wav --image my.jpg`。拍摄他人前须告知并取得同意。
