# docs/ — GitHub Pages 门面页

## 项目官网首页

[`index.html`](./index.html) 是项目官网：介绍 AI 硬件商业化实践库，提供能力预览、九个商业化品类、入门路径与深度阅读入口。品类是商业方向，具体项目的商业交付、开发者用途和集成条件在各项目资料中分别说明。

首页保持单文件 HTML，使用系统字体、内联 SVG 和 CSS 硬件概念插画，不依赖第三方资源。布局参考 [Mole](https://mole.fit/zh/) 与 [Kami](https://kami.tw93.fun/index-zh.html) 的留白和清晰层次，视觉素材与页面实现为本项目独立制作。照片来自仓内既有样本，预览文本不代表在线模型调用；真实 Key 与实机验证状态沿用体验广场。

交互包括手机导航、支持方向键 / Home / End 的能力预览、克隆命令复制和有限的入场动效，尊重系统的减少动态效果偏好。关闭 JavaScript 时仍可阅读首页并使用导航。

浏览器回归使用现有 Playwright Core 与 Chromium，无需安装前端构建框架：

```bash
PLAYWRIGHT_CORE=/path/to/playwright-core/index.mjs \
CHROME=/path/to/chromium node docs/tools/home-smoke.mjs
```

脚本自行启动和关闭本地静态服务，检查 320 / 390 / 768 / 1024 / 1440px 布局、品类链接、旧锚点、菜单、键盘切换、复制成功与拒绝、无 JavaScript 及减少动效。可设置 `REVIEW_SCREENSHOTS=/tmp/homepage-review` 保存截图；CI 的 Pages 检查会运行同一脚本。

## 网页 APP（app/）

官网中的「打开体验广场」进入网页 APP（[`app/`](./app/)）。`designs/aihw-square/` 下的 HTML 原型为设计存档，说明见 [`designs/aihw-square/`](./designs/aihw-square/README.md)：

- [完整可点击原型](./designs/aihw-square/app-v2.html?screen=home)
- [18 屏页面总览](./designs/aihw-square/overview.html)
- [核心体验流程](./designs/aihw-square/flow.html)

HTML 文件各自内嵌图像、样式和脚本，可以直接离线打开。运行范围和验证说明见该目录的 README；AI 输出与硬件连接均为本地设计样例。

## 深度阅读

- [`omni-runtime-host.html`](./omni-runtime-host.html)：Qwen-Omni-Realtime + harness 的 AI 硬件多模态实时交互方案。沿用官网样式，提供八章侧边目录、手机折叠目录、章节搜索及交互链路示意；协议说明按官方来源核对，参考骨架的集成范围单独标注。
- [`kv-cache-quantization.html`](./kv-cache-quantization.html)：TurboQuant 交互式学习页，保留原有内容与交互，通过顶部入口返回首页。

子页浏览器检查：`PLAYWRIGHT_CORE=/path/to/playwright-core/index.mjs CHROME=/path/to/chromium node docs/tools/article-smoke.mjs`。沿用首页检查的环境，可用 `REVIEW_SCREENSHOTS` 指定截图目录。

## 贡献

如果想优化门面页：

1. 修改 `index.html`（请保持单文件结构）
2. 在本地或浏览器中预览
3. 提交 PR，标题前缀 `[docs]`

详见根目录 [`CONTRIBUTING.md`](../CONTRIBUTING.md)。
