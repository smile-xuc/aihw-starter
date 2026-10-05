// Produce checklists and summary-only request bodies. No network or credentials.
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {transcriptText,validateTranscript,groundedResponseFormat} from '../js/meeting-evidence.js';

const here=path.dirname(fileURLToPath(import.meta.url));
const args=process.argv.slice(2);
if(args.length!==2 || args[0]!=='--out')throw Error('用法：node docs/app/tools/prepare-quality.mjs --out 一个尚不存在的目录');
const out=path.resolve(args[1]);
const dataset=JSON.parse(await readFile(path.join(here,'quality-fixtures/cases.json'),'utf8'));
const constants=JSON.parse(await readFile(path.join(here,'../live-data/07-recorder.bailian.json'),'utf8'));
await mkdir(out); // Refuse to replace an existing report or evidence directory.
const checklist={schema:'aihw/quality-report@0.1',prepared_at:new Date().toISOString(),mode:'not-run',cases:dataset.cases.map(c=>({id:c.id,layer:c.layer,status:'not-run',attempt:0,output_trace_file:null,request_ids:[],metrics:{asr_ms:null,total_ms:null,cost:null,cost_status:'unknown'},checks:c.expected.map(criterion=>({criterion,passed:null,note:''}))}))};
await writeFile(path.join(out,'checklist.json'),JSON.stringify(checklist,null,2)+'\n');
for(const c of dataset.cases.filter(c=>c.layer==='summary')){
  const source=validateTranscript(c.input.transcript);
  const request={model:constants.LLM_MODEL,messages:[{role:'system',content:constants.MINUTES_PROMPT},{role:'user',content:transcriptText(source,{ids:true})}],response_format:groundedResponseFormat(constants.MINUTES_SCHEMA,source),enable_thinking:false,stream:true,stream_options:{include_usage:true}};
  await writeFile(path.join(out,c.id+'-request.json'),JSON.stringify(request,null,2)+'\n');
}
console.log('已准备 20 个未运行用例的检查清单和 4 份摘要阶段请求体；没有调用模型或读取凭证。');
