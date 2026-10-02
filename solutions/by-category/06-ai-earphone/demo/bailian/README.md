# 06 AI 耳机 · 百炼实时同传参考 demo

一副同传耳机：外宾参观耳机工厂，讲解员和工程师说中文，耳机边听边出英文字幕和英文译音，并标出是谁在说。WAV 文件按实时节奏推流（或电脑麦克风）模拟耳机麦克风，控制台模拟 App 字幕，`out/translation.wav` 模拟耳机扬声器。模型：`qwen3.8-livetranslate-flash-realtime`。

> **状态：待真 Key 验证**（目前只通过 mock 冒烟）。验证记录见 [VERIFY.md](./VERIFY.md)，标准见 [demo-standard](../../../../demo-standard/README.md)。

## 三步跑通

1. 安装依赖（Python 3.9+）：`pip install -r requirements.txt`
2. 填 Key：复制 `.env.example` 为 `.env`，填 `DASHSCOPE_API_KEY`（百炼控制台「密钥管理」创建，只在创建时显示一次）和 `DASHSCOPE_WORKSPACE_ID`，地域默认北京（见下文「地域」）
3. 运行：`python3 run.py`（Windows 用 `python run.py`）

没有 Key 时，同一条命令自动进入 mock：按样本时间轴离线回放官方事件序列（10 倍速，约 2 秒跑完），不联网、不计费。`python3 run.py --mock` 强制 mock。

## 模拟的设备

| 耳机环节 | 默认（文件模拟） | 真设备（可选，先 `pip install -r requirements-device.txt`） |
|---|---|---|
| 耳机麦克风 | `samples/expo_guide_zh.wav`：讲解员 + 工程师两人中文讲解，15.8 s；100 ms 一包，按实时节奏推流 | `--mic`：边说边译，回车结束（或 `--seconds 30`） |
| App 字幕 | 控制台 `[耳机] 字幕` 增量；`out/subtitles.txt` 双语字幕（含说话人与时间） | 量产由手机 App 显示 |
| 耳机扬声器 | `out/translation.wav`（24 kHz） | 装了 sounddevice 时边收边播 |

## 预期输出（mock）

```text
[云端] 会话就绪：自动识别源语种 → en · 字幕 + 译音（24 kHz · 音色 Tina） · 断句 speaker_detection
[设备] 耳机麦克风 ← expo_guide_zh.wav（15.8 s），按 100 ms 一包 10 倍速推流
[耳机] 字幕（说话人1）：Hello everyone, and welcome
[云端] 原文（说话人1）：各位好，欢迎参观耳机生产线。
[耳机] 字幕（说话人1）：…to the earphone production line.
[耳机] 字幕（说话人2）：This is the acoustic test area. Every pair of earphones
[云端] 原文（说话人2）：这里是声学测试区，每副耳机出厂前都要做三道降噪检测。
[耳机] 字幕（说话人2）：…goes through three noise-cancellation checks before it leaves the factory.
[耳机] 字幕（说话人1）：After the tour, trial units
[设备] 讲话结束（共推流 15.8 s）→ session.finish，等待最后一句
[云端] 原文（说话人1）：参观结束后，可以在前台领取试用样机。
[耳机] 字幕（说话人1）：…are available at the front desk.
[App] 双语字幕 → out/subtitles.txt（3 句）
[设备] 耳机扬声器 → out/translation.wav（4.0 s）
[统计] 时延 —（mock 不计时） · 3 句 · ¥0.042（输入 112 / 输出 254 Token） · 折合每分钟 ¥0.160
```

译文在一句话还没说完时就开始出，这是同传「边听边出」的效果；原文识别完成后插一行原文，字幕用「…」续接。最后一句要等发出 `session.finish` 后才收尾。真跑时字幕和译音由模型实时生成，`[统计]` 给出首条字幕、首包译音、同传时延和按 `usage` 计算的费用；mock 的译文、提示音和用量都是固定示意值。

## 链路

```text
耳机（或手机 App 中转）
  │ WebSocket：wss://{业务空间ID}.cn-beijing.maas.aliyuncs.com/api-ws/v1/realtime?model=qwen3.8-livetranslate-flash-realtime
  ├─ session.update      output_modalities=["text","audio"]（--text-only 时 ["text"]）、translation.language=en
  ├─ input_audio_buffer.append ×N（16 kHz PCM，100 ms 一包，按实时节奏，与收事件在同一线程交替）   ← 首包发出时开始计时
  ├─ ← input_audio_buffer.speech_started（speaker_id）→ 原文 conversation.item.input_audio_transcription.delta / .completed
  ├─ ← conversation.item.created（previous_item_id = 原文项）→ response.audio_transcript.delta（字幕）+ response.audio.delta（译音）
  ├─ ← response.done.usage → 成本（每句一次）
  └─ session.finish → 等到 session.finished 再断开（不发它，最后一句的识别和翻译会丢）
```

- 3.8 的会话字段和事件与 3.5 不同：输出模态用 `output_modalities`（3.5 是 `modalities`）；字幕增量是 `response.text.delta` / `response.audio_transcript.delta`（3.5 是带 `stash` 的 `.text` 事件）；原文识别始终开启，不能关闭；默认 `speaker_detection` 断句，同时区分说话人；不支持 `same_language_skip_options`
- 官方示例直接用 `websocket-client` 收发原生事件，不经过 SDK 的 `TranslationRealtime`；旧 demo [`livetranslate-ws/`](../livetranslate-ws/) 是 3.5 的 SDK 回调写法，仍保留
- 原文与译文靠 `previous_item_id` 配对；说话人编号按首次出现的顺序显示为「说话人1、说话人2」
- 收发放在一个线程里按 100 ms 节拍交替：同一条 TLS 连接不要一个线程收、另一个线程同时发（OpenSSL 的连接对象不是线程安全的）。官方 Python 示例用的是「发送线程 + 主线程接收」，本地仿真中这种写法偶发会话开头被误判断开。麦克风采集和扬声器播放各用一个线程，它们不碰网络连接
- 量产不要在耳机或 App 里放长期 Key，改由业务服务端下发临时 Key（见 [demo-standard](../../../../demo-standard/README.md)「设备侧凭证」）；蓝牙耳机通常由手机 App 中转这条 WebSocket

## 常用参数

| 参数 | 作用 |
|---|---|
| `--audio my.wav` | 换输入（任意采样率的 16-bit WAV，自动转 16 kHz 单声道） |
| `--mic [--seconds 30]` | 用麦克风边说边译；不给秒数时按回车结束 |
| `--target ja` | 目标语种，默认 `en`。可出译音的 29 种：`zh` `en` `ja` `ko` `fr` `de` `es` `pt` `it` `ru` `ar` `id` `th` `vi` `tr` `hi` `ms` `nl` `ur` `nb` `sv` `da` `he` `fi` `pl` `is` `cs` `fil` `fa`；其余（如 `yue` 粤语）只出字幕，demo 自动切换 |
| `--text-only` | 只出字幕、不要译音，费用约为带译音的四分之一 |
| `--phrase 降噪=noise cancellation` | 热词，可重复，写入 `translation.corpus.phrases` |
| `--no-play` | 只写 WAV，不播放 |
| `--region ap-southeast-1` | 临时切到新加坡（Key 与业务空间也要换成新加坡的） |
| `--record` | 真跑成功后把一行验证记录追加到 `VERIFY.md` |

## 计费与延迟口径

`qwen3.8-livetranslate-flash-realtime` 单价（元 / 百万 Token，[模型页](https://help.aliyun.com/zh/model-studio/qwen3-8-livetranslate-flash-realtime)，查证 2026-10-01）：

| 计费项 | 华北2（北京） | 新加坡 |
|---|---:|---:|
| 音频输入 | 40 | 54.688 |
| 图片输入 | 3.3 | 4.01 |
| 文本输出 | 100 | 145.835 |
| 音频输出 | 160 | 218.752 |

- 折算（[使用指南](https://help.aliyun.com/zh/model-studio/qwen3-5-livetranslate-flash-realtime)「计费说明」）：输入音频每秒 7 Token，输出音频每秒 12.5 Token；模型页没有文本输入单价，`run.py` 把非音频输入按图片输入单价计
- 估算（北京）：每分钟讲话约 420 输入 + 750 输出音频 Token，约 ¥0.14；再加英文字幕约 200 文本 Token（约 ¥0.02），合计约 ¥0.16 / 分钟。`--text-only` 约 ¥0.04 / 分钟。mock 的示意用量按同一口径
- 原文识别：3.8 的[客户端事件](https://help.aliyun.com/zh/model-studio/live-translator-client-events)写明 ASR 始终开启、识别结果免费；使用指南「计费说明」另有一句「源语言识别文本按输出文本计费」，没有区分型号。以真跑时的 `usage` 为准
- 首字延迟 = 首包音频发出（开口）→ 首条译文字幕；另记首包译音和「同传时延」（每句开口 → 该句首个译文，官方称低至 2.3 秒）。受网络影响大，记录时在「备注」写清网络环境
- 限流：北京、新加坡均为 10 RPM、10 万 TPM；每次运行占一次请求，多路演示要排队

## 地域

| 地域 | `.env` 里的 `DASHSCOPE_API_REGION` | 同传地址 |
|---|---|---|
| 华北2（北京） | `cn-beijing` | `wss://{业务空间ID}.cn-beijing.maas.aliyuncs.com/api-ws/v1/realtime` |
| 新加坡 | `ap-southeast-1` | `wss://{业务空间ID}.ap-southeast-1.maas.aliyuncs.com/api-ws/v1/realtime` |

使用指南给出的 3.8 调用地址只有业务空间专属域名，所以 `DASHSCOPE_WORKSPACE_ID` 必填；Key、业务空间与地域三者要一致。

## 常见问题

- **提示缺少 `DASHSCOPE_WORKSPACE_ID`**：在百炼控制台「业务空间管理」页的 API Host 列复制业务空间 ID（形如 `llm-xxx`）填入 `.env`
- **连接时报 401 / 403**：Key 与地域不一致（例如北京的 Key 配了 `ap-southeast-1`），或业务空间 ID 不属于这个 Key
- **连上了但一直没有字幕**：确认 WAV 里有人声；推流要接近实时节奏（官方示例同样是 100 ms 一包、每包间隔 0.1 秒）
- **最后一句没有翻译**：必须发 `session.finish` 并等到 `session.finished`；中途按 Ctrl+C 会丢最后一句
- **想换译音音色或复刻讲话人音色**：3.8 的 `session.update` 文档没有列出音色字段，默认 `Tina`。复刻发言人音色（`enable_voice_clone`）的官方示例用的是 3.5 的会话字段，需要时可改用 `qwen3.5-livetranslate-flash-realtime`；复刻音色创建免费，绑定实际使用的模型（`target_model`），每个账号最多 1,000 个，见[声音复刻](https://help.aliyun.com/zh/model-studio/voice-cloning-user-guide)
- **粤语**：粤语作为目标语种只能出字幕；需要粤语语音时，可改用 `qwen3.8-omni-flash-realtime` 做对话式翻译
- **Linux 上 `--mic` 报 PortAudio 错误**：先装系统库 `sudo apt install libportaudio2`

## 合规提示

- 同传会采集在场其他人的讲话：使用前告知讲话人并取得同意；字幕与译音默认只写本机 `out/`，量产要设定保存期限，含个人信息时按《个人信息保护法》处理
- 机器翻译可能出错，医疗、法律、合同等场合要人工复核
- 本 demo 是开发者参考实现，不是面向公众的服务；面向公众上线前需完成生成式 AI 服务登记 / 备案与内容标识等义务

## 文件

| 文件 | 说明 |
|---|---|
| `run.py` | 入口：推流线程 + 同传协议 + 原文 / 字幕 / 译音配对 + 成本与时延统计 |
| `mock.py` | 离线假服务端，按样本时间轴和官方事件结构回放 |
| `demo_kit.py` | 百炼 demo 公共件（与模板逐字一致，勿单独修改） |
| `solution.yaml` | 方案清单 |
| `VERIFY.md` | 验证记录 |
| `samples/` | 模拟输入；来源见 [samples/README.md](./samples/README.md) |

> ⚠️ AI 生成代码，仅作接入参考。协议字段以[客户端事件](https://help.aliyun.com/zh/model-studio/live-translator-client-events)与[服务端事件](https://help.aliyun.com/zh/model-studio/live-translator-server-events)为准。
