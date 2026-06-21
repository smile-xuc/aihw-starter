# 🚗 视觉移动机器人入门 | Vision Rover

> 基于 [JetBot](https://github.com/NVIDIA-AI-IOT/jetbot) 构建，¥2,000 / $280、NVIDIA 官方教育 AI 机器人

---

## 📋 项目简介 | Overview

JetBot 是 NVIDIA 官方开发的开源 AI 微型机器人，基于 Jetson Nano + 差速底盘 + 摄像头。支持物体跟踪、避障、路径规划等 AI 视觉任务，是学习边缘 AI 的最佳平台。

**你会学到 | You'll Learn**：
- NVIDIA Jetson 环境配置
- 摄像头实时推理（YOLO/分类模型）
- 差速底盘运动控制
- 端到端视觉避障

---

## 🛒 BOM 物料清单 | Bill of Materials

| 元件 Component | 型号 Model | 数量 | 参考价 |
|---------------|-----------|------|--------|
| 主控 SBC | Jetson Nano 4GB / Orin Nano | 1 | ¥1,000-2,500 |
| 摄像头 Camera | IMX219 CSI (Pi Camera v2) | 1 | ¥80 |
| 底盘 Chassis | JetBot Waveshare 底盘 | 1 | ¥200 |
| 电机 Motor | TT 减速电机 (1:48) | 2 | ¥10×2 |
| 电机驱动 | TB6612 / Waveshare 扩展板 | 1 | ¥30 |
| 电池 Battery | 18650 ×2 (7.4V) | 1组 | ¥20 |
| OLED | 0.96寸 I2C (可选) | 1 | ¥10 |
| WiFi 模块 | Intel 8265 (M.2) | 1 | ¥50 |
| TF 卡 | 64GB U1 | 1 | ¥35 |
| **合计 Total** | | | **~¥1,500-3,000** |

> 💡 **替代方案**：Jetson Nano 已停产，可用 [RDK X5](https://developer.d-robotics.cc/)（¥600，地平线旭日 X5）替代。

---

## 🔧 硬件组装 | Hardware Assembly

### 结构 | Structure

```
         摄像头 (CSI)
           │
    ┌──────┴──────┐
    │   Jetson Nano  │
    │  + 扩展板      │
    │  + OLED       │
    └──┬───────┬───┘
       │       │
  左轮电机    右轮电机
       │       │
    ═══╧═══════╧═══  电池(底部)
```

### 组装步骤 | Steps

1. **安装 Jetson Nano**：固定在底盘上层
2. **连接电机**：左/右电机 → 电机驱动板
3. **连接摄像头**：CSI 排线 → Jetson CSI 接口
4. **安装电池**：18650 电池盒固定在底盘底部
5. **WiFi 模块**：插入 M.2 slot（Jetson Nano 自带天线孔）

---

## 💻 软件环境 | Software Setup

### 刷系统 | Flash OS

```bash
# 1. 下载 JetBot SD 卡镜像 | Download image
# https://jetbot.org/master/#setup

# 2. 用 Etcher 刷入 TF 卡 | Flash with Etcher

# 3. 插入 Jetson Nano，启动 | Insert & boot

# 4. 连接 WiFi | Connect WiFi
# 默认: 用户名 jetbot, 密码 jetbot
```

### 安装 Python 库 | Install Libraries

```bash
# SSH 连接 | SSH connect
ssh jetbot@192.168.1.xxx

# 安装 JupyterLab | Install JupyterLab
sudo apt update
sudo apt install python3-pip
pip3 install jupyterlab

# 安装 JetBot 库 | Install JetBot library
git clone https://github.com/NVIDIA-AI-IOT/jetbot.git
cd jetbot
sudo python3 setup.py install
```

---

## 🧠 AI 视觉任务 | AI Vision Tasks

### 任务一：物体跟踪 | Object Following

```python
from jetbot import Robot, Camera
import torch
import torchvision

robot = Robot()
camera = Camera.instance()

# 加载预训练模型 | Load pretrained model
model = torchvision.models.alexnet(pretrained=True)
model.classifier[6] = torch.nn.Linear(4096, 2)  # blocked / free

# 加载 JetBot 避障模型 | Load collision avoidance model
model.load_state_dict(torch.load('collision_model.pth'))
model.eval()

while True:
    image = camera.value
    # 推理 | Inference
    output = model(image)
    if output[0] > 0.5:  # blocked
        robot.left(0.3)
    else:  # free
        robot.forward(0.3)
```

### 任务二：YOLO 实时检测 | YOLO Detection

```python
from jetbot import Camera
from ultralytics import YOLO

model = YOLO('yolov8n.pt')  # nano 模型，适合 Jetson Nano
camera = Camera.instance()

while True:
    frame = camera.value
    results = model(frame, verbose=False)

    for box in results[0].boxes:
        cls = model.names[int(box.cls)]
        conf = float(box.conf)
        if conf > 0.5:
            print(f"检测到: {cls} ({conf:.0%})")
```

### 接入 LLM 语音控制 | LLM Voice Control

```python
import requests

def voice_command_to_motion(text):
    """LLM 解析语音 → 运动指令"""
    response = requests.post(
        "https://api.deepseek.com/v1/chat/completions",
        headers={"Authorization": f"Bearer {API_KEY}"},
        json={
            "model": "deepseek-chat",
            "messages": [{
                "role": "system",
                "content": "你是机器人控制器。将指令转为: forward/backward/left/right/stop + 速度(0-1)"
            }, {"role": "user", "content": text}],
            "max_tokens": 20
        }
    )
    return response.json()["choices"][0]["message"]["content"]

# "向左前方慢慢走" → {"action": "left", "speed": 0.3}
```

---

## ✅ 快速验证 | Quick Test

```python
from jetbot import Robot
import time

robot = Robot()
# 前进 1 秒 | Forward 1 second
robot.forward(0.3)
time.sleep(1)
robot.stop()
print("✅ JetBot 正常工作！")
```

---

## 🚀 进阶玩法 | Next Steps

- [ ] 训练自定义避障模型（收集 200+ 张照片）
- [ ] 接入 ROS 2 实现 SLAM 导航
- [ ] 用 TensorRT 加速推理
- [ ] 添加激光雷达实现建图

---

## ❓ 常见问题 | FAQ

<details>
<summary><b>Q: Jetson Nano 过热？</b></summary>

1. 安装主动散热风扇（风扇座 J15）
2. `sudo nvpmodel -m 0` 切换到 MAXN 模式（需风扇）
3. 或降频运行：`sudo nvpmodel -m 1`（5W 模式）
</details>

<details>
<summary><b>Q: 摄像头黑屏？</b></summary>

1. 确认 CSI 排线方向（蓝色面朝 Ethernet 口）
2. 运行 `nvgstcapture-1.0` 测试摄像头
3. 检查设备树：`ls /dev/video*`
</details>

<details>
<summary><b>Q: YOLO 推理太慢？</b></summary>

1. 使用 `yolov8n.pt`（nano 版本，3.2M 参数）
2. 降低分辨率：`imgsz=320`
3. 用 TensorRT 加速：`model.export(format='engine')`
4. 或换 RDK X5（地平线 NPU 加速）
</details>

---

*最后更新：2026-06-21 | 基于 JetBot 最新版本*
