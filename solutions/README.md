# solutions/ — 两个独立维度

本目录是仓库核心，按**两个独立维度**组织，方便不同角色按自己的视角进入：

| 维度 | 适合谁 | 入口 |
|---|---|---|
| **按品类** | 品牌商 / 方案商 / 决策者：先选赛道，再看方案 | [`by-category/`](./by-category/) |
| **按方案** | 开发者 / 架构师：先选模型/框架，再看在各品类中的落地 | [`by-solution/`](./by-solution/) |

两个维度互相正交，最终都指向同一份品类内容（`solutions/0X-xxx/`）。

## 实际品类内容存放位置

为避免破坏既有链接，所有品类的"商业 / 方案 / 算账 / 案例 / FAQ / demo"实际内容仍位于 `solutions/0X-xxx/`：

```
solutions/
├── README.md          ← 本页
├── by-category/       ← 品类维度入口（品牌商视角）
├── by-solution/       ← 方案维度入口（开发者视角）
├── 01-ipc/            ← IPC / AI 视觉（完整版）
├── 02-ai-glasses/     ← AI 眼镜（占位版）
├── 03-toys-companion/ ← AI 玩具 / 陪伴（完整版）
├── 04-desktop-pet/    ← 桌宠（占位版）
├── 05-ai-earphone/    ← AI 耳机（占位版）
└── 06-recorder/       ← 录音卡 / 会议盒子（占位版）
```

## 怎么开始

- **品牌商 / 方案商**：进入 [`by-category/`](./by-category/) 浏览全品类总览，再选感兴趣的赛道。
- **开发者 / 架构师**：进入 [`by-solution/`](./by-solution/) 选定模型 / 框架方案，再看跨品类的接入差异。
- **不确定从哪开始**：直接看根 [`README.md`](../README.md) 的"热门品类"表格速览。
