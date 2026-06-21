# 📦 采购指南 | Supply Chain Guide

> AI 硬件元器件采购渠道、价格参考与替代方案

---

## 🇨🇳 中国采购渠道 | China Sourcing

### 推荐优先级 | Priority Order

| 渠道 Channel | 适合 Suitable For | 优势 Pros | 劣势 Cons |
|-------------|------------------|----------|----------|
| **[立创商城](https://www.szlcsc.com/)** | 芯片/电阻/电容/PCB | 正品保障、BOM 一键下单、嘉立创 PCB 打板 | 部分小众元件缺货 |
| **[淘宝](https://taobao.com/)** | 开发板/传感器/舵机/3D 打印件 | 品种最全、价格低 | 质量参差、需甄别 |
| **[华强北](https://www.huaqiangbei.com/)** | 批量元件/紧急采购 | 实体店即时取货 | 需到店、无线上保障 |
| **[嘉立创](https://www.jlcpcb.com/)** | PCB 打样/PCBA 贴片 | 5 片 10×10cm PCB 仅 ¥2、全球发货 | — |
| **[京东](https://jd.com/)** | 树莓派/Jetson/品牌开发板 | 正品、次日达 | 价格偏高 |

### 常用元件参考价 | Common Component Prices

| 元件 Component | 参考价 Price | 渠道 Channel |
|--------------|------------|-------------|
| ESP32-S3-DevKitC | ¥25-40 | 淘宝/立创 |
| ESP32-CAM | ¥30-50 | 淘宝 |
| Raspberry Pi 4B (4GB) | ¥350-450 | 京东/淘宝 |
| Raspberry Pi 5 (8GB) | ¥600-700 | 京东 |
| NVIDIA Jetson Nano 4GB | ¥800-1200 | 淘宝 |
| Feetech STS3215 舵机 | ¥80-120/个 | 淘宝 |
| MG996R 舵机 | ¥15-25/个 | 淘宝 |
| SG90 微型舵机 | ¥3-8/个 | 淘宝 |
| 0.96寸 OLED (I2C) | ¥8-15 | 淘宝/立创 |
| INMP441 I2S 麦克风 | ¥5-15 | 淘宝 |
| MAX98357 I2S 功放 | ¥5-12 | 淘宝 |
| MPU6050 IMU | ¥5-10 | 淘宝/立创 |
| 18650 锂电池 (3000mAh) | ¥10-20 | 淘宝 |
| XIAO ESP32-S3 Sense | ¥45-60 | Seeed 官方/淘宝 |
| RPLidar A1 (2D LiDAR) | ¥500-700 | Slamtec/淘宝 |

---

## 🌍 国际采购渠道 | International Sourcing

| 渠道 Channel | 适合 Suitable For | 优势 | 劣势 |
|-------------|------------------|------|------|
| **[Amazon](https://amazon.com/)** | 开发板/传感器套装 | Prime 次日达 | 价格偏高 |
| **[DigiKey](https://digikey.com/)** | 芯片/元件 | 正品、库存全 | 运费高 |
| **[Mouser](https://mouser.com/)** | 芯片/元件 | 正品、技术文档好 | 运费高 |
| **[Adafruit](https://adafruit.com/)** | 开发板/传感器/教程 | 品质保障、教程全 | 价格高 |
| **[SparkFun](https://sparkfun.com/)** | 开发板/传感器 | 品质保障 | 价格高 |
| **[AliExpress](https://aliexpress.com/)** | 全品类 | 全球发货、价格低 | 物流慢 (2-4 周) |
| **[PCBWay](https://pcbway.com/)** | PCB 打样/3D 打印/CNC | 全球发货、多工艺 | — |

---

## 💡 采购技巧 | Tips

### 中国用户 | For China Users
1. **开发板先买**：ESP32/Raspberry Pi 等核心板先到手，其他元件可以边学边买
2. **BOM 批量**：立创商城支持 BOM 表一键导入，减少多次运费
3. **PCB 打样**：嘉立创新用户首单 5 片 ¥2，适合小批量原型
4. **3D 打印件**：打印啦 (3ddayin.com) 或嘉立创 3D 打印服务，上传 STL 即可

### 国际用户 | For International Users
1. **Starter Kit**：Adafruit/SparkFun 的 starter kit 省去逐个采购的麻烦
2. **AliExpress**：非紧急元件可从 AliExpress 采购，价格低 50-70%
3. **PCBWay**：全球 PCB 打样首选，$5 起 5 片

---

## 🔄 替代方案 | Alternatives

| 原件 Original | 替代 Alternative | 说明 Notes |
|-------------|----------------|----------|
| Raspberry Pi 4B | Orange Pi 5 / Radxa Rock 5 | 国产 SBC，性价比更高 |
| Jetson Nano | Jetson Orin Nano / RDK X5 | Nano 已停产，Orin Nano 是后继 |
| ESP32-S3 | ESP32-C3 / ESP32-C6 | 功能略简但更便宜 |
| Feetech STS3215 | LX-16A / DS3218 | 兼容总线舵机协议 |
| MG996R | DS3218 (20kg) | 更大扭矩，价格相近 |
| RPLidar A1 | YDLIDAR X3 / LidarTOF | 国产替代，价格更低 |

---

## 📊 关税与物流 | Customs & Shipping

| 场景 Scenario | 建议 Recommendation |
|-------------|-------------------|
| 中国→海外发货 | 嘉立创/PCBWay 全球发货，无额外操作 |
| 海外→中国 | DigiKey/Mouser 运费约 $20-40，关税另计 |
| AliExpress 全球 | 大部分免运费，2-4 周到货 |

---

*最后更新：2026-06-21 | 价格仅供参考，以实际购买时为准*
