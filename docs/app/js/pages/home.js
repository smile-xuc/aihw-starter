import { PRODUCTS } from '../experience.js';
import { readHistory, statusLabel } from '../history.js';
import { label } from '../data.js';
import { runnerCount, solutionRunnable } from '../live/index.js';
import { loadCredentials } from '../settings.js';
import { brandmark, html, icon, mountPage } from '../ui.js';
import { CATEGORY_BUSINESS, casesFor } from '../positioning.js';

export function experienceChips(reg, sol) {
  const modes = sol.experience?.modes || [];
  const chips = [];
  if (modes.includes('replay')) chips.push({ label: label(reg.labels.modes, 'replay'), cls: 'accent' });
  if (solutionRunnable(reg, sol)) chips.push({ label: '网页真跑', cls: 'cloud' });
  if (modes.includes('local-run')) chips.push({ label: label(reg.labels.modes, 'local-run'), cls: '' });
  return chips;
}

function card(reg, cat) {
  const projects = casesFor(cat.id);
  return html`<a class="cat-card" href="#/c/${cat.id}">
    <div class="row1">
      <span class="cat-emoji" aria-hidden="true">${cat.emoji || '·'}</span>
      <div class="names"><small>${cat.no} · 商业化方向</small><h3>${cat.name}</h3></div>
    </div>
    <p class="scene">${CATEGORY_BUSINESS[cat.id] || cat.scenes || ''}</p>
    <div class="chips"><span class="chip">${projects.length} 个项目精选</span><span class="chip accent">商业产品 / 开发者项目</span></div>
  </a>`;
}

export function savedStacks(reg) {
  return [...reg.stacks.values()].filter((s) => loadCredentials(s.id));
}

export function modeBanner(reg) {
  const saved = savedStacks(reg);
  const n = runnerCount();
  if (saved.length) {
    return html`<div class="mode-banner live">${icon('key')}<div><strong>已填 ${saved.map((s) => s.name).join('、')} 的 Key</strong>
      <p>${n} 个玩法可以在浏览器里直接真跑（待真 Key 验证）：请求直接发往官方接入点，按你的账单计费；实时语音只能回放。<a href="#/me">管理 Key</a></p></div></div>`;
  }
  return html`<div class="mode-banner">${icon('info')}<div><strong>回放模式</strong>
    <p>现在看的是 mock 回放：不调用模型、不花钱，用量是示意值。在「我的」填上自己的百炼 Key，其中 ${n} 个玩法可以在浏览器里真跑。<a href="#/me">去填 Key</a></p></div></div>`;
}

export const dataNote = (reg) => `方案注册表 · demo 标准 v${reg.standard}`;

export function renderHome(view, reg) {
  document.title = 'AIHW · AI 硬件方案';
  const saved = savedStacks(reg).length > 0;
  const recent = readHistory().records.slice(0, 3);
  mountPage(view, html`
    <header class="app-top"><a class="wordmark" href="#/">${brandmark}AIHW</a>
      <a class="chip ${saved ? 'ok' : 'accent'}" href="#/me">${saved ? '已填 Key' : '回放模式'}</a></header>
    <section class="intro">
      <p class="eyebrow">把 AI 硬件的能力，先拿来用</p><h1>一张照片，一段录音。<br>体验就在这里。</h1>
      <p>先看免费的示例效果，再用自己的 Key 和素材体验。请求直达官方接入点。</p>
    </section>
    <section class="featured-grid" aria-label="精选体验">${Object.entries(PRODUCTS).map(([id,p],i)=>html`<a class="featured-card ${i ? 'recorder' : 'vision'}" href="#/s/${id}/default"><span class="feature-art" aria-hidden="true">${icon(i ? 'file' : 'play')}</span><span class="eyebrow">${i ? '听见，然后整理' : '看见，然后理解'}</span><h2>${p.title}</h2><p>${i ? '录音 → 要点、决定、待办' : '照片 + 提问 → 回答与播报'}</p><span class="feature-link">免费示例 / 我的 Key ${icon('chevron')}</span></a>`)}</section>
    ${recent.length ? html`<section class="section"><div class="section-title"><h2>最近体验</h2><a href="#/me">查看历史</a></div><div class="panel">${recent.map(r=>html`<a class="history-preview" href="#/me?history=${encodeURIComponent(r.id)}"><span><strong>${PRODUCTS[r.trace.solution]?.title || r.trace.title}</strong><small>${new Date(r.trace.ran_at).toLocaleString('zh-CN')}</small></span><span class="chip">${statusLabel(r.trace)}</span></a>`)}</div></section>` : ''}
    <section class="workspace-links" aria-label="继续验证"><a class="panel" href="#/hardware"><strong>把能力做进硬件</strong><p>3 条 ESP32 路线 · BOM、研发节奏与商用条件</p></a><a class="panel" href="#/cost-lab"><strong>准备成本跑测</strong><p>你提供价格说明，用调用证据核对账单</p></a></section>
    ${modeBanner(reg)}
    <section class="section">
      <div class="section-title"><h2>商业化品类 <small>${reg.categories.length}</small></h2><small>场景与具体项目</small></div>
      <div class="cat-list">${reg.categories.map((c) => card(reg, c))}</div>
    </section>
    <p class="footnote">
      数据：<a href="${reg.repo.url || 'https://github.com/smile-xuc/aihw-starter'}" rel="noopener">smile-xuc/aihw-starter</a> · ${dataNote(reg)}<br>
      成本未经真跑的都是估算（mock 用量 × 官方单价），以账单为准 · <a href="../designs/aihw-square/app-v2.html?screen=home">APP 设计原型（存档）</a>
    </p>`);
}
