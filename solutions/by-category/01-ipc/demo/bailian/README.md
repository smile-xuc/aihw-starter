# 01 IPC / AI 视觉 · 百炼事件理解参考 demo

一台家用看护摄像头的云端 AI 链路：事件抓拍 → `qwen3.7-flash` 看图生成结构化事件卡 → 在手机 App 里用一句话检索（「找昨晚宠物跳沙发那段」）→ 每天一份看护日报。JPG 文件或电脑摄像头模拟 IPC，`out/` 目录模拟 App 收到的事件列表和日报。

> **状态：待真 Key 验证**（目前只通过 mock 冒烟）。验证记录见 [VERIFY.md](./VERIFY.md)，标准见 [demo-standard](../../../../demo-standard/README.md)。

## 三步跑通

1. 准备环境：Python 3.9+，只用标准库，不需要 `pip install`（`--camera` 另需 `pip install -r requirements-device.txt`）
2. 填 Key：复制 `.env.example` 为 `.env`，填 `DASHSCOPE_API_KEY`；建议同时填 `DASHSCOPE_WORKSPACE_ID`（走官方推荐的业务空间专属域名），地域默认北京
3. 运行：`python3 run.py`（Windows 用 `python run.py`）

没有 Key 时，同一条命令自动进入 mock：按官方流式响应结构回放，不联网、不计费。`python3 run.py --mock` 强制 mock。

## 模拟的设备

| IPC 环节 | 默认（文件模拟） | 其他方式 |
|---|---|---|
| 事件抓拍 | `samples/events/` 4 帧：门口快递、夜里猫跳沙发、厨房燃气灶无人看管、早上扫地机器人和狗 | `--images a.jpg b.jpg`；`--camera`：电脑摄像头每隔 `--interval` 秒抓一帧 |
| 抓拍信息（时间、位置、触发方式） | `samples/events.json`；其中 `now` 固定了样本的「当前时间」，让「昨晚」「今早」有参照 | 摄像头和本地图片取实际时间 |
| 本地联动（录像、声光告警） | 中高风险时打印 `[设备]` 日志 | 量产时把 `Camera.react()` 换成固件调用 |
| 手机 App | `out/events.json` 事件列表、`out/daily.md` 看护日报，检索结果打印在控制台 | 量产时由业务服务端推送 |

## 预期输出（mock）

```text
[设备] 客厅 · 移动侦测 → 抓拍 1 帧（16 KB）· 上传云端
[云端] 事件理解 qwen3.7-flash（看图 · JSON）……
[App] 事件卡 #2 · 09-30 21:47 · 客厅 · 风险：低
        猫跳上客厅沙发 ｜ 宠物活动
        对象：橘猫、布艺沙发、茶几、落地灯 · 动作：跳跃、跳上沙发
        夜间客厅只开着落地灯，一只橘猫正从地面跃上灰色布艺沙发，周围没有人。
[统计] 抓拍完成 → 事件卡首字 —（mock 不计时） · ¥0.00027（输入 635 / 输出 178 Token）
[设备] 厨房 · 画面变化 → 抓拍 1 帧（29 KB）· 上传云端
[App] 事件卡 #3 · 10-01 07:05 · 厨房 · 风险：中
        燃气灶开着火，厨房无人 ｜ 用火用电
[设备] 中风险 → 录制 30 秒云存片段 · App 强提醒
……
[App] 检索「找昨晚宠物跳沙发那段」
[App] 找到 1 段，最相关的是 09-30 21:47 客厅：猫跳上客厅沙发。
        #2 09-30 21:47 · 客厅 · 猫跳上客厅沙发 → samples/events/02_cat_sofa_night.jpg
[云端] 日报 qwen3.7-flash（流式 Markdown）……
        # 家庭看护日报 · 2026-10-01
        ## 需要留意
        - 07:05 厨房 · 燃气灶开着火，厨房无人：请确认现场情况
[App] 推送看护日报 → out/daily.md
[统计] 4 个事件合计 ¥0.0011 · 检索 ¥0.00037 · 日报 ¥0.00045
```

mock 的事件卡是按图片回放的固定内容；检索做的是「时间段 + 关键词」匹配，日报按事件列表拼成；用量是估算的示意值。真跑时三者都由模型生成，`[统计]` 给出实测首字延迟和按 `usage` 算出的费用。

## 链路

```text
IPC（摄像头 + 本地移动侦测）
  │ 触发 → 抓拍 1 帧 JPG → 上传
  ├─ 事件理解：POST {base}/compatible-mode/v1/chat/completions                ← 抓拍完成，开始计时
  │    model=qwen3.7-flash，user 消息 = [image_url(data:image/jpeg;base64,…), text(指令 + 抓拍信息)]
  │    stream=true，response_format={"type":"json_object"}，enable_thinking=false
  │    → {title, objects, actions, event, risk_level, description}
  ├─ risk_level 为 medium / high → 设备补录云存片段、声光告警、App 强提醒
  ├─ 自然语言检索：同一接口，输入事件列表 + 问题 → {matches[{id, reason}], answer}
  └─ 看护日报：同一接口，流式 Markdown → App
```

`{base}` 由 `.env` 决定：填了业务空间 ID 是 `https://{业务空间ID}.cn-beijing.maas.aliyuncs.com`（新加坡为 `ap-southeast-1`），否则是通用域名 `https://dashscope.aliyuncs.com`（新加坡 `https://dashscope-intl.aliyuncs.com`）。

- `qwen3.7-flash` 原生看图，看图、检索、日报用同一个模型；检索和日报更看重文字质量时，把 `run.py` 的 `TEXT_MODEL` 换成 `qwen3.8-flash`（单价已写在 `PRICES` 里）
- Qwen3.5 及以后的系列默认开启思考，硬件场景一律传 `enable_thinking=false`，否则首字明显变慢、输出 Token 也会多
- 官方建议 Qwen3.x 看图时不设 system 消息，指令写在 user 消息里，本 demo 照此组织
- JSON Object 模式要求消息里出现「JSON」字样；多模态输入不支持 `json_schema`，会自动降级为 `json_object`

## 常用参数

| 参数 | 作用 |
|---|---|
| `--images a.jpg b.jpg` | 换成自己的事件帧（JPG / PNG / WEBP） |
| `--camera [--interval 5] [--frames 3]` | 电脑摄像头定时抓帧，边抓边分析；Ctrl+C 提前结束 |
| `--ask "门口有没有快递"` | 换检索问题；`--ask ""` 跳过检索 |
| `--no-daily` | 不生成看护日报 |
| `--region ap-southeast-1` | 临时切到新加坡（Key 也要换成新加坡的） |
| `--record` | 真跑成功后把一行验证记录追加到 `VERIFY.md` |

## 计费与延迟口径

`qwen3.7-flash` 单价（元 / 百万 Token，按单次请求的输入 Token 分档，[模型页](https://help.aliyun.com/zh/model-studio/qwen3-7-flash)，查证 2026-10-01）：

| 单次输入 | 华北2（北京）输入 / 输出 | 新加坡 输入 / 输出 |
|---|---|---|
| ≤32K | 0.2 / 0.8 | 0.225 / 0.974 |
| 32K–256K | 0.6 / 2.4 | 0.749 / 2.998 |
| 256K–1M | 1.2 / 4.8 | 1.499 / 5.995 |

- 图片按每 32×32 像素 1 Token 折算（[视觉理解](https://help.aliyun.com/zh/model-studio/vision)）：640×360 的事件帧约 220 Token，1280×720 约 900 Token。抓拍分辨率直接决定成本，事件理解用 640×360 足够
- 估算（北京，未计免费额度）：每个事件约 ¥0.0002（约 520 输入 + 120 输出 Token）；一路摄像头每天 30 个事件加一份日报，约 ¥0.007 / 天、¥0.2 / 月
- 免费额度只适用于北京地域
- 首字延迟 = 抓拍完成（开始上传）→ 事件卡首个 token；检索和日报的首字单独打印在 `[统计]` 里
- 每轮实际费用以 `[统计]` 里按 `usage` 算出的为准

## 常见问题

- **401 / 403**：Key 与地域不一致，或业务空间 ID 不属于这个 Key
- **事件卡不是合法 JSON**：重跑一次；确认请求里带了 `enable_thinking=false`；仍不稳定时把 `VISION_MODEL` 换成效果档 `qwen3.7-plus` 对比（单价已在 `PRICES` 里，北京约为 `qwen3.7-flash` 的 10 倍）
- **为什么不用 `qwen3-vl-flash`**：它和 `qwen-vl-plus` / `qwen-vl-max` 都在 2026-10-10 下线（[公告 118344](https://www.aliyun.com/notice/118344)）；官方替代 `qwen3.6-flash` 单价更高，`qwen3.7-flash` 原生看图、输出更便宜
- **`--camera` 打不开摄像头**：先 `pip install -r requirements-device.txt`；macOS 需要在「隐私与安全性」里给终端摄像头权限
- **量产怎么接**：端侧先做移动侦测、人形 / 宠物检测，只上传触发帧控制成本；事件帧走自己的 OSS + STS 上传；设备不放长期 Key，见 [demo-standard](../../../../demo-standard/README.md)「设备侧凭证」

## 合规提示

- 摄像头画面属于个人信息，上传云端分析前须告知用户并取得同意，写明保存期限；不满十四周岁未成年人的个人信息属于敏感个人信息，按《个人信息保护法》从严处理
- 本 demo 的提示词要求模型不识别、不猜测人的身份和特征；正式产品如需人脸识别，须另行取得单独同意，并评估必要性
- 门口摄像头尽量只拍自家门前，避免长期拍摄邻居门口和公共通道；在公共场所安装图像采集设备须设置显著的提示标识
- 本 demo 是开发者参考实现，不是面向公众的服务；面向公众上线前需完成生成式 AI 服务登记 / 备案与内容标识等义务

## 文件

| 文件 | 说明 |
|---|---|
| `run.py` | 入口：设备模拟 + 事件理解 + 检索 + 日报 + 成本统计 |
| `mock.py` | 离线假接口，按官方流式响应结构回放 |
| `demo_kit.py` | 百炼 demo 公共件（与模板逐字一致，勿单独修改） |
| `solution.yaml` | 方案清单 |
| `VERIFY.md` | 验证记录 |
| `samples/` | 模拟输入；来源见 [samples/README.md](./samples/README.md) |

套件版「物理世界感知 Agent」的调用示例见专题 demo [`physical-sense/`](../physical-sense/)。

> ⚠️ AI 生成代码，仅作接入参考。接口字段以[视觉理解](https://help.aliyun.com/zh/model-studio/vision)与[结构化输出](https://help.aliyun.com/zh/model-studio/json-mode)文档为准。
