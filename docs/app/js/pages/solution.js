import { label, repoLink, trace as loadTrace, sampleUrl } from '../data.js';
import { hostsFor } from '../live/client.js';
import { browserSupport, requiredMissing, runInBrowser } from '../live/index.js';
import { costInfo, kindOf, range, verificationBadge } from '../meta.js';
import { playTrace, resultLines, Stage } from '../replay.js';
import { fieldValues, loadCredentials, validateCredentials } from '../settings.js';
import { copyText, download, fmtCny, fmtYuan, html, icon, mount, mountPage, sheet } from '../ui.js';
import { experienceChips } from './home.js';

import { PRODUCTS, draftFor, resetDraft, setupRoute, fileType, decodeFile, browserTrace, renderOutcome, redact } from '../experience.js';
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
    <div class="subbar"><a class="back-link" href="#/c/${cat.id}">${icon('back')}所属品类：${cat.name}</a></div>
    <section class="sol-head page-head">
      <p class="eyebrow">${stack?.name || sol.stack} · ${sol.kind === 'reference' ? '参考方案' : '上游指针'}${archetype ? ` · ${archetype}` : ''}</p>
      <h1>${product?.title || sol.title}</h1>
      ${product ? html`<p class="small">${sol.title}</p>` : ''}
      <p>${product?.description || sol.summary}</p>
      <div class="chips">${[...experienceChips(reg, sol), verificationBadge(sol), referencePosition(sol)].map((c) => html`<span class="chip ${c.cls}">${c.label}</span>`)}</div>
      <details class="reference-note"><summary>参考实现与许可说明</summary><p class="small">${referencePosition(sol).note} 本仓代码 MIT；模型服务、素材与第三方组件按各自许可核对。<a href="#/c/${cat.id}">查看品类商业方案与具体项目</a>。</p></details>
      <nav class="qnav" aria-label="四个问题">
        <a href="#effect" data-jump="effect"><b>效果</b>怎样</a><a href="#cost" data-jump="cost"><b>成本</b>一次多少钱</a>
        <a href="#hardware" data-jump="hardware"><b>硬件</b>要什么</a><a href="#compliance" data-jump="compliance"><b>合规</b>有哪些义务</a>
      </nav>
    </section>

    <section class="section" id="effect">
      <div class="section-title"><h2><span class="q">①</span>效果怎样</h2><small>${variant.mock_command || sol.run?.mock || ''}</small></div>
      ${sol.variants.length > 1 ? html`<div class="segment variant-switch" role="group" aria-label="玩法">${sol.variants.map((v) => html`<button type="button" data-variant="${v.id}" aria-pressed="${String(v.id === variant.id)}">${v.title}</button>`)}</div>` : ''}
      ${product ? html`<div class="material material-editor panel" data-material-editor data-validation-state="idle">
        <div class="material-heading"><h3>${product.kind === 'image' ? '选择照片，再问一个问题' : '选择一段会议录音'}</h3><p class="small">先用示例了解效果，或放入你自己的${product.kind === 'image' ? '照片' : '录音'}。</p></div>
        <div class="segment" role="group" aria-label="素材来源"><button type="button" data-source="sample" aria-pressed="${String(draft.source === 'sample')}">示例素材</button><button type="button" data-source="own" aria-pressed="${String(draft.source === 'own')}">我的${product.kind === 'image' ? '照片' : '录音'}</button></div>
        <div data-own-material ${draft.source === 'own' ? '' : 'hidden'}><label class="file-pick material-dropzone" data-dropzone data-dragging="false" data-disabled="false" aria-busy="false"><span class="material-drop-icon" aria-hidden="true">${icon('upload')}</span><span class="material-drop-copy">选择${product.kind === 'image' ? '照片' : '录音'}，或拖放到这里</span><span class="material-drop-hint" id="material-file-hint">${product.kind === 'image' ? 'JPEG / PNG / WebP · 不超过 7 MiB' : 'WAV / MP3 · 不超过 180 秒、7 MiB'}，一次一个文件</span><input type="file" data-material aria-describedby="material-file-hint material-status" accept="${product.kind === 'image' ? '.jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp' : '.wav,.mp3,audio/wav,audio/mpeg'}"></label></div>
        <div data-preview></div>
        ${product.kind === 'image' ? html`<label class="field" for="experience-question"><span class="question-heading"><span>你想知道什么</span><small class="question-count" data-question-count id="question-count">已输入 ${draft.question.length} / 2000 字符</small></span><textarea id="experience-question" data-question maxlength="2000" rows="3" aria-describedby="question-hint question-count">${draft.question}</textarea><small id="question-hint">示例原始提问使用随附语音；修改后使用照片和文字。</small></label>` : ''}
        <p class="small">${product.kind === 'image' ? '照片不超过 7 MiB' : '录音不超过 180 秒、7 MiB'} · 本机历史只保存文字结果，不保存原始素材和临时语音。</p>
        <button type="button" class="secondary-action block" data-reset>重置素材与提问</button>
        <div id="material-status" data-material-status role="status" aria-live="polite" aria-atomic="true"></div>
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
  const materialEditor = page.querySelector('[data-material-editor]');
  const dropzone = page.querySelector('[data-dropzone]');
  const materialInput = page.querySelector('[data-material]');
  const materialStatus = page.querySelector('[data-material-status]');
  let replay = null, running = null, active = true, reading = null, previewURL = null, confirmation = null;
  let materialError = '', readVersion = 0, dragDepth = 0;
  const secrets = (stack?.fields || []).filter(f=>f.input === 'secret').map(f=>cred?.values[f.key]).filter(Boolean);
  const connected = () => active && isCurrent() && page.isConnected;
  const materialFeedback = (state, message = '') => {
    if (!materialEditor) return;
    materialEditor.dataset.validationState = state;
    dropzone.setAttribute('aria-busy', String(state === 'validating'));
    materialInput.setAttribute('aria-invalid', String(state === 'invalid'));
    mount(materialStatus, message ? html`<p class="${state === 'invalid' ? 'inline-error' : state === 'valid' ? 'inline-ok' : 'small'}">${message}</p>` : '');
  };
  const resetDrag = () => {
    dragDepth = 0;
    if (dropzone) dropzone.dataset.dragging = 'false';
  };
  const updateQuestionCount = () => {
    const count = page.querySelector('[data-question-count]');
    if (count) count.textContent = `已输入 ${draft.question.length} / 2000 字符`;
  };
  const clearResult = () => {
    outcome.replaceChildren(); page.querySelector('.live-cost')?.classList.add('hidden');
    replay?.stop(); host.replaceChildren();
    const missingSample = !tr && draft.source === 'sample' && (product.kind !== 'image' || draft.question === sampleQuestion);
    mount(outcome, missingSample
      ? html`<p class="info-note">示例回放暂时无法加载。请联网刷新重试，或在<a href="#/me">「我的」缓存全部回放</a>后离线使用。</p>`
      : html`<p class="info-note">素材或提问已更改，点击真跑获得当前输入的结果。示例回放不会代表你的素材。</p>`);
  };
  const preview = () => {
    if (!product) return;
    if (previewURL) URL.revokeObjectURL(previewURL);
    previewURL = draft.source === 'own' && draft.file ? URL.createObjectURL(draft.file) : null;
    const sample = (tr?.inputs || []).find(f=>(f.media_type||f.type||'').startsWith(product.kind+'/'));
    const src = previewURL || (draft.source === 'sample' && sample ? sampleUrl(reg,sol,sample.path) : null);
    mount(page.querySelector('[data-preview]'), src ? (product.kind === 'image'
      ? html`<figure class="input-preview"><img src="${src}" alt="${draft.source === 'sample' ? '示例照片' : '已选照片'}"><figcaption>${draft.source === 'sample' ? '示例照片' : draft.file.name}</figcaption></figure>`
      : html`<div class="input-preview"><audio controls preload="metadata" src="${src}"></audio><p class="small">${draft.source === 'sample' ? '示例会议录音' : `${draft.file.name} · ${draft.input ? draft.input.durationSeconds.toFixed(1) + ' 秒' : '待验证'}`}</p></div>`) : html`<p class="small">${draft.source === 'sample' ? '示例素材暂未加载，请联网后重试。' : '尚未选择素材'}</p>`);
    page.querySelector('[data-own-material]').hidden = draft.source !== 'own';
    for (const b of page.querySelectorAll('[data-source]')) b.setAttribute('aria-pressed',String(b.dataset.source === draft.source));
  };
  async function validateMaterial() {
    if (!product || draft.source !== 'own' || !draft.file) return;
    if (draft.input) {materialFeedback('valid', '素材核验通过');return;}
    reading?.abort();
    const controller = new AbortController(); reading = controller;
    const selectedDraft = draft, file = draft.file, version = ++readVersion;
    const currentRead = () => connected() && !controller.signal.aborted && version === readVersion && draft === selectedDraft && draft.file === file && draft.source === 'own';
    materialError = '正在核验素材，请稍候';
    materialFeedback('validating', materialError);
    try {
      const input = await decodeFile(file, product.kind, draft.question, {signal:controller.signal});
      if (!currentRead()) return;
      draft.input = input; materialError = ''; preview();
      materialFeedback('valid', '素材核验通过');
    } catch (err) {
      if (!currentRead()) return;
      materialError = redact(err.message, secrets);
      materialFeedback('invalid', materialError);
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
    if (dropzone) dropzone.dataset.disabled = String(value);
    resetDrag();
  }
  page.querySelector('[data-question]')?.addEventListener('input', e=>{if(running)return;draft.question=e.target.value;updateQuestionCount();refreshResult();});
  const rejectSelection = message => {
    // A rejected drop does not replace or invalidate an already selected file.
    mount(materialStatus, html`<p class="inline-error">${message}当前素材未更换。</p>`);
  };
  const selectMaterial = files => {
    if (!connected() || running || draft.source !== 'own') return;
    if (files.length !== 1) {rejectSelection('请一次只添加 1 个文件。');return;}
    const file = files[0];
    if (!(file instanceof File)) {rejectSelection('请添加本机照片或录音文件。');return;}
    try {fileType(file, product.kind);}
    catch (error) {rejectSelection(`${redact(error.message, secrets)}。`);return;}
    draft.file=file;draft.input=null;clearResult();preview();validateMaterial();
  };
  materialInput?.addEventListener('change', e=>{
    const files = Array.from(e.target.files || []);
    if (files.length) selectMaterial(files);
    // Allow choosing the same file again after a failed decode; the draft owns it.
    e.target.value = '';
  });
  dropzone?.addEventListener('dragenter', e=>{
    e.preventDefault();
    if (running || draft.source !== 'own') return;
    dragDepth++;
    dropzone.dataset.dragging = 'true';
  });
  dropzone?.addEventListener('dragover', e=>{
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = running ? 'none' : 'copy';
  });
  dropzone?.addEventListener('dragleave', e=>{
    e.preventDefault();
    dragDepth = Math.max(0, dragDepth - 1);
    if (!dragDepth) resetDrag();
  });
  dropzone?.addEventListener('drop', e=>{
    e.preventDefault();
    resetDrag();
    if (running) {
      mount(materialStatus, html`<p class="small">正在体验，请先停止后再替换素材。</p>`);
      return;
    }
    const items = Array.from(e.dataTransfer?.items || []);
    if (items.some(item => item.kind !== 'file' || item.webkitGetAsEntry?.()?.isDirectory)) {
      rejectSelection('不支持文件夹、链接或文字，请拖入一个本机文件。');
      return;
    }
    const files = Array.from(e.dataTransfer?.files || []);
    if (!files.length) {rejectSelection('没有读到文件，请使用“选择照片”或“选择录音”。');return;}
    selectMaterial(files);
    materialInput.value = '';
  });
  page.addEventListener('click', e=>{
    const copy=e.target.closest('[data-copy]');if(copy)copyText(copy.dataset.copy);
    const jump=e.target.closest('[data-jump]');if(jump){e.preventDefault();page.querySelector(`#${jump.dataset.jump}`)?.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});}
    const source=e.target.closest('[data-source]');
    if(source && !running && source.dataset.source!==draft.source){reading?.abort();readVersion++;resetDrag();draft.source=source.dataset.source;materialError='';refreshResult();preview();materialFeedback('idle');validateMaterial();}
    if(e.target.closest('[data-reset]') && !running){reading?.abort();readVersion++;resetDrag();draft=resetDraft(draftKey,initialDraft);materialError='';const q=page.querySelector('[data-question]');if(q)q.value=draft.question;updateQuestionCount();materialInput.value='';refreshResult();preview();materialFeedback('idle');}
    const v=e.target.closest('[data-variant]');if(v && !running && v.dataset.variant!==variant.id)location.hash=`#/s/${encodeURIComponent(sol.id)}/${encodeURIComponent(v.dataset.variant)}`;
    const act=e.target.closest('[data-act]')?.dataset.act;
    if(act==='live' && !running){
      const opener=e.target.closest('[data-act="live"]');
      const ctrl=new AbortController();
      let restoreFocus=false;
      running=ctrl;freeze(true);
      startLive(ctrl).then(status=>{restoreFocus=status==='cancelled';}).finally(()=>{
        if(connected()){
          running=null;freeze(false);
          if(restoreFocus)opener?.focus({preventScroll:true});
        }
      });
    }
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
      confirmation=sheet(html`<h2>用你的 Key 真跑</h2><p>浏览器直接调用${stack.name}官方接入点，按你的账号计费。</p><p>${est}</p>${sol.id === '07-recorder.bailian' ? html`<p class="small">录音将上传到百炼临时存储（48 小时有效，官方不用于生产环境）。双声道分别识别、分别计费；停止只结束本机等待，云端任务可能继续运行并计费，重试会创建新任务。</p>` : ''}<p class="small">${hostsFor(stack,cred.values).join('、')} · ${regionLabel(stack,cred.values.DASHSCOPE_API_REGION)}。待真 Key 验证，结果由 AI 生成。</p><div class="btn-row"><button type="button" class="secondary-action" data-sheet="cancel">取消</button><button type="button" class="primary-action" data-sheet="go" data-autofocus>开始真跑</button></div>`,{label:'确认真跑'});
      const answer=await confirmation.done;confirmation=null;
      if(!connected() || ctrl.signal.aborted)return;
      if(answer!=='go')return 'cancelled';
      replay?.stop();outcome.replaceChildren();page.querySelector('.process-panel').open=true;
      stage=new Stage(host,{reg,sol,controls:false,aiLabel:'内容由 AI 生成',mode:'live',badges:[{label:'真跑 · 你的 Key',cls:'ok'},{label:'待真 Key 验证',cls:'warn'}]});
      if(!input && tr)stage.setInputs(tr.inputs);
      const noop={update(){return this;}};
      const safeStage={push(ev){return connected()?stage.push({...ev,text:redact(ev.text,secrets),lines:(ev.lines||[]).map(l=>redact(l,secrets))}):noop;}};
      // Streaming updates are redacted before rendering as well as before history/export.
      safeStage.push=ev=>{if(!connected())return noop;const handle=stage.push({...ev,text:redact(ev.text,secrets),lines:(ev.lines||[]).map(l=>redact(l,secrets))});return {update(next){if(connected())handle.update({...next,...('text' in next?{text:redact(next.text,secrets)}:{}),...('detail' in next?{detail:redact(next.detail,secrets)}:{})});return this;}};};
      result=await runInBrowser(reg,sol,variant,cred,safeStage,{signal:ctrl.signal,input,onFallback:(from,to)=>safeStage.push({tag:'提示',kind:'notice',text:`本次改用 ${to} 官方接入点`})});
    } catch(err){error=err;}
    if(!connected())return;
    if(!result && !error)return;
    if(error && stage)stage.push({tag:'提示',kind:'notice',text:error.name==='AbortError'?(sol.id==='07-recorder.bailian'?'已停止等待；已提交的云端任务可能继续运行并计费':'已停止'):`出错：${redact(error.message,secrets)}`,lines:error.hint?[redact(error.hint,secrets)]:[]});
    const inputs=product && draft.source==='own' ? (draft.file ? [{path:`samples/${draft.file.name}`,media_type:draft.input?.mime||draft.file.type,bytes:draft.file.size}] : []) : tr?.inputs||[];
    const record=browserTrace({sol,variant,result,error,events:stage?.events||[],inputs,startedAt,region:cred?.values.DASHSCOPE_API_REGION||'',secrets});
    const saved=saveHistory(record);
    const speechURL = sol.id === '02-ai-glasses.bailian' && !error ? result?.outputs?.find(f=>(f.media_type||f.type||'').startsWith('audio/') && f.url)?.url : null;
    renderOutcome(outcome,record,{settingsHref:setupRoute(sol,variant),secrets,speechURL,historyNote:saved.saved?'文字结果已保存到本机体验历史；本机历史不保存原始素材和临时语音。':saved.error});
    if(stage){stage.setOutputs((result?.outputs||error?.outputs||[]).map(f=>({...f,text:f.text==null?f.text:redact(f.text,secrets)})));stage.setFoot(resultLines(record));}
    const box=page.querySelector('.live-cost');if(result){mount(box,html`<p class="inline-ok">本次体验已完成，费用与延迟见上方结果。</p>`);box.classList.remove('hidden');}
    page.querySelector('.process-panel').open=!!error;
  }
  return {cleanup(){active=false;confirmation?.close();reading?.abort();running?.abort();replay?.stop();if(previewURL)URL.revokeObjectURL(previewURL);}};
}
