import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
const E = await import('../js/experience.js').catch(() => ({}));
const H = await import('../js/history.js').catch(() => ({}));
const reg = {byId: new Map([['02', {id:'02', stack:'bailian', variants:[{id:'default'},{id:'call'}]}]])};
const result = {models:['model'],firstMs:8.4,metrics:{textFirstMs:null,audioFirstMs:null,audioReadyMs:23.6,totalMs:40.9},cost:null,costStatus:'unknown',sample:'photo',note:'Bearer sk-secret',warnings:['https://host/audio?token=private'],outputs:[{path:'out/answer.txt',type:'text/plain',text:'hello sk-secret'}, {path:'out/audio.wav',type:'audio/wav',url:'https://host/?token=private'}],usageRecords:[{model:'model',requestId:'req',usage:{known:false,prompt:0,headers:'secret'}}]};
function record(extra={}) {return E.browserTrace({sol:{id:'02',title:'一看即懂',models:[]},variant:{id:'default'},result,events:[{tag:'AI',kind:'result',text:'sk-secret',t_ms:1.7}],secrets:['sk-secret'],...extra});}
test('validate registry return paths and variant; reject redirects', () => {
 assert.equal(typeof E.returnTarget,'function');
 assert.equal(E.returnTarget(reg,'#/s/02/call').variant.id,'call');
 for(const path of ['https://evil.test','#/s/02/missing','#/me','#/s/02/default?x=1','#/s/02/default/extra']) assert.equal(E.returnTarget(reg,path),null);
});
test('draft holds original file only in memory and resets explicitly', () => {
 assert.equal(typeof E.draftFor,'function');
 const file={name:'photo.jpg'}; E.draftFor('02/default').file=file; E.draftFor('02/default').question='new question';
 assert.equal(E.draftFor('02/default').file,file); assert.equal(E.draftFor('02/default').question,'new question');
 E.resetDraft('02/default'); assert.equal(E.draftFor('02/default').file,null);
});
test('browser trace whitelists files, rounds time and uses textFirstMs including null', () => {
 assert.equal(typeof E.browserTrace,'function'); const trace=record();
 assert.equal(trace.kit,'browser'); assert.equal(trace.result.first_token_ms,null); assert.equal(trace.events[0].t_ms,2);
 assert.equal(trace.outputs[0].media_type,'text/plain'); assert.equal(trace.outputs[0].bytes, new TextEncoder().encode(trace.outputs[0].text).length);
 assert.equal(trace.outputs[1].asset,null); assert.ok(!JSON.stringify(trace).includes('sk-secret')); assert.ok(!JSON.stringify(trace).includes('https://')); assert.ok(!JSON.stringify(trace).includes('headers'));
});
test('cost missing is unknown and timing labels distinguish audio ready and legacy', () => {
 assert.equal(typeof E.costText,'function'); assert.equal(E.costText({cost:null,costStatus:'unknown'}),'费用未知（接口未返回完整用量）');
 assert.match(E.costText({cost:{low:1,high:2},costStatus:'estimated'}),/估算/); assert.match(E.costText({cost:{low:0,high:0},costStatus:'usage'}),/按用量计算/);
 assert.match(E.metricLines(record().result).join(' '),/整段音频就绪/); assert.match(E.metricLines({first_token_ms:12}).join(' '),/旧记录首响应/);
});
test('history bound, reopen, delete and storage failure leave record usable', () => {
 assert.equal(typeof H.saveHistory,'function'); const memory=new Map(); const store={getItem:k=>memory.get(k),setItem:(k,v)=>memory.set(k,v)};
 for(let i=0;i<25;i++) assert.equal(H.saveHistory(record({startedAt:new Date(i*1000).toISOString()}),store).saved,true);
 assert.equal(H.readHistory(store).records.length,20); const first=H.readHistory(store).records[0]; H.deleteHistory(first.id,store); assert.equal(H.readHistory(store).records.length,19); H.clearHistory(store); assert.equal(H.readHistory(store).records.length,0);
 const bad={getItem(){throw Error('disabled')},setItem(){throw Error('quota')}}; assert.equal(H.saveHistory(record(),bad).saved,false); assert.match(H.saveHistory(record(),bad).error,/历史未保存/); assert.equal(record().outputs[0].text,'hello [已隐藏]');
});
test('successful, failed and stopped serialized browser traces validate JSON Schema', () => {
 assert.equal(typeof E.browserTrace,'function');
 const traces=[record(),record({result:null,error:Object.assign(Error('sk-secret failed'),{outputs:[{path:'out/transcript.txt',type:'text/plain',text:'partial'}]})}),record({result:null,error:Object.assign(Error('stop'),{name:'AbortError'})})];
 const schema=JSON.parse(readFileSync(new URL('../../../solutions/demo-standard/trace.schema.json',import.meta.url)));
 const p=spawnSync(process.env.PYTHON||'python3',['-c','import json,sys,jsonschema\nd=json.load(sys.stdin)\nfor t in d["traces"]: jsonschema.validate(t,d["schema"])'],{input:JSON.stringify({schema,traces}),encoding:'utf8'}); assert.equal(p.status,0,p.stderr);
});
test('generated trace fixtures still satisfy the additive schema', async () => {
 const {readdir}=await import('node:fs/promises'); const root=new URL('../data/traces/',import.meta.url);
 const fixtures=await readdir(root,{recursive:true}); const traces=fixtures.filter(p=>p.endsWith('.json')).map(p=>JSON.parse(readFileSync(new URL(p,root))));
 const schema=JSON.parse(readFileSync(new URL('../../../solutions/demo-standard/trace.schema.json',import.meta.url)));
 const p=spawnSync(process.env.PYTHON||'python3',['-c','import json,sys,jsonschema\nd=json.load(sys.stdin)\nfor t in d["traces"]: jsonschema.validate(t,d["schema"])'],{input:JSON.stringify({schema,traces}),encoding:'utf8'});assert.equal(p.status,0,p.stderr);assert.ok(traces.length>=11);
});
test('partial transcript remains expandable instead of becoming the main answer', () => {
 assert.equal(E.mainOutput({outputs:[{path:'out/transcript.txt',text:'partial'}]}),undefined);
});
test('history whitelists trace metadata and cannot persist an injected credential/header', () => {
 const memory=new Map();const store={getItem:k=>memory.get(k),setItem:(k,v)=>memory.set(k,v)};
 const trace=record();trace.credentials={DASHSCOPE_API_KEY:'injected-secret'};trace.headers={Authorization:'injected-secret'};trace.result.payload={auth:'injected-secret'};
 assert.equal(H.saveHistory(trace,store).saved,true);assert.ok(!JSON.stringify(H.readHistory(store)).includes('injected-secret'));
});
test('02 original mock fixture exposes its result-event answer immediately', () => {
 const trace=JSON.parse(readFileSync(new URL('../data/traces/02-ai-glasses.bailian/default.json',import.meta.url)));
 assert.match(E.mainOutput(trace)?.text||'',/宫保鸡丁/);
});

test('default question initializes only a new draft and explicit reset', () => {
 const key='draft-empty-question'; const initial={question:'sample question'};
 assert.equal(E.draftFor(key,initial).question,'sample question');
 E.draftFor(key).question='';
 assert.equal(E.draftFor(key,initial).question,'');
 assert.equal(E.resetDraft(key,initial).question,'sample question');
});
test('failed trace import and re-export preserve only typed audit metadata', async () => {
 const {normalizeTrace}=await import('../js/data.js');
 const failed=record({result:null,error:Object.assign(Error('minutes failed'),{usageRecords:[{model:'asr',requestId:'request-123',usage:{known:true,duration:10}}]})});
 failed.usageRecords[0].headers={Authorization:'sk-secret'};
 failed.usageRecords[0].payload={url:'https://host/private'};
 Object.assign(failed.usageRecords[0].usage,{headers:'sk-secret',prompt:true,completion:-1,input_tokens:'12',output_tokens:Infinity,characters:20});
 failed.usageRecords.push({model:'https://host/model?token=private',requestId:'Bearer sk-secret',usage:{known:'yes',duration:2}});
 failed.usageRecords.push(null);
 const normalized=normalizeTrace(failed);
 assert.deepEqual(normalized.usageRecords?.[0],{model:'asr',requestId:'request-123',usage:{known:true,duration:10,characters:20}});
 assert.equal(normalized.usageRecords.length,2);
 assert.ok(!JSON.stringify(normalized.usageRecords).includes('https://'));
 assert.ok(!JSON.stringify(normalized.usageRecords).includes('sk-secret'));
 const exported=E.safeTrace(normalized);
 assert.deepEqual(exported.usageRecords,normalized.usageRecords);
});
test('temporary speech is accessible beside the answer and absent from imported text results', () => {
 const slot={innerHTML:'',querySelector(){return null;}};
 const trace=record(); const speechURL='https://dashscope-result.oss-cn-beijing.aliyuncs.com/reply.wav?token=temporary';
 E.renderOutcome(slot,trace,{speechURL});
 assert.match(slot.innerHTML,/<audio[^>]*aria-label="听播报"[^>]*controls/);
 assert.ok(slot.innerHTML.includes('token=temporary'));
 assert.ok(!JSON.stringify(E.safeTrace(trace)).includes('token=temporary'));
 E.renderOutcome(slot,{...trace,outputs:[...trace.outputs,{path:'out/injected.wav',media_type:'audio/wav',url:speechURL}]});
 assert.ok(!slot.innerHTML.includes('<audio'));
 assert.ok(!slot.innerHTML.includes('token=temporary'));
});
