// Evidence is transcription text, not a claim that the ASR or summary is correct.
const object = value => value && typeof value === 'object' && !Array.isArray(value);
const string = value => typeof value === 'string' && value.trim();
const time = value => value === null || (Number.isFinite(value) && value >= 0);
export const sentenceId = index => `s${String(index + 1).padStart(3, '0')}`;

export function validateTranscript(value) {
  if (!object(value) || value.schema !== 'aihw/transcript@0.1' || !Array.isArray(value.sentences) || !value.sentences.length) throw Error('转写来源格式无效');
  const ids = new Set();
  for (const s of value.sentences) {
    if (!object(s) || typeof s.id !== 'string' || !/^s\d{3,}$/.test(s.id) || ids.has(s.id) || !string(s.text) || !string(s.speaker) || !time(s.begin_ms) || !time(s.end_ms) || (s.begin_ms != null && s.end_ms != null && s.end_ms < s.begin_ms)) throw Error('转写来源句子无效');
    ids.add(s.id);
  }
  return value;
}

export function readTranscript(trace) {
  if (trace?.solution !== '07-recorder.bailian') return null;
  const file = trace.outputs?.find(f => f.path === 'out/transcript.json' && typeof f.text === 'string');
  try { return file ? validateTranscript(JSON.parse(file.text)) : null; } catch { return null; }
}

export function timestamp(ms) {
  if (ms == null) return '时间未提供';
  const sec = Math.floor(ms / 1000);
  return `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;
}

export function transcriptText(value, { ids = false } = {}) {
  return value.sentences.map(s => `${ids ? `[${s.id}] ` : ''}[${timestamp(s.begin_ms)}] ${s.speaker}：${s.text}`).join('\n');
}

export function groundedResponseFormat(schema, transcript) {
  const result = structuredClone(schema);
  for (const key of ['decisions', 'action_items']) result.properties[key].items.properties.source_ids.items.enum = transcript.sentences.map(s => s.id);
  return { type: 'json_schema', json_schema: { name: 'meeting_minutes', strict: true, schema: result } };
}

export function validateSources(minutes, transcript) {
  const ids = new Set(validateTranscript(transcript).sentences.map(s => s.id));
  for (const key of ['decisions', 'action_items']) for (const item of minutes[key]) {
    if (!Array.isArray(item.source_ids) || item.source_ids.some(id => !ids.has(id)) || new Set(item.source_ids).size !== item.source_ids.length) throw Error('纪要来源编号无效；转写已保留，请核对后手动重试');
  }
  return minutes;
}

const fieldsFor = section => section === 'decisions' ? ['owner'] : section === 'action_items' ? ['owner', 'due'] : [];
const editValue = value => typeof value === 'string' && value.length <= 200;

export function readMeetingEdits(trace, minutes) {
  const file = trace.outputs?.find(f => f.path === 'out/minutes-edits.json' && typeof f.text === 'string');
  if (!file) return [];
  try {
    const value = JSON.parse(file.text), seen = new Set();
    if (!object(value) || value.schema !== 'aihw/minutes-edits@0.1' || !Array.isArray(value.edits)) return [];
    for (const e of value.edits) {
      const original = minutes[e.section]?.[e.index]?.[e.field] ?? '';
      const id = `${e.section}:${e.index}:${e.field}`;
      if (!object(e) || !fieldsFor(e.section).includes(e.field) || !Number.isInteger(e.index) || e.index < 0 || !minutes[e.section]?.[e.index] || !editValue(e.value) || e.original !== original || seen.has(id) || typeof e.edited_at !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(e.edited_at) || !Number.isFinite(Date.parse(e.edited_at))) return [];
      seen.add(id);
    }
    return value.edits;
  } catch { return []; }
}

// The original minutes.json stays intact. Corrections are a separate text file
// within the existing trace outputs, preserving both provenance and old readers.
export function editMeetingTrace(trace, section, index, changes, { restore = false, now = new Date().toISOString() } = {}) {
  if (trace.solution !== '07-recorder.bailian' || !fieldsFor(section).length || !Number.isInteger(index) || index < 0) throw Error('无法修正这条纪要');
  const originalFile = trace.outputs?.find(f => f.path === 'out/minutes.json');
  const minutes = JSON.parse(originalFile?.text || 'null');
  if (!object(minutes?.[section]?.[index])) throw Error('这条纪要已不存在');
  const item = minutes[section][index], fields = fieldsFor(section);
  if (!restore && (!object(changes) || Object.keys(changes).some(field => !fields.includes(field)) || fields.some(field => !editValue(changes[field])))) throw Error('负责人和截止日期各不超过 200 字符');
  let edits = readMeetingEdits(trace, minutes).filter(e => !(e.section === section && e.index === index));
  if (!restore) for (const field of fields) {
    const value = changes[field].trim(), original = item[field] ?? '';
    if (value !== original) edits.push({ section, index, field, original, value, edited_at: now });
  }
  const result = structuredClone(trace);
  result.outputs = result.outputs.filter(f => f.path !== 'out/minutes-edits.json');
  if (edits.length) {
    const text = JSON.stringify({ schema: 'aihw/minutes-edits@0.1', edits }, null, 2);
    result.outputs.push({ path: 'out/minutes-edits.json', media_type: 'application/json', text, asset: null, bytes: new TextEncoder().encode(text).length });
  }
  return result;
}
