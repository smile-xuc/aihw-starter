import { PRODUCTS } from '../experience.js';
import { readHistory, statusLabel } from '../history.js';
import { label } from '../data.js';
import { runnerCount, solutionRunnable } from '../live/index.js';
import { LIVE_PRODUCTS } from '../live/product-session.js';
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
  const n = runnerCount() + LIVE_PRODUCTS.filter((item) => item.kind !== 'link').length;
  if (saved.length) {
    return html`<div class="mode-banner live">${icon('key')}<div><strong>已填 ${saved.map((s) => s.name).join('、')} 的 Key</strong>
      <p>${n} 个玩法可以在浏览器里直接真跑（待真 Key 验证）：请求直接发往官方接入点，按你的账单计费。也可以打开<a href="#/session">看说体验</a>，接通后对着摄像头或屏幕说话。声音、画面、到点提醒、连续解说和多套记忆库可以在看说体验里开。后台委托仍要在 Mac 上运行。<a href="#/me">管理 Key</a></p></div></div>`;
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
    <section class="section panel"><p class="eyebrow">KEY / 看说</p><h2>填入百炼 Key，前台接着聊。</h2><p>打开摄像头或共享屏幕，接通后直接说话。可以说「持续报告我手机屏幕里的内容」，或「关注我的身体，咳嗽了就提醒」。这两项可以同时开。报告屏幕只看画面，咳嗽提醒只听声音。说「咳嗽了提醒我一次」，提醒过就停；说「从现在开始关注」，会一直听，同一次里不重复说。前台先接住，后台再看再查，结果稍后才说。玩具、桌宠和同传耳机用同一把 Key。说「把这个交给编码助手」，前台马上说明这个页面没有编码后台。说「咳嗽了就提醒我喝水」，提醒的是喝水，不是只说听到了咳嗽。说「有人叫我名字就说我在」，已经在听的咳嗽提醒会继续。这个页面同时最多两项监视。说「持续报告屏幕，每次只说一句很短的话」，后台按这句原话的详略来讲。同一轮里已经在查的问题，或已经开始的提醒，不会再开一条。同一句话里要持续报告屏幕、又要咳嗽提醒时，两项都会开始。问到事实时，只有确认这次联网了，才会说查过网上。这一通最长 30 分钟，到点会结束通话，持续报告和监视也停下。正在查或正在看的一项可以停下，停下后结果不再说出来。已经发出的请求仍会计费。查询和看图的结果由单独的播报说出，不再占用主对话。查到或看到的结果会留给这一通对话，之后追问可以直接用。持续报告和咳嗽提醒说过的话也会留下。播报静音时，还没说的查询和看图也不再补播。你一开口，正在读的查询或看图会停住，不再补播。持续报告和咳嗽提醒会等你说完再讲。还没读完的结果留在这一通。你问到这件事会直接说。麦克风和摄像头可以换成这台设备上的其他输入，通话中更换会接着这一通。通话中也可以改实时画面或按需看一眼。这一通还没送过画面时，改成实时画面会新开一条连接，计时接着算。持续报告和监视听久了会换一条后台连接，这一项接着做。缺一帧或一小段声音就跳过这一轮。问到事实时最多等 25 秒。超时就说没查成，不会再发一次。通话中也可以换记忆库，接下来用这一套，长期资料在挂断时整理。一帧太大就再缩小后送出。缩不到限制内就跳过这一帧，通话、持续报告和监视接着做。问以前看到的画面时，相距不到 10 分钟的观察只留一条。持续报告或咳嗽提醒有字但没有声音时，会另读一次。没读出来这项也接着做。模型没答上、回答 15 秒还没开始，或你开口后 2 秒还停不掉当前回答，会换一条连接接着通话，计时不重算。工具回执后的回答超过 2 分钟也会换。持续报告和监视先接着做。换了两次仍没接上，这一通才结束。放进这一通的长期资料每项最多 6 条。整段超过 800 字时，先拿掉关系，再拿掉兴趣、偏好、外形、习惯和长期目标。姓名和长期角色会留下。视觉记忆这一帧最多等 60 秒。记下或没记下之后，再隔 60 秒看下一帧。还没有画面时，2 秒后再试。额度不够时这一通马上结束，不会再换一条连接。请到百炼控制台看额度。持续报告和监视也停下。看画面第一次没看上，会用同一张画面再看一次，这次只说两句短话。两次加起来最多 50 秒。挂断后整理长期资料最多等 2 分钟。超过就这次不写入，也不会再收成一段摘要。已经发出的请求仍会计费。你用英文说话，或说「请用英文和我说话」之后，这一通改用英文回答，查询和看图的播报也用英文。说「请用中文和我说话」就改回中文。OK 这种短句不会改语言。改用英文之后，提示里不再同时要求用中文回答。放进这一通的长期资料按姓名、长期角色、长期目标、习惯、外形、偏好、兴趣、关系排列。记下画面和挂断后整理长期资料时，都按温度 0 生成。记一帧最多 400 token，整理最多 2048 token。整理写到上限还没写完，这次不写入，再收成一段摘要。咳嗽这类持续提醒说完后，先停 3 秒，这 3 秒不再交给模型。只有这一项在听声音时，这 3 秒的声音会丢掉。安静一轮之后才会再提醒。持续报告屏幕的间隔不变。问事实或看画面的问题最长 4096 字，不再截成几百字。问题空了、超长，或带了别的参数，这次不查、不看，也不会发出请求。问事实时，问题里有控制字符也不查。查询或看图的结果里如果出现工具调用，这次不算查到或看清。查到或看到的最新一条结果会把完整内容留在这一通里，最长 16000 字，之后追问可以用。更早的查询和看图只留开头大约 180 字。说出来的仍是开头大约 180 字。持续报告和咳嗽提醒仍只留下刚说的那句。查到或看到的内容超过 16000 字，或拆成超过 64 段，这次不算查到或看清，也不会截短后当成完整结果。看画面的结果里有控制字符，这次没看清，也不会再看一次。记下的长期事实按原句保存，一条最长 800 字。每一项只留最近 6 条，更早的不再保存。姓名仍最多 40 字。放进这一通时，整段仍最多 800 字。记下的近期事项也按原句保存，一条最长 1200 字。放进这一通时最多 20 条，整段最多 1200 字。问事实或看画面时，按这个问题本身的语言回答。英文问题用英文，中文问题用中文。问题短到分不清时，跟这一通正在用的语言。这一通用英文时，持续报告和咳嗽提醒按英文规则在后台看和听。英文里说持续报告屏幕，只看画面；说关注身体或咳嗽，只听声音。说一次就提醒过即停。条件没发生时仍只输出 remain_silent。这一通用英文时，前台也认得持续报告屏幕、关注身体或咳嗽、交给编码助手这些英文说法。接住之后的回执用英文，只说已经交给后台，不把结果说成已经发生。中文通话的回执仍是中文。编码委托仍在 Mac 上的 Qwen-Live-Harness。</p><a class="primary-action" href="#/session">打开看说体验</a><div class="btn-row"><a class="secondary-action" href="#/live/toy">玩具</a><a class="secondary-action" href="#/live/pet">桌宠</a><a class="secondary-action" href="#/live/earphone">同传耳机</a></div></section>
    <section class="section panel"><p class="eyebrow">NEW / 开发者能力实验室</p><h2>从调用工具，到持续办事。</h2><p>Bailian CLI 命令模板、视频证据与图片检查、纯语音任务编排、视觉上下文演练。四条能力路线，附本地运行步骤。</p><a class="primary-action" href="#/lab">打开能力实验室 →</a></section>
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
