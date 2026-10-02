import { repoLink } from '../data.js';
import { costInfo, PLANNED_STACKS, range, verificationBadge } from '../meta.js';
import { fmtCny, html, icon, mountPage } from '../ui.js';
import { experienceChips } from './home.js';

const DOCS = [
  ['readme', '品类概述', 'README'],
  ['business', '商业模式与市场判断', '01-business'],
  ['solution', '技术方案', '02-solution'],
  ['cost', 'BOM、云端用量与算账', '03-cost'],
  ['cases', '公开案例', '04-cases'],
  ['faq', '常见问答（含合规）', '05-faq'],
];

function solutionRow(reg, sol) {
  const c = costInfo(sol);
  const stack = reg.stacks.get(sol.stack);
  return html`<a class="row-card" href="#/s/${sol.id}">
    <span class="row-symbol">${(stack?.name || sol.stack).replace(/^阿里云/, '').slice(0, 2)}</span>
    <span class="grow"><strong>${sol.title.split('·').pop().trim()}</strong>
      <small>${sol.summary}</small>
      <span class="chips">${[...experienceChips(reg, sol), verificationBadge(sol)].map((x) => html`<span class="chip ${x.cls}">${x.label}</span>`)}${c ? html`<span class="chip stat">¥${fmtCny(range(c.low, c.high))} / 次（${c.label}）</span>` : ''}</span>
    </span>${icon('chevron')}</a>`;
}

export function renderCategory(view, reg, id) {
  const cat = reg.catById.get(id);
  if (!cat) {
    location.replace('#/');
    return null;
  }
  document.title = `${cat.name} · AIHW`;
  const ind = cat.industry || {};
  const units = cat.industry_units || {};
  const have = new Set(cat.solutions.map((s) => reg.stacks.get(s.stack)?.name));
  const planned = PLANNED_STACKS.filter((s) => !have.has(s));
  const source = ind.source || {};
  mountPage(view, html`
    <div class="subbar"><a class="back-link" href="#/">${icon('back')}全部品类</a></div>
    <section class="category-hero">
      <span class="big-emoji" aria-hidden="true">${cat.emoji || ''}</span>
      <p class="eyebrow">品类 ${cat.no}</p>
      <h1>${cat.name}</h1>
      <p>${cat.capabilities || ''}</p>
    </section>

    <section class="section">
      <div class="section-title"><h2>速览</h2><small>来自品类总表，欢迎校准</small></div>
      <div class="metric-grid">
        <div class="metric"><small>年出货（${units.shipments || '万台/年'}）</small><strong>${ind.shipments || '—'}</strong></div>
        <div class="metric"><small>总营收（${units.revenue || '亿元/年'}）</small><strong>${ind.revenue || '—'}</strong></div>
        <div class="metric"><small>AI 增量营收占比</small><strong>${ind.ai_share || '—'}</strong><span>趋势 ${ind.trend || '—'}</span></div>
        <div class="metric"><small>代表产品</small><strong>公开案例</strong>${cat.docs?.cases ? html`<span><a href="${repoLink(reg, cat.docs.cases)}" rel="noopener">看案例</a></span>` : ''}</div>
      </div>
      <p class="info-note">${icon('info')}<span>代表场景：${cat.scenes || '—'}。数据来源：${source.url ? html`<a href="${source.url}" rel="noopener">${source.text}</a>` : (source.text || '待核实')}；带「~」的是区间估计。</span></p>
    </section>

    <section class="section">
      <div class="section-title"><h2>方案 <small>按栈</small></h2></div>
      ${cat.solutions.map((s) => solutionRow(reg, s))}
      ${planned.length ? html`<div class="row-card muted"><span class="grow"><strong>${planned.join(' · ')}</strong><small>其他栈按路线第 2 步接入，接入后在这里并列显示，可以对比同一品类在不同栈上的效果与成本。</small></span></div>` : ''}
    </section>

    ${cat.topic_demos?.length ? html`<section class="section">
      <details class="fold"><summary>专题 demo（${cat.topic_demos.length}）</summary>
        <div class="fold-body"><p class="small">参考 demo 之前的专题示例，保留原路径。</p>
          <div class="link-list">${cat.topic_demos.map((d) => html`<a href="${repoLink(reg, d.path, true)}" rel="noopener">${d.title}<span>GitHub ${icon('link')}</span></a>`)}</div>
        </div></details>
    </section>` : ''}

    <section class="section">
      <div class="section-title"><h2>品类文档</h2></div>
      <div class="link-list">${DOCS.map(([k, text, file]) => (cat.docs?.[k] ? html`<a href="${repoLink(reg, cat.docs[k])}" rel="noopener">${text}<span>${file} ${icon('link')}</span></a>` : ''))}</div>
    </section>`);
  return null;
}
