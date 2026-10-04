import { repoLink } from '../data.js';
import { costInfo, PLANNED_STACKS, range, verificationBadge } from '../meta.js';
import { fmtCny, html, icon, mountPage } from '../ui.js';
import { experienceChips } from './home.js';
import { referencePosition } from '../projects.js';
import { CATEGORY_BUSINESS, POSITIONING_REVIEW_DATE, casesFor } from '../positioning.js';

const DOCS = [
  ['readme', '品类概述', 'README'],
  ['business', '商业模式与市场判断', '01-business'],
  ['solution', '技术方案', '02-solution'],
  ['cost', 'BOM、云端用量与算账', '03-cost'],
  ['cases', '公开案例', '04-cases'],
  ['faq', '常见问答（含合规）', '05-faq'],
];

function projectCard(reg, project) {
  const tags = {commercial:'商业产品 / 集成方案', developer:'面向开发者'};
  return html`<article class="panel project-case" data-case="${project.id}" data-audiences="${project.audiences.join(' ')}">
    <div class="chips">${project.audiences.map(a=>html`<span class="chip ${a==='commercial'?'ok':'accent'}">${tags[a]}</span>`)}</div>
    <h3>${project.title}</h3><p class="small">${project.form} · ${project.status}</p>
    <p>${project.reason}</p><p class="small">适用范围：${project.boundary}</p>
    <div class="case-sources">${project.evidence.map((path,i)=>html`<a href="${path.startsWith('https://')?path:repoLink(reg,path)}" rel="noopener">${path.startsWith('https://')?'固定版本依据':`资料 ${i+1}`} ${icon('link')}</a>`)}</div>
  </article>`;
}

function solutionRow(reg, sol) {
  const c = costInfo(sol);
  const stack = reg.stacks.get(sol.stack);
  return html`<a class="row-card" href="#/s/${sol.id}">
    <span class="row-symbol">${(stack?.name || sol.stack).replace(/^阿里云/, '').slice(0, 2)}</span>
    <span class="grow"><strong>${sol.title.split('·').pop().trim()}</strong>
      <small>${sol.summary}</small>
      <span class="chips">${[...experienceChips(reg, sol), verificationBadge(sol), referencePosition(sol)].map((x) => html`<span class="chip ${x.cls}">${x.label}</span>`)}${c ? html`<span class="chip stat">¥${fmtCny(range(c.low, c.high))} / 次（${c.label}）</span>` : ''}</span>
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
  const projects = casesFor(id);
  const page = mountPage(view, html`
    <div class="subbar"><a class="back-link" href="#/">${icon('back')}全部品类</a></div>
    <section class="category-hero">
      <span class="big-emoji" aria-hidden="true">${cat.emoji || ''}</span>
      <p class="eyebrow">商业化品类 ${cat.no}</p>
      <h1>${cat.name}</h1>
      <p>${CATEGORY_BUSINESS[id] || cat.capabilities || ''}</p>
    </section>

    <section class="section" aria-label="品类项目">
      <div class="section-title"><h2>项目精选 <small>${projects.length}</small></h2></div>
      <p class="small">按项目的交付范围和现有资料判断。商业产品、集成方案与开发者用途可重叠；开发者项目也可用于商业产品。</p>
      <div class="filter-row" role="group" aria-label="项目用途筛选">${[['all','全部'],['commercial','商业产品 / 方案'],['developer','开发者项目']].map(([value,text])=>html`<button type="button" class="secondary-action" data-project-filter="${value}" aria-pressed="${value==='all'}">${text}</button>`)}</div>
      <p class="small" data-case-count role="status">显示 ${projects.length} 个项目</p>
      <div class="project-grid">${projects.map(p=>projectCard(reg,p))}</div>
      <p class="small">${POSITIONING_REVIEW_DATE} 复核仓内资料；销售状态沿用各资料的查证日期，未重新核实今日库存或测试整机。完整项目库：<a href="${repoLink(reg,`awesome/commercial-products/by-category/${id}.md`)}" rel="noopener">商业产品</a> · <a href="${repoLink(reg,`awesome/open-source/by-category/${id}.md`)}" rel="noopener">开源项目</a>。</p>
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
      <div class="section-title"><h2>本仓参考实现 <small>按栈体验</small></h2></div>
      <p class="small">以下入口用于理解和验证技术链路；其回放、费用与验证状态只描述本仓代码。</p>
      ${cat.solutions.map((s) => solutionRow(reg, s))}
      ${planned.length ? html`<div class="row-card muted"><span class="grow"><strong>${planned.join(' · ')}</strong><small>其他栈按路线第 2 步接入，接入后在这里并列显示，可以对比同一品类在不同栈上的效果与成本。</small></span></div>` : ''}
    </section>

    ${cat.topic_demos?.length ? html`<section class="section">
      <details class="fold"><summary>专题 demo（${cat.topic_demos.length}）</summary>
        <div class="fold-body"><p class="small">参考 demo 之前的专题示例，保留原路径。</p>
          <div class="link-list">${cat.topic_demos.map((d) => html`<a href="${repoLink(reg, d.path, true)}" rel="noopener"><span>${d.title}<small> · 本仓开发者示例</small></span><span>GitHub ${icon('link')}</span></a>`)}</div>
        </div></details>
    </section>` : ''}

    <section class="section">
      <div class="section-title"><h2>品类文档</h2></div>
      <div class="link-list">${DOCS.map(([k, text, file]) => (cat.docs?.[k] ? html`<a href="${repoLink(reg, cat.docs[k])}" rel="noopener">${text}<span>${file} ${icon('link')}</span></a>` : ''))}</div>
    </section>`);
  page.querySelectorAll('[data-project-filter]').forEach(button=>button.addEventListener('click',()=>{
    const selected = button.dataset.projectFilter;
    page.querySelectorAll('[data-project-filter]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
    let visible = 0;
    page.querySelectorAll('[data-case]').forEach(card=>{
      card.hidden = selected!=='all' && !card.dataset.audiences.split(' ').includes(selected);
      if (!card.hidden) visible++;
    });
    page.querySelector('[data-case-count]').textContent = `显示 ${visible} 个项目`;
  }));
  return null;
}
