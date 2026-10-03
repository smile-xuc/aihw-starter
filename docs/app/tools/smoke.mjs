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
const CRED = { values: { DASHSCOPE_API_KEY: 'sk-apptest0000000001', DASHSCOPE_API_REGION: 'cn-beijing', DASHSCOPE_WORKSPACE_ID: 'llm-apptest' } };
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization,content-type,x-dashscope-sse', 'access-control-allow-methods': 'GET,POST' };

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
  const page = await context.newPage();
  page.on('console', (m) => { if (m.type() === 'error' && !(expectFault && /Failed to load resource:.*status of (401|500)/.test(m.text()))) problems.push(`[${current}] console：${m.text()}`); });
  page.on('pageerror', (e) => problems.push(`[${current}] 脚本异常：${e.message}`));
  page.on('response', (r) => { if (r.status() >= 400 && r.url().startsWith(BASE)) problems.push(`[${current}] HTTP ${r.status()}：${r.url()}`); });
  page.on('request', (r) => {
    const url = r.url();
    if (url.startsWith(BASE) || url.startsWith('data:') || url.startsWith('blob:')) return;
    if (!ALLOWED.test(url)) problems.push(`[${current}] 请求发往了官方接入点以外的地址：${url}`);
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
  await context.route(ALLOWED, async (route, req) => {
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    const u = new URL(req.url());
    requests.push({path:u.pathname,body:req.postDataJSON()});
    if (failureMode === '401') return route.fulfill({status:401,headers:CORS,json:{message:'bad key sk-apptest0000000001'}});
    if (failureMode === 'hold') { await new Promise(r=>setTimeout(r,600)); }
    if (failureMode === 'partial' && u.pathname.endsWith('chat/completions')) return route.fulfill({status:500,headers:CORS,json:{message:'minutes failed'}});
    if (failureMode === 'unknown' && u.pathname.endsWith('chat/completions')) return route.fulfill({status:200,headers:{...CORS,'content-type':'text/event-stream'},body:'data: {"choices":[{"delta":{"content":"<img src=x onerror=alert(1)>安全结果"}}]}\n\ndata: [DONE]\n\n'});
    const res = await fetch(`http://127.0.0.1:${FAKE_PORT}/${current}${u.pathname}`, { method: req.method(), headers: req.headers(), body: req.postDataBuffer() });
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
  current='experience'; await page.goto(BASE); await page.waitForSelector('.featured-card');
  assertUI((await page.locator('.featured-card').allTextContents()).join('').includes('一看即懂'),'home featured missing');
  assertUI(await page.locator('a[href="#/s/02-ai-glasses.bailian/default"]').count(),'02 direct route missing');
  await page.evaluate(()=>{localStorage.removeItem('aihw.credentials.bailian');sessionStorage.removeItem('aihw.credentials.bailian');});
  await page.goto(`${BASE}#/s/02-ai-glasses.bailian/default`); await page.waitForSelector('[data-question]');
  assertUI((await page.locator('.result-text').innerText()).includes('宫保鸡丁'),'02 sample outcome not immediately readable');
  assertUI(await page.locator('[data-result-copy]').count()===1,'02 sample copy action missing');
  await page.fill('[data-question]','这张照片有什么？');
  await page.click('.live-bar a'); await page.waitForSelector('form[data-form="bailian"]');
  assertUI(await page.locator('button[type="submit"]').textContent()==='保存并继续体验','setup continuation label missing');
  await page.fill('[name="DASHSCOPE_API_KEY"]',CRED.values.DASHSCOPE_API_KEY); await page.click('button[type="submit"]');
  assertUI(page.url().includes('#/me'),'missing scene workspace unexpectedly saved/returned');
  assertUI((await page.locator('[data-slot="result"]').innerText()).includes('继续这个玩法还需要'),'missing origin credential message');
  await page.fill('[name="DASHSCOPE_WORKSPACE_ID"]',CRED.values.DASHSCOPE_WORKSPACE_ID);await page.click('button[type="submit"]');
  await page.waitForSelector('[data-question]');assertUI(await page.inputValue('[data-question]')==='这张照片有什么？','draft question lost on setup return');
  current='02-ai-glasses.bailian'; requests.length=0; await begin();
  const changed=requests.find(r=>r.path.endsWith('chat/completions')).body.messages.at(-1).content;
  assertUI(!changed.some(p=>p.type==='input_audio') && changed.some(p=>p.text==='这张照片有什么？'),'changed sample question did not use text-only question');
  await page.click('[data-source="own"]');await page.setInputFiles('[data-material]',{name:'mine.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1sAAAAASUVORK5CYII=','base64')});
  await page.waitForSelector('[data-material-status] .inline-ok');requests.length=0;await begin();
  const own=requests.find(r=>r.path.endsWith('chat/completions')).body.messages.at(-1).content;
  assertUI(own.find(p=>p.type==='image_url').image_url.url.startsWith('data:image/png;') && !own.some(p=>p.type==='input_audio'),'own PNG payload wrong');
  await noOverflow(page);
  const saved = await page.evaluate(()=>JSON.parse(localStorage.getItem('aihw.history.v1')));
  assertUI(saved.length>=2 && !JSON.stringify(saved).includes(CRED.values.DASHSCOPE_API_KEY) && !JSON.stringify(saved).includes('data:image') && !JSON.stringify(saved).includes('https://'),'history persisted sensitive material');
  const count=requests.length;
  await page.setInputFiles('[data-material]',{name:'corrupt.png',mimeType:'image/png',buffer:Buffer.from('not a png')});await page.waitForSelector('[data-material-status] .inline-error');
  await page.click('[data-act="live"]');await page.waitForSelector('[data-outcome] .inline-error');assertUI(requests.length===count,'corrupt image reached provider');
  // Image with plausible headers but corrupt compressed pixels must fail browser decode.
  const broken=Buffer.alloc(33); Buffer.from([137,80,78,71,13,10,26,10]).copy(broken);broken.writeUInt32BE(13,8);broken.write('IHDR',12);broken.writeUInt32BE(1,16);broken.writeUInt32BE(1,20);
  await page.setInputFiles('[data-material]',{name:'header-only.png',mimeType:'image/png',buffer:broken});await page.waitForSelector('[data-material-status] .inline-error');assertUI((await page.locator('[data-material-status]').innerText()).includes('解码'),'corrupt image decode not checked');
  await page.click('[data-reset]');expectFault=true;failureMode='401';await begin();assertUI((await page.locator('[data-outcome]').innerText()).includes('401'),'401 outcome missing');assertUI(!(await page.locator('[data-outcome]').innerText()).includes(CRED.values.DASHSCOPE_API_KEY),'error exposed secret');
  failureMode='unknown';await begin();assertUI((await page.locator('.result-cost').innerText()).includes('费用未知'),'unknown usage presented as exact cost');assertUI(await page.locator('.result-text img').count()===0,'model output executed markup');
  failureMode='hold';await page.click('[data-act="live"]');await page.click('[data-sheet="go"]');await page.waitForSelector('[data-act="live"][disabled]');assertUI(await page.locator('[data-question]').isDisabled(),'input mutable during run');await page.click('[data-act="stop"]');await page.waitForSelector('[data-act="live"]:not([disabled])');assertUI((await page.locator('[data-outcome]').innerText()).includes('已停止'),'stopped state missing');failureMode='';
  current='07-recorder.bailian';await page.goto(`${BASE}#/s/07-recorder.bailian/default`);await page.waitForSelector('[data-source="own"]');assertUI((await page.locator('.result-text').innerText()).includes('待办'),'07 sample minutes not immediately readable');await page.click('[data-source="own"]');
  const wav = seconds=>{const b=Buffer.alloc(44+seconds*16000*2);b.write('RIFF',0);b.writeUInt32LE(b.length-8,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(16000,24);b.writeUInt32LE(32000,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(b.length-44,40);return b;};
  await page.setInputFiles('[data-material]',{name:'meeting.wav',mimeType:'audio/wav',buffer:wav(1)});await page.waitForSelector('[data-material-status] .inline-ok');requests.length=0;await begin();
  assertUI(requests.find(r=>r.path.endsWith('generation')).body.parameters.format==='wav','own WAV format incorrect');
  const beforeLong=requests.length;await page.setInputFiles('[data-material]',{name:'long.wav',mimeType:'audio/wav',buffer:wav(181)});await page.waitForSelector('[data-material-status] .inline-error');assertUI((await page.locator('[data-material-status]').innerText()).includes('180'),'long audio not rejected');assertUI(requests.length===beforeLong,'long audio reached provider');
  await page.setInputFiles('[data-material]',{name:'meeting.wav',mimeType:'audio/wav',buffer:wav(1)});await page.waitForSelector('[data-material-status] .inline-ok');failureMode='partial';await begin();assertUI((await page.locator('[data-outcome]').innerText()).includes('展开原始转写'),'failed minutes lost partial transcript');failureMode='';
  const actualTraces = await page.evaluate(()=>JSON.parse(localStorage.getItem('aihw.history.v1')).map(r=>r.trace));
  const schema = JSON.parse(readFileSync(path.join(docs,'../solutions/demo-standard/trace.schema.json')));
  const checked=spawnSync(process.env.PYTHON || 'python3',['-c','import json,sys,jsonschema\nd=json.load(sys.stdin)\nfor t in d["traces"]: jsonschema.validate(t,d["schema"])'],{input:JSON.stringify({schema,traces:actualTraces}),encoding:'utf8'});
  assertUI(checked.status===0,`actual browser traces violate schema: ${checked.stderr}`);
  await page.goto(`${BASE}#/me`);await page.waitForSelector('[data-history-open]');await page.locator('[data-history-open]').first().click();await page.waitForSelector('[data-history-result] [data-export]');await noOverflow(page);
  const downloadEvent=page.waitForEvent('download');await page.click('[data-history-result] [data-export]');
  const exported=await downloadEvent;const stream=await exported.createReadStream();let exportedText='';for await(const chunk of stream)exportedText+=chunk.toString();
  const exportCheck=spawnSync(process.env.PYTHON || 'python3',['-c','import json,sys,jsonschema\nd=json.load(sys.stdin)\njsonschema.validate(d["trace"],d["schema"])'],{input:JSON.stringify({schema,trace:JSON.parse(exportedText)}),encoding:'utf8'});
  assertUI(exportCheck.status===0,`downloaded browser export invalid: ${exportCheck.stderr}`);
  await page.setInputFiles('[data-act="open-trace"]',{name:'record.json',mimeType:'application/json',buffer:Buffer.from(exportedText)});await page.waitForSelector('[data-slot="local-trace"] [data-export]');
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
  console.log('体验 UI 回归通过：设置返回、草稿、样本提问、PNG、WAV、损坏/过长素材、401、停止、缺失用量、转写保留、历史重开/删除');
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
