// 哪些方案能在浏览器里真跑。能跑的每个方案一个 runner 模块，提示词、工具定义、单价从 data/live/<id>.json 读（build.py 从 run.py 导入）。

import { demoAsset, liveConstants } from '../data.js';
import { chat, now, postJson } from './bailian.js';

export const REALTIME_REASON = '实时语音走 Realtime API，官方文档写明鉴权只在建连时认 Authorization 请求头：浏览器的 WebSocket 不能设置请求头；WebRTC 的建连请求（SDP 交换）被浏览器跨域拦截，官方要求由服务端代理；AOQ 只有原生 SDK。临时 Key（st-）也是放在同一个请求头里，换成临时 Key 也解决不了。';

const BROWSER = {
  '01-ipc.bailian': { load: () => import('./run-01-ipc.js'), note: '4 帧事件卡 + 检索 + 日报，共 6 次调用。' },
  '02-ai-glasses.bailian': {
    load: () => import('./run-02-ai-glasses.js'),
    note: '只跑默认的「拍照即问」。播报在浏览器里改用非实时 HTTP 合成（整段合成后播放，只在北京地域可用；新加坡只出文字）；--realtime「给 AI 打电话」是实时语音，只能回放。',
  },
  '03-toys-companion.bailian': { blocked: REALTIME_REASON },
  '04-agent-hardware.bailian': { load: () => import('./run-04-agent-hardware.js'), note: '一条端侧指令 + 一条语音指令（先转写，再多轮工具编排）；断网降级只在电脑上演示。' },
  '05-desktop-pet.bailian': { blocked: REALTIME_REASON },
  '06-ai-earphone.bailian': { blocked: REALTIME_REASON },
  '07-recorder.bailian': { load: () => import('./run-07-recorder.js'), note: '样本 55 秒录音走同步转写；超过 3 分钟的录音要先上传临时存储，浏览器版没做，请在电脑上跑。' },
  '08-smart-watch.bailian': { load: () => import('./run-08-smart-watch.js'), note: '两份日报（平稳日、红线日）；抬腕播报（--speak）只在电脑上演示。' },
  '09-embodied.bailian': { load: () => import('./run-09-embodied.js'), note: '三条指令：正常、超力矩（安全门改写）、禁止动作（指令级拒绝，不上云）。' },
};

export function browserSupport(sol) {
  const entry = BROWSER[sol.id];
  if (!entry) return { status: 'none', reason: '这个方案还没有浏览器版。' };
  if (entry.blocked) return { status: 'blocked', reason: entry.blocked };
  return { status: 'runnable', note: entry.note };
}

export const runnableIds = () => Object.keys(BROWSER).filter((id) => BROWSER[id].load);

// 跑一次：runner 往舞台上写和 run.py 同样标签的日志行，返回 { models, firstMs, cost, sample, note, outputs }
export async function runInBrowser(sol, cfg, stage, { signal, onFallback } = {}) {
  const entry = BROWSER[sol.id];
  const [mod, c] = await Promise.all([entry.load(), liveConstants(sol.id)]);
  const asset = async (path) => {
    const res = await fetch(demoAsset(sol, path), { signal });
    if (!res.ok) throw new Error(`读取样本 ${path} 失败：HTTP ${res.status}`);
    return res;
  };
  const ctx = {
    c,
    cfg,
    region: cfg.region,
    signal,
    now,
    say: (tag, text, detail = '') => stage.push({ tag, text, detail }),
    asset: async (path) => (await asset(path)).arrayBuffer(),
    assetText: async (path) => (await asset(path)).text(),
    chat: (payload, opts = {}) => chat(cfg, payload, { signal, onFallback, ...opts }),
    post: (kind, path, payload, headers = {}) => postJson(cfg, kind, path, payload, { headers, signal, onFallback }),
  };
  if (!cfg.workspaceId) ctx.say('提示', '未填业务空间 ID，使用通用域名；官方推荐业务空间专属域名');
  return mod.default(ctx);
}
