import { validateTranscript, sentenceId } from '../meeting-evidence.js';
export const STREAM_MODEL = 'qwen-audio-3.1-asr-flash-streaming';
export function gatewayURL(value) {
  let url; try { url = new URL(String(value).trim()); } catch { throw Error('请填写完整的 wss:// 网关地址'); }
  const loopback = ['localhost','127.0.0.1'].includes(url.hostname);
  if(url.protocol==='ws:' && globalThis.location && !['localhost','127.0.0.1'].includes(globalThis.location.hostname))throw Error('公开页面请使用 wss:// 网关；ws:// 只供本机前端调试');
  if (!(url.protocol === 'wss:' || (url.protocol === 'ws:' && loopback)) || url.username || url.password || url.search || url.hash || url.pathname !== '/asr') throw Error('网关使用 wss://主机/asr；仅本机可用 ws://，地址不能包含凭证或查询参数');
  return url.href;
}

export class TranscriptBuffer {
  constructor() { this.confirmed = new Map(); this.partial = ''; }
  accept(value) {
    if (!value || typeof value.text !== 'string' || typeof value.final !== 'boolean' || !Number.isFinite(value.begin_ms) || value.begin_ms < 0 || !(value.end_ms === null || (Number.isFinite(value.end_ms) && value.end_ms >= value.begin_ms))) throw Error('实时转写格式无效；已确认内容会保留');
    if (!value.final) { this.partial = value.text; return; }
    const key = value.begin_ms;
    // A repeated final event may update its own sentence, never duplicate it.
    if (this.confirmed.has(key) && this.confirmed.get(key).text !== value.text.trim()) throw Error('模型改写已确认原句；原确认文字会保留，请核对');
    if (value.text.trim()) this.confirmed.set(key, {begin_ms:value.begin_ms,end_ms:value.end_ms,speaker:'发言标签未提供',text:value.text.trim()});
    this.partial = '';
  }
  source() {
    const sentences = [...this.confirmed.values()].sort((a,b)=>a.begin_ms-b.begin_ms).map((s,i)=>({id:sentenceId(i),...s}));
    return sentences.length ? validateTranscript({schema:'aihw/transcript@0.1',sentences}) : null;
  }
}

export function connectASR({url,values,signal,onSentence,onAudit,WebSocketImpl=WebSocket,timeoutMs=15000}) {
  const socket = new WebSocketImpl(gatewayURL(url));
  let ready = false, finished = false, closing = false, settled = false, taskId = '';
  let resolveReady, rejectReady, resolveDone, rejectDone;
  const opened = new Promise((resolve,reject)=>{resolveReady=resolve;rejectReady=reject;});
  const done = new Promise((resolve,reject)=>{resolveDone=resolve;rejectDone=reject;});
  // Callers may still be acquiring the microphone when an early failure arrives.
  done.catch(()=>{});
  let timer = setTimeout(()=>fail(Error('实时转写连接超时；不会自动重连')),timeoutMs);
  const clear = () => { clearTimeout(timer); signal?.removeEventListener('abort',abort); };
  const fail = error => { if(settled)return;settled=true;clear();rejectReady(error);rejectDone(error);socket.close(); };
  const abort = () => fail(new DOMException('已停止等待，已确认转写会保留','AbortError'));
  socket.onopen = () => { if(signal?.aborted)return abort();socket.send(JSON.stringify({type:'start',key:values.DASHSCOPE_API_KEY,region:values.DASHSCOPE_API_REGION,workspace:values.DASHSCOPE_WORKSPACE_ID || ''})); };
  socket.onmessage = ({data}) => {
    if(settled)return;
    try {
      const value=JSON.parse(data);
      if(value.type==='error')throw Error('实时转写未完成：'+(typeof value.message==='string'?value.message:'网关或模型响应异常'));
      if(value.type==='submitted'){if(taskId || typeof value.task_id!=='string')throw Error('实时任务状态无效');taskId=value.task_id;onAudit?.({requestId:taskId,usage:{known:false}});}
      else if(value.type==='ready') { if(ready || typeof value.task_id!=='string' || value.task_id!==taskId)throw Error('实时任务状态无效');ready=true;clearTimeout(timer);onAudit?.({requestId:taskId,usage:{known:false}});resolveReady(); }
      else if(value.type==='sentence') { if(!ready)throw Error('实时转写早于任务就绪');onSentence(value); }
      else if(value.type==='finished') { if(!ready || !closing)throw Error('实时任务提前结束');finished=true;settled=true;clear();onAudit?.({requestId:taskId,usage:{known:false,...(Number.isFinite(value.duration)&&value.duration>=0?{duration:value.duration}:{})}});resolveDone();socket.close(); }
      else throw Error('未知的实时转写消息');
    } catch(error) { fail(error); }
  };
  socket.onerror = () => fail(Error('无法连接实时网关；检查地址、HTTPS、来源白名单及网络，不会自动重连'));
  socket.onclose = () => { if(!finished)fail(Error('实时连接已断开；已确认转写会保留，不会自动重连')); };
  signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();
  return {
    ready:opened,done,
    send(buffer) {
      if(!ready || settled || closing)throw Error('实时会话尚未就绪或已经结束');
      if(socket.bufferedAmount>256*1024) { const error=Error('网络发送积压；已停止采集并保留确认文字');fail(error);throw error; }
      socket.send(buffer);
    },
    finish() { if(settled)return done;if(!ready)throw Error('实时任务尚未就绪');if(!closing){closing=true;timer=setTimeout(()=>fail(Error('等待最后一段转写超时；已确认内容会保留，请手动生成纪要')),timeoutMs);socket.send(JSON.stringify({type:'finish'}));}return done; },
    close:abort,
  };
}
