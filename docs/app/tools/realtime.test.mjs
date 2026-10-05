import test from 'node:test';
import assert from 'node:assert/strict';
import {PCMResampler} from '../js/live/pcm.js';
import {gatewayURL,probeGateway,STREAM_MODEL,TranscriptBuffer,connectASR} from '../js/live/realtime-asr.js';
const sentence=(text,final=true,begin=0,end=1000)=>({text,final,begin_ms:begin,end_ms:end});
test('PCM resampling retains phase across chunks and emits mono little-endian clipped samples',()=>{
  for(const rate of [16000,44100,48000]){
    const encoder=new PCMResampler(rate);let bytes=0;
    for(let i=0;i<rate;i+=128)bytes+=encoder.push(new Float32Array(Math.min(128,rate-i)).fill(.5)).byteLength;
    assert.ok(Math.abs(bytes-32000)<=2,rate+' sample count');
  }
  const view=new DataView(new PCMResampler(16000).push([2,-2,NaN]));assert.deepEqual([0,2,4].map(i=>view.getInt16(i,true)),[32767,-32768,0]);
  assert.throws(()=>new PCMResampler(8000));
});
test('gateway addresses reject keys, arbitrary insecure destinations and other paths',()=>{
  assert.equal(gatewayURL(' wss://example.org/asr '),'wss://example.org/asr');assert.match(gatewayURL('ws://127.0.0.1:8766/asr'),/^ws:/);
  for(const url of ['https://example.org/asr','ws://example.org/asr','wss://key@example.org/asr','wss://example.org/asr?key=x','wss://example.org/asr#x','wss://example.org/other'])assert.throws(()=>gatewayURL(url));
});
test('only final sentences enter evidence, duplicate finals stay unique and confirmed text cannot be overwritten',()=>{
  const buffer=new TranscriptBuffer();buffer.accept(sentence('临时',false,0,null));assert.equal(buffer.source(),null);assert.equal(buffer.partial,'临时');
  buffer.accept(sentence('确认'));buffer.accept(sentence('确认'));assert.equal(buffer.source().sentences.length,1);
  buffer.accept(sentence('末句',true,1200,1800));assert.deepEqual(buffer.source().sentences.map(s=>s.id),['s001','s002']);assert.equal(buffer.source().sentences[0].speaker,'发言标签未提供');
  assert.throws(()=>buffer.accept(sentence('改写')));assert.equal(buffer.source().sentences[0].text,'确认');
  for(const s of [{text:'x'},sentence('x',true,-1),sentence('x',true,20,10)])assert.throws(()=>buffer.accept(s));
});
class Socket {
  constructor(url){this.url=url;this.sent=[];this.bufferedAmount=0;Socket.last=this;}
  send(value){this.sent.push(value);}close(){this.closed=true;}
  event(value){this.onmessage({data:JSON.stringify(value)});}
}
function connection(options={}){return connectASR({url:'wss://example.org/asr',values:{DASHSCOPE_API_KEY:'test-key',DASHSCOPE_API_REGION:'cn-beijing'},WebSocketImpl:Socket,onSentence(){},...options});}
function ready(){const s=Socket.last;s.onopen();s.event({type:'submitted',task_id:'test-task'});s.event({type:'ready',task_id:'test-task'});return s;}
test('BYOK stays out of the address; ready gates PCM and finish waits for the last final event',async()=>{
  const frames=[],audits=[],c=connection({onSentence:value=>frames.push(value),onAudit:value=>audits.push(value)}),socket=Socket.last;
  assert.throws(()=>c.send(new ArrayBuffer(2)));ready();await c.ready;assert.equal(socket.url,'wss://example.org/asr');assert.equal(JSON.parse(socket.sent[0]).key,'test-key');
  c.send(new ArrayBuffer(2));const done=c.finish();assert.equal(JSON.parse(socket.sent.at(-1)).type,'finish');
  socket.event({type:'sentence',...sentence('结束前最后一句')});socket.event({type:'finished',duration:1});await done;assert.equal(frames[0].text,'结束前最后一句');assert.equal(socket.closed,true);assert.equal(audits.at(-1).usage.known,false);
});
test('disconnect and send backlog reject once and never create a replacement socket',async()=>{
  const c=connection();const socket=ready();await c.ready;socket.bufferedAmount=300000;assert.throws(()=>c.send(new ArrayBuffer(2)),/积压/);await assert.rejects(c.done,/积压/);assert.equal(Socket.last,socket);
  const d=connection();const second=ready();await d.ready;second.onclose();await assert.rejects(d.done,/断开/);assert.equal(Socket.last,second);
});
test('early task finish is rejected and the tail timeout preserves external confirmed data',async()=>{
  const c=connection({timeoutMs:20});const socket=ready();await c.ready;socket.event({type:'finished'});await assert.rejects(c.done,/提前结束/);
  const d=connection({timeoutMs:20});ready();await d.ready;await assert.rejects(d.finish(),/最后一段转写超时/);
  let accepted=false;const e=connection({onSentence(){accepted=true;}});const malformed=ready();await e.ready;malformed.event({type:'sentence',text:['invalid'],begin_ms:0,end_ms:1000,final:true});await assert.rejects(e.done,/文字格式无效/);assert.equal(accepted,false);
});
test('abort rejects both pending operations and closes the current socket',async()=>{
  const ctrl=new AbortController(),c=connection({signal:ctrl.signal});const opened=assert.rejects(c.ready,{name:'AbortError'}),done=assert.rejects(c.done,{name:'AbortError'});ctrl.abort();await Promise.all([opened,done]);assert.equal(Socket.last.closed,true);
});
const capabilities={type:'probe',service:'aihw-byok-asr',protocol:1,model:STREAM_MODEL,max_seconds:180};
const probe=(options={})=>probeGateway({url:'wss://example.org/asr',WebSocketImpl:Socket,...options});
test('connection probe sends only a probe and accepts compatible metadata without echoing extras',async()=>{
  const result=probe(),socket=Socket.last;socket.onopen();assert.deepEqual(socket.sent,['{"type":"probe"}']);
  socket.event({...capabilities,unexpected:'test-key'});assert.deepEqual(await result,{service:capabilities.service,protocol:1,model:STREAM_MODEL,max_seconds:180});assert.equal(socket.closed,true);
  socket.onopen();assert.equal(socket.sent.length,1);
});
test('probe rejects wrong service/model/protocol, early close, network failure and timeout with no retry',async()=>{
  for(const value of [{...capabilities,model:'other'},{...capabilities,protocol:2},{...capabilities,max_seconds:300},{type:'error',message:'test-key'},{type:'ready'}]){
    const result=probe(),socket=Socket.last;socket.onopen();socket.event(value);await assert.rejects(result,error=>/兼容/.test(error.message)&&!error.message.includes('test-key'));assert.equal(socket.closed,true);assert.equal(socket.sent.length,1);
  }
  const closed=probe();Socket.last.onclose();await assert.rejects(closed,/断开/);
  const failed=probe();Socket.last.onerror();await assert.rejects(failed,/白名单/);
  const timeout=probe({timeoutMs:10}),socket=Socket.last;await assert.rejects(timeout,/及时响应/);assert.equal(Socket.last,socket);assert.equal(socket.closed,true);assert.deepEqual(socket.sent,[]);
});
test('probe cancellation closes its socket and pre-abort opens no connection',async()=>{
  const ctrl=new AbortController(),result=probe({signal:ctrl.signal}),socket=Socket.last;ctrl.abort();await assert.rejects(result,{name:'AbortError'});assert.equal(socket.closed,true);socket.onopen();assert.deepEqual(socket.sent,[]);
  await assert.rejects(probe({signal:ctrl.signal}),{name:'AbortError'});assert.equal(Socket.last,socket);
});
test('a canceled ASR connection never sends a late start message',async()=>{
  const ctrl=new AbortController(),c=connection({signal:ctrl.signal}),socket=Socket.last;
  ctrl.abort();await assert.rejects(c.ready,{name:'AbortError'});await assert.rejects(c.done,{name:'AbortError'});socket.onopen();assert.deepEqual(socket.sent,[]);
});
