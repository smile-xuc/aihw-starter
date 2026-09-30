# 贡献指南

欢迎为 **aihw-starter（AI 硬件行业热门品类商业化最佳实践案例库）** 贡献内容。本仓库的目标是沉淀 AI 硬件不同品类的可落地、可对比、可复用的商业化案例与方案。

我们欢迎以下四类贡献。每一类都有清晰的提交规范，按需选择即可。

---

## 一、新增「其他大模型方案」

> 场景：使用大模型（豆包、GLM、DeepSeek、OpenAI、Gemini 等）完成了某品类的商业化落地，希望把对应的接入路径补充到本仓库。

### 提交位置

按范围二选一，都写进**已有文件**，不按模型另建方案文件：

- **跨品类**的通用内容：写到 `solutions/by-solution/` 的方案页（`0X-*.md`）
- **只涉及单个品类**：写进该品类现有的 `02-solution.md`，在「能力边界」之前增加「其他模型方案」小节

三个必备 **H2**、小节顺序，以及每个模型要写的字段，见文末「内容格式通则」的「02-solution 小节」。

### 写作纪律

- **不做营销话术**：避免「业内最强」「领先」「唯一」这种主观表述。
- **数据必须来自公开渠道**：定价、延迟、并发等数字附带官方文档链接。
- **不暴露任何客户信息**：除非客户已公开授权（如官网、官方公众号、官方案例页）。

---

## 二、新增「方案商端到端方案」

> 场景：你是芯片/模组/ODM/集成商，已经把某品类做成了端到端可量产的方案；或者你是观察者，看到市场上某家方案商的方案值得记录。

### 提交位置（两选一）

**A. 作为某客户在某品类的脱敏案例**——补充到对应品类的 `04-cases.md`：

```
solutions/by-category/01-ipc/04-cases.md  ← 末尾追加新案例
```

**B. 作为在售产品记录**——提交到 `awesome/commercial-products/` 下对应品类的 markdown：

```
awesome/commercial-products/by-category/03-toys-companion.md
awesome/commercial-products/by-category/01-ipc.md
```

商业产品卡与 04-cases 条目的模板只在本节维护。其他页面只放链接，不要再抄一份字段表。

### 商业产品卡

用在 `awesome/commercial-products/by-category/0X-*.md`。字段和顺序以 HiDock H1 Lite 为基线，并补上「上市状态」和价格块。

**字段按固定顺序排列，✱ 为必填。** 必填字段即使没有信息也不能省略：写「未公开」或「未见公开数据」。旧卡迁移（第 4 批）时，不知道内容的必填字段一律填「待核实」，由第 5 批替换。

0. ✱ 标题：`### 产品名（品牌 / 公司）`。品牌括注一律要写。不在售的产品在标题后加状态标签，见文末「停售 / 断服产品」
1. ✱ **上市状态**：从以下值中选一个：`在售` / `预售` / `众筹中` / `停售新客` / `停售` / `已关闭服务`。后面用括号写明依据和查证日期；除「在售」外，还要写事件日期并附来源链接
2. ✱ **官网/渠道**：写成 `<URL>`。多个渠道之间用「；」分隔，渠道名写在 URL 后面
3. ✱ **形态**
4. ✱ **定价**（价格块）。每行格式：`价格类型：金额 ISO代码 · 地区 · [出处](URL) · 查证 YYYY-MM-DD`
   - **`首发价` / `现价` / `MSRP` 三行都必须写，不放宽**。跟现价相同的写「同现价」；确实查不到的写「待核实」；已停售产品的现价写「—（已停售）」
   - 可选行：`预售价`、`促销价`、`历史价`、`经销商价`、`估算`、`订阅`
5. ✱ **目标市场**
6. ✱ **AI 能力**
7. ✱ **大模型方案**：没有公开时，写「官网未公开具体基座模型（非千问默认绑定）」
8. ✱ **公开数据**：没有时写「未见公开销量」
9. ✱ **关键差异化**：用 ①②③ 列出
10. ✱ **商业模式**
11. **风险事件**（选填）：召回、下架、断服、监管事件。写明日期，附上链接
12. **另见**（选填）：链接到别的品类里的对照卡或 04-cases 条目
13. ✱ `> 来源：` 引用行：Markdown 链接之间用「 · 」分隔。链接文字里带上发布日期，写成「标题（YYYY-MM-DD）」；查证日期统一放在行尾，写成「（均查证 YYYY-MM-DD）」。至少要有 1 条官方来源（官网、官方商店或官方新闻稿）

**产品页有局限或矛盾时，写在该字段末尾，不用脚注。** 只用以下五种写法：

- 「页面不一致：A 页写 X，B 页写 Y，卡片取 Z」
- 「页面未写 X」
- 「厂商称」
- 「评测观察（媒体，日期）」
- 「原文 "…"」

不用 GFM `[^n]` 脚注，因为同一个文件里有多张卡，脚注编号会冲突。

**示例**（基于 HiDock H1 Lite 原文，只调整了字段顺序并补上价格块；「…」表示省略的原文。原卡的「官网 $189」只写了「2026-09 产品页」，没有精确到日，所以按规则标「待核实」）：

```markdown
### HiDock H1 Lite（HiDock）

- **上市状态**：在售（Amazon 页面在售，查证 2026-09-28）
- **官网/渠道**：<https://www.hidock.com/products/hidock-h1-lite>；Amazon <https://www.amazon.com/HiDock-Conference-Speakerphone-Noise-Canceling-Transcription/dp/B0GZ3GZ3DT>（HiDock Official Store）
- **形态**：USB-C 桌面 AI 扬声器电话 + 会议录音机；面向 Mac mini 与现代 USB-C 桌面 …
- **定价**：
  - 首发价：$169 USD · 美国 · [Newswire 发布稿（2026-06-02）](https://www.newswire.com/news/hidock-launches-h1-lite-solving-bluetooth-earphone-recording-for-ai-meeting) · 限时首发
  - 现价：$189 USD · 美国 · [官网产品页](https://www.hidock.com/products/hidock-h1-lite) · 查证 待核实（原卡仅写「2026-09 产品页」）
  - 现价（渠道）：$189.99 USD · 美国 · [Amazon](https://www.amazon.com/HiDock-Conference-Speakerphone-Noise-Canceling-Transcription/dp/B0GZ3GZ3DT) · 查证 2026-09-28
  - MSRP：$189 USD · 美国 · [Newswire 发布稿（2026-06-02）](https://www.newswire.com/news/hidock-launches-h1-lite-solving-bluetooth-earphone-recording-for-ai-meeting) · 发布稿称促销结束后零售价
  - 订阅：基础转写 / 摘要随设备；Pro / Unlimited 公开价见 [HiNotes 套餐页](https://www.hidock.com/pages/hinotes)
- **目标市场**：固定工位上的线上会议与当面访谈；强调用户佩戴蓝牙耳机时仍录通话双方
- **AI 能力**：配套 HiNotes（网页 / iOS / Android）做转写、摘要与检索。厂商称 75+ 语种 …
- **大模型方案**：产品页列出 GPT-5.4、Claude 4.6、Gemini 3.1 Pro；[HiNotes 套餐页](https://www.hidock.com/pages/hinotes)另写 GPT-5 等（**非千问默认绑定**，以套餐页当前列表为准）
- **公开数据**：2026-06-02 公开发布，未见独立销量。规格页写本地存储 8 GB、蓝牙 5.3、5 W 扬声器、约 362 g …（同页英制 5.0×1.5×0.6 in 与毫米不完全对应）
- **关键差异化**：① BlueCatch：蓝牙耳机通话时录双方，且不向会议加入 bot；② 桌面扬声器电话，区别于 Plaud / Notta 卡片机；③ 厂商称基础转写与摘要含在购机价内 …
- **商业模式**：硬件销售 + 基础转写 / 摘要随设备（厂商表述，以当前条款为准）…

> 来源：[H1 Lite 产品页](https://www.hidock.com/products/hidock-h1-lite) · [发布博客](https://www.hidock.com/blogs/new-release/hidock-h1-lite-the-ai-audio-companion-for-mac-mini-and-modern-desktops) · [Newswire 发布稿（2026-06-02）](https://www.newswire.com/news/hidock-launches-h1-lite-solving-bluetooth-earphone-recording-for-ai-meeting) · [Amazon](https://www.amazon.com/HiDock-Conference-Speakerphone-Noise-Canceling-Transcription/dp/B0GZ3GZ3DT) · [HiNotes 套餐](https://www.hidock.com/pages/hinotes) · [设置指南](https://www.hidock.com/blogs/user-guide/hidock-com-blog-hidock-h1-lite-setup-guide)
```

### 04-cases 案例条目

用在 `solutions/by-category/0X-*/04-cases.md`。HERO 和 FOOTER 注释块原样保留。

**页面结构**：

1. HERO 块 → `>` 引言（不超过两行）→ `---`
2. `## 一、收录原则`：统一换成下面的标准文字
3. `## 二、产品横评`：选填，案例有 5 个以上时建议写。可以包含 `### 形态路线图`。价格列只写「链接 + 金额」，数字要跟 awesome 卡一致
4. `## 三、关键案例速览`：也可以按形态拆成几个 H2（02 / 03 现在就是这么拆的），编号依次往后排
5. `## N、开源 / 自建快速验证`：选填
6. `## N、待补充清单（欢迎 PR）`：永远是正文最后一个 H2
7. `**版本**` / `**更新日期**：YYYY-MM` → FOOTER

**写法要求**：

- **章节编号**：统一用中文 `## 一、`。不要用 `## 1.` 这种阿拉伯数字编号
- **「案例如何提交」节**：02 / 03 现有的这一节删掉，改成收录原则最后一行的链接
- **案例标题**：统一为 `### 案例：{产品名}（{品牌 / 公司}）— {一句定位}`
  - `— 定位` 选填，保留 04–07 现有的副标题
  - 第 4 批要把 04–07、09 的 `### 3.x`、01 的 `### 1.x`、08 的 `### Oura` 都改成这种格式
  - 产品名里已经有品牌的，括注可以省略
  - 不在售的产品，标题后加停售标签
- **条目字段按固定顺序排列**（✱ 为必填）：✱ `公开信息源` → `形态` → `技术路线` → ✱ `亮点` → `公开数据` → ✱ `可借鉴点` → `另见`
  - `另见`：只在该产品有 awesome 卡时写，链接到卡片；没有卡就不写这一项，不留占位
  - 跨产品对照也写在 `另见` 里。Bee 要从 Limitless 条目中拆出来，单独写成 `### 案例：Bee Pioneer（Bee / Amazon）`（第 4 批）
- **来源标签**：只用 `**公开信息源**`（「公开渠道」「来源」「参考」都改成它），只写一行，放在条目第一条。引用格式：`[标题（发布日期）](URL) · […](URL)（查证 YYYY-MM-DD）`；不同链接查证日期不同时，逐条标注
- **跨品类产品**：在非主品类页面里保留的对照条目，要点不超过 3 条，标题加 `〔另见 0X〕`，不重复写价格和规格数字

**收录原则标准文字**（整段写入各品类 `04-cases.md`；最后一行的相对链接按该文件所在目录计算）：

```markdown
## 一、收录原则

- **只写公开信息**：产品与客户名仅在官网 / 官方商店 / 官方公众号 / 媒体报道已披露时出现
- **客观陈述**：不评价优劣，只记形态、技术路线、可观察事实；不写「首个 / 最强 / 唯一」
- **数字有出处**：价格、销量等用公开口径，附链接与查证日期；查不到标「待核实」；不写转化率 / ARPU / 私下报价
- **与 awesome 的关系**：有商业产品卡的案例用「另见」互链；提交规范见 [CONTRIBUTING.md](../../../CONTRIBUTING.md)
```

**条目示例**（基于 Halliday G2 原文，只改了标题、加了「另见」；「…」表示省略的原文。示例里的相对链接按 `solutions/by-category/02-ai-glasses/04-cases.md` 计算）：

```markdown
### 案例：Halliday G2（Halliday）— 无摄像头光波导显示

- **公开信息源**：[Halliday 官网](https://www.hallidayglobal.com/) · [订购页](https://www.hallidayglobal.com/purchase) · [设计页](https://www.hallidayglobal.com/design)（查证 2026-09-29）· [The Verge 2026-07-21](https://www.theverge.com/tech/968255/halliday-gen-2-smart-glasses-hands-on-ai-wearables) · [Android Authority 2026-07-21](https://www.androidauthority.com/halliday-g2-smart-glasses-launch-3689649/)
- **形态**：无摄像头双目光波导。官网规格表：双 MicroLED、绿色、单眼 600×300 … 美区订购页标价 599 美元；可见优惠为 LAUNCH50 减 50 美元
- **亮点**：Meeting Flow 在会中提供 Thread Tracker、Decision Confirmation、Commitment Check，并带会后摘要 …
- **可借鉴点**：相对 Ray-Ban Meta、Oakley Meta HSTN 的拍照音频路线 … Halliday 则把会议时长做成 credits
- **另见**：[Halliday G2 商业产品卡](../../../awesome/commercial-products/by-category/02-ai-glasses.md)
```

**第 4 批处理纯文本来源的写法**（不新增事实，只加标记）：

```markdown
- **公开信息源**：Rokid 官网、CES 2026 报道、财联社等（**待补链接**）
```

### 写作纪律

- **客户名只在公开渠道已披露的情况下写出**；其他情况一律用「某头部毛绒玩具品牌」「某 IPC 出海厂商」等泛指。
- **订阅可行性用「已知跑通 / 未跑通」中性描述**——不写转化率、不写 ARPU、不写收入。
- **只写公开标价**（官网 / 官方商店 / 发布稿 / 可信媒体），附链接与查证日期，区分首发价 / 现价 / MSRP；不写客户私下报价、项目报价。

---

## 三、新增品类

> 场景：你认为还有一个 AI 硬件热门品类值得纳入（如 AI NAS、AI 学习机、AI 投影仪、AI 健身镜、AI 翻译笔等）。

### 流程

1. **先在 GitHub Issues 认领**——标题建议 `[category] 新增 0X-slug`，避免重复劳动。
2. 在 `solutions/by-category/` 下新建目录 `solutions/by-category/0X-{slug}/`，目录命名采用 kebab-case 全小写英文（如 `10-ai-nas`、`11-learning-machine`）。当前已占用 `01`–`09`，见 [`solutions/by-category/README.md`](./solutions/by-category/README.md)。
3. 提交一份**完整 6 文件 + demo 占位**：

```
solutions/by-category/0X-{slug}/
├── README.md             ← 1 分钟读完，给读者快速判断要不要继续看
├── 01-business.md        ← 市场&需求&可行性
├── 02-solution.md        ← 推荐架构 + 接入步骤（其他模型以小节形式补在本文件内）
├── 03-cost.md            ← BOM 拆分 + Token 测算 + 报价口径
├── 04-cases.md           ← 公开案例 / 脱敏案例
├── 05-faq.md             ← 该品类客户高频问答
└── demo/                 ← 可运行 demo（Python）
    └── README.md
```

4. **完整版** vs **占位版**：第一次提交可以是占位版（每个文件保留小节标题 + TODO 说明即可），但 PR 中要写清楚下一步补全计划。

### 6 文件的标准小节

请直接参考 `solutions/by-category/03-toys-companion/` 或 `solutions/by-category/01-ipc/` 的完整版作为模板。

---

## 四、修订成本（cost）/ 案例（cases）数据

> 场景：你发现仓库里的某个数字过时了、或者写错了，想纠正。

### 必备：数据来源

任何对 `03-cost.md` 或 `04-cases.md` 数字的修订，**PR 必须附带至少一个数据来源链接**，包括但不限于：

- 大模型厂商官方计费页 / API 文档
- 元器件官方报价页 / 立创商城 / Octopart
- 客户公开发布会 / 官网案例 / 媒体公开报道
- 政府公开数据（如各地 OPC 政策、补贴公告）

### 不接受的修订

- 无来源的数字调整（哪怕你说「我私下知道」也不行）
- 引用未授权的客户内部数据
- 把客观陈述改成营销表述

---

## 五、新增开源项目

> 场景：你看到 GitHub 上有一个 AI 硬件相关的优秀开源项目，没被收录。

### 提交位置

补充到 `awesome/open-source/by-category/` 下对应品类的 markdown：

```
awesome/open-source/by-category/03-toys-companion.md
awesome/open-source/by-category/01-ipc.md
...
```

如果该项目所属品类不在已有 9 个里面，先在 `awesome/open-source/by-category/_others.md` 暂存，等到对应品类纳入后再迁移。文件名编号与 `solutions/by-category/` 对齐（`04` = Agent 硬件，`05` = 桌宠，以此类推）。

### 项目条目

字段顺序以分册现状为准（作废旧的 emoji 字段模板）。查不到的 License 写「待核实」。第 4 批把现有「仓库」裸 URL 改成 `<URL>`，并把「待核」改成「待核实」；第 5 批逐条补齐 License。

字段顺序：`仓库`（用 `<URL>`）· `Star` · `License` · `框架` · `状态` · `简介` · `关键特性` · `HTML 品类` · `另见`（选填）。

```markdown
### Omi（原 Friend）

- **仓库**：<https://github.com/BasedHardware/omi>
- **Star**：以 HTML 大盘为准
- **License**：MIT
- **框架**：nRF52840 BLE
- **状态**：活跃
- **简介**：开源 AI 可穿戴，持续录音转写 + AI 记忆，录音卡/胸针形态主参考。
- **关键特性**：实时转写；AI 记忆；语音录制；LLM 人格
- **HTML 品类**：语音 AI
- **另见**：耳机/可穿戴形态见 [`06-ai-earphone.md`](./06-ai-earphone.md)
```

> ⚠️ 单纯的 awesome list 索引项目（如 awesome-XXX）我们不收录，因为本仓库自身就是案例库性质。

---

## 六、不接受的 PR

为了保持仓库的客观中立和实用价值，以下 PR 我们会直接 close（请理解）：

- **单纯链接堆砌**：没有任何描述、对比、可运行示例的链接列表 PR。
- **营销性内容**：「最强」「唯一」「领先业界」等主观表述；针对某个厂商的负面对比也不收录。
- **暴露未授权客户信息的案例**：哪怕是好案例，没拿到授权就不要写出客户名；用泛指替代。
- **客户私下报价 / 转化率 / ARPU / 未公开收入**：不收录；公开标价须附来源与查证日期。
- **未署名的搬运**：转载第三方文档/案例必须标注来源。

---

## 七、PR 流程

1. **Fork 本仓库**到你自己的 GitHub 账号。
2. 在你的 fork 上创建一个 feature 分支：`feat/03-toys-companion-doubao` 或 `docs/01-ipc-cost-update` 等语义化命名。
3. 提交时请用清晰的 commit message：
   - `feat(03-toys-companion): add doubao solution`
   - `docs(01-ipc): update cost section with 2026 pricing`
   - `feat(awesome/commercial-products): add new IPC product entry`
4. 打开 PR 时请按 [`.github/PULL_REQUEST_TEMPLATE.md`](./.github/PULL_REQUEST_TEMPLATE.md) 填写：
   - 这次贡献属于上面哪一类（一/二/三/四/五）
   - 涉及哪些品类
   - 数据来源（如有）
   - 是否包含客户敏感信息（应为「否」）
5. 新增开源项目时：写入 `awesome/open-source/by-category/` **主品类**；建议同步更新 HTML 大盘 `projects` 数组。
6. 我们会在 7 天内给出 review 反馈。如有讨论，我们会在 PR 评论里推进。

---

## 八、行为准则

- 对人对事均保持职业、克制、就事论事。
- 鼓励有理有据的不同意见，但不接受人身攻击或厂商之间的拉踩。
- 不在 issue / PR 评论中讨论任何客户具体信息。

---

## 九、有问题怎么办

- **内容相关问题**：在仓库 issues 区开 issue，加 `question` 标签。
- **想长期参与**：欢迎在 issue 区自我介绍，我们会逐步邀请活跃贡献者作为 maintainer。

感谢你为 AI 硬件商业化案例库添砖加瓦。让这个仓库成为整个行业可信的参考。

---

## 内容格式通则

产品卡、案例、方案页都适用。批次一律写「第 N 批」。

### 通用规则

| # | 规则 | 说明 |
|---|---|---|
| U1 | **不写裸 URL** | 正文一律写成 Markdown 链接。只有产品卡的「官网/渠道」字段和开源卡的「仓库」字段可以用 `<URL>` 尖括号链接。网址必须放进链接括号或尖括号，不能直接写在正文里。反例（审计 E1）：讯飞商城地址曾被裸写，并在后面紧跟全角括号「（商城商品页）」。全角括号被解析进路径（`%EF%BC%88`），请求 404。应写成 [讯飞商城](https://www.xunfei.cn/)，全角标点放在 `)` 之外 |
| U2 | **URL 里只放半角字符** | 链接后面的全角标点（，。（）「」）必须放在 `)` 或 `>` 之外。中文路径用浏览器复制出来的百分号编码形式 |
| U3 | **日期统一写 `YYYY-MM-DD`** | 查证日期必须精确到日（按 UTC+8）。事件日期只查得到月份时，可以写 `YYYY-MM`。页面本身没写年份的，照抄原文，并注明「页面未写年份」 |
| U4 | **来源必须是可点击的链接** | 不再接受「官网、36氪等报道」这类纯文本来源。已有的纯文本来源，由第 4 批在后面标注「（**待补链接**）」，再由第 5 批补上链接 |
| U5 | **信息不确定时的写法** | 查不到或说法互相矛盾时写 **待核实**。官方明确说「以后公布」的写 **待定**。现存的「待核」统一改成「待核实」 |
| U6 | **品牌和型号写原文** | 例：HiDock H1 Lite、Meta Ray-Ban Display。国内品牌写成「中文名（英文名）」，例如「萤石（EZVIZ）」。功能名照官网原文写，例如 BlueCatch、Meeting Flow |
| U7 | **引文** | 英文原句用半角 `"…"` 照录。中文引语和强调用「」。厂商的自我描述要标明出处，写「厂商称」「官网称」；不能写成像是本仓库的判断 |
| U8 | **货币** | 产品卡的价格块写成「符号 + 金额 + 空格 + ISO 代码」，例如 `$189 USD`、`¥2,499 CNY`、`¥59,400 JPY`、`€499 EUR`。人民币和日元都用 ¥，所以必须带 ISO 代码。04-cases 正文里可以写「599 美元」「2499 元」。不要写「X 万元 / 亿元」：pre-commit 会拦截，应写成 `¥13,500 CNY` |
| U9 | **数字和单位** | 数字和英文单位之间空一格，例如 `8 GB`、`210 mAh`、`49 g`、`1,600 nits`。`%`、`°`、`℃` 前面不空格。五位数及以上加千分位。这条只要求新写或改动的行遵守，不对全仓库做空格清洗 |
| U10 | **措辞** | 不用「首个 / 最强 / 唯一 / 领先」。不写转化率、复购率、ARPU、客户私下报价、项目报价、未公开收入。`solutions/`、`awesome/` 和根 README 里不用「我们 / 你」（pre-commit 会拦截） |
| U11 | **一个产品只放一个主品类** | 每个产品只在**一个** `by-category/0X-*.md` 中写完整卡片。在其他品类里最多写一行「另见」，链接到主卡，不重复写价格和规格数字。主品类按产品的主要形态和用途判断；判断不了时，以最先收录它的品类为准。已经定下的：Limitless Pendant 主卡放 **07**（04 只留「另见」），Humane AI Pin 放 04，Moxie 放 03，Bee 放 07。主品类归位由第 4 批完成 |
| U12 | **案例和产品卡不强制一一对应** | 04-cases 是有借鉴价值的深度条目，awesome 是按固定字段收录的产品卡。两者不要求一一对应，也不留待补占位。案例对应的产品有 awesome 卡时，才用「另见」链接过去。不要写「精选 3–5 / 全集 10+」这类数量说法 |

### 停售 / 断服产品

Humane、Moxie、Limitless 这一类：

- **原位保留**，不删除，不单独开一节（也不新开「历史对标」一节）。卡片留在主品类文件的 `## 已收录产品` 下，位置不变，卡片计数也不变
- **标题加标签**：上市状态为 `停售新客` 或 `停售` 的，标题后加 `〔已停售〕`；为 `已关闭服务` 的，加 `〔已停售·已断服〕`
- **上市状态**：必须写事件日期和来源链接
- **价格块**：原卡写的「历史公开价」放进 `历史价` 行；口径不明的，首发价和 MSRP 写「待核实」，由第 5 批核实归类；现价写「—（已停售）」
- 「关键差异化」可以改名为「**关键差异化（教训）**」
- awesome 收录原则中的对应表述是：停售产品可作「历史对标」收录，须在标题与上市状态中标明。这是收录条件，不是单独章节
- **主品类归位由第 4 批完成**：Limitless 的完整卡片从 04 移到 07，04 只留一行「另见」；07 待补充清单里的 Limitless 勾掉。Humane（04）和 Moxie（03）已经在主品类里，只需检查其他页面有没有重复写价格或规格，有的话改成「另见」链接

**示例**（基于现有 Humane 卡，只改格式，不新增事实）：

```markdown
### Humane AI Pin（Humane → HP 资产收购）〔已停售·已断服〕

- **上市状态**：已关闭服务（2025-02 停售，资产售予 HP，云服务关闭；[The Verge](https://www.theverge.com/news/614883/humane-ai-hp-acquisition-pin-shutdown)）
- **官网/渠道**：产品已停售；见下方报道
- **形态**：胸针可穿戴，投影 + 语音
- **定价**：
  - 首发价：待核实
  - 现价：—（已停售）
  - MSRP：待核实
  - 历史价：约 $499 USD（原卡「历史公开价」）
  - 订阅：约 $24/月（历史公开价）
…
- **关键差异化（教训）**：① 强制订阅；② 强云依赖；③ 断服即变砖
```

非主品类只写一行，例如 04 文件中写：`- **另见**：Limitless Pendant〔已停售〕主卡见 [07 录音卡](./07-recorder.md)`

### 02-solution 小节

本节是规范；按此改现有文件放在第 6 批。

- 每个品类的 `02-solution.md` 都必须有三个 **H2** 小节，标题关键词要跟下面完全一致：`## N、接入步骤`、`## N、能力边界`、`## N、官方文档与 SDK 链接`（05 / 06 / 07 已经是这种写法）
- 要扩展到别的模型时，**不新建文件**：在 `02-solution.md` 的「能力边界」之前加 `## N、其他模型方案`，每个模型写一个 `### {模型名}`，按顺序写：方案定位 → 链路差异 → 核心组件 → 接入步骤 → 能力边界 → 官方文档链接。跨品类的通用内容写到 `solutions/by-solution/0X-*.md`
- **第 6 批的覆盖范围**：
  - 04 / 08 / 09：新增三节
  - 03：新增 `## N、接入步骤`（现在只有「接入前置」和「场景包接入」）
  - 01：三节现在都是 H3，改成 H2
  - 02：`### 1.2 接入步骤` 是 H3，也要改成 H2（H2 规则带出来的）
