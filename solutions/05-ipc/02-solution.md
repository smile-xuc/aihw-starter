# 02 · 推荐方案与接入指南（千问大模型版）

> **方案版本**：千问大模型方案（首发版）
> **品类**：智能摄像头 / 智能门铃 / 可穿戴拍摄设备 / 人形巡检机器人
> **核心能力**：OSS AI 内容感知（视频/图片以文搜图）+ Qwen-VL 视觉模型
>
> 本文档基于千问（Qwen）大模型生态。其他厂商方案欢迎通过 PR 补充为 `02-solution-{model}.md`。

---

## 一、能力概述

OSS AI 内容感知是阿里云对象存储原生提供的「以文搜图/搜视频」能力。上传到 Bucket 的视频和图片会自动生成：

- 100 字详细描述
- 20 字精简摘要
- 向量索引

支持自然语言查询直接召回，完全 Serverless，无需自己搭建向量库。配合 Qwen-VL 视觉模型可以实现「事件检测、场景描述、智能剪辑」等高级能力。

典型场景：

- IPC 云存量用户的「AI 摘要 + 智能搜索」订阅升级
- 人形/可穿戴拍摄设备的「自动相册」
- 商业监控的事件回查

## 二、推荐链路总览

```
[摄像头] → [实时上传 OSS] → [AI 内容感知自动索引（Serverless）]
              ↓                       ↓
         [Qwen-VL 实时分析]      [App 自然语言搜索 DoMetaQuery]
              ↓
         [事件告警推送]
```

## 三、接入前置

| 项目 | 说明 |
|---|---|
| OSS 服务 | 阿里云 OSS Bucket，存放视频/图片 |
| AI 内容感知 | 在 Bucket 数据索引中开启 |
| API-KEY | OSS AccessKey + 千问大模型 API-KEY（用 Qwen-VL 时） |
| 地域 | 华北 2/3、华东 1/2、华南 1、西南 1、新加坡、美国（弗吉尼亚）；新加坡和美国需提工单开通 |

## 四、关键参数与硬约束

### 4.1 三段计费模型

OSS AI 内容感知按以下三个维度独立计费：

1. **数据索引费用**（向量检索模式）
2. **AI 内容感知费用**（按图片/视频文件类型与用量）
3. **API 请求费用**（ListObjects / HeadObject / GetObject 等）

**控费技巧**：开启时设置最多 5 条文件过滤规则（按前缀如 `videos/`、文件大小、LastModifiedTime、ObjectTag），避免全 Bucket 索引带来的成本失控。

### 4.2 索引时延

- 首次开启：「数分钟到数小时」（取决于存量文件量）
- 增量索引：自动触发，无具体 SLA

### 4.3 准确率

官方文档无量化值。建议接入后用客户实际场景跑 demo，把召回效果直观演示给客户看。

### 4.4 与 Qwen-VL 的关系

- OSS AI 内容感知：批量索引、检索、生成摘要 → 适合「事后回查」
- Qwen-VL 系列模型：实时视频/图片理解 → 适合「事件触发分析」

两者可组合使用：实时由 Qwen-VL 触发告警，事后由 OSS 检索回查。

## 五、接入步骤

### 5.1 控制台路径（最快验证）

1. OSS 控制台 → 选中目标 Bucket → 数据索引
2. 开启「视频内容感知」或「图片内容感知」
3. 配置文件过滤规则（必做，控成本）
4. 等待首次索引完成（看文件量 5 分钟到几小时）
5. 在控制台搜索框测试自然语言查询效果

### 5.2 代码接入

DoMetaQuery 调用（ossutil 命令行）：

```bash
ossutil api do-meta-query --bucket examplebucket \
  --meta-query "{\"Query\":\"小孩在沙发上跳\",\"MediaTypes\":{\"MediaType\":\"video\"}}" \
  --meta-query-mode semantic
```

SDK 调用（Python）：

```python
import oss2

auth = oss2.Auth("YOUR_AK", "YOUR_SK")
bucket = oss2.Bucket(auth, "https://oss-cn-hangzhou.aliyuncs.com", "examplebucket")

result = bucket.do_meta_query(
    query='{"Query":"小孩在沙发上跳","MediaTypes":{"MediaType":"video"}}',
    mode="semantic",
)
for f in result.files:
    print(f.file_name, f.description, f.summary)
```

返回字段示例：

```json
{
  "files": [
    {
      "file_name": "videos/cam01_2026_06_24_10_30.mp4",
      "description": "客厅沙发上一个小男孩在跳跃，旁边有一只白色的猫...",
      "summary": "小男孩沙发跳跃，猫在旁边",
      "score": 0.87
    }
  ]
}
```

### 5.3 与 Qwen-VL 组合（实时分析）

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
            {"type": "image_url", "image_url": {"url": "https://your-cdn/frame.jpg"}},
            {"type": "text", "text": "画面中有几个人？是否有异常行为？"},
        ],
    }],
)
```

## 六、示例与模板

### 6.1 文件过滤规则示例

控制台可配置最多 5 条：

| 规则类型 | 示例值 | 用途 |
|---|---|---|
| 前缀 | `videos/event/` | 只索引「事件录像」目录 |
| 文件大小 | `> 1MB` | 过滤掉缩略图 |
| LastModifiedTime | 最近 7 天 | 历史录像不索引 |
| ObjectTag | `index=true` | 应用层显式标记 |

### 6.2 IPC 订阅升级路径（针对已有云存的存量用户）

| 存量功能 | AI 升级点 |
|---|---|
| 24 小时滚动云存 | 自动生成「今日精彩瞬间」摘要 |
| 事件录像（人形/移动） | 中文化描述 + 自然语言检索 |
| 看回放 | 「找小孩跳下沙发那段」直接定位 |
| 推送告警 | Qwen-VL 二次确认，降低误报 |

存量 Bucket 可直接开启 AI 内容感知，**无需迁移数据**。

## 七、能力边界

- **能做**：存量 Bucket 零迁移升级、自然语言搜视频/图、事件实时分析、告警二次确认
- **不能做（当前）**：本地化/私有化部署（OSS 原生服务）、秒级实时索引（增量自动触发，无 SLA 保证）
- **建议自建的部分**：用户管理与计费、订阅生命周期、推送规则引擎

## 八、计费与配额

| 项目 | 计费方式 | 备注 |
|---|---|---|
| 数据索引 | 按文件数+索引存储 | 向量库托管 |
| AI 内容感知 | 按视频时长 / 图片张数 | 文件首次进入 Bucket 时计费 |
| DoMetaQuery API | 按调用次数 | 按 OSS API 标准计费 |
| Qwen-VL 调用 | 按 token | 实时分析时使用 |

具体单价见 [OSS 计费页面](https://www.aliyun.com/price/product#/oss/detail) 与千问大模型计费页面。

## 九、官方文档与 SDK 链接

- OSS AI 内容感知：https://help.aliyun.com/zh/oss/user-guide/ai-content-awareness
- Qwen-VL 视觉模型：https://help.aliyun.com/zh/model-studio/vision
- DoMetaQuery API 参考：https://help.aliyun.com/zh/oss/developer-reference/dometaquery
