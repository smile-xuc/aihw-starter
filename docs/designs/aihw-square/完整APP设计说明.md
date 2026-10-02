# AIHW · 完整 APP 设计

2026-10-01 · v2 · 面向产品体验者

延续已认可的首页，补齐从发现功能到实际尝试、查看结果、保存记录和继续探索的完整流程。本次交付为可点击设计原型，保留 iOS 27 / Liquid Glass 与 Android Material 3 两套呈现，并提供深浅色及手机全屏布局。

## 查看设计

- `app-v2.html`：完整可点击原型。桌面上用「页面」「体验」选择器切换页面和 Demo，两端可以独立操作。
- `overview.html`：18 个画面总览，包含主要页面和六类体验工作台，可切换平台及外观。每个画面可以直接操作。
- `flow.html`：功能详情 → 体验准备 → 体验工作台 → 结果详情的四页流程。
- `index.html`：保留上一版首页设计。

原型、总览和流程页各自内嵌图像、图标、样式与脚本，可以独立离线打开。页面之间的快捷链接使用同目录文件，整套设计分享时建议保持文件在同一文件夹。

手机预览可以添加 `?platform=ios` 或 `?platform=android`。深色预览添加 `&theme=dark`。页面支持 `screen`、`demo` 参数；`state=done` 展示完成状态。

## 页面与导航

底部导航为「广场 / 体验 / 记录 / 我的」。收藏归入「我的」，核心体验流程使用独立页面和底部主操作。

| 页面 | 用户在这里做什么 | 主要交互 |
|---|---|---|
| 功能广场 | 先看效果，发现想尝试的能力 | 精选功能、分类、场景卡片、首次体验入口 |
| 体验库 | 找到一个具体 Demo | 搜索、品类筛选、云端 / 本地 / 提示词筛选、方案资料 |
| 品类专区 | 探索某种硬件能做什么 | 切换 9 个品类、打开功能、查看品类资料 |
| 功能详情 | 理解能力和适用场景 | 场景入口、收藏、方案来源、开始体验 |
| 体验准备 | 挑素材，写下问题 | 示例切换、本地文件预览、输入编辑 |
| 体验工作台 | 观察一轮完整交互 | 开始、过程、停止、回应、重试 |
| 结果详情 | 看清输出及本次输入 | 结果 / 输入 / 运行信息切换、保存、文本导出预览与选择、追问 |
| 体验记录 | 接着上一次继续探索 | 示例与本次记录、完成与停止状态、范围筛选 |
| 对比实验室 | 观察不同交互链路 | 选择 2 个以上方案、相同输入、历史参考结果 |
| 设备中心 | 理解设备连接和联动 | 模拟连接 / 断开、虚拟桌宠、进入联动体验 |
| 素材库 | 管理示例与自选输入 | 类型筛选、使用素材、本地添加、空状态 |
| 我的 / 收藏 | 留下感兴趣的功能 | 收藏同步、体验统计、素材、设备、设置入口 |
| 服务与设置 | 调整体验偏好 | 深色模式、自动记录、模拟服务连接 |

共 14 个页面视图，覆盖首页与此前约定的 12 类补充页面。总览单独展示六种工作台，因此包含 18 个画面。

## 六种工作台与仓库映射

| 工作台 | 对应 Demo | 输入与输出形式 |
|---|---|---|
| 实时对话 | AI 眼镜 `omni-realtime`；AI 耳机 `livetranslate-ws` | 通话界面、画面缩略图、原文与译文、回应字幕 |
| 视觉理解 | AI 眼镜 `kit-chat`；IPC `physical-sense` | 示例菜单 / 招牌 / 插画、本地图片、问题、场景解释或结构化事件 |
| 声音创作 | AI 玩具 `voice-clone` | 音色说明、故事文本、波形与成品界面预览 |
| 会议处理 | 录音卡 `map-reduce-summary` | 会议转写、处理过程、摘要、结论和待办 |
| 表情动作联动 | 桌宠 `stream-tag-parser` | 开心 / 失落 / 好奇样例、回应、表情变化、动作示意 |
| 结构化分析 | Agent `intent-router`；手表 `metrics-prompt`；具身智能 `vla-intent-router` | 指令或指标、参数提取、意图路由、行动计划 |

入口覆盖仓库 `solutions/by-category` 中 10 个类别 Demo。`solutions/by-solution` 的千问、小智、主流模型、Talk to Fengge、千问机器人套件、端云协同资料另列为「文档」入口，不把文档当作可运行体验。

IPC 页使用画面理解 Demo；会议处理使用已有转写；Agent 与机器人展示意图解析；桌宠展示标签与虚拟联动。它们分别与仓库现有脚本的能力对应。

## 双端规范的表达

| 维度 | iOS 方向 | Android M3 方向 |
|---|---|---|
| 导航 | 半透明悬浮导航、大标题与返回标签 | 色调导航表面、选中胶囊、返回图标 |
| 内容 | 实色卡片、分组面板、克制分隔 | 色调 surface、较大容器圆角 |
| 选择 | 分段控件与圆角选项 | 色调选择容器、Filter chips |
| 触控 | 44 px 以上交互目标 | 48 px 以上交互目标 |
| 外观 | 浅色 / 深色、减少动态效果 | 浅色 / 深色、减少动态效果 |
| 手机 | 全屏内容、安全区 padding、独立页面主操作 | 全屏内容、底栏与主操作适配 |

HTML 以 CSS 像素呈现设计方向。正式原生实现需使用 SwiftUI/UIKit 与 Compose 的系统组件、pt/dp/sp、Dynamic Type 和原生安全区。原型不能替代系统级 Liquid Glass 光学效果或原生规范验收。

## 原型的实际范围

搜索、筛选、收藏、本地素材预览、样例流程、停止 / 重试、记录、结果文本导出预览及外观切换可操作。导出面板支持选择全部文本后复制，并提供 TXT 下载；部分内置浏览器不支持文件下载，已在面板说明。收藏和样例记录保存在本地浏览器；两个平台画板同步这些状态。本地文件仅在当前页面会话预览，刷新后需重新选择。

所有 AI 输出均为预设样例。编辑输入或选择自己的素材后，结果仍来自预设，不代表模型对该输入的分析。声音页展示波形与播放交互，不包含真实克隆音频；设备及服务按钮展示模拟连接状态，不扫描或连接硬件，不发送服务请求，不收集 API Key。

对比页使用仓库 2026-07-09 的历史结果文件，展示轻度、中度和复杂三组输入。HTTP、实时 VAD 与按键说话的计时起点可能不同，页面明确标注为参考，不能替代统一条件下的实测，也不展示虚构的当次费用。

## 验证与参考

浏览器已验证导出文本预览、全选与 Escape 关闭，以及 14 个页面的双端渲染、六类工作台的双端完成流程、结果及记录、搜索空状态、收藏同步、素材选择、本地文本文件、停止流程、历史结果比较、模拟设备 / 服务连接、深色切换及 390 × 844 手机布局。具体记录见 `app-v2-verification.json`。

视觉预览保存在 `app-flow-ios.jpg`、`app-flow-android-dark.jpg`、`app-overview.jpg`、`app-mobile-ios.jpg` 与 `app-mobile-android-dark.jpg`。

- [项目源码](https://github.com/smile-xuc/aihw-starter)
- [品类 Demo](https://github.com/smile-xuc/aihw-starter/tree/master/solutions/by-category)
- [方案资料](https://github.com/smile-xuc/aihw-starter/tree/master/solutions/by-solution)
- [Benchmark 原始结果](https://github.com/smile-xuc/aihw-starter/tree/master/solutions/benchmark/results)
- [Apple WWDC26 Design guide](https://developer.apple.com/wwdc26/guides/design/)
- [Apple HIG · Materials](https://developer.apple.com/design/human-interface-guidelines/materials)
- [Apple HIG · Tab bars](https://developer.apple.com/design/human-interface-guidelines/tab-bars)
- [Material 3 · Navigation bar](https://m3.material.io/components/navigation-bar/overview)
- [Material 3 · Cards](https://m3.material.io/components/cards/overview)
- [Android Developers · Accessibility](https://developer.android.com/design/ui/mobile/guides/foundations/accessibility)

眼镜主图延用上一版生成的概念素材；菜单、招牌、公园与桌宠均为设计示意素材。
