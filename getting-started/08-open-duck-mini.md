# 🦆 开源双足机器人入门 | Open Duck Mini

> 基于 [Open_Duck_Mini](https://github.com/apirrone/Open_Duck_Mini)，¥2,800 / $400、BDX 风格双足机器人

---

## 📋 项目简介 | Overview

Open_Duck_Mini 是 Disney BDX Droid 的迷你开源版，42cm 高，14 个舵机，强化学习 sim-to-real 步态。它在 GitHub 有 3,000+ stars，是开源人形/双足机器人最热门的项目之一。

**你会学到 | You'll Learn**：
- 双足机器人硬件组装（14 舵机 + 3D 打印）
- MuJoCo 物理仿真环境
- 强化学习 sim-to-real 训练
- RDK X5 / Raspberry Pi 板载控制

---

## 🛒 BOM 物料清单

| 元件 | 型号 | 数量 | 参考价 |
|------|------|------|--------|
| 总线舵机 | Feetech STS3215 (30kg) | 14 | ¥80×14=¥1,120 |
| 舵机驱动 | Feetech FE-URT-1 | 1 | ¥30 |
| 上位机 | RDK X5 / Raspberry Pi 4 | 1 | ¥350-600 |
| IMU | MPU6050 / BMI270 | 1 | ¥10 |
| 电池 | 7.4V 3000mAh (2S) | 1 | ¥50 |
| 3D 打印 | STL（GitHub 免费） | 1套 | ¥200 |
| DC-DC | 5V 5A 降压模块 | 1 | ¥15 |
| 螺丝/轴承 | | 1包 | ¥30 |
| | **合计** | | **~¥1,805-2,055** |

---

## 🔧 硬件组装

### 舵机布局 | Servo Layout

```
     头部 (4 舵机)
    ┌──┬──┐
    │  │  │   pitch/yaw/roll/neck
    └──┴──┘
      │
   左腿 (5 舵机)    右腿 (5 舵机)
   hip-yaw/roll     hip-yaw/roll
   hip-pitch        hip-pitch
   knee             knee
   ankle            ankle
```

### 组装步骤

1. **3D 打印所有零件**（PLA/PETG，0.2mm 层高，30% 填充）
2. **焊接舵机线**：14 个舵机菊花链串联
3. **安装腿部**：先装左腿，再装右腿
4. **安装头部**：4 个舵机控制头颈
5. **安装上位机+IMU**：RDK X5 固定在背部

---

## 💻 软件环境

### 环境安装 | Setup

```bash
# 克隆项目 | Clone
git clone https://github.com/apirrone/Open_Duck_Mini.git
cd Open_Duck_Mini

# 安装依赖 | Install deps
pip install -r requirements.txt

# 安装 MuJoCo（仿真用）| Install MuJoCo
pip install mujoco
```

### 训练 RL 步态 | Train RL Gait

```bash
# 在仿真中训练 | Train in simulation
python scripts/train.py --env-name duck_walk \
    --total-timesteps 1000000 \
    --algorithm ppo

# 训练完成后导出策略 | Export policy
python scripts/export_policy.py --checkpoint best_model.pt
```

### 部署到机器人 | Deploy to Robot

```python
# 运行时控制 | Runtime control
from duck_runtime import DuckRobot

robot = DuckRobot(
    servo_port="/dev/ttyUSB0",
    imu_port="/dev/i2c-1",
    policy_path="policies/best_model.pt"
)

robot.connect()
robot.stand_up()  # 站起来 | Stand up
robot.walk()      # 行走 | Walk
```

---

## 🧠 AI/大模型接入

### Gemma 本地推理（RDK X5）

RDK X5 支持运行 Google Gemma 模型，实现机器人视觉问答：

```python
# 在 RDK X5 上运行 Gemma | Run Gemma on RDK X5
from rdkgpu import Model

model = Model.load("gemma-2b-rdk")
response = model.chat("你看到了什么？")
# 通过摄像头获取视觉输入 + LLM 生成描述
```

---

## ✅ 快速验证

```bash
# 1. 舵机归零 | Zero servos
python scripts/zero_servos.py

# 2. 仿真测试 | Sim test
python scripts/sim_test.py
# → 应看到 3D 机器人站立

# 3. 真机站立 | Real robot stand
python scripts/stand_up.py
# → 机器人应站立 5 秒不倒
```

---

## 🚀 进阶玩法

- [ ] 训练自定义步态（侧步/后退/转弯）
- [ ] 接入摄像头实现视觉导航
- [ ] 用 Isaac Lab 提升仿真保真度
- [ ] 参加强化学习比赛

---

## ❓ 常见问题

<details>
<summary><b>Q: 机器人站不稳？</b></summary>

1. 检查舵机 ID 和方向（运行 `zero_servos.py` 确认归零位置）
2. IMU 安装方向必须正确（芯片朝上，标记对齐）
3. 确保 RL 策略训练足够（至少 100 万步）
4. 电池电压不低于 7.0V
</details>

---

*最后更新：2026-06-21 | 基于 Open_Duck_Mini v2*
