# aihw-starter

> AI 硬件行业热门品类的**商业化最佳实践案例库**
>
> 从"这门生意能不能做、怎么搭、怎么算账"出发的工程化案例集。

---

## 热门品类

| # | 品类 | 状态 | 一句话定位 |
|---|---|---|---|
| 05 | [IPC / AI 视觉](./solutions/05-ipc/) | 完整版 | 视频以文搜图 + 摘要订阅 |
| 06 | [AI 眼镜](./solutions/06-ai-glasses/) | 占位版 | 多模态交互套件，端到端打包 |
| 01 | [AI 玩具 / 陪伴 / 儿童伴学](./solutions/01-toys-companion/) | 完整版 | 自定义对话角色 + 声音克隆，IP 与儿童陪伴双线 |
| 02 | [桌宠](./solutions/02-desktop-pet/) | 占位版 | 动作情绪标签 + 情感 TTS，三路同步 |
| 04 | [AI 耳机](./solutions/04-ai-earphone/) | 占位版 | 实时翻译 / 对话 / 听记多用途 |
| 03 | [录音卡 / 会议盒子](./solutions/03-recorder/) | 占位版 | ASR + 纪要 Agent，2–5 分钟出结构化纪要 |

未来计划：[future/](./future/)（具身智能 / 桌面服务机器人、智能手表等）

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

**方案商**：从感兴趣的品类进入 → 读 [01-business.md](./solutions/05-ipc/01-business.md) 判断是否值得投入 → 读 [02-solution.md](./solutions/05-ipc/02-solution.md) 看技术方案 → 读 [03-cost.md](./solutions/05-ipc/03-cost.md) 算账。

**品牌商**：先看 [docs/ 门面页](./docs/) 对全品类的总览 → 锁定方向后进入对应 solution 的 [01-business.md](./solutions/05-ipc/01-business.md)。

**开发者**：进入 [solutions/05-ipc/demo/](./solutions/05-ipc/demo/) 跑通示例 → 改造成自家产品。

**了解开源生态**：[awesome/open-source/](./awesome/open-source/) 已收录 136 个 GitHub 开源项目，覆盖 15 品类。

**查看在售产品**：[awesome/commercial-products/](./awesome/commercial-products/) 持续收集中。

---

## 贡献

仓库欢迎以下四类贡献：

1. **新增其他大模型方案**：在现有 solution 下新增 [02-solution-{model}.md](./solutions/05-ipc/02-solution.md)
2. **新增方案商端到端方案**：在 [04-cases.md](./solutions/05-ipc/04-cases.md) 加脱敏案例，或在 [awesome/commercial-products/](./awesome/commercial-products/) 加在售产品记录
3. **新增品类**：从 [future/README.md](./future/README.md) 路线图认领，提交完整 6 文件 + demo
4. **新增开源项目**：补充到 [awesome/open-source/by-category/](./awesome/open-source/by-category/) 对应文件

详细规则参见 [CONTRIBUTING.md](./CONTRIBUTING.md)。

---

## 反馈与交流

- Issue：报问题 / 提建议 / 申请收录
- Discussion：行业讨论 / 经验交流
- 商业化合作：在 Issue 中标注 `[business]` 标签

---

## License

- **文档内容**（Markdown、表格、清单、示意图）：[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) — 可自由复制、修改、商用，需注明来源
- **代码**（`demo/` 下的脚本与 Python/Go 示例）：[MIT](./LICENSE) — 可自由使用，无担保

> **SDK 协议说明**：demo 中引用的第三方 SDK（如 DashScope / 百炼 API）遵循其原厂服务协议，MIT 仅覆盖本仓库自身的示例代码。

建议在引用时附上原文链接，方便读者回溯版本与更新。
