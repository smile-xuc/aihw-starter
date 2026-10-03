# WEB、费用跑测与 ESP32 项目 review

查证日期：2026-10-04。当前交付是一套可操作的静态 WEB、可执行的 mock/live 费用 runner，以及三条可复核的软硬件设计路线。尚未进行真实模型计费或开发板联调。本轮继续使用同一草稿 PR #60；不合并、不部署。原生 iPhone／Android APP 和实时桌宠后排。

## WEB 交付与费用核对

原有“一看即懂”“会议纪要”保留个人素材、免费样本、预览／停止／重试、配置后返回、结果导出和本机文字历史。新增硬件／跑测导航；手机底部导航，Pad／桌面侧栏；宽屏方案把体验和成本／硬件资料并列展示。手机宽度检查是响应式证据，不能替代实机验收。

费用准备已经可以执行：网页导入用户价格和调用轨迹，CLI 顺序跑固定样本，导出每个场景的脱敏轨迹与总报告。HTTP 错误及流式中断保留请求 ID／已返回的用量；缺计数保留未知，失败不视为免费。mock 排除、重复请求去重、冲突未知、单价有效日期、输入 Token 档位和取整均有回归。完整使用方法及文件格式见 [README](README.md#用户价格与实际成本跑测)。

真实模式仍需用户提供：

- 安全注入的 Key、业务空间和对应地域；不放进聊天、源码或价格文件。
- 官方价格说明／合同版本、生效日期、各模型计价维度；多模态拆分缺计数时保持未知。
- 明确费用上限及账号侧额度，确认计划的单次预留和计费风险。
- 运行后的同范围账单金额，由用户核对账号、空间、地域、时间窗及折扣。

runner 的预算为软预算：一场景可包含多个请求，无法约束服务商单次收费；成本未知／失败／停止后不执行后续场景，不自动重试。账单差额须人工确认范围；导入文件也需核实来源。任何报告都不会把入口改为“已验证”。

## 三条硬件链路

下面金额为人民币**工程规划假设**，非供应商报价、销售价格或量产 BOM。按 1 台原型、120 元／研发小时估算。固件／开源服务端没有按设备软件 License 费；商标、模型服务、第三方组件和产品权利须分别核对。开发板未采购／烧录，未宣称当前仓库已有完整产品固件或网关。

| 项目 | 定位与依据 | 原型材料／台 | 软件与服务预算 | 研发工时／治具 | 分阶段日历时间 |
|---|---|---:|---|---|---|
| 小智 Wi-Fi 语音终端 | 社区 demo；固件及后端 MIT，但选用后端明示勿用于生产；ESP-SR 有芯片限定 | 99–208 | 自建 API 测试服务 100–400／月；模型费待用户价格与实测 | 240–480 小时；治具 3,000–12,000 | 原型 1–2 周；联调 2–4 周；试制准备 6–10 周 |
| ESP-Skainet 离线语音控制 | 商用候选·有条件；ESPRESSIF MIT 只授权用于乐鑫产品，唤醒词权利另审 | 270–517 | 本地推理云费 0；当前 LED 原型无需云服务器 | 160–320 小时；治具 2,000–8,000 | 原型 1–2 周；联调 1–2 周；试制准备 4–8 周 |
| ESP32 Camera 拍照问答 | 商用候选·有条件；驱动 Apache-2.0，完整产品链路待集成 | 74–165 | 设备网关测试服务 80–300／月；模型费待用户价格与实测 | 200–400 小时；治具 2,000–10,000 | 原型 1–2 周；联调 2–3 周；试制准备 4–8 周 |

日历周按有嵌入式／服务端经验的 1–2 人小组、部分并行估算，不能直接乘出工时。采购、返板和认证可能延长周期。计入 12 个月共享测试服务器后，1 台原型的已纳入项小计分别为 33,099–74,608、21,470–46,917、27,034–61,765；其中小智与相机尚缺模型费，完整总额未知。

数量增加只放大材料和逐台调用费；研发／治具和共享服务器不逐设备重复购买。生产 PCB、模具、认证、税运、损耗、移动流量和售后另行报价。网页预算表可编辑数量、工时单价、日调用次数和单次云费，空价格不按 0。

### 小智：语音设备 → 自建服务 → ASR／LLM／TTS → 扬声器

原型 BOM：S3＋PSRAM 板 28–55；I²S 麦克风 8–16；功放 8–15；扬声器 5–12；OLED 15–30；电源／USB 12–25；外壳／按键／线材 23–55。GPIO 与电源依具体板型核对。

按键／WakeNet 收音 → Opus → Wi-Fi WebSocket 或 MQTT＋UDP → 自建后端鉴权与会话 → ASR → LLM → TTS → Opus 下行播放 → 请求 ID／用量／故障日志。先按键收音，确认声学后再接唤醒。网页仅做固定链路演练，不能直接建立此实时语音设备连接。

固件当前要求 ESP-IDF ≥6.0.1，推荐 6.1，5.x 已不支持。固定提交后选择 S3 板型、核对 PSRAM／音频 GPIO，`set-target → menuconfig → build flash monitor`。社区服务端先用隔离测试实例，API-only 参考 2 核 2GB；模型 Key 留在服务端。连续 30 次对话核对文字、声音、请求 ID，并验收静音／打断／断网／重连、声学回声、设备身份与 OTA 回滚。

社区后端原文：“功能未完善，且未通过网络安全测评，请勿在生产环境中使用”。因此当前链路定为社区 demo；若做产品，需要独立生产服务的鉴权、配额、租户隔离和交付验收。

依据：[固件 README（0d576d3）](https://github.com/78/xiaozhi-esp32/blob/0d576d3d4c049c6f55eaf879725dc23e516511b4/README.md)、[MIT](https://github.com/78/xiaozhi-esp32/blob/0d576d3d4c049c6f55eaf879725dc23e516511b4/LICENSE)、[社区服务端 README（87c6df7）](https://github.com/xinnan-tech/xiaozhi-esp32-server/blob/87c6df77b0220ddbd8fc804f984f83f69f3225e5/README.md)、[MIT](https://github.com/xinnan-tech/xiaozhi-esp32-server/blob/87c6df77b0220ddbd8fc804f984f83f69f3225e5/LICENSE)。

### ESP-Skainet：离线语音 → 命令白名单 → LED → ACK

原型 BOM：S3-Korvo-1 音频套件（含音频输入）220–420；外接 4–6 Ω 扬声器 5–12；电源 20–35；USB／调试线 10–20；LED／电阻／外壳 15–30。扬声器依官方示例要求单列，套件内麦克风不重复计费。

麦克风 → AFE／WakeNet → MultiNet 命令 ID → 本地白名单／防重复 → LED 状态 → 串口 ACK。不加云推理，先用 LED 验证控制。进入固定提交的 `examples/cn_speech_commands_recognition`；组件声明 ESP-SR `~2.4.7`、led_strip `^3.0.0`。按该示例的实际工具链／组件要求建环境，不和小智 IDF 6.1 混装。

把命令 ID 映射到 LED、增加去重与 ACK 属于集成工作，尚未交付固件。验收至少 100 条语音的命中／拒识／误唤醒、不同距离与噪声、断网运行和掉电恢复。进一步接电机／继电器需要另做硬件工程。

许可为 **ESPRESSIF MIT**，正文限定用于 “ESPRESSIF SYSTEMS products”；不能标成无条件通用 MIT。ESP-SR 的商用唤醒词／商标需拥有或取得授权。乐鑫芯片上的组件可作商用候选，仍无实机或量产证明。

依据：[官方 README（4f3d825）](https://github.com/espressif/esp-skainet/blob/4f3d8252373fdbbec7c20add928ff084aeff4066/README.md)、[许可](https://github.com/espressif/esp-skainet/blob/4f3d8252373fdbbec7c20add928ff084aeff4066/LICENSE)、[中文命令示例](https://github.com/espressif/esp-skainet/blob/4f3d8252373fdbbec7c20add928ff084aeff4066/examples/cn_speech_commands_recognition/README.md)、[组件要求](https://github.com/espressif/esp-skainet/blob/4f3d8252373fdbbec7c20add928ff084aeff4066/examples/cn_speech_commands_recognition/main/idf_component.yml)、[ESP-SR README（7658101）](https://github.com/espressif/esp-sr/blob/76581015af7075681814627a5bb03d2f3f328f8a/README.md)、[许可](https://github.com/espressif/esp-sr/blob/76581015af7075681814627a5bb03d2f3f328f8a/LICENSE)。

### ESP32 Camera：JPEG → 网页验证 → 产品 HTTPS 网关

原型 BOM：S3＋PSRAM 摄像头板及 OV2640 50–110；电源／USB 12–25；按键／LED／外壳 12–30。

原型路线：按键采集 JPEG → PSRAM → 手工导出文件 → 上传现有“一看即懂” → 问题／模型回答 → 文字结果／调用证据。网页上传链路已经具备；尚未采集实机照片。产品路线需要设备 HTTPS 网关、设备鉴权／去重／配额、结果回传；静态 PWA 不能替代网关，云 Key 不烧进固件。

IDF 添加 esp32-camera，Arduino-ESP32 已含驱动；按真实板型核对 pins 和 PSRAM。先单帧 JPEG，再评估持续捕获；官方说明大部分分辨率需要 PSRAM，Wi-Fi＋RGB／YUV 更容易造成内存压力。验收光照／连续捕获、JPEG 解码及 ≤7 MiB、超时、功耗、照片同意／删除与设备 ACK。

Apache-2.0 可用于商业评估，但只覆盖驱动；所选框架、照片／镜头／模型服务、网关和产品可靠性仍需核对。这是商用候选，未声称完整产品已交付。

依据：[驱动 README（2bba0d1）](https://github.com/espressif/esp32-camera/blob/2bba0d1d57219ddacd18d2c5701927e1884a51d1/README.md)、[Apache-2.0](https://github.com/espressif/esp32-camera/blob/2bba0d1d57219ddacd18d2c5701927e1884a51d1/LICENSE)。

## 全部可上手项目的定位

范围：注册表 9 个百炼参考项目、10 个专题 demo、视频配音、benchmark 工具组，以及本轮 3 个硬件设计项目。9 个参考项目共 11 个回放玩法，变体继承项目定位。本表不替代仓库中另有来源的商业产品卡。

| 项目／入口 | 定位 | 当前商业化缺口 |
|---|---|---|
| 01 IPC 百炼事件理解 | 社区 demo | 官方接口／账单；真实视频接入及生产服务 |
| 02 AI 眼镜百炼一看即懂 | 社区 demo | 官方多模态／播报／账单；设备链路 |
| 03 AI 玩具百炼实时语音 | 社区 demo | 原生实时连接、儿童产品与实机交付 |
| 04 Agent 硬件百炼工具编排 | 社区 demo | 官方调用、设备执行权限和状态回执 |
| 05 桌宠百炼实时语音／记忆 | 社区 demo | 实时设备协议、记忆边界和产品长稳 |
| 06 AI 耳机百炼实时同传 | 社区 demo | 实时声学、物理设备和官方计费 |
| 07 录音卡百炼纪要 | 社区 demo | 官方转写末句／账单、设备录音链路 |
| 08 智能手表百炼日报 | 社区 demo | 数据接入、用户健康风险与设备可靠性 |
| 09 具身百炼看图规划 | 社区 demo | 当前动作模拟，真实执行器与安全验证 |
| physical-sense | 社区 demo | 真实事件流、误报和交付服务 |
| kit-chat | 社区 demo | 套件权限／费用、完整设备交付 |
| omni-realtime | 社区 demo | 真实会话、设备声学和生产服务 |
| voice-clone | 社区 demo | 说话人权利、儿童产品、服务交付 |
| intent-router | 社区 demo | 意图示例、设备执行／状态协议 |
| stream-tag-parser | 社区 demo | 标签解析组件，非完整桌宠 |
| livetranslate-ws | 社区 demo | 实际语音／网络／耳机验收 |
| map-reduce-summary | 社区 demo | 长录音实测、失败恢复与账单 |
| metrics-prompt | 社区 demo | 提示示例、真实数据／健康风险 |
| vla-intent-router | 社区 demo | 技能计划／安全门示例，非真实机器人 |
| 视频翻译配音 | 社区 demo | 真实配音／计费、声音授权与生产服务 |
| benchmark（全部测量脚本） | 社区 demo／工具 | 样本测量不是产品 SLA；各实时接口待验证 |
| 小智＋所选社区后端 | 社区 demo | 上游生产限制、设备联调、服务重做 |
| ESP-Skainet LED 控制 | 商用候选·有条件 | 乐鑫限定／唤醒词许可、固件集成与实机验收 |
| ESP32 Camera JPEG 问答 | 商用候选·有条件 | 驱动之外的网关／设备固件／照片与产品验收 |

商用候选表示核心组件值得继续评估，不表示任何路线已能量产或直接售卖。定位在网页方案／专题入口与硬件页显示；独立配音及 benchmark 文档也作了标注。

## 本轮验收与下一轮

自动化证据记录于 [VERIFY_BROWSER](VERIFY_BROWSER.md)。本轮完成 WEB 与本地 mock 逻辑；保留所有“待真 Key 验证”和“实机待验证”标记。

下一轮先用用户价格／凭证／额度跑两个精选样本，用户核对账单；再选硬件路线采购／烧录，取得串口、图像或声学证据。物理 iPhone／Android、原生 APP、实时桌宠与更多技术栈继续后排。
