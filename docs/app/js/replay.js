// 通用回放舞台：只按日志行标签和输入输出的文件类型渲染，不按品类写分支。
// 回放（mock 轨迹）、浏览器真跑、打开本机轨迹都用它。

import { demoAsset } from './data.js';
import { eventKind } from './meta.js';
import { fragment, html, icon, markdown, mount } from './ui.js';

const ARCHETYPE_CLASS = { 'realtime-voice': 'is-voice', vision: 'is-vision', recording: 'is-recording', tools: 'is-tools' };

function detailBlock(d) {
  if (!d) return '';
  if (/^#\s/.test(d)) return markdown(d);
  const lines = d.split('\n');
  if (lines.every((l) => /^\[\d{2}:\d{2}\]/.test(l) || !l.trim())) {
    return html`<div class="transcript">${lines.filter((l) => l.trim()).map((l) => {
      const m = l.match(/^\[(\d{2}:\d{2})\]\s*(.*)$/);
      return html`<div><b>${m[1]}</b>${m[2]}</div>`;
    })}</div>`;
  }
  const art = /[\u2500-\u257f]/.test(d) || /^\s*[.|'`]/m.test(d);
  return html`<pre class="${art ? '' : 'wrap'}">${d}</pre>`;
}

function eventHtml(ev, aiLabel) {
  const kind = eventKind(ev);
  const label = kind.startsWith('persona') && aiLabel ? html`<small class="ai-label">${aiLabel}</small>` : '';
  return html`<li class="ev ${kind}"><span class="tag">${ev.tag}</span><div class="txt">${ev.text}${detailBlock(ev.detail)}${label}</div></li>`;
}

function mediaHtml(sol, item, single) {
  const src = item.url || demoAsset(sol, item.path);
  const name = item.path.split('/').pop();
  if (item.type.startsWith('image/')) {
    return html`<figure class="media-item ${single ? 'wide' : ''}"><img src="${src}" alt="样本图片 ${name}" loading="lazy" decoding="async"><figcaption class="cap">${name}</figcaption></figure>`;
  }
  if (item.type.startsWith('audio/')) {
    return html`<div class="media-item audio"><audio controls preload="none" src="${src}"></audio><div class="cap">样本录音 · ${name}</div></div>`;
  }
  if (item.text) {
    return html`<div class="media-item"><pre>${item.text}</pre><div class="cap">${name}</div></div>`;
  }
  return '';
}

function outputHtml(out) {
  const name = out.path;
  if (out.type.startsWith('audio/') && out.url) {
    return html`<details open><summary>产出 <code>${name}</code></summary><div class="media-item audio wide"><audio controls preload="none" src="${out.url}"></audio><div class="cap">${out.note || ''}</div></div></details>`;
  }
  let body;
  if (out.type === 'text/markdown') body = markdown(out.text);
  else if (out.type === 'application/json') {
    let pretty = out.text;
    try { pretty = JSON.stringify(JSON.parse(out.text), null, 2); } catch { /* 原样显示 */ }
    body = html`<pre>${pretty}</pre>`;
  } else body = html`<pre>${out.text}</pre>`;
  return html`<details><summary>产出 <code>${name}</code></summary>${body}</details>`;
}

export class Stage {
  constructor(container, { sol, badges = [], controls = true, aiLabel = '' }) {
    this.sol = sol;
    this.aiLabel = aiLabel;
    this.events = [];
    this.el = fragment(html`<div class="stage ${ARCHETYPE_CLASS[sol.archetype] || ''}">
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

  setBadges(badges) {
    mount(this.el.querySelector('.stage-top .chips'), badges.map((b) => html`<span class="chip ${b.cls || ''}"><i></i>${b.label}</span>`));
  }

  setInputs(inputs) {
    const shown = inputs.filter((i) => i.type.startsWith('image/') || i.type.startsWith('audio/') || i.text);
    this.media.hidden = !shown.length;
    const images = shown.filter((i) => i.type.startsWith('image/'));
    mount(this.media, shown.map((i) => mediaHtml(this.sol, i, images.length === 1 && i.type.startsWith('image/'))));
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
    let li = fragment(eventHtml(ev, this.aiLabel));
    this.list.append(li);
    this.events.push(ev);
    const stage = this;
    return {
      update(next) {
        Object.assign(ev, next);
        const fresh = fragment(eventHtml(ev, stage.aiLabel));
        fresh.style.animation = 'none';
        li.replaceWith(fresh);
        li = fresh;
        return this;
      },
    };
  }

  setOutputs(outputs) {
    this.outputs.hidden = !outputs.length;
    mount(this.outputs, outputs.map(outputHtml));
  }

  setFoot(lines) {
    this.foot.hidden = !lines.length;
    mount(this.foot, lines.map((l) => html`<p>${l}</p>`));
  }
}

function finishLines(finish, mode) {
  const lines = [];
  const cost = finish.cost_text ? `¥${finish.cost_text}` : '—';
  lines.push(`单次成本 ${cost} · 首字 ${finish.first_token || '—'} · 输入 ${finish.sample || '—'}`);
  if (finish.note) lines.push(`备注：${finish.note}`);
  if (mode === 'mock') lines.push('这是 mock 回放：按官方事件结构离线回放，没有调用模型，用量是示意值。');
  return lines;
}

const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// 逐行播放一条轨迹；返回控制器，页面离开时调用 stop()
export function playTrace(stage, trace, { autoplay = true } = {}) {
  let timer = null;
  let index = 0;
  const step = () => {
    if (index >= trace.events.length) {
      stage.setOutputs(trace.outputs);
      stage.setFoot(finishLines(trace.finish, trace.mode));
      timer = null;
      return;
    }
    const ev = trace.events[index++];
    stage.push(ev);
    const wait = Math.min(1100, 260 + ev.text.length * 9 + (ev.detail ? 420 : 0));
    timer = setTimeout(step, wait);
  };
  const start = (instant) => {
    clearTimeout(timer);
    stage.clear();
    index = 0;
    if (instant) {
      while (index < trace.events.length) stage.push(trace.events[index++]);
      step();
    } else step();
  };
  stage.setInputs(trace.inputs);
  stage.el.addEventListener('click', (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'replay') start(reduceMotion());
    if (act === 'all') start(true);
  });
  start(!autoplay || reduceMotion());
  return { stop: () => clearTimeout(timer), replay: () => start(false) };
}
