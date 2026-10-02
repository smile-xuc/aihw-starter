import { label, repoLink, trace as loadTrace } from '../data.js';
import { hostsFor } from '../live/client.js';
import { browserSupport, requiredMissing, runInBrowser } from '../live/index.js';
import { costInfo, kindOf, range, verificationBadge } from '../meta.js';
import { playTrace, resultLines, Stage } from '../replay.js';
import { fieldValues, loadCredentials } from '../settings.js';
import { copyText, download, fmtCny, fmtYuan, html, icon, mount, mountPage, sheet } from '../ui.js';
import { experienceChips } from './home.js';

const PER_DAY = 30;

function cmd(text) {
  return html`<div class="cmd"><code>${text}</code><button type="button" data-copy="${text}" aria-label="复制命令">复制</button></div>`;
}

function regionLabel(stack, region) {
  return stack?.fields?.find((f) => f.key === 'DASHSCOPE_API_REGION')?.options?.find((o) => o.value === region)?.label || region;
}

function effectActions(reg, sol, variant, cred) {
  const support = browserSupport(reg, sol, variant);
  if (support.status === 'runnable') {
    if (!cred) {
      return html`<a class="secondary-action block" href="#/me">${icon('key')}填自己的百炼 Key 后，可以在浏览器里真跑</a><p class="small">${support.note}</p>`;
    }
    const missing = requiredMissing(reg, sol, variant, cred.values);
    if (missing.length) {
      return html`<a class="secondary-action block" href="#/me">${icon('key')}这个方案还要填：${missing.join('、')}</a><p class="small">${support.note}</p>`;
    }
    return html`<button type="button" class="primary-action" data-act="live">${icon('play')}用我的 Key 真跑</button>
      <button type="button" class="secondary-action block hidden" data-act="stop">${icon('stop')}停止</button>
      <p class="small">${support.note} 浏览器真跑待真 Key 验证。</p>`;
  }
  const title = { unavailable: '网页真跑暂未开放', blocked: '浏览器里跑不了，只放回放' }[support.status] || '这个玩法没有网页真跑';
  return html`<div class="panel"><h3>${title}</h3><p>${support.reason}</p>
    <p>要真跑，在电脑上运行 <code>${variant.live_command || sol.run?.live || 'python3 run.py'}</code>（见下方「三步跑通」）。</p></div>`;
}

function costSection(reg, sol) {
  const c = costInfo(sol);
  const y = c ? range(c.low * PER_DAY * 365, c.high * PER_DAY * 365) : null;
  const variants = sol.variants.filter((v) => v.cost);
  const lat = sol.latency || {};
  return html`<div class="panel">
    <div class="cost-hero"><div><div class="num">${c ? `¥${fmtCny(range(c.low, c.high))}` : '—'}</div><div class="unit">${sol.cost?.unit || '一次交互'}</div></div>
      ${c ? html`<span class="chip ${c.cls}">${c.label === '估算' ? '估算：mock 用量 × 官方单价' : c.label}</span>` : ''}</div>
    <dl class="kv">
      <dt>按年折算</dt><dd>${y != null ? `假设每台每天 ${PER_DAY} 次，一年约 ${fmtYuan(y)}` : '—'}</dd>
      ${variants.length > 1 ? html`<dt>各玩法</dt><dd>${variants.map((v) => `${v.title} ¥${fmtCny(range(v.cost.low, v.cost.high))}`).join('；')}</dd>` : ''}
      <dt>计费口径</dt><dd>${sol.cost?.basis || '—'}</dd>
      <dt>首字延迟</dt><dd>${lat.first_token || '—'}；${lat.measured ? `实测 ${lat.measured.text || ''}` : '还没有实测值'}</dd>
      <dt>地域</dt><dd>${(sol.regions || []).map((r) => regionLabel(reg.stacks.get(sol.stack), r)).join('、')}</dd>
    </dl>
    <div class="live-cost hidden"></div>
    <p class="info-note">${icon('info')}<span>${c?.note || 'mock 用量为示意值'}，只用来说明量级；真跑以接口返回的 usage 计，最终以账单为准。单价表与查证日期见 demo 说明，替代路线（如套件 License）见品类算账文档。</span></p>
  </div>`;
}

function hardwareSection(reg, sol) {
  const hw = sol.hardware || {};
  const v = verificationBadge(sol);
  const stack = reg.stacks.get(sol.stack);
  const fieldLabel = (k) => stack?.fields?.find((f) => f.key === k)?.label || k;
  const creds = sol.credentials || {};
  const run = sol.run || {};
  const pending = sol.verification?.pending_checks || [];
  return html`
    <div class="parts">${(hw.parts || []).map((p) => html`<div class="part"><strong>${p.label || label(reg.labels.parts, p.part)}</strong><small>${p.role || ''}${p.simulated_by ? `；demo 用 ${p.simulated_by} 模拟` : ''}</small></div>`)}
      <div class="part"><strong>联网</strong><small>Wi-Fi / 4G，或经手机 App 中转；模型在云端</small></div>
    </div>
    <p class="info-note">${icon('info')}<span>芯片与板卡：${[...(hw.chips || []), ...(hw.boards || [])].join('、') || '还没有数据，接入芯片验证后在这里显示'}。</span></p>
    <div class="panel"><h3>模型</h3>
      ${(sol.models || []).map((m) => html`<div class="model-row"><code>${m.id}</code><p>${m.role}${m.regions ? `（仅 ${m.regions.map((r) => regionLabel(stack, r)).join('、')}）` : ''}</p></div>`)}
    </div>
    <div class="panel"><h3>在电脑上三步跑通</h3>
      <ol class="steps-list">
        <li><div>拿到代码，进入 demo 目录${cmd(`git clone ${reg.repo.url || 'https://github.com/smile-xuc/aihw-starter'} && cd aihw-starter/${run.cwd || sol.path}`)}</div></li>
        <li><div>${run.setup || '安装依赖'}${/pip /.test(run.setup || '') ? cmd(run.setup) : ''}</div></li>
        <li><div>复制 .env.example 为 .env，填 ${(creds.required || []).map(fieldLabel).join('、') || 'Key'}${creds.optional?.length ? `（可选：${creds.optional.map(fieldLabel).join('、')}）` : ''}${cmd('cp .env.example .env')}</div></li>
        <li><div>运行；没有 Key 时同一条命令自动进入 mock${cmd(run.live || 'python3 run.py')}</div></li>
      </ol>
      <p class="small">验证状态：${v.label}${sol.verification?.live_records ? `（${sol.verification.live_records} 条真跑记录）` : ''}。${pending.length ? `待实测：${pending.join('、')}。` : ''}真跑成功后 <code>python3 run.py --record</code> 把一行记录追加到 VERIFY.md。</p>
    </div>`;
}

function complianceSection(reg, sol, cat) {
  const base = reg.vocab.compliance_baseline;
  const sources = (tag) => reg.labels.compliance.get(tag)?.sources || [];
  const srcHtml = (list) => (list.length ? html`<small>依据：${list.map((s, i) => html`${i ? '；' : ''}${s.url ? html`<a href="${s.url}" rel="noopener">${s.title}</a>` : s.title}`)}</small>` : '');
  return html`<div class="panel">
    ${(sol.compliance || []).map((c) => html`<div class="duty"><span class="chip stat">${c.label}</span><div><p>${c.obligation}</p>${srcHtml(sources(c.tag))}</div></div>`)}
    ${base ? html`<div class="duty"><span class="chip">${base.label || '所有方案'}</span><div><p>${base.obligation}</p>${srcHtml(base.sources || [])}</div></div>` : ''}
  </div>
  <p class="info-note">${icon('shield')}<span>以上是要点摘要，不构成法律意见。细节见${(sol.docs?.faq || cat.docs?.faq) ? html`<a href="${repoLink(reg, sol.docs?.faq || cat.docs.faq)}" rel="noopener">品类常见问答</a>` : '品类常见问答'}。</span></p>`;
}

function deeperSection(reg, sol) {
  const d = sol.docs || {};
  const links = [
    ['demo 说明（三步跑通、链路、计费口径）', d.readme && repoLink(reg, d.readme)],
    ['验证记录 VERIFY.md', d.verify && repoLink(reg, d.verify)],
    ['方案清单 solution.yaml', repoLink(reg, `${sol.path}/solution.yaml`)],
    ['品类概述', d.category && repoLink(reg, d.category)],
    ['技术方案 02-solution', d.solution && repoLink(reg, d.solution)],
    ['算账 03-cost', d.cost && repoLink(reg, d.cost)],
    ['上游项目', sol.upstream],
  ].filter(([, url]) => url);
  return html`<div class="link-list">${links.map(([text, url]) => html`<a href="${url}" rel="noopener">${text}${icon('link')}</a>`)}</div>`;
}

export async function renderSolution(view, reg, id, variantId = '') {
  const sol = reg.byId.get(id);
  if (!sol) {
    location.replace('#/');
    return null;
  }
  const cat = reg.catById.get(sol.category);
  const stack = reg.stacks.get(sol.stack);
  const variant = sol.variants.find((v) => v.id === variantId) || sol.variants[0] || { id: 'default', title: '默认' };
  const saved = loadCredentials(sol.stack);
  const cred = saved && stack ? { stack, values: fieldValues(stack, saved.values) } : null;
  document.title = `${sol.title} · AIHW`;
  const archetype = label(reg.labels.archetypes, variant.archetype || sol.archetype || '');
  const page = mountPage(view, html`
    <div class="subbar"><a class="back-link" href="#/c/${cat.id}">${icon('back')}${cat.name}</a></div>
    <section class="sol-head page-head">
      <p class="eyebrow">${stack?.name || sol.stack} · ${sol.kind === 'reference' ? '参考方案' : '上游指针'}${archetype ? ` · ${archetype}` : ''}</p>
      <h1>${sol.title}</h1>
      <p>${sol.summary}</p>
      <div class="chips">${[...experienceChips(reg, sol), verificationBadge(sol)].map((c) => html`<span class="chip ${c.cls}">${c.label}</span>`)}</div>
      <nav class="qnav" aria-label="四个问题">
        <a href="#effect" data-jump="effect"><b>效果</b>怎样</a><a href="#cost" data-jump="cost"><b>成本</b>一次多少钱</a>
        <a href="#hardware" data-jump="hardware"><b>硬件</b>要什么</a><a href="#compliance" data-jump="compliance"><b>合规</b>有哪些义务</a>
      </nav>
    </section>

    <section class="section" id="effect">
      <div class="section-title"><h2><span class="q">①</span>效果怎样</h2><small>${variant.mock_command || sol.run?.mock || ''}</small></div>
      ${sol.variants.length > 1 ? html`<div class="segment variant-switch" role="group" aria-label="玩法">${sol.variants.map((v) => html`<button type="button" data-variant="${v.id}" aria-pressed="${String(v.id === variant.id)}">${v.title}</button>`)}</div>` : ''}
      <div class="stage-host"><div class="stage"><p class="small">正在加载回放……</p></div></div>
      <div class="live-bar">${effectActions(reg, sol, variant, cred)}</div>
    </section>

    <section class="section" id="cost">
      <div class="section-title"><h2><span class="q">②</span>一次多少钱</h2></div>
      ${costSection(reg, sol)}
    </section>

    <section class="section" id="hardware">
      <div class="section-title"><h2><span class="q">③</span>做成产品要什么硬件</h2></div>
      ${hardwareSection(reg, sol)}
    </section>

    <section class="section" id="compliance">
      <div class="section-title"><h2><span class="q">④</span>有哪些合规义务</h2></div>
      ${complianceSection(reg, sol, cat)}
    </section>

    <section class="section">
      <div class="section-title"><h2>深入</h2></div>
      ${deeperSection(reg, sol)}
    </section>`);

  const host = page.querySelector('.stage-host');
  let replay = null;
  let running = null;
  const tr = await loadTrace(reg, sol, variant).catch((e) => {
    mount(host, html`<div class="inline-error">回放轨迹加载失败：${e.message}</div>`);
    return null;
  });
  if (tr) {
    const stage = new Stage(host, { reg, sol, badges: [{ label: '回放', cls: 'accent' }, { label: tr.mode === 'mock' ? 'mock 示意' : '真跑记录', cls: '' }], mode: tr.mode });
    replay = playTrace(stage, tr);
  } else if (!host.querySelector('.inline-error')) {
    mount(host, html`<div class="panel"><p>这个玩法还没有回放轨迹。</p></div>`);
  }

  page.addEventListener('click', (e) => {
    const copy = e.target.closest('[data-copy]');
    if (copy) copyText(copy.dataset.copy);
    const jump = e.target.closest('[data-jump]');
    if (jump) {
      e.preventDefault();
      page.querySelector(`#${jump.dataset.jump}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    const v = e.target.closest('[data-variant]');
    if (v && v.dataset.variant !== variant.id) location.hash = `#/s/${encodeURIComponent(sol.id)}/${encodeURIComponent(v.dataset.variant)}`;
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'live' && !running) running = startLive();
    if (act === 'stop') running?.abort();
  });

  function startLive() {
    const ctrl = new AbortController();
    (async () => {
      const c = costInfo(sol);
      const est = c ? `约 ¥${fmtCny(range(c.low, c.high))} / 次（${c.label}，真实用量可能更高）` : '以账单为准';
      const answer = await sheet(html`<h2>用你的 Key 真跑</h2>
        <p>浏览器会直接调用${stack.name}，按你账号的单价计费。</p>
        <ul><li>模型：${(sol.models || []).map((m) => m.id).join('、')}</li>
          <li>请求只发往：${hostsFor(stack, cred.values).join('、')}</li>
          <li>地域：${regionLabel(stack, cred.values.DASHSCOPE_API_REGION)}</li>
          <li>预计花费：${est}</li></ul>
        <p class="small">${browserSupport(reg, sol, variant).note} 浏览器真跑的代码还没用真 Key 验证过，结果和报错欢迎反馈到仓库 Issue。生成的内容由 AI 生成，仅供参考。</p>
        <div class="btn-row"><button type="button" class="secondary-action" data-sheet="cancel">取消</button>
          <button type="button" class="primary-action" data-sheet="go" data-autofocus>开始真跑</button></div>`, { label: '确认真跑' }).done;
      if (answer !== 'go') { running = null; return; }
      replay?.stop();
      const stage = new Stage(host, {
        reg, sol, controls: false, aiLabel: '内容由 AI 生成', mode: 'live',
        badges: [{ label: '真跑 · 你的 Key', cls: 'ok' }, { label: '待真 Key 验证', cls: 'warn' }],
      });
      if (tr) stage.setInputs(tr.inputs);
      const liveBtn = page.querySelector('[data-act="live"]');
      const stopBtn = page.querySelector('[data-act="stop"]');
      liveBtn.disabled = true;
      stopBtn.classList.remove('hidden');
      const startedAt = new Date();
      let result = null;
      let error = null;
      try {
        result = await runInBrowser(reg, sol, variant, cred, stage, {
          signal: ctrl.signal,
          onFallback: (from, to) => stage.push({ tag: '提示', kind: 'notice', text: `${from} 的这个接口在浏览器里被跨域拦截，本次改走 ${to}` }),
        });
      } catch (err) {
        error = err;
        stage.push(err.name === 'AbortError'
          ? { tag: '提示', kind: 'notice', text: '已停止' }
          : { tag: '提示', kind: 'notice', text: `出错：${err.message}`, lines: err.hint ? [err.hint] : [] });
      } finally {
        liveBtn.disabled = false;
        stopBtn.classList.add('hidden');
        running = null;
      }
      const cost = result ? (Array.isArray(result.cost) ? { low: result.cost[0], high: result.cost[1] } : { low: result.cost, high: result.cost }) : null;
      const record = {
        schema: 'aihw/trace@0.1', solution: sol.id, variant: variant.id, mode: 'live', kit: null, runner: 'browser',
        args: variant.args || [], title: sol.title, region: cred.values.DASHSCOPE_API_REGION, models: (sol.models || []).map((m) => m.id),
        timing: 'measured', ran_at: startedAt.toISOString(),
        events: stage.events.map((ev, i) => ({ i, t_ms: ev.t_ms ?? null, tag: ev.tag, kind: ev.kind || kindOf(ev.tag), text: ev.text, lines: ev.lines || [], assets: ev.assets || [] })),
        result: result ? { models: result.models, first_token_ms: result.firstMs, cost, sample: result.sample, note: result.note } : null,
        inputs: (tr?.inputs || []).map((f) => ({ ...f, asset: null })),
        outputs: (result?.outputs || []).map(({ url, note, ...f }) => ({ ...f, asset: null })),
        error: error && error.name !== 'AbortError' ? error.message : null,
      };
      if (result) {
        stage.setOutputs(result.outputs || []);
        stage.setFoot([...resultLines(record), '成本按接口返回的 usage × 单价计算，以账单为准；首字延迟含你的网络，和设备上的口径不同。']);
        const box = page.querySelector('.live-cost');
        const first = result.firstMs != null ? `${Math.round(result.firstMs)} ms` : '—';
        mount(box, html`<p class="inline-ok">本次真跑：¥${fmtCny(result.cost)}（${regionLabel(stack, cred.values.DASHSCOPE_API_REGION)}，按返回的 usage 计）· 首字 ${first}</p>`);
        box.classList.remove('hidden');
      }
      page.querySelector('[data-export]')?.remove();
      const exportBtn = document.createElement('button');
      exportBtn.type = 'button';
      exportBtn.dataset.export = '1';
      exportBtn.className = 'secondary-action block';
      exportBtn.textContent = '导出本次记录（aihw/trace@0.1，不含 Key）';
      exportBtn.addEventListener('click', () => download(`${sol.id}.${variant.id}.browser-live.json`, JSON.stringify(record, null, 1)));
      page.querySelector('.live-bar').append(exportBtn);
    })();
    return ctrl;
  }

  return { cleanup: () => { replay?.stop(); running?.abort(); } };
}
