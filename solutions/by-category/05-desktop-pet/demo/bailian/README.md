# 05 桌宠 · 百炼实时语音陪伴参考 demo

一只住在书桌上的 AI 桌宠「豆豆」：按住头顶按键说话 → `qwen3.8-omni-flash-realtime` 实时语音回答，同时用 Function Calling 切换屏幕表情、做动作、联动灯光；结束时 `qwen3.7-flash` 以桌宠第一人称写陪伴日记、提炼记忆点，下次开机注入系统提示词。电脑麦克风或 WAV 文件模拟桌宠麦克风，控制台字符画模拟头顶小圆屏。

> **状态：待真 Key 验证**（目前只通过 mock 冒烟）。验证记录见 [VERIFY.md](./VERIFY.md)，标准见 [demo-standard](../../../../demo-standard/README.md)。

## 三步跑通

1. 安装依赖（Python 3.9+）：`pip install -r requirements.txt`
2. 填 Key：复制 `.env.example` 为 `.env`，填 `DASHSCOPE_API_KEY`（百炼控制台「密钥管理」创建，只在创建时显示一次）和 `DASHSCOPE_WORKSPACE_ID`，地域默认北京（见下文「地域」）
3. 运行：`python3 run.py`（Windows 用 `python run.py`）

没有 Key 时，同一条命令自动进入 mock：离线回放官方事件序列，不联网、不计费。`python3 run.py --mock` 强制 mock。

## 模拟的设备

| 桌宠部件 | 默认（文件模拟） | 真设备（可选，先 `pip install -r requirements-device.txt`） |
|---|---|---|
| 麦克风（按住头顶按键说话） | `samples/owner_1~3.wav`：下班前和桌宠聊三句 | `--mic`：回车开始、回车结束，可连续多轮 |
| 头顶小圆屏 | 控制台字符画，7 种表情 | 量产时把 `Pet.show()` 换成屏幕驱动 |
| 四足舵机 / 灯光 | 控制台打印 `[设备] 屏幕：… · 动作：… · 灯光：…` | 量产时把 `Pet.act()` 换成舵机 / LED 驱动 |
| 扬声器 | 写入 `out/reply_N.wav`（24 kHz） | 装了 sounddevice 时边收边播 |
| 记忆缓存 | `out/memory.json`（mock 写 `out/memory.mock.json`，互不混用） | 量产放云端用户档案 + 设备缓存摘要 |
| 手机 App 日记卡片 | `out/diary.md` | 量产由业务服务端推送 |

## 预期输出（mock）

```text
[设备] 屏幕：我是 AI 桌宠「豆豆」，对话内容由 AI 生成
[云端] 会话就绪：音色 longanlingxin · 按键说话（Manual） · 已注册 pet_expression
[设备] 麦克风 ← owner_1.wav（3.6 s）
[设备] 按键松开 → 提交本轮
[云端] 听到：豆豆，方案终于交上去啦！
[设备] 屏幕：大笑 · 动作：跳一下 · 灯光：暖黄呼吸（pet_expression）
        .-----------.
        |  ^     ^  |
        |   \___/   |
        '-----------'
[豆豆] 哇，交上去啦！这几天熬夜辛苦了，必须跳一下庆祝！今晚早点休息吧。
[统计] 第 1 轮 · 首包音频 —（mock 不计时） · ¥0.0037（输入 1492 / 输出 132 Token）
……（第 2、3 轮）
[设备] 听到道别 → 结束陪伴，屏幕切换为待机表情
[云端] 陪伴日记 qwen3.7-flash（流式 JSON）……
[App] 推送陪伴日记 → out/diary.md
        # YYYY-MM-DD（运行当天） · 豆豆的日记：方案交上去的一天
        今天主人把熬了好几天的方案交上去了，我跳了一下帮主人庆祝！……
        今日心情：疲惫 ⭐⭐⭐ | 互动次数：3 次 | 最爱动作：跳一下
[设备] 记忆写回 out/memory.mock.json：共 2 条（下次开机注入系统提示词）
[统计] 陪伴 3 轮 · 每轮均值 ¥0.0041 · 日记 ¥0.00027（输入 511 / 输出 211 Token）
```

再运行一次，开机时会先打印 `[设备] 读取记忆 out/memory.mock.json：2 条 · 上次想关心：问问修改清单列好了没有`，这些记忆已写进本次会话的系统提示词。真跑时 `[豆豆]` 一行和日记由模型生成，`[统计]` 给出实测首包延迟和按 `usage` 计算的费用；mock 的回答、提示音、日记内容和用量都是固定示意值，日记标题的日期取运行当天。

## 链路

```text
桌宠（麦克风 + 头顶小圆屏 + 舵机 + LED + 扬声器）
  │ WebSocket：wss://{业务空间ID}.cn-beijing.maas.aliyuncs.com/api-ws/v1/realtime?model=qwen3.8-omni-flash-realtime
  ├─ session.update      Manual 模式（turn_detection=null）、音色、内置转写、tools=[pet_expression]、instructions（含记忆）
  ├─ input_audio_buffer.append ×N（16 kHz PCM，100 ms 一包）
  ├─ input_audio_buffer.commit → response.create          ← 松开按键，开始计时
  ├─ response.done 里有 function_call → 屏幕 / 舵机 / 灯光 → conversation.item.create(function_call_output) → response.create
  └─ response.audio.delta / response.audio_transcript.delta → 扬声器；response.done.usage → 成本
结束陪伴
  └─ POST {base}/compatible-mode/v1/chat/completions
       model=qwen3.7-flash，stream=true，response_format=json_object，enable_thinking=false
       → out/diary.md（日记）+ out/memory.json（记忆卡片，下次开机注入 instructions）
```

- 品类方案推荐的「标签嵌入式」（`[emoji-01][action-04]` 写在回复文字里）适合「文本模型 + TTS」链路；实时语音模型会把文字直接说出来，标签也会被念出来，所以本 demo 改用 Function Calling 的 `pet_expression`。离线标签解析见旧 demo [`stream-tag-parser/`](../stream-tag-parser/)
- 实时模型没用单价相同的纯语音模型 `qwen-audio-3.0-realtime-flash`：本 demo 靠 Function Calling 切换表情，`qwen3.8-omni-flash-realtime` 官方明确支持自定义工具调用；多轮对话时它的历史音频按每秒 7 Token 重复计入输入（`qwen-audio-3.0-realtime-flash` 收发都按每秒 12.5 Token），聊得越久越省；协议代码也能直接复用 03 试点
- `{base}` 是 `https://{业务空间ID}.cn-beijing.maas.aliyuncs.com`（新加坡为 `ap-southeast-1`）：本 demo 必须填业务空间 ID，日记请求也走专属域名
- 固件端照搬这条 WebSocket 即可；量产不要在设备里放长期 Key，改由业务服务端下发临时 Key（见 [demo-standard](../../../../demo-standard/README.md)「设备侧凭证」）

## 常用参数

| 参数 | 作用 |
|---|---|
| `--audio a.wav --audio b.wav` | 换输入，可多轮（WAV 任意采样率，自动转 16 kHz 单声道） |
| `--mic` | 用麦克风，回车开始 / 结束；输入 `q`，或说「再见」「明天见」结束 |
| `--voice Tina` | 换音色（默认 `longanlingxin` 知心温暖音；官方默认 `Tina`） |
| `--no-diary` | 结束时不写日记、不更新记忆 |
| `--forget` | 开机前删除记忆文件，从零开始 |
| `--no-play` | 只写 WAV，不播放 |
| `--region ap-southeast-1` | 临时切到新加坡（Key 与业务空间也要换成新加坡的） |
| `--record` | 真跑成功后把一行验证记录追加到 `VERIFY.md` |

## 计费与延迟口径

单价（元 / 百万 Token，查证 2026-10-01）：

| 模型 | 计费项 | 华北2（北京） | 新加坡 |
|---|---|---:|---:|
| `qwen3.8-omni-flash-realtime` | 输入：音频 | 6 | 6.781 |
| | 输入：文本 / 图片 / 视频 | 1.5 | 1.677 |
| | 输出：文本 | 4.5 | 5.104 |
| | 输出：音频 | 12 | 13.636 |
| `qwen3.7-flash`（单次输入 ≤32K） | 输入 / 输出 | 0.2 / 0.8 | 0.225 / 0.974 |

来源：[qwen3.8-omni-flash-realtime 模型页](https://help.aliyun.com/zh/model-studio/qwen3-8-omni-flash-realtime)、[qwen3.7-flash 模型页](https://help.aliyun.com/zh/model-studio/qwen3-7-flash)、[Realtime 计费说明](https://www.alibabacloud.com/help/zh/model-studio/realtime)。

- 音频折算：输入 7 Token / 秒、输出 12.5 Token / 秒；输出语音时，音频和对应文本分别计费
- 每轮有两次 `response.done`（先调 `pet_expression`，再说话），两次都计输入上下文。按目录价估算（提问 3–5 秒、回答 5–10 秒、系统提示词约 700 Token）：首轮约 ¥0.004；历史音频和文字逐轮重复计入输入，聊到第 10 轮约 ¥0.008。`[统计]` 按每轮实际 `usage` 计算
- 记忆注入后，系统提示词每轮多出几十到上百个 Token；记忆最多保存 20 条，每次注入最近 10 条
- 日记每天一次，约 500–1,000 输入 + 200–300 输出 Token，约 ¥0.0003（北京）
- 首字延迟 = 松开按键 → 首包音频，含 `pet_expression` 往返，受网络影响大；记录时在「备注」写清网络环境
- 免费额度只适用于北京地域；`qwen3.8-omni-flash-realtime` 限流为北京、新加坡均 60 RPM

## 地域

| 地域 | `.env` 里的 `DASHSCOPE_API_REGION` | Realtime 地址 |
|---|---|---|
| 华北2（北京） | `cn-beijing` | `wss://{业务空间ID}.cn-beijing.maas.aliyuncs.com/api-ws/v1/realtime` |
| 新加坡 | `ap-southeast-1` | `wss://{业务空间ID}.ap-southeast-1.maas.aliyuncs.com/api-ws/v1/realtime` |

`qwen3.8-omni-flash-realtime` 必须使用业务空间专属域名，所以 `DASHSCOPE_WORKSPACE_ID` 必填；Key、业务空间与地域三者要一致。来源：[Qwen-Omni-Realtime 文档](https://help.aliyun.com/zh/model-studio/realtime)（2026-09-24）。

## 常见问题

- **提示缺少 `DASHSCOPE_WORKSPACE_ID`**：在百炼控制台「业务空间管理」页的 API Host 列复制业务空间 ID（形如 `llm-xxx`）填入 `.env`
- **连接时报 401 / 403**：Key 与地域不一致（例如北京的 Key 配了 `ap-southeast-1`），或业务空间 ID 不属于这个 Key
- **模型没有调用 `pet_expression`**：提示词已要求每次回答前先调用；实测仍有遗漏时，在设备端保留上一个表情或按回答文字的情绪兜底
- **想用复刻音色**：复刻音色要先通过声音复刻接口创建，并绑定实际使用的模型（`target_model`，不能跨模型）；创建免费，每个账号最多 1,000 个
- **日记不是合法 JSON**：重跑一次；仍失败时把 `DIARY_MODEL` 换成 `qwen3.8-flash` 对比
- **WAV 报错**：只支持 16-bit PCM WAV；其他格式先转：`ffmpeg -i in.m4a -ac 1 -ar 16000 -sample_fmt s16 out.wav`
- **Linux 上 `--mic` 报 PortAudio 错误**：先装系统库 `sudo apt install libportaudio2`

## 合规提示

桌宠这类「持续性的情感陪伴」面向境内公众提供时，适用《人工智能拟人化互动服务管理暂行办法》（2026-07-15 施行，[网信办原文](https://www.cac.gov.cn/2026-04/10/c_1777558395078289.htm)）。本 demo 的对应做法：

- **第十八条 AI 身份与使用时长**：开机屏幕提示「AI 桌宠、内容由 AI 生成」；连续使用每满 2 小时，屏幕提醒注意使用时长（`REMIND_SECONDS`）
- **第八条第（五）项、第十条 防沉迷**：系统提示词要求不诱导情感依赖、不扮演恋人 / 伴侣 / 家人，并鼓励主人多和朋友、家人来往
- **第十四条 未成年人**：不得向未成年人提供虚拟亲属、虚拟伴侣服务；面向未成年人还需未成年人模式、定期现实提醒和使用时长限制
- **第十三条 极端情绪**：提到自伤、轻生时，回答劝其马上联系身边信任的人或心理援助热线；正式产品还需按规定干预并联络监护人或紧急联系人
- **第十六条 交互数据**：日记和记忆只存在本机 `out/` 目录，删除文件或加 `--forget` 即清空；量产要提供聊天记录复制、删除选项，未经单独同意不得把敏感交互数据用于模型训练；记忆提炼提示词已要求不记录住址、电话、证件号、病情诊断
- **第十九条 退出**：说「再见」「明天见」或输入 `q` 立即结束，回答不挽留

本 demo 是开发者参考实现，不是面向公众的服务；上线前还需完成算法备案（第二十六条）、安全评估（第二十二条）与生成内容标识等义务。

## 文件

| 文件 | 说明 |
|---|---|
| `run.py` | 入口：设备模拟 + Realtime 协议 + 工具调用 + 成本统计 |
| `diary.py` | 每日记忆日记：写日记、提炼与合并记忆卡片、开机注入系统提示词 |
| `mock.py` | 离线假服务端：Realtime 事件与日记流式响应，按官方结构回放 |
| `demo_kit.py` | 百炼 demo 公共件（与模板逐字一致，勿单独修改） |
| `solution.yaml` | 方案清单 |
| `VERIFY.md` | 验证记录 |
| `samples/` | 模拟输入；来源见 [samples/README.md](./samples/README.md) |

> ⚠️ AI 生成代码，仅作接入参考。协议字段以[官方客户端事件](https://help.aliyun.com/zh/model-studio/client-events)与[服务端事件](https://help.aliyun.com/zh/model-studio/server-events)为准。
