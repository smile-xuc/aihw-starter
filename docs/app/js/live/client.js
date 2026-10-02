// 浏览器直连云端：接入点按栈声明（registry.stacks[].endpoints）推导，鉴权头按 stack.auth 拼，凭证只进请求头。
// 页面 CSP 的 connect-src 只放行这些官方域名，写错地址浏览器也会拦下。

import { fullMatch } from '../settings.js';

export const now = () => performance.now();

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
    if (this.status && this.status >= 500) return '服务端错误，稍后再试。';
    return '';
  }
}

// 代进地址模板的值只能是字母、数字和连字符，并且符合字段自己的 pattern
function fill(template, stack, values) {
  if (!template) return null;
  return template.replace(/\{(\w+)\}/g, (_, key) => {
    const field = (stack.fields || []).find((f) => f.key === key);
    const v = values[key] || '';
    if (!/^[A-Za-z0-9-]+$/.test(v) || (field?.pattern && !fullMatch(field.pattern, v))) {
      throw new ApiError(`${field?.label || key} 不合法，不能拼进接入地址`);
    }
    return v;
  });
}

// endpoints.roots 从上到下匹配：第一条生效；后面同样匹配的只在前一条被浏览器跨域拦截时退回
export function matchingRoots(stack, values) {
  return (stack.endpoints?.roots || [])
    .filter((r) => Object.entries(r.when || {}).every(([k, want]) => (want === '*' ? Boolean(values[k]) : values[k] === want)))
    .map((r) => ({ label: r.label, http: fill(r.http, stack, values), ws: fill(r.ws, stack, values) }));
}

export const serviceOf = (stack, id) => (stack.endpoints?.services || []).find((s) => s.id === id) || null;

function serviceBase(stack, root, id) {
  const svc = serviceOf(stack, id);
  if (!svc) throw new ApiError(`栈声明里没有接入点 ${id}`);
  return svc.url.replace('{http}', root.http).replace('{ws}', root.ws || '');
}

export function hostsFor(stack, values) {
  try {
    return [...new Set(matchingRoots(stack, values).map((r) => new URL(r.http).host))];
  } catch {
    return [];
  }
}

function authHeaders(stack, values) {
  const auth = stack.auth || {};
  return { [auth.header || 'Authorization']: String(auth.value || '').replace(/\{(\w+)\}/g, (_, k) => values[k] || '') };
}

const preferred = new Map();

async function send(cred, serviceId, path, init, onFallback) {
  const { stack, values } = cred;
  const roots = matchingRoots(stack, values);
  if (!roots.length) throw new ApiError('按填写的地域找不到接入点');
  const cacheKey = `${stack.id}:${roots.map((r) => r.http).join('|')}:${serviceId}`;
  const start = Math.max(0, roots.findIndex((r) => r.http === preferred.get(cacheKey)));
  let lastError = null;
  for (let i = start; i < roots.length; i++) {
    try {
      const res = await fetch(serviceBase(stack, roots[i], serviceId) + path, {
        ...init,
        mode: 'cors',
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
        cache: 'no-store',
        headers: { ...authHeaders(stack, values), ...(init.headers || {}) },
      });
      if (i !== start) {
        preferred.set(cacheKey, roots[i].http);
        onFallback?.(new URL(roots[start].http).host, new URL(roots[i].http).host);
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
  return new ApiError(`HTTP ${res.status}${err.code ? ` ${err.code}` : ''}：${err.message || res.statusText || '请求失败'}`, {
    status: res.status, code: err.code || '', requestId: body.request_id || err.id || '',
  });
}

export async function postJson(cred, serviceId, path, payload, { headers = {}, signal, onFallback } = {}) {
  const res = await send(cred, serviceId, path, {
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
export async function chat(cred, payload, { onText, signal, onFallback, service = 'compatible' } = {}) {
  const res = await send(cred, service, '/chat/completions', {
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
    if (event.usage) turn.usage = { prompt: Number(event.usage.prompt_tokens || 0), completion: Number(event.usage.completion_tokens || 0) };
  }
  turn.calls = [...slots.keys()].sort((a, b) => a - b).map((k) => slots.get(k));
  return turn;
}

export async function testConnection(cred, test, signal) {
  const t0 = now();
  const turn = await chat(cred, { model: test.model, messages: [{ role: 'user', content: '回复「好」' }], max_tokens: 4, enable_thinking: false }, { signal, service: test.service });
  return { ms: Math.round(now() - t0), text: turn.text, usage: turn.usage };
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
export function costOf(tiers, usage) {
  let [pin, pout] = [tiers[tiers.length - 1][1], tiers[tiers.length - 1][2]];
  for (const [limit, a, b] of tiers) {
    if (limit == null || usage.prompt <= limit) { [pin, pout] = [a, b]; break; }
  }
  return (usage.prompt * pin + usage.completion * pout) / 1e6;
}
