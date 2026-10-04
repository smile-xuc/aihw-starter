# 品类、项目与验证：分别判断

九个品类都是商业化方向。品类回答面向什么客户、解决什么需求、如何形成收入；其中具体项目再区分开发者参考、可用于商业集成的组件，以及已形成商品的整机或服务。项目面向开发者和项目已经商业化可以同时成立，例如开源且公开销售的 StackChan。

本文于 2026-10-04 复核**仓内已有资料与引用**，未对所有上游官网重新查证。商品是否在售、服务是否继续和具体许可版本，以各引用卡片的查证日期及原始来源为准；未知项继续保留未知。这里没有新增实机测试或销售数据。

## 判断规则

| 层次 | 要回答的问题 | 页面表达 |
|---|---|---|
| 品类 | 客户、场景、商业模式是什么？ | IPC、AI 眼镜、AI 玩具、Agent 硬件、桌宠、AI 耳机、录音纪要、健康可穿戴、具身智能；均按商业化方向组织 |
| 具体项目 | 交付什么，谁能使用，商业条件是什么？ | 写明整机、开发套件、组件、平台、参考代码或设计；开发者用途与商业用途可同时出现 |
| 本仓验证 | 本仓实际运行或测量过什么？ | 回放可用、网页可运行、待真实调用、实机待验证；只描述本仓证据 |

具体项目采用以下判断：

1. **开发者项目**：交付示例、原型、研究工具、SDK 或开发平台，供学习与二次开发。这个标签说明使用对象，不表示禁止商业使用。
2. **可商业化项目**：有明确的产品交付或商业集成路径。整机／服务的商品事实与组件可用于商业产品分别说明，不能只凭一项开源许可就认定完整产品成熟。已有公开销售资料时可附“已销售”；预售、众筹、停售和停止服务保留各自状态。
3. **商业条件待核实**：许可证、关键服务条款或交付依据不完整时，写明具体未知项，不用“可直接商用”补齐信息，也不因此把所在品类降为 demo。

**许可和交付对象要对齐。** MIT、Apache-2.0 通常允许遵守条件后的商业使用，但不代表完整产品已经完成可靠性、售后或设备集成。GPL／AGPL 不等于禁止商用，其适用的源码提供等义务须按版本与使用方式处理。硬件、固件、模型权重、素材、平台 Token、云服务可以使用不同条款，源码许可不能替代其他层的授权。例如本仓 Muse 案例记录 SDK 源码 Apache-2.0，但默认 SDK Token 的独立条款限制个人非商业用途。

**验证不能代替商业判断。** 没有 Key、只运行 mock、尚未采购开发板，意味着本仓缺少对应调用或实机证据；不能推出上游项目没有商业能力。真实调用一次成功，也不能推出完整设备已经具备商业交付条件。九个百炼参考实现采用文件或模拟设备，是其交付范围，不是九个品类的等级。

## 九个品类中的具体例子

下表各列可以重叠，并非互斥的高低等级。商业例子依据仓内产品卡所保留的公开商品、服务和来源信息；开发者例子依据仓内项目卡对代码、组件、原型或框架的描述。链接均指向已有证据，不表示本仓重新测试了对应产品。

| 商业化品类 | 商业项目／商业集成例子 | 开发者项目例子 | 判断要点与仓内依据 |
|---|---|---|---|
| 01 IPC／AI 视觉 | Wyze Duo Cam Doorbell：门铃硬件与 Cam Unlimited Pro 服务；Frigate：可集成的开源 NVR 软件 | jetson-inference：Jetson 推理指南与视觉示例 | [商业产品](../../awesome/commercial-products/by-category/01-ipc.md)、[开源项目](../../awesome/open-source/by-category/01-ipc.md)。门铃商品、NVR 软件和推理示例是不同交付对象；套餐能力按地区与机型区分。 |
| 02 AI 眼镜 | Ray-Ban Meta Gen 2：眼镜整机、手机应用与 AI 服务 | OpenGlass：基于 XIAO ESP32-S3 的开源眼镜原型 | [商业产品](../../awesome/commercial-products/by-category/02-ai-glasses.md)、[开源项目](../../awesome/open-source/by-category/02-ai-glasses.md)。OpenGlass 的原型身份不影响眼镜品类商业化；MIT 本身也不证明原型已有佩戴、续航和整机交付能力。 |
| 03 AI 玩具／陪伴 | Curio Grem／Gabbo：玩具整机与配套服务；小智固件：商业设备可用的终端基础 | 小智社区后端：语音编排与设备管理的开发验证组合 | [商业产品](../../awesome/commercial-products/by-category/03-toys-companion.md)、[开源项目](../../awesome/open-source/by-category/03-toys-companion.md)、[小智分层导读](../../solutions/by-solution/02-xiaozhi.md)。小智固件、具体社区后端和托管服务分别判断，不能互相代替许可或生产条件。 |
| 04 Agent 硬件 | SwitchBot AI Hub：家庭中枢整机与 VLM 服务；OpenEmbodied：上游定位面向量产的硬件接入方案 | Muse Gadget SDK＋默认 SDK Token：当前条款下的个人非商业开发组合 | [商业产品](../../awesome/commercial-products/by-category/04-agent-hardware.md)、[开源项目](../../awesome/open-source/by-category/04-agent-hardware.md)、[Muse 案例与 Token 条款](../../solutions/by-category/04-agent-hardware/04-cases.md)。SDK 开源不自动授予商业平台接入权；方案商量产定位也不等于本仓完成量产验收。 |
| 05 桌宠 | StackChan：公开销售、软硬件开源且可二次开发的桌面机器人 | ElectronBot：表情屏与动作硬件参考；StackChan 同样面向开发者 | [商业产品](../../awesome/commercial-products/by-category/05-desktop-pet.md)、[开源项目](../../awesome/open-source/by-category/05-desktop-pet.md)。StackChan 同时具有开发者用途和商业产品属性，是二者不互斥的直接例子；ElectronBot 的 GPL-3.0 不能解读成禁止商用。 |
| 06 AI 耳机 | Timekettle WT2 Edge／W3：耳机整机与手机翻译应用 | RTranslator：可配合蓝牙耳机的开源翻译 App；OpenEarable：耳部感知开发平台 | [商业产品](../../awesome/commercial-products/by-category/06-ai-earphone.md)、[开源项目](../../awesome/open-source/by-category/06-ai-earphone.md)。翻译 App、传感平台与可购买耳机分别描述，不把软件参考当成耳机整机。 |
| 07 录音卡／会议盒子 | Plaud Note：硬件销售与转写／摘要套餐 | whisper.cpp：本地语音识别组件；本仓 map-reduce-summary：长录音摘要示例 | [商业产品](../../awesome/commercial-products/by-category/07-recorder.md)、[开源项目](../../awesome/open-source/by-category/07-recorder.md)、[品类参考实现](../../solutions/by-category/07-recorder/README.md)。组件和示例可进入商业流水线；它们自身不等于完整录音设备与订阅服务。 |
| 08 智能手表／健康可穿戴 | WHOOP 5.0／MG：可穿戴硬件与会员服务 | InfiniTime：PineTime 社区固件；Open-Smartwatch OS：开源手表系统 | [商业产品](../../awesome/commercial-products/by-category/08-smart-watch.md)、[开源项目](../../awesome/open-source/by-category/08-smart-watch.md)。固件的开发者定位与商业使用权限分别判断；GPL 不等于非商业许可，健康解读能力也不自动代表医疗用途资质。 |
| 09 具身智能 | Unitree Go2：销售中的机器人本体；Universal Robots e-Series：协作臂与集成商交付 | LeRobot：机器人学习框架；SO-ARM100／SO-101：开源机械臂与训练参考 | [商业产品](../../awesome/commercial-products/by-category/09-embodied.md)、[开源项目](../../awesome/open-source/by-category/09-embodied.md)。本体销售、训练框架和具体作业单元分别判断，不能因本仓只做模拟动作就把上游本体列为 demo。 |

品类的商业模式与客户背景见 [按品类总览](../../solutions/by-category/README.md)；商品收录规则见 [商业产品库](../../awesome/commercial-products/README.md)。开发者项目的名称、主品类与技术描述沿用 [开源项目库](../../awesome/open-source/README.md)。正式采购或集成时再按所选版本、地区和服务合同核实商业条件。

## 三条 ESP32 路线如何分层

本轮硬件页的交付对象是三条**参考设计与预算**，并非新上架的完整设备。它们所采用的上游代码和组件具有各自商业条件；本仓设计当前完成到哪一步另行列示。

| 路线 | 上游可用基础与商业条件 | 本仓当前参考设计与验证 |
|---|---|---|
| 小智 Wi-Fi 语音终端 | 小智固件以 MIT 提供语音、协议和设备能力，可作为商业设备基础；ESP-SR 等依赖按各自许可。所选 `xinnan-tech/xiaozhi-esp32-server` 固定版本明示勿用于生产，此限制适用于该后端，并不禁止其他生产后端或小智固件商业集成。 | 提供 BOM、固件构建路径、端云链路与固定演练。社区后端组合用于开发验证；产品路线需另选或自建生产服务。本仓尚未烧板或验证对话链路。 |
| ESP-Skainet 离线语音控制 | ESP-SR／ESP-Skainet 的 ESPRESSIF MIT 限用于乐鑫产品，商用唤醒词与商标权利另核对；满足条件的组件可用于商业集成。官方示例是开发起点。 | 提供中文命令 → 白名单 → LED → ACK 的设计与预算；LED 映射、防重复和回执仍是集成工作，尚无烧录和误触发率实测。 |
| ESP32 Camera 拍照问答 | esp32-camera 驱动 Apache-2.0 可用于商业集成；许可范围是驱动。固件框架、云服务和完整设备各有交付条件。 | 提供 JPEG 捕获 → 导出 → 网页问答的参考设计；网页上传能力已实现，设备采集尚未实测，产品 HTTPS 网关与设备回传尚待集成。 |

上述固定版本 README、许可正文与构建依据见 [本轮 review 的硬件链路](ITERATION_REVIEW.md#三条硬件链路)。小智的固件、组件、托管云和自建后端分层也见 [小智方案导读](../../solutions/by-solution/02-xiaozhi.md#2-仓库与部署形态)。这些条件应写在相应组件或组合旁，不能把后端的一条限制扩展为整个生态的商业结论。

## 页面与文档的使用方式

- 品类卡展示场景和项目入口，不继承第一个参考实现的开发者标签或待验证状态。
- 项目卡写明交付对象、开发者／商业用途、依据及适用条件。一个项目可以同时出现在两种用途筛选中；开源或面向开发者不构成商业化的反义词。
- 本仓体验和硬件演练单列验证状态。免费回放只说明当前展示的运行模式；真实 Key 与实机进度只说明本仓证据。
- 对参考脚本保留“示例”“demo”等准确技术名称，但不把这些名称用作商业品类或整个上游生态的评级。

自动化验证范围见 [VERIFY_BROWSER](VERIFY_BROWSER.md)；本轮实际交付和后续验证项见 [ITERATION_REVIEW](ITERATION_REVIEW.md)。项目定位的变化不得把尚未完成的验证标成已完成。
