// Desktop/tablet, hardware planning, accounting and fresh-install offline regression.
// No API credentials or provider requests. Uses the same Playwright/Chrome as smoke.mjs.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {readFile,mkdtemp,mkdir} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {PROJECTS,hardwareTrace} from '../js/projects.js';
import {CATEGORY_BUSINESS} from '../js/positioning.js';

const here=path.dirname(fileURLToPath(import.meta.url)),docs=path.resolve(here,'../..');
const temp=await mkdtemp(path.join(os.tmpdir(),'aihw-workspace-'));
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_CORE||'playwright-core').href);
const child=spawn(process.env.PYTHON||'python3',['-u','-m','http.server','0','--bind','127.0.0.1','--directory',docs],{stdio:['ignore','pipe','ignore']});
let browser;
try {
  const port=await new Promise((resolve,reject)=>{
    let output='';const timer=setTimeout(()=>reject(Error('Static server timeout')),10000);
    child.stdout.on('data',chunk=>{output+=chunk;const found=/port (\d+)/.exec(output);if(found){clearTimeout(timer);resolve(found[1]);}});
    child.on('error',error=>{clearTimeout(timer);reject(error);});
    child.on('exit',code=>{clearTimeout(timer);reject(Error('Static server exited '+code));});
  });
  const base='http://127.0.0.1:'+port+'/app/';
  browser=await chromium.launch({executablePath:process.env.CHROME||'/usr/bin/google-chrome',args:['--no-sandbox']});
  const context=await browser.newContext({viewport:{width:1440,height:900},locale:'zh-CN',serviceWorkers:'block',reducedMotion:'reduce'});
  const page=await context.newPage(),errors=[],external=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('request',request=>{if(!request.url().startsWith(base)&&!request.url().startsWith('blob:')&&!request.url().startsWith('data:'))external.push(request.url());});
  await context.route('**/*',(route,request)=>request.url().startsWith(base)||request.url().startsWith('blob:')||request.url().startsWith('data:')?route.continue():route.abort());
  async function go(route,selector){
    await page.goto(base+'#/'+route);
    await page.waitForSelector(selector,{state:selector==='.stage'?'attached':'visible'}).catch(error=>{throw Error(route+' at '+page.viewportSize().width+': '+error.message);});
  }
  async function fits(label){
    const size=await page.evaluate(()=>({actual:document.documentElement.scrollWidth,width:innerWidth}));
    assert.ok(size.actual<=size.width+1,label+' overflows '+JSON.stringify(size));
  }
  const routes=[['','.featured-card'],...Object.keys(CATEGORY_BUSINESS).map(id=>['c/'+id,'[data-case]']),['s/02-ai-glasses.bailian/default','.stage'],['s/07-recorder.bailian/default','.stage'],['me','form[data-form]'],['hardware','[data-project-card]'],...PROJECTS.map(p=>['hardware/'+p.id,'[data-budget-form]']),['cost-lab','[data-price-editor]']];
  for(const [width,height] of [[320,740],[390,844],[768,1024],[1024,768],[1280,900],[1440,900]]){
    await page.setViewportSize({width,height});
    for(const [route,selector] of routes){await go(route,selector);await fits(width+' '+route);}
    const layout=await page.evaluate(()=>({shell:document.querySelector('.shell').getBoundingClientRect().width,nav:getComputedStyle(document.querySelector('.bottom-nav')).position,items:document.querySelectorAll('[data-nav]').length}));
    assert.equal(layout.items,4);
    if(width>=768){assert.ok(layout.shell>540);assert.equal(layout.nav,'sticky');}
    else assert.equal(layout.nav,'fixed');
  }
  await go('','.cat-card');
  assert.equal(await page.locator('.cat-card').count(),9);
  assert.doesNotMatch((await page.locator('.cat-card').allTextContents()).join('\n'),/demo|待真 Key|待实测|商用候选|开发者参考实现/);
  // A sold developer platform belongs to both filters; a limited SDK token does not.
  await go('c/05-desktop-pet','[data-case="stackchan"]');
  await page.click('[data-project-filter="commercial"]');
  assert.equal(await page.locator('[data-case="stackchan"]').isVisible(),true);
  assert.equal(await page.locator('[data-case="electronbot"]').isVisible(),false);
  await page.click('[data-project-filter="developer"]');
  assert.equal(await page.locator('[data-case="stackchan"]').isVisible(),true);
  assert.equal(await page.locator('[data-case="electronbot"]').isVisible(),true);
  assert.equal(await page.locator('[data-case="emo"]').isVisible(),false);
  await page.click('[data-project-filter="all"]');assert.equal(await page.locator('[data-case]:visible').count(),3);
  await go('c/04-agent-hardware','[data-case="muse-gadget-sdk-token"]');
  await page.click('[data-project-filter="commercial"]');assert.equal(await page.locator('[data-case="muse-gadget-sdk-token"]').isVisible(),false);
  await page.click('[data-project-filter="developer"]');assert.equal(await page.locator('[data-case="muse-gadget-sdk-token"]').isVisible(),true);
  await go('hardware','[data-project-card]');
  assert.equal(await page.locator('[data-reference-design]').count(),3);
  assert.equal(await page.locator('[data-upstream-basis]').count(),3);
  assert.equal(await page.locator('[data-integration-boundary]').count(),3);
  assert.equal(await page.locator('[data-delivery-evidence]').count(),3);
  await page.locator('[data-nav="hardware"]').focus();await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(()=>document.activeElement.dataset.nav),'cost-lab');
  for(const project of PROJECTS){
    await go('hardware/'+project.id,'[data-budget-form]');
    await page.click('[data-simulate]');
    assert.match(await page.locator('[data-hardware-outcome]').innerText(),/演练|模拟/);
    const promise=page.waitForEvent('download');await page.click('[data-hardware-outcome] [data-export]');
    const d=await promise;const saved=path.join(temp,project.id+'.json');await d.saveAs(saved);
    assert.equal(JSON.parse(await readFile(saved,'utf8')).mode,'mock');
    await page.click('[data-offline]');
    assert.match(await page.locator('[data-hardware-outcome]').innerText(),project.id==='skainet-control'?/LED|白名单/:/断网|停止/);
    await page.locator('[name="cloud"]').fill('');assert.match(await page.locator('[data-hardware-budget]').innerText(),/未知/);
    await page.locator('[name="cloud"]').fill('0');assert.doesNotMatch(await page.locator('[data-hardware-budget]').innerText(),/未知/);
    await page.locator('[name="hourly"]').fill('');assert.match(await page.locator('[data-hardware-budget]').innerText(),/空值不是零/);
  }
  await go('cost-lab','[data-price-editor]');
  const prices=JSON.parse(await readFile(path.join(here,'cost-fixtures/prices-example.json'),'utf8'));
  prices.demo=false;prices.title='Synthetic accounting only';prices.source='Synthetic fixture; no actual calls';
  await page.locator('[data-price-editor]').fill(JSON.stringify(prices));await page.click('[data-apply-price]');
  const live={...hardwareTrace(PROJECTS[2]),mode:'live',region:'cn-beijing',ran_at:'2026-10-04T01:00:00Z',status:'success'};
  live.result.usageRecords=[{model:prices.rates[0].model,requestId:'synthetic-request-1',usage:{known:true,prompt:1000,completion:100}}];
  live.result.text='PRIVATE_ANSWER';live.outputs[0].text='PRIVATE_ANSWER';live.result.credentials='PRIVATE_CREDENTIAL';
  const mock={...live,mode:'mock'};
  const file=(name,value)=>({name,mimeType:'application/json',buffer:Buffer.from(JSON.stringify(value))});
  await page.locator('[data-trace-files]').setInputFiles([file('live.json',live),file('duplicate.json',live),file('mock.json',mock)]);
  await page.waitForSelector('[data-source-index="2"]');
  assert.equal(await page.locator('[data-source-index]').count(),3);
  async function report(){
    const promise=page.waitForEvent('download');await page.click('[data-export-ledger]');
    const d=await promise,file=path.join(temp,'ledger-'+Date.now()+'.json');await d.saveAs(file);
    const text=await readFile(file,'utf8');assert.ok(!text.includes('PRIVATE_'));
    return JSON.parse(text);
  }
  let ledger=await report();assert.equal(ledger.rows.length,1);assert.equal(ledger.duplicateRequests,1);assert.equal(ledger.excludedMock,1);assert.ok(ledger.total>0);assert.equal(ledger.bill.amount,null);
  await page.locator('[data-bill]').fill('0');assert.equal((await report()).bill.difference,null);
  await page.locator('[data-bill-scope]').check();assert.ok((await report()).bill.difference<0);
  await page.locator('[data-trace-files]').setInputFiles([file('valid.json',live),file('invalid.json',{schema:'bad'})]);
  await page.locator('[data-import-status]').filter({hasText:'格式'}).waitFor();
  assert.equal(await page.locator('[data-source-index]').count(),3);assert.match(await page.locator('[data-import-status]').innerText(),/格式/);
  const conflict=structuredClone(live);conflict.result.usageRecords[0].usage.prompt=3;
  await page.locator('[data-trace-files]').setInputFiles(file('conflict.json',conflict));await page.waitForSelector('[data-source-index="3"]');assert.equal((await report()).total,null);
  await page.locator('[data-price-file]').setInputFiles({name:'large.json',mimeType:'application/json',buffer:Buffer.alloc(100001)});
  assert.equal(await page.locator('[data-export-ledger]').isDisabled(),true);
  assert.match(await page.locator('[data-price-status]').innerText(),/100 KB/);
  await page.locator('[data-price-editor]').fill('{');await page.click('[data-apply-price]');assert.equal(await page.locator('[data-export-ledger]').isDisabled(),true);
  await page.locator('[name="budget"]').fill('0.1');await page.locator('[data-plan-form] button[type="submit"]').click();assert.match(await page.locator('[data-plan-status]').innerText(),/超过预算/);
  await page.locator('[name="budget"]').fill('0.2');
  const planDownload=page.waitForEvent('download');await page.locator('[data-plan-form] button[type="submit"]').click();
  const pd=await planDownload,planFile=path.join(temp,'plan.json');await pd.saveAs(planFile);
  const plan=JSON.parse(await readFile(planFile,'utf8'));assert.equal(plan.scenes.length,2);assert.equal(plan.acknowledge_billing_risk,false);
  await page.emulateMedia({colorScheme:'dark'});await fits('dark OS, light cost lab');
  assert.equal(await page.evaluate(()=>getComputedStyle(document.documentElement).colorScheme),'light');
  if(process.env.REVIEW_SCREENSHOTS){
    await mkdir(process.env.REVIEW_SCREENSHOTS,{recursive:true});
    for(const [name,route,width,height,selector] of [['desktop-category','c/05-desktop-pet',1440,900,'[data-case]'],['phone-category','c/03-toys-companion',390,844,'[data-case]'],['desktop-hardware','hardware',1440,900,'[data-project-card]'],['pad-experience','s/02-ai-glasses.bailian/default',1024,768,'.stage'],['phone-cost','cost-lab',390,844,'[data-price-editor]']]){
      await page.emulateMedia({colorScheme:'light'});await page.setViewportSize({width,height});await go(route,selector);
      await page.screenshot({path:path.join(process.env.REVIEW_SCREENSHOTS,name+'.png'),fullPage:true});
    }
  }
  assert.deepEqual(errors,[]);assert.deepEqual(external,[]);await context.close();
  // Seed an old app cache and another same-origin application before first registration.
  const offline=await browser.newContext({viewport:{width:1024,height:768},serviceWorkers:'allow'});
  const op=await offline.newPage();await op.goto(base+'icons/icon-192.png');
  await op.evaluate(async()=>{await (await caches.open('aihw-app-v13')).put('old',new Response('old'));await (await caches.open('other-app-sentinel')).put('sentinel',new Response('keep'));});
  await op.goto(base);await op.waitForSelector('.featured-card');
  await op.evaluate(async()=>{await navigator.serviceWorker.ready;if(!navigator.serviceWorker.controller)await new Promise(resolve=>navigator.serviceWorker.addEventListener('controllerchange',resolve,{once:true}));});
  const cache=await op.evaluate(async()=>({names:await caches.keys(),urls:(await (await caches.open('aihw-app-v14')).keys()).map(r=>r.url)}));
  assert.ok(cache.names.includes('other-app-sentinel'));assert.ok(!cache.names.includes('aihw-app-v13'));
  for(const asset of ['js/realtime-meeting.js','js/live/realtime-asr.js','js/live/microphone.js','js/live/pcm.js','js/live/pcm-worklet.js','js/meeting-evidence.js','js/photo-questions.js','js/photo-results.js','js/meeting-results.js','js/live/audio-channels.js','js/live/file-transcription.js','js/projects.js','js/positioning.js','js/cost.js','js/pages/hardware.js','js/pages/cost-lab.js','data/registry.json'])assert.ok(cache.urls.includes(base+asset),asset+' not precached');
  await offline.setOffline(true);
  for(const [route,selector] of [['c/05-desktop-pet','[data-case="stackchan"]'],['hardware','[data-project-card]'],...PROJECTS.map(p=>['hardware/'+p.id,'[data-budget-form]']),['cost-lab','[data-price-editor]']]){
    await op.goto(base+'#/'+route);await op.reload();await op.waitForSelector(selector);
    assert.doesNotMatch(await op.locator('body').innerText(),/数据暂时不可用/);
  }
  await offline.close();
  console.log('Workspace smoke OK: '+routes.length*6+' viewport/routes, project classification and filters, budgets, mock exports, accounting, plan, keyboard, dark OS with light palette and actual SW v14 offline.');
} finally {
  await browser?.close();child.kill();
}
