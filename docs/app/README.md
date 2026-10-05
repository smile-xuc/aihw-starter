# docs/app — AIHW Starter 体验中心

GitHub Pages 上的静态网页，可以「添加到主屏幕」当 APP 用（PWA，看过的回放离线也能看）。面向产品体验者，首页精选「一看即懂」「会议纪要」，支持用自己的素材和百炼 Key 体验；保留 9 个品类的「方案索引 + 回放」。每个方案页回答四个问题——效果怎样、一次多少钱、做成产品要什么硬件、有哪些合规义务。凭证方向见 [APP 设计初稿评审](../designs/aihw-square/README.md#评审后的方向用户自填-key)。

- 地址：<https://smile-xuc.github.io/aihw-starter/app/>（Pages 是「从分支部署」master 的 `/docs`，合并即上线）
- 没有后端、没有构建链：HTML + CSS + 原生 ES 模块；数据由仓库里的生成器产出并入库
- 沿用官网的暖白底色、深灰文字、亮蓝主色与中性分隔线，统一线性图标和轻量微动效；系统深色和旧外观偏好均使用这一套浅色配色。手机底导航、平板紧凑导航与桌面侧栏共用一套页面。当前规范和参考见 [界面设计说明](UI_DESIGN.md)，[早期原型](../designs/aihw-square/)保留为存档

## 页面

| 页面 | 地址 | 内容 |
|---|---|---|
| 首页 | `#/` | 两个精选体验、最近体验、9 个商业化品类的场景与项目入口 |
| 品类页 | `#/c/<品类>` | 31 个代表项目及交付依据、商业／开发者用途筛选、行业速览、本仓参考实现与品类文档 |
| 方案页 | `#/s/<方案 id>[/<玩法 id>]`，也可以 `?s=<方案 id>` | ① 效果（回放 / 真跑，多个玩法可切换）② 一次多少钱 ③ 要什么硬件、三步跑通 ④ 合规义务；深入链接 |
| 我的 | `#/me` | 凭证配置与返回原体验、本机体验历史、打开/导出运行记录、离线缓存 |
| 硬件方案 | `#/hardware[/<项目 id>]` | 3 条 ESP32 设计路线：链路、原型 BOM、共享研发／服务器成本、进度、许可依据与实机缺口 |
| 成本账本 | `#/cost-lab` | 导入用户单价与轨迹、按请求 ID 去重、用量计价、账单差额、导出软预算计划；本页不调用模型 |

同一套页面适配 320px 手机、768px Pad 竖屏、1024px 横屏和宽屏桌面。768px 起改为侧边导航，桌面展开方案与成本两栏；无需安装原生 APP。九个品类均为商业化方向；具体项目的开发者用途与商业交付可以重叠，本仓验证进度单列。判断规则及九品类例子见 [项目定位分析](PROJECT_POSITIONING.md)，硬件规划见 [本轮 review](ITERATION_REVIEW.md)。

全局顶部保留「官网首页」真实链接，各级页面、加载失败和无 JavaScript 时均可返回官网；底部／侧栏的「体验、硬件、成本、我的」只切换体验中心内部功能。官网在 APP 的离线作用域之外，断网时普通点击或键盘激活会提示需要联网，继续留在可用的体验中心内。完整产品路径与修复依据见 [产品走查](../PRODUCT_REVIEW.md)。

## 两个精选体验

- **一看即懂**：用样本看回放，或上传 JPEG / PNG / WebP 图片，选择「识别物品、读取文字、翻译、解释」快捷问题，也可继续编辑。快捷问题只填入提问，不调用模型；保存 Key 后返回时保留本次草稿。用自己的 Key 运行后，回答与模型报告的「看不清 / 无法确定」分开显示，复制和下载同时保留两部分。旧文字记录没有独立不确定项时明确说明未提供，空数组也不代表全部看清。北京地域另有 HTTP 整段语音合成；新加坡只出文字。
- **会议纪要**：用样本看回放，或上传 WAV / MP3 短录音，生成摘要、决策、待办与逐字稿。录音须不超过 180 秒；上传百炼临时存储后，经 `qwen-audio-3.1-asr-flash-filetrans` 文件识别，再由 `qwen3.8-flash` 整理。单声道尝试分离说话人；双声道完整识别两轨并按声道标注，声道不是人物身份。摘要、决策、待办可分别复制，原始转写可展开、复制与下载；需人工核对末句。
- 百炼临时存储 **48 小时有效，官方注明不用于生产环境**；生产方案应配置自己的存储与访问控制。停止浏览器等待不会取消已提交云端任务或停止计费；失败后手动重试会创建新任务。上传、任务与结果的实际 CORS／权限仍待真 Key 验证。
- 原文件大小上限 **7 MiB**；照片仍需 Base64 编码，录音以文件上传。网页先检查文件头，再解码图片或读取录音时长；格式损坏、空文件、超限和未知时长不能开始真跑。暂不接 HEIC、长录音或视频。
- 支持原生文件选择与单文件拖放，提供拖入、核验、有效／错误状态和问题字数。多文件、目录、文本链接及格式／体积预检失败不会替换原草稿；实际解码失败会标出当前文件不可用。运行期间不能更换素材，仍可停止；拖放和核验不调用模型。
- 去配置凭证时，当前图片/录音和问题暂留在本页的 JS 内存中；保存或点击「暂不配置，返回体验」均回到原玩法，由用户点击开始。刷新或关闭页面会丢弃这份素材草稿。
- 首次打开「我的」且没有 Key 时，会提供两个免费样本入口；空历史同样可直接进入样本。免费回放不会写入体验历史。打开历史仅查看已保存的文字和运行记录，不恢复原始素材或旧 Key；返回体验页面后需检查素材与当前凭证，由用户确认是否再次运行。
- 「我的 → 缓存全部回放与素材」下载本站发布的轨迹及其输入、输出素材，确认写入 APP 缓存后才显示完成。下载失败或存储未就绪会列出未完成资源，可重试；不缓存个人上传素材和云端调用。
- 结果可复制、下载并导出 `aihw/trace@0.1`；技术过程可展开查看。成功、失败和停止的记录均可留在本机历史，刷新后仍可打开文本结果。原图、录音、临时合成音频地址和凭证不存入历史；历史受容量限制，存储失败会提示并保留当前导出能力。
- 会议纪要使用 `qwen3.8-flash` 的严格 JSON Schema，并将决策、待办关联到转写句子编号。点击来源可定位并高亮原句；关联由模型生成，仍需核对相关性与事实。时间缺失显示“时间未提供”，声道不等于人物。旧记录没有来源文件时继续展示文字，并说明无法回溯。
- 负责人、截止日期可人工修正和恢复 AI 原值，不会再次调用模型。原始 `minutes.json` 保留，修正单独存在 `minutes-edits.json`；复制、下载及导出包含用户修改和来源。已保存的历史原位更新；存储失败时保留页面内修正与导出能力，不假报保存成功。免费样本和导入记录的修正仅保留在当前页。
- 录音处理沿用 BYOK（自填百炼 Key）与百炼临时上传，文件有效期 48 小时，当前范围为体验验证；不配置自有 OSS 或新的账户托管服务。费用由用户百炼账号承担，历史不保存上传凭证、原录音和临时文件地址。
- 当前页面的失败／停止记录提供手动重新运行入口，仍需再次确认计费，不自动重试或自动切换接入点重新发出照片回答／播报请求。停止播报时保留已经完成的照片回答与不确定项；历史页面只查看文字，不提供缺少原始素材的直接重试。

## 费用、耗时与验证

- 完整接口用量乘价格表显示为「按用量计算」；推导费用显示「估算」；缺失必要用量显示「费用未知」，不会把缺失当作 0。
- 会议的文字首响应包含上传、排队、转写和纪要生成前的等待，不是实时麦克风延迟。filetrans 只返回时长而缺完整 Token 时，转写及总费用显示未知，不套用其他模型的每秒 Token 折算。
- 文字首包、整段语音地址就绪、总耗时与转写耗时分开显示。HTTP 整段合成没有音频首包指标，返回音频 URL 也不代表已经播放。浏览器指标包含网络耗时，与设备端首音频口径不同。
- 绿色 CI 验证本地逻辑和假百炼响应；不能证明官方接口、实际账单或手机实机操作已经通过。当前入口继续保留待真 Key 验证，验收步骤和真实证据模板见 [VERIFY_BROWSER.md](VERIFY_BROWSER.md)。
- 两个精选体验的结果质量使用 [固定质量验收包](QUALITY_ACCEPTANCE.md) 与 [结果记录模板](QUALITY_RESULT_TEMPLATE.md)：复用公开样本，按画面事实和原台词逐项核对；目前尚无真实模型评分。
- [二十例质量输入](tools/quality-fixtures/README.md)进一步覆盖 8 个照片、8 个录音和 4 个摘要阶段用例，6 份衍生录音在本机生成。`node docs/app/tools/prepare-quality.mjs --out 新目录` 只生成未运行清单及摘要请求体，不读取凭证、不执行模型调用。摘要层用例不代表 ASR 已测，来源合法不代表内容准确。

## 用户价格与实际成本跑测

1. 在「成本」下载单价模板，填写官方价格说明或合同版本、地域、生效日期。参考 [演练单价](tools/cost-fixtures/prices-example.json) 与 [演练计划](tools/cost-fixtures/plan-example.json)；其中价格明确为演练值，不能用于真实费用结论。模板所有单价为 `null`；ASR 按实际价格选择 Token 或时长字段，Omni 多模态拆分若接口没有返回对应计数，合计须保持未知。
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
- `index.html` 的 CSP `connect-src` 放行这些接入点及北京／新加坡官方 OSS 域（临时上传与转写结果下载不携带 API Key），页面不加载任何第三方脚本，也没有我们自己的服务器。以后接新栈时，CSP 要同步加上它的官方域名
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
| 07 录音卡 | ✅ 待真 Key 验证 | 样本或个人 WAV/MP3，≤3 分钟、7 MiB 文件上传 + 异步 filetrans + 3.8 纪要；双声道完整识别；上传 CORS 待真 Key 验证 |
| 08 智能手表 | ✅ 待真 Key 验证 | 两份日报；抬腕播报没做 |
| 09 具身智能 | ✅ 待真 Key 验证 | 本地安全门 + 看图多轮技能调用 |

会议纪要新增「实时录音纪要」：16 kHz PCM → qwen-audio-3.1-asr-flash-streaming → 确认原句 → qwen3.8-flash。需要用户配置并确认 [自托管 BYOK 网关](../../services/asr-gateway/README.md)，仓库没有公共托管地址。支持暂停／恢复、尾句收尾、断线保留确认转写和仅摘要重试；180 秒上限、总费用未知、原媒体不保存。网关只负责实时 ASR，文件识别和摘要仍沿用现有接入。

其他实时语音入口为什么仍只放回放：百炼官方 [Token 鉴权](https://help.aliyun.com/zh/model-studio/realtime-token-authentication) 写明 WebSocket、WebRTC、AOQ 都只在建连时认 `Authorization` 请求头——浏览器的 WebSocket 不能设请求头；WebRTC 的 SDP 交换被浏览器跨域拦截，[官方说明](https://help.aliyun.com/zh/model-studio/best-practice-webrtc-omni-realtime)要由服务端代理；AOQ 只有原生 SDK。[临时 Key](https://help.aliyun.com/zh/model-studio/generate-temporary-api-key) 也走同一个请求头，换成临时 Key 解决不了。2026-10-02 实测：网关会读取 URL 里的 `api_key` 参数（报错从 “No API-key provided” 变成 “Invalid API-key provided”），但官方没有文档，而且会把 Key 放进 URL，不采用。当前可选网关仅适配会议 ASR，没有将玩具／桌宠／耳机的 Omni 实时交互标成已接通。

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
PLAYWRIGHT_CORE=/tmp/pw/node_modules/playwright-core/index.mjs CHROME=$(command -v google-chrome) node docs/tools/product-smoke.mjs
PLAYWRIGHT_CORE=/tmp/pw/node_modules/playwright-core/index.mjs CHROME=$(command -v google-chrome) node docs/tools/interaction-smoke.mjs
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
├── css/app.css             统一清爽浅色、响应式工作区、组件状态与减少动效支持
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
├── tools/workspace-smoke.mjs 桌面/Pad、品类项目/硬件/账本交互与 SW v10 离线回归
├── tools/cost-run.mjs      mock/live 固定样本跑测；默认 mock、凭证只读环境
├── ITERATION_REVIEW.md     软硬件链路、费用/工时假设、项目定位与当前缺口
├── VERIFY_BROWSER.md       真实接口与真机验收步骤、待验证状态
├── icons/                  图标（取自 #35 原型）
└── data/                   注册表、轨迹、资源（solutions/demo-standard/build_registry.py 生成）
```
