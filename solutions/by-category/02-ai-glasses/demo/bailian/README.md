# 02 AI 眼镜 · 百炼「一看即懂」参考 demo

一副带摄像头和耳机的 AI 眼镜：按住镜腿拍照并提问，松开后耳机播报回答。默认走「拍照即问」：`qwen3.8-omni-flash` 一次看图、听问，流式出文字，`qwen-audio-3.0-tts-flash` 边收文字边合成；`--realtime` 切到「给 AI 打电话」：`qwen3.8-omni-flash-realtime` 直接用语音回答，画面每秒推 1 帧。电脑的麦克风或 WAV 文件模拟镜腿麦克风，摄像头或 JPG 模拟镜腿摄像头。

> **状态：待真 Key 验证**（目前只通过 mock 冒烟）。验证记录见 [VERIFY.md](./VERIFY.md)，标准见 [demo-standard](../../../../demo-standard/README.md)。

## 三步跑通

1. 安装依赖（Python 3.9+）：`pip install -r requirements.txt`（live 需要 websocket-client；mock 只用标准库）
2. 填 Key：复制 `.env.example` 为 `.env`，填 `DASHSCOPE_API_KEY` 和 `DASHSCOPE_WORKSPACE_ID`（三个模型都走业务空间专属域名，地域默认北京）
3. 运行：`python3 run.py`（Windows 用 `python run.py`）；「给 AI 打电话」：`python3 run.py --realtime`

没有 Key 时，同一条命令自动进入 mock：离线回放官方响应和事件序列，不联网、不计费。`python3 run.py --mock` 强制 mock。

## 模拟的设备

| 眼镜部件 | 默认（文件模拟） | 真设备（可选，先 `pip install -r requirements-device.txt`） |
|---|---|---|
| 镜腿按键 + 麦克风 | `samples/ask_dish.wav`：「这是什么菜？辣不辣？」 | `--mic`：回车开始、回车结束，可连续多问 |
| 镜腿摄像头 | `samples/dish.jpg`：餐桌上的一盘宫保鸡丁，第一视角 | `--camera`：拍一张 640×480；`--realtime` 时每秒拍 1 帧 |
| 耳机 | 写入 `out/reply_N.wav`（24 kHz）；`--realtime` 写 `out/realtime_reply_N.wav` | 装了 sounddevice 时边收边播 |

量产时把 `Glasses.speak()` 换成蓝牙或开放式耳机的音频输出。

## 预期输出（mock）

```text
[设备] 按住镜腿 · 拍照 + 收音
[设备] 麦克风 ← ask_dish.wav（3.1 s）
[设备] 镜腿摄像头 ← dish.jpg（54 KB）
[设备] 松开镜腿 → 上传照片和提问，同时连好播报通道
[云端] 看图听问 qwen3.8-omni-flash（流式文字）→ 播报 qwen-audio-3.0-tts-flash（WebSocket · longanhuan_v3.6）
[眼镜] 这是宫保鸡丁，鸡丁配花生米、干辣椒和葱段，微辣带一点甜。怕辣的话把干辣椒拨到一边，配米饭正好。
[设备] 耳机 → out/reply_1.wav（0.7 s）
[统计] 第 1 问 · 松开镜腿 → 首字 —（mock 不计时） · 首包语音 —（mock 不计时） · ¥0.0093（看图听问 ¥0.00048：输入 444 / 输出 47 Token；播报 ¥0.0088：88 字符）
```

`python3 run.py --realtime`：

```text
[云端] 会话就绪：音色 Tina · 按住镜腿说话（Manual）· 画面 1 帧/秒 · representation_compact=normal
[设备] 松开镜腿 → 提交本轮（3.1 s 语音 + 4 帧画面）
[云端] 听到：这是什么菜？辣不辣？
[眼镜] 这是宫保鸡丁，鸡丁配花生米、干辣椒和葱段，微辣带一点甜。怕辣的话把干辣椒拨到一边，配米饭正好。
[设备] 耳机 → out/realtime_reply_1.wav（1.8 s）
[统计] 第 1 轮 · 松开镜腿 → 首包语音 —（mock 不计时） · ¥0.0023（输入 293（音频 23）/ 输出 178 Token；画面 4 帧，聚合 normal）
```

mock 的回答是固定示意内容，播报用提示音代替真实语音，用量按官方折算规则估算。真跑时 `[眼镜]` 一行是模型实时生成的回答，`[统计]` 给出实测首包延迟和按 `usage` 算出的费用。

## 链路

```text
默认：拍照即问（松开镜腿时开始计时）
  ├─ 看图听问：POST {base}/compatible-mode/v1/chat/completions
  │    model=qwen3.8-omni-flash
  │    user 消息 = [image_url(data:image/jpeg;base64,…), input_audio(data:;base64,…, format=wav), text(指令)]
  │    modalities=["text"]，stream=true，reasoning_effort="none"
  └─ 播报（与上一步同时建连）：wss://{业务空间ID}.cn-beijing.maas.aliyuncs.com/api-ws/v1/inference
       run-task(model=qwen-audio-3.0-tts-flash, voice, format=pcm, sample_rate=24000) → task-started
       每收到一段文字发一次 continue-task → 服务端自动分句，句子完整就合成 → 二进制音频帧 → 耳机
       finish-task → task-finished（payload.usage.characters 是计费字符数）

--realtime：给 AI 打电话
  wss://{业务空间ID}.cn-beijing.maas.aliyuncs.com/api-ws/v1/realtime?model=qwen3.8-omni-flash-realtime
  ├─ session.update：Manual（turn_detection=null）、音色、内置转写、video.input.representation_compact
  ├─ input_audio_buffer.append ×N（16 kHz PCM，100 ms 一包）+ 每秒 1 次 input_image_buffer.append（JPG）
  ├─ input_audio_buffer.commit → response.create          ← 松开镜腿，开始计时
  └─ response.audio.delta / response.audio_transcript.delta → 耳机；response.done.usage → 成本
```

`{base}` 是 `https://{业务空间ID}.cn-beijing.maas.aliyuncs.com`，新加坡把 `cn-beijing` 换成 `ap-southeast-1`。

- `qwen3.8-omni-flash` 只输出文字，所以默认链路要接 TTS；它默认开启深度思考（`reasoning_effort` 默认 `xhigh`），拍照即问传 `none` 关闭
- 本地音频按官方写法转成 `data:;base64,…` 并注明 `format`；图片、音频、文字放在同一条 user 消息里一次输入
- Qwen-Audio-TTS 的 HTTP 接口只在北京可用，WebSocket 两地都有，所以播报走 WebSocket；文字边生成边送合成，不用等整段回答
- `representation_compact` 要在发首段音频之前设置，之后不能再改

## 两种模式怎么选

| | 拍照即问（默认） | 给 AI 打电话（`--realtime`） |
|---|---|---|
| 交互 | 一问一答，每次独立 | 一通会话多轮，保留上下文（音频最多 600 秒、画面 240 秒） |
| 画面 | 一张照片，分辨率可以高（看菜单、路牌） | 每秒 1 帧持续推送，JPG 编码前 ≤190 KB |
| 回复 | 文字 → TTS，音色和语速可单独调 | 模型直接出语音 |
| 单次成本（北京，估算） | 约 ¥0.01，TTS 占九成 | 首轮约 ¥0.002–0.003，后续轮次逐步变贵 |

## 常用参数

| 参数 | 作用 |
|---|---|
| `--realtime` | 切到「给 AI 打电话」 |
| `--audio a.wav --audio b.wav` | 换提问，可多问（WAV 任意采样率，自动转 16 kHz 单声道） |
| `--image x.jpg` / `--camera` | 换画面 / 用摄像头 |
| `--mic` | 用麦克风提问，回车开始、回车结束 |
| `--compact none` | `--realtime` 不聚合画面表征（默认 `normal`，Token 约为 `none` 的 1/4） |
| `--voice longanfengyue` | 换音色；默认播报用 `longanhuan_v3.6`，`--realtime` 用 `Tina` |
| `--no-play` | 只写 WAV，不播放 |
| `--region ap-southeast-1` | 临时切到新加坡（Key 与业务空间也要换成新加坡的） |
| `--record` | 真跑成功后把一行验证记录追加到 `VERIFY.md` |

## 计费与延迟口径

单价（[模型价格](https://help.aliyun.com/zh/model-studio/model-pricing)、[qwen3.8-omni-flash-realtime 模型页](https://help.aliyun.com/zh/model-studio/qwen3-8-omni-flash-realtime)，查证 2026-10-01）：

| 模型 | 计费项 | 华北2（北京） | 新加坡 |
|---|---|---:|---:|
| `qwen3.8-omni-flash` | 输入（文本、图片、音频同价）/ 输出，元 / 百万 Token | 0.8 / 2.7 | 1.094 / 3.427 |
| `qwen-audio-3.0-tts-flash` | 元 / 万字符（一个汉字计 2 个字符） | 1 | 1.12413 |
| `qwen3.8-omni-flash-realtime` | 输入：音频 / 文本、图片，元 / 百万 Token | 6 / 1.5 | 6.781 / 1.677 |
| | 输出：文本 / 音频，元 / 百万 Token | 4.5 / 12 | 5.104 / 13.636 |

- Token 折算（[Qwen-Omni](https://help.aliyun.com/zh/model-studio/qwen-omni)、[Realtime](https://help.aliyun.com/zh/model-studio/realtime)）：输入音频每秒 7 Token，Realtime 输出音频每秒 12.5 Token；图片每 32×32 像素 1 Token，640×480 约 300 Token
- **拍照即问**：每问约 ¥0.01。看图听问约 440 输入 + 45 输出 Token，约 ¥0.0005；播报 45 个字左右约 90 个计费字符，约 ¥0.009。以接口返回的 `usage.characters` 为准
- **给 AI 打电话**：一轮约 ¥0.002–0.003。最大头是回答语音（10 秒约 125 Token，¥0.0015）；画面按 1 帧/秒、每 2 秒计 1 帧估算，`none` 时每分钟约 9,000 Token（¥0.014），`normal` 约 2,250 Token（¥0.003）
- 按目录价，`--realtime` 单轮反而比拍照即问便宜，因为 TTS 按字符计费、一个汉字算 2 个字符；但 Realtime 每次回答都会把上下文里保留的历史音频和画面再计一次输入，回答越多越贵，以 `usage` 为准
- 免费额度只在北京地域发放，各模型额度不同，以控制台为准；`qwen-audio-3.0-tts-flash` 只有 1 万字符
- 首字延迟 = 松开镜腿 → 首包语音。默认模式包含看图听问的首字和 TTS 首包，`[统计]` 里两者分开打印；网络影响大，记录时在「备注」写清网络环境

## 常见问题

- **提示缺少 `DASHSCOPE_WORKSPACE_ID`**：在百炼控制台「业务空间详情」复制 ID 填入 `.env`
- **401 / 403**：Key 与地域不一致，或业务空间 ID 不属于这个 Key
- **回答很慢、开头有长时间空白**：确认请求里带了 `reasoning_effort="none"`；`qwen3.8-omni-flash` 默认开深度思考
- **播报报音色错误**：音色必须属于所选 TTS 模型，`qwen-audio-3.0-tts-flash` 的系统音色只支持中文普通话和英文，例如 `longanhuan_v3.6`、`longanfengyue`
- **`--realtime` 图片报错**：只收 JPG / JPEG，编码前不超过 190 KB，建议 480P–720P
- **WAV 报错**：只支持 16-bit PCM WAV；其他格式先转：`ffmpeg -i in.m4a -ac 1 -ar 16000 -sample_fmt s16 out.wav`
- **Linux 上 `--mic` 报 PortAudio 错误**：先装系统库 `sudo apt install libportaudio2`
- **量产怎么接**：眼镜多数经手机 App 中转，App 侧可评估 AOQ SDK（内置回声消除和降噪）；设备不放长期 Key，由业务服务端下发临时 Key，见 [demo-standard](../../../../demo-standard/README.md)「设备侧凭证」

## 合规提示

- 拍摄他人时须告知：眼镜拍照、录像要有明显提示（如指示灯），不得偷拍。《民法典》规定未经肖像权人同意不得制作、使用、公开其肖像；《个人信息保护法》要求处理个人信息前告知并取得同意。拍到他人的画面只用于本次问答，不留存、不识别身份
- 照片和语音属于个人信息，上传云端前须告知佩戴者并取得同意，写明保存期限；画面里有人时，提示词要求模型不识别身份
- 本 demo 是开发者参考实现，不是面向公众的服务；面向公众上线前需完成生成式 AI 服务登记 / 备案与内容标识等义务

## 文件

| 文件 | 说明 |
|---|---|
| `run.py` | 入口：设备模拟 + 拍照即问（omni-flash + 流式 TTS）+ `--realtime` + 成本统计 |
| `mock.py` | 离线假接口：HTTP 流式响应、TTS 的 run-task 事件、Realtime 事件 |
| `demo_kit.py` | 百炼 demo 公共件（与模板逐字一致，勿单独修改） |
| `solution.yaml` | 方案清单 |
| `VERIFY.md` | 验证记录 |
| `samples/` | 模拟输入；来源见 [samples/README.md](./samples/README.md) |

旧版专题 demo：[`kit-chat/`](../kit-chat/)（多模态交互套件链路）、[`omni-realtime/`](../omni-realtime/)（`qwen3.5-omni-flash-realtime` + DashScope SDK）。

> ⚠️ AI 生成代码，仅作接入参考。协议字段以 [Qwen-Omni](https://help.aliyun.com/zh/model-studio/qwen-omni)、[实时语音合成 WebSocket](https://help.aliyun.com/zh/model-studio/cosyvoice-websocket-api)、[Realtime 客户端事件](https://help.aliyun.com/zh/model-studio/client-events)与[服务端事件](https://help.aliyun.com/zh/model-studio/server-events)文档为准。
