import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const docs=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_CORE).href);
const server=spawn('python3',['-u','-m','http.server','0','--bind','127.0.0.1','-d',docs],{stdio:['ignore','pipe','ignore']});let browser;
try{
 const port=await new Promise((resolve,reject)=>{let data='';const timer=setTimeout(()=>reject(Error('Server timeout')),10000);server.stdout.on('data',c=>{data+=c;const m=/port (\d+)/.exec(data);if(m){clearTimeout(timer);resolve(m[1]);}});server.on('error',reject);});
 const base=`http://127.0.0.1:${port}/`;
 browser=await chromium.launch({executablePath:process.env.CHROME,args:['--no-sandbox']});
 const context=await browser.newContext({serviceWorkers:'block',reducedMotion:'reduce'}),page=await context.newPage(),errors=[],external=[];
 page.on('pageerror',e=>errors.push(e.message));await context.route('**/*',route=>{if(route.request().url().startsWith(base))return route.continue();external.push(route.request().url());return route.abort();});
 for(const width of [320,390,768,1024,1440]){await page.setViewportSize({width,height:900});await page.goto(base+'voice-agent-runtime.html');assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`article overflow ${width}`);}
 assert.match(await page.title(),/同一句话，三种厚度/);assert.equal(await page.locator('h1').count(),1);
 assert.match(await page.locator('h1').innerText(),/语音硬件后面到底差在哪/);
 assert.match(await page.locator('#scene').innerText(),/客厅灯调暗一点/);
 assert.match(await page.locator('#l1').innerText(),/1～10 元\/台\/年/);
 assert.match(await page.locator('#l1').innerText(),/5 元\/设备终身/);
 assert.match(await page.locator('#l2').innerText(),/能办事/);
 assert.match(await page.locator('#read').innerText(),/有没有生成或物理输出闭环/);
 assert.equal(await page.locator('a[href="https://github.com/smile-xuc/aihw-starter/blob/master/README.md#ai-硬件方案分层"]').count(),2);
 assert.ok(await page.evaluate(()=>!!(document.getElementById('read').compareDocumentPosition(document.getElementById('l2-deep'))&Node.DOCUMENT_POSITION_FOLLOWING)),'L2 appendix follows the mainline');
 const broken=await page.evaluate(()=>Array.from(document.querySelectorAll('a[href^="#"]')).map(a=>a.hash.slice(1)).filter(id=>!document.getElementById(id)));assert.deepEqual(broken,[]);
 const ids=await page.locator('[id]').evaluateAll(elements=>elements.map(el=>el.id));assert.equal(new Set(ids).size,ids.length,'unique fragment targets');
 // Preserve old incoming fragments while allowing the editorial structure to evolve.
 for(const id of ['task','layers','voice','state','delivery','visual','tools','acceptance','sources'])assert.ok(ids.includes(id),`missing incoming fragment ${id}`);
 assert.match(await page.locator('#task').innerText(),/假设/);
 assert.match(await page.locator('#voice').innerText(),/qwen-audio-agent/);
 assert.match(await page.locator('#visual').innerText(),/Qwen-Live-Harness/);
 assert.match(await page.locator('#sources').innerText(),/无模型请求/);
 assert.match(await page.locator('#sources').innerText(),/AGENT_PROTOCOL=none/);
 await page.locator('.toc a[href="#state"]').focus();await page.keyboard.press('Enter');assert.equal(new URL(page.url()).hash,'#state');
 await page.locator('.sources summary').focus();await page.keyboard.press('Enter');assert.equal(await page.locator('.sources').evaluate(el=>el.open),false);
 await page.keyboard.press('Enter');assert.equal(await page.locator('.sources').evaluate(el=>el.open),true);
 for(const id of ['voice','visual','cli','media']){const href='app/#/lab/'+id;await page.locator(`a[href="${href}"]`).first().click();await page.waitForSelector('[data-lab-demo]');await page.goBack();await page.waitForSelector('h1');}
 await page.goto(base);assert.equal(await page.locator('a.reading-card[href="voice-agent-runtime.html"]').count(),1);await page.click('a.reading-card[href="voice-agent-runtime.html"]');assert.match(await page.locator('h1').innerText(),/语音硬件后面到底差在哪/);
 if(process.env.REVIEW_SCREENSHOTS){await mkdir(process.env.REVIEW_SCREENSHOTS,{recursive:true});await page.screenshot({path:path.join(process.env.REVIEW_SCREENSHOTS,'voice-article-desktop.png'),fullPage:true});await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(process.env.REVIEW_SCREENSHOTS,'voice-article-mobile.png'),fullPage:true});}
 const fullText=(await page.locator('main').innerText()).replace(/\s+/g,' ').trim();
 const noJS=await browser.newContext({javaScriptEnabled:false,viewport:{width:320,height:740}});const staticPage=await noJS.newPage();await staticPage.goto(base+'voice-agent-runtime.html');assert.equal((await staticPage.locator('main').innerText()).replace(/\s+/g,' ').trim(),fullText,'complete article remains readable without JavaScript');assert.ok(await staticPage.locator('a[href="app/#/lab/voice"]').first().isVisible());await noJS.close();
 assert.deepEqual(errors,[]);assert.deepEqual(external,[]);console.log('PASS independent article: five widths, retained fragments, scenario and capability boundaries, keyboard/disclosure, four demo paths/back, homepage entry, identical no-JavaScript text, zero external requests');
}finally{await browser?.close();server.kill();}
