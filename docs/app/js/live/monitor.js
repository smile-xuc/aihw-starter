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

export const TIMER_TOOL = {
  type: 'function',
  function: {
    name: 'create_proactive_timer',
    description: '在用户明确说了多久以后，提醒一句指定的话。',
    parameters: {
      type: 'object',
      properties: {
        delay_sec: { type: 'integer', description: '多少秒后提醒，5 到 3600。' },
        message: { type: 'string', description: '到点要说的那句话。' },
      },
      required: ['delay_sec', 'message'],
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

export const NARRATE_TOOL = {
  type: 'function',
  function: {
    name: 'create_live_narration',
    description: '连续解说当前摄像头或屏幕，以及这两秒的声音。只在出现值得一提的变化时开口。',
    parameters: {
      type: 'object',
      properties: { narration_focus: { type: 'string', description: '解说时重点看什么。留空则概述刚发生的变化。' } },
    },
  },
};

export const NARRATE_RULES = `你在连续解说这一小段新的声音和画面。
只说刚出现的、值得一提的变化。
没有明显变化时，只输出 remain_silent。
不要编造，不要重复没有变化的内容。`;

export function narrateTask(focus) {
  const text = String(focus || '').replace(/\s+/g, ' ').trim().slice(0, 200);
  return text ? `解说重点：${text}` : '解说刚发生的变化。';
}

export const MONITOR_RULES = `你是主动提醒监视器，只判断这一小段新的声音和画面。
条件没有发生时，只输出 remain_silent。
条件发生时，用一句中文说明听到或看到了什么。不要编造，也不要提醒条件以外的事。`;

export const SPEAK_RULES = '你只朗读给出的那句话，不要改写，不要加称呼或解释。';

export function timerRequest(raw) {
  const args = raw && typeof raw === 'object' ? raw : {};
  let seconds = Number(args.delay_sec ?? args.seconds);
  if (!Number.isFinite(seconds) && args.minutes != null) seconds = Number(args.minutes) * 60;
  if (!Number.isFinite(seconds)) throw new Error('提醒时间要在 5 秒到 1 小时之间');
  seconds = Math.round(seconds);
  const text = String(args.message || args.text || '').replace(/\s+/g, ' ').trim().slice(0, 120);
  if (seconds < 5 || seconds > 3600) throw new Error('提醒时间要在 5 秒到 1 小时之间');
  if (!text) throw new Error('提醒内容是空的');
  return { seconds, text };
}

export async function speakReminder(options) {
  const connect = options.connect || connectRealtime;
  const sentence = String(options.text || '').replace(/\s+/g, ' ').trim().slice(0, 120);
  if (!sentence) throw new Error('提醒内容是空的');
  let audio = [];
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
  const timer = setTimeout(() => finish(new Error('朗读超时')), options.timeoutMs || 25000);
  let handle;
  try {
    handle = connect({
      url: options.url,
      secret: options.secret,
      timeoutMs: options.timeoutMs || 25000,
      WebSocketImpl: options.WebSocketImpl,
      session: sessionConfig({
        instructions: SPEAK_RULES,
        voice: options.voice,
        inputRate: options.inputRate,
        outputRate: options.outputRate,
        asrModel: options.asrModel,
        turnDetection: null,
        video: false,
      }),
      onEvent(event) {
        if (event.type === 'error') finish(new Error(event.message || '朗读失败'));
        if (event.type === 'response.audio.delta' && event.delta) {
          try { audio.push(decodeBase64(event.delta)); } catch { /* 这一小段声音无效就只留文字 */ }
        }
        if (event.type === 'input_audio_buffer.committed') {
          try { handle.send('response.create', { response: { instructions: sentence } }); }
          catch (error) { finish(error); }
        }
        if (event.type === 'response.done') finish(null, { audio });
      },
    });
    await handle.ready;
    handle.send('input_audio_buffer.append', { audio: pcmBase64(silencePcm(options.inputRate, 1)) });
    handle.send('input_audio_buffer.commit');
    return await finished;
  } finally {
    clearTimeout(timer);
    handle?.close();
  }
}

export function monitorTask(condition) {
  const text = String(condition || '').replace(/\s+/g, ' ').trim().slice(0, 200);
  if (!text) throw new Error('提醒条件是空的');
  return `只判断这个条件：${text}`;
}

export function isSilentMonitor(text) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  return !clean || /\bremain_silent\b/i.test(clean);
}

export function spokenWhileMuted(queue, muted) {
  const waiting = (Array.isArray(queue) ? queue : []).filter((item) => item && Array.isArray(item.audio) && item.audio.length);
  return muted ? [] : waiting;
}

export function nextSpokenAlert(queue, busy) {
  const waiting = (Array.isArray(queue) ? queue : []).filter((item) => item && Array.isArray(item.audio) && item.audio.length);
  if (!waiting.length || busy) return { waiting, audio: null };
  return { waiting: waiting.slice(1), audio: waiting[0].audio };
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

export const CANCEL_TOOL = {
  type: 'function',
  function: {
    name: 'cancel_proactive_task',
    description: '只在用户明确要求停下某一项监视、解说或到点提醒时调用。用标题精确匹配，或用一段能唯一对上的文字。只有用户明确说全部停下时，才把 all 设为 true。停下说话、换话题或纠正回答都不算取消。没有刚创建的任务时不要传空参数。工具回执确认之前，不要说已经停下。',
    parameters: {
      type: 'object',
      properties: {
        target_title: { type: 'string', description: '要停下的任务标题，必须和现有任务完全一致。' },
        target_title_contains: { type: 'string', description: '标题里能唯一对上的一段文字。' },
        all: { type: 'boolean', description: '只有用户明确要求停下全部主动任务时才为 true。' },
      },
    },
  },
};

export const UPDATE_TOOL = {
  type: 'function',
  function: {
    name: 'update_proactive_task',
    description: '只在用户明确要求修改某一项正在进行的监视、解说或到点提醒时调用。用标题精确匹配，或用一段能唯一对上的文字。监视只改条件和提醒说法，解说只改重点和风格，到点提醒只改内容和时间。不能把一种任务改成另一种。工具回执确认之前，不要说已经改了。',
    parameters: {
      type: 'object',
      properties: {
        target_title: { type: 'string', description: '要修改的任务标题，必须和现有任务完全一致。' },
        target_title_contains: { type: 'string', description: '标题里能唯一对上的一段文字。' },
        title: { type: 'string', description: '新的标题。' },
        condition: { type: 'string', description: '监视的新条件。' },
        trigger_response: { type: 'string', description: '监视发生时要怎么说。' },
        narration_focus: { type: 'string', description: '解说的新重点。' },
        narration_style: { type: 'string', description: '解说的新风格。' },
        reminder_text: { type: 'string', description: '到点要读的新内容。' },
        duration_sec: { type: 'number', description: '从现在起多少秒后提醒，5 到 3600。' },
      },
    },
  },
};

export const LIST_TOOL = {
  type: 'function',
  function: {
    name: 'list_proactive_tasks',
    description: '回答现在有哪些主动任务之前先调用。只读取，不改变任务。',
    parameters: { type: 'object', properties: {} },
  },
};

function kindLabel(kind) {
  if (kind === 'narration') return '解说';
  if (kind === 'timer') return '到点提醒';
  return '监视';
}

export function proactiveTasks(tasks) {
  return (Array.isArray(tasks) ? tasks : []).filter((task) => task && task.id && typeof task.title === 'string' && task.title.trim());
}

function taskLines(tasks) {
  return proactiveTasks(tasks).map((task) => `- ${kindLabel(task.kind)}「${task.title.trim()}」`);
}

export function listProactive(tasks) {
  const lines = taskLines(tasks);
  return lines.length ? `现在有这些主动任务：\n${lines.join('\n')}` : '现在没有主动任务。';
}

export function taskPrompt(tasks) {
  const lines = taskLines(tasks);
  if (!lines.length) return '';
  return `\n当前主动任务：\n${lines.join('\n')}\n用户明确要求停下其中一项时，调用 cancel_proactive_task。停下说话、换话题或纠正回答都不算取消。`;
}

export function cancelProactive(tasks, args, adjacentId) {
  const active = proactiveTasks(tasks);
  if (!args || typeof args !== 'object' || Array.isArray(args)) return { ids: [], receipt: '参数不是对象，没有停下任何任务。' };
  const keys = Object.keys(args);
  if (keys.some((key) => key !== 'target_title' && key !== 'target_title_contains' && key !== 'all')) {
    return { ids: [], receipt: '有不能识别的参数，没有停下任何任务。' };
  }
  const title = typeof args.target_title === 'string' ? args.target_title.trim() : '';
  const contains = typeof args.target_title_contains === 'string' ? args.target_title_contains.trim() : '';
  if (args.all !== undefined && args.all !== true && args.all !== false) return { ids: [], receipt: 'all 必须是布尔值，没有停下任何任务。' };
  const all = args.all === true;
  if (all && (title || contains)) return { ids: [], receipt: '全部停下不能再指定标题，没有停下任何任务。' };
  if (title && contains) return { ids: [], receipt: '一次只能用一种标题，没有停下任何任务。' };
  const done = (chosen) => ({
    ids: chosen.map((task) => task.id),
    receipt: `已停下：${chosen.map((task) => `${kindLabel(task.kind)}「${task.title.trim()}」`).join('、')}。`,
  });
  if (!all && !title && !contains) {
    if (keys.length) return { ids: [], receipt: '没有指定任务。要停刚创建的那一项，参数必须是空的。' };
    const adjacent = active.find((task) => task.id === adjacentId);
    if (!adjacent) return { ids: [], receipt: '没有刚创建的任务。请说明要停哪一个。' };
    return done([adjacent]);
  }
  if (all) return active.length ? done(active) : { ids: [], receipt: '现在没有主动任务。' };
  const needle = (title || contains).toLocaleLowerCase();
  const matches = active.filter((task) => {
    const name = task.title.trim().toLocaleLowerCase();
    return title ? name === needle : name.includes(needle);
  });
  if (!matches.length) return { ids: [], receipt: '没有对上的主动任务。' };
  if (matches.length > 1) return { ids: [], receipt: '对上了不止一项。请用完整标题。' };
  return done(matches);
}

const UPDATE_KEYS = ['target_title', 'target_title_contains', 'title', 'condition', 'trigger_response', 'narration_focus', 'narration_style', 'reminder_text', 'duration_sec', 'repeat', 'modalities'];

function clipPiece(value, max) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

export function updateProactive(tasks, args) {
  const active = proactiveTasks(tasks);
  const fail = (receipt) => ({ id: null, patch: null, receipt });
  if (!args || typeof args !== 'object' || Array.isArray(args)) return fail('参数不是对象，没有改任何任务。');
  const keys = Object.keys(args);
  if (keys.some((key) => !UPDATE_KEYS.includes(key))) return fail('有不能识别的参数，没有改任何任务。');
  const title = typeof args.target_title === 'string' ? args.target_title.trim() : '';
  const contains = typeof args.target_title_contains === 'string' ? args.target_title_contains.trim() : '';
  if (title && contains) return fail('一次只能用一种标题，没有改任何任务。');
  const changes = keys.filter((key) => key !== 'target_title' && key !== 'target_title_contains');
  if (!changes.length) return fail('没有要改的内容。');
  if (!title && !contains) return fail('请说明要改哪一项。');
  const needle = (title || contains).toLocaleLowerCase();
  const matches = active.filter((task) => {
    const name = task.title.trim().toLocaleLowerCase();
    return title ? name === needle : name.includes(needle);
  });
  if (!matches.length) return fail('没有对上的主动任务。');
  if (matches.length > 1) return fail('对上了不止一项。请用完整标题。');
  const task = matches[0];
  const present = (names) => names.filter((name) => args[name] !== undefined);
  if (task.kind === 'timer' && present(['condition', 'trigger_response', 'narration_focus', 'narration_style', 'repeat', 'modalities']).length) {
    return fail('到点提醒不能改监视或解说的内容。');
  }
  if (task.kind === 'narration' && present(['condition', 'trigger_response', 'repeat', 'reminder_text', 'duration_sec', 'modalities']).length) {
    return fail('解说不能改成监视或到点提醒。');
  }
  if (task.kind !== 'timer' && task.kind !== 'narration') {
    if (present(['narration_focus', 'narration_style', 'reminder_text', 'duration_sec']).length) return fail('监视不能改成解说或到点提醒。');
    if (args.repeat !== undefined) return fail('这里的监视会一直进行，直到你停下，不能改成只提醒一次。');
    if (args.modalities !== undefined) return fail('监视一直同时看画面和听这两秒的声音，不能单独改。');
  }
  const patch = {};
  if (typeof args.title === 'string') {
    const next = clipPiece(args.title, 200);
    if (!next) return fail('新标题是空的，没有改。');
    const clash = active.some((item) => item.id !== task.id && item.title.trim().toLocaleLowerCase() === next.toLocaleLowerCase());
    if (clash) return fail('已经有同名的主动任务，没有改。');
    if (next !== task.title.trim()) patch.title = next;
  }
  if (task.kind === 'monitor' || task.kind == null) {
    if (typeof args.condition === 'string') {
      const next = clipPiece(args.condition, 200);
      if (!next) return fail('新的条件是空的，没有改。');
      if (next !== String(task.condition || task.title).trim()) patch.condition = next;
    }
    if (typeof args.trigger_response === 'string') {
      const next = clipPiece(args.trigger_response, 200);
      if (!next) return fail('提醒说法是空的，没有改。');
      if (next !== String(task.response || '').trim()) patch.response = next;
    }
  }
  if (task.kind === 'narration') {
    if (typeof args.narration_focus === 'string') {
      const next = clipPiece(args.narration_focus, 200);
      if (!next) return fail('解说重点是空的，没有改。');
      if (next !== String(task.focus || '').trim()) patch.focus = next;
    }
    if (typeof args.narration_style === 'string') {
      const next = clipPiece(args.narration_style, 200);
      if (!next) return fail('解说风格是空的，没有改。');
      if (next !== String(task.style || '').trim()) patch.style = next;
    }
  }
  if (task.kind === 'timer') {
    if (args.duration_sec !== undefined) {
      const seconds = Math.round(Number(args.duration_sec));
      if (!Number.isFinite(seconds) || seconds < 5 || seconds > 3600) return fail('提醒时间要在 5 秒到 1 小时之间，没有改。');
      patch.seconds = seconds;
    }
    if (typeof args.reminder_text === 'string') {
      const next = clipPiece(args.reminder_text, 120);
      if (!next) return fail('提醒内容是空的，没有改。');
      if (next !== String(task.reminder || task.title).trim()) patch.reminder = next;
    }
  }
  if (!Object.keys(patch).length) return fail('内容和现在一样，没有改。');
  const bits = [];
  if (patch.title) bits.push(`标题「${patch.title}」`);
  if (patch.condition) bits.push(`条件「${patch.condition}」`);
  if (patch.response) bits.push(`说法「${patch.response}」`);
  if (patch.focus) bits.push(`重点「${patch.focus}」`);
  if (patch.style) bits.push(`风格「${patch.style}」`);
  if (patch.reminder) bits.push(`内容「${patch.reminder}」`);
  if (patch.seconds) bits.push(`从现在起 ${patch.seconds} 秒`);
  return { id: task.id, patch, receipt: `已改${kindLabel(task.kind)}：${bits.join('，')}。下一轮按新的来。` };
}

export function openMonitor(options) {
  const connect = options.connect || connectRealtime;
  let focus = options.task || monitorTask(options.condition);
  let announce = true;
  let text = '';
  let audio = [];
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
      instructions: options.rules || MONITOR_RULES,
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
        try {
          if (announce) {
            handle.send('response.create', { response: { instructions: focus } });
            announce = false;
          } else handle.send('response.create');
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
    setFocus(next) {
      const text = String(next || '').trim();
      if (!text || text === focus) return;
      focus = text;
      announce = true;
    },
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
