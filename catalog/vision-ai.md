# 👁️ 视觉 AI / 相机 | Vision AI & Cameras

> 端侧图像/视频 AI：目标检测、人脸识别、行为分析、OCR、SLAM。
> 覆盖 ESP32-CAM、OpenMV、Jetson、RPi+Coral/Hailo 等主流平台。
>
> 筛选标准：必须含 AI 模型推理 + 硬件部署

| # | Project | ⭐ Stars | Lang | Cost(¥) | Diff | Description | Link |
|---|---------|--------:|------|--------:|------|-------------|------|
| 1 | **openpilot** | 61,475 | Python | 7,000 | ⭐⭐⭐⭐ | comma.ai 开源 ADAS：comma 3X 硬件 + 端到端驾驶模型 | [→](https://github.com/commaai/openpilot) |
| 2 | **ultralytics (YOLO)** | 58,500 | Python | 0 | ⭐⭐ | YOLOv8/v11 端到端目标检测，支持 Jetson/RPi/手机 | [→](https://github.com/ultralytics/ultralytics) |
| 3 | **Frigate** | 33,862 | TS/Python | 2,000 | ⭐⭐⭐ | 本地 NVR + 实时目标检测（Coral TPU/OpenVINO/TensorRT） | [→](https://github.com/blakeblackshear/frigate) |
| 4 | **OpenALPR** | 11,400 | C++ | 1,000 | ⭐⭐⭐ | 开源车牌识别引擎，支持 RPi/Jetson | [→](https://github.com/openalpr/openalpr) |
| 5 | **jetson-inference** | 8,897 | C++ | 1,500 | ⭐⭐⭐ | NVIDIA 官方 Jetson 视觉推理教程：分类/检测/分割 | [→](https://github.com/dusty-nv/jetson-inference) |
| 6 | **AI-on-the-edge-device** | 8,500 | C++ | 100 | ⭐⭐ | ESP32-CAM 抄表器：水电气表数字识别 | [→](https://github.com/jomjol/AI-on-the-edge-device) |
| 7 | **ZoneMinder** | 5,900 | PHP/Perl | 1,500 | ⭐⭐⭐ | 老牌开源 NVR，可接入 ML 检测插件 | [→](https://github.com/ZoneMinder/zoneminder) |
| 8 | **Scrypted** | 5,700 | TS | 1,000 | ⭐⭐⭐ | NVR + HomeKit Secure Video，支持 Coral/OpenVINO | [→](https://github.com/koush/scrypted) |
| 9 | **jetson-containers** | 4,700 | Shell | 1,500 | ⭐⭐ | Jetson 全栈 AI Docker 镜像（LLM/VLM/Stable Diffusion） | [→](https://github.com/dusty-nv/jetson-containers) |
| 10 | **motionEye** | 4,600 | Python | 100 | ⭐ | 轻量 IP Cam Web UI，支持运动检测 + ML 后处理 | [→](https://github.com/motioneye-project/motioneye) |
| 11 | **Viseron** | 3,200 | Python | 600 | ⭐⭐ | 自主托管 NVR，支持 EdgeTPU、CUDA、OpenVINO | [→](https://github.com/roflcoopter/viseron) |
| 12 | **OpenMV** | 2,800 | C/MicroPy | 400 | ⭐⭐ | 嵌入式机器视觉相机，MicroPython 跑 CNN/二维码/AprilTag | [→](https://github.com/openmv/openmv) |
| 13 | **DeepCamera** | 2,800 | Python | 600 | ⭐⭐ | 开源 AI Camera：人脸识别、活体检测、移动端 App | [→](https://github.com/SharpAI/DeepCamera) |
| 14 | **ESP-WHO** | 2,100 | C | 70 | ⭐⭐ | 乐鑫官方 ESP32 人脸识别/检测库 | [→](https://github.com/espressif/esp-who) |
| 15 | **OpenIPC** | 2,100 | C | 200 | ⭐⭐⭐ | 开源 IP Camera 固件，支持海思/星宸/SigmaStar 主控 | [→](https://github.com/OpenIPC/openipc.github.io) |
| 16 | **OpenDataCam** | 1,700 | JS | 1,500 | ⭐⭐⭐ | YOLO + Jetson 的开源车流统计相机 | [→](https://github.com/opendatacam/opendatacam) |
| 17 | **DepthAI** | 1,100 | Python | 1,500 | ⭐⭐⭐ | Luxonis OAK 相机的 SDK：深度 + AI 推理一体 | [→](https://github.com/luxonis/depthai) |
| 18 | **Hailo RPi5 Examples** | 925 | Python | 1,000 | ⭐⭐ | RPi 5 + Hailo-8 26TOPS AI HAT 官方示例 | [→](https://github.com/hailo-ai/hailo-rpi5-examples) |
| 19 | **OAK Hardware** | 536 | KiCad | 800 | ⭐⭐⭐ | OAK 相机硬件设计文件 | [→](https://github.com/luxonis/depthai-hardware) |
| 20 | **reCamera** | 453 | C | 600 | ⭐⭐ | Seeed reCamera 开源端侧 AI 相机（CV 算子加速） | [→](https://github.com/Seeed-Studio/reCamera-OS) |
| 21 | **rknn-toolkit2** | 1,170 | C/Py | 300 | ⭐⭐⭐ | Rockchip RK3588/3576 NPU 推理工具链 | [→](https://github.com/rockchip-linux/rknn-toolkit2) |
| 22 | **ESP32 WildlifeCAM** | 4 | C | 200 | ⭐⭐ | ESP32-CAM 野外拍摄 + 物种识别 | [→](https://github.com/thewriterben/ESP32WildlifeCAM) |

## 📌 选型建议

| 场景 | 推荐硬件平台 | 推荐项目 |
|------|------------|---------|
| 入门/低成本 | ESP32-CAM | AI-on-the-edge-device、ESP-WHO |
| 中端嵌入式 | OpenMV / K210 | OpenMV |
| 家庭 NVR | RPi 5 + Coral / Hailo | Frigate / Scrypted |
| 工业/车规级 | Jetson Orin | jetson-inference / jetson-containers |
| 量产 IP Cam | OpenIPC（星宸/海思） | OpenIPC |
| 双目深度+AI | OAK / Luxonis | DepthAI |

> 完整 BOM 与教程见 [入门教程：JetBot 视觉机器人](../getting-started/05-vision-rover.md)
