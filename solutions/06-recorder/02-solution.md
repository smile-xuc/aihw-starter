# 推荐方案与接入指南（千问大模型版）

> **方案版本**：千问大模型方案（首发版）
> **品类**：录音卡 / 智能会议盒子 / 智能笔 / 便携录音设备
> **核心能力**：ASR 转写 + 说话人分离 + 纪要 Agent
>
> 本文档基于千问（Qwen）大模型生态。其他厂商方案欢迎通过 PR 补充为 `02-solution-{model}.md`。

---

## 一、能力概述

录音类硬件的典型链路是：**录音 → 转写 → 说话人分离 → 摘要/决策/待办抽取 → 卡片化展示**。本方案提供从 ASR 到纪要 Agent 的完整工具链，支持文件转写和实时流式两种模式。

参考量级：1 小时音频，端到端 ¥1–4，2–5 分钟内出纪要。实时模式下首字延迟可控制在 500ms 内。

## 二、推荐链路总览

```
[设备录音] → [上传 OSS / 流式上传] → [ASR 转写]
                                          ↓
                                   [说话人分离]
                                          ↓
[录音卡 UI] ← [纪要 Agent 编排] ← [决策/待办抽取]
```

## 三、接入前置

| 项目 | 说明 |
|---|---|
| 服务开通 | 千问大模型平台开通 Paraformer 系列（ASR）+ Qwen 系列（摘要） |
| OSS | Paraformer-v2 文件版仅支持公网 URL，需要先上传到 OSS 或可访问 URL |
| API-KEY | 标准 sk- 前缀 |
| SDK | dashscope；纪要 Agent 可走「应用」配置，无需写代码 |

## 四、关键参数与硬约束

### 4.1 Paraformer-v2 仅支持公网 URL

不支持 Base64、二进制流、本地文件。需要先将音频上传到 OSS（推荐使用 STS 临时凭证生成 48 小时签名 URL），再调用 API。SDK 不支持 `oss://` 前缀，REST API 支持。QPS 限流 100。

### 4.2 实时 ASR 与文件 ASR 选型

| 模式 | 模型 | 适用 |
|---|---|---|
| 文件转写 | Paraformer-v2 | 录完一段后批量处理 |
| 实时流式 | Gummy / Paraformer-realtime | 边录边转，首字 < 500ms |

### 4.3 说话人分离

- 文件版可叠加 `--diarization` 参数，自动返回 `speaker_id`
- 实时版可走 fun-asr 流式 + CAM++ 后处理
- 准确率与录音质量强相关，多人混杂、背景噪音大的场景建议先做降噪

## 五、接入步骤

### 5.1 控制台路径（最快验证）

1. 进入千问大模型控制台 → 应用 → 模板库 → 选择「录音纪要 Agent」
2. 配置摘要风格、字段（决策/待办/关键数据）
3. 上传一段测试音频，对比纪要质量
4. 调通后导出 API 调用代码

### 5.2 代码接入

文件转写（Paraformer-v2）：

```python
import dashscope
from dashscope.audio.asr import Transcription

dashscope.api_key = "YOUR_DASHSCOPE_API_KEY"

task = Transcription.async_call(
    model="paraformer-v2",
    file_urls=["https://your-oss-bucket.aliyuncs.com/meeting_2026_06_24.wav"],
    language_hints=["zh"],
    diarization_enabled=True,
)

result = Transcription.wait(task=task)
sentences = result.output.results[0]["sentences"]
```

返回结构示例：

```json
{
  "sentences": [
    {
      "speaker_id": 0,
      "begin_time": 0,
      "end_time": 3520,
      "text": "今天我们讨论一下...",
      "words": [...]
    }
  ]
}
```

实时流式（fun-asr，WebSocket）：

```python
from dashscope.audio.asr import Recognition

recognition = Recognition(
    model="fun-asr",
    format="pcm",
    sample_rate=16000,
    callback=on_recognition_result,
    diarization=True,
    language="zh",
)
recognition.start()
recognition.send_audio_frame(audio_chunk)
```

### 5.3 纪要 Agent 编排

将转写结果按主题切分后，走 Map-Reduce：

- **Map**：每段抽取决策、待办、风险、关键数据
- **Reduce**：去重 + 全局汇总 → 结构化 JSON → Markdown 渲染

## 六、示例与模板

### 6.1 ASR 模型选型表

| 模型 | 适用 | RTF | 备注 |
|---|---|---|---|
| Paraformer-v2 | 标准会议录音 | ~0.05 | 性价比最高，文件转写默认推荐 |
| fun-asr / SenseVoice | 多语种+情感 | ~0.07 | 50+ 语种，开源可私有化 |
| Qwen3-ASR | 复杂口音/术语 | 0.1–0.3 | LLM 驱动，热词效果最好 |
| 通义听悟 SaaS | 开箱即用 | 分钟级 | 录音纪要 Agent 内置 |

### 6.2 端到端成本与时延（1 小时音频，参考量级）

| 环节 | 时延 | 成本（参考值） |
|---|---|---|
| ASR（Paraformer 文件版） | 1–3 分钟 | ¥0.5–1.5 |
| 说话人分离（CAM++ 等） | 30–60 秒 | 计算可忽略 |
| LLM 摘要（qwen-plus/max） | 20–60 秒 | ¥0.3–2.0 |
| **合计** | **2–5 分钟** | **¥1–4 / 小时** |

实时模式：首字 <500ms，纪要在结束后 5–15 秒生成。

> 数字仅作量级参考，实际请以官方计费页面与客户场景实测为准。

### 6.3 摘要抽取 Prompt（可直接复用）

```text
你是会议纪要分析师。基于带时间戳和说话人的会议片段，严格输出 JSON：

{
  "decisions": [{"content":"", "owner":"", "timestamp":""}],
  "action_items": [{"task":"", "owner":"", "due":"", "priority":"H/M/L"}],
  "open_questions": [],
  "key_points": []
}

判定规则：
- 决策：出现"我们就这么定/确认/拍板/敲定"等强承诺语义
- 待办：动词 + 责任人 + （隐含）时间
- 风险/未决：表达不确定、待确认、待跟进
- 关键数据：金额、时间点、人数等可量化信息

输入: {transcript_chunk}
```

### 6.4 录音卡产品形态建议

1. **卡片结构**：头部摘要 + 决策 Badge + 待办 Checklist + 可展开逐字稿
2. **深链跳转**：点卡片任一段 → 跳到对应音频时间点
3. **冷启动双入口**：上传录音文件 + 实时录音
4. **闭环优化**：用户对纪要点赞/纠错 → 回流优化 prompt 与热词库
5. **后续动作**：同步飞书/钉钉日历、创建任务、向量化入库做跨会议检索

## 七、能力边界

- **能做**：长音频文件转写（无需手动切片）、说话人分离、实时流式、Map-Reduce 摘要
- **不能做（当前）**：免上传 OSS 直接传二进制（文件版强制 URL）、超过 100 QPS 的高并发（需提工单提配额）
- **建议自建的部分**：纪要模板个性化（不同场景：销售拜访 / 课堂 / 法律咨询 不同字段）、热词库（行业术语/人名）

## 八、官方文档与 SDK 链接

- 录音纪要 Agent 实践：https://help.aliyun.com/zh/model-studio/recording-summary-agent-tutorial
- Paraformer-v2 文件转写：https://help.aliyun.com/zh/model-studio/paraformer
- bailian-cli（本地 mp3 直传）：https://bailian.aliyun.com/cli/install.md
- 计费页面：https://bailian.console.aliyun.com/?productCode=p_efm#/billing
