# docs/app — AIHW 网页 APP（MVP）

GitHub Pages 上的静态网页，可以「添加到主屏幕」当 APP 用（PWA，看过的回放离线也能看）。按 [APP 设计初稿评审](../designs/aihw-square/README.md#评审后的方向用户自填-key) 的 MVP 范围实现：9 个品类的百炼参考方案做成「方案索引 + 回放」，每个方案页回答四个问题——效果怎样、一次多少钱、做成产品要什么硬件、有哪些合规义务。

- 地址：<https://smile-xuc.github.io/aihw-starter/app/>（Pages 是「从分支部署」master 的 `/docs`，合并即上线）
- 没有后端、没有构建链：HTML + CSS + 原生 ES 模块；数据由仓库里的生成器产出并入库
- 视觉沿用 [PR #35 的原型](../designs/aihw-square/)（只保留一套自适应主题）；原型留作设计存档

## 页面

| 页面 | 地址 | 内容 |
|---|---|---|
| 首页 | `#/` | 9 个品类卡片：单次成本、体验方式（回放 / 网页真跑 / 本机真跑）、合规标签、验证状态 |
| 品类页 | `#/c/<品类>` | 速览（出货、营收、AI 占比、公开案例）、按栈列出的方案、专题 demo、品类文档 |
| 方案页 | `#/s/<方案 id>[/<玩法 id>]`，也可以 `?s=<方案 id>` | ① 效果（回放 / 真跑，多个玩法可切换）② 一次多少钱 ③ 要什么硬件、三步跑通 ④ 合规义务；深入链接 |
| 我的 | `#/me` | 按栈声明渲染的凭证表单、哪些玩法能在浏览器里真跑、打开本机运行记录、离线缓存、外观 |

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
| 02 AI 眼镜 · 拍照即问 | ✅ 待真 Key 验证 | 设备上的播报走任务制 WebSocket（`browser.direct` 为 `false`）；浏览器版改用非实时 HTTP 合成（`api` 接入点，仅北京），新加坡只出文字；必须填业务空间 ID |
| 02 AI 眼镜 · 给 AI 打电话 | ❌ 只放回放 | 实时语音 |
| 03 AI 玩具 | ❌ 只放回放 | 实时语音 |
| 04 Agent 硬件 · 端侧 + 云端编排 | ✅ 待真 Key 验证 | 端侧规则 + 语音转写 + 多轮工具编排 |
| 04 Agent 硬件 · 断网降级 | — | 不调用云端，回放就是完整过程 |
| 05 桌宠 | ❌ 只放回放 | 实时语音 |
| 06 AI 耳机 | ❌ 只放回放 | 实时语音（同传） |
| 07 录音卡 | ✅ 待真 Key 验证 | ≤3 分钟同步转写 + 纪要；长录音的临时上传没做 |
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

- `data/` 的格式见 [demo 标准](../../solutions/demo-standard/README.md)第十四节；这个目录归生成器，APP 只读、不写
- 页面只按事件的 `kind`、续行和文件类型渲染，不按方案写分支；数据格式变了只改 `js/data.js`
- 新增一个 `demo/<栈>/solution.yaml` 并重新生成注册表，它就出现在首页、品类页和方案页（回放、成本、硬件、合规都从数据来），APP 代码不用改。想让它在浏览器里真跑，再加一个 `js/live/run-<方案 id>.js`，在 `js/live/index.js` 登记它调用的接入点，并在 `tools/build.py` 的 `LIVE` 里列出要导入的常量
- 改了某个 demo `run.py` 里被导入的常量，运行 `python3 docs/app/tools/build.py` 后提交 `live-data/`；常量改名时 `build.py` 会报错并指出要同步改 `LIVE`
- 注册表里没有的少量界面约定（计划接入的栈、测试连接用的模型等）在 `js/meta.js`

## 本地预览与测试

```bash
python3 docs/app/tools/build.py --check          # live-data/ 与 run.py 一致、注册表引用齐全
python3 -m http.server 8000 -d docs              # 打开 http://localhost:8000/app/

# 冒烟测试（CI 同款）：全部页面和玩法无报错、390 px 不横向溢出；能网页真跑的玩法对着各 demo 的 mock.py 完整跑一遍
npm install --no-save --prefix /tmp/pw playwright-core
PLAYWRIGHT_CORE=/tmp/pw/node_modules/playwright-core/index.mjs CHROME=$(command -v google-chrome) node docs/app/tools/smoke.mjs
```

冒烟测试只能说明页面逻辑与 mock（官方事件 / 响应结构）对得上，真实接口的响应仍待真 Key 验证。

## 部署与 CI

- 部署：Pages 设置不用改，仍是「从分支部署」master 的 `/docs`（Jekyll）；`data/` 和 `live-data/` 都入库，合并即上线
- CI：[`.github/workflows/pages.yml`](../../.github/workflows/pages.yml) 在 PR 和 master 上跑 `build.py --check`、与 Pages 同款的 Jekyll 构建、网页 APP 冒烟测试

## 文件

```text
docs/app/
├── index.html              入口；CSP 只放行本站和百炼官方接入点
├── manifest.webmanifest    PWA 清单    sw.js  离线缓存（只缓存本站 GET，不碰云端接口）
├── css/app.css             视觉令牌与组件（来自 #35 原型）
├── js/main.js              路由    js/pages/  首页、品类页、方案页、我的
├── js/data.js              读 data/    js/replay.js  通用回放舞台    js/meta.js  少量界面约定
├── js/settings.js          凭证的本机存储与校验（按栈声明）
├── js/live/                浏览器真跑：client.js 按栈声明直连，index.js 能力判断，run-*.js 各玩法流程
├── live-data/              真跑常量（tools/build.py 生成）
├── tools/build.py          生成 live-data/ 与自检    tools/smoke.mjs + fake_bailian.py  冒烟测试
├── icons/                  图标（取自 #35 原型）
└── data/                   注册表、轨迹、资源（solutions/demo-standard/build_registry.py 生成）
```
