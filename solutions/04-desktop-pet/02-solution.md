<!-- HERO:START -->
<div align="center">

<sub><a href="../../README.md">🏠 aihw-starter</a> &nbsp;›&nbsp; <a href="README.md">🪴 桌宠</a> &nbsp;›&nbsp; <b>🛠️ 技术方案</b></sub>

# 🛠️ 推荐方案与接入指南

`🪴 桌宠` · `技术方案`

</div>

---
<!-- HERO:END -->

> **方案版本**：千问大模型方案（首发版）
>
> **品类**：桌宠 / 桌面陪伴机器人 / 机械桌宠 / 智能毛绒（带屏与动作反馈）
>
> **核心能力**：动作情绪标签 + 情感 TTS 三路同步
>
> 本文档基于千问（Qwen）大模型生态。其他厂商方案欢迎通过 PR 补充为 `02-solution-{model}.md`，参考 [CONTRIBUTING.md](../../CONTRIBUTING.md) 第一章。

---

## 方案总览

桌宠品类的核心诉求是「语音 + 表情 + 动作」三路同步输出。根据动作协议复杂度，提供 **三种接入方案**：

1. **方案 C · 标签嵌入式（推荐）** — token 最省，端侧好解析，桌宠/毛绒首选
2. **方案 A · 标准 JSON** — 字段清晰、解析稳，适合多自由度机械臂
3. **方案 B · 自然语言 + 特殊符号** — 流式 TTS 最快，适合工业/服务机器人

| 维度 | 方案 C · 标签嵌入式 | 方案 A · 标准 JSON | 方案 B · 自然语言符号 |
|---|---|---|---|
| 输出格式 | `[emoji-01][action-01]哎呀` | `{"action_query":[...],"response":"..."}` | `["举右",2],["抓取","苹果"]。我将…` |
| Token 消耗 | 最低 | 中 | 中 |
| 流式 TTS | 支持（去标签后直出） | 需等完整 JSON | 最快 |
| 端侧解析 | 简单正则 | JSON 反序列化 | 自定义分隔符 |
| 适用设备 | 桌宠/毛绒/AI 眼镜 | 多自由度机械臂、复杂参数 | 工业/服务机器人 |

**选型建议**：

- 桌宠/毛绒类 → 选**方案 C**（每次回复最多 1 个 emoji + 1 个 action）
- 多自由度机器人 → 选**方案 A**
- 已有动作协议的工业设备 → 选**方案 B**

---

## 一、能力概述

桌宠/毛绒类硬件的特点是除了语音回复之外，还需要驱动屏幕表情、马达动作、RGB 灯光等多路输出。本方案的核心是让 LLM 在一次推理中同时输出「说什么」+「做什么动作」+「什么情绪」，并配合情感 TTS 实现「动作、情绪声、屏幕表情」三路同步。

支持三种输出格式：

| 方案 | 形态 | 优点 | 适用 |
|---|---|---|---|
| A. 标准 JSON | `{"action_query":[...],"response":"..."}` | 字段清晰、解析稳 | 多自由度机械臂、复杂参数 |
| B. 自然语言+特殊符号 | `["举右",2],["抓取","苹果"]。我将……` | 流式 TTS 最快 | 工业/服务机器人 |
| C. 标签嵌入式 | `[emoji-01][action-01]哎呀` | token 最省，端侧好解析 | 桌宠/毛绒/AI 眼镜推荐 |

桌宠/毛绒类**推荐方案 C**，每次回复最多输出 1 个 emoji + 1 个 action。

## 二、推荐链路总览

```
端侧（屏 + 舵机 + RGB + 麦克风）
        │
        │ WebSocket 流式
        ▼
千问 LLM（一次推理输出 文本 + emoji + action + emotion）
        │
        ├─► 文本流 → 标签解析器 → 触发屏幕表情、舵机动作、RGB
        │
        └─► 文本（去标签后）+ emotion → 情感 TTS（CosyVoice v3-plus/flash）
```

## 三、接入前置

| 项目 | 说明 |
|---|---|
| 服务开通 | 千问大模型控制台开通 Qwen 系列 + cosyvoice-v3-plus 或 cosyvoice-v3-flash（情感 TTS） |
| API-KEY | 标准 sk- 前缀 |
| SDK | dashscope（Python/Node.js/Java），TTS 走 WebSocket |
| 端侧 | 屏幕、舵机/马达、RGB 任一组合，需固件层做标签解析 |

## 四、关键参数与硬约束

### 4.1 标签解析必须流式做

LLM 输出是 token 流，标签 `[emoji-01]` 可能跨多个 token 才完整。客户端需要在收到完整标签后再触发动作，否则会出现「还没说完话就先动了」的错位。

### 4.2 标签数量限制

每次回复建议最多 1 个 emoji + 1 个 action。否则 LLM 会倾向于堆叠标签，端侧动作排队执行体验变差。

### 4.3 情绪 TTS 适配音色

cosyvoice-v3-plus / cosyvoice-v3-flash 支持 7 种情绪。但只有部分音色支持情感参数：龙安欢、龙安洋、龙呼呼、龙火火、龙川叔。其他音色传入情绪参数会被忽略。

### 4.4 安全兜底

用户表达自伤、暴力意图时，强制走 neutral 语气，避免 TTS 念出愤怒/悲伤的不当播报。这条建议直接写入系统提示词。

## 五、接入步骤

### 5.1 设计阶段

1. 列出硬件支持的所有「动作」和「表情」，编号（如 `action-01` 到 `action-10`）
2. 制定标签到端侧执行的映射表（见 6.1）
3. 在系统提示词中明确告知 LLM 可用标签集

### 5.2 开发阶段

1. LLM 调用使用流式输出（`stream=True`）
2. 在 token 流上跑标签解析器，标签触发端侧动作，剩余文本送 TTS
3. TTS 调用根据 LLM 输出的情绪标签设置 `emotion` 参数

### 5.3 联调阶段

- 端侧设置动作最大时长（防堵转）
- 同标签设最小冷却（默认 1 秒，防抖动）
- 表情持续到下一句话开始

## 六、示例与模板

### 6.1 标签映射表（写入固件）

| 标签 | 屏幕 | 马达 | RGB |
|---|---|---|---|
| `[emoji-01]` 大笑 | 弯眼笑脸 | 头部点动 2 次 | 暖黄呼吸 |
| `[emoji-03]` 害羞 | 红脸蛋闭眼 | 头部左右轻摆 | 粉色慢闪 |
| `[emoji-04]` 大哭 | 流泪动画 | 身体小幅抖动 | 蓝色低亮 |
| `[action-02]` 抱抱 | — | 双臂内合 | 粉红常亮 |
| `[action-04]` 跳一下 | — | 弹簧/舵机弹跳 | 闪烁 1 次 |

### 6.2 系统提示词片段

```text
##输出格式
你的每条回复，可以在文本中嵌入最多一个表情标签和一个动作标签：

可用表情：
[emoji-01] 大笑   [emoji-02] 微笑   [emoji-03] 害羞
[emoji-04] 难过   [emoji-05] 惊讶   [emoji-06] 生气

可用动作：
[action-01] 点头   [action-02] 抱抱   [action-03] 摇头
[action-04] 跳一下 [action-05] 转圈

输出格式示例：
[emoji-01][action-04]太棒啦！我们一起去玩吧～

##情绪
在文本最前面用 <M>xxx</M> 表示情绪，xxx 取自：
neutral / happy / surprised / fearful / angry / sad / disgusted

##安全
当用户提到自伤、暴力时，情绪强制为 neutral，引导到积极话题。
```

### 6.3 流式标签解析（Python，可移植到嵌入式）

```python
import re

PAT = re.compile(r'\[(emoji|action)-(\d{2})\]')
EMOTION_PAT = re.compile(r'<M>(\w+)</M>')

def stream_handler(token_stream, screen, motor, tts):
    buf = ""
    emotion = "neutral"
    emotion_set = False

    for token in token_stream:
        buf += token

        if not emotion_set:
            m = EMOTION_PAT.search(buf)
            if m:
                emotion = m.group(1)
                emotion_set = True
                tts.set_emotion(emotion)
                buf = EMOTION_PAT.sub('', buf)

        for m in PAT.finditer(buf):
            kind, code = m.group(1), m.group(2)
            if kind == "emoji":
                screen.play(f"emoji_{code}")
            else:
                motor.enqueue(f"action_{code}")

        clean = PAT.sub('', buf)
        tts.feed(clean)
        buf = ""
```

### 6.4 情感 TTS 调用

```python
from dashscope.audio.tts_v2 import SpeechSynthesizer, AudioFormat

synthesizer = SpeechSynthesizer(
    model="cosyvoice-v3-plus",
    voice="longhuhu",
    format=AudioFormat.PCM_16000HZ_MONO_16BIT,
    extra_params={"emotion": "happy"},  # 7 种情绪可选
)
audio = synthesizer.call("今天天气真好呀～")
```

## 七、能力边界

- **能做**：单次推理同时输出文本 + 表情 + 动作 + 情绪四路；端侧并行驱动
- **不能做（当前）**：复杂多自由度机械臂连续轨迹（建议走 JSON 格式 + 客户自建运动规划层）
- **建议自建的部分**：动作连贯性平滑（IK 解算、舵机加速度限制）、长期人格一致性（走客户 Agent 的长记忆）

## 八、官方文档与 SDK 链接

- 动作情绪控制实践：https://help.aliyun.com/zh/model-studio/action-emotion-control-practice
- CosyVoice 情感 TTS：https://help.aliyun.com/zh/model-studio/cosyvoice-clone-design-api
- 千问大模型计费页面：https://bailian.console.aliyun.com/?productCode=p_efm#/billing

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
