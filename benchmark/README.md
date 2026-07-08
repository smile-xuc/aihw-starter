# benchmark - 方案延迟横评实测

本目录包含对 [solutions/by-solution](../solutions/by-solution/) 中"方案延迟横评"表格的可复现 demo。

同一批测试样本，用不同技术链路跑一遍，量化「首包延迟」和「端到端延迟」。

## 已覆盖的方案

| 方案 | 脚本 | 说明 |
|---|---|---|
| 方案 1 · 裸模型串接（阻塞式） | [scripts/method1_blocking_sdk.py](./scripts/method1_blocking_sdk.py) / [scripts/method1_blocking_cli.sh](./scripts/method1_blocking_cli.sh) | ASR → LLM → TTS，每步等前一步完成 |
| 方案 2 · 裸模型串接（流式） | [scripts/method2_streaming_sdk.py](./scripts/method2_streaming_sdk.py) | ASR + LLM 流式 + TTS 流式输入 |
| 方案 3 · Qwen-Omni 端到端 | [scripts/method3_omni_sdk.py](./scripts/method3_omni_sdk.py) / [scripts/method3_omni_cli.sh](./scripts/method3_omni_cli.sh) | 一个模型同时吞音频吐音频 |

> 待补：百炼多模态交互开发套件（全双工套件方案）、端云协同方案。

## 测试样本

三段短句，覆盖轻/中/复杂三档，位于 [samples/](./samples/)：

| ID | 文本 | 级别 |
|---|---|---|
| q1_light | 今天天气怎么样 | 轻度 |
| q2_medium | 帮我讲一个关于恐龙的小故事 | 中度 |
| q3_complex | 如果我在河边发现了一只受伤的小鸟应该怎么办我需要考虑哪些方面 | 复杂 |

样本用 CosyVoice `longwan_v2` 音色合成，采样率 22050 Hz，单声道 WAV。如需重新生成或换其他声音，跑一次方案 3 CLI 即可产出对应文件。

## 快速开始

### 1. 依赖安装

```bash
# Python SDK
pip3 install dashscope openai --break-system-packages

# Bailian CLI（可选，跑 CLI 脚本才需要）
npx skills add modelstudioai/cli --all -g
bl auth login
```

### 2. 配置 API Key

```bash
cp .env.example .env
# 编辑 .env 填入 DASHSCOPE_API_KEY=sk-...
```

或用环境变量：

```bash
export DASHSCOPE_API_KEY=sk-...
```

> ⚠️ `.env` 已在 `.gitignore` 中，不会被提交。所有脚本都通过 `os.environ["DASHSCOPE_API_KEY"]` 读取，日志中只打印脱敏形式 `sk-xx...xxxx`。

### 3. 跑 SDK 版

```bash
cd benchmark

# 方案 1（阻塞式）
python3 scripts/method1_blocking_sdk.py

# 方案 2（流式）
python3 scripts/method2_streaming_sdk.py

# 方案 3（Qwen-Omni）
python3 scripts/method3_omni_sdk.py
```

每个脚本会跑 3 条样本，最终把明细写到 `results/methodX_*.json`，控制台打印一张耗时汇总表。

### 4. 跑 CLI 版

```bash
cd benchmark

# 方案 1 · CLI 单条
./scripts/method1_blocking_cli.sh samples/q1_light.wav

# 方案 3 · CLI 单条
./scripts/method3_omni_cli.sh samples/q1_light.wav
```

CLI 版适合快速验证 `bl` 命令是否可用，SDK 版才能精细拆分 ASR/LLM/TTS 每一步耗时。

## 实测结果（参考）

测试时间 2026-07-08，海铂 macOS + 公司 Wi-Fi。仅供选型参考，不同网络/时段结果会波动。

### 方案 1 · 裸模型串接（阻塞式）

| 级别 | ASR | LLM | TTS | 端到端 |
|---|---:|---:|---:|---:|
| 轻度 | 858 | 973 | 2222 | **4053** |
| 中度 | 760 | 2616 | 2539 | **5915** |
| 复杂 | 1075 | 1253 | 3102 | **5430** |

阻塞式最大问题：TTS 必须等 LLM 完整拿完才开工，所以「首包」等于「端到端」，用户会经历 4～6 秒的沉默。

### 方案 2 · 裸模型串接（流式）

| 级别 | ASR | LLM 首 token | TTS 首字节 | 首包 | 端到端 |
|---|---:|---:|---:|---:|---:|
| 轻度 | 823 | 752 | 1466 | **2289** | 4741 |
| 中度 | 1000 | 623 | 1714 | **2714** | 5021 |
| 复杂 | 1613 | 519 | 1285 | **2898** | 5527 |

流式最直接的收益是首包从 4～5s 掉到 2～3s，用户能在 2～3 秒听到第一个字。端到端整体没显著缩短（因为 LLM+TTS 本来就在做，只是提前开始播）。

### 方案 3 · Qwen-Omni 端到端（语音进语音出）

| 级别 | 首 text | 首 audio | 末 audio | 首包 | 端到端 |
|---|---:|---:|---:|---:|---:|
| 轻度 | 845 | 1294 | 4188 | **1294** | 4188 |
| 中度 | 775 | 1294 | 14012 | **1294** | 14012 |
| 复杂 | 726 | 1068 | 9410 | **1068** | 9410 |

首包最短（1s 出头），但**端到端受 LLM 回复长度直接影响**。Omni 会自发生成较长回复，如果不在系统提示词里死磕字数上限，中/复杂题目端到端可能拉到 10s 以上。

### 横向对比

| 方案 | 首包（中度） | 端到端（中度） | 结论 |
|---|---:|---:|---|
| 方案 1 · 阻塞 | 5915 | 5915 | 简单实现，体验最差 |
| 方案 2 · 流式 | **2714** | 5021 | 首包体验最优的裸模型方案 |
| 方案 3 · Omni | 1294 | 14012 | 首包最快，但需要严格控字数 |

**选型建议**：

- 玩具/桌宠等短对话场景 → 方案 2（首包 2～3s，端到端 5s 出头，最平衡）
- 追求极致首字延迟 → 方案 3 + 短回复系统提示词
- 一定不要用方案 1，除非只是 POC 验证

## 目录结构

```
benchmark/
├── README.md                        # 本文件
├── .env.example                     # API Key 配置模板
├── samples/                         # 测试音频样本 (wav)
│   ├── q1_light.wav
│   ├── q2_medium.wav
│   └── q3_complex.wav
├── scripts/                         # 测试脚本
│   ├── common.py                    # 加载 .env / 脱敏 key / 时间戳
│   ├── method1_blocking_sdk.py
│   ├── method1_blocking_cli.sh
│   ├── method2_streaming_sdk.py
│   ├── method3_omni_sdk.py
│   └── method3_omni_cli.sh
└── results/                         # 实测数据（json）
    ├── method1_blocking.json
    ├── method2_streaming.json
    └── method3_omni.json
```

## 待补充

- [ ] 方案 4：百炼多模态交互开发套件（全双工套件）
- [ ] 方案 5：端云协同（端侧 VAD/ASR + 云端 LLM/TTS）
- [ ] 方案 2 的 CLI 版（流式在 shell 里较难拆解，暂用 SDK 演示）
- [ ] 加入并发压测（当前只测单会话延迟）
- [ ] 加入 asyncio 版本，对比同步/异步差异

欢迎 PR 补充。
