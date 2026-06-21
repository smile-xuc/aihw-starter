# 🦾 桌面机械臂入门 | Desktop Robot Arm

> 基于 [SO-ARM100](https://github.com/TheRobotStudio/SO-ARM100) 构建，¥250 / $35、HuggingFace LeRobot 官方支持

---

## 📋 项目简介 | Overview

SO-ARM100 是一个超低成本的 6 自由度桌面机械臂，使用 6 个总线舵机，配合 HuggingFace LeRobot 框架可实现遥操作、模仿学习和强化学习。它是目前最便宜的 AI 机械臂研究平台。

**你会学到 | You'll Learn**：
- 总线舵机（Feetech STS3215）控制
- 3D 打印机械臂组装
- Python 机械臂控制（正向/逆向运动学）
- HuggingFace LeRobot 遥操作与模仿学习

---

## 🛒 BOM 物料清单 | Bill of Materials

| 元件 Component | 型号 Model | 数量 Qty | 参考价 Price |
|---------------|-----------|---------|------------|
| 总线舵机 Servo | Feetech STS3215 (30kg) | 6 | ¥80×6 = ¥480 |
| 舵机驱动板 | Feetech FE-URT-1 / USB-TTL | 1 | ¥30 |
| 5V 电源 | 5V 10A 开关电源 | 1 | ¥35 |
| 3D 打印件 | STL 文件（免费下载） | 1套 | ¥50（打印服务） |
| 螺丝包 | M2/M3 螺丝+螺母 | 1包 | ¥10 |
| USB-TTL 转换器 | CH340/CP2102 | 1 | ¥10 |
| **合计 Total** | | | **~¥615** |

> 💡 **省钱版**：用 STS3215 兼容舵机（¥50/个），总成本可降至 ~¥400。

---

## 🔧 硬件组装 | Hardware Assembly

### 3D 打印 | 3D Printing

1. 从 [SO-ARM100 GitHub](https://github.com/TheRobotStudio/SO-ARM100) 下载 STL 文件
2. 推荐设置：PLA/PETG，0.2mm 层高，30% 填充
3. 或使用 [嘉立创 3D 打印](https://www.jlc3dp.com/) 打印服务

### 组装步骤 | Assembly

```
        基座 (J1)
         │
     肩部 (J2)
         │
     大臂 (J3)
         │
     小臂 (J4)
         │
     腕部 (J5)
         │
     末端 (J6) ── 夹爪
```

1. **安装基座舵机**：J1 舵机固定在底座上
2. **逐节安装**：J1→J2→J3→J4→J5→J6，每节用螺丝固定
3. **连接舵机线**：6 个舵机菊花链串联（总线连接）
4. **连接驱动板**：总线末端连接 FE-URT-1 驱动板
5. **供电**：5V 10A 电源接驱动板

> ⚠️ **注意**：安装舵机前先归零（用 Python 脚本设为 0 位）

---

## 💻 软件环境 | Software Setup

### 安装 LeRobot | Install LeRobot

```bash
# 创建虚拟环境 | Create virtual environment
conda create -n lerobot python=3.10
conda activate lerobot

# 安装 LeRobot | Install
pip install lerobot

# 克隆 SO-ARM100 配置 | Clone configs
git clone https://github.com/TheRobotStudio/SO-ARM100.git
cd SO-ARM100
```

### 舵机测试 | Servo Test

```python
from lerobot.common.robot_devices.motors import FeetechMotorsBus

# 连接机械臂 | Connect arm
bus = FeetechMotorsBus(
    port="/dev/ttyUSB0",  # Windows: "COM3"
    motors={
        "joint_1": (1, "sts3215"),
        "joint_2": (2, "sts3215"),
        "joint_3": (3, "sts3215"),
        "joint_4": (4, "sts3215"),
        "joint_5": (5, "sts3215"),
        "joint_6": (6, "sts3215"),
    }
)

bus.connect()

# 读取当前位置 | Read current position
positions = bus.sync_read("Present_Position")
print(f"当前位置: {positions}")

# 移动到目标位置 | Move to target
bus.sync_write("Goal_Position", [512, 512, 512, 512, 512, 512])

bus.disconnect()
```

---

## 🧠 大模型/AI 接入 | AI Integration

### 方式一：遥操作+模仿学习 | Teleoperation + Imitation Learning

```python
# 使用 LeRobot 数据采集 | Data collection with LeRobot
# 1. 手动引导机械臂完成动作
# 2. 记录关节角度序列
# 3. 训练策略网络
# 4. 策略自主复现

python lerobot/scripts/control_robot.py \
    --robot.type=so_arm100 \
    --control.type=replay \
    --control.fps=30
```

### 方式二：VLM 视觉引导 | Vision-Language Model Guidance

```python
# 用 GPT-4o/DeepSeek-VL 分析场景
# 输出目标物体坐标
# 机械臂抓取
import requests

def get_grasp_position(image_path):
    """用 VLM 分析图像，返回抓取坐标"""
    response = requests.post(
        "https://api.deepseek.com/v1/chat/completions",
        headers={"Authorization": f"Bearer {API_KEY}"},
        json={
            "model": "deepseek-chat",
            "messages": [{
                "role": "user",
                "content": "分析这张桌面图像，告诉我红色立方体的坐标"
            }]
        }
    )
    return parse_coordinates(response.json())
```

---

## ✅ 快速验证 | Quick Test

```python
# 最简测试：让机械臂挥手 | Wave hello
import time

bus.connect()
# 挥手动作序列 | Wave sequence
for _ in range(3):
    bus.sync_write("Goal_Position", [512, 300, 700, 512, 512, 300])
    time.sleep(0.5)
    bus.sync_write("Goal_Position", [512, 300, 700, 512, 512, 700])
    time.sleep(0.5)
bus.disconnect()
print("✅ 机械臂正常工作！")
```

---

## 🚀 进阶玩法 | Next Steps

- [ ] 双臂遥操作（主从控制）
- [ ] 接入摄像头实现视觉抓取
- [ ] 训练模仿学习策略
- [ ] 接入 VLM 实现语言指令控制

---

## ❓ 常见问题 | FAQ

<details>
<summary><b>Q: 舵机不转/报错？</b></summary>

1. 检查 ID 是否正确（1-6）
2. 确认电源 5V 10A（电流不足会报错）
3. 用 Feetech 调试软件单独测试每个舵机
</details>

<details>
<summary><b>Q: LeRobot 找不到机械臂？</b></summary>

1. 确认 USB-TTL 驱动已安装（CH340/CP2102）
2. Linux: `ls /dev/ttyUSB*`，Windows: 设备管理器查看 COM 端口
3. 确认波特率匹配（STS3215 默认 1000000）
</details>

---

*最后更新：2026-06-21 | 基于 SO-ARM100 + LeRobot*
