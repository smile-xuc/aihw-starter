// Focused interaction regressions. All network traffic stays local or is intercepted before delivery.
// PLAYWRIGHT_CORE=/path/to/playwright-core/index.mjs CHROME=/usr/bin/chromium node docs/tools/interaction-smoke.mjs
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir,readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

const docs=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const {chromium}=await import(process.env.PLAYWRIGHT_CORE?pathToFileURL(process.env.PLAYWRIGHT_CORE).href:'playwright-core');
const shotDir=process.env.INTERACTION_SCREENSHOTS;
if(shotDir)await mkdir(shotDir,{recursive:true});
const photo=await readFile(path.join(docs,'app/data/assets/02-ai-glasses.bailian/samples/dish.jpg'));
const recording=await readFile(path.join(docs,'app/data/assets/02-ai-glasses.bailian/samples/ask_dish.wav'));
const python=String.raw`
import http.server,sys
class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self,*args,**kwargs):super().__init__(*args,directory=sys.argv[1],**kwargs)
    def log_message(self,*args):pass
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),Handler)
print('port '+str(server.server_address[1]),flush=True)
server.serve_forever()
`;
const server=spawn(process.env.PYTHON||'python3',['-u','-c',python,docs],{stdio:['ignore','pipe','pipe']});
const errors=[],unexpected=[];
const provider=/^https:\/\/(dashscope\.aliyuncs\.com|dashscope-intl\.aliyuncs\.com|[a-z0-9-]+\.(cn-beijing|ap-southeast-1)\.maas\.aliyuncs\.com)\//;
const imageRoute='#/s/02-ai-glasses.bailian/default',audioRoute='#/s/07-recorder.bailian/default';
const deferred=()=>{let resolve;const promise=new Promise(done=>{resolve=done;});return {promise,resolve};};
let browser;
try{
  const port=await new Promise((resolve,reject)=>{
    let stdout='',stderr='';const timer=setTimeout(()=>reject(Error('Interaction server timeout: '+stderr)),10000);
    server.stdout.on('data',chunk=>{stdout+=chunk;const match=/port (\d+)/.exec(stdout);if(match){clearTimeout(timer);resolve(match[1]);}});
    server.stderr.on('data',chunk=>{stderr+=chunk;});
    server.on('error',error=>{clearTimeout(timer);reject(error);});
    server.on('exit',code=>{clearTimeout(timer);reject(Error('Interaction server exited '+code+': '+stderr));});
  });
  const base='http://127.0.0.1:'+port+'/',app=base+'app/';
  browser=await chromium.launch({executablePath:process.env.CHROME||'/usr/bin/google-chrome',args:['--no-sandbox']});
  async function context(options={}){
    const ctx=await browser.newContext({viewport:{width:1440,height:1000},locale:'zh-CN',colorScheme:'light',reducedMotion:'reduce',serviceWorkers:'block',...options});
    await ctx.route('**/*',(route,request)=>{
      if(request.url().startsWith(base)||/^(data:|blob:)/.test(request.url()))return route.continue();
      unexpected.push(request.url());return route.abort();
    });
    ctx.on('page',page=>{page.setDefaultTimeout(10000);page.on('pageerror',error=>errors.push(error.message));});
    return ctx;
  }
  async function mounted(page,selector){
    await page.locator(selector).first().waitFor({state:'visible'});
    await page.waitForFunction(()=>document.querySelector('#view').getAttribute('aria-busy')!=='true'&&document.activeElement?.id==='view');
  }
  async function navigate(page,hash,selector){await page.goto(app+hash);await mounted(page,selector);}
  async function fits(page,label){
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,label+' horizontal overflow');
  }
  async function hit(page,selector){
    const node=page.locator(selector).first();await node.scrollIntoViewIfNeeded();
    assert.equal(await node.evaluate(el=>{
      const r=el.getBoundingClientRect(),top=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
      return r.width>0&&r.height>0&&r.top>=0&&r.bottom<=innerHeight&&!!top&&(top===el||el.contains(top));
    }),true,selector+' must remain visible and hit-testable');
  }
  async function focusVisible(page,selector){
    const node=page.locator(selector).first();await node.focus();
    // Tab back gives real keyboard modality without clicking the target.
    await page.keyboard.press('Tab');await page.keyboard.press('Shift+Tab');
    assert.equal(await node.evaluate(el=>{
      const style=getComputedStyle(el);
      return document.activeElement===el&&el.matches(':focus-visible')&&((style.outlineStyle!=='none'&&parseFloat(style.outlineWidth)>=2)||style.boxShadow!=='none');
    }),true,selector+' needs visible keyboard focus');
    await hit(page,selector);
  }
  async function settled(page){
    await page.waitForFunction(()=>document.getAnimations().every(a=>a.playState!=='running'),null,{timeout:5000});
  }
  async function screenshot(page,name){if(shotDir)await page.screenshot({path:path.join(shotDir,name+'.png')});}
  async function drop(page,files=[],kind='files',event='drop'){
    await page.locator('[data-dropzone]').evaluate((node,{files,kind,event})=>{
      const transfer=new DataTransfer();
      for(const file of files)transfer.items.add(new File([Uint8Array.from(atob(file.bytes),char=>char.charCodeAt(0))],file.name,{type:file.type}));
      if(kind==='text')transfer.setData('text/plain','https://invalid.example/not-a-local-file');
      const drag=new DragEvent(event,{bubbles:true,cancelable:true,dataTransfer:transfer});
      if(kind==='directory')Object.defineProperty(drag,'dataTransfer',{value:{items:[{kind:'file',webkitGetAsEntry:()=>({isDirectory:true})}],files:[]}});
      node.dispatchEvent(drag);
    },{files:files.map(file=>({...file,bytes:file.bytes.toString('base64')})),kind,event});
  }
  const jpg=name=>({name,type:'image/jpeg',bytes:photo});

  // Small layout sample complements the existing full route matrix.
  const visual=await context({reducedMotion:'no-preference'}),vp=await visual.newPage();
  for(const [width,height] of [[320,740],[390,844],[768,1024],[1024,768],[1440,1000]]){
    await vp.setViewportSize({width,height});
    for(const [name,hash,selector] of [['home','#/','.featured-card'],['experience',imageRoute,'[data-question]'],['settings','#/me','form[data-form]']]){
      await navigate(vp,hash,selector);await fits(vp,width+' '+name);
      const animations=await vp.evaluate(()=>document.getAnimations().map(a=>({end:a.effect.getComputedTiming().endTime,iterations:a.effect.getTiming().iterations})));
      assert.equal(animations.every(a=>Number.isFinite(a.end)&&Number.isFinite(a.iterations)),true,'Page entrance animations must finish');
      assert.equal(await vp.locator('#view').evaluate(el=>parseFloat(getComputedStyle(el).opacity)>0),true,'Content may not wait behind an invisible entrance');
      await hit(vp,'[data-site-home]');await settled(vp);
      if(name==='home'){
        const cards=await vp.locator('.featured-card').evaluateAll(nodes=>nodes.map(n=>{const r=n.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom};}));
        assert.equal(cards.length,2);
        assert.ok(cards[0].right<=cards[1].x+1||cards[0].bottom<=cards[1].y+1,'Featured cards must not overlap');
      }
      await screenshot(vp,'light-'+width+'-'+name);
    }
  }
  // Pointer hover is a finite visual effect, and must not shift a neighbouring card.
  await navigate(vp,'#/','.featured-card');await settled(vp);
  const siblingBefore=await vp.locator('.featured-card').nth(1).boundingBox();
  await vp.locator('.featured-card').first().hover();await settled(vp);
  assert.deepEqual(await vp.locator('.featured-card').nth(1).boundingBox(),siblingBefore,'Hover must not reflow adjacent cards');
  await vp.mouse.move(0,0);await settled(vp);

  // System preference, explicit override and following the system again.
  await navigate(vp,'#/me','form[data-form]');
  const bg=()=>vp.evaluate(()=>getComputedStyle(document.body).backgroundColor);
  const light=await bg();await vp.emulateMedia({colorScheme:'dark'});await settled(vp);const dark=await bg();assert.notEqual(dark,light);
  await vp.locator('button[data-theme="light"]').click();await settled(vp);assert.equal(await bg(),light);
  await vp.locator('button[data-theme="dark"]').click();await vp.emulateMedia({colorScheme:'light'});await settled(vp);assert.equal(await bg(),dark);
  await vp.locator('button[data-theme="system"]').click();await settled(vp);assert.equal(await bg(),light);
  await vp.emulateMedia({colorScheme:'dark'});
  for(const width of [390,1440]){
    await vp.setViewportSize({width,height:width===390?844:1000});
    for(const [name,hash,selector] of [['home','#/','.featured-card'],['experience',imageRoute,'[data-question]'],['settings','#/me','form[data-form]']]){
      await navigate(vp,hash,selector);await fits(vp,'dark '+width+' '+name);await settled(vp);await screenshot(vp,'dark-'+width+'-'+name);
      await focusVisible(vp,'[data-site-home]');
    }
  }
  // Reduced motion still changes theme and routes, without running visual effects.
  await vp.emulateMedia({reducedMotion:'reduce',colorScheme:'light'});await navigate(vp,'#/','.featured-card');
  await vp.locator('.featured-card').first().hover();
  assert.deepEqual(await vp.evaluate(()=>document.getAnimations().filter(a=>a.playState==='running').map(a=>a.constructor.name)),[],'Reduced motion disables entrance/hover animations');
  assert.notEqual(await vp.evaluate(()=>getComputedStyle(document.documentElement).scrollBehavior),'smooth');
  // Start at the document's beginning; route mounting otherwise intentionally focuses main.
  await vp.evaluate(()=>{document.body.tabIndex=-1;document.body.focus();document.body.removeAttribute('tabindex');});
  await vp.keyboard.press('Tab');assert.equal(await vp.locator('.skip-link').evaluate(el=>el===document.activeElement),true);
  await hit(vp,'.skip-link');const prior=vp.url();await vp.keyboard.press('Enter');
  assert.equal(vp.url(),prior,'Skip link must not become a hash-router route');
  assert.equal(await vp.evaluate(()=>document.activeElement?.id),'view');
  await focusVisible(vp,'[data-nav="hardware"]');await vp.keyboard.press('Enter');await mounted(vp,'[data-project-card]');
  await visual.close();
  console.log('Interaction layout/motion OK: 15 light and 6 dark page/viewport checks, theme overrides, finite effects, reduced motion and keyboard skip/focus.');

  const touch=await context({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'no-preference'}),tp=await touch.newPage();
  await navigate(tp,'#/','.featured-card');assert.equal(await tp.evaluate(()=>matchMedia('(hover: hover)').matches),false);
  await tp.locator('.featured-card').first().tap();await mounted(tp,'[data-question]');
  await tp.locator('[data-source="own"]').tap();assert.equal(await tp.locator('[data-source="own"]').getAttribute('aria-pressed'),'true');
  await tp.locator('[data-question]').tap();await tp.keyboard.insertText('触控问题');await tp.keyboard.press('Tab');
  await tp.locator('[data-nav="home"]').tap();await mounted(tp,'.featured-card');await settled(tp);
  assert.equal(await tp.locator('.featured-card').first().evaluate(el=>getComputedStyle(el).transform),'none','Touch navigation must not leave a hovered card lifted');
  const cdp=await touch.newCDPSession(tp);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:180,y:650}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:180,y:350}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await tp.waitForFunction(()=>scrollY>50);await hit(tp,'[data-nav="me"]');await touch.close();
  console.log('Interaction touch OK: touch-only tap, input, return, no lingering hover transform and native swipe scrolling.');

  const material=await context(),mp=await material.newPage();
  // Gate a real File.arrayBuffer read to observe pending validation without time-based races.
  await mp.addInitScript(()=>{
    const read=File.prototype.arrayBuffer;
    File.prototype.arrayBuffer=function(){
      if(this.name!=='delayed.jpg')return read.call(this);
      return new Promise(resolve=>{window.releaseMaterialRead=()=>resolve(read.call(this));});
    };
  });
  await navigate(mp,imageRoute,'[data-question]');await mp.locator('[data-source="own"]').click();
  await drop(mp,[jpg('delayed.jpg')],'files','dragenter');assert.equal(await mp.locator('[data-dropzone]').getAttribute('data-dragging'),'true');
  await drop(mp,[],'files','dragleave');assert.equal(await mp.locator('[data-dropzone]').getAttribute('data-dragging'),'false');
  await drop(mp,[jpg('delayed.jpg')]);
  assert.equal(await mp.locator('[data-material-editor]').getAttribute('data-validation-state'),'validating');
  assert.equal(await mp.locator('[data-dropzone]').getAttribute('aria-busy'),'true');
  assert.match(await mp.locator('[data-material-status]').innerText(),/核验/);
  assert.equal(await mp.locator('[data-material-status]').getAttribute('aria-live'),'polite');
  await mp.evaluate(()=>window.releaseMaterialRead());await mp.locator('[data-material-status] .inline-ok').waitFor();
  assert.equal(await mp.locator('[data-material-editor]').getAttribute('data-validation-state'),'valid');
  assert.equal(await mp.locator('[data-dropzone]').getAttribute('aria-busy'),'false');
  assert.match(await mp.locator('[data-preview]').innerText(),/delayed\.jpg/);
  const previewBefore=await mp.locator('[data-preview] img').getAttribute('src');
  for(const [files,kind] of [[[jpg('one.jpg'),jpg('two.jpg')],'files'],[[],'text'],[[],'directory'],[[],'files'],
    [[{name:'wrong.gif',type:'image/gif',bytes:photo}],'files'],[[{name:'wrong.jpg',type:'image/png',bytes:photo}],'files'],[[{name:'empty.jpg',type:'image/jpeg',bytes:Buffer.alloc(0)}],'files']]){
    await drop(mp,files,kind);assert.match(await mp.locator('[data-material-status] .inline-error').innerText(),/当前素材未更换/);
    assert.equal(await mp.locator('[data-preview] img').getAttribute('src'),previewBefore);
    assert.equal(await mp.locator('[data-material-editor]').getAttribute('data-validation-state'),'valid','A rejected drag must preserve a valid draft');
    assert.equal(await mp.locator('[data-dropzone]').getAttribute('data-dragging'),'false');
  }
  await drop(mp,[{name:'bad.jpg',type:'image/jpeg',bytes:Buffer.from('not an image')}]);await mp.locator('[data-material-status] .inline-error').waitFor();
  assert.equal(await mp.locator('[data-material-editor]').getAttribute('data-validation-state'),'invalid');
  assert.equal(await mp.locator('[data-material]').getAttribute('aria-invalid'),'true');
  await mp.locator('[data-material]').setInputFiles({name:'recovered.jpg',mimeType:'image/jpeg',buffer:photo});
  await mp.locator('[data-material-status] .inline-ok').waitFor();assert.match(await mp.locator('[data-preview]').innerText(),/recovered\.jpg/);
  assert.equal(await mp.locator('[data-material]').inputValue(),'','Native file selection resets so the same file can be chosen again');
  for(const value of ['','问题 A','测'.repeat(2000)]){
    await mp.locator('[data-question]').fill(value);assert.equal(await mp.locator('[data-question-count]').innerText(),`已输入 ${value.length} / 2000 字符`);
  }
  await mp.locator('[data-question]').press('End');await mp.keyboard.type('x');assert.equal((await mp.locator('[data-question]').inputValue()).length,2000);
  await mp.locator('[data-question]').fill('这是什么菜？');
  await mp.locator('[data-nav="me"]').click();await mounted(mp,'form[data-form]');
  await navigate(mp,imageRoute,'[data-question]');assert.equal(await mp.locator('[data-question-count]').innerText(),'已输入 6 / 2000 字符');
  await navigate(mp,audioRoute,'[data-source="own"]');await mp.locator('[data-source="own"]').click();
  await drop(mp,[{name:'meeting.wav',type:'audio/wav',bytes:recording}]);await mp.locator('[data-material-status] .inline-ok').waitFor();
  await mp.waitForFunction(()=>{const audio=document.querySelector('[data-preview] audio');return audio&&Number.isFinite(audio.duration)&&audio.duration>0;});
  assert.equal(unexpected.length,0,'Local selection and feedback must never invoke a provider');

  // No fake server is needed here: hold the one intercepted request until the user stops it.
  const requestStarted=deferred(),releaseRequest=deferred();let heldRequests=0;
  await material.route(provider,async route=>{heldRequests++;requestStarted.resolve();await releaseRequest.promise;await route.abort().catch(()=>{});});
  await mp.evaluate(()=>sessionStorage.setItem('aihw.credentials.bailian',JSON.stringify({values:{DASHSCOPE_API_KEY:'sk-interaction-test000001',DASHSCOPE_API_REGION:'cn-beijing',DASHSCOPE_WORKSPACE_ID:'llm-interaction'}})));
  await navigate(mp,imageRoute,'[data-act="live"]');
  await focusVisible(mp,'[data-act="live"]');await mp.keyboard.press('Enter');await mp.getByRole('dialog').waitFor();
  await mp.keyboard.press('Tab');assert.equal(await mp.getByRole('dialog').evaluate(el=>el.contains(document.activeElement)),true);
  await mp.keyboard.press('Shift+Tab');assert.equal(await mp.getByRole('dialog').evaluate(el=>el.contains(document.activeElement)),true);
  await mp.keyboard.press('Escape');await mp.waitForFunction(()=>document.querySelector('[data-act="live"]')===document.activeElement);
  assert.equal(heldRequests,0,'Cancelling confirmation must not send a request');
  await mp.locator('[data-act="live"]').click();await mp.locator('[data-sheet="go"]').click();
  await Promise.race([requestStarted.promise,new Promise((_,reject)=>setTimeout(()=>reject(Error('Local interception was not reached')),10000))]);
  assert.equal(await mp.locator('[data-dropzone]').getAttribute('data-disabled'),'true');
  const runningPreview=await mp.locator('[data-preview] img').getAttribute('src');
  await drop(mp,[jpg('during-run.jpg')]);assert.equal(await mp.locator('[data-preview] img').getAttribute('src'),runningPreview);
  assert.match(await mp.locator('[data-material-status]').innerText(),/先停止/);
  assert.equal(await mp.locator('[data-question]').isDisabled(),true);
  await hit(mp,'[data-act="stop"]');await mp.locator('[data-act="stop"]').click();
  await mp.locator('[data-outcome]').filter({hasText:'已停止'}).waitFor();releaseRequest.resolve();
  assert.equal(await mp.locator('[data-dropzone]').getAttribute('data-disabled'),'false');
  assert.equal(heldRequests,1,'Only the intentional intercepted run may reach the request boundary');
  await material.close();
  console.log('Interaction material OK: photo/audio drops, pending/valid/invalid feedback, seven rejected drops preserving drafts, input recovery/count, keyboard dialog and immutable input during a locally intercepted stopped run.');

  // Hold data at the request boundary: no fixed network sleeps and no model traffic.
  const slow=await context(),sp=await slow.newPage(),registryGate=deferred(),registrySeen=deferred();
  await sp.addInitScript(()=>{
    window.routeTiming={};
    new MutationObserver(records=>{
      for(const record of records){
        if(record.target.id==='view'&&record.target.getAttribute('aria-busy')==='true')window.routeTiming.busy??=performance.now();
        if(record.target.matches?.('.product-bar')&&record.target.hasAttribute('data-loading'))window.routeTiming.progress??=performance.now();
      }
    }).observe(document,{attributes:true,subtree:true,attributeFilter:['aria-busy','data-loading']});
  });
  await slow.route('**/app/data/registry.json',async route=>{registrySeen.resolve();await registryGate.promise;await route.fulfill({status:200,contentType:'application/json',body:await readFile(path.join(docs,'app/data/registry.json'))});});
  await sp.goto(app+'#/');await registrySeen.promise;
  assert.equal(await sp.locator('#view').getAttribute('aria-busy'),'true');
  await sp.waitForFunction(()=>document.querySelector('.product-bar').hasAttribute('data-loading'));
  const timing=await sp.evaluate(()=>window.routeTiming);
  assert.ok(timing.progress-timing.busy>=140,'Progress must be delayed rather than flashing immediately: '+JSON.stringify(timing));
  assert.equal(await sp.locator('[data-route-progress]').getAttribute('role'),'status');
  assert.match(await sp.locator('[data-route-status]').innerText(),/加载/);
  await hit(sp,'[data-site-home]');registryGate.resolve();await mounted(sp,'.featured-card');
  assert.equal(await sp.locator('.product-bar').getAttribute('data-loading'),null);
  const traceGate=deferred(),traceSeen=deferred(),traceDone=deferred();
  await slow.route('**/app/data/traces/02-ai-glasses.bailian/default.json',async route=>{
    traceSeen.resolve();await traceGate.promise;await route.fulfill({status:200,contentType:'application/json',body:await readFile(path.join(docs,'app/data/traces/02-ai-glasses.bailian/default.json'))});traceDone.resolve();
  });
  await sp.locator('.featured-card').first().click();await traceSeen.promise;
  await sp.waitForFunction(()=>document.querySelector('.product-bar').hasAttribute('data-loading'));
  await sp.locator('[data-nav="me"]').click();await mounted(sp,'form[data-form]');
  assert.equal(await sp.locator('.product-bar').getAttribute('data-loading'),null);
  traceGate.resolve();await traceDone.promise;
  // Let the released fetch and its continuation drain before examining the newer view.
  await sp.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  assert.equal(new URL(sp.url()).hash,'#/me');assert.equal(await sp.locator('form[data-form]').count(),1);
  assert.equal(await sp.locator('[data-question]').count(),0,'A late previous route must never replace the newest page');
  assert.equal(await sp.locator('[data-nav="me"]').getAttribute('aria-current'),'page');
  assert.notEqual(await sp.locator('#view').getAttribute('aria-busy'),'true');await slow.close();
  assert.deepEqual(errors,[],'Interaction JavaScript errors');assert.deepEqual(unexpected,[],'No unhandled external requests');
  console.log('Interaction routing OK: delayed progress, accessible busy status, usable global navigation, fast-route replacement and stale-response isolation. No external traffic delivered.');
}finally{await browser?.close();server.kill();}
