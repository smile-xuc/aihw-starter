import { browserSupport, runnableIds } from '../live/index.js';
import { COMPLIANCE, STACKS, verificationOf } from '../meta.js';
import { loadBailian } from '../settings.js';
import { brandmark, fmtCny, html, icon, mountPage } from '../ui.js';

export function experienceChips(sol) {
  const chips = [];
  if (sol.tracePath) chips.push({ label: '回放', cls: 'accent' });
  const web = browserSupport(sol);
  if (web.status === 'runnable') chips.push({ label: '网页真跑', cls: 'cloud' });
  if (sol.kind === 'reference') chips.push({ label: '本机真跑', cls: '' });
  return chips;
}

function costLine(sol) {
  if (!sol.cost || sol.cost.cny == null) return html`<b>—</b><small>暂无成本</small>`;
  return html`<b>¥${fmtCny(sol.cost.cny)}</b><small>${sol.cost.basis === 'mock' ? '估算 / 次' : '实测 / 次'}</small>`;
}

function card(cat) {
  const sol = cat.solutions[0];
  const chips = sol ? [
    ...experienceChips(sol),
    ...(sol.compliance_tags || []).map((t) => ({ label: COMPLIANCE[t]?.label || t, cls: 'stat' })),
    verificationOf(sol),
  ] : [{ label: '暂无参考方案', cls: '' }];
  return html`<a class="cat-card" href="#/c/${cat.id}">
    <div class="row1">
      <span class="cat-emoji" aria-hidden="true">${cat.emoji}</span>
      <div class="names"><small>${cat.id.slice(0, 2)} · ${cat.solutions.map((s) => STACKS[s.stack] || s.stack).join(' / ') || '待接入'}</small><h3>${cat.name}</h3></div>
      <div class="cost">${sol ? costLine(sol) : ''}</div>
    </div>
    <p class="scene">${cat.scenes}</p>
    <div class="chips">${chips.map((c) => html`<span class="chip ${c.cls}">${c.label}</span>`)}</div>
  </a>`;
}

export function modeBanner(key) {
  const n = runnableIds().length;
  if (key) {
    return html`<div class="mode-banner live">${icon('key')}<div><strong>已填百炼 Key · ${key.region === 'cn-beijing' ? '北京' : '新加坡'}</strong>
      <p>${n} 个方案可以在浏览器里直接真跑（待真 Key 验证），调用直接发往百炼官方接入点，按你的账单计费；实时语音的 3 个方案只能回放。<a href="#/me">管理 Key</a></p></div></div>`;
  }
  return html`<div class="mode-banner">${icon('info')}<div><strong>回放模式</strong>
    <p>现在看的是 mock 回放：不调用模型、不花钱，用量是示意值。在「我的」填上自己的百炼 Key，其中 ${n} 个方案可以在浏览器里真跑。<a href="#/me">去填 Key</a></p></div></div>`;
}

export function renderHome(view, reg) {
  document.title = 'AIHW · AI 硬件方案';
  const key = loadBailian();
  mountPage(view, html`
    <header class="app-top"><a class="wordmark" href="#/">${brandmark}AIHW</a>
      <a class="chip ${key ? 'ok' : 'accent'}" href="#/me">${key ? '已填 Key' : '回放模式'}</a></header>
    <section class="intro">
      <h1>9 个品类的 AI 硬件参考方案</h1>
      <p>每个方案回答四个问题：效果怎样、一次多少钱、做成产品要什么硬件、有哪些合规义务。</p>
    </section>
    ${modeBanner(key)}
    <section class="section">
      <div class="section-title"><h2>品类 <small>${reg.categories.length}</small></h2><small>品类 × 栈 · 目前只有百炼</small></div>
      <div class="cat-list">${reg.categories.map(card)}</div>
    </section>
    <p class="footnote">
      数据：<a href="https://github.com/smile-xuc/aihw-starter" rel="noopener">smile-xuc/aihw-starter</a>${reg.source.commit ? ` @ ${reg.source.commit}` : ''}${reg.temporary ? ' · 临时样例数据，正式注册表上线后替换' : ''}<br>
      成本均为估算（mock 用量 × 官方单价），以百炼账单为准 · <a href="../designs/aihw-square/app-v2.html?screen=home">APP 设计原型（存档）</a>
    </p>`);
}
