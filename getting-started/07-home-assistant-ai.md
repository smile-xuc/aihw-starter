# 🏠 智能家居 AI 入门 | Smart Home AI

> 基于 [Home Assistant](https://www.home-assistant.io/) + ESP32 构建，¥100 起步的 AI 智能家居

---

## 📋 项目简介 | Overview

用 Home Assistant + ESP32 传感器构建本地智能HomeController，接入 LLM 实现自然语言控制。

**你会学到 | You'll Learn**：
- Home Assistant 安装配置
- ESP32 传感器接入（温湿度/PIR/继电器）
- LLM 自然语言控制设备
- 自动化场景编写

---

## 🛒 BOM 物料清单

| 元件 | 型号 | 数量 | 参考价 |
|------|------|------|--------|
| 主机 | 树莓派 4B (4GB) 或 NUC | 1 | ¥400 |
| 温湿度传感器 | AHT20 / BME280 | 1 | ¥10 |
| 人体感应 | HC-SR501 PIR | 1 | ¥5 |
| 继电器 | SRD-05VDC 继电器模块 | 1 | ¥5 |
| ESP32 | ESP32-DevKitC | 1 | ¥25 |
| TF 卡 | 32GB | 1 | ¥20 |
| | **合计** | | **~¥465** |

---

## 💻 软件环境

### 安装 Home Assistant

```bash
# 方法一：树莓派镜像 | Method 1: Pi image
# 下载 HAOS 镜像刷入 TF 卡 | Flash HAOS image
# https://www.home-assistant.io/installation/

# 方法二：Docker | Method 2: Docker
docker run -d \
  --name homeassistant \
  --privileged \
  --restart=unless-stopped \
  -e TZ=Asia/Shanghai \
  -v /path/to/ha:/config \
  --network=host \
  ghcr.io/home-assistant/home-assistant:stable
```

### ESP32 刷写 ESPHome

```bash
# 安装 ESPHome | Install
pip install esphome

# 创建配置 | Create config
esphome config init  # 生成 .esphome 配置

# 编译刷写 | Build & flash
esphome run sensor.yaml
```

### ESP32 传感器配置（ESPHome YAML）

```yaml
# sensor.yaml
esphome:
  name: ai-sensor
  platform: ESP32

wifi:
  ssid: "your_wifi"
  password: "your_password"

api:
  encryption:
    key: "your_encryption_key"

sensor:
  - platform: aht20
    temperature:
      name: "Room Temperature"
    humidity:
      name: "Room Humidity"

binary_sensor:
  - platform: gpio
    pin: GPIO13
    name: "Motion Sensor"
    device_class: motion

switch:
  - platform: gpio
    pin: GPIO14
    name: "Light Relay"
```

---

## 🧠 LLM 自然语言控制

### 安装 Extended OpenAI Conversation

在 HA 中安装集成：`Settings → Devices → Add Integration → Extended OpenAI Conversation`

### 配置 DeepSeek API

```yaml
# configuration.yaml
rest_command:
  deepseek_chat:
    url: https://api.deepseek.com/v1/chat/completions
    method: post
    headers:
      Authorization: "Bearer YOUR_API_KEY"
      Content-Type: application/json
    payload: |
      {
        "model": "deepseek-chat",
        "messages": [{"role": "user", "content": "{{ message }}"}],
        "max_tokens": 200
      }

# 自动化：语音/文本控制 | Automation
automation:
  - alias: "AI Voice Control"
    trigger:
      platform: conversation
      command:
        - "打开${entity}"
        - "关闭${entity}"
    action:
      - service: light.toggle
        target:
          entity_id: "{{ entity }}"
```

### 效果示例

```
用户："把客厅灯打开，调到最亮"
→ HA 解析 → light.living_room turn_on + brightness 255
→ ESP32 继电器闭合 → 灯亮
```

---

## ✅ 快速验证

```bash
# 1. 打开 HA Web 界面 http://你的IP:8123
# 2. 检查 ESP32 传感器是否出现在 Devices 列表
# 3. 测试说话："打开客厅灯"
# → 灯应亮起
```

---

## 🚀 进阶玩法

- [ ] 添加摄像头实现人脸识别开门
- [ ] 接入 xiaozhi-esp32 作为语音入口
- [ ] 用 Node-RED 编写复杂自动化
- [ ] 接入小米/涂鸦设备

---

*最后更新：2026-06-21*
