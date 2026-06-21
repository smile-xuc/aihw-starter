# 🛒 ESP32 语音助手 BOM | xiaozhi-esp32

> 总成本 ~¥72-300（视配置）| Total cost ~$10-42

---

## 核心元件 | Core Components

| # | 元件 Component | 型号 Model | 数量 Qty | 单价 Unit | 小计 Subtotal | 采购建议 Sourcing |
|---|---------------|-----------|---------|----------|-------------|------------------|
| 1 | ESP32-S3 开发板 | ESP32-S3-DevKitC-1 N16R8 | 1 | ¥35 | ¥35 | [立创](https://www.szlcsc.com/) / 淘宝 |
| 2 | I2S 麦克风 | INMP441 | 1 | ¥10 | ¥10 | 淘宝 |
| 3 | I2S 功放 | MAX98357A | 1 | ¥8 | ¥8 | 淘宝 |
| 4 | 喇叭 | 4Ω 3W (28mm) | 1 | ¥5 | ¥5 | 淘宝 |
| 5 | 按钮开关 | 6×6mm 微动按钮 | 1 | ¥1 | ¥1 | 淘宝 |
| 6 | 杜邦线 | 母对母 20cm | 10根 | ¥0.3 | ¥3 | 淘宝 |
| 7 | USB-C 数据线 | 编程+供电 | 1 | ¥10 | ¥10 | 京东/淘宝 |
| | **基础合计** | | | | **¥72** | |

## 可选升级 | Optional Upgrades

| # | 元件 | 型号 | 参考价 | 说明 |
|---|------|------|--------|------|
| A | OLED 屏 | 0.96寸 I2C SSD1306 | ¥10 | 显示对话文本 |
| B | 摄像头 | ESP32-CAM / XIAO Sense | ¥30-55 | 视觉问答（VLM） |
| C | 外壳 | 3D 打印 | ¥30 | 桌面伴侣外观 |
| D | 电池 | 3.7V 1000mAh + TP4056 | ¥15 | 便携供电 |

## 推荐套件 | Recommended Kit

| 套件 Kit | 包含 Includes | 价格 Price | 链接 Link |
|---------|-------------|----------|----------|
| xiaozhi 官方推荐套件 | ESP32-S3 + INMP441 + MAX98357 + 喇叭 | ¥68-99 | 淘宝搜"小智 AI 语音助手套件" |
| 完整版 | 基础套件 + OLED + 电池 + 外壳 | ¥150-200 | 淘宝 |

---

## 接线速查 | Quick Wiring Reference

```
ESP32-S3 Pin    →    INMP441
  GPIO4 (WS)    →    WS (LRCL)
  GPIO5 (BCLK)  →    SCK
  GPIO6 (DIN)   →    SD (DOUT)
  3V3           →    VDD
  GND           →    GND + L/R

ESP32-S3 Pin    →    MAX98357A
  GPIO15 (DOUT) →    DIN
  GPIO16 (BCLK) →    BCLK
  GPIO7 (WS)    →    LRC
  5V (VIN)      →    VIN
  GND           →    GND
  → 喇叭接 SPK+/SPK-

ESP32-S3 Pin    →    Button
  GPIO0         →    [按钮] → GND
```

---

*价格采集日期：2026-06-21 | 以实际购买时为准*
