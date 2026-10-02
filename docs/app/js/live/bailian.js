// 浏览器直连百炼：只拼官方接入点（与 demo_kit.Config 同一套地址规则），Key 只放在 Authorization 请求头里。
// 页面的 CSP connect-src 只放行这些域名，写错地址浏览器也会拦下。

export const REGIONS = {
  'cn-beijing': { label: '华北2（北京）', http: 'https://dashscope.aliyuncs.com', workspaceHost: 'cn-beijing.maas.aliyuncs.com' },
  'ap-southeast-1': { label: '新加坡', http: 'https://dashscope-intl.aliyuncs.com', workspaceHost: 'ap-southeast-1.maas.aliyuncs.com' },
};

export const now = () => performance.now();

export function workspaceRoot(cfg) {
  return cfg.workspaceId ? `https://${cfg.workspaceId}.${REGIONS[cfg.region].workspaceHost}` : null;
}

export function hosts(cfg) {
  const list = [REGIONS[cfg.region].http];
  const ws = workspaceRoot(cfg);
  if (ws) list.unshift(ws);
  return list.map((u) => new URL(u).host);
}

export class ApiError extends Error {
  constructor(message, { status = null, code = '', requestId = '', network = false } = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.requestId = requestId;
    this.network = network;
  }

  get hint() {
    if (this.network) return '请求没有发出去或被浏览器拦下：检查网络；如果只有这个接口失败，多半是它的跨域预检没通过。';
    if (this.status === 401) return 'Key 无效，或 Key、地域、业务空间不属于同一地域（三者要一致）。';
    if (this.status === 403) return '这个 Key 没有该模型的权限：检查子业务空间是否授权了这个模型，或 Key 的「可访问模型」列表。';
    if (this.status === 404) return '接口或模型不存在：该模型可能在这个地域不可用。';
    if (this.status === 429) return '被限流（RPM / TPM），稍后再试。';
    if (this.status && this.status >= 500) return '百炼服务端错误，稍后再试。';
    return '';
  }
}

// 业务空间专属域名优先；某类接口在浏览器里被跨域拦截时（fetch 直接抛 TypeError，请求本身没有发出），本次会话改走通用域名
const preferred = new Map();

async function send(cfg, kind, path, init, onFallback) {
  const shared = REGIONS[cfg.region].http;
  const ws = workspaceRoot(cfg);
  const roots = ws && preferred.get(`${cfg.region}:${kind}`) !== shared ? [ws, shared] : [shared];
  const prefix = kind === 'compat' ? '/compatible-mode/v1' : '/api/v1';
  let lastError = null;
  for (const root of roots) {
    try {
      const res = await fetch(root + prefix + path, {
        ...init,
        mode: 'cors',
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
        cache: 'no-store',
        headers: { Authorization: `Bearer ${cfg.apiKey}`, ...(init.headers || {}) },
      });
      if (root !== roots[0]) {
        preferred.set(`${cfg.region}:${kind}`, root);
        onFallback?.(new URL(roots[0]).host, new URL(root).host);
      }
      if (!res.ok) throw await apiError(res);
      return res;
    } catch (e) {
      if (e.name === 'AbortError' || e instanceof ApiError) throw e;
      lastError = e;
    }
  }
  throw new ApiError(`网络错误：${lastError?.message || '请求失败'}`, { network: true });
}

async function apiError(res) {
  let body = {};
  try { body = await res.json(); } catch { /* 非 JSON 错误体 */ }
  const err = body.error || body;
  const message = err.message || res.statusText || '请求失败';
  return new ApiError(`HTTP ${res.status}${err.code ? ` ${err.code}` : ''}：${message}`, {
    status: res.status, code: err.code || '', requestId: body.request_id || err.id || '',
  });
}

export async function postJson(cfg, kind, path, payload, { headers = {}, signal, onFallback } = {}) {
  const res = await send(cfg, kind, path, {
    method: 'POST', signal, headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(payload),
  }, onFallback);
  return res.json();
}

async function* sse(res) {
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
    let nl;
    while ((nl = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!line.startsWith('data:')) continue;
      const data = line.slice(5).trim();
      if (data === '[DONE]') return;
      yield JSON.parse(data);
    }
    if (done) return;
  }
}

// OpenAI 兼容 Chat Completions 流式调用：文字增量回调；tool_calls 按 index 拼接 arguments 片段（只有首块带 id 和 name）
export async function chat(cfg, payload, { onText, signal, onFallback } = {}) {
  const res = await send(cfg, 'compat', '/chat/completions', {
    method: 'POST', signal,
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    body: JSON.stringify({ stream: true, stream_options: { include_usage: true }, ...payload }),
  }, onFallback);
  const turn = { text: '', calls: [], usage: { prompt: 0, completion: 0 }, firstTextAt: null, firstCallAt: null };
  const slots = new Map();
  for await (const event of sse(res)) {
    for (const choice of event.choices || []) {
      const delta = choice.delta || {};
      if (delta.content) {
        if (turn.firstTextAt == null) turn.firstTextAt = now();
        turn.text += delta.content;
        onText?.(delta.content, turn.text);
      }
      for (const part of delta.tool_calls || []) {
        const i = part.index ?? 0;
        const slot = slots.get(i) || { id: '', name: '', arguments: '' };
        const fn = part.function || {};
        slot.id = part.id || slot.id;
        slot.name = fn.name || slot.name;
        slot.arguments += fn.arguments || '';
        slots.set(i, slot);
        if (turn.firstCallAt == null && slot.name) turn.firstCallAt = now();
      }
    }
    if (event.usage) {
      turn.usage = { prompt: Number(event.usage.prompt_tokens || 0), completion: Number(event.usage.completion_tokens || 0) };
    }
  }
  turn.calls = [...slots.keys()].sort((a, b) => a - b).map((k) => slots.get(k));
  return turn;
}

// 与 demo 里的 parse_json 一致：去掉 ```json 围栏再解析
export function parseJson(text, what) {
  const clean = String(text).trim().replace(/^```(?:json)?\s*|\s*```$/g, '');
  try {
    return JSON.parse(clean);
  } catch (e) {
    throw new ApiError(`${what}不是合法 JSON（${e.message}）：${clean.slice(0, 200)}`);
  }
}

export async function testConnection(cfg, signal) {
  const t0 = now();
  const turn = await chat(cfg, {
    model: 'qwen3.7-flash', messages: [{ role: 'user', content: '回复「好」' }], max_tokens: 4, enable_thinking: false,
  }, { signal });
  return { ms: Math.round(now() - t0), text: turn.text, usage: turn.usage };
}

// 非实时语音合成返回的是百炼结果存储里的音频地址（OSS 签名 URL）；只接受 aliyuncs.com 下的 https 地址
export function safeAudioUrl(url) {
  try {
    const u = new URL(url);
    if (!/(^|\.)aliyuncs\.com$/.test(u.hostname)) return null;
    u.protocol = 'https:';
    return u.href;
  } catch {
    return null;
  }
}

export function toBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

// Python str.format 的子集：{name} 取值，{{ }} 是字面量花括号
export function pyFormat(template, vars) {
  return template.replace(/\{\{|\}\}|\{(\w+)\}/g, (m, name) => {
    if (m === '{{') return '{';
    if (m === '}}') return '}';
    if (!(name in vars)) throw new Error(`提示词缺少变量 ${name}`);
    return String(vars[name]);
  });
}

// 单价表与 run.py 一致：[(档位上限, 输入, 输出)]，上限 null 表示不封顶
export function tierPrice(tiers, promptTokens) {
  for (const [limit, pin, pout] of tiers) if (limit == null || promptTokens <= limit) return [pin, pout];
  const last = tiers[tiers.length - 1];
  return [last[1], last[2]];
}

export function costOf(tiers, usage) {
  const [pin, pout] = tierPrice(tiers, usage.prompt);
  return (usage.prompt * pin + usage.completion * pout) / 1e6;
}
