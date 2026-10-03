import { html, mountPage, mount, download, fmtCny } from '../ui.js';
import { readHistory } from '../history.js';
import { normalizeTrace } from '../data.js';
import { validateProfile, buildLedger, priceTemplate, validatePlan, PLAN_SCHEMA } from '../cost.js';
import { loadCredentials } from '../settings.js';
import { redact } from '../experience.js';

export function renderCostLab(view,reg) {
  document.title='AIHW · 跑测账本';
  let active=true,profile=null,ledger=null;
  const sources=readHistory().records.map(r=>({id:r.id,trace:r.trace,origin:'本机历史',selected:true}));
  const secrets=[...reg.stacks.values()].flatMap(s=>(s.fields||[]).filter(f=>f.input==='secret').map(f=>loadCredentials(s.id)?.values[f.key])).filter(Boolean);
  const page=mountPage(view,html`<header class="page-head"><p class="eyebrow">用量 → 单价 → 账单</p><h1>费用先能核对，再谈实际成本。</h1><p>记录每个请求的模型与用量，用你提供的价格说明重新计价，再核对同一时间窗的账单。导入和导出只在本机进行。</p></header>
    <p class="info-note">本页不调用模型。mock 不纳入实测合计；失败和停止不等于免费。计算值不能代替账单，也不会把任何入口改标“已验证”。</p>
    <div class="cost-workspace"><section class="section"><div class="section-title"><h2>1. 提供价格说明</h2></div><div class="panel">
      <label class="field">地域<select data-price-region><option value="cn-beijing">北京</option><option value="ap-southeast-1">新加坡</option></select></label>
      <div class="btn-row"><button class="secondary-action" data-template>下载待填写模板</button><label class="file-pick">导入价格 JSON<input type="file" accept=".json,application/json" data-price-file></label></div>
      <label class="field">单价表（可编辑）<textarea class="json-editor" data-price-editor rows="12" spellcheck="false" maxlength="100000" aria-describedby="price-help"></textarea></label>
      <p class="small" id="price-help">单价币种 CNY，必须提供地域、生效日期和来源；生效日从所选地域的零点起算（北京／新加坡均为 UTC+8）。price: null 表示未填写；0 是明确的零单价。per 是计费单位；quantum 是向上取整粒度；Token 档位可用 tiers。不同模态须有对应的用量，不能用总 Token 假装已拆分。</p>
      <button class="primary-action" data-apply-price>应用单价表</button><p data-price-status aria-live="polite"></p></div></section>
      <section class="section"><div class="section-title"><h2>2. 选择调用记录</h2></div><div class="panel"><p>读取本机文字历史，或导入方案页导出的运行轨迹。核账只导出模型、请求 ID、用量与金额，不带素材、回答正文、Key 或签名音频地址。</p><label class="file-pick">添加运行轨迹 JSON<input type="file" accept=".json,application/json" multiple data-trace-files></label><div data-ledger-sources></div><p data-import-status aria-live="polite"></p></div>
      <div class="panel"><h3>3. 填写账单核对值</h3><label class="field">同范围账单金额（元）<input data-bill type="number" min="0" step="any" placeholder="尚未提供"></label><label class="field">时间窗／账单备注<input data-bill-ref maxlength="160" placeholder="例如：日期范围、账单批次；不要放密钥"></label><label class="check-row"><input type="checkbox" data-bill-scope><span>已确认同一账号、业务空间、地域与时间窗，且没有混入其他调用。</span></label><p class="small">优惠、缓存、多模态拆分、取整与未知用量可能造成差异。金额未填写时是未知，不按零元处理。</p></div></section></div>
    <section class="section"><div class="section-title"><h2>核对结果</h2><button class="secondary-action" data-export-ledger disabled>导出核账报告</button></div><div data-ledger aria-live="polite"></div></section>
    <section class="section"><div class="section-title"><h2>下一步跑测计划</h2></div><form class="panel" data-plan-form>
      <p>先用固定样本跑“一看即懂”和“会议纪要”，再覆盖其余入口。计划只包含场景、地域、次数和软预算，不包含 Key。提供有效凭证和完整单价后才能执行真实跑测。</p>
      <div class="plan-scenes">${reg.solutions.filter(s=>s.variants.some(v=>v.browser?.status==='ok')||['01-ipc.bailian','02-ai-glasses.bailian','04-agent-hardware.bailian','07-recorder.bailian','08-smart-watch.bailian','09-embodied.bailian'].includes(s.id)).map(s=>html`<label class="check-row"><input type="checkbox" name="scenes" value="${s.id}" ${['02-ai-glasses.bailian','07-recorder.bailian'].includes(s.id)?'checked':''}><span>${s.title}</span></label>`)}</div>
      <div class="form-grid"><label class="field">地域<select name="region"><option value="cn-beijing">北京</option><option value="ap-southeast-1">新加坡</option></select></label>
      <label class="field">每场景重复次数<input name="repeat" type="number" min="1" max="10" step="1" value="1"></label>
      <label class="field">每次预留金额（元）<input name="ceiling" type="number" min="0.0001" step="any" value="0.1"></label>
      <label class="field">总软预算（元）<input name="budget" type="number" min="0.0001" max="10000" step="any" value="1"></label></div>
      <label class="check-row"><input name="ack" type="checkbox"><span>用于真实跑测时，我会另设账号侧额度，并知悉单次超额、未知用量或停止仍可能计费。此勾选只写入计划，本页不执行调用。</span></label>
      <button class="secondary-action" type="submit">导出跑测计划</button><p data-plan-status aria-live="polite"></p>
      <p class="small">计划预留值是用户预算假设，不能限制服务商实际账单。离线 runner 先验证流程；真实模式会要求非演练单价、明确预算、显式 live 参数与环境凭证，未知成本后停止后续场景。</p></form></section>`);
  const editor=page.querySelector('[data-price-editor]');
  editor.value=JSON.stringify(priceTemplate(reg),null,2);
  function renderSources(){
    mount(page.querySelector('[data-ledger-sources]'),sources.length?sources.map((s,i)=>html`<label class="check-row ledger-source"><input type="checkbox" data-source-index="${i}" ${s.selected?'checked':''}><span>${reg.byId.get(s.trace.solution)?.title||s.trace.solution} · ${s.trace.ran_at||'无时间记录'}<small>${s.origin} · ${s.trace.mode==='mock'?'mock（不会纳入实测）':s.trace.status||'状态未知'}</small></span></label>`):html`<p class="small">还没有运行记录。先用自己的 Key 跑一次，或导入轨迹。导入固定回放也可验证“排除 mock”的行为。</p>`);
    page.querySelectorAll('[data-source-index]').forEach(input=>input.addEventListener('change',()=>{sources[Number(input.dataset.sourceIndex)].selected=input.checked;calculate();}));
  }
  function calculate(){
    ledger=null;page.querySelector('[data-export-ledger]').disabled=true;
    if(!profile){mount(page.querySelector('[data-ledger]'),html`<div class="panel"><p>先应用单价表。未填单价会保持未知，不推断真实零成本。</p></div>`);return;}
    try{
      const raw=page.querySelector('[data-bill]').value;
      ledger=buildLedger(sources.filter(s=>s.selected).map(s=>s.trace),profile,{billAmount:raw===''?null:Number(raw),billScopeConfirmed:page.querySelector('[data-bill-scope]').checked,billReference:redact(page.querySelector('[data-bill-ref]').value,secrets),secrets});
      const priced=ledger.rows.filter(r=>r.cost!==null).length;
      mount(page.querySelector('[data-ledger]'),html`<div class="panel"><div class="metric-grid"><div class="metric"><small>已知项小计</small><strong>¥${fmtCny(ledger.knownSubtotal)}</strong><span>${priced} 项；不是完整账单</span></div><div class="metric"><small>调用成本合计</small><strong>${ledger.total===null?'未知':'¥'+fmtCny(ledger.total)}</strong><span>${ledger.unknownRows} 项缺证据</span></div><div class="metric"><small>账单金额</small><strong>${ledger.bill.amount===null?'未填写':'¥'+fmtCny(ledger.bill.amount)}</strong></div><div class="metric"><small>账单 − 计算值</small><strong>${ledger.bill.difference===null?'待核对':(ledger.bill.difference>=0?'+':'−')+'¥'+fmtCny(Math.abs(ledger.bill.difference))}</strong></div></div>
        <p class="small">${profile.title} · ${profile.region} · ${profile.effective_date} 生效 · 来源：${profile.source||'未提供来源'}${profile.demo?' · 演练单价，不支持真实跑测':''}</p><p>已排除 ${ledger.excludedMock} 份 mock；去重 ${ledger.duplicateRequests} 个重复请求。${ledger.note}</p></div>
        ${ledger.rows.length?html`<div class="table-wrap"><table class="data-table"><caption>调用证据 · 单次失败不表示未计费</caption><thead><tr><th>场景／状态</th><th>模型</th><th>请求 ID</th><th>接口计数</th><th>计算金额（元）</th><th>核对说明</th></tr></thead><tbody>${ledger.rows.map(r=>html`<tr><td>${r.scene}<small>${r.status}</small></td><td>${r.model}</td><td>${r.requestId||'缺失'}</td><td>${Object.entries(r.usage).filter(([k])=>k!=='known').map(([k,v])=>k+': '+v).join('；')||'未知'}</td><td>${r.cost===null?'未知':fmtCny(r.cost)}</td><td>${r.reason}</td></tr>`)}</tbody></table></div>`:''}`);
      page.querySelector('[data-export-ledger]').disabled=false;
    }catch(error){mount(page.querySelector('[data-ledger]'),html`<p class="inline-error">${error.message}</p>`);}
  }
  function apply(){
    try{profile=validateProfile(JSON.parse(editor.value));mount(page.querySelector('[data-price-status]'),html`<span class="inline-ok">已应用 ${profile.rates.length} 个模型价格；null 单价仍为待填写。</span>`);}
    catch(error){profile=null;mount(page.querySelector('[data-price-status]'),html`<span class="inline-error">${error.message}</span>`);}
    calculate();
  }
  editor.addEventListener('input',()=>{profile=null;mount(page.querySelector('[data-price-status]'),html`<span class="small">编辑尚未应用。</span>`);calculate();});
  page.querySelector('[data-apply-price]').addEventListener('click',apply);
  page.querySelector('[data-template]').addEventListener('click',()=>download('aihw-prices-template.json',JSON.stringify(priceTemplate(reg,page.querySelector('[data-price-region]').value),null,2),'application/json'));
  page.querySelector('[data-price-region]').addEventListener('change',()=>{editor.value=JSON.stringify(priceTemplate(reg,page.querySelector('[data-price-region]').value),null,2);profile=null;mount(page.querySelector('[data-price-status]'),html`<span class="small">地域已改变，请填写并应用新单价表。</span>`);calculate();});
  page.querySelector('[data-price-file]').addEventListener('change',async e=>{
    try{const file=e.target.files[0];if(!file)return;if(file.size>100000)throw Error('单价表不能超过 100 KB');const text=await file.text();if(!active)return;editor.value=text;apply();}
    catch(error){if(active){profile=null;calculate();mount(page.querySelector('[data-price-status]'),html`<span class="inline-error">${error.message}</span>`);}}
    finally{e.target.value='';}
  });
  page.querySelector('[data-trace-files]').addEventListener('change',async e=>{
    try{
      const files=[...e.target.files];if(sources.length+files.length>200)throw Error('一次最多 200 份轨迹');
      const imported=[];
      for(const file of files){if(file.size>2*1024*1024)throw Error('每份轨迹最多 2 MiB');const raw=JSON.parse(await file.text());if(raw?.schema!=='aihw/trace@0.1')throw Error('轨迹格式不认识');const trace=normalizeTrace(raw);imported.push({id:'import-'+sources.length+'-'+imported.length,trace,origin:'导入轨迹（来源需核实）',selected:true});}
      if(!active)return;sources.push(...imported);renderSources();calculate();mount(page.querySelector('[data-import-status]'),html`<span class="inline-ok">已添加 ${imported.length} 份轨迹，仅存本页内存。</span>`);
    }catch(error){if(active)mount(page.querySelector('[data-import-status]'),html`<span class="inline-error">${error.message}</span>`);}
    finally{e.target.value='';}
  });
  for(const selector of ['[data-bill]','[data-bill-ref]','[data-bill-scope]'])page.querySelector(selector).addEventListener('input',calculate);
  page.querySelector('[data-export-ledger]').addEventListener('click',()=>{if(ledger)download('aihw-cost-ledger.json',JSON.stringify(ledger,null,2),'application/json');});
  page.querySelector('[data-plan-form]').addEventListener('submit',e=>{
    e.preventDefault();
    try{
      const raw=new FormData(e.target);
      const plan=validatePlan({schema:PLAN_SCHEMA,region:raw.get('region'),budget_cny:Number(raw.get('budget')),acknowledge_billing_risk:raw.has('ack'),scenes:raw.getAll('scenes').map(id=>({id,repeat:Number(raw.get('repeat')),ceiling_cny:Number(raw.get('ceiling'))}))});
      download('aihw-cost-plan.json',JSON.stringify(plan,null,2),'application/json');
      mount(page.querySelector('[data-plan-status]'),html`<span class="inline-ok">计划已导出，本页未调用模型。</span>`);
    }catch(error){mount(page.querySelector('[data-plan-status]'),html`<span class="inline-error">${error.message}</span>`);}
  });
  renderSources();calculate();
  return {cleanup(){active=false;}};
}
