import { label } from '../data.js';
import { runnerCount, solutionRunnable } from '../live/index.js';
import { costInfo, range, verificationBadge } from '../meta.js';
import { loadCredentials } from '../settings.js';
import { brandmark, fmtCny, html, icon, mountPage } from '../ui.js';

export function experienceChips(reg, sol) {
  const modes = sol.experience?.modes || [];
  const chips = [];
  if (modes.includes('replay')) chips.push({ label: label(reg.labels.modes, 'replay'), cls: 'accent' });
  if (solutionRunnable(reg, sol)) chips.push({ label: '网页真跑', cls: 'cloud' });
  if (modes.includes('local-run')) chips.push({ label: label(reg.labels.modes, 'local-run'), cls: '' });
  return chips;
}

function costCell(sol) {
  const c = costInfo(sol);
  if (!c) return html`<b>—</b><small>暂无成本</small>`;
  return html`<b>¥${fmtCny(range(c.low, c.high))}</b><small>${c.label} / 次</small>`;
}

function card(reg, cat) {
  const sol = cat.solutions[0];
  const stacks = cat.solutions.map((s) => reg.stacks.get(s.stack)?.name?.replace(/^阿里云/, '') || s.stack);
  const chips = sol ? [
    ...experienceChips(reg, sol),
    ...(sol.compliance || []).map((c) => ({ label: c.label, cls: 'stat' })),
    verificationBadge(sol),
  ] : [{ label: '暂无参考方案', cls: '' }];
  return html`<a class="cat-card" href="#/c/${cat.id}">
    <div class="row1">
      <span class="cat-emoji" aria-hidden="true">${cat.emoji || '·'}</span>
      <div class="names"><small>${cat.no} · ${stacks.join(' / ') || '待接入'}</small><h3>${cat.name}</h3></div>
      <div class="cost">${sol ? costCell(sol) : ''}</div>
    </div>
    <p class="scene">${cat.scenes || ''}</p>
    <div class="chips">${chips.map((c) => html`<span class="chip ${c.cls}">${c.label}</span>`)}</div>
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
  mountPage(view, html`
    <header class="app-top"><a class="wordmark" href="#/">${brandmark}AIHW</a>
      <a class="chip ${saved ? 'ok' : 'accent'}" href="#/me">${saved ? '已填 Key' : '回放模式'}</a></header>
    <section class="intro">
      <h1>${reg.categories.length} 个品类的 AI 硬件参考方案</h1>
      <p>每个方案回答四个问题：效果怎样、一次多少钱、做成产品要什么硬件、有哪些合规义务。</p>
    </section>
    ${modeBanner(reg)}
    <section class="section">
      <div class="section-title"><h2>品类 <small>${reg.categories.length}</small></h2><small>品类 × 栈</small></div>
      <div class="cat-list">${reg.categories.map((c) => card(reg, c))}</div>
    </section>
    <p class="footnote">
      数据：<a href="${reg.repo.url || 'https://github.com/smile-xuc/aihw-starter'}" rel="noopener">smile-xuc/aihw-starter</a> · ${dataNote(reg)}<br>
      成本未经真跑的都是估算（mock 用量 × 官方单价），以账单为准 · <a href="../designs/aihw-square/app-v2.html?screen=home">APP 设计原型（存档）</a>
    </p>`);
}
