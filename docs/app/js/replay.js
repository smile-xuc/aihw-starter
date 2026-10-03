// 通用回放舞台（aihw/trace@0.1）：只按事件的 kind、续行和引用的文件类型渲染，不按方案写分支。
// 回放（mock 轨迹）、浏览器真跑、打开本机轨迹都用它。

import { assetUrl } from './data.js';
import { costText, metricLines } from './experience.js';
import { eventClass } from './meta.js';
import { fmtCny, fragment, html, icon, markdown, mount } from './ui.js';

const ARCHETYPE_CLASS = { 'realtime-voice': 'is-voice', vision: 'is-vision', recorder: 'is-recorder', tools: 'is-tools' };

function detailBlock(lines) {
  if (!lines.length) return '';
  const text = lines.join('\n');
  if (/^#\s/.test(lines[0])) return markdown(text);
  if (lines.every((l) => /^\[\d{2}:\d{2}\]/.test(l) || !l.trim())) {
    return html`<div class="transcript">${lines.filter((l) => l.trim()).map((l) => {
      const m = l.match(/^\[(\d{2}:\d{2})\]\s*(.*)$/);
      return html`<div><b>${m[1]}</b>${m[2]}</div>`;
    })}</div>`;
  }
  const art = /[\u2500-\u257f]/.test(text) || /^\s*[.|'`]/m.test(text);
  return html`<pre class="${art ? '' : 'wrap'}">${text}</pre>`;
}

export class Stage {
  constructor(container, { reg, sol, badges = [], controls = true, aiLabel = '', mode = 'mock' }) {
    this.reg = reg;
    this.sol = sol;
    this.aiLabel = aiLabel;
    this.mode = mode;
    this.events = [];
    this.files = new Map();
    this.el = fragment(html`<div class="stage ${ARCHETYPE_CLASS[sol?.archetype] || ''}">
      <div class="stage-top">
        <div class="chips">${badges.map((b) => html`<span class="chip ${b.cls || ''}"><i></i>${b.label}</span>`)}</div>
        ${controls ? html`<div class="stage-controls">
          <button type="button" data-act="replay" aria-label="从头重播">${icon('replay')}</button>
          <button type="button" data-act="all">全部显示</button>
        </div>` : ''}
      </div>
      <div class="media-strip" hidden></div>
      <ol class="timeline" aria-label="运行过程"></ol>
      <div class="outputs" hidden></div>
      <div class="stage-foot" hidden></div>
    </div>`);
    this.media = this.el.querySelector('.media-strip');
    this.list = this.el.querySelector('.timeline');
    this.outputs = this.el.querySelector('.outputs');
    this.foot = this.el.querySelector('.stage-foot');
    container.replaceChildren(this.el);
  }

  url(file) {
    return file.url || assetUrl(this.reg, file.asset);
  }

  setInputs(inputs) {
    inputs = inputs.map(f=>({...f,media_type:f.media_type || f.type || 'application/octet-stream'}));
    for (const f of inputs) this.files.set(f.path, { ...f, role: 'input' });
    const isImage = (f) => f.media_type.startsWith('image/');
    const shown = inputs.filter((f) => this.url(f) && /^(image|audio)\//.test(f.media_type))
      .sort((a, b) => Number(isImage(b)) - Number(isImage(a)));
    const images = shown.filter(isImage);
    this.media.hidden = !shown.length;
    this.media.classList.toggle('stacked', images.length === 1);
    mount(this.media, shown.map((f) => {
      const src = this.url(f);
      const name = f.path.split('/').pop();
      if (f.media_type.startsWith('image/')) {
        return html`<figure class="media-item ${images.length === 1 ? 'wide' : ''}"><img src="${src}" alt="样本图片 ${name}" loading="lazy" decoding="async"><figcaption class="cap">${name}</figcaption></figure>`;
      }
      return html`<div class="media-item audio"><audio controls preload="none" src="${src}"></audio><div class="cap">样本录音 · ${name}</div></div>`;
    }));
  }

  inlineAssets(ev) {
    return ev.assets.map((path) => {
      const f = this.files.get(path);
      const src = f && this.url(f);
      if (!src || !f.media_type.startsWith('audio/') || f.role === 'input') return '';
      const note = this.mode === 'mock' ? 'mock 占位提示音，不是真实语音' : '语音由 AI 合成';
      return html`<div class="inline-audio"><audio controls preload="none" src="${src}"></audio><small>${note}</small></div>`;
    });
  }

  eventHtml(ev) {
    const cls = eventClass(ev);
    const label = cls === 'persona' && this.aiLabel ? html`<small class="ai-label">${this.aiLabel}</small>` : '';
    return html`<li class="ev ${cls}"><span class="tag">${ev.tag || '·'}</span><div class="txt">${ev.text}${detailBlock(ev.lines)}${this.inlineAssets(ev)}${label}</div></li>`;
  }

  clear() {
    this.events = [];
    this.list.replaceChildren();
    this.outputs.hidden = true;
    this.outputs.replaceChildren();
    this.foot.hidden = true;
    this.foot.replaceChildren();
  }

  push(ev) {
    const event = { assets: [], lines: [], ...ev };
    let li = fragment(this.eventHtml(event));
    this.list.append(li);
    this.events.push(event);
    const stage = this;
    return {
      update(next) {
        if ('detail' in next) next = { ...next, lines: next.detail ? String(next.detail).split('\n') : [] };
        delete next.detail;
        Object.assign(event, next);
        const fresh = fragment(stage.eventHtml(event));
        fresh.style.animation = 'none';
        li.replaceWith(fresh);
        li = fresh;
        return this;
      },
    };
  }

  setOutputs(outputs) {
    outputs = outputs.map(f=>({...f,media_type:f.media_type || f.type || 'application/octet-stream'}));
    for (const f of outputs) this.files.set(f.path, { ...f, role: 'output' });
    const items = outputs.map((out) => {
      const src = this.url(out);
      if (out.media_type?.startsWith('audio/') && src) {
        const note = out.note || (this.mode === 'mock' ? 'mock 占位提示音，不是真实语音' : '语音由 AI 合成');
        return html`<details ${this.mode === 'mock' ? '' : 'open'}><summary>产出 <code>${out.path}</code></summary><div class="media-item audio wide"><audio controls preload="none" src="${src}"></audio><div class="cap">${note}</div></div></details>`;
      }
      if (out.text == null) return '';
      let body;
      if (out.media_type === 'text/markdown') body = markdown(out.text);
      else if (out.media_type === 'application/json') {
        let pretty = out.text;
        try { pretty = JSON.stringify(JSON.parse(out.text), null, 2); } catch { /* 原样显示 */ }
        body = html`<pre>${pretty}</pre>`;
      } else body = html`<pre>${out.text}</pre>`;
      return html`<details><summary>产出 <code>${out.path}</code></summary>${body}</details>`;
    }).filter((x) => x !== '');
    this.outputs.hidden = !items.length;
    mount(this.outputs, items);
  }

  setFoot(lines) {
    this.foot.hidden = !lines.length;
    mount(this.foot, lines.map((l) => html`<p>${l}</p>`));
  }
}

export function resultLines(trace) {
  const r = trace.result;
  const lines = [];
  if (trace.error) lines.push(`运行失败：${trace.error}`);
  if (r) {
    lines.push(`${trace.mode === 'mock' ? '示例估算' : costText(r)} · 输入 ${r.sample || '—'}`);
    lines.push(...metricLines(r));
    if (r.note) lines.push(`备注：${r.note}`);
  }
  if (trace.mode === 'mock') lines.push('这是 mock 回放：按官方事件结构离线回放，没有调用模型，用量是示意值。');
  return lines;
}

const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// 契约建议的节奏：device / cloud 0.5 秒，result 按字数，stats 0.3 秒
function pause(ev) {
  const base = { device: 500, cloud: 500, stats: 300, notice: 300 }[ev.kind] ?? Math.min(1800, 300 + ev.text.length * 22);
  return base + (ev.lines.length ? 350 : 0);
}

// 逐行播放一条轨迹；返回控制器，页面离开时调用 stop()
export function playTrace(stage, trace, { autoplay = true } = {}) {
  let timer = null;
  let index = 0;
  const finish = () => {
    stage.setOutputs(trace.outputs);
    stage.setFoot(resultLines(trace));
    timer = null;
  };
  const step = () => {
    if (index >= trace.events.length) return finish();
    const ev = trace.events[index++];
    stage.push(ev);
    timer = setTimeout(step, pause(ev));
    return undefined;
  };
  const start = (instant) => {
    clearTimeout(timer);
    stage.clear();
    index = 0;
    if (instant) {
      while (index < trace.events.length) stage.push(trace.events[index++]);
      finish();
    } else step();
  };
  stage.setInputs(trace.inputs);
  stage.el.addEventListener('click', (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'replay') start(reduceMotion());
    if (act === 'all') start(true);
  });
  start(!autoplay || reduceMotion());
  return { stop: () => clearTimeout(timer) };
}
