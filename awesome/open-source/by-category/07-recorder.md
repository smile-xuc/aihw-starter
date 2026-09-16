# 开源项目 · 录音/纪要方向

> 本页收录录音/纪要方向的开源 AI 硬件与推理项目。
> 完整索引见 [`../ai-hardware-projects.html`](../ai-hardware-projects.html)。
> 对应方案：[`solutions/by-category/07-recorder/`](../../../solutions/by-category/07-recorder/)

## 推荐参考项目

### Omi（原 Friend）

- **仓库**：https://github.com/BasedHardware/omi
- **Star**：以 HTML 大盘为准
- **License**：MIT
- **框架**：nRF52840 BLE
- **状态**：活跃
- **简介**：开源 AI 可穿戴，持续录音转写 + AI 记忆，录音卡/胸针形态主参考。
- **关键特性**：实时转写；AI 记忆；语音录制；LLM 人格
- **HTML 品类**：语音 AI
- **另见**：耳机/可穿戴形态见 [`06-ai-earphone.md`](./06-ai-earphone.md)

### whisper.cpp

- **仓库**：https://github.com/ggml-org/whisper.cpp
- **Star**：以 HTML 大盘为准
- **License**：MIT
- **框架**：跨平台 C/C++（可端侧）
- **状态**：活跃
- **简介**：OpenAI Whisper 的轻量 C++ 推理实现，本地 ASR / 纪要流水线常用底座。
- **关键特性**：本地 ASR；多平台；可嵌入边缘设备
- **HTML 品类**：模型部署

### sherpa-onnx（新一代 Kaldi）

- **仓库**：https://github.com/k2-fsa/sherpa-onnx
- **Star**：以 HTML 大盘为准
- **License**：Apache-2.0
- **框架**：RPi / ESP32 / 手机 / PC
- **状态**：活跃
- **简介**：实时语音识别推理框架，覆盖嵌入式到桌面的录音转写部署。
- **关键特性**：多语言 ASR；TTS；说话人识别；嵌入式部署
- **HTML 品类**：语音 AI

### openWakeWord

- **仓库**：https://github.com/dscripka/openWakeWord
- **Star**：以 HTML 大盘为准（HTML 大盘可能未收录，2026-09 核验存在）
- **License**：Apache-2.0
- **框架**：Python / ONNX（可端侧）
- **状态**：活跃
- **简介**：开源唤醒词检测，适合录音笔/纪要设备「按键+唤醒」混合交互。
- **关键特性**：自定义唤醒词；ONNX 推理；低算力友好
- **HTML 品类**：—（外链补录，已核验）

### ADeus

- **仓库**：https://github.com/adamcohenhillel/ADeus
- **Star**：以 HTML 大盘为准
- **License**：待核
- **框架**：Coral AI + Raspberry Pi
- **状态**：活跃
- **简介**：开源 AI 可穿戴，持续捕获所说/所听并自托管转写与私有记忆。
- **关键特性**：持续音频捕获；自托管转写；个性化 AI；私有记忆
- **HTML 品类**：可穿戴 AI

### HA Voice PE（ESPHome）

- **仓库**：https://github.com/esphome/home-assistant-voice-pe
- **Star**：以 HTML 大盘为准
- **License**：待核
- **框架**：ESP32-S3 + XMOS（ESPHome）
- **状态**：活跃
- **简介**：Home Assistant Voice 预览版硬件源码，语音助手流水线可参考到纪要前置采集。
- **关键特性**：语音助手流水线；STT/TTS；唤醒词
- **HTML 品类**：语音 AI

## 贡献指引

详见根目录 [`CONTRIBUTING.md`](../../../CONTRIBUTING.md)。
