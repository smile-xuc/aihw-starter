# docs/app — AIHW 功能广场

GitHub Pages 上的静态网页，可以「添加到主屏幕」当 APP 用（PWA，看过的回放离线也能看）。面向产品体验者，首页精选「一看即懂」「会议纪要」，支持用自己的素材和百炼 Key 体验；保留 9 个品类的「方案索引 + 回放」。每个方案页回答四个问题——效果怎样、一次多少钱、做成产品要什么硬件、有哪些合规义务。凭证方向见 [APP 设计初稿评审](../designs/aihw-square/README.md#评审后的方向用户自填-key)。

- 地址：<https://smile-xuc.github.io/aihw-starter/app/>（Pages 是「从分支部署」master 的 `/docs`，合并即上线）
- 没有后端、没有构建链：HTML + CSS + 原生 ES 模块；数据由仓库里的生成器产出并入库
- 视觉沿用 [PR #35 的原型](../designs/aihw-square/)（只保留一套自适应主题）；原型留作设计存档

## 页面

| 页面 | 地址 | 内容 |
|---|---|---|
| 首页 | `#/` | 两个精选体验、最近体验、9 个商业化品类的场景与项目入口 |
| 品类页 | `#/c/<品类>` | 31 个代表项目及交付依据、商业／开发者用途筛选、行业速览、本仓参考实现与品类文档 |
| 方案页 | `#/s/<方案 id>[/<玩法 id>]`，也可以 `?s=<方案 id>` | ① 效果（回放 / 真跑，多个玩法可切换）② 一次多少钱 ③ 要什么硬件、三步跑通 ④ 合规义务；深入链接 |
| 我的 | `#/me` | 凭证配置与返回原体验、本机体验历史、打开/导出运行记录、离线缓存、外观 |
| 硬件方案 | `#/hardware[/<项目 id>]` | 3 条 ESP32 设计路线：链路、原型 BOM、共享研发／服务器成本、进度、许可依据与实机缺口 |
| 跑测账本 | `#/cost-lab` | 导入用户单价与轨迹、按请求 ID 去重、用量计价、账单差额、导出软预算计划；本页不调用模型 |

同一套页面适配 320px 手机、768px Pad 竖屏、1024px 横屏和宽屏桌面。768px 起改为侧边导航，桌面展开方案与成本两栏；无需安装原生 APP。九个品类均为商业化方向；具体项目的开发者用途与商业交付可以重叠，本仓验证进度单列。判断规则及九品类例子见 [项目定位分析](PROJECT_POSITIONING.md)，硬件规划见 [本轮 review](ITERATION_REVIEW.md)。

## 两个精选体验

- **一看即懂**：用样本看回放，或上传 JPEG / PNG / WebP 图片并输入问题，用自己的 Key 取得文字回答。北京地域另有 HTTP 整段语音合成；新加坡只出文字。
- **会议纪要**：用样本看回放，或上传 WAV / MP3 短录音，生成摘要、决策、待办与逐字稿。录音须不超过 180 秒；疑似转写截断会给出提示，需人工核对末句。
- 原文件大小上限 **7 MiB**，为 Base64 编码留出空间。网页先检查文件头，再解码图片或读取录音时长；格式损坏、空文件、超限和未知时长不能开始真跑。暂不接 HEIC、长录音或视频。
- 去配置凭证时，当前图片/录音和问题暂留在本页的 JS 内存中；保存后返回原玩法，由用户点击开始。刷新或关闭页面会丢弃这份素材草稿。
- 结果可复制、下载并导出 `aihw/trace@0.1`；技术过程可展开查看。成功、失败和停止的记录均可留在本机历史，刷新后仍可打开文本结果。原图、录音、临时合成音频地址和凭证不存入历史；历史受容量限制，存储失败会提示并保留当前导出能力。

## 费用、耗时与验证

- 完整接口用量乘价格表显示为「按用量计算」；推导费用显示「估算」；缺失必要用量显示「费用未知」，不会把缺失当作 0。
- 文字首包、整段语音地址就绪、总耗时与转写耗时分开显示。HTTP 整段合成没有音频首包指标，返回音频 URL 也不代表已经播放。浏览器指标包含网络耗时，与设备端首音频口径不同。
- 绿色 CI 验证本地逻辑和假百炼响应；不能证明官方接口、实际账单或手机实机操作已经通过。当前入口继续保留待真 Key 验证，验收步骤和真实证据模板见 [VERIFY_BROWSER.md](VERIFY_BROWSER.md)。
- 两个精选体验的结果质量使用 [固定质量验收包](QUALITY_ACCEPTANCE.md) 与 [结果记录模板](QUALITY_RESULT_TEMPLATE.md)：复用公开样本，按画面事实和原台词逐项核对；目前尚无真实模型评分。

## 用户价格与实际成本跑测

1. 在「跑测」下载单价模板，填写官方价格说明或合同版本、地域、生效日期。参考 [演练单价](tools/cost-fixtures/prices-example.json) 与 [演练计划](tools/cost-fixtures/plan-example.json)；其中价格明确为演练值，不能用于真实费用结论。模板所有单价为 `null`；ASR 按实际价格选择 Token 或时长字段，Omni 多模态拆分若接口没有返回对应计数，合计须保持未知。
2. 导入运行轨迹或选择本机历史。生效日按所选地域零点（北京／新加坡 UTC+8）起算。账本只计 `mode: live`；同地域同请求 ID 的相同证据去重，冲突变未知。失败、停止或缺用量不推断免费。来源仍需人工确认，导入文件不证明它确实来自服务商。
3. 提供同账号、业务空间、地域、时间窗的账单金额，并确认范围，才显示账单差额。优惠／缓存／取整按实际规则填入价格表；报告保存模型、请求 ID、计数、价格和金额，不保存回答、媒体、Key 或请求头。
4. 导出计划供下面的 runner 使用。计划最大 6 场景、每场景 1–10 次；每次预留金额总和不超过预算。浮点边界允许计算误差，不把实质超额当作可执行。

```bash
# 激活已配置的 Python 环境，使用 CI 同款 Playwright 和 Chrome。
PLAYWRIGHT_CORE=/path/to/playwright-core/index.mjs CHROME=/path/to/chromium \
node docs/app/tools/cost-run.mjs --mock \
  --plan docs/app/tools/cost-fixtures/plan-example.json \
  --prices docs/app/tools/cost-fixtures/prices-example.json \
  --out /tmp/aihw-cost-mock-new
```

默认是 mock，全部官方请求转给本机假接口，每份轨迹标记 mock，不能纳入实测合计。输出目录必须不存在，避免覆盖旧报告。

真实运行由本地／云任务执行相同命令并显式使用 `--live`，传入用户确认的价格和计划文件。凭证须预先安全注入 `DASHSCOPE_API_KEY`、`DASHSCOPE_WORKSPACE_ID`，可另设 `DASHSCOPE_API_REGION`；不要写在命令、计划、价格文件或提交中。真实模式要求非演练价格、所选模型完整单价和 `acknowledge_billing_risk: true`，使用临时浏览器上下文，关闭后不保留凭证。用内置固定样本顺序执行、记录成功／失败／停止，成本未知或失败后不再跑下一场景，不自动重试。

**软预算无法限制服务商单次收费。** 下一场景开始前预留额度；一个场景内仍可能有多个请求，停止和超时也可能计费。账号侧额度、价格条款及账单由用户控制和复核。当前尚无真实凭证、费用授权和实际账单，本轮只跑 mock。

## 凭证：用户自己填，只存本机，只发官方接入点

- 表单按栈声明（`aihw/stack@0.1`，百炼见 [`stacks/bailian.yaml`](../../solutions/demo-standard/stacks/bailian.yaml)）的 `fields` 渲染：百炼是 API Key、地域、业务空间 ID
- 只存在这台设备的浏览器存储里，键名 `aihw.credentials.<栈>`，字段名与 `.env` 变量名相同：勾「记在这台设备上」存 `localStorage`，不勾存 `sessionStorage`（关页面即清）；「清除」两处都删
- 请求只发往按栈声明 `endpoints.roots` 推导出的官方接入点（百炼：`dashscope.aliyuncs.com`、`dashscope-intl.aliyuncs.com`、`<业务空间ID>.<地域>.maas.aliyuncs.com`），凭证只放进 `auth` 声明的请求头。代进域名的值只能是字母、数字和连字符，并且要符合字段的 `pattern`
- `index.html` 的 CSP `connect-src` 只放行这几个域名，页面不加载任何第三方脚本，也没有我们自己的服务器。以后接新栈时，CSP 要同步加上它的官方域名
- 专属域名的某个接口在浏览器里被跨域拦截时（预检失败，请求本身没有发出），本次会话改走下一条匹配的根地址（同地域的通用域名），并在时间线上提示
- 没填凭证：所有方案只放回放
- 页面上列出栈声明的 `security_advice`，并提示 `smile-xuc.github.io` 下的其他 Pages 页面与本页同源

## 哪些玩法能在浏览器里真跑

一个玩法能网页真跑，要同时满足：APP 里有它的 runner（`js/live/run-*.js`），并且 runner 实际调用的接入点在栈声明里都是 `browser: ok`。方案页还会按 `credentials.required` 提示缺哪些字段。

| 方案 · 玩法 | 网页真跑 | 说明 |
|---|---|---|
| 01 IPC | ✅ 待真 Key 验证 | 4 帧事件卡 + 检索 + 日报 |
| 02 AI 眼镜 · 拍照即问 | ✅ 待真 Key 验证 | 样本或个人图片 + 问题；设备播报走任务制 WebSocket，浏览器版用非实时 HTTP 合成（仅北京），新加坡只出文字；必须填业务空间 ID |
| 02 AI 眼镜 · 给 AI 打电话 | ❌ 只放回放 | 实时语音 |
| 03 AI 玩具 | ❌ 只放回放 | 实时语音 |
| 04 Agent 硬件 · 端侧 + 云端编排 | ✅ 待真 Key 验证 | 端侧规则 + 语音转写 + 多轮工具编排 |
| 04 Agent 硬件 · 断网降级 | — | 不调用云端，回放就是完整过程 |
| 05 桌宠 | ❌ 只放回放 | 实时语音 |
| 06 AI 耳机 | ❌ 只放回放 | 实时语音（同传） |
| 07 录音卡 | ✅ 待真 Key 验证 | 样本或个人 WAV/MP3，≤3 分钟同步转写 + 纪要；疑似截断提示；长录音的临时上传没做 |
| 08 智能手表 | ✅ 待真 Key 验证 | 两份日报；抬腕播报没做 |
| 09 具身智能 | ✅ 待真 Key 验证 | 本地安全门 + 看图多轮技能调用 |

实时语音为什么跑不了：百炼官方 [Token 鉴权](https://help.aliyun.com/zh/model-studio/realtime-token-authentication) 写明 WebSocket、WebRTC、AOQ 都只在建连时认 `Authorization` 请求头——浏览器的 WebSocket 不能设请求头；WebRTC 的 SDP 交换被浏览器跨域拦截，[官方说明](https://help.aliyun.com/zh/model-studio/best-practice-webrtc-omni-realtime)要由服务端代理；AOQ 只有原生 SDK。[临时 Key](https://help.aliyun.com/zh/model-studio/generate-temporary-api-key) 也走同一个请求头，换成临时 Key 解决不了。2026-10-02 实测：网关会读取 URL 里的 `api_key` 参数（报错从 “No API-key provided” 变成 “Invalid API-key provided”），但官方没有文档，而且会把 Key 放进 URL，不采用。

## 数据

| 路径 | 内容 | 谁生成 |
|---|---|---|
| `data/registry.json` | 方案注册表（含词表与栈声明），`aihw/registry@0.1` | [`build_registry.py`](../../solutions/demo-standard/build_registry.py)，入库，CI 逐字节校验 |
| `data/traces/<方案 id>/<玩法 id>.json` | 回放轨迹，`aihw/trace@0.1` | 同上（各玩法 `run.py --mock --trace`） |
| `data/assets/<方案 id>/…` | 样本图片、录音、传感器数据；mock 的二进制产出 | 同上 |
| `live-data/<方案 id>.json` | 浏览器真跑用的模型 ID、提示词、工具定义、单价 | `tools/build.py` 从各 demo 的 `run.py` 直接导入，入库；JS 里不另抄一份 |
| `js/positioning.js` | 品类商业场景与代表项目定位、交付范围、资料链接 | 人工复核已有项目卡；独立于生成注册表和调用验证，不作实时在售保证 |

- `data/` 的格式见 [demo 标准](../../solutions/demo-standard/README.md)第十四节；这个目录归生成器，APP 只读、不写
- 通用回放按事件的 `kind`、续行和文件类型渲染；两个精选体验额外提供对应素材输入与结果展示，约定集中在 `js/experience.js`
- 新增一个 `demo/<栈>/solution.yaml` 并重新生成注册表，它就出现在首页、品类页和方案页（回放、成本、硬件、合规都从数据来），APP 代码不用改。想让它在浏览器里真跑，再加一个 `js/live/run-<方案 id>.js`，在 `js/live/index.js` 登记它调用的接入点，并在 `tools/build.py` 的 `LIVE` 里列出要导入的常量
- 改了某个 demo `run.py` 里被导入的常量，运行 `python3 docs/app/tools/build.py` 后提交 `live-data/`；常量改名时 `build.py` 会报错并指出要同步改 `LIVE`
- 注册表里没有的少量界面约定（计划接入的栈、测试连接用的模型等）在 `js/meta.js`

## 本地预览与测试

```bash
python3 -m pip install pyyaml jsonschema        # 生成器检查与轨迹契约测试依赖，建议在虚拟环境内安装
python3 docs/app/tools/build.py --check          # live-data/ 与 run.py 一致、注册表引用齐全
node --test docs/app/tools/*.test.mjs            # 素材、流式响应、指标、历史与路由回归（Node 22+，使用当前 python3）
python3 -m http.server 8000 -d docs              # 打开 http://localhost:8000/app/

# 冒烟测试（CI 同款）：全部页面和玩法无报错、390 px 不横向溢出；能网页真跑的玩法对着各 demo 的 mock.py 完整跑一遍
npm install --no-save --prefix /tmp/pw playwright-core
PLAYWRIGHT_CORE=/tmp/pw/node_modules/playwright-core/index.mjs CHROME=$(command -v google-chrome) node docs/app/tools/smoke.mjs
PLAYWRIGHT_CORE=/tmp/pw/node_modules/playwright-core/index.mjs CHROME=$(command -v google-chrome) node docs/app/tools/workspace-smoke.mjs
```

冒烟测试使用测试凭证与本地假百炼，不产生云端调用。它检查页面、素材输入、配置返回、结果与历史的行为及手机宽度布局；另用允许 Service Worker 的独立桌面 Chrome 上下文，验证首次安装后的断网刷新、两个精选样本的离线结果/回放/导出和缓存隔离。真实接口、实际手机 Safari / Android Chrome 仍须按 [验收记录](VERIFY_BROWSER.md) 实测。

## 部署与 CI

- 部署：Pages 设置不用改，仍是「从分支部署」master 的 `/docs`（Jekyll）；`data/` 和 `live-data/` 都入库，合并即上线
- CI：[`.github/workflows/pages.yml`](../../.github/workflows/pages.yml) 在 PR 和 master 上跑 `build.py --check`、Node 回归测试、与 Pages 同款的 Jekyll 构建、网页 APP 冒烟测试

## 文件

```text
docs/app/
├── index.html              入口；CSP 只放行本站和百炼官方接入点
├── manifest.webmanifest    PWA 清单    sw.js  离线缓存（只缓存本站 GET，不碰云端接口）
├── css/app.css             视觉令牌与组件（来自 #35 原型）
├── js/main.js              路由    js/pages/  首页、品类页、方案页、我的
├── js/data.js              读 data/    js/replay.js  通用回放舞台    js/meta.js  少量界面约定
├── js/settings.js          凭证的本机存储与校验（按栈声明）
├── js/experience.js        素材草稿、解码校验、结果与浏览器轨迹
├── js/history.js           有容量限制的本机文字历史
├── js/projects.js          固定上游依据、3 条 ESP32 规划与可编辑成本假设
├── js/cost.js              用户价格、核账、计划校验与软预算调度（不负责网络）
├── js/live/                浏览器真跑：client.js 直连，input.js 素材校验，index.js 能力判断，run-*.js 各玩法流程
├── live-data/              真跑常量（tools/build.py 生成）
├── tools/build.py          生成 live-data/ 与自检    tools/smoke.mjs + fake_bailian.py  冒烟测试
├── tools/*.test.mjs        素材、接口响应、指标、历史与轨迹契约回归
├── tools/workspace-smoke.mjs 桌面/Pad、品类项目/硬件/账本交互与 SW v6 离线回归
├── tools/cost-run.mjs      mock/live 固定样本跑测；默认 mock、凭证只读环境
├── ITERATION_REVIEW.md     软硬件链路、费用/工时假设、项目定位与当前缺口
├── VERIFY_BROWSER.md       真实接口与真机验收步骤、待验证状态
├── icons/                  图标（取自 #35 原型）
└── data/                   注册表、轨迹、资源（solutions/demo-standard/build_registry.py 生成）
```
