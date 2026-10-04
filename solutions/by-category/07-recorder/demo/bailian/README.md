# 07 录音卡 / 会议盒子 · 百炼录音纪要参考 demo

一张 AI 录音卡的会后流程：录音上传 → **qwen-audio-3.1-asr-flash-filetrans** 转写（单声道分离说话人，双声道按音轨整理）→ **qwen3.8-flash** 生成摘要、决策、待办和待确认事项。录音文件或电脑麦克风模拟录音卡，`out/` 目录模拟 App 收到的纪要。

> **状态：待真 Key 验证**。离线 mock 验证的是流程、输出格式和失败保留，不代表真实识别准确率或模型总结质量。验证记录见 [VERIFY.md](./VERIFY.md)，标准见 [demo-standard](../../../../demo-standard/README.md)。

## 三步跑通

1. 准备环境：Python 3.9+，只用标准库，不需要 `pip install`。
2. 填 Key：复制 `.env.example` 为 `.env`，填 `DASHSCOPE_API_KEY`；建议同时填 `DASHSCOPE_WORKSPACE_ID`，地域默认北京。
3. 运行：`python3 run.py`（Windows 用 `python run.py`）。

没有 Key 时自动进入 mock：回放 `samples/meeting.json`，不联网、不计费。`python3 run.py --mock` 强制 mock。默认样本和个人录音都走同一条文件识别流程。

## 模拟的设备

| 录音卡环节 | 默认（文件模拟） | 其他方式 |
|---|---|---|
| 会议录音 | `samples/meeting.mp3`：三人短会，54.8 s | `--audio my.m4a --channels 1`；`--mic`（需 `pip install -r requirements-device.txt`） |
| 录音上传 | 百炼临时存储 → `oss://` → filetrans 文件识别 | `--audio-url https://… --channels 1`：使用设备已经上传的公网录音 |
| 手机 App 纪要卡片 | `out/minutes.md`、`out/minutes.json`、`out/transcript.txt` | 量产时由业务服务端推送 |

单声道可尝试说话人分离；双声道选择 `[0,1]` 分别识别并按声道合并，声道不代表人物身份，每轨独立计费。不支持超过两声道。

filetrans 支持常见录音格式，单文件最多 12 小时 / 2 GB；启用说话人分离时官方建议不超过 2 小时，且需单声道。**临时存储单文件上限 100 MB**，因此本地上传路线还受这个更小的限制；更大的文件请用 `--audio-url` 指向自行管理的存储。临时存储 48 小时失效，官方注明仅供开发测试；生产环境使用自己的 OSS 等存储与访问控制。

本地 WAV / MP3 自动探测声道数；其他本地格式和公网 URL 必须明确传 `--channels 1` 或 `--channels 2`。声明与探测结果冲突、WAV / MP3 无法可靠探测或超过 2 声道时会拒绝处理，避免漏掉音轨。

| 声道 | filetrans 参数 | 输出含义 |
|---|---|---|
| 单声道 | `channel_id: [0]`、`diarization_enabled: true` | 按说话人标记转写；`--speakers` 可提供人数参考 |
| 双声道 | `channel_id: [0, 1]`、`diarization_enabled: false` | 保留两条音轨，按时间排序并标记「声道1 / 声道2」；声道不等于说话人 |

结果必须包含所有请求的声道；漏轨或声道标识无效会报错，不会把不完整转写交给总结。若双声道录音需要说话人分离，可先自行混音为单声道并核对两个音轨均已保留。

实时边录边转写可另接 `qwen-audio-3.1-asr-flash-streaming`。本入口先实现会后文件识别，`--mic` 也是录完后上传，不是实时字幕。

## 结果与原文

默认输出：

```text
[云端] 转写路线：临时上传 + 异步任务（默认文件识别）
[云端] 转写 qwen-audio-3.1-asr-flash-filetrans（异步任务 · 说话人分离）……
[云端] 转写完成 · 8 句 · 3 位说话人 · mock 不计时
[App] 转写已保存 → out/transcript.txt；纪要失败时仍可取用原文
[云端] 纪要 qwen3.8-flash（流式）……
[App] 推送纪要卡片 → out/minutes.md（另存 minutes.json、transcript.txt）
```

- 纪要分为摘要、议题、决策、待办、待定和风险；决策与待办可对照带时间戳的原文核对。
- 问句、提议与未承诺的建议不算已作出的决定；负责人只使用明确指派的信息，发言人不自动成为负责人。
- 未知负责人 / 期限在 JSON 中保持空字符串，在 Markdown 中显示「待确认」。期限保留「周五前」等原话，不补年份或推算日期。
- 转写先保存，再请求总结。总结失败或返回格式错误时保留 `transcript.txt`；上一次的 `minutes.*` 会清除，避免与本次原文混淆。
- mock 转写来自合成样本的真实台词与时间轴，纪要是固定示意。它不能验证模型是否遵循上述规则，真实质量验收见 [VERIFY.md](./VERIFY.md)。

## 链路

```text
录音卡 / 手机 App
  ├─ 本地文件：GET {base}/api/v1/uploads?action=getPolicy&model=…filetrans
  │    → POST {upload_host}（OSS 表单上传，file 字段放最后）→ oss://{upload_dir}/{文件名}
  ├─ 文件识别：POST {base}/api/v1/services/audio/asr/transcription
  │    请求头 X-DashScope-Async: enable；oss:// 地址另加 X-DashScope-OssResourceResolve: enable
  │    model=qwen-audio-3.1-asr-flash-filetrans
  │    单声道 parameters={channel_id:[0], diarization_enabled:true}
  │    双声道 parameters={channel_id:[0,1], diarization_enabled:false}
  │    → GET {base}/api/v1/tasks/{task_id} 轮询 → 下载 transcription_url（24 小时内有效）
  └─ 纪要：POST {base}/compatible-mode/v1/chat/completions
       model=qwen3.8-flash，stream=true，response_format=json_object，enable_thinking=false
```

`{base}` 由 `.env` 决定：

- 有业务空间 ID：`https://{业务空间ID}.cn-beijing.maas.aliyuncs.com`，新加坡为 `ap-southeast-1`。
- 没填时走通用域名 `https://dashscope.aliyuncs.com`，新加坡为 `https://dashscope-intl.aliyuncs.com`；官方推荐业务空间专属域名。
- 上传凭证接口专属域名返回 404 时，demo 自动退回通用域名，并打印 `[提示]`。

## 常用参数

| 参数 | 作用 |
|---|---|
| `--audio my.m4a --channels 1` | 换本地录音，默认临时上传 + filetrans；WAV / MP3 可省略声道声明 |
| `--audio-url https://… --channels 1` | 使用公网录音 URL，跳过临时上传，必须声明实际声道数 |
| `--channels 1` / `--channels 2` | 单 / 双声道；其他本地格式和 URL 必填，已探测格式的声明必须一致 |
| `--speakers 3` | 仅单声道 filetrans 使用的说话人数量参考值（2–100），不是强制人数 |
| `--mic [--seconds 60]` | 麦克风录完再上传；不给秒数时回车结束 |
| `--region ap-southeast-1` | 切到新加坡（Key 也应属于该地域） |
| `--record` | 真跑成功后追加一行到 `VERIFY.md` |
| `--long` | 保留兼容；现在默认已走 filetrans |
| `--quality` | 保留兼容；现在默认已使用 qwen3.8-flash |
| `--sync` | 显式对比旧同步 qwen-audio-3.1-asr-flash，仅短单声道 WAV / MP3；不适用的本地录音转 filetrans |

`--sync` 不是实时接口，不能与 `--audio-url` 同用。demo 仅将 ≤3 分钟的单声道 WAV / MP3 用于同步对比；MP3 按文件大小保守判断。最后一句结束时间明显早于录音结尾时会提示尾部可能缺失，但该提示不能证明转写是否完整；请对照原录音，去掉 `--sync` 改走默认文件识别复核。

## 计费与延迟口径

单价（元 / 百万 Token，[模型价格](https://help.aliyun.com/zh/model-studio/model-pricing)，核对 2026-10-04）：

| 模型 | 北京输入 / 输出 | 新加坡输入 / 输出 |
|---|---|---|
| `qwen-audio-3.1-asr-flash-filetrans`（含显式旧同步对比的 `qwen-audio-3.1-asr-flash`） | 0.8 / 2.7 | 1.094 / 3.427 |
| `qwen3.8-flash` | 0.8 / 2.7 | 1.094 / 3.427 |

- 仅在输入、输出 Token `usage` 都是有效非负整数时，才按返回值计算该阶段费用；显式零用量保留为零，缺失或无效字段不会当成免费。
- 转写使用 `input_tokens` / `output_tokens`，总结使用 `prompt_tokens` / `completion_tokens`。filetrans 只有 `usage.duration` 时，转写费用为**未知**，不按时长或转写字数换算 Token。
- 任一阶段缺完整有效 Token 用量，总费用就为未知；可分别展示另一阶段的已知费用。实际费用以百炼账单为准。
- mock 的用量与费用仅示意，不计费；免费额度与适用地域以当前官方页面为准。
- 首字延迟 = 录音结束（开始上传）→ 纪要首个 token，含上传与转写；另显示总结请求本身的首字时间。
- 本地停止或中断只会停止本地等待，不会取消已经提交的远端 filetrans 任务；远端仍可能继续执行并计费。

## 常见问题

- **401 / 403**：检查 Key、地域、业务空间与模型权限是否一致。
- **临时文件过大**：本地临时上传最多 100 MB；改用自己的存储和 `--audio-url`，仍需满足 filetrans 限制。
- **上传或转写 `oss://` 报错**：demo 已自动加解析请求头；临时文件超过 48 小时、上传凭证过期时需重新上传。
- **双声道没有说话人编号**：双声道按音轨输出，不启用说话人分离。需要分离时可先转单声道：`ffmpeg -i in.wav -ac 1 out.wav`，并核对混音结果。
- **声道未知 / 不完整**：其他本地格式与 URL 补上实际 `--channels 1/2`；服务结果漏轨时检查原录音及返回结构，不要把仅一轨的结果当作完整会议。
- **总结失败或纪要不完整**：先取 `out/transcript.txt` 核对原文；修复服务错误后重试。默认已用 qwen3.8-flash，`--quality` 不会再切换模型。
- **网页体验跨域失败**：CLI 不受浏览器 CORS 限制。网页的上传凭证、OSS 上传、任务轮询及结果下载仍需在真实浏览器和真实服务下验收；离线测试不能证明服务端跨域配置可用。

## 合规提示

- 录音前须告知并取得参会人同意；含个人信息的录音按《个人信息保护法》处理，转写与纪要设定保存期限。
- 本 demo 是开发者接入参考；面向公众的产品需按实际业务完成登记、备案与内容标识等义务。

## 文件

| 文件 | 说明 |
|---|---|
| `run.py` | 设备模拟、文件识别、纪要与费用统计 |
| `mock.py` | 离线假接口，校验默认模型和上传 / 文件识别流程 |
| `test_recorder.py` | 标准库离线专项回归，含总结失败保留原文 |
| `demo_kit.py` | 公共件，与模板逐字一致，不单独修改 |
| `solution.yaml` / `VERIFY.md` | 方案清单 / 验证记录 |
| `samples/` | 输入来源见 [samples/README.md](./samples/README.md) |

长会议分段摘要见 [`map-reduce-summary/`](../map-reduce-summary/)。接口以[非实时语音识别](https://help.aliyun.com/zh/model-studio/non-realtime-speech-recognition-user-guide)、[录音文件识别 HTTP API](https://help.aliyun.com/zh/model-studio/fun-asr-recorded-speech-recognition-http-api)、[同步 HTTP API](https://help.aliyun.com/en/model-studio/fun-asr-flash-recorded-speech-recognition-http-api)与[临时文件上传](https://help.aliyun.com/zh/model-studio/get-temporary-file-url)官方文档为准。
