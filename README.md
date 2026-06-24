# aihw-starter

> AI 硬件行业热门品类的**商业化最佳实践案例库**
>
> 不是 API 文档镜像，不是开源项目导航 — 而是从"这门生意能不能做、怎么搭、怎么算账"出发的工程化案例集。

---

## 站位声明

本仓库**客观中立**，不隶属于任何单一模型厂商或方案商。

- **首发版本**：以**千问大模型**作为示例方案进行端到端演示
- **后续会补充**：
  - 主流大模型方案（豆包、Kimi、智谱、DeepSeek、OpenAI 等）
  - 优秀方案商的端到端方案（已落地、可背书）
  - 端侧/混合方案（轻量本地 + 云端协同）
- **欢迎贡献**：参见 [CONTRIBUTING.md](./CONTRIBUTING.md)

仓库的目的是让 AI 硬件方案商、品牌商、ODM、开发者**少走弯路、看清边界、算清账目**。

---

## 已收录品类

| # | 品类 | 状态 | 一句话定位 |
|---|---|---|---|
| 01 | [AI 玩具 / 陪伴 / 儿童伴学](./solutions/01-toys-companion/) | 完整版 | 自定义对话角色 + 声音克隆，IP 与儿童陪伴双线 |
| 02 | [桌宠 / 毛绒](./solutions/02-desktop-pet/) | 占位版 | 动作情绪标签 + 情感 TTS，三路同步 |
| 03 | [录音卡 / 会议盒子](./solutions/03-recorder/) | 占位版 | ASR + 纪要 Agent，2–5 分钟出结构化纪要 |
| 04 | [AI 耳机](./solutions/04-ai-earphone/) | 占位版 | 实时翻译 / 对话 / 听记多用途 |
| 05 | [IPC / AI 视觉](./solutions/05-ipc/) | 完整版 | 视频以文搜图 + 摘要订阅 |
| 06 | [AI 眼镜](./solutions/06-ai-glasses/) | 占位版 | 多模态交互套件，端到端打包 |

未来计划：[future/](./future/)（龙虾硬件、手表等）

---

## 仓库结构

```
aihw-starter/
├── solutions/             # 6 个品类的商业化方案（核心内容）
│   └── 0X-xxxx/
│       ├── README.md      # 1 分钟读完
│       ├── 01-business.md # 商业模式与市场判断
│       ├── 02-solution.md # 技术方案（推荐架构 + 接入步骤）
│       ├── 03-cost.md     # BOM + 云端用量 + 算账
│       ├── 04-cases.md    # 脱敏案例与公开案例
│       ├── 05-faq.md      # 客户高频问答
│       └── demo/          # 最小可跑 demo（Python 或 Go）
├── awesome/               # 生态资源索引
│   ├── open-source/       # 开源项目（136 项目，15 品类）
│   └── commercial-products/  # 在售商业化产品案例（持续收集）
├── future/                # 路线图：计划纳入的品类
├── docs/                  # GitHub Pages 门面页
├── faq.md                 # 跨品类通用 FAQ
└── CONTRIBUTING.md        # 贡献指南
```

---

## 快速开始

**如果你是方案商**：从感兴趣的品类进入 → 读 `01-business.md` 判断要不要做 → 读 `02-solution.md` 看技术方案 → 读 `03-cost.md` 算账。

**如果你是品牌商**：先看 [docs/](./docs/) 门面页对全品类的总览 → 锁定方向后进入对应 solution 的 `01-business.md`。

**如果你是开发者**：进入 `solutions/0X-xxx/demo/` 跑通示例 → 改造成自家产品。

**如果你想了解开源生态**：[awesome/open-source/](./awesome/open-source/) 已收录 136 个 GitHub 开源项目，覆盖 15 品类。

**如果你想看市场上有什么在售产品**：[awesome/commercial-products/](./awesome/commercial-products/) 持续收集中。

---

## 贡献

仓库欢迎以下四类贡献：

1. **新增其他大模型方案**：在现有 solution 下新增 `02-solution-{model}.md`
2. **新增方案商端到端方案**：在 `solutions/0X/04-cases.md` 加脱敏案例，或在 `awesome/commercial-products/` 加在售产品记录
3. **新增品类**：从 `future/README.md` 路线图认领，提交完整 6 文件 + demo
4. **新增开源项目**：补充到 `awesome/open-source/by-category/` 对应文件

详细规则参见 [CONTRIBUTING.md](./CONTRIBUTING.md)。

---

## 反馈与交流

- Issue：报问题 / 提建议 / 申请收录
- Discussion：行业讨论 / 经验交流
- 商业化合作：在 Issue 中标注 `[business]` 标签

---

## License

本仓库内容采用 [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) 协议，代码采用 [MIT](./LICENSE) 协议。
