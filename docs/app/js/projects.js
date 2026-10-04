// Public-source facts are pinned; prices and schedules are editable planning assumptions.
export const REVIEW_DATE = '2026-10-04';
const source = (repo, commit, path, title) => ({title, url:'https://github.com/'+repo+'/blob/'+commit+'/'+path, commit});
export const POSITION = {
  reference: {label:'开发者参考实现', note:'仅描述本仓这份百炼示例代码的交付范围；所属品类与上游项目的商业化定位分别判断，实际调用与实机验证状态另列。', cls:'accent'},
  design: {label:'本仓参考设计', note:'本仓提供链路、预算与验收计划；上游商业集成基础、选用组合条件和本仓验证进度分别说明。', cls:'accent'},
  unassessed: {label:'未评估', note:'尚未评估该具体实现的交付范围；不能从所属品类、代码许可或本仓验证状态推断其商业化定位。', cls:'warn'},
};
const referenceIds = new Set([
  '01-ipc.bailian','02-ai-glasses.bailian','03-toys-companion.bailian',
  '04-agent-hardware.bailian','05-desktop-pet.bailian','06-ai-earphone.bailian',
  '07-recorder.bailian','08-smart-watch.bailian','09-embodied.bailian',
]);
export const referencePosition = solution => referenceIds.has(solution?.id) ? POSITION.reference : POSITION.unassessed;
export const PROJECTS = [
  {
    id:'xiaozhi-voice', title:'小智 · Wi-Fi 语音终端', category:'03-toys-companion', scene:'03-toys-companion.bailian', variant:'default',
    summary:'按键或唤醒词收音，流式送到自有服务端，经 ASR → LLM → TTS 返回扬声器。',
    assessment:{
      upstream:'小智固件已有设备语音与协议能力，MIT 允许商业使用，可作为商业设备的终端基础。',
      combination:'本设计选用的社区后端在固定版本明确提示“请勿在生产环境中使用”；这个限制只作用于该后端组合，产品服务需另行选型与验收。',
      delivery:'本仓已提供参考链路、预算和固定事件演练；尚未烧录设备、连接实际语音服务或完成整机交付。',
    },
    license:'固件 MIT；社区服务端 MIT；ESP-SR 为 ESPRESSIF MIT（限定乐鑫产品）',
    licenseNote:'小智固件 MIT 许可允许商业使用，须保留许可并分别核对 ESP-SR 等组件条件。所选社区后端的生产限制不适用于所有小智项目；产品服务应另行完成鉴权、配额、租户隔离与交付验收。',
    sources:[
      source('78/xiaozhi-esp32','0d576d3d4c049c6f55eaf879725dc23e516511b4','README.md','固件功能、板卡与 IDF 要求'),
      source('78/xiaozhi-esp32','0d576d3d4c049c6f55eaf879725dc23e516511b4','LICENSE','固件 MIT'),
      source('xinnan-tech/xiaozhi-esp32-server','87c6df77b0220ddbd8fc804f984f83f69f3225e5','README.md','社区后端、部署与生产限制'),
      source('xinnan-tech/xiaozhi-esp32-server','87c6df77b0220ddbd8fc804f984f83f69f3225e5','LICENSE','后端 MIT'),
    ],
    board:'ESP32-S3 + PSRAM 开发板；I²S 麦克风、功放和扬声器；GPIO 按具体板型接线。',
    bom:[['S3 + PSRAM 开发板',28,55],['I²S 麦克风',8,16],['I²S 功放',8,15],['扬声器',5,12],['OLED 显示屏',15,30],['5V 电源与 USB 线',12,25],['外壳、按键、线材',23,55]],
    chain:['按键／WakeNet 收音','ESP32-S3 编码 Opus','Wi-Fi + WebSocket／MQTT+UDP','自建后端鉴权／会话','ASR → LLM → TTS','Opus 下行 → 扬声器','请求 ID、用量与故障日志'],
    tasks:[
      ['原型',1,2,'固件板型与声学连通；只做按键收音，确认回声与噪声。'],
      ['链路联调',2,4,'自建后端、超时重连、用户 Key、ASR/LLM/TTS 用量记录；核对连续 30 次对话。'],
      ['试制准备',6,10,'PCB/声学/电源迭代、租户鉴权、OTA 回滚、长稳与隐私；需另行评估量产。'],
    ],
    hours:[240,480], serverMonthly:[100,400], tooling:[3000,12000],
    build:[
      '固件按上述固定提交取代码；初始化 ESP-IDF 6.1（上游当前要求 ≥6.0.1，5.x 已不支持）。',
      '选择匹配实物的 S3 板型，核对 PSRAM、音频 GPIO 和电源；idf.py set-target esp32s3 → menuconfig → build flash monitor。',
      '社区后端按固定提交的部署文档使用隔离测试实例；API 方案参考 2 核 2GB。配置服务端模型凭证，不把云 Key 烧进固件。',
      '配网并连接自建端点；分别验证收音、ASR、文本、TTS、回放、停止、断网与重连。',
    ],
    acceptance:['30 次对话的文本/语音/请求 ID 对齐','静音、打断、断网不重复计费重试','声学回声和音量实测','设备身份、OTA 回滚和多租户隔离'],
    gaps:['本仓网页只回放这条实时链路，不能直接建立该设备 WebSocket','尚未烧录或测量这套硬件','社区后端不具备已验证的生产交付条件'],
    sample:['用户按键：“今天几点开会？”','设备上传 Opus（演练）','后端返回示例文本与语音事件（演练）','设备播放并确认结束（演练）'],
  },
  {
    id:'skainet-control', title:'ESP-Skainet · 离线语音控制', category:'04-agent-hardware', scene:'04-agent-hardware.bailian', variant:'offline',
    summary:'麦克风 → AFE/WakeNet/MultiNet → 白名单命令 → LED → 状态回执；推理留在设备上。',
    assessment:{
      upstream:'ESP-Skainet 与 ESP-SR 提供离线语音组件，在乐鑫产品上可按相应许可用于商业集成。',
      combination:'S3-Korvo-1、离线命令与 LED 回执仍需集成；芯片限定、模型、唤醒词和商标权利须逐项核对。',
      delivery:'本仓已提供参考链路、BOM 与演练；LED 映射、状态协议和产品 OTA 尚未交付，实机识别与可靠性待验证。',
    },
    license:'ESPRESSIF MIT：仅授权用于乐鑫产品，非无条件的通用 MIT',
    licenseNote:'乐鑫芯片路线可评估商业使用，须保留许可并核对 ESP-SR、模型、唤醒词与商标授权。先控制 LED；继电器、电机等执行器需要独立工程设计。',
    sources:[
      source('espressif/esp-skainet','4f3d8252373fdbbec7c20add928ff084aeff4066','README.md','官方示例、支持板卡与模型'),
      source('espressif/esp-skainet','4f3d8252373fdbbec7c20add928ff084aeff4066','LICENSE','ESPRESSIF MIT 的芯片限定'),
      source('espressif/esp-skainet','4f3d8252373fdbbec7c20add928ff084aeff4066','examples/cn_speech_commands_recognition/README.md','中文命令示例与外接扬声器要求'),
      source('espressif/esp-sr','76581015af7075681814627a5bb03d2f3f328f8a','README.md','MultiNet 与唤醒词权利说明'),
      source('espressif/esp-sr','76581015af7075681814627a5bb03d2f3f328f8a','LICENSE','语音组件许可'),
    ],
    board:'ESP32-S3-Korvo-1 音频开发套件；其音频输入已包含在套件成本中。',
    bom:[['S3-Korvo-1 音频套件（含音频输入）',220,420],['4–6 Ω 外接扬声器',5,12],['5V 电源',20,35],['USB 线与调试线',10,20],['LED、限流电阻和原型外壳',15,30]],
    chain:['麦克风输入','AFE 降噪／WakeNet','MultiNet 离线命令 ID','本地白名单＋防重复触发','LED 状态改变','串口事件与状态回执'],
    tasks:[
      ['原型',1,2,'官方中文命令示例；核对音频板型、模型分区与 LED 回执。'],
      ['链路联调',1,2,'命令白名单、误触发率、不同距离与噪声、掉电恢复。'],
      ['试制准备',4,8,'定制板/麦阵、声学标定、离线升级与寿命验证；非官方交付承诺。'],
    ],
    hours:[160,320], serverMonthly:[0,0], tooling:[2000,8000],
    build:[
      '按固定提交取 ESP-Skainet，进入 examples/cn_speech_commands_recognition；使用该示例实际声明的 IDF/依赖，不按小智的 IDF 版本混装。',
      '根据官方 S3-Korvo-1 板卡说明选择音频板型与模型；idf.py set-target esp32s3 → menuconfig → build flash monitor。',
      '把命令 ID 映射到 LED 白名单，增加防重复触发与 ACK；这一步是项目集成工作，不是上游开箱即有的产品。',
      '拔掉 Wi-Fi 后重复命令并保留串口日志，验证无云端依赖；网页的断网回放用于先理解规则。',
    ],
    acceptance:['≥100 条语音：命中、拒识、误唤醒分别统计','断网后命令与 ACK 正常','掉电/重复命令不会误动作','芯片限定许可与唤醒词权利核查'],
    gaps:['当前未对真实开发板烧录或测误触发','LED 映射、状态协议和产品 OTA 需集成','本地推理云费为零不代表硬件、研发和运维零成本'],
    sample:['“打开客厅灯”（固定演练）','MultiNet → 允许的命令 ID（演练）','本地白名单通过，LED 打开（演练）','状态 ACK：on（演练）'],
  },
  {
    id:'camera-question', title:'ESP32 Camera · 拍照问答终端', category:'02-ai-glasses', scene:'02-ai-glasses.bailian', variant:'default',
    summary:'相机捕获 JPEG，经本机导出与网页上传验证；产品路线经自有 HTTPS 网关调用模型并回传结果。',
    assessment:{
      upstream:'esp32-camera 具备传感器驱动与 JPEG 捕获能力，Apache-2.0 允许商业使用，可作为摄像设备的软件组件。',
      combination:'驱动之外还需摄像头固件、设备 HTTPS 网关、身份认证与结果回传；组件许可不等于完整设备交付。',
      delivery:'本仓网页已有照片上传与问答入口；本设计尚未采集实机照片，设备固件、网关和功耗验证仍待完成。',
    },
    license:'esp32-camera 驱动 Apache-2.0；选用的固件框架和第三方组件另行核对',
    licenseNote:'驱动具备可评估商用的许可条件，但摄像头固件、云网关、设备认证、照片隐私和镜头授权没有随驱动交付。不能把驱动直接标成完整可售产品。',
    sources:[
      source('espressif/esp32-camera','2bba0d1d57219ddacd18d2c5701927e1884a51d1','README.md','芯片/传感器、PSRAM 与 JPEG 约束'),
      source('espressif/esp32-camera','2bba0d1d57219ddacd18d2c5701927e1884a51d1','LICENSE','Apache-2.0'),
    ],
    board:'ESP32-S3 + PSRAM 摄像头开发板，OV2640；按板卡实际排线与 GPIO 配置。',
    bom:[['S3 PSRAM 摄像头板 + OV2640',50,110],['5V 电源与 USB 线',12,25],['按键、状态 LED 与外壳',12,30]],
    chain:['按键拍照','OV2640 → PSRAM JPEG','开发阶段导出 JPEG 文件','一看即懂上传＋问题','官方模型回答／可选播报','文字导出、请求 ID 与用量','产品化：设备 HTTPS 网关＋鉴权／重试'],
    tasks:[
      ['原型',1,2,'匹配板卡 pins/PSRAM，捕获可解码 JPEG；网页上传校验。'],
      ['链路联调',2,3,'产品 HTTPS 网关、设备认证、照片缩放与超时、回传与用量记录。'],
      ['试制准备',4,8,'镜头/外壳/光照、功耗/长稳、OTA 与隐私；另估量产认证。'],
    ],
    hours:[200,400], serverMonthly:[80,300], tooling:[2000,10000],
    build:[
      '按固定提交核对驱动支持；IDF 项目添加 espressif/esp32-camera，启用 PSRAM；Arduino-ESP32 已包含驱动。',
      '使用与你的板型匹配的官方示例和 camera pins；先以 JPEG 单帧缓冲验证，再评估持续捕获。',
      '从设备导出一张 JPEG，在“一看即懂”选择“我的照片”上传；这一手工文件路线已经具备网页能力，尚未实机采集。',
      '产品链路需新增自有 HTTPS 网关保存服务端凭证、设备认证、限流与请求去重；静态网页不能充当这个网关。',
    ],
    acceptance:['不同光照下 JPEG 可解码且不超过 7 MiB','Wi-Fi 开启时连续捕获不丢帧','照片同意/删除、Key 不进入固件','请求去重、用量及设备 ACK 可追踪'],
    gaps:['当前没有实机照片/功耗证据','产品 HTTPS 网关和设备回传尚未交付','网页体验不证明摄像头板卡已经完成联调'],
    sample:['按键捕获示例 JPEG（演练）','本机导出 → 网页选择照片（演练）','示例问题：这是什么菜？（演练）','固定回答：宫保鸡丁（演练）'],
  },
];

export function hardwareEstimate(project, {units=1,hourly=120,cloudPerUse=null,usesPerDay=30}={}) {
  for (const [value,min,max] of [[units,1,10000],[hourly,0,10000],[usesPerDay,0,100000]]) {
    if (!Number.isFinite(value)||value<min||value>max) throw Error('数量、工时单价或日调用次数超出范围');
  }
  if (!Number.isInteger(units) || !Number.isInteger(usesPerDay)) throw Error('数量和日调用次数必须为整数');
  if (cloudPerUse!=null && (!Number.isFinite(cloudPerUse)||cloudPerUse<0||cloudPerUse>10000)) throw Error('单次云费无效');
  const bom=project.bom.reduce((a,row)=>[a[0]+row[1],a[1]+row[2]],[0,0]);
  const nre=project.hours.map((h,i)=>h*hourly+project.tooling[i]);
  const hardware=bom.map(n=>n*units);
  const service=project.serverMonthly.map(n=>n*12);
  const cloud=cloudPerUse==null?null:cloudPerUse*usesPerDay*365*units;
  const subtotal=hardware.map((n,i)=>n+nre[i]+service[i]);
  return {bom,hardware,nre,service,cloud,subtotal,total:cloud==null?null:subtotal.map(n=>n+cloud)};
}

export function hardwareTrace(project, {offline=false}={}) {
  const blocked=offline&&project.id!=='skainet-control';
  const lines=blocked?['模拟断网：上云路径停止；未发起模型请求。','保留本机素材，恢复连接后由用户重新开始。']:project.sample;
  return {
    schema:'aihw/trace@0.1',solution:project.scene,variant:project.variant,mode:'mock',kit:'hardware-plan',args:[],title:project.title,
    region:'local',models:[],timing:'none',
    events:lines.map((text,i)=>({i,t_ms:null,tag:i===lines.length-1?'演练结果':'模拟设备',kind:i===lines.length-1?'result':'device',text,lines:[],assets:[]})),
    result:{models:[],first_token_ms:null,cost:null,sample:'固定链路演练，未连接板卡',note:'无网络请求；不能作为硬件实测或账单证据'},
    inputs:[],outputs:[{path:'out/hardware-plan.txt',media_type:'text/plain',bytes:new TextEncoder().encode(lines.join('\n')).length,asset:null,text:lines.join('\n')}],error:null,
  };
}
