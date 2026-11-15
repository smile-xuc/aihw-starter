// 按需看一眼：主会话不持续收画面。模型调用 analyze_view 后，另开一条没有工具、没有联网的
// Omni Realtime，按上游协议送两段 1 秒静音和同一张 JPEG，再提交这一次视觉问题。

import { toBase64 } from './client.js';
import { connectRealtime, pcmBase64, sessionConfig } from './realtime-omni.js';

export const LOOK_TOOL = {
  type: 'function',
  function: {
    name: 'analyze_view',
    description: '看用户当前打开的摄像头或屏幕的一张画面。只有用户问到画面内容时才调用。',
    parameters: {
      type: 'object',
      properties: { query: { type: 'string', description: '要看的问题。留空则概述画面。' } },
    },
  },
};

export const VISUAL_INSTRUCTIONS = '你只分析这一张画面。用简短中文回答问题。看不清就说看不清，不要编造画面里没有的文字、人物或物体。';

export const DEMAND_INSTRUCTIONS = `你是看说体验里的语音助手。你不能持续看到画面。
用户问到当前摄像头或屏幕里有什么时，调用 analyze_view，等结果再回答。不要编造没看到的内容。
需要事实或最新信息时调用 web_search，并用口语说明依据。
用户要求盯着画面或听某种声音、出现情况就提醒时，调用 create_proactive_monitor。没有调用成功就不要说已经在监视。
用户明确说了多久以后提醒时，调用 create_proactive_timer。没有调用成功就不要说已经设好。
用户要求连续解说画面或声音的变化时，调用 create_live_narration。没有明显变化就不要主动开口。
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
  const message = String(error?.message || '');
  if (/Key|鉴权|地域|业务空间|不安全|拒绝/.test(message)) return false;
  return /超时|连接|网络|临时/.test(message);
}

async function lookOnce({ connect, url, secret, jpeg, question, voice, inputRate, outputRate, asrModel, timeoutMs, WebSocketImpl }) {
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
  let handle;
  try {
  handle = connect({
    url,
    secret,
    timeoutMs,
    WebSocketImpl,
    session: sessionConfig({
      instructions: VISUAL_INSTRUCTIONS,
      voice,
      inputRate,
      outputRate,
      asrModel,
      turnDetection: null,
      video: true,
    }),
    onEvent(event) {
      if (event.type === 'error') finish(new Error(event.message || '看画面失败'));
      if (event.type === 'response.text.delta' || event.type === 'response.audio_transcript.delta') text += event.delta || '';
      if (event.type === 'input_audio_buffer.committed') {
        try { handle.send('response.create', { response: { instructions: question } }); }
        catch (error) { finish(error); }
      }
      if (event.type === 'response.done') finish(null, text.replace(/\s+/g, ' ').trim());
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
    handle?.close();
  }
}

export async function analyzeFrame(options) {
  const connect = options.connect || connectRealtime;
  const question = visualQuestion(options.question, options.heard);
  const attempt = { ...options, connect, question, timeoutMs: options.timeoutMs || 25000 };
  try {
    return await lookOnce(attempt);
  } catch (error) {
    if (!canRetryVisual(error)) throw error;
    return lookOnce(attempt);
  }
}
