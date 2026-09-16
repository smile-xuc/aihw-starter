# Awesome · 开源 AI 硬件项目集

> 本目录收录公开可访问的开源 AI 硬件项目，包括代码仓库、硬件方案、设计文件等。
> 所有项目均链接到原始仓库或公开页面，本仓库不代为分发任何二进制或受限内容。

## 1. 综合索引（HTML 大盘）

完整项目集（137+ 项目，15 个品类）：[`ai-hardware-projects.html`](./ai-hardware-projects.html)

可在浏览器打开 HTML 进行搜索、分类筛选、Star 数排序。**HTML 是浏览/检索大盘**，按能力轴分类（语音 AI、视觉 AI、机器人、可穿戴、芯片平台等）。

## 2. 按品类细分（MD 入口）

### 2.1 双轨说明（HTML ↔ MD）

| 轨 | 定位 | 分类轴 |
|---|---|---|
| **HTML** `ai-hardware-projects.html` | 搜索、排序、全量浏览 | 能力轴（15 类） |
| **MD** `by-category/*.md` | 与 solutions 对齐的可读入口 | 解决方案品类（01–09 + `_others`） |

映射 **不是 1:1**：一个 HTML 项目只落 **一个主 MD 品类**（避免九份拷贝）；次要关联用「另见」一行。HTML 里的「芯片平台 / 模型部署 / 参考合集 / 无人机」等多数进 [`_others.md`](./by-category/_others.md)，不强行塞进 01–09。

建议主品类映射（挑卡时用）：

| MD 分册 | 优先从 HTML 品类取 |
|---|---|
| `01-ipc` | 视觉 AI |
| `02-ai-glasses` | 可穿戴 AI（眼镜向） |
| `03-toys-companion` | 语音 AI（玩具/陪伴） |
| `04-agent-hardware` | 语音 AI / Agent 盒子（勿与 03 抢小智全文） |
| `05-desktop-pet` | 机器人 / 显示创意（桌面形态） |
| `06-ai-earphone` | 翻译设备 / 可穿戴 / 音频栈 |
| `07-recorder` | 语音 AI / 模型部署（录音纪要） |
| `08-smart-watch` | 可穿戴（健康/手表；开源整机偏少） |
| `09-embodied` | 机器人（具身/机械臂） |
| `_others` | 芯片平台、模型部署、参考合集、无人机等 |

文件名编号与 [`solutions/by-category/`](../../solutions/by-category/) **对齐**。详细列表见 [`by-category/`](./by-category/)：

- [`01-ipc.md`](./by-category/01-ipc.md) — IPC/视觉方向开源项目
- [`02-ai-glasses.md`](./by-category/02-ai-glasses.md) — AI 眼镜方向开源项目
- [`03-toys-companion.md`](./by-category/03-toys-companion.md) — 玩具/陪伴方向开源项目
- [`04-agent-hardware.md`](./by-category/04-agent-hardware.md) — Agent 硬件方向开源项目
- [`05-desktop-pet.md`](./by-category/05-desktop-pet.md) — 桌宠方向开源项目
- [`06-ai-earphone.md`](./by-category/06-ai-earphone.md) — AI 耳机方向开源项目
- [`07-recorder.md`](./by-category/07-recorder.md) — 录音/纪要方向开源项目
- [`08-smart-watch.md`](./by-category/08-smart-watch.md) — 智能手表 / 健康可穿戴方向开源项目
- [`09-embodied.md`](./by-category/09-embodied.md) — 具身智能方向开源项目
- [`_others.md`](./by-category/_others.md) — 芯片/部署/合集等尚未归入 01–09 的项目

### 2.2 项目卡片字段

每张卡至少包含：仓库 / 简介 / 框架或平台 / License（未知写「待核」）/ 可选 Star（写「以 HTML 大盘为准」或快照月）。完整模板见各分册文首示例。

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

1. 在 `by-category/` **主品类** Markdown 中追加项目卡片（一项目一主品类）
2. 建议同步更新 HTML `projects` 数组（浏览大盘）
3. 包含：项目名、框架、license、一句话简介、原始链接；Star 可写「以 HTML 为准」
4. 验证项目至少满足「收录原则」中的 3 条

详见根目录 [`CONTRIBUTING.md`](../../CONTRIBUTING.md)。

---

**版本**：千问大模型方案  
**更新日期**：2026-09
