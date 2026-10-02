// 注册表里只有代号（栈、设备输入输出、合规标签……），这里是它们在界面上的说法。新增代号时在这里补一行。

export const STACKS = {
  bailian: '百炼',
  xiaozhi: '小智',
  tuyaopen: 'TuyaOpen',
  volcengine: '火山引擎',
  agora: '声网',
  tencent: '腾讯云',
};
// 路线第 2 步要接入的栈，品类页先占位
export const PLANNED_STACKS = ['xiaozhi', 'tuyaopen', 'volcengine'];

export const ARCHETYPES = {
  'realtime-voice': '实时语音',
  vision: '拍照 / 视觉理解',
  recording: '录音纪要',
  tools: '工具编排 / 结构化输出',
};

export const REGIONS = {
  'cn-beijing': '华北2（北京）',
  'ap-southeast-1': '新加坡',
};

// solution.yaml 的 device 写的是 demo 的模拟方式；这里折算成做产品时要的部件
const PART = {
  mic: ['麦克风', '按键说话或常开拾音'],
  camera: ['摄像头', '抓拍或定时取帧'],
  speaker: ['扬声器 / 耳机', '播报回复'],
  sensor: ['传感器', '心率、血氧、睡眠等聚合指标'],
  input: ['按键 / 文本', '一句话指令'],
  actuator: ['执行部件', '灯光、电机、屏幕、震动；demo 用 [设备] 日志模拟'],
  app: ['手机 App', '卡片、日报、纪要'],
  screen: ['屏幕 / 字幕', '显示译文或状态'],
  storage: ['存储与上传', '录音先传到存储，只把地址交给云端'],
};
const INPUT_PART = { mic: 'mic', wav: 'mic', mp3: 'mic', m4a: 'mic', camera: 'camera', jpg: 'camera', png: 'camera', json: 'sensor', text: 'input', url: 'storage' };
const OUTPUT_PART = { speaker: 'speaker', wav: 'speaker', console: 'actuator', markdown: 'app', json: 'app', text: 'screen' };
const SIMULATED = { wav: 'WAV 录音', mp3: 'MP3 录音', m4a: 'M4A 录音', jpg: 'JPG 图片', png: 'PNG 图片', json: 'JSON 数据', text: '文本', url: '公网 URL', console: '控制台日志', markdown: 'Markdown 文件' };

export function hardwareParts(device = {}) {
  const parts = new Map();
  const add = (key, via) => {
    const entry = parts.get(key) || { key, name: PART[key][0], note: PART[key][1], via: new Set() };
    if (via) entry.via.add(via);
    parts.set(key, entry);
  };
  for (const t of device.inputs || []) if (INPUT_PART[t]) add(INPUT_PART[t], SIMULATED[t]);
  for (const t of device.outputs || []) if (OUTPUT_PART[t]) add(OUTPUT_PART[t], SIMULATED[t]);
  return [...parts.values()].map((p) => ({ ...p, via: [...p.via] }));
}

// 合规标签 → 一句话义务。要点摘要，以原文和品类 05-faq 为准
export const COMPLIANCE = {
  'camera-privacy': {
    label: '摄像头隐私',
    duty: '画面属于个人信息：设备要有拍摄提示（指示灯或提示音），隐私政策写明哪些画面上云、保存多久，并提供删除；不识别、不推测人的身份。',
    ref: '《个人信息保护法》；品类 05-faq「隐私」',
  },
  minors: {
    label: '未成年人',
    duty: '面向儿童要建立未成年人模式并取得监护人同意；不得向未成年人提供虚拟亲属、虚拟伴侣类服务。',
    ref: '《人工智能拟人化互动服务管理暂行办法》第十四条；《未成年人网络保护条例》',
  },
  anthropomorphic: {
    label: '拟人化互动',
    duty: '持续情感陪伴类服务自 2026-07-15 起适用拟人化互动办法：上线前做安全评估、算法备案，显著标识 AI 身份，连续使用超过 2 小时要提醒，不得以诱导沉迷为目标。',
    ref: '《人工智能拟人化互动服务管理暂行办法》第十八、二十二、二十六条',
  },
  'recording-consent': {
    label: '录音告知',
    duty: '录音会录到他人的声音：产品要有录音提示（指示灯或提示音），事先告知并取得同意；部分地区要求双方同意，纪要留存要脱敏。',
    ref: '品类 05-faq「隐私与合规」',
  },
  health: {
    label: '健康数据',
    duty: '健康数据是敏感个人信息：单独同意，只上传必要的聚合指标；未取得医疗器械资质前不做诊断、不宣传医疗功能，输出要写明「不替代专业医疗意见」。',
    ref: '《个人信息保护法》第二十八、二十九条；品类 05-faq「合规」',
  },
  'safety-critical': {
    label: '动作安全',
    duty: '模型输出会驱动实体动作：每次调用先过本地安全门（技能白名单、力矩上限、禁止动作），急停、速度分区和工作空间围栏放在控制器层。',
    ref: '品类 05-faq「安全与工程」',
  },
};
export const GENERAL_DUTY = {
  label: '所有品类',
  duty: '面向公众上线时：调用已备案大模型的应用要向网信部门登记，并在显著位置公示模型名称与备案号；AI 生成的文本、音频要做显式和隐式标识。',
  ref: '《生成式人工智能服务管理暂行办法》；《人工智能生成合成内容标识办法》（2025-09-01 施行）',
};

export function verificationOf(sol) {
  const v = sol.verification || {};
  if (v.status === 'live-verified' && v.last_verified) return { label: `实测 ${v.last_verified}`, cls: 'ok' };
  return { label: '待真 Key 验证', cls: 'warn' };
}

// 回放时间线的分类只看日志行标签：[设备] 硬件动作、[云端] 接口事件、[统计] 成本与延迟、其余是用户看到或听到的结果
export function eventKind(ev) {
  if (ev.tag === '设备') return 'device';
  if (ev.tag === '云端') {
    if (/^听到[：:]/.test(ev.text)) return 'cloud heard';
    if (/第 ?\d+ ?轮 ?→/.test(ev.text)) return 'cloud tool';
    return 'cloud';
  }
  if (ev.tag === '统计') return 'stat';
  if (ev.tag === '提示') return 'hint';
  return 'persona';
}
