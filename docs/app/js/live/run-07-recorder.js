// 07 录音卡 · 浏览器真跑：流程对照 solutions/by-category/07-recorder/demo/bailian/run.py（异步文件识别 + 流式纪要）
import { fmtCny } from '../ui.js';
import { costOf, parseJson, validCount } from './client.js';

import { validateInput } from './input.js';
import { validateMinutes, confirmationText } from '../meeting-results.js';
import { audioChannels } from './audio-channels.js';
import { sentenceId, transcriptText, groundedResponseFormat, validateSources, validateTranscript } from '../meeting-evidence.js';
import { STREAM_MODEL } from './realtime-asr.js';

const speakerLabel = (raw) => (raw == null ? '说话人' : `说话人${raw + 1}`);

function toSentences(items, channels) {
  if (!Array.isArray(items)) throw new Error('转写句子格式无效');
  return items.map((it, index) => {
    const fail = (field) => { throw new Error(`转写第 ${index + 1} 句${field}无效`); };
    if (!it || typeof it !== 'object' || Array.isArray(it)) fail('句子格式');
    if (typeof it.text !== 'string') fail('文字');
    const begin = it.begin_time ?? null;
    const end = it.end_time ?? null;
    if ((begin !== null && !validCount(begin)) || (end !== null && !validCount(end)) || (begin !== null && end !== null && end < begin)) fail('时间');
    if (it.speaker_id != null && (!Number.isInteger(it.speaker_id) || it.speaker_id < 0)) fail('说话人标识');
    if (channels === 2 && ![0, 1].includes(it.channel_id)) fail('声道标识');
    return { begin_ms: begin, end_ms: end, speaker: channels === 2 ? `声道${it.channel_id + 1}` : speakerLabel(it.speaker_id), text: it.text.trim() };
  }).filter((sentence) => sentence.text);
}

function render(minutes, speakers, seconds, models) {
  const bullet = (items, fmt) => (items.length ? items.map((i) => `- ${fmt(i)}`) : ['- （无）']);
  return [
    `# ${minutes.title || '会议纪要'}`, '',
    `> ${seconds > 0 ? `录音 ${Math.round(seconds)} 秒` : '实时转写'} · ${speakers == null ? '发言标签未提供' : `${speakers} 个发言标签`} · 由 ${models.join(' + ')} 生成，请人工核对`, '',
    minutes.summary || '', '', '## 议题',
    ...bullet(minutes.agenda || [], String), '', '## 决策',
    ...bullet(minutes.decisions || [], (d) => `${d.content || ''}（${confirmationText(d.owner)}）`), '', '## 待办',
    ...bullet(minutes.action_items || [], (a) => `[ ] ${a.task || ''} · ${confirmationText(a.owner)} · ${confirmationText(a.due)}`), '', '## 待定',
    ...bullet(minutes.open_questions || [], String), '', '## 风险',
    ...bullet(minutes.risks || [], String),
  ].join('\n') + '\n';
}

export default async function run(x) {
  const { c } = x;
  if (x.transcript) {
    const source = validateTranscript(x.transcript);
    return summarize(x, {source, models:[STREAM_MODEL,c.LLM_MODEL], seconds:0, speakers:null, asrMs:null, asrCost:null, costStatus:'unknown', tEnd:x.now(), warnings:['实时 ASR 账单用量未核实，本次总费用未知；请在百炼账单核对。'], name:'实时录音确认转写'});
  }
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
  const channels = audioChannels(audio, format);
  if (![1, 2].includes(channels)) throw new Error('当前只支持单声道或双声道录音');
  const warnings = [];
  const warn = (text) => { warnings.push(text); x.say('提示', text); };
  x.say('设备', `录音卡 · 会议录音 ← ${name}（${seconds ? `${seconds.toFixed(1)} s，` : ''}${Math.floor(audio.byteLength / 1024)} KB）`);
  x.say('设备', '录音结束 → 浏览器上传百炼临时存储（48 小时有效，不用于生产环境）');
  if (channels > 1) warn('双声道分别转写、分别计费，按声道标注；声道不等于说话人。');
  const tEnd = x.now();
  x.say('云端', `转写 ${c.ASR_FILE_MODEL}（文件识别 · ${channels === 1 ? '尝试说话人分离' : '双声道'}）……`);
  const t0 = x.now();
  const resp = await x.transcribeFile({ buffer: audio, mime: input?.mime || 'audio/mpeg', format });
  const asrMs = x.now() - t0;
  let output = resp.output || {};
  if (!('sentences' in output) && output.output && typeof output.output === 'object') output = output.output;
  const sentences = toSentences(output.sentences || (output.sentence ? [output.sentence] : []), channels);
  if (!sentences.length) throw new Error('转写结果为空：检查录音是否有人声');
  const speakers = new Set(sentences.map((s) => s.speaker)).size;
  const source = { schema: 'aihw/transcript@0.1', sentences: sentences.map((s, i) => ({ id: sentenceId(i), ...s })) };
  const transcript = transcriptText(source);
  const ends = sentences.filter(s => s.end_ms != null).map(s => s.end_ms);
  const lastEnd = ends.length === sentences.length ? Math.max(...ends) / 1000 : null;
  if (seconds > 0 && lastEnd !== null && seconds - lastEnd > 10) warn('转写可能不完整：最后一句结束时间距离录音结尾超过 10 秒，请核对录音');
  if (lastEnd === null) warn('转写未提供结束时间，无法判断尾句是否完整，请核对录音');
  if (resp.finish_reason === 'length' || output.finish_reason === 'length') warn('转写可能被截断，请核对完整性');
  x.say('云端', `转写完成 · ${sentences.length} 句 · ${speakers} 个发言标签 · ${(asrMs / 1000).toFixed(1)} s`, transcript);
  const usage = resp.usage || {};
  const [pin, pout] = c.ASR_PRICES[x.region];
  let asrCost = null;
  let costStatus = 'unknown';
  if (validCount(usage.input_tokens) && validCount(usage.output_tokens)) {
    asrCost = (usage.input_tokens * pin + usage.output_tokens * pout) / 1e6;
    costStatus = 'usage';
  } else {
    warn('转写 Token 用量未完整返回，转写费用和本次总费用未知；录音时长不能换算为实际 Token 用量。');
  }
  const models = [c.ASR_FILE_MODEL, model];
  seconds = seconds || lastEnd || 0;
  return summarize(x, {source,models,seconds,speakers,asrMs,asrCost,costStatus,tEnd,warnings,name});
}

async function summarize(x, {source, models, seconds, speakers, asrMs, asrCost, costStatus, tEnd, warnings, name}) {
  const {c} = x, model = c.LLM_MODEL;
  const warn = text => {warnings.push(text);x.say('提示',text);};
  const transcript = transcriptText(source);
  const outputs = [{path:'out/transcript.txt',media_type:'text/plain',type:'text/plain',text:transcript+'\n'}, {path:'out/transcript.json',media_type:'application/json',type:'application/json',text:JSON.stringify(source,null,2)}];
  try {
    x.say('云端', `纪要 ${model}（流式）……`);
    const card = x.say('App', '纪要生成中……');
    const turn = await x.chat({ model,
      messages: [{ role: 'system', content: c.MINUTES_PROMPT }, { role: 'user', content: transcriptText(source, { ids: true }) }],
      response_format: groundedResponseFormat(c.MINUTES_SCHEMA, source), enable_thinking: false,
    }, { allowNetworkFallback: false, onText: (_, all) => card.update({ text: `纪要生成中……已收到 ${all.length} 字` }) });
    if (turn.finish_reason === 'length') warn('纪要可能被截断，请核对完整性');
    const minutes = validateSources(validateMinutes(parseJson(turn.text, '纪要')), source);
    const markdown = render(minutes, speakers, seconds, models);
    card.update({ text: '推送纪要卡片 → out/minutes.md（另存 minutes.json、transcript.txt）', detail: markdown });
    const llmCost = costOf(c.LLM_TIERS[model][x.region], turn.usage);
    const total = asrCost == null || llmCost == null ? null : asrCost + llmCost;
    if (total == null) costStatus = 'unknown';
    const firstMs = turn.firstTextAt == null ? null : turn.firstTextAt - tEnd;
    x.say('统计', `录音结束 → 纪要首字 ${firstMs == null ? '—' : `${(firstMs / 1000).toFixed(1)} s`} · ${total == null ? '费用未知' : `¥${fmtCny(total)}`}`);
    return { models, firstMs, cost: total, costStatus,
      metrics: { textFirstMs: firstMs, audioFirstMs: null, audioReadyMs: null, asrMs, totalMs: x.now() - tEnd },
      sample: seconds ? `${name}（${Math.round(seconds)} s）` : name, note: asrMs == null ? '已确认的实时转写生成纪要；转写费用未知。' : `首字=录音结束→纪要首字，包含上传、排队与转写；转写 ${(asrMs / 1000).toFixed(1)} s（文件识别）`, warnings,
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
