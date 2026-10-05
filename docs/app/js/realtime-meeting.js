import { html, mount, sheet, copyText, download } from './ui.js';
import { loadCredentials, validateCredentials } from './settings.js';
import { browserTrace, renderOutcome, setupRoute, redact } from './experience.js';
import { saveHistory, updateHistory } from './history.js';
import { transcriptText, timestamp } from './meeting-evidence.js';
import { runInBrowser } from './live/index.js';
import { microphone } from './live/microphone.js';
import { STREAM_MODEL, gatewayURL, probeGateway, TranscriptBuffer, connectASR } from './live/realtime-asr.js';

const GATEWAY_KEY = 'aihw.asr-gateway';
const states = {idle:'准备开始',connecting:'正在请求麦克风并连接',recording:'正在录音 · 边录边转',paused:'已暂停 · 不发送音频',finishing:'录音已结束 · 等待最后一句',summarizing:'转写已保留 · 正在整理纪要',complete:'本次录音已完成',failed:'本次未完成 · 确认文字已保留'};

export function mountRealtimeMeeting(slot,{reg,sol,variant,onBusy=()=>{}}) {
  let url='';try{url=localStorage.getItem(GATEWAY_KEY)||'';}catch{}
  mount(slot,html`<details class="realtime-panel panel" data-realtime><summary><span><strong>实时录音纪要</strong><small>边录边看字幕，结束后整理 · BYOK</small></span><span class="chip warn">待真 Key 验证</span></summary>
    <div class="realtime-content"><p class="small">使用麦克风，最多录音 180 秒。临时字幕可能变化，已确认原句会保留；此接口未提供说话人标签，负责人仍需核对。暂停不发送音频，时间戳按已发送音频计算。离开页面会结束采集。</p>
      <div class="realtime-setup"><strong>录音前准备</strong><p class="small">仓库没有公共网关。需要你自己的百炼 Key 和可信的实时转写网关；只有 Key 还不能开始实时录音。</p><ol data-rt-checklist aria-label="录音配置检查"></ol></div>
      <label class="field"><span>你的实时转写网关</span><input data-rt-gateway type="url" value="${url}" autocomplete="off" spellcheck="false" placeholder="wss://你的网关域名/asr"><small>只连接你信任的网关。Key 和实时音频经该网关转发到百炼，摘要仍由浏览器直连百炼。<a href="https://github.com/smile-xuc/aihw-starter/tree/master/services/asr-gateway" rel="noopener">网关部署说明</a> · <a href="${setupRoute(sol,variant)}" data-rt-setup>设置我的 Key</a></small></label>
      <p class="small realtime-origin">网关来源白名单应包含当前页面：<code>${location.origin}</code></p>
      <div class="btn-row"><button type="button" class="secondary-action" data-rt-probe>检查网关连接（不调用模型）</button><button type="button" class="secondary-action" data-rt-probe-cancel hidden>取消检查</button></div>
      <p class="small" data-rt-diagnostic role="status">无需 Key，只向你填写的网关发送协议检查，不申请麦克风、不发送 Key 或音频。通过后仍需录音验证 Key、模型权限和实际费用。</p>
      <p class="info-note">文件识别继续使用上方的临时上传方案。实时模式不上传录音文件、不保存原录音；浏览器历史只保存确认转写、纪要及调用记录。</p>
      <div class="realtime-status"><span data-rt-state role="status">准备开始</span><strong data-rt-duration>00:00 / 03:00</strong></div>
      <div class="btn-row"><button type="button" class="primary-action" data-rt-start>开始实时录音</button><button type="button" class="secondary-action" data-rt-pause hidden>暂停</button><button type="button" class="primary-action" data-rt-finish hidden>结束并生成纪要</button><button type="button" class="secondary-action" data-rt-abort hidden>停止等待，保留文字</button><button type="button" class="secondary-action" data-rt-summary hidden>用已确认文字生成纪要</button></div>
      <p class="small" data-rt-message role="status">尚未设置网关时，可以继续使用上方的文件识别或免费样本。</p>
      <div class="realtime-transcript" data-rt-transcript><p class="meeting-empty">录音开始后，已确认原句会显示在这里。</p></div>
      <div class="realtime-partial" data-rt-partial aria-label="临时转写" hidden><span class="small">临时文字 · 尚未确认</span><p></p></div>
      <div class="btn-row"><button type="button" class="secondary-action" data-rt-copy disabled>复制确认转写</button><button type="button" class="secondary-action" data-rt-download disabled>下载确认转写</button></div>
      <div data-rt-outcome></div>
    </div></details>`);
  const root=slot.querySelector('[data-realtime]'), field=root.querySelector('[data-rt-gateway]'), outcome=root.querySelector('[data-rt-outcome]');
  let active=true,state='idle',buffer=new TranscriptBuffer(),mic=null,session=null,ctrl=null,confirmation=null,externalBusy=false,seconds=0,started=0,asrEnded=0,startedAt='',firstText=null,epoch=0,audits=[],probeCtrl=null;
  const busy=()=>['connecting','recording','paused','finishing','summarizing'].includes(state);
  const message=text=>{root.querySelector('[data-rt-message]').textContent=text;};
  const diagnostic=text=>{root.querySelector('[data-rt-diagnostic]').textContent=text;};
  const controls=()=>{
    const locked=busy()||externalBusy||!!probeCtrl||!!confirmation;
    field.disabled=locked;
    for(const name of ['start','summary','probe'])root.querySelector(`[data-rt-${name}]`).disabled=locked;
    root.querySelector('[data-rt-probe-cancel]').hidden=!probeCtrl;
  };
  const checklist=()=>{
    let key='未配置 · 点击「设置我的 Key」',gateway='未填写 · 配置你自己信任的网关';
    try{credentials();key='已填写 · Key 有效性与模型权限待实际调用验证';}catch(error){key=error.message;}
    if(field.value.trim())try{gatewayURL(field.value);gateway='地址格式可用 · 可先检查连接';}catch(error){gateway=error.message;}
    const supported=isSecureContext&&!!navigator.mediaDevices?.getUserMedia&&!!globalThis.AudioWorkletNode;
    mount(root.querySelector('[data-rt-checklist]'),html`<li>浏览器：${supported?'支持安全麦克风录音 · 开始时申请权限':'需要 HTTPS 和支持 AudioWorklet 的浏览器'}</li><li>百炼凭证：${key}</li><li>实时网关：${gateway}</li>`);
  };
  const update=next=>{
    state=next;root.dataset.state=next;root.querySelector('[data-rt-state]').textContent=states[next];controls();
    root.querySelector('summary strong').textContent=busy()?`实时录音 · ${states[next]}`:'实时录音纪要';
    root.querySelector('[data-rt-start]').textContent=['complete','failed'].includes(next)?'开始新录音':'开始实时录音';
    for(const [name,visible] of [['pause',['recording','paused'].includes(next)],['finish',['recording','paused'].includes(next)],['abort',['connecting','finishing','summarizing'].includes(next)],['summary',!busy()&&!!buffer.source()&&next!=='complete']])root.querySelector(`[data-rt-${name}]`).hidden=!visible;
    root.querySelector('[data-rt-pause]').textContent=next==='paused'?'继续录音':'暂停';onBusy(busy());
  };
  let sourceSignature='';
  const draw=()=>{
    const source=buffer.source(),signature=JSON.stringify(source);
    if(signature!==sourceSignature){
      const old=root.querySelector('[data-rt-transcript] ol'),scroll=old?.scrollTop||0,atEnd=!old||old.scrollTop+old.clientHeight>=old.scrollHeight-20;
      mount(root.querySelector('[data-rt-transcript]'),source?html`<ol class="transcript-sentences">${source.sentences.map(s=>html`<li><span class="transcript-meta">${s.id} · ${timestamp(s.begin_ms)}</span><p>${s.text}</p></li>`)}</ol>`:html`<p class="meeting-empty">尚无已确认原句；临时字幕不会写入历史或纪要。</p>`);
      const list=root.querySelector('[data-rt-transcript] ol');if(list)list.scrollTop=atEnd?list.scrollHeight:scroll;sourceSignature=signature;
    }
    const partial=root.querySelector('[data-rt-partial]');partial.hidden=!buffer.partial;partial.querySelector('p').textContent=buffer.partial;
    for(const name of ['copy','download'])root.querySelector(`[data-rt-${name}]`).disabled=!source;
  };
  const credentials=()=>{const stack=reg.stacks.get(sol.stack),saved=loadCredentials(sol.stack);const {values,errors}=validateCredentials(stack,saved?.values||{});if(!values.DASHSCOPE_API_KEY)throw Error('请先设置自己的百炼 Key，再返回这里开始；不会自动调用模型');if(errors.length)throw Error(errors.join('；'));return {stack,values};};
  const showRecord=(cred,result=null,error=null)=>{
    const source=buffer.source(),secrets=[cred?.values.DASHSCOPE_API_KEY].filter(Boolean);
    if(error && source)error.outputs=[{path:'out/transcript.txt',media_type:'text/plain',text:transcriptText(source)+'\n'},{path:'out/transcript.json',media_type:'application/json',text:JSON.stringify(source,null,2)}];
    if(error)error.usageRecords=[...audits,...(error.usageRecords||[])];
    if(result){result.usageRecords=[...audits,...(result.usageRecords||[])];result.metrics.textFirstMs=firstText;result.metrics.asrMs=asrEnded-started;result.metrics.totalMs=performance.now()-started;result.sample=`实时录音 ${Math.round(seconds)} 秒`;result.note='文字首响应为本次实时 ASR 首条文字；总耗时含暂停、结束收尾和纪要生成。未保存原录音，ASR 未提供说话人标签；总费用未知。';}
    const trace=browserTrace({sol,variant,result,error,events:[],inputs:[],startedAt,region:cred?.values.DASHSCOPE_API_REGION||'',secrets});trace.models=[...new Set([...audits,...(result?.usageRecords||error?.usageRecords||[])].map(a=>a.model))];
    const saved=saveHistory(trace);renderOutcome(outcome,trace,{settingsHref:setupRoute(sol,variant),secrets,onChange:saved.saved?updated=>updateHistory(saved.record.id,updated):null,historyNote:saved.saved?'确认转写与结果已保存到本机历史；不保存原录音、Key 或网关地址。':saved.error});
  };
  const failure=async(error,cred,id)=>{
    if(!active||id!==epoch||state==='failed'||state==='complete')return;
    const failedMic=mic,failedSession=session;asrEnded=asrEnded||performance.now();update('failed');buffer.partial='';draw();message(redact(error.message,[cred?.values.DASHSCOPE_API_KEY])+ ' 已发出的请求可能计费；不会自动重连。');ctrl?.abort();failedSession?.close();showRecord(cred,null,error);await failedMic?.discard();
  };
  const consent=async(content)=>{confirmation=sheet(content,{label:'确认实时录音'});controls();const selected=await confirmation.done;confirmation=null;if(active)controls();return active&&selected==='go';};
  const diagnose=async()=>{
    if(busy()||externalBusy||confirmation||probeCtrl)return;
    let target;try{target=gatewayURL(field.value);}catch(error){diagnostic(error.message);return;}
    if(!await consent(html`<h2>检查这个网关的连接？</h2><p>将连接 <strong>${new URL(target).host}</strong>，仅发送协议检查。不会发送百炼 Key、音频或调用模型。请确认这是你填写并信任的地址。</p><div class="btn-row"><button class="secondary-action" data-sheet="cancel">取消</button><button class="primary-action" data-sheet="go">检查连接</button></div>`))return;
    if(!active||busy()||externalBusy)return;
    const current=new AbortController();probeCtrl=current;controls();diagnostic('正在检查 WebSocket 连接与网关协议…');
    try{await probeGateway({url:target,signal:current.signal});if(active)diagnostic('网关连接检查通过 · 当前来源已被接受，协议兼容。未验证 Key、模型权限、上游网络、音质或计费。');}
    catch(error){if(active)diagnostic(error.name==='AbortError'?'连接检查已取消；可修改地址后手动重试。':error.message);}
    finally{if(probeCtrl===current)probeCtrl=null;if(active)controls();}
  };
  const generate=async(manual=false)=>{
    if(manual&&(busy()||externalBusy||confirmation||probeCtrl))return;
    const pendingId=epoch;
    const source=buffer.source();if(!source){let cred;try{cred=credentials();}catch{}await failure(Error('没有已确认的转写，暂时无法生成纪要。可开始新录音。'),cred,epoch);return;}
    let cred;try{cred=credentials();}catch(error){message(error.message);return;}
    if(manual && !await consent(html`<h2>用保留的确认文字生成纪要？</h2><p>只调用 qwen3.8-flash，不重开 ASR 或麦克风；费用计入你的百炼账号，实际费用以账单为准。</p><div class="btn-row"><button class="secondary-action" data-sheet="cancel">取消</button><button class="primary-action" data-sheet="go">生成纪要</button></div>`))return;
    if(!active||pendingId!==epoch||externalBusy||(manual&&busy()))return;
    // Each summary attempt owns its callbacks, including retries on the same
    // transcript. A canceled earlier attempt cannot fail a later attempt.
    const id=++epoch,current=new AbortController();ctrl=current;update('summarizing');message('正在根据已确认原句整理；临时字幕未参与。');
    try{
      const stage={push(){return {update(){return this;}};}};
      const result=await runInBrowser(reg,sol,variant,cred,stage,{signal:current.signal,transcript:source});
      if(!active||id!==epoch||current.signal.aborted)return;
      update('complete');message('纪要已生成，可定位原句并修正负责人和期限。');showRecord(cred,result);
    }catch(error){await failure(error,cred,id);}
  };
  const finish=async()=>{
    if(!['recording','paused'].includes(state))return;
    const id=epoch,currentMic=mic,currentSession=session;update('finishing');message('正在收尾；等待模型确认最后一段文字，不会重开 ASR。');
    try{await currentMic.stop();await currentSession.finish();if(active&&id===epoch&&state==='finishing'){asrEnded=performance.now();buffer.partial='';draw();await generate();}}
    catch(error){let cred;try{cred=credentials();}catch{}await failure(error,cred,id);}
  };
  const begin=async()=>{
    if(busy()||externalBusy||confirmation||probeCtrl)return;
    let cred,target;try{cred=credentials();target=gatewayURL(field.value);}catch(error){message(error.message);return;}
    if(!await consent(html`<h2>开始实时录音？</h2><p>麦克风音频和你的百炼 Key 会经由 <strong>${new URL(target).host}</strong> 转发给 ${STREAM_MODEL}，结束后调用 qwen3.8-flash 生成纪要。请确认这是你信任的网关。费用计入你的百炼账号，当前总费用未知，以账单为准。</p><p class="small">最多录音 180 秒；暂停不发音频，长时间暂停可能使模型断线。停止等待或离开页面不保证取消已发出的计费请求。网关和真实接口仍待真 Key 验证。</p><div class="btn-row"><button class="secondary-action" data-sheet="cancel">取消</button><button class="primary-action" data-sheet="go">确认并开始</button></div>`))return;
    if(!active||externalBusy||busy())return;
    try{localStorage.setItem(GATEWAY_KEY,target);}catch{}
    const id=++epoch;buffer=new TranscriptBuffer();audits=[];mic=null;session=null;seconds=0;firstText=null;asrEnded=0;started=performance.now();startedAt=new Date().toISOString();ctrl=new AbortController();outcome.replaceChildren();root.querySelector('[data-rt-duration]').textContent='00:00 / 03:00';draw();update('connecting');message('请允许麦克风；模型任务就绪前不发送音频。');
    try{
      const acquired=await microphone({signal:ctrl.signal,onPCM:data=>{try{session.send(data);}catch(error){void failure(error,cred,id);}},onDuration:value=>{seconds=value;root.querySelector('[data-rt-duration]').textContent=`${timestamp(value*1000)} / 03:00`;},onLimit:()=>{message('已达到 180 秒上限，正在收尾。');void finish();},onError:error=>{void failure(error,cred,id);}});
      if(!active||id!==epoch||ctrl.signal.aborted){await acquired.discard();return;}mic=acquired;
      session=connectASR({url:target,values:cred.values,signal:ctrl.signal,onAudit:audit=>{audits=[{model:STREAM_MODEL,...audit}];},onSentence:value=>{buffer.accept({...value,text:redact(value.text,[cred.values.DASHSCOPE_API_KEY])});if(firstText===null&&value.text)firstText=performance.now()-started;draw();}});
      session.done.catch(error=>{if(['connecting','recording','paused'].includes(state))void failure(error,cred,id);});
      await session.ready;if(!active||id!==epoch||ctrl.signal.aborted)return;
      update('recording');message('已连接。临时字幕仅供预览，最终确认后才进入纪要。');mic.resume();
    }catch(error){await failure(error,cred,id);}
  };
  root.addEventListener('click',event=>{
    if(event.target.closest('[data-rt-probe]'))void diagnose();
    if(event.target.closest('[data-rt-probe-cancel]'))probeCtrl?.abort();
    if(event.target.closest('[data-rt-start]'))void begin();
    if(event.target.closest('[data-rt-pause]')){if(state==='recording'){mic.pause();if(state==='recording'){update('paused');message('已暂停，不发送音频；长时间暂停可能使模型断线。');}}else if(state==='paused'){mic.resume();if(state==='paused'){update('recording');message('已继续录音。');}}}
    if(event.target.closest('[data-rt-finish]'))void finish();
    if(event.target.closest('[data-rt-abort]')){let cred;try{cred=credentials();}catch{}void failure(new DOMException('已停止本机等待','AbortError'),cred,epoch);}
    if(event.target.closest('[data-rt-summary]'))void generate(true);
    if(event.target.closest('[data-rt-copy]')&&buffer.source())void copyText(transcriptText(buffer.source()));
    if(event.target.closest('[data-rt-download]')&&buffer.source())download('transcript.txt',transcriptText(buffer.source())+'\n','text/plain');
  });
  field.addEventListener('input',()=>{checklist();diagnostic('地址已更改，需要重新检查连接；检查不会发送 Key 或音频。');});
  field.addEventListener('change',()=>{try{if(!field.value.trim()){localStorage.removeItem(GATEWAY_KEY);return;}const target=gatewayURL(field.value);localStorage.setItem(GATEWAY_KEY,target);}catch(error){message(error.message);}});
  checklist();update('idle');if(field.value.trim())message('核对配置后可手动开始录音；开始前会确认网关、Key 去向和计费。');
  return {setExternalBusy(value){externalBusy=value;controls();},cleanup(){active=false;epoch++;confirmation?.close();probeCtrl?.abort();ctrl?.abort();session?.close();void mic?.discard();onBusy(false);}};
}
