// 网页 APP 冒烟测试（CI 与本地通用）：无头 Chrome 以 390 × 844 打开全部页面和玩法，查控制台报错、越界请求和横向溢出；
// 再把发往百炼域名的请求转给 fake_bailian.py（各 demo 的 mock.py），把能在浏览器里真跑的玩法完整跑一遍。
//
//   npm install --no-save --prefix /tmp/pw playwright-core
//   PLAYWRIGHT_CORE=/tmp/pw/node_modules/playwright-core/index.mjs CHROME=$(command -v google-chrome) node docs/app/tools/smoke.mjs
//
// 只说明页面逻辑与 mock（官方事件 / 响应结构）对得上；真实接口的响应仍待真 Key 验证。
import { spawn } from 'node:child_process';
import path from 'node:path';
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
  page.on('console', (m) => { if (m.type() === 'error') problems.push(`[${current}] console：${m.text()}`); });
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
    await page.waitForSelector('.stage');
    const variants = await page.$$eval('[data-variant]', (els) => els.map((e) => e.dataset.variant));
    for (const v of variants.length ? variants : ['']) pages.push({ id, variant: v });
  }
  for (const { id, variant } of pages) {
    current = `s/${id}/${variant}`;
    await page.goto(`${BASE}#/s/${id}${variant ? `/${variant}` : ''}`);
    await page.waitForSelector('.timeline .ev');
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
  await context.route(ALLOWED, async (route, req) => {
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    const u = new URL(req.url());
    const res = await fetch(`http://127.0.0.1:${FAKE_PORT}/${current}${u.pathname}`, { method: req.method(), headers: req.headers(), body: req.postDataBuffer() });
    return route.fulfill({ status: res.status, headers: { ...CORS, 'content-type': res.headers.get('content-type') || 'application/json' }, body: Buffer.from(await res.arrayBuffer()) });
  });
  const results = [];
  for (const { id, variant } of pages) {
    current = id;
    await fetch(`http://127.0.0.1:${FAKE_PORT}/${id}/reset`, { method: 'POST' });
    await page.goto(`${BASE}#/s/${id}${variant ? `/${variant}` : ''}`);
    await page.waitForSelector('.timeline .ev');
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
