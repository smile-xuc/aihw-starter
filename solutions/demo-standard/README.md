# 百炼参考 demo 统一标准 v0.1

> 目标：9 个品类各有一个「百炼参考 demo」——填入自己的百炼 Key，在本机用文件或麦克风 / 摄像头模拟设备，真实跑通一次；没有 Key 时自动 mock，供 CI 和快速体验。以后接入小智、TuyaOpen、火山等栈，按同一结构并列放置。
>
> 试点：[03 AI 玩具 / 陪伴（实时语音）](../by-category/03-toys-companion/demo/bailian/) · [07 录音卡（非实时）](../by-category/07-recorder/demo/bailian/)。模板：[`templates/bailian/`](./templates/bailian/)。

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
│   ├── VERIFY.md             验证记录
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
| `DASHSCOPE_WORKSPACE_ID` | 视模型 | 形如 `llm-xxx`，在控制台「业务空间管理」的 API Host 列；走业务空间专属域名时需要，`qwen3.8-omni-flash-realtime` 必须 |
| `AIHW_VERIFIED_BY` | 否 | 验证人 GitHub ID，`--record` 时写入 |

- Key、地域、业务空间三者必须属于同一地域，否则接口返回 401
- `.env` 可放在 demo 目录或仓库根目录；根目录放一份，全部 demo 共用。`.env` 已被 `.gitignore` 忽略
- 只读取 `DASHSCOPE_*` / `AIHW_*` 变量；空值、`xxx` / `your` 之类占位符一律视为未填
- 有 Key 但缺必需的业务空间 ID 时直接报错退出，不静默降级成 mock
- 用官方 SDK 的 demo 要显式把推导出的地址赋给 `dashscope.base_http_api_url` / `base_websocket_api_url`：SDK 在 `cn-beijing` 下默认仍走通用域名

## 三、一条启动命令

```bash
python3 run.py            # 有 Key：真跑；没有 Key：自动 mock，并在横幅里写明原因
python3 run.py --mock     # 强制 mock（CI 用）
python3 run.py --record   # 真跑成功后把一行验证记录追加到 VERIFY.md
python3 run.py --region ap-southeast-1   # 临时切地域
```

- `--mock` 只用标准库，不联网、不读写云端；live 依赖在 live 分支里才导入
- mock 必须走与 live 相同的协议代码：只把传输层换成 `mock.py` 里的假实现（WebSocket 事件或 HTTP 响应），按官方文档的事件顺序和字段回放
- 输出统一用 `[设备]`（模拟硬件动作）、`[云端]`（接口事件）、`[玩具]` / `[App]` 等（用户看到或听到的结果）、`[统计]`（延迟与成本）四类日志行，让硬件场景一眼可见
- 结束时调用 `demo_kit.finish()` 打印一行 VERIFY.md 格式的验证记录；mock 的记录只打印、不写入

## 四、README「三步跑通」

每个 demo 的 README 按这个顺序写（模板：[`templates/bailian/README.md`](./templates/bailian/README.md)）：

1. 标题 + 一句话场景 + 状态行（`待真 Key 验证` 或 `已验证 YYYY-MM-DD`）
2. **三步跑通**：① 装依赖（或「仅标准库」）② 复制 `.env.example` 为 `.env` 填 Key ③ `python3 run.py`；紧跟一句「没有 Key 时自动 mock」
3. 模拟的设备：部件 × 默认文件 × 真设备参数
4. 预期输出（mock）
5. 链路：接口地址、关键事件 / 字段
6. 常用参数
7. 计费与延迟口径：单价表（北京 / 新加坡，附官方链接与查证日期）、首字延迟起止点、免费额度
8. 常见问题、合规提示、文件清单

## 五、`solution.yaml`（最小清单）

完整约束见 [`solution.schema.json`](./solution.schema.json)，示例见两个试点。

| 字段 | 说明 |
|---|---|
| `schema` | 固定 `aihw/solution@0.1` |
| `id` | `<品类目录>.<栈>`，如 `03-toys-companion.bailian`；必须与所在目录一致 |
| `title` / `summary` | 名称；一句话「设备输入 → 模型 → 设备输出」 |
| `category` / `stack` / `kind` | 品类目录名；栈；`reference`（本仓可运行）或 `pointer`（只指向上游，此时必填 `upstream`） |
| `models[]` | 实际调用的模型 ID 与用途，一个模型一项 |
| `regions` | 两地都核实过可用的地域 |
| `env` | 真跑必需的环境变量 |
| `device.inputs` / `device.outputs` | 模拟方式，如 `wav` `mp3` `mic` `jpg` `camera` `url` / `speaker` `wav` `markdown` `json` `console` |
| `run.setup` / `run.live` / `run.mock` | 安装命令；真跑命令；mock 命令（CI 执行它） |
| `metrics.first_token` / `metrics.cost` | 本 demo 首字延迟的起止点；成本算法 |
| `verification` | `status`：`pending-live` / `live-verified`；`last_verified`；`record`（默认 `VERIFY.md`） |
| `license` / `compliance_tags` / `maintainers` | 许可；合规标签（`minors` `anthropomorphic` `recording-consent` `health` `camera-privacy` 等）；维护者 |

## 六、验证记录：`VERIFY.md`

表头固定，`--record` 追加到表格末尾，所以表格必须是文件最后一段：

```text
| 日期 | 地域 | 模型 | 首字延迟 | 单次成本（元） | 输入 | 环境 | 验证人 | 备注 |
```

- **日期**：真跑当天；**地域**：`cn-beijing` / `ap-southeast-1`；**模型**：本次实际调用的全部模型 ID
- **首字延迟**：用户感知的第一个输出到达的时间，起点在 `metrics.first_token` 写清：
  - 实时语音：松开按键（`input_audio_buffer.commit`）或 VAD 判停 → 首包音频
  - 非实时（录音、图片）：输入完成（开始上传）→ 第一个输出 token，含转写 / 上传耗时
- **单次成本**：一次交互的接口 `usage` × `run.py` 里的单价表（单价旁注明官方链接与查证日期）；接口不返回用量时写明估算方法
- **环境**：自动填系统与 Python 版本；网络环境（家庭宽带 / 4G 热点 / 机房）写进「备注」
- 至少一条真跑记录后，把 `solution.yaml` 的 `verification.status` 改成 `live-verified`、填 `last_verified`，README 状态行同步更新

## 七、设备模拟

- 默认输入放 `samples/`，必须可随仓库分发：本仓自制、AI 生成，或用 [`tools/make_speech_sample.py`](./tools/make_speech_sample.py) 离线合成（Kokoro-82M，Apache-2.0；同时输出每句起止时间，可直接当 mock 的标准答案）。不放来源不明的录音和照片，不放可识别的人脸
- 真设备是可选项：`requirements-device.txt` 里放 `sounddevice`（麦克风 / 扬声器）、`opencv-python`（摄像头），用 `--mic` / `--camera` 打开
- 音频统一转 16 kHz 单声道 16-bit PCM（`demo_kit.read_wav` 自动重采样）；图片按接口要求压缩（如 Realtime 要求 JPG、编码前 ≤190 KB）
- 设备动作（电机、灯光、屏幕）用 `[设备]` 日志模拟，量产时替换成驱动调用的位置要在代码里一眼能找到（如 03 的 `Toy.act()`）

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
| 新加坡缺的 | — | `cosyvoice-v3.5-*`、`paraformer-*`、`qwen-audio-3.1-tts-flash`、多模态交互开发套件；Qwen-Audio-TTS 的 HTTP 接口只在北京，新加坡要走 WebSocket |

- 通用域名「当前可继续使用」，但官方注明自 2026-09-30 起不再支持新特性；新 demo 一律建议填业务空间 ID
- `demo_kit.Config`：填了业务空间 ID 时 HTTP 也走专属域名，否则走通用域名；Realtime 一律走专属域名
- `regions` 只写两地都核实过可用的；只在北京可用的模型（如 `cosyvoice-v3.5-flash`）要在 `solution.yaml` 只写 `cn-beijing`
- 价格页另列美国（弗吉尼亚）、德国（法兰克福）、日本（东京）、中国香港等地域，部分模型可用；语音类 WebSocket 文档只给了北京与新加坡，本标准暂只覆盖这两地
- 来源：[地域](https://help.aliyun.com/zh/model-studio/regions) · [Base URL](https://help.aliyun.com/zh/model-studio/base-url) · [Qwen-Omni-Realtime](https://help.aliyun.com/zh/model-studio/realtime)（2026-09-24）· [Realtime Python SDK](https://www.alibabacloud.com/help/zh/model-studio/omni-realtime-python-sdk) · [非实时语音识别](https://www.alibabacloud.com/help/zh/model-studio/non-realtime-speech-recognition-user-guide)（2026-09-22）· [模型价格](https://help.aliyun.com/zh/model-studio/model-pricing)

## 九、百炼能力速查（查证 2026-10-01）

参考 demo 默认选用下表的「推荐」列；换模型时改 `run.py` 顶部常量与 `solution.yaml` 的 `models`。价格单位：元 / 百万 Token，或注明的单位；「京 / 新」= 北京 / 新加坡。

| 能力 | 推荐模型 | 接入 | 价格（京 / 新） | 来源 |
|---|---|---|---|---|
| 实时音视频对话（语音进语音出、看图、工具调用、MCP） | `qwen3.8-omni-flash-realtime` | WebSocket / WebRTC，业务空间专属域名 | 音频入 6 / 6.781，音频出 12 / 13.636，文本图片入 1.5 / 1.677，文本出 4.5 / 5.104 | [模型页](https://help.aliyun.com/zh/model-studio/qwen3-8-omni-flash-realtime) |
| 实时语音对话（纯音频） | `qwen-audio-3.1-realtime-plus`；成本敏感用 `qwen-audio-3.0-realtime-flash`（单价与 `qwen3.8-omni-flash-realtime` 相同） | WebSocket | 3.1-plus：文本入 5、音频入 40、文本出 40、音频出 150（北京）；音频按每秒 12.5 Token 折算 | [模型价格](https://help.aliyun.com/zh/model-studio/model-pricing)「实时语音对话」节 |
| 文件转写 + 说话人分离（≤5 分钟） | `qwen-audio-3.1-asr-flash` | HTTP 同步，本地文件可 Base64；`speaker_diarization_enabled` | 入 0.8 / 1.094，出 2.7 / 3.427（官方未写每秒音频折合多少 Token） | [HTTP API](https://help.aliyun.com/en/model-studio/fun-asr-flash-recorded-speech-recognition-http-api) |
| 长录音转写 + 说话人分离（≤12 小时） | `qwen-audio-3.1-asr-flash-filetrans`；按秒计费可选 `fun-asr`（0.00022 / 0.00026 元 / 秒） | HTTP 异步任务；公网 URL 或 `oss://` 临时 URL；`diarization_enabled` | 同上 | [非实时语音识别](https://www.alibabacloud.com/help/zh/model-studio/non-realtime-speech-recognition-user-guide) · [录音文件识别 HTTP API](https://help.aliyun.com/zh/model-studio/fun-asr-recorded-speech-recognition-http-api) |
| 流式转写 | `qwen-audio-3.1-asr-flash-streaming` | 任务制 WebSocket（`run-task`） | 入 6 / 6.781，出 4.5 / 5.104 | [模型价格](https://help.aliyun.com/zh/model-studio/model-pricing) |
| 语音合成 | `qwen-audio-3.0-tts-flash` / `-plus`（两地，含童声如 `longpaopao_v3.6`）；`cosyvoice-v3-flash`（两地，童声 `longhuhu_v3`）；`qwen-audio-3.1-tts-flash`（仅北京）；`cosyvoice-v3.5-*` 仅北京且没有系统音色，只能用复刻音色 | 任务制 WebSocket（两地）/ HTTP（仅北京） | 3.0-flash 1 / 1.124 元 / 万字符；3.0-plus 1.4 / 1.499；cosyvoice-v3-flash 1 / 0.954；3.1-flash 入 1.5、出 12（北京）。按字符计费时一个汉字算 2 个字符 | [语音合成](https://help.aliyun.com/zh/model-studio/tts-model) · 模型价格 |
| 同声传译 | `qwen3.8-livetranslate-flash-realtime` | Realtime WebSocket（业务空间专属域名）；RPM 10 | 音频入 40 / 54.688，图片入 3.3 / 4.01，文本出 100 / 145.835，音频出 160 / 218.752；音频入每秒 7 Token、出每秒 12.5 Token | [模型页](https://help.aliyun.com/zh/model-studio/qwen3-8-livetranslate-flash-realtime) |
| 图片理解 | `qwen3.7-flash`（低价原生多模态，两地支持 Function Calling）；`qwen3-vl-flash`；`qwen3.7-plus` / `qwen3.8-omni-flash`（综合） | OpenAI 兼容；本地图 Base64 Data URI | `qwen3.7-flash` ≤32K 入 0.2、出 0.8；`qwen3-vl-flash` 入 0.15、出 1.5（≤32K，北京）；`qwen3.8-omni-flash` 入 0.8 / 1.094、出 2.7 / 3.427 | [视觉理解](https://help.aliyun.com/zh/model-studio/vision) · 模型价格 |
| 文本 / 工具调用 | `qwen3.8-flash`；`qwen3.7-flash`（更便宜）；`qwen3.7-plus`；`qwen3.8-max` | OpenAI 兼容，Function Calling；以上四个默认开思考，延迟敏感时传 `enable_thinking: false` | flash 入 0.8 / 1.094、出 2.7 / 3.427；plus 入 2 / 2.998、出 8 / 11.991；max 入 12 / 14.988、出 36 / 44.965 | [Function Calling](https://help.aliyun.com/zh/model-studio/qwen-function-calling) · 模型价格 |

几条容易踩的坑：

- `qwen3.8-omni-flash`（非实时）只输出文本，默认开思考（`reasoning_effort` 默认 `xhigh`），设备场景传 `reasoning_effort: "none"`；音频按每秒 7 Token 计
- Function Calling：默认只返回一个工具调用，要多个时传 `parallel_tool_calls: true`；`tool_choice` 不支持 `"required"`，思考模式下也不能用对象形式强制调用
- Realtime 工具调用不支持 `tool_choice` / `parallel_tool_calls`，且不能与 `enable_search` 同时开
- 同传 3.8 与 3.5 的事件名不同（3.8 用 `response.text.delta` / `response.audio_transcript.delta`）；音频发完要先发 `session.finish`、等到 `session.finished` 再断开，否则最后一段会丢
- 异步转写的 `parameters` 必须传，没有参数也传 `{}`；`oss://` 地址要加请求头 `X-DashScope-OssResourceResolve: enable`，官方 SDK 不支持自定义请求头，只能直接调 HTTP

## 十、设备侧凭证

- demo 把长期 Key 放在本机 `.env`，只适合开发者自测
- 量产设备不放长期 Key：由业务服务端调用 `POST …/api/v1/tokens?expire_in_seconds=…` 换取临时 Key（北京示例为 `https://dashscope.aliyuncs.com`，新加坡用业务空间专属域名），设备拿临时 Key 连 Realtime / HTTP。临时 Key 以 `st-` 开头，默认 60 秒，可设 1–1,800 秒，继承原 Key 的全部权限，不能提前作废；见[生成临时 API Key](https://help.aliyun.com/zh/model-studio/generate-temporary-api-key)
- 临时 Key 能否用于业务空间专属域名上的 Realtime 连接，官方没有写明，量产前要实测
- 录音、图片等文件在量产中走自己的 OSS + STS 上传；百炼「临时存储」（`oss://`，48 小时）官方注明不用于生产

## 十一、CI 与自检

[`check.py`](./check.py) 同时用于本地与 CI（[`.github/workflows/demo-smoke.yml`](../../.github/workflows/demo-smoke.yml)，Python 3.9 / 3.12）：

```bash
pip install pyyaml jsonschema              # 只有检查工具需要
python3 solutions/demo-standard/check.py   # = secrets + manifests + smoke
python3 solutions/demo-standard/check.py sync   # 改完模板公共件后同步到各 demo
```

- **secrets**：扫描 git 跟踪的文件与未忽略的新文件，发现 `sk-` 形态 Key、阿里云 AccessKey、GitHub Token、私钥或提交了 `.env` 即失败；`sk-xxxx`、`sk-your-…` 等占位符放行
- **manifests**：`solution.yaml` 过 schema；`id` 与目录一致；必备文件齐全；README 含「三步跑通」；VERIFY.md 表头标准；`demo_kit.py` 与 `.env.example` 和模板逐字一致
- **smoke**：模板 + 每个 `solution.yaml` 的 `run.mock` + 旧 demo 清单（`check.py` 里的 `LEGACY`），在不带任何 `DASHSCOPE_*` 变量的子进程里运行，必须退出 0；新标准 demo 还必须打印 MOCK 标识和验证记录

## 十二、新增一个百炼 demo

1. `cp -r solutions/demo-standard/templates/bailian solutions/by-category/<品类>/demo/bailian`
2. 改 `solution.yaml`（带「改」的字段）、`run.py`、`mock.py`、README、VERIFY.md 标题；README 里指向本标准的相对链接改为 `../../../../demo-standard/README.md`
3. 准备 `samples/` 与 `samples/README.md`（来源与许可）
4. 在品类的 `demo/README.md` 索引里加一行
5. `python3 solutions/demo-standard/check.py` 全绿后提交；有 Key 时 `python3 run.py --record` 补验证记录

## 十三、共享文件与改动边界

| 文件 | 谁来改 | 规则 |
|---|---|---|
| `demo-standard/templates/bailian/demo_kit.py`、`.env.example` | 维护者，单独 PR | 改后运行 `check.py sync` 同步到全部百炼 demo，同一个 PR 提交 |
| `demo-standard/check.py`、`solution.schema.json`、`.github/workflows/demo-smoke.yml` | 维护者，单独 PR | 品类 PR 不改；需要新字段 / 新检查时先提议 |
| `check.py` 的 `LEGACY` 清单 | 迁移旧 demo 的那个 PR | 只删自己品类的条目 |
| 品类目录 `by-category/<品类>/demo/bailian/`、该品类 `demo/README.md` | 负责该品类的人 | 互不交叉 |
| 根 `README.md`、`CHANGELOG.md`、`solutions/README.md` | 维护者合并后统一更新 | 品类 PR 不改，避免冲突 |
