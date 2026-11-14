// 主动提醒：另一条没有工具、没有联网的 Omni Realtime。每轮送两段 1 秒静音和两张新画面，
// 只有第一轮在 response.create 里带上条件。条件没发生时模型应只回答 remain_silent。

import { toBase64 } from './client.js';
import { silencePcm } from './on-demand.js';
import { connectRealtime, decodeBase64, pcmBase64, sessionConfig } from './realtime-omni.js';

export const SEARCH_TOOL = {
  type: 'function',
  function: {
    name: 'web_search',
    description: '查询公开信息。只有用户问到事实、新闻或你不确定的近况时才调用。',
    parameters: {
      type: 'object',
      properties: { query: { type: 'string', description: '要查的问题。' } },
      required: ['query'],
    },
  },
};

export const MONITOR_TOOL = {
  type: 'function',
  function: {
    name: 'create_proactive_monitor',
    description: '盯着当前摄像头或屏幕，并听这两秒的麦克风。条件发生时才提醒，没发生就保持安静。',
    parameters: {
      type: 'object',
      properties: { condition: { type: 'string', description: '要盯的条件，例如出现报错时提醒。' } },
      required: ['condition'],
    },
  },
};

export const MONITOR_RULES = `你是主动提醒监视器，只判断这一小段新的声音和画面。
条件没有发生时，只输出 remain_silent。
条件发生时，用一句中文说明听到或看到了什么。不要编造，也不要提醒条件以外的事。`;

export function monitorTask(condition) {
  const text = String(condition || '').replace(/\s+/g, ' ').trim().slice(0, 200);
  if (!text) throw new Error('提醒条件是空的');
  return `只判断这个条件：${text}`;
}

export function isSilentMonitor(text) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  return !clean || /\bremain_silent\b/i.test(clean);
}

export function searchMessages(query) {
  const text = String(query || '').replace(/\s+/g, ' ').trim().slice(0, 300);
  if (!text) throw new Error('搜索内容是空的');
  return [
    { role: 'system', content: '只根据联网结果用简短中文回答。没有结果就说没查到，不要编造来源。' },
    { role: 'user', content: text },
  ];
}

export function pushMonitorAudio(state, chunk, sampleRate = 16000) {
  if (!(chunk instanceof Uint8Array) || chunk.byteLength < 2 || chunk.byteLength % 2) throw new Error('监视音频无效');
  const keep = sampleRate * 2 * 3;
  const parts = [...(state?.parts || []), chunk];
  let total = (state?.total || 0) + chunk.byteLength;
  let start = 0;
  while (start < parts.length - 1 && total - parts[start].byteLength >= keep) {
    total -= parts[start].byteLength;
    start += 1;
  }
  return { parts: parts.slice(start), total };
}

export function takeMonitorAudio(state, sampleRate = 16000) {
  const need = sampleRate * 2 * 2;
  if (!state || state.total < need) return null;
  const merged = new Uint8Array(state.total);
  let offset = 0;
  for (const part of state.parts) { merged.set(part, offset); offset += part.byteLength; }
  const slice = merged.subarray(merged.byteLength - need);
  const half = need / 2;
  return [slice.slice(0, half), slice.slice(half)];
}

export function toolArguments(raw) {
  try { return JSON.parse(raw || '{}'); } catch { return {}; }
}

export function openMonitor(options) {
  const connect = options.connect || connectRealtime;
  const task = monitorTask(options.condition);
  let text = '';
  let audio = [];
  let firstRound = true;
  const rounds = [];
  let pending = null;
  const settle = (error, value) => {
    if (!pending) return;
    const current = pending;
    pending = null;
    if (error) current.reject(error);
    else current.resolve(value);
  };
  const handle = connect({
    url: options.url,
    secret: options.secret,
    timeoutMs: options.timeoutMs || 25000,
    WebSocketImpl: options.WebSocketImpl,
    session: sessionConfig({
      instructions: MONITOR_RULES,
      voice: options.voice,
      inputRate: options.inputRate,
      outputRate: options.outputRate,
      asrModel: options.asrModel,
      turnDetection: null,
      video: true,
    }),
    onEvent(event) {
      if (event.type === 'error') settle(new Error(event.message || '主动提醒失败'));
      if (event.type === 'response.text.delta' || event.type === 'response.audio_transcript.delta') text += event.delta || '';
      if (event.type === 'response.audio.delta' && event.delta) {
        try { audio.push(decodeBase64(event.delta)); } catch { /* 这一小段声音无效就只留文字 */ }
      }
      if (event.type === 'input_audio_buffer.committed') {
        const meta = rounds.shift();
        try {
          if (meta?.first) handle.send('response.create', { response: { instructions: task } });
          else handle.send('response.create');
        } catch (error) { settle(error); }
      }
      if (event.type === 'response.done') {
        const result = { text: text.replace(/\s+/g, ' ').trim(), audio };
        text = '';
        audio = [];
        settle(null, result);
      }
    },
  });
  return {
    ready: handle.ready,
    round(frames, audioClips = null) {
      if (pending) return Promise.reject(new Error('上一次监视还没结束'));
      if (!Array.isArray(frames) || frames.length < 2 || !(frames[0] instanceof Uint8Array) || !(frames[1] instanceof Uint8Array)) {
        return Promise.reject(new Error('监视画面不足'));
      }
      const size = options.inputRate * 2;
      const heard = Array.isArray(audioClips) && audioClips.length >= 2
        && audioClips[0] instanceof Uint8Array && audioClips[0].byteLength === size
        && audioClips[1] instanceof Uint8Array && audioClips[1].byteLength === size
        ? [pcmBase64(audioClips[0]), pcmBase64(audioClips[1])]
        : null;
      const silence = heard ? null : pcmBase64(silencePcm(options.inputRate, 1));
      const run = new Promise((resolve, reject) => { pending = { resolve, reject }; });
      rounds.push({ first: firstRound });
      firstRound = false;
      try {
        handle.send('input_audio_buffer.append', { audio: heard ? heard[0] : silence });
        handle.send('input_image_buffer.append', { image: toBase64(frames[0]) });
        handle.send('input_audio_buffer.append', { audio: heard ? heard[1] : silence });
        handle.send('input_image_buffer.append', { image: toBase64(frames[1]) });
        handle.send('input_audio_buffer.commit');
      } catch (error) {
        pending = null;
        return Promise.reject(error);
      }
      return run;
    },
    close() {
      handle.close();
      settle(new Error('主动提醒已停止'));
    },
  };
}
