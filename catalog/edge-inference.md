# ⚡ 边缘推理 / TinyML | Edge Inference & TinyML

> 端侧/嵌入式 AI 推理框架与运行时：从 MCU 上的 KB 级模型到 Jetson 上的 LLM。
>
> 筛选标准：直接服务于硬件落地的推理引擎/工具链/参考实现。

| # | Project | ⭐ Stars | Lang | Cost(¥) | Diff | Description | Link |
|---|---------|--------:|------|--------:|------|-------------|------|
| 1 | **ollama** | 174,617 | Go | 0 | ⭐⭐ | 一键本地 LLM 运行（Mac/Linux/Win/Pi）| [→](https://github.com/ollama/ollama) |
| 2 | **llama.cpp** | 117,471 | C++ | 0 | ⭐⭐ | CPU/ARM/x86 量化 LLM 推理（GGUF）| [→](https://github.com/ggerganov/llama.cpp) |
| 3 | **whisper.cpp** | 50,903 | C++ | 0 | ⭐⭐ | 端侧 Whisper 语音识别 | [→](https://github.com/ggerganov/whisper.cpp) |
| 4 | **vllm** | 83,432 | Python | 0 | ⭐⭐ | 高性能 LLM 推理（含边缘 GPU/Jetson）| [→](https://github.com/vllm-project/vllm) |
| 5 | **mediapipe** | 35,745 | C++ | 0 | ⭐⭐ | 跨端实时 ML（手势/姿态/人脸）| [→](https://github.com/google/mediapipe) |
| 6 | **ncnn** | 23,392 | C++ | 0 | ⭐⭐ | 腾讯端侧推理框架（手机/MCU/MR3588）| [→](https://github.com/Tencent/ncnn) |
| 7 | **onnxruntime** | 20,874 | C++ | 0 | ⭐⭐ | 微软跨平台推理运行时（含 EdgeTPU/RKNN）| [→](https://github.com/microsoft/onnxruntime) |
| 8 | **MNN** | 15,522 | C++ | 0 | ⭐⭐ | 阿里巴巴端侧推理引擎 | [→](https://github.com/alibaba/MNN) |
| 9 | **TensorRT** | 13,090 | C++ | 0 | ⭐⭐⭐ | NVIDIA Jetson/GPU 推理优化 | [→](https://github.com/NVIDIA/TensorRT) |
| 10 | **sherpa-onnx** | 13,081 | C++ | 0 | ⭐⭐ | 端侧 ASR/TTS/VAD（支持 RKNN/Coral）| [→](https://github.com/k2-fsa/sherpa-onnx) |
| 11 | **openvino** | 10,395 | C++ | 0 | ⭐⭐ | Intel 端侧推理（CPU/iGPU/VPU）| [→](https://github.com/openvinotoolkit/openvino) |
| 12 | **tvm** | 13,480 | Python | 0 | ⭐⭐⭐ | Apache 深度学习编译器（多后端）| [→](https://github.com/apache/tvm) |
| 13 | **tflite-micro** | 2,962 | C++ | 0 | ⭐⭐⭐ | TensorFlow Lite Micro：MCU 上跑 NN | [→](https://github.com/tensorflow/tflite-micro) |
| 14 | **Paddle-Lite** | 7,257 | C++ | 0 | ⭐⭐ | 百度端侧推理（含 NPU 后端）| [→](https://github.com/PaddlePaddle/Paddle-Lite) |
| 15 | **TinyMaix** | 1,052 | C | 0 | ⭐⭐ | Sipeed 极简 MCU 推理（K210/STM32）| [→](https://github.com/sipeed/TinyMaix) |
| 16 | **rknn-toolkit2** | 1,170 | C/Py | 0 | ⭐⭐⭐ | Rockchip RK3588/3576 NPU 工具链 | [→](https://github.com/rockchip-linux/rknn-toolkit2) |
| 17 | **lmdeploy** | 7,909 | Python | 0 | ⭐⭐ | InternLM 高性能 LLM 部署（端侧/边缘 GPU）| [→](https://github.com/InternLM/lmdeploy) |
| 18 | **ggml** | 14,849 | C++ | 0 | ⭐⭐⭐ | llama.cpp/whisper.cpp 底层张量库 | [→](https://github.com/ggerganov/ggml) |
| 19 | **inference (Xinference)** | 9,367 | Python | 0 | ⭐⭐ | 一键部署多种本地 LLM/Embedding/ASR | [→](https://github.com/xorbitsai/inference) |
| 20 | **mlx-audio** | 7,400 | Python | 0 | ⭐⭐ | Apple MLX 端侧音频生成（M 系列 Mac 跑 TTS）| [→](https://github.com/Blaizzy/mlx-audio) |
| 21 | **cactus** | 5,355 | C++ | 0 | ⭐⭐⭐ | 端侧推理框架（移动端 LLM）| [→](https://github.com/cactus-compute/cactus) |
| 22 | **vosk-api** | 14,868 | Jupyter | 0 | ⭐⭐ | 离线语音识别（支持 Pi/Jetson/Android）| [→](https://github.com/alphacep/vosk-api) |
| 23 | **CosyVoice** | 21,755 | Python | 0 | ⭐⭐⭐ | 阿里通义语音合成（可端侧/边缘 GPU）| [→](https://github.com/FunAudioLLM/CosyVoice) |
| 24 | **esp32-llm** | 800 | C | 0 | ⭐⭐⭐ | ESP32 上跑微型 LLM（115M tinyllama）| [→](https://github.com/DaveBben/esp32-llm) |
| 25 | **WasmEdge** | 10,656 | C++ | 0 | ⭐⭐⭐ | WebAssembly 端侧 AI 运行时 | [→](https://github.com/WasmEdge/WasmEdge) |
| 26 | **ModelAssistant (SSCMA)** | 438 | Python | 0 | ⭐⭐ | Seeed Studio 端侧模型助手 | [→](https://github.com/Seeed-Studio/ModelAssistant) |

## 📌 选型建议

| 硬件层级 | 模型规模 | 推荐运行时 |
|--------|---------|-----------|
| MCU（ESP32/STM32/K210）| KB ~ 几 MB | tflite-micro / TinyMaix / esp-sr |
| 边缘 SoC（RK3588/海思）| 100MB ~ 几 GB | rknn-toolkit2 / ncnn / MNN |
| 嵌入式 GPU（Jetson Orin）| 1B ~ 13B LLM | TensorRT / vLLM / lmdeploy |
| 树莓派 + AI HAT | 视情况 | onnxruntime / Hailo / Coral |
| Mac 本地大模型 | 7B ~ 70B | ollama / llama.cpp / mlx-audio |

