<div align="center">

# 🚀 AI Hardware Starter

**AI 硬件行业热门品类的商业化最佳实践案例库**

从"这门生意能不能做、怎么搭、怎么算账"出发的工程化案例集

[![License: CC BY 4.0](https://img.shields.io/badge/Docs-CC%20BY%204.0-lightgrey.svg)](https://creativecommons.org/licenses/by/4.0/)
[![License: MIT](https://img.shields.io/badge/Code-MIT-blue.svg)](./LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](./CONTRIBUTING.md)

</div>

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
<td><a href="./solutions/01-ipc/"><b>IPC / AI 视觉</b></a></td>
<td align="center">✅ 完整版</td>
<td>视频以文搜图 + 摘要订阅</td>
</tr>
<tr>
<td align="center">02</td>
<td><a href="./solutions/02-ai-glasses/"><b>AI 眼镜</b></a></td>
<td align="center">🚧 占位版</td>
<td>多模态交互套件，端到端打包</td>
</tr>
<tr>
<td align="center">03</td>
<td><a href="./solutions/03-toys-companion/"><b>AI 玩具 / 陪伴 / 儿童伴学</b></a></td>
<td align="center">✅ 完整版</td>
<td>自定义对话角色 + 声音克隆</td>
</tr>
<tr>
<td align="center">04</td>
<td><a href="./solutions/04-desktop-pet/"><b>桌宠</b></a></td>
<td align="center">🚧 占位版</td>
<td>动作情绪标签 + 情感 TTS</td>
</tr>
<tr>
<td align="center">05</td>
<td><a href="./solutions/05-ai-earphone/"><b>AI 耳机</b></a></td>
<td align="center">✅ 完整版</td>
<td>实时翻译 / 对话 / 听记多用途</td>
</tr>
<tr>
<td align="center">06</td>
<td><a href="./solutions/06-recorder/"><b>录音卡 / 会议盒子</b></a></td>
<td align="center">✅ 完整版</td>
<td>ASR + 纪要 Agent，结构化纪要</td>
</tr>
</table>

> 📌 未来计划：[future/](./future/) — 具身智能 / 桌面服务机器人、智能手表等

---

## 每个品类包含什么

```
solutions/0X-xxxx/
├── README.md        # 1 分钟读完的品类概述
├── 01-business.md   # 商业模式与市场判断
├── 02-solution.md   # 技术方案：推荐架构 + 接入步骤 + 代码示例
├── 03-cost.md       # BOM + 云端用量 + 算账模型
├── 04-cases.md      # 脱敏案例与公开案例
├── 05-faq.md        # 客户高频问答
└── demo/            # 最小可跑 demo（Python / Go）
```

---

## 快速开始

<table>
<tr>
<td width="34%">

### 🏭 方案商 / 品牌商

1. 看 [docs/ 门面页](./docs/) 了解全品类总览
2. 进入感兴趣的品类目录
3. 读 [01-business.md](./solutions/01-ipc/01-business.md) 判断值不值得投入
4. 读 [02-solution.md](./solutions/01-ipc/02-solution.md) 看技术方案
5. 读 [03-cost.md](./solutions/01-ipc/03-cost.md) 算清楚账

</td>
<td width="33%">

### 👩‍💻 开发者

1. 进入 [solutions/0X-xxxx/demo/](./solutions/01-ipc/demo/)
2. 跑通示例 → 改造成自家产品

</td>
<td width="33%">

### 🔍 了解生态

- [awesome/open-source/](./awesome/open-source/) — 136 个 GitHub 开源项目，15 品类
- [awesome/commercial-products/](./awesome/commercial-products/) — 在售商业产品

</td>
</tr>
</table>

---

## 仓库结构

```
aihw-starter/
├── solutions/                 # 6 个品类的商业化方案（核心内容）
├── awesome/
│   ├── open-source/           # 开源项目索引（136 项目，15 品类）
│   └── commercial-products/   # 在售商业化产品案例
├── future/                    # 路线图：计划纳入的品类
├── docs/                      # GitHub Pages 门面页
├── faq.md                     # 跨品类通用 FAQ
└── CONTRIBUTING.md            # 贡献指南
```

---

## 参与贡献

欢迎以下四类贡献：

| 贡献类型 | 说明 |
|---|---|
| **新增其他大模型方案** | 在现有品类下新增 `02-solution-{model}.md` |
| **新增案例** | 在 `04-cases.md` 加脱敏案例，或在 `awesome/` 加产品记录 |
| **新增品类** | 从 [future/](./future/) 路线图认领，提交完整 6 文件 + demo |
| **新增开源项目** | 补充到 `awesome/open-source/by-category/` 对应文件 |

详细规则参见 [CONTRIBUTING.md](./CONTRIBUTING.md)

---

## 反馈与交流

- **Issue**：报问题 / 提建议 / 申请收录
- **Discussion**：行业讨论 / 经验交流
- **商业化合作**：在 Issue 中标注 `[business]` 标签

---

## License

| 内容 | 协议 |
|---|---|
| 文档（Markdown、表格、示意图） | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) — 可自由复制、修改、商用，需注明来源 |
| 代码（`demo/` 下的脚本与示例） | [MIT](./LICENSE) — 可自由使用，无担保 |

> **SDK 协议说明**：demo 中引用的第三方 SDK（如 DashScope / 百炼 API）遵循其原厂服务协议，MIT 仅覆盖本仓库自身的示例代码。
