<!-- HERO:START -->
<div align="center">

<sub><a href="../README.md">🏠 aihw-starter</a> &nbsp;›&nbsp; <a href="README.md">📚 AI 通识</a> &nbsp;›&nbsp; <b>04 Token 与计费</b></sub>

# 04 · Token 与计费：一次对话到底花多少钱

`AI 通识` · `Token & Billing`

</div>

---
<!-- HERO:END -->

> **本篇回答**：一次对话到底花多少钱？输入 / 输出 / 缓存 / 音频 token 怎么算？为什么「同传一小时」和「聊五句」不是同一套账？
>
> 本篇单价均为**量级示意**，用于建立算账直觉；具体数字以官方计费页为准，禁止把某月活动价当成标准价。

## 〇、先建立直觉：Token ≠ 字

大模型不按「字」或「秒」直接收费（多数文本模型），而是把内容切成 **token**（子词单元）再计费。对硬件从业者，先记住三条量级直觉：

| 直觉 | 量级 | 说明 |
|---|---|---|
| 中文 | **约 1 token ≈ 0.7 字**（或反过来：约 1.5 token / 字） | 品类测算里常用；精确值随分词器与标点变化 |
| 英文 | 约 1 token ≈ 0.75 词 | 单词常被拆成多片 |
| 价格结构 | **输入便宜、输出贵** | 常见输出单价是输入的数倍；思考链 / max 档再贵一截 |

类比：token 是「加油站的升」，不是「公里数」。同样说五句话，带长 system prompt、多轮历史、图片或音频时，「加了多少升」完全不同——所以同传一小时和玩具闲聊五句，账单形态差一个数量级以上。

> 官方入口（仓库默认方案）：[百炼模型价格](https://help.aliyun.com/zh/model-studio/model-pricing) · [计费说明](https://help.aliyun.com/zh/model-studio/billing-of-model-studio)

## 一、计费解剖：钱花在哪几块

### 1.1 文本：输入 vs 输出 vs 档位

| 维度 | 计什么 | 硬件侧含义 |
|---|---|---|
| **输入 token** | system / 用户话 / 历史轮次 / 工具结果 / 注入的记忆摘要 | 每多一轮历史，整段通常**再计一遍输入** |
| **输出 token** | 模型生成的回复（含动作标签、JSON） | 话痨设定、长故事、强制长思考会抬高输出 |
| **思考 / max 档** | 更深推理或旗舰模型 | 单价与阶梯往往更高；适合按需路由，不适合每轮默认 |
| **阶梯计费** | 部分模型按「单次请求输入总量」分档抬价 | 长文档一次塞满，可能整单跳到更贵档 |

### 1.2 缓存（prompt / 上下文缓存）

多厂商对**可复用前缀**（长 system、工具定义、固定知识块）提供缓存折扣。公开规则量级（2026 核对，以各家文档为准）：

| 机制 | 常见规则量级 | 来源 |
|---|---|---|
| 百炼显式缓存 | 创建约 **125%** 标准输入价；命中约 **10%** | [百炼模型价格 · 上下文缓存说明](https://help.aliyun.com/zh/model-studio/model-pricing) |
| Anthropic prompt cache | 写入约 **1.25×～2×**；读取约 **0.1×** | [Claude Prompt caching](https://platform.claude.com/docs/en/build-with-claude/prompt-caching) |
| OpenAI prompt cache | 命中可至约 **0.1×** 输入价（写费因模型代际而异） | [OpenAI Prompt caching](https://developers.openai.com/api/docs/guides/prompt-caching) |

产品含义：把**不变的前缀**放前、**变的用户内容**放后，才能打中缓存；时间戳、设备 ID 塞进前缀会把命中率打穿。

### 1.3 多模态：图与音频不是「附赠」

| 模态 | 常见折算 | 注意 |
|---|---|---|
| **图片 / VL** | 按分辨率 tile 或像素折算 token（如 IPC Caption：低分辨率图可到数百 token/张量级） | 抽帧张数 × 分辨率直接决定账单；见 [01-ipc/03-cost](../solutions/by-category/01-ipc/03-cost.md) |
| **Realtime / Omni 音频** | 音频按时长折成 audio token，再乘音频单价 | **进入上下文的音频即计费**；静默若不挡在 VAD 外也会烧钱 |
| **Livetranslate 同传** | Qwen3.5：输入约 **7 tokens/秒**，输出约 **12.5 tokens/秒**（代际会变；旧版曾双向 12.5） | 规则见[实时语音翻译文档](https://help.aliyun.com/zh/model-studio/qwen3-5-livetranslate-flash-realtime)；品类落点见 [06-ai-earphone/03-cost](../solutions/by-category/06-ai-earphone/03-cost.md) |

另有一类「三段式」：ASR 按时长 + LLM 按文本 token + TTS 按字符/时长——和 Realtime「进上下文即计费」是两套账，对照见 [Omni Realtime · 计费结构](../solutions/by-solution/01-qwen/omni-realtime/README.md)。

## 二、三类硬件常见账单形态

> 下表只比**结构**，不写死单价。

| 形态 | 典型品类 | 主导成本因子 | 容易低估的项 |
|---|---|---|---|
| **文本对话** | 玩具闲聊、桌宠标签 | 日均轮次 ×（历史长度 + 输出长度）× 模型档 | system + 多轮回放、emoji/动作标签占 token |
| **音频 Realtime / 同传** | AI 耳机 Livetranslate、旗舰全双工 | **有效音频秒数** × tokens/秒 × 音频单价 | 双向满负荷、源语言转写文本、弱网重传重计 |
| **视觉 Caption / VL** | IPC 抽帧、伴学拍照问答 | 触发次数 ×（prompt + 图 token）× 输入/输出单价 | 高清多图、长 prompt、失败重试 |

「聊五句」≈ 文本表；「同传一小时」≈ 音频表。用文本单价去估同传，会低估一个数量级。

## 三、一次会话怎么估

模板（各模态分别算再相加）：

```
费用 ≈ Σ( 该模态用量 × 该模态对应单价量级 )

文本会话更具体一点：
  输入 ≈ system + 工具定义 + 注入记忆 + Σ(历史轮次) + 本轮用户话
  输出 ≈ 本轮生成（含标签 / 思考）
  费用 ≈ 输入×输入单价 + 输出×输出单价
        + 缓存创建/命中差额（若启用）
```

三条实务提醒：

1. **系统提示 + 历史会反复计入输入**——不是「只付最新一句」。
2. **先估用量再套单价**；单价链官方页，用量用日志里的 `usage` 校准。
3. **Batch / 夜间档 / 免费额度**只写进敏感性分析，不写进「标准毛利」。

玩具侧单次 150–500 token、日均次数决定年费的落点：[03-toys-companion/03-cost](../solutions/by-category/03-toys-companion/03-cost.md)；桌宠同类：[05-desktop-pet/03-cost](../solutions/by-category/05-desktop-pet/03-cost.md)。方案总览入口：[千问方案 · 典型 BOM 与计费](../solutions/by-solution/01-qwen/README.md)。

## 四、省钱杠杆清单（产品可决策）

| 杠杆 | 做什么 | 牺牲什么 |
|---|---|---|
| 关长期记忆 / 知识库 / 联网 | IPC Caption 默认关；减少固定注入 | 「记得你」与检索能力 |
| 缩上下文 | 轮次上限、主动摘要替换全文回放 | 远期细节 |
| flash vs plus/max | 闲聊走 flash，难题再升档 | 复杂题正确率 |
| 端侧预筛少上传 | VAD、事件检测、抽帧降分辨率 | 漏检风险 |
| 稳定可缓存前缀 | 固定 instructions 前置 | 前缀工程约束 |
| 异步离线摘要 | 日批用小模型，不堵实时链路 | 非实时一致性 |
| 场景分流 | 同传/Realtime 与三段式各走各的 | 两套宿主复杂度 |

与 [03 · KV Cache](./03-kv-cache-quantization.md) 的交叉：更长 context = 更厚草稿纸 = **更多计费输入**；本篇只点到账，物理公式见 03。与 [02 · 规格与芯片](./02-model-size-chips.md) 的交叉：端上跑得动才少付云 token。

## 五、对本仓库各品类意味着什么

| 品类 | 意味着什么 | 详见 |
|---|---|---|
| 📷 IPC | VL / Agent 按 token；OSS 内容感知是另一套「文件/时长」账，勿混算 | [01-ipc/03-cost](../solutions/by-category/01-ipc/03-cost.md) |
| 🎧 AI 耳机 | 同传按音频 token 规则；时长包与「有效分钟」定义决定毛利 | [06-ai-earphone/03-cost](../solutions/by-category/06-ai-earphone/03-cost.md) |
| 🎙️ 录音卡 | ASR 时长 + 纪要 LLM；与耳机同传配额分开计量 | [07-recorder/03-cost](../solutions/by-category/07-recorder/03-cost.md) |
| 🧸 玩具 / 🪴 桌宠 | 日均次数 × flash 档是走量路线年费锚点；摘要日批通常远小于对话费 | [03](../solutions/by-category/03-toys-companion/03-cost.md) · [05](../solutions/by-category/05-desktop-pet/03-cost.md) |
| 🤖 Agent / Realtime | 「进上下文即计费」；宿主裁上下文、场景分流决定能不能卖订阅 | [Omni Realtime](../solutions/by-solution/01-qwen/omni-realtime/README.md) |

## 六、给 AI 硬件从业者的检查清单

谈合同时问清：

1. **计费维度**：文本 token / 音频 token / 时长 / 次 / 文件数——是否混用、是否分账本
2. **免费额度与阶梯**：开通赠送、输入长度跳档、Batch 是否与缓存互斥
3. **失败与重试**：超时重试、客户端重复提交是否二次计费
4. **音频静默**：VAD 在端还是在云；静默段是否进上下文
5. **usage 字段**：能否拿到 `input` / `output` / `cached_tokens` 做对账与告警

---

**更新日期**：2026-09
**贡献欢迎**：口径修正或新公开规则补充，请提 PR，详见 [`CONTRIBUTING.md`](../CONTRIBUTING.md)

<!-- FOOTER:START -->

---

<table width="100%">
<tr>
<td align="left" width="33%">

<a href="./03-kv-cache-quantization.md">← 03 KV Cache 量化</a>

</td>
<td align="center" width="34%">

<a href="README.md">↑ 返回板块首页</a> · <a href="../README.md">🏠 仓库首页</a>

</td>
<td align="right" width="33%">

<a href="./05-distillation.md">05 蒸馏 →</a>

</td>
</tr>
</table>
<!-- FOOTER:END -->
