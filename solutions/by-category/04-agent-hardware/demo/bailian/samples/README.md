# samples · 模拟设备输入

| 文件 | 模拟 | 内容 | 来源 |
|---|---|---|---|
| `cmd_morning.wav` | 盒子麦克风录到的一句指令 | 「明早七点叫我，顺便查一下杭州天气，要是下雨就提前半小时。」7.0 s，16 kHz 单声道 16-bit | 离线合成（Kokoro-82M，Apache-2.0，音色 `zf_xiaoxiao`），2026-10-01 |
| `cmd_morning_script.txt` | — | 上面录音的台词 | 本仓编写 |
| `cmd_morning.json` | — | 台词与起止毫秒；mock 用它回放转写，`--offline` 用它模拟端侧离线识别 | 合成时自动生成 |

合成后用 Whisper（small）回听，识别为「明早7点叫我,顺便查一下杭州天气,要是下雨就提前半小时。」，与台词一致。

重新生成（需 ffmpeg 与 Kokoro，demo 运行不需要）：

```bash
python3 ../../../../../demo-standard/tools/make_speech_sample.py cmd_morning_script.txt cmd_morning.wav --voice "=zf_xiaoxiao"
```

换成自己的指令：`python3 run.py --audio my.wav`（WAV），或直接 `--text "…"`。
