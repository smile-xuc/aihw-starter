# 推荐方案与接入指南（千问大模型版）

> **方案版本**：千问大模型方案（首发版）
> **品类**：AI 眼镜 / 智能音箱 / 智能学习机 / 机器人 / 智能玩具（需要端到端语音/多模态交互）
> **核心能力**：多模态交互开发套件
>
> 本文档基于千问（Qwen）大模型生态。其他厂商方案欢迎通过 PR 补充为 `02-solution-{model}.md`。

---

## 一、能力概述

千问大模型多模态交互开发套件是面向硬件设备的工程化封装产品，把「裸模型 + 端侧算法 + 全双工对话引擎 + 可视化配置 + 场景模板 + 设备指令」打包成开箱即用的端云一体方案。

它解决的核心问题是：**端侧设备接入大模型的「最后一公里」** —— 尤其是 RTOS、嵌入式 Linux 这种自己拼链路成本很高的场景。

支持系统：Android / iOS / Linux / RTOS

支持场景模板：智能眼镜、学习机、机器人、玩具、音箱

## 二、套件 vs 裸调用 关键差异

接入前先想清楚走套件还是自己拼 ASR/LLM/TTS：

| 维度 | 裸模型直调 | 多模态交互开发套件 |
|---|---|---|
| 集成粒度 | 自己拼 ASR → LLM → TTS | 端到端打包 |
| 端侧能力 | 自己实现 | 内置 VAD / 回声消除 / 语音唤醒 |
| 对话模式 | 请求-响应 | 全双工流式可打断 |
| 配置方式 | 写代码 | 可视化无代码（模型/提示词/知识库/Agent/插件/指令） |
| 系统覆盖 | 云端 / 移动 | Android / iOS / Linux / RTOS |
| 场景模板 | 无 | 智能眼镜 / 学习机 / 机器人 / 玩具 / 音箱 |

**选型建议**：

- 选**套件**：快速跑通端侧 demo、需要全双工对话、目标系统包含 Linux/RTOS、希望非工程师也能配置
- 选**裸调用**：已有成熟端侧框架、对协议有强定制需求、只需要单点能力（如只用 TTS）

## 三、接入前置

| 项目 | 说明 |
|---|---|
| 服务开通 | 千问大模型控制台开通「多模态交互开发套件」 |
| API-KEY | 标准 sk- 前缀 |
| SDK | 套件 SDK，支持 Android / iOS / Linux / RTOS |
| Demo | https://github.com/aliyun/alibabacloud-bailian-speech-demo |

## 四、套件能力清单

### 4.1 ASR

- 端侧 VAD（语音活动检测）
- 回声消除
- 语音唤醒

### 4.2 LLM

- 通义系列模型
- 支持自定义替换平台其他大模型

### 4.3 TTS

- 超拟人音色
- 一句话声音复刻

### 4.4 视觉

- 文物讲解
- 地标识别
- 花束搭配
- 药品识别
- 热量分析
- 绘本朗读

### 4.5 设备控制

- 预置丰富指令集
- 可视化无代码配置自定义指令

### 4.6 配置面（控制台可视化）

- 模型选择
- 提示词
- 知识库
- Agent
- 插件
- 设备指令

## 五、接入步骤

### 5.1 控制台路径

1. 登录千问大模型控制台 → 应用 → 选择「多模态交互开发套件」官方应用
2. 在可视化界面配置：
   - 模型（默认 Qwen 系列，可替换）
   - 系统提示词
   - 知识库（上传文档作为长期记忆）
   - Agent / 插件
   - 设备指令（语音唤醒、自定义指令）
3. 选择场景模板（智能眼镜 / 学习机 / 机器人 / 玩具 / 音箱）
4. 在调试台用网页麦克风测试对话效果

### 5.2 端侧 SDK 集成

以 Linux 为例：

```bash
git clone https://github.com/aliyun/alibabacloud-bailian-speech-demo
cd alibabacloud-bailian-speech-demo/linux
# 按 README 配置 API-KEY 和应用 ID
make && ./demo
```

集成到产品固件的关键步骤：

1. SDK 初始化时传入 API-KEY 和应用 ID
2. 启动音频采集，将 PCM 流送入 SDK
3. SDK 通过回调返回：识别文本、LLM 回复、TTS 音频流、设备指令
4. 端侧根据回调执行播放、显示、控制等动作

### 5.3 RTOS 集成要点

- SDK 提供精简版本，内存占用与具体芯片平台有关
- WebSocket 协议要求设备支持 TLS
- 建议先在 Linux 上跑通逻辑，再移植到 RTOS

## 六、示例与模板

### 6.1 AI 眼镜典型接入流程

```
1. 控制台选「多模态交互开发套件」官方应用
2. 可视化配置：模型 / 提示词 / 知识库 / Agent / 插件 / 设备指令
3. 选「智能眼镜」场景模板
4. 端侧集成 SDK（Android / Linux / RTOS）
5. 实时测试调试
6. 部署上线
```

### 6.2 设备指令配置示例

在控制台配置自定义设备指令：

| 用户语音 | 触发指令 |
|---|---|
| 「打开手电筒」 | `cmd_flashlight_on` |
| 「拍张照片」 | `cmd_camera_capture` |
| 「我饿了」 | `cmd_show_nearby_restaurants` |

LLM 识别意图后通过回调下发指令，端侧固件解析指令执行动作。

### 6.3 视觉能力调用

AI 眼镜场景下，相机拍摄后传图片到云端走 Qwen-VL：

```python
# 套件内部已封装，无需开发者直接调用
# 示例展示等价逻辑
response = vl_model.recognize(
    image_url="https://oss/photo.jpg",
    prompt="这是什么文物？",
)
tts.play(response.text)
```

## 七、能力边界

- **能做**：Android / iOS / Linux / RTOS 全覆盖、全双工对话、可视化无代码配置、场景模板、视觉调用、知识库、自定义指令
- **不能做（当前）**：端到端 SLA 量化承诺、特定芯片白名单（建议联系售前提供 demo 联调支持）、ASR/TTS 自由替换为第三方
- **建议自建的部分**：续航策略（VAD 驱动的低功耗模式）、设备激活/订阅生命周期管理、用户隐私同意流程

## 八、计费与配额

| 项目 | 计费方式 | 备注 |
|---|---|---|
| LLM | 按 token | 默认 Qwen 系列，可换成其他模型 |
| ASR | 按音频时长 | 套件已封装 |
| TTS | 按字符 | 套件已封装 |
| 视觉模型 | 按 token / 图片 | 调用 Qwen-VL 时计费 |
| 套件本身 | 当前不额外收费 | 仅按底层模型用量计费 |

## 九、官方文档与 SDK 链接

- 多模态交互开发套件总览：https://help.aliyun.com/zh/model-studio/multimodal-products-overview
- Demo 仓库：https://github.com/aliyun/alibabacloud-bailian-speech-demo
- Qwen-VL 视觉模型：https://help.aliyun.com/zh/model-studio/vision
- 计费页面：https://bailian.console.aliyun.com/?productCode=p_efm#/billing
