# samples · 模拟设备输入

| 文件 | 模拟 | 内容 | 来源 |
|---|---|---|---|
| `owner_1.wav` | 桌宠麦克风（第 1 轮） | 「豆豆，方案终于交上去啦！」，3.6 s | 离线合成（Kokoro-82M，Apache-2.0，音色 `zf_xiaoxiao`），2026-10-01 |
| `owner_2.wav` | 桌宠麦克风（第 2 轮） | 「不过老板说下周还要大改，有点累。」，4.2 s | 同上 |
| `owner_3.wav` | 桌宠麦克风（第 3 轮） | 「好啦，先下班了，明天见。」，3.5 s | 同上 |
| `owner_script.txt` | — | 上面三句台词，一行对应一个文件 | 本仓编写 |

均为 16 kHz 单声道 16-bit PCM WAV，句尾带 0.45 s 静音。mock 回放的转写与回答写在 `mock.py`，与台词一致。

重新生成（需 ffmpeg 与 Kokoro，demo 运行不需要）：

```bash
for i in 1 2 3; do
  sed -n "${i}p" owner_script.txt > /tmp/owner_line.txt
  python3 ../../../../../demo-standard/tools/make_speech_sample.py /tmp/owner_line.txt owner_$i.wav --voice 主人=zf_xiaoxiao
done
rm -f owner_?.json
```

换成自己的输入：`python3 run.py --audio my1.wav --audio my2.wav`，或加 `--mic` 直接对着麦克风说。
