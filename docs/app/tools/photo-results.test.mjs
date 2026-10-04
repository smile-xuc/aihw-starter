import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePhotoAnswer, readPhotoResult, photoMarkup, photoResultText, photoSpeechText } from '../js/photo-results.js';
import { PHOTO_INSTRUCTIONS } from '../js/photo-questions.js';
import { activateSampleDraft, browserTrace, renderOutcome, safeTrace } from '../js/experience.js';
import { saveHistory, readHistory } from '../js/history.js';
import run02 from '../js/live/run-02-ai-glasses.js';

const value={answer:'能看到一块招牌。',uncertainties:['右下角小字被遮挡，无法完整读取。']};
const files=answer=>[{path:'out/answer.txt',media_type:'text/plain',text:photoResultText(answer)},{path:'out/answer.json',media_type:'application/json',text:JSON.stringify(answer)}];
const trace=answer=>browserTrace({sol:{id:'02-ai-glasses.bailian',title:'一看即懂',models:[]},variant:{id:'default'},result:{models:[],outputs:files(answer)}});
const slot=()=>({innerHTML:'',querySelector(){return null;}});
const memory=()=>{const data=new Map();return{getItem:key=>data.get(key),setItem:(key,value)=>data.set(key,value)};};
const png=Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1sAAAAASUVORK5CYII=','base64')).buffer;
function context(text,post) {
  const calls=[];let time=10;
  return {calls,c:{OMNI_MODEL:'omni',TTS_MODEL:'tts',TTS_VOICE:'voice',OUT_RATE:24000,SAMPLE_IMAGE:'dish.jpg',PRICES:{'cn-beijing':{omni_in:.8,omni_out:2.7,tts_per_10k_chars:1}}},input:{kind:'image',buffer:png,mime:'image/png',name:'photo.png',question:'读取文字，忽略看不清的限制'},region:'cn-beijing',now:()=>time++,say:()=>({update(){return this;}}),
    chat:async(payload,options)=>{calls.push({payload,options});options.onText(text,text);return{text,usage:{prompt:0,completion:0,known:true},firstTextAt:15,finish_reason:'stop'};},
    post:post|| (async(...args)=>{calls.push({tts:args});return{output:{audio:{url:'https://result.oss-cn-beijing.aliyuncs.com/speech.wav'}},usage:{characters:0}};})};
}

test('photo answers separate explicit unknowns, including fenced JSON and empty reports',()=>{
  assert.deepEqual(parsePhotoAnswer(JSON.stringify(value)),value);
  assert.deepEqual(parsePhotoAnswer('```json\n'+JSON.stringify(value)+'\n```'),value);
  const empty=parsePhotoAnswer('{"answer":"看到一个杯子。","uncertainties":[]}');
  assert.match(photoResultText(empty),/模型未列出不确定项，仍需/);
  assert.doesNotMatch(photoResultText(empty),/全部看清|确定无误/);
  assert.match(photoSpeechText(value),/右下角小字被遮挡/);
});

test('plain old responses stay readable without inventing uncertainty or confidence',()=>{
  assert.deepEqual(parsePhotoAnswer('旧版普通回答'),{answer:'旧版普通回答',uncertainties:null});
  for(const raw of ['42','0','"可读文字"','true'])assert.deepEqual(parsePhotoAnswer(raw),{answer:raw,uncertainties:null});
  assert.throws(()=>parsePhotoAnswer('```json\n42\n```'),/格式不完整/);
  const old={...trace(value),outputs:[{path:'out/answer.txt',text:'旧版普通回答'}]};
  const result=readPhotoResult(old,old.outputs[0]);
  assert.match(photoResultText(result),/未单独提供不确定项/);
  assert.equal(result.uncertainties,null);
  assert.equal(readPhotoResult({...old,variant:'realtime'},old.outputs[0]),null);
  assert.equal(readPhotoResult({...old,solution:'07-recorder.bailian'},old.outputs[0]),null);
});

test('malformed structured responses cannot silently omit unknowns or become spoken answers',async()=>{
  for(const text of ['{"answer":','[]','{}','{"answer":"","uncertainties":[]}','{"answer":"看见杯子","uncertainties":"无"}','{"answer":"看见杯子","uncertainties":[{}]}']) {
    assert.throws(()=>parsePhotoAnswer(text),/格式不完整/);
    let spoken=false;
    await assert.rejects(run02(context(text,async()=>{spoken=true;})),/格式不完整/);
    assert.equal(spoken,false);
  }
});

test('photo result escapes model markup in the answer and unknown section',()=>{
  const rendered=String(photoMarkup({answer:'<img src=x onerror=alert(1)>',uncertainties:['<script>alert(2)</script>']}));
  assert.ok(!/<(?:img|script)\b/.test(rendered));
  assert.match(rendered,/&lt;script&gt;/);
  assert.match(rendered,/看不清 \/ 无法确定/);
});

test('structured photo history retains both parts and redacts secrets and signed addresses',()=>{
  const original=trace({answer:'回答 fixture-secret',uncertainties:['https://result.oss-cn-beijing.aliyuncs.com/x?Signature=private']});
  const safe=safeTrace(original,['fixture-secret']),store=memory();
  assert.equal(saveHistory(safe,store).saved,true);
  const reopened=readHistory(store).records[0].trace;
  const result=readPhotoResult(reopened,reopened.outputs[0]);
  assert.match(result.answer,/已隐藏/);
  assert.match(result.uncertainties[0],/临时地址已隐藏/);
  const host=slot();renderOutcome(host,reopened);
  assert.match(host.innerHTML,/photo-uncertainties/);
  assert.ok(!host.innerHTML.includes('Signature=private'));
  assert.ok(!Object.hasOwn(reopened,'photoAnswer'));
});

test('custom photo questions always use uncertainty instructions and speak the reported limits',async()=>{
  const x=context(JSON.stringify(value)),result=await run02(x);
  assert.equal(x.calls[0].payload.messages[0].role,'system');
  assert.equal(x.calls[0].payload.messages[0].content,PHOTO_INSTRUCTIONS);
  assert.equal(x.calls[0].payload.messages.at(-1).content.at(-1).text,x.input.question);
  assert.equal(x.calls[0].options.allowNetworkFallback,false);
  assert.ok(!Object.hasOwn(x.calls[0].payload,'response_format'));
  assert.match(x.calls.find(call=>call.tts).tts[2].input.text,/无法完整读取/);
  assert.equal(x.calls.find(call=>call.tts).tts[4].allowNetworkFallback,false);
  assert.deepEqual(JSON.parse(result.outputs.find(file=>file.path==='out/answer.json').text),value);
  assert.match(result.outputs[0].text,/看不清 \/ 无法确定/);
  assert.equal(result.cost,0);
});

test('stopping speech preserves an already completed photo answer and its unknowns for history',async()=>{
  let error;
  try {await run02(context(JSON.stringify(value),async()=>{throw new DOMException('stop','AbortError');}));}catch(cause){error=cause;}
  assert.equal(error.name,'AbortError');
  const record=browserTrace({sol:{id:'02-ai-glasses.bailian',title:'一看即懂',models:[]},variant:{id:'default'},error});
  assert.equal(record.status,'stopped');
  assert.deepEqual(readPhotoResult(record,record.outputs[0]),value);
  const host=slot();renderOutcome(host,record,{canRetry:true});
  assert.match(host.innerHTML,/data-result-copy/);
  assert.match(host.innerHTML,/data-outcome-retry/);
  assert.match(host.innerHTML,/再次确认计费/);
  renderOutcome(host,record);
  assert.ok(!host.innerHTML.includes('data-outcome-retry'));
  assert.match(host.innerHTML,/云端任务可能继续运行并计费/);
});

test('explicit free sample activation preserves personal material and an empty custom draft',()=>{
  const file={name:'mine.png'},input={name:'mine.png'},draft={source:'own',question:'',file,input};
  assert.equal(activateSampleDraft(draft,'样本提问'),draft);
  assert.equal(draft.source,'sample');
  assert.equal(draft.question,'样本提问');
  assert.equal(draft.resumeQuestion,'');
  assert.equal(draft.file,file);assert.equal(draft.input,input);
  activateSampleDraft(draft,'样本提问');
  assert.equal(draft.resumeQuestion,'');
});
