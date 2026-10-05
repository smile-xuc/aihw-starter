import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateMinutes, readMeetingResult, meetingMarkup, meetingSectionText, meetingMarkdown } from '../js/meeting-results.js';
import { browserTrace, renderOutcome, safeTrace } from '../js/experience.js';
import { readHistory, saveHistory } from '../js/history.js';

const sample = JSON.parse(readFileSync(new URL('../data/traces/07-recorder.bailian/default.json', import.meta.url)));
const minutes = {
  title:'发布准备讨论', summary:'本周只讨论准备工作，发布时间还未确定。',
  agenda:['发布准备'], decisions:[],
  action_items:[{task:'整理需要确认的问题',owner:'',due:null},{task:'补充测试记录',owner:'陈工',due:'下周二'}],
  open_questions:['具体发布日期下次再确认'], risks:[],
};
const traceFor = value => ({...sample,outputs:[{path:'out/minutes.json',media_type:'application/json',text:JSON.stringify(value)}]});
const slot = () => ({innerHTML:'',querySelector(){return null;}});
const memoryStore = () => {const values = new Map();return {getItem:key=>values.get(key),setItem:(key,value)=>values.set(key,value)};};

test('meeting sample separates decisions, actions, open questions and risks without inventing dates', () => {
  const result = readMeetingResult(sample);
  assert.equal(result.decisions.length,2);
  assert.equal(result.action_items.length,2);
  assert.equal(result.open_questions.length,1);
  assert.equal(result.risks.length,1);
  assert.match(meetingSectionText(result,'summary'),/星云科技/);
  assert.match(meetingSectionText(result,'action_items'),/截止日期：周五前/);
  assert.ok(!meetingSectionText(result,'action_items').includes('德语包装'));
  assert.ok(!meetingSectionText(result,'decisions').includes('准备星云科技报价单'));
  assert.equal(meetingSectionText(result,'missing'),'');
});

test('an unresolved discussion stays unresolved and absent owner/date remain pending in UI and copies', () => {
  const result = readMeetingResult(traceFor(minutes));
  assert.deepEqual(result.action_items[0],{task:'整理需要确认的问题',owner:'待确认',due:'待确认'});
  assert.deepEqual(result.action_items[1],minutes.action_items[1]);
  assert.equal(result.decisions.length,0);
  const section = meetingSectionText(result,'action_items');
  assert.match(section,/负责人：待确认 · 截止日期：待确认/);
  assert.match(section,/负责人：陈工 · 截止日期：下周二/);
  assert.ok(!section.includes('发布时间'));
  assert.match(meetingMarkdown(result),/转写中未提取到明确决策/);
  assert.match(String(meetingMarkup(result)),/class="is-unconfirmed">待确认/);
  assert.deepEqual(minutes.action_items[0],{task:'整理需要确认的问题',owner:'',due:null});
});

test('legacy placeholder fields are normalized without changing explicit assignments', () => {
  const value = structuredClone(minutes);
  value.decisions=[{content:'先完成测试',owner:'未指定'}];
  value.action_items=[{task:'补充资料',owner:' N/A ',due:'未提及'},{task:'回归测试',owner:'说话人2',due:'明早 10 点'}];
  const result = readMeetingResult(traceFor(value));
  assert.equal(result.decisions[0].owner,'待确认');
  assert.deepEqual(result.action_items[0],{task:'补充资料',owner:'待确认',due:'待确认'});
  assert.deepEqual(result.action_items[1],value.action_items[1]);
});

test('malformed or unrelated structured outputs do not partially hide an invalid task', () => {
  for (const value of [null,[],{...minutes,title:''},{...minutes,action_items:[{task:'',owner:'陈工'}]},{...minutes,decisions:'已决定'},{...minutes,action_items:[{task:'测试',due:20261004}]},{...minutes,risks:[{}]}]) {
    assert.throws(()=>validateMinutes(value));
    assert.equal(readMeetingResult(traceFor(value)),null);
  }
  assert.equal(readMeetingResult({...traceFor(minutes),solution:'02-ai-glasses.bailian'}),null);
  assert.equal(readMeetingResult({...sample,outputs:[{path:'out/minutes.json',text:'{"title":'}]}),null);
});

test('structured content is escaped as text, including titles, tasks and assignments', () => {
  const value = {...minutes,title:'<img src=x onerror=alert(1)>',summary:'<script>alert(2)</script>',action_items:[{task:'<svg onload=alert(3)>',owner:'<b>名字</b>',due:'<a href=javascript:alert(4)>日期</a>'}]};
  const rendered = String(meetingMarkup(readMeetingResult(traceFor(value))));
  assert.ok(!/<(?:img|script|svg|b|a)\b/.test(rendered));
  assert.match(rendered,/&lt;script&gt;/);
  assert.match(rendered,/&lt;svg onload=alert\(3\)&gt;/);
  assert.match(rendered,/&lt;b&gt;名字&lt;\/b&gt;/);
});

test('structured history reopens with the same sections while the trace contract stays unchanged', () => {
  const store = memoryStore(),original = traceFor(minutes);
  assert.equal(saveHistory(original,store).saved,true);
  const reopened = readHistory(store).records[0].trace;
  assert.deepEqual(readMeetingResult(reopened),readMeetingResult(original));
  const host = slot();renderOutcome(host,reopened);
  for (const key of ['summary','decisions','action_items','agenda','open_questions','risks']) assert.ok(host.innerHTML.includes(`data-meeting-copy="${key}"`));
  assert.ok(!Object.hasOwn(reopened,'minutes'));
  assert.equal(JSON.parse(reopened.outputs[0].text).action_items[0].owner,'');
});

test('old Markdown-only history remains readable and escapes model HTML', () => {
  const trace = {...sample,outputs:[{path:'out/minutes.md',media_type:'text/markdown',text:'# 旧会议\n\n<script>alert(1)</script>\n\n- 保留原记录'}]};
  const host = slot();renderOutcome(host,trace);
  assert.match(host.innerHTML,/<h1>旧会议<\/h1>/);
  assert.match(host.innerHTML,/&lt;script&gt;/);
  assert.ok(!host.innerHTML.includes('data-meeting-copy'));
  assert.ok(host.innerHTML.includes('data-result-copy'));
});

test('summary failure or stop keeps the entire transcript visible and copyable after history reopen', () => {
  for (const name of ['Error','AbortError']) {
    const error = Object.assign(new Error('总结没有完成'),{name,outputs:[{path:'out/transcript.txt',media_type:'text/plain',text:'[00:00] 说话人1：先确认排期。\n[00:09] 说话人2：日期还没决定。\n'}]});
    const trace = browserTrace({sol:{id:'07-recorder.bailian',title:'会议纪要',models:[]},variant:{id:'default'},error});
    const store = memoryStore();saveHistory(trace,store);
    const reopened = readHistory(store).records[0].trace;
    const host = slot();renderOutcome(host,reopened);
    assert.equal(reopened.status,name==='AbortError'?'stopped':'failed');
    assert.match(host.innerHTML,/转写已保留，纪要尚未完成/);
    assert.match(host.innerHTML,/<details class="meeting-transcript" open\s*[^>]*>/);
    assert.ok(host.innerHTML.includes('说话人2：日期还没决定。'));
    assert.ok(host.innerHTML.includes('data-transcript-copy="0"'));
    assert.ok(host.innerHTML.includes('data-transcript-download="0"'));
    assert.ok(!host.innerHTML.includes('data-result-copy'));
    assert.deepEqual(safeTrace(reopened).outputs,trace.outputs);
  }
});
