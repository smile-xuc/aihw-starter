# 03 AI 玩具 / 陪伴 · 百炼实时语音参考 demo

一只「会听、会看、会说、会动」的毛绒玩具：按键说话 + 眼睛摄像头 → `qwen3.8-omni-flash-realtime` → 语音回复，同时用 Function Calling 控制动作和灯光。电脑的麦克风或 WAV 文件模拟玩具麦克风，摄像头或 JPG 模拟玩具眼睛。

> **状态：待真 Key 验证**（目前只通过 mock 冒烟）。验证记录见 [VERIFY.md](./VERIFY.md)，标准见 [demo-standard](../../../../demo-standard/README.md)。

## 三步跑通

1. 安装依赖（Python 3.9+）：`pip install -r requirements.txt`
2. 填 Key：复制 `.env.example` 为 `.env`，填 `DASHSCOPE_API_KEY` 和 `DASHSCOPE_WORKSPACE_ID`（地域默认北京，见下文「地域」）
3. 运行：`python3 run.py`（Windows 用 `python run.py`）

没有 Key 时，同一条命令自动进入 mock：离线回放官方事件序列，不联网、不计费。`python3 run.py --mock` 强制 mock。

## 模拟的设备

| 玩具部件 | 默认（文件模拟） | 真设备（可选，先 `pip install -r requirements-device.txt`） |
|---|---|---|
| 麦克风（按键说话） | `samples/kid_ask_story.wav`：「帮我讲一个关于恐龙的小故事」 | `--mic`：回车开始、回车结束，可连续多轮 |
| 眼睛摄像头 | `samples/toy_cam.jpg`：孩子手里的绿色剑龙 | `--camera`：抓一帧 640×480 |
| 扬声器 | 写入 `out/reply_N.wav`（24 kHz） | 装了 sounddevice 时边收边播 |
| 动作 / 灯光 | 控制台打印 `[设备] 动作：… · 灯光：…` | 量产时把 `Toy.act()` 换成电机 / LED 驱动 |

## 预期输出（mock）

```text
[设备] 开机，连接本地 mock 云端（按官方事件顺序回放，不联网）
[云端] 会话就绪：音色 longanlingxin · 按键说话（Manual） · 已注册 toy_action
[设备] 按键按下 · 灯光：蓝光（聆听中）
[设备] 麦克风 ← kid_ask_story.wav（2.3 s）
[设备] 眼睛摄像头 ← toy_cam.jpg（30 KB）
[设备] 按键松开 → 提交本轮
[云端] 听到：帮我讲一个关于恐龙的小故事。
[设备] 动作：挥挥手 · 灯光：彩虹灯（toy_action）
[玩具] 哇，小手里举着一只绿色的剑龙呀！……小朋友觉得阿绿勇敢吗？
[设备] 扬声器 → out/reply_1.wav（2.1 s）
[统计] 第 1 轮 · 首包音频 —（mock 不计时） · ¥0.0058（输入 1990 / 输出 278 Token）
```

真跑时 `[玩具]` 一行是模型实时生成的回答，`[统计]` 给出实测首包延迟和按 `usage` 计算的费用；mock 的回答、提示音和用量都是固定示意值。

## 链路

```text
玩具（麦克风 + 摄像头 + 扬声器 + 电机/LED）
  │ WebSocket：wss://{业务空间ID}.cn-beijing.maas.aliyuncs.com/api-ws/v1/realtime?model=qwen3.8-omni-flash-realtime
  ├─ session.update      Manual 模式（turn_detection=null）、音色、内置转写、tools=[toy_action]
  ├─ input_audio_buffer.append ×N（16 kHz PCM，100 ms 一包）+ input_image_buffer.append（JPG）
  ├─ input_audio_buffer.commit → response.create          ← 松开按键，开始计时
  ├─ response.done 里有 function_call → 设备执行 → conversation.item.create(function_call_output) → response.create
  └─ response.audio.delta / response.audio_transcript.delta → 扬声器；response.done.usage → 成本
```

固件端照搬这条 WebSocket 即可；量产不要在设备里放长期 Key，改由业务服务端下发临时 Key（见 [demo-standard](../../../../demo-standard/README.md)「设备侧凭证」）。

## 常用参数

| 参数 | 作用 |
|---|---|
| `--audio a.wav --audio b.wav` | 换输入，可多轮（WAV 任意采样率，自动转 16 kHz 单声道） |
| `--image x.jpg` / `--camera` / `--no-image` | 换画面 / 用摄像头 / 不发画面 |
| `--voice Tina` | 换音色（默认 `longanlingxin` 知心温暖音；官方默认 `Tina`） |
| `--no-tools` | 不注册 `toy_action`，纯语音对话 |
| `--no-play` | 只写 WAV，不播放 |
| `--region ap-southeast-1` | 临时切到新加坡（Key 与业务空间也要换成新加坡的） |
| `--record` | 真跑成功后把一行验证记录追加到 `VERIFY.md` |

## 计费与延迟口径

`qwen3.8-omni-flash-realtime` 单价（元 / 百万 Token，[模型页](https://help.aliyun.com/zh/model-studio/qwen3-8-omni-flash-realtime)，查证 2026-10-01）：

| 计费项 | 华北2（北京） | 新加坡 |
|---|---:|---:|
| 输入：音频 | 6 | 6.781 |
| 输入：文本 / 图片 / 视频 | 1.5 | 1.677 |
| 输出：文本 | 4.5 | 5.104 |
| 输出：音频 | 12 | 13.636 |

- 输出语音时，音频和对应文本分别计费；免费额度 100 万 Token 只适用于北京地域
- 一轮对话通常有两次 `response.done`（先调用工具、再说话），两次的输入上下文都计费；`--no-tools` 可以省掉一次
- 多轮对话时，历史音频、画面和文本每轮都会重复计入输入（音频最多保留 600 秒、画面 240 秒），后续轮次比首轮贵；`[统计]` 按每轮实际 `usage` 计算
- 首字延迟 = 松开按键 → 首包音频，受网络影响大；记录时在「备注」写清网络环境
- 限流（模型页）：北京、新加坡均为 60 RPM、2,000,000 TPM

## 地域

| 地域 | `.env` 里的 `DASHSCOPE_API_REGION` | Realtime 地址 |
|---|---|---|
| 华北2（北京） | `cn-beijing` | `wss://{业务空间ID}.cn-beijing.maas.aliyuncs.com/api-ws/v1/realtime` |
| 新加坡 | `ap-southeast-1` | `wss://{业务空间ID}.ap-southeast-1.maas.aliyuncs.com/api-ws/v1/realtime` |

`qwen3.8-omni-flash-realtime` 必须使用业务空间专属域名，所以 `DASHSCOPE_WORKSPACE_ID` 必填；Key、业务空间与地域三者要一致。来源：[Qwen-Omni-Realtime 文档](https://help.aliyun.com/zh/model-studio/realtime)（2026-09-24）。

## 常见问题

- **提示缺少 `DASHSCOPE_WORKSPACE_ID`**：在百炼控制台「业务空间详情」复制 ID 填入 `.env`
- **连接时报 401 / 403**：Key 与地域不一致（例如北京的 Key 配了 `ap-southeast-1`），或业务空间 ID 不属于这个 Key
- **图片报错**：Realtime 只收 JPG / JPEG，建议 480P–720P、编码前不超过 190 KB
- **WAV 报错**：只支持 16-bit PCM WAV；其他格式先转：`ffmpeg -i in.m4a -ac 1 -ar 16000 -sample_fmt s16 out.wav`
- **Linux 上 `--mic` 报 PortAudio 错误**：先装系统库 `sudo apt install libportaudio2`

## 合规提示

- 本 demo 是开发者参考实现，不是面向公众的服务；面向公众上线前需完成生成式 AI 服务的登记 / 备案、内容标识等义务
- 面向未成年人的陪伴类产品适用《人工智能拟人化互动服务管理暂行办法》（2026-07-15 施行），第十四条不得向未成年人提供虚拟亲属、虚拟伴侣等服务，[网信办原文](https://www.cac.gov.cn/2026-04/10/c_1777558395078289.htm)；系统提示词里已写明不扮演家人或恋人，正式产品还需未成年人模式、使用时长提醒等
- 儿童内容安全红线见 [02-solution.md](../../02-solution.md) 3.2 节

## 文件

| 文件 | 说明 |
|---|---|
| `run.py` | 入口：设备模拟 + Realtime 协议 + 工具调用 + 成本统计 |
| `mock.py` | 离线假服务端，按官方事件顺序回放 |
| `demo_kit.py` | 百炼 demo 公共件（与模板逐字一致，勿单独修改） |
| `solution.yaml` | 方案清单 |
| `VERIFY.md` | 验证记录 |
| `samples/` | 模拟输入；来源见 [samples/README.md](./samples/README.md) |

> ⚠️ AI 生成代码，仅作接入参考。协议字段以[官方客户端事件](https://help.aliyun.com/zh/model-studio/client-events)与[服务端事件](https://help.aliyun.com/zh/model-studio/server-events)为准。
