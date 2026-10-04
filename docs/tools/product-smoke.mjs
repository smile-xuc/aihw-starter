// Product journeys and first-visit offline caching. No credentials or model requests.
// PLAYWRIGHT_CORE=/path/to/playwright-core/index.mjs CHROME=/usr/bin/chromium node docs/tools/product-smoke.mjs
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

const docs=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const registry=JSON.parse(await readFile(path.join(docs,'app/data/registry.json'),'utf8'));
const {chromium}=await import(process.env.PLAYWRIGHT_CORE?pathToFileURL(process.env.PLAYWRIGHT_CORE).href:'playwright-core');
// A server-side failure also reaches Service Worker requests, which Playwright routes cannot intercept.
const python=String.raw`
import http.server,json,sys,urllib.parse
class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self,*args,**kwargs): super().__init__(*args,directory=sys.argv[1],**kwargs)
    def log_message(self,*args): pass
    def do_GET(self):
        parsed=urllib.parse.urlsplit(self.path)
        if parsed.path=='/__product_test__/fault':
            self.server.failed_path=urllib.parse.parse_qs(parsed.query).get('path',[''])[0]
            self.send_response(200);self.end_headers();self.wfile.write(b'ok');return
        if parsed.path==self.server.failed_path:
            self.send_response(503);self.end_headers();self.wfile.write(b'Intentional local cache regression failure');return
        super().do_GET()
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),Handler)
server.failed_path=''
print('port '+str(server.server_address[1]),flush=True)
server.serve_forever()
`;
const child=spawn(process.env.PYTHON||'python3',['-u','-c',python,docs],{stdio:['ignore','pipe','pipe']});
const errors=[],external=[];
let browser;
try{
  const port=await new Promise((resolve,reject)=>{
    let output='',stderr='';
    const timer=setTimeout(()=>reject(Error('Product server timeout: '+stderr)),10000);
    child.stderr.on('data',chunk=>{stderr+=chunk;});
    child.stdout.on('data',chunk=>{output+=chunk;const match=/port (\d+)/.exec(output);if(match){clearTimeout(timer);resolve(match[1]);}});
    child.on('error',error=>{clearTimeout(timer);reject(error);});
    child.on('exit',code=>{clearTimeout(timer);reject(Error('Product server exited '+code+': '+stderr));});
  });
  const base='http://127.0.0.1:'+port+'/',app=base+'app/';
  browser=await chromium.launch({executablePath:process.env.CHROME||'/usr/bin/google-chrome',args:['--no-sandbox']});
  async function context(options={}){
    const ctx=await browser.newContext({viewport:{width:1440,height:1000},locale:'zh-CN',reducedMotion:'reduce',serviceWorkers:'block',...options});
    await ctx.route('**/*',(route,request)=>{
      const url=request.url();if(url.startsWith(base)||/^(data:|blob:)/.test(url))return route.continue();
      external.push(url);return route.abort();
    });
    ctx.on('page',page=>{page.setDefaultTimeout(8000);page.on('pageerror',error=>errors.push(error.message));});
    return ctx;
  }
  async function keyClick(page,selector){await page.locator(selector).first().focus();await page.keyboard.press('Enter');}
  async function mounted(page,selector){
    await page.locator(selector).first().waitFor({state:selector==='.stage'?'attached':'visible'});
    await page.waitForFunction(()=>document.activeElement?.id==='view');
  }
  async function fits(page,label){
    const size=await page.evaluate(()=>({width:innerWidth,actual:document.documentElement.scrollWidth}));
    assert.ok(size.actual<=size.width+1,label+' horizontal overflow '+JSON.stringify(size));
  }
  async function returnLink(page){
    const link=page.locator('[data-site-home]');
    assert.equal(await link.count(),1);assert.equal(await link.getAttribute('href'),'../');
    assert.equal(await link.evaluate(node=>node.href),base);
    await page.evaluate(()=>window.scrollTo(0,document.documentElement.scrollHeight));
    const hit=await link.evaluate(node=>{
      const rect=node.getBoundingClientRect(),top=document.elementFromPoint(rect.left+rect.width/2,rect.top+rect.height/2);
      return rect.top>=0&&rect.bottom<=innerHeight&&top?.closest('[data-site-home]')===node;
    });
    assert.equal(hit,true,'Website return remains visible and clickable after scrolling');
  }
  const routes=[['','.featured-card'],...registry.categories.map(category=>['c/'+category.id,'[data-case]']),
    ...registry.solutions.flatMap(solution=>solution.experience.variants.map(variant=>['s/'+solution.id+'/'+variant.id,'.stage'])),
    ['hardware','[data-project-card]'],...['xiaozhi-voice','skainet-control','camera-question'].map(id=>['hardware/'+id,'[data-budget-form]']),
    ['cost-lab','[data-price-editor]'],['me','form[data-form]']];
  const main=await context(),page=await main.newPage();
  for(const [width,height] of [[320,740],[390,844],[768,1024],[1024,768],[1440,1000]]){
    await page.setViewportSize({width,height});await page.goto(base);
    await keyClick(page,'a.button-primary[href="app/"]');await mounted(page,'.featured-card');
    for(const [route,selector] of routes){
      await page.goto(app+'#/'+route);await mounted(page,selector);await fits(page,width+' '+route);await returnLink(page);
      await keyClick(page,'[data-site-home]');await page.waitForURL(base);await page.locator('h1').waitFor();
      await page.goBack();await mounted(page,selector);
    }
    for(const [file,back] of [['omni-runtime-host.html','[data-home-link]'],['kv-cache-quantization.html','.article-home-nav a']]){
      await page.goto(base);await keyClick(page,'a[href="'+file+'"]');await page.locator('h1').waitFor();
      await keyClick(page,back);await page.waitForURL(base);
    }
  }
  console.log('Product routes OK: '+routes.length*5+' route/viewport returns and both article return links.');

  for(const route of ['%','unknown-path','c/missing','s/missing','s/02-ai-glasses.bailian/not-a-variant','hardware/missing']){
    await page.goto(app+'#/'+route);await mounted(page,'[data-route-missing]');await returnLink(page);
    await keyClick(page,'[data-nav="home"]');await mounted(page,'.featured-card');
  }
  // Leaving setup without saving returns to the exact draft and never initiates a call.
  const inputs=[['02-ai-glasses.bailian','dish.jpg','image'],['07-recorder.bailian','ask_dish.wav','audio']];
  for(const [id,file,kind] of inputs){
    await page.goto(app+'#/s/'+id+'/default');await mounted(page,'[data-reset]');await page.locator('[data-reset]').click();
    await page.locator('[data-source="own"]').click();
    await page.locator('[data-material]').setInputFiles(path.join(docs,'app/data/assets/02-ai-glasses.bailian/samples',file));
    await page.locator('[data-material-status] .inline-ok').waitFor();
    if(kind==='image')await page.locator('[data-question]').fill('保留这张照片和这个问题，暂不配置 Key。');
    await keyClick(page,'.live-bar a[href^="#/me?"]');await mounted(page,'[data-return-experience]');
    assert.equal(await page.locator('[data-return-experience]').getAttribute('href'),'#/s/'+id+'/default');
    await keyClick(page,'[data-return-experience]');await mounted(page,'[data-material]');
    assert.equal(await page.locator('[data-source="own"]').getAttribute('aria-pressed'),'true');
    assert.match(await page.locator('[data-preview]').innerText(),new RegExp(file.replace('.','\\.')));
    if(kind==='image')assert.equal(await page.locator('[data-question]').inputValue(),'保留这张照片和这个问题，暂不配置 Key。');
    assert.equal(await page.locator('[data-preview] '+(kind==='image'?'img':'audio')).evaluate(node=>node.src.startsWith('blob:')),true);
    assert.deepEqual(await page.evaluate(()=>[...Object.keys(localStorage),...Object.keys(sessionStorage)].filter(key=>key.startsWith('aihw.credentials.'))),[]);
  }
  await main.close();

  const missing=await context();
  await missing.route('**/app/data/registry.json',route=>route.fulfill({status:503,body:'Intentional data error'}));
  const failed=await missing.newPage();await failed.goto(app);await failed.getByRole('heading',{name:'方案数据暂时不可用'}).waitFor();
  await returnLink(failed);await keyClick(failed,'[data-site-home]');await failed.waitForURL(base);await missing.close();
  const noJs=await context({javaScriptEnabled:false,viewport:{width:390,height:844}});
  const staticPage=await noJs.newPage();await staticPage.goto(app);await returnLink(staticPage);
  await keyClick(staticPage,'[data-site-home]');await staticPage.waitForURL(base);await noJs.close();
  const legacy=await context(),oldShell=(await readFile(path.join(docs,'app/index.html'),'utf8')).replace(/<header class="product-bar">[\s\S]*?<\/header>/,'');
  assert.ok(!oldShell.includes('data-site-home'));
  await legacy.route('**/app/',route=>route.fulfill({status:200,contentType:'text/html',body:oldShell}));
  const lp=await legacy.newPage();await lp.goto(app);await mounted(lp,'.featured-card');
  await keyClick(lp,'[data-nav="hardware"]');await mounted(lp,'[data-project-card]');await legacy.close();
  console.log('Product recovery OK: malformed/missing routes, data errors, no-JS, older cached shell and both setup drafts.');

  async function controlled(page){
    await page.waitForFunction(()=>Boolean(navigator.serviceWorker.controller),null,{timeout:15000});
    assert.equal(await page.evaluate(async()=>{await navigator.serviceWorker.ready;return Boolean(navigator.serviceWorker.controller);}),true);
  }
  async function cacheAll(page){
    await page.locator('[data-act="cache"]').click();
    await page.waitForFunction(()=>['complete','partial','failed'].includes(document.querySelector('[data-slot="cache"]').dataset.cacheState),null,{timeout:30000});
    assert.equal(await page.locator('[data-act="cache"]').isEnabled(),true);
    return page.locator('[data-slot="cache"]').getAttribute('data-cache-state');
  }
  const requiredAssets=new Set();
  const variants=[];
  for(const solution of registry.solutions){
    for(const sample of solution.samples||[])if(sample.asset)requiredAssets.add(sample.asset);
    for(const variant of solution.experience.variants){
      if(!variant.trace)continue;
      requiredAssets.add(variant.trace);variants.push([solution.id,variant.id]);
      const trace=JSON.parse(await readFile(path.join(docs,'app/data',variant.trace),'utf8'));
      for(const file of [...trace.inputs||[],...trace.outputs||[]])if(file.asset)requiredAssets.add(file.asset);
    }
  }
  // This context has never opened an experience: cache from My Settings, then visit every trace offline.
  const offline=await context({serviceWorkers:'allow',viewport:{width:390,height:844}});
  const op=await offline.newPage();await op.goto(app+'#/me');await mounted(op,'[data-act="cache"]');await controlled(op);
  // The homepage preview belongs to the shell, even before cache-all or visiting an experience.
  await offline.setOffline(true);await op.goto(app+'#/');await op.reload();await mounted(op,'.featured-card');
  await op.waitForFunction(()=>document.querySelector('.image-preview img')?.naturalWidth>0);
  await offline.setOffline(false);await op.goto(app+'#/me');await mounted(op,'[data-act="cache"]');
  assert.equal(await cacheAll(op),'complete');
  const absent=await op.evaluate(async({root,assets})=>{
    const missing=[];for(const asset of assets)if(!await caches.match(new URL(asset,root).href))missing.push(asset);return missing;
  },{root:app+'data/',assets:[...requiredAssets]});
  assert.deepEqual(absent,[],'Successful cache-all must persist every published trace/input/output asset');
  assert.ok((await op.evaluate(()=>caches.keys())).includes('aihw-app-v11'));
  await offline.setOffline(true);
  const featured=['02-ai-glasses.bailian','07-recorder.bailian'];
  const ordered=[...variants.filter(([id,variant])=>featured.includes(id)&&variant==='default'),...variants.filter(([id,variant])=>!featured.includes(id)||variant!=='default')];
  for(const [id,variant] of ordered){
    await op.goto(app+'#/s/'+id+'/'+variant);await op.reload();await mounted(op,'.stage');
    if(featured.includes(id)&&variant==='default'){
      await op.locator('[data-outcome] .result-text').waitFor();
      if(id.startsWith('02'))await op.waitForFunction(()=>document.querySelector('[data-preview] img')?.naturalWidth>0);
      else await op.waitForFunction(()=>{const audio=document.querySelector('[data-preview] audio');return audio&&Number.isFinite(audio.duration)&&audio.duration>0;});
    }
    await op.locator('.process-panel').evaluate(node=>node.open=true);await op.locator('[data-act="all"]').click();await op.locator('.stage-foot:not([hidden])').waitFor();
    assert.doesNotMatch(await op.locator('#view').innerText(),/方案数据暂时不可用/);
  }
  assert.equal(await op.evaluate(()=>fetch('/__product_test__/uncached-network-probe').then(()=>true,()=>false)),false,'Offline replay context still blocks an uncached network request');
  // Chromium may reset navigator.onLine after an offline SW reload even while requests stay blocked.
  // Reapply actual network emulation to this document before checking the offline navigation UI.
  await offline.setOffline(false);await offline.setOffline(true);
  await op.waitForFunction(()=>navigator.onLine===false);
  const before=op.url();await keyClick(op,'[data-site-home]');
  await op.locator('.toast-host').filter({hasText:/联网|离线/}).waitFor();assert.equal(op.url(),before,'Offline return must retain the functioning app');
  await offline.setOffline(false);await keyClick(op,'[data-site-home]');await op.waitForURL(base);await offline.close();
  console.log('Product offline OK: first-settings cache, '+requiredAssets.size+' published resources, '+variants.length+' previously unopened replays, offline website notice and online return.');

  const failedPath='/app/data/traces/09-embodied.bailian/default.json';
  assert.equal((await fetch(base+'__product_test__/fault?path='+encodeURIComponent(failedPath))).ok,true);
  const partial=await context({serviceWorkers:'allow'}),pp=await partial.newPage();
  await pp.goto(app+'#/me');await mounted(pp,'[data-act="cache"]');await controlled(pp);
  const state=await cacheAll(pp);assert.ok(['partial','failed'].includes(state),'HTTP failures must not claim complete offline caching');
  assert.match(await pp.locator('[data-slot="cache"]').innerText(),/失败|未完成|未缓存/);
  assert.doesNotMatch(await pp.locator('.toast-host').innerText(),/回放素材已缓存|全部.*成功/);
  assert.equal(await pp.evaluate(async url=>Boolean(await caches.match(url)),base+failedPath.slice(1)),false);
  assert.equal((await fetch(base+'__product_test__/fault')).ok,true);
  assert.equal(await cacheAll(pp),'complete','A later retry can finish caching after the network recovers');
  await partial.close();
  assert.deepEqual(errors,[],'Product JavaScript errors');assert.deepEqual(external,[],'No external API calls');
  console.log('Product smoke OK: '+routes.length*5+' route/viewport return journeys, sticky header, articles, missing/data/no-JS recovery, two preserved setup drafts, first-settings real SW v11 caching of '+requiredAssets.size+' published resources and '+variants.length+' offline replays, offline return/reconnect, failed-cache reporting and retry. No external requests.');
}finally{await browser?.close();child.kill();}
