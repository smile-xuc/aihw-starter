import { normalizeUsageRecords } from './data.js';
import { redact } from './experience.js';

const COUNTERS=['prompt','completion','input_tokens','output_tokens','characters','duration'];
const finite=n=>typeof n==='number'&&Number.isFinite(n)&&n>=0;
const bounded=(v,max=160)=>redact(typeof v==='string'?v:'').replace(/\bsk-[A-Za-z0-9_-]{10,}/g,'[已隐藏]').slice(0,max);
const family=k=>({input_tokens:'prompt',output_tokens:'completion'})[k]||k;
// Ignore only binary floating-point noise at an exact budget boundary.
const exceeds=(amount,budget)=>amount-budget>8*Number.EPSILON*Math.max(Number.MIN_VALUE,Math.abs(amount),Math.abs(budget));
function priceSource(value,secrets=[]) {
  let text=typeof value==='string'?value:'';
  for(const secret of secrets.filter(s=>typeof s==='string'&&s.length>2))text=text.split(secret).join('[已隐藏]');
  return text.replace(/(?:https?:\/\/|blob:|data:)[^\s<>"']+/gi,url=>{
    try{const parsed=new URL(url);return parsed.protocol==='https:'&&!parsed.username&&!parsed.password&&['help.aliyun.com','www.aliyun.com'].includes(parsed.hostname)?parsed.origin+parsed.pathname:'[地址已隐藏]';}
    catch{return '[地址已隐藏]';}
  }).replace(/Bearer\s+[^\s,;]+/gi,'Bearer [已隐藏]').replace(/\bsk-[A-Za-z0-9_-]{10,}/g,'[已隐藏]').slice(0,500);
}
export const PRICE_SCHEMA='aihw/prices@0.1';
export const PLAN_SCHEMA='aihw/cost-plan@0.1';

function components(list) {
  if(!Array.isArray(list)||!list.length||list.length>6)throw Error('每个价格档位需要 1–6 项计价组成');
  const used=new Set();
  return list.map(c=>{
    if(!c||!COUNTERS.includes(c.counter)||used.has(family(c.counter)))throw Error('计价字段无效或重复（Token 别名不能重复计价）');
    used.add(family(c.counter));
    if(!finite(c.per)||c.per===0||c.per>1e9||(c.price!==null&&!finite(c.price)))throw Error('计价单位或单价无效；未填写单价请用 null');
    const quantum=c.quantum??null;
    if(quantum!==null&&(!finite(quantum)||quantum===0||quantum>1e9))throw Error('计费取整粒度无效');
    return {counter:c.counter,per:c.per,price:c.price,quantum};
  });
}
export function validateProfile(raw) {
  if(!raw||raw.schema!==PRICE_SCHEMA||raw.currency!=='CNY'||!['cn-beijing','ap-southeast-1'].includes(raw.region))throw Error('单价表需为 aihw/prices@0.1、CNY 和支持的地域');
  if(typeof raw.effective_date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(raw.effective_date)||new Date(raw.effective_date).toISOString().slice(0,10)!==raw.effective_date)throw Error('单价生效日期无效');
  if(!Array.isArray(raw.rates)||!raw.rates.length||raw.rates.length>100)throw Error('需要 1–100 个模型价格');
  const models=new Set();
  const rates=raw.rates.map(r=>{
    if(!r||typeof r.model!=='string'||!/^[a-zA-Z0-9_.-]{1,100}$/.test(r.model)||models.has(r.model))throw Error('模型名无效或重复');
    models.add(r.model);
    if(r.tiers){
      if(r.components||!Array.isArray(r.tiers)||!r.tiers.length||r.tiers.length>20)throw Error('档位与固定单价不能同时设置');
      let previous=0;
      const tiers=r.tiers.map((t,i)=>{
        if(t.upto===null){if(i!==r.tiers.length-1)throw Error('无限档位只能放最后');}
        else if(!finite(t.upto)||t.upto<=previous)throw Error('输入 Token 档位上限须递增');
        previous=t.upto;return {upto:t.upto,components:components(t.components)};
      });
      if(tiers.at(-1).upto!==null)throw Error('最后一个档位上限须为 null');
      return {model:r.model,tiers};
    }
    return {model:r.model,components:components(r.components)};
  });
  return {schema:PRICE_SCHEMA,title:bounded(raw.title),source:priceSource(raw.source),currency:'CNY',region:raw.region,effective_date:raw.effective_date,demo:raw.demo===true,rates};
}
const count=(u,k)=>u?.[k]??u?.[({prompt:'input_tokens',completion:'output_tokens',input_tokens:'prompt',output_tokens:'completion'})[k]];
export function priceUsage(record,profile,region) {
  const unknown=reason=>({cost:null,reason,components:[]});
  if(region!==profile.region)return unknown('地域与单价表不一致');
  const rate=profile.rates.find(r=>r.model===record.model);
  if(!rate)return unknown('缺少该模型单价');
  const u=record.usage||{};
  let parts=rate.components;
  if(rate.tiers){
    const prompt=count(u,'prompt');
    if(!finite(prompt)||u.known!==true)return unknown('缺少选择输入 Token 档位所需的完整用量');
    parts=rate.tiers.find(t=>t.upto===null||prompt<=t.upto).components;
  }
  const amounts=[];
  for(const c of parts){
    const amount=count(u,c.counter);
    if(c.price===null)return unknown('单价尚未填写');
    if(!finite(amount)||(family(c.counter)==='prompt'||family(c.counter)==='completion')&&u.known!==true)return unknown('接口未返回完整计价用量');
    const billed=c.quantum?Math.ceil(amount/c.quantum)*c.quantum:amount;
    const cost=billed/c.per*c.price;
    if(!finite(cost))return unknown('用量或计价结果超出范围');
    amounts.push({...c,amount,billed,cost});
  }
  const cost=amounts.reduce((n,c)=>n+c.cost,0);
  if(!finite(cost))return unknown('计价合计超出范围');
  return {cost,reason:'按用户单价和接口用量计算，待账单核对',components:amounts};
}
export function buildLedger(traces,rawProfile,{billAmount=null,billScopeConfirmed=false,billReference='',secrets=[]}={}) {
  const clean=(value,max)=>bounded(redact(typeof value==='string'?value:'',secrets),max);
  const profile=validateProfile({...rawProfile,title:clean(rawProfile?.title),source:priceSource(rawProfile?.source,secrets)});
  if(!Array.isArray(traces)||traces.length>200)throw Error('一次最多核对 200 份轨迹');
  if(billAmount!==null&&!finite(billAmount))throw Error('账单金额须为非负数字，未填写为未知');
  const rows=[],seen=new Map();let excluded=0,duplicates=0;
  for(const trace of traces){
    if(!trace||trace.schema!=='aihw/trace@0.1')throw Error('需要 aihw/trace@0.1 运行轨迹');
    if(trace.mode!=='live'){excluded++;continue;}
    const records=normalizeUsageRecords(trace.result?.usageRecords||trace.usageRecords);
    if(!records.length)rows.push({scene:clean(trace.solution),variant:clean(trace.variant),ran_at:clean(trace.ran_at),status:clean(trace.status),model:'未返回调用证据',requestId:'',usage:{known:false},cost:null,reason:'没有请求用量；失败/停止仍可能计费',components:[]});
    for(const record of records){
      const safe={model:clean(record.model),requestId:clean(record.requestId,500),usage:record.usage};
      const key=trace.region+'/'+safe.requestId;
      const signature=JSON.stringify([safe.model,Object.entries(safe.usage).sort()]);
      if(safe.requestId&&seen.has(key)){
        if(seen.get(key).signature===signature){duplicates++;continue;}
        seen.get(key).row.cost=null;seen.get(key).row.components=[];seen.get(key).row.reason='同一请求 ID 的模型/用量冲突，需核对原记录';continue;
      }
      let price=priceUsage(safe,profile,trace.region);
      const when=Date.parse(trace.ran_at||'');
      if(!Number.isFinite(when)||when<Date.parse(profile.effective_date+'T00:00:00Z'))price={cost:null,reason:'缺少运行日期或早于单价生效日',components:[]};
      const row={scene:clean(trace.solution),variant:clean(trace.variant),ran_at:clean(trace.ran_at),status:clean(trace.status)||'unknown',...safe,...price};
      if(!safe.requestId)row.reason+='；缺少请求 ID，不能逐请求核账';
      rows.push(row);if(safe.requestId)seen.set(key,{signature,row});
    }
  }
  const knownSubtotal=rows.reduce((n,r)=>n+(r.cost??0),0);
  if(!finite(knownSubtotal))throw Error('已知项合计超出数字范围，无法生成可信报告');
  const unknown=rows.filter(r=>r.cost===null).length;
  const total=rows.length&&!unknown?knownSubtotal:null;
  const comparable=total!==null&&billAmount!==null&&billScopeConfirmed&&!profile.demo;
  return {schema:'aihw/cost-ledger@0.1',profile,rows,excludedMock:excluded,duplicateRequests:duplicates,unknownRows:unknown,knownSubtotal,total,
    bill:{amount:billAmount,scopeConfirmed:billScopeConfirmed===true,reference:clean(billReference),difference:comparable?billAmount-total:null},
    note:'导入记录来源需人工确认；计算值不是账单。按同账号、业务空间、地域、时间窗核账。失败/停止可能计费；优惠、缓存、取整和多模态单价须按实际价格表填写。报告不改变项目验证状态。'};
}
export function validatePlan(raw) {
  if(!raw||raw.schema!==PLAN_SCHEMA||!['cn-beijing','ap-southeast-1'].includes(raw.region)||!finite(raw.budget_cny)||raw.budget_cny<=0||raw.budget_cny>10000)throw Error('跑测计划需要地域与 0–10000 元之间的正预算');
  if(!Array.isArray(raw.scenes)||!raw.scenes.length||raw.scenes.length>6)throw Error('请选择 1–6 个网页场景');
  const allowed=['01-ipc.bailian','02-ai-glasses.bailian','04-agent-hardware.bailian','07-recorder.bailian','08-smart-watch.bailian','09-embodied.bailian'];
  const ids=new Set();
  const scenes=raw.scenes.map(s=>{
    if(!allowed.includes(s.id)||ids.has(s.id)||!Number.isInteger(s.repeat)||s.repeat<1||s.repeat>10||!finite(s.ceiling_cny)||s.ceiling_cny<=0)throw Error('场景、重复次数或单次预留金额无效');
    ids.add(s.id);return {id:s.id,repeat:s.repeat,ceiling_cny:s.ceiling_cny};
  });
  if(exceeds(scenes.reduce((n,s)=>n+s.repeat*s.ceiling_cny,0),raw.budget_cny))throw Error('计划预留金额超过预算');
  return {schema:PLAN_SCHEMA,region:raw.region,budget_cny:raw.budget_cny,acknowledge_billing_risk:raw.acknowledge_billing_risk===true,scenes};
}
export function priceTemplate(reg,region='cn-beijing') {
  const models=[...new Set(reg.solutions.flatMap(s=>(s.models||[]).filter(m=>!m.regions||m.regions.includes(region)).map(m=>m.id)))].sort();
  return {schema:PRICE_SCHEMA,title:'请填写用户确认的价格说明',source:'请填写官方价格说明或合同版本',currency:'CNY',region,effective_date:'2026-10-04',demo:false,
    rates:models.map(model=>({model,components:/tts/.test(model)?[{counter:'characters',per:10000,price:null}]:[{counter:'prompt',per:1000000,price:null},{counter:'completion',per:1000000,price:null}]}))};
}

// The runner owns transport; this scheduler never initiates requests itself.
export async function executePlan(rawPlan,rawProfile,runScene,{mode='mock'}={}) {
  const plan=validatePlan(rawPlan),profile=validateProfile(rawProfile);
  if(!['mock','live'].includes(mode))throw Error('执行模式无效');
  if(profile.region!==plan.region)throw Error('计划地域与单价表不一致');
  if(mode==='live'&&(profile.demo||!plan.acknowledge_billing_risk||!profile.source||!profile.title))throw Error('真实跑测需要非演练价格说明、来源与明确的预算风险确认');
  const traces=[];let stopped='';
  for(const scene of plan.scenes){
    for(let i=0;i<scene.repeat;i++){
      if(mode==='live'){
        const prior=buildLedger(traces,profile);
        if(exceeds(prior.knownSubtotal+scene.ceiling_cny,plan.budget_cny)){stopped='剩余额度不足以预留下一次调用';break;}
      }
      const trace=await runScene(scene.id,i);
      if(mode==='mock'&&trace.mode!=='mock')throw Error('离线执行器必须明确标注 mock');
      if(mode==='live'&&trace.mode!=='live')throw Error('真实执行器返回了非真实调用记录');
      traces.push(trace);
      if(mode==='live'){
        const current=buildLedger(traces,profile);
        if(current.unknownRows){stopped='当前调用成本未知，停止后续付费请求';break;}
        if(trace.status!=='success'){stopped='调用失败或停止，保留可能计费的证据且不自动重试';break;}
        if(current.knownSubtotal>=plan.budget_cny){stopped='已达到软预算，停止后续调用；单次可能已超额';break;}
      }
    }
    if(stopped)break;
  }
  return {schema:'aihw/cost-run@0.1',mode,plan,completed:traces.length,stopped,traces,ledger:buildLedger(traces,profile),
    warning:'软预算不能限制服务商单次计费；请另设账号侧额度。停止请求不保证免计费；报告不改变真实接口/硬件验证状态。'};
}
