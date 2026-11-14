// 浏览器里的 Qwen Omni Realtime。官方握手只认 Authorization 头，浏览器设不了这个头。
// 2026-11-15 实测：wss 查询参数 api_key 会被网关读取；临时 Key 的 HTTP 接口没有浏览器跨域。
// 因此只把 Key 放进发往官方域名的 WebSocket 地址，调用方不得把这个地址写入页面、历史或日志。

import { matchingRoots, toBase64 } from './client.js';

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
      if (!readySettled) fail(new Error(message));
      else emit({ type: 'error', message });
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
  socket.onclose = () => {
    if (!readySettled) fail(new Error('实时连接在就绪前断开'));
    else if (!closed) emit({ type: 'socket.close' });
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
