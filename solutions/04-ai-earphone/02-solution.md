# 02 · 推荐方案与接入指南（千问大模型版）

> **方案版本**：千问大模型方案（首发版）
> **品类**：AI 翻译耳机 / AI 对话耳机 / AI 转写耳机 / AR 翻译眼镜 / 跨语言对讲机
> **核心能力**：Qwen3.5-Livetranslate 实时语音翻译 + 三段拼接对话方案
>
> 本文档基于千问（Qwen）大模型生态。其他厂商方案欢迎通过 PR 补充为 `02-solution-{model}.md`。

---

## 一、能力概述

`qwen3.5-livetranslate-flash-realtime` 是专为同传/直播翻译设计的端到端 S2S 模型，相比「ASR + LLM + TTS」拼接方案延迟更低、输出更连贯。

- **语言覆盖**：60 种语言，其中 29 种支持音频输出，31 种仅文本
- **接入协议**：WebSocket 实时流式
- **典型延迟**：约 3 秒（包含语义积累 + 网络）
- **使用模式**：单向同传（A 说话→B 听翻译）或双向对讲

适合做：会议同传耳机、跨境对讲机、旅游翻译耳机、直播实时字幕。

对于「AI 对话耳机」（语音助手 / 智能问答场景），推荐走 ASR + LLM + TTS 的三段拼接方案，体感响应更快；对于「AI 转写耳机」走 03-recorder 的 ASR + 摘要链路。

## 二、推荐链路总览

```
耳机/眼镜端
   │ PCM 音频流（独立线程）
   ▼
WebSocket 长连接 ─► qwen3.5-livetranslate-flash-realtime
   ▲
   │ 流式回调
   ├─ translation.text  → 字幕显示
   └─ translation.audio → 播报回放
```

## 三、接入前置

| 项目 | 说明 |
|---|---|
| 服务开通 | 千问大模型控制台开通 qwen3.5-livetranslate 系列 |
| API-KEY | 标准 sk- 前缀 |
| SDK | dashscope（Python/Node.js）或直接 WebSocket |
| 端侧 | 麦克风、扬声器、PCM 音频采集与播放能力 |

## 四、关键参数与硬约束

### 4.1 语言覆盖差异

| 类别 | 语言数 | 说明 |
|---|---|---|
| 音频输入 + 音频输出 | 29 | 主流语言 + 中文 5 种方言（普通话/四川/上海/北京/天津） |
| 仅文本输出 | 31 | 包括粤语等 |

**实操含义**：粤语场景如果做 AR 眼镜，需要走「关闭 TTS、改字幕」模式；要粤语语音输出可切回 `Qwen3-Livetranslate` 或 `Qwen3.5-Omni`。

### 4.2 Livetranslate vs Omni 对比

| 维度 | Livetranslate | Qwen3.5-Omni |
|---|---|---|
| 定位 | 同传/直播翻译 | 通用语音助手 |
| Function Calling | 不支持 | 支持 |
| 联网搜索 | 不支持 | 支持 |
| 输入模态 | 音频为主 | 文本/音频/图片/视频 |
| 语言覆盖 | 60 | 29 输出 + 7 中文方言 |

**选型建议**：
- 快速搭翻译应用 → Livetranslate
- 最高质量 + 最广覆盖 → Omni
- 成本敏感 → Omni-Flash

### 4.3 版本锁定

生产环境用日期版模型号，避免回归风险：

```
qwen3.5-livetranslate-flash-realtime-2026-05-19
```

非日期版会跟随线上最新版本，可能引入行为变化。

### 4.4 延迟特性

- Qwen3.5-Livetranslate：延迟约 3 秒
- 三段拼接（ASR+LLM+TTS）：首字 1.2–1.5 秒
- Livetranslate 比拼接慢，但翻译更准（要等更多上下文做语义判断）

不同场景的选型权衡：

| 场景 | 推荐 |
|---|---|
| 同传会议、专业翻译 | Livetranslate（准确优先） |
| 一般对讲、口语对话 | 三段拼接（响应快） |
| 多模态对话（看图/看视频翻译） | Qwen3.5-Omni |

## 五、接入步骤

### 5.1 控制台验证

1. 进入千问大模型控制台 → 模型广场 → 搜索 `qwen3.5-livetranslate-flash-realtime`
2. 在调试台传入测试音频，验证翻译质量
3. 切换源语言/目标语言，确认覆盖范围

### 5.2 代码接入（WebSocket）

```python
import dashscope
from dashscope.audio.qwen_translator import TranslationRealtimeCallback, TranslationRealtime

dashscope.api_key = "YOUR_DASHSCOPE_API_KEY"

class MyCallback(TranslationRealtimeCallback):
    def on_open(self):
        print("connection opened")

    def on_event(self, response):
        if response.type == "translation.text":
            print(f"text: {response.text}")
        elif response.type == "translation.audio":
            audio_player.play(response.audio)

translator = TranslationRealtime(
    model="qwen3.5-livetranslate-flash-realtime-2026-05-19",
    source_language="zh",
    target_language="en",
    callback=MyCallback(),
)
translator.start()

# 持续推送音频帧（独立线程，不要阻塞 WebSocket 回调）
for frame in mic_stream:
    translator.send_audio_frame(frame)

translator.stop()
```

### 5.3 接入注意

- WebSocket 连接初始化时设置好源/目标语言，中途切换需要断开重连
- 麦克风音频采集放在独立线程，避免阻塞 WebSocket 回调
- 对端无声时不要持续发空帧，浪费配额
- 客户端必须监听 `translation.text` 事件并实时上屏字幕；只监听 `.done` 事件会出现「文字慢于语音」错觉

## 六、示例与模板

### 6.1 中文方言降级表

| 方言 | 音频输出 | 文本输出 | 端侧策略 |
|---|---|---|---|
| 普通话 | ✓ | ✓ | 全功能 |
| 四川话 | ✓ | ✓ | 全功能 |
| 上海话 | ✓ | ✓ | 全功能 |
| 北京话 | ✓ | ✓ | 全功能 |
| 天津话 | ✓ | ✓ | 全功能 |
| 粤语 | ✗ | ✓ | 关 TTS、走字幕 |
| 其他方言 | ✗ | 部分 | 切 Qwen3-Livetranslate |

### 6.2 双向对讲伪代码

```python
# A 说中文，B 听英文；B 说英文，A 听中文
translator_a_to_b = TranslationRealtime(
    source_language="zh", target_language="en", ...
)
translator_b_to_a = TranslationRealtime(
    source_language="en", target_language="zh", ...
)

# 端侧：检测哪一端在说话（VAD），把音频路由到对应翻译器
def on_audio_frame(frame, side):
    if side == "A":
        translator_a_to_b.send_audio_frame(frame)
    else:
        translator_b_to_a.send_audio_frame(frame)
```

## 七、能力边界

- **能做**：60 种语言互译、5 种中文方言音频输出、双向同传、流式字幕
- **不能做（当前）**：自定义系统提示词（端到端模型）、私有化部署
- **建议自建的部分**：风格化翻译（商务/口语）需走 ASR + qwen-plus 翻译 + TTS 拼接方案

## 八、计费与成本对比

| 方案 | 计费方式 | 适用 |
|---|---|---|
| Livetranslate | 按音频时长 | 同传质量优先 |
| Omni-Realtime | 按 token | 多模态全双工 |
| 三段拼接 | 各自计费 | ASR 按时长、LLM 按 token、TTS 按字符 |

具体单价以千问大模型计费页面为准。

## 九、官方文档与 SDK 链接

- S2S 实时翻译模型：https://help.aliyun.com/zh/model-studio/s2s-model
- Qwen-Omni 多模态：https://help.aliyun.com/zh/model-studio/qwen-omni
- 计费页面：https://bailian.console.aliyun.com/?productCode=p_efm#/billing
