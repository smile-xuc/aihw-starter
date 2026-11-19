// 按需看一眼：主会话不持续收画面。模型调用 analyze_view 后，另开一条没有工具、没有联网的
// Omni Realtime，按上游协议送两段 1 秒静音和同一张 JPEG，再提交这一次视觉问题。

import { toBase64 } from './client.js';
import { connectRealtime, pcmBase64, sessionConfig } from './realtime-omni.js';

export const JPEG_LONG_EDGE = 640;
export const JPEG_MIN_EDGE = 160;
export const JPEG_QUALITY_START = 0.72;
export const JPEG_QUALITY_MIN = 0.35;
export const JPEG_QUALITY_STEP = 0.12;

export function pictureOpen(video) {
  return Boolean(video && Number(video.videoWidth) > 0 && Number(video.videoHeight) > 0);
}

export function nextJpegFit({ edge, quality, bytes, maxBytes, maxEdge }) {
  const size = Number(bytes);
  const limit = Number(maxBytes);
  const longEdge = Math.floor(Number(edge));
  const level = Number(quality);
  const cap = Math.floor(Number(maxEdge));
  if (!Number.isFinite(size) || size < 1 || !Number.isFinite(limit) || limit < 1 || longEdge < 1 || !Number.isFinite(level)) return { done: false };
  if (size <= limit) return { done: true };
  const nextQuality = Math.round((level - JPEG_QUALITY_STEP) * 100) / 100;
  if (nextQuality >= JPEG_QUALITY_MIN) return { done: false, edge: longEdge, quality: nextQuality };
  const nextEdge = Math.floor(longEdge * 0.75);
  if (nextEdge >= JPEG_MIN_EDGE && nextEdge < longEdge && (!Number.isFinite(cap) || cap < 1 || nextEdge <= cap)) {
    return { done: false, edge: nextEdge, quality: JPEG_QUALITY_START };
  }
  return { done: false };
}

export const LOOK_TOOL = {
  type: 'function',
  function: {
    name: 'analyze_view',
    description: '把当前画面交给后台看一眼。回执里没有画面内容。只有用户问到这一帧里有什么时才调用。调用后只用一句话告诉用户你在看，不要在这一轮描述画面。',
    parameters: {
      type: 'object',
      properties: { query: { type: 'string', description: '要看的问题。留空则概述画面。' } },
    },
  },
};

export const VISUAL_INSTRUCTIONS = '你只分析这一张画面。用简短中文回答问题。看不清就说看不清，不要编造画面里没有的文字、人物或物体。';
export const VISUAL_RETRY_INSTRUCTIONS = '这一次最多两句短话，只说画面里看得清的部分。不要逐条念屏幕上的长文字，不要用列表、标题或表格。看不清就说看不清。不要提上一次。';
export const VISUAL_TIMEOUT_MS = 25000;
export const VISUAL_ATTEMPTS = 2;

export const DEMAND_INSTRUCTIONS = `你是看说体验里的语音助手。你不能持续看到画面。
用户问到当前摄像头或屏幕里有什么时，调用 analyze_view。回执里没有画面，这一轮只说你在看，不要描述画面，结果稍后另说。
需要事实或最新信息时调用 web_search。回执里没有答案，这一轮只说你去查了，结果稍后另说。同一轮里已经在查的问题不要再调用。已经开始的监视、解说或到点提醒也不要再创建一次。稍后的结果只有明确写了已经联网，才可以说查过网上；不能确认时不要说已经查过，也不要编造链接。
用户说从现在开始关注身体、咳嗽了提醒，或盯着以后才发生的声音和画面时，调用 create_proactive_monitor。说「提醒我一次」时 repeat 设为 false；说「从现在开始关注」或「一直盯着」时 repeat 设为 true。用户说咳嗽了就提醒我喝水时，condition 写听到咳嗽，trigger_response 写该喝水了。报告屏幕、画面时 modalities 只写 ["vision"]；咳嗽、身体或声音只写 ["audio"]；又要看又要听才两项都写。回执不表示条件已经发生，这一轮不要说已经听到或看到，也不要把提醒原文说成已经发生。
用户明确说了多久以后提醒时，调用 create_proactive_timer。没有调用成功就不要说已经设好。
用户说持续报告屏幕或画面内容，或解说变化时，调用 create_live_narration，把要报告的内容写进 narration_focus。报告屏幕、画面时 modalities 只写 ["vision"]；只听声音时只写 ["audio"]。回执里没有画面，这一轮不要描述画面。这一轮听到的原话会交给后台，句子长短和语气按原话来。narration_focus 只写要看或要听的内容。
持续报告和身体提醒可以同时进行。同一句话里两项都要时，把 create_live_narration 和 create_proactive_monitor 都调用，不要只做一个。两项监视也可以同时留着，后说的一项不要取消前一项，除非用户明确要求停下。这个页面同时最多两项监视，满了就告诉用户先停掉一项。
用户要求改代码、跑命令、操作网页，或交给编码助手时，调用 handoff，task 写用户原话。回执是 no_backend。这一轮只说明这个页面没有编码后台，不要说已经开始或已经做完。
前台要一直能接话。后台结果没到时，不要停下来等，也不要编造结果。
用户明确要求停下某一项监视、解说或到点提醒时，调用 cancel_proactive_task。停下说话、换话题或纠正回答都不算取消。没有调用成功就不要说已经停下。
用户明确要求修改某一项正在进行的监视、解说或到点提醒时，调用 update_proactive_task。不能把一种任务改成另一种。没有调用成功就不要说已经改了。
用户说出会在以后多次用到的个人事实时，调用 omnibio 记下。改掉或取消已有事实时，按提示里的编号 update 或 delete。已经记下的不要重复。名单满了就不要再加，不要删掉更早的事实来腾位置。
用户问起更早的对话、而当前记忆里没有时，调用 omniretrieve，source 用 dialogue。问起以前看到的环境时，source 用 env。用户提到昨天、上周这类时间时，把时间放进 time_range，例如昨天用 [2, 0]，上周用 [14, 1]，不要写进 query。
用口语化中文回答，每次两三句话。不识别画面中人的身份。用户可以随时插话。`;

export function silencePcm(sampleRate = 16000, seconds = 1) {
  const rate = Number(sampleRate);
  const span = Number(seconds);
  if (!Number.isInteger(rate) || rate < 8000 || !Number.isInteger(span) || span < 1 || span > 2) throw new Error('静音参数无效');
  return new Uint8Array(rate * span * 2);
}

export function visualQuestion(query, heard) {
  const text = String(query || heard || '').replace(/\s+/g, ' ').trim().slice(0, 200);
  return text || '概述这张画面里看得到的内容。';
}

export function canRetryVisual(error) {
  if (error?.name === 'AbortError') return false;
  const message = String(error?.message || '');
  if (/Key|鉴权|地域|业务空间|不安全|拒绝/.test(message)) return false;
  return /超时|连接|网络|临时/.test(message);
}

export function visualRepeatError(error) {
  if (!error || typeof error !== 'object') return false;
  if (error.code !== 'COMMON_ERROR' || error.message !== 'model repeat output happened') return false;
  if (error.type !== undefined && error.type !== 'server_error') return false;
  const status = error.status;
  return status === undefined || (typeof status === 'number' && status >= 500 && status <= 599);
}

export function visualRetryPlan({ code, message, name, type, status, attempt } = {}) {
  const used = Number.isInteger(attempt) && attempt > 0 ? attempt : 1;
  if (name === 'AbortError' || used >= VISUAL_ATTEMPTS) return { action: 'stop' };
  if (visualRepeatError({ code, message, type, status }) || canRetryVisual({ name, message })) return { action: 'retry' };
  return { action: 'stop' };
}

function presentLookError(error) {
  if (!visualRepeatError(error)) return error;
  const wrapped = new Error('这一帧看了两次，内容还是重复，这次没看清');
  wrapped.code = error.code;
  return wrapped;
}

// 视频表征在首段音频之后不能改。已经开过画面的通话只停帧或续帧，并换工具。
// 这一通还没开过画面时，改成实时画面必须新开连接。
export function captureSwitchPlan({ mode, next, videoOn, tools }) {
  const current = mode === 'demand' ? 'demand' : 'live';
  const target = next === 'demand' ? 'demand' : 'live';
  if (target === current) return { changed: false, mode: current, reconnect: false, tools: 'omit', note: '' };
  const reconnect = target === 'live' && !videoOn;
  let note;
  if (reconnect) note = '已改为实时画面。这一通计时接着算，会新开一条连接。刚才听到的声音不会带过去。记下的查询和提醒还在。';
  else if (target === 'demand' && videoOn) note = tools
    ? '已改为按需看一眼。不再持续送画面。刚才送进这一通的画面还会留一会儿。问到画面时另看一次。'
    : '已改为按需看一眼。不再持续送画面。这一通没有工具，问到画面时看不了。';
  else if (target === 'live') note = '已改为实时画面。大约每秒送一帧。';
  else note = '已改为按需看一眼。问到画面时才会另开一次看图。';
  return { changed: true, mode: target, reconnect, tools: tools ? target : 'omit', note };
}

async function lookOnce({ connect, url, secret, jpeg, question, voice, inputRate, outputRate, asrModel, timeoutMs, WebSocketImpl, signal, instructions = VISUAL_INSTRUCTIONS }) {
  if (!(jpeg instanceof Uint8Array) || jpeg.byteLength < 3) throw new Error('没有可看的画面');
  const image = toBase64(jpeg);
  const silence = pcmBase64(silencePcm(inputRate, 1));
  let text = '';
  let settled = false;
  let resolve;
  let reject;
  const finished = new Promise((ok, bad) => { resolve = ok; reject = bad; });
  const finish = (error, value) => {
    if (settled) return;
    settled = true;
    clearTimeout(timer);
    if (error) reject(error);
    else resolve(value);
  };
  const timer = setTimeout(() => finish(new Error('看画面超时')), timeoutMs);
  const onAbort = () => finish(new DOMException('已停下', 'AbortError'));
  signal?.addEventListener('abort', onAbort, { once: true });
  if (signal?.aborted) onAbort();
  let handle;
  try {
  handle = connect({
    url,
    secret,
    timeoutMs,
    signal,
    WebSocketImpl,
    session: sessionConfig({
      instructions,
      voice,
      inputRate,
      outputRate,
      asrModel,
      turnDetection: null,
      video: true,
    }),
    onEvent(event) {
      if (event.type === 'error') {
        const error = new Error(event.message || '看画面失败');
        if (event.code) error.code = event.code;
        finish(error);
      }
      if (event.type === 'response.text.delta' || event.type === 'response.audio_transcript.delta') text += event.delta || '';
      if (event.type === 'input_audio_buffer.committed') {
        try { handle.send('response.create', { response: { instructions: question } }); }
        catch (error) { finish(error); }
      }
      if (event.type === 'response.done') {
        const response = event.response;
        const repeated = visualRepeatError(response?.error) || visualRepeatError(response?.status_details?.error);
        if (response?.status === 'failed' && repeated) {
          const error = new Error('model repeat output happened');
          error.code = 'COMMON_ERROR';
          error.type = 'server_error';
          error.status = 500;
          finish(error);
          return;
        }
        if (response?.status && response.status !== 'completed') {
          finish(new Error(response.error?.message || '看画面失败'));
          return;
        }
        finish(null, text.replace(/\s+/g, ' ').trim());
      }
    },
  });
    await handle.ready;
    handle.send('input_audio_buffer.append', { audio: silence });
    handle.send('input_image_buffer.append', { image });
    handle.send('input_audio_buffer.append', { audio: silence });
    handle.send('input_image_buffer.append', { image });
    handle.send('input_audio_buffer.commit');
    return await finished;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
    handle?.close();
  }
}

export async function analyzeFrame(options) {
  const connect = options.connect || connectRealtime;
  const question = visualQuestion(options.question, options.heard);
  const limit = options.timeoutMs || VISUAL_TIMEOUT_MS;
  const deadline = Date.now() + limit * VISUAL_ATTEMPTS;
  let lastError;
  for (let attempt = 1; attempt <= VISUAL_ATTEMPTS; attempt += 1) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw presentLookError(lastError || new Error('看画面超时'));
    const timeoutMs = Math.min(limit, remaining);
    const instructions = attempt === 1 ? VISUAL_INSTRUCTIONS : `${VISUAL_INSTRUCTIONS}\n${VISUAL_RETRY_INSTRUCTIONS}`;
    try {
      return await lookOnce({ ...options, connect, question, timeoutMs, instructions });
    } catch (error) {
      lastError = error;
      const plan = visualRetryPlan({ code: error.code, message: error.message, name: error.name, type: error.type, status: error.status, attempt });
      if (plan.action !== 'retry') throw presentLookError(error);
    }
  }
  throw presentLookError(lastError);
}
