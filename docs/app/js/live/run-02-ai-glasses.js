// 02 AI 眼镜 · 浏览器真跑「拍照即问」：流程对照 solutions/by-category/02-ai-glasses/demo/bailian/run.py 的 run_ask()。
// 设备上的播报走 WebSocket 流式合成；浏览器的 WebSocket 不能带 Authorization 请求头，这里改用非实时 HTTP 合成（仅北京地域）。
import { fmtCny } from '../ui.js';
import { toBase64 } from './client.js';

// 按价格页口径计费字符：一个汉字计 2 个字符，其他计 1 个（与 run.py 的 tts_chars() 一致）
const ttsChars = (text) => [...text].reduce((n, ch) => n + (ch >= '\u4e00' && ch <= '\u9fff' ? 2 : 1), 0);

// 非实时合成返回的是百炼结果存储里的音频地址（OSS 签名 URL）；只接受 aliyuncs.com 下的地址，并改成 https
function safeAudioUrl(url) {
  try {
    const u = new URL(url);
    if (!/(^|\.)aliyuncs\.com$/.test(u.hostname)) return null;
    u.protocol = 'https:';
    return u.href;
  } catch {
    return null;
  }
}

export default async function run(x) {
  const { c } = x;
  const p = c.PRICES[x.region];
  const image = await x.asset(c.SAMPLE_IMAGE);
  const wav = await x.asset(c.SAMPLE_AUDIO);
  const imageName = c.SAMPLE_IMAGE.split('/').pop();
  const audioName = c.SAMPLE_AUDIO.split('/').pop();
  const speak = x.region === 'cn-beijing';
  x.say('设备', '按住镜腿 · 拍照 + 收音');
  x.say('设备', `麦克风 ← ${audioName}`);
  x.say('设备', `镜腿摄像头 ← ${imageName}（${Math.floor(image.byteLength / 1024)} KB）`);
  x.say('设备', '松开镜腿 → 上传照片和提问');
  const t0 = x.now();
  x.say('云端', `看图听问 ${c.OMNI_MODEL}（流式文字）${speak ? ` → 播报 ${c.TTS_MODEL}（HTTP 非实时合成 · ${c.TTS_VOICE}）` : ''}`);
  if (!speak) x.say('提示', `${c.TTS_MODEL} 的非实时 HTTP 合成只在北京地域提供，新加坡这里只出文字`);
  let answerEv = null;
  const turn = await x.chat({
    model: c.OMNI_MODEL,
    messages: [{ role: 'user', content: [
      { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${toBase64(image)}` } },
      { type: 'input_audio', input_audio: { data: `data:;base64,${toBase64(wav)}`, format: 'wav' } },
      { type: 'text', text: c.ASK_PROMPT },
    ] }],
    modalities: ['text'],
    reasoning_effort: 'none',
  }, { onText: (_, all) => { answerEv = answerEv ? answerEv.update({ text: all }) : x.say('眼镜', all); } });
  const answer = turn.text.trim();
  const omniCost = (turn.usage.prompt * p.omni_in + turn.usage.completion * p.omni_out) / 1e6;
  const firstText = turn.firstTextAt == null ? null : turn.firstTextAt - t0;
  const outputs = [];
  let ttsCost = 0;
  let chars = 0;
  let audioReady = null;
  if (speak && answer) {
    x.say('云端', `播报合成 ${c.TTS_MODEL}（整段）……`);
    const resp = await x.post('api', '/services/audio/tts/SpeechSynthesizer', {
      model: c.TTS_MODEL, input: { text: answer, voice: c.TTS_VOICE, format: 'wav', sample_rate: c.OUT_RATE },
    });
    audioReady = x.now() - t0;
    const url = safeAudioUrl(resp.output?.audio?.url || '');
    chars = Number(resp.usage?.characters || 0) || ttsChars(answer);
    ttsCost = (chars * p.tts_per_10k_chars) / 1e4;
    if (url) {
      outputs.push({ path: 'out/reply_1.wav', type: 'audio/wav', url, note: '语音由 AI 合成；地址 24 小时内有效' });
      x.say('设备', '耳机 → 合成语音已就绪（见下方「产出」，点播放）');
    } else x.say('提示', '语音合成没有返回可用的音频地址');
  }
  const ms = (v) => (v == null ? '—' : `${Math.round(v)} ms`);
  x.say('统计', `第 1 问 · 松开镜腿 → 首字 ${ms(firstText)}${speak ? ` · 整段语音就绪 ${ms(audioReady)}` : ''} · ¥${fmtCny(omniCost + ttsCost)}`
    + `（看图听问 ¥${fmtCny(omniCost)}：输入 ${turn.usage.prompt} / 输出 ${turn.usage.completion} Token${speak ? `；播报 ¥${fmtCny(ttsCost)}：${chars} 字符` : ''}）`);
  return {
    models: speak ? [c.OMNI_MODEL, c.TTS_MODEL] : [c.OMNI_MODEL],
    firstMs: speak ? audioReady : firstText,
    cost: omniCost + ttsCost,
    sample: `${audioName} + ${imageName}`,
    note: speak ? '首字=松开镜腿→整段语音就绪（浏览器用 HTTP 整段合成，比设备上的流式播报慢）' : '新加坡只出文字，首字=松开镜腿→首个文字',
    outputs,
  };
}
