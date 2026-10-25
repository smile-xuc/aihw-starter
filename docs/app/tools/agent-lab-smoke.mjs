import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import path from 'node:path';
const docs=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_CORE).href);
const server=spawn(process.env.PYTHON||'python3',['-u','-m','http.server','0','--bind','127.0.0.1','-d',docs],{stdio:['ignore','pipe','ignore']});
let browser;
try {
 const port=await new Promise((resolve,reject)=>{let text='';const timer=setTimeout(()=>reject(Error('Server timeout')),10000);server.stdout.on('data',data=>{text+=data;const match=/port (\d+)/.exec(text);if(match){clearTimeout(timer);resolve(match[1]);}});server.on('error',reject);});
 const base=`http://127.0.0.1:${port}/`;
 browser=await chromium.launch({executablePath:process.env.CHROME,args:['--no-sandbox']});
 const ctx=await browser.newContext({serviceWorkers:'block',locale:'zh-CN'}),page=await ctx.newPage(),errors=[],external=[];
 page.on('pageerror',error=>errors.push(error.message));
 await ctx.route('**/*',route=>{if(route.request().url().startsWith(base))return route.continue();external.push(route.request().url());return route.abort();});
 const go=async route=>{await page.goto(base+'app/#/'+route);await page.waitForSelector('.intro h1');};
 for(const width of [320,390,768,1024,1440]){
  await page.setViewportSize({width,height:900});
  for(const route of ['lab','lab/cli','lab/media','lab/voice','lab/visual']){
   await go(route);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${route} at ${width}`);
  }
 }
 await go('lab/cli');await page.fill('[name=input]','');await page.click('[data-command-form] button');assert.match(await page.locator('[data-command-output]').innerText(),/不能为空/);
 await page.fill('[name=input]',"it's $(echo not-run) <script>");await page.click('[data-command-form] button');assert.match(await page.locator('[data-command-output]').innerText(),/尚未执行/);assert.equal(await page.locator('[data-command-output] script').count(),0);
 await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.copied=text;}}}));await page.click('[data-copy-command]');assert.match(await page.locator('[data-copy-status]').innerText(),/已复制/);assert.match(await page.evaluate(()=>window.copied),/bl text chat/);
 await page.evaluate(()=>navigator.clipboard.writeText=async()=>{throw Error('Denied');});await page.click('[data-copy-command]');assert.match(await page.locator('[data-copy-status]').innerText(),/复制失败/);
 await page.fill('[name=input]','edited');assert.equal(await page.locator('[data-copy-command]').count(),0);
 for(const kind of ['image','asr','tts']){await page.selectOption('[name=kind]',kind);await page.click('[data-command-form] button');assert.equal(await page.locator('[data-copy-command]').count(),1);}
 await page.selectOption('[name=kind]','asr');await page.fill('[name=input]','--api-key bad');await page.click('[data-command-form] button');assert.match(await page.locator('[data-command-output]').innerText(),/本地/);
 await page.click('a.back');assert.equal(new URL(page.url()).hash,'#/lab');await page.goBack();await page.waitForSelector('[data-command-form]');
 await go('lab/media');await page.click('[data-evidence="2"]');assert.match(await page.locator('[data-evidence-detail]').innerText(),/发送回执/);await page.click('[data-zoom]');assert.equal(await page.locator('[data-zoom]').getAttribute('aria-pressed'),'true');await page.click('[data-zoom]');assert.equal(await page.locator('[data-zoom]').getAttribute('aria-pressed'),'false');
 // A missing image leaves the evidence browser usable and exposes a real retry path.
 await ctx.route('**/samples/dish.jpg',route=>route.abort());await page.reload();await page.waitForFunction(()=>document.querySelector('[data-image-status]').textContent.includes('加载失败'));assert.equal(await page.locator('[data-zoom]').isDisabled(),true);await page.click('[data-evidence=\"1\"]');assert.match(await page.locator('[data-evidence-detail]').innerText(),/抽样帧/);await ctx.unroute('**/samples/dish.jpg');await page.reload();await page.waitForSelector('[data-zoom]');assert.equal(await page.locator('[data-zoom]').isEnabled(),true);
 for(const route of ['voice','visual']){
  await go('lab/'+route);const action=async name=>page.click(`[data-event="${name}"]`);const status=()=>page.locator('[data-task-status]').innerText();
  await action('start');await action('stop-speech');assert.equal(await status(),'运行中');
  await action('permission');assert.equal(await status(),'等待批准');await action(route==='visual'?'context':'update');assert.equal(await status(),'运行中');
  if(route==='visual'){assert.match(await page.locator('.lab-frame').innerText(),/fixture-port-b/);assert.equal(await page.locator('.lab-frame img').evaluate(img=>img.complete&&img.naturalWidth>0),true);await action('expire-context');assert.equal(await status(),'等待核对新画面');assert.match(await page.locator('[data-frame-freshness]').innerText(),/已过期/);await action('stale');assert.equal(await status(),'等待核对新画面');await action('refresh-context');assert.equal(await status(),'运行中');}
  await action('stale');assert.match(await page.locator('[data-task-log]').innerText(),/忽略迟到/);
  await action('permission');await action('deny');assert.equal(await status(),'失败 / 被拒绝');await action('retry');await action('fail');await action('retry');
  await action('cancel');assert.equal(await status(),'取消待确认');await action('stale');await action('cancelled');assert.equal(await status(),'已取消');await action('retry');
  await action('permission');await action('approve');await action('talk');await action('result');await action('deliver');assert.match(await page.locator('[data-delivery]').innerText(),/尚未交付/);await action('talk');await action('deliver');assert.match(await page.locator('[data-delivery]').innerText(),/已确认/);
  const downloaded=page.waitForEvent('download');await page.click('[data-export-task]');assert.equal((await downloaded).suggestedFilename(),'aihw-agent-lab-mock.json');
  await page.click('[data-reset-task]');assert.equal(await status(),'未开始');
  await action('start');await page.click('a.back');await page.click(`a[href="#/lab/${route}"]`);await page.waitForSelector('[data-task-status]');assert.equal(await status(),'未开始');await action('start');assert.equal(await status(),'运行中');
 }
 await go('lab/missing');await page.waitForSelector('[data-route-missing]');await page.click('[data-route-missing] + a');await page.waitForSelector('a[href="#/lab"]');
 // New lab pages can still render if the legacy registry is unavailable.
 await ctx.route('**/data/registry.json',route=>route.abort());await go('lab/voice');await page.waitForSelector('[data-task-status]');
 assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
 const offline=await browser.newContext(),offlinePage=await offline.newPage();await offlinePage.goto(base+'app/#/lab');
 await offlinePage.evaluate(async()=>{await navigator.serviceWorker.ready;if(!navigator.serviceWorker.controller)await new Promise(resolve=>navigator.serviceWorker.addEventListener('controllerchange',resolve,{once:true}));});
 await offline.setOffline(true);await offlinePage.reload();await offlinePage.waitForSelector('.lab-card');await offlinePage.click('a[href="#/lab/voice"]');await offlinePage.waitForSelector('[data-task-status]');await offlinePage.click('[data-event=start]');assert.equal(await offlinePage.locator('[data-task-status]').innerText(),'运行中');await offlinePage.goto(base+'app/#/lab/visual');await offlinePage.waitForSelector('.lab-frame img');assert.equal(await offlinePage.locator('.lab-frame img').evaluate(img=>img.complete&&img.naturalWidth>0),true);await offline.close();
 if(process.env.REVIEW_SCREENSHOTS){await mkdir(process.env.REVIEW_SCREENSHOTS,{recursive:true});await go('lab');await page.screenshot({path:path.join(process.env.REVIEW_SCREENSHOTS,'lab-desktop.png'),fullPage:true});await page.setViewportSize({width:390,height:844});await go('lab/voice');await page.screenshot({path:path.join(process.env.REVIEW_SCREENSHOTS,'lab-voice-mobile.png'),fullPage:true});await go('lab/visual');await page.screenshot({path:path.join(process.env.REVIEW_SCREENSHOTS,'lab-visual-mobile.png'),fullPage:true});}
 console.log('PASS capability lab: five widths, CLI validation/copy, evidence/image, state/approval/cancel/retry/delivery, back/404, registry failure, fresh offline, zero provider requests');
} finally {await browser?.close();server.kill();}
