// 浏览器里的 Qwen Omni Realtime。官方握手只认 Authorization 头，浏览器设不了这个头。
// 2026-11-15 实测：wss 查询参数 api_key 会被网关读取；临时 Key 的 HTTP 接口没有浏览器跨域。
// 因此只把 Key 放进发往官方域名的 WebSocket 地址，调用方不得把这个地址写入页面、历史或日志。

import { matchingRoots, toBase64 } from './client.js';

// qwen3.8-omni-flash-realtime 预设音色。来源：Qwen-Live-Harness voice-catalog，对应官方 Omni 音色表。
export const VOICE_STORAGE_KEY = 'aihw.session.voice';
export const DEFAULT_VOICE = 'Tina';
export const OMNI_38_VOICES = Object.freeze([
  'Tina', 'Cindy', 'Liora Mira', 'Raymond', 'Zane', 'Katerina', 'Ryan', 'Mia', 'Cici', 'Theo Calm',
  'Serena', 'Maia', 'Evan', 'Qiao', 'Momo', 'Wil', 'Angel', 'Li Cassian', 'Joyner', 'Gold',
  'Jennifer', 'Aiden', 'Mione', 'Sunny', 'Dylan', 'Eric', 'Peter', 'Joseph Chen', 'Marcus', 'Li',
  'Rocky', 'Kiki', 'Sohee', 'Eliška', 'Alek', 'Arda', 'Dolce', 'Lenn', 'Ono Anna', 'Sonrisa',
  'Bodega', 'Andre', 'Radio Gol', 'Rizky', 'Roya', 'Hana', 'Jakub', 'Griet', 'Marina', 'Siiri',
  'Ingrid', 'Sigga', 'Bea', 'Chloe', 'Emilien', 'longanlingxin',
]);

export function chooseVoice(requested, presets = OMNI_38_VOICES) {
  return presets.includes(requested) ? requested : DEFAULT_VOICE;
}

export function readVoice(storage) {
  try { return chooseVoice(storage?.getItem(VOICE_STORAGE_KEY)); }
  catch { return DEFAULT_VOICE; }
}

export function writeVoice(storage, voice) {
  const chosen = chooseVoice(voice);
  storage.setItem(VOICE_STORAGE_KEY, chosen);
  return chosen;
}

export function redactSecret(text, secret) {
  let out = String(text ?? '');
  if (typeof secret === 'string' && secret.length > 4) out = out.split(secret).join('[已隐藏]');
  return out.replace(/([?&]api_key=)[^&\s'"]+/gi, '$1[已隐藏]');
}

export function realtimeSocketUrl(stack, values, model) {
  const key = String(values?.DASHSCOPE_API_KEY || '');
  if (!/^s[kt]-\S{8,}$/.test(key)) throw new Error('先保存百炼 Key');
  if (!/^[A-Za-z0-9._-]+$/.test(String(model || ''))) throw new Error('实时模型名不可用');
  const root = matchingRoots(stack, values)[0];
  if (!root?.ws) throw new Error('按填写的地域找不到实时接入点');
  const url = new URL(`${root.ws}/api-ws/v1/realtime`);
  if (!url.protocol.startsWith('wss:') || url.username || url.password) throw new Error('实时接入点必须是没有凭证的 wss 地址');
  url.searchParams.set('model', model);
  url.searchParams.set('api_key', key);
  return url.href;
}

export const SEMANTIC_TURN = { type: 'semantic_vad', threshold: 0.5, silence_duration_ms: 800 };

export function sessionConfig({ instructions, voice, inputRate, outputRate, asrModel, turnDetection = null, search = false, tools = null, video = true }) {
  const session = {
    modalities: ['text', 'audio'],
    instructions,
    turn_detection: turnDetection,
    audio: {
      input: { format: { type: 'pcm', sample_rate: inputRate } },
      output: { voice, format: { type: 'pcm', sample_rate: outputRate } },
    },
    input_audio_transcription: { model: asrModel },
  };
  if (video) session.video = { input: { representation_compact: 'normal' } };
  if (Array.isArray(tools) && tools.length) session.tools = tools;
  else if (search) session.enable_search = true;
  return session;
}

export function translationSession({ language = 'en', textOnly = false, phrases = null } = {}) {
  const translation = { language: String(language || 'en') };
  if (phrases && typeof phrases === 'object' && Object.keys(phrases).length) translation.corpus = { phrases };
  return { output_modalities: textOnly ? ['text'] : ['text', 'audio'], translation };
}

export const MUTE_HEARTBEAT_MS = 30000;

export function silenceFrame(rate, seconds = 1) {
  const samples = Math.max(0, Math.round(Number(rate) * Number(seconds)));
  return new Uint8Array(Number.isFinite(samples) ? samples * 2 : 0);
}

export function pcmBase64(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.byteLength < 2 || bytes.byteLength % 2) throw new Error('音频分片无效');
  return toBase64(new Uint8Array(bytes));
}

export function decodeBase64(data) {
  const text = String(data || '');
  if (!text || text.length % 4 || !/^[A-Za-z0-9+/]+={0,2}$/.test(text)) throw new Error('实时音频数据无效');
  const binary = atob(text);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export const CALL_RECOVERY_LIMIT = 2;
export const RESPONSE_CREATED_TIMEOUT_MS = 15000;
export const RESPONSE_DONE_TIMEOUT_MS = 120000;
export const CANCEL_GRACE_MS = 2000;
const MODEL_SERVING_ERROR = /^<50002>\s+InternalError\.Algo\.ModelServingError:/;
const RESPONSE_WAIT_CODES = new Set(['response_created_timeout', 'response_done_timeout', 'response_cancel_timeout']);

export function responseWaitPlan({ phase, authority, elapsedMs }) {
  const elapsed = Number(elapsedMs);
  if (!Number.isFinite(elapsed) || elapsed < 0) return { action: 'wait' };
  if (phase === 'created' && elapsed >= RESPONSE_CREATED_TIMEOUT_MS) return { action: 'recover', code: 'response_created_timeout' };
  if (phase === 'done' && authority !== 'direct' && elapsed >= RESPONSE_DONE_TIMEOUT_MS) return { action: 'recover', code: 'response_done_timeout' };
  if (phase === 'cancel' && elapsed >= CANCEL_GRACE_MS) return { action: 'recover', code: 'response_cancel_timeout' };
  return { action: 'wait' };
}

const QUOTA_ERROR = /insufficient[ _.-]?quota|quota[ _.-]?exceeded/i;
export const QUOTA_STOP_NOTE = '额度不够时这一通马上结束，不会再换一条连接。请到百炼控制台看额度。持续报告和监视也停下。';

export function quotaPlan({ code, message, reason } = {}) {
  const text = `${code || ''} ${message || ''} ${reason || ''}`;
  if (!QUOTA_ERROR.test(text)) return { action: 'continue' };
  return { action: 'stop', note: QUOTA_STOP_NOTE };
}

function quotaFailure(code, message) {
  const plan = quotaPlan({ code, message });
  if (plan.action !== 'stop') return null;
  const error = new Error(plan.note);
  error.code = 'insufficient_quota';
  return error;
}

export function callRecoveryPlan({ code, message, attempts }) {
  if (quotaPlan({ code, message }).action === 'stop') return { action: 'fail' };
  const serving = code === 'COMMON_ERROR' && MODEL_SERVING_ERROR.test(String(message || '').trim());
  const waiting = RESPONSE_WAIT_CODES.has(code);
  const used = Number.isInteger(attempts) && attempts > 0 ? attempts : 0;
  if (!serving && !waiting) return { action: 'fail' };
  if (used >= CALL_RECOVERY_LIMIT) return { action: 'stop', note: '这一通换了两次连接仍没接上。请再开一次通话。' };
  const note = waiting
    ? '这一轮没有按时完成，正在换一条连接。计时接着算。刚才这一轮的声音不会带过去。持续报告、监视和记下的查询还在。'
    : '这一轮模型没有答上，正在换一条连接。计时接着算。刚才这一轮的声音不会带过去。持续报告、监视和记下的查询还在。';
  return { action: 'reconnect', note };
}

export function splitPcm(bytes, size) {
  if (!(bytes instanceof Uint8Array) || !Number.isInteger(size) || size < 2 || size % 2) throw new Error('音频分片无效');
  const chunks = [];
  for (let offset = 0; offset < bytes.length; offset += size) chunks.push(bytes.subarray(offset, offset + size));
  return chunks;
}

export function connectRealtime({ url, secret, session, signal, WebSocketImpl = WebSocket, timeoutMs = 15000, onEvent }) {
  if (typeof url !== 'string' || !url.startsWith('wss://')) throw new Error('实时地址无效');
  const socket = new WebSocketImpl(url);
  let readySettled = false;
  let closed = false;
  let readyResolve;
  let readyReject;
  const ready = new Promise((resolve, reject) => { readyResolve = resolve; readyReject = reject; });
  const fail = (error) => {
    if (readySettled) return;
    readySettled = true;
    closed = true;
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
    const message = redactSecret(error?.message || '实时连接失败', secret);
    const wrapped = error?.name === 'AbortError' ? error : new Error(message);
    if (error?.code) wrapped.code = error.code;
    readyReject(wrapped);
    try { socket.close(); } catch { /* 连接可能还没建立 */ }
  };
  const abort = () => fail(new DOMException('已停止', 'AbortError'));
  const timer = setTimeout(() => fail(new Error('实时连接超时')), timeoutMs);
  const emit = (event) => { try { onEvent?.(event); } catch (error) { onEvent?.({ type: 'error', message: redactSecret(error.message, secret) }); } };
  socket.onopen = () => { if (signal?.aborted) abort(); };
  socket.onmessage = ({ data }) => {
    let event;
    try { event = JSON.parse(data); } catch { fail(new Error('实时事件不是 JSON')); return; }
    if (event?.type === 'error') {
      const message = redactSecret(event.error?.message || event.message || '实时会话返回错误', secret);
      const code = String(event.error?.code || event.code || '');
      if (!readySettled) fail(quotaFailure(code, message) || new Error(message));
      else emit({ type: 'error', code, message });
      return;
    }
    if (event?.type === 'session.created') socket.send(JSON.stringify({ type: 'session.update', session }));
    else if (event?.type === 'session.updated' && !readySettled) {
      readySettled = true;
      clearTimeout(timer);
      readyResolve();
    }
    emit(event);
  };
  socket.onerror = () => fail(new Error('实时连接失败。请核对 Key、地域、业务空间是否一致，以及是否开通了实时模型。'));
  socket.onclose = (event) => {
    const code = Number(event?.code);
    const reason = redactSecret(event?.reason || '', secret);
    if (!readySettled) fail(quotaFailure('', reason) || new Error('实时连接在就绪前断开'));
    else if (!closed) emit({ type: 'socket.close', code: Number.isInteger(code) ? code : 0, reason });
  };
  signal?.addEventListener('abort', abort, { once: true });
  if (signal?.aborted) abort();
  return {
    ready,
    send(type, fields = {}) {
      if (closed || socket.readyState !== 1) throw new Error('实时连接已不可用');
      socket.send(JSON.stringify({ type, ...fields }));
    },
    close() {
      closed = true;
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
      try { socket.close(); } catch { /* 已关闭 */ }
    },
  };
}
