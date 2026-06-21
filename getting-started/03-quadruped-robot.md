# 🐕 四足机器人入门 | Quadruped Robot

> 基于 [OpenCat](https://github.com/PetoiCamp/OpenCat-Quadruped-Robot) 构建，¥2,000 / $280、经典开源四足机器人

---

## 📋 项目简介 | Overview

OpenCat 是 Petoi 开发的开源四足机器人框架，已有 Nybble（猫）和 Bittle（狗）两个成熟产品。它使用 ESP32/Arduino 主控 + 8-16 个舵机，支持本能动作、技能编程和 AI 扩展。

**你会学到 | You'll Learn**：
- 四足机器人运动学（步态生成）
- 多舵机协调控制
- IMU 平衡调节
- 蓝牙/App 遥控

---

## 🛒 BOM 物料清单 | Bill of Materials

| 元件 Component | 型号 Model | 数量 | 参考价 |
|---------------|-----------|------|--------|
| 成品套件 | Petoi Bittle / Nybble | 1 | ¥1,500-2,500 |
| **或自建** | | | |
| 主控 MCU | ESP32 / NyBoard | 1 | ¥100 |
| 舵机 Servo | MG996R / P1S | 8-12 | ¥20×12=¥240 |
| IMU | MPU6050 | 1 | ¥8 |
| 蓝牙模块 | HC-05 / ESP32 内置 | 1 | ¥15 |
| 电池 | 7.4V 14500 ×2 | 1组 | ¥20 |
| 3D 打印件 | OpenCat STL（免费） | 1套 | ¥80 |
| 螺丝包 | | 1包 | ¥15 |
| **自建合计** | | | **~¥500** |

> 💡 **推荐**：直接买 Petoi Bittle 套件（含所有零件+3D件+PCB），省去大量调试时间。

---

## 🔧 硬件组装 | Hardware Assembly

### 组装顺序 | Assembly Order

```
         前左腿 FL    前右腿 FR
              \\      //
         肩部 ──── NyBoard ──── 肩部
              //      \\
         后左腿 RL    后右腿 RR
```

1. **安装 NyBoard**：固定在机身中央
2. **安装舵机**：8 个舵机（每腿 2 个：髋关节+膝关节）
3. **连接 IMU**：MPU6050 → I2C
4. **接线**：舵机按编号连接 NyBoard 舵机口（1-8 或 1-16）
5. **安装电池**：7.4V 锂电池接电源口

---

## 💻 软件环境 | Software Setup

### 安装 Petoi Desktop App | Install

```bash
# 下载 Petoi Desktop App | Download
# https://github.com/PetoiCamp/OpenCat-Quadruped-Robot/releases

# 或使用 Arduino IDE | Or use Arduino IDE
# 安装 Petoi Arduino 库 | Install Petoi library
git clone https://github.com/PetoiCamp/OpenCat-Quadruped-Robot.git
```

### 烧录固件 | Flash Firmware

1. 打开 Arduino IDE
2. 选择开发板：`ESP32 Dev Module` 或 `Arduino Uno`（视版本）
3. 打开 `OpenCat/OpenCat.ino`
4. 上传固件

---

## 🧠 大模型/AI 接入 | AI Integration

### 方式一：蓝牙语音控制 | Bluetooth Voice Control

```python
# 通过蓝牙发送文本指令给 OpenCat
import serial

ser = serial.Serial("/dev/ttyUSB0", 115200)  # HC-05 蓝牙
ser.write(b"khi")   # hi 动作
ser.write(b"kwkF")  # 前进
ser.write(b"kbk")   # 后退
ser.write(b"ktrL")  # 左转
```

### 方式二：LLM 指令解析 | LLM Command Parsing

```python
import requests

def parse_voice_command(text):
    """用 LLM 将自然语言转为机器人指令"""
    response = requests.post(
        "https://api.deepseek.com/v1/chat/completions",
        headers={"Authorization": f"Bearer {API_KEY}"},
        json={
            "model": "deepseek-chat",
            "messages": [{
                "role": "system",
                "content": "你是机器人指令转换器。将用户指令转为 OpenCat 指令码。"
                           "可用指令: wkF(前进) bk(后退) trL(左转) trR(右转) "
                           "hi(打招呼) bk(退后) balance(平衡) rest(休息)"
            }, {
                "role": "user",
                "content": text
            }],
            "max_tokens": 20
        }
    )
    return response.json()["choices"][0]["message"]["content"].strip()

# 示例 | Example
cmd = parse_voice_command("向前走三步然后打招呼")
# 输出: "wkF wkF wkF hi"
```

---

## ✅ 快速验证 | Quick Test

```python
# 最简测试：让机器人坐下 | Sit down
ser = serial.Serial("/dev/ttyUSB0", 115200)
ser.write(b"kst")    # sit
import time; time.sleep(2)
ser.write(b"kup")    # stand up
ser.close()
print("✅ 四足机器人正常工作！")
```

---

## 🚀 进阶玩法 | Next Steps

- [ ] 用 MuJoCo/Isaac Sim 训练步态策略
- [ ] 接入摄像头实现视觉导航
- [ ] 多机器人群控
- [ ] 3D 打印自定义外壳

---

## ❓ 常见问题 | FAQ

<details>
<summary><b>Q: 机器人站不稳？</b></summary>

1. 校准舵机零位（Petoi Desktop App → Calibration）
2. 检查电池电压（低于 6.5V 需充电）
3. 确认 IMU 方向正确（芯片朝上）
</details>

<details>
<summary><b>Q: 舵机抖动？</b></summary>

1. 调低 PID 参数（OpenCat Config → Skill → PWM）
2. 检查机械结构是否卡阻
3. 确认电源电流足够（≥3A）
</details>

---

*最后更新：2026-06-21 | 基于 OpenCat 最新版本*
