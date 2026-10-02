import { normalizeTrace, trace as loadTrace, demoAsset } from '../data.js';
import { hosts, REGIONS, testConnection } from '../live/bailian.js';
import { browserSupport } from '../live/index.js';
import { playTrace, Stage } from '../replay.js';
import { clearBailian, loadBailian, loadTheme, maskKey, saveBailian, saveTheme, validateBailian } from '../settings.js';
import { copyText, fmtCny, html, icon, mount, mountPage, toast } from '../ui.js';

const TOKEN_CMD = {
  'cn-beijing': 'curl -X POST "https://dashscope.aliyuncs.com/api/v1/tokens?expire_in_seconds=1800" -H "Authorization: Bearer $DASHSCOPE_API_KEY"',
  'ap-southeast-1': 'curl -X POST "https://<业务空间ID>.ap-southeast-1.maas.aliyuncs.com/api/v1/tokens?expire_in_seconds=1800" -H "Authorization: Bearer $DASHSCOPE_API_KEY"',
};

function keyState(key) {
  if (!key) return html`<div class="key-state"><span>还没有填，所有方案只放回放</span><span class="chip accent">回放模式</span></div>`;
  return html`<div class="key-state"><span><code>${maskKey(key.apiKey)}</code> · ${REGIONS[key.region].label}${key.workspaceId ? html` · <code>${key.workspaceId}</code>` : ''}</span>
    <span class="chip ok">${key.remember ? '记在这台设备' : '只在本次打开期间'}</span></div>`;
}

function hostList(key) {
  const region = key?.region || 'cn-beijing';
  const list = key ? hosts(key) : [new URL(REGIONS[region].http).host, `<业务空间ID>.${REGIONS[region].workspaceHost}`];
  return html`<ul class="host-list">${list.map((h) => html`<li>${h}</li>`)}</ul>`;
}

export function renderMe(view, reg) {
  document.title = '我的 · AIHW';
  const key = loadBailian();
  const theme = loadTheme();
  const region = key?.region || 'cn-beijing';
  const sols = reg?.solutions || [];
  const page = mountPage(view, html`
    <header class="app-top"><span class="wordmark"><span class="brandmark" aria-hidden="true"><i></i><i></i><i></i><i></i></span>我的</span></header>

    <section class="section" aria-labelledby="key-title">
      <div class="section-title"><h2 id="key-title">百炼 Key</h2><small>用于浏览器真跑</small></div>
      <div class="panel">
        <div data-slot="state">${keyState(key)}</div>
        <form data-form="key" autocomplete="off" novalidate>
          <label class="field"><span>API Key <small>sk- 长期 Key 或 st- 临时 Key</small></span>
            <span class="input-wrap"><input name="apiKey" type="password" inputmode="text" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="sk-…" value="${key?.apiKey || ''}">
              <button type="button" data-act="reveal" aria-label="显示或隐藏 Key">显示</button></span></label>
          <div class="field"><span>地域 <small>Key、地域、业务空间要属于同一地域</small></span>
            <div class="segment" role="group" aria-label="地域">
              ${Object.entries(REGIONS).map(([id, r]) => html`<button type="button" data-region="${id}" aria-pressed="${String(id === region)}">${r.label}</button>`)}
            </div></div>
          <label class="field"><span>业务空间 ID <small>可选；填了走业务空间专属域名</small></span>
            <span class="input-wrap"><input name="workspaceId" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="llm-xxxx" value="${key?.workspaceId || ''}"></span></label>
          <label class="check-row"><input type="checkbox" name="remember" ${key && !key.remember ? '' : 'checked'}>
            <span>记在这台设备上<small>关掉后只保存在本次打开期间，关闭页面就清掉</small></span></label>
          <div class="btn-row">
            <button type="submit" class="primary-action">保存</button>
            <button type="button" class="secondary-action" data-act="test">测试连接</button>
          </div>
          <button type="button" class="secondary-action block danger-action" data-act="clear">清除这台设备上的 Key</button>
          <div data-slot="result" aria-live="polite"></div>
        </form>
        <p class="info-note">${icon('shield')}<span>Key、地域和业务空间 ID 只存在这台设备的浏览器存储里（localStorage 或 sessionStorage 的 <code>aihw.bailian.v1</code>），不经过任何我们自己的服务器。真跑时浏览器把 Key 放在请求头里，只发往百炼官方接入点：</span></p>
        <div data-slot="hosts">${hostList(key)}</div>
        <p class="info-note">${icon('info')}<span>页面的内容安全策略（CSP）只允许连接上面这些百炼域名，写错地址也会被浏览器拦下；页面不加载任何第三方脚本。注意：smile-xuc.github.io 下的其他 Pages 页面与本页同源，浏览器存储彼此可见。介意的话关掉「记在这台设备上」，或用临时 Key。</span></p>
      </div>
    </section>

    <section class="section">
      <div class="section-title"><h2>把风险控制住</h2></div>
      <div class="panel">
        <p>浏览器不是保管长期 Key 的好地方。建议给这个页面单独准备一把「小 Key」：</p>
        <ul class="small">
          <li>在百炼控制台新建一个子业务空间，只授权 demo 用到的模型，并设 RPM / TPM 限流</li>
          <li>API Key 用自定义权限，只勾这些模型；可以加 IP 白名单</li>
          <li>在费用中心设消费预警（百炼不支持按金额给单个 Key 设上限）</li>
          <li>或者在电脑上用长期 Key 换一个临时 Key（st- 开头，最长 30 分钟，到期自动失效、不能提前作废），填到上面：</li>
        </ul>
        <div class="cmd"><code>${TOKEN_CMD[region]}</code><button type="button" data-copy="${TOKEN_CMD[region]}" aria-label="复制命令">复制</button></div>
        <p class="small">临时 Key 能否在浏览器里调用兼容接口、能否用于业务空间专属域名，官方没写清，待真 Key 验证。</p>
      </div>
    </section>

    <section class="section">
      <div class="section-title"><h2>哪些方案能在浏览器里真跑</h2><small>均待真 Key 验证</small></div>
      <div class="panel">
        ${sols.map((s) => {
          const sup = browserSupport(s);
          return html`<a class="cap-row" href="#/s/${s.id}"><span class="chip ${sup.status === 'runnable' ? 'cloud' : ''}">${s.category.slice(0, 2)}</span>
            <span>${s.title.split('·')[0].trim()}</span><b>${sup.status === 'runnable' ? '网页真跑' : '只能回放'}</b></a>`;
        })}
        <p class="info-note">${icon('info')}<span>03 玩具、05 桌宠、06 耳机（以及 02 的 --realtime）是实时语音：Realtime API 只在建连时认 Authorization 请求头，浏览器的 WebSocket 设不了请求头，WebRTC 建连被跨域拦截，AOQ 只有原生 SDK，所以只放回放，请在电脑上跑。</span></p>
      </div>
    </section>

    <section class="section">
      <div class="section-title"><h2>打开本机运行记录</h2></div>
      <div class="panel">
        <p>在电脑上跑出来的回放轨迹（JSON）或者从这里导出的真跑记录，可以在同一个界面打开，只在本机读取，不上传。</p>
        <label class="file-pick">${icon('file')}选择 JSON 文件<input type="file" accept="application/json,.json" data-act="open-trace"></label>
        <div data-slot="local-trace"></div>
      </div>
    </section>

    <section class="section">
      <div class="section-title"><h2>离线与外观</h2></div>
      <div class="panel">
        <button type="button" class="secondary-action block" data-act="cache">缓存全部回放素材，离线也能看</button>
        <div data-slot="cache" class="small"></div>
        <div class="field"><span>外观</span>
          <div class="segment" role="group" aria-label="外观">
            ${[['system', '跟随系统'], ['light', '浅色'], ['dark', '深色']].map(([id, label]) => html`<button type="button" data-theme="${id}" aria-pressed="${String(id === theme)}">${label}</button>`)}
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
      <p class="footnote">${reg?.build ? `数据构建于 ${reg.build.built_at}${reg.build.commit ? ` · ${reg.build.commit}` : ''} · ${reg.build.registry}` : '方案数据未加载'}</p>
    </section>`);

  const form = page.querySelector('[data-form="key"]');
  const result = page.querySelector('[data-slot="result"]');
  let chosenRegion = region;

  const current = () => validateBailian({
    apiKey: form.apiKey.value, region: chosenRegion, workspaceId: form.workspaceId.value,
  });
  const refresh = () => {
    const k = loadBailian();
    mount(page.querySelector('[data-slot="state"]'), keyState(k));
    mount(page.querySelector('[data-slot="hosts"]'), hostList(k));
  };
  const show = (errors, warnings, ok) => mount(result, html`
    ${errors.map((e) => html`<p class="inline-error">${e}</p>`)}
    ${warnings.map((w) => html`<p class="info-note">${icon('alert')}<span>${w}</span></p>`)}
    ${ok ? html`<p class="inline-ok">${ok}</p>` : ''}`);

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const { errors, warnings, value } = current();
    if (errors.length) return show(errors, warnings);
    try {
      saveBailian(value, form.remember.checked);
    } catch (err) {
      return show([err.message], []);
    }
    show([], warnings, form.remember.checked ? '已保存在这台设备上' : '已保存，关闭页面后清掉');
    refresh();
    return undefined;
  });

  let testing = null;
  page.addEventListener('click', async (e) => {
    const copy = e.target.closest('[data-copy]');
    if (copy) copyText(copy.dataset.copy);
    const r = e.target.closest('[data-region]');
    if (r) {
      chosenRegion = r.dataset.region;
      for (const b of page.querySelectorAll('[data-region]')) b.setAttribute('aria-pressed', String(b === r));
    }
    const t = e.target.closest('[data-theme]');
    if (t) {
      saveTheme(t.dataset.theme);
      for (const b of page.querySelectorAll('[data-theme]')) b.setAttribute('aria-pressed', String(b === t));
    }
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'reveal') {
      const shown = form.apiKey.type === 'text';
      form.apiKey.type = shown ? 'password' : 'text';
      e.target.closest('button').textContent = shown ? '显示' : '隐藏';
    }
    if (act === 'clear') {
      clearBailian();
      form.apiKey.value = '';
      form.workspaceId.value = '';
      show([], [], '已清除，这台设备上不再保存百炼 Key');
      refresh();
    }
    if (act === 'test' && !testing) {
      const { errors, warnings, value } = current();
      if (errors.length) return show(errors, warnings);
      show([], warnings, '');
      mount(result, html`<p class="small">正在调用 qwen3.7-flash 测试……</p>`);
      testing = new AbortController();
      try {
        const res = await testConnection(value, testing.signal);
        const [pin, pout] = value.region === 'cn-beijing' ? [0.2, 0.8] : [0.225, 0.974];
        const cost = (res.usage.prompt * pin + res.usage.completion * pout) / 1e6;
        show([], warnings, `连接正常 · ${res.ms} ms · 回复「${res.text.trim().slice(0, 20)}」· 用量 ${res.usage.prompt} / ${res.usage.completion} Token（约 ¥${fmtCny(cost)}）`);
      } catch (err) {
        show([`测试失败：${err.message}`, ...(err.hint ? [err.hint] : [])], warnings);
      } finally {
        testing = null;
      }
    }
    if (act === 'cache') cacheAll(page, reg);
    return undefined;
  });

  page.querySelector('[data-act="open-trace"]').addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    const slot = page.querySelector('[data-slot="local-trace"]');
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      const tr = normalizeTrace(data);
      const sol = reg?.byId.get(tr.solution) || { id: tr.solution || 'local', archetype: null };
      mount(slot, html`<p class="small">${file.name} · ${tr.solution || '未知方案'} · ${tr.mode}</p><div data-slot="stage"></div>`);
      const stage = new Stage(slot.querySelector('[data-slot="stage"]'), {
        sol, badges: [{ label: '本机记录', cls: 'ok' }, { label: tr.mode === 'mock' ? 'mock' : '真跑', cls: '' }],
      });
      playTrace(stage, { ...tr, inputs: [] }, { autoplay: false });
    } catch (err) {
      mount(slot, html`<p class="inline-error">打不开这个文件：${err.message}</p>`);
    }
  });

  return null;
}

async function cacheAll(page, reg) {
  const slot = page.querySelector('[data-slot="cache"]');
  if (!reg) return mount(slot, html`<p class="inline-error">方案数据未加载，无法缓存</p>`);
  const urls = new Set();
  for (const sol of reg.solutions) {
    const tr = await loadTrace(sol).catch(() => null);
    for (const item of tr?.inputs || []) urls.add(demoAsset(sol, item.path));
  }
  let done = 0;
  let bytes = 0;
  for (const url of urls) {
    try {
      const res = await fetch(url);
      bytes += (await res.clone().arrayBuffer()).byteLength;
    } catch { /* 单个失败不影响其他 */ }
    done += 1;
    mount(slot, html`<p>已缓存 ${done} / ${urls.size} 个素材（${Math.round(bytes / 1024)} KB）</p>`);
  }
  toast(navigator.serviceWorker?.controller ? '回放素材已缓存，离线也能看' : '已下载；离线缓存需要浏览器支持 Service Worker');
  return undefined;
}
