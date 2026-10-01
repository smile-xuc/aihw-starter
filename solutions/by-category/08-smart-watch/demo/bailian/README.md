# 08 智能手表 · 百炼健康日报参考 demo

一块健康手表的每日日报：手表把一天的聚合指标同步到手机 App → 本地红线规则先判定（命中立即震动，不等云端）→ `qwen3.7-flash` 按 JSON Schema 输出结构化日报 → 表盘窄卡片 + App 日报；`--speak` 再用 `qwen-audio-3.0-tts-flash` 做抬腕播报。JSON 文件模拟手表同步上来的数据，控制台模拟表盘。

模型分两档：默认档 `qwen3.7-flash`（单价低，日报够用），`--quality` 换质量档 `qwen3.8-flash` 对比效果与成本。两者都是混合思考模型、默认开思考，demo 显式传 `enable_thinking=false`。

> **状态：待真 Key 验证**（目前只通过 mock 冒烟）。验证记录见 [VERIFY.md](./VERIFY.md)，标准见 [demo-standard](../../../../demo-standard/README.md)。

## 三步跑通

1. 准备环境：Python 3.9+，只用标准库，不需要 `pip install`（想用扬声器听播报再装 `requirements-device.txt`）
2. 填 Key：复制 `.env.example` 为 `.env`，填 `DASHSCOPE_API_KEY`；建议同时填 `DASHSCOPE_WORKSPACE_ID`（走官方推荐的业务空间专属域名），地域默认北京
3. 运行：`python3 run.py`（Windows 用 `python run.py`）；加 `--speak` 听抬腕播报

没有 Key 时，同一条命令自动进入 mock：按官方响应结构离线回放，不联网、不计费。`python3 run.py --mock` 强制 mock。

## 模拟的设备

| 手表环节 | 默认（文件模拟） | 其他方式 |
|---|---|---|
| 一天的聚合指标（手表 → App 同步） | `samples/day_normal.json`（无红线）、`samples/day_alert.json`（血氧红线） | `--day my_day.json`，可重复给多天；字段见 [samples/README.md](./samples/README.md) |
| 震动 / 弹窗 | 控制台 `[设备] 本地红线 …` | 量产时把 `red_lines()` 命中后的动作换成马达与通知驱动 |
| 表盘 | 控制台窄卡片（26 列，汉字算 2 列） | 量产时把 `watch_card()` 换成表盘 UI 渲染 |
| App 日报 | `out/report_<样本名>.json` | 量产时由业务服务端推送 |
| 抬腕播报 | `--speak` → `out/speak_<样本名>.wav` | 装了 sounddevice 时同时播放；`--no-play` 只写文件 |

## 预期输出（mock）

```text
[设备] 手表 → 手机 App 同步完成：day_alert.json（11 项聚合指标，不含原始波形）
[设备] 本地红线 ×1 → 震动 2 次 + 表盘弹窗：血氧最低 87%，低于 90%
[云端] 日报 qwen3.7-flash（流式 · JSON Schema）……
[手表] 表盘卡片：
        ╭────────────────────────────╮
        │ 今日健康          红线提醒 │
        │ 血氧触发红线，今天多休息   │
        │ ────────────────────────── │
        │ 红 血氧最低 87%，低于 90%  │
        │ 黄 静息心率 84，比 7 日均  │
        │    值高 22                 │
        │ 黄 深睡 41 分钟，偏少      │
        │ > 今天避免剧烈运动和饮酒   │
        │ > 红线反复出现请咨询医生   │
        │ ────────────────────────── │
        │ 以上为 AI 健康参考，不替代 │
        │ 专业医疗意见。             │
        ╰────────────────────────────╯
[App] 推送日报 → out/report_day_alert.json
[统计] day_alert.json · 同步完成 → 首字 —（mock 不计时） · ¥0.00038（输入 806 / 输出 268 Token）
```

默认依次跑 `day_normal.json` 和 `day_alert.json` 两天，上面只截了第二天。mock 的日报由固定规则生成、用量是示意值；真跑时 `summary`、黄色提醒和建议由模型生成，`[统计]` 给出实测首字延迟和按 `usage` 计算的费用。

## 链路

```text
手表 ──蓝牙──▶ 手机 App（当天聚合指标 JSON）
  ├─ 本地红线 red_lines()：血氧最低 < 90%、静息心率 > 100 或 < 40 → 立即震动 + 弹窗（不上云也成立）
  ├─ 日报：POST {base}/compatible-mode/v1/chat/completions
  │    model=qwen3.7-flash（--quality：qwen3.8-flash），stream=true，enable_thinking=false
  │    response_format={type: json_schema, json_schema: {name, strict: true, schema}}
  │    → {summary, alerts[{metric, text}], advice[], disclaimer}
  │    → merge()：红色提醒只认本地规则，模型给出的同一指标不重复显示；免责声明由代码固定
  └─ --speak：POST {base}/api/v1/services/audio/tts/SpeechSynthesizer
       model=qwen-audio-3.0-tts-flash，input={text, voice, format: wav, sample_rate: 24000}
       → output.audio.url（24 小时有效）→ 下载 WAV；usage.characters → 成本
```

`{base}` 由 `.env` 决定：填了业务空间 ID 是 `https://{业务空间ID}.cn-beijing.maas.aliyuncs.com`（新加坡为 `ap-southeast-1`），否则是通用域名 `https://dashscope.aliyuncs.com`（新加坡 `https://dashscope-intl.aliyuncs.com`）。官方说明通用域名自 2026-09-30 起不再支持新特性，建议填业务空间 ID。

为什么红线不交给模型：红线要求每次都触发、断网也触发，确定性规则比模型可靠；模型负责把多项指标串起来解释、给出当天能做到的建议。模型和规则意见不一致时，以规则为准。

## 常用参数

| 参数 | 作用 |
|---|---|
| `--day my_day.json` | 换输入，可重复给多天（默认两份样本） |
| `--quality` | 日报改用质量档 `qwen3.8-flash`，对比效果与成本 |
| `--speak` | 抬腕播报：把总结、红线和第一条建议合成语音（仅北京地域） |
| `--voice longanfengyue` | 换播报音色（默认 `longanhuan_v3.6`，官方示例音色） |
| `--no-play` | 只写 WAV，不播放 |
| `--region ap-southeast-1` | 临时切到新加坡（Key 也要换成新加坡的；`--speak` 会被跳过） |
| `--record` | 真跑成功后把一行验证记录追加到 `VERIFY.md` |

## 计费与延迟口径

单价（查证 2026-10-01，[qwen3.7-flash 模型页](https://help.aliyun.com/zh/model-studio/qwen3-7-flash)、[qwen3.8-flash 模型页](https://help.aliyun.com/zh/model-studio/qwen3-8-flash)、[模型价格](https://help.aliyun.com/zh/model-studio/model-pricing)）：

| 模型 | 计费单位 | 华北2（北京） | 新加坡 |
|---|---|---|---|
| `qwen3.7-flash`（单次输入 ≤32K） | 元 / 百万 Token，输入 / 输出 | 0.2 / 0.8 | 0.225 / 0.974 |
| `qwen3.7-flash`（32K–256K） | 同上 | 0.6 / 2.4 | 0.749 / 2.998 |
| `qwen3.8-flash`（`--quality`，不分档） | 同上 | 0.8 / 2.7 | 1.094 / 3.427 |
| `qwen-audio-3.0-tts-flash` | 元 / 万字符（汉字算 2 个字符） | 1 | 非实时 HTTP 合成不可用 |

- 一份日报约 1,000 输入 Token、200–300 输出 Token：默认档约 ¥0.0004，质量档约 ¥0.0015；加抬腕播报（约 35 个汉字、70 个计费字符）约 +¥0.007，播报占大头
- 免费额度只在北京地域发放：两个文本模型各 100 万 Token，`qwen-audio-3.0-tts-flash` 1 万字符
- 首字延迟 = 数据同步完成 → 日报首个 token；红线提醒在这之前已经在本地发出，不受网络影响
- 新加坡要做播报，可改用实时语音合成（WebSocket），本 demo 只演示标准库能完成的 HTTP 方式

## 常见问题

- **401 / 403**：Key 与地域不一致，或业务空间 ID 不属于这个 Key
- **日报不是合法 JSON**：JSON Schema 模式下少见；重跑一次，仍失败时加 `--quality` 换 `qwen3.8-flash`（同样支持 JSON Schema）对比
- **日报变慢、输出多了思考过程**：确认请求里有 `enable_thinking=false`；Qwen3.5–3.8 系列不传就会先思考，延迟和输出 Token 都会明显增加
- **想加更多红线**：改 `red_lines()`；阈值请与医学顾问确认，不要交给模型临场判断
- **想做周报 / 月报**：把多天的聚合指标一起传入，`summary` 改成趋势描述；输入超过 32K Token 时单价按第二档计

## 合规提示

- **不做医疗诊断**：输出只是健康参考。系统提示词禁止写病名、推荐药物或剂量；免责声明由代码固定追加，不依赖模型是否照做。未取得相应医疗器械注册前，产品宣传不能写「诊断」「监测疾病」
- **健康数据属于敏感个人信息**（《个人信息保护法》第二十八条），处理前需取得用户单独同意（第二十九条）；不满十四周岁用户需取得监护人同意（第三十一条）。只上传聚合指标，不上传原始 PPG 波形和身份标识；为日报和推送记录设定保存期限
- 本 demo 是开发者参考实现，不是面向公众的服务；面向公众上线前需完成生成式 AI 服务登记 / 备案、内容标识等义务

## 文件

| 文件 | 说明 |
|---|---|
| `run.py` | 入口：同步模拟 + 本地红线 + 结构化日报 + 表盘卡片 + 抬腕播报 + 成本统计 |
| `mock.py` | 离线假接口，按官方响应结构回放 |
| `demo_kit.py` | 百炼 demo 公共件（与模板逐字一致，勿单独修改） |
| `solution.yaml` | 方案清单 |
| `VERIFY.md` | 验证记录 |
| `samples/` | 模拟输入；来源见 [samples/README.md](./samples/README.md) |

纯离线、不调用模型的提示词模板见旧 demo [`metrics-prompt/`](../metrics-prompt/)。

> ⚠️ AI 生成代码，仅作接入参考。接口字段以[结构化输出](https://help.aliyun.com/zh/model-studio/json-mode)与[非实时语音合成](https://help.aliyun.com/zh/model-studio/non-realtime-tts-user-guide)文档为准。
