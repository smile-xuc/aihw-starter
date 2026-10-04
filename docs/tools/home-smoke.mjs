// Root project homepage regression. Local files only; no model or external requests.
// PLAYWRIGHT_CORE=/path/to/playwright-core/index.mjs CHROME=/usr/bin/chromium node docs/tools/home-smoke.mjs
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir,stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const docs=path.resolve(here,'..');
const playwright=process.env.PLAYWRIGHT_CORE;
const {chromium}=await import(playwright?pathToFileURL(playwright).href:'playwright-core');
const server=spawn(process.env.PYTHON||'python3',['-u','-m','http.server','0','--bind','127.0.0.1','--directory',docs],{stdio:['ignore','pipe','pipe']});
const categories=['01-ipc','02-ai-glasses','03-toys-companion','04-agent-hardware','05-desktop-pet','06-ai-earphone','07-recorder','08-smart-watch','09-embodied'];
const anchors=['top','categories','deep','howto','awesome'];
const tabs=['vision','minutes','hardware'];
const errors=[],external=[];
let browser;

try {
  const port=await new Promise((resolve,reject)=>{
    let output='',stderr='';
    const timer=setTimeout(()=>reject(Error('Homepage static server timeout: '+stderr)),10000);
    server.stderr.on('data',chunk=>{stderr+=chunk;});
    server.stdout.on('data',chunk=>{
      output+=chunk;
      const found=/port (\d+)/.exec(output);
      if(found){clearTimeout(timer);resolve(found[1]);}
    });
    server.on('error',error=>{clearTimeout(timer);reject(error);});
    server.on('exit',code=>{clearTimeout(timer);reject(Error('Homepage static server exited '+code+': '+stderr));});
  });
  const base='http://127.0.0.1:'+port+'/';
  browser=await chromium.launch({executablePath:process.env.CHROME||'/usr/bin/google-chrome',args:['--no-sandbox']});

  async function context(options={}){
    const ctx=await browser.newContext({viewport:{width:1440,height:1000},locale:'zh-CN',serviceWorkers:'block',...options});
    await ctx.route('**/*',(route,request)=>{
      const url=request.url();
      if(url.startsWith(base)||url.startsWith('data:')||url.startsWith('blob:'))return route.continue();
      external.push(url);return route.abort();
    });
    ctx.on('page',page=>{
      page.setDefaultTimeout(6000);
      page.on('pageerror',error=>errors.push(error.message));
    });
    return ctx;
  }
  async function fits(page,label){
    const size=await page.evaluate(()=>({actual:document.documentElement.scrollWidth,width:innerWidth}));
    assert.ok(size.actual<=size.width+1,label+' horizontal overflow: '+JSON.stringify(size));
  }
  async function illustrationFits(page,label){
    // The hero clips overflow, so document width alone cannot catch a cut-off device.
    await page.locator('.hero-art').evaluate(async node=>{
      await Promise.all(node.getAnimations().filter(animation=>animation.effect.getComputedTiming().iterations!==Infinity).map(animation=>animation.finished.catch(()=>{})));
    });
    const bounds=await page.locator('.hero-art .device, .hero-art .art-tag').evaluateAll(nodes=>{
      const hero=document.querySelector('.hero').getBoundingClientRect();
      return nodes.map(node=>{
        const rect=node.getBoundingClientRect();
        return {item:node.className,left:rect.left,right:rect.right,top:rect.top,bottom:rect.bottom,viewport:innerWidth,heroTop:hero.top,heroBottom:hero.bottom};
      });
    });
    assert.equal(bounds.length,6,'Three illustrated devices and three labels are visible');
    for(const box of bounds){
      assert.ok(box.left>=-1&&box.right<=box.viewport+1,label+' clipped illustration horizontally: '+JSON.stringify(box));
      assert.ok(box.top>=box.heroTop-1&&box.bottom<=box.heroBottom+1,label+' clipped illustration vertically: '+JSON.stringify(box));
    }
  }
  async function categoryLinks(page){
    const links=await page.locator('a[data-category]').evaluateAll(nodes=>nodes.map(node=>({href:node.href,text:node.textContent.trim()})));
    assert.equal(links.length,9,'Homepage must retain all nine commercial categories');
    assert.equal(new Set(links.map(link=>link.href)).size,9,'Category destinations must be unique');
    for(const category of categories){
      const matches=links.filter(link=>link.href.includes('/c/'+category)||link.href.includes('/by-category/'+category));
      assert.equal(matches.length,1,'Missing or duplicated destination for '+category);
      const target=new URL(matches[0].href);
      if(target.origin===new URL(base).origin){
        assert.equal(target.pathname,'/app/','Local category link must enter the existing app');
        assert.equal(target.hash,'#/c/'+category);
      } else {
        assert.equal(target.origin,'https://github.com');
        assert.match(target.pathname,new RegExp('^/smile-xuc/aihw-starter/(?:tree|blob)/master/solutions/by-category/'+category+'/?$'));
      }
      assert.ok(matches[0].text.length,'Category links need readable names');
    }
  }

  const main=await context();
  const page=await main.newPage();
  for(const [width,height] of [[320,740],[390,844],[768,1024],[1024,768],[1440,1000]]){
    await page.setViewportSize({width,height});
    await page.goto(base);
    await page.locator('h1').waitFor();
    await fits(page,width+' initial');
    await illustrationFits(page,width+' initial');
    await categoryLinks(page);
    for(const id of anchors)assert.equal(await page.locator('[id="'+id+'"]').count(),1,'Legacy anchor #'+id);
    for(const name of tabs){
      await page.locator('[data-preview-tab="'+name+'"]').click();
      await assertTab(page,name);
      await fits(page,width+' '+name+' preview');
    }
    if(process.env.REVIEW_SCREENSHOTS){
      await page.locator('[data-preview-tab="vision"]').click();
      await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));
      await mkdir(process.env.REVIEW_SCREENSHOTS,{recursive:true});
      await page.screenshot({path:path.join(process.env.REVIEW_SCREENSHOTS,'homepage-'+width+'.png'),fullPage:true,animations:'disabled'});
      if(width===390||width===1440)await page.screenshot({path:path.join(process.env.REVIEW_SCREENSHOTS,'homepage-'+width+'-viewport.png'),animations:'disabled'});
    }
  }

  async function assertTab(targetPage,name){
    const selected=targetPage.locator('[data-preview-tab="'+name+'"]');
    assert.equal(await selected.getAttribute('role'),'tab');
    assert.equal(await selected.getAttribute('aria-selected'),'true');
    assert.equal(await selected.getAttribute('tabindex'),'0');
    assert.equal(await targetPage.locator('[data-preview-tab][aria-selected="true"]').count(),1);
    assert.equal(await targetPage.locator('[data-preview-panel]:visible').count(),1);
    for(const other of tabs){
      const panel=targetPage.locator('#preview-'+other);
      assert.equal(await panel.evaluate(node=>node.hidden),other!==name,'Panel hidden state for '+other);
      if(other!==name){
        const inactive=targetPage.locator('[data-preview-tab="'+other+'"]');
        assert.equal(await inactive.getAttribute('aria-selected'),'false');
        assert.equal(await inactive.getAttribute('tabindex'),'-1');
      }
    }
  }
  // Tabs must be usable without a pointer, including wrap-around and Home/End.
  await page.locator('[data-preview-tab="vision"]').focus();
  for(const [key,name] of [['ArrowRight','minutes'],['ArrowRight','hardware'],['ArrowRight','vision'],['ArrowLeft','hardware'],['Home','vision'],['End','hardware']]){
    await page.keyboard.press(key);
    await assertTab(page,name);
    assert.equal(await page.evaluate(()=>document.activeElement.dataset.previewTab),name,'Keyboard focus after '+key);
  }

  for(const width of [320,390]){
    await page.setViewportSize({width,height:844});
    await page.goto(base);
    const toggle=page.locator('button[data-menu-toggle]');
    await toggle.waitFor();
    assert.equal(await toggle.getAttribute('aria-controls'),'site-nav');
    assert.equal(await toggle.getAttribute('aria-expanded'),'false');
    await toggle.click();
    assert.equal(await toggle.getAttribute('aria-expanded'),'true');
    assert.equal(await page.locator('#site-nav').isVisible(),true);
    await fits(page,width+' expanded menu');
    await page.locator('#site-nav a[href="#categories"]').click();
    assert.equal(new URL(page.url()).hash,'#categories');
    assert.equal(await toggle.getAttribute('aria-expanded'),'false','Selecting a mobile destination closes the menu');
    await toggle.click();
    await page.locator('#site-nav a').first().focus();
    await page.keyboard.press('Escape');
    assert.equal(await toggle.getAttribute('aria-expanded'),'false','Escape closes the menu');
    assert.equal(await toggle.evaluate(node=>node===document.activeElement),true,'Escape returns focus to menu trigger');
  }

  // Clipboard stubs record the exact requested command and control both outcomes.
  for(const outcome of ['success','denied']){
    const copyContext=await context({reducedMotion:'reduce'});
    await copyContext.addInitScript(({outcome})=>{
      window.__copiedCommands=[];
      Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{
        window.__copiedCommands.push(text);
        if(outcome==='denied')throw new DOMException('Clipboard denied for regression','NotAllowedError');
      }}});
      document.execCommand=()=>false;
    },{outcome});
    const copyPage=await copyContext.newPage();
    await copyPage.goto(base);
    assert.ok(await copyPage.locator('#copy-status').getAttribute('aria-live'),'Copy status must be announced');
    const command=(await copyPage.locator('#clone-command').innerText()).trim();
    assert.match(command,/git clone https:\/\/github\.com\/smile-xuc\/aihw-starter\.git/);
    await copyPage.locator('button[data-copy-command]').click();
    await copyPage.waitForFunction(()=>document.querySelector('#copy-status').textContent.trim().length>0);
    const status=await copyPage.locator('#copy-status').innerText();
    assert.deepEqual(await copyPage.evaluate(()=>window.__copiedCommands),[command]);
    if(outcome==='success')assert.match(status,/已复制|复制成功/);
    else {
      assert.doesNotMatch(status,/已复制|复制成功/,'Rejected clipboard access must never report success');
      assert.match(status,/手动复制|未能复制|复制失败/);
    }
    await copyContext.close();
  }

  // Static content and all local destinations remain useful with scripts disabled.
  const noJs=await context({javaScriptEnabled:false,viewport:{width:390,height:844}});
  const staticPage=await noJs.newPage();
  await staticPage.goto(base);
  assert.ok((await staticPage.locator('h1').innerText()).trim());
  await categoryLinks(staticPage);
  assert.equal(await staticPage.locator('a[data-category]:visible').count(),9);
  assert.equal(await staticPage.locator('#site-nav a:visible').count(),await staticPage.locator('#site-nav a').count(),'No-JS mobile navigation remains reachable');
  assert.match(await staticPage.locator('#clone-command').innerText(),/git clone/);
  await fits(staticPage,'No-JS mobile');
  const hrefs=await staticPage.locator('a[href]').evaluateAll(nodes=>nodes.map(node=>node.getAttribute('href')));
  for(const href of new Set(hrefs)){
    const target=new URL(href,base);
    if(target.origin!==new URL(base).origin)continue;
    if(target.pathname==='/'){
      if(target.hash)assert.equal(await staticPage.locator('[id="'+decodeURIComponent(target.hash.slice(1))+'"]').count(),1,'Local anchor '+href);
    } else {
      const local=path.resolve(docs,'.'+decodeURIComponent(target.pathname));
      assert.ok(local.startsWith(docs+path.sep),'Local link escapes docs: '+href);
      const info=await stat(local);
      if(info.isDirectory())assert.ok((await stat(path.join(local,'index.html'))).isFile(),'Missing directory entry: '+href);
      else assert.ok(info.isFile(),'Missing local page: '+href);
    }
  }
  await noJs.close();

  const reduced=await context({reducedMotion:'reduce'});
  const reducedPage=await reduced.newPage();
  await reducedPage.goto(base);
  async function noMotion(label){
    // Observe multiple frames, so a short WAAPI tab/entry animation is not missed.
    const active=await reducedPage.evaluate(async()=>{
      const found=new Set();
      for(let frame=0;frame<12;frame++){
        for(const animation of document.getAnimations()){
          if(animation.playState==='running'||animation.pending)found.add(animation.animationName||animation.transitionProperty||'WAAPI animation');
        }
        await new Promise(resolve=>requestAnimationFrame(resolve));
      }
      return [...found];
    });
    assert.deepEqual(active,[],'Reduced motion must disable CSS and WAAPI animations: '+label);
  }
  assert.equal(await reducedPage.evaluate(()=>getComputedStyle(document.documentElement).scrollBehavior),'auto','Reduced-motion navigation must not smooth-scroll');
  await noMotion('initial page');
  for(const id of anchors){
    await reducedPage.locator('#'+id).scrollIntoViewIfNeeded();
    await noMotion('scroll to #'+id);
    const visible=await reducedPage.locator('#'+id).evaluate(node=>{const style=getComputedStyle(node);return style.visibility!=='hidden'&&Number(style.opacity)>0;});
    assert.equal(visible,true,'Reduced-motion section remains visible: '+id);
  }
  for(const name of tabs){
    await reducedPage.locator('[data-preview-tab="'+name+'"]').click();
    await noMotion('select '+name+' tab');
    await assertTab(reducedPage,name);
  }
  await reduced.close();
  await main.close();
  assert.deepEqual(errors,[],'Homepage JavaScript errors');
  assert.deepEqual(external,[],'Homepage must not load external assets or call APIs');
  console.log('Homepage smoke OK: 5 viewports, complete device illustrations, 9 category destinations, legacy anchors, mobile menu, keyboard tabs, clipboard success/rejection, no-JS links and no CSS/WAAPI animation under reduced motion. No external requests.');
} finally {
  await browser?.close();
  server.kill();
}
