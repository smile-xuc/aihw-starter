// Engineering article regression: local static pages only, no model or external requests.
// PLAYWRIGHT_CORE=/path/to/playwright-core/index.mjs CHROME=/usr/bin/chromium node docs/tools/article-smoke.mjs
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir,stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

const docs=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const {chromium}=await import(process.env.PLAYWRIGHT_CORE?pathToFileURL(process.env.PLAYWRIGHT_CORE).href:'playwright-core');
const server=spawn(process.env.PYTHON||'python3',['-u','-m','http.server','0','--bind','127.0.0.1','--directory',docs],{stdio:['ignore','pipe','pipe']});
const ids=['overview','architecture','routing','execution','session','memory','cost','implementation'];
const flows=['voice','vision','interrupt'];
const errors=[],external=[];
let browser;

try {
  const port=await new Promise((resolve,reject)=>{
    let output='',stderr='';
    const timer=setTimeout(()=>reject(Error('Article server timeout: '+stderr)),10000);
    server.stderr.on('data',chunk=>{stderr+=chunk;});
    server.stdout.on('data',chunk=>{output+=chunk;const found=/port (\d+)/.exec(output);if(found){clearTimeout(timer);resolve(found[1]);}});
    server.on('error',error=>{clearTimeout(timer);reject(error);});
    server.on('exit',code=>{clearTimeout(timer);reject(Error('Article server exited '+code+': '+stderr));});
  });
  const base='http://127.0.0.1:'+port+'/';
  const article=base+'omni-runtime-host.html';
  browser=await chromium.launch({executablePath:process.env.CHROME||'/usr/bin/google-chrome',args:['--no-sandbox']});
  async function context(options={}){
    const ctx=await browser.newContext({viewport:{width:1440,height:1000},locale:'zh-CN',serviceWorkers:'block',reducedMotion:'reduce',...options});
    await ctx.route('**/*',(route,request)=>{
      const url=request.url();
      if(url.startsWith(base)||url.startsWith('data:')||url.startsWith('blob:'))return route.continue();
      external.push(url);return route.abort();
    });
    ctx.on('page',page=>{page.setDefaultTimeout(6000);page.on('pageerror',error=>errors.push(error.message));});
    return ctx;
  }
  async function fits(page,label){
    const size=await page.evaluate(()=>({actual:document.documentElement.scrollWidth,width:innerWidth}));
    assert.ok(size.actual<=size.width+1,label+' horizontal overflow: '+JSON.stringify(size));
  }
  async function openToc(page){
    if(!await page.locator('#page-toc').evaluate(node=>node.open))await page.locator('#page-toc>summary').click();
  }
  async function allSections(page){
    assert.equal(await page.locator('[data-doc-section]:visible').count(),8);
    assert.equal(await page.locator('[data-toc-link]:not([hidden])').count(),8);
  }
  async function atSection(page,id){
    await page.waitForFunction(id=>{
      const section=document.getElementById(id),header=document.querySelector('.site-header');
      const rect=section.getBoundingClientRect();
      const top=header.getBoundingClientRect().bottom;
      return !section.hidden&&rect.top>=top-1&&rect.top<innerHeight*.6&&document.querySelector('[data-toc-link][aria-current="location"]')?.hash==='#'+id;
    },id);
    assert.equal(await page.locator('[data-toc-link][aria-current="location"]').count(),1);
  }
  async function assertFlow(page,name){
    assert.equal(await page.locator('[data-flow][aria-selected="true"]').count(),1);
    assert.equal(await page.locator('[data-flow="'+name+'"]').getAttribute('aria-selected'),'true');
    assert.equal(await page.locator('[data-flow="'+name+'"]').getAttribute('tabindex'),'0');
    assert.equal(await page.locator('[data-flow-panel]:visible').count(),1);
    assert.equal(await page.locator('#flow-'+name).isVisible(),true);
    for(const other of flows.filter(item=>item!==name))assert.equal(await page.locator('[data-flow="'+other+'"]').getAttribute('tabindex'),'-1');
  }
  const main=await context();
  const page=await main.newPage();
  for(const [width,height] of [[320,740],[390,844],[768,1024],[1024,768],[1440,1000]]){
    await page.setViewportSize({width,height});
    await page.goto(article);
    await page.locator('h1').waitFor();
    await allSections(page);await fits(page,width+' initial');
    assert.deepEqual(await page.locator('[data-doc-section]').evaluateAll(nodes=>nodes.map(node=>node.id)),ids);
    assert.deepEqual(await page.locator('[data-toc-link]').evaluateAll(nodes=>nodes.map(node=>node.hash.slice(1))),ids);
    assert.equal(await page.locator('#page-toc').evaluate(node=>node.open),width>760);
    if(process.env.REVIEW_SCREENSHOTS&&[390,1440].includes(width)){
      await mkdir(process.env.REVIEW_SCREENSHOTS,{recursive:true});
      await page.screenshot({path:path.join(process.env.REVIEW_SCREENSHOTS,'article-'+width+'-hero.png'),animations:'disabled'});
    }
    for(const id of ids){
      await openToc(page);
      await page.locator('[data-toc-link][href="#'+id+'"]').click();
      await atSection(page,id);await fits(page,width+' '+id);
      if(width<=760)assert.equal(await page.locator('#page-toc').evaluate(node=>node.open),false,'Mobile section choice collapses TOC');
    }
    if(width>760){
      const sticky=await page.locator('#page-toc').evaluate(node=>({position:getComputedStyle(node).position,top:node.getBoundingClientRect().top}));
      assert.equal(sticky.position,'sticky');assert.ok(Math.abs(sticky.top-104)<2,'Desktop TOC remains at its sticky offset');
    }
    await page.goto(article+'#overview');await atSection(page,'overview');
    for(const flow of flows){await page.locator('[data-flow="'+flow+'"]').click();await assertFlow(page,flow);await fits(page,width+' flow '+flow);}
    await page.locator('[data-flow="voice"]').focus();
    for(const [key,name] of [['ArrowRight','vision'],['ArrowRight','interrupt'],['ArrowRight','voice'],['ArrowLeft','interrupt'],['Home','voice'],['End','interrupt']]){
      await page.keyboard.press(key);await assertFlow(page,name);
      assert.equal(await page.evaluate(()=>document.activeElement.dataset.flow),name);
    }
    await page.goto(article+'#session');await atSection(page,'session');
    const detail=page.locator('#session details').first();
    assert.equal(await detail.evaluate(node=>node.open),false);
    await detail.locator('summary').focus();await page.keyboard.press('Enter');
    assert.equal(await detail.evaluate(node=>node.open),true,'Protocol details open with keyboard');await fits(page,width+' expanded code');
    if(process.env.REVIEW_SCREENSHOTS&&[390,1440].includes(width)){
      await page.screenshot({path:path.join(process.env.REVIEW_SCREENSHOTS,'article-'+width+'-body.png'),animations:'disabled'});
      await openToc(page);
      await page.screenshot({path:path.join(process.env.REVIEW_SCREENSHOTS,'article-'+width+'-toc.png'),animations:'disabled'});
    }
  }

  // Filtering includes collapsed code; navigation and section visibility must agree.
  for(const width of [390,1440]){
    await page.setViewportSize({width,height:1000});await page.goto(article+'#session');await atSection(page,'session');await openToc(page);
    const search=page.locator('#section-search');
    assert.equal(await page.locator('label[for="section-search"]').count(),1);
    assert.equal(await page.locator('#search-status').getAttribute('aria-live'),'polite');
    await search.fill('  HoSt_RuNtImE_EvEnT  ');
    assert.deepEqual(await page.locator('[data-doc-section]:visible').evaluateAll(nodes=>nodes.map(node=>node.id)),['memory']);
    assert.deepEqual(await page.locator('[data-toc-link]:not([hidden])').evaluateAll(nodes=>nodes.map(node=>node.hash)),['#memory']);
    assert.match(await page.locator('#search-status').innerText(),/1\s*\/\s*8/);
    await search.fill('NO_SECTION_MATCH_8fc14');
    assert.equal(await page.locator('[data-doc-section]:visible').count(),0);
    assert.equal(await page.locator('[data-toc-link]:not([hidden])').count(),0);
    assert.equal(await page.locator('#no-results').isVisible(),true);
    assert.match(await page.locator('#search-status').innerText(),/0\s*\/\s*8/);
    await page.locator('#clear-search').click();await allSections(page);
    assert.equal(await search.inputValue(),'');assert.equal(await search.evaluate(node=>node===document.activeElement),true);
    await search.fill('   ');await allSections(page);
    await search.fill('response.audio.delta');
    assert.deepEqual(await page.locator('[data-doc-section]:visible').evaluateAll(nodes=>nodes.map(node=>node.id)),['session']);
    assert.equal(await page.locator('#session details').first().evaluate(node=>node.open),true,'Search opens matching collapsed protocol');
    await search.fill('旧任务的迟到结果');
    assert.deepEqual(await page.locator('[data-doc-section]:visible').evaluateAll(nodes=>nodes.map(node=>node.id)),['overview']);
    await assertFlow(page,'interrupt');
    await search.fill('HOST_RUNTIME_EVENT');
    await page.evaluate(()=>{location.hash='#cost';});await atSection(page,'cost');await allSections(page);
    assert.equal(await search.inputValue(),'','Hash navigation restores filtered-out sections');
    await page.goBack();await atSection(page,'session');await allSections(page);
    await openToc(page);await search.fill('HOST_RUNTIME_EVENT');
    await page.goForward();await atSection(page,'cost');await allSections(page);
    assert.equal(await search.inputValue(),'','Forward history navigation also resets filtering');
  }

  // Short desktop windows must retain reachable links/search inside the sticky sidebar.
  await page.setViewportSize({width:1024,height:500});await page.goto(article+'#session');await atSection(page,'session');
  const compactToc=await page.locator('#page-toc').evaluate(node=>({top:node.getBoundingClientRect().top,bottom:node.getBoundingClientRect().bottom,scrollHeight:node.scrollHeight,clientHeight:node.clientHeight,overflow:getComputedStyle(node).overflowY}));
  assert.ok(compactToc.top>=76&&compactToc.bottom<=500,'Short-screen TOC fits the viewport');
  assert.ok(compactToc.scrollHeight>compactToc.clientHeight&&['auto','scroll'].includes(compactToc.overflow),'Long desktop TOC is scrollable');
  await page.locator('.sidebar-resources a').last().scrollIntoViewIfNeeded();
  const lastResource=await page.locator('.sidebar-resources a').last().boundingBox();
  assert.ok(lastResource.y>=76&&lastResource.y+lastResource.height<=500,'Last sidebar resource remains reachable');

  // Static content stays complete and native details remain operable without scripts.
  const noJs=await context({javaScriptEnabled:false,viewport:{width:390,height:844}});
  const staticPage=await noJs.newPage();await staticPage.goto(article);
  await allSections(staticPage);await fits(staticPage,'No-JS mobile');
  assert.equal(await staticPage.locator('[data-flow-panel]:visible').count(),3);
  assert.equal(await staticPage.locator('.flow-tabs').isVisible(),false);
  assert.equal(await staticPage.locator('#section-search').isVisible(),false);
  await staticPage.locator('#page-toc>summary').click();assert.equal(await staticPage.locator('#page-toc').evaluate(node=>node.open),false);
  await staticPage.locator('#page-toc>summary').click();assert.equal(await staticPage.locator('[data-toc-link]:visible').count(),8);
  await staticPage.locator('#session details summary').click();assert.equal(await staticPage.locator('#session details').first().evaluate(node=>node.open),true);
  const hrefs=await staticPage.locator('a[href]').evaluateAll(nodes=>nodes.map(node=>node.getAttribute('href')));
  for(const href of new Set(hrefs)){
    const target=new URL(href,article);if(target.origin!==new URL(base).origin)continue;
    if(target.pathname==='/omni-runtime-host.html'){
      if(target.hash)assert.equal(await staticPage.locator('[id="'+decodeURIComponent(target.hash.slice(1))+'"]').count(),1,'Broken article anchor '+href);
    }else{
      const local=path.resolve(docs,'.'+decodeURIComponent(target.pathname));assert.ok(local.startsWith(docs+path.sep)||local===docs);
      const info=await stat(local);if(info.isDirectory())assert.ok((await stat(path.join(local,'index.html'))).isFile());else assert.ok(info.isFile());
    }
  }
  await noJs.close();

  // The reduced-motion mode must avoid both CSS and scripted animation during interaction.
  await page.setViewportSize({width:1440,height:1000});await page.goto(article+'#overview');await atSection(page,'overview');
  for(const flow of flows){
    await page.locator('[data-flow="'+flow+'"]').click();
    assert.deepEqual(await page.evaluate(()=>document.getAnimations().filter(animation=>['running','pending'].includes(animation.playState)).map(animation=>animation.animationName||'WAAPI')),[]);
  }
  assert.equal(await page.evaluate(()=>getComputedStyle(document.documentElement).scrollBehavior),'auto');

  const normal=await context({reducedMotion:'no-preference'});
  const normalPage=await normal.newPage();await normalPage.goto(article+'#overview');
  for(const flow of flows){
    await normalPage.locator('[data-flow="'+flow+'"]').click();await assertFlow(normalPage,flow);
    await normalPage.locator('#flow-'+flow).evaluate(async node=>{await Promise.all(node.getAnimations().map(animation=>animation.finished.catch(()=>{})));});
  }
  await normal.close();

  // Check only the KV page's new return entry and one pre-existing interaction.
  await page.goto(base+'kv-cache-quantization.html');
  const home=page.locator('.article-home-nav a');assert.equal(await home.count(),1);assert.equal(await home.getAttribute('href'),'./');
  await page.locator('#bitSlider').fill('8');await page.locator('#bitSlider').dispatchEvent('input');
  assert.match(await page.locator('#bitV').innerText(),/^8 bit$/);
  assert.match(await page.locator('#lvlV').innerText(),/256/);
  await home.click();await page.waitForURL(base);assert.equal(await page.locator('h1').count(),1);
  await main.close();
  assert.deepEqual(errors,[],'Article JavaScript errors');assert.deepEqual(external,[],'No external asset or API requests');
  console.log('Article smoke OK: 5 viewports, 40 anchor landings, sticky/mobile/short-height TOC, keyboard flows and protocol details, search/nav synchronization, empty/clear/code/hidden-flow matching, hash/back/forward recovery, no-JS complete content, normal/reduced motion, local links and KV return/slider. No external requests.');
}finally{
  await browser?.close();server.kill();
}
