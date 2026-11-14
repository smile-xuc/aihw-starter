// 浏览器看说的请求组装和本机文字记忆。不保存 Key、画面或录音。

export const MAX_TURN_SECONDS = 20;
export const MAX_HISTORY_TURNS = 6;
export const MAX_QUESTION_CHARS = 500;

export const SYSTEM_PROMPT = `你是 AI 硬件体验里的看说助手。用户每次给你一张当前画面（摄像头或屏幕的一帧）和一句问题（文字或语音）。
用口语中文回答，两三句话，先给结论，适合播报。不要用列表、Markdown 和表情符号。
画面里有人时不识别身份。看不清或听不清就直说，不要编造画面里没有的内容。
你看不到连续视频，也不能操作电脑；只根据这一帧、这次提问，以及下面已经发生的文字对话回答。`;

export function isSessionReturn(hash) {
  return hash === '#/session';
}

export function encodeWav(pcm, sampleRate = 16000) {
  const bytes = pcm instanceof Uint8Array ? pcm : new Uint8Array(pcm);
  if (!bytes.byteLength || bytes.byteLength % 2) throw new Error('录音数据不完整');
  if (!Number.isInteger(sampleRate) || sampleRate < 8000) throw new Error('采样率不可用');
  const header = new ArrayBuffer(44);
  const view = new DataView(header);
  const write = (offset, text) => { for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i)); };
  write(0, 'RIFF');
  view.setUint32(4, 36 + bytes.byteLength, true);
  write(8, 'WAVE');
  write(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  write(36, 'data');
  view.setUint32(40, bytes.byteLength, true);
  const out = new Uint8Array(44 + bytes.byteLength);
  out.set(new Uint8Array(header), 0);
  out.set(bytes, 44);
  return out.buffer;
}

export function safeAudioUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && !parsed.username && !parsed.password && /(^|\.)aliyuncs\.com$/.test(parsed.hostname) ? parsed.href : null;
  } catch {
    return null;
  }
}

export function buildUserContent({ imageDataUrl, audioBase64 = '', question = '' }) {
  if (typeof imageDataUrl !== 'string' || !/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/.test(imageDataUrl)) {
    throw new Error('需要一张当前画面');
  }
  const text = String(question || '').trim();
  if (text.length > MAX_QUESTION_CHARS) throw new Error(`问题请控制在 ${MAX_QUESTION_CHARS} 字以内`);
  if (audioBase64 && !/^[A-Za-z0-9+/]+=*$/.test(audioBase64)) throw new Error('录音无法发送');
  if (!text && !audioBase64) throw new Error('请说话或输入问题');
  const content = [{ type: 'image_url', image_url: { url: imageDataUrl } }];
  if (audioBase64) content.push({ type: 'input_audio', input_audio: { data: `data:;base64,${audioBase64}`, format: 'wav' } });
  content.push({ type: 'text', text: text || '请回答音频中的提问。' });
  return content;
}

export function nextTextHistory(history, question, answer, limit = MAX_HISTORY_TURNS) {
  const user = String(question || '').trim() || '（上一轮是语音提问，画面已更新）';
  const next = [...(history || []), { role: 'user', content: user }, { role: 'assistant', content: String(answer || '').trim() }];
  const max = Math.max(1, limit) * 2;
  return next.length > max ? next.slice(next.length - max) : next;
}

export function requestMessages(system, history, userContent) {
  return [{ role: 'system', content: system }, ...(history || []), { role: 'user', content: userContent }];
}

export const MAX_MEMORY_NOTES = 8;
export const MAX_MEMORY_CHARS = 160;
export const SUMMARY_MODEL = 'qwen3.7-plus';
export const MAX_SUMMARY_CHARS = 600;

export function nextMemory(notes, heard, answer, limit = MAX_MEMORY_NOTES) {
  const clean = (value) => String(value || '').replace(/\s+/g, ' ').trim().slice(0, MAX_MEMORY_CHARS);
  const left = clean(heard);
  const right = clean(answer);
  const kept = (Array.isArray(notes) ? notes : []).filter((line) => typeof line === 'string' && line.trim());
  const max = Math.max(1, limit);
  if (!left && !right) return kept.slice(-max);
  const line = left && right ? `${left} → ${right}` : (left || right);
  return [...kept, line].slice(-max);
}

export function clipSummary(text) {
  return String(text || '').replace(/\s+/g, ' ').trim().slice(0, MAX_SUMMARY_CHARS);
}

export function summaryMessages(previous, notes) {
  const recent = (Array.isArray(notes) ? notes : []).filter((line) => typeof line === 'string' && line.trim()).slice(-MAX_MEMORY_NOTES);
  return [
    { role: 'system', content: '你在整理语音助手留在这台设备上的记忆。只根据给出的文字，写成一段不超过 200 字的中文摘要。不要加入密钥、画面描述、猜测，或对话里没有的事实。不要用列表。' },
    { role: 'user', content: `已有摘要：\n${clipSummary(previous) || '（无）'}\n\n新的对话：\n${recent.map((line) => `- ${line.trim()}`).join('\n')}` },
  ];
}

export function instructionsWithMemory(base, notes, summary = '', bio = [], profile = '', upcoming = '') {
  const lines = (Array.isArray(notes) ? notes : [])
    .map((line) => String(line || '').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .slice(-MAX_MEMORY_NOTES);
  const facts = (Array.isArray(bio) ? bio : [])
    .map((line) => String(line || '').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .slice(-24);
  const brief = clipSummary(summary);
  const portrait = String(profile || '').trim();
  const coming = String(upcoming || '').trim();
  if (!lines.length && !brief && !facts.length && !portrait && !coming) return String(base || '');
  const personal = facts.length ? `\n关于用户的长期事实，编号从 0 开始。只在相关时使用，不要复述密钥，也不要编造没发生的事：\n${facts.map((line, index) => `${index}. ${line}`).join('\n')}` : '';
  const stable = portrait ? `\n长期资料。只在相关时使用，不要复述密钥，也不要编造没发生的事：\n${portrait}` : '';
  const soon = coming ? `\n近期事项。只在相关时使用，不要复述密钥，也不要编造没发生的事：\n${coming}` : '';
  const older = brief ? `\n更早的对话摘要。只在相关时使用，不要复述密钥，也不要编造没发生的事：\n${brief}` : '';
  const recent = lines.length ? `\n最近的文字对话。只在相关时使用，不要复述密钥，也不要编造没发生的事：\n${lines.map((line) => `- ${line}`).join('\n')}` : '';
  return `${base}${personal}${stable}${soon}${older}${recent}`;
}

export function spokenText(text) {
  return String(text || '').replace(/[`*#_>[\]()]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 400);
}
