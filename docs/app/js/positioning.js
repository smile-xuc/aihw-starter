// Curated from the linked repository dossiers; not a live inventory or a product test.
// Developer audience and commercial delivery are independent, overlapping attributes.
export const POSITIONING_REVIEW_DATE = '2026-10-04';
export const CATEGORY_BUSINESS = {
  "01-ipc": "面向家庭看护与安防：摄像头、门铃和 NVR，加上事件理解与订阅服务。",
  "02-ai-glasses": "面向免手持拍摄、视觉问答与翻译：眼镜整机、应用和配套服务。",
  "03-toys-companion": "面向亲子互动与情感陪伴：玩具硬件、角色内容和持续服务。",
  "04-agent-hardware": "面向家庭与办公自动化：设备中枢、Agent 工具和系统集成。",
  "05-desktop-pet": "面向桌面陪伴与互动：机器人整机、表情动作和内容生态。",
  "06-ai-earphone": "面向跨语言交流与随身助手：耳机硬件、翻译应用和服务套餐。",
  "07-recorder": "面向会议与访谈：录音硬件、转写纪要和订阅服务。",
  "08-smart-watch": "面向运动与健康管理：可穿戴设备、数据分析和会员服务。",
  "09-embodied": "面向教育科研与作业场景：机器人本体、软件能力和集成交付。"
};
export const PROJECT_CASES = [
  {
    "id": "wyze-duo-cam-doorbell",
    "category": "01-ipc",
    "title": "Wyze Duo Cam Doorbell",
    "audiences": [
      "commercial"
    ],
    "form": "商业整机＋订阅服务",
    "status": "资料查证时在售",
    "reason": "商业产品卡记录官方商店在售，硬件与包含描述式提醒、AI 视频搜索的 Cam Unlimited Pro 分别定价（查证 2026-09-30）。",
    "boundary": "套餐兼容机型与地区以官方说明为准；本仓尚未实测该整机。",
    "evidence": [
      "awesome/commercial-products/by-category/01-ipc.md",
      "solutions/by-category/01-ipc/04-cases.md"
    ]
  },
  {
    "id": "tapo-d260",
    "category": "01-ipc",
    "title": "Tapo D260",
    "audiences": [
      "commercial"
    ],
    "form": "商业整机＋可选 AI 订阅",
    "status": "资料查证时在售",
    "reason": "官方商品与商店资料提供门铃现价，端侧检测不另收费，云端摘要与 AI Chat 列入 Tapo Care 高级套餐（查证 2026-09-30）。",
    "boundary": "高级 AI 套餐按地区和账号逐步开放，商品在售不表示所有地区均具备相同能力。",
    "evidence": [
      "awesome/commercial-products/by-category/01-ipc.md",
      "solutions/by-category/01-ipc/04-cases.md"
    ]
  },
  {
    "id": "frigate-nvr",
    "category": "01-ipc",
    "title": "Frigate NVR",
    "audiences": [
      "developer",
      "commercial"
    ],
    "form": "开源 NVR 软件",
    "status": "商业集成基础",
    "reason": "已有本地 NVR、目标检测与事件录制完整软件能力，且 SwitchBot 商业产品资料明确写兼容 Frigate，具备商业集成用途。",
    "boundary": "MIT 许可与实际软件能力支持集成判断；具体部署、设备兼容和交付服务仍由集成方验证。",
    "evidence": [
      "awesome/open-source/by-category/01-ipc.md",
      "awesome/commercial-products/by-category/04-agent-hardware.md"
    ]
  },
  {
    "id": "jetson-inference",
    "category": "01-ipc",
    "title": "jetson-inference",
    "audiences": [
      "developer"
    ],
    "form": "推理框架与示例",
    "status": "开发者参考",
    "reason": "项目卡将其定位为 NVIDIA Jetson 推理部署指南与图像分类、检测、分割等示例，适合边缘视觉开发。",
    "boundary": "代码可作为产品组件评估，但本条对象是开发参考，不代表完整摄像头或安防服务产品。",
    "evidence": [
      "awesome/open-source/by-category/01-ipc.md"
    ]
  },
  {
    "id": "ray-ban-meta-gen-2",
    "category": "02-ai-glasses",
    "title": "Ray-Ban Meta Gen 2",
    "audiences": [
      "commercial"
    ],
    "form": "商业眼镜整机",
    "status": "资料查证时在售",
    "reason": "Meta 官方商品与发布资料提供开售和定价证据，形成相机、音频、手机应用与 Meta AI 的商品链路（查证 2026-10-01）。",
    "boundary": "地区服务能力与账号条件以官方说明为准；本仓浏览器验证不替代整机实测。",
    "evidence": [
      "awesome/commercial-products/by-category/02-ai-glasses.md",
      "solutions/by-category/02-ai-glasses/04-cases.md"
    ]
  },
  {
    "id": "rokid-ai-glasses-style",
    "category": "02-ai-glasses",
    "title": "Rokid AI Glasses Style",
    "audiences": [
      "commercial"
    ],
    "form": "商业眼镜整机",
    "status": "资料查证时在售",
    "reason": "官方商店与发布稿记录全球开售、硬件定价和视觉、语音、翻译等功能，是已商品化的无显示 AI 眼镜。",
    "boundary": "产品页、新闻稿与 FAQ 的模型和订阅说明分别引用，不能推定默认模型或尚未公布的未来服务价格。",
    "evidence": [
      "awesome/commercial-products/by-category/02-ai-glasses.md"
    ]
  },
  {
    "id": "openglass",
    "category": "02-ai-glasses",
    "title": "OpenGlass",
    "audiences": [
      "developer"
    ],
    "form": "开源眼镜原型",
    "status": "开发者参考",
    "reason": "项目以 XIAO ESP32-S3 和摄像头改造普通眼镜，提供视觉查询、物体识别等开发参考。",
    "boundary": "MIT 许可不等同于完成佩戴、续航、声学与整机交付验证；现有卡片没有在售产品证据。",
    "evidence": [
      "awesome/open-source/by-category/02-ai-glasses.md"
    ]
  },
  {
    "id": "mentra-os",
    "category": "02-ai-glasses",
    "title": "MentraOS",
    "audiences": [
      "developer",
      "commercial"
    ],
    "form": "跨硬件开源操作系统",
    "status": "商业集成基础",
    "reason": "项目提供跨眼镜硬件的字幕、视角流和应用运行时，可作为眼镜应用及产品集成的软件基础。",
    "boundary": "Apache-2.0 覆盖相应源码；硬件兼容、部署服务及整机销售状态需逐项目核实，不把 OS 当成已交付整机。",
    "evidence": [
      "awesome/open-source/by-category/02-ai-glasses.md"
    ]
  },
  {
    "id": "curio-grem-gabbo",
    "category": "03-toys-companion",
    "title": "Curio Grem / Gabbo",
    "audiences": [
      "commercial"
    ],
    "form": "商业 AI 玩具整机",
    "status": "资料查证时在售",
    "reason": "官网商品、FAQ 和隐私资料提供售价、无屏语音玩具、配套 App 与基础聊天服务证据（查证 2026-09-30）。",
    "boundary": "商业产品属性不代表本仓完成儿童使用、内容审核或长期服务实测；具体产品条款以官方为准。",
    "evidence": [
      "awesome/commercial-products/by-category/03-toys-companion.md",
      "solutions/by-category/03-toys-companion/04-cases.md"
    ]
  },
  {
    "id": "folotoy-teddy-fofo",
    "category": "03-toys-companion",
    "title": "FoloToy 乐乐 / Fofo",
    "audiences": [
      "commercial"
    ],
    "form": "商业 AI 玩具整机＋会员",
    "status": "在售（资料查证时）",
    "reason": "商业产品卡记录官方商店售价与月度会员，完整商品与同品牌自托管服务器应分开判断（查证 2026-09-30）。",
    "boundary": "卡片同时保留历史暂停销售事件，最新售卖状态需再次核实；FoloToy Server 的许可不能替代商品与服务条款。",
    "evidence": [
      "awesome/commercial-products/by-category/03-toys-companion.md",
      "awesome/open-source/by-category/03-toys-companion.md"
    ]
  },
  {
    "id": "xiaozhi-esp32-firmware",
    "category": "03-toys-companion",
    "title": "小智 xiaozhi-esp32 固件",
    "audiences": [
      "developer",
      "commercial"
    ],
    "form": "开源设备固件",
    "status": "商业集成基础",
    "reason": "固件已有语音唤醒、音频链路、多模型和设备协议能力，并以 MIT 开源，可用于开发商业设备的终端基础。",
    "boundary": "商业集成需选择具备相应服务权利与交付能力的后端，并核对 ESP-SR 等组件许可；不能把某个社区后端的限制泛化到全部小智项目。",
    "evidence": [
      "awesome/open-source/by-category/03-toys-companion.md",
      "solutions/by-solution/02-xiaozhi.md"
    ]
  },
  {
    "id": "xiaozhi-community-server",
    "category": "03-toys-companion",
    "title": "xiaozhi-esp32-server 社区后端",
    "audiences": [
      "developer"
    ],
    "form": "开源语音服务端",
    "status": "开发者验证",
    "reason": "所选社区后端提供语音编排与设备管理，但固定版本 README 明示功能未完善、未通过网络安全测评，请勿用于生产。",
    "boundary": "该限制针对这套后端的当前交付条件；MIT 本身不禁止商用，也不能据此认定小智固件或玩具品类仅适合 demo。",
    "evidence": [
      "awesome/open-source/by-category/03-toys-companion.md",
      "solutions/by-solution/02-xiaozhi.md",
      "https://github.com/xinnan-tech/xiaozhi-esp32-server/blob/87c6df77b0220ddbd8fc804f984f83f69f3225e5/README.md"
    ]
  },
  {
    "id": "switchbot-ai-hub",
    "category": "04-agent-hardware",
    "title": "SwitchBot AI Hub",
    "audiences": [
      "commercial"
    ],
    "form": "商业家庭中枢整机＋VLM 服务",
    "status": "资料查证时在售",
    "reason": "美、欧、英官方商店均有商品资料，设备联动、摄像头理解与 VLM 月费有公开依据（查证 2026-09-30）。",
    "boundary": "商品资料同时涉及本地计算和云端服务，不能把整套能力写成全部离线或零云费。",
    "evidence": [
      "awesome/commercial-products/by-category/04-agent-hardware.md",
      "solutions/by-category/04-agent-hardware/04-cases.md"
    ]
  },
  {
    "id": "rabbit-r1",
    "category": "04-agent-hardware",
    "title": "Rabbit R1",
    "audiences": [
      "commercial"
    ],
    "form": "商业口袋 Agent 整机",
    "status": "资料查证时在售",
    "reason": "官方产品页提供售价与 rabbitOS 商品能力，公开季度资料记录出货；早期采用者定位不改变其商业产品属性。",
    "boundary": "第三方 Agent 或进阶能力可能要求自建服务及自带 Key，无强制订阅不等于全部外部调用免费。",
    "evidence": [
      "awesome/commercial-products/by-category/04-agent-hardware.md",
      "solutions/by-category/04-agent-hardware/04-cases.md"
    ]
  },
  {
    "id": "openembodied",
    "category": "04-agent-hardware",
    "title": "OpenEmbodied（机智云）",
    "audiences": [
      "developer",
      "commercial"
    ],
    "form": "开源硬件接入方案",
    "status": "商业集成基础",
    "reason": "项目卡明确定位为面向量产的 ESP32-S3、机智云与 Coze 方案，提供设备接入与语音交互参考。",
    "boundary": "这是上游方案定位，不能写成本仓已完成量产验收；云服务、设备管理及项目交付条件需单独确认。",
    "evidence": [
      "awesome/open-source/by-category/04-agent-hardware.md"
    ]
  },
  {
    "id": "muse-gadget-sdk-token",
    "category": "04-agent-hardware",
    "title": "Muse Gadget SDK＋默认 SDK Token",
    "audiences": [
      "developer"
    ],
    "form": "设备 SDK＋平台接入服务",
    "status": "个人非商业开发",
    "reason": "源码采用 Apache-2.0，但所需 SDK Token 的独立条款限个人非商业使用，并禁止嵌入出售、公开上架或促销设备（查证 2026-10-03）。",
    "boundary": "源码许可不授予平台 Token 权利；商业设备接入须另获许可，不能因 SDK 开源而标成可直接商业化。",
    "evidence": [
      "solutions/by-category/04-agent-hardware/04-cases.md"
    ]
  },
  {
    "id": "emo",
    "category": "05-desktop-pet",
    "title": "EMO（Living.AI）",
    "audiences": [
      "commercial"
    ],
    "form": "桌宠整机",
    "status": "资料查证时在售",
    "reason": "商业产品卡引用官方商店现价，记录表情、自主行为、配件与硬件买断模式。",
    "boundary": "具体大模型方案和销量待核实；本仓未实机测试不改变其在售产品定位。",
    "evidence": [
      "awesome/commercial-products/by-category/05-desktop-pet.md",
      "solutions/by-category/05-desktop-pet/04-cases.md"
    ]
  },
  {
    "id": "stackchan",
    "category": "05-desktop-pet",
    "title": "StackChan（M5Stack）",
    "audiences": [
      "commercial",
      "developer"
    ],
    "form": "可编程桌宠整机",
    "status": "资料查证时在售",
    "reason": "官方商店与文档提供成品价格、App 绑定、语音交互、OTA，以及 Arduino／UiFlow2 二次开发能力。",
    "boundary": "开发者受众与商业在售并存；具体模型、销量及新增产品集成需要分别核对。",
    "evidence": [
      "awesome/commercial-products/by-category/05-desktop-pet.md"
    ]
  },
  {
    "id": "electronbot",
    "category": "05-desktop-pet",
    "title": "ElectronBot（稚晖君）",
    "audiences": [
      "developer"
    ],
    "form": "开源桌面机器人硬件",
    "status": "开发者参考",
    "reason": "开源卡记录 STM32、USB 表情屏、六自由度结构与 GPL-3.0 许可，定位桌宠硬件参考。",
    "boundary": "本仓未提供对应整机销售与交付证据；GPL-3.0 本身不等于禁止商业使用。",
    "evidence": [
      "awesome/open-source/by-category/05-desktop-pet.md"
    ]
  },
  {
    "id": "timekettle-w4-plus",
    "category": "06-ai-earphone",
    "title": "Timekettle W4 Plus（时空壶）",
    "audiences": [
      "commercial"
    ],
    "form": "翻译耳机整机与云服务",
    "status": "资料查证时在售",
    "reason": "商业产品卡引用官方商品页与发售新闻稿，记录买断版、订阅版以及通话和媒体翻译收费方式。",
    "boundary": "功能与服务按地区和套餐区分；仓内百炼同传示例不代表该产品使用百炼，也不替代整机测评。",
    "evidence": [
      "awesome/commercial-products/by-category/06-ai-earphone.md",
      "solutions/by-category/06-ai-earphone/04-cases.md"
    ]
  },
  {
    "id": "openearable",
    "category": "06-ai-earphone",
    "title": "OpenEarable",
    "audiences": [
      "developer"
    ],
    "form": "开源感知耳机平台",
    "status": "开发者参考",
    "reason": "开源卡记录 MIT 许可、自定义 PCB、BLE 与 IMU，能力侧重活动识别、健康监测和手势感知。",
    "boundary": "感知平台不能直接当作大模型翻译耳机；本仓没有对应成品销售与交付证据。",
    "evidence": [
      "awesome/open-source/by-category/06-ai-earphone.md"
    ]
  },
  {
    "id": "rtranslator",
    "category": "06-ai-earphone",
    "title": "RTranslator",
    "audiences": [
      "developer"
    ],
    "form": "开源 Android 翻译软件",
    "status": "开发者参考",
    "reason": "开源卡记录 Apache-2.0 许可、实时翻译能力与蓝牙耳机配合方式，明确其为翻译 App。",
    "boundary": "可以作为耳机场景的软件集成参考，完整耳机硬件、声学和商业服务不由该 App 一并交付。",
    "evidence": [
      "awesome/open-source/by-category/06-ai-earphone.md"
    ]
  },
  {
    "id": "plaud-note",
    "category": "07-recorder",
    "title": "Plaud Note（Plaud）",
    "audiences": [
      "commercial"
    ],
    "form": "录音卡整机与订阅服务",
    "status": "资料查证时在售",
    "reason": "商业产品卡引用官方产品及套餐页，记录现场／通话录音、硬件售价和转写分钟数订阅。",
    "boundary": "官方套餐与模型列表按版本更新；本仓纪要示例的验证状态不代表 Plaud 产品成熟度。",
    "evidence": [
      "awesome/commercial-products/by-category/07-recorder.md",
      "solutions/by-category/07-recorder/04-cases.md"
    ]
  },
  {
    "id": "whisper-cpp",
    "category": "07-recorder",
    "title": "whisper.cpp",
    "audiences": [
      "developer"
    ],
    "form": "开源语音识别推理组件",
    "status": "开发者组件",
    "reason": "开源卡记录 MIT 许可与跨平台 C/C++ 本地 ASR，可作为录音转写和纪要流水线底座。",
    "boundary": "推理组件不是完整录音卡产品；模型文件、设备集成和交付服务需按所选方案核对。",
    "evidence": [
      "awesome/open-source/by-category/07-recorder.md"
    ]
  },
  {
    "id": "omi",
    "category": "07-recorder",
    "title": "Omi（原 Friend）",
    "audiences": [
      "developer"
    ],
    "form": "开源 AI 可穿戴软硬件",
    "status": "开发者参考 · 销售状态待核实",
    "reason": "开源卡记录 MIT 许可、nRF52840 BLE、持续录音转写与 AI 记忆，定位录音卡／胸针参考。",
    "boundary": "本仓尚无对应商业产品卡，不能凭开源身份排除商业化，也不能据此认定成品在售。",
    "evidence": [
      "awesome/open-source/by-category/07-recorder.md"
    ]
  },
  {
    "id": "whoop",
    "category": "08-smart-watch",
    "title": "WHOOP 5.0／MG",
    "audiences": [
      "commercial"
    ],
    "form": "健康腕带与会员服务",
    "status": "资料查证时在售",
    "reason": "商业产品卡引用官网会员方案及 Coach 支持文，记录年费包含设备、运动恢复分析与 AI 教练。",
    "boundary": "会员档位与适用功能应逐项核对；健康建议和本仓日报参考实现均不等于医疗诊断。",
    "evidence": [
      "awesome/commercial-products/by-category/08-smart-watch.md",
      "solutions/by-category/08-smart-watch/04-cases.md"
    ]
  },
  {
    "id": "amazfit-balance-2",
    "category": "08-smart-watch",
    "title": "Amazfit Balance 2",
    "audiences": [
      "commercial"
    ],
    "form": "运动健康手表整机",
    "status": "资料查证时在售",
    "reason": "商业产品卡引用美国官方商店及全球发售新闻稿，记录 Zepp Flow 语音控制和 Zepp Coach 训练计划。",
    "boundary": "部分语音功能限地区，底层模型名未公开；这些信息边界不影响硬件在售定位。",
    "evidence": [
      "awesome/commercial-products/by-category/08-smart-watch.md",
      "solutions/by-category/08-smart-watch/04-cases.md"
    ]
  },
  {
    "id": "infinitime",
    "category": "08-smart-watch",
    "title": "InfiniTime",
    "audiences": [
      "developer"
    ],
    "form": "开源手表固件",
    "status": "开发者参考",
    "reason": "开源卡记录 PineTime／nRF52、GPL-3.0 许可，以及表盘、健康传感和 OTA 能力。",
    "boundary": "固件是可复用技术基础，本仓没有将其证明为完整 AI 健康服务；商业使用需履行对应许可义务。",
    "evidence": [
      "awesome/open-source/by-category/08-smart-watch.md"
    ]
  },
  {
    "id": "unitree-go2",
    "category": "09-embodied",
    "title": "Unitree Go2（宇树）",
    "audiences": [
      "commercial",
      "developer"
    ],
    "form": "四足机器人整机与科研平台",
    "status": "资料查证时在售",
    "reason": "商业产品卡引用官网和官方商店，列出 Air／Pro／X 及 EDU／行业配置，面向消费、教育科研和场景验证。",
    "boundary": "开发能力依配置与 SDK 权限确认；可售四足设备不等于已具备所有通用自主任务。",
    "evidence": [
      "awesome/commercial-products/by-category/09-embodied.md",
      "solutions/by-category/09-embodied/04-cases.md"
    ]
  },
  {
    "id": "lerobot",
    "category": "09-embodied",
    "title": "LeRobot（Hugging Face）",
    "audiences": [
      "developer"
    ],
    "form": "开源机器人学习框架",
    "status": "开发者框架",
    "reason": "开源卡记录 Apache-2.0 许可、硬件无关接口、模仿学习、预训练策略与 Sim-to-Real 能力。",
    "boundary": "学习框架本身不是整机交付方案；具体本体、安全限制和任务验收需另行集成。",
    "evidence": [
      "awesome/open-source/by-category/09-embodied.md"
    ]
  },
  {
    "id": "qwen-robotnav",
    "category": "09-embodied",
    "title": "Qwen-RobotNav",
    "audiences": [
      "developer"
    ],
    "form": "机器人导航研究模型",
    "status": "研究公开 · 权重未开放",
    "reason": "品类方案记录 Go2 部署公开演示，同时明确官方仓库目前没有发布 RobotNav 模型权重的计划。",
    "boundary": "可调用云 API／SDK 仍待核实；公开演示不能据此当作本仓已可接入的产品接口。",
    "evidence": [
      "solutions/by-category/09-embodied/02-solution.md",
      "solutions/by-category/09-embodied/04-cases.md",
      "solutions/by-solution/05-qwen-robot.md"
    ]
  }
];

export const casesFor = category => PROJECT_CASES.filter(p => p.category === category);
