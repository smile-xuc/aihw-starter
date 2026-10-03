import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chat, costOf, ApiError, postJson } from '../js/live/client.js';
import { runInBrowser } from '../js/live/index.js';
import run02 from '../js/live/run-02-ai-glasses.js';
import run07 from '../js/live/run-07-recorder.js';
import run04 from '../js/live/run-04-agent-hardware.js';

const bytes = (...values) => Uint8Array.from(values).buffer;
const ascii = (s) => [...s].map((c) => c.charCodeAt(0));
const jpeg = bytes(255,216,255,224,0,16,74,70,73,70,0,255,217);
const png = bytes(137,80,78,71,13,10,26,10,0,0,0,13,...ascii('IHDR'),0,0,0,1,0,0,0,1,8,6,0,0,0,...Array(4).fill(0));
const webp = bytes(...ascii('RIFF'),16,0,0,0,...ascii('WEBPVP8 '),4,0,0,0,0,0,0,0);
const wav = bytes(...ascii('RIFF'),38,0,0,0,...ascii('WAVEfmt '),16,0,0,0,1,0,1,0,128,62,0,0,0,125,0,0,2,0,16,0,...ascii('data'),2,0,0,0,0,0);
const mp3 = bytes(255,251,144,0,...Array(413).fill(0));
const imageInput = (extra = {}) => ({kind:'image', buffer:png, mime:'image/png', name:'picture.png', question:'  这是什么？  ', ...extra});
const audioInput = (extra = {}) => ({kind:'audio', buffer:wav, mime:'audio/wav', format:'wav', name:'memo.wav', durationSeconds:55, ...extra});
const constants = async (id) => JSON.parse(await readFile(new URL(`../live-data/${id}.json`, import.meta.url)));
const turn = (text = '你好', extra = {}) => ({text, calls:[], usage:{prompt:10,completion:5,known:true},firstTextAt:130,firstCallAt:null,...extra});
const minutes = () => JSON.stringify({title:'会议',summary:'讨论计划',agenda:['计划'],decisions:[],action_items:[],open_questions:[],risks:[]});
const asr = (extra = {}) => ({output:{sentences:[{begin_time:0,end_time:55000,speaker_id:0,text:'讨论计划'}]},usage:{input_tokens:100,output_tokens:10},...extra});
function context(c, extra = {}) {
  let tick = 100;
  const events = [], payloads = [], assets = [];
  return {c,region:'cn-beijing',now:()=>tick += 10,events,payloads,assets,
    say:(tag,text,detail) => { const ev = {tag,text,detail, update(next) {Object.assign(this,next); return this;}}; events.push(ev); return ev; },
    asset:async (path) => {assets.push(path); return path.endsWith('.jpg') ? jpeg : mp3;},
    assetText:async (path) => {assets.push(path); return JSON.stringify({duration_ms:55000});},hasAsset:()=>true,
    chat:async (payload, opts) => {payloads.push(payload); const result = turn(); opts?.onText?.(result.text,result.text); return result;},
    post:async (...args) => {payloads.push(args); return {output:{audio:{url:'https://result.oss-cn-beijing.aliyuncs.com/audio.wav'}},usage:{characters:4}};},...extra};
}
const cred = {stack:{id:'fixture',auth:{header:'Authorization',value:'Bearer {KEY}'},endpoints:{roots:[{http:'https://dashscope.aliyuncs.com',when:{}}],services:[{id:'compatible',url:'{http}/compatible-mode/v1'},{id:'api',url:'{http}/api/v1'}]}},values:{KEY:'fixture-only',DASHSCOPE_API_REGION:'cn-beijing',DASHSCOPE_WORKSPACE_ID:'fixture'}};
const stream = (events) => new Response(events.map((event)=>`data: ${JSON.stringify(event)}\n\n`).join('')+'data: [DONE]\n\n',{headers:{'x-request-id':'request-header'}});
const withFetch = async (fn, work) => { const old = globalThis.fetch; globalThis.fetch = fn; try {return await work();} finally {globalThis.fetch = old;} };

test('input validation accepts real media headers and normalizes question', async () => {
  const mod = await import('../js/live/input.js').catch(()=>({}));
  assert.equal(typeof mod.validateInput,'function');
  for (const [buffer,mime,name] of [[jpeg,'image/jpeg','x.jpeg'],[png,'image/png','x.png'],[webp,'image/webp','x.webp']]) assert.equal(mod.validateInput(imageInput({buffer,mime,name})).question,'这是什么？');
  for (const [buffer,mime,format] of [[wav,'audio/wav','wav'],[mp3,'audio/mpeg','mp3']]) assert.equal(mod.validateInput(audioInput({buffer,mime,format,name:`x.${format}`})).format,format);
});
test('input validation rejects limits, empty bytes, fake MIME, extension and headers', async () => {
  const mod = await import('../js/live/input.js').catch(()=>({}));
  assert.equal(typeof mod.validateInput,'function');
  for (const input of [imageInput({buffer:bytes()}),imageInput({buffer:bytes(1,2,3)}),imageInput({buffer:new ArrayBuffer(7*1024*1024+1)}),imageInput({mime:'image/jpeg'}),imageInput({name:'x.jpg'}),imageInput({name:'png'}),imageInput({question:' '}),imageInput({question:'字'.repeat(2001)}),imageInput({buffer:new Uint8Array(png)}),audioInput({durationSeconds:181}),audioInput({durationSeconds:NaN}),audioInput({durationSeconds:0}),audioInput({mime:'audio/mpeg'}),audioInput({format:'mp3'}),audioInput({name:'x.mp3'}),audioInput({buffer:bytes(255,251,144,0),mime:'audio/mpeg',format:'mp3',name:'x.mp3'}),imageInput({buffer:bytes(137,80,78,71,13,10,26,10,0,0,0,13,...ascii('IHDR'),...Array(17).fill(0))}),audioInput({buffer:bytes(...ascii('RIFF'),36,0,0,0,...ascii('WAVEfmt '),16,0,0,0,1,0,1,0,128,62,0,0,0,125,0,0,2,0,16,0,...ascii('data'),0,0,0,0)}),audioInput({buffer:bytes(...ascii('RIFF'),0,0,0,0,...ascii('WAVE'))})]) assert.throws(()=>mod.validateInput(input),/[\u4e00-\u9fff]/);
});
test('chat retains complete zero usage, finish reason, request ids and no credential', async () => {
  await withFetch(async()=>stream([{id:'response-id',choices:[{delta:{content:'正常'},finish_reason:'stop'}]},{choices:[],usage:{prompt_tokens:0,completion_tokens:0}}]),async()=>{
    const result = await chat(cred,{model:'test',messages:[]});
    assert.equal(result.text,'正常'); assert.equal(result.usage.known,true); assert.equal(result.finish_reason,'stop'); assert.equal(result.requestId,'request-header'); assert.equal(result.id,'response-id'); assert.equal(costOf([[null,1,2]],result.usage),0); assert.ok(!JSON.stringify(result).includes('fixture-only'));
  });
});
test('chat missing or partial usage is unknown and costOf cannot manufacture zero', async () => {
  for (const usage of [undefined,{prompt_tokens:10},{prompt_tokens:null,completion_tokens:0}]) await withFetch(async()=>stream([{choices:[{delta:{content:'answer'}}],usage}]),async()=>{const result=await chat(cred,{});assert.equal(result.usage.known,false);assert.equal(costOf([[null,1,2]],result.usage),null);});
});
test('chat reports SSE provider errors and HTTP errors; cancellation propagates', async () => {
  await withFetch(async()=>stream([{error:{code:'bad',message:'provider failed'},request_id:'request-error'}]),async()=>assert.rejects(chat(cred,{}),(e)=>e instanceof ApiError && e.code==='bad' && e.requestId==='request-error'));
  await withFetch(async()=>new Response(JSON.stringify({code:'Denied',message:'拒绝',request_id:'id'}),{status:403}),async()=>assert.rejects(chat(cred,{}),(e)=>e.status===403 && e.requestId==='id'));
  const controller=new AbortController();controller.abort();
  await withFetch(async(_url,init)=>{init.signal.throwIfAborted();},async()=>assert.rejects(chat(cred,{}, {signal:controller.signal}),{name:'AbortError'}));
});
test('02 sends only custom image MIME and typed question, exposes answer and honest timings', async () => {
  const x=context(await constants('02-ai-glasses.bailian'),{input:imageInput()}); const result=await run02(x);
  const content=x.payloads[0].messages[0].content;assert.equal(content.length,2);assert.equal(content[0].image_url.url,`data:image/png;base64,${Buffer.from(png).toString('base64')}`);assert.equal(content[1].text,'这是什么？');assert.deepEqual(x.assets,[]);
  assert.equal(result.firstMs,result.metrics.textFirstMs);assert.equal(result.metrics.audioFirstMs,null);assert.ok(result.metrics.audioReadyMs >= 0);assert.ok(result.metrics.totalMs >= result.metrics.audioReadyMs);assert.equal(result.outputs[0].path,'out/answer.txt');assert.equal(result.outputs[0].text,'你好\n');assert.equal(result.outputs[0].media_type,'text/plain');assert.equal(result.costStatus,'usage');
});
test('02 bundled run still sends photo, audio and prompt', async()=>{const x=context(await constants('02-ai-glasses.bailian'));await run02(x);assert.equal(x.payloads[0].messages[0].content.length,3);assert.equal(x.assets.length,2);});
test('02 rejects empty answer and invalid input before requests', async()=>{let calls=0;const c=await constants('02-ai-glasses.bailian');await assert.rejects(run02(context(c,{chat:async()=>turn(' ')})),/回答.*空/);await assert.rejects(run02(context(c,{input:imageInput({question:''}),chat:async()=>{calls++;return turn();}})),/提问/);assert.equal(calls,0);});
test('02 preserves answer on TTS error, marks inferred chars estimated, rejects unsafe URL', async()=>{
  const c=await constants('02-ai-glasses.bailian');const result=await run02(context(c,{post:async()=>{throw new Error('TTS failure');}}));assert.equal(result.outputs[0].path,'out/answer.txt');assert.ok(result.warnings.some(w=>w.includes('TTS failure')));assert.equal(result.cost,null);assert.equal(result.costStatus,'unknown');
  const estimated=await run02(context(c,{post:async()=>({output:{audio:{url:'https://a.aliyuncs.com/x'}}})}));assert.equal(estimated.costStatus,'estimated');
  for (const url of ['http://a.aliyuncs.com/x','javascript:alert(1)','ftp://a.aliyuncs.com/x','https://secret@a.aliyuncs.com/x','https://aliyuncs.com.evil/x']) {const unsafe=await run02(context(c,{post:async()=>({output:{audio:{url}},usage:{characters:0}})}));assert.equal(unsafe.outputs.length,1);assert.ok(unsafe.warnings.length);}
  await assert.rejects(run02(context(c,{post:async()=>{throw new DOMException('cancel','AbortError');}})),{name:'AbortError'});
});
test('02 unavailable TTS keeps text and text-first metric', async()=>{const result=await run02(context(await constants('02-ai-glasses.bailian'),{region:'ap-southeast-1'}));assert.equal(result.outputs[0].path,'out/answer.txt');assert.equal(result.metrics.audioReadyMs,null);assert.ok(result.warnings.length);});
test('07 sends custom WAV/MP3 and duration without sample metadata', async()=>{
  const c=await constants('07-recorder.bailian');
  for (const input of [audioInput(),audioInput({buffer:mp3,mime:'audio/mpeg',format:'mp3',name:'new.mp3',durationSeconds:60})]) {const x=context(c,{input,post:async(...args)=>{x.payloads.push(args);return asr({usage:{}});},chat:async()=>turn(minutes())});const result=await run07(x);const p=x.payloads[0][2];assert.equal(p.parameters.format,input.format);if(input.format==='wav')assert.equal(p.parameters.sample_rate,"16000");assert.ok(p.input.messages[0].content[0].input_audio.data.startsWith(`data:${input.mime};base64,`));assert.deepEqual(x.assets,[]);assert.ok(result.sample.includes(String(input.durationSeconds)));assert.equal(result.costStatus,'estimated');assert.ok(result.cost[1]>0);assert.equal(result.metrics.audioFirstMs,null);assert.equal(result.metrics.asrMs,10);assert.ok(result.outputs.every(o=>o.media_type));}
});
test('07 bundled sample still uses metadata and MP3', async()=>{const x=context(await constants('07-recorder.bailian'),{post:async()=>asr(),chat:async()=>turn(minutes())});const result=await run07(x);assert.equal(x.assets.length,2);assert.ok(result.sample.includes('55'));});
test('07 rejects empty/malformed transcript and minutes with accessible partial transcript', async()=>{
  const c=await constants('07-recorder.bailian');for (const output of [{sentences:[]},{sentences:{}},{sentences:[null]}]) await assert.rejects(run07(context(c,{post:async()=>asr({output}),chat:async()=>turn(minutes())})),/转写/);
  for(const text of ['','{}','not json',JSON.stringify({title:'x',summary:'s',agenda:{},decisions:[],action_items:[],open_questions:[],risks:[]}),JSON.stringify({title:'x',summary:'s',agenda:[],decisions:[null],action_items:[],open_questions:[],risks:[]})]) await assert.rejects(run07(context(c,{post:async()=>asr(),chat:async()=>turn(text)})),(e)=>e.message.includes('纪要') && e.outputs?.some(o=>o.path==='out/transcript.txt'));
  await assert.rejects(run07(context(c,{post:async()=>asr(),chat:async()=>{throw new Error('provider unavailable');}})),(e)=>e.outputs?.[0].text.includes('讨论计划'));
});
test('07 truncation warnings and known zero ASR usage are retained', async()=>{
  const c=await constants('07-recorder.bailian');const result=await run07(context(c,{input:audioInput({durationSeconds:100}),post:async()=>asr({usage:{input_tokens:0,output_tokens:0}}),chat:async()=>turn(minutes(),{finish_reason:'length',usage:{prompt:10,completion:1000,known:true}})}));assert.equal(result.costStatus,'usage');assert.ok(result.warnings.some(w=>/转写.*不完整/.test(w)));assert.ok(result.warnings.some(w=>/纪要.*截断/.test(w)));assert.equal(result.firstMs,result.metrics.textFirstMs);
});

test('wrapper marks missing chat usage unknown across all six runners without breaking completion', async()=>{
  const ids=['01-ipc','02-ai-glasses','04-agent-hardware','07-recorder','08-smart-watch','09-embodied'];
  for(const id of ids){const full=`${id}.bailian`;const c=await constants(full);const reg={root:new URL('../data/',import.meta.url)};const sol={id:full,samples:[]};const fetcher=async(url,init)=>{
    const path=String(url);if(path.includes('/live-data/'))return Response.json(c);
    if(path.includes('/chat/completions')){let text='完成 ¥9';if(id==='01-ipc'){const payload=JSON.parse(init.body);text=payload.response_format?JSON.stringify({title:'event',objects:[],actions:[],matches:[],answer:'ok'}):'daily';}if(id==='07-recorder')text=minutes();if(id==='08-smart-watch')text=JSON.stringify({summary:'平稳',alerts:[],advice:[]});return stream([{choices:[{delta:{content:text},finish_reason:'stop'}]}]);}
    if(path.includes('/api/v1/'))return Response.json(id==='02-ai-glasses'?{output:{audio:{url:'https://a.aliyuncs.com/x'}},usage:{characters:2}}:id==='07-recorder'?asr():{output:{text:'请说你好'},usage:{input_tokens:1,output_tokens:1}});
    if(path.endsWith('.json')){if(id==='01-ipc')return Response.json({now:'2026-10-03 12:00',frames:[{file:'x.jpg',time:'2026-10-03 12:00',camera:'front',trigger:'test'}]});if(id==='08-smart-watch')return Response.json(Object.fromEntries(c.FIELDS.map(k=>[k,70])));return Response.json({duration_ms:55000});}
    return new Response(jpeg);
  };await withFetch(fetcher,async()=>{const events=[];const result=await runInBrowser(reg,sol,{id:'default'},cred,{push:(event)=>{events.push(event);return {update(){return this;}};}});assert.equal(result.cost,null,full);assert.equal(result.costStatus,'unknown',full);assert.ok(result.metrics.totalMs>=0);assert.ok(result.warnings.length);assert.ok(result.outputs.every(o=>o.media_type));assert.ok(events.filter(e=>e.tag==='统计' && !e.text.includes('不上云')).every(e=>!/¥[0-9]/.test(e.text)),full);if(id==='09-embodied')assert.ok(events.filter(e=>e.tag==='机械臂' && e.text==='完成 ¥9').length>=2);});}
});
test('wrapper validates input before network, passes custom image and records known usage', async()=>{
  const c=await constants('02-ai-glasses.bailian');let requests=0;const reg={root:new URL('../data/',import.meta.url)},sol={id:'02-ai-glasses.bailian',samples:[]},stage={push:()=>({update(){return this;}})};
  await withFetch(async()=>{requests++;throw new Error('must not fetch');},async()=>assert.rejects(runInBrowser(reg,sol,{id:'default'},cred,stage,{input:imageInput({buffer:bytes()})}),/图片/));assert.equal(requests,0);
  await withFetch(async(url,init)=>{if(String(url).includes('live-data'))return Response.json(c);if(String(url).includes('chat/completions')){const payload=JSON.parse(init.body);assert.equal(payload.messages[0].content.length,2);return stream([{choices:[{delta:{content:'answer'}}],usage:{prompt_tokens:0,completion_tokens:0}}]);}return Response.json({output:{audio:{url:'https://a.aliyuncs.com/x'}},usage:{characters:0}});},async()=>{const result=await runInBrowser(reg,sol,{id:'default'},cred,stage,{input:imageInput()});assert.equal(result.cost,0);assert.equal(result.costStatus,'usage');assert.equal(result.usageRecords.length,2);assert.equal(result.usageRecords[0].usage.known,true);assert.equal(result.usageRecords[1].usage.characters,0);assert.ok(!JSON.stringify(result.usageRecords).includes('fixture-only'));});
});

test('chat reads fragmented UTF-8 SSE with final line', async()=>{
  const encoded=new TextEncoder().encode('data: {"choices":[{"delta":{"content":"中文"},"finish_reason":"length"}]}\r\n\r\ndata: {"choices":[],"usage":{"prompt_tokens":2,"completion_tokens":3}}');
  let cancelled=false;
  await withFetch(async()=>new Response(new ReadableStream({start(controller){for(let i=0;i<encoded.length;i+=7)controller.enqueue(encoded.slice(i,i+7));controller.close();},cancel(){cancelled=true;}})),async()=>{const result=await chat(cred,{});assert.equal(result.text,'中文');assert.equal(result.usage.known,true);assert.equal(result.finish_reason,'length');});
  assert.equal(cancelled,false);
});
test('chat releases reader when stream cancellation rejects read',async()=>{
  let unlocked=false;
  const body=new ReadableStream({start(controller){controller.error(new DOMException('cancelled read','AbortError'));}});
  await withFetch(async()=>({ok:true,headers:new Headers(),body}),async()=>assert.rejects(chat(cred,{}),{name:'AbortError'}));unlocked=!body.locked;assert.equal(unlocked,true);
});
test('07 unknown ASR duration cannot create an exact zero estimate',async()=>{
  const x=context(await constants('07-recorder.bailian'),{hasAsset:()=>false,post:async()=>asr({usage:{}}),chat:async()=>turn(minutes())});const result=await run07(x);assert.equal(result.cost,null);assert.equal(result.costStatus,'unknown');assert.ok(result.warnings.some(w=>w.includes('时长未知')));
});
test('07 records truncation warnings even when partial minutes JSON fails',async()=>{
  await assert.rejects(run07(context(await constants('07-recorder.bailian'),{post:async()=>asr(),chat:async()=>turn('{',{finish_reason:'length',usage:{prompt:1,completion:1000,known:true}})})),e=>e.outputs?.length===1 && e.warnings?.some(w=>/纪要.*截断/.test(w)));
});
test('07 invalid custom recording fails before provider calls, zero ending warns incomplete',async()=>{
  let calls=0;const c=await constants('07-recorder.bailian');await assert.rejects(run07(context(c,{input:audioInput({durationSeconds:Infinity}),post:async()=>{calls++;return asr();}})),/时长/);assert.equal(calls,0);
  const result=await run07(context(c,{input:audioInput(),post:async()=>asr({output:{sentences:[{begin_time:0,end_time:0,text:'文字'}]}}),chat:async()=>turn(minutes())}));assert.ok(result.warnings.some(w=>/转写.*不完整/.test(w)));
});
test('07 long complete minutes have no ASR token-limit warning',async()=>{const result=await run07(context(await constants('07-recorder.bailian'),{post:async()=>asr(),chat:async()=>turn(minutes(),{finish_reason:'stop',usage:{prompt:5,completion:1200,known:true}})}));assert.ok(!result.warnings.some(w=>/纪要.*截断/.test(w)));});
test('postJson retains provider request-id header without credentials',async()=>{await withFetch(async()=>Response.json({output:{text:'ok'},usage:{input_tokens:0,output_tokens:0}},{headers:{'x-request-id':'post-request'}}),async()=>{const result=await postJson(cred,'api','/fixture',{});assert.equal(result.request_id,'post-request');assert.ok(!JSON.stringify(result).includes('fixture-only'));});});
test('wrapper error retains request ids and numeric-only usage evidence',async()=>{
  const c=await constants('07-recorder.bailian'),reg={root:new URL('../data/',import.meta.url)},sol={id:'07-recorder.bailian',samples:[]},stage={push:()=>({update(){return this;}})};
  await withFetch(async(url)=>{if(String(url).includes('live-data'))return Response.json(c);if(String(url).includes('chat/completions'))return stream([{request_id:'llm-id',choices:[{delta:{content:'{}'}}],usage:{prompt_tokens:3,completion_tokens:2,secret:'fixture-only'}}]);return Response.json(asr({request_id:'asr-id',usage:{input_tokens:0,output_tokens:0,duration:55,secret:'fixture-only'}}));},async()=>assert.rejects(runInBrowser(reg,sol,{id:'default'},cred,stage,{input:audioInput()}),e=>e.usageRecords?.length===2 && e.usageRecords[0].requestId==='asr-id' && e.usageRecords[1].requestId==='llm-id' && e.usageRecords[0].usage.input_tokens===0 && !JSON.stringify(e.usageRecords).includes('fixture-only')));
});

async function agentUsageFixture(usage, sample = wav) {
  const c=await constants('04-agent-hardware.bailian');const reg={root:new URL('../data/',import.meta.url)},sol={id:'04-agent-hardware.bailian',samples:[]};const events=[];
  return withFetch(async(url)=>{const path=String(url);if(path.includes('live-data'))return Response.json(c);if(path.includes('chat/completions'))return stream([{choices:[{delta:{content:'已完成'}}],usage:{prompt_tokens:0,completion_tokens:0}}]);if(path.includes('api/v1'))return Response.json({output:{text:'请说你好'},usage});return new Response(sample);},async()=>{const result=await runInBrowser(reg,sol,{id:'default'},cred,{push:event=>{events.push(event);return {update(){return this;}};}});return {result,events};});
}
test('04 absent and partial ASR usage with complete chat usage stays estimated from valid WAV duration',async()=>{
  for(const usage of [{},{input_tokens:1},{input_tokens:1,output_tokens:2,duration:NaN},{duration:4}]){const {result,events}=await agentUsageFixture(usage);if(usage.input_tokens===1 && usage.output_tokens===2){assert.equal(result.costStatus,'usage');continue;}assert.equal(result.costStatus,'estimated');assert.ok(result.cost>0);assert.equal(result.usageRecords.find(r=>r.model.includes('asr')).usage.known,false);assert.ok(events.some(e=>e.tag==='统计' && e.text.includes('估算')));}
});
test('04 valid zero ASR counts remain exact zero rather than inferred transcript charges',async()=>{const {result}=await agentUsageFixture({input_tokens:0,output_tokens:0,duration:5});assert.equal(result.costStatus,'usage');assert.equal(result.cost,0);});
test('04 missing or partial ASR usage without defensible duration is unknown',async()=>{
  for(const usage of [{},{input_tokens:1},{input_tokens:1,output_tokens:null},{duration:0},{duration:-2}]){const {result,events}=await agentUsageFixture(usage,jpeg);assert.equal(result.costStatus,'unknown');assert.equal(result.cost,null);assert.ok(result.warnings.length);assert.ok(events.filter(e=>e.tag==='统计'&&!e.text.includes('不上云')).every(e=>!/¥[0-9]/.test(e.text)));}
});
test('wrapper preserves explicit 02 TTS and 07 ASR estimates with complete chat usage',async()=>{
  for(const [id,input] of [['02-ai-glasses',imageInput()],['07-recorder',audioInput()]]){const c=await constants(`${id}.bailian`),reg={root:new URL('../data/',import.meta.url)},sol={id:`${id}.bailian`,samples:[]};await withFetch(async(url)=>{const path=String(url);if(path.includes('live-data'))return Response.json(c);if(path.includes('chat/completions'))return stream([{choices:[{delta:{content:id==='07-recorder'?minutes():'回答'}}],usage:{prompt_tokens:0,completion_tokens:0}}]);return Response.json(id==='02-ai-glasses'?{output:{audio:{url:'https://a.aliyuncs.com/x'}},usage:{}}:asr({usage:{}}));},async()=>{const result=await runInBrowser(reg,sol,{id:'default'},cred,{push:()=>({update(){return this;}})},{input});assert.equal(result.costStatus,'estimated');assert.notEqual(result.cost,null);});}
});
const malformedSentences = [
  ['object text',{text:{unexpected:'object'},begin_time:'bad',end_time:'bad'}],
  ['numeric text',{text:123,begin_time:0,end_time:1}],
  ['null text',{text:null,begin_time:0,end_time:1}],
  ['string begin',{text:'句子',begin_time:'1',end_time:2}],
  ['NaN begin',{text:'句子',begin_time:NaN,end_time:2}],
  ['infinite end',{text:'句子',begin_time:0,end_time:Infinity}],
  ['negative begin',{text:'句子',begin_time:-1,end_time:2}],
  ['negative end',{text:'句子',begin_time:0,end_time:-1}],
  ['reversed times',{text:'句子',begin_time:2,end_time:1}],
  ['object speaker',{text:'句子',begin_time:0,end_time:1,speaker_id:{}}],
  ['negative speaker',{text:'句子',begin_time:0,end_time:1,speaker_id:-1}],
  ['nonfinite speaker',{text:'句子',begin_time:0,end_time:1,speaker_id:NaN}],
  ['fractional speaker',{text:'句子',begin_time:0,end_time:1,speaker_id:1.5}],
];
for(const [name,sentence] of malformedSentences)test(`07 rejects malformed sentence ${name} before minutes request`,async()=>{
  let calls=0;const x=context(await constants('07-recorder.bailian'),{post:async()=>asr({output:{sentences:[sentence]}}),chat:async()=>{calls++;return turn(minutes());}});await assert.rejects(run07(x),/转写.*(文字|时间|说话人|句子)/);assert.equal(calls,0);
});
test('07 optional omitted sentence timestamps and speaker stay supported',async()=>{const result=await run07(context(await constants('07-recorder.bailian'),{post:async()=>asr({output:{sentences:[{text:'仅有文字'}]}}),chat:async()=>turn(minutes())}));assert.ok(result.outputs.find(o=>o.path==='out/transcript.txt').text.includes('[00:00] 说话人：仅有文字'));});
test('04 audio routed to local rules still includes incurred ASR estimate',async()=>{const c={...await constants('04-agent-hardware.bailian'),DEFAULT_SESSION:[['audio','samples/local.wav']]};const result=await run04(context(c,{asset:async()=>wav,post:async()=>({output:{text:'客厅开灯'},usage:{}})}));assert.equal(result.costStatus,'estimated');assert.ok(result.cost>0);});
test('04 empty transcription rejects after billed ASR and retains usage evidence',async()=>{
  const c=await constants('04-agent-hardware.bailian'),reg={root:new URL('../data/',import.meta.url)},sol={id:'04-agent-hardware.bailian',samples:[]};let chatRequests=0;
  await withFetch(async(url)=>{const path=String(url);if(path.includes('live-data'))return Response.json(c);if(path.includes('chat/completions')){chatRequests++;return stream([{choices:[{delta:{content:'已完成'}}],usage:{prompt_tokens:0,completion_tokens:0}}]);}if(path.includes('api/v1'))return Response.json({request_id:'empty-asr',output:{text:'   '},usage:{input_tokens:10,output_tokens:5}});return new Response(wav);},async()=>assert.rejects(runInBrowser(reg,sol,{id:'default'},cred,{push:()=>({update(){return this;}})}),e=>/转写结果为空/.test(e.message) && e.usageRecords?.some(record=>record.requestId==='empty-asr' && record.usage.input_tokens===10 && record.usage.output_tokens===5 && record.usage.known===true)));
  assert.equal(chatRequests,0);
});

test('02 complete long stop answer is not truncated; length finish still warns',async()=>{
  const c=await constants('02-ai-glasses.bailian');
  for(const finish_reason of ['stop','length']) {
    const result=await run02(context(c,{input:imageInput(),chat:async()=>turn('完整长回答',{finish_reason,usage:{prompt:5,completion:1200,known:true}})}));
    assert.equal(result.warnings.some(w=>/看图回答.*截断/.test(w)),finish_reason==='length');
  }
});
