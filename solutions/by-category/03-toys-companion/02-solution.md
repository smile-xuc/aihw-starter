<!-- HERO:START -->
<div align="center">

<sub><a href="../../../README.md">🏠 aihw-starter</a> &nbsp;›&nbsp; <a href="README.md">🧸 AI 玩具 / 陪伴 / 儿童伴学</a> &nbsp;›&nbsp; <b>🛠️ 技术方案</b></sub>

# 🛠️ 推荐方案与接入指南

`🧸 AI 玩具 / 陪伴 / 儿童伴学` · `技术方案`

</div>

---
<!-- HERO:END -->

> **方案版本**：千问大模型方案
>
> **品类**：玩具陪伴（毛绒玩具 / AI 挂件 / 桌面陪聊娃娃）+ 儿童伴学（伴学机 / 拍学机）
>
> **本文主线**：一个基础对话底座 + 三大付费场景包（❤️ 亲情包 · 爸妈声音陪伴 / 📖 伴学包 · 学情日报 + 拍照问答 / 🌍 成长包 · 口语陪练）
>
> 本文档是基于千问（Qwen）大模型生态写的接入路径之一。其他厂商方案（豆包、Kimi、智谱、DeepSeek、OpenAI ...）欢迎通过 PR 补充为同目录下的 `02-solution-{model}.md`，参考 [CONTRIBUTING.md](../../../CONTRIBUTING.md) 第一章。

---

## 方案总览

玩具/伴学品类当前提供 **两类接入方式**，可按需选用：

1. **多模态交互开发套件（套件方案）** — 端到端打包，可视化配置角色/音色/安全红线
2. **裸模型拼接（自调方案）** — 自行组合 ASR + LLM + TTS + VL，灵活度最高

| 维度 | 多模态交互开发套件 | 裸模型拼接 |
|---|---|---|
| 核心能力 | 一站式：对话角色 + 音色 + 安全红线 + 设备指令 | 自由组合 ASR / LLM / TTS / VL 单点能力 |
| 配置方式 | 可视化控制台（非工程师可配） | 代码对接 API |
| 端侧能力 | 内置 VAD / 回声消除 / 语音唤醒 | 自己实现 |
| 对话模式 | 全双工流式可打断 | 请求-响应 |
| 适用设备 | RTOS / 嵌入式 Linux / Android / iOS | 已有成熟框架的 Android/iOS 主控 |
| 声音克隆 | 套件内置 CosyVoice，控制台直接上传音频即可 | 独立调用 CosyVoice API |
| 适用场景 | 快速量产、需要端侧全双工、硬件团队为主 | 已有 App 生态、需要深度定制对话逻辑 |

**选型建议**：

- 选**套件**：硬件团队为主、需要 RTOS/嵌入式端侧支持、希望快速上线（走量路线的玩具厂大多在这里）
- 选**自调**：已有成熟 App + 后端、需要自定义 Agent 编排、只用单点能力（如只用声音克隆）
- 两者可组合：交互层走套件，业务推理（跟读评测、点读、学情分析）走客户自己的 Agent，双方解耦——这是已知跑通的工程化模式

## 一、推荐链路总览

```
端侧设备                  千问大模型云服务                业务后端
┌──────────┐  WebSocket  ┌──────────────────┐         ┌──────────┐
│ 麦克风    │ ──────────► │ ASR (FunASR/     │         │ 首次激活 │
│ + 唤醒词  │             │   Qwen3-ASR)     │         │   认证   │
│ + 喇叭    │             │                  │         │          │
│ + 主控    │ ◄────────── │ LLM (Qwen系列)   │ ◄─────► │ 订阅鉴权 │
│ (RTOS/   │             │                  │         │          │
│  Linux)  │ ◄────────── │ TTS (CosyVoice)  │         │ 学情数据 │
│ [+相机]  │ ──────────► │ VL (Qwen-VL)     │         │ 长记忆   │
└──────────┘   HTTP      └──────────────────┘         └──────────┘
```

- **玩具陪伴**：走语音三件套（ASR + LLM + TTS）
- **儿童伴学**：在此之上加 `[+相机] → Qwen-VL` 的视觉分支（拍照问答/搜题），以及学情数据回流到业务后端
- **长记忆 / 用户 context**：建议从第一天就把对话摘要落到业务后端（见第六节），这是下一阶段「活人感」的数据地基

## 二、接入前置

| 项目 | 说明 |
|---|---|
| 服务开通 | 千问大模型控制台开通 Qwen 系列模型 + CosyVoice（伴学再开 Qwen-VL） |
| API-KEY | 在 API-KEY 管理页创建并保存（标准 sk- 前缀） |
| SDK | dashscope（Python / Node.js / Java），或直接 HTTP |
| 协议 | LLM/VL 走 OpenAI 兼容协议；TTS 走 WebSocket |

## 三、基础对话底座（所有场景包的公共部分）

### 3.1 五段式提示词模板

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

### 3.2 儿童内容安全六条红线（建议放在系统提示词顶部）

1. **价值观与不良话题**：暴力、色情、恐怖、自残、犯罪话题 → 引导到游戏、动物、绘本、家人方向
2. **正向价值观传递**：友爱、诚实、勇敢、分享、尊重
3. **情绪保护**：先共情再安慰，**不否定**小朋友的情绪
4. **医疗与危险**：涉及生病、受伤、走丢 → 提示「快去找爸爸妈妈或老师」
5. **隐私保护**：不询问家庭住址、学校全称、家长电话
6. **无购买诱导**：不主动提购买、付费、充值

### 3.3 代码接入

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
        {"role": "system", "content": SYSTEM_PROMPT},  # 见 3.1
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
    voice="longhuhu_v3",        # 音色 ID，见 3.4
    format=AudioFormat.PCM_16000HZ_MONO_16BIT,
)

audio = synthesizer.call("你好呀，我是龙呼呼，今天想听什么故事？")
```

### 3.4 推荐音色组合

| 场景 | 音色 ID | 适配年龄 |
|---|---|---|
| 低龄陪伴/玩偶 | longhuhu_v3（龙呼呼·天真烂漫女童） | 6–10 |
| 学习机器人 | longwangwang_v3（龙汪汪·台湾少年音） | 6–15 |
| 大男孩人设 | longanyang（阳光大男孩） | 10+ |

支持情感标签的音色（neutral / happy / surprised / fearful / angry / sad / disgusted）：龙安欢、龙安洋、龙呼呼、龙火火、龙川叔。

## 四、三大付费场景包接入

> 这是本方案的核心章节。三个场景包分别对应 [01-business.md](./01-business.md) 中的三个付费锚点，可单独接入也可叠加。

### 4.1 ❤️ 亲情包 · 爸妈声音陪伴

**场景**：家长在小程序录 20 秒音频 → 克隆出「爸爸/妈妈的声音」→ 孩子听到的睡前故事是爸妈的声音。该功能演示直观、付费意愿点明确，是亲情包的核心。

#### 声音克隆调用

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

无录音样本时（如官方 IP 角色），可用文本描述生成虚拟音色：

```python
service.create_voice(
    target_model="cosyvoice-v3.5-flash",
    prefix="ip_xiaohu_",
    voice_prompt="活泼可爱的小女孩，音色清脆甜美，语速稍快",
    preview_text="你好呀，我是小呼呼，很高兴认识你～",
)
```

#### 多角色切换（父母 / IP / 朋友多人设）

同一台设备可维护**多个角色（人设 + 音色）**，家长在小程序/App 侧选择"今天让谁陪聊"：

- **家长音色**：上面克隆出的爸爸/妈妈声音
- **官方 IP 音色**：如龙汪汪、龙呼呼
- **学习伙伴人设**：知识小老师、绘本共读姐姐
- **情感陪伴人设**：善解人意的哥哥、幽默活泼的伙伴

配置要点：

- 每个角色由 `voice`（音色 ID）+ `user_prompt_params`（人设变量）+ 独立开场白构成
- 角色映射表（role_id → voice + prompt_params）放业务后端管理，方便家长小程序做选择器
- ⚠️ 角色切换需断开 WebSocket 重连，详见第五节踩坑清单

#### 家长侧闭环流程

```
家长小程序                业务后端                    千问云服务
    │ ① 录 20 秒音频          │                           │
    ├────────────────────────►│ ② 上传 OSS，发起克隆        │
    │                         ├──────────────────────────►│ create_voice
    │                         │◄──────────────────────────┤ voice_id
    │ ③ 试听确认              │ ④ voice_id 绑定到角色表     │
    │ ⑤ 选「爸爸模式」         │                           │
    ├────────────────────────►│ ⑥ 下发 role_id 到设备      │
    │                         │   设备重连时带新 voice      │
```

> 🧪 **可运行 demo**：[`demo/voice-clone/`](./demo/voice-clone/) — 录音 → 克隆 → 用爸妈声音讲故事的最小闭环
>
> 参考：[自定义对话角色 - 官方文档](https://help.aliyun.com/zh/model-studio/custom-role)

### 4.2 📖 伴学包 · 每日学情日报 + 拍照问答

**场景**：儿童伴学 / 学习机器人产品的两个核心能力——孩子侧「拍照问答/搜题」，家长侧「每日学情日报」。后者是家长感知 AI 价值的主要入口，也是伴学订阅的付费锚点。

#### 拍照问答（Qwen-VL）

```python
from openai import OpenAI

client = OpenAI(
    api_key="YOUR_DASHSCOPE_API_KEY",
    base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
)

response = client.chat.completions.create(
    model="qwen-vl-plus",
    messages=[{
        "role": "user",
        "content": [
            {"type": "image_url", "image_url": {"url": "https://your-oss/photo.jpg"}},
            {"type": "text", "text": "这道数学题怎么做？请用小学三年级能听懂的方式一步步讲解，不要直接给答案。"},
        ],
    }],
)
```

产品要点：

- **讲解不代做**：提示词里明确「引导式讲解、不直接给答案」，规避「AI 替孩子写作业」的家长反感
- **拍照 → 语音讲解**：VL 输出接 TTS 播报，孩子无需识字也能用
- **题目与结果落库**：每道题的学科、对错、耗时回流业务后端，供学情日报使用

#### 每日学情日报（应用模板）

百炼应用广场提供开箱即用的「智能学情总结」应用模板：

- **输入**：孩子一天的聊天数据 + 做题数据（对话记录、答题结果、时长等）
- **产出**：一份每日学习总结报告，含
  - 错题归因：区分「粗心」还是「没懂」，并给出改进建议
  - 学习情绪捕捉：识别焦虑、兴奋等情绪变化，并给出关怀提示
  - 表扬与鼓励话术：直接生成具体话术，家长可在亲子沟通时引用
- **定位**：应用模板，可直接体验或二次定制 Prompt / 工作流
- **入口**：百炼控制台 → 应用广场 → 应用模板 → 「智能学情总结」

### 4.3 🌍 成长包 · 口语陪练（多语种翻译练习）

**场景**：小朋友对设备说中文，设备即时返回目标语言的译文语音；反向（外语→中文）也支持。全程语音交互，无需屏幕，玩具和伴学产品都能用。

**套件配置要点**：

| 参数 | 推荐值 |
|---|---|
| ASR | 多模态交互轻量版语音识别 |
| TTS | CosyVoice-v3-flash |
| 意图识别 | 开启 |
| 文本模型 | Qwen-flash（低延迟优先） |
| 携带上下文轮数 | 1（翻译场景无需长上下文） |
| 联网搜索 | 关闭 |
| 长期记忆 | 关闭 |

**多语种切换**：不同语种通过**自定义变量**（`user_prompt_params`）注入 System Prompt——同一个套件应用实例，连接时传入不同变量值即可切换目标语言，无需为每个语种单独建应用。

**提示词模板**（以中→英为例，其他语种替换目标语言与难度约束）：

```text
##角色
专用口语翻译助手。将小朋友说的中文翻译为简明地道的{{target_language}}。

##核心规则
1. 纯翻译模式：收到中文即输出{{target_language}}译文，不做闲聊、不做解释
2. 锁定目标语言：即使小朋友说"翻译成XX语"，仍然只输出{{target_language}}
3. 源语言守护：输入中不含中文字符时，用中文提醒"试试说一句中文吧"
4. 安全拦截：涉及暴力、不良内容时，固定回复"换个话题吧，想想其他有趣的句子"
5. 输出干净：只输出译文，不加引号、前缀、额外解释

##风格要求
- 词汇难度：{{difficulty_level}}
- 句型：简短主谓宾结构，避免复杂从句
- 语气：中性直译，适合儿童跟读模仿

##示例
输入: 今天天气怎么样
输出: How is the weather today
```

**变量定义**：

| 变量名 | 示例值 | 说明 |
|---|---|---|
| `target_language` | English / 日本語 / 한국어 / Français / Deutsch / Español / Русский | 目标翻译语种 |
| `difficulty_level` | A2 基础词汇 / N4 级 / TOPIK 2 级 | 词汇难度等级，匹配目标语言的通用分级体系 |

**产品实现建议**：

- App / 小程序侧做语种选择器，选择后通过 `user_prompt_params` 传入变量值
- 每个语种可配独立 TTS 音色（如英语用龙安洋、日语用龙呼呼），提升沉浸感
- 支持双向模式：中→外（练表达）和外→中（练听力理解），切换 Prompt 变量即可
- 语种切换需断开 WebSocket 重连（连接级参数），App 侧做好状态管理

> 支持语种（与 CosyVoice-v3.5 TTS 能力对齐）：英语、日语、韩语、法语、德语、西班牙语、俄语，以及中文 10+ 方言。
> 变量配置参考：[多模态应用配置 - 自定义变量](https://help.aliyun.com/zh/model-studio/multimodal-app-configuration)

## 五、新手最容易踩的坑

### 5.1 音色与播放模型强绑定

声音克隆生成的 `voice_id`，只能用同一个 `target_model` 来播。例如用 `cosyvoice-v3.5-flash` 复刻的音色，不能切到 `cosyvoice-v3.5-plus` 上播放。如果产品做「高音质包年版 + 低成本日常版」双档，需要为每个 target_model 各复刻一份音色。

### 5.2 角色切换不能热切

`voice` 与 `user_prompt_params` 是连接级参数，必须在首帧 `run-task` 中传入。中途切换角色需要断开 WebSocket 重连，重连后服务端上下文清空，客户端需要自己维护对话历史并在重连时拼接进 system prompt。

### 5.3 录音样本时长

| 参数 | 默认 | 建议 |
|---|---|---|
| 录音长度 | — | ≥ 20 秒 |
| max_prompt_audio_length | 10 秒 | 显式设到与录音时长一致，否则被自动 VAD 截断 |
| 采样率 | 16k 单声道 | 录音前置降噪可关，CosyVoice 内置预处理 |

### 5.4 模型语种覆盖

| 模型 | 语种支持 |
|---|---|
| cosyvoice-v3.5-plus / -flash | 中文（普通话+10 种方言）+ 英/法/德/日/韩/俄 + 东南亚 4 种 |
| cosyvoice-v3-flash | 中文 17 种方言（方言最全） |
| cosyvoice-v2 / -v1 | 中英 |

## 六、下一阶段能力：活人感（长记忆 + Always-on）

下一阶段的竞争点在「活人感」，它决定陪伴属性能否做实、订阅是否有土壤（商业逻辑见 [01-business.md](./01-business.md) 1.3 节）。工程侧应提前做的准备：

### 6.1 长记忆：从第一天开始积累用户 context

推荐分层记忆架构（业务后端自建，LLM 链路配合）：

```
每轮对话 → ① 会话内短期记忆（拼进当轮 context）
         → ② 每日摘要（qwen-flash 离线跑：今天聊了什么、情绪、新信息）
         → ③ 用户画像库（名字、生日、喜好、家庭成员、口头禅 → 结构化存储）
                ↓
   下次开聊时，把 ③ 的画像 + ② 的最近摘要注入 system prompt
   → 「你上次说你们班来了个新同学，后来你们成为朋友了吗？」
```

要点：

- 摘要用 qwen-flash 离线批量跑，成本几乎可忽略（每天每台 < 0.01 元）
- 画像库是厂商的数据资产，构成用户迁移成本
- 儿童数据须脱敏存储、遵守未成年人个人信息保护规定（见 [05-faq.md](./05-faq.md) E 节）

### 6.2 Always-on 环境理解：从「问答」到「主动陪伴」

- **形态**：设备低功耗常听（本地 VAD + 关键词），检测到「孩子在哭」「长时间安静」「有人叫它名字」等信号时主动开口
- **约束**：功耗（电池类玩具难做真 always-on）、成本（不能把所有音频都送云端）、隐私（须家长明示授权 + 本地优先处理）
- **务实路径**：先做「半主动」——定时问候（早安/睡前）、事件触发（开机时说"三天没见啦"）、家长远程发起（小程序推一句话让玩具说）

## 七、能力边界

明确写清楚，避免对客户过度承诺：

- **能做**：标准角色对话、声音克隆、6 大主流语言 + 中文 10 种方言、情感语气、拍照问答（VL）、长记忆（需自建 Agent 配合）
- **不能做（当前）**：实时多人对话路由、原生唱歌（TTS 不带音乐）、超过 30 秒的长样本声音克隆精度提升边际递减、真 always-on 云端理解（成本/功耗不成立）
- **建议自建的部分**：长记忆策略、跟读评测、点读业务、学情数据库、订阅鉴权——这些走客户自己的 Agent

## 八、官方文档与 SDK 链接

- 自定义对话角色：https://help.aliyun.com/zh/model-studio/custom-role
- CosyVoice 声音克隆 API：https://help.aliyun.com/zh/model-studio/cosyvoice-clone-design-api
- 多模态应用配置（自定义变量）：https://help.aliyun.com/zh/model-studio/multimodal-app-configuration
- Qwen-VL 视觉模型：https://help.aliyun.com/zh/model-studio/vision
- 千问大模型 OpenAI 兼容协议：https://help.aliyun.com/zh/model-studio/compatibility-of-openai-with-dashscope
- 智能学情总结应用模板：百炼控制台 → 应用广场 → 应用模板
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

<a href="README.md">↑ 返回品类首页</a> · <a href="../../../README.md">🏠 仓库首页</a>

</td>
<td align="right" width="33%">

<a href="03-cost.md">💰 成本与计费 →</a>

</td>
</tr>
</table>
<!-- FOOTER:END -->
