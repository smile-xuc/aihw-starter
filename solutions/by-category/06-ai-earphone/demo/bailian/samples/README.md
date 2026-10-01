# samples · 模拟设备输入

| 文件 | 模拟 | 内容 | 来源 |
|---|---|---|---|
| `expo_guide_zh.wav` | 外宾戴的同传耳机听到的现场讲话 | 参观耳机生产线：讲解员（女声）与工程师（男声）两人中文讲解，3 句，15.8 s，16 kHz 单声道 16-bit PCM | 离线合成（Kokoro-82M，Apache-2.0），2026-10-01 |
| `expo_guide_script.txt` | — | 上面录音的台词 | 本仓编写 |
| `expo_guide_zh.json` | — | 每句的说话人、起止毫秒、文本；mock 按它的时间轴回放 | 合成时自动生成 |

mock 回放的英文译文写在 `mock.py`，为固定示意内容。

重新生成（需 ffmpeg 与 Kokoro，demo 运行不需要）：

```bash
python3 ../../../../../demo-standard/tools/make_speech_sample.py expo_guide_script.txt expo_guide_zh.wav \
  --voice 讲解员=zf_xiaoxiao --voice 工程师=zm_yunjian
```

换成自己的输入：`python3 run.py --audio my.wav`（任意采样率的 16-bit WAV，自动转 16 kHz 单声道），或加 `--mic` 直接对着麦克风说。用真实现场录音前，须告知并取得在场讲话人同意。
