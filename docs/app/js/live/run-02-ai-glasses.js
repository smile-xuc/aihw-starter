// 02 拍照即问；HTTP 合成只测整段音频 URL 就绪，首音频包不可测。
import { fmtCny } from '../ui.js';
import { toBase64, validCount } from './client.js';
import { validateInput } from './input.js';

const ttsChars = (text) => [...text].reduce((n, ch) => n + (ch >= '\u4e00' && ch <= '\u9fff' ? 2 : 1), 0);
function safeAudioUrl(url) {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && !u.username && !u.password && /(^|\.)aliyuncs\.com$/.test(u.hostname) ? u.href : null;
  } catch { return null; }
}
const money = (cost) => cost == null ? '未知' : `¥${fmtCny(cost)}`;

export default async function run(x) {
  const { c } = x;
  const input = validateInput(x.input);
  if (input && input.kind !== 'image') throw new Error('拍照即问需要图片输入');
  const p = c.PRICES[x.region];
  const image = input?.buffer || await x.asset(c.SAMPLE_IMAGE);
  const wav = input ? null : await x.asset(c.SAMPLE_AUDIO);
  const imageName = input?.name || c.SAMPLE_IMAGE.split('/').pop();
  const audioName = input ? null : c.SAMPLE_AUDIO.split('/').pop();
  const speak = x.region === 'cn-beijing';
  const warnings = [];
  const warn = (text) => { warnings.push(text); x.say('提示', text); };
  x.say('设备', input ? '选择照片 + 输入提问' : '按住镜腿 · 拍照 + 收音');
  if (audioName) x.say('设备', `麦克风 ← ${audioName}`);
  x.say('设备', `镜腿摄像头 ← ${imageName}（${Math.floor(image.byteLength / 1024)} KB）`);
  x.say('设备', '上传照片和提问');
  const t0 = x.now();
  x.say('云端', `看图提问 ${c.OMNI_MODEL}（流式文字）${speak ? ` → 播报 ${c.TTS_MODEL}（HTTP 非实时合成 · ${c.TTS_VOICE}）` : ''}`);
  if (!speak) warn(`${c.TTS_MODEL} 的非实时 HTTP 合成只在北京地域提供，本地域只出文字`);
  const content = [{ type: 'image_url', image_url: { url: `data:${input?.mime || 'image/jpeg'};base64,${toBase64(image)}` } }];
  if (wav) content.push({ type: 'input_audio', input_audio: { data: `data:;base64,${toBase64(wav)}`, format: 'wav' } });
  content.push({ type: 'text', text: input?.question || c.ASK_PROMPT });
  let answerEv = null;
  const turn = await x.chat({
    model: c.OMNI_MODEL, messages: [{ role: 'user', content }], modalities: ['text'], reasoning_effort: 'none',
  }, { onText: (_, all) => { answerEv = answerEv ? answerEv.update({ text: all }) : x.say('眼镜', all); } });
  const answer = turn.text.trim();
  if (!answer) throw new Error('看图回答为空：请重新提问');
  if (turn.finish_reason === 'length' || turn.usage.completion >= 1000) warn('看图回答可能被截断，请核对完整性');
  const omniCost = turn.usage.known === false ? null : (turn.usage.prompt * p.omni_in + turn.usage.completion * p.omni_out) / 1e6;
  let costStatus = omniCost == null ? 'unknown' : 'usage';
  const firstText = turn.firstTextAt == null ? null : turn.firstTextAt - t0;
  const outputs = [{ path: 'out/answer.txt', media_type: 'text/plain', type: 'text/plain', text: `${answer}\n` }];
  let ttsCost = 0;
  let audioReady = null;
  if (speak) {
    x.say('云端', `播报合成 ${c.TTS_MODEL}（整段）……`);
    try {
      const resp = await x.post('api', '/services/audio/tts/SpeechSynthesizer', {
        model: c.TTS_MODEL, input: { text: answer, voice: c.TTS_VOICE, format: 'wav', sample_rate: c.OUT_RATE },
      });
      if (resp.code || resp.error) throw new Error(resp.message || resp.error?.message || '语音合成服务返回错误');
      const url = safeAudioUrl(resp.output?.audio?.url || '');
      const knownChars = validCount(resp.usage?.characters);
      const chars = knownChars ? resp.usage.characters : ttsChars(answer);
      ttsCost = (chars * p.tts_per_10k_chars) / 1e4;
      if (!knownChars) {
        if (costStatus !== 'unknown') costStatus = 'estimated';
        warn('播报接口未返回字符用量，费用按回答字符数估算');
      }
      if (url) {
        audioReady = x.now() - t0;
        outputs.push({ path: 'out/reply_1.wav', media_type: 'audio/wav', type: 'audio/wav', url, note: '语音由 AI 合成；地址 24 小时内有效' });
        x.say('设备', '耳机 → 整段音频 URL 已就绪（见下方「产出」，点播放）');
      } else warn('语音合成没有返回安全的官方 HTTPS 音频地址，文字回答已保留');
    } catch (error) {
      if (error.name === 'AbortError' || x.signal?.aborted) throw error;
      ttsCost = null;
      costStatus = 'unknown';
      warn(`语音合成失败：${error.message}；文字回答已保留，播报费用未知`);
    }
  }
  const cost = omniCost == null || ttsCost == null ? null : omniCost + ttsCost;
  const ms = (v) => v == null ? '—' : `${Math.round(v)} ms`;
  x.say('统计', `首字 ${ms(firstText)}${speak ? ` · 整段音频 URL 就绪 ${ms(audioReady)}` : ''} · ${money(cost)}${costStatus === 'estimated' ? '（估算）' : ''}`);
  return {
    models: speak ? [c.OMNI_MODEL, c.TTS_MODEL] : [c.OMNI_MODEL], firstMs: firstText, cost, costStatus,
    metrics: { textFirstMs: firstText, audioFirstMs: null, audioReadyMs: audioReady, totalMs: x.now() - t0 },
    sample: audioName ? `${audioName} + ${imageName}` : imageName,
    note: speak ? '首字=上传→首个文字；音频就绪=整段 HTTP 合成返回 URL，未测首音频包或可播放时刻' : '本地域只出文字，首字=上传→首个文字',
    outputs, warnings,
  };
}
