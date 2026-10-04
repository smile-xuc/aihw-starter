import { normalizeTrace, sampleUrl } from '../data.js';
import { hostsFor, testConnection } from '../live/client.js';
import { browserSupport, requiredMissing } from '../live/index.js';
import { CONNECTION_TEST } from '../meta.js';
import { playTrace, Stage } from '../replay.js';
import { clearCredentials, fieldValues, loadCredentials, loadTheme, maskSecret, saveCredentials, saveTheme, validateCredentials } from '../settings.js';
import { copyText, fmtCny, html, icon, mount, mountPage, toast } from '../ui.js';

import { PRODUCTS, returnTarget, renderOutcome, redact } from '../experience.js';
import { readHistory, deleteHistory, clearHistory, statusLabel } from '../history.js';

// 百炼：在电脑上用长期 Key 换临时 Key（官方「生成临时 API Key」）
const TEMP_KEY_CMD = {
  'cn-beijing': 'curl -X POST "https://dashscope.aliyuncs.com/api/v1/tokens?expire_in_seconds=1800" -H "Authorization: Bearer $DASHSCOPE_API_KEY"',
  'ap-southeast-1': 'curl -X POST "https://<业务空间ID>.ap-southeast-1.maas.aliyuncs.com/api/v1/tokens?expire_in_seconds=1800" -H "Authorization: Bearer $DASHSCOPE_API_KEY"',
};

function fieldHtml(f, value) {
  const id = `f-${f.key}`;
  const help = html`<small class="field-help">${f.help || ''}${f.link ? html` · <a href="${f.link.url}" rel="noopener">${f.link.title}</a>` : ''}</small>`;
  if (f.input === 'select') {
    return html`<div class="field"><span>${f.label}${f.required ? '' : html`<small>可选</small>`}</span>
      <div class="segment" role="group" aria-label="${f.label}">${(f.options || []).map((o) => html`<button type="button" data-select="${f.key}" data-value="${o.value}" aria-pressed="${String(o.value === value)}">${o.label}</button>`)}</div>${help}</div>`;
  }
  const secret = f.input === 'secret';
  return html`<label class="field" for="${id}"><span>${f.label}${f.required ? '' : html`<small>可选</small>`}</span>
    <span class="input-wrap"><input id="${id}" name="${f.key}" type="${secret ? 'password' : f.input === 'url' ? 'url' : 'text'}" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="${f.placeholder || ''}" value="${value || ''}">
      ${secret ? html`<button type="button" data-act="reveal" data-for="${id}" aria-label="显示或隐藏 ${f.label}">显示</button>` : ''}</span>${help}</label>`;
}

function stateHtml(stack, saved) {
  if (!saved) return html`<div class="key-state"><span>还没有填，所有方案只放回放</span><span class="chip accent">回放模式</span></div>`;
  const values = fieldValues(stack, saved.values);
  const parts = (stack.fields || []).filter((f) => values[f.key]).map((f) => (f.input === 'secret' ? maskSecret(values[f.key])
    : f.options?.find((o) => o.value === values[f.key])?.label || values[f.key]));
  return html`<div class="key-state"><span><code>${parts.join(' · ')}</code></span><span class="chip ok">${saved.remember ? '记在这台设备' : '只在本次打开期间'}</span></div>`;
}

function hostsHtml(stack, values) {
  const list = hostsFor(stack, values);
  const shown = list.length ? list : (stack.endpoints?.roots || []).map((r) => new URL(r.http.replace(/\{(\w+)\}/g, '<$1>')).host);
  return html`<ul class="host-list">${shown.map((h) => html`<li>${h}</li>`)}</ul>`;
}

function stackPanel(stack, target) {
  const saved = loadCredentials(stack.id);
  const values = fieldValues(stack, saved?.values || {});
  const groups = [['credential', '凭证'], ['endpoint', '接入点']];
  const region = values.DASHSCOPE_API_REGION;
  return html`<section class="section" data-stack="${stack.id}" aria-label="${stack.name}">
    <div class="section-title"><h2>${stack.name}</h2><small>用于浏览器真跑</small></div>
    <div class="panel">
      <div data-slot="state">${stateHtml(stack, saved)}</div>
      <form data-form="${stack.id}" autocomplete="off" novalidate>
        ${groups.map(([g, title]) => {
          const fields = (stack.fields || []).filter((f) => f.group === g);
          return fields.length ? html`<p class="field-group">${title}</p>${fields.map((f) => fieldHtml(f, values[f.key]))}` : '';
        })}
        <label class="check-row"><input type="checkbox" name="remember" ${saved && !saved.remember ? '' : 'checked'}>
          <span>记在这台设备上<small>关掉后只保存在本次打开期间，关闭页面就清掉</small></span></label>
        <div class="btn-row">
          <button type="submit" class="primary-action">${target?.sol.stack === stack.id ? '保存并继续体验' : '保存'}</button>
          ${CONNECTION_TEST[stack.id] ? html`<button type="button" class="secondary-action" data-act="test">测试连接</button>` : ''}
        </div>
        <button type="button" class="secondary-action block danger-action" data-act="clear">清除这台设备上的 ${stack.name} 凭证</button>
        <div data-slot="result" aria-live="polite"></div>
      </form>
      <p class="info-note">${icon('shield')}<span>这些信息只存在这台设备的浏览器存储里（键名 <code>aihw.credentials.${stack.id}</code>，字段名与 .env 相同），不经过任何我们自己的服务器。真跑时凭证只放进请求头，只发往${stack.name}的官方接入点：</span></p>
      <div data-slot="hosts">${hostsHtml(stack, values)}</div>
      <p class="info-note">${icon('info')}<span>页面的内容安全策略（CSP）只允许连接这些官方域名，写错地址也会被浏览器拦下；页面不加载任何第三方脚本。smile-xuc.github.io 下的其他 Pages 页面与本页同源，浏览器存储彼此可见；介意的话关掉「记在这台设备上」，或用临时 Key。</span></p>
    </div>
    <div class="panel">
      <h3>把风险控制住</h3>
      <ul class="small advice">${(stack.security_advice || []).map((a) => html`<li>${a}</li>`)}</ul>
      ${stack.id === 'bailian' ? html`<p class="small">也可以在电脑上用长期 Key 换一个临时 Key（st- 开头，最长 30 分钟，到期自动失效、不能提前作废）填到上面：</p>
        <div class="cmd"><code>${TEMP_KEY_CMD[region] || TEMP_KEY_CMD['cn-beijing']}</code><button type="button" data-copy="${TEMP_KEY_CMD[region] || TEMP_KEY_CMD['cn-beijing']}" aria-label="复制命令">复制</button></div>
        <p class="small">临时 Key 能否在浏览器里调用兼容接口、能否用于业务空间专属域名，官方没写清，待真 Key 验证。</p>` : ''}
      ${(stack.docs || []).length ? html`<p class="small">官方文档：${stack.docs.map((d, i) => html`${i ? ' · ' : ''}<a href="${d.url}" rel="noopener">${d.title}</a>`)}</p>` : ''}
    </div>
  </section>`;
}

function capabilities(reg) {
  const rows = reg.solutions.flatMap((s) => s.variants.map((v) => ({ s, v, sup: browserSupport(reg, s, v) })));
  const text = { runnable: '网页真跑', unavailable: '暂未开放', blocked: '只能回放', none: '只能回放' };
  return html`<section class="section">
    <div class="section-title"><h2>哪些玩法能在浏览器里真跑</h2><small>均待真 Key 验证</small></div>
    <div class="panel">
      ${rows.map(({ s, v, sup }) => html`<a class="cap-row" href="#/s/${s.id}${s.variants.length > 1 ? `/${v.id}` : ''}"><span class="chip ${sup.status === 'runnable' ? 'cloud' : ''}">${s.category.slice(0, 2)}</span>
        <span>${s.title.split('·')[0].trim()}${s.variants.length > 1 ? ` · ${v.title}` : ''}</span><b>${text[sup.status]}</b></a>`)}
      <p class="info-note">${icon('info')}<span>实时语音（03 玩具、05 桌宠、06 耳机、02 的「给 AI 打电话」）只放回放：Realtime API 只在建连时认 Authorization 请求头，浏览器的 WebSocket 设不了请求头，WebRTC 建连被跨域拦截，AOQ 只有原生 SDK。请在电脑上跑。</span></p>
    </div>
  </section>`;
}

export function renderMe(view, reg) {
  document.title = '我的 · AIHW';
  const theme = loadTheme();
  let active = true, localReplay = null;
  const parameters = new URLSearchParams(location.hash.split('?')[1] || '');
  const requestedReturn = parameters.get('return');
  const target = returnTarget(reg, requestedReturn);
  const stacks = reg ? [...reg.stacks.values()] : [];
  const secrets=stacks.flatMap(stack=>(stack.fields||[]).filter(f=>f.input==='secret').map(f=>loadCredentials(stack.id)?.values[f.key])).filter(Boolean);
  const page = mountPage(view, html`
    <header class="app-top"><span class="wordmark"><span class="brandmark" aria-hidden="true"><i></i><i></i><i></i><i></i></span>我的</span></header>
    ${target ? html`<div class="mode-banner"><div><strong>继续体验：${PRODUCTS[target.sol.id]?.title || target.sol.title} · ${target.variant.title}</strong><p>请补全当前玩法所需凭证。保存后返回素材页面，再由你点击开始，不会自动调用模型。</p><a href="${target.hash}" data-return-experience>暂不配置，返回体验</a></div></div>` : requestedReturn ? html`<p class="inline-error">返回地址无效，请从方案页面重新进入设置。</p>` : ''}
    <section class="section history-panel"><div class="section-title"><h2>体验历史</h2><button type="button" class="secondary-action" data-history-clear>清空历史</button></div><p class="small">文字结果只保存在这台设备。最多 20 条、共 2 MiB；原始照片、录音和临时播报不保存。</p><div class="panel" data-history-list></div><div data-history-result></div></section>
    ${stacks.length ? stacks.map(s=>stackPanel(s,target)) : html`<div class="inline-error">方案数据没有加载出来，填写表单要用注册表里的栈声明。已保存的凭证仍在本机，可以先清除：</div>
      <button type="button" class="secondary-action block danger-action" data-act="clear-all">清除这台设备上保存的全部凭证</button>`}
    ${reg ? capabilities(reg) : ''}

    <section class="section">
      <div class="section-title"><h2>打开本机运行记录</h2></div>
      <div class="panel">
        <p>在电脑上 <code>python3 run.py --trace 文件名</code> 得到的轨迹，或者从方案页导出的浏览器真跑记录（aihw/trace@0.1），可以在同一个界面打开。只在本机读取，不上传。</p>
        <label class="file-pick">${icon('file')}选择 JSON 文件<input type="file" accept="application/json,.json" data-act="open-trace"></label>
        <div data-slot="local-trace"></div>
      </div>
    </section>

    <section class="section">
      <div class="section-title"><h2>离线与外观</h2></div>
      <div class="panel">
        <button type="button" class="secondary-action block" data-act="cache" ${reg ? '' : 'disabled'}>缓存全部回放与素材，离线也能看</button>
        <div data-slot="cache" class="small" role="status" aria-live="polite"></div>
        <div class="field"><span>外观</span>
          <div class="segment" role="group" aria-label="外观">
            ${[['system', '跟随系统'], ['light', '浅色'], ['dark', '深色']].map(([id, text]) => html`<button type="button" data-theme="${id}" aria-pressed="${String(id === theme)}">${text}</button>`)}
          </div></div>
      </div>
    </section>

    <section class="section">
      <div class="section-title"><h2>关于</h2></div>
      <div class="link-list">
        <a href="https://github.com/smile-xuc/aihw-starter" rel="noopener">仓库 smile-xuc/aihw-starter${icon('link')}</a>
        <a href="https://github.com/smile-xuc/aihw-starter/tree/master/docs/app" rel="noopener">这个网页 APP 的源码与说明${icon('link')}</a>
        <a href="../designs/aihw-square/app-v2.html?screen=home">APP 设计原型（存档）${icon('chevron')}</a>
      </div>
      <p class="footnote">${reg ? `数据：方案注册表 · demo 标准 v${reg.standard}` : '方案数据未加载'}</p>
    </section>`);

  const stackCleanups = stacks.map(stack=>bindStack(page, stack, reg, target, ()=>active));
  const showHistory = id => {
    const record = readHistory().records.find(r=>r.id===id);if(!record)return;
    renderOutcome(page.querySelector('[data-history-result]'),record.trace,{secrets,label:PRODUCTS[record.trace.solution]?.title || record.trace.title,historyNote:`${new Date(record.trace.ran_at).toLocaleString('zh-CN')} · ${statusLabel(record.trace)} · 原始素材和临时语音未保存。`});
  };
  const refreshHistory = () => {
    const {records,error}=readHistory();
    mount(page.querySelector('[data-history-list]'),html`${error ? html`<p class="inline-error">${error}</p>` : ''}${records.length ? records.map(r=>html`<div class="history-row"><h3>${PRODUCTS[r.trace.solution]?.title || r.trace.title}</h3><p class="small">${new Date(r.trace.ran_at).toLocaleString('zh-CN')} · ${statusLabel(r.trace)} · ${r.trace.variant}</p><div class="btn-row"><button type="button" class="secondary-action" data-history-open="${r.id}">打开结果</button><button type="button" class="secondary-action" data-history-delete="${r.id}">删除</button></div></div>`) : html`<p class="small">还没有体验记录。真跑后的结果、失败和停止记录会出现在这里。</p>`}`);
  };
  refreshHistory();
  if(parameters.get('history')) showHistory(parameters.get('history'));
  page.addEventListener('click', e=>{
    const open=e.target.closest('[data-history-open]');if(open)showHistory(open.dataset.historyOpen);
    const del=e.target.closest('[data-history-delete]');if(del){const res=deleteHistory(del.dataset.historyDelete);toast(res.error||'记录已删除');page.querySelector('[data-history-result]').replaceChildren();refreshHistory();}
    if(e.target.closest('[data-history-clear]')){const res=clearHistory();toast(res.error||'历史已清空');page.querySelector('[data-history-result]').replaceChildren();refreshHistory();}
  });

  page.addEventListener('click', (e) => {
    const copy = e.target.closest('[data-copy]');
    if (copy) copyText(copy.dataset.copy);
    const t = e.target.closest('[data-theme]');
    if (t) {
      saveTheme(t.dataset.theme);
      for (const b of page.querySelectorAll('[data-theme]')) b.setAttribute('aria-pressed', String(b === t));
    }
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'cache') cacheAll(page, reg);
    if (act === 'clear-all') {
      for (const k of Object.keys(localStorage)) if (k.startsWith('aihw.credentials.')) localStorage.removeItem(k);
      for (const k of Object.keys(sessionStorage)) if (k.startsWith('aihw.credentials.')) sessionStorage.removeItem(k);
      toast('已清除这台设备上保存的全部凭证');
    }
  });

  page.querySelector('[data-act="open-trace"]').addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    const slot = page.querySelector('[data-slot="local-trace"]');
    if (!file) return;
    try {
      const tr = normalizeTrace(JSON.parse(await file.text()));
      if (!active) return;
      localReplay?.stop();
      const sol = reg?.byId.get(tr.solution) || { id: tr.solution || 'local', archetype: null };
      mount(slot, html`<p class="small">${file.name} · ${tr.solution || '未知方案'}${tr.variant ? ` · ${tr.variant}` : ''} · ${tr.mode === 'mock' ? 'mock' : '真跑'}</p><div data-slot="outcome"></div><details class="process-panel"><summary>技术过程</summary><div data-slot="stage"></div></details>`);
      const stage = new Stage(slot.querySelector('[data-slot="stage"]'), {
        reg, sol, mode: tr.mode, aiLabel: tr.mode === 'live' ? '内容由 AI 生成' : '',
        badges: [{ label: '本机记录', cls: 'ok' }, { label: tr.mode === 'mock' ? 'mock' : '真跑', cls: '' }],
      });
      renderOutcome(slot.querySelector('[data-slot="outcome"]'), tr,{secrets});
      localReplay = playTrace(stage, { ...tr, inputs: tr.inputs.map((f) => ({ ...f, asset: null })), outputs: tr.outputs.map((f) => ({ ...f, asset: null })) }, { autoplay: false });
    } catch (err) {
      if (active) mount(slot, html`<p class="inline-error">打不开这个文件：${err.message}</p>`);
    }
  });
  return { cleanup(){active=false;localReplay?.stop();stackCleanups.forEach(fn=>fn?.());} };
}

function bindStack(page, stack, reg, target, isActive) {
  const root = page.querySelector(`[data-stack="${stack.id}"]`);
  const form = root.querySelector('form');
  const result = root.querySelector('[data-slot="result"]');
  const selected = {};
  for (const f of stack.fields || []) if (f.input === 'select') selected[f.key] = root.querySelector(`[data-select="${f.key}"][aria-pressed="true"]`)?.dataset.value || f.default || '';
  const current = () => {
    const raw = { ...selected };
    for (const f of stack.fields || []) if (f.input !== 'select') raw[f.key] = form.elements[f.key]?.value || '';
    return validateCredentials(stack, raw);
  };
  const refresh = () => {
    const saved = loadCredentials(stack.id);
    mount(root.querySelector('[data-slot="state"]'), stateHtml(stack, saved));
    mount(root.querySelector('[data-slot="hosts"]'), hostsHtml(stack, fieldValues(stack, saved?.values || {})));
  };
  const show = (errors, warnings, ok) => {if (!isActive()) return; return mount(result, html`
    ${errors.map((e) => html`<p class="inline-error">${e}</p>`)}
    ${warnings.map((w) => html`<p class="info-note">${icon('alert')}<span>${w}</span></p>`)}
    ${ok ? html`<p class="inline-ok">${ok}</p>` : ''}`);};

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const { errors, warnings, values } = current();
    if (target?.sol.stack === stack.id) errors.push(...requiredMissing(reg,target.sol,target.variant,values).map(label=>`继续这个玩法还需要：${label}`));
    if (errors.length) return show(errors, warnings);
    try {
      saveCredentials(stack.id, values, form.remember.checked);
    } catch (err) {
      return show([err.message], []);
    }
    show([], warnings, form.remember.checked ? '已保存在这台设备上' : '已保存，关闭页面后清掉');
    refresh();
    if (target?.sol.stack === stack.id) location.hash = target.hash;
    return undefined;
  });

  let testing = null;
  root.addEventListener('click', async (e) => {
    const sel = e.target.closest('[data-select]');
    if (sel) {
      selected[sel.dataset.select] = sel.dataset.value;
      for (const b of root.querySelectorAll(`[data-select="${sel.dataset.select}"]`)) b.setAttribute('aria-pressed', String(b === sel));
    }
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'reveal') {
      const btn = e.target.closest('button');
      const input = root.querySelector(`#${btn.dataset.for}`);
      const shown = input.type === 'text';
      input.type = shown ? 'password' : 'text';
      btn.textContent = shown ? '显示' : '隐藏';
    }
    if (act === 'clear') {
      clearCredentials(stack.id);
      for (const f of stack.fields || []) if (f.input !== 'select' && form.elements[f.key]) form.elements[f.key].value = '';
      show([], [], `已清除，这台设备上不再保存${stack.name}凭证`);
      refresh();
    }
    if (act === 'test' && !testing) {
      const { errors, warnings, values } = current();
      if (errors.length) return show(errors, warnings);
      const test = CONNECTION_TEST[stack.id];
      mount(result, html`<p class="small">正在调用 ${test.model} 测试……</p>`);
      testing = new AbortController();
      try {
        const res = await testConnection({ stack, values }, test, testing.signal);
        if (!isActive()) return;
        const [pin, pout] = test.price[values.DASHSCOPE_API_REGION] || test.price['cn-beijing'];
        const cost = (res.usage.prompt * pin + res.usage.completion * pout) / 1e6;
        if (res.usage.known === false) {show([],warnings,`连接正常 · ${res.ms} ms · 费用未知（接口未返回完整用量）`); return;}
        show([], warnings, `连接正常 · ${res.ms} ms · 回复「${redact(res.text.trim(), Object.values(values)).slice(0, 20)}」· 用量 ${res.usage.prompt} / ${res.usage.completion} Token（约 ¥${fmtCny(cost)}）`);
      } catch (err) {
        show([`测试失败：${redact(err.message, Object.values(values))}`, ...(err.hint ? [redact(err.hint,Object.values(values))] : [])], warnings);
      } finally {
        testing = null;
      }
    }
    return undefined;
  });
  return ()=>testing?.abort();
}

async function cacheAll(page, reg) {
  const slot = page.querySelector('[data-slot="cache"]');
  const button = page.querySelector('[data-act="cache"]');
  if (!reg || button.disabled) return;
  button.disabled = true;
  slot.dataset.cacheState = 'loading';
  const root = new URL(reg.root);
  const queue = new Map(), downloaded = new Set(), failures = new Map();
  let done = 0, bytes = 0;
  const showProgress = () => {
    if (page.isConnected) mount(slot, html`<p>正在准备离线回放：已处理 ${done} / ${queue.size} 个资源。</p>`);
  };
  const add = (value, kind) => {
    if (!value) return;
    try {
      const url = new URL(value, root);
      const allowedPath = root.pathname + (kind === 'trace' ? 'traces/' : 'assets/');
      const decodedPath = decodeURIComponent(url.pathname);
      if (url.origin !== location.origin || !url.pathname.startsWith(allowedPath) || !decodedPath.startsWith(allowedPath) || decodedPath.includes('\\') || decodedPath.split('/').some(part=>part==='.'||part==='..') || url.search || url.hash || url.username || url.password) {
        throw Error('资源不在本站回放目录，已跳过');
      }
      if (!queue.has(url.href)) queue.set(url.href, {kind, label:url.pathname.slice(root.pathname.length)});
    } catch {
      // Never fetch or display an untrusted external/signed URL from a trace.
      failures.set(String(value), {label:kind === 'trace' ? '回放轨迹地址' : '素材地址',reason:'资源不在本站回放目录，已跳过'});
    }
  };
  try {
    for (const solution of reg.solutions) {
      for (const variant of solution.variants || []) add(variant.trace, 'trace');
      for (const sample of solution.samples || []) add(sampleUrl(reg, solution, sample.path), 'asset');
    }
    showProgress();
    // The queue grows as each published trace reveals its input/output assets.
    for (const [url, item] of queue) {
      try {
        const response = await fetch(url,{redirect:'error'});
        if (!response.ok) throw Error(`HTTP ${response.status}`);
        const buffer = await response.arrayBuffer();
        if (item.kind === 'trace') {
          const trace = normalizeTrace(JSON.parse(new TextDecoder().decode(buffer)));
          for (const file of [...trace.inputs, ...trace.outputs]) add(file.url || file.asset, 'asset');
        }
        bytes += buffer.byteLength;
        downloaded.add(url);
      } catch (error) {
        failures.set(url, {label:item.label,reason:/^HTTP \d+$/.test(error.message) ? error.message : '下载或解析失败，请联网重试'});
      }
      done++;
      showProgress();
    }

    const verified = new Set();
    let cacheNote = '';
    if (!navigator.serviceWorker?.controller || !('caches' in window)) {
      cacheNote = '当前未启用离线缓存；资源下载不代表断网后可用。请使用支持 Service Worker 的浏览器，联网刷新后重试。';
    } else {
      // Only inspect this app's cache. Another app's matching response is not proof.
      const names = (await caches.keys()).filter(name=>name.startsWith('aihw-app-'));
      if (names.length !== 1) {
        cacheNote = '离线缓存尚未就绪或正在更新，请联网刷新后重试。';
      } else {
        const cache = await caches.open(names[0]);
        for (const url of downloaded) {
          const stored = await cache.match(url);
          if (stored?.ok) verified.add(url);
        }
      }
    }
    for (const url of downloaded) {
      if (!verified.has(url)) failures.set(url,{label:queue.get(url).label,reason:'尚未确认写入离线缓存'});
    }
    const complete = queue.size > 0 && failures.size === 0 && verified.size === queue.size;
    const state = complete ? 'complete' : verified.size ? 'partial' : 'failed';
    slot.dataset.cacheState = state;
    if (page.isConnected) {
      mount(slot, html`<p>${complete ? '全部回放与素材已缓存' : '离线缓存未全部完成'}：${verified.size} / ${queue.size} 个资源可离线使用（下载 ${Math.round(bytes / 1024)} KB）。</p>
        ${cacheNote ? html`<p>${cacheNote}</p>` : ''}
        ${failures.size ? html`<p>有 ${failures.size} 项未就绪，可以重新点击缓存按钮重试。</p><details><summary>查看未完成的资源</summary><ul>${[...failures.values()].map(failure=>html`<li>${failure.label}：${failure.reason}</li>`)}</ul></details>` : ''}`);
      toast(complete ? '全部回放与素材已缓存，离线也能看' : '离线缓存未全部完成，请查看未完成的资源');
    }
  } catch {
    slot.dataset.cacheState = 'failed';
    if (page.isConnected) {
      mount(slot,html`<p class="inline-error">无法确认离线缓存，请检查浏览器存储权限并重试；已下载不代表已缓存。</p>`);
      toast('离线缓存未完成');
    }
  } finally {
    button.disabled = false;
  }
}
