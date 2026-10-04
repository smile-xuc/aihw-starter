import { DataMissing, registry } from './data.js';
import { renderCategory } from './pages/category.js';
import { renderHome } from './pages/home.js';
import { renderMe } from './pages/me.js';
import { renderSolution } from './pages/solution.js';
import { renderHardware } from './pages/hardware.js';
import { renderCostLab } from './pages/cost-lab.js';
import { applyTheme } from './settings.js';
import { html, icon, mountPage } from './ui.js';

applyTheme();
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => applyTheme());

const view = document.getElementById('view');
let cleanup = null;
let routeVersion = 0;

function setNav(current) {
  for (const a of document.querySelectorAll('[data-nav]')) {
    if (a.dataset.nav === current) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  }
}

function renderError(error) {
  const missing = error instanceof DataMissing;
  document.title = 'AIHW · 数据不可用';
  mountPage(view, html`
    <header class="app-top"><a class="wordmark" href="#/"><span class="brandmark" aria-hidden="true"><i></i><i></i><i></i><i></i></span>AIHW</a></header>
    <section class="intro"><h1>方案数据暂时不可用</h1>
      <p>${missing ? '这个页面的数据在部署时生成，这次没有找到。' : '加载数据时出错。'}稍后刷新再试；Key 设置不受影响，可以在「我的」里查看。</p></section>
    <div class="inline-error">${error.message}</div>
    <p class="info-note">${icon('info')}<span>维护者：数据由 <code>docs/app/tools/build.py</code> 生成（Pages workflow 部署前自动运行）。本地预览先运行 <code>python3 docs/app/tools/build.py</code>。</span></p>`);
}

async function route() {
  const version = ++routeVersion;
  const isCurrent = () => version === routeVersion;
  cleanup?.();
  cleanup = null;
  const deep = new URLSearchParams(location.search).get('s');
  if (deep && !location.hash) history.replaceState(null, '', `${location.pathname}#/s/${encodeURIComponent(deep)}`);
  const parts = (location.hash.replace(/^#\/?/, '').split('?')[0] || '').split('/').filter(Boolean).map(decodeURIComponent);
  const page = parts[0] || '';
  view.dataset.page = page || 'home';
  setNav(['me', 'hardware', 'cost-lab'].includes(page) ? page : 'home');
  try {
    if (page === 'me') {
      const reg = await registry().catch(() => null);
      if (!isCurrent()) return;
      cleanup = renderMe(view, reg)?.cleanup || null;
    } else {
      const reg = await registry();
      if (!isCurrent()) return;
      let result;
      if (page === 'c') result = renderCategory(view, reg, parts[1] || '');
      else if (page === 's') result = await renderSolution(view, reg, parts[1] || '', parts[2] || '', { isCurrent });
      else if (page === 'hardware') result = renderHardware(view, reg, parts[1] || '');
      else if (page === 'cost-lab') result = renderCostLab(view, reg);
      else result = renderHome(view, reg);
      if (!isCurrent()) { result?.cleanup?.(); return; }
      cleanup = result?.cleanup || null;
    }
  } catch (e) {
    if (!isCurrent()) return;
    renderError(e);
  }
  if (!isCurrent()) return;
  window.scrollTo(0, 0);
  view.focus({ preventScroll: true });
}

window.addEventListener('hashchange', route);
route();

if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
  navigator.serviceWorker.register('sw.js', { scope: './' }).catch(() => { /* 不支持或被禁用时照常在线使用 */ });
}
