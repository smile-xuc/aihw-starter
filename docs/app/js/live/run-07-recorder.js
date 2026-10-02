// 07 录音卡 · 浏览器真跑：流程对照 solutions/by-category/07-recorder/demo/bailian/run.py（同步转写 + 流式纪要）
import { fmtCny } from '../ui.js';
import { costOf, parseJson, toBase64 } from './bailian.js';

const pad = (n) => String(n).padStart(2, '0');
const speakerLabel = (raw) => (raw == null ? '说话人' : `说话人${Number(raw) + 1}`);

function toSentences(items) {
  return items
    .map((it) => ({ begin: Number(it.begin_time || 0), end: Number(it.end_time || 0), speaker: speakerLabel(it.speaker_id), text: String(it.text || '').trim() }))
    .filter((s) => s.text);
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

export default async function run(x) {
  const { c } = x;
  const model = c.LLM_MODEL;
  const audioPath = c.SAMPLE_AUDIO;
  const name = audioPath.split('/').pop();
  const meta = JSON.parse(await x.assetText(audioPath.replace(/\.\w+$/, '.json')));
  const audio = await x.asset(audioPath);
  let seconds = (meta.duration_ms || 0) / 1000;
  x.say('设备', `录音卡 · 会议录音 ← ${name}（${seconds.toFixed(1)} s，${Math.floor(audio.byteLength / 1024)} KB）`);
  x.say('设备', '录音结束 → 经手机 App 上传云端');
  const tEnd = x.now();

  x.say('云端', `转写 ${c.ASR_MODEL}（同步 · 说话人分离）……`);
  const t0 = x.now();
  const resp = await x.post('api', '/services/aigc/multimodal-generation/generation', {
    model: c.ASR_MODEL,
    input: { messages: [{ role: 'user', content: [{ type: 'input_audio', input_audio: { data: `data:audio/mpeg;base64,${toBase64(audio)}` } }] }] },
    parameters: { format: 'mp3', speaker_diarization_enabled: true },
  }, { 'X-DashScope-SSE': 'disable' });
  const asrMs = x.now() - t0;
  let output = resp.output || {};
  if (!('sentences' in output) && output.output && typeof output.output === 'object') output = output.output;
  const items = output.sentences || (output.sentence ? [output.sentence] : []);
  const usage = resp.usage || {};
  const asrTokens = [Number(usage.input_tokens || 0), Number(usage.output_tokens || 0)];
  const [pin, pout] = c.ASR_PRICES[x.region];
  let asrCost;
  let estimated = '';
  if (asrTokens[0] || asrTokens[1]) {
    const exact = (asrTokens[0] * pin + asrTokens[1] * pout) / 1e6;
    asrCost = [exact, exact];
  } else {
    const dur = Number(usage.duration || 0);
    const chars = String(output.text || '').length;
    asrCost = c.TOKENS_PER_SECOND_RANGE.map((rate) => (dur * rate * pin) / 1e6 + (chars * pout) / 1e6);
    estimated = `（接口未返回转写 Token 数，按每秒 ${c.TOKENS_PER_SECOND_RANGE.join('–')} Token 给区间）`;
  }
  const sentences = toSentences(items);
  if (!sentences.length) throw new Error('转写结果为空：检查录音是否有人声');
  const speakers = new Set(sentences.map((s) => s.speaker)).size;
  const transcript = sentences.map(line).join('\n');
  x.say('云端', `转写完成 · ${sentences.length} 句 · ${speakers} 位说话人 · ${(asrMs / 1000).toFixed(1)} s`, transcript);

  x.say('云端', `纪要 ${model}（流式）……`);
  const card = x.say('App', '纪要生成中……');
  const turn = await x.chat({
    model,
    messages: [{ role: 'system', content: c.MINUTES_PROMPT }, { role: 'user', content: transcript }],
    response_format: { type: 'json_object' },
    enable_thinking: false,
  }, { onText: (_, all) => card.update({ text: `纪要生成中……已收到 ${all.length} 字` }) });
  const minutes = parseJson(turn.text, '纪要');
  const models = [c.ASR_MODEL, model];
  seconds = seconds || sentences[sentences.length - 1].end / 1000;
  const markdown = render(minutes, speakers, seconds, models);
  card.update({ text: '推送纪要卡片 → out/minutes.md（另存 minutes.json、transcript.txt）', detail: markdown });

  const llmCost = costOf(c.LLM_TIERS[model][x.region], turn.usage);
  const total = [asrCost[0] + llmCost, asrCost[1] + llmCost];
  const firstMs = turn.firstTextAt == null ? null : turn.firstTextAt - tEnd;
  x.say('统计', `录音结束 → 纪要首字 ${firstMs == null ? '—' : `${(firstMs / 1000).toFixed(1)} s`} · ¥${fmtCny(total)}`
    + `（转写 ¥${fmtCny(asrCost)} + 纪要 ¥${fmtCny(llmCost)}）${estimated}`);
  return {
    models,
    firstMs,
    cost: total[0] === total[1] ? total[0] : total,
    sample: `${name}（${Math.round(seconds)} s）`,
    note: `首字=录音结束→纪要首字；转写 ${(asrMs / 1000).toFixed(1)} s（同步）${estimated}`,
    outputs: [
      { path: 'out/minutes.md', type: 'text/markdown', text: markdown },
      { path: 'out/minutes.json', type: 'application/json', text: JSON.stringify(minutes, null, 2) },
      { path: 'out/transcript.txt', type: 'text/plain', text: `${transcript}\n` },
    ],
  };
}
