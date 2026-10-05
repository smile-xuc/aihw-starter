import { fmtCny, html, markdown, mount, copyText, download } from './ui.js';
import { validateInput } from './live/input.js';
import { normalizeUsageRecords } from './data.js';
import { readMeetingResult, meetingMarkup, meetingMarkdown, meetingSectionText } from './meeting-results.js';
import { readPhotoResult, photoMarkup, photoResultText } from './photo-results.js';
import { readTranscript, timestamp, editMeetingTrace } from './meeting-evidence.js';

export const PRODUCTS = {
  '02-ai-glasses.bailian': {title:'一看即懂', description:'拍下眼前的画面，问出你想知道的事。得到简明回答，也可以听 AI 播报。',kind:'image',question:'这张图片里有什么？'},
  '07-recorder.bailian': {title:'会议纪要',description:'放入一段录音，得到会议要点、决定和待办，原始转写随时展开查看。',kind:'audio'},
};
const drafts = new Map();
export function draftFor(key, {question=''}={}) {
  if (!drafts.has(key)) drafts.set(key,{file:null,input:null,question,source:'sample'});
  return drafts.get(key);
}
export function resetDraft(key, initial) {drafts.delete(key); return draftFor(key, initial);}
export function activateSampleDraft(draft, question='') {
  if(draft.source !== 'sample' || draft.question !== question)draft.resumeQuestion=draft.question;
  draft.source='sample';draft.question=question;
  return draft;
}
export const sceneRoute = (sol,variant) => `#/s/${encodeURIComponent(sol.id)}/${encodeURIComponent(variant.id)}`;
export function returnTarget(reg, hash) {
  if (!reg || typeof hash !== 'string' || !/^#\/s\/[^/?#]+\/[^/?#]+$/.test(hash)) return null;
  try {
    const [, , id, vid] = hash.split('/').map(decodeURIComponent);
    const sol=reg.byId.get(id); const variant=sol?.variants.find(v=>v.id===vid);
    return variant ? {sol,variant,hash:sceneRoute(sol,variant)} : null;
  } catch {return null;}
}
export const setupRoute = (sol,variant) => `#/me?return=${encodeURIComponent(sceneRoute(sol,variant))}`;
export function redact(value, secrets=[]) {
  let text=String(value ?? '');
  for (const secret of secrets.filter(s=>typeof s==='string' && s.length>2).sort((a,b)=>b.length-a.length)) text=text.split(secret).join('[已隐藏]');
  return text.replace(/(?:https?:\/\/|blob:|data:)[^\s<>"']+/gi,'[临时地址已隐藏]').replace(/Bearer\s+[^\s,;]+/gi,'Bearer [已隐藏]');
}
const integer = n=>Number.isFinite(n) ? Math.max(0,Math.round(n)) : null;
export function safeFiles(files=[],secrets=[]) {
  return files.filter(f=>/^(samples|out)\//.test(f.path||'')).map(f=>{
    const text=f.text==null?null:redact(f.text,secrets);
    return {path:redact(f.path,secrets),media_type:String(f.media_type||f.type||'application/octet-stream'),bytes:text==null?(Number.isInteger(f.bytes)&&f.bytes>=0?f.bytes:0):new TextEncoder().encode(text).length,asset:null,...(text==null?{}:{text})};
  });
}
const usageRecords = (records, secrets=[]) => normalizeUsageRecords(records, value=>redact(value,secrets));
export function browserTrace({sol,variant,result=null,error=null,events=[],inputs=[],startedAt=new Date().toISOString(),region='',secrets=[]}) {
  const cost=result?.cost;
  const range=cost==null?null:Array.isArray(cost)?{low:cost[0],high:cost[1]}:typeof cost==='object'?{low:cost.low,high:cost.high}:{low:cost,high:cost};
  const metrics=result?.metrics;
  return {schema:'aihw/trace@0.1',solution:sol.id,variant:variant.id,mode:'live',kit:'browser',runner:'browser',ran_at:startedAt,status:error?(error.name==='AbortError'?'stopped':'failed'):'success',args:variant.args||[],title:redact(sol.title,secrets),region,models:(sol.models||[]).map(m=>m.id),timing:'measured',
    events:events.map((e,i)=>({i,t_ms:integer(e.t_ms),tag:e.tag??null,kind:['device','cloud','result','stats','notice','other'].includes(e.kind)?e.kind:'other',text:redact(e.text,secrets),lines:(e.lines||[]).map(l=>redact(l,secrets)),assets:(e.assets||[]).filter(a=>/^(samples|out)\//.test(a))})),
    result:result?{models:result.models||[],first_token_ms:integer(metrics?metrics.textFirstMs:null),cost:range,sample:redact(result.sample,secrets),note:redact(result.note,secrets),costStatus:result.costStatus||'unknown',metrics:Object.fromEntries(['textFirstMs','audioFirstMs','audioReadyMs','totalMs','asrMs'].map(k=>[k,integer(metrics?.[k])])),warnings:(result.warnings||[]).map(w=>redact(w,secrets)),usageRecords:usageRecords(result.usageRecords,secrets)}:null,
    inputs:safeFiles(inputs,secrets),outputs:safeFiles(result?.outputs||error?.outputs||[],secrets),error:error&&error.name!=='AbortError'?redact([error.message,error.hint].filter(Boolean).join(' · '),secrets):null,
    ...(error?.usageRecords?{usageRecords:usageRecords(error.usageRecords,secrets)}:{}),
  };
}
export function safeTrace(trace, secrets=[]) {
  const pick=(object,keys)=>Object.fromEntries(keys.filter(k=>object?.[k]!==undefined).map(k=>[k,object[k]]));
  const safe=pick(trace,['schema','solution','variant','mode','kit','args','title','region','models','timing','runner','ran_at','status','error']);
  safe.kit=typeof safe.kit==='string'?safe.kit:'imported';
  safe.events=(trace.events||[]).map((e,i)=>({...pick(e,['tag','kind','text','lines','assets']),i,t_ms:integer(e.t_ms)}));
  safe.inputs=safeFiles(trace.inputs,secrets);safe.outputs=safeFiles(trace.outputs,secrets);
  safe.result=trace.result?pick(trace.result,['models','first_token_ms','sample','note','costStatus','warnings']):null;
  if(safe.result){
    safe.result.first_token_ms=integer(trace.result.first_token_ms);
    safe.result.cost=trace.result.cost?pick(trace.result.cost,['low','high']):null;
    if(trace.result.metrics)safe.result.metrics=Object.fromEntries(['textFirstMs','audioFirstMs','audioReadyMs','totalMs','asrMs'].filter(k=>k in trace.result.metrics).map(k=>[k,integer(trace.result.metrics[k])]));
    if(trace.result.usageRecords)safe.result.usageRecords=usageRecords(trace.result.usageRecords,secrets);
  }
  if(trace.usageRecords)safe.usageRecords=usageRecords(trace.usageRecords,secrets);
  return JSON.parse(JSON.stringify(safe,(key,value)=>typeof value==='string'?redact(value,secrets):value));
}
export function costText(result) {
  if (!result?.cost || result.costStatus==='unknown') return '费用未知（接口未返回完整用量）';
  const {low,high}=result.cost;
  return `${result.costStatus==='estimated'?'估算':'按用量计算'} ¥${fmtCny(low===high?low:[low,high])}（以账单为准）`;
}
export function metricLines(result) {
  if (!result) return [];
  if (!result.metrics) return [result.first_token_ms==null?'旧记录首响应：未记录':`旧记录首响应：${result.first_token_ms} ms（旧口径，可能含工具响应）`];
  const m=result.metrics; const label=(key,name)=>`${name}：${m[key]==null?'未获得':`${Math.round(m[key])} ms`}`;
  return [label('textFirstMs','文字首响应'),label('audioFirstMs','音频首包（HTTP 整段流程不可测）'),label('audioReadyMs','整段音频就绪（非播放延迟）'),label('totalMs','总耗时'),...(m.asrMs==null?[]:[label('asrMs','语音转写')])];
}
export function mainOutput(trace) {
  const derived = trace?.mode === 'mock' ? (trace.events || []).filter(e=>e.kind === 'result').map(e=>[e.text,...(e.lines || [])].join('\n')).join('\n\n') : '';
  return (trace?.outputs||[]).find(f=>/\/(answer\.txt|minutes\.md)$/.test(f.path)) || (trace?.outputs||[]).find(f=>f.text!=null && !/transcript|\.json$/.test(f.path)) || (trace?.outputs||[]).find(f=>f.text!=null && !/transcript/.test(f.path)) || (derived ? {path:'out/answer.txt',media_type:'text/plain',text:derived} : undefined);
}
export function renderOutcome(slot, trace, options={}) {
  const {label='',historyNote='',settingsHref='#/me',secrets=[],speechURL=null,canRetry=false,onChange=null,editNotice='',experienceHref=''}=options;
  trace=safeTrace(trace,secrets);
  const meeting=readMeetingResult(trace);
  let output=meeting?{path:'out/minutes.md',media_type:'text/markdown',text:meetingMarkdown(meeting)}:mainOutput(trace);
  const photo=readPhotoResult(trace,output);
  if(photo)output={path:'out/answer.txt',media_type:'text/plain',text:photoResultText(photo)};
  const source=readTranscript(trace);
  const transcripts=(trace?.outputs||[]).filter(f=>/transcript/.test(f.path)&&!f.path.endsWith('.json')&&f!==output&&typeof f.text==='string'&&f.text.trim());
  const partialMeeting=trace.solution==='07-recorder.bailian'&&!meeting&&!output&&transcripts.length>0;
  const status=trace?.status==='stopped'?(canRetry?'已停止，已得到的文字仍可查看':'已停止的记录'):trace?.error?(canRetry?'本次未完成，请检查后手动重试':'未完成的记录'):trace?.mode==='mock'?'免费样本 · 预录回放':'本次结果 · 内容由 AI 生成';
  mount(slot,html`<div class="outcome panel" aria-live="polite"><div class="section-title"><h2>${label||status}</h2><span class="chip ${trace?.mode==='mock'?'accent':''}">${trace?.mode==='mock'?'mock 示例':trace?.status==='failed'?'失败':trace?.status==='stopped'?'已停止':'真跑记录'}</span></div>
    ${trace?.error?html`<p class="inline-error">${trace.error}</p><p class="small">请先检查素材和提问；遇到 401 / 403 再检查 Key、地域与模型权限。网络异常时先核对调用记录，已发出的模型请求可能继续运行并计费。<a href="${settingsHref}">查看 Key 设置</a></p>`:''}
    ${trace.status==='stopped' ? html`<p class="info-note">只停止了本机等待，已提交的云端任务可能继续运行并计费。已得到的文字可以继续复制或下载。</p>` : ''}
    ${output?html`<div class="result-text">${meeting?meetingMarkup(meeting):photo?photoMarkup(photo):output.media_type==='text/markdown'||output.type==='text/markdown'?markdown(output.text):html`<pre class="wrap">${output.text}</pre>`}</div>
      <div class="btn-row"><button type="button" class="secondary-action" data-result-copy>${meeting?'复制完整纪要':'复制结果'}</button><button type="button" class="secondary-action" data-result-download>${meeting?'下载纪要':'下载结果'}</button></div>`:partialMeeting?html`<p class="inline-ok">转写已保留，纪要尚未完成。可以先复制或下载转写。</p>`:html`<p>${status}</p>`}
    ${meeting?html`<p class="small meeting-save-status" data-meeting-save-status role="status">${editNotice || (onChange ? '人工修正会更新这条本机历史，并保留 AI 原值。' : '可试着修正信息；修正仅保留在当前页面，也可复制或导出。')}</p>`:''}
    ${speechURL?html`<div class="input-preview"><p class="small">听播报 · AI 合成语音（仅本次临时可用）</p><audio aria-label="听播报" controls preload="none" src="${speechURL}"></audio></div>`:''}
    ${transcripts.map((f,index)=>html`<details class="meeting-transcript" ${partialMeeting?html`open`:''} ${source && index===0 ? html`data-meeting-transcript`:''}><summary>原始转写<span class="small">${partialMeeting?'已保留':'点击展开'}</span></summary>${source && index===0 ? html`<p class="small">以下是 ASR 转写，原句关联可帮助核对，但不代表识别内容已确认。发言标签不代表真实身份。</p><ol class="transcript-sentences">${source.sentences.map(s=>html`<li data-transcript-id="${s.id}" tabindex="-1"><span class="transcript-meta">${s.id} · ${timestamp(s.begin_ms)} · ${s.speaker}</span><p>${s.text}</p></li>`)}</ol>` : html`<pre class="wrap">${f.text}</pre>`}<div class="btn-row"><button type="button" class="secondary-action" data-transcript-copy="${index}">复制转写</button><button type="button" class="secondary-action" data-transcript-download="${index}">下载转写</button></div></details>`)}
    ${trace?.result?html`<p class="small result-cost">${trace.mode==='mock'?'示例估算（没有产生费用）':costText(trace.result)}</p><div class="metric-list">${metricLines(trace.result).map(l=>html`<span>${l}</span>`)}</div>${(trace.result.warnings||[]).map(w=>html`<p class="info-note">${w}</p>`)}`:''}
    ${historyNote?html`<p class="small history-note">${historyNote}</p>`:''}
    ${experienceHref?html`<p class="small"><a class="secondary-action" data-history-experience href="${experienceHref}">返回体验页面</a></p>`:''}
    ${canRetry && (trace.status==='failed' || trace.status==='stopped') ? html`<div class="retry-action"><button type="button" class="secondary-action" data-outcome-retry>检查后重新运行</button><p class="small">可修改上方的素材和提问。重新运行需要再次确认计费；不会自动重试。</p></div>` : ''}
    <button type="button" class="secondary-action block" data-export>导出本次记录（aihw/trace@0.1）</button></div>`);
  slot.querySelector('[data-result-copy]')?.addEventListener('click',()=>copyText(output.text));
  slot.querySelector('[data-result-download]')?.addEventListener('click',()=>download(output.path.split('/').pop(),output.text,output.media_type||output.type));
  if(meeting)for(const key of ['summary','decisions','action_items','agenda','open_questions','risks'])slot.querySelector(`[data-meeting-copy="${key}"]`)?.addEventListener('click',()=>copyText(meetingSectionText(meeting,key)));
  transcripts.forEach((file,index)=>{
    slot.querySelector(`[data-transcript-copy="${index}"]`)?.addEventListener('click',()=>copyText(file.text));
    slot.querySelector(`[data-transcript-download="${index}"]`)?.addEventListener('click',()=>download(file.path.split('/').pop(),file.text,file.media_type||'text/plain'));
  });
  slot.querySelector('[data-export]')?.addEventListener('click',()=>download(`${trace.solution}.${trace.variant}.json`,JSON.stringify(safeTrace(trace),null,2)));
  const root=slot.querySelector('.outcome');
  const saveEdit=(key,changes,restore=false)=>{
    const [section,rawIndex]=key.split(':');
    const next=editMeetingTrace(trace,section,Number(rawIndex),changes,{restore});
    const effective=readMeetingResult(next);
    const markdown=meetingMarkdown(effective);
    const file=next.outputs.find(f=>f.path==='out/minutes.md');
    if(file){file.text=markdown;file.bytes=new TextEncoder().encode(markdown).length;}
    let notice=onChange?'修正已保存到这条本机历史，AI 原值仍保留。':'修正仅保留在当前页面；复制、下载和导出会包含修正。';
    if(onChange){const saved=onChange(next);if(saved && !saved.saved)notice=saved.error+' 修正仍可复制、下载和导出。';}
    renderOutcome(slot,next,{...options,editNotice:restore?'已恢复 AI 原值。 '+notice:notice});
    slot.querySelector(`[data-meeting-edit="${key}"]`)?.focus();
  };
  root?.addEventListener('click',event=>{
    const jump=event.target.closest('[data-meeting-source]');
    if(jump){
      const node=slot.querySelector(`[data-transcript-id="${jump.dataset.meetingSource}"]`);
      if(node){node.closest('details').open=true;for(const old of slot.querySelectorAll('.transcript-sentences .is-linked'))old.classList.remove('is-linked');node.classList.add('is-linked');node.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'center'});node.focus({preventScroll:true});}
    }
    const edit=event.target.closest('[data-meeting-edit]');
    if(edit){const form=slot.querySelector(`[data-meeting-edit-form="${edit.dataset.meetingEdit}"]`);form.hidden=!form.hidden;edit.setAttribute('aria-expanded',String(!form.hidden));if(!form.hidden)form.querySelector('input').focus();else form.reset();}
    const cancel=event.target.closest('[data-meeting-edit-cancel]');
    if(cancel){const form=cancel.closest('form');form.hidden=true;form.reset();form.querySelector('[data-meeting-edit-error]').textContent='';const button=slot.querySelector(`[data-meeting-edit="${form.dataset.meetingEditForm}"]`);button.setAttribute('aria-expanded','false');button.focus();}
    const restore=event.target.closest('[data-meeting-restore]');
    if(restore)saveEdit(restore.dataset.meetingRestore,{},true);
  });
  root?.addEventListener('submit',event=>{
    const form=event.target.closest('[data-meeting-edit-form]');if(!form)return;
    event.preventDefault();
    try{saveEdit(form.dataset.meetingEditForm,Object.fromEntries(new FormData(form)));}
    catch(error){form.querySelector('[data-meeting-edit-error]').textContent=error.message;}
  });
}

export function fileType(file,kind) {
  const ext=file.name.split('.').pop().toLowerCase();
  const mime=({jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webp:'image/webp',wav:'audio/wav',mp3:'audio/mpeg'})[ext];
  if (!mime?.startsWith(`${kind}/`) || (file.type && ![mime,...(ext==='wav'?['audio/x-wav','audio/wave']:[])].includes(file.type))) throw Error('文件格式不支持或扩展名不匹配');
  if (!file.size || file.size>7*1024*1024) throw Error('文件不能为空，且不能超过 7 MiB');
  return mime;
}
export async function decodeFile(file,kind,question, {signal}={}) {
  const mime=fileType(file,kind),buffer=await file.arrayBuffer();
  // Decode media independently of editable text; inputForRun and the runner validate the current question.
  const mediaQuestion=kind==='image' ? '素材核验' : question;
  const url=URL.createObjectURL(file);
  try {
    let durationSeconds;
    if(kind==='image') {
      validateInput({kind,mime,buffer,name:file.name,question:mediaQuestion});
      await new Promise((resolve,reject)=>{
        const image=new Image(); const timer=setTimeout(()=>{image.src='';reject(Error('图片解码超时，请换一个文件'));},8000);
        image.onload=()=>{clearTimeout(timer); image.naturalWidth&&image.naturalHeight?resolve():reject(Error('图片为空或损坏'));};
        image.onerror=()=>{clearTimeout(timer);reject(Error('图片无法解码，可能已损坏或截断'));}; image.src=url;
      });
    } else {
      // Validate signature before decoding. Duration here is only a placeholder for header checking.
      validateInput({kind,mime,buffer,name:file.name,format:mime==='audio/wav'?'wav':'mp3',durationSeconds:1});
      try {
        durationSeconds=await new Promise((resolve,reject)=>{
          const audio=document.createElement('audio'); let timer;
          const done=(fn,value)=>{clearTimeout(timer);audio.removeAttribute('src');audio.load();fn(value);};
          audio.onloadedmetadata=()=>done(resolve,audio.duration);audio.onerror=()=>done(reject,Error('录音无法解码'));timer=setTimeout(()=>done(reject,Error('读取录音时长超时')),6000);audio.preload='metadata';audio.src=url;
        });
      } catch { durationSeconds=NaN; }
      if (!Number.isFinite(durationSeconds)||durationSeconds<=0) {
        const Audio=globalThis.AudioContext||globalThis.webkitAudioContext;
        if(Audio) {const context=new Audio();try {durationSeconds=(await Promise.race([context.decodeAudioData(buffer.slice(0)),new Promise((_,reject)=>setTimeout(()=>reject(Error('录音解码超时')),8000))])).duration;}catch {throw Error('录音损坏或无法确定时长，请使用有效 WAV / MP3');}finally {await context.close();}}
      }
    }
    if(signal?.aborted) throw new DOMException('已停止','AbortError');
    const input=validateInput({kind,mime,buffer,name:file.name,question:mediaQuestion,format:mime==='audio/wav'?'wav':'mp3',durationSeconds});
    return kind==='image' ? {...input,question:typeof question==='string'?question.trim():''} : input;
  } finally {URL.revokeObjectURL(url);}
}
