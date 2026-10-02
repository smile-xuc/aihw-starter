import { trace as loadTrace } from '../data.js';
import { hosts } from '../live/bailian.js';
import { browserSupport, runInBrowser } from '../live/index.js';
import { ARCHETYPES, COMPLIANCE, GENERAL_DUTY, REGIONS, STACKS, hardwareParts, verificationOf } from '../meta.js';
import { playTrace, Stage } from '../replay.js';
import { loadBailian } from '../settings.js';
import { copyText, download, fmtCny, fmtYuan, html, icon, mount, mountPage, repoUrl, sheet } from '../ui.js';
import { experienceChips } from './home.js';

const PER_DAY = 30;

function yearly(cny) {
  if (cny == null) return null;
  const f = (v) => v * PER_DAY * 365;
  return Array.isArray(cny) ? [f(cny[0]), f(cny[1])] : f(cny);
}

function cmd(text) {
  return html`<div class="cmd"><code>${text}</code><button type="button" data-copy="${text}" aria-label="复制命令">复制</button></div>`;
}

function effectActions(sol, support, key) {
  if (support.status === 'runnable') {
    if (!key) {
      return html`<a class="secondary-action block" href="#/me">${icon('key')}填自己的百炼 Key 后，可以在浏览器里真跑</a>
        <p class="small">${support.note}</p>`;
    }
    return html`<button type="button" class="primary-action" data-act="live">${icon('play')}用我的 Key 真跑</button>
      <button type="button" class="secondary-action block hidden" data-act="stop">${icon('stop')}停止</button>
      <p class="small">${support.note} 浏览器真跑待真 Key 验证。</p>`;
  }
  return html`<div class="panel"><h3>浏览器里跑不了，只放回放</h3><p>${support.reason}</p>
    <p>要真跑，在电脑上用「三步跑通」（见下方「做成产品要什么硬件」）。</p></div>`;
}

function costSection(sol) {
  const c = sol.cost || {};
  const y = yearly(c.cny);
  return html`<div class="panel">
    <div class="cost-hero"><div><div class="num">${c.cny != null ? `¥${fmtCny(c.cny)}` : '—'}</div><div class="unit">${c.unit || '一次交互'}</div></div>
      <span class="chip ${c.basis === 'mock' ? 'stat' : 'ok'}">${c.basis === 'mock' ? '估算：mock 用量 × 官方单价' : '实测'}</span></div>
    <dl class="kv">
      <dt>按年折算</dt><dd>${y != null ? html`每台每天 ${PER_DAY} 次，一年约 ${fmtYuan(y)}` : '—'}</dd>
      <dt>计费口径</dt><dd>${sol.metrics?.cost || '—'}</dd>
      <dt>首字延迟</dt><dd>${sol.metrics?.first_token || '—'}；实测值见验证记录</dd>
      <dt>地域</dt><dd>${(sol.regions || []).map((r) => REGIONS[r] || r).join('、')}，新加坡单价普遍更高</dd>
    </dl>
    <div class="live-cost hidden"></div>
    <p class="info-note">${icon('info')}<span>mock 用量是示意值，只用来说明量级；真跑以接口返回的 usage 计，最终以百炼账单为准。单价表与查证日期见 demo README，替代路线（如套件 License）见品类的算账文档。</span></p>
  </div>`;
}

function hardwareSection(sol) {
  const parts = hardwareParts(sol.device);
  const v = verificationOf(sol);
  return html`
    <div class="parts">${parts.map((p) => html`<div class="part"><strong>${p.name}</strong><small>${p.note}${p.via.length ? `；demo 用 ${p.via.join('、')} 模拟` : ''}</small></div>`)}
      <div class="part"><strong>联网</strong><small>Wi-Fi / 4G，或经手机 App 中转；模型都在云端</small></div>
    </div>
    <p class="info-note">${icon('info')}<span>芯片与板卡：方案清单（solution.yaml）还没有 hardware 字段，接入芯片验证后在这里显示。</span></p>
    <div class="panel"><h3>模型</h3>
      ${(sol.models || []).map((m) => html`<div class="model-row"><code>${m.id}</code><p>${m.role}</p></div>`)}
    </div>
    <div class="panel"><h3>在电脑上三步跑通</h3>
      <ol class="steps-list">
        <li><div>拿到代码，进入 demo 目录${cmd(`git clone https://github.com/smile-xuc/aihw-starter && cd aihw-starter/${sol.path}`)}</div></li>
        <li><div>${sol.run?.setup || '安装依赖'}${/pip /.test(sol.run?.setup || '') ? cmd(sol.run.setup) : ''}</div></li>
        <li><div>复制 .env.example 为 .env，填 ${(sol.env || []).join('、')}${cmd('cp .env.example .env')}</div></li>
        <li><div>运行；没有 Key 时同一条命令自动进入 mock${cmd(sol.run?.live || 'python3 run.py')}</div></li>
      </ol>
      <p class="small">验证状态：${v.label}。真跑成功后 <code>python3 run.py --record</code> 把一行记录追加到 VERIFY.md。</p>
    </div>`;
}

function complianceSection(sol, cat) {
  const tags = sol.compliance_tags || [];
  const duties = tags.map((t) => ({ tag: t, ...(COMPLIANCE[t] || { label: t, duty: '这个标签还没有说明，见品类常见问答。', ref: '' }) }));
  duties.push({ tag: 'general', ...GENERAL_DUTY });
  return html`<div class="panel">
    ${duties.map((d) => html`<div class="duty"><span class="chip ${d.tag === 'general' ? '' : 'stat'}">${d.label}</span><div><p>${d.duty}</p>${d.ref ? html`<small>依据：${d.ref}</small>` : ''}</div></div>`)}
  </div>
  <p class="info-note">${icon('shield')}<span>以上是要点摘要，不构成法律意见。细节见<a href="${repoUrl(cat.docs.faq)}" rel="noopener">品类常见问答</a>。</span></p>`;
}

function deeperSection(sol, cat) {
  const links = [
    ['demo 说明（三步跑通、链路、计费口径）', repoUrl(`${sol.path}/README.md`)],
    ['验证记录 VERIFY.md', repoUrl(`${sol.path}/${sol.verification?.record || 'VERIFY.md'}`)],
    ['方案清单 solution.yaml', repoUrl(`${sol.path}/solution.yaml`)],
    ['技术方案 02-solution', repoUrl(cat.docs.solution)],
    ['算账 03-cost', repoUrl(cat.docs.cost)],
    ['公开案例 04-cases', repoUrl(cat.docs.cases)],
  ];
  if (sol.upstream) links.push(['上游项目', sol.upstream]);
  return html`<div class="link-list">${links.map(([label, url]) => html`<a href="${url}" rel="noopener">${label}${icon('link')}</a>`)}</div>`;
}

export async function renderSolution(view, reg, id) {
  const sol = reg.byId.get(id);
  if (!sol) {
    location.replace('#/');
    return null;
  }
  const cat = reg.catById.get(sol.category);
  document.title = `${sol.title} · AIHW`;
  const support = browserSupport(sol);
  const key = loadBailian();
  const v = verificationOf(sol);
  const page = mountPage(view, html`
    <div class="subbar"><a class="back-link" href="#/c/${cat.id}">${icon('back')}${cat.name}</a></div>
    <section class="sol-head page-head">
      <p class="eyebrow">${STACKS[sol.stack] || sol.stack} · ${sol.kind === 'reference' ? '参考方案' : '上游指针'} · ${ARCHETYPES[sol.archetype] || ''}</p>
      <h1>${sol.title}</h1>
      <p>${sol.summary}</p>
      <div class="chips">${[...experienceChips(sol), v].map((c) => html`<span class="chip ${c.cls}">${c.label}</span>`)}</div>
      <nav class="qnav" aria-label="四个问题">
        <a href="#effect" data-jump="effect"><b>效果</b>怎样</a><a href="#cost" data-jump="cost"><b>成本</b>一次多少钱</a>
        <a href="#hardware" data-jump="hardware"><b>硬件</b>要什么</a><a href="#compliance" data-jump="compliance"><b>合规</b>有哪些义务</a>
      </nav>
    </section>

    <section class="section" id="effect">
      <div class="section-title"><h2><span class="q">①</span>效果怎样</h2><small>${sol.run?.mock || ''}</small></div>
      <div class="stage-host"><div class="stage"><p class="small">正在加载回放……</p></div></div>
      <div class="live-bar">${effectActions(sol, support, key)}</div>
    </section>

    <section class="section" id="cost">
      <div class="section-title"><h2><span class="q">②</span>一次多少钱</h2></div>
      ${costSection(sol)}
    </section>

    <section class="section" id="hardware">
      <div class="section-title"><h2><span class="q">③</span>做成产品要什么硬件</h2></div>
      ${hardwareSection(sol)}
    </section>

    <section class="section" id="compliance">
      <div class="section-title"><h2><span class="q">④</span>有哪些合规义务</h2></div>
      ${complianceSection(sol, cat)}
    </section>

    <section class="section">
      <div class="section-title"><h2>深入</h2></div>
      ${deeperSection(sol, cat)}
    </section>`);

  const host = page.querySelector('.stage-host');
  let replay = null;
  let running = null;
  const tr = await loadTrace(sol).catch((e) => {
    mount(host, html`<div class="inline-error">回放轨迹加载失败：${e.message}</div>`);
    return null;
  });
  if (tr) {
    const stage = new Stage(host, { sol, badges: [{ label: '回放', cls: 'accent' }, { label: 'mock 示意', cls: '' }] });
    replay = playTrace(stage, tr);
  }

  page.addEventListener('click', (e) => {
    const copy = e.target.closest('[data-copy]');
    if (copy) copyText(copy.dataset.copy);
    const jump = e.target.closest('[data-jump]');
    if (jump) {
      e.preventDefault();
      page.querySelector(`#${jump.dataset.jump}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'live' && !running) running = startLive();
    if (act === 'stop') running?.abort();
  });

  function startLive() {
    const cfg = loadBailian();
    if (!cfg) {
      location.hash = '#/me';
      return null;
    }
    const ctrl = new AbortController();
    (async () => {
      const est = sol.cost?.cny != null ? `约 ¥${fmtCny(sol.cost.cny)} / 次（按 mock 用量估算，真实用量可能更高）` : '以账单为准';
      const answer = await sheet(html`<h2>用你的 Key 真跑</h2>
        <p>浏览器会直接调用百炼，按你账号的单价计费。</p>
        <ul><li>模型：${(sol.models || []).map((m) => m.id).join('、')}</li>
          <li>请求只发往：${hosts(cfg).join('、')}</li>
          <li>地域：${REGIONS[cfg.region]}${cfg.workspaceId ? ' · 业务空间专属域名' : ' · 通用域名'}</li>
          <li>预计花费：${est}</li></ul>
        <p class="small">${support.note} 浏览器真跑的代码还没用真 Key 验证过，结果和报错欢迎反馈到仓库 Issue。生成的内容由 AI 生成，仅供参考。</p>
        <div class="btn-row"><button type="button" class="secondary-action" data-sheet="cancel">取消</button>
          <button type="button" class="primary-action" data-sheet="go" data-autofocus>开始真跑</button></div>`, { label: '确认真跑' }).done;
      if (answer !== 'go') { running = null; return; }
      replay?.stop();
      const stage = new Stage(host, {
        sol, controls: false, aiLabel: '内容由 AI 生成',
        badges: [{ label: '真跑 · 你的 Key', cls: 'ok' }, { label: '待真 Key 验证', cls: 'warn' }],
      });
      if (tr) stage.setInputs(tr.inputs);
      const liveBtn = page.querySelector('[data-act="live"]');
      const stopBtn = page.querySelector('[data-act="stop"]');
      liveBtn.disabled = true;
      stopBtn.classList.remove('hidden');
      try {
        const result = await runInBrowser(sol, cfg, stage, {
          signal: ctrl.signal,
          onFallback: (from, to) => stage.push({ tag: '提示', text: `${from} 的这个接口在浏览器里被跨域拦截，本次改走 ${to}` }),
        });
        stage.setOutputs(result.outputs || []);
        const first = result.firstMs != null ? `${Math.round(result.firstMs)} ms` : '—';
        stage.setFoot([
          `本次真跑：单次成本 ¥${fmtCny(result.cost)} · 首字 ${first} · 输入 ${result.sample || '—'}`,
          `备注：${result.note || ''}`,
          '成本按接口返回的 usage × 单价计算，以百炼账单为准；首字延迟含你的网络，和设备上的口径不同。',
        ]);
        const box = page.querySelector('.live-cost');
        mount(box, html`<p class="inline-ok">本次真跑：¥${fmtCny(result.cost)}（${REGIONS[cfg.region]}，按返回的 usage 计）· 首字 ${first}</p>
          <button type="button" class="secondary-action block" data-act="export">导出本次记录（JSON，不含 Key）</button>`);
        box.classList.remove('hidden');
        box.querySelector('[data-act="export"]').addEventListener('click', () => {
          const record = {
            schema: 'aihw-app/browser-run@temp', solution: sol.id, mode: 'browser-live', region: cfg.region,
            workspace_domain: Boolean(cfg.workspaceId), ran_at: new Date().toISOString(), models: result.models,
            events: stage.events, finish: { first_ms: result.firstMs, cost_cny: result.cost, sample: result.sample, note: result.note },
            outputs: result.outputs || [],
          };
          download(`${sol.id}.browser-run.json`, JSON.stringify(record, null, 1));
        });
      } catch (err) {
        if (err.name === 'AbortError') stage.push({ tag: '提示', text: '已停止' });
        else stage.push({ tag: '提示', text: `出错：${err.message}`, detail: err.hint || '' });
      } finally {
        liveBtn.disabled = false;
        stopBtn.classList.add('hidden');
        running = null;
      }
    })();
    return ctrl;
  }

  return { cleanup: () => { replay?.stop(); running?.abort(); } };
}
