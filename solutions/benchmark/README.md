# benchmark - 方案延迟横评实测

本目录包含对 [by-solution](../by-solution/) 中"方案延迟横评"表格的可复现 demo。

同一批测试样本，用不同技术链路跑一遍，量化「首包延迟」和「端到端延迟」。

## 已覆盖的方案

| 方案 | 脚本 | 说明 |
|---|---|---|
| 方案 1 · 千问大模型串接（阻塞式） | [scripts/method1_blocking_sdk.py](./scripts/method1_blocking_sdk.py) / [scripts/method1_blocking_cli.sh](./scripts/method1_blocking_cli.sh) | ASR → LLM → TTS，每步等前一步完成 |
| 方案 2 · 千问大模型串接（流式） | [scripts/method2_streaming_sdk.py](./scripts/method2_streaming_sdk.py) | ASR + LLM 流式 + TTS 流式输入 |
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

> ⚠️ `.env` 已在 `.gitignore` 中，不会被提交。所有脚本都通过 SDK 从环境变量 `DASHSCOPE_API_KEY` 读取，脚本本身不持有 key 变量，日志中也不打印任何 key 相关信息（连脱敏形式都没有）。

### 3. 跑 SDK 版

```bash
cd solutions/benchmark

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
cd solutions/benchmark

# 方案 1 · CLI 单条
./scripts/method1_blocking_cli.sh samples/q1_light.wav

# 方案 3 · CLI 单条
./scripts/method3_omni_cli.sh samples/q1_light.wav
```

CLI 版适合快速验证 `bl` 命令是否可用，SDK 版才能精细拆分 ASR/LLM/TTS 每一步耗时。

## 实测结果（参考）

**体感延迟**定义：从音频发起请求，到 TTS 第一帧音频播出（即用户说完话到听到 AI 第一个字的等待时间）。

**测试环境**（2026-07-09 01:30 CST）：macOS 26.3 / Apple Silicon / 无线网络 / ping dashscope.aliyuncs.com ≈ 42ms。

> ⚠️ 延迟数据因网络环境会略有不同，仅供选型参考。

### 方案 1 · 千问大模型串接（阻塞式）

| 级别 | ASR | LLM | TTS | 体感延迟 |
|---|---:|---:|---:|---:|
| 轻度 | 661 | 1016 | 2200 | **3876** |
| 中度 | 1101 | 1041 | 2486 | **4628** |
| 复杂 | 1760 | 1235 | 2942 | **5938** |

阻塞式最大问题：TTS 必须等 LLM 完整拿完才开工，体感延迟 = ASR + LLM + TTS 三者顺序叠加，用户会经历 4～6 秒的沉默。

### 方案 2 · 千问大模型串接（流式）

| 级别 | ASR | LLM 首 token | TTS 首字节 | 体感延迟 |
|---|---:|---:|---:|---:|
| 轻度 | 821 | 612 | 1377 | **2198** |
| 中度 | 786 | 540 | 1582 | **2368** |
| 复杂 | 1715 | 574 | 1372 | **3087** |

流式让 LLM 边产出边喂给 TTS，体感延迟 = ASR + TTS 首字节，相比阻塞式缩短约 40%～50%。

### 方案 3 · Qwen-Omni 端到端（qwen3.5-omni-flash，语音进语音出）

| 级别 | 首 audio | 体感延迟 |
|---|---:|---:|
| 轻度 | 1035 | **1035** |
| 中度 | 1291 | **1291** |
| 复杂 | 1284 | **1284** |

体感延迟 ≈ 1～1.3s 且基本不随问题复杂度增长（单一模型整体处理，无 ASR+LLM+TTS 串行开销）。

> 注：此处用 HTTP stream 接口测试。该模型的 WebSocket 实时版本（qwen3.5-omni-flash-realtime）支持连续对话和语义打断，体感延迟预计更低。

### 方案 3b · Qwen-Omni Realtime（qwen3.5-omni-flash-realtime，WebSocket 双工）

| 级别 | 体感延迟 |
|---|---:|
| 轻度 | **330** |
| 中度 | **354** |
| 复杂 | **394** |

WebSocket 双工协议 + server_vad，体感延迟 ≈ 330～394ms，比 HTTP 流式再快 3 倍。支持语义打断和连续多轮对话。需配置 `DASHSCOPE_WORKSPACE_ID` 环境变量。

### 方案 4 · 百炼多模态交互开发套件（全双工套件方案）

| 级别 | 体感延迟 |
|---|---:|
| 轻度 | **991** |
| 中度 | **1120** |
| 复杂 | **1036** |

百炼平台托管的全双工语音交互方案，内置 ASR + LLM + TTS 全链路。体感延迟 ≈ 1s，支持语义打断、多轮对话、应用级配置（通过 APP_ID 绑定 prompt/知识库等）。需配置 `DASHSCOPE_WORKSPACE_ID` 和 `DASHSCOPE_APP_ID` 环境变量。

### 横向对比

| 方案 | 体感延迟（轻度） | 体感延迟（搜索） | 结论 |
|---|---:|---:|---|
| 方案 1 · 阻塞 | 5502 ms | 7416 ms | 简单实现，体验最差 |
| 方案 2 · 流式 | 2473 ms | 2980 ms | 体验最优的千问大模型串接方案 |
| 方案 3 · Omni (HTTP) | 1204 ms | 1318 ms | 单模型端到端，体感快 |
| 方案 4 · 多模态套件 | 997 ms | 1660 ms | 平台托管，支持应用配置 |
| 方案 3b · Omni Realtime (WS) | **347 ms** | **433 ms** | 体感最快，支持语义打断 |

**选型建议**：

- 追求极致体感 + 语义打断 → 方案 3b（WebSocket Realtime，轻度 ≈350ms，搜索 ≈430ms）
- 需要平台托管 + 应用级能力（知识库/prompt 模板）→ 方案 4（轻度 ≈1s，搜索 ≈1.7s）
- 需要自主拼接灵活性 → 方案 2 流式（≈3s）
- 一定不要用方案 1，除非只是 POC 验证

## 目录结构

```
solutions/benchmark/
├── README.md                        # 本文件
├── .env.example                     # API Key 配置模板
├── samples/                         # 测试音频样本 (wav)
│   ├── q1_light.wav
│   ├── q2_medium.wav
│   └── q3_complex.wav
├── scripts/                         # 测试脚本
│   ├── common.py                    # 加载 .env / 时间戳 / 样本清单
│   ├── method1_blocking_sdk.py
│   ├── method1_blocking_cli.sh
│   ├── method2_streaming_sdk.py
│   ├── method3_omni_sdk.py
│   ├── method3_omni_realtime_sdk.py
│   ├── method4_duplex_sdk.py
│   └── method3_omni_cli.sh
└── results/                         # 实测数据（json）
    ├── method1_blocking.json
    ├── method2_streaming.json
    └── method3_omni.json
```

## 待补充

- [ ] 方案 4：百炼多模态交互开发套件（全双工套件）
- [ ] 方案 2 的 CLI 版（流式在 shell 里较难拆解，暂用 SDK 演示）
- [ ] 加入并发压测（当前只测单会话延迟）
- [ ] 加入 asyncio 版本，对比同步/异步差异

欢迎 PR 补充。
