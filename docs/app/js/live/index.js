// 哪些玩法能在浏览器里真跑。每个能跑的玩法一个 runner 模块，声明它实际调用的接入点（栈声明 services 的 id）；
// 只有这些接入点在栈声明里都是 browser: ok 才放行。提示词、工具定义、单价从 live-data/<id>.json 读（tools/build.py 从 run.py 导入）。

import { liveConstants, sampleUrl } from '../data.js';
import { kindOf } from '../meta.js';
import { missingFields } from '../settings.js';
import { chat, now, postJson, serviceOf, validCount } from './client.js';
import { validateInput } from './input.js';

const RUNNERS = {
  '01-ipc.bailian': { default: { load: () => import('./run-01-ipc.js'), services: ['compatible'], note: '4 帧事件卡 + 检索 + 日报，共 6 次调用。' } },
  '02-ai-glasses.bailian': {
    default: {
      load: () => import('./run-02-ai-glasses.js'), services: ['compatible', 'api'],
      note: '设备上的播报走任务制 WebSocket，浏览器里改用非实时 HTTP 合成（整段合成后播放，只在北京地域提供；新加坡只出文字）。',
    },
  },
  '04-agent-hardware.bailian': { default: { load: () => import('./run-04-agent-hardware.js'), services: ['api', 'compatible'], note: '一条端侧指令 + 一条语音指令（先转写，再多轮工具编排）。' } },
  '07-recorder.bailian': { default: { load: () => import('./run-07-recorder.js'), services: ['api', 'compatible'], note: '样本 55 秒录音走同步转写；超过 3 分钟的录音要先上传临时存储，浏览器版没做。' } },
  '08-smart-watch.bailian': { default: { load: () => import('./run-08-smart-watch.js'), services: ['compatible'], note: '两份日报（平稳日、红线日）；抬腕播报（--speak）只在电脑上演示。' } },
  '09-embodied.bailian': { default: { load: () => import('./run-09-embodied.js'), services: ['compatible'], note: '三条指令：正常、超力矩（安全门改写）、禁止动作（指令级拒绝，不上云）。' } },
};

// 依据：百炼「Realtime Token 鉴权」「WebRTC 最佳实践」「Realtime API 概述」（2026-10-02）
const REALTIME_DETAIL = 'Realtime API 的 WebSocket、WebRTC、AOQ 都只在建连时认 Authorization 请求头：浏览器的 WebSocket 不能设请求头；WebRTC 的建连请求（SDP 交换）被浏览器跨域拦截，官方要求由服务端代理；AOQ 只有原生 SDK。临时 Key（st-）也放在同一个请求头里，换成临时 Key 也解决不了。';

export function browserSupport(reg, sol, variant) {
  const stack = reg.stacks.get(sol.stack);
  const runner = RUNNERS[sol.id]?.[variant.id];
  if (runner && stack) {
    const notOk = runner.services.filter((id) => serviceOf(stack, id)?.browser !== 'ok');
    if (!notOk.length) return { status: 'runnable', note: runner.note, services: runner.services };
  }
  if (Array.isArray(variant.services) && !variant.services.length) {
    return { status: 'none', reason: '这个玩法不调用云端，回放就是完整过程。' };
  }
  const blocked = variant.browser?.blocked_by || [];
  if (blocked.length) {
    const why = blocked.map((id) => {
      const svc = stack && serviceOf(stack, id);
      return svc ? `${svc.label}：${svc.browser_note || '浏览器里不能直连'}` : id;
    }).join('；');
    const realtime = blocked.some((id) => /realtime|ws/.test(id));
    return { status: 'blocked', reason: `${why}。${realtime ? REALTIME_DETAIL : ''}` };
  }
  return { status: 'none', reason: '这个玩法还没有浏览器版。' };
}

export function solutionRunnable(reg, sol) {
  return sol.variants.some((v) => browserSupport(reg, sol, v).status === 'runnable');
}

export const runnerCount = () => Object.values(RUNNERS).reduce((n, v) => n + Object.keys(v).length, 0);

export function requiredMissing(reg, sol, variant, values) {
  const stack = reg.stacks.get(sol.stack);
  const required = variant.credentials?.required || sol.credentials?.required || [];
  return stack ? missingFields(stack, values, required) : [];
}

// 跑一次：runner 往舞台上写和 run.py 同样标签的日志行，返回 { models, firstMs, cost, sample, note, outputs }
export async function runInBrowser(reg, sol, variant, cred, stage, { signal, onFallback, input } = {}) {
  const normalizedInput = validateInput(input);
  if (normalizedInput && !((sol.id === '02-ai-glasses.bailian' && normalizedInput.kind === 'image') || (sol.id === '07-recorder.bailian' && normalizedInput.kind === 'audio'))) throw new Error('这个玩法不支持此媒体输入');
  const runner = RUNNERS[sol.id][variant.id];
  const [mod, c] = await Promise.all([runner.load(), liveConstants(sol.id)]);
  const t0 = now();
  const fetchSample = async (path) => {
    const url = sampleUrl(reg, sol, path);
    if (!url) throw new Error(`样本 ${path} 不在发布的数据里`);
    const res = await fetch(url, { signal });
    if (!res.ok) throw new Error(`读取样本 ${path} 失败：HTTP ${res.status}`);
    return res;
  };
  const values = cred.values;
  const usageRecords = [];
  const recordUsage = (model, requestId, usage, kind = 'chat') => {
    const safeUsage = Object.fromEntries(['prompt', 'completion', 'input_tokens', 'output_tokens', 'characters', 'duration'].filter((key) => validCount(usage?.[key])).map((key) => [key, usage[key]]));
    safeUsage.known = kind === 'chat' ? usage?.known === true : kind === 'tts' ? validCount(usage?.characters) : validCount(usage?.input_tokens) && validCount(usage?.output_tokens);
    usageRecords.push({ model: typeof model === 'string' ? model : '', requestId: typeof requestId === 'string' ? requestId : '', usage: safeUsage });
    return safeUsage.known;
  };
  let missingUsage = false;
  let incompletePostUsage = false;
  let firstTextAt = null;
  const honestCostText = (text) => missingUsage ? String(text).replace(/¥(?:[\d.,]+(?:[–-][\d.,]+)?|—)/g, '费用未知') : text;
  const ctx = {
    c,
    input: normalizedInput,
    region: values.DASHSCOPE_API_REGION,
    signal,
    now,
    say: (tag, text, detail = '') => stage.push({ tag, kind: kindOf(tag), text: tag === '统计' ? honestCostText(text) : text, lines: detail ? String(tag === '统计' ? honestCostText(detail) : detail).split('\n') : [], t_ms: Math.round(now() - t0), assets: [] }),
    asset: async (path) => (await fetchSample(path)).arrayBuffer(),
    assetText: async (path) => (await fetchSample(path)).text(),
    hasAsset: (path) => (sol.samples || []).some((s) => s.path === path),
    chat: async (payload, opts = {}) => {
      const turn = await chat(cred, payload, { signal, onFallback, ...opts });
      recordUsage(payload.model, turn.requestId || turn.id, turn.usage);
      if (!turn.usage.known) missingUsage = true;
      if (firstTextAt == null && turn.firstTextAt != null) firstTextAt = turn.firstTextAt;
      return turn;
    },
    post: async (service, path, payload, headers = {}) => {
      const response = await postJson(cred, service, path, payload, { headers, signal, onFallback });
      const known = recordUsage(payload.model, response.request_id, response.usage, payload.model === c.TTS_MODEL ? 'tts' : 'post');
      if (!known) incompletePostUsage = true;
      return response;
    },
  };
  if (!values.DASHSCOPE_WORKSPACE_ID) ctx.say('提示', '未填业务空间 ID，使用通用域名；官方推荐业务空间专属域名');
  let result;
  try { result = await mod.default(ctx); } catch (error) {
    error.usageRecords = usageRecords;
    throw error;
  }
  result.usageRecords = usageRecords;
  result.metrics ||= { textFirstMs: firstTextAt == null ? null : firstTextAt - t0, audioFirstMs: null, audioReadyMs: null, totalMs: now() - t0 };
  result.costStatus ||= result.cost == null ? 'unknown' : 'usage';
  result.warnings ||= [];
  if (missingUsage || (incompletePostUsage && result.costStatus !== 'estimated')) {
    result.cost = null;
    result.costStatus = 'unknown';
    result.note = String(result.note).replace(/¥(?:[\d.,]+(?:[–-][\d.,]+)?|—)/g, '费用未知');
    const warning = missingUsage ? '接口未返回完整 Chat Token 用量，总成本未知' : '接口未返回完整转写或合成用量，缺少有效估算依据，总成本未知';
    result.warnings.push(warning);
    ctx.say('提示', warning);
  }
  result.outputs = (result.outputs || []).map((output) => ({ ...output, media_type: output.media_type || output.type || 'application/octet-stream' }));
  return result;
}
