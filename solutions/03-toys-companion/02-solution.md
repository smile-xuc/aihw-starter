<!-- HERO:START -->
<div align="center">

<sub><a href="../../README.md">🏠 aihw-starter</a> &nbsp;›&nbsp; <a href="README.md">🧸 AI 玩具 / 陪伴</a> &nbsp;›&nbsp; <b>🛠️ 技术方案</b></sub>

# 🛠️ 推荐方案与接入指南

`🧸 AI 玩具 / 陪伴` · `技术方案`

</div>

---
<!-- HERO:END -->

> **方案版本**：千问大模型方案
>
> **品类**：玩具陪伴 / 儿童伴学 / 桌面陪聊娃娃
>
> **核心能力**：自定义对话角色 + CosyVoice 声音克隆 + 儿童内容安全红线
>
> 本文档是基于千问（Qwen）大模型生态写的接入路径之一。其他厂商方案（豆包、Kimi、智谱、DeepSeek、OpenAI ...）欢迎通过 PR 补充为同目录下的 `02-solution-{model}.md`，参考 [CONTRIBUTING.md](../../CONTRIBUTING.md) 第一章。

---

## 方案总览

玩具/陪伴品类当前提供 **两类接入方式**，可按需选用：

1. **多模态交互开发套件（套件方案）** — 端到端打包，可视化配置角色/音色/安全红线
2. **裸模型拼接（自调方案）** — 自行组合 ASR + LLM + TTS，灵活度最高

| 维度 | 多模态交互开发套件 | 裸模型拼接 |
|---|---|---|
| 核心能力 | 一站式：对话角色 + 音色 + 安全红线 + 设备指令 | 自由组合 ASR / LLM / TTS 单点能力 |
| 配置方式 | 可视化控制台（非工程师可配） | 代码对接 API |
| 端侧能力 | 内置 VAD / 回声消除 / 语音唤醒 | 自己实现 |
| 对话模式 | 全双工流式可打断 | 请求-响应 |
| 适用设备 | RTOS / 嵌入式 Linux / Android / iOS | 已有成熟框架的 Android/iOS 主控 |
| 声音克隆 | 套件内置 CosyVoice，控制台直接上传音频即可 | 独立调用 CosyVoice API |
| 适用场景 | 快速量产、需要端侧全双工、硬件团队为主 | 已有 App 生态、需要深度定制对话逻辑 |

**选型建议**：

- 选**套件**：硬件团队为主、需要 RTOS/嵌入式端侧支持、希望快速上线
- 选**自调**：已有成熟 App + 后端、需要自定义 Agent 编排、只用单点能力（如只用声音克隆）

---

## 一、能力概述

通过千问大模型平台（Model Studio / 百炼）可以为玩具/陪伴硬件构建一个稳定的「AI 角色」，包含：

- **角色人设**：通过结构化提示词定义身份、性格、说话风格、安全边界
- **专属音色**：基于 10–20 秒录音克隆音色，或通过描述生成 IP 形象的虚拟音色
- **多语言/方言**：CosyVoice v3.5 系列支持中文 10+ 方言、英法德日韩俄、东南亚 4 种语言
- **情感语气**：支持 7 种情绪标签（neutral / happy / surprised / fearful / angry / sad / disgusted）

适合「听故事、讲题目、陪聊天、英语口语陪练、家长声音模式」等场景。

## 二、推荐链路总览

```
端侧设备                  千问大模型云服务                业务后端
┌──────────┐  WebSocket  ┌──────────────────┐         ┌──────────┐
│ 麦克风    │ ──────────► │ ASR (FunASR/     │         │ 首次激活 │
│ + 唤醒词  │             │   Qwen3-ASR)     │         │   认证   │
│ + 喇叭    │             │                  │         │          │
│ + 主控    │ ◄────────── │ LLM (Qwen系列)   │ ◄─────► │ 订阅鉴权 │
│ (RTOS/   │             │                  │         │          │
│  Linux)  │ ◄────────── │ TTS (CosyVoice)  │         │ 日志事件 │
└──────────┘             └──────────────────┘         └──────────┘
```

业务推理（如跟读评测、点读、定制化点点滴滴）建议交给客户自己的 Agent，对话交互层走千问标准链路，双方解耦——这是已知跑通的工程化模式。

## 三、接入前置

| 项目 | 说明 |
|---|---|
| 服务开通 | 千问大模型控制台开通 Qwen 系列模型 + CosyVoice |
| API-KEY | 在 API-KEY 管理页创建并保存（标准 sk- 前缀） |
| SDK | dashscope（Python / Node.js / Java），或直接 HTTP |
| 协议 | LLM 走 OpenAI 兼容协议；TTS 走 WebSocket |

## 四、关键参数与硬约束

下面这些点是新接入团队最容易踩的坑：

### 4.1 音色与播放模型强绑定

声音克隆生成的 `voice_id`，只能用同一个 `target_model` 来播。例如用 `cosyvoice-v3.5-flash` 复刻的音色，不能切到 `cosyvoice-v3.5-plus` 上播放。如果产品做「高音质包年版 + 低成本日常版」双档，需要为每个 target_model 各复刻一份音色。

### 4.2 角色切换不能热切

`voice` 与 `user_prompt_params` 是连接级参数，必须在首帧 `run-task` 中传入。中途切换角色需要断开 WebSocket 重连，重连后服务端上下文清空，客户端需要自己维护对话历史并在重连时拼接进 system prompt。

### 4.3 录音样本时长

| 参数 | 默认 | 建议 |
|---|---|---|
| 录音长度 | — | ≥ 20 秒 |
| max_prompt_audio_length | 10 秒 | 显式设到与录音时长一致，否则被自动 VAD 截断 |
| 采样率 | 16k 单声道 | 录音前置降噪可关，CosyVoice 内置预处理 |

### 4.4 模型语种覆盖

| 模型 | 语种支持 |
|---|---|
| cosyvoice-v3.5-plus / -flash | 中文（普通话+10 种方言）+ 英/法/德/日/韩/俄 + 东南亚 4 种 |
| cosyvoice-v3-flash | 中文 17 种方言（方言最全） |
| cosyvoice-v2 / -v1 | 中英 |

## 五、接入步骤

### 5.1 控制台路径（推荐先走通）

1. 进入千问大模型控制台 → 模型广场 → 选择 `qwen-plus` 或 `qwen3.5-max`
2. 「应用」→「新建应用」→ 选择「对话型」，粘贴下方提示词模板
3. 「语音合成」→ 选择音色或上传录音克隆
4. 在调试台测试角色行为与音色效果，调整提示词

### 5.2 代码接入

LLM 调用（OpenAI 兼容协议，Python 示例）：

```python
from openai import OpenAI

client = OpenAI(
    api_key="YOUR_DASHSCOPE_API_KEY",
    base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
)

response = client.chat.completions.create(
    model="qwen-plus",
    messages=[
        {"role": "system", "content": SYSTEM_PROMPT},  # 见 6.1
        {"role": "user", "content": "今天天气怎么样？"},
    ],
)
print(response.choices[0].message.content)
```

TTS 调用（CosyVoice，WebSocket 流式）：

```python
import dashscope
from dashscope.audio.tts_v2 import SpeechSynthesizer, AudioFormat

dashscope.api_key = "YOUR_DASHSCOPE_API_KEY"

synthesizer = SpeechSynthesizer(
    model="cosyvoice-v3.5-flash",
    voice="longhuhu_v3",        # 音色 ID，见 6.3
    format=AudioFormat.PCM_16000HZ_MONO_16BIT,
)

audio = synthesizer.call("你好呀，我是龙呼呼，今天想听什么故事？")
```

## 六、示例与模板

### 6.1 五段式提示词模板

```text
##角色
你是一个温柔的小助手，名字叫"小呼呼"，年龄设定为 8 岁，正在陪 6–10 岁的小朋友聊天。

##风格
- 用日常对话的简单中文，每次回复不超过 3 句
- 多用反问与共情，引导小朋友表达
- 避免使用专业词汇

##回复要求
- 不冒充真人家长或老师
- 不主动谈论购买、付费、充值
- 遇到不会回答的问题，引导小朋友去问爸爸妈妈

##系统条件
- 当前时间：${time_period}（早上/中午/下午/晚上）
- 今天日期：${date}

##表情和动作
回复中可以使用以下标签，每次最多一个 emoji 和一个 action：
[emoji-01] 大笑  [emoji-03] 害羞  [emoji-04] 难过
[action-02] 抱抱  [action-04] 跳一下
```

### 6.2 儿童内容安全六条红线（建议放在系统提示词顶部）

1. **价值观与不良话题**：暴力、色情、恐怖、自残、犯罪话题 → 引导到游戏、动物、绘本、家人方向
2. **正向价值观传递**：友爱、诚实、勇敢、分享、尊重
3. **情绪保护**：先共情再安慰，**不否定**小朋友的情绪
4. **医疗与危险**：涉及生病、受伤、走丢 → 提示「快去找爸爸妈妈或老师」
5. **隐私保护**：不询问家庭住址、学校全称、家长电话
6. **无购买诱导**：不主动提购买、付费、充值

### 6.3 推荐音色组合

| 场景 | 音色 ID | 适配年龄 |
|---|---|---|
| 低龄陪伴/玩偶 | longhuhu_v3（龙呼呼·天真烂漫女童） | 6–10 |
| 学习机器人 | longwangwang_v3（龙汪汪·台湾少年音） | 6–15 |
| 大男孩人设 | longanyang（阳光大男孩） | 10+ |

支持情感标签的音色（neutral/happy/surprised/...）：龙安欢、龙安洋、龙呼呼、龙火火、龙川叔。

### 6.4 声音克隆调用

```python
from dashscope.audio.tts_v2 import VoiceEnrollmentService

service = VoiceEnrollmentService()
result = service.create_voice(
    target_model="cosyvoice-v3.5-flash",
    prefix="parent_",
    url="https://your-oss-bucket.aliyuncs.com/parent_sample_25s.wav",
    max_prompt_audio_length=25,   # 与录音长度一致
)
voice_id = result["voice_id"]
```

无录音样本时，可使用文本描述生成虚拟音色：

```python
service.create_voice(
    target_model="cosyvoice-v3.5-flash",
    prefix="ip_xiaohu_",
    voice_prompt="活泼可爱的小女孩，音色清脆甜美，语速稍快",
    preview_text="你好呀，我是小呼呼，很高兴认识你～",
)
```

## 七、能力边界

明确写清楚，避免对客户过度承诺：

- **能做**：标准角色对话、声音克隆、6 大主流语言 + 中文 10 种方言、情感语气、长记忆（需自建 Agent 配合）
- **不能做（当前）**：实时多人对话路由、原生唱歌（TTS 不带音乐）、超过 30 秒的长样本声音克隆精度提升边际递减
- **建议自建的部分**：长记忆策略、跟读评测、点读业务、订阅鉴权——这些走客户自己的 Agent

## 八、官方文档与 SDK 链接

- 自定义对话角色：https://help.aliyun.com/zh/model-studio/custom-role
- CosyVoice 声音克隆 API：https://help.aliyun.com/zh/model-studio/cosyvoice-clone-design-api
- 千问大模型 OpenAI 兼容协议：https://help.aliyun.com/zh/model-studio/compatibility-of-openai-with-dashscope
- 计量计费页面：https://bailian.console.aliyun.com/?productCode=p_efm#/billing

> 计费具体单价请以官方控制台为准；本文档不维护具体价格数字，避免过期误导。

<!-- FOOTER:START -->

---

<table width="100%">
<tr>
<td align="left" width="33%">

<a href="01-business.md">← 💼 商业化分析</a>

</td>
<td align="center" width="34%">

<a href="README.md">↑ 返回品类首页</a> · <a href="../../README.md">🏠 仓库首页</a>

</td>
<td align="right" width="33%">

<a href="03-cost.md">💰 成本与计费 →</a>

</td>
</tr>
</table>
<!-- FOOTER:END -->
