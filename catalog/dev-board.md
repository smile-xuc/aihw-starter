# 🛠️ 开发板 / 参考硬件 | Dev Boards & Reference Hardware

> 跑 AI 项目最常用的开发板、模组、参考设计与配套生态。包含主控、相机模组、AI 加速卡、屏幕扩展板等。
>
> 筛选标准：硬件平台本身（不是基于其上的应用）+ AI 友好度

| # | Project | ⭐ Stars | 用途 | Cost(¥) | Diff | Description | Link |
|---|---------|--------:|------|--------:|------|-------------|------|
| 1 | **ESP32 / ESP32-S3 (esp-idf)** | 14,800 | 主控 | 30~80 | ⭐⭐ | 最强生态的 AI 友好 MCU，自带 AI 加速指令 | [→](https://github.com/espressif/esp-idf) |
| 2 | **MicroPython** | 21,300 | 固件 | - | ⭐⭐ | 在 MCU 上跑 Python，K210/ESP32/RP2040 全支持 | [→](https://github.com/micropython/micropython) |
| 3 | **Sipeed MaixPy** | 765 | K210 主控 | 100 | ⭐⭐ | RISC-V K210 双核 + KPU AI 加速器 | [→](https://github.com/sipeed/MaixPy) |
| 4 | **Sipeed MaixCDK** | 322 | M2/M2S | 200 | ⭐⭐ | MaixCAM/M2 系列 SDK（V831/SG200X NPU）| [→](https://github.com/sipeed/MaixCDK) |
| 5 | **Coral Examples** | 392 | EdgeTPU | 600 | ⭐⭐ | Google Coral USB/PCIe 加速器示例 | [→](https://github.com/google-coral/examples-camera) |
| 6 | **Hailo Application Code** | 925 | Hailo-8 | 1,000 | ⭐⭐ | 26 TOPS 边缘 AI 加速器（适配 RPi5）| [→](https://github.com/hailo-ai/hailo-rpi5-examples) |
| 7 | **Seeed reTerminal Examples** | 264 | Jetson | 1,200 | ⭐⭐ | reTerminal/reComputer 工业 AI 终端 | [→](https://github.com/Seeed-Projects/reComputer-Jetson-for-Beginners) |
| 8 | **Raspberry Pi AI Camera (IMX500)** | 143 | RPi 摄像头 | 700 | ⭐⭐ | RPi 官方含 NN 推理的相机模组 | [→](https://github.com/raspberrypi/picamera2) |
| 9 | **OpenToys** | 132 | DIY 套件 | 200 | ⭐⭐ | 适合儿童/AI 玩具的 ESP32 配件参考 | [→](https://github.com/lampcat/OpenToys) |
| 10 | **OAK Hardware** | 536 | 双目相机 | 800 | ⭐⭐⭐ | Luxonis OAK 系列硬件设计 | [→](https://github.com/luxonis/depthai-hardware) |
| 11 | **OpenMV H7/N6** | 2,800 | AI 相机模组 | 400 | ⭐⭐ | 内置 CNN 加速的机器视觉相机 | [→](https://github.com/openmv/openmv) |
| 12 | **MILK-V Duo** | 460 | RISC-V Linux | 100 | ⭐⭐⭐ | RISC-V 双核 + 0.5TOPS NPU，跑 ncnn/MNN | [→](https://github.com/milkv-duo/duo-buildroot-sdk) |
| 13 | **LicheePi 4A** | 350 | RISC-V SBC | 600 | ⭐⭐⭐ | 4 核 RISC-V + 4 TOPS NPU 单板电脑 | [→](https://github.com/sipeed/LicheePi4A) |
| 14 | **Orange Pi AIPro** | 80 | 昇腾 SBC | 800 | ⭐⭐⭐ | 含华为昇腾 AI 处理器的开发板 | [→](https://github.com/orangepi-xunlong/orangepi-aipro) |
| 15 | **NVIDIA Jetson Linux Tegra** | 1,500 | Jetson SBC | 1,500+ | ⭐⭐⭐ | Jetson Orin 系列官方 BSP | [→](https://github.com/dusty-nv/jetson-inference) |
| 16 | **AI Kit Tutorial Raspberry Pi** | 306 | RPi+加速卡 | 800 | ⭐⭐ | RPi5 + Hailo / Coral / OAK 入门教程 | [→](https://github.com/Seeed-Projects/Tutorial-of-AI-Kit-with-Raspberry-Pi-From-Zero-to-Hero) |
| 17 | **ESP-BOX-3** | 1,300 | ESP32-S3 模组 | 350 | ⭐⭐⭐ | 乐鑫官方 AI 语音盒参考硬件 | [→](https://github.com/espressif/esp-box) |
| 18 | **XIAO ESP32S3 Sense** | 296 | 微型相机模组 | 100 | ⭐⭐ | 拇指大小 ESP32-S3 + 摄像头模组 | [→](https://github.com/Mjrovai/XIAO-ESP32S3-Sense) |
| 19 | **Grove Vision AI V2** | 100 | 视觉模组 | 350 | ⭐⭐ | Himax WiseEye2 1TOPS NPU 视觉模组 | [→](https://github.com/HimaxWiseEyePlus/Seeed_Grove_Vision_AI_Module_V2) |
| 20 | **CanMV (K230)** | 200 | 大算力 K230 | 250 | ⭐⭐⭐ | RISC-V K230 1.6 TOPS NPU + Python | [→](https://github.com/kendryte/canmv_k230) |

## 📌 选型建议

| 想做的事 | 推荐板子 |
|---------|---------|
| ¥30 起步学习 ESP32 AI | ESP32-S3 / XIAO ESP32S3 Sense |
| ¥100 跑端侧 CV+CNN | K210（MaixPy）/ K230（CanMV）|
| ¥500 跑 LLM/VLM | LicheePi 4A / Orange Pi AIPro |
| ¥1500 量产级 AI 算力 | RPi5 + Hailo-8 / Jetson Orin Nano |
| 工业 AGI 终端 | Jetson Orin NX / AGX Orin |

