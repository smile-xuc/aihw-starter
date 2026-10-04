// 页面渲染的公共件。所有插值默认转义：真跑时模型输出会进到页面里，而 Key 就在同源的本机存储里。

export class Raw {
  constructor(s) { this.s = s; }
  toString() { return this.s; }
}
export const raw = (s) => new Raw(String(s));

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ESC[c]);

function part(v) {
  if (v == null || v === false || v === true) return '';
  if (v instanceof Raw) return v.s;
  if (Array.isArray(v)) return v.map(part).join('');
  return esc(v);
}

export function html(strings, ...values) {
  let out = strings[0];
  for (let i = 0; i < values.length; i++) out += part(values[i]) + strings[i + 1];
  return new Raw(out);
}

export function mount(el, content) {
  el.innerHTML = part(content);
  return el;
}

// 每次进入页面都换一个新的根节点，事件监听随旧页面一起丢掉
export function mountPage(view, content) {
  const page = document.createElement('div');
  page.className = 'page';
  page.innerHTML = part(content);
  view.replaceChildren(page);
  return page;
}

export function fragment(content) {
  const t = document.createElement('template');
  t.innerHTML = part(content);
  return t.content.firstElementChild;
}

export const REPO = 'https://github.com/smile-xuc/aihw-starter';

export function repoUrl(path, dir = false) {
  const clean = String(path).replace(/^\/+|\/+$/g, '');
  return `${REPO}/${dir ? 'tree' : 'blob'}/master/${clean.split('/').map(encodeURIComponent).join('/')}`;
}

const PATHS = {
  back: '<path d="m14 5-7 7 7 7"/>',
  chevron: '<path d="m9 5 7 7-7 7"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v.2"/>',
  play: '<path d="m8 5 11 7-11 7Z" fill="currentColor" stroke="none"/>',
  replay: '<path d="M4 12a8 8 0 1 0 2.3-5.6M4 4v4h4"/>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" stroke="none"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="m11 12 9-9m-3 3 3 3m-6 0 2 2"/>',
  shield: '<path d="M12 3 4 6v6c0 4.5 3.4 8.2 8 9 4.6-.8 8-4.5 8-9V6Z"/><path d="m9 12 2 2 4-4"/>',
  link: '<path d="M14 3h7v7m0-7L10 14M11 5H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6"/>',
  file: '<path d="M14 2H5v20h14V7Zm0 0v5h5M8 12h8m-8 4h6"/>',
  cloud: '<path d="M6 18a5 5 0 1 1 .7-9.9A6 6 0 0 1 18 9a4.5 4.5 0 0 1 0 9Z"/>',
  alert: '<path d="m12 3 10 18H2Zm0 6v5m0 3v.2"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  camera: '<rect x="3" y="6" width="18" height="14" rx="3"/><path d="m7 6 2-3h6l2 3"/><circle cx="12" cy="13" r="4"/>',
  glasses: '<path d="m3 12 2-7h3m13 7-2-7h-3M9 14h6"/><rect x="2" y="11" width="7" height="7" rx="3"/><rect x="15" y="11" width="7" height="7" rx="3"/>',
  toy: '<circle cx="6" cy="6" r="3"/><circle cx="18" cy="6" r="3"/><rect x="4" y="6" width="16" height="15" rx="7"/><path d="M8 12h.1M16 12h.1m-6 4h4"/>',
  chip: '<rect x="5" y="5" width="14" height="14" rx="3"/><path d="M9 2v3m6-3v3M9 19v3m6-3v3M2 9h3m-3 6h3m14-6h3m-3 6h3"/>',
  bot: '<rect x="4" y="6" width="16" height="13" rx="4"/><path d="M12 3v3M8 12h.1m7.9 0h.1M9 16h6M2 10v5m20-5v5"/>',
  headphones: '<path d="M4 14v-3a8 8 0 0 1 16 0v3"/><rect x="3" y="12" width="4" height="8" rx="2"/><rect x="17" y="12" width="4" height="8" rx="2"/>',
  mic: '<rect x="9" y="2" width="6" height="13" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v4m-4 0h8"/>',
  watch: '<rect x="6" y="5" width="12" height="14" rx="4"/><path d="m8 5 1-3h6l1 3M8 19l1 3h6l1-3M12 9v4l2 1"/>',
  arm: '<path d="M4 21h16M7 21v-4l4-5m3-2 3-5 3 2-1 3M6 5l4 5m0-7L7 6"/><circle cx="12" cy="12" r="3"/>',
  chart: '<path d="M4 3v17h17M8 15v-3m5 3V8m5 7V5"/>',
  arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
  upload: '<path d="M12 16V3m-5 5 5-5 5 5M4 16v4h16v-4"/>',
};
export const icon = (name, cls = '') =>
  raw(`<svg class="icon ${cls}" viewBox="0 0 24 24" aria-hidden="true">${PATHS[name] || PATHS.info}</svg>`);
export const brandmark = raw('<span class="brandmark" aria-hidden="true"><i></i><i></i><i></i><i></i></span>');

// 与 demo_kit.fmt_cny 同一口径：≥ 0.01 元保留 3 位小数，更小的保留 2 位有效数字；区间写成「下限–上限」
export function fmtCny(v) {
  if (Array.isArray(v)) {
    const [lo, hi] = v;
    return Math.abs(hi - lo) < 1e-9 ? fmtCny(lo) : `${fmtCny(lo)}–${fmtCny(hi)}`;
  }
  if (v == null || Number.isNaN(v)) return '—';
  if (v >= 0.01) return v.toFixed(3);
  if (v <= 0) return '0';
  const r = Number(v.toPrecision(2));
  const decimals = Math.max(0, 1 - Math.floor(Math.log10(r)));
  return r.toFixed(decimals).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
}

export function fmtYuan(v) {
  if (v == null) return '—';
  if (Array.isArray(v)) return `¥${fmtYuan(v[0]).slice(1)}–${fmtYuan(v[1]).slice(1)}`;
  if (v >= 100) return `¥${Math.round(v).toLocaleString('zh-CN')}`;
  if (v >= 1) return `¥${v.toFixed(1)}`;
  return `¥${fmtCny(v)}`;
}

// 只认标题、列表、待办、引用、行内代码和加粗；先整体转义再套标签，模型输出也能安全显示
export function markdown(src) {
  const lines = String(src).replace(/\r\n?/g, '\n').split('\n');
  const inline = (s) => esc(s).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  let out = '';
  let list = false;
  let para = [];
  const flush = () => {
    if (para.length) out += `<p>${para.map(inline).join('<br>')}</p>`;
    para = [];
  };
  const close = () => {
    if (list) out += '</ul>';
    list = false;
  };
  for (const line of lines) {
    const t = line.trimEnd();
    let m;
    if (!t.trim()) { flush(); close(); continue; }
    if ((m = t.match(/^(#{1,3})\s+(.*)$/))) { flush(); close(); out += `<h${m[1].length}>${inline(m[2])}</h${m[1].length}>`; continue; }
    if ((m = t.match(/^>\s?(.*)$/))) { flush(); close(); out += `<blockquote>${inline(m[1])}</blockquote>`; continue; }
    if ((m = t.match(/^\s*[-*]\s+\[[ xX]\]\s+(.*)$/))) { flush(); if (!list) { out += '<ul>'; list = true; } out += `<li class="todo">${inline(m[1])}</li>`; continue; }
    if ((m = t.match(/^\s*[-*]\s+(.*)$/))) { flush(); if (!list) { out += '<ul>'; list = true; } out += `<li>${inline(m[1])}</li>`; continue; }
    close();
    para.push(t);
  }
  flush();
  close();
  return raw(`<div class="md">${out}</div>`);
}

export function toast(message, ms = 2600) {
  const host = document.querySelector('.toast-host');
  if (!host) return;
  const el = fragment(html`<div class="toast">${message}</div>`);
  host.replaceChildren(el);
  setTimeout(() => el.remove(), ms);
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    toast('已复制');
  } catch {
    toast('复制失败，请长按选择文字');
  }
}

// 底部弹层：Esc 关闭、焦点留在弹层内、关闭后焦点回到触发按钮
export function sheet(content, { label = '对话框' } = {}) {
  const opener = document.activeElement;
  const layer = fragment(html`<div class="sheet-layer"><div class="sheet" role="dialog" aria-modal="true" aria-label="${label}" tabindex="-1"><div class="sheet-handle" aria-hidden="true"></div>${content}</div></div>`);
  const box = layer.querySelector('.sheet');
  let resolve;
  const done = new Promise((r) => { resolve = r; });
  const close = (value = null) => {
    layer.remove();
    document.removeEventListener('keydown', onKey, true);
    if (opener && opener.focus) opener.focus();
    resolve(value);
  };
  const onKey = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); close(null); return; }
    if (e.key !== 'Tab') return;
    const items = [...box.querySelectorAll('button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])')].filter((x) => !x.disabled);
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };
  layer.addEventListener('click', (e) => {
    if (e.target === layer) close(null);
    const btn = e.target.closest('[data-sheet]');
    if (btn) close(btn.dataset.sheet);
  });
  document.addEventListener('keydown', onKey, true);
  document.body.append(layer);
  (box.querySelector('[data-autofocus]') || box).focus();
  return { el: box, close, done };
}

export function download(name, text, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
