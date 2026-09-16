# 开源项目 · 其他 / 基础设施与合集

> 承接 HTML 大盘中暂无法映射到 solutions 01–09 的项目：芯片平台、模型部署、参考合集、无人机、网络/汽车/农业等。
> 完整交互式索引仍以 [`../ai-hardware-projects.html`](../ai-hardware-projects.html) 为准。
> 对应品类成熟后可迁入正式分册。

## 芯片平台

### RKNN-Toolkit2（Rockchip）

- **仓库**：https://github.com/airockchip/rknn-toolkit2
- **Star**：以 HTML 大盘为准
- **License**：待核
- **框架**：Rockchip NPU
- **状态**：活跃
- **简介**：瑞芯微 RKNN 模型转换与部署工具链。
- **关键特性**：模型转换；量化；板端部署
- **HTML 品类**：芯片平台

### MaixPy（Sipeed）

- **仓库**：https://github.com/sipeed/MaixPy
- **Star**：以 HTML 大盘为准
- **License**：待核
- **框架**：Sipeed Maix 系列
- **状态**：活跃
- **简介**：端侧 MicroPython AI 开发栈。
- **关键特性**：端侧视觉；易上手；板级示例
- **HTML 品类**：芯片平台

### AliOS Things

- **仓库**：https://github.com/alibaba/AliOS-Things
- **Star**：以 HTML 大盘为准
- **License**：Apache-2.0
- **框架**：多 MCU
- **状态**：维护中
- **简介**：阿里开源 IoT OS，量产级嵌入式参考。
- **关键特性**：RTOS；物联网连接；组件生态
- **HTML 品类**：芯片平台

## 模型部署

### llama.cpp

- **仓库**：https://github.com/ggml-org/llama.cpp
- **Star**：以 HTML 大盘为准
- **License**：MIT
- **框架**：跨平台 C/C++
- **状态**：活跃
- **简介**：本地 LLM 推理事实标准之一，边缘/桌面部署常用。
- **关键特性**：量化推理；多后端；可嵌入
- **HTML 品类**：模型部署

### LocalAI

- **仓库**：https://github.com/mudler/LocalAI
- **Star**：以 HTML 大盘为准
- **License**：MIT
- **框架**：自托管（Docker/本地）
- **状态**：活跃
- **简介**：OpenAI 兼容的本地 AI API 网关，适合硬件产品的云/边混合后端。
- **关键特性**：多模型；OpenAI API 兼容；自托管
- **HTML 品类**：模型部署

### ncnn（Tencent）

- **仓库**：https://github.com/Tencent/ncnn
- **Star**：以 HTML 大盘为准
- **License**：待核
- **框架**：移动/嵌入式
- **状态**：活跃
- **简介**：高性能力端神经网络推理框架。
- **关键特性**：端侧推理；无第三方依赖；多平台
- **HTML 品类**：模型部署

### ONNX Runtime

- **仓库**：https://github.com/microsoft/onnxruntime
- **Star**：以 HTML 大盘为准
- **License**：MIT
- **框架**：跨平台
- **状态**：活跃
- **简介**：跨平台 ONNX 推理运行时。
- **关键特性**：多 EP；训练/推理；硬件加速
- **HTML 品类**：模型部署

> whisper.cpp 主卡在 [`07-recorder.md`](./07-recorder.md)。

## 参考合集

### awesome-tinyml

- **仓库**：https://github.com/umitkacar/awesome-tinyml
- **Star**：以 HTML 大盘为准
- **License**：MIT
- **简介**：TinyML 资源合集。
- **HTML 品类**：参考合集

### tinyml-papers-and-projects

- **仓库**：https://github.com/gigwegbe/tinyml-papers-and-projects
- **Star**：以 HTML 大盘为准
- **License**：MIT
- **简介**：TinyML 论文与项目索引。
- **HTML 品类**：参考合集

### awesome-local-ai

- **仓库**：https://github.com/janhq/awesome-local-ai
- **Star**：以 HTML 大盘为准
- **License**：待核
- **简介**：本地 AI 工具与项目合集。
- **HTML 品类**：参考合集

## 无人机与其它

### PX4-Autopilot

- **仓库**：https://github.com/PX4/PX4-Autopilot
- **Star**：以 HTML 大盘为准
- **License**：BSD-3-Clause
- **框架**：飞控
- **状态**：活跃
- **简介**：开源无人机飞控；具身分册仅「另见」，不作为 09 主卡。
- **HTML 品类**：无人机

### OpenIPC Firmware

- **仓库**：https://github.com/OpenIPC/firmware
- **Star**：以 HTML 大盘为准
- **License**：MIT
- **简介**：IP 摄像头开源固件（亦可对照 IPC 品类）。
- **HTML 品类**：视觉 AI

## 手表开源稀缺说明

完整「AI 智能手表整机」优质开源仍然稀缺；手表 OS 级参考已收入 [`08-smart-watch.md`](./08-smart-watch.md)（InfiniTime 等）。欢迎按收录原则 PR 补录。

## 贡献指引

详见根目录 [`CONTRIBUTING.md`](../../../CONTRIBUTING.md)。
