import { DataMissing, registry } from './data.js';
import { renderCategory } from './pages/category.js';
import { renderHome } from './pages/home.js';
import { renderMe } from './pages/me.js';
import { renderSolution } from './pages/solution.js';
import { renderHardware } from './pages/hardware.js';
import { renderCostLab } from './pages/cost-lab.js';
import { PROJECTS } from './projects.js';
import { applyTheme } from './settings.js';
import { html, icon, mountPage, toast } from './ui.js';

applyTheme();

const view = document.getElementById('view');
let cleanup = null;
let routeVersion = 0;
const productBar = document.querySelector('.product-bar');
const routeStatus = document.querySelector('[data-route-status]');
document.querySelector('.skip-link')?.addEventListener('click', (event) => {
  event.preventDefault();
  view.focus({preventScroll:true});
  view.scrollIntoView({behavior:'auto',block:'start'});
});

// The project website is outside this PWA's offline scope. Keep a real link,
// but do not strand an offline reader on a browser error page.
const websiteLink = document.querySelector('[data-site-home]');
const offlineNote = document.querySelector('[data-offline-note]');
function reflectConnection() { offlineNote?.classList.toggle('hidden', navigator.onLine); }
websiteLink?.addEventListener('click', (event) => {
  if (!navigator.onLine && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
    event.preventDefault();
    toast('官网首页需要联网。当前可继续使用已缓存的体验，联网后再返回官网。', 5000);
  }
});
window.addEventListener('online', reflectConnection);
window.addEventListener('offline', reflectConnection);
reflectConnection();

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
    <a class="secondary-action" href="#/me">查看本机设置与历史</a>
    <details class="process-panel"><summary>查看技术详情</summary><p class="inline-error">${error.message}</p>
    <p class="info-note">${icon('info')}<span>维护者：数据由 <code>docs/app/tools/build.py</code> 生成。本地预览先运行 <code>python3 docs/app/tools/build.py</code>。</span></p></details>`);
}

function renderNotFound() {
  document.title = '页面未找到 · AIHW Starter';
  mountPage(view, html`<section class="intro" data-route-missing><p class="eyebrow">链接可能已失效</p><h1>没有找到这个页面</h1><p>可以回体验广场重新选择品类、体验或硬件方案。保存在本机的设置与历史不会因此清除。</p></section>
    <a class="primary-action" href="#/">返回体验广场</a>`);
}

async function route() {
  const version = ++routeVersion;
  const isCurrent = () => version === routeVersion;
  cleanup?.();
  cleanup = null;
  view.setAttribute('aria-busy', 'true');
  productBar?.removeAttribute('data-loading');
  if (routeStatus) routeStatus.textContent = '';
  // Avoid a flashing loader on cached routes; preserve the shell during slower requests.
  const pending = setTimeout(() => {
    if (!isCurrent()) return;
    productBar?.setAttribute('data-loading', '');
    if (routeStatus) routeStatus.textContent = '正在加载页面';
  }, 180);
  try {
    const deep = new URLSearchParams(location.search).get('s');
    if (deep && !location.hash) history.replaceState(null, '', `${location.pathname}#/s/${encodeURIComponent(deep)}`);
    let parts;
    try {
      parts = (location.hash.replace(/^#\/?/, '').split('?')[0] || '').split('/').filter(Boolean).map(decodeURIComponent);
    } catch {
      view.dataset.page = 'missing';setNav('');renderNotFound();
      window.scrollTo(0, 0);view.focus({ preventScroll: true });return;
    }
    const page = parts[0] || '';
    view.dataset.page = page || 'home';
    setNav(['me', 'hardware', 'cost-lab'].includes(page) ? page : 'home');
    try {
      const validShape = !parts.length || (['me', 'cost-lab'].includes(page) && parts.length === 1)
        || (page === 'c' && parts.length === 2) || (page === 's' && [2, 3].includes(parts.length))
        || (page === 'hardware' && parts.length <= 2);
      if (!validShape) {
        setNav('');renderNotFound();
      } else if (page === 'me') {
        const reg = await registry().catch(() => null);
        if (!isCurrent()) return;
        cleanup = renderMe(view, reg)?.cleanup || null;
      } else {
        const reg = await registry();
        if (!isCurrent()) return;
        let result;
        const solution = page === 's' ? reg.byId.get(parts[1]) : null;
        const missing = (page === 'hardware' && parts[1] && !PROJECTS.some(project => project.id === parts[1]))
          || (page === 'c' && !reg.catById.has(parts[1])) || (page === 's' && (!solution
          || (parts[2] && !solution.variants.some(variant => variant.id === parts[2]))));
        if (missing) {setNav('');renderNotFound();}
        else if (page === 'c') result = renderCategory(view, reg, parts[1]);
        else if (page === 's') result = await renderSolution(view, reg, parts[1], parts[2] || '', { isCurrent });
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
  } finally {
    clearTimeout(pending);
    if (isCurrent()) {
      view.setAttribute('aria-busy', 'false');
      productBar?.removeAttribute('data-loading');
      if (routeStatus) routeStatus.textContent = '';
    }
  }
}

window.addEventListener('hashchange', route);
route();

if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
  navigator.serviceWorker.register('sw.js', { scope: './' }).catch(() => { /* 不支持或被禁用时照常在线使用 */ });
}
