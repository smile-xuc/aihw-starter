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
<td><a href="./solutions/by-category/01-ipc/"><b>IPC / AI 视觉</b></a></td>
<td align="center">✅ 完整版</td>
<td>视频以文搜图 + 摘要订阅</td>
</tr>
<tr>
<td align="center">02</td>
<td><a href="./solutions/by-category/02-ai-glasses/"><b>AI 眼镜</b></a></td>
<td align="center">🚧 占位版</td>
<td>多模态交互套件，端到端打包</td>
</tr>
<tr>
<td align="center">03</td>
<td><a href="./solutions/by-category/03-toys-companion/"><b>AI 玩具 / 陪伴 / 儿童伴学</b></a></td>
<td align="center">✅ 完整版</td>
<td>自定义对话角色 + 声音克隆</td>
</tr>
<tr>
<td align="center">04</td>
<td><a href="./solutions/by-category/"><b>Agent 硬件（如桌面盒子）</b></a></td>
<td align="center">📌 计划中</td>
<td>多 Agent 协同 + 端云模型协同</td>
</tr>
<tr>
<td align="center">05</td>
<td><a href="./solutions/by-category/04-desktop-pet/"><b>桌宠</b></a></td>
<td align="center">🚧 占位版</td>
<td>动作情绪标签 + 情感 TTS</td>
</tr>
<tr>
<td align="center">06</td>
<td><a href="./solutions/by-category/05-ai-earphone/"><b>AI 耳机</b></a></td>
<td align="center">✅ 完整版</td>
<td>实时翻译 / 对话 / 听记多用途</td>
</tr>
<tr>
<td align="center">07</td>
<td><a href="./solutions/by-category/06-recorder/"><b>录音卡 / 会议盒子</b></a></td>
<td align="center">✅ 完整版</td>
<td>ASR + 纪要 Agent，结构化纪要</td>
</tr>
<tr>
<td align="center">08</td>
<td><b>智能手表 / 健康可穿戴</b></td>
<td align="center">📌 计划中</td>
<td>健康指标解读 + 订阅商业化</td>
</tr>
<tr>
<td align="center">09</td>
<td><b>具身智能</b></td>
<td align="center">📌 计划中</td>
<td>Qwen-Robot Suite 三模型矩阵（操作 + 导航 + 世界模型）</td>
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
└── demo/            # 最小可跑 demo（Python / Go）
```

---

## 快速开始

> 📑 **两条进入路径**：品牌商按「品类」找市场，开发者按「方案」找技术栈。两个维度互相正交，可以任意切换。

<table>
<tr>
<td width="34%" valign="top">

### 🏭 方案商 / 品牌商

1. 看 [solutions/by-category/](./solutions/by-category/) — 品类总览（IPC / 玩具陪伴 / 耳机 / 录音卡 …）
2. 进入感兴趣的品类目录（如 [`solutions/01-ipc/`](./solutions/by-category/01-ipc/)）
3. 读 [01-business.md](./solutions/by-category/01-ipc/01-business.md) 判断值不值得投入
4. 读 [02-solution.md](./solutions/by-category/01-ipc/02-solution.md) 看技术方案
5. 读 [03-cost.md](./solutions/by-category/01-ipc/03-cost.md) 算清楚账

</td>
<td width="33%" valign="top">

### 👩‍💻 开发者

1. 看 [solutions/by-solution/](./solutions/by-solution/) — 方案总览（千问大模型 / 小智 / 端侧 …）
2. 选定方案后回到具体品类的 [demo/](./solutions/by-category/01-ipc/demo/)
3. 跑通示例 → 改造成自家产品

</td>
<td width="33%" valign="top">

### 🔍 了解生态

- [awesome/open-source/](./awesome/open-source/) — 136 个 GitHub 开源项目，15 品类
- [awesome/commercial-products/](./awesome/commercial-products/) — 在售商业产品
- [docs/ 门面页](https://smile-xuc.github.io/aihw-starter/) — GitHub Pages 总览

</td>
</tr>
</table>

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
│   │   ├── 04-desktop-pet/    # 桌宠
│   │   ├── 05-ai-earphone/    # AI 耳机
│   │   └── 06-recorder/       # 录音卡 / 会议盒子
│   └── by-solution/           # 方案总览（开发者视角：千问 / 小智 …）
├── awesome/
│   ├── open-source/           # 开源项目索引（136 项目，15 品类）
│   └── commercial-products/   # 在售商业化产品案例
├── docs/                      # GitHub Pages 门面页
├── faq.md                     # 跨品类通用 FAQ
└── CONTRIBUTING.md            # 贡献指南
```

---

## 参与贡献

欢迎以下贡献：

| 贡献类型 | 说明 |
|---|---|
| **新增品类** | 在 `solutions/by-category/` 下新建目录，提交完整 6 文件 + demo |
| **新增方案** | 在 `solutions/by-solution/` 新增方案页，并在各品类 `02-solution-{model}.md` 补充接入代码 |
| **新增案例** | 在对应品类 `04-cases.md` 加脱敏案例，或在 `awesome/` 加产品记录 |
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
