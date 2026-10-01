# 04 Agent 硬件 · 百炼工具编排参考 demo

一台桌面 AI 盒子：一句指令先过端侧规则，本地能完成的（开关灯、设闹钟、调音量）直接执行、不上云；多步任务交给 `qwen3.7-flash` 做 Function Calling 多轮编排，同时调用本地设备工具和云端服务工具；断网时降级到端侧规则，做不了的部分明确说出来。文本、WAV 或电脑麦克风模拟盒子的语音入口（语音先经 `qwen-audio-3.1-asr-flash` 转写），控制台 `[设备]` 日志模拟灯光、闹钟和音量。

模型分两档：默认档 `qwen3.7-flash`，`--quality` 换质量档 `qwen3.8-flash` 对比编排效果与成本。两者都是混合思考模型、默认开思考，demo 显式传 `enable_thinking=false`。

> **状态：待真 Key 验证**（目前只通过 mock 冒烟）。验证记录见 [VERIFY.md](./VERIFY.md)，标准见 [demo-standard](../../../../demo-standard/README.md)。

## 三步跑通

1. 准备环境：Python 3.9+，只用标准库，不需要 `pip install`（用麦克风再装 `requirements-device.txt`）
2. 填 Key：复制 `.env.example` 为 `.env`，填 `DASHSCOPE_API_KEY`；建议同时填 `DASHSCOPE_WORKSPACE_ID`（走官方推荐的业务空间专属域名），地域默认北京
3. 运行：`python3 run.py`（Windows 用 `python run.py`）；`python3 run.py --offline` 看断网降级

没有 Key 时，同一条命令自动进入 mock：按官方响应结构离线回放，不联网、不计费。`python3 run.py --mock` 强制 mock。

## 模拟的设备

| 盒子部件 | 默认（文件模拟） | 其他方式 |
|---|---|---|
| 语音入口（按键说话） | 内置两条指令：文本「把客厅灯关掉」+ `samples/cmd_morning.wav`「明早七点叫我，顺便查一下杭州天气，要是下雨就提前半小时」 | `--text "…"`、`--audio my.wav`（都可重复）；`--mic`（需 `pip install -r requirements-device.txt`） |
| 灯光 / 闹钟 / 音量 | 控制台 `[设备]` 日志，结束时打印盒子状态 | 量产时把 `Box.tool_*()` 换成驱动调用 |
| 云端服务（天气、日程） | demo 内的固定示例数据，日志标「示例数据」 | 量产时接自己的天气 / 日历服务 |
| 扬声器 | 控制台 `[盒子]` 一行 | 量产时把播报文本交给 TTS（如 `qwen-audio-3.0-tts-flash`） |
| 网络 | 在线 | `--offline` 模拟断网 |

## 预期输出（mock）

```text
[设备] 指令（文本）：把客厅灯关掉
[设备] 端侧规则：本地关键词「关掉」 → 本地执行，不上云
[设备] 灯光：客厅 → 关
[盒子] 好的，客厅的灯已关闭。
[统计] 指令 1 · 端侧执行 · 工具 1 次 · 不上云 · ¥0
[设备] 麦克风 ← cmd_morning.wav（7.0 s）· 松开按键
[云端] 转写 qwen-audio-3.1-asr-flash……
[云端] 听到：明早七点叫我，顺便查一下杭州天气，要是下雨就提前半小时。（mock 不计时）
[云端] 多步线索「查一下」 → qwen3.7-flash 编排（Function Calling，流式）
[云端] 第 1 轮 → 调用 get_weather
[云端] 天气服务（示例数据）：杭州 明天 小雨 18–23℃，降水概率 70%
[云端] 第 2 轮 → 调用 set_alarm
[设备] 闹钟：明天 06:30「起床」
[盒子] 杭州明天小雨，18–23 度。闹钟已改到明早 06:30，出门记得带伞。
[统计] 指令 2 · 云端 3 轮 · 工具 2 次 · 说完指令 → 首个工具调用 —（mock 不计时） · ¥0.00074（转写 ¥0.00022 + 编排 ¥0.00053；编排共 2201 / 110 Token）
[设备] 盒子状态：灯 客厅关 · 闹钟 「起床」明天 06:30 · 音量 40
```

`--offline` 时第二条指令变成：

```text
[设备] 断网 → 端侧离线识别（模拟：读取 cmd_morning.json）：明早七点叫我，顺便查一下杭州天气，要是下雨就提前半小时。
[设备] 断网：多步线索「查一下」，拆成小句降级到端侧规则
[设备] 闹钟：明天 07:00「起床」
[盒子] 网络不可用。已设好明天 07:00 的闹钟。「查一下杭州天气」「要是下雨就提前半小时」需要联网，恢复网络后再说一次。
```

mock 的转写取自样本台词，编排按固定剧本回放（只覆盖查天气 + 闹钟、记日程两类），用量是示意值；真跑时由模型决定调用哪些工具、按什么顺序，`[统计]` 给出实测延迟和按 `usage` 计算的费用。

## 链路

```text
盒子（按键说话 / 文本）
  ├─ 语音：POST {base}/api/v1/services/aigc/multimodal-generation/generation（X-DashScope-SSE: disable）
  │    model=qwen-audio-3.1-asr-flash，input_audio.data=data:audio/wav;base64,…，parameters={format, sample_rate}
  ├─ 端侧规则 local_rules.py：classify() 三分 local / cloud / hybrid
  │    local 且能解析出参数 → Box 直接执行（不上云）
  └─ 其余：POST {base}/compatible-mode/v1/chat/completions（每轮一次，最多 4 轮）
       model=qwen3.7-flash（--quality：qwen3.8-flash），stream=true，enable_thinking=false，
       tools=[set_light, set_alarm, set_volume, get_weather, add_calendar]，parallel_tool_calls=true
       流式 delta.tool_calls：首块带 id 和 name，后续块只带 arguments 片段，按 index 拼接
       → 盒子执行工具（参数在宿主侧校验，不合法返回 ok=false 让模型修正）
       → messages 追加 assistant(tool_calls) + tool(tool_call_id, content) → 下一轮
       → 没有 tool_calls 时，content 就是播报内容
```

`{base}` 由 `.env` 决定：填了业务空间 ID 是 `https://{业务空间ID}.cn-beijing.maas.aliyuncs.com`（新加坡为 `ap-southeast-1`），否则是通用域名 `https://dashscope.aliyuncs.com`（新加坡 `https://dashscope-intl.aliyuncs.com`）。官方说明通用域名自 2026-09-30 起不再支持新特性，建议填业务空间 ID。

端侧规则沿用旧 demo [`intent-router/`](../intent-router/) 的关键词三分法，补了「叫我」「闹钟」「音量」「顺便」几个词。规则只负责高频、确定的指令；规则拿不准的交给模型，模型拿不到的（断网）由规则兜住一部分。

## 常用参数

| 参数 | 作用 |
|---|---|
| `--text "把音量调到 30"` | 文本指令，可重复 |
| `--audio my.wav` | 语音指令（16-bit WAV，建议单声道 16 kHz），可重复 |
| `--mic` | 用麦克风：回车开始、回车结束，可连续多条 |
| `--offline` | 模拟断网：只用端侧规则，演示降级；语音指令用样本附带的台词模拟端侧离线识别 |
| `--quality` | 编排改用质量档 `qwen3.8-flash` |
| `--region ap-southeast-1` | 临时切到新加坡（Key 也要换成新加坡的） |
| `--record` | 真跑成功后把一行验证记录追加到 `VERIFY.md` |

## 计费与延迟口径

单价（元 / 百万 Token，查证 2026-10-01，[qwen3.7-flash 模型页](https://help.aliyun.com/zh/model-studio/qwen3-7-flash)、[qwen3.8-flash 模型页](https://help.aliyun.com/zh/model-studio/qwen3-8-flash)、[模型价格](https://help.aliyun.com/zh/model-studio/model-pricing)）：

| 模型 | 华北2（北京）输入 / 输出 | 新加坡 输入 / 输出 |
|---|---|---|
| `qwen3.7-flash`（单次输入 ≤32K；32K–256K 为 0.6 / 2.4） | 0.2 / 0.8 | 0.225 / 0.974 |
| `qwen3.8-flash`（`--quality`，不分档） | 0.8 / 2.7 | 1.094 / 3.427 |
| `qwen-audio-3.1-asr-flash` | 0.8 / 2.7 | 1.094 / 3.427 |

- 多轮编排每一轮都要把系统提示、工具定义和之前的对话重新计入输入：样本指令 3 轮约 2,000–3,000 输入 Token，默认档约 ¥0.0006，质量档约 ¥0.0025；语音转写 7 秒约 ¥0.0002（音频 Token 折算率官方未公布，接口返回 `usage` 时以实际为准）
- 端侧命中的指令不上云、不计费；断网降级同样不计费
- 免费额度只在北京地域发放
- 首字延迟 = 说完指令（松开按键 / 提交文本）→ 首个工具调用到达（流式里第一个带函数名的 `tool_calls` 块），语音指令含转写耗时

## 常见问题

- **401 / 403**：Key 与地域不一致，或业务空间 ID 不属于这个 Key
- **模型不调用工具、直接回答**：确认 `tools` 已传；Qwen 系列不支持 `tool_choice="required"`，需要强制时用 `{"type":"function","function":{"name":…}}` 指定某个工具
- **编排变慢、输出 Token 变多**：确认请求里有 `enable_thinking=false`；Qwen3.5–3.8 系列不传就会先思考
- **想加新设备**：在 `TOOLS` 里加一项 schema，在 `Box` 里加同名的 `tool_<名字>` 方法并做参数校验；能用规则覆盖的高频说法再补进 `local_rules.py`
- **门锁、支付这类操作**：本 demo 有意不提供工具。真要接入，必须在设备或 App 上二次确认，不能只凭一句语音执行

## 合规提示

- 本 demo 是开发者参考实现，不是面向公众的服务；面向公众上线前需完成生成式 AI 服务登记 / 备案、内容标识等义务
- 语音指令可能录到旁人，设备上要有明确的收音指示（灯环）；只上传触发后的那一段录音
- 工具调用写本地审计日志，敏感操作二次确认，见 [02-solution.md](../../02-solution.md) 第七节

## 文件

| 文件 | 说明 |
|---|---|
| `run.py` | 入口：指令输入 + 转写 + 端侧路由 + 多轮工具编排 + 断网降级 + 成本统计 |
| `local_rules.py` | 端侧规则：意图三分（沿用旧 `intent-router`）+ 本地指令解析 |
| `mock.py` | 离线假接口，按官方响应结构回放 |
| `demo_kit.py` | 百炼 demo 公共件（与模板逐字一致，勿单独修改） |
| `solution.yaml` | 方案清单 |
| `VERIFY.md` | 验证记录 |
| `samples/` | 模拟输入；来源见 [samples/README.md](./samples/README.md) |

> ⚠️ AI 生成代码，仅作接入参考。接口字段以 [Function Calling](https://help.aliyun.com/zh/model-studio/qwen-function-calling) 与 [Qwen-Audio-3.x-ASR-Flash HTTP API](https://help.aliyun.com/en/model-studio/fun-asr-flash-recorded-speech-recognition-http-api) 文档为准。
