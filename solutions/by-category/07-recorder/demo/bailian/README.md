# 07 录音卡 / 会议盒子 · 百炼录音纪要参考 demo

一张 AI 录音卡的会后流程：录音交给云端 → 转写并分出「谁说了什么」→ 生成带决策、待办、风险的纪要卡片推到手机 App。录音文件或电脑麦克风模拟录音卡，`out/` 目录模拟 App 收到的纪要。

> **状态：待真 Key 验证**（目前只通过 mock 冒烟）。验证记录见 [VERIFY.md](./VERIFY.md)，标准见 [demo-standard](../../../../demo-standard/README.md)。

## 三步跑通

1. 准备环境：Python 3.9+，只用标准库，不需要 `pip install`
2. 填 Key：复制 `.env.example` 为 `.env`，填 `DASHSCOPE_API_KEY`；建议同时填 `DASHSCOPE_WORKSPACE_ID`（走官方推荐的业务空间专属域名），地域默认北京
3. 运行：`python3 run.py`（Windows 用 `python run.py`）

没有 Key 时，同一条命令自动进入 mock：回放 `samples/meeting.json`，不联网、不计费。`python3 run.py --mock` 强制 mock。

## 模拟的设备

| 录音卡环节 | 默认（文件模拟） | 其他方式 |
|---|---|---|
| 会议录音 | `samples/meeting.mp3`：三人短会，54.8 s | `--audio my.m4a`（任意格式和时长，见下文路线）；`--mic`（需 `pip install -r requirements-device.txt`） |
| 长录音上传 | 超过 3 分钟或非 WAV / MP3 的本地文件，自动传到百炼临时存储 | `--audio-url https://…`：设备已把录音传到自己的公网存储（量产常见做法是 OSS + STS 临时凭证） |
| 手机 App 纪要卡片 | `out/minutes.md`、`out/minutes.json`、`out/transcript.txt` | 量产时由业务服务端推送 |

转写路线按录音自动选择，`[云端] 转写路线` 一行会写明原因：

| 录音 | 路线 | 模型 |
|---|---|---|
| ≤3 分钟的 WAV / MP3（默认样本） | 同步接口，本地文件直接 Base64 | `qwen-audio-3.1-asr-flash` |
| 更长、其他格式（m4a / aac / opus …），或加 `--long` | 百炼临时存储（`oss://`，48 小时）→ 异步任务 | `qwen-audio-3.1-asr-flash-filetrans` |
| `--audio-url` | 公网 URL → 异步任务 | `qwen-audio-3.1-asr-flash-filetrans` |

同步接口官方上限是 5 分钟，但单次最多输出 1,024 Token，密集讲话 3 分钟以上可能被截断，所以 demo 只把 ≤3 分钟的录音交给它。

## 预期输出（mock）

```text
[设备] 录音卡 · 会议录音 ← meeting.mp3（54.8 s，214 KB）
[设备] 录音结束 → 经手机 App 上传云端
[云端] 转写 qwen-audio-3.1-asr-flash（同步 · 说话人分离）……
[云端] 转写完成 · 8 句 · 3 位说话人 · mock 不计时
        [00:00] 说话人1：开个短会，今天就两件事：一是新款录音卡的试产排期，二是下周的客户拜访。
        [00:08] 说话人2：先说拜访。星云科技下周二见面，他们想先试点两百台，报价单我来准备。
        ……
[云端] 纪要 qwen3.7-flash（流式）……
[App] 推送纪要卡片 → out/minutes.md（另存 minutes.json、transcript.txt）
        # 新款录音卡试产排期与客户拜访
        ## 决策
        - 十月十二号按计划试产，二十八号小批量（说话人1）
        ## 待办
        - [ ] 与麦克风阵列供应商确认交期 · 说话人3 · 周三前
        ……
[统计] 录音结束 → 纪要首字 —（mock 不计时） · ¥0.0023（转写 ¥0.0017 + 纪要 ¥0.00054）
```

mock 的转写句子取自合成样本时记录的真实台词与时间轴，纪要内容是固定示意；真跑时两者都由模型生成。

## 链路

```text
录音卡 / 手机 App
  ├─ ≤3 分钟：POST {base}/api/v1/services/aigc/multimodal-generation/generation   ← 默认
  │    model=qwen-audio-3.1-asr-flash，input_audio.data=data:audio/mpeg;base64,…
  │    parameters={format, speaker_diarization_enabled: true} → output.sentences[].speaker_id
  ├─ 长录音（本地文件）：GET https://dashscope.aliyuncs.com/api/v1/uploads?action=getPolicy&model=…filetrans
  │    → POST {upload_host}（OSS 表单上传，file 字段放最后）→ oss://{upload_dir}/{文件名}
  ├─ 长录音：POST {base}/api/v1/services/audio/asr/transcription
  │    请求头 X-DashScope-Async: enable；oss:// 地址另加 X-DashScope-OssResourceResolve: enable
  │    model=qwen-audio-3.1-asr-flash-filetrans，parameters={channel_id:[0], diarization_enabled:true}
  │    → GET {base}/api/v1/tasks/{task_id} 轮询 → 下载 transcription_url（24 小时内有效）
  └─ 纪要：POST {base}/compatible-mode/v1/chat/completions
       model=qwen3.7-flash，stream=true，response_format=json_object，enable_thinking=false
```

`{base}` 由 `.env` 决定：填了业务空间 ID 是 `https://{业务空间ID}.cn-beijing.maas.aliyuncs.com`（新加坡为 `ap-southeast-1`），否则是通用域名 `https://dashscope.aliyuncs.com`（新加坡 `https://dashscope-intl.aliyuncs.com`）。通用域名自 2026-09-30 起不再支持新特性，建议填业务空间 ID。上传凭证接口按官方示例走通用域名。

## 常用参数

| 参数 | 作用 |
|---|---|
| `--audio my.m4a` | 换本地录音；路线见上表 |
| `--long` | 本地录音强制走「临时上传 + 异步任务」 |
| `--audio-url https://…` | 公网录音走异步 filetrans（≤12 小时、≤2 GB；开说话人分离时官方建议 ≤2 小时） |
| `--speakers 3` | 说话人数量参考值（2–100），仅异步路线有效 |
| `--mic [--seconds 60]` | 用麦克风录一段；不给秒数时回车结束 |
| `--region ap-southeast-1` | 临时切到新加坡（Key 也要换成新加坡的） |
| `--record` | 真跑成功后把一行验证记录追加到 `VERIFY.md` |

## 计费与延迟口径

单价（元 / 百万 Token，[模型价格](https://help.aliyun.com/zh/model-studio/model-pricing)，查证 2026-10-01）：

| 模型 | 华北2（北京）输入 / 输出 | 新加坡 输入 / 输出 |
|---|---|---|
| `qwen-audio-3.1-asr-flash`、`qwen-audio-3.1-asr-flash-filetrans` | 0.8 / 2.7 | 1.094 / 3.427 |
| `qwen3.7-flash`（单次输入 ≤32K；32K–256K 为 0.6 / 2.4，256K–1M 为 1.2 / 4.8） | 0.2 / 0.8 | 0.225 / 0.974 |

- 成本按接口返回的 `usage` 计算，纪要按输入 Token 所在档位计价。官方未写 3.1 ASR「每秒音频折合多少 Token」；接口没返回 Token 数时，demo 按每秒 25 Token 粗估并在 `[统计]` 里注明。按这个粗估，样本这样一段 55 秒短会，转写加纪要约 ¥0.002
- 免费额度（各 100 万 Token）只适用于北京地域
- 百炼临时存储免费，但 48 小时后失效、上传凭证接口限 100 QPS，官方注明不用于生产
- 首字延迟 = 录音结束（开始上传）→ 纪要首个 token，主要花在上传与转写上；`[统计]` 一行给出分项

## 常见问题

- **401 / 403**：Key 与地域不一致，或业务空间 ID 不属于这个 Key
- **上传或转写 `oss://` 报 400 `invalid_parameter_error`**：缺 `X-DashScope-OssResourceResolve` 请求头（demo 已自动加），或临时地址已过 48 小时；403 `AccessDenied` 表示上传凭证过期，重跑即可
- **同步转写报时长超限或结果不全**：MP3 无法在本地准确判断时长，超过 3 分钟的录音加 `--long`
- **说话人只有一位**：说话人分离只支持单声道；双声道录音先转：`ffmpeg -i in.wav -ac 1 out.wav`
- **纪要不是合法 JSON，或想要更强的纪要**：把 `LLM_MODEL` 换成 `qwen3.8-flash`（0.8 / 2.7）或 `qwen3.7-plus` 对比；改 `run.py` 顶部常量与单价表、`solution.yaml` 即可

## 合规提示

- 录音前须告知并取得参会人同意；含个人信息的录音按《个人信息保护法》处理，转写结果与纪要设定保存期限
- 本 demo 是开发者参考实现，不是面向公众的服务；面向公众上线前需完成生成式 AI 服务登记 / 备案与内容标识等义务

## 文件

| 文件 | 说明 |
|---|---|
| `run.py` | 入口：设备模拟 + 转写（同步 / 异步）+ 纪要 + 成本统计 |
| `mock.py` | 离线假接口，按官方响应结构回放 |
| `demo_kit.py` | 百炼 demo 公共件（与模板逐字一致，勿单独修改） |
| `solution.yaml` | 方案清单 |
| `VERIFY.md` | 验证记录 |
| `samples/` | 模拟输入；来源见 [samples/README.md](./samples/README.md) |

长会议的分段 Map-Reduce 摘要见旧 demo [`map-reduce-summary/`](../map-reduce-summary/)。

> ⚠️ AI 生成代码，仅作接入参考。接口字段以[非实时语音识别](https://help.aliyun.com/zh/model-studio/non-realtime-speech-recognition-user-guide)、[Qwen-Audio-3.x-ASR-Flash HTTP API](https://help.aliyun.com/en/model-studio/fun-asr-flash-recorded-speech-recognition-http-api)、[录音文件识别 HTTP API](https://help.aliyun.com/zh/model-studio/fun-asr-recorded-speech-recognition-http-api)（RESTful 支持 `oss://` 临时 URL）与[上传本地文件获取临时 URL](https://help.aliyun.com/zh/model-studio/get-temporary-file-url) 文档为准。
