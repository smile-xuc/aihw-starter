# Agent 能力更新与独立文章：本地验收

验收日期：2026-10-25。基线 `551cb3df56e450ad8c2c715313dd62571d2d60dc`，分支 `feat/agent-capability-lab`。此记录描述本地实现与验证，不代表发布、真实 Key 验证或硬件交付。原始日志、截图与媒体产物位于本次执行环境 `/tmp/aihw-validation/`。

## 范围与证据等级

- **A：体验中心与项目能力更新**：[审计](app/CAPABILITY_AUDIT.md)、[开发指南](../solutions/by-solution/09-agent-capabilities.md)、四组实验室页面、本地 runner、实际 MM core 客户端。
- **B：独立原理文章**：[从语音聊天到语音 Agent：真正缺的是哪一层？](voice-agent-runtime.html)，包含三层职责、具体任务、机制取舍、两种方案与 Demo 入口。
- 九个既有 Bailian 注册场景仍为 `pending-live`，`live_records=0`；没有通过新实验室的测试改变它们的验证状态。本文中的“通过”只适用于明确列出的检查。
- 网页实验室与 Node 状态 runner 是 `mock`；`inspect_media.py` 是 `local-tools`，实际调用 Qwen-MM-Plugins core MCP，但没有宿主模型或云端模型理解。CLI 帮助验证也不代表执行了模型命令。

## A 验收

- [x] 四组能力分别提供用途、架构 / 数据流、固定源码、本地步骤、前置依赖、失败与验收条件。
- [x] CLI 四类命令模板；空值、非法本地路径、控制字符、长度、单引号与 shell 元字符；复制成功 / 失败、编辑后旧命令失效。
- [x] 人工视频证据时间线、独立样本图片局部检查 / 恢复；样本来源不混用。
- [x] 纯语音演练：停播不取消，修改要求改变结果范围，旧结果抑制，待批准 / 拒绝 / 重试，取消请求与确认分开。
- [x] 视觉演练：手绘画面 A / B、frame ID、来源、场景取样时间与年龄；过期后暂停，旧批准 / 结果失效，重新核对后继续。15 秒阈值为教学假设。
- [x] 结果完成与交付分开；用户讲话时排队；播放开始确认只交付一次。
- [x] 路由退出后重新进入从初始状态开始；未引入定时器、采集流、后台连接或跨页任务。首页、返回、未知能力 404、注册表加载失败下的实验室仍可使用。
- [x] 320 / 390 / 768 / 1024 / 1440px 无横向溢出；新安装 SW 后离线打开实验室，视觉样本可用。

## B 独立验收

- [x] 完整原创文章，围绕同一巡检任务解释对话前台、编排状态 / 权限与后台执行，不以仓库名单代替机制。
- [x] qwen-audio-agent 纯语音实例与 Qwen-Live-Harness 视觉实例，各有具体方案、Demo 和开发路径。
- [x] 区分停止播报 / 取消任务、更新要求 / 旧结果、等待批准、任务完成 / 及时交付。
- [x] 来源固定到 2026-10-25 实际读取的提交；本仓设计建议与上游保证明确分开；保留旧 Runtime Host 文章的参考骨架限制。
- [x] 官网原理区、Primer、根 README、Docs、实验室、开发指南互链。
- [x] 五种宽度、全部页内锚点、事件切换 / 键盘、四个 Demo 往返、无 JavaScript 完整正文；无外部网络请求。

## 仓库检查

| 检查 | 结果与范围 |
|---|---|
| Node 单元测试 | 最终 159 / 159 通过（含 6 项新增能力逻辑回归） |
| APP `build.py --check` | 通过；既有 live-data / 注册表引用一致 |
| Demo 标准 secrets / manifests / registry / smoke | 全部通过；所有 Demo 使用无 Key mock |
| 录音卡 Python 回归 | 17 / 17 通过 |
| ASR 网关 Python 回归 | 11 / 11 通过；初次缺 aiohttp，按仓内 requirements 补齐虚拟环境后重跑通过 |
| 官网 / 旧文章 / 产品流程 / 交互 / APP / 实时 / workspace 浏览器脚本 | 全部通过；真实本地 HTTP / WS 与 fake provider，不请求模型服务 |
| 两个新增独立浏览器脚本 | 最终通过；已加入 pages.yml 的显式步骤，不依赖单元测试通配符 |
| 成本 runner `--mock` | 通过；演练用量不计为真实费用 |
| 全仓离线链接 | 最终通过：3,130 条、979 unique、零错误；按仓库规则排除外部 URL |
| 变更文件外链 | 最终 371 / 371 通过、234 unique、零错误；沿用 CI 的 200/204/206/429 接受规则。首轮两条缺失的本验收文件链接已修复 |
| Jekyll / GitHub Pages 构建 | 本地离线构建通过（Pages 同款 v1.0.13 容器 / github-pages 232）；仅临时副本关闭 GitHub metadata，7 个关键静态交付文件逐字节与源码一致。不是线上部署或完整远程 metadata 验证 |
| 格式 / 源码检查 | `git diff --check` 与新增 Python 客户端语法编译通过；本仓无单独 lint 命令，按 CI 执行上述检查 |

缓存测试修复说明：SW 从 v15 升到 v16 后，两项旧测试仍硬编码 v15，一项还因 `caches.open` 创建空旧缓存而误报资源缺失。现在从 SW 声明读取版本，断言激活后仅保留当前应用缓存、旧缓存删除、其他应用缓存保留，并检查新旧核心模块均真实预缓存。没有删除离线断言来掩盖问题。

## 上游开发路径的实际验证

| 项目 | 已运行 | 未运行 / 限制 |
|---|---|---|
| Bailian CLI | `/tmp` 中安装 npm 2.5.1，`bl --version`、text chat / image generate / speech recognize / speech synthesize 四组 `--help` 成功 | text / image / ASR / TTS 的真实模型调用均未运行；无费用或效果结论 |
| Qwen-MM-Plugins | 固定 checkout + 独立 venv 安装 core；MCP initialize / tools/list 得到 7 工具；实际 read_image、crop、media_info、read_video 成功 | 无宿主模型 / API / video2note PDF；没有把 dry_run 当产物。系统报告缺少插件专用 Playwright Chromium、无 API Key，不影响已验证的图片 / 视频 core 路径 |
| qwen-audio-agent | 固定源码依赖安装及 WebUI build 成功 | 无凭据启动被上游 setup gate 明确拒绝：缺少 QWEN_AUDIO_REALTIME_API_KEY；未提供虚假 Key 绕过。未成功启动健康接口，路径 / capability / 版本基于源码核对；语音、后台执行、声学效果未运行 |
| Qwen-Live-Harness | 固定源码、配置、Host / daemon 要求核对 | Linux 环境未运行 macOS Host；未验证真实采集、Omni 服务、后台委托 |

MM 测试使用仓内餐盘照片和由该照片生成的 3 秒静态测试视频：真实输出为 320×240 裁图、媒体元数据与 3 个抽样图像块。视频不代表实际巡检录像，处理成功不代表模型看懂。

## 发布与剩余条件

本地成果可审阅；尚未推送、创建 PR、合并或部署。没有公开网关，没有付费请求或使用真实模型凭据，没有修改持久安全 / 环境配置。PR #121 与 X30 文件未触碰。旧任务由父线程管理，本轮不操作它；旧工作区未推送内容仍无法据此确认。

后续若获得仓库发布授权，可基于本分支创建 **draft PR**，仍不自动合并或部署。真实服务验收需要另行提供匹配地域的凭据和费用授权；macOS 桌面 / 手机 / 硬件验收需要对应设备。新文章与实验室链接目前指向预期发布位置，不能据此声称线上已存在。

## 可复查的本地构建方法

原始禁网容器会在 Jekyll GitHub metadata 插件读取 repository / theme 数据时失败。临时副本追加以下 `_config.yml`，利用插件对 `github: false` 的分支关闭远程元数据注入；原仓库不新增部署配置，也不传入 GitHub Token：

```yaml
title: AIHW Starter
description: AI hardware capability and architecture documentation
url: https://smile-xuc.github.io
baseurl: /aihw-starter
repository: smile-xuc/aihw-starter
github: false
```

构建镜像 `ghcr.io/actions/jekyll-build-pages:v1.0.13`（digest `sha256:6791ebfd912185ed59bfb5fb102664fa872496b79f87ff8b9cfba292a7345041`），`--network none`，只挂载临时 docs 源目录和临时输出目录。日志：`jekyll-offline.log`；`build-parity.log` 记录 `index.html`、新文章、APP index、两个实验室 JS、两张 SVG 与源码的逐字节比较和 SHA-256。Markdown 的主题元数据区域在此模式下不代表线上 GitHub 元数据。

## 日志索引

- `node-unit.log`、`app-build.log`、`secrets.log`、`manifests.log`、`registry.log`、`demo-smoke.log`、`recorder.log`、`asr-gateway.log`、`cost-run.log`。
- `docs-tools-*.log` 与 `docs-app-tools-*.log`：九个浏览器脚本。新增图片失败测试初次未真正重载已打开的同一路由，改为实际 reload 触发失败请求后通过；未删除失败断言。
- `links-offline.log`、`links-changed.log`；`mm-local.log`、`media-local/inspection-report.json`、`media-local/inspection-crop.png`。
- `audio-install.log`、`audio-build.log`、`audio-gateway.log`（setup gate 缺 Key，预期停止）；四份 `cli-*-help.log`。
- `screenshots-final/`：官网、旧页、实验室及独立文章的移动 / 桌面截图。已有文章与样本的检查范围保持不变。
