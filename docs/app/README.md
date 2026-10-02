# docs/app — AIHW 网页 APP（MVP）

GitHub Pages 上的静态网页，可以「添加到主屏幕」当 APP 用（PWA，离线也能看回放）。按 [APP 设计初稿评审](../designs/aihw-square/README.md#评审后的方向用户自填-key) 的 MVP 范围实现：把 9 个品类的百炼参考方案做成「方案索引 + 回放」，每个方案页回答四个问题——效果怎样、一次多少钱、做成产品要什么硬件、有哪些合规义务。

- 地址：<https://smile-xuc.github.io/aihw-starter/app/>（Pages 的 Source 切到 GitHub Actions 之后才有数据，见「部署」）
- 没有后端、没有构建链：HTML + CSS + 原生 ES 模块，数据由一个标准库 Python 脚本生成
- 视觉沿用 [PR #35 的原型](../designs/aihw-square/)（只保留一套自适应主题）；原型留作设计存档

## 页面

| 页面 | 地址 | 内容 |
|---|---|---|
| 首页 | `#/` | 9 个品类卡片：单次成本、体验方式（回放 / 网页真跑 / 本机真跑）、合规标签、验证状态 |
| 品类页 | `#/c/<品类>` | 速览（出货、营收、AI 占比、公开案例数）、按栈列出的方案、专题 demo、品类文档 |
| 方案页 | `#/s/<方案 id>`，也可以 `?s=<方案 id>` | ① 效果（回放 / 真跑）② 一次多少钱 ③ 要什么硬件、三步跑通 ④ 合规义务；深入链接 |
| 我的 | `#/me` | 百炼 Key 设置、哪些方案能在浏览器里真跑、打开本机运行记录、离线缓存、外观 |

## Key：用户自己填，只存本机，只发官方接入点

- 百炼填三项：API Key（`sk-` 长期 Key 或 `st-` 临时 Key）、地域（北京 / 新加坡）、业务空间 ID（可选，填了走业务空间专属域名）
- 只存在这台设备的浏览器存储里：勾「记在这台设备上」存 `localStorage`，不勾存 `sessionStorage`（关页面即清），键名 `aihw.bailian.v1`；「清除」两处都删
- 只发往百炼官方接入点：`dashscope.aliyuncs.com`、`dashscope-intl.aliyuncs.com`、`<业务空间ID>.cn-beijing.maas.aliyuncs.com`、`<业务空间ID>.ap-southeast-1.maas.aliyuncs.com`。地址规则与 `demo_kit.Config` 一致；`index.html` 的 CSP `connect-src` 只放行这几个域名，页面不加载任何第三方脚本，也没有我们自己的服务器
- 业务空间专属域名的某个接口在浏览器里被跨域拦截时（请求本身没有发出），本次会话改走同地域的通用域名，并在时间线上提示
- 没填 Key：所有方案只放回放
- 页面上给了降低风险的做法：子业务空间只授权 demo 用到的模型并限流、自定义权限 Key、费用中心消费预警、临时 Key；也提示了 `smile-xuc.github.io` 下的其他 Pages 页面与本页同源

## 哪些方案能在浏览器里真跑

| 方案 | 网页真跑 | 说明 |
|---|---|---|
| 01 IPC | ✅ 待真 Key 验证 | 4 帧事件卡 + 检索 + 日报 |
| 02 AI 眼镜 | ✅ 待真 Key 验证（默认「拍照即问」） | 播报改用非实时 HTTP 合成（仅北京）；`--realtime` 只放回放 |
| 03 AI 玩具 | ❌ 只放回放 | 实时语音，原因见下 |
| 04 Agent 硬件 | ✅ 待真 Key 验证 | 端侧规则 + 语音转写 + 多轮工具编排 |
| 05 桌宠 | ❌ 只放回放 | 实时语音 |
| 06 AI 耳机 | ❌ 只放回放 | 实时语音（同传） |
| 07 录音卡 | ✅ 待真 Key 验证 | ≤3 分钟同步转写 + 纪要；长录音的临时上传没做 |
| 08 智能手表 | ✅ 待真 Key 验证 | 两份日报；抬腕播报没做 |
| 09 具身智能 | ✅ 待真 Key 验证 | 本地安全门 + 看图多轮技能调用 |

实时语音（03、05、06 和 02 的 `--realtime`）为什么跑不了：百炼官方 [Token 鉴权](https://help.aliyun.com/zh/model-studio/realtime-token-authentication) 写明 WebSocket、WebRTC、AOQ 都只在建连时认 `Authorization` 请求头——浏览器的 WebSocket 不能设请求头；WebRTC 的 SDP 交换被浏览器跨域拦截，[官方说明](https://help.aliyun.com/zh/model-studio/best-practice-webrtc-omni-realtime)要由服务端代理；AOQ 只有原生 SDK。[临时 Key](https://help.aliyun.com/zh/model-studio/generate-temporary-api-key) 也走同一个请求头，换成临时 Key 解决不了。2026-10-02 实测：网关会读取 URL 里的 `api_key` 参数（报错从 “No API-key provided” 变成 “Invalid API-key provided”），但官方没有文档，而且会把 Key 放进 URL，不采用。

## 数据

页面只读 `data/`（不入库，`tools/build.py` 生成；Pages workflow 每次部署前重新生成）：

| 路径 | 内容 | 来源 |
|---|---|---|
| `data/registry.json` | 品类与方案注册表 | 正式注册表上线前用 `sample-data/`（临时样例，由 mock 输出整理） |
| `data/traces/<方案 id>.json` | 回放轨迹：日志行、验证记录、输入样本、产出文件 | 同上 |
| `data/demos/<方案 id>/samples/` | 样本图片、录音 | 复制自各 demo 的 `samples/` |
| `data/live/<方案 id>.json` | 浏览器真跑用的模型 ID、提示词、工具定义、单价 | 从各 demo 的 `run.py` 直接导入，JS 里不另抄一份 |
| `data/build.json` | 构建时间、提交、注册表来源 | `tools/build.py` |

- 数据格式变了只改 `js/data.js` 的 `normalize*`；回放渲染只看日志行标签（`[设备]` `[云端]` `[统计]` 和用户看到的结果）和文件类型，不按品类写分支
- 新增一个 `demo/<栈>/solution.yaml`：进了注册表就自动出现在首页、品类页和方案页（回放、成本、硬件、合规都从数据来），APP 代码不用改。想让它在浏览器里真跑，再加一个 `js/live/run-<方案 id>.js` 并在 `js/live/index.js` 登记
- 改了某个 demo `run.py` 里被导入的常量名，`build.py` 会报错并指出要同步改 `tools/build.py` 的 `LIVE`
- 合规标签、设备部件、栈名的界面说法在 `js/meta.js`

## 本地预览与测试

```bash
python3 docs/app/tools/build.py --check          # 生成 docs/app/data/ 并自检
python3 -m http.server 8000 -d docs              # 打开 http://localhost:8000/app/

# 冒烟测试（CI 同款）：全部页面无报错、390 px 不横向溢出；6 个浏览器真跑对着各 demo 的 mock.py 完整跑一遍
npm install --no-save --prefix /tmp/pw playwright-core
PLAYWRIGHT_CORE=/tmp/pw/node_modules/playwright-core/index.mjs CHROME=$(command -v google-chrome) node docs/app/tools/smoke.mjs
```

冒烟测试只能说明页面逻辑与 mock（官方事件 / 响应结构）对得上，真实接口的响应仍待真 Key 验证。

## 部署

`.github/workflows/pages.yml`：PR 上构建 + 冒烟测试；推到 `master` 后用 Jekyll 构建 `docs/`（与现在「从分支部署」的结果一致），连同 `docs/app/data/` 部署到 Pages。

需要仓库管理员做一次：Settings → Pages → Build and deployment → Source 改成 **GitHub Actions**。没改之前 workflow 只构建、跳过部署；线上仍是「从分支部署」的 `docs/`，其中 `app/` 因为没有 `data/` 会显示「方案数据暂时不可用」。

## 文件

```text
docs/app/
├── index.html              入口；CSP 只放行本站和百炼官方接入点
├── manifest.webmanifest    PWA 清单    sw.js  离线缓存（只缓存本站 GET，不碰百炼接口）
├── css/app.css             视觉令牌与组件（来自 #35 原型）
├── js/main.js              路由    js/pages/  首页、品类页、方案页、我的
├── js/data.js              读 data/ 并整理    js/replay.js  通用回放舞台    js/meta.js  代号的界面说法
├── js/settings.js          Key 的本机存储与校验
├── js/live/                浏览器真跑：bailian.js 客户端，index.js 能力表，run-*.js 各方案流程
├── tools/build.py          生成 data/    tools/smoke.mjs + fake_bailian.py  冒烟测试
├── sample-data/            临时样例注册表与轨迹（正式注册表上线后删除）
└── icons/                  图标（取自 #35 原型）
```
