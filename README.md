<div align="center">

# 🚀 AI Hardware Starter

**AI 硬件行业热门品类的商业化最佳实践案例库**

从"这门生意能不能做、怎么搭、怎么算账"出发的工程化案例集

[![License: CC BY 4.0](https://img.shields.io/badge/Docs-CC%20BY%204.0-lightgrey.svg)](https://creativecommons.org/licenses/by/4.0/)
[![License: MIT](https://img.shields.io/badge/Code-MIT-blue.svg)](./LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](./CONTRIBUTING.md)
[![demo-smoke](https://github.com/smile-xuc/aihw-starter/actions/workflows/demo-smoke.yml/badge.svg)](https://github.com/smile-xuc/aihw-starter/actions/workflows/demo-smoke.yml)
[![pages](https://github.com/smile-xuc/aihw-starter/actions/workflows/pages.yml/badge.svg)](https://github.com/smile-xuc/aihw-starter/actions/workflows/pages.yml)

[网页 APP](https://smile-xuc.github.io/aihw-starter/app/) · [门面页](https://smile-xuc.github.io/aihw-starter/) · [品类总览](./solutions/by-category/) · [百炼参考 demo](#百炼参考-demo) · [贡献指南](./CONTRIBUTING.md)

</div>

---

## ✨ 亮点功能速览

精选覆盖 9 个品类的 13 个「Wow feature」（其中 1 个跨品类）——都是**能收费、有付费锚点**的功能，看完就懂 AI 硬件能做出什么样的产品。

| 品类 | 亮点功能 | 一句话描述 | 付费锚点 |
|---|---|---|---|
| 📷 IPC | 自然语言找回放 | 「找昨晚小孩跳沙发那段」→ 5 秒定位 | AI 订阅 5~9.9 元/月（已知跑通） |
| 📷 IPC | 每日 AI 精彩片段 | 自动剪出今日精彩 30 秒 vlog | 云存 + AI 套餐加值 |
| 👓 眼镜 | 一看即懂 | 对着菜单/招牌看一眼 → 耳机播报翻译 + 推荐 | 硬件溢价 + 翻译功能包（探索期） |
| 👓 眼镜 | 给 AI 打电话 | 按住镜腿即问即答，AI 实时看到眼前画面、边走边聊 | 旗舰档硬件溢价 |
| 🧸 玩具 | 爸妈声音陪伴 | 家长录 20 秒 → 孩子听到爸妈声音讲故事 | 硬件一次性溢价（亲情包） |
| 🧸 儿童伴学 | 每日学情日报 | 自动告诉家长今天孩子学了啥、情绪如何、如何鼓励 | 伴学订阅（探索期） |
| 🤖 Agent 硬件 | 一句话办完多步任务 | 「明早七点叫我，顺便查一下杭州天气，要是下雨就提前半小时」→ 端侧先办能办的，其余交给云端多轮编排，断网降级到端侧规则 | 硬件溢价（订阅已知难跑通） |
| 🪴 桌宠 | 情绪 → 动作联动 | AI 识别语气 → 触发实体机器人表情 / 摇头 / 摆手 | 硬件买断，云端成本摊进售价（订阅已知未跑通） |
| 🎧 AI 耳机 | 实时同传 | 开会同声传译，不用看屏幕，边听边说 | 硬件溢价 + 可选时长 / 离线包 |
| 🎙️ 录音卡 | 一键会议纪要 | 会后 3 分钟出结构化纪要 + 待办 + 分角色发言 | 硬件 + 按时长 / 按月套餐（Plaud 等已跑通） |
| ⌚ 手表 | 每日健康日报 | 一天的心率、血氧、睡眠指标 → 本地红线先判（命中立即震动）→ 表盘解读卡 + App 日报 | 硬件为主；健康会员订阅海外已跑通（Oura / WHOOP） |
| 🦾 具身智能 | 一句话指挥机械臂 | 「把螺丝放进左边的盒子」→ 看腕部相机画面逐步定位、抓取、放置，每一步先过本地安全门 | 本体 + 集成交付（订阅已知未跑通） |
| 🧭 跨品类 · 随身硬件 | 一句话派活给 Agent | 路上对眼镜、耳机、录音卡或口袋设备说「把今天三场会整理成周报发给团队」→ 设备只当入口，任务交给云端或家里电脑上的 Agent（如 OpenClaw）去办，发出前先确认，办完推回结果——现实版私人助理 | Agent 订阅 / 用量额度（探索期；[Meta 称](https://about.fb.com/news/2026/09/introducing-muse-personal-ai-agent/)旗下个人 Agent Muse 多数用途免费，另有订阅方案） |

> 想看完整功能清单和商业化打法？进入对应品类的 [`solutions/by-category/`](./solutions/by-category/) 目录。

---

## 热门品类

<table width="100%">
<tr>
<th align="center">#</th>
<th align="left">品类</th>
<th align="center">状态</th>
<th align="left">核心能力</th>
</tr>
<tr>
<td align="center">01</td>
<td><a href="./solutions/by-category/01-ipc/"><b>IPC / AI 视觉</b></a></td>
<td align="center" nowrap>✅ 完整版</td>
<td>事件摘要、自然语言检索、自定义事件告警、每日总结、一键成片等</td>
</tr>
<tr>
<td align="center">02</td>
<td><a href="./solutions/by-category/02-ai-glasses/"><b>AI 眼镜</b></a></td>
<td align="center" nowrap>✅ 完整版</td>
<td>视觉问答（一看即懂）、同声传译、实时音视频交互、会议听记、屏显导航/提词</td>
</tr>
<tr>
<td align="center">03</td>
<td><a href="./solutions/by-category/03-toys-companion/"><b>AI 玩具 / 陪伴 / 儿童伴学</b></a></td>
<td align="center" nowrap>✅ 完整版</td>
<td>爸妈声音陪伴（声音克隆）、学情日报、拍照问答、口语陪练等</td>
</tr>
<tr>
<td align="center">04</td>
<td><a href="./solutions/by-category/04-agent-hardware/"><b>Agent 硬件（如桌面盒子）</b></a></td>
<td align="center" nowrap>✅ 完整版</td>
<td>多 Agent 协同 + 端云模型协同</td>
</tr>
<tr>
<td align="center">05</td>
<td><a href="./solutions/by-category/05-desktop-pet/"><b>桌宠</b></a></td>
<td align="center" nowrap>✅ 完整版</td>
<td>动作情绪标签三路同步 + 每日记忆日记 + BLE 降级对话 + Agent 后台热配置</td>
</tr>
<tr>
<td align="center">06</td>
<td><a href="./solutions/by-category/06-ai-earphone/"><b>AI 耳机</b></a></td>
<td align="center" nowrap>✅ 完整版</td>
<td>实时翻译 / 对话 / 听记多用途</td>
</tr>
<tr>
<td align="center">07</td>
<td><a href="./solutions/by-category/07-recorder/"><b>录音卡 / 会议盒子</b></a></td>
<td align="center" nowrap>✅ 完整版</td>
<td>ASR + 纪要 Agent，结构化纪要</td>
</tr>
<tr>
<td align="center">08</td>
<td><a href="./solutions/by-category/08-smart-watch/"><b>智能手表 / 健康可穿戴</b></a></td>
<td align="center" nowrap>✅ 完整版</td>
<td>健康指标解读 + 订阅商业化</td>
</tr>
<tr>
<td align="center">09</td>
<td><a href="./solutions/by-category/09-embodied/"><b>具身智能</b></a></td>
<td align="center" nowrap>✅ 完整版</td>
<td>VLA 端云协同 + 多本体形态适配</td>
</tr>
</table>

---

## 每个品类包含什么

```
solutions/by-category/0X-xxxx/
├── README.md        # 1 分钟读完的品类概述
├── 01-business.md   # 商业模式与市场判断
├── 02-solution.md   # 技术方案：推荐架构 + 接入步骤 + 代码示例
├── 03-cost.md       # BOM + 云端用量 + 算账模型
├── 04-cases.md      # 脱敏案例与公开案例
├── 05-faq.md        # 客户高频问答
└── demo/            # 最小可跑 demo（Python）
    └── bailian/     # 百炼参考 demo：python3 run.py，无 Key 自动 mock
```

---

## 快速开始

> 🚀 **先看效果**：打开[网页 APP](https://smile-xuc.github.io/aihw-starter/app/)，9 个品类的参考方案都能直接看回放、单次成本、硬件与合规要点，不用装任何东西。
>
> 📑 **两条进入路径**：品牌商按「品类」找市场，开发者按「方案」找技术栈。两个维度互相正交，可以任意切换。

<table>
<tr>
<td width="34%" valign="top">

### 🏭 方案商 / 品牌商

1. 看 [solutions/by-category/](./solutions/by-category/) — 品类总览（IPC / 玩具陪伴 / 耳机 / 录音卡 …）
2. 进入感兴趣的品类目录（如 [`solutions/by-category/01-ipc/`](./solutions/by-category/01-ipc/)）
3. 读 [01-business.md](./solutions/by-category/01-ipc/01-business.md) 判断值不值得投入
4. 读 [02-solution.md](./solutions/by-category/01-ipc/02-solution.md) 看技术方案
5. 读 [03-cost.md](./solutions/by-category/01-ipc/03-cost.md) 算清楚账

</td>
<td width="33%" valign="top">

### 👩‍💻 开发者

1. 看 [solutions/by-solution/](./solutions/by-solution/) — 方案总览（千问大模型 / 小智 / 端侧 …）
2. 选定方案后回到具体品类的 [demo/](./solutions/by-category/01-ipc/demo/)
3. 跑通示例 → 改造成自家产品
4. 做实时语音机器人？看 [Omni 实时端到端 · Runtime Host](./solutions/by-solution/01-qwen/omni-realtime/)
5. 百炼参考 demo：9 个品类各一个，填自己的 Key 三步跑通、没有 Key 自动走 mock，入口见下方[百炼参考 demo](#百炼参考-demo)，标准见 [demo-standard](./solutions/demo-standard/README.md)

</td>
<td width="33%" valign="top">

### 🔍 了解生态

- [primer/](./primer/) — AI 通识：开放权重、规格与芯片、KV 量化、Token 计费、蒸馏、端云、记忆
- [awesome/open-source/](./awesome/open-source/) — 137+ 个 GitHub 开源项目，15 品类
- [awesome/commercial-products/](./awesome/commercial-products/) — 在售商业产品
- [docs/ 门面页](https://smile-xuc.github.io/aihw-starter/) — GitHub Pages 总览

</td>
</tr>
</table>

---

## 网页 APP

[网页 APP](https://smile-xuc.github.io/aihw-starter/app/) 把 9 个品类的百炼参考方案做成「方案索引 + 回放」，每个方案页回答四个问题：效果怎样、一次多少钱、做成产品要什么硬件、有哪些合规义务。手机上可以添加到主屏当 APP 用，看过的回放离线也能看。

- **回放**：9 个方案都能直接看，不需要 Key，不调用云端模型
- **浏览器真跑**：在「我的」页填自己的百炼 Key 后，01 IPC、02 眼镜「拍照即问」、04 Agent 硬件、07 录音卡、08 手表、09 具身可以在浏览器里真跑（均待真 Key 验证）。03 玩具、05 桌宠、06 耳机和 02「给 AI 打电话」是实时语音：接口要在建连时带鉴权请求头，浏览器做不到，只放回放
- **凭证只留在本机**：Key 只存在这台设备的浏览器里，请求只发往百炼官方接入点；页面不加载第三方脚本，也没有自建服务器
- **数据来自 demo**：方案注册表、回放轨迹和样本由 [demo 标准](./solutions/demo-standard/README.md)的生成器从各品类 `demo/bailian/` 产出，新增一个方案不用改 APP 代码

页面结构、数据格式与本地预览见 [`docs/app/README.md`](./docs/app/README.md)。早先的[功能广场可点击原型](./docs/designs/aihw-square/README.md)保留为设计存档。

---

## 百炼参考 demo

9 个品类各有一个百炼参考 demo，路径统一为 `solutions/by-category/<品类>/demo/bailian/`。在 `.env` 填好 Key 后运行 `python3 run.py`（Windows 用 `python run.py`）；没有 Key 时同一条命令自动进入 mock，离线回放、不联网、不计费。目前均为「待真 Key 验证」，验证记录见各自目录的 `VERIFY.md`，统一标准见 [demo-standard](./solutions/demo-standard/README.md)。「网页 APP」列可以直接看同一条链路的回放。

| 品类 | 入口 | 跑通的链路 | 网页 APP |
|---|---|---|---|
| 📷 01 IPC | [`01-ipc/demo/bailian/`](./solutions/by-category/01-ipc/demo/bailian/) | 事件抓拍 → `qwen3.7-flash` 看图生成事件卡 → 自然语言检索 → 看护日报 | [回放 · 网页真跑](https://smile-xuc.github.io/aihw-starter/app/#/s/01-ipc.bailian) |
| 👓 02 AI 眼镜 | [`02-ai-glasses/demo/bailian/`](./solutions/by-category/02-ai-glasses/demo/bailian/) | 拍照即问：`qwen3.8-omni-flash` 看图听问 + `qwen-audio-3.0-tts-flash` 播报；`--realtime` 用 `qwen3.8-omni-flash-realtime` 给 AI 打电话 | [回放 · 拍照即问可网页真跑](https://smile-xuc.github.io/aihw-starter/app/#/s/02-ai-glasses.bailian) |
| 🧸 03 玩具 / 陪伴 | [`03-toys-companion/demo/bailian/`](./solutions/by-category/03-toys-companion/demo/bailian/) | 按键说话 + 眼睛摄像头 → `qwen3.8-omni-flash-realtime` 实时语音回复，Function Calling 控制动作与灯光 | [回放](https://smile-xuc.github.io/aihw-starter/app/#/s/03-toys-companion.bailian) |
| 🤖 04 Agent 硬件 | [`04-agent-hardware/demo/bailian/`](./solutions/by-category/04-agent-hardware/demo/bailian/) | 端侧规则先执行 → `qwen3.8-flash` Function Calling 多轮编排本地设备与云端服务，断网降级到端侧规则 | [回放 · 网页真跑](https://smile-xuc.github.io/aihw-starter/app/#/s/04-agent-hardware.bailian) |
| 🪴 05 桌宠 | [`05-desktop-pet/demo/bailian/`](./solutions/by-category/05-desktop-pet/demo/bailian/) | `qwen3.8-omni-flash-realtime` 实时语音 + 表情动作工具；结束时 `qwen3.7-flash` 写陪伴日记、提炼记忆 | [回放](https://smile-xuc.github.io/aihw-starter/app/#/s/05-desktop-pet.bailian) |
| 🎧 06 AI 耳机 | [`06-ai-earphone/demo/bailian/`](./solutions/by-category/06-ai-earphone/demo/bailian/) | `qwen3.8-livetranslate-flash-realtime` 实时同传：英文字幕 + 译音，自动区分说话人 | [回放](https://smile-xuc.github.io/aihw-starter/app/#/s/06-ai-earphone.bailian) |
| 🎙️ 07 录音卡 | [`07-recorder/demo/bailian/`](./solutions/by-category/07-recorder/demo/bailian/) | `qwen-audio-3.1-asr-flash` 转写 + 说话人分离 → `qwen3.7-flash` 结构化纪要卡片 | [回放 · 网页真跑](https://smile-xuc.github.io/aihw-starter/app/#/s/07-recorder.bailian) |
| ⌚ 08 智能手表 | [`08-smart-watch/demo/bailian/`](./solutions/by-category/08-smart-watch/demo/bailian/) | 本地红线规则先判 → `qwen3.7-flash` 健康日报 → 表盘卡片，可选抬腕语音播报 | [回放 · 网页真跑](https://smile-xuc.github.io/aihw-starter/app/#/s/08-smart-watch.bailian) |
| 🦾 09 具身智能 | [`09-embodied/demo/bailian/`](./solutions/by-category/09-embodied/demo/bailian/) | 腕部相机画面 + 指令 → `qwen3.8-flash` 看图逐步调用技能，每次调用先过本地安全门 | [回放 · 网页真跑](https://smile-xuc.github.io/aihw-starter/app/#/s/09-embodied.bailian) |

---

## 仓库结构

```
aihw-starter/
├── solutions/
│   ├── README.md              # 双维度入口说明（品类 × 方案）
│   ├── by-category/           # 品类总览 + 各品类内容
│   │   ├── README.md          # 品类总览表格
│   │   ├── 01-ipc/            # IPC / AI 视觉
│   │   ├── 02-ai-glasses/     # AI 眼镜
│   │   ├── 03-toys-companion/ # AI 玩具 / 陪伴
│   │   ├── 04-agent-hardware/ # Agent 硬件
│   │   ├── 05-desktop-pet/    # 桌宠
│   │   ├── 06-ai-earphone/    # AI 耳机
│   │   ├── 07-recorder/       # 录音卡 / 会议盒子
│   │   ├── 08-smart-watch/    # 智能手表 / 健康可穿戴
│   │   └── 09-embodied/       # 具身智能
│   ├── by-solution/           # 方案总览（开发者视角：千问 / 小智 …）
│   ├── demo-standard/         # 参考 demo 统一标准、模板与 CI 自检；生成网页 APP 的注册表与回放
│   └── benchmark/             # 方案延迟横评实测
├── awesome/
│   ├── open-source/           # 开源项目索引（137+ 项目，15 品类）
│   └── commercial-products/   # 在售商业化产品案例
├── primer/                    # AI 通识（01–07：授权 / 规格 / KV / Token / 蒸馏 / 端云 / 记忆）
├── docs/                      # GitHub Pages：门面页与交互式学习页
│   ├── app/                   # 网页 APP：方案回放 + 浏览器真跑
│   └── designs/aihw-square/   # 功能广场 APP 原型（设计存档）
├── .github/workflows/         # CI：demo 冒烟、链接检查、Pages 构建与 APP 冒烟
├── faq.md                     # 跨品类通用 FAQ
├── CHANGELOG.md               # 版本记录
└── CONTRIBUTING.md            # 贡献指南
```

---

## 参与贡献

欢迎以下贡献：

| 贡献类型 | 说明 |
|---|---|
| **新增品类** | 在 `solutions/by-category/` 下新建目录，提交完整 6 文件 + demo |
| **新增方案** | 在 `solutions/by-solution/` 新增方案页；品类内接入差异写进对应品类现有 `02-solution.md` 的小节 |
| **新增案例** | 在对应品类 `04-cases.md` 加脱敏案例，或在 `awesome/` 加产品记录（商业产品卡须写明具体的 AI 功能，见收录门槛） |
| **新增开源项目** | 补充到 `awesome/open-source/by-category/` 对应文件 |

详细规则参见 [CONTRIBUTING.md](./CONTRIBUTING.md)。PR 会自动跑 demo 冒烟（无 Key、走 mock）与链接检查；改到 `docs/`、百炼 demo 或 demo 标准时，还会跑 Pages 构建与网页 APP 冒烟测试。

---

## 反馈与交流

- **Issue**：报问题 / 提建议 / 申请收录 / 行业讨论与经验交流
- **商业化合作**：新建 Issue，标题以 `[business]` 开头

> 仓库暂未开启 GitHub Discussions；交流统一走 Issue，避免空转入口。

---

## License

| 内容 | 协议 |
|---|---|
| 文档（Markdown、表格、示意图） | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) — 可自由复制、修改、商用，需注明来源 |
| 代码（`demo/` 下的脚本与示例） | [MIT](./LICENSE) — 可自由使用，无担保 |

> **SDK 协议说明**：demo 中引用的第三方 SDK（如 DashScope / 百炼 API）遵循其原厂服务协议，MIT 仅覆盖本仓库自身的示例代码。
