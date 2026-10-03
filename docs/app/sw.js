// 离线回放：只缓存本站的 GET 请求；云端接口是跨域请求，这里一律不碰。
const CACHE = 'aihw-app-v4';
const SHELL = [
  './', 'index.html', 'manifest.webmanifest', 'css/app.css', 'data/registry.json',
  'js/main.js', 'js/experience.js', 'js/history.js', 'js/live/input.js', 'js/ui.js', 'js/meta.js', 'js/data.js', 'js/replay.js', 'js/settings.js',
  'js/pages/home.js', 'js/pages/category.js', 'js/pages/solution.js', 'js/pages/me.js',
  'js/live/index.js', 'js/live/client.js',
  'js/live/run-01-ipc.js', 'js/live/run-02-ai-glasses.js', 'js/live/run-04-agent-hardware.js',
  'js/live/run-07-recorder.js', 'js/live/run-08-smart-watch.js', 'js/live/run-09-embodied.js',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k.startsWith('aihw-app-') && k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(request);
    if (res.ok) cache.put(request, res.clone());
    return res;
  } catch (e) {
    const hit = await cache.match(request, { ignoreSearch: true });
    if (hit) return hit;
    throw e;
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok && res.status === 200) cache.put(request, res.clone());
  return res;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith(new URL('./', self.location).pathname)) return;
  if (request.headers.has('range')) {
    // 录音播放会带 Range；缓存里有整段时直接给整段（Chrome 接受），没有就走网络
    event.respondWith(caches.open(CACHE).then((c) => c.match(url.href)).then((hit) => hit || fetch(request)));
    return;
  }
  // 样本图片、录音不会变，优先用缓存；页面、脚本、注册表与轨迹先走网络，离线时退回缓存
  const media = /\/data\/assets\//.test(url.pathname);
  event.respondWith(media ? cacheFirst(request) : networkFirst(request));
});
