// 07 录音卡 · 浏览器真跑：流程对照 solutions/by-category/07-recorder/demo/bailian/run.py（同步转写 + 流式纪要）
import { fmtCny } from '../ui.js';
import { costOf, parseJson, toBase64, validCount } from './client.js';

import { validateInput } from './input.js';

const pad = (n) => String(n).padStart(2, '0');
const speakerLabel = (raw) => (raw == null ? '说话人' : `说话人${raw + 1}`);

function toSentences(items) {
  if (!Array.isArray(items)) throw new Error('转写句子格式无效');
  return items.map((it, index) => {
    const fail = (field) => { throw new Error(`转写第 ${index + 1} 句${field}无效`); };
    if (!it || typeof it !== 'object' || Array.isArray(it)) fail('句子格式');
    if (typeof it.text !== 'string') fail('文字');
    const begin = it.begin_time === undefined ? 0 : it.begin_time;
    const end = it.end_time === undefined ? begin : it.end_time;
    if (!validCount(begin) || !validCount(end) || end < begin) fail('时间');
    if (it.speaker_id != null && (!Number.isInteger(it.speaker_id) || it.speaker_id < 0)) fail('说话人标识');
    return { begin, end, speaker: speakerLabel(it.speaker_id), text: it.text.trim() };
  }).filter((sentence) => sentence.text);
}

const line = (s) => {
  const sec = Math.floor(s.begin / 1000);
  return `[${pad(Math.floor(sec / 60))}:${pad(sec % 60)}] ${s.speaker}：${s.text}`;
};

function render(minutes, speakers, seconds, models) {
  const bullet = (items, fmt) => (items.length ? items.map((i) => `- ${fmt(i)}`) : ['- （无）']);
  return [
    `# ${minutes.title || '会议纪要'}`, '',
    `> 录音 ${Math.round(seconds)} 秒 · ${speakers} 位说话人 · 由 ${models.join(' + ')} 生成，请人工核对`, '',
    minutes.summary || '', '', '## 议题',
    ...bullet(minutes.agenda || [], String), '', '## 决策',
    ...bullet(minutes.decisions || [], (d) => `${d.content || ''}（${d.owner || '未指定'}）`), '', '## 待办',
    ...bullet(minutes.action_items || [], (a) => `[ ] ${a.task || ''} · ${a.owner || '未指定'}${a.due ? ` · ${a.due}` : ''}`), '', '## 待定',
    ...bullet(minutes.open_questions || [], String), '', '## 风险',
    ...bullet(minutes.risks || [], String),
  ].join('\n') + '\n';
}

function validateMinutes(minutes) {
  const text = (value) => typeof value === 'string' && value.trim().length > 0;
  if (!minutes || typeof minutes !== 'object' || Array.isArray(minutes) || !text(minutes.title) || !text(minutes.summary)) throw new Error('纪要为空或缺少有效标题、摘要');
  for (const key of ['agenda', 'decisions', 'action_items', 'open_questions', 'risks']) {
    if (!Array.isArray(minutes[key])) throw new Error(`纪要 ${key} 必须是数组`);
    for (const item of minutes[key]) {
      if (key === 'decisions' || key === 'action_items') {
        if (!item || typeof item !== 'object' || !text(item[key === 'decisions' ? 'content' : 'task']) || (item.owner != null && typeof item.owner !== 'string') || (item.due != null && typeof item.due !== 'string')) throw new Error(`纪要 ${key} 条目无效`);
      } else if (!text(item)) throw new Error(`纪要 ${key} 条目必须是非空文字`);
    }
  }
  return minutes;
}
function wavRate(buffer) {
  const bytes = new Uint8Array(buffer), view = new DataView(buffer);
  for (let i = 12; i + 8 <= bytes.length;) {
    if (String.fromCharCode(...bytes.slice(i, i + 4)) === 'fmt ') return view.getUint32(i + 12, true);
    const size = view.getUint32(i + 4, true);
    i += 8 + size + size % 2;
  }
  throw new Error('录音 WAV 缺少采样率');
}

export default async function run(x) {
  const { c } = x;
  const input = validateInput(x.input);
  if (input && input.kind !== 'audio') throw new Error('录音卡需要录音输入');
  const model = c.LLM_MODEL;
  const audioPath = c.SAMPLE_AUDIO;
  const name = input?.name || audioPath.split('/').pop();
  const metaPath = audioPath.replace(/\.\w+$/, '.json');
  const meta = !input && x.hasAsset(metaPath) ? JSON.parse(await x.assetText(metaPath)) : {};
  const audio = input?.buffer || await x.asset(audioPath);
  let seconds = input?.durationSeconds || (meta.duration_ms || 0) / 1000;
  const format = input?.format || 'mp3';
  const warnings = [];
  const warn = (text) => { warnings.push(text); x.say('提示', text); };
  x.say('设备', `录音卡 · 会议录音 ← ${name}（${seconds ? `${seconds.toFixed(1)} s，` : ''}${Math.floor(audio.byteLength / 1024)} KB）`);
  x.say('设备', '录音结束 → 经手机 App 上传云端');
  const tEnd = x.now();
  x.say('云端', `转写 ${c.ASR_MODEL}（同步 · 说话人分离）……`);
  const t0 = x.now();
  const resp = await x.post('api', '/services/aigc/multimodal-generation/generation', {
    model: c.ASR_MODEL,
    input: { messages: [{ role: 'user', content: [{ type: 'input_audio', input_audio: { data: `data:${input?.mime || 'audio/mpeg'};base64,${toBase64(audio)}` } }] }] },
    parameters: { format, ...(format === 'wav' ? { sample_rate: String(wavRate(audio)) } : {}), speaker_diarization_enabled: true },
  }, { 'X-DashScope-SSE': 'disable' });
  const asrMs = x.now() - t0;
  let output = resp.output || {};
  if (!('sentences' in output) && output.output && typeof output.output === 'object') output = output.output;
  const sentences = toSentences(output.sentences || (output.sentence ? [output.sentence] : []));
  if (!sentences.length) throw new Error('转写结果为空：检查录音是否有人声');
  const speakers = new Set(sentences.map((s) => s.speaker)).size;
  const transcript = sentences.map(line).join('\n');
  const outputs = [{ path: 'out/transcript.txt', media_type: 'text/plain', type: 'text/plain', text: `${transcript}\n` }];
  const lastEnd = Math.max(...sentences.map((s) => Number.isFinite(s.end) ? s.end : 0)) / 1000;
  if (seconds > 0 && seconds - lastEnd > 10) warn('转写可能不完整：最后一句结束时间距离录音结尾超过 10 秒，请核对录音');
  if (resp.usage?.output_tokens >= 1000 || resp.finish_reason === 'length' || output.finish_reason === 'length') warn('转写可能被截断，请核对完整性');
  x.say('云端', `转写完成 · ${sentences.length} 句 · ${speakers} 位说话人 · ${(asrMs / 1000).toFixed(1)} s`, transcript);
  const usage = resp.usage || {};
  const [pin, pout] = c.ASR_PRICES[x.region];
  let asrCost = null;
  let costStatus = 'unknown';
  let estimated = '';
  if (validCount(usage.input_tokens) && validCount(usage.output_tokens)) {
    const exact = (usage.input_tokens * pin + usage.output_tokens * pout) / 1e6;
    asrCost = [exact, exact]; costStatus = 'usage';
  } else {
    const duration = Number.isFinite(usage.duration) && usage.duration > 0 ? usage.duration : seconds;
    if (duration > 0 && Number.isFinite(duration)) {
      asrCost = c.TOKENS_PER_SECOND_RANGE.map((rate) => (duration * rate * pin + transcript.length * pout) / 1e6);
      costStatus = 'estimated';
      estimated = `（转写 Token 用量未完整返回，按每秒 ${c.TOKENS_PER_SECOND_RANGE.join('–')} Token 估算区间）`;
      warn(estimated);
    } else warn('转写 Token 用量和录音时长未知，转写费用未知');
  }
  const models = [c.ASR_MODEL, model];
  try {
    x.say('云端', `纪要 ${model}（流式）……`);
    const card = x.say('App', '纪要生成中……');
    const turn = await x.chat({ model,
      messages: [{ role: 'system', content: c.MINUTES_PROMPT }, { role: 'user', content: transcript }],
      response_format: { type: 'json_object' }, enable_thinking: false,
    }, { onText: (_, all) => card.update({ text: `纪要生成中……已收到 ${all.length} 字` }) });
    if (turn.finish_reason === 'length') warn('纪要可能被截断，请核对完整性');
    const minutes = validateMinutes(parseJson(turn.text, '纪要'));
    seconds = seconds || lastEnd;
    const markdown = render(minutes, speakers, seconds, models);
    card.update({ text: '推送纪要卡片 → out/minutes.md（另存 minutes.json、transcript.txt）', detail: markdown });
    const llmCost = costOf(c.LLM_TIERS[model][x.region], turn.usage);
    const total = asrCost == null || llmCost == null ? null : asrCost.map((value) => value + llmCost);
    if (total == null) costStatus = 'unknown';
    const firstMs = turn.firstTextAt == null ? null : turn.firstTextAt - tEnd;
    x.say('统计', `录音结束 → 纪要首字 ${firstMs == null ? '—' : `${(firstMs / 1000).toFixed(1)} s`} · ${total == null ? '费用未知' : `¥${fmtCny(total)}`}${estimated}`);
    return { models, firstMs, cost: total == null ? null : total[0] === total[1] ? total[0] : total, costStatus,
      metrics: { textFirstMs: firstMs, audioFirstMs: null, audioReadyMs: null, asrMs, totalMs: x.now() - tEnd },
      sample: `${name}（${Math.round(seconds)} s）`, note: `首字=录音结束→纪要首字；转写 ${(asrMs / 1000).toFixed(1)} s（同步）${estimated}`, warnings,
      outputs: [
        { path: 'out/minutes.md', media_type: 'text/markdown', type: 'text/markdown', text: markdown },
        { path: 'out/minutes.json', media_type: 'application/json', type: 'application/json', text: JSON.stringify(minutes, null, 2) },
        ...outputs,
      ],
    };
  } catch (error) {
    error.outputs = outputs;
    error.warnings = warnings;
    throw error;
  }
}
