// 注册表里没有、但界面要用的少量约定。品类、栈、部件、合规等的说法都从注册表的 vocab / stacks 读。

// 路线第 2 步要接入的栈：品类页先占位，接入后由注册表里的方案替代
export const PLANNED_STACKS = ['小智', 'TuyaOpen', '火山引擎'];

// 与 demo_kit 的日志行归类一致：浏览器真跑写出的行也按这个归类
export function kindOf(tag) {
  return { 设备: 'device', 云端: 'cloud', 统计: 'stats', 提示: 'notice' }[tag] || (tag ? 'result' : 'other');
}

// 时间线样式：在 kind 之外，再认出云端行里的「听到：」和「第 N 轮 → 调用」
export function eventClass(ev) {
  if (ev.kind === 'cloud') {
    if (/^听到[：:]/.test(ev.text)) return 'cloud heard';
    if (/第 ?\d+ ?轮 ?→/.test(ev.text)) return 'cloud tool';
  }
  return { device: 'device', cloud: 'cloud', result: 'persona', stats: 'stat', notice: 'hint' }[ev.kind] || 'hint';
}

// 单次成本：有真跑记录显示「实测 YYYY-MM-DD」，否则显示「估算」（mock 用量 × 单价）
export function costInfo(sol) {
  const c = sol.cost || {};
  if (c.measured && c.measured.low != null) {
    return { low: c.measured.low, high: c.measured.high, label: `实测 ${c.measured.date}`, cls: 'ok', note: c.measured.note || '' };
  }
  if (c.estimate && c.estimate.low != null) {
    return { low: c.estimate.low, high: c.estimate.high, label: '估算', cls: 'stat', note: c.estimate.note || 'mock 用量为示意值' };
  }
  return null;
}

export const range = (low, high) => (low === high || high == null ? low : [low, high]);

export function verificationBadge(sol) {
  const v = sol.verification || {};
  return { label: v.label || (v.status === 'live-verified' ? '已验证' : '待真 Key 验证'), cls: v.status === 'live-verified' ? 'ok' : 'warn' };
}

// 字段级的补充提示：栈声明里的 help 之外，界面上额外提醒的情况
export const FIELD_HINTS = {
  DASHSCOPE_API_KEY: (v) => {
    if (v.startsWith('sk-sp-')) return 'sk-sp- 开头的是 Token Plan 专属 Key，只能用于编程工具，调模型接口会被拒绝';
    if (v.startsWith('st-')) return '临时 Key 最长 30 分钟有效，过期后要重新生成';
    return '';
  },
  DASHSCOPE_WORKSPACE_ID: (v) => (v && !v.startsWith('llm-') ? '业务空间 ID 一般形如 llm-xxxx，请在控制台「业务空间管理」核对' : ''),
};

// 「测试连接」用最便宜的一次调用（不到 ¥0.0001）
export const CONNECTION_TEST = {
  bailian: { service: 'compatible', model: 'qwen3.7-flash', price: { 'cn-beijing': [0.2, 0.8], 'ap-southeast-1': [0.225, 0.974] } },
};
