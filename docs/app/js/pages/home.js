import { PRODUCTS } from '../experience.js';
import { readHistory, statusLabel } from '../history.js';
import { label } from '../data.js';
import { runnerCount, solutionRunnable } from '../live/index.js';
import { loadCredentials } from '../settings.js';
import { html, icon, mountPage } from '../ui.js';
import { CATEGORY_BUSINESS, casesFor } from '../positioning.js';

export function experienceChips(reg, sol) {
  const modes = sol.experience?.modes || [];
  const chips = [];
  if (modes.includes('replay')) chips.push({ label: label(reg.labels.modes, 'replay'), cls: 'accent' });
  if (solutionRunnable(reg, sol)) chips.push({ label: '网页真跑', cls: 'cloud' });
  if (modes.includes('local-run')) chips.push({ label: label(reg.labels.modes, 'local-run'), cls: '' });
  return chips;
}

export const categoryIcon = (cat) => icon(['camera','glasses','toy','chip','bot','headphones','mic','watch','arm'][Number(cat.no) - 1] || 'chip');

function card(reg, cat) {
  const projects = casesFor(cat.id);
  return html`<a class="cat-card" href="#/c/${cat.id}">
    <div class="row1">
      <span class="cat-emoji" aria-hidden="true">${categoryIcon(cat)}</span>
      <div class="names"><small>${cat.no} · 商业化方向</small><h3>${cat.name}</h3></div>
      <span class="card-arrow" aria-hidden="true">${icon('arrow')}</span>
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
  return html`<div class="mode-banner">${icon('info')}<div><strong>先看免费样本</strong>
    <p>样本展示预先保存的结果，不调用模型、不产生费用。想用自己的素材生成回答或纪要，可从体验页面进入设置、填写百炼 Key，保存后返回再确认开始。<a href="#/me">查看设置与使用说明</a></p></div></div>`;
}

export const dataNote = (reg) => `方案注册表 · demo 标准 v${reg.standard}`;

export function renderHome(view, reg) {
  document.title = '体验中心 · AIHW Starter';
  const saved = savedStacks(reg).length > 0;
  const recent = readHistory().records.slice(0, 3);
  mountPage(view, html`
    <header class="app-top"><span class="eyebrow">探索 · 体验 · 构建</span>
      <a class="chip ${saved ? 'ok' : 'accent'}" href="#/me"><i aria-hidden="true"></i>${saved ? '已填 Key' : '免费样本'}</a></header>
    <section class="intro home-intro">
      <h1>从一次体验开始。</h1>
      <p>一张照片，一段录音。先看 AI 能做什么，再用自己的素材试一试。</p>
    </section>
    <section class="featured-grid" aria-label="精选体验">${Object.entries(PRODUCTS).map(([id,p],i)=>html`<a class="featured-card ${i ? 'recorder' : 'vision'}" href="#/s/${id}/default">
      <div class="feature-heading"><span class="feature-art" aria-hidden="true">${icon(i ? 'mic' : 'glasses')}</span><span><span class="eyebrow">${i ? 'AUDIO → NOTES' : 'IMAGE → ANSWER'}</span><h2>${p.title}</h2></span><span class="card-arrow" aria-hidden="true">${icon('arrow')}</span></div>
      <p>${i ? '录下讨论，留下要点与下一步。' : '拍下眼前，问出你想知道的事。'}</p>
      ${i ? html`<div class="feature-preview audio-preview" aria-hidden="true"><div class="audio-sample"><span class="sample-play">${icon('play')}</span><span class="sample-wave">${Array.from({length:28},()=>html`<i></i>`)}</span><span class="sample-time">WAV</span></div><div class="note-sample"><span class="note-label">${icon('file')}会议纪要</span><span class="note-line"></span><span class="note-line short"></span><span class="note-tags"><b>要点</b><b>决定</b><b>待办</b></span></div></div>`
        : html`<div class="feature-preview image-preview" aria-hidden="true"><img src="${new URL('assets/02-ai-glasses.bailian/samples/dish.jpg',reg.root).href}" alt="" width="640" height="480"><span class="image-frame"></span><span class="preview-caption">示例照片<span>看见 · 理解</span></span></div>`}
      <span class="feature-link"><span>开始体验 <span class="feature-free">免费样本</span></span>${icon('arrow')}</span></a>`)}</section>
    ${recent.length ? html`<section class="section"><div class="section-title"><h2>最近体验</h2><a href="#/me">查看历史</a></div><div class="panel">${recent.map(r=>html`<a class="history-preview" href="#/me?history=${encodeURIComponent(r.id)}"><span><strong>${PRODUCTS[r.trace.solution]?.title || r.trace.title}</strong><small>${new Date(r.trace.ran_at).toLocaleString('zh-CN')}</small></span><span class="chip">${statusLabel(r.trace)}</span></a>`)}</div></section>` : ''}
    <section class="workspace-links" aria-label="继续验证"><a class="panel" href="#/hardware"><span class="workspace-icon">${icon('chip')}</span><span><strong>把能力做进硬件</strong><p>3 条 ESP32 路线与成本规划</p></span>${icon('arrow')}</a><a class="panel" href="#/cost-lab"><span class="workspace-icon">${icon('chart')}</span><span><strong>核对每次调用成本</strong><p>用自己的价格与运行记录算账</p></span>${icon('arrow')}</a></section>
    ${modeBanner(reg)}
    <section class="section">
      <div class="section-title"><h2>商业化品类 <small>${reg.categories.length}</small></h2><small>场景与具体项目</small></div>
      <div class="cat-list">${reg.categories.map((c) => card(reg, c))}</div>
    </section>
    <p class="footnote">
      数据：<a href="${reg.repo.url || 'https://github.com/smile-xuc/aihw-starter'}" rel="noopener">smile-xuc/aihw-starter</a> · ${dataNote(reg)}<br>
      免费样本不产生费用；真实调用费用以账单为准 · <a href="../designs/aihw-square/app-v2.html?screen=home">APP 设计原型（存档）</a>
    </p>`);
}
