// 用户自己的百炼 Key、地域、业务空间 ID：只放在这台设备的浏览器存储里，页面不会把它们发给百炼官方接入点以外的任何地址。

const STORE_KEY = 'aihw.bailian.v1';
const THEME_KEY = 'aihw.theme';
export const REGION_IDS = ['cn-beijing', 'ap-southeast-1'];

function stores() {
  const list = [];
  try { list.push(['session', window.sessionStorage]); } catch { /* 存储被禁用 */ }
  try { list.push(['local', window.localStorage]); } catch { /* 存储被禁用 */ }
  return list;
}

export function loadBailian() {
  for (const [where, store] of stores()) {
    try {
      const raw = store.getItem(STORE_KEY);
      if (!raw) continue;
      const v = JSON.parse(raw);
      if (v && typeof v.apiKey === 'string' && REGION_IDS.includes(v.region)) {
        return { apiKey: v.apiKey, region: v.region, workspaceId: v.workspaceId || '', remember: where === 'local', savedAt: v.savedAt || null };
      }
    } catch { /* 损坏的记录当作没填 */ }
  }
  return null;
}

export function saveBailian({ apiKey, region, workspaceId }, remember) {
  clearBailian();
  const value = JSON.stringify({ apiKey, region, workspaceId: workspaceId || '', savedAt: new Date().toISOString() });
  const target = stores().find(([where]) => where === (remember ? 'local' : 'session'));
  if (!target) throw new Error('浏览器禁用了本地存储，无法保存');
  target[1].setItem(STORE_KEY, value);
}

export function clearBailian() {
  for (const [, store] of stores()) {
    try { store.removeItem(STORE_KEY); } catch { /* 忽略 */ }
  }
}

export function maskKey(key) {
  if (!key) return '';
  return key.length <= 10 ? `${key.slice(0, 3)}…` : `${key.slice(0, 5)}…${key.slice(-4)}`;
}

// 业务空间 ID 会拼进域名 {id}.{地域}.maas.aliyuncs.com，只放行小写字母、数字和连字符
export function validateBailian({ apiKey, region, workspaceId }) {
  const errors = [];
  const warnings = [];
  const key = (apiKey || '').trim();
  if (!key) errors.push('请填 API Key');
  else if (!/^s[kt]-[A-Za-z0-9_-]{8,}$/.test(key)) errors.push('API Key 应以 sk-（长期 Key）或 st-（临时 Key）开头，只含字母、数字、- 和 _');
  else if (key.startsWith('sk-sp-')) warnings.push('sk-sp- 开头的是 Token Plan 专属 Key，只能用于编程工具，调模型接口会被拒绝');
  else if (key.startsWith('st-')) warnings.push('临时 Key 最长 30 分钟有效，过期后要重新生成');
  if (!REGION_IDS.includes(region)) errors.push('请选择地域');
  const ws = (workspaceId || '').trim();
  if (ws && !/^[a-z0-9][a-z0-9-]{2,62}$/.test(ws)) errors.push('业务空间 ID 只含小写字母、数字和连字符，形如 llm-xxxx');
  else if (ws && !ws.startsWith('llm-')) warnings.push('业务空间 ID 一般形如 llm-xxxx，请在控制台「业务空间管理」核对');
  return { errors, warnings, value: { apiKey: key, region, workspaceId: ws } };
}

export function loadTheme() {
  try { return localStorage.getItem(THEME_KEY) || 'system'; } catch { return 'system'; }
}

export function saveTheme(theme) {
  try {
    if (theme === 'system') localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, theme);
  } catch { /* 忽略 */ }
  applyTheme(theme);
}

export function applyTheme(theme = loadTheme()) {
  const root = document.documentElement;
  if (theme === 'light' || theme === 'dark') root.dataset.theme = theme;
  else delete root.dataset.theme;
}
