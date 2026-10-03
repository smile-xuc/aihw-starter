import { PROJECTS, POSITION, REVIEW_DATE, hardwareEstimate, hardwareTrace } from '../projects.js';
import { html, icon, mountPage, mount, fmtYuan } from '../ui.js';
import { renderOutcome } from '../experience.js';

const money=values=>fmtYuan(values);
const badge=p=>html`<span class="chip ${POSITION[p.position].cls}">${POSITION[p.position].label}</span>`;
export function renderHardware(view,reg,id) {
  document.title='AIHW · 硬件方案';
  const project=PROJECTS.find(p=>p.id===id);
  if(id&&!project){mountPage(view,html`<h1>没有这个硬件方案</h1><a href="#/hardware">返回硬件方案</a>`);return;}
  if(!project){
    const page=mountPage(view,html`<header class="page-head"><p class="eyebrow">从网页能力到设备</p><h1>先验证链路，再决定做什么硬件。</h1><p>三条 ESP32 路线。把代码许可、原型成本、研发工作与尚未验证的环节放在一起 review。</p></header>
      <p class="info-note">上游资料核对：${REVIEW_DATE} · BOM 是人民币单台原型采购估算，非供应商报价或量产 BOM。当前没有板卡联调与量产证据。</p>
      <div class="filter-row" role="group" aria-label="项目定位筛选"><button class="chip accent" data-position="all" aria-pressed="true">全部 3 条路线</button><button class="chip" data-position="demo" aria-pressed="false">社区 demo</button><button class="chip" data-position="candidate" aria-pressed="false">商用候选</button></div>
      <div class="project-grid">${PROJECTS.map(p=>html`<article class="project-card panel" data-project-card data-position-kind="${p.position}"><div class="chips">${badge(p)}<span class="chip">实机待验证</span></div><h2><a href="#/hardware/${p.id}">${p.title}</a></h2><p>${p.summary}</p><dl class="kv"><dt>原型材料</dt><dd>${money(hardwareEstimate(p).bom)} / 台</dd><dt>软件许可</dt><dd>${p.license}</dd><dt>研发工时</dt><dd>${p.hours[0]}–${p.hours[1]} 小时（规划估算）</dd></dl><a class="secondary-action block" href="#/hardware/${p.id}">链路、BOM 与验收 ${icon('chevron')}</a></article>`)}</div>
      <section class="section panel"><h2>定位如何判断</h2><p><strong>社区 demo</strong>：主要验证能力，交付与生产限制尚未解决。<strong>商用候选</strong>：核心组件许可可评估用于产品，但未完成产品化。当前没有项目被标成“已商业化产品”。</p><p>软件许可、第三方服务条款、硬件生产、可靠性、隐私与售后分别 review。许可证允许使用不等于完整产品已经可售。</p><a href="#/cost-lab">打开跑测账本，准备模型费用核对</a></section>`);
    page.querySelectorAll('[data-position]').forEach(button=>button.addEventListener('click',()=>{
      const kind=button.dataset.position;
      page.querySelectorAll('[data-position]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
      page.querySelectorAll('[data-project-card]').forEach(card=>card.hidden=kind!=='all'&&card.dataset.positionKind!==kind);
    }));
    return;
  }
  document.title=project.title+' · AIHW';
  const page=mountPage(view,html`<div class="subbar"><a class="back-link" href="#/hardware">${icon('back')}全部硬件方案</a></div>
    <header class="page-head"><div class="chips">${badge(project)}<span class="chip warn">板卡／量产待验证</span></div><h1>${project.title}</h1><p>${project.summary}</p></header>
    <section class="section"><div class="section-title"><h2>一条完整链路</h2><small>设计路线，非实机结果</small></div><ol class="chain">${project.chain.map((s,i)=>html`<li><b>${i+1}</b><span>${s}</span></li>`)}</ol><p class="info-note">${project.board}</p>
      <div class="btn-row"><a class="primary-action" href="#/s/${project.scene}/${project.variant}">先验证网页能力</a><button class="secondary-action" data-simulate>免费演练链路</button><button class="secondary-action" data-offline>模拟断网</button></div><p class="small">链路演练使用固定事件，不联网、不连接板卡。网页能力的回放／真跑范围见各方案说明。</p><div data-hardware-outcome></div></section>
    <div class="hardware-workspace"><section class="section"><div class="section-title"><h2>原型 BOM 与软硬成本</h2></div>
      <div class="table-wrap"><table class="data-table"><caption>人民币／单台原型采购估算；套件包含的部件不重复相加</caption><thead><tr><th>部件</th><th>规划区间</th></tr></thead><tbody>${project.bom.map(row=>html`<tr><td>${row[0]}</td><td>${money(row.slice(1))}</td></tr>`)}</tbody></table></div>
      <form class="panel" data-budget-form><div class="form-grid">
        <label class="field">原型台数<input name="units" type="number" min="1" max="10000" step="1" value="1"></label>
        <label class="field">研发工时单价（元／小时）<input name="hourly" type="number" min="0" max="10000" value="120"></label>
        <label class="field">单次云费（元）<input name="cloud" type="number" min="0" max="10000" step="any" value="${project.id==='skainet-control'?'0':''}" placeholder="待你提供实测或预算值"></label>
        <label class="field">每台每天调用次数<input name="uses" type="number" min="0" max="100000" step="1" value="30"></label></div>
        <p class="small">默认 120 元／小时只是可编辑的规划假设。运行单价需填入自己的实测或预算值，填写不改变验证状态。纯离线控制默认没有云推理费。</p></form>
      <div class="panel" data-hardware-budget aria-live="polite"></div>
      <p class="small">费用包含材料、研发工时、原型治具 ${money(project.tooling)} 与共享测试服务器 ${money(project.serverMonthly)}／月。服务器不是逐设备重复购买。生产 PCB、模具、认证、税运、损耗、移动流量和售后另行报价；这个总额不能代替量产成本。</p></section>
      <section class="section"><div class="section-title"><h2>研发节奏与验收</h2></div>${project.tasks.map(t=>html`<div class="panel"><h3>${t[0]} · ${t[1]}–${t[2]} 周</h3><p>${t[3]}</p></div>`)}<p class="small">按有嵌入式与服务端经验的 1–2 人小组、部分并行估算；等待采购、返板和认证不保证包含在周期内。工时与日历周分别估算，不把它们直接相乘。</p><div class="panel"><h3>完成标准</h3><ul>${project.acceptance.map(s=>html`<li>${s}</li>`)}</ul></div></section></div>
    <section class="section panel"><h2>从代码到实物</h2><ol class="readable-list">${project.build.map(s=>html`<li>${s}</li>`)}</ol><h3>目前的缺口</h3><ul>${project.gaps.map(s=>html`<li>${s}</li>`)}</ul></section>
    <section class="section panel"><h2>社区与商业化 review</h2><p><strong>${project.license}</strong></p><p>${project.licenseNote}</p><p>结论：${POSITION[project.position].note}</p><a href="#/cost-lab">软件调用成本与账单核对</a></section>
    <section class="section"><div class="section-title"><h2>可复核的上游依据</h2><small>${REVIEW_DATE} 核对</small></div><div class="link-list">${project.sources.map(s=>html`<a href="${s.url}" rel="noopener"><span>${s.title}<small> · ${s.commit.slice(0,7)}</small></span>${icon('link')}</a>`)}</div></section>`);
  const form=page.querySelector('[data-budget-form]');
  form.addEventListener('submit',e=>e.preventDefault());
  const calculate=()=>{
    try{
      const raw=new FormData(form);
      if(['units','hourly','uses'].some(k=>raw.get(k)===''))throw Error('请填写数量、工时单价与日调用次数；空值不是零成本');
      const result=hardwareEstimate(project,{units:Number(raw.get('units')),hourly:Number(raw.get('hourly')),usesPerDay:Number(raw.get('uses')),cloudPerUse:raw.get('cloud')===''?null:Number(raw.get('cloud'))});
      mount(page.querySelector('[data-hardware-budget]'),html`<dl class="kv"><dt>材料小计</dt><dd>${money(result.hardware)}</dd><dt>研发＋治具</dt><dd>${money(result.nre)}</dd><dt>共享测试服务器／年</dt><dd>${money(result.service)}</dd><dt>云调用／年</dt><dd>${result.cloud===null?'尚未填写，不能算完整总额':money(result.cloud)}</dd><dt>已纳入项小计</dt><dd>${money(result.subtotal)}（不含云调用）</dd><dt>首年规划总额</dt><dd>${result.total?money(result.total):'未知：缺少云调用单价'}</dd></dl>`);
    }catch(error){mount(page.querySelector('[data-hardware-budget]'),html`<p class="inline-error">${error.message}</p>`);}
  };
  form.addEventListener('input',calculate);calculate();
  const simulate=offline=>renderOutcome(page.querySelector('[data-hardware-outcome]'),hardwareTrace(project,{offline}));
  page.querySelector('[data-simulate]').addEventListener('click',()=>simulate(false));
  page.querySelector('[data-offline]').addEventListener('click',()=>simulate(true));
}
