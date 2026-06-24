# Awesome · 开源 AI 硬件项目集

> 本目录收录公开可访问的开源 AI 硬件项目，包括代码仓库、硬件方案、设计文件等。
> 所有项目均链接到原始仓库或公开页面，本仓库不代为分发任何二进制或受限内容。

## 1. 综合索引

完整项目集（136+ 项目，15 个品类）：[`ai-hardware-projects.html`](./ai-hardware-projects.html)

可在浏览器打开 HTML 进行搜索、分类筛选、Star 数排序。

## 2. 按品类细分（占位）

详细按品类的项目列表见 [`by-category/`](./by-category/)，覆盖：

- [`01-toys-companion.md`](./by-category/01-toys-companion.md) — 玩具/陪伴方向开源项目
- [`02-desktop-pet.md`](./by-category/02-desktop-pet.md) — 桌宠/毛绒方向开源项目
- [`03-recorder.md`](./by-category/03-recorder.md) — 录音/纪要方向开源项目
- [`04-ai-earphone.md`](./by-category/04-ai-earphone.md) — AI 耳机方向开源项目
- [`05-ipc.md`](./by-category/05-ipc.md) — IPC/视觉方向开源项目
- [`06-ai-glasses.md`](./by-category/06-ai-glasses.md) — AI 眼镜方向开源项目

## 3. 收录原则

- **真开源**：必须有公开 license（MIT、Apache、GPL 等），代码可下载
- **有维护**：1 年内有提交活动，或明确表明是稳定版
- **可参考**：要么有详细文档/教程，要么有典型架构示范价值
- **客观中立**：不区分模型/平台/方案商，覆盖各种技术栈

## 4. 框架分布速览

按主流框架分类（详见 HTML 索引）：

| 框架 | 适用 | 代表项目 |
|---|---|---|
| ESP-IDF | 语音 AI 交互、流式音频 | 小智、小聆、火山引擎类项目 |
| Arduino | 轻量交互（BLE/显示/舵机） | Claude Desktop Buddy、Sesame 等 |
| Raspberry Pi | 高算力场景、Linux 应用 | DIY AI 助手、智能音箱 |
| RTOS（FreeRTOS/AliOS） | 严格资源受限设备 | 商业级量产硬件参考 |

## 5. 贡献新项目

提交新开源项目 PR 时请：

1. 在 `by-category/` 对应品类的 Markdown 中追加项目卡片
2. 包含：项目名、Star 数、主要框架、license、一句话简介、原始链接
3. 验证项目至少满足"收录原则"中的 3 条

详见根目录 [`CONTRIBUTING.md`](../../CONTRIBUTING.md)。

---

**版本**：千问大模型方案 · 首发版
**更新日期**：2026-06
