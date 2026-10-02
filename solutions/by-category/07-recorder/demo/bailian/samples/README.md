# samples · 模拟设备输入

| 文件 | 模拟 | 内容 | 来源 |
|---|---|---|---|
| `meeting.mp3` | 录音卡录下的会议 | 三人短会：新款录音卡试产排期 + 客户拜访，54.8 s，16 kHz 单声道 32 kbps | 离线合成（Kokoro-82M，Apache-2.0），2026-10-01 |
| `meeting_script.txt` | — | 上面录音的台词 | 本仓编写 |
| `meeting.json` | — | 每句的说话人、起止毫秒、文本；mock 直接回放它 | 合成时自动生成 |

重新生成（需 ffmpeg 与 Kokoro，demo 运行不需要）：

```bash
python3 ../../../../../demo-standard/tools/make_speech_sample.py meeting_script.txt meeting.mp3 \
  --voice 说话人1=zm_yunjian --voice 说话人2=zf_xiaoxiao --voice 说话人3=zm_yunxi
```

换成自己的录音：`python3 run.py --audio my.mp3`（≤5 分钟）或 `--audio-url https://…`（长录音）。真实会议录音须事先告知并取得参会人同意。
