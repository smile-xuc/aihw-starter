import { html } from './ui.js';

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
    return {
      title:value.title.trim(), summary:value.summary.trim(),
      agenda:value.agenda.map(item=>item.trim()),
      decisions:value.decisions.map(item=>({content:item.content.trim(),owner:confirmationText(item.owner)})),
      action_items:value.action_items.map(item=>({task:item.task.trim(),owner:confirmationText(item.owner),due:confirmationText(item.due)})),
      open_questions:value.open_questions.map(item=>item.trim()), risks:value.risks.map(item=>item.trim()),
    };
  } catch { return null; }
}

// Copy/export is plain text. Relative deadlines remain exactly as transcribed;
// a recording date is not available, so we never invent a calendar date.
export function meetingSectionText(minutes, key) {
  if (!Object.hasOwn(titles, key)) return '';
  if (key === 'summary') return minutes.summary;
  if (!minutes[key].length) return emptyText[key];
  if (key === 'decisions') return minutes.decisions.map(item=>`- ${item.content}\n  负责人：${item.owner}`).join('\n');
  if (key === 'action_items') return minutes.action_items.map(item=>`- [ ] ${item.task}\n  负责人：${item.owner} · 截止日期：${item.due}`).join('\n');
  return minutes[key].map(item=>`- ${item}`).join('\n');
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
        <dl class="meeting-assignment"><div><dt>负责人</dt><dd class="${item.owner === '待确认' ? 'is-unconfirmed' : ''}">${item.owner}</dd></div>${key === 'action_items' ? html`<div><dt>截止日期</dt><dd class="${item.due === '待确认' ? 'is-unconfirmed' : ''}">${item.due}</dd></div>` : ''}</dl></div>` : html`<p>${item}</p>`}
      </li>`)}</ul>`}
    </section>`;
}

export function meetingMarkup(minutes) {
  return html`<div class="meeting-result">
    <div class="meeting-heading"><span class="eyebrow">会议纪要</span><h3>${minutes.title}</h3><p class="small">根据转写整理，请核对原始录音。未明确的负责人、截止日期标为“待确认”；相对日期保留原文。</p></div>
    ${section(minutes,'summary')}${section(minutes,'decisions')}${section(minutes,'action_items')}
    <details class="meeting-more"><summary>议题、待确认与风险<span class="small">${minutes.agenda.length + minutes.open_questions.length + minutes.risks.length} 项</span></summary>
      ${section(minutes,'agenda')}${section(minutes,'open_questions')}${section(minutes,'risks')}</details>
    </div>`;
}
