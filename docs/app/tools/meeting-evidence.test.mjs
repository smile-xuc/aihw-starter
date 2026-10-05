import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateTranscript,readTranscript,transcriptText,groundedResponseFormat,validateSources,editMeetingTrace,readMeetingEdits} from '../js/meeting-evidence.js';
import {readMeetingResult,meetingMarkup,meetingMarkdown,validateMinutes} from '../js/meeting-results.js';
import {saveHistory,readHistory,updateHistory,deleteHistory} from '../js/history.js';
import {safeTrace} from '../js/experience.js';

const source={schema:'aihw/transcript@0.1',sentences:[
  {id:'s001',begin_ms:0,end_ms:3100,speaker:'说话人1',text:'小林周五前整理报价单。'},
  {id:'s002',begin_ms:4200,end_ms:5800,speaker:'说话人2',text:'发布日期还没定。'},
]};
const minutes={title:'准备工作',summary:'整理报价单，发布日期待定。',agenda:['报价'],decisions:[],action_items:[{task:'整理报价单',owner:'小林',due:'周五前',source_ids:['s001']}],open_questions:['发布日期'],risks:[]};
const file=(path,value)=>({path,media_type:'application/json',text:JSON.stringify(value)});
const trace=()=>({schema:'aihw/trace@0.1',solution:'07-recorder.bailian',variant:'default',mode:'live',kit:'browser',status:'success',events:[],inputs:[],outputs:[file('out/minutes.json',minutes),file('out/transcript.json',source),{path:'out/transcript.txt',text:transcriptText(source),media_type:'text/plain'}],result:null,error:null});
const store=()=>{const map=new Map();return {getItem:key=>map.get(key),setItem:(key,value)=>map.set(key,value)};};

test('strict schema restricts references to actual sentence IDs and leaves generated constants intact',()=>{
  const schema=JSON.parse(readFileSync(new URL('../live-data/07-recorder.bailian.json',import.meta.url))).MINUTES_SCHEMA;
  const format=groundedResponseFormat(schema,source);
  assert.equal(format.type,'json_schema');assert.equal(format.json_schema.strict,true);
  assert.equal(format.json_schema.schema.additionalProperties,false);
  for(const key of ['decisions','action_items'])assert.deepEqual(format.json_schema.schema.properties[key].items.properties.source_ids.items.enum,['s001','s002']);
  assert.equal(schema.properties.action_items.items.properties.source_ids.items.enum,undefined);
});

test('source association is validated without declaring semantic accuracy',()=>{
  assert.equal(validateSources(minutes,source),minutes);
  for(const refs of [['s003'],['s001','s001'],[1],null])assert.throws(()=>validateSources({...minutes,action_items:[{...minutes.action_items[0],source_ids:refs}]},source),/来源/);
  assert.throws(()=>validateSources({...minutes,action_items:[{task:'任务',owner:'',due:''}]},source),/来源/);
  const text=String(meetingMarkup(readMeetingResult(trace())));
  assert.match(text,/模型关联，请核对/);assert.match(text,/data-meeting-source="s001"/);
});

test('missing times stay unknown while actual zero timestamps stay available',()=>{
  const unknown=structuredClone(source);unknown.sentences[0].begin_ms=null;unknown.sentences[0].end_ms=null;
  assert.match(transcriptText(validateTranscript(unknown),{ids:true}),/\[s001\] \[时间未提供\]/);
  assert.match(transcriptText(source),/\[00:00\]/);
  for(const mutation of [{begin_ms:-1},{end_ms:NaN},{id:'<script>'},{id:'s002'},{end_ms:-1},{text:''},{speaker:''}]){
    const bad=structuredClone(source);Object.assign(bad.sentences[0],mutation);assert.throws(()=>validateTranscript(bad));
  }
});

test('source files and original quotes survive text-only trace history and export',()=>{
  const original=trace(),target=store(),saved=saveHistory(original,target);assert.equal(saved.saved,true);
  assert.deepEqual(readTranscript(readHistory(target).records[0].trace),source);
  assert.equal(safeTrace(original).schema,'aihw/trace@0.1');
  assert.match(meetingMarkdown(readMeetingResult(original)),/来源原句.*s001.*小林周五前整理报价单/);
});

test('manual corrections preserve AI values, provenance and original source linkage',()=>{
  const original=trace(),updated=editMeetingTrace(original,'action_items',0,{owner:'林工',due:'下周二'});
  assert.deepEqual(JSON.parse(updated.outputs[0].text),minutes);assert.deepEqual(original,trace());
  const result=readMeetingResult(updated);
  assert.equal(result.action_items[0].owner,'林工');assert.equal(result.action_items[0].due,'下周二');
  assert.deepEqual(result.action_items[0].source_ids,['s001']);
  assert.equal(result.action_items[0].corrections.owner.original,'小林');
  assert.match(meetingMarkdown(result),/负责人由用户修正（AI 原值：小林）/);
  assert.match(String(meetingMarkup(result)),/用户修正/);
});

test('updates keep the same history ID and do not recreate deleted or unreadable records',()=>{
  const target=store(),saved=saveHistory(trace(),target),updated=editMeetingTrace(trace(),'action_items',0,{owner:'林工',due:'周五前'});
  assert.equal(updateHistory(saved.record.id,updated,target).saved,true);
  const records=readHistory(target).records;assert.equal(records.length,1);assert.equal(records[0].id,saved.record.id);
  assert.equal(readMeetingResult(records[0].trace).action_items[0].owner,'林工');
  deleteHistory(saved.record.id,target);assert.equal(updateHistory(saved.record.id,updated,target).saved,false);assert.equal(readHistory(target).records.length,0);
  assert.equal(updateHistory('x',updated,{getItem(){throw Error('blocked')}}).saved,false);
});

test('restore removes the manual sidecar and returns to the untouched AI assignments',()=>{
  const corrected=editMeetingTrace(trace(),'action_items',0,{owner:'林工',due:'下周二'});
  const restored=editMeetingTrace(corrected,'action_items',0,{}, {restore:true});
  assert.equal(restored.outputs.some(f=>f.path==='out/minutes-edits.json'),false);
  assert.deepEqual(readMeetingResult(restored),readMeetingResult(trace()));
});

test('invalid edit inputs cannot modify task content, another item or unsupported fields',()=>{
  for(const [section,index,changes] of [['risks',0,{}],['action_items',-1,{}],['action_items',1,{}],['action_items',0,{owner:'x',due:1}],['action_items',0,{owner:'x',due:'',task:'覆盖任务'}],['action_items',0,{owner:'x'.repeat(201),due:''}]])assert.throws(()=>editMeetingTrace(trace(),section,index,changes));
  assert.throws(()=>editMeetingTrace({...trace(),solution:'02-ai-glasses.bailian'},'action_items',0,{owner:'x',due:''}));
});

test('mismatched imported edits are ignored atomically instead of hiding changed provenance',()=>{
  const updated=editMeetingTrace(trace(),'action_items',0,{owner:'林工',due:'下周二'});
  const editFile=updated.outputs.find(f=>f.path==='out/minutes-edits.json');
  for(const mutation of [{original:'伪造原值'},{field:'task'},{section:'__proto__'},{index:99},{edited_at:'not-a-date'},{value:[] }]){
    const bad=structuredClone(updated),value=JSON.parse(editFile.text);Object.assign(value.edits[0],mutation);bad.outputs.find(f=>f.path===editFile.path).text=JSON.stringify(value);
    assert.deepEqual(readMeetingEdits(bad,minutes),[]);assert.equal(readMeetingResult(bad).action_items[0].owner,'小林');
  }
});

test('source IDs and correction values remain escaped and corrupt source files stay clearly unavailable',()=>{
  const updated=editMeetingTrace(trace(),'action_items',0,{owner:'<img onerror=alert(1)>',due:'<script>日期</script>'});
  const ui=String(meetingMarkup(readMeetingResult(updated)));assert.ok(!ui.includes('<img'));assert.match(ui,/&lt;script&gt;/);
  const invalid=trace();invalid.outputs.find(f=>f.path==='out/transcript.json').text='{}';
  assert.equal(readTranscript(invalid),null);assert.match(String(meetingMarkup(readMeetingResult(invalid))),/尚无可查看的关联原句/);
  assert.throws(()=>validateMinutes({...minutes,action_items:[{...minutes.action_items[0],source_ids:['s001" onclick="alert(1)'] }]}));
});
