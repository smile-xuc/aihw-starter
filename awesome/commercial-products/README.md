# Awesome · 商业产品案例库

> 本目录收录公开市场可查证的 AI 硬件商业产品案例，用于客户做对标参考、抄作业。
> 所有产品均链接到官网/产品页/公开报道，本仓库不代为分发任何商业 SDK 或受限内容。

## 1. 收录原则

- **公开可查**：必须有官网/产品页/公开报道链接
- 收录标准：已量产并公开销售，或公开众筹已达成的产品（不含 PPT 概念产品）。已停售或已关闭服务的产品原位保留，标题加〔已停售〕或〔已停售·已断服〕，作为历史对标，不另设章节。
- **主品类**：每个产品只在一个品类文件写完整卡片；其他品类最多写一行「另见」，不重复价格和规格数字。已定主品类见同一通则
- **客观中立**：不限于使用千问大模型的产品，覆盖 OpenAI/豆包/智谱/Kimi/DeepSeek/方案商等所有路径
- **数据来源**：所有数字（出货量、定价、订阅价格等）必须有公开来源

## 2. 按品类细分

文件名编号与 [`solutions/by-category/`](../../solutions/by-category/) **对齐**。详细产品列表见 [`by-category/`](./by-category/)：

- [`01-ipc.md`](./by-category/01-ipc.md) — IPC/视觉方向商业产品
- [`02-ai-glasses.md`](./by-category/02-ai-glasses.md) — AI 眼镜方向商业产品
- [`03-toys-companion.md`](./by-category/03-toys-companion.md) — 玩具/陪伴方向商业产品
- [`04-agent-hardware.md`](./by-category/04-agent-hardware.md) — Agent 硬件方向商业产品
- [`05-desktop-pet.md`](./by-category/05-desktop-pet.md) — 桌宠方向商业产品
- [`06-ai-earphone.md`](./by-category/06-ai-earphone.md) — AI 耳机方向商业产品
- [`07-recorder.md`](./by-category/07-recorder.md) — 录音/纪要方向商业产品
- [`08-smart-watch.md`](./by-category/08-smart-watch.md) — 智能手表 / 健康可穿戴方向商业产品
- [`09-embodied.md`](./by-category/09-embodied.md) — 具身智能方向商业产品

## 3. 产品卡片格式

字段按固定顺序排列（✱ 为必填）。完整模板、价格块与示例见 [CONTRIBUTING.md](../../CONTRIBUTING.md) 第二节。

1. ✱ 标题：`### 产品名（品牌 / 公司）`
2. ✱ 上市状态
3. ✱ 官网/渠道
4. ✱ 形态
5. ✱ 定价（首发价 / 现价 / MSRP）
6. ✱ 目标市场
7. ✱ AI 能力
8. ✱ 大模型方案
9. ✱ 公开数据
10. ✱ 关键差异化
11. ✱ 商业模式
12. 风险事件（选填）
13. 另见（选填）
14. ✱ 来源引用行（`> 来源：`）

## 4. 贡献指引

提交新产品 PR 时请：

1. 在 `by-category/` 对应品类的 Markdown 中追加产品卡片
2. 严格遵守"收录原则"
3. **禁止**：销售口径、未公开的内部数据、夸大宣传
4. **欢迎**：方案商完整方案案例（设备 + 模型 + Agent + 端到端实施）

详见根目录 [`CONTRIBUTING.md`](../../CONTRIBUTING.md)。

## 5. 与 solutions/ 案例的关系

- [`solutions/by-category/0X-xxx/04-cases.md`](../../solutions/by-category/)：有借鉴价值的深度案例
- `awesome/commercial-products/by-category/0X.md`：按固定字段收录的产品卡

案例与产品卡不要求一一对应，也不留待补占位。产品已有卡片时，案例用「另见」链到该卡。详见 [CONTRIBUTING.md](../../CONTRIBUTING.md)。

---

**版本**：千问大模型方案
**更新日期**：2026-09
