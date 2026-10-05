// 网页 APP 冒烟测试（CI 与本地通用）：无头 Chrome 以 390 × 844 打开全部页面和玩法，查控制台报错、越界请求和横向溢出；
// 再把发往百炼域名的请求转给 fake_bailian.py（各 demo 的 mock.py），把能在浏览器里真跑的玩法完整跑一遍。
//
//   npm install --no-save --prefix /tmp/pw playwright-core
//   PLAYWRIGHT_CORE=/tmp/pw/node_modules/playwright-core/index.mjs CHROME=$(command -v google-chrome) node docs/app/tools/smoke.mjs
//
// 只说明页面逻辑与 mock（官方事件 / 响应结构）对得上；真实接口的响应仍待真 Key 验证。
import { spawn, spawnSync } from 'node:child_process';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const docs = path.resolve(here, '../..');
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_CORE || 'playwright-core').href);
const STATIC_PORT = Number(process.env.STATIC_PORT || 8781);
const FAKE_PORT = Number(process.env.FAKE_PORT || 8782);
const BASE = `http://127.0.0.1:${STATIC_PORT}/app/`;
const ALLOWED = /^https:\/\/(dashscope\.aliyuncs\.com|dashscope-intl\.aliyuncs\.com|[a-z0-9-]+\.(cn-beijing|ap-southeast-1)\.maas\.aliyuncs\.com)\//;
const MOCK_OSS = /^https:\/\/(dashscope-file-mock|dashscope-result)\.oss-cn-beijing\.aliyuncs\.com\//;
const CRED = { values: { DASHSCOPE_API_KEY: 'sk-apptest0000000001', DASHSCOPE_API_REGION: 'cn-beijing', DASHSCOPE_WORKSPACE_ID: 'llm-apptest' } };
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization,content-type,x-dashscope-sse,x-dashscope-async,x-dashscope-ossresourceresolve', 'access-control-allow-methods': 'GET,POST' };

const children = [];
function serve(args, quiet) {
  children.push(spawn('python3', args, { cwd: docs, stdio: ['ignore', 'ignore', quiet ? 'ignore' : 'inherit'] }));
}
async function ready(url, method = 'GET') {
  for (let i = 0; i < 50; i++) {
    try { await fetch(url, { method }); return; } catch { await new Promise((r) => setTimeout(r, 200)); }
  }
  throw new Error(`没起来：${url}`);
}

const problems = [];
const hostsSeen = new Set();
let current = '';
let expectFault = false;

// 390 px 宽的手机上不能出现横向滚动
async function noOverflow(page) {
  const wide = await page.evaluate(() => {
    if (document.documentElement.scrollWidth <= window.innerWidth + 1) return null;
    const el = [...document.querySelectorAll('.page *')].find((e) => e.getBoundingClientRect().right > window.innerWidth + 1);
    return el ? `${el.tagName.toLowerCase()}.${el.className}` : 'unknown';
  });
  if (wide) problems.push(`[${current}] 横向溢出：${wide}`);
}

async function main() {
  serve(['-m', 'http.server', String(STATIC_PORT), '--bind', '127.0.0.1', '-d', docs], true);
  serve([path.join(here, 'fake_bailian.py'), '--port', String(FAKE_PORT)]);
  await ready(`${BASE}index.html`);
  await ready(`http://127.0.0.1:${FAKE_PORT}/x/reset`, 'POST');

  const browser = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'zh-CN', reducedMotion: 'reduce', serviceWorkers: 'block' });
  // Every provider request must have a later explicit mock handler; never fall through to the network.
  await context.route('**/*', route => route.request().url().startsWith(BASE) ? route.continue() : route.abort());
  await context.addInitScript(()=>{window.copiedTexts=[];Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.copiedTexts.push(text);}}});});
  const page = await context.newPage();
  page.on('console', (m) => { if (m.type() === 'error' && !(expectFault && /Failed to load resource:.*status of (401|500)/.test(m.text()))) problems.push(`[${current}] console：${m.text()}`); });
  page.on('pageerror', (e) => problems.push(`[${current}] 脚本异常：${e.message}`));
  page.on('response', (r) => { if (r.status() >= 400 && r.url().startsWith(BASE)) problems.push(`[${current}] HTTP ${r.status()}：${r.url()}`); });
  page.on('request', (r) => {
    const url = r.url();
    if (url.startsWith(BASE) || url.startsWith('data:') || url.startsWith('blob:')) return;
    if (!ALLOWED.test(url) && !MOCK_OSS.test(url)) problems.push(`[${current}] 请求发往了官方接入点以外的地址：${url}`);
    else hostsSeen.add(new URL(url).host);
  });

  current = 'home';
  await page.goto(BASE);
  await page.waitForSelector('.cat-card');
  await noOverflow(page);
  const cats = await page.$$eval('.cat-card', (els) => els.map((e) => e.getAttribute('href').replace('#/c/', '')));
  const routes = [];
  for (const cat of cats) {
    current = `c/${cat}`;
    await page.goto(`${BASE}#/c/${cat}`);
    await page.waitForSelector('.category-hero');
    await noOverflow(page);
    for (const href of await page.$$eval('a.row-card[href^="#/s/"]', (els) => els.map((e) => e.getAttribute('href')))) routes.push(href.slice(4));
  }
  const pages = [];
  for (const id of routes) {
    await page.goto(`${BASE}#/s/${id}`);
    await page.waitForSelector('.stage', { state: 'attached' });
    const variants = await page.$$eval('[data-variant]', (els) => els.map((e) => e.dataset.variant));
    for (const v of variants.length ? variants : ['']) pages.push({ id, variant: v });
  }
  for (const { id, variant } of pages) {
    current = `s/${id}/${variant}`;
    await page.goto(`${BASE}#/s/${id}${variant ? `/${variant}` : ''}`);
    await page.waitForSelector('.timeline .ev', { state: 'attached' });
    await page.locator('.process-panel').evaluate(e=>e.open=true);
    await page.click('[data-act="all"]');
    await page.waitForSelector('.stage-foot:not([hidden])');
    await noOverflow(page);
  }
  current = 'me';
  await page.goto(`${BASE}#/me`);
  await page.waitForSelector('form[data-form]');
  await noOverflow(page);

  // 浏览器真跑：填测试凭证，把百炼域名的请求转给假百炼
  await page.evaluate((cred) => localStorage.setItem('aihw.credentials.bailian', JSON.stringify(cred)), CRED);
  const requests = [];
  let failureMode = '';
  await context.route(MOCK_OSS, async(route,req)=>{
    if(req.method()==='OPTIONS')return route.fulfill({status:204,headers:CORS});
    const u=new URL(req.url()),upload=u.hostname.startsWith('dashscope-file-mock.');
    if(!upload && u.pathname!=='/transcription.json')return route.abort();
    requests.push({path:upload?'/__oss/upload':'/__oss/result',method:req.method(),headers:req.headers(),body:null});
    const res=await fetch(`http://127.0.0.1:${FAKE_PORT}/${current}/__oss/${upload?'upload':'result'}`,{method:req.method(),headers:req.headers(),...(req.method()==='POST'?{body:req.postDataBuffer()}: {})});
    return route.fulfill({status:res.status,headers:{...CORS,'content-type':res.headers.get('content-type')||'application/json'},body:Buffer.from(await res.arrayBuffer())});
  });
  await context.route(ALLOWED, async (route, req) => {
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    const u = new URL(req.url());
    requests.push({path:u.pathname,query:u.search,method:req.method(),headers:req.headers(),body:req.method()==='POST'?req.postDataJSON():null});
    if (failureMode === '401') return route.fulfill({status:401,headers:CORS,json:{message:'bad key sk-apptest0000000001'}});
    if (failureMode === 'hold' || (failureMode === 'hold-tts' && u.pathname.endsWith('SpeechSynthesizer'))) { await new Promise(r=>setTimeout(r,1000)); }
    if (failureMode === 'partial' && u.pathname.endsWith('chat/completions')) return route.fulfill({status:500,headers:CORS,json:{message:'minutes failed'}});
    if (failureMode === 'task-failed' && u.pathname.includes('/tasks/')) return route.fulfill({status:200,headers:CORS,json:{request_id:'smoke-failed-task',output:{task_id:'mock-task-1',task_status:'FAILED',code:'InvalidAudio',message:'mock transcription task failed'}}});
    if (failureMode === 'polling' && u.pathname.includes('/tasks/')) return route.fulfill({status:200,headers:CORS,json:{request_id:'smoke-running-task',output:{task_id:'mock-task-1',task_status:'RUNNING'}}});
    if (failureMode === 'unknown' && u.pathname.endsWith('chat/completions')) return route.fulfill({status:200,headers:{...CORS,'content-type':'text/event-stream'},body:'data: {"choices":[{"delta":{"content":"<img src=x onerror=alert(1)>安全结果"}}]}\n\ndata: [DONE]\n\n'});
    const res = await fetch(`http://127.0.0.1:${FAKE_PORT}/${current}${u.pathname}${u.search}`, { method: req.method(), headers: req.headers(), ...(req.method()==='POST'?{body: req.postDataBuffer()}: {}) });
    if (current==='02-ai-glasses.bailian' && u.pathname.endsWith('SpeechSynthesizer')) {
      const data=await res.json();data.output.audio.url='https://dashscope-result.oss-cn-beijing.aliyuncs.com/mock-reply.wav?token=temporary-speech';
      return route.fulfill({status:res.status,headers:CORS,json:data});
    }
    return route.fulfill({ status: res.status, headers: { ...CORS, 'content-type': res.headers.get('content-type') || 'application/json' }, body: Buffer.from(await res.arrayBuffer()) });
  });
  const results = [];
  for (const { id, variant } of pages) {
    current = id;
    await fetch(`http://127.0.0.1:${FAKE_PORT}/${id}/reset`, { method: 'POST' });
    await page.goto(`${BASE}#/s/${id}${variant ? `/${variant}` : ''}`);
    await page.waitForSelector('.timeline .ev', { state: 'attached' });
    const name = `${id}${variant ? `/${variant}` : ''}`;
    if (!(await page.$('[data-act="live"]'))) {
      const reason = await page.$eval('.live-bar', (e) => e.textContent.trim()).catch(() => '');
      results.push(`${name}：不在浏览器里跑 · ${reason.slice(0, 40)}…`);
      if (!reason) problems.push(`[${name}] 没有真跑按钮，也没有说明原因`);
      continue;
    }
    await page.click('[data-act="live"]');
    await page.click('[data-sheet="go"]');
    await page.waitForSelector('[data-export]', { timeout: 30000 });
    const errors = await page.$$eval('.timeline .ev .txt', (els) => els.map((e) => e.textContent).filter((t) => t.startsWith('出错')));
    const cost = await page.$eval('.live-cost', (e) => e.textContent.trim()).catch(() => '');
    const events = await page.$$eval('.timeline .ev', (els) => els.length);
    if (errors.length || !cost) problems.push(`[${name}] 真跑失败：${errors.join('；') || '没有出结果'}`);
    results.push(`${name}：真跑 ${events} 行 · ${cost}`);
  }
  // Personal input/setup/history flows against local mocks. No actual credentials or cloud requests.
  const assertUI = (value, message) => { if (!value) throw new Error(message); };
  const begin = async () => {await page.click('[data-act="live"]');await page.click('[data-sheet="go"]');await page.waitForSelector('[data-act="live"]:not([disabled])');await page.waitForSelector('[data-outcome] [data-export]');};
  const downloadText = async selector => {
    const event=page.waitForEvent('download');await page.click(selector);const file=await event;
    assertUI(!await file.failure(),'meeting download failed');
    const stream=await file.createReadStream();let text='';for await(const chunk of stream)text+=chunk.toString();return text;
  };
  const meetingActions = async scope => {
    const root=page.locator(scope);await root.locator('.meeting-result').waitFor();
    assertUI(await root.locator('[data-meeting-copy]').count()===6,'meeting sections/copy actions missing');
    await root.locator('.meeting-more').evaluate(node=>node.open=true);
    for(const [key,expected] of [['summary','录音卡'],['decisions','负责人：待确认'],['action_items','周五前'],['agenda','客户拜访'],['open_questions','供应商待定'],['risks','晚一周']]){
      await root.locator(`[data-meeting-copy="${key}"]`).click();
      assertUI((await page.evaluate(()=>window.copiedTexts.at(-1))).includes(expected),`meeting ${key} copied incorrect text`);
    }
    await root.locator('[data-result-copy]').click();const all=await page.evaluate(()=>window.copiedTexts.at(-1));
    for(const title of ['摘要','决策','待办','议题','待确认','风险'])assertUI(all.includes(`## ${title}`),`full minutes omitted ${title}`);
    assertUI(all.includes('说话人2')&&all.includes('周五前'),'meeting copy invented or dropped source assignments');
    assertUI(await downloadText(`${scope} [data-result-download]`)===all,'meeting Markdown differs from complete copy');
    await noOverflow(page);
  };
  current='experience'; await page.goto(BASE); await page.waitForSelector('.featured-card');
  assertUI((await page.locator('.featured-card').allTextContents()).join('').includes('一看即懂'),'home featured missing');
  assertUI(await page.locator('a[href="#/s/02-ai-glasses.bailian/default"]').count(),'02 direct route missing');
  await page.evaluate(()=>{localStorage.removeItem('aihw.credentials.bailian');sessionStorage.removeItem('aihw.credentials.bailian');});
  await page.goto(`${BASE}#/s/02-ai-glasses.bailian/default`); await page.waitForSelector('[data-question]');
  assertUI((await page.locator('.result-text').innerText()).includes('宫保鸡丁'),'02 sample outcome not immediately readable');
  assertUI(await page.locator('[data-result-copy]').count()===1,'02 sample copy action missing');
  assertUI(await page.locator('[data-question-preset]').count()===4,'photo shortcut choices missing');
  const presetQuestions={};const beforePresets=requests.length;
  for(const id of ['identify','read','translate','explain']) {
    await page.click(`[data-question-preset="${id}"]`);
    presetQuestions[id]=await page.inputValue('[data-question]');
    assertUI(presetQuestions[id].includes('看不清')&&presetQuestions[id].length<2000,`${id} lost uncertainty instructions`);
    assertUI(await page.locator(`[data-question-preset="${id}"]`).getAttribute('aria-pressed')==='true','selected shortcut not announced');
    assertUI(await page.locator('[data-question-preset][aria-pressed="true"]').count()===1,'multiple shortcuts appear selected');
    assertUI(await page.locator('[data-outcome] .result-text').count()===0,'shortcut retained an unrelated sample result');
  }
  await page.locator('[data-question-preset="read"]').focus();await page.keyboard.press('Enter');
  assertUI(await page.inputValue('[data-question]')===presetQuestions.read && requests.length===beforePresets,'shortcut keyboard action triggered provider');
  await page.fill('[data-question]','这张照片有什么？');
  assertUI(await page.locator('[data-question-preset][aria-pressed="true"]').count()===0,'editing kept an outdated shortcut selection');
  await page.click('.live-bar a'); await page.waitForSelector('form[data-form="bailian"]');
  assertUI(await page.locator('button[type="submit"]').textContent()==='保存并继续体验','setup continuation label missing');
  await page.fill('[name="DASHSCOPE_API_KEY"]',CRED.values.DASHSCOPE_API_KEY); await page.click('button[type="submit"]');
  assertUI(page.url().includes('#/me'),'missing scene workspace unexpectedly saved/returned');
  assertUI((await page.locator('[data-slot="result"]').innerText()).includes('继续这个玩法还需要'),'missing origin credential message');
  await page.fill('[name="DASHSCOPE_WORKSPACE_ID"]',CRED.values.DASHSCOPE_WORKSPACE_ID);await page.click('button[type="submit"]');
  await page.waitForSelector('[data-question]');assertUI(await page.inputValue('[data-question]')==='这张照片有什么？','draft question lost on setup return');
  await page.click('[data-question-preset="translate"]');
  await page.goto(`${BASE}#/me?return=${encodeURIComponent('#/s/02-ai-glasses.bailian/default')}`);await page.waitForSelector('button[type="submit"]');await page.click('button[type="submit"]');
  await page.waitForSelector('[data-question]');
  assertUI(await page.inputValue('[data-question]')===presetQuestions.translate && await page.locator('[data-question-preset="translate"]').getAttribute('aria-pressed')==='true','shortcut draft lost on settings return');
  await page.fill('[data-question]','这张照片有什么？');
  current='02-ai-glasses.bailian'; requests.length=0; await begin();
  const changed=requests.find(r=>r.path.endsWith('chat/completions')).body.messages.at(-1).content;
  assertUI(!changed.some(p=>p.type==='input_audio') && changed.some(p=>p.text==='这张照片有什么？'),'changed sample question did not use text-only question');
  const photoRequest=requests.find(r=>r.path.endsWith('chat/completions')).body;
  assertUI(photoRequest.messages[0].role==='system'&&photoRequest.messages[0].content.includes('uncertainties'),'custom question bypassed uncertainty instructions');
  assertUI((await page.locator('.photo-uncertainties').innerText()).includes('小字看不清'),'reported unknown not separated from answer');
  await page.click('[data-result-copy]');const photoCopy=await page.evaluate(()=>window.copiedTexts.at(-1));
  assertUI(photoCopy.includes('看不清 / 无法确定')&&photoCopy.includes('小字看不清'),'copy omitted uncertainty');
  assertUI(await downloadText('[data-result-download]')===photoCopy,'photo export differs from full copy');
  const photo=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1sAAAAASUVORK5CYII=','base64');
  // Final-review regressions: failed local validation must stay readable and recoverable.
  const finalCheck = async (name, check) => {try {await check();console.log(`final regression PASS: ${name}`);} catch(e) {problems.push(`final regression ${name}: ${e.message}`);}};
  const sampleActions = async () => {
    assertUI(await page.locator('[data-outcome] .result-text').count()===1,'free sample result missing');
    for(const selector of ['[data-outcome] [data-result-copy]','[data-outcome] [data-result-download]','[data-outcome] [data-export]','[data-act="replay"]']) assertUI(await page.locator(selector).count()===1,`sample action missing: ${selector}`);
    await page.locator('.process-panel').evaluate(e=>e.open=true);await page.click('[data-act="all"]');await page.waitForSelector('.stage-foot:not([hidden])');
  };
  for(const id of ['02-ai-glasses.bailian','07-recorder.bailian']) {
    current=id;await page.goto(`${BASE}#/s/${id}/default`);await page.waitForSelector('[data-reset]');await page.click('[data-reset]');await page.click('[data-source="own"]');
    await finalCheck(`${id} missing own material`,async()=>{
      const before=requests.length;await page.click('[data-act="live"]');await page.waitForSelector('[data-act="live"]:not([disabled])');
      await page.waitForSelector('[data-outcome] .inline-error',{timeout:2000});
      assertUI((await page.locator('[data-outcome]').innerText()).includes('请先选择并核验你的素材'),'missing file error unreadable');assertUI(requests.length===before,'missing file reached provider');
    });
    const before=requests.length;await page.click('[data-source="sample"]');await finalCheck(`${id} back to sample restores outcome`,sampleActions);
    await page.click('[data-source="own"]');await page.click('[data-reset]');await finalCheck(`${id} reset restores outcome`,sampleActions);assertUI(requests.length===before,'sample restoration triggered provider');
  }
  current='02-ai-glasses.bailian';await page.goto(`${BASE}#/s/${current}/default`);await page.waitForSelector('[data-question]');await page.click('[data-reset]');await page.fill('[data-question]','');await page.click('[data-source="own"]');
  await page.setInputFiles('[data-material]',{name:'recover.png',mimeType:'image/png',buffer:photo});
  await finalCheck('empty question photo decode recovers without reselection',async()=>{
    await page.waitForSelector('[data-material-status] .inline-ok',{timeout:2000});
    const before=requests.length;await page.click('[data-act="live"]');await page.waitForSelector('[data-outcome] .inline-error');assertUI(requests.length===before && (await page.locator('[data-outcome]').innerText()).includes('提问不能为空'),'empty question reached provider');
    await page.fill('[data-question]','恢复后的有效提问');requests.length=0;await begin();
    assertUI(requests.find(r=>r.path.endsWith('chat/completions')).body.messages.at(-1).content.some(p=>p.text==='恢复后的有效提问'),'corrected question did not reach provider');
  });
  await page.click('[data-reset]');await page.fill('[data-question]','这张照片有什么？');
  // Gate real File reads, while retaining real signature/image decode checks.
  await page.evaluate(()=>{
    const original=File.prototype.arrayBuffer;window.materialReads=[];
    window.restoreMaterialReads=()=>{File.prototype.arrayBuffer=original;};
    File.prototype.arrayBuffer=function(){
      const bytes=original.call(this);let release;const gate=new Promise(r=>{release=r;});
      const read={name:this.name,release,settled:false};window.materialReads.push(read);
      return gate.then(async()=>{const buffer=await bytes;read.settled=true;return buffer;});
    };
  });
  await page.click('[data-source="own"]');await page.setInputFiles('[data-material]',{name:'mine.png',mimeType:'image/png',buffer:photo});
  await page.waitForFunction(()=>window.materialReads.length===1);
  await page.click('[data-source="sample"]');await page.click('[data-source="own"]');
  assertUI(await page.evaluate(()=>window.materialReads.length)===2,'returning to own material did not resume interrupted decode');
  await page.evaluate(()=>{window.materialReads[0].release();window.materialReads[1].release();});
  await page.waitForSelector('[data-material-status] .inline-ok');
  await page.setInputFiles('[data-material]',{name:'settings.png',mimeType:'image/png',buffer:photo});
  await page.waitForFunction(()=>window.materialReads.length===3);
  await page.goto(`${BASE}#/me?return=${encodeURIComponent('#/s/02-ai-glasses.bailian/default')}`);await page.waitForSelector('button[type="submit"]');await page.click('button[type="submit"]');
  await page.waitForSelector('[data-question]');await page.waitForFunction(()=>window.materialReads.length===4);
  await page.evaluate(()=>{window.materialReads[2].release();window.materialReads[3].release();});
  await page.waitForSelector('[data-material-status] .inline-ok');
  assertUI(await page.evaluate(async()=>{const {draftFor}=await import('./js/experience.js');return draftFor('02-ai-glasses.bailian/default').input.name;})==='settings.png','retained material not validated after settings remount');
  // A stale invalid read must not replace the newer valid selection or its status.
  await page.setInputFiles('[data-material]',{name:'stale.png',mimeType:'image/png',buffer:Buffer.from('invalid png')});await page.waitForFunction(()=>window.materialReads.length===5);
  await page.setInputFiles('[data-material]',{name:'newest.png',mimeType:'image/png',buffer:photo});await page.waitForFunction(()=>window.materialReads.length===6);
  await page.evaluate(()=>window.materialReads[5].release());await page.waitForSelector('[data-material-status] .inline-ok');
  await page.evaluate(()=>window.materialReads[4].release());await page.waitForFunction(()=>window.materialReads[4].settled);
  assertUI(await page.locator('[data-material-status] .inline-ok').count()===1,'stale failure contaminated the current material status');
  assertUI(await page.evaluate(async()=>{const {draftFor}=await import('./js/experience.js');return draftFor('02-ai-glasses.bailian/default').input.name;})==='newest.png','stale decode replaced selected input');
  await page.evaluate(()=>window.restoreMaterialReads());
  await page.fill('[data-question]','');
  await page.goto(`${BASE}#/me?return=${encodeURIComponent('#/s/02-ai-glasses.bailian/default')}`);await page.waitForSelector('button[type="submit"]');await page.click('button[type="submit"]');
  await page.waitForSelector('[data-question]');assertUI(await page.inputValue('[data-question]')==='','empty question was replaced on settings return');
  const beforeEmpty=requests.length;await page.click('[data-act="live"]');await page.waitForSelector('[data-outcome] .inline-error');
  assertUI((await page.locator('[data-outcome]').innerText()).includes('提问不能为空') && requests.length===beforeEmpty,'empty question reached provider');
  await page.click('[data-reset]');assertUI(await page.inputValue('[data-question]')==='这是什么菜？辣不辣？','explicit reset did not restore sample question');
  await page.fill('[data-question]','');
  await page.goto(`${BASE}#/me?return=${encodeURIComponent('#/s/02-ai-glasses.bailian/default')}`);await page.waitForSelector('button[type="submit"]');await page.click('button[type="submit"]');
  await page.waitForSelector('[data-question]');assertUI(await page.inputValue('[data-question]')==='' && await page.locator('[data-outcome] .result-text').count()===0,'empty sample question restored the original sample answer');
  await page.click('[data-reset]');
  await page.click('[data-source="own"]');await page.setInputFiles('[data-material]',{name:'mine.png',mimeType:'image/png',buffer:photo});
  await page.waitForSelector('[data-material-status] .inline-ok');requests.length=0;await begin();
  const own=requests.find(r=>r.path.endsWith('chat/completions')).body.messages.at(-1).content;
  assertUI(own.find(p=>p.type==='image_url').image_url.url.startsWith('data:image/png;') && !own.some(p=>p.type==='input_audio'),'own PNG payload wrong');
  assertUI(await page.locator('[data-outcome] audio[aria-label="听播报"][controls]').count()===1,'successful live02 speech control missing beside answer');
  assertUI(!await page.locator('.process-panel').evaluate(e=>e.open),'successful technical process stayed open');
  assertUI((await page.locator('[data-outcome] audio').getAttribute('src')).includes('temporary-speech'),'temporary speech URL unavailable');
  assertUI(await page.evaluate(async()=>{const {draftFor}=await import('./js/experience.js');return draftFor('02-ai-glasses.bailian/default').input.name;})==='mine.png','current draft input did not follow selected file');
  await noOverflow(page);
  const speechExportEvent=page.waitForEvent('download');await page.click('[data-outcome] [data-export]');
  const speechExport=await speechExportEvent;const speechStream=await speechExport.createReadStream();let speechExportText='';for await(const chunk of speechStream)speechExportText+=chunk.toString();
  assertUI(!speechExportText.includes('temporary-speech') && !speechExportText.includes('https://'),'live speech URL escaped into trace export');
  await page.goto(`${BASE}#/me`);await page.waitForSelector('[data-history-open]');await page.locator('[data-history-open]').first().click();await page.waitForSelector('[data-history-result] [data-export]');
  assertUI(await page.locator('[data-history-result] audio').count()===0,'saved result exposed temporary speech');
  await page.goto(`${BASE}#/s/02-ai-glasses.bailian/default`);await page.waitForSelector('[data-question]');
  const saved = await page.evaluate(()=>JSON.parse(localStorage.getItem('aihw.history.v1')));
  assertUI(saved.length>=2 && !JSON.stringify(saved).includes(CRED.values.DASHSCOPE_API_KEY) && !JSON.stringify(saved).includes('data:image') && !JSON.stringify(saved).includes('https://'),'history persisted sensitive material');
  const count=requests.length;
  await page.setInputFiles('[data-material]',{name:'corrupt.png',mimeType:'image/png',buffer:Buffer.from('not a png')});await page.waitForSelector('[data-material-status] .inline-error');
  await page.click('[data-act="live"]');await page.waitForSelector('[data-outcome] .inline-error');assertUI(requests.length===count,'corrupt image reached provider');
  // Image with plausible headers but corrupt compressed pixels must fail browser decode.
  const broken=Buffer.alloc(33); Buffer.from([137,80,78,71,13,10,26,10]).copy(broken);broken.writeUInt32BE(13,8);broken.write('IHDR',12);broken.writeUInt32BE(1,16);broken.writeUInt32BE(1,20);
  await page.setInputFiles('[data-material]',{name:'header-only.png',mimeType:'image/png',buffer:broken});await page.waitForSelector('[data-material-status] .inline-error');assertUI((await page.locator('[data-material-status]').innerText()).includes('解码'),'corrupt image decode not checked');
  await page.click('[data-reset]');expectFault=true;failureMode='401';await begin();assertUI((await page.locator('[data-outcome]').innerText()).includes('401'),'401 outcome missing');assertUI(!(await page.locator('[data-outcome]').innerText()).includes(CRED.values.DASHSCOPE_API_KEY),'error exposed secret');
  const beforeRetry=requests.length;await page.click('[data-outcome-retry]');await page.waitForSelector('[data-sheet="go"]');
  assertUI(requests.length===beforeRetry,'retry bypassed billing confirmation');await page.click('[data-sheet="cancel"]');await page.waitForSelector('[data-act="live"]:not([disabled])');
  assertUI(await page.locator('[data-outcome-retry]').evaluate(node=>node===document.activeElement),'retry cancel lost keyboard focus');
  failureMode='';await page.click('[data-outcome-retry]');await page.click('[data-sheet="go"]');await page.waitForSelector('[data-act="live"]:not([disabled])');
  assertUI(await page.locator('[data-outcome] .result-text').count()===1&&await page.locator('[data-outcome-retry]').count()===0,'explicit retry did not recover the result');
  failureMode='unknown';await begin();assertUI((await page.locator('.result-cost').innerText()).includes('费用未知'),'unknown usage presented as exact cost');assertUI(await page.locator('.result-text img').count()===0,'model output executed markup');
  failureMode='hold';await page.click('[data-act="live"]');await page.click('[data-sheet="go"]');await page.waitForSelector('[data-act="live"][disabled]');assertUI(await page.locator('[data-question]').isDisabled(),'input mutable during run');assertUI(await page.locator('[data-question-preset]:disabled').count()===4,'shortcuts mutable during run');await page.click('[data-act="stop"]');await page.waitForSelector('[data-act="live"]:not([disabled])');assertUI((await page.locator('[data-outcome]').innerText()).includes('已停止'),'stopped state missing');failureMode='';
  await page.click('[data-source="own"]');await page.setInputFiles('[data-material]',{name:'speech-stop.png',mimeType:'image/png',buffer:photo});await page.waitForSelector('[data-material-status] .inline-ok');await page.click('[data-question-preset="read"]');
  failureMode='hold-tts';const speechStarted=page.waitForRequest(req=>req.url().endsWith('SpeechSynthesizer'));await page.click('[data-act="live"]');await page.click('[data-sheet="go"]');await speechStarted;
  await page.click('[data-act="stop"]');await page.waitForSelector('[data-act="live"]:not([disabled])');
  assertUI((await page.locator('[data-outcome]').innerText()).includes('已停止')&&(await page.locator('.photo-uncertainties').innerText()).includes('小字看不清'),'stopping speech lost completed answer or its unknowns');
  assertUI(await page.locator('[data-result-copy]').count()===1&&await page.locator('[data-outcome-retry]').count()===1,'stopped answer cannot be copied or manually retried');
  await page.goto(`${BASE}#/me`);await page.waitForSelector('[data-history-open]');await page.locator('[data-history-open]').first().click();await page.waitForSelector('[data-history-result] .photo-uncertainties');
  assertUI((await page.locator('[data-history-result] .photo-uncertainties').innerText()).includes('小字看不清')&&await page.locator('[data-history-result] [data-outcome-retry]').count()===0,'history lost limits or offered retry without material');
  failureMode='';
  current='07-recorder.bailian';await page.goto(`${BASE}#/s/07-recorder.bailian/default`);await page.waitForSelector('[data-source="own"]');assertUI((await page.locator('.result-text').innerText()).includes('待办'),'07 sample minutes not immediately readable');await meetingActions('[data-outcome]');await page.click('[data-source="own"]');
  const wav = seconds=>{const b=Buffer.alloc(44+seconds*16000*2);b.write('RIFF',0);b.writeUInt32LE(b.length-8,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(16000,24);b.writeUInt32LE(32000,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(b.length-44,40);return b;};
  await page.setInputFiles('[data-material]',{name:'meeting.wav',mimeType:'audio/wav',buffer:wav(1)});await page.waitForSelector('[data-material-status] .inline-ok');requests.length=0;await begin();
  assertUI(requests[0]?.method==='GET' && requests[0]?.path==='/api/v1/uploads' && new URLSearchParams(requests[0].query).get('model')==='qwen-audio-3.1-asr-flash-filetrans','filetrans upload policy model or order incorrect');
  const uploaded=requests.findIndex(r=>r.path==='/__oss/upload'),submitted=requests.findIndex(r=>r.path.endsWith('/asr/transcription')),downloaded=requests.findIndex(r=>r.path==='/__oss/result'),summarized=requests.findIndex(r=>r.path.endsWith('/chat/completions'));
  assertUI(uploaded>0 && submitted>uploaded && downloaded>submitted && summarized>downloaded,'filetrans chain order incorrect');
  assertUI(requests.filter(r=>r.path.includes('/tasks/')).length===2,'filetrans did not poll RUNNING until SUCCEEDED');
  assertUI(!requests[uploaded].headers.authorization&&!requests[downloaded].headers.authorization,'API Key sent to OSS upload or result URL');
  const submission=requests[submitted];
  assertUI(submission.body.model==='qwen-audio-3.1-asr-flash-filetrans' && submission.body.input.file_urls[0].startsWith('oss://'),'filetrans did not submit uploaded OSS object');
  assertUI(submission.headers['x-dashscope-async']==='enable'&&submission.headers['x-dashscope-ossresourceresolve']==='enable','filetrans async/OSS resource headers missing');
  assertUI(requests[summarized].body.model==='qwen3.8-flash'&&!requests.some(r=>r.path.endsWith('/generation')),'07 used old synchronous ASR or incorrect minutes model');
  const responseFormat=requests[summarized].body.response_format;
  assertUI(responseFormat.type==='json_schema'&&responseFormat.json_schema.strict===true,'07 did not request strict structure');
  assertUI(responseFormat.json_schema.schema.properties.action_items.items.properties.source_ids.items.enum.includes('s008'),'07 source IDs were not restricted to actual transcript');
  await meetingActions('[data-outcome]');
  assertUI((await page.locator('[data-byok-storage]').innerText()).includes('BYOK')&&(await page.locator('[data-byok-storage]').innerText()).includes('48 小时'),'BYOK temporary storage boundary missing');
  const callCount=requests.length;
  const sourceButton=page.locator('[data-outcome] .meeting-action_items [data-meeting-source]').first();
  const sourceId=await sourceButton.getAttribute('data-meeting-source');await sourceButton.focus();await page.keyboard.press('Enter');
  assertUI(await page.locator(`[data-outcome] [data-transcript-id="${sourceId}"]`).evaluate(node=>node===document.activeElement&&node.classList.contains('is-linked')),'source jump did not focus and highlight the actual sentence');
  const editSelector='[data-meeting-edit-form="action_items:0"]';
  await page.locator('[data-outcome] [data-meeting-edit="action_items:0"]').click();
  await page.locator(`${editSelector} input[name="owner"]`).fill('林工（用户核对）');await page.locator(`${editSelector} input[name="due"]`).fill('周五 17:00');
  await page.locator(`${editSelector} [data-meeting-edit-cancel]`).click();
  assertUI(!await page.locator(editSelector).isVisible()&&await page.locator('.meeting-correction').count()===0&&(await page.locator(`${editSelector} input[name="owner"]`).inputValue())==='说话人2','cancel did not discard edits without saving');
  const beforeEdit=await page.evaluate(()=>JSON.parse(localStorage.getItem('aihw.history.v1')));
  await page.locator('[data-outcome] [data-meeting-edit="action_items:0"]').click();
  await page.locator(`${editSelector} input[name="owner"]`).fill('林工（用户核对）');await page.locator(`${editSelector} input[name="due"]`).fill('周五 17:00');await page.locator(`${editSelector} button[type="submit"]`).click();
  assertUI((await page.locator('[data-meeting-save-status]').innerText()).includes('已保存'),'live correction did not save to existing history');
  await page.locator('[data-outcome] [data-result-copy]').click();const corrected=await page.evaluate(()=>window.copiedTexts.at(-1));
  assertUI(corrected.includes('负责人：林工（用户核对） · 截止日期：周五 17:00')&&corrected.includes('用户修正（AI 原值：说话人2）'),'corrected copy lost user values or AI provenance');
  assertUI(await downloadText('[data-outcome] [data-result-download]')===corrected,'corrected download differs from copy');
  const correctedExport=JSON.parse(await downloadText('[data-outcome] [data-export]'));
  assertUI(JSON.parse(correctedExport.outputs.find(f=>f.path==='out/minutes.json').text).action_items[0].owner==='说话人2','manual edit overwrote original model JSON');
  assertUI(JSON.parse(correctedExport.outputs.find(f=>f.path==='out/minutes-edits.json').text).edits.length===2,'correction audit missing from export');
  const afterEdit=await page.evaluate(()=>JSON.parse(localStorage.getItem('aihw.history.v1')));
  assertUI(afterEdit.length===beforeEdit.length&&afterEdit[0].id===beforeEdit[0].id,'correction created duplicate history');
  assertUI(requests.length===callCount,'source review or manual correction sent a provider request');await noOverflow(page);
  await page.goto(`${BASE}#/me`);await page.waitForSelector('[data-history-open]');await page.locator('[data-history-open]').first().click();await meetingActions('[data-history-result]');
  assertUI((await page.locator('[data-history-result] .meeting-action_items').innerText()).includes('林工（用户核对）'),'history did not reopen user correction');
  assertUI(await page.locator('[data-history-experience]').count()===1,'history return missing');
  await page.locator('[data-history-result] [data-meeting-restore="action_items:0"]').click();
  assertUI((await page.locator('[data-history-result] .meeting-action_items').innerText()).includes('说话人2')&&await page.locator('[data-history-experience]').count()===1,'restore lost original assignment or history return');
  assertUI(!JSON.parse(await page.evaluate(()=>localStorage.getItem('aihw.history.v1')))[0].trace.outputs.some(f=>f.path==='out/minutes-edits.json'),'restore did not remove correction sidecar');
  await page.evaluate(()=>{window.originalHistorySet=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='aihw.history.v1')throw Error('test storage unavailable');return window.originalHistorySet.call(this,key,value);};});
  await page.locator('[data-history-result] [data-meeting-edit="action_items:0"]').click();await page.locator(`${editSelector} input[name="owner"]`).fill('存储失败仍可复制');await page.locator(`${editSelector} button[type="submit"]`).click();
  assertUI((await page.locator('[data-meeting-save-status]').innerText()).includes('修正未保存到历史'),'failed storage falsely reported success');
  await page.locator('[data-history-result] [data-result-copy]').click();assertUI((await page.evaluate(()=>window.copiedTexts.at(-1))).includes('存储失败仍可复制'),'failed storage lost in-page correction');
  await page.evaluate(()=>{Storage.prototype.setItem=window.originalHistorySet;delete window.originalHistorySet;});
  assertUI(requests.length===callCount,'history edit or restore sent a provider request');
  const meetingHistory=await page.evaluate(()=>localStorage.getItem('aihw.history.v1'));
  for(const forbidden of [CRED.values.DASHSCOPE_API_KEY,'temporary-transcription','mock-policy','mock-signature','oss://','Authorization','data:audio','blob:'])assertUI(!meetingHistory.includes(forbidden),`meeting history persisted ${forbidden}`);
  await page.goto(`${BASE}#/s/07-recorder.bailian/default`);await page.waitForSelector('[data-material-status] .inline-ok');
  const beforeLong=requests.length;await page.setInputFiles('[data-material]',{name:'long.wav',mimeType:'audio/wav',buffer:wav(181)});await page.waitForSelector('[data-material-status] .inline-error');assertUI((await page.locator('[data-material-status]').innerText()).includes('180'),'long audio not rejected');assertUI(requests.length===beforeLong,'long audio reached provider');
  await page.setInputFiles('[data-material]',{name:'meeting.wav',mimeType:'audio/wav',buffer:wav(1)});await page.waitForSelector('[data-material-status] .inline-ok');
  requests.length=0;failureMode='task-failed';await begin();
  assertUI((await page.locator('[data-outcome]').innerText()).includes('正在转写录音失败'),'failed async task not explained');
  assertUI(!requests.some(r=>r.path==='/__oss/result'||r.path.endsWith('/chat/completions')),'failed async task continued to result/minutes');
  const failedTask=await page.evaluate(()=>JSON.parse(localStorage.getItem('aihw.history.v1'))[0].trace);
  assertUI(failedTask.status==='failed'&&failedTask.usageRecords?.some(r=>r.requestId==='smoke-asr-request-123'),'failed async task audit missing');
  requests.length=0;failureMode='polling';await page.click('[data-act="live"]');await page.click('[data-sheet="go"]');
  const pollDeadline=Date.now()+10000;while(!requests.some(r=>r.path.includes('/tasks/'))){assertUI(Date.now()<pollDeadline,'async task polling never started');await page.waitForTimeout(25);}
  await page.click('[data-act="stop"]');await page.waitForSelector('[data-act="live"]:not([disabled])');
  const stoppedPollCount=requests.length;await page.waitForTimeout(2200);
  assertUI(requests.length===stoppedPollCount&&!requests.some(r=>r.path.endsWith('/chat/completions')),'stopped async task continued polling or summarizing');
  assertUI((await page.locator('[data-outcome]').innerText()).includes('已停止'),'async poll stop outcome missing');
  assertUI(await page.evaluate(()=>JSON.parse(localStorage.getItem('aihw.history.v1'))[0].trace.status)==='stopped','async poll stop not recorded');
  failureMode='partial';await begin();await page.locator('.meeting-transcript[open]').waitFor();
  assertUI((await page.locator('[data-outcome]').innerText()).includes('转写已保留，纪要尚未完成'),'failed minutes lost partial transcript');
  await page.locator('[data-transcript-copy="0"]').click();const partialText=await page.evaluate(()=>window.copiedTexts.at(-1));
  assertUI(partialText.includes('说话人')&&partialText.includes('录音卡'),'partial transcript copy missing source text');
  assertUI(await downloadText('[data-transcript-download="0"]')===partialText,'partial transcript download differs from copy');failureMode='';
  const actualTraces = await page.evaluate(()=>JSON.parse(localStorage.getItem('aihw.history.v1')).map(r=>r.trace));
  const schema = JSON.parse(readFileSync(path.join(docs,'../solutions/demo-standard/trace.schema.json')));
  const checked=spawnSync(process.env.PYTHON || 'python3',['-c','import json,sys,jsonschema\nd=json.load(sys.stdin)\nfor t in d["traces"]: jsonschema.validate(t,d["schema"])'],{input:JSON.stringify({schema,traces:actualTraces}),encoding:'utf8'});
  assertUI(checked.status===0,`actual browser traces violate schema: ${checked.stderr}`);
  assertUI(actualTraces[0].status==='failed' && actualTraces[0].usageRecords.some(r=>r.requestId==='smoke-asr-request-123'),'failed ASR audit metadata missing');
  await page.goto(`${BASE}#/me`);await page.waitForSelector('[data-history-open]');await page.locator('[data-history-open]').first().click();await page.waitForSelector('[data-history-result] [data-export]');await noOverflow(page);
  const downloadEvent=page.waitForEvent('download');await page.click('[data-history-result] [data-export]');
  const exported=await downloadEvent;const stream=await exported.createReadStream();let exportedText='';for await(const chunk of stream)exportedText+=chunk.toString();
  const exportCheck=spawnSync(process.env.PYTHON || 'python3',['-c','import json,sys,jsonschema\nd=json.load(sys.stdin)\njsonschema.validate(d["trace"],d["schema"])'],{input:JSON.stringify({schema,trace:JSON.parse(exportedText)}),encoding:'utf8'});
  assertUI(exportCheck.status===0,`downloaded browser export invalid: ${exportCheck.stderr}`);
  await page.setInputFiles('[data-act="open-trace"]',{name:'record.json',mimeType:'application/json',buffer:Buffer.from(exportedText)});await page.waitForSelector('[data-slot="local-trace"] [data-export]');
  const reexportEvent=page.waitForEvent('download');await page.click('[data-slot="local-trace"] [data-export]');
  const reexported=await reexportEvent;const reexportStream=await reexported.createReadStream();let reexportedText='';for await(const chunk of reexportStream)reexportedText+=chunk.toString();
  assertUI(JSON.stringify(JSON.parse(reexportedText).usageRecords)===JSON.stringify(JSON.parse(exportedText).usageRecords),'failed imported trace lost request/model/usage metadata');
  assertUI(await page.locator('[data-slot="local-trace"] audio').count()===0,'imported text record exposed temporary speech');
  await page.reload();await page.waitForSelector('[data-history-open]');assertUI(await page.locator('[data-history-open]').count()>0,'history lost on reload');
  await page.locator('[data-history-delete]').first().click();await page.click('[data-history-clear]');assertUI(await page.locator('[data-history-open]').count()===0,'clear history failed');
  await page.goto(`${BASE}#/me?return=${encodeURIComponent('https://evil.test')}`);await page.waitForSelector('button[type="submit"]');assertUI(await page.locator('button[type="submit"]').textContent()==='保存','invalid return changed generic save');
  // Storage failure must not turn successful completion into failure or disable export.
  current='02-ai-glasses.bailian';await page.goto(`${BASE}#/s/02-ai-glasses.bailian/default`);await page.waitForSelector('[data-act="live"]');
  await page.evaluate(()=>{const original=Storage.prototype.setItem;window.restoreHistoryStorage=()=>{Storage.prototype.setItem=original;};Storage.prototype.setItem=function(k,v){if(k==='aihw.history.v1')throw new DOMException('quota','QuotaExceededError');return original.call(this,k,v);};});
  await begin();assertUI((await page.locator('.history-note').innerText()).includes('历史未保存'),'quota failure not disclosed');assertUI(await page.locator('[data-result-copy]').count()===1,'quota failure lost result');assertUI(await page.locator('[data-outcome] [data-export]').count()===1,'quota failure lost export');
  await page.evaluate(()=>window.restoreHistoryStorage());
  // Leaving a pending request must abort and never append history or leave a confirmation overlay.
  const priorHistory=await page.evaluate(()=>localStorage.getItem('aihw.history.v1'));failureMode='hold';await page.click('[data-act="live"]');await page.click('[data-sheet="go"]');await page.waitForSelector('[data-act="live"][disabled]');await page.evaluate(()=>location.hash='#/me');await page.waitForSelector('form[data-form]');await page.waitForTimeout(800);assertUI(await page.evaluate(()=>localStorage.getItem('aihw.history.v1'))===priorHistory,'page-leave added detached history');failureMode='';
  console.log('体验 UI 回归通过：四快捷问题仅填入/键盘/编辑/设置保留，不确定项展示/复制/下载，手动重试计费确认/取消，停止播报保留回答与不确定项并在历史重开，设置返回、空提问保留、素材解码切换/重挂载/旧读取隔离、临时播报/导出隔离、样本提问、PNG、WAV、损坏/过长素材、401、停止、缺失用量、filetrans OSS上传/两次轮询/结果无Key下载、任务失败审计、轮询停止、会议六区复制/下载/历史、失败转写复制/下载、失败记录导入再导出、历史重开/删除');
  // Isolated desktop Chrome regression exercises the actual SW cache and offline reloads.
  const offlineContext=await browser.newContext({viewport:{width:1280,height:900},locale:'zh-CN',reducedMotion:'reduce',serviceWorkers:'allow'});
  const offlinePage=await offlineContext.newPage();
  const offlineErrors=[],offlineFailures=[];
  offlinePage.on('requestfailed',r=>offlineFailures.push({url:r.url(),error:r.failure()?.errorText}));
  offlinePage.on('pageerror',e=>offlineErrors.push(e.message));
  offlinePage.on('console',m=>{if(m.type()==='error')offlineErrors.push(m.text());});
  await offlineContext.route('**/*',route=>route.request().url().startsWith(BASE)?route.continue():route.abort());
  try {
    // Seed same-origin neighbor and old app caches before this app installs its worker.
    await offlinePage.goto(`${BASE}manifest.webmanifest`);
    await offlinePage.evaluate(async()=>{
      await (await caches.open('unrelated-app-sentinel')).put('./unrelated-marker',new Response('preserve neighboring app cache'));
      await (await caches.open('aihw-app-v2')).put('./old-app-marker',new Response('old app version'));
    });
    await offlinePage.goto(BASE);await offlinePage.waitForSelector('.featured-card');
    await offlinePage.evaluate(()=>navigator.serviceWorker.ready);
    await offlinePage.waitForFunction(()=>!!navigator.serviceWorker.controller);
    const activationCaches=await offlinePage.evaluate(()=>caches.keys());
    assertUI(activationCaches.includes('unrelated-app-sentinel'),'service-worker activation deleted neighboring app cache');
    assertUI(!activationCaches.includes('aihw-app-v2'),'service-worker activation retained obsolete app cache');
    const featured=['02-ai-glasses.bailian','07-recorder.bailian'];
    const warmedAssets=new Set();
    for(const id of featured) {
      await offlinePage.goto(`${BASE}#/s/${id}/default`);await offlinePage.waitForSelector('[data-outcome] .result-text');
      const assets=await offlinePage.evaluate(async id=>{
        const {registry,trace,assetUrl}=await import('./js/data.js');const reg=await registry(),sol=reg.byId.get(id),tr=await trace(reg,sol,sol.variants.find(v=>v.id==='default'));
        const urls=[...new Set([...tr.inputs,...tr.outputs].map(f=>assetUrl(reg,f.asset)).filter(Boolean))];
        for(const url of urls) {const response=await fetch(url);if(!response.ok)throw Error(`warm asset HTTP ${response.status}: ${url}`);await response.arrayBuffer();}
        return urls;
      },id);
      for(const url of assets)warmedAssets.add(url);
    }
    const cachedURLs=[...warmedAssets,...['js/experience.js','js/photo-questions.js','js/photo-results.js','js/history.js','js/live/input.js','js/pages/solution.js','data/registry.json',...featured.map(id=>`data/traces/${id}/default.json`)].map(p=>new URL(p,BASE).href)];
    const cacheDeadline=Date.now()+10000;
    while(true) {
      const missing=await offlinePage.evaluate(async urls=>{const missing=[];for(const url of urls)if(!await caches.match(url))missing.push(url);return missing;},cachedURLs);
      if(!missing.length)break;
      assertUI(Date.now()<cacheDeadline,`offline warm cache missing required resource: ${missing.join(', ')}`);
      await new Promise(resolve=>setTimeout(resolve,50));
    }
    await offlineContext.setOffline(true);
    for(const id of [...featured].reverse()) {
      // Reopen via hash routing, then reload to rebuild the app/module graph from cache.
      await offlinePage.evaluate(id=>{location.hash=`#/s/${id}/default`;},id);
      await offlinePage.waitForFunction(id=>document.querySelector('h1')?.textContent===(id.startsWith('02')?'一看即懂':'会议纪要'),id);
      await offlinePage.reload();await offlinePage.waitForSelector('[data-outcome] .result-text');
      const text=await offlinePage.locator('[data-outcome] .result-text').innerText();assertUI(text.includes(id.startsWith('02')?'宫保鸡丁':'待办'),`${id} offline sample outcome missing`);
      if(id.startsWith('02'))await offlinePage.waitForFunction(()=>{const image=document.querySelector('[data-preview] img');return image?.complete&&image.naturalWidth>0;});
      else await offlinePage.waitForFunction(()=>document.querySelector('[data-preview] audio')?.readyState>=1);
      for(const selector of ['[data-result-copy]','[data-result-download]','[data-outcome] [data-export]','[data-act="replay"]'])assertUI(await offlinePage.locator(selector).count()===1,`${id} offline action missing: ${selector}`);
      await offlinePage.locator('.process-panel').evaluate(e=>e.open=true);await offlinePage.click('[data-act="all"]');await offlinePage.waitForSelector('.stage-foot:not([hidden])');
      const exportedEvent=offlinePage.waitForEvent('download');await offlinePage.click('[data-outcome] [data-export]');const exported=await exportedEvent;assertUI(!await exported.failure(),`${id} offline export failed`);
      await offlinePage.evaluate(async urls=>{for(const url of urls){const response=await fetch(url);if(!response.ok||(await response.arrayBuffer()).byteLength===0)throw Error(`offline asset unavailable: ${url}`);}},[...warmedAssets]);
    }
    assertUI(offlineErrors.length===0,`offline page errors: ${offlineErrors.join('; ')}`);
    console.log('桌面 Chrome 离线回归通过：独立 serviceWorkers-allowed 上下文、预热两场景素材、离线重开/刷新、结果/回放/导出/模块与媒体缓存、无脚本错误');
  } catch(error) {
    console.error('offline diagnostics',JSON.stringify({url:offlinePage.url(),text:(await offlinePage.locator('body').innerText().catch(()=>'')).slice(0,800),errors:offlineErrors,failures:offlineFailures,cache:await offlinePage.evaluate(async()=>({controller:!!navigator.serviceWorker.controller,keys:(await Promise.all((await caches.keys()).map(async k=>({name:k,urls:(await (await caches.open(k)).keys()).map(r=>r.url)}))))})).catch(e=>e.message)}));throw error;
  } finally {await offlineContext.close();}
  await browser.close();
  console.log(results.join('\n'));
  console.log(`发往的百炼域名：${[...hostsSeen].join('、') || '无'}`);
  if (!hostsSeen.has(`${CRED.values.DASHSCOPE_WORKSPACE_ID}.cn-beijing.maas.aliyuncs.com`)) problems.push('填了业务空间 ID，但请求没有走业务空间专属域名');
  if (!results.some((r) => r.includes('：真跑 '))) problems.push('一个浏览器真跑都没有跑');
}

try {
  await main();
} catch (e) {
  problems.push(`测试中断：${e.stack || e.message}`);
} finally {
  for (const c of children) c.kill();
}
if (problems.length) {
  console.error(`网页 APP 冒烟测试失败（${problems.length}）：\n${problems.map((p) => `- ${p}`).join('\n')}`);
  process.exit(1);
}
console.log('网页 APP 冒烟测试通过');
