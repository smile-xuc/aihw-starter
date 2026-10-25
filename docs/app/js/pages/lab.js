import {html, mount, mountPage, download, repoUrl} from '../ui.js';
import {CAPABILITIES, CLI_TEMPLATES, EVIDENCE, VISUAL_FRAMES, buildCommand, initialTask, transition, taskToken} from '../agent-lab.js';

const guide = id => repoUrl('solutions/by-solution/09-agent-capabilities.md') + '#' + id;
export function renderLab(view, id='') {
  const capability=CAPABILITIES.find(c=>c.id===id);
  document.title=(capability?capability.name:'能力实验室')+' · AIHW Starter';
  const page=mountPage(view,html`
    <a class="back" href="${id?'#/lab':'#/'}">← ${id?'能力实验室':'体验中心'}</a>
    <section class="intro"><p class="eyebrow">BUILD / VERIFY / UNDERSTAND</p><h1>${capability?.title||'能力实验室'}</h1>
    <p>${capability?.summary||'从调用工具，到理解媒体，再到持续交流和后台办事。选择一条链路，先验证交互，再进入本地开发。'}</p></section>
    <div class="mode-banner"><div><strong>本地交互演练 · 无模型请求</strong><p>命令只生成不执行；时间线与任务结果为人工编写样本。无需 Key，不采集麦克风、摄像头或屏幕。真实开发步骤与依赖单列。</p></div></div>
    ${capability?html`<div class="panel"><h2>${capability.name}</h2><p class="lab-flow">${capability.flow}</p><p>${capability.needs}</p><div class="btn-row"><a href="${guide(id)}">本地开发步骤与验收</a><a href="${capability.source}">固定提交源码</a></div></div><section class="section" data-lab-demo></section>`:html`
    <div class="lab-grid">${CAPABILITIES.map(c=>html`<a class="panel lab-card" href="#/lab/${c.id}"><span class="chip accent">${c.name}</span><h2>${c.title}</h2><p>${c.summary}</p><span>打开演练 →</span></a>`)}</div>
    <section class="panel section"><h2>现有体验，能做到哪一步？</h2><ul><li>图片问答与文件会议纪要：已有浏览器实现；需要自备 Key，云端 CORS 与真实账单尚未验证。</li><li>九品类样本：固定回放；实时语音与部分合成玩法需要本地运行或网关。</li><li>会议实时字幕：已有可选 ASR 网关路径，网关、麦克风和模型权限缺一不可。</li><li>硬件页：参考设计、预算与状态演练；没有整机验收证据。</li></ul><div class="btn-row"><a href="#/s/07-recorder.bailian/default">会议纪要 / 实时字幕</a><a href="#/hardware">硬件参考设计</a><a href="${repoUrl('docs/app/CAPABILITY_AUDIT.md')}">完整审计与本轮修复</a></div></section>`}
    <section class="panel section"><h2>把原理，也弄明白</h2><a href="../voice-agent-runtime.html">从语音聊天到语音 Agent：真正缺的是哪一层？</a><p>独立长文：为什么停播不是取消，完成之后仍要安排交付。</p></section>
    <p class="footnote">资料复核：2026-10-25 · <a href="${guide('sources')}">版本与来源清单</a></p>`);
  const slot=page.querySelector('[data-lab-demo]');
  if(id==='cli') renderCLI(slot);
  if(id==='media') renderMedia(slot);
  if(id==='voice'||id==='visual') renderTask(slot,id);
}

function renderCLI(slot) {
  mount(slot,html`<form data-command-form class="panel" novalidate><h2>任务模板 → 可复制命令</h2><label class="field">任务<select name="kind">${Object.entries(CLI_TEMPLATES).map(([k,v])=>html`<option value="${k}">${v.label}</option>`)}</select></label>
    <label class="field"><span data-input-label>提示词</span><textarea name="input" rows="4" maxlength="2000">${CLI_TEMPLATES.text.value}</textarea></label><p class="small">按 POSIX shell 单引号转义；不适用于 PowerShell。不会核验本地文件存在、模型权限或余额。</p><button class="primary-action">校验并生成命令</button></form>
    <div data-command-output aria-live="polite"></div>`);
  const form=slot.querySelector('form'),out=slot.querySelector('[data-command-output]');
  let command='';
  form.elements.kind.addEventListener('change',()=>{form.elements.input.value=CLI_TEMPLATES[form.elements.kind.value].value;slot.querySelector('[data-input-label]').textContent=form.elements.kind.value==='asr'?'本地音频路径':'提示词 / 播报文字';out.replaceChildren();command='';});
  form.elements.input.addEventListener('input',()=>{out.replaceChildren();command='';});
  form.addEventListener('submit',e=>{e.preventDefault();try{command=buildCommand(form.elements.kind.value,form.elements.input.value);mount(out,html`<div class="panel section"><h3>已校验语法 · 尚未执行</h3><pre class="lab-code"><code>${command}</code></pre><p>运行可能产生费用、上传素材并写入输出文件；重试可能重复提交任务。先阅读开发步骤并确认输出路径。</p><button class="secondary-action" data-copy-command>复制命令</button><p data-copy-status role="status"></p></div>`);}catch(error){mount(out,html`<p class="inline-error" role="alert">${error.message}</p>`);}});
  out.addEventListener('click',async e=>{if(!e.target.closest('[data-copy-command]'))return;const status=out.querySelector('[data-copy-status]');try{await navigator.clipboard.writeText(command);if(status.isConnected)status.textContent='命令已复制；尚未执行。';}catch{if(status.isConnected)status.textContent='复制失败，请选择上方命令手动复制。';}});
}

function renderMedia(slot) {
  mount(slot,html`<div class="panel"><h2>视频证据时间线（脚本样本）</h2><p>这三个时间点是人工编写的巡检教程示例，未加载或分析真实视频。抽帧只提供证据候选，不能证明抽样间隔内没有事件。</p><div class="btn-row">${EVIDENCE.map((e,i)=>html`<button class="secondary-action" data-evidence="${i}" aria-pressed="${i===0}">${e.time} ${e.title}</button>`)}</div><div data-evidence-detail aria-live="polite"></div></div>
    <div class="panel section"><h2>图片局部检查（仓内样本）</h2><p>独立的图片工具演示：这张餐盘照片不是上方巡检视频的一帧。切换放大只改变浏览器显示，不生成识别结论。</p><div class="lab-image"><img data-inspect-image src="data/assets/02-ai-glasses.bailian/samples/dish.jpg" alt="仓内餐盘样本照片，供人工观察局部" width="640" height="480"></div><button class="secondary-action" data-zoom aria-pressed="false">放大中央区域</button><p data-image-status role="status">完整图片 · 不含模型推理</p></div>`);
  const detail=slot.querySelector('[data-evidence-detail]');
  const show=i=>{const e=EVIDENCE[i];mount(detail,html`<h3>${e.time} · ${e.title}</h3><p>${e.observation}</p><p><strong>${e.confidence}</strong> → ${e.step}</p>`);for(const b of slot.querySelectorAll('[data-evidence]'))b.setAttribute('aria-pressed',String(Number(b.dataset.evidence)===i));};
  show(0);
  slot.addEventListener('click',e=>{const b=e.target.closest('[data-evidence]');if(b)show(Number(b.dataset.evidence));if(e.target.closest('[data-zoom]')){const image=slot.querySelector('[data-inspect-image]');const zoom=image.classList.toggle('zoomed');slot.querySelector('[data-zoom]').setAttribute('aria-pressed',String(zoom));slot.querySelector('[data-zoom]').textContent=zoom?'恢复完整图片':'放大中央区域';slot.querySelector('[data-image-status]').textContent=zoom?'中央区域放大 2 倍 · 未识别内容':'完整图片 · 不含模型推理';}});
  const image=slot.querySelector('[data-inspect-image]');image.addEventListener('error',()=>{slot.querySelector('[data-image-status]').textContent='样本图片加载失败，请联网刷新重试；时间线仍可使用。';slot.querySelector('[data-zoom]').disabled=true;});
}

function renderTask(slot,id) {
  let state=initialTask({visual:id==='visual'});
  const labels={idle:'未开始',running:'运行中',awaiting_approval:'等待批准',awaiting_context:'等待核对新画面',cancelling:'取消待确认',cancelled:'已取消',completed:'后台已完成',failed:'失败 / 被拒绝'};
  const button=(type,label,allowed)=>html`<button class="secondary-action" data-event="${type}" ${allowed?'':'disabled'}>${label}</button>`;
  mount(slot,html`<div class="panel"><h2>巡检记录 → 本地草稿</h2><p>${id==='voice'?'设想用户通过语音要求整理巡检记录，后台生成草稿时，仍可追问、修改与取消。这里用按钮代替语音输入。':'设想用户说“把这里的异常整理成清单”。画面 A 是设备铭牌，画面 B 是接口近景，均为预制示意图。切换画面等同于一次新的需求版本。'}</p><div data-visual-frame></div><div data-task-state></div><div data-task-actions class="lab-actions"></div></div><div class="panel section"><h2>事件记录</h2><ol data-task-log aria-live="polite"></ol><button class="secondary-action" data-export-task>下载演练记录</button><button class="secondary-action" data-reset-task>重新开始</button></div>`);
  function draw(){
    if(id==='visual'){const frame=VISUAL_FRAMES[state.context];mount(slot.querySelector('[data-visual-frame]'),html`<figure class="lab-frame"><img src="${frame.file}" alt="${frame.title} · 预制示意画面" width="640" height="360"><figcaption><strong>${frame.title} · ${frame.id}</strong><br>${frame.source}<br>场景时钟 ${state.clock} 秒 / 取样时刻 ${state.observedAt} 秒 / 年龄 ${state.clock-state.observedAt} 秒<br><span data-frame-freshness>${state.clock-state.observedAt>15?'已过期，等待重新核对':'样本有效窗口内'}</span> · 15 秒阈值仅为教学假设，不是上游保证。</figcaption></figure>`);}
    mount(slot.querySelector('[data-task-state]'),html`<dl class="kv"><dt>后台任务</dt><dd data-task-status>${labels[state.task]}</dd><dt>当前要求</dt><dd>${state.requirement}</dd><dt>要求 / 尝试</dt><dd>v${state.revision} / 第 ${state.attempt} 次</dd><dt>前台播报</dt><dd>${state.speech==='speaking'?'模拟播报中':'已停播 / 静默'}</dd><dt>用户</dt><dd>${state.userTalking?'正在讲话':'未讲话'}</dd>${id==='visual'?html`<dt>预制画面</dt><dd>${state.context==='A'?'A · 设备铭牌（未读取实际屏幕）':'B · 接口近景（未读取实际屏幕）'}</dd>`:''}<dt>结果交付</dt><dd data-delivery>${state.delivered?'播放开始已确认（模拟）':state.result?'已排队，尚未交付':'无结果'}</dd></dl>${state.approval?html`<p class="info-note">待批准范围：${state.approval.scope} · 仅 v${state.revision}</p>`:''}${state.result?html`<p>${state.result}</p>`:''}`);
    const active=['running','awaiting_approval','awaiting_context'].includes(state.task);
    mount(slot.querySelector('[data-task-actions]'),html`${button('start','开始任务',state.task==='idle')}${button('stop-speech','停止播报',state.speech==='speaking')}${button('talk',state.userTalking?'用户停止讲话':'用户开始讲话',true)}${button('update','改为只保留待核对项',['running','awaiting_approval','completed'].includes(state.task))}${id==='visual'?html`${button('context','切换预制画面',['running','awaiting_approval','completed','awaiting_context'].includes(state.task))}${button('expire-context','模拟 20 秒后画面过期',['running','awaiting_approval','completed'].includes(state.task))}${button('refresh-context','重新核对当前画面',state.task==='awaiting_context')}`:''}${button('permission','模拟请求写入批准',state.task==='running')}${button('approve','批准本次草稿写入',state.task==='awaiting_approval')}${button('deny','拒绝批准',state.task==='awaiting_approval')}${button('cancel','取消任务',active)}${button('cancelled','模拟后台取消确认',state.task==='cancelling')}${button('fail','模拟后台失败',state.task==='running')}${button('retry','重试任务',['failed','cancelled'].includes(state.task))}${button('result','模拟当前结果到达',state.task==='running')}${button('stale','模拟旧结果到达',state.attempt>0)}${button('deliver','尝试交付结果',state.task==='completed'&&!state.delivered)}`);
    mount(slot.querySelector('[data-task-log]'),state.log.map(line=>html`<li>${line}</li>`));
  }
  slot.addEventListener('click',e=>{const b=e.target.closest('[data-event]');if(b&&!b.disabled){const type=b.dataset.event;state=transition(state,{type:type==='stale'?'result':type,token:type==='stale'?'0:0':type==='approve'?state.approval?.token:taskToken(state)});draw();}if(e.target.closest('[data-reset-task]')){state=initialTask({visual:id==='visual'});draw();}if(e.target.closest('[data-export-task]'))download('aihw-agent-lab-mock.json',JSON.stringify({mode:'mock',providerCalls:0,scenario:id,...state},null,2),'application/json');});
  draw();
}
