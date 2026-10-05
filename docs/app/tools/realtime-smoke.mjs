// Fake microphone + local WebSocket frames + local summary: no provider calls.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {mkdir,readFile} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_CORE||'playwright-core').href);
const docs=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const child=spawn(process.env.PYTHON||'python3',['-u','-m','http.server','0','--bind','127.0.0.1','--directory',docs],{stdio:['ignore','pipe','ignore']});
let browser,phase='launch';
try{
  const port=await new Promise((resolve,reject)=>{let output='';const timer=setTimeout(()=>reject(Error('server timeout')),10000);child.stdout.on('data',data=>{output+=data;const m=/port (\d+)/.exec(output);if(m){clearTimeout(timer);resolve(m[1]);}});child.on('error',reject);});
  const base='http://127.0.0.1:'+port+'/app/';
  browser=await chromium.launch({executablePath:process.env.CHROME||'/usr/bin/chromium',args:['--no-sandbox','--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream']});
  const context=await browser.newContext({viewport:{width:390,height:844},locale:'zh-CN',reducedMotion:'reduce',serviceWorkers:'block',permissions:['microphone']});
  const errors=[],external=[],sessions=[],requests=[];let mode='success';
  await context.addInitScript(()=>{
    sessionStorage.setItem('aihw.credentials.bailian',JSON.stringify({values:{DASHSCOPE_API_KEY:'test-key',DASHSCOPE_API_REGION:'cn-beijing',DASHSCOPE_WORKSPACE_ID:'test-space'}}));
    const original=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);window.testTracks=[];
    navigator.mediaDevices.getUserMedia=async constraints=>{const stream=await original(constraints);window.testTracks.push(...stream.getTracks());return stream;};
  });
  await context.route('**/*',(route,request)=>{
    if(request.url().startsWith(base)||/^(blob:|data:)/.test(request.url()))return route.continue();
    if(request.url().includes('/chat/completions')){
      const body=JSON.parse(request.postData());requests.push(body);assert.equal(body.model,'qwen3.8-flash');assert.equal(body.response_format.type,'json_schema');
      if(mode==='summary-fail')return route.fulfill({status:500,contentType:'application/json',body:JSON.stringify({error:{message:'fake summary failure'}})});
      const minutes={title:'实时录音测试',summary:'确认报价事项。',agenda:['报价'],decisions:[{content:'确定整理报价',owner:'',source_ids:['s002']}],action_items:[{task:'周五前整理报价',owner:'林工',due:'周五前',source_ids:['s001','s002']}],open_questions:[],risks:[]};
      return route.fulfill({status:200,contentType:'text/event-stream',body:'data: '+JSON.stringify({id:'summary-'+requests.length,choices:[{delta:{content:JSON.stringify(minutes)}}]})+'\n\ndata: '+JSON.stringify({choices:[],usage:{prompt_tokens:40,completion_tokens:50}})+'\n\ndata: [DONE]\n\n'});
    }
    external.push(new URL(request.url()).origin);return route.abort();
  });
  await context.routeWebSocket('wss://gateway.example/asr',socket=>{
    const log={url:socket.url(),bytes:0,frames:[],closed:false};sessions.push(log);let initialized=false,first=true;
    socket.onClose(()=>{log.closed=true;});
    socket.onMessage(data=>{
      if(typeof data==='string'){
        const message=JSON.parse(data);log.frames.push(message.type);
        if(message.type==='start'){
          initialized=true;assert.equal(message.key,'test-key');assert.equal(message.region,'cn-beijing');socket.send(JSON.stringify({type:'submitted',task_id:'asr-'+sessions.length}));socket.send(JSON.stringify({type:'ready',task_id:'asr-'+sessions.length}));
        }else if(message.type==='finish'){
          if(mode!=='empty')socket.send(JSON.stringify({type:'sentence',text:'最后确定：林工周五前整理报价。',begin_ms:1200,end_ms:2000,final:true}));
          socket.send(JSON.stringify({type:'finished',duration:log.bytes/32000}));
        }else throw Error('Unexpected gateway action');
      }else{
        assert.ok(initialized);assert.equal(data.length%2,0);assert.ok(data.length<=4096);log.bytes+=data.length;log.frames.push('pcm');
        if(first){first=false;if(mode!=='empty'){
          socket.send(JSON.stringify({type:'sentence',text:'林工准备报价。',begin_ms:0,end_ms:1000,final:true}));
          socket.send(JSON.stringify({type:'sentence',text:'这是尚未确认的临时文字',begin_ms:1200,end_ms:null,final:false}));
        }if(mode==='drop')socket.close({code:1011,reason:'fake disconnect'});}
      }
    });
  });
  const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));page.setDefaultTimeout(15000);
  async function open(){await page.goto(base+'#/s/07-recorder.bailian/default');await page.locator('[data-realtime]').waitFor();await page.locator('[data-realtime]>summary').click();await page.locator('[data-rt-gateway]').fill('wss://gateway.example/asr');}
  async function start(){await page.locator('[data-rt-start]').click();await page.locator('[data-sheet="go"]').click();}
  async function state(value){await page.locator(`[data-realtime][data-state="${value}"]`).waitFor();}
  async function released(){await page.waitForFunction(()=>window.testTracks.every(t=>t.readyState==='ended'));}
  async function fits(){assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'horizontal overflow');}
  phase='cancel';await open();await page.locator('[data-rt-start]').click();await page.locator('[data-sheet="cancel"]').click();assert.equal(sessions.length,0);assert.equal(await page.evaluate(()=>window.testTracks.length),0);
  phase='success';await start();await state('recording');await page.locator('[data-rt-partial]:not([hidden])').waitFor();assert.equal(await page.locator('[data-act="live"]').isDisabled(),true);assert.equal(await page.locator('[data-outcome] .meeting-result').count(),0);
  await page.locator('[data-rt-pause]').click();await state('paused');await page.waitForTimeout(250);const paused=sessions[0].bytes;const time=await page.locator('[data-rt-duration]').innerText();await page.waitForTimeout(300);assert.equal(sessions[0].bytes,paused);assert.equal(await page.locator('[data-rt-duration]').innerText(),time);assert.equal(await page.evaluate(()=>window.testTracks.filter(t=>t.readyState==='live').every(t=>!t.enabled)),true);
  await page.locator('[data-rt-pause]').click();await state('recording');await page.waitForTimeout(200);assert.ok(sessions[0].bytes>paused);await fits();
  if(process.env.SCREENSHOTS){await mkdir(process.env.SCREENSHOTS,{recursive:true});await page.locator('[data-realtime]').screenshot({path:path.join(process.env.SCREENSHOTS,'390-realtime-recording.png')});}
  await page.locator('[data-rt-finish]').click();await state('complete');await released();assert.equal(requests.length,1);assert.equal(sessions.length,1);assert.match(requests[0].messages[1].content,/s002.*最后确定/);assert.doesNotMatch(requests[0].messages[1].content,/尚未确认/);assert.deepEqual(requests[0].response_format.json_schema.schema.properties.decisions.items.properties.source_ids.items.enum,['s001','s002']);
  assert.match(await page.locator('[data-rt-outcome]').innerText(),/费用未知/);assert.equal(await page.locator('[data-rt-partial]').isHidden(),true);assert.equal(sessions[0].frames.at(-1),'finish');assert.equal(sessions[0].frames.filter(f=>f==='finish').length,1);
  await page.locator('[data-rt-outcome] [data-meeting-source]').first().click();assert.equal(await page.locator('[data-rt-outcome] [data-transcript-id]:focus').count(),1);await fits();
  const event=page.waitForEvent('download');await page.locator('[data-rt-outcome] [data-export]').click();const trace=JSON.parse(await readFile(await(await event).path(),'utf8'));assert.equal(trace.runner,'browser');assert.match(trace.models.join(','),/streaming/);assert.ok(trace.result.metrics.asrMs<trace.result.metrics.totalMs);assert.equal(trace.result.cost,null);assert.equal(trace.inputs.length,0);assert.doesNotMatch(JSON.stringify(trace),/test-key|gateway.example|尚未确认/);
  const schema=JSON.parse(await readFile(path.join(docs,'../solutions/demo-standard/trace.schema.json'),'utf8'));const validated=spawnSync(process.env.PYTHON||'python3',['-c','import json,sys,jsonschema; d=json.load(sys.stdin);jsonschema.validate(d["trace"],d["schema"])'],{input:JSON.stringify({schema,trace}),encoding:'utf8'});assert.equal(validated.status,0,validated.stderr);
  const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('aihw.history.v1')));assert.equal(stored.length,1);assert.doesNotMatch(JSON.stringify(stored),/test-key|gateway.example|audio\/pcm/);
  phase='drop';mode='drop';await start();await state('failed');await released();assert.equal(sessions.length,2);assert.equal(requests.length,1);assert.match(await page.locator('[data-rt-message]').innerText(),/不会自动重连/);assert.match(await page.locator('[data-rt-transcript]').innerText(),/林工准备报价/);assert.equal(await page.locator('[data-rt-summary]').isVisible(),true);
  // Manual salvage starts only summary; no replacement ASR or microphone.
  mode='success';await page.locator('[data-rt-summary]').click();await page.locator('[data-sheet="go"]').click();await state('failed');assert.equal(sessions.length,2);assert.equal(requests.length,2); // fake response deliberately references unavailable s002
  assert.match(await page.locator('[data-rt-outcome]').innerText(),/来源编号无效/);
  phase='summary-fail';mode='summary-fail';await start();await state('recording');await page.locator('[data-rt-partial]:not([hidden])').waitFor();await page.locator('[data-rt-finish]').click();await state('failed');await released();assert.equal(sessions.length,3);assert.equal(requests.length,3);assert.match(await page.locator('[data-rt-transcript]').innerText(),/最后确定/);
  mode='success';await page.locator('[data-rt-summary]').click();await page.locator('[data-sheet="go"]').click();await state('complete');assert.equal(sessions.length,3);assert.equal(requests.length,4);
  phase='empty';mode='empty';await start();await state('recording');await page.waitForTimeout(200);await page.locator('[data-rt-finish]').click();await state('failed');await released();assert.equal(requests.length,4);assert.equal(await page.locator('[data-rt-summary]').isHidden(),true);
  phase='navigation';mode='success';await start();await state('recording');await page.locator('[data-rt-partial]:not([hidden])').waitFor();await page.goto(base+'#/me');await released();assert.equal(sessions.length,5);assert.equal(requests.length,4);
  phase='denied';await open();await page.evaluate(()=>{navigator.mediaDevices.getUserMedia=async()=>{throw new DOMException('Permission denied','NotAllowedError');};});await start();await state('failed');assert.match(await page.locator('[data-rt-message]').innerText(),/麦克风权限/);assert.equal(sessions.length,5);
  phase='missing-key';await page.evaluate(()=>{sessionStorage.removeItem('aihw.credentials.bailian');});await page.locator('[data-rt-start]').click();assert.match(await page.locator('[data-rt-message]').innerText(),/设置自己的百炼 Key/);assert.equal(sessions.length,5);
  phase='responsive';for(const [width,height]of[[320,740],[768,1024],[1440,1000]]){await page.setViewportSize({width,height});await fits();if(process.env.SCREENSHOTS)await page.locator('[data-realtime]').screenshot({path:path.join(process.env.SCREENSHOTS,width+'-realtime.png')});}
  assert.deepEqual(errors,[]);assert.deepEqual(external,[]);console.log('Realtime browser OK: actual AudioWorklet fake-microphone PCM, pause/resume, tail-before-summary, source references, history/export, disconnect/manual salvage, summary retry, empty/permission failures, navigation track release, responsive layout. Five local mocked WS sessions, four mocked summary requests, no provider calls.');await context.close();
}catch(error){console.error(phase+': '+error.stack);process.exitCode=1;}finally{await browser?.close();child.kill('SIGTERM');}
