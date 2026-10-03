import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {validateProfile,priceUsage,buildLedger,validatePlan,executePlan} from '../js/cost.js';
import {PROJECTS,hardwareEstimate,hardwareTrace} from '../js/projects.js';

const profile=()=>({schema:'aihw/prices@0.1',title:'用户确认的测试价格',source:'测试合同版本',currency:'CNY',region:'cn-beijing',effective_date:'2026-10-01',demo:false,rates:[{model:'model',components:[{counter:'prompt',per:1000000,price:2},{counter:'completion',per:1000000,price:4}]}]});
const record=(extra={})=>({model:'model',requestId:'request-1',usage:{known:true,prompt:1000,completion:100},...extra});
const trace=(extra={})=>({schema:'aihw/trace@0.1',solution:'02-ai-glasses.bailian',variant:'default',region:'cn-beijing',mode:'live',ran_at:'2026-10-04T01:00:00Z',status:'success',result:{usageRecords:[record()]},...extra});
const plan=()=>({schema:'aihw/cost-plan@0.1',region:'cn-beijing',budget_cny:1,acknowledge_billing_risk:true,scenes:[{id:'02-ai-glasses.bailian',repeat:3,ceiling_cny:0.1}]});
const close=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-12,`${actual} should be within 1e-12 of ${expected}`);

test('profile rejects currencies, malformed rates, negative prices and duplicate token aliases',()=>{
  for(const raw of [{...profile(),currency:'USD'},{...profile(),region:'elsewhere'},{...profile(),effective_date:'2026-02-30'},{...profile(),rates:[{model:'model',components:[{counter:'prompt',per:0,price:0}]}]},{...profile(),rates:[{model:'model',components:[{counter:'prompt',per:1,price:-1}]}]},{...profile(),rates:[{model:'model',components:[{counter:'prompt',per:1,price:0},{counter:'input_tokens',per:1,price:0}]}]}])assert.throws(()=>validateProfile(raw));
});
test('counter aliases retain zero while absent, invalid and unknown token usage remain unknown',()=>{
  const p=validateProfile(profile());
  close(priceUsage(record(),p,'cn-beijing').cost,0.0024);
  assert.equal(priceUsage(record({usage:{known:true,input_tokens:0,output_tokens:0}}),p,'cn-beijing').cost,0);
  for(const usage of [{known:false,prompt:0,completion:0},{known:true,prompt:1},{known:true,prompt:'1',completion:2},{known:true,prompt:true,completion:2}])assert.equal(priceUsage(record({usage}),p,'cn-beijing').cost,null);
  assert.equal(priceUsage(record(),p,'ap-southeast-1').cost,null);
});
test('duration quantum and input tiers use explicit provider counters, including exact boundaries',()=>{
  const p=validateProfile({...profile(),rates:[{model:'model',components:[{counter:'duration',per:60,price:0.2,quantum:60}]}]});
  assert.equal(priceUsage(record({usage:{known:false,duration:60.01}}),p,'cn-beijing').cost,0.4);
  assert.equal(priceUsage(record({usage:{duration:0}}),p,'cn-beijing').cost,0);
  const tier=validateProfile({...profile(),rates:[{model:'model',tiers:[{upto:1000,components:[{counter:'prompt',per:1000,price:1}]},{upto:null,components:[{counter:'prompt',per:1000,price:3}]}]}]});
  assert.equal(priceUsage(record(),tier,'cn-beijing').cost,1);
  close(priceUsage(record({usage:{known:true,prompt:1001}}),tier,'cn-beijing').cost,3.003);
  assert.throws(()=>validateProfile({...profile(),rates:[{model:'model',tiers:[{upto:1000,components:[{counter:'prompt',per:1,price:1}]}]}]}));
});
test('mock is excluded; missing dates and effective prices never create a complete zero total',()=>{
  assert.equal(buildLedger([trace({mode:'mock'})],profile()).total,null);
  assert.equal(buildLedger([trace({mode:'mock'})],profile()).excludedMock,1);
  assert.equal(buildLedger([trace({ran_at:'2026-09-30'})],profile()).total,null);
  const missing=profile();missing.rates[0].components[0].price=null;
  assert.equal(buildLedger([trace()],missing).total,null);
  assert.equal(buildLedger([],profile()).total,null);
});
test('overflow cannot serialize a falsely known price or accounting total',()=>{
  const huge=validateProfile({...profile(),rates:[{model:'model',components:[{counter:'prompt',per:1,price:1},{counter:'completion',per:1,price:1}]}]});
  assert.equal(priceUsage(record({usage:{known:true,prompt:1e308,completion:1e308}}),huge,'cn-beijing').cost,null);
  const large=id=>trace({result:{usageRecords:[record({requestId:id,usage:{known:true,prompt:1e308,completion:0}})]}});
  assert.throws(()=>buildLedger([large('a'),large('b')],huge),/数字范围/);
});
test('deduplicate identical request ids but surface conflicting audit evidence as unknown',()=>{
  const r=buildLedger([trace(),trace()],profile());
  assert.equal(r.rows.length,1);assert.equal(r.duplicateRequests,1);close(r.total,0.0024);
  const conflict=trace({result:{usageRecords:[record({usage:{known:true,prompt:5,completion:0}})]}});
  assert.equal(buildLedger([trace(),conflict],profile()).total,null);
  assert.match(buildLedger([trace(),conflict],profile()).rows[0].reason,/冲突/);
});
test('failed and stopped attempts retain unknown charges; aggregate invoice needs matching scope',()=>{
  const failed=buildLedger([trace({status:'failed',result:null})],profile());
  assert.equal(failed.total,null);assert.match(failed.rows[0].reason,/可能计费/);
  const stopped=buildLedger([trace({status:'stopped'})],profile());
  close(stopped.total,0.0024);
  assert.equal(buildLedger([trace()],profile(),{billAmount:0}).bill.difference,null);
  close(buildLedger([trace()],profile(),{billAmount:0,billScopeConfirmed:true}).bill.difference,-0.0024);
  assert.equal(buildLedger([trace()],{...profile(),demo:true},{billAmount:0,billScopeConfirmed:true}).bill.difference,null);
});
test('exported ledger omits responses, credentials, media and request headers',()=>{
  const input=trace();input.credentials={key:'private-value'};input.outputs=[{url:'https://media/?key=private-value'}];input.result.text='private-value';input.result.usageRecords[0].headers={authorization:'private-value'};
  const serialized=JSON.stringify(buildLedger([input],profile()));
  assert.ok(!serialized.includes('private-value'));assert.ok(!serialized.includes('https://media'));assert.ok(!serialized.includes('authorization'));
  input.result.usageRecords[0].requestId='request-private-value';
  const redacted=JSON.stringify(buildLedger([input],{...profile(),title:'private-value',source:'private-value'},{billReference:'private-value',secrets:['private-value']}));
  assert.ok(!redacted.includes('private-value'));
});
test('plan validates repeat budgets and live consent before invoking transport',async()=>{
  assert.throws(()=>validatePlan({...plan(),budget_cny:0.1}));
  assert.equal(validatePlan({...plan(),budget_cny:0.3}).budget_cny,0.3);
  assert.throws(()=>validatePlan({...plan(),budget_cny:0.299999}));
  assert.throws(()=>validatePlan({...plan(),budget_cny:1e-20,scenes:[{id:'02-ai-glasses.bailian',repeat:1,ceiling_cny:1e-19}]}));
  assert.throws(()=>validatePlan({...plan(),scenes:[{id:'03-toys-companion.bailian',repeat:1,ceiling_cny:0.1}]}));
  let calls=0;
  await assert.rejects(executePlan({...plan(),acknowledge_billing_risk:false},profile(),async()=>{calls++;},{mode:'live'}));
  await assert.rejects(executePlan(plan(),{...profile(),demo:true},async()=>{calls++;},{mode:'live'}));
  assert.equal(calls,0);
});
test('retain public price provenance while stripping queries and signed media references',()=>{
  const source='https://help.aliyun.com/zh/model-studio/model-pricing?token=private-value';
  const p={...profile(),source};
  assert.equal(buildLedger([trace()],p).profile.source,'https://help.aliyun.com/zh/model-studio/model-pricing');
  assert.ok(!validateProfile({...p,source:'https://media.example/voice?token=private-value'}).source.includes('private-value'));
});
test('live scheduler stops on unknown charge, failed attempt and soft-budget reserve without retry',async()=>{
  for(const t of [trace({result:null}),trace({status:'failed'})]){
    let calls=0;const result=await executePlan(plan(),profile(),async()=>{calls++;return t;},{mode:'live'});
    assert.equal(calls,1);assert.ok(result.stopped);assert.equal(result.completed,1);
  }
  let calls=0;
  const result=await executePlan({...plan(),budget_cny:0.3},profile(),async()=>{calls++;return trace({result:{usageRecords:[record({requestId:'req-'+calls,usage:{known:true,prompt:125000,completion:0}})]}});},{mode:'live'});
  assert.equal(calls,1);assert.match(result.stopped,/预留/);
});
test('mock scheduler completes repeatable transport exercises and refuses mislabeled live traces',async()=>{
  const result=await executePlan(plan(),profile(),async()=>trace({mode:'mock'}),{mode:'mock'});
  assert.equal(result.completed,3);assert.equal(result.ledger.excludedMock,3);assert.equal(result.ledger.total,null);
  await assert.rejects(executePlan(plan(),profile(),async()=>trace(),{mode:'mock'}));
});
test('hardware budget separates shared NRE/server from per-device hardware; cloud unknown is not zero',()=>{
  const p=PROJECTS[0],one=hardwareEstimate(p),ten=hardwareEstimate(p,{units:10});
  assert.equal(ten.hardware[0],one.hardware[0]*10);assert.deepEqual(ten.nre,one.nre);assert.deepEqual(ten.service,one.service);
  assert.equal(one.total,null);
  const zero=hardwareEstimate(p,{cloudPerUse:0});assert.deepEqual(zero.total,zero.subtotal);
  assert.throws(()=>hardwareEstimate(p,{units:1.5}));assert.throws(()=>hardwareEstimate(p,{hourly:-1}));
});
test('all hardware mock and offline rehearsals export valid replay schema',()=>{
  const schema=JSON.parse(readFileSync(new URL('../../../solutions/demo-standard/trace.schema.json',import.meta.url)));
  const traces=PROJECTS.flatMap(p=>[hardwareTrace(p),hardwareTrace(p,{offline:true})]);
  const check=spawnSync(process.env.PYTHON||'python3',['-c','import json,sys,jsonschema\nd=json.load(sys.stdin)\nfor t in d["traces"]:jsonschema.validate(t,d["schema"])'],{input:JSON.stringify({schema,traces}),encoding:'utf8'});
  assert.equal(check.status,0,check.stderr);
  assert.ok(traces.every(t=>t.mode==='mock'&&t.result.cost===null));
});
test('live CLI refuses without credentials and authorization before creating an output or server',()=>{
  const env=Object.fromEntries(Object.entries(process.env).filter(([k])=>!k.startsWith('DASHSCOPE_')));
  const result=spawnSync(process.execPath,['docs/app/tools/cost-run.mjs','--live','--plan','docs/app/tools/cost-fixtures/plan-example.json','--prices','docs/app/tools/cost-fixtures/prices-example.json'],{env,encoding:'utf8'});
  assert.equal(result.status,1);assert.match(result.stderr,/需要环境中的/);assert.equal(result.stdout,'');
});
