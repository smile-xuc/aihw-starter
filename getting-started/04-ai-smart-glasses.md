# 🕶️ AI 智能眼镜入门 | AI Smart Glasses

> 基于 [OpenGlass](https://github.com/BasedHardware/OpenGlass) 构建，¥180 / $25、开源 AI 眼镜

---

## 📋 项目简介 | Overview

OpenGlass 是 BasedHardware 开发的开源 AI 智能眼镜项目。使用 Seeed XIAO ESP32-S3 Sense（含摄像头）+ 3D 打印镜框，实现拍照识别、物体描述、文字读取、记忆记录等 AI 功能。

**你会学到 | You'll Learn**：
- XIAO ESP32-S3 Sense 摄像头编程
- 图片上传到云端 VLM（视觉语言模型）
- 低功耗可穿戴设计
- 3D 打印眼镜外壳

---

## 🛒 BOM 物料清单 | Bill of Materials

| 元件 Component | 型号 Model | 数量 | 参考价 |
|---------------|-----------|------|--------|
| 主控+摄像头 | XIAO ESP32-S3 Sense | 1 | ¥55 |
| 电池 Battery | 3.7V 250mAh 锂电池 | 1 | ¥10 |
| 开关 Switch | 拨动开关 | 1 | ¥1 |
| 镜框 Frame | 3D 打印镜框 | 1 | ¥30 |
| 充电模块 | TP4056 (USB-C 充电) | 1 | ¥3 |
| 杜邦线 | | 少量 | ¥2 |
| **合计 Total** | | | **~¥101** |

---

## 🔧 硬件组装 | Hardware Assembly

### 接线图 | Wiring

```
XIAO ESP32-S3 Sense        TP4056
┌────────────────┐    ┌──────────┐
│ 5V (USB-C)     │←───│ BAT+     │←── 电池+
│ GND            │←───│ BAT-     │←── 电池-
│                │    │ IN+      │←── USB-C
└────────────────┘    └──────────┘
         │
    拨动开关 串接在 BAT+ 和 XIAO 5V 之间
```

### 组装步骤 | Steps

1. **3D 打印镜框**：从 [OpenGlass GitHub](https://github.com/BasedHardware/OpenGlass) 下载 STL
2. **焊接电池**：电池 → TP4056 → 拨动开关 → XIAO 5V/GND
3. **安装模组**：XIAO ESP32-S3 Sense 固定在镜框右侧
4. **摄像头朝前**：确保摄像头孔对准镜框开口

---

## 💻 软件环境 | Software Setup

### 安装 | Install

```bash
# Arduino IDE 安装 | Arduino IDE setup
# 1. 添加 Seeed 板支持包 URL
#    https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
# 2. 安装 "XIAO ESP32-S3" 板
# 3. 安装库: "seeed_arduino_mbedtls" "WiFi" "HTTPClient"

# 克隆 OpenGlass | Clone
git clone https://github.com/BasedHardware/OpenGlass.git
cd OpenGlass
```

### 配置 | Configure

```cpp
// 在 config.h 中填入 | Edit config.h
#define WIFI_SSID "your_wifi"
#define WIFI_PASSWORD "your_password"

// VLM API Key | 视觉语言模型 API
#define OPENAI_API_KEY "sk-xxx"       // 或 DeepSeek/GLM
#define VLM_MODEL "gpt-4o"            // 或 deepseek-vl
```

---

## 🧠 大模型接入 | LLM/VLM Integration

### 拍照识别流程 | Photo Recognition Flow

```
[按钮按下] → [ESP32 拍照] → [上传 Base64 到云端 VLM] → [返回文字描述] → [手机显示]
```

### 代码示例 | Code Example

```cpp
#include "camera.h"
#include "api_client.h"

void setup() {
    Serial.begin(115200);
    initCamera();      // 初始化摄像头
    connectWiFi();     // 连接 Wi-Fi
}

void loop() {
    if (digitalRead(BUTTON_PIN) == LOW) {
        // 1. 拍照 | Take photo
        camera_fb_t *fb = esp_camera_fb_get();

        // 2. 转 Base64 | Encode Base64
        String imageB64 = base64Encode(fb);

        // 3. 发送到 VLM | Send to VLM
        // 使用 DeepSeek-VL 或 GPT-4o
        String description = askVLM(imageB64, "描述你看到的场景");

        // 4. 输出 | Output
        Serial.println("AI: " + description);

        esp_camera_fb_return(fb);
    }
}
```

### 使用 DeepSeek-VL（国产替代）| Using DeepSeek-VL

```cpp
String askVLM(String imageB64, String question) {
    HTTPClient http;
    http.begin("https://api.deepseek.com/v1/chat/completions");
    http.addHeader("Authorization", "Bearer " + String(API_KEY));
    http.addHeader("Content-Type", "application/json");

    String body = R"({"model":"deepseek-vl","messages":[{"role":"user","content":[{"type":"text","text":")" + question + R"("},{"type":"image_url","image_url":{"url":"data:image/jpeg;base64,)" + imageB64 + R"("}}]}]})";

    http.POST(body);
    // 解析响应 | Parse response...
}
```

---

## ✅ 快速验证 | Quick Test

```cpp
// 最简测试：拍照+串口输出 | Photo + serial output
void loop() {
    if (Serial.available()) {
        camera_fb_t *fb = esp_camera_fb_get();
        Serial.printf("✅ 拍照成功！尺寸: %d bytes\n", fb->len);
        esp_camera_fb_return(fb);
    }
}
```

---

## 🚀 进阶玩法 | Next Steps

- [ ] 添加骨传导耳机实现语音播报
- [ ] 接入 ESP-SR 实现语音唤醒
- [ ] 实现连续记忆记录（Life Logging）
- [ ] OCR 文字识别（读取菜单/标签）

---

## ❓ 常见问题 | FAQ

<details>
<summary><b>Q: 摄像头初始化失败？</b></summary>

1. 确认使用的是 XIAO ESP32-S3 **Sense** 版（含摄像头）
2. 在 Arduino IDE 选择 PSRAM: Enabled
3. 摄像头排线确认插紧
</details>

<details>
<summary><b>Q: 电池续航多久？</b></summary>

250mAh 电池约 2-3 小时待机，或 30-50 次拍照识别。可通过 deep sleep 延长到 8+ 小时。
</details>

---

*最后更新：2026-06-21 | 基于 OpenGlass 最新版本*
