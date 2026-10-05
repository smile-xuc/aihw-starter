// 用户自己填的凭证与接入点：按栈声明（aihw/stack@0.1）的字段存，键名与 .env 变量名相同。
// 保存在这台设备；文件/摘要直连官方。实时录音的 Key 只在用户确认后发送其自选网关。

import { FIELD_HINTS } from './meta.js';

const storeKey = (stackId) => `aihw.credentials.${stackId}`;
const THEME_KEY = 'aihw.theme';

function stores() {
  const list = [];
  try { list.push(['session', window.sessionStorage]); } catch { /* 存储被禁用 */ }
  try { list.push(['local', window.localStorage]); } catch { /* 存储被禁用 */ }
  return list;
}

export function loadCredentials(stackId) {
  for (const [where, store] of stores()) {
    try {
      const raw = store.getItem(storeKey(stackId));
      if (!raw) continue;
      const v = JSON.parse(raw);
      if (v && v.values && typeof v.values === 'object') return { values: v.values, remember: where === 'local', savedAt: v.savedAt || null };
    } catch { /* 损坏的记录当作没填 */ }
  }
  return null;
}

export function saveCredentials(stackId, values, remember) {
  clearCredentials(stackId);
  const target = stores().find(([where]) => where === (remember ? 'local' : 'session'));
  if (!target) throw new Error('浏览器禁用了本地存储，无法保存');
  target[1].setItem(storeKey(stackId), JSON.stringify({ values, savedAt: new Date().toISOString() }));
}

export function clearCredentials(stackId) {
  for (const [, store] of stores()) {
    try { store.removeItem(storeKey(stackId)); } catch { /* 忽略 */ }
  }
}

// 契约约定 pattern 是整串匹配
export function fullMatch(pattern, value) {
  const src = pattern.startsWith('^') ? pattern : `^(?:${pattern})`;
  return new RegExp(src.endsWith('$') ? src : `${src}$`).test(value);
}

// 取值：用户填的值，没填用 default；首尾空白去掉
export function fieldValues(stack, raw = {}) {
  const out = {};
  for (const f of stack.fields || []) out[f.key] = String(raw[f.key] ?? '').trim() || f.default || '';
  return out;
}

export function validateCredentials(stack, raw) {
  const values = fieldValues(stack, raw);
  const errors = [];
  const warnings = [];
  for (const f of stack.fields || []) {
    const v = values[f.key];
    if (!v) {
      if (f.required) errors.push(`请填 ${f.label}`);
      continue;
    }
    if (f.input === 'select' && f.options && !f.options.some((o) => o.value === v)) errors.push(`${f.label} 只能选：${f.options.map((o) => o.label).join(' / ')}`);
    else if (f.pattern && !fullMatch(f.pattern, v)) errors.push(`${f.label} 格式不对：${f.help || f.pattern}`);
    const hint = FIELD_HINTS[f.key]?.(v);
    if (hint) warnings.push(hint);
  }
  return { errors, warnings, values };
}

export function missingFields(stack, values, required = []) {
  return required.filter((k) => !values?.[k]).map((k) => (stack.fields || []).find((f) => f.key === k)?.label || k);
}

export function maskSecret(v) {
  if (!v) return '';
  return v.length <= 10 ? `${v.slice(0, 3)}…` : `${v.slice(0, 5)}…${v.slice(-4)}`;
}

// Keep these exports during service-worker upgrades: cached pages may still import them.
// The square now has one fresh light palette, including under a dark OS preference.
export function loadTheme() { return 'light'; }

export function saveTheme() { applyTheme(); }

export function applyTheme() {
  document.documentElement.dataset.theme = 'light';
  // Only migrate appearance. Credentials, drafts and experience history are untouched.
  try { localStorage.setItem(THEME_KEY, 'light'); } catch { /* 浅色仍可用，不依赖存储权限 */ }
  document.querySelector('meta[name="color-scheme"]')?.setAttribute('content', 'light');
  for (const meta of document.querySelectorAll('meta[name="theme-color"]')) {
    meta.setAttribute('content', '#fafaf8');
    meta.removeAttribute('media');
  }
}
