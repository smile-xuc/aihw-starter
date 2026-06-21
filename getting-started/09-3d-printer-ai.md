# 🖨️ AI 3D 打印/CNC 入门 | AI 3D Printing

> 基于 [Klipper](https://github.com/Klipper3d/klipper) + AI 实现 3D 打印机智能控制

---

## 📋 项目简介 | Overview

Klipper 是 3D 打印机最流行的开源固件。配合 AI 可以实现：智能首层检测、失败预测、远程监控。本教程带你从零配置 Klipper 并接入 AI 功能。

**你会学到 | You'll Learn**：
- Klipper 固件安装配置
- 廉价 3D 打印机升级（ESP32 摄像头监控）
- AI 打印失败检测（Obico/神经网络）
- 远程 LLM 辅助切片

---

## 🛒 BOM 物料清单

| 元件 | 型号 | 数量 | 参考价 |
|------|------|------|--------|
| 3D 打印机 | Ender 3 / Kingroon KP3S（任意） | 1 | ¥500-1,500 |
| 主控 | Raspberry Pi 4B (2GB) | 1 | ¥250 |
| 摄像头 | USB 摄像头 / CSI Pi Camera | 1 | ¥30-80 |
| TF 卡 | 32GB | 1 | ¥20 |
| | **如无打印机** | | |
| 廉价入门 | Kingroon KP3S Pro S2 | 1 | ¥700 |
| | **合计（不含打印机）** | | **~¥300** |

---

## 💻 软件环境

### 安装 MainsailOS（Klipper 前端）

```bash
# 1. 下载 MainsailOS 镜像 | Download image
# https://github.com/mainsail-crew/MainsailOS/releases

# 2. 用 Etcher 刷入 TF 卡 | Flash to SD card

# 3. 配置 Wi-Fi | Configure Wi-Fi
# 编辑 TF 卡 boot 分区中的 mainsailos-wpa-supplicant.txt

# 4. 启动 | Boot
# SSH: pi@mainsailos.local (密码: raspberry)
```

### 编译 Klipper 固件

```bash
ssh pi@mainsailos.local

cd ~/klipper
make menuconfig
# 选择你的打印机主板型号 | Select your printer board
# 例：STM32F103 / STM32F401 / STM32G0B1

make clean && make

# 刷写到打印机主板 | Flash to printer board
sudo service klipper stop
make flash FLASH_DEVICE=/dev/ttyUSB0
sudo service klipper start
```

---

## 🧠 AI 功能接入

### AI 打印监控（Obico）

```bash
# 安装 Obico（AI 打印失败检测）| Install Obico
cd ~/
wget -qO - https://raw.githubusercontent.com/Obico/Obico-for-Klipper/master/install.sh | bash

# 配置 | Configure
# 在 moonraker.conf 中添加:
# [update_manager obico]
# type: git_repo
# ...

# Obico 使用 AI 分析摄像头画面
# 检测打印失败（ spaghetti / 层偏移 / 堵料）
# 自动暂停打印 + 发送通知
```

### LLM 切片参数建议

```python
import requests

def get_slice_advice(filament, model_type):
    """用 LLM 获取切片参数建议"""
    resp = requests.post(
        "https://api.deepseek.com/v1/chat/completions",
        headers={"Authorization": "Bearer YOUR_KEY"},
        json={
            "model": "deepseek-chat",
            "messages": [{
                "role": "user",
                "content": f"PLA 线材打印 {model_type}，推荐层高/温度/速度/填充率"
            }],
            "max_tokens": 200
        }
    )
    return resp.json()["choices"][0]["message"]["content"]

# 使用 | Usage
advice = get_slice_advice("PLA", "机械臂关节件")
print(advice)
# 输出: 层高 0.2mm, 温度 200°C, 速度 60mm/s, 填充 40%, 添加支撑
```

---

## ✅ 快速验证

```bash
# 1. 打开 Web 界面 http://你的Pi_IP
# 2. 检查打印机连接状态（Temperature 图表应显示室温）
# 3. 手动加热喷头 → PREHEAT PLA → 200°C
# 4. 上传 G-code 文件 → 开始打印
# 5. 摄像头画面应在 Web 界面实时显示
```

---

## 🚀 进阶玩法

- [ ] 接入 OrcaSlicer（AI 辅助切片配置）
- [ ] 添加 AI 首层检测（First Layer AI）
- [ ] 多打印机集群管理
- [ ] Telegram/微信远程通知

---

*最后更新：2026-06-21 | 基于 Klipper + MainsailOS*
