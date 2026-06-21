# 🚁 开源无人机 AI 入门 | Autonomous Drone

> 基于 [ArduPilot](https://github.com/ArduPilot/ardupilot) + ESP32 构建，¥1,500 起步

---

## 📋 项目简介 | Overview

使用 Pixhawk/ESP32 飞控 + ArduPilot 开源固件构建可编程无人机，接入 AI 实现自主航拍、目标跟踪、航点巡检。

**你会学到 | You'll Learn**：
- ArduPilot/PX4 飞控配置
- MAVLink 协议与 Python 控制
- AI 视觉目标跟踪（YOLO）
- 航点任务规划

---

## 🛒 BOM 物料清单

| 元件 | 型号 | 数量 | 参考价 |
|------|------|------|--------|
| 飞控 | Pixhawk 4 / Matek H743 | 1 | ¥300-600 |
| GPS | M8N GPS + 磁力计 | 1 | ¥50 |
| 电调 ESC | 4合1 30A BLHeli_S | 1 | ¥100 |
| 电机 | 2207 2400KV 无刷 | 4 | ¥25×4=¥100 |
| 螺旋桨 | 5045 三叶桨 | 4对 | ¥15 |
| 机架 | F450 / 250mm 碳纤维 | 1 | ¥80 |
| 电池 | 4S 1500mAh LiPo | 2 | ¥50×2=¥100 |
| 遥控接收 | FlySky/ELRS 接收机 | 1 | ¥50 |
| 树莓派 | Pi Zero 2W (AI 视觉) | 1 | ¥120 |
| 摄像头 | Pi Camera V2 | 1 | ¥80 |
| | **合计** | | **~¥1,045** |

---

## 💻 软件环境

### 配置 ArduPilot

```bash
# 1. 下载 QGroundControl | Download QGC
# https://qgroundcontrol.com/

# 2. 连接 Pixhawk → 刷入 ArduPilot Copter 固件

# 3. 配置传感器：GPS/IMU/磁力计/气压计

# 4. 校准遥控器 + 电调

# 5. 设置飞行模式：Stabilize / AltHold / Loiter / Auto
```

### Python 无人机控制（MAVLink）

```python
from pymavlink import mavutil
import time

# 连接飞控 | Connect
master = mavutil.mavlink_connection('udpin:0.0.0.0:14550')

# 等待心跳 | Wait for heartbeat
master.wait_heartbeat()

# 解锁 | Arm
master.mav.command_long_send(
    master.target_system, master.target_component,
    mavutil.mavlink.CMD_COMPONENT_ARM_DISARM,
    0, 1, 0, 0, 0, 0, 0, 0
)

# 起飞到 5 米 | Takeoff to 5m
master.mav.command_long_send(
    master.target_system, master.target_component,
    mavutil.mavlink.CMD_NAV_TAKEOFF,
    0, 0, 0, 0, 0, 0, 0, 5
)

# 悬停 10 秒 | Hover 10 seconds
time.sleep(10)

# 降落 | Land
master.mav.command_long_send(
    master.target_system, master.target_component,
    mavutil.mavlink.CMD_NAV_LAND,
    0, 0, 0, 0, 0, 0, 0, 0
)
```

---

## 🧠 AI 视觉跟踪 | AI Vision Tracking

### YOLO 目标检测（树莓派）

```python
from ultralytics import YOLO
from pymavlink import mavutil
import cv2

model = YOLO('yolov8n.pt')
master = mavutil.mavlink_connection('udpin:0.0.0.0:14550')
cap = cv2.VideoCapture(0)  # Pi Camera

while True:
    ret, frame = cap.read()
    results = model(frame, verbose=False)

    # 检测人 | Detect person
    for box in results[0].boxes:
        if model.names[int(box.cls)] == 'person':
            x, y, w, h = box.xywh[0]
            # 计算偏移 → 发送控制指令
            offset_x = (x - frame.shape[1]/2) / (frame.shape[1]/2)
            # → 向目标移动 | Move toward target
            print(f"跟踪目标，X 偏移: {offset_x:.2f}")
```

### LLM 任务规划

```python
def plan_mission(natural_language):
    """LLM 将自然语言转为航点任务"""
    resp = requests.post(
        "https://api.deepseek.com/v1/chat/completions",
        headers={"Authorization": "Bearer YOUR_KEY"},
        json={
            "model": "deepseek-chat",
            "messages": [{
                "role": "user",
                "content": f"生成 MAVLink 航点任务 JSON: {natural_language}"
            }]
        }
    )
    return resp.json()["choices"][0]["message"]["content"]
```

---

## ✅ 快速验证

```bash
# 1. QGroundControl 连接飞控
# 2. 校准所有传感器
# 3. 室内 Stabilize 模式测试（低空 0.5m）
# 4. 确认解锁/起飞/降落正常
# ⚠️ 首次飞行务必在开阔场地 + 有人在旁
```

---

## ⚠️ 安全注意 | Safety

- **法规**：中国需在适飞区域飞行（120m 以下，远离机场/人群）
- **电池**：LiPo 电池有火灾风险，充电需有人值守
- **首次飞行**：先在 Stabilize 模式手动测试，再尝试 Auto

---

*最后更新：2026-06-21 | 基于 ArduPilot Copter 4.5+*
