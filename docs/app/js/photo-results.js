import { html } from './ui.js';

function validate(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || typeof value.answer !== 'string' || !value.answer.trim() || !Array.isArray(value.uncertainties) || value.uncertainties.some(item => typeof item !== 'string' || !item.trim())) throw new Error('照片回答格式不完整，请调整提问后手动重试');
  return {answer:value.answer.trim(),uncertainties:value.uncertainties.map(item=>item.trim())};
}

export function parsePhotoAnswer(text) {
  const raw = String(text).trim();
  if (!raw) throw new Error('看图回答为空：请重新提问');
  const clean = raw.replace(/^```(?:json)?\s*|\s*```$/g, '');
  let value;
  try { value = JSON.parse(clean); }
  catch {
    if (/^[{\[]/.test(clean) || /^```json\b/.test(raw)) throw new Error('照片回答格式不完整，请调整提问后手动重试');
    return {answer:raw,uncertainties:null};
  }
  // A legacy OCR response can be a bare number or quoted word. It supplies no
  // uncertainty metadata; explicit JSON objects must still satisfy the shape.
  if(value !== null && typeof value !== 'object' && !/^```json\b/.test(raw))return {answer:raw,uncertainties:null};
  return validate(value);
}

export function readPhotoResult(trace, output) {
  if (trace?.solution !== '02-ai-glasses.bailian' || trace.variant !== 'default') return null;
  const file = (trace.outputs || []).find(file=>file.path === 'out/answer.json' && typeof file.text === 'string');
  if (file) {try {return validate(JSON.parse(file.text));} catch { /* Older text output remains accessible. */ }}
  return output?.path === 'out/answer.txt' && typeof output.text === 'string' && output.text.trim() ? {answer:output.text.trim(),uncertainties:null} : null;
}

export function photoUncertaintyText(result) {
  if (result.uncertainties === null) return '这份记录未单独提供不确定项，请结合照片核对；不能据此判断所有内容都已看清。';
  return result.uncertainties.length ? result.uncertainties.map(item=>`- ${item}`).join('\n') : '模型未列出不确定项，仍需结合照片核对。';
}

export function photoResultText(result) {
  return `回答\n${result.answer}\n\n看不清 / 无法确定\n${photoUncertaintyText(result)}\n`;
}

export function photoSpeechText(result) {
  return result.uncertainties?.length ? `${result.answer} 另外，无法确定的内容有：${result.uncertainties.join('；')}` : result.answer;
}

export function photoMarkup(result) {
  return html`<div class="photo-result"><section class="photo-answer" aria-label="回答"><h3>回答</h3><p>${result.answer}</p></section>
    <section class="photo-uncertainties" aria-label="看不清或无法确定"><h3>看不清 / 无法确定</h3>
      ${result.uncertainties?.length ? html`<ul>${result.uncertainties.map(item=>html`<li>${item}</li>`)}</ul>` : html`<p class="small">${photoUncertaintyText(result)}</p>`}
      <p class="small">以上由模型报告，请核对照片；提取文字或翻译时，建议补拍清晰的局部。</p></section></div>`;
}
