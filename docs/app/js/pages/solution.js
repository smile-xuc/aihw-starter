import { label, repoLink, trace as loadTrace, sampleUrl } from '../data.js';
import { hostsFor } from '../live/client.js';
import { browserSupport, requiredMissing, runInBrowser } from '../live/index.js';
import { costInfo, kindOf, range, verificationBadge } from '../meta.js';
import { playTrace, resultLines, Stage } from '../replay.js';
import { fieldValues, loadCredentials, validateCredentials } from '../settings.js';
import { copyText, download, fmtCny, fmtYuan, html, icon, mount, mountPage, sheet } from '../ui.js';
import { experienceChips } from './home.js';

import { PRODUCTS, draftFor, resetDraft, setupRoute, decodeFile, browserTrace, renderOutcome, redact } from '../experience.js';
import { saveHistory } from '../history.js';
import { PROJECTS, referencePosition } from '../projects.js';

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
      return html`<a class="secondary-action block" href="${setupRoute(sol, variant)}">${icon('key')}填自己的百炼 Key 后，可以在浏览器里真跑</a><p class="small">${support.note}</p>`;
    }
    const missing = requiredMissing(reg, sol, variant, cred.values);
    if (missing.length) {
      return html`<a class="secondary-action block" href="${setupRoute(sol, variant)}">${icon('key')}这个方案还要填：${missing.join('、')}</a><p class="small">${support.note}</p>`;
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
      <dt>延迟口径</dt><dd>${lat.first_token || '—'}；${lat.measured ? `实测 ${lat.measured.text || ''}` : '还没有实测值'}</dd>
      <dt>地域</dt><dd>${(sol.regions || []).map((r) => regionLabel(reg.stacks.get(sol.stack), r)).join('、')}</dd>
    </dl>
    <div class="live-cost hidden"></div>
    <p class="info-note">${icon('info')}<span>${c?.note || 'mock 用量为示意值'}，只用来说明量级；真跑以接口返回的 usage 计，最终以账单为准。单价表与查证日期见 demo 说明，替代路线（如套件 License）见品类算账文档。</span></p>
    <a class="secondary-action block" href="#/cost-lab">用自己的价格说明与运行记录核对账单</a>
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
    <div class="parts">${(hw.parts || []).map((p) => html`<div class="part"><strong>${p.label || label(reg.labels.parts, p.part)}</strong><small>${p.role || ''}</small>${p.simulated_by ? html`<small class="sim">demo 里：${p.simulated_by}</small>` : ''}</div>`)}
      <div class="part"><strong>联网</strong><small>Wi-Fi / 4G，或经手机 App 中转；模型在云端</small></div>
    </div>
    <p class="info-note">${icon('info')}<span>芯片与板卡：${[...(hw.chips || []), ...(hw.boards || [])].join('、') || '还没有数据，接入芯片验证后在这里显示'}。</span></p>
    ${PROJECTS.filter(p=>p.scene===sol.id).map(p=>html`<a class="row-card" href="#/hardware/${p.id}"><span class="grow"><strong>${p.title}</strong><small>完整链路设计、原型 BOM 与研发预算；板卡待验证</small></span>${icon('chevron')}</a>`)}
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

export async function renderSolution(view, reg, id, variantId = '', { isCurrent = () => true } = {}) {
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
  const tr = await loadTrace(reg, sol, variant).catch(() => null);
  if (!isCurrent()) return null;
  const product = variant.id === 'default' ? PRODUCTS[sol.id] : null;
  const draftKey = `${sol.id}/${variant.id}`;
  const sampleQuestion = '这是什么菜？辣不辣？';
  const initialDraft = {question:product?.kind === 'image' ? sampleQuestion : ''};
  let draft = draftFor(draftKey, initialDraft);
  document.title = `${product?.title || sol.title} · AIHW`;
  const archetype = label(reg.labels.archetypes, variant.archetype || sol.archetype || '');
  const page = mountPage(view, html`
    <div class="subbar"><a class="back-link" href="#/c/${cat.id}">${icon('back')}${cat.name}</a></div>
    <section class="sol-head page-head">
      <p class="eyebrow">${stack?.name || sol.stack} · ${sol.kind === 'reference' ? '参考方案' : '上游指针'}${archetype ? ` · ${archetype}` : ''}</p>
      <h1>${product?.title || sol.title}</h1>
      ${product ? html`<p class="small">${sol.title}</p>` : ''}
      <p>${product?.description || sol.summary}</p>
      <div class="chips">${[...experienceChips(reg, sol), verificationBadge(sol), referencePosition(sol)].map((c) => html`<span class="chip ${c.cls}">${c.label}</span>`)}</div>
      <p class="small">${referencePosition(sol).note} 本仓代码 MIT；模型服务、素材与第三方组件按各自许可 review。</p>
      <nav class="qnav" aria-label="四个问题">
        <a href="#effect" data-jump="effect"><b>效果</b>怎样</a><a href="#cost" data-jump="cost"><b>成本</b>一次多少钱</a>
        <a href="#hardware" data-jump="hardware"><b>硬件</b>要什么</a><a href="#compliance" data-jump="compliance"><b>合规</b>有哪些义务</a>
      </nav>
    </section>

    <section class="section" id="effect">
      <div class="section-title"><h2><span class="q">①</span>效果怎样</h2><small>${variant.mock_command || sol.run?.mock || ''}</small></div>
      ${sol.variants.length > 1 ? html`<div class="segment variant-switch" role="group" aria-label="玩法">${sol.variants.map((v) => html`<button type="button" data-variant="${v.id}" aria-pressed="${String(v.id === variant.id)}">${v.title}</button>`)}</div>` : ''}
      ${product ? html`<div class="material panel">
        <h3>${product.kind === 'image' ? '选择照片，再问一个问题' : '选择一段会议录音'}</h3>
        <div class="segment" role="group" aria-label="素材来源"><button type="button" data-source="sample" aria-pressed="${String(draft.source === 'sample')}">示例素材</button><button type="button" data-source="own" aria-pressed="${String(draft.source === 'own')}">我的${product.kind === 'image' ? '照片' : '录音'}</button></div>
        <div data-own-material ${draft.source === 'own' ? '' : 'hidden'}><label class="file-pick">选择${product.kind === 'image' ? 'JPEG / PNG / WebP 照片' : 'WAV / MP3 录音'}<input type="file" data-material accept="${product.kind === 'image' ? '.jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp' : '.wav,.mp3,audio/wav,audio/mpeg'}"></label></div>
        <div data-preview></div>
        ${product.kind === 'image' ? html`<label class="field" for="experience-question"><span>你想知道什么</span><textarea id="experience-question" data-question maxlength="2000" rows="3">${draft.question}</textarea><small>最多 2000 字符。示例原始提问使用随附语音；修改后使用照片和文字。</small></label>` : ''}
        <p class="small">${product.kind === 'image' ? '照片不超过 7 MiB' : '录音不超过 180 秒、7 MiB'} · 原始素材和临时语音不保存，文字结果保存在本机。</p>
        <button type="button" class="secondary-action block" data-reset>重置素材与提问</button>
        <div data-material-status aria-live="polite"></div>
      </div>` : ''}
      <div class="live-bar">${effectActions(reg, sol, variant, cred)}</div>
      <div data-outcome></div>
      <details class="process-panel" ${product ? '' : 'open'}><summary>查看技术过程与输出文件</summary><div class="stage-host"><div class="stage"><p class="small">加载回放</p></div></div></details>
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
  const outcome = page.querySelector('[data-outcome]');
  let replay = null, running = null, active = true, reading = null, previewURL = null, confirmation = null;
  let materialError = '', readVersion = 0;
  const secrets = (stack?.fields || []).filter(f=>f.input === 'secret').map(f=>cred?.values[f.key]).filter(Boolean);
  const connected = () => active && isCurrent() && page.isConnected;
  const clearResult = () => {
    outcome.replaceChildren(); page.querySelector('.live-cost')?.classList.add('hidden');
    replay?.stop(); host.replaceChildren();
    mount(outcome, html`<p class="info-note">素材或提问已更改，点击真跑获得当前输入的结果。示例回放不会代表你的素材。</p>`);
  };
  const preview = () => {
    if (!product) return;
    if (previewURL) URL.revokeObjectURL(previewURL);
    previewURL = draft.source === 'own' && draft.file ? URL.createObjectURL(draft.file) : null;
    const sample = (tr?.inputs || []).find(f=>(f.media_type||f.type||'').startsWith(product.kind+'/'));
    const src = previewURL || (draft.source === 'sample' && sample ? sampleUrl(reg,sol,sample.path) : null);
    mount(page.querySelector('[data-preview]'), src ? (product.kind === 'image'
      ? html`<figure class="input-preview"><img src="${src}" alt="${draft.source === 'sample' ? '示例照片' : '已选照片'}"><figcaption>${draft.source === 'sample' ? '示例照片' : draft.file.name}</figcaption></figure>`
      : html`<div class="input-preview"><audio controls preload="metadata" src="${src}"></audio><p class="small">${draft.source === 'sample' ? '示例会议录音' : `${draft.file.name} · ${draft.input ? draft.input.durationSeconds.toFixed(1) + ' 秒' : '待验证'}`}</p></div>`) : html`<p class="small">尚未选择素材</p>`);
    page.querySelector('[data-own-material]').hidden = draft.source !== 'own';
    for (const b of page.querySelectorAll('[data-source]')) b.setAttribute('aria-pressed',String(b.dataset.source === draft.source));
  };
  async function validateMaterial() {
    if (!product || draft.source !== 'own' || !draft.file || draft.input) return;
    reading?.abort();
    const controller = new AbortController(); reading = controller;
    const selectedDraft = draft, file = draft.file, version = ++readVersion;
    const currentRead = () => connected() && !controller.signal.aborted && version === readVersion && draft === selectedDraft && draft.file === file && draft.source === 'own';
    materialError = '正在核验素材，请稍候';
    mount(page.querySelector('[data-material-status]'), html`<p class="small">${materialError}</p>`);
    try {
      const input = await decodeFile(file, product.kind, draft.question, {signal:controller.signal});
      if (!currentRead()) return;
      draft.input = input; materialError = ''; preview();
      mount(page.querySelector('[data-material-status]'), html`<p class="inline-ok">素材核验通过</p>`);
    } catch (err) {
      if (!currentRead()) return;
      materialError = redact(err.message, secrets);
      mount(page.querySelector('[data-material-status]'), html`<p class="inline-error">${materialError}</p>`);
    }
  }
  preview();
  validateMaterial();
  function showSample() {
    if (!tr || (product && (draft.source !== 'sample' || (product.kind === 'image' && draft.question !== sampleQuestion)))) return false;
    replay?.stop();
    page.querySelector('.live-cost')?.classList.add('hidden');
    const stage = new Stage(host,{reg,sol,badges:[{label:'回放',cls:'accent'},{label:tr.mode === 'mock' ? 'mock 示意' : '真跑记录',cls:''}],mode:tr.mode});
    replay = playTrace(stage,tr);
    renderOutcome(outcome, tr);
    return true;
  }
  const refreshResult = () => {if (!showSample()) clearResult();};
  if (!showSample()) {
    if (product) clearResult();
    else mount(host,html`<p class="small">这个玩法还没有回放轨迹。</p>`);
  }

  function freeze(value) {
    for (const el of page.querySelectorAll('[data-source], [data-material], [data-question], [data-reset], [data-variant], [data-act="live"]')) el.disabled=value;
    page.querySelector('[data-act="stop"]')?.classList.toggle('hidden',!value);
    const button=page.querySelector('[data-act="live"]'); if(button) button.textContent=value?'正在体验…':'用我的 Key 真跑';
  }
  page.querySelector('[data-question]')?.addEventListener('input', e=>{if(running)return;draft.question=e.target.value;refreshResult();});
  page.querySelector('[data-material]')?.addEventListener('change', e=>{
    if(running)return;
    const file=e.target.files?.[0]; if(!file)return;
    draft.file=file;draft.input=null;clearResult();preview();validateMaterial();
  });
  page.addEventListener('click', e=>{
    const copy=e.target.closest('[data-copy]');if(copy)copyText(copy.dataset.copy);
    const jump=e.target.closest('[data-jump]');if(jump){e.preventDefault();page.querySelector(`#${jump.dataset.jump}`)?.scrollIntoView({behavior:'smooth',block:'start'});}
    const source=e.target.closest('[data-source]');
    if(source && !running && source.dataset.source!==draft.source){reading?.abort();readVersion++;draft.source=source.dataset.source;materialError='';refreshResult();preview();mount(page.querySelector('[data-material-status]'),'');validateMaterial();}
    if(e.target.closest('[data-reset]') && !running){reading?.abort();readVersion++;draft=resetDraft(draftKey,initialDraft);materialError='';const q=page.querySelector('[data-question]');if(q)q.value=draft.question;page.querySelector('[data-material]').value='';refreshResult();preview();mount(page.querySelector('[data-material-status]'),'');}
    const v=e.target.closest('[data-variant]');if(v && !running && v.dataset.variant!==variant.id)location.hash=`#/s/${encodeURIComponent(sol.id)}/${encodeURIComponent(v.dataset.variant)}`;
    const act=e.target.closest('[data-act]')?.dataset.act;
    if(act==='live' && !running){const ctrl=new AbortController();running=ctrl;freeze(true);startLive(ctrl).finally(()=>{if(connected()){running=null;freeze(false);}});}
    if(act==='stop')running?.abort();
  });

  async function inputForRun(signal) {
    if(!product)return undefined;
    if(product.kind==='image' && (!draft.question.trim() || draft.question.length>2000))throw Error('提问不能为空，且不能超过 2000 字符');
    if(draft.source==='own'){
      if(materialError)throw Error(materialError);
      if(!draft.input)throw Error('请先选择并核验你的素材');
      return {...draft.input,...(product.kind==='image'?{question:draft.question}:{} )};
    }
    if(product.kind==='image' && draft.question!==sampleQuestion){
      const f=(tr?.inputs||[]).find(f=>f.media_type?.startsWith('image/'));
      if(!f)throw Error('示例照片不可用');
      const response=await fetch(sampleUrl(reg,sol,f.path),{signal});if(!response.ok)throw Error('读取示例照片失败');
      const file=new File([await response.blob()],f.path.split('/').pop(),{type:f.media_type});
      return decodeFile(file,'image',draft.question,{signal});
    }
    return undefined;
  }
  async function startLive(ctrl) {
    let stage=null, result=null, error=null;
    const startedAt=new Date().toISOString();
    try {
      if(!cred || validateCredentials(stack,cred.values).errors.length || requiredMissing(reg,sol,variant,cred.values).length){location.hash=setupRoute(sol,variant);return;}
      const input=await inputForRun(ctrl.signal);
      if(!connected() || ctrl.signal.aborted)return;
      const c=costInfo(sol),est=c?`约 ¥${fmtCny(range(c.low,c.high))} / 次（估算，实际用量可能更高）`:'费用以账单为准';
      confirmation=sheet(html`<h2>用你的 Key 真跑</h2><p>浏览器直接调用${stack.name}官方接入点，按你的账号计费。</p><p>${est}</p><p class="small">${hostsFor(stack,cred.values).join('、')} · ${regionLabel(stack,cred.values.DASHSCOPE_API_REGION)}。待真 Key 验证，结果由 AI 生成。</p><div class="btn-row"><button type="button" class="secondary-action" data-sheet="cancel">取消</button><button type="button" class="primary-action" data-sheet="go" data-autofocus>开始真跑</button></div>`,{label:'确认真跑'});
      const answer=await confirmation.done;confirmation=null;
      if(answer!=='go' || !connected() || ctrl.signal.aborted)return;
      replay?.stop();outcome.replaceChildren();page.querySelector('.process-panel').open=true;
      stage=new Stage(host,{reg,sol,controls:false,aiLabel:'内容由 AI 生成',mode:'live',badges:[{label:'真跑 · 你的 Key',cls:'ok'},{label:'待真 Key 验证',cls:'warn'}]});
      if(!input && tr)stage.setInputs(tr.inputs);
      const noop={update(){return this;}};
      const safeStage={push(ev){return connected()?stage.push({...ev,text:redact(ev.text,secrets),lines:(ev.lines||[]).map(l=>redact(l,secrets))}):noop;}};
      // Streaming updates are redacted before rendering as well as before history/export.
      safeStage.push=ev=>{if(!connected())return noop;const handle=stage.push({...ev,text:redact(ev.text,secrets),lines:(ev.lines||[]).map(l=>redact(l,secrets))});return {update(next){if(connected())handle.update({...next,...('text' in next?{text:redact(next.text,secrets)}:{}),...('detail' in next?{detail:redact(next.detail,secrets)}:{})});return this;}};};
      result=await runInBrowser(reg,sol,variant,cred,safeStage,{signal:ctrl.signal,input,onFallback:(from,to)=>safeStage.push({tag:'提示',kind:'notice',text:`接口跨域拦截，本次改走 ${to}`})});
    } catch(err){error=err;}
    if(!connected())return;
    if(!result && !error)return;
    if(error && stage)stage.push({tag:'提示',kind:'notice',text:error.name==='AbortError'?'已停止':`出错：${redact(error.message,secrets)}`,lines:error.hint?[redact(error.hint,secrets)]:[]});
    const inputs=product && draft.source==='own' ? (draft.file ? [{path:`samples/${draft.file.name}`,media_type:draft.input?.mime||draft.file.type,bytes:draft.file.size}] : []) : tr?.inputs||[];
    const record=browserTrace({sol,variant,result,error,events:stage?.events||[],inputs,startedAt,region:cred?.values.DASHSCOPE_API_REGION||'',secrets});
    const saved=saveHistory(record);
    const speechURL = sol.id === '02-ai-glasses.bailian' && !error ? result?.outputs?.find(f=>(f.media_type||f.type||'').startsWith('audio/') && f.url)?.url : null;
    renderOutcome(outcome,record,{settingsHref:setupRoute(sol,variant),secrets,speechURL,historyNote:saved.saved?'文字结果已保存到本机体验历史；原始素材和临时语音不保存。':saved.error});
    if(stage){stage.setOutputs((result?.outputs||error?.outputs||[]).map(f=>({...f,text:f.text==null?f.text:redact(f.text,secrets)})));stage.setFoot(resultLines(record));}
    const box=page.querySelector('.live-cost');if(result){mount(box,html`<p class="inline-ok">本次体验已完成，费用与延迟见上方结果。</p>`);box.classList.remove('hidden');}
    page.querySelector('.process-panel').open=!!error;
  }
  return {cleanup(){active=false;confirmation?.close();reading?.abort();running?.abort();replay?.stop();if(previewURL)URL.revokeObjectURL(previewURL);}};
}
