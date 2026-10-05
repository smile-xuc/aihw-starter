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
let browser,gateway,phase='launch';
try{
  const port=await new Promise((resolve,reject)=>{let output='';const timer=setTimeout(()=>reject(Error('server timeout')),10000);child.stdout.on('data',data=>{output+=data;const m=/port (\d+)/.exec(output);if(m){clearTimeout(timer);resolve(m[1]);}});child.on('error',reject);});
  const base='http://127.0.0.1:'+port+'/app/';
  browser=await chromium.launch({executablePath:process.env.CHROME||'/usr/bin/chromium',args:['--no-sandbox','--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream']});
  const context=await browser.newContext({viewport:{width:390,height:844},locale:'zh-CN',reducedMotion:'reduce',serviceWorkers:'block',permissions:['microphone']});
  const errors=[],external=[],sessions=[],probes=[],requests=[];let mode='success',probeMode='success',releaseSummary;
  await context.addInitScript(()=>{
    sessionStorage.setItem('aihw.credentials.bailian',JSON.stringify({values:{DASHSCOPE_API_KEY:'sk-test-key-00000000',DASHSCOPE_API_REGION:'cn-beijing',DASHSCOPE_WORKSPACE_ID:'test-space'}}));
    const original=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);window.testTracks=[];
    navigator.mediaDevices.getUserMedia=async constraints=>{const stream=await original(constraints);window.testTracks.push(...stream.getTracks());return stream;};
  });
  await context.route('**/*',async(route,request)=>{
    if(request.url().startsWith(base)||/^(blob:|data:)/.test(request.url()))return route.continue();
    if(request.url().includes('/chat/completions')){
      const body=JSON.parse(request.postData());requests.push(body);assert.equal(body.model,'qwen3.8-flash');assert.equal(body.response_format.type,'json_schema');
      const responseMode=mode;
      if(responseMode==='summary-wait')await new Promise(resolve=>{releaseSummary=resolve;});
      if(responseMode==='summary-fail')return route.fulfill({status:500,contentType:'application/json',body:JSON.stringify({error:{message:'fake summary failure'}})});
      const minutes={title:'实时录音测试',summary:'确认报价事项。',agenda:['报价'],decisions:[{content:'确定整理报价',owner:'',source_ids:['s002']}],action_items:[{task:'周五前整理报价',owner:'林工',due:'周五前',source_ids:['s001','s002']}],open_questions:[],risks:[]};
      return route.fulfill({status:200,contentType:'text/event-stream',body:'data: '+JSON.stringify({id:'summary-'+requests.length,choices:[{delta:{content:JSON.stringify(minutes)}}]})+'\n\ndata: '+JSON.stringify({choices:[],usage:{prompt_tokens:40,completion_tokens:50}})+'\n\ndata: [DONE]\n\n'}).catch(error=>{if(responseMode!=='summary-wait')throw error;});
    }
    external.push(new URL(request.url()).origin);return route.abort();
  });
  await context.routeWebSocket('wss://gateway.example/asr',socket=>{
    const log={url:socket.url(),bytes:0,frames:[],closed:false};let initialized=false,first=true;
    socket.onClose(()=>{log.closed=true;});
    socket.onMessage(data=>{
      if(typeof data==='string'){
        const message=JSON.parse(data);log.frames.push(message.type);
        if(message.type==='probe'){
          probes.push(log);assert.deepEqual(message,{type:'probe'});
          if(probeMode==='close')socket.close({code:1008,reason:'origin rejected'});
          else if(probeMode==='legacy')socket.send(JSON.stringify({type:'error',message:'do not echo sk-test-key-00000000'}));
          else if(probeMode!=='wait')socket.send(JSON.stringify({type:'probe',service:'aihw-byok-asr',protocol:1,model:'qwen-audio-3.1-asr-flash-streaming',max_seconds:180}));
        }else if(message.type==='start'){
          sessions.push(log);initialized=true;assert.equal(message.key,'sk-test-key-00000000');assert.equal(message.region,'cn-beijing');
          if(mode==='start-fail'){socket.send(JSON.stringify({type:'error',message:'mock authentication failure'}));return;}
          socket.send(JSON.stringify({type:'submitted',task_id:'asr-'+sessions.length}));if(mode!=='ready-wait')socket.send(JSON.stringify({type:'ready',task_id:'asr-'+sessions.length}));
        }else if(message.type==='finish'){
          if(mode==='tail-wait')return;
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
  async function open(){await page.goto(base+'#/s/07-recorder.bailian/default');await page.reload();await page.locator('[data-realtime]').waitFor();await page.locator('[data-realtime]>summary').click();await page.locator('[data-rt-gateway]').fill('wss://gateway.example/asr');}
  async function start(){await page.locator('[data-rt-start]').click();await page.locator('[data-sheet="go"]').click();}
  async function state(value){await page.locator(`[data-realtime][data-state="${value}"]`).waitFor();}
  async function released(){await page.waitForFunction(()=>window.testTracks.every(t=>t.readyState==='ended'));}
  async function fits(){assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'horizontal overflow');}
  phase='configuration';await open();await page.evaluate(()=>sessionStorage.removeItem('aihw.credentials.bailian'));await page.reload();await page.locator('[data-realtime]>summary').click();
  // addInitScript supplies test credentials at reload; clear then remount via hash.
  await page.evaluate(()=>sessionStorage.removeItem('aihw.credentials.bailian'));await page.goto(base+'#/me');await page.goto(base+'#/s/07-recorder.bailian/default');await page.locator('[data-realtime]>summary').click();
  assert.match(await page.locator('[data-rt-checklist]').innerText(),/设置自己的百炼 Key/);assert.match(await page.locator('.realtime-setup').innerText(),/没有公共网关/);
  await page.locator('[data-rt-start]').click();assert.equal(await page.locator('[data-sheet="go"]').count(),0);assert.equal(sessions.length,0);
  await page.locator('[data-rt-probe]').click();assert.match(await page.locator('[data-rt-diagnostic]').innerText(),/完整的 wss/);assert.equal(probes.length,0);
  await page.locator('[data-rt-gateway]').fill('wss://gateway.example/asr?key=invalid');await page.locator('[data-rt-probe]').click();assert.match(await page.locator('[data-rt-diagnostic]').innerText(),/查询参数/);assert.equal(probes.length,0);
  await page.locator('[data-rt-gateway]').fill('wss://gateway.example/asr');
  async function diagnose(){await page.locator('[data-rt-probe]').click();await page.locator('[data-sheet="go"]').click();}
  phase='diagnostic';await page.locator('[data-rt-probe]').click();await page.locator('[data-sheet="cancel"]').click();assert.equal(probes.length,0);
  await diagnose();await page.waitForFunction(()=>document.querySelector('[data-rt-diagnostic]').textContent.includes('检查通过'));assert.equal(probes.length,1);assert.equal(sessions.length,0);assert.equal(requests.length,0);assert.equal(await page.evaluate(()=>window.testTracks.length),0);assert.equal(await page.evaluate(()=>localStorage.getItem('aihw.history.v1')),null);
  await page.locator('[data-rt-gateway]').fill('wss://gateway.example/asr');assert.match(await page.locator('[data-rt-diagnostic]').innerText(),/重新检查/);
  probeMode='legacy';await diagnose();await page.waitForFunction(()=>document.querySelector('[data-rt-diagnostic]').textContent.includes('兼容'));assert.doesNotMatch(await page.locator('[data-rt-diagnostic]').innerText(),/sk-test-key-00000000/);
  probeMode='close';await diagnose();await page.waitForFunction(()=>document.querySelector('[data-rt-diagnostic]').textContent.includes('断开'));
  probeMode='wait';await diagnose();await page.locator('[data-rt-probe-cancel]:not([hidden])').waitFor();assert.equal(await page.locator('[data-rt-start]').isDisabled(),true);await page.locator('[data-rt-probe]').dispatchEvent('click');await page.locator('[data-rt-start]').dispatchEvent('click');assert.equal(probes.length,4);assert.equal(sessions.length,0);await page.locator('[data-rt-probe-cancel]').click();await page.waitForFunction(()=>document.querySelector('[data-rt-diagnostic]').textContent.includes('已取消'));
  phase='settings-return';await page.locator('[data-rt-setup]').click();await page.locator('input[name="DASHSCOPE_API_KEY"]').fill('sk-test-key-00000000');await page.locator('input[name="DASHSCOPE_WORKSPACE_ID"]').fill('test-space');await page.locator('input[name="remember"]').uncheck();await page.locator('form[data-form="bailian"] button[type="submit"]').click();await page.locator('[data-realtime]').waitFor();await page.locator('[data-realtime]>summary').click();assert.equal(await page.locator('[data-rt-gateway]').inputValue(),'wss://gateway.example/asr');assert.match(await page.locator('[data-rt-checklist]').innerText(),/已填写/);assert.equal(sessions.length,0);assert.equal(requests.length,0);
  phase='cancel';await page.locator('[data-rt-start]').click();await page.locator('[data-rt-start]').dispatchEvent('click');assert.equal(await page.locator('[data-sheet="go"]').count(),1);await page.locator('[data-sheet="cancel"]').click();assert.equal(sessions.length,0);assert.equal(await page.evaluate(()=>window.testTracks.length),0);
  phase='success';await start();await state('recording');await page.locator('[data-rt-partial]:not([hidden])').waitFor();assert.equal(await page.locator('[data-act="live"]').isDisabled(),true);assert.equal(await page.locator('[data-outcome] .meeting-result').count(),0);
  await page.locator('[data-rt-pause]').click();await state('paused');await page.waitForTimeout(250);const paused=sessions[0].bytes;const time=await page.locator('[data-rt-duration]').innerText();await page.waitForTimeout(300);assert.equal(sessions[0].bytes,paused);assert.equal(await page.locator('[data-rt-duration]').innerText(),time);assert.equal(await page.evaluate(()=>window.testTracks.filter(t=>t.readyState==='live').every(t=>!t.enabled)),true);
  await page.locator('[data-rt-pause]').click();await state('recording');await page.waitForTimeout(200);assert.ok(sessions[0].bytes>paused);await fits();
  if(process.env.SCREENSHOTS){await mkdir(process.env.SCREENSHOTS,{recursive:true});await page.locator('[data-realtime]').screenshot({path:path.join(process.env.SCREENSHOTS,'390-realtime-recording.png')});}
  await page.locator('[data-rt-finish]').click();await page.locator('[data-rt-finish]').dispatchEvent('click');await state('complete');await released();assert.equal(requests.length,1);assert.equal(sessions.length,1);assert.match(requests[0].messages[1].content,/s002.*最后确定/);assert.doesNotMatch(requests[0].messages[1].content,/尚未确认/);assert.deepEqual(requests[0].response_format.json_schema.schema.properties.decisions.items.properties.source_ids.items.enum,['s001','s002']);
  assert.match(await page.locator('[data-rt-outcome]').innerText(),/费用未知/);assert.equal(await page.locator('[data-rt-partial]').isHidden(),true);assert.equal(sessions[0].frames.at(-1),'finish');assert.equal(sessions[0].frames.filter(f=>f==='finish').length,1);
  await page.locator('[data-rt-outcome] [data-meeting-source]').first().click();assert.equal(await page.locator('[data-rt-outcome] [data-transcript-id]:focus').count(),1);await fits();
  const event=page.waitForEvent('download');await page.locator('[data-rt-outcome] [data-export]').click();const trace=JSON.parse(await readFile(await(await event).path(),'utf8'));assert.equal(trace.runner,'browser');assert.match(trace.models.join(','),/streaming/);assert.ok(trace.result.metrics.asrMs<trace.result.metrics.totalMs);assert.equal(trace.result.cost,null);assert.equal(trace.inputs.length,0);assert.doesNotMatch(JSON.stringify(trace),/sk-test-key-00000000|gateway.example|尚未确认/);
  const schema=JSON.parse(await readFile(path.join(docs,'../solutions/demo-standard/trace.schema.json'),'utf8'));const validated=spawnSync(process.env.PYTHON||'python3',['-c','import json,sys,jsonschema; d=json.load(sys.stdin);jsonschema.validate(d["trace"],d["schema"])'],{input:JSON.stringify({schema,trace}),encoding:'utf8'});assert.equal(validated.status,0,validated.stderr);
  const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('aihw.history.v1')));assert.equal(stored.length,1);assert.doesNotMatch(JSON.stringify(stored),/sk-test-key-00000000|gateway.example|audio\/pcm/);
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
  phase='start-failure';await open();mode='start-fail';await start();await state('failed');await released();assert.equal(requests.length,4);assert.equal(sessions.length,6);
  phase='stop-connection';mode='ready-wait';await start();await state('connecting');await page.waitForFunction(()=>window.testTracks.some(t=>t.readyState==='live'));await page.locator('[data-rt-abort]').click();await state('failed');await released();assert.equal(requests.length,4);
  phase='stop-tail';mode='tail-wait';await start();await state('recording');await page.locator('[data-rt-partial]:not([hidden])').waitFor();await page.locator('[data-rt-finish]').click();await state('finishing');await released();await page.locator('[data-rt-abort]').click();await state('failed');assert.equal(requests.length,4);assert.match(await page.locator('[data-rt-transcript]').innerText(),/林工准备报价/);
  phase='stop-summary';mode='summary-wait';await start();await state('recording');await page.locator('[data-rt-partial]:not([hidden])').waitFor();await page.locator('[data-rt-finish]').click();await state('summarizing');const deadline=Date.now()+15000;while(!releaseSummary){assert.ok(Date.now()<deadline,'summary request did not reach the mock');await page.waitForTimeout(20);}await released();await page.locator('[data-rt-abort]').click();await state('failed');assert.equal(requests.length,5);
  mode='success';const beforeRetry=sessions.length,tracksBeforeRetry=await page.evaluate(()=>window.testTracks.length);await page.locator('[data-rt-summary]').click();await page.locator('[data-rt-summary]').dispatchEvent('click');assert.equal(await page.locator('[data-sheet="go"]').count(),1);await page.locator('[data-sheet="go"]').click();await page.locator('[data-rt-summary]').dispatchEvent('click');await state('complete');releaseSummary();await page.waitForTimeout(100);assert.equal(await page.locator('[data-realtime]').getAttribute('data-state'),'complete');assert.equal(sessions.length,beforeRetry);assert.equal(requests.length,6);assert.equal(await page.evaluate(()=>window.testTracks.length),tracksBeforeRetry);
  phase='microphone-disconnect';await start();await state('recording');await page.locator('[data-rt-partial]:not([hidden])').waitFor();await page.evaluate(()=>window.testTracks.at(-1).dispatchEvent(new Event('ended')));await state('failed');await released();assert.match(await page.locator('[data-rt-message]').innerText(),/麦克风已断开/);
  phase='delayed-permission';await page.evaluate(()=>{const original=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);navigator.mediaDevices.getUserMedia=async constraints=>{const stream=await original(constraints);await new Promise(resolve=>window.grantDelayed=resolve);return stream;};});await start();await state('connecting');await page.waitForFunction(()=>!!window.grantDelayed);const beforeDelayed=sessions.length;await page.locator('[data-rt-abort]').click();await state('failed');await page.evaluate(()=>window.grantDelayed());await released();assert.equal(sessions.length,beforeDelayed);
  phase='navigate-probe';probeMode='wait';await diagnose();await page.locator('[data-rt-probe-cancel]:not([hidden])').waitFor();await page.goto(base+'#/me');await page.waitForTimeout(100);assert.equal(probes.at(-1).closed,true);assert.equal(requests.length,6);
  await open();
  phase='actual-local-probe';
  // Exercise the actual browser Upgrade and server probe handler together.
  // This local fixture rejects any attempt to open an upstream connection.
  let gatewayOutput='';
  gateway=spawn(process.env.PYTHON||'python3',['-u','-c',`
import asyncio, sys
from aiohttp import web
sys.path.insert(0, sys.argv[1])
from server import create_app
async def forbidden(target, headers):
    print('UNEXPECTED_PROVIDER', flush=True)
    raise RuntimeError('Provider access forbidden in probe test')
async def main():
    runner=web.AppRunner(create_app([sys.argv[2]],test_connector=forbidden),access_log=None)
    await runner.setup()
    site=web.TCPSite(runner,'127.0.0.1',0)
    await site.start()
    print('gateway-port',site._server.sockets[0].getsockname()[1],flush=True)
    await asyncio.Event().wait()
asyncio.run(main())
`,path.resolve(docs,'../services/asr-gateway'),new URL(base).origin],{stdio:['ignore','pipe','pipe']});
  const gatewayPort=await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(Error('local gateway timeout')),10000);
    gateway.stdout.on('data',data=>{gatewayOutput+=data;const match=/gateway-port (\d+)/.exec(gatewayOutput);if(match){clearTimeout(timer);resolve(match[1]);}});
    gateway.on('error',error=>{clearTimeout(timer);reject(error);});
    gateway.on('exit',code=>{clearTimeout(timer);reject(Error('local gateway exited '+code));});
  });
  await page.locator('[data-rt-gateway]').fill('ws://127.0.0.1:'+gatewayPort+'/asr');await diagnose();await page.waitForFunction(()=>document.querySelector('[data-rt-diagnostic]').textContent.includes('检查通过'));assert.doesNotMatch(gatewayOutput,/UNEXPECTED_PROVIDER/);assert.equal(sessions.length,beforeDelayed);assert.equal(requests.length,6);assert.equal(await page.evaluate(()=>window.testTracks.length),0);
  phase='responsive';for(const [width,height]of[[320,740],[768,1024],[1440,1000]]){await page.setViewportSize({width,height});await fits();if(process.env.SCREENSHOTS)await page.locator('[data-realtime]').screenshot({path:path.join(process.env.SCREENSHOTS,width+'-realtime.png')});}
  assert.deepEqual(errors,[]);assert.deepEqual(external,[]);console.log('Realtime browser OK: configuration/return, no-Key probes/cancel/legacy/failure, actual local gateway Upgrade/probe, duplicate clicks, actual AudioWorklet fake-microphone PCM, pause/resume, tail-before-summary, history/export, disconnect/manual salvage, summary retry, empty/permission failures, stop connecting/tail/summary, late permission and microphone release, navigation cleanup, responsive layout. '+sessions.length+' mocked ASR sessions, '+requests.length+' mocked summary requests, '+probes.length+' mock probes and one actual local gateway probe; no provider calls.');await context.close();
}catch(error){console.error(phase+': '+error.stack);process.exitCode=1;}finally{await browser?.close();gateway?.kill('SIGTERM');child.kill('SIGTERM');}
