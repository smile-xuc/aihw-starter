# 百炼参考 demo 统一标准 v0.3

> 目标：9 个品类各有一个「百炼参考 demo」——填入自己的百炼 Key，在本机用文件或麦克风 / 摄像头模拟设备，真实跑通一次；没有 Key 时自动 mock，供 CI 和快速体验。以后接入小智、TuyaOpen、火山等栈，按同一结构并列放置。
>
> 试点：[03 AI 玩具 / 陪伴（实时语音）](../by-category/03-toys-companion/demo/bailian/) · [07 录音卡（非实时）](../by-category/07-recorder/demo/bailian/)。模板：[`templates/bailian/`](./templates/bailian/)。配套网页 APP 读的注册表、回放轨迹和凭证声明见「十四、APP 数据」；各版本的变化见文末「十五、版本」。

## 一、目录：品类 × 栈

```text
solutions/by-category/<品类>/demo/
├── README.md                 品类 demo 索引：各栈的状态与入口
├── bailian/                  栈：百炼（本标准的参考实现）
│   ├── README.md             三步跑通 + 模拟设备 + 链路 + 计费口径 + 合规
│   ├── solution.yaml         最小方案清单，schema 见 solution.schema.json
│   ├── .env.example          与模板逐字一致
│   ├── requirements.txt      live 依赖；没有依赖也保留并注明「仅标准库」
│   ├── requirements-device.txt  可选：真麦克风 / 扬声器 / 摄像头
│   ├── run.py                唯一入口
│   ├── mock.py               离线假接口，按官方事件 / 响应结构回放
│   ├── demo_kit.py           公共件，与模板逐字一致
│   ├── VERIFY.md             验证记录（含「待实测」清单）
│   └── samples/              模拟设备输入 + README（写明来源与许可）
├── xiaozhi/ tuyaopen/ volcengine/ …   以后的栈：同一套文件，同一套口径
└── <旧 demo>/                专题 demo，保留原路径（文档里已有大量链接）
```

- 栈目录名取 `solution.schema.json` 里的 `stack` 枚举：`bailian` / `xiaozhi` / `tuyaopen` / `volcengine` / `agora` / `tencent`。新增栈先改 schema，再加 `templates/<栈>/`
- 一个「品类 × 栈」只放一个参考 demo；同一栈的不同玩法用参数区分（如 `--audio-url`、`--no-tools`）
- 只放本仓代码；上游方案（小智固件、厂商 SDK）只写指针，不搬代码、不放固件

## 二、统一配置：`.env.example`

所有百炼 demo 的 `.env.example` 与 [`templates/bailian/.env.example`](./templates/bailian/.env.example) 逐字一致。变量名与官方 dashscope Python SDK 一致：

| 变量 | 必填 | 说明 |
|---|---|---|
| `DASHSCOPE_API_KEY` | 真跑必填 | 百炼控制台「密钥管理」创建；Key 与地域绑定 |
| `DASHSCOPE_API_REGION` | 否 | `cn-beijing`（默认）或 `ap-southeast-1`；早期写法 `DASHSCOPE_REGION` 仍兼容 |
| `DASHSCOPE_WORKSPACE_ID` | 推荐；部分模型必填 | 形如 `llm-xxx`，在控制台「业务空间管理」的 API Host 列。填了之后全部 HTTP / WebSocket 都走业务空间专属域名（见「八、地域」的地址规则）；`qwen3.8-omni-flash-realtime` 必须填 |
| `AIHW_VERIFIED_BY` | 否 | 验证人 GitHub ID，`--record` 时写入 |

- Key、地域、业务空间三者必须属于同一地域，否则接口返回 401
- 变量名与栈声明 [`stacks/bailian.yaml`](./stacks/bailian.yaml) 一致（`check.py` 校验）：配套 APP 的填写表单用同一套名字，填好的值可以直接导出成 `.env`
- `.env` 可放在 demo 目录或仓库根目录；根目录放一份，全部 demo 共用。`.env` 已被 `.gitignore` 忽略
- 只读取 `DASHSCOPE_*` / `AIHW_*` 变量；空值、`xxx` / `your` 之类占位符一律视为未填
- 有 Key 但缺必需的业务空间 ID 时直接报错退出，不静默降级成 mock
- 用官方 SDK 的 demo：`dashscope>=1.26.5`（`qwen3.8-omni-flash-realtime` 的最低版本；PyPI 当前最新 1.27.7）；并显式把 `Config` 推导出的地址赋给 `dashscope.base_http_api_url` / `base_websocket_api_url`，因为 SDK 在 `cn-beijing` 下默认仍走通用域名

## 三、一条启动命令

```bash
python3 run.py            # 有 Key：真跑；没有 Key：自动 mock，并在横幅里写明原因
python3 run.py --mock     # 强制 mock（CI 用）
python3 run.py --record   # 真跑成功后把一行验证记录追加到 VERIFY.md
python3 run.py --region ap-southeast-1   # 临时切地域
python3 run.py --trace out/trace.json    # 把这次运行写成回放轨迹，可在配套 APP 里打开（见「十四、APP 数据」）
```

- `--mock` 只用标准库，不联网、不读写云端；live 依赖在 live 分支里才导入
- mock 必须走与 live 相同的协议代码：只把传输层换成 `mock.py` 里的假实现（WebSocket 事件或 HTTP 响应），按官方文档的事件顺序和字段回放
- mock 输出必须可复现：同一份代码在不同日期、不同机器、Python 3.9 与 3.12 下逐字相同。要用日期时间时调 `demo_kit.today(cfg)` / `demo_kit.now(cfg)`（mock 固定为 2026-10-01 上午 9 点），不用 `date.today()`、随机数和真实耗时。注册表的回放轨迹由 mock 输出生成，CI 逐字节比对
- 输出统一用 `[设备]`（模拟硬件动作）、`[云端]`（接口事件）、`[玩具]` / `[App]` 等（用户看到或听到的结果）、`[统计]`（延迟与成本）四类日志行，让硬件场景一眼可见；多行内容（表盘卡片、字符画、纪要）缩进写在所属日志行下面，回放轨迹会把它们归到同一条
- 结束时调用 `demo_kit.finish()` 打印一行 VERIFY.md 格式的验证记录；mock 的记录只打印、不写入

## 四、README「三步跑通」

每个 demo 的 README 按这个顺序写（模板：[`templates/bailian/README.md`](./templates/bailian/README.md)）：

1. 标题 + 一句话场景 + 状态行（`待真 Key 验证` 或 `已验证 YYYY-MM-DD`）
2. **三步跑通**：① 装依赖（或「仅标准库」）② 复制 `.env.example` 为 `.env` 填 Key ③ `python3 run.py`；紧跟一句「没有 Key 时自动 mock」
3. 模拟的设备：部件 × 默认文件 × 真设备参数
4. 预期输出（mock）
5. 链路：接口地址、关键事件 / 字段
6. 常用参数
7. 计费与延迟口径：单价表（北京 / 新加坡，附官方链接与查证日期）、首字延迟起止点、免费额度；接口不返回用量时写明估算方法
8. 常见问题、合规提示、文件清单

## 五、`solution.yaml`（最小清单）

完整约束见 [`solution.schema.json`](./solution.schema.json)，示例见两个试点。v0.3 起用 `aihw/solution@0.2`：在 @0.1 上只加字段，`reference` 方案要填 `features`、`experience`、`hardware` 和 `metrics.unit`。

| 字段 | 说明 |
|---|---|
| `schema` | `aihw/solution@0.2`；旧的 `@0.1` 清单仍能通过校验，新字段只对 @0.2 的 `reference` 方案强制 |
| `id` | `<品类目录>.<栈>`，如 `03-toys-companion.bailian`；必须与所在目录一致 |
| `title` / `summary` | 名称；一句话「设备输入 → 模型 → 设备输出」 |
| `category` / `stack` / `kind` | 品类目录名；栈；`reference`（本仓可运行）或 `pointer`（只指向上游，此时必填 `upstream`） |
| `models[]` | 实际调用的模型 ID 与用途，一个模型一项；某个模型只在部分地域可用时加 `regions`（如 08 的播报只写 `[cn-beijing]`） |
| `regions` | 主链路两地都核实过可用的地域 |
| `env` | 真跑必需的变量，只能用栈声明 `stacks/<栈>.yaml` 里的字段 |
| `features` | 能力标签（`voice-input` `vision` `tool-calling` `offline-fallback` 等），配套 APP 按它筛选 |
| `experience` | `archetype`：回放舞台（`realtime-voice` / `vision` / `recorder` / `tools`）；`cover`：卡片封面图（`samples/` 下的文件，可空）；`variants`：玩法列表，第一个必须是 `id: default`、`args: []`，其余如 `--realtime`、`--offline` 各一项，每项写 `title`、`args` 和用到的接入点 `services`（`compatible` / `api` / `ws-inference` / `realtime`），舞台不同时另写 `archetype`。每个玩法生成一份回放轨迹 |
| `hardware` | `parts`：做成产品要的硬件部件，每项 `{part, role, simulated_by}`；`chips` / `boards`：验证过的芯片与板卡，没有就写 `[]` |
| `device.inputs` / `device.outputs` | 模拟方式，如 `wav` `mp3` `mic` `jpg` `camera` `url` / `speaker` `wav` `markdown` `json` `console` |
| `run.setup` / `run.live` / `run.mock` | 安装命令；真跑命令；mock 命令（CI 执行它） |
| `metrics.first_token` / `metrics.cost` / `metrics.unit` | 首字延迟的起止点；成本算法；「一次」指什么（如「每轮对话」「每份日报」） |
| `verification` | `status`：`pending-live` / `live-verified`；`last_verified`；`record`（默认 `VERIFY.md`）；可选 `level`（芯片与固件维度的 L0–L4）与 `evidence`（证据链接） |
| `license` / `compliance_tags` / `maintainers` | 许可；合规标签（见下表）；维护者 |

### 词表与合规标签

`features`、`experience.archetype`、`hardware.parts[].part`、`compliance_tags` 只能用 [`vocab.yaml`](./vocab.yaml) 里的 id（`check.py` 校验）；要新增词条，维护者改 `vocab.yaml`。每个合规标签在 demo README 的「合规提示」一节至少要写到：

| 标签 | 一句话义务 | README 至少写 |
|---|---|---|
| `minors` | 面向未成年人不得提供虚拟亲属、虚拟伴侣；要有未成年人模式与时长提醒；不满十四周岁的个人信息要取得监护人同意 | 提示词怎么避免扮演家人或恋人；未成年人模式与时长提醒在哪一层实现；监护人同意 |
| `anthropomorphic` | 持续性情感陪伴适用拟人化互动办法：提示 AI 身份与使用时长、防止依赖、极端情绪干预、交互数据可删除 | AI 身份与时长提醒的位置；防沉迷与极端情绪的处理；数据存在哪、怎么删 |
| `camera-privacy` | 画面属于个人信息：告知同意、保存期限；拍到他人要有提示、不偷拍、不识别身份 | 告知方式与保存期限；他人入镜的处理；是否做人脸识别 |
| `recording-consent` | 录音、同传会录到旁人：使用前告知并取得同意，转写与纪要设保存期限 | 设备上的录音提示；录音与转写存在哪、存多久 |
| `health` | 不做医疗诊断；健康数据属于敏感个人信息，要单独同意 | 免责声明由哪一层固定追加；上传哪些数据；单独同意与保存期限 |
| `safety-critical` | 急停、限速、力矩限制必须在控制器和硬件层实现，软件安全门只是额外一层 | 安全门在哪一层、拦什么；哪些限制必须在硬件层；现场怎么叫停 |

另有一条对所有 demo 都适用：本仓 demo 是开发者参考实现，面向公众上线前要完成生成式 AI 服务登记 / 备案与内容标识。法规原文与来源见 `vocab.yaml`。

## 六、验证记录：`VERIFY.md`

表头固定，`--record` 追加到表格末尾，所以表格必须是文件最后一段：

```text
| 日期 | 地域 | 模型 | 首字延迟 | 单次成本（元） | 输入 | 环境 | 验证人 | 备注 |
```

- **日期**：真跑当天；**地域**：`cn-beijing` / `ap-southeast-1`；**模型**：本次实际调用的全部模型 ID
- **首字延迟**：用户感知的第一个输出到达的时间，起点在 `metrics.first_token` 写清：
  - 实时语音：松开按键（`input_audio_buffer.commit`）或 VAD 判停 → 首包音频
  - 非实时（录音、图片）：输入完成（开始上传）→ 第一个输出 token，含转写 / 上传耗时
- **单次成本**：一次交互的接口 `usage` × `run.py` 里的单价表（单价旁注明官方链接与查证日期）
  - 「一次」只算主交互，写在 `metrics.unit`（如 05 是每轮对话、01 是每个事件）；同一次运行里的其他环节（05 的记忆日记、08 的播报、01 的检索与日报）单独算，写进「备注」，不加进这一列
  - 接口不返回用量、官方又没公布折算率时，按能查到的口径给区间：`demo_kit.finish(cost=(下限, 上限))`，记录里显示为 `0.0015–0.0023`，备注写明估算依据（例：07 的异步转写按每秒 7–25 Token）
  - 不要把未公布的折算率写成确定值
- **环境**：自动填系统与 Python 版本；网络环境（家庭宽带 / 4G 热点 / 机房）写进「备注」
- **待实测**：官方文档没写清、只能靠真跑核对的点，写成表格上方的清单，每项 `- [ ] **标题**：说明`（例：07 同步转写是否截断、03 的 Token 折算）。真跑后把结论写进「备注」，再改 README 和 `run.py` 里的常量，并把该项勾掉。注册表会把没勾掉的标题列给配套 APP。几条通用项，用到对应能力的 demo 都应列上：
  - 首字 / 首包延迟（官方多数只给图表）
  - 按 `usage` 算出的单次成本是否落在 README 的估算里
  - 业务空间专属域名在北京、新加坡是否都连得通
  - TTS 的 `usage.characters` 是否按「一个汉字 2 个字符」返回（02、08 用到）
- 至少一条真跑记录后，把 `solution.yaml` 的 `verification.status` 改成 `live-verified`、填 `last_verified`，README 状态行同步更新

## 七、设备模拟

- 默认输入放 `samples/`，必须可随仓库分发：本仓自制、AI 生成，或用 [`tools/make_speech_sample.py`](./tools/make_speech_sample.py) 离线合成（Kokoro-82M，Apache-2.0；同时输出每句起止时间，可直接当 mock 的标准答案）。不放来源不明的录音和照片，不放可识别的人脸
- 真设备是可选项：`requirements-device.txt` 里放 `sounddevice`（麦克风 / 扬声器）、`opencv-python`（摄像头），用 `--mic` / `--camera` 打开
- 音频统一转 16 kHz 单声道 16-bit PCM（`demo_kit.read_wav` 自动重采样）；图片按接口要求压缩（如 Realtime 要求 JPG、编码前 ≤190 KB）
- 多轮看图任务（如 09 的多轮规划、Realtime 每轮都带画面）里，画面每一轮都会重新计入输入：画面分辨率直接决定成本，按每 32×32 像素约 1 Token 估算，能缩就缩
- 设备动作（电机、灯光、屏幕）用 `[设备]` 日志模拟，量产时替换成驱动调用的位置要在代码里一眼能找到（如 03 的 `Toy.act()`）
- 实时连接（WebSocket）的两条约束：
  - 同一条连接只在一个线程里读写；要边推流边收事件时，用一个线程按固定节拍交替收发（06 每 100 ms、02 播报每 20 ms），播放另开线程。OpenSSL 连接对象不是线程安全的，一个线程收、另一个线程同时发，会在首包后被误判断开（06 本地仿真一到三成会话复现）
  - 握手失败（401 / 403、网络不通）时打印一行可读的 `[云端] 连接失败：…`，提示检查 Key、业务空间与地域，不抛 traceback

## 八、地域

查证 2026-10-01。

| 项 | 华北2（北京）`cn-beijing` | 新加坡 `ap-southeast-1` |
|---|---|---|
| 通用域名 | `https://dashscope.aliyuncs.com` · `wss://dashscope.aliyuncs.com` | `https://dashscope-intl.aliyuncs.com` · `wss://dashscope-intl.aliyuncs.com` |
| 业务空间专属域名（官方推荐） | `{WorkspaceId}.cn-beijing.maas.aliyuncs.com` | `{WorkspaceId}.ap-southeast-1.maas.aliyuncs.com` |
| Realtime（`qwen3.8-omni-flash-realtime` 必须用专属域名） | `wss://{WorkspaceId}.cn-beijing.maas.aliyuncs.com/api-ws/v1/realtime` | `wss://{WorkspaceId}.ap-southeast-1.maas.aliyuncs.com/api-ws/v1/realtime` |
| 任务制 WebSocket（CosyVoice / Qwen-Audio-TTS / Fun-ASR 等，`run-task`） | `wss://{WorkspaceId}.cn-beijing.maas.aliyuncs.com/api-ws/v1/inference` | `wss://{WorkspaceId}.ap-southeast-1.maas.aliyuncs.com/api-ws/v1/inference` |
| API Key | 只能调北京 | 只能调新加坡 |
| 免费额度 | 多数模型各 100 万 Token（90 天） | 中国站无（国际站账号在新加坡另有免费额度） |
| 单价 | 基准 | 普遍更高，例如 `qwen3.8-flash` 输入 0.8 → 1.094 元 / 百万 Token |
| 新加坡缺的 | — | `cosyvoice-v3.5-*`、`paraformer-*`、`qwen-audio-3.1-tts-flash`、百炼硬件 Agent 开发平台（Agent Studio for Hardware，原多模态交互开发套件）；Qwen-Audio-TTS 的 HTTP 接口只在北京，新加坡要走 WebSocket |

- 通用域名「当前可继续使用」，但官方注明自 2026-09-30 起不再支持新特性；新 demo 一律建议填业务空间 ID
- `regions` 只写两地都核实过可用的；只在北京可用的模型（如 `cosyvoice-v3.5-flash`）要在 `solution.yaml` 只写 `cn-beijing`

**地址规则（v0.2）**：demo 里的接入地址一律从 `demo_kit.Config` 的方法取，不写死域名。填了 `DASHSCOPE_WORKSPACE_ID`，下表全部地址都走业务空间专属域名 `{WorkspaceId}.{地域}.maas.aliyuncs.com`；没填时走通用域名 `dashscope.aliyuncs.com` / `dashscope-intl.aliyuncs.com`，路径不变。

| `Config` 方法 | 用途 | 路径 |
|---|---|---|
| `compatible_base()` | OpenAI 兼容接口：文本、看图、工具调用 | `https://…/compatible-mode/v1` |
| `api_base()` | DashScope 原生 HTTP：同步 / 异步推理、任务查询、临时存储上传凭证、TTS HTTP | `https://…/api/v1` |
| `ws_inference()` | 任务制 WebSocket（`run-task`）：流式 ASR、流式 TTS | `wss://…/api-ws/v1/inference` |
| `realtime_url(model)` | 会话制 Realtime WebSocket：omni 实时、Qwen-Audio 实时、同传 | `wss://…/api-ws/v1/realtime?model=…` |
| `shared_api_base()` | 通用域名的 `…/api/v1`：只在专属域名对某个接口返回 404 时退回，并打印提示 | `https://dashscope(-intl).aliyuncs.com/api/v1` |

- 必须用专属域名的模型（`qwen3.8-omni-flash-realtime`），demo 调 `kit.resolve(…, need_workspace=True)`：有 Key 没填业务空间 ID 时直接报错退出
- 07 的临时存储上传凭证（`GET …/uploads?action=getPolicy`）官方只给了通用域名的示例：先走专属域名，返回 404 再退回 `shared_api_base()`，是否需要退回列在 07 的「待实测」里
- `check.py` 会拦下 demo 的 `.py` 文件（`demo_kit.py` 除外）里出现的 `dashscope(-intl).aliyuncs.com` / `maas.aliyuncs.com`
- 价格页另列美国（弗吉尼亚）、德国（法兰克福）、日本（东京）、中国香港等地域，部分模型可用；语音类 WebSocket 文档只给了北京与新加坡，本标准暂只覆盖这两地
- 来源：[地域](https://help.aliyun.com/zh/model-studio/regions) · [Base URL](https://help.aliyun.com/zh/model-studio/base-url) · [Qwen-Omni-Realtime](https://help.aliyun.com/zh/model-studio/realtime)（2026-09-24）· [Realtime Python SDK](https://www.alibabacloud.com/help/zh/model-studio/omni-realtime-python-sdk) · [非实时语音识别](https://www.alibabacloud.com/help/zh/model-studio/non-realtime-speech-recognition-user-guide)（2026-09-22）· [模型价格](https://help.aliyun.com/zh/model-studio/model-pricing)

## 九、百炼能力速查（查证 2026-10-01）

参考 demo 默认选用下表的「推荐」列；换模型时改 `run.py` 顶部常量、`solution.yaml` 的 `models` 与 README 价格表。模型一律用主线名，不用带日期的快照：快照下线只提前 30 天通知，主线提前 3 个月（[模型下线机制](https://help.aliyun.com/zh/model-studio/model-depreciation)）。2026-10-10 将下线 `qwen-vl-plus` / `qwen-vl-max`、`qwen3-vl-flash`、`qwen3-omni-flash-realtime`、`gummy-*-v1` 等，新 demo 不要再用（`check.py` 会拦下）。价格单位：元 / 百万 Token，或注明的单位；「京 / 新」= 北京 / 新加坡。

### 文本模型：默认档与质量档

文本对话、摘要 / 纪要、拍照问答、工具调用这类走 OpenAI 兼容接口的环节，统一分两档：

| 档 | 模型 | 什么时候用 | 单价（京 / 新） |
|---|---|---|---|
| 默认档 | `qwen3.7-flash` | 新 demo 默认用它：文本对话、摘要 / 纪要、拍照问答、单次工具调用。原生看图，两地都支持 Function Calling 和结构化输出 | 按单次输入长度分档：≤32K 入 0.2 / 0.225、出 0.8 / 0.974；32K–256K 入 0.6 / 0.749、出 2.4 / 2.998 |
| 质量档 | `qwen3.8-flash` | 默认档效果不够时切过来；以多轮工具编排为主的 demo（04 Agent 硬件、09 具身）直接默认用它 | 入 0.8 / 1.094，出 2.7 / 3.427，不分档 |

- 两档都默认开思考（Qwen3.5–3.8 系列都是），设备交互一律传 `enable_thinking: false`（OpenAI SDK 放在 `extra_body` 里）
- 切档参数统一：默认用默认档的 demo 提供 `--quality`（切到质量档）；默认用质量档的 demo 提供 `--cheap`（切回默认档，对比成本）。`run.py` 顶部各放一个常量，两个模型都写进 `solution.yaml` 的 `models`
- 默认档的单次输入超过 32K Token 后，单价约变成 3 倍。长输入（如 1 小时录音的逐字稿）要么分段，要么在 README 里按实际档位算成本
- 更高一档 `qwen3.7-plus`（2 / 8）、旗舰 `qwen3.8-max`（12 / 36）只在 README 里作为可选项提及，参考 demo 不默认用
- 来源：[视觉理解](https://help.aliyun.com/zh/model-studio/vision)（思考模式默认值）· [模型价格](https://help.aliyun.com/zh/model-studio/model-pricing)，查证 2026-10-01

### 各能力推荐

| 能力 | 推荐模型 | 接入 | 价格（京 / 新） | 来源 |
|---|---|---|---|---|
| 实时音视频对话（语音进语音出、看图、工具调用、MCP） | `qwen3.8-omni-flash-realtime` | WebSocket / WebRTC / AOQ，业务空间专属域名 | 音频入 6 / 6.781，音频出 12 / 13.636，文本图片入 1.5 / 1.677，文本出 4.5 / 5.104；音频入每秒 7 Token、出每秒 12.5 Token（空间音频输入翻倍） | [模型页](https://help.aliyun.com/zh/model-studio/qwen3-8-omni-flash-realtime) · [Realtime](https://help.aliyun.com/zh/model-studio/realtime) |
| 实时语音对话（纯音频） | `qwen-audio-3.0-realtime-flash`（单价与 `qwen3.8-omni-flash-realtime` 相同）；效果优先用 `qwen-audio-3.1-realtime-plus` | WebSocket | 3.1-plus：文本入 5、音频入 40、文本出 40、音频出 150（北京）；音频收发都按每秒 12.5 Token 折算 | [模型价格](https://help.aliyun.com/zh/model-studio/model-pricing)「实时语音对话」节 |
| 短录音转写 + 说话人分离（官方 ≤5 分钟） | `qwen-audio-3.1-asr-flash` | HTTP 同步，本地文件可 Base64；`speaker_diarization_enabled`；上下文 8,192 Token、单次最多输出 1,024 Token，密集讲话 3–5 分钟可能被截断（待实测），所以参考 demo 只把 ≤3 分钟的录音送同步接口，更长的一律走 `-filetrans` | 入 0.8 / 1.094，出 2.7 / 3.427（官方未写每秒音频折合多少 Token） | [HTTP API](https://help.aliyun.com/en/model-studio/fun-asr-flash-recorded-speech-recognition-http-api) |
| 长录音转写 + 说话人分离（≤12 小时） | `qwen-audio-3.1-asr-flash-filetrans`；按秒计费可选 `fun-asr`（0.00022 / 0.00026 元 / 秒） | HTTP 异步任务；公网 URL 或 `oss://` 临时 URL；`diarization_enabled` | 同上 | [非实时语音识别](https://www.alibabacloud.com/help/zh/model-studio/non-realtime-speech-recognition-user-guide) · [录音文件识别 HTTP API](https://help.aliyun.com/zh/model-studio/fun-asr-recorded-speech-recognition-http-api) |
| 流式转写 | `qwen-audio-3.0-asr-flash-streaming`（支持热词、Prompt 上下文）；备选 `fun-asr-realtime` | 任务制 WebSocket（`run-task`）/ AOQ | 0.00033 / 0.00066 元 / 秒；`qwen-audio-3.1-asr-flash-streaming` 按 Token 计（入 6、出 4.5） | [语音识别](https://help.aliyun.com/zh/model-studio/asr-model) · [模型价格](https://help.aliyun.com/zh/model-studio/model-pricing) |
| 语音合成 | `qwen-audio-3.0-tts-flash` / `-plus`（两地，含童声如 `longpaopao_v3.6`）；`cosyvoice-v3-flash`（两地，童声 `longhuhu_v3`）；`qwen-audio-3.1-tts-flash`（仅北京）；`cosyvoice-v3.5-*` 仅北京且没有系统音色，只能用复刻音色 | 任务制 WebSocket（两地）/ HTTP（仅北京） | 3.0-flash 1 / 1.124 元 / 万字符；3.0-plus 1.4 / 1.499；cosyvoice-v3-flash 1 / 0.954；3.1-flash 入 1.5、出 12（北京）。按字符计费时一个汉字算 2 个字符 | [语音合成](https://help.aliyun.com/zh/model-studio/tts-model) · 模型价格 |
| 同声传译 | `qwen3.8-livetranslate-flash-realtime` | Realtime WebSocket（业务空间专属域名）；RPM 10 | 音频入 40 / 54.688，图片入 3.3 / 4.01，文本出 100 / 145.835，音频出 160 / 218.752；音频入每秒 7 Token、出每秒 12.5 Token | [模型页](https://help.aliyun.com/zh/model-studio/qwen3-8-livetranslate-flash-realtime) |
| 拍照问答 / 图片理解 | 默认档 `qwen3.7-flash`（原生多模态，两地支持 Function Calling）；质量档 `qwen3.8-flash`；带语音提问时用 `qwen3.8-omni-flash`（音频 + 图片一次输入） | OpenAI 兼容；本地图 Base64 Data URI；每 32×32 像素约 1 Token | `qwen3.7-flash` ≤32K 入 0.2 / 0.225、出 0.8 / 0.974；`qwen3.8-omni-flash` 入 0.8 / 1.094、出 2.7 / 3.427 | [视觉理解](https://help.aliyun.com/zh/model-studio/vision) · 模型价格 |
| 文本对话 / 摘要 | 默认档 `qwen3.7-flash`；质量档 `qwen3.8-flash`（见上一小节） | OpenAI 兼容；传 `enable_thinking: false` | 见上一小节 | 模型价格 |
| 工具调用 / 多轮编排 | 多轮编排默认用质量档 `qwen3.8-flash`（`--cheap` 切默认档 `qwen3.7-flash`）；单次工具调用用默认档即可；再往上 `qwen3.7-plus`（`qwen3.8-max` 为旗舰） | OpenAI 兼容 Function Calling；传 `enable_thinking: false` | plus 入 2 / 2.998、出 8 / 11.991；max 入 12 / 14.988、出 36 / 44.965 | [Function Calling](https://help.aliyun.com/zh/model-studio/qwen-function-calling) · 模型价格 |

几条容易踩的坑：

- `qwen3.8-omni-flash`（非实时）只输出文本，默认开思考（`reasoning_effort` 默认 `xhigh`），设备场景传 `reasoning_effort: "none"`；音频按每秒 7 Token 计
- Function Calling：默认只返回一个工具调用，要多个时传 `parallel_tool_calls: true`；`tool_choice` 不支持 `"required"`，思考模式下也不能用对象形式强制调用
- Realtime 工具调用不支持 `tool_choice` / `parallel_tool_calls`，且不能与 `enable_search` 同时开
- Realtime 的 `usage` 只拆文本和音频两类，画面 Token 计在 `text_tokens` 里；对比 `representation_compact` 等画面压缩的效果，要看 `input_tokens` 总数（待真 Key 核对）
- 同传 3.8 与 3.5 的事件名不同（3.8 用 `response.text.delta` / `response.audio_transcript.delta`）；音频发完要先发 `session.finish`、等到 `session.finished` 再断开，否则最后一段会丢
- 异步转写的 `parameters` 必须传，没有参数也传 `{}`；`oss://` 地址要加请求头 `X-DashScope-OssResourceResolve: enable`，官方 SDK 不支持自定义请求头，只能直接调 HTTP

## 十、设备侧凭证

- demo 把长期 Key 放在本机 `.env`，只适合开发者自测
- 量产设备不放长期 Key：由业务服务端调用 `POST …/api/v1/tokens?expire_in_seconds=…` 换取临时 Key（北京示例为 `https://dashscope.aliyuncs.com`，新加坡用业务空间专属域名），设备拿临时 Key 连 Realtime / HTTP。临时 Key 以 `st-` 开头，默认 60 秒，可设 1–1,800 秒，继承原 Key 的全部权限，不能提前作废；见[生成临时 API Key](https://help.aliyun.com/zh/model-studio/generate-temporary-api-key)
- 临时 Key 能否用于业务空间专属域名上的 Realtime 连接，官方没有写明，量产前要实测
- 录音、图片等文件在量产中走自己的 OSS + STS 上传；百炼「临时存储」（`oss://`，48 小时）官方注明不用于生产
- 配套 APP 和网页由用户自己填 Key 和接入点（2026-10-02 决定）：只存用户本机，直连平台，不设代持 Key 的后端。要填哪些字段、地址怎么推导，由栈声明 `stacks/<栈>.yaml` 给出，见「十四、APP 数据」

## 十一、CI 与自检

[`check.py`](./check.py) 同时用于本地与 CI（[`.github/workflows/demo-smoke.yml`](../../.github/workflows/demo-smoke.yml)，Python 3.9 / 3.12）：

```bash
pip install pyyaml jsonschema              # 只有检查工具需要
python3 solutions/demo-standard/check.py   # = secrets + manifests + smoke + registry
python3 solutions/demo-standard/check.py sync   # 改完模板公共件后同步到各 demo
python3 solutions/demo-standard/build_registry.py   # 改了 demo、清单、样本、词表或栈声明后，重新生成 docs/app/data/
```

- **secrets**：扫描 git 跟踪的文件与未忽略的新文件，发现 `sk-` 形态 Key、阿里云 AccessKey、GitHub Token、私钥或提交了 `.env` 即失败；`sk-xxxx`、`sk-your-…` 等占位符放行
- **manifests**：`solution.yaml` 过 schema；`id` 与目录一致；必备文件齐全；README 含「三步跑通」；VERIFY.md 表头标准；`demo_kit.py` 与 `.env.example` 和模板逐字一致。v0.2 起另查：
  - `solution.yaml` 里的每个模型 ID 都要在 demo 的 `.py` 里以字符串出现（清单与 `run.py` 常量一致）
  - 模型不得在 2026-10-10 下线清单里（`check.py` 的 `DEPRECATED_MODELS`），也不得用带日期的快照或 `-latest` 别名
  - `.py`（`demo_kit.py` 除外）不得写死百炼域名，地址走 `Config` 的方法
  - 旧 demo（`LEGACY`）只查下线模型，允许快照名
- **manifests**（v0.3 新增）：
  - `features`、`experience.archetype`、`hardware.parts`、`compliance_tags` 只用 `vocab.yaml` 里的 id
  - 玩法列表第一个是 `default`、`args` 为空，id 不重复；`cover` 指向的文件存在；`models[].regions` 是方案 `regions` 的子集
  - `env` 只用栈声明里的字段，`services` 只用栈声明里的接入点
  - 栈声明过 `stack.schema.json`；`templates/bailian/.env.example` 的变量与声明的字段一致；按声明推导出的地址与 `demo_kit.Config` 算出的逐个相同（北京 / 新加坡 × 填与不填业务空间 ID）
- **smoke**：模板 + 每个 `solution.yaml` 的 `run.mock` + 旧 demo 清单（`check.py` 里的 `LEGACY`），在不带任何 `DASHSCOPE_*` 变量的子进程里运行，必须退出 0；新标准 demo 还必须打印 MOCK 标识和验证记录
- **registry**（v0.3 新增）：用 `build_registry.py` 在临时目录重新生成注册表、全部玩法的回放轨迹和资源副本，过 `registry.schema.json` / `trace.schema.json`，再与提交的 `docs/app/data/` 逐字节比对。不一致时按提示运行 `build_registry.py` 后提交

## 十二、新增一个百炼 demo

1. `cp -r solutions/demo-standard/templates/bailian solutions/by-category/<品类>/demo/bailian`
2. 改 `solution.yaml`（带「改」的字段，含 `features`、`experience`、`hardware`、`metrics.unit`）、`run.py`、`mock.py`、README、VERIFY.md 标题；README 里指向本标准的相对链接改为 `../../../../demo-standard/README.md`
3. 准备 `samples/` 与 `samples/README.md`（来源与许可）
4. 在品类的 `demo/README.md` 索引里加一行
5. `python3 solutions/demo-standard/build_registry.py` 生成回放轨迹和注册表，连同 `docs/app/data/` 的变化一起提交；新方案会自动出现在配套 APP 里
6. `python3 solutions/demo-standard/check.py` 全绿后提交；有 Key 时 `python3 run.py --record` 补验证记录（之后再跑一次 `build_registry.py`，实测值会进注册表）

## 十三、共享文件与改动边界

| 文件 | 谁来改 | 规则 |
|---|---|---|
| `demo-standard/templates/bailian/demo_kit.py`、`.env.example` | 维护者，单独 PR | 改后运行 `check.py sync` 同步到全部百炼 demo，同一个 PR 提交 |
| `demo-standard/check.py`、`build_registry.py`、`*.schema.json`、`vocab.yaml`、`stacks/`、`.github/workflows/demo-smoke.yml` | 维护者，单独 PR | 品类 PR 不改；需要新字段、新词条、新检查时先提议 |
| `docs/app/data/` | 谁改了数据源谁重新生成 | 生成物，不手改；品类 PR 只会改到自己方案的 `traces/<id>/`、`assets/<id>/` 和 `registry.json` 里自己的那一项 |
| `check.py` 的 `LEGACY` 清单 | 迁移旧 demo 的那个 PR | 只删自己品类的条目 |
| 品类目录 `by-category/<品类>/demo/bailian/`、该品类 `demo/README.md` | 负责该品类的人 | 互不交叉 |
| 根 `README.md`、`CHANGELOG.md`、`solutions/README.md` | 维护者合并后统一更新 | 品类 PR 不改，避免冲突 |

公共件或 `check.py` 升级后，已经开工的品类分支这样跟进：

1. `git fetch origin <基线分支>`，`git rebase origin/<基线分支>`（公共件只会在基线里改，正常不会冲突）
2. `python3 solutions/demo-standard/check.py sync`，单独提交一次「同步 demo 标准 v0.x 公共件」
3. `python3 solutions/demo-standard/build_registry.py`；`registry.json` 有冲突时不用手工合并，rebase 后直接重新生成即可
4. `python3 solutions/demo-standard/check.py` 全绿后推送（rebase 过的分支用 `git push --force-with-lease`）

## 十四、APP 数据：注册表、回放轨迹、凭证声明

配套网页 APP（`docs/app/`，Pages 上的静态网页）不按方案写代码，只读这里生成的数据：新增一个 `solution.yaml`，CI 通过后它就出现在 APP 里。

| 数据 | 位置 | 格式 | 从哪来 |
|---|---|---|---|
| 方案注册表 | `docs/app/data/registry.json` | `aihw/registry@0.1`，[`registry.schema.json`](./registry.schema.json) | 各 `solution.yaml`、VERIFY.md（实测值与「待实测」）、`solutions/by-category/README.md` 的两张品类表、`vocab.yaml`、栈声明 |
| 回放轨迹 | `docs/app/data/traces/<方案 id>/<玩法 id>.json` | `aihw/trace@0.1`，[`trace.schema.json`](./trace.schema.json) | 每个玩法的 `run.py --mock --trace`（在 demo 目录的干净副本里运行） |
| 资源副本 | `docs/app/data/assets/<方案 id>/samples/…`、`…/outputs/<玩法 id>/…` | 原文件 | `samples/` 全部文件；mock 生成的二进制产出（如回复音频）。文本产出直接写进轨迹 |
| 凭证声明 | `solutions/demo-standard/stacks/<栈>.yaml`，生成时并入注册表 | `aihw/stack@0.1`，[`stack.schema.json`](./stack.schema.json) | 维护者手写，每个栈一份 |

- **注册表**每个方案回答四个问题：效果（玩法与回放轨迹）、单次成本（mock 估算；有真跑记录时给实测值和日期）、硬件部件（`hardware.parts`）、合规义务（标签 → 一句话义务 → 品类 FAQ）；另有验证状态、模型、三步跑通命令和文档链接
- **回放轨迹**：`demo_kit` 的 `--trace <文件>` 记录 demo 打印的每一行，`[标签] 文字` 一行一条事件，后面缩进的续行归到同一条；横幅和验证记录不进事件，结构化地放进顶层字段和 `result`；结束时列出用到的样本和产出文件。用户在自己电脑上真跑时也能加 `--trace`，得到同样格式、带真实耗时的本地轨迹
- **凭证声明**：每个栈声明用户要自己填的字段（凭证与接入点）、接入点的推导规则（`endpoints.roots` 按顺序匹配，`services` 列出各接入点及能否从浏览器直连）、鉴权方式和安全建议。APP 和网页按它渲染填写表单，只存本机、直连平台；以后接小智、火山、TuyaOpen 各写一份，APP 不用改代码。百炼的声明是 `DASHSCOPE_API_KEY`、`DASHSCOPE_API_REGION`、`DASHSCOPE_WORKSPACE_ID`，与 `.env.example` 和 `demo_kit` 的地址表一致（`check.py` 校验）
- 兼容约定：同一个 `@0.x` 版本内只加字段；APP 要忽略不认识的字段和词表值；破坏性修改升版本号，并在过渡期同时生成新旧两种格式

## 十五、版本

- **v0.3（2026-10-02）**：
  - 配套 APP 数据：`build_registry.py` 生成方案注册表、回放轨迹和资源副本，CI 逐字节校验；栈声明 `stacks/bailian.yaml`；词表 `vocab.yaml`；三个新 schema
  - `demo_kit`：`--trace` 写回放轨迹；`today()` / `now()` 让 mock 输出可复现；缺业务空间 ID 时的提示改为「业务空间管理」页 API Host 列
  - `solution.yaml` 升 `aihw/solution@0.2`：`features`、`experience`（回放舞台、封面、玩法与接入点）、`hardware`、`metrics.unit`、`models[].regions`、`verification.level` / `evidence`
  - 写进标准的约定：合规标签表与 README 至少要写的内容；单次成本只算主交互；多轮看图时画面每轮重复计费；实时连接单线程收发、握手失败给可读报错；Realtime `usage` 不单列画面 Token；「待实测」的通用项
  - 向后兼容：`Config` 与 `finish()` 的签名不变，品类 demo 只需 `check.py sync`；mock 输出除 05 的日期改为固定值外逐字不变

- **v0.2（2026-10-01）**：
  - 地址：填了 `DASHSCOPE_WORKSPACE_ID` 时，`demo_kit` 的全部 HTTP / WebSocket 地址（OpenAI 兼容、DashScope 原生 HTTP、任务制 WebSocket 的流式 ASR / TTS、Realtime）都走业务空间专属域名；新增 `Config.ws_root()` / `workspace_host()` / `shared_api_base()`；`realtime_url()` 没填业务空间 ID 时改走通用域名（必须专属域名的模型仍由 `need_workspace=True` 拦下）
  - 文本模型分两档：默认档 `qwen3.7-flash`，质量档 `qwen3.8-flash`；多轮工具编排默认用质量档；切档参数统一为 `--quality` / `--cheap`
  - 成本可以写成区间（`finish(cost=(下限, 上限))`）；`fmt_cny` 小于 0.0001 元时不再输出科学计数法，其余输出与 v0.1 相同；`HttpError` 带 `status`（HTTP 状态码）
  - VERIFY.md 增加「待实测」清单
  - `check.py` 增加下线模型、快照名、清单与代码一致、写死域名四项检查
  - 用官方 SDK 的 demo 要求 `dashscope>=1.26.5`
  - 向后兼容：v0.1 的 `Config` 方法签名不变，品类 demo 代码不用改，只需 `check.py sync`
- **v0.1（2026-10-01）**：目录、`.env.example`、启动命令、三步跑通、`--mock`、`solution.yaml`、验证记录格式、CI
