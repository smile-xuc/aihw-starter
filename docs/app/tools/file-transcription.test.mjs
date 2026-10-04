import test from 'node:test';
import assert from 'node:assert/strict';
import { transcribeFile } from '../js/live/file-transcription.js';

const MODEL = 'qwen-audio-3.1-asr-flash-filetrans';
const API = 'https://dashscope.aliyuncs.com/api/v1';
const UPLOAD = 'https://upload-fixture.oss-cn-beijing.aliyuncs.com/';
const RESULT = 'https://result-fixture.oss-cn-beijing.aliyuncs.com/result.json?Signature=private-signature';
const cred = {
  stack: { id:'filetrans-fixture', auth:{header:'Authorization',value:'Bearer {KEY}'}, endpoints:{
    roots:[{http:'https://dashscope.aliyuncs.com',when:{}}], services:[{id:'api',url:'{http}/api/v1'}],
  } }, values:{KEY:'fixture-api-key',DASHSCOPE_API_REGION:'cn-beijing'},
};
const ascii = text => [...text].map(char => char.charCodeAt(0));
const bytes = (...values) => Uint8Array.from(values).buffer;
function recording(channels=1) {
  const size=channels*2;
  return {format:'wav',mime:'audio/wav',buffer:bytes(...ascii('RIFF'),36+size,0,0,0,...ascii('WAVEfmt '),16,0,0,0,1,0,channels,0,128,62,0,0,0,125*channels,0,0,size,0,16,0,...ascii('data'),size,0,0,0,...Array(size).fill(0))};
}
const policy = () => ({upload_host:UPLOAD,upload_dir:'fixture/recordings',oss_access_key_id:'upload-access-only',signature:'upload-signature-only',policy:'upload-policy-only',x_oss_object_acl:'private',x_oss_forbid_overwrite:'true'});
const sentence = (text='会议内容',begin_time=0,speaker_id=0) => ({text,begin_time,end_time:begin_time+1000,speaker_id});
const done = (extra={}) => ({request_id:'poll-id',output:{task_id:'task-id',task_status:'SUCCEEDED',results:[{subtask_status:'SUCCEEDED',transcription_url:RESULT}]},usage:{input_tokens:100,output_tokens:10},...extra});
const result = () => ({transcripts:[{channel_id:0,sentences:[sentence()]}],properties:{original_duration_in_milliseconds:12500}});
function server({policyData=policy(),submit={request_id:'submit-id',output:{task_id:'task-id',task_status:'PENDING'}},tasks=[done()],transcription=result(),override}={}) {
  let pollIndex=0;
  const requests=[];
  const fetcher=async(url,init={})=>{
    const address=new URL(String(url));
    const phase=address.pathname==='/api/v1/uploads'?'policy':address.hostname==='upload-fixture.oss-cn-beijing.aliyuncs.com'?'upload':address.pathname==='/api/v1/services/audio/asr/transcription'?'submit':address.pathname.startsWith('/api/v1/tasks/')?'poll':address.hostname==='result-fixture.oss-cn-beijing.aliyuncs.com'?'result':'unexpected';
    const request={phase,url:String(url),init}; requests.push(request);
    const custom=await override?.(request,requests);
    if(custom!==undefined)return custom;
    if(phase==='policy')return Response.json({request_id:'policy-id',data:policyData});
    if(phase==='upload')return new Response('',{status:200});
    if(phase==='submit')return Response.json(submit);
    if(phase==='poll')return Response.json(tasks[Math.min(pollIndex++,tasks.length-1)]);
    if(phase==='result')return Response.json(transcription);
    assert.fail(`Unexpected network request: ${url}`);
  };
  return {fetcher,requests};
}
async function withServer(mock,work) {
  const old=globalThis.fetch;
  globalThis.fetch=mock.fetcher;
  try { return await work(); } finally { globalThis.fetch=old; }
}
const run=(mock,options={},audio=recording(),credentials=cred)=>withServer(mock,()=>transcribeFile(credentials,audio,{model:MODEL,pollMs:0,timeoutMs:500,...options}));
const header=(request,name)=>new Headers(request.init.headers).get(name);
function assertPrivate(value) {
  const serialized=JSON.stringify(value instanceof Error?{message:value.message,...value}:value);
  for(const secret of ['fixture-api-key','private-signature','upload-access-only','upload-signature-only','upload-policy-only','oss://','Authorization']) assert.ok(!serialized.includes(secret),secret);
}

test('filetrans performs official upload, one async job, and signed result fetch with isolated credentials',async()=>{
  const mock=server(), progress=[];
  const audio=recording();
  const value=await run(mock,{onProgress:text=>progress.push(text)},audio);
  assert.deepEqual(mock.requests.map(request=>request.phase),['policy','upload','submit','poll','result']);
  const [getPolicy,upload,submit,poll,download]=mock.requests;
  assert.equal(new URL(getPolicy.url).searchParams.get('action'),'getPolicy');
  assert.equal(new URL(getPolicy.url).searchParams.get('model'),MODEL);
  for(const request of [getPolicy,submit,poll]) assert.equal(header(request,'Authorization'),'Bearer fixture-api-key');
  assert.equal(getPolicy.init.method,'GET'); assert.equal(poll.init.method,'GET');
  for(const request of [getPolicy,poll]) {
    assert.equal(header(request,'Content-Type'),'application/json');
    assert.equal(request.init.body,undefined);
  }
  assert.equal(upload.init.method,'POST'); assert.ok(upload.init.body instanceof FormData);
  const fields=[...upload.init.body.entries()];
  assert.equal(fields.at(-1)[0],'file','OSS file field must follow its policy fields');
  const form=upload.init.body, blob=form.get('file');
  assert.deepEqual(await blob.arrayBuffer(),audio.buffer); assert.equal(blob.type,'audio/wav');
  assert.equal(form.get('OSSAccessKeyId'),'upload-access-only');
  assert.equal(form.get('Signature'),'upload-signature-only');
  assert.equal(form.get('policy'),'upload-policy-only');
  assert.equal(form.get('x-oss-object-acl'),'private');
  assert.equal(form.get('x-oss-forbid-overwrite'),'true');
  assert.equal(form.get('success_action_status'),'200');
  assert.match(form.get('key'),/^fixture\/recordings\/.+\.wav$/);
  assert.equal(header(submit,'X-DashScope-Async'),'enable');
  assert.equal(header(submit,'X-DashScope-OssResourceResolve'),'enable');
  assert.deepEqual(JSON.parse(submit.init.body),{model:MODEL,input:{file_urls:[`oss://${form.get('key')}`]},parameters:{channel_id:[0],diarization_enabled:true}});
  for(const request of [upload,download]) {
    assert.equal(header(request,'Authorization'),null);
    assert.equal(header(request,'X-DashScope-Async'),null);
    assert.equal(header(request,'Content-Type'),null,'browser sets multipart boundary itself');
  }
  for(const request of mock.requests) {
    assert.equal(request.init.credentials,'omit');
    assert.equal(request.init.redirect,'error');
    assert.equal(request.init.cache,'no-store');
    assert.equal(request.init.referrerPolicy,'no-referrer');
  }
  assert.deepEqual(value,{output:{sentences:[sentence()]},usage:{input_tokens:100,output_tokens:10},request_id:'submit-id',durationSeconds:12.5});
  assert.ok(progress.length>=4);
  assertPrivate(value); assertPrivate(progress);
});

test('filetrans polls without resubmitting and retains logical request identity and zero usage',async()=>{
  const mock=server({submit:{request_id:'submit-zero',output:{task_id:'task-id'},usage:{input_tokens:0}},tasks:[
    {request_id:'poll-one',output:{task_status:'PENDING'},usage:{duration:0}},
    {request_id:'poll-two',output:{task_status:'RUNNING'},usage:{output_tokens:0}},
    done({usage:{duration:0,credential:'fixture-api-key'}}),
  ]});
  const value=await run(mock);
  assert.equal(value.request_id,'submit-zero');
  assert.deepEqual(value.usage,{input_tokens:0,output_tokens:0,duration:0});
  assert.equal(mock.requests.filter(r=>r.phase==='submit').length,1);
  assert.equal(mock.requests.filter(r=>r.phase==='poll').length,3);
  assertPrivate(value);
});

test('filetrans falls back to task id and preserves partial usage without inventing missing tokens',async()=>{
  for(const usage of [{},{duration:12.5},{input_tokens:0},{output_tokens:3},{input_tokens:null,output_tokens:NaN,duration:-1}]) {
    const mock=server({submit:{output:{task_id:'task-id'}},tasks:[done({usage})]});
    const value=await run(mock);
    assert.equal(value.request_id,'task-id');
    assert.equal(Object.hasOwn(value.usage,'input_tokens'),usage.input_tokens===0);
    assert.equal(Object.hasOwn(value.usage,'output_tokens'),usage.output_tokens===3);
    assert.equal(value.usage.duration,usage.duration===12.5?12.5:undefined);
  }
});

test('filetrans stereo requests both channels without fabricated speaker diarization',async()=>{
  const mock=server({transcription:{transcripts:[
    {channel_id:1,sentences:[sentence('右声道后句',1000,4),sentence('右声道首句',0,4)]},
    {channel_id:0,sentences:[sentence('左声道首句',0,8)]},
  ],properties:{original_duration_in_milliseconds:2000}}});
  const value=await run(mock,{},recording(2));
  assert.deepEqual(JSON.parse(mock.requests.find(r=>r.phase==='submit').init.body).parameters,{channel_id:[0,1],diarization_enabled:false});
  assert.deepEqual(value.output.sentences.map(s=>[s.text,s.channel_id,s.speaker_id]),[['左声道首句',0,null],['右声道首句',1,null],['右声道后句',1,null]]);
});

test('filetrans mono keeps speaker identity while removing redundant sentence channel metadata',async()=>{
  const mock=server({transcription:{transcripts:[{channel_id:0,sentences:[{...sentence('第二位发言人',0,1),channel_id:0}]}]}});
  const value=await run(mock);
  assert.deepEqual(value.output.sentences,[sentence('第二位发言人',0,1)]);
  assert.equal(Object.hasOwn(value.output.sentences[0],'channel_id'),false);
});

test('filetrans stereo fails honestly if either requested channel is absent',async()=>{
  for(const transcripts of [[],[{channel_id:0,sentences:[]}],[{channel_id:1,sentences:[]}],[{channel_id:0,sentences:[]},{channel_id:0,sentences:[]}]]) {
    const mock=server({transcription:{transcripts}});
    await assert.rejects(run(mock,{},recording(2)),error=>error.taskSubmitted===true && error.requestId==='submit-id');
  }
});

test('filetrans rejects unsupported channels, malformed audio, and unsafe model before network',async()=>{
  for(const audio of [recording(3),{...recording(),buffer:new ArrayBuffer(0)},{...recording(),buffer:bytes(1,2,3)},{...recording(),format:'ogg'}]) {
    const mock=server(); await assert.rejects(run(mock,{},audio)); assert.equal(mock.requests.length,0);
  }
  const mock=server(); await assert.rejects(run(mock,{model:'model&action=other'})); assert.equal(mock.requests.length,0);
});

const unsafeURLs=[
  'http://upload-fixture.oss-cn-beijing.aliyuncs.com/file',
  'https://upload-fixture.oss-cn-beijing.aliyuncs.com.evil.test/file',
  'https://evil.test/file',
  'https://user:password@upload-fixture.oss-cn-beijing.aliyuncs.com/file',
  'https://upload-fixture.oss-cn-beijing.aliyuncs.com:8443/file',
  'https://upload-fixture.oss-cn-beijing.aliyuncs.com/file#fragment',
  'https://dashscope.aliyuncs.com/file',
  'https://bucket.oss-cn-unverified.aliyuncs.com/file',
  '//upload-fixture.oss-cn-beijing.aliyuncs.com/file',
  'javascript:alert(1)',
];
test('filetrans rejects unsafe upload destinations before transmitting media or submitting a task',async()=>{
  for(const upload_host of unsafeURLs) {
    const mock=server({policyData:{...policy(),upload_host}});
    await assert.rejects(run(mock),error=>{assert.equal(error.taskSubmitted,false); assert.equal(error.requestId,''); assertPrivate(error); return true;});
    assert.deepEqual(mock.requests.map(r=>r.phase),['policy'],upload_host);
  }
});
test('filetrans rejects unsafe signed result destinations while preserving known task usage',async()=>{
  for(const transcription_url of unsafeURLs) {
    const mock=server({tasks:[done({output:{task_status:'SUCCEEDED',results:[{subtask_status:'SUCCEEDED',transcription_url}]}})]});
    await assert.rejects(run(mock),error=>{assert.equal(error.taskSubmitted,true); assert.equal(error.requestId,'submit-id'); assert.deepEqual(error.usage,{input_tokens:100,output_tokens:10}); assertPrivate(error); return true;});
    assert.deepEqual(mock.requests.map(r=>r.phase),['policy','upload','submit','poll'],transcription_url);
  }
});

test('filetrans rejects malformed upload policy before sending media',async()=>{
  for(const policyData of [null,{...policy(),upload_dir:'../private'},{...policy(),upload_dir:'folder?x=y'},{...policy(),signature:''},{...policy(),oss_access_key_id:null},{...policy(),policy:4}]) {
    const mock=server({policyData}); await assert.rejects(run(mock),error=>error.taskSubmitted===false); assert.deepEqual(mock.requests.map(r=>r.phase),['policy']);
  }
});

test('filetrans upload policy must target the bucket root without path or query',async()=>{
  for(const upload_host of [`${UPLOAD}other-path`,`${UPLOAD}?policy=override`,`${UPLOAD}%2F`]) {
    const mock=server({policyData:{...policy(),upload_host}});
    await assert.rejects(run(mock),error=>error.taskSubmitted===false);
    assert.deepEqual(mock.requests.map(r=>r.phase),['policy']);
  }
});

test('filetrans enforces local and policy file size limits before upload',async()=>{
  const large=recording();
  const buffer=new ArrayBuffer(7*1024*1024+2),view=new DataView(buffer);
  new Uint8Array(buffer).set(new Uint8Array(large.buffer));
  view.setUint32(4,buffer.byteLength-8,true);view.setUint32(40,buffer.byteLength-44,true);
  const local=server();
  await assert.rejects(run(local,{}, {...large,buffer}),/7 MiB/);
  assert.equal(local.requests.length,0);
  const restricted=server({policyData:{...policy(),max_file_size_mb:0.00004}});
  await assert.rejects(run(restricted),error=>error.taskSubmitted===false);
  assert.deepEqual(restricted.requests.map(r=>r.phase),['policy']);
  for(const max_file_size_mb of [1,undefined,0,-1,null,'1']) {
    const permitted=server({policyData:{...policy(),max_file_size_mb}});
    assert.equal((await run(permitted)).request_id,'submit-id');
  }
});

test('filetrans errors before ASR submission never claim a billable task',async()=>{
  for(const failPhase of ['policy','upload']) {
    const mock=server({override:({phase})=>phase===failPhase?new Response('blocked',{status:403}):undefined});
    await assert.rejects(run(mock),error=>{assert.equal(error.taskSubmitted,false); assert.equal(error.status,403); assert.deepEqual(error.usage,{}); assertPrivate(error); return true;});
    assert.ok(!mock.requests.some(r=>r.phase==='submit'));
  }
});

test('filetrans submission HTTP error retains its request identity but no storage secrets',async()=>{
  const mock=server({override:({phase})=>phase==='submit'?Response.json({request_id:'rejected-submit',code:'Denied',message:RESULT,usage:{input_tokens:0,output_tokens:0,duration:12.5,signed_url:RESULT,credential:'fixture-api-key'}},{status:403}):undefined});
  await assert.rejects(run(mock),error=>{assert.equal(error.taskSubmitted,true); assert.equal(error.requestId,'rejected-submit'); assert.equal(error.status,403); assert.deepEqual(error.usage,{input_tokens:0,output_tokens:0,duration:12.5}); assertPrivate(error); assert.ok(!error.message.includes('private-signature')); return true;});
});

test('filetrans failed polling retains delivered numeric usage and the original task identity',async()=>{
  const mock=server({submit:{request_id:'submit-id',output:{task_id:'task-id'},usage:{input_tokens:12}},override:({phase})=>phase==='poll'?Response.json({request_id:'failed-poll',message:RESULT,usage:{input_tokens:42,output_tokens:3,credential:'fixture-api-key'}},{status:500}):undefined});
  await assert.rejects(run(mock),error=>{
    assert.equal(error.status,500); assert.equal(error.taskSubmitted,true); assert.equal(error.requestId,'submit-id');
    assert.deepEqual(error.usage,{input_tokens:42,output_tokens:3}); assertPrivate(error); return true;
  });
  assert.ok(!mock.requests.some(r=>r.phase==='result'));
});

test('filetrans invalid task ids cannot alter the polling path',async()=>{
  for(const task_id of ['',null,'../uploads','task?key=value','task#fragment','x'.repeat(161)]) {
    const mock=server({submit:{request_id:'submit-id',output:{task_id}}});
    await assert.rejects(run(mock),error=>error.taskSubmitted===true && error.requestId==='submit-id');
    assert.ok(!mock.requests.some(r=>r.phase==='poll'));
  }
});

test('filetrans unsuccessful and malformed task states stop polling and preserve prior usage',async()=>{
  for(const task_status of ['FAILED','CANCELED','UNKNOWN','UNRECOGNIZED',undefined]) {
    const mock=server({submit:{request_id:'submit-id',output:{task_id:'task-id'},usage:{input_tokens:42}},tasks:[{request_id:'last-poll',output:{task_status},usage:{output_tokens:3}}]});
    await assert.rejects(run(mock),error=>{assert.equal(error.taskSubmitted,true); assert.equal(error.requestId,'submit-id'); assert.deepEqual(error.usage,{input_tokens:42,output_tokens:3}); assertPrivate(error); return true;});
    assert.equal(mock.requests.filter(r=>r.phase==='poll').length,1);
    assert.ok(!mock.requests.some(r=>r.phase==='result'));
  }
});

test('filetrans rejects missing, failed, and multiple subtask results',async()=>{
  for(const results of [undefined,[],[null],[{subtask_status:'FAILED',transcription_url:RESULT}],[{subtask_status:'SUCCEEDED'}],[{subtask_status:'SUCCEEDED',transcription_url:RESULT},{subtask_status:'SUCCEEDED',transcription_url:RESULT}]]) {
    const mock=server({tasks:[done({output:{task_status:'SUCCEEDED',results}})]});
    await assert.rejects(run(mock),error=>error.taskSubmitted===true && error.requestId==='submit-id');
    assert.ok(!mock.requests.some(r=>r.phase==='result'));
  }
});

test('filetrans rejects malformed transcript/channel data and sanitizes failed result download',async()=>{
  for(const transcription of [{},{transcripts:{}},{transcripts:[null]},{transcripts:[{channel_id:0,sentences:{}}]},{transcripts:[{sentences:[]}]},{transcripts:[{channel_id:1,sentences:[]}]},{transcripts:[{channel_id:0,sentences:[]},{channel_id:0,sentences:[]}]}]) {
    const mock=server({transcription}); await assert.rejects(run(mock),error=>error.taskSubmitted===true && error.requestId==='submit-id');
  }
  const mock=server({override:({phase})=>phase==='result'?Response.json({message:RESULT},{status:403}):undefined});
  await assert.rejects(run(mock),error=>{assert.equal(error.status,403);assert.deepEqual(error.usage,{input_tokens:100,output_tokens:10});assertPrivate(error);return true;});
});

test('filetrans stop before upload does not create an ASR task',async()=>{
  const controller=new AbortController(); controller.abort();
  const mock=server();
  await assert.rejects(run(mock,{signal:controller.signal}),error=>error.name==='AbortError' && error.taskSubmitted===false);
  assert.equal(mock.requests.length,0);
});

test('filetrans stop during polling preserves possible charge and does not fetch a result',async()=>{
  const controller=new AbortController();
  const mock=server({tasks:[{output:{task_status:'RUNNING'},usage:{input_tokens:25}}],override:({phase})=>{if(phase==='poll')queueMicrotask(()=>controller.abort());}});
  await assert.rejects(run(mock,{signal:controller.signal,pollMs:10000}),error=>{
    assert.equal(error.name,'AbortError'); assert.equal(error.taskSubmitted,true); assert.equal(error.requestId,'submit-id'); assert.deepEqual(error.usage,{input_tokens:25}); assert.match(error.message,/可能.*计费/); assertPrivate(error); return true;
  });
  assert.equal(mock.requests.filter(r=>r.phase==='poll').length,1);
  assert.ok(!mock.requests.some(r=>r.phase==='result'));
});

test('filetrans timeout interrupts pending wait and keeps task audit evidence',async()=>{
  const mock=server({tasks:[{output:{task_status:'RUNNING'},usage:{input_tokens:0,output_tokens:0}}]});
  const started=performance.now();
  await assert.rejects(run(mock,{timeoutMs:20,pollMs:10000}),error=>{
    assert.match(error.message,/超时/); assert.equal(error.taskSubmitted,true); assert.equal(error.requestId,'submit-id'); assert.deepEqual(error.usage,{input_tokens:0,output_tokens:0}); assertPrivate(error); return true;
  });
  assert.ok(performance.now()-started<1000,'timeout must interrupt a long poll delay');
  assert.equal(mock.requests.filter(r=>r.phase==='poll').length,1);
});

test('filetrans handles workspace policy 404 with authenticated shared fallback',async()=>{
  const credentials={...cred,stack:{...cred.stack,id:'workspace-fallback-fixture',endpoints:{...cred.stack.endpoints,roots:[{http:'https://workspace.cn-beijing.maas.aliyuncs.com',when:{}},{http:'https://dashscope.aliyuncs.com',when:{}}]}}};
  const fallbacks=[];
  const mock=server({override:({phase,url})=>phase==='policy' && new URL(url).hostname==='workspace.cn-beijing.maas.aliyuncs.com'?Response.json({code:'NotFound'},{status:404}):undefined});
  const value=await run(mock,{onFallback:(from,to)=>fallbacks.push([from,to])},recording(),credentials);
  assert.equal(value.request_id,'submit-id');
  assert.equal(mock.requests.filter(r=>r.phase==='policy').length,2);
  assert.deepEqual(fallbacks,[['workspace.cn-beijing.maas.aliyuncs.com','dashscope.aliyuncs.com']]);
  assert.ok(mock.requests.filter(r=>r.phase==='submit'||r.phase==='poll').every(r=>r.url.startsWith(API)));
});

test('filetrans uncertain submission never retries a potentially billable POST on a second root',async()=>{
  const credentials={...cred,stack:{...cred.stack,id:'no-submit-fallback-fixture',endpoints:{...cred.stack.endpoints,roots:[{http:'https://workspace.cn-beijing.maas.aliyuncs.com',when:{}},{http:'https://dashscope.aliyuncs.com',when:{}}]}}};
  const fallbacks=[];
  const mock=server({override:({phase})=>{if(phase==='submit')throw new TypeError('response lost after task submission');}});
  await assert.rejects(run(mock,{onFallback:(...hosts)=>fallbacks.push(hosts)},recording(),credentials),error=>{
    assert.equal(error.taskSubmitted,true);assert.equal(error.requestId,'');assert.deepEqual(error.usage,{});
    assert.ok(error.warnings?.some(w=>w.includes('可能继续运行并计费')));assertPrivate(error);return true;
  });
  assert.equal(mock.requests.filter(r=>r.phase==='submit').length,1);
  assert.ok(!mock.requests.some(r=>r.phase==='poll'));
  assert.deepEqual(fallbacks,[]);
});
