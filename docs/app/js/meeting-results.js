import { html } from './ui.js';
import { readTranscript, readMeetingEdits, timestamp } from './meeting-evidence.js';

const text = value => typeof value === 'string' && value.trim().length > 0;
const collectionKeys = ['agenda', 'decisions', 'action_items', 'open_questions', 'risks'];
const titles = {summary:'摘要',decisions:'决策',action_items:'待办',agenda:'议题',open_questions:'待确认',risks:'风险'};
const emptyText = {decisions:'转写中未提取到明确决策。',action_items:'转写中未提取到明确待办。',agenda:'未提取到独立议题。',open_questions:'未提取到待确认事项。',risks:'未提取到明确风险。'};

// Shared by the runner and the presentation layer. Reject a malformed section as
// a whole: silently dropping an invalid action could hide work from the reader.
export function validateMinutes(minutes) {
  if (!minutes || typeof minutes !== 'object' || Array.isArray(minutes) || !text(minutes.title) || !text(minutes.summary)) throw new Error('纪要为空或缺少有效标题、摘要');
  for (const key of collectionKeys) {
    if (!Array.isArray(minutes[key])) throw new Error(`纪要 ${key} 必须是数组`);
    for (const item of minutes[key]) {
      if (key === 'decisions' || key === 'action_items') {
        if (!item || typeof item !== 'object' || Array.isArray(item) || !text(item[key === 'decisions' ? 'content' : 'task']) || (item.owner != null && typeof item.owner !== 'string') || (item.due != null && typeof item.due !== 'string')) throw new Error(`纪要 ${key} 条目无效`);
        if (item.source_ids !== undefined && (!Array.isArray(item.source_ids) || item.source_ids.some(id => typeof id !== 'string' || !/^s\d{3,}$/.test(id)) || new Set(item.source_ids).size !== item.source_ids.length)) throw new Error('纪要来源编号无效');
      } else if (!text(item)) throw new Error(`纪要 ${key} 条目必须是非空文字`);
    }
  }
  return minutes;
}

export function confirmationText(value) {
  const clean = typeof value === 'string' ? value.trim() : '';
  return !clean || /^(?:未指定|未提供|未说明|未提及|不明确|不详|未知|待定|待确认|无|暂无|没有|none|null|n\/?a|unknown|unspecified|[-—–])$/i.test(clean) ? '待确认' : clean;
}

export function readMeetingResult(trace) {
  if (trace?.solution !== '07-recorder.bailian') return null;
  const file = (trace.outputs || []).find(file => file.path === 'out/minutes.json' && typeof file.text === 'string');
  if (!file) return null;
  try {
    const value = validateMinutes(JSON.parse(file.text));
    const refs = item => item.source_ids === undefined ? {} : { source_ids: [...item.source_ids] };
    const result = {
      title:value.title.trim(), summary:value.summary.trim(),
      agenda:value.agenda.map(item=>item.trim()),
      decisions:value.decisions.map(item=>({content:item.content.trim(),owner:confirmationText(item.owner),...refs(item)})),
      action_items:value.action_items.map(item=>({task:item.task.trim(),owner:confirmationText(item.owner),due:confirmationText(item.due),...refs(item)})),
      open_questions:value.open_questions.map(item=>item.trim()), risks:value.risks.map(item=>item.trim()),
    };
    const transcript = readTranscript(trace);
    if (transcript) result.transcript = transcript;
    for (const edit of readMeetingEdits(trace, value)) {
      const item = result[edit.section][edit.index];
      item[edit.field] = confirmationText(edit.value);
      (item.corrections ||= {})[edit.field] = { original: confirmationText(edit.original), value: item[edit.field], edited_at: edit.edited_at };
    }
    return result;
  } catch { return null; }
}

// Copy/export is plain text. Relative deadlines remain exactly as transcribed;
// a recording date is not available, so we never invent a calendar date.
export function meetingSectionText(minutes, key) {
  if (!Object.hasOwn(titles, key)) return '';
  if (key === 'summary') return minutes.summary;
  if (!minutes[key].length) return emptyText[key];
  if (key === 'decisions') return minutes.decisions.map(item=>`- ${item.content}\n  负责人：${item.owner}${extraText(minutes,item)}`).join('\n');
  if (key === 'action_items') return minutes.action_items.map(item=>`- [ ] ${item.task}\n  负责人：${item.owner} · 截止日期：${item.due}${extraText(minutes,item)}`).join('\n');
  return minutes[key].map(item=>`- ${item}`).join('\n');
}

const linkedSources = (minutes, item) => (item.source_ids || []).map(id => minutes.transcript?.sentences.find(s => s.id === id)).filter(Boolean);
function extraText(minutes, item) {
  const edits = Object.entries(item.corrections || {}).map(([field,e]) => `\n  ${field === 'owner' ? '负责人' : '截止日期'}由用户修正（AI 原值：${e.original}）`);
  const sources = linkedSources(minutes, item);
  const evidence = item.source_ids === undefined ? '' : sources.length ? `\n  来源原句（模型关联，请核对）：${sources.map(s => `[${s.id}] [${timestamp(s.begin_ms)}] ${s.speaker}：${s.text}`).join('\n  ')}${sources.length !== item.source_ids.length ? '\n  部分关联原句不可用，请核对。' : ''}` : '\n  来源原句：未关联或暂不可用，请核对';
  return edits.join('') + evidence;
}

function sourceMarkup(minutes, item) {
  const sources = linkedSources(minutes, item);
  return html`<div class="meeting-sources">${sources.length ? html`<span class="small">来源原句 · 模型关联，请核对</span><div>${sources.map(s => html`<button type="button" class="meeting-source" data-meeting-source="${s.id}" aria-label="查看原句 ${s.id} ${timestamp(s.begin_ms)} ${s.speaker}">${timestamp(s.begin_ms)} · ${s.speaker}<span>查看原句</span></button>`)}</div>${sources.length !== item.source_ids.length ? html`<p class="small">部分关联原句不可用，请核对。</p>` : ''}` : html`<p class="small">${item.source_ids === undefined ? '旧记录未提供原句关联。' : '尚无可查看的关联原句，请核对转写。'}</p>`}</div>`;
}

function correctionMarkup(item, field) {
  const edit = item.corrections?.[field];
  return edit ? html`<small class="meeting-correction">用户修正 · AI 原值：${edit.original}</small>` : '';
}

export function meetingMarkdown(minutes) {
  return [`# ${minutes.title}`, '> 根据转写整理，请核对原始录音。未明确的负责人、截止日期标为待确认；相对日期保留原文。', ...Object.keys(titles).map(key=>`## ${titles[key]}\n\n${meetingSectionText(minutes,key)}`)].join('\n\n') + '\n';
}

function section(minutes, key) {
  const count = key === 'summary' ? null : minutes[key].length;
  const items = minutes[key];
  return html`<section class="meeting-section meeting-${key}" aria-label="${titles[key]}">
    <div class="meeting-section-head"><h4>${titles[key]}${count == null ? '' : html`<span class="meeting-count">${count}</span>`}</h4>
      <button type="button" class="meeting-copy" data-meeting-copy="${key}" aria-label="复制${titles[key]}">复制${titles[key]}</button></div>
    ${key === 'summary' ? html`<p class="meeting-summary-text">${minutes.summary}</p>` : !count ? html`<p class="meeting-empty">${emptyText[key]}</p>` : html`<ul class="meeting-items">${items.map((item,index)=>html`<li>
      ${key === 'decisions' || key === 'action_items' ? html`<span class="meeting-item-number" aria-hidden="true">${String(index+1).padStart(2,'0')}</span><div class="meeting-item-body"><p>${key === 'decisions' ? item.content : item.task}</p>
        <dl class="meeting-assignment"><div><dt>负责人</dt><dd class="${item.owner === '待确认' ? 'is-unconfirmed' : ''}">${item.owner}</dd>${correctionMarkup(item,'owner')}</div>${key === 'action_items' ? html`<div><dt>截止日期</dt><dd class="${item.due === '待确认' ? 'is-unconfirmed' : ''}">${item.due}</dd>${correctionMarkup(item,'due')}</div>` : ''}</dl>
        ${sourceMarkup(minutes,item)}
        <div class="meeting-edit-actions"><button type="button" class="meeting-edit" data-meeting-edit="${key}:${index}" aria-expanded="false">修正信息</button>${item.corrections ? html`<button type="button" class="meeting-edit" data-meeting-restore="${key}:${index}">恢复 AI 原值</button>` : ''}</div>
        <form class="meeting-edit-form" data-meeting-edit-form="${key}:${index}" hidden><p class="small">修正由你填写，会保留 AI 原值；不会再次调用模型。日期按你的输入保存。</p>
          <label class="field"><span>负责人</span><input name="owner" maxlength="200" value="${item.owner === '待确认' ? '' : item.owner}" autocomplete="off" placeholder="未明确可留空"></label>
          ${key === 'action_items' ? html`<label class="field"><span>截止日期</span><input name="due" maxlength="200" value="${item.due === '待确认' ? '' : item.due}" autocomplete="off" placeholder="例如：周五前；未明确可留空"></label>` : ''}
          <div class="btn-row"><button type="submit" class="primary-action">保存修正</button><button type="button" class="secondary-action" data-meeting-edit-cancel>取消</button></div><p class="small" data-meeting-edit-error role="alert"></p></form>
        </div>` : html`<p>${item}</p>`}
      </li>`)}</ul>`}
    </section>`;
}

export function meetingMarkup(minutes) {
  return html`<div class="meeting-result">
    <div class="meeting-heading"><span class="eyebrow">会议纪要</span><h3>${minutes.title}</h3><p class="small">根据转写整理，请核对原始录音。未明确的负责人、截止日期标为“待确认”；相对日期保留原文。原句关联由模型生成，可展开核对。</p></div>
    ${section(minutes,'summary')}${section(minutes,'decisions')}${section(minutes,'action_items')}
    <details class="meeting-more"><summary>议题、待确认与风险<span class="small">${minutes.agenda.length + minutes.open_questions.length + minutes.risks.length} 项</span></summary>
      ${section(minutes,'agenda')}${section(minutes,'open_questions')}${section(minutes,'risks')}</details>
    </div>`;
}
