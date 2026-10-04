// Browser sample runner. Default is local mocks; credentials are never command arguments or saved.
import {spawn} from 'node:child_process';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {executePlan,validatePlan,validateProfile} from '../js/cost.js';
import {safeTrace} from '../js/experience.js';

const args=process.argv.slice(2),flags={};
for(let i=0;i<args.length;i++){
  const name=args[i];
  if(['--live','--mock'].includes(name)){flags[name]=true;continue;}
  if(!['--plan','--prices','--out'].includes(name)||!args[i+1])throw Error('参数：--plan 文件 --prices 文件 --out 新目录 [--mock | --live]');
  flags[name]=args[++i];
}
if(flags['--live']&&flags['--mock'])throw Error('live 与 mock 不能同时指定');
const mode=flags['--live']?'live':'mock';
const here=path.dirname(fileURLToPath(import.meta.url)),docs=path.resolve(here,'../..'),repo=path.resolve(docs,'..');
const children=[];
let browser;
async function server(argv,pattern){
  const childEnv=Object.fromEntries(Object.entries(process.env).filter(([name])=>!name.startsWith('DASHSCOPE_')));
  const child=spawn(process.env.PYTHON||'python3',argv,{cwd:repo,env:{...childEnv,PYTHONDONTWRITEBYTECODE:'1'},stdio:['ignore','pipe','pipe']});children.push(child);
  return new Promise((resolve,reject)=>{
    let data='';const timer=setTimeout(()=>reject(Error('本地服务启动超时')),10000);
    child.stdout.on('data',chunk=>{data+=chunk.toString();const found=pattern.exec(data);if(found){clearTimeout(timer);resolve(Number(found[1]));}});
    child.on('error',error=>{clearTimeout(timer);reject(error);});
    child.on('exit',code=>{clearTimeout(timer);if(code!==null)reject(Error('本地服务退出：'+code));});
    child.stderr.resume();
  });
}
try{
  if(!flags['--plan']||!flags['--prices'])throw Error('请提供计划与单价表；本页不读取任何凭证文件。');
  const plan=validatePlan(JSON.parse(await readFile(flags['--plan'],'utf8')));
  const prices=validateProfile(JSON.parse(await readFile(flags['--prices'],'utf8')));
  if(prices.region!==plan.region)throw Error('计划地域与单价表不一致');
  const registry=JSON.parse(await readFile(path.join(docs,'app/data/registry.json'),'utf8'));
  const key=mode==='live'?process.env.DASHSCOPE_API_KEY:'sk-apptest0000000001';
  const workspace=mode==='live'?process.env.DASHSCOPE_WORKSPACE_ID:'llm-apptest';
  if(mode==='live'){
    if(!key||!workspace)throw Error('真实模式需要环境中的 DASHSCOPE_API_KEY 与 DASHSCOPE_WORKSPACE_ID；请安全配置，勿写入命令或文件。');
    if(process.env.DASHSCOPE_API_REGION&&process.env.DASHSCOPE_API_REGION!==plan.region)throw Error('环境凭证地域与计划不一致');
    if(prices.demo||!plan.acknowledge_billing_risk||!prices.source||!prices.title)throw Error('尚未确认价格与计费风险，拒绝真实请求');
    for(const scene of plan.scenes){
      const c=JSON.parse(await readFile(path.join(docs,'app/live-data/'+scene.id+'.json'),'utf8'));
      const models=scene.id.startsWith('02-')?[c.OMNI_MODEL,...(plan.region==='cn-beijing'?[c.TTS_MODEL]:[])]:scene.id.startsWith('07-')?[c.ASR_MODEL,c.LLM_MODEL]:(registry.solutions.find(s=>s.id===scene.id)?.models||[]).filter(m=>!m.regions||m.regions.includes(plan.region)).map(m=>m.id);
      for(const model of models){
        const rate=prices.rates.find(r=>r.model===model),parts=rate?.components||rate?.tiers.flatMap(t=>t.components);
        if(!parts?.length||parts.some(c=>c.price===null))throw Error('真实请求前必须填齐所选路线可能使用的全部单价：'+model);
      }
    }
  }
  // Reserve outputs without overwriting previous runs; validate before any paid transport exists.
  const output=path.resolve(flags['--out']||path.join('/tmp','aihw-cost-run-'+Date.now()));
  await mkdir(output,{recursive:false});
  const port=await server(['-u','-m','http.server','0','--bind','127.0.0.1','--directory',docs],/port (\d+)/);
  const fakePort=mode==='mock'?await server(['-u',path.join(here,'fake_bailian.py'),'--port','0'],/127\.0\.0\.1:(\d+)/):null;
  const base='http://127.0.0.1:'+port+'/app/';
  const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_CORE||'/workspace/aihw-cloud-tools/pw/node_modules/playwright-core/index.mjs').href);
  browser=await chromium.launch({executablePath:process.env.CHROME||'/usr/bin/chromium',args:['--no-sandbox']});
  const context=await browser.newContext({viewport:{width:1280,height:900},locale:'zh-CN',serviceWorkers:'block',reducedMotion:'reduce'});
  const page=await context.newPage();
  let current='',requests=0;
  const allowed=/^https:\/\/(dashscope\.aliyuncs\.com|dashscope-intl\.aliyuncs\.com|[a-z0-9-]+\.(cn-beijing|ap-southeast-1)\.maas\.aliyuncs\.com)\//;
  const cors={'access-control-allow-origin':'*','access-control-allow-headers':'authorization,content-type,x-dashscope-sse','access-control-allow-methods':'GET,POST'};
  await context.route('**/*',async(route,req)=>{
    if(req.url().startsWith(base)||req.url().startsWith('blob:')||req.url().startsWith('data:'))return route.continue();
    if(!allowed.test(req.url()))return route.abort();
    if(req.method()==='OPTIONS')return mode==='mock'?route.fulfill({status:204,headers:cors}):route.continue();
    if(++requests>100)return route.abort();
    if(mode==='live')return route.continue();
    const u=new URL(req.url());
    const response=await fetch('http://127.0.0.1:'+fakePort+'/'+current+u.pathname,{method:req.method(),headers:req.headers(),body:req.postDataBuffer()});
    return route.fulfill({status:response.status,headers:{...cors,'content-type':response.headers.get('content-type')||'application/json'},body:Buffer.from(await response.arrayBuffer())});
  });
  await page.goto(base);await page.waitForSelector('.featured-card');
  await page.evaluate(values=>localStorage.setItem('aihw.credentials.bailian',JSON.stringify({values})),{DASHSCOPE_API_KEY:key,DASHSCOPE_API_REGION:plan.region,DASHSCOPE_WORKSPACE_ID:workspace});
  const report=await executePlan(plan,prices,async(id,index)=>{
    current=id;requests=0;
    if(mode==='mock')await fetch('http://127.0.0.1:'+fakePort+'/'+id+'/reset',{method:'POST'});
    await page.goto(base+'#/s/'+id+'/default');
    await page.waitForSelector('[data-act="live"]');
    const before=await page.evaluate(()=>JSON.parse(localStorage.getItem('aihw.history.v1')||'[]')[0]?.id);
    await page.click('[data-act="live"]');await page.click('[data-sheet="go"]');
    try{await page.waitForSelector('[data-outcome] [data-export]',{timeout:180000});}
    catch(error){
      await page.locator('[data-act="stop"]').click().catch(()=>{});
      await page.waitForSelector('[data-outcome] [data-export]',{timeout:10000});
    }
    const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('aihw.history.v1')||'[]')[0]);
    if(!saved||saved.id===before)throw Error('调用后没有新的可审计记录；停止本批，不重试。');
    const trace=safeTrace(saved.trace,[key]);
    if(mode==='mock')trace.mode='mock';
    await writeFile(path.join(output,id+'-'+(index+1)+'.json'),JSON.stringify(trace,null,2),{flag:'wx'});
    return trace;
  },{mode});
  const {traces,...summary}=report;
  await writeFile(path.join(output,'report.json'),JSON.stringify(summary,null,2),{flag:'wx'});
  console.log('已完成 '+report.completed+' 次 '+mode+' 样本；'+(report.stopped||'计划执行结束')+'。输出：'+output);
  if(mode==='mock')console.log('所有官方域名请求均转交本地假接口；轨迹标为 mock，不能作为费用实测。');
  if(mode==='live'&&report.stopped)process.exitCode=2;
}catch(error){
  // Do not expose provider error bodies, credentials, process environment, or screenshots.
  const message=String(error.message).split(process.env.DASHSCOPE_API_KEY||'\0').join('[已隐藏]').replace(/\bsk-[A-Za-z0-9_-]{10,}/g,'[已隐藏]');
  console.error(message);process.exitCode=1;
}finally{
  await browser?.close().catch(()=>{});
  for(const child of children)child.kill();
}
