import test from 'node:test';
import assert from 'node:assert/strict';
import {microphone} from '../js/live/microphone.js';
import {MAX_SECONDS, SAMPLE_RATE, SESSION_CALL_SECONDS, captureLimitBytes} from '../js/live/pcm.js';

function media(t,getUserMedia,AudioContext) {
  for(const [name,value] of Object.entries({navigator:{mediaDevices:{getUserMedia}},isSecureContext:true,AudioWorkletNode:class{},AudioContext})){
    const old=Object.getOwnPropertyDescriptor(globalThis,name);
    Object.defineProperty(globalThis,name,{configurable:true,writable:true,value});
    t.after(()=>old?Object.defineProperty(globalThis,name,old):delete globalThis[name]);
  }
}
const options=signal=>({signal,onPCM(){assert.fail('canceled microphone emitted PCM');},onDuration(){},onLimit(){},onError(){}});
test('session calls last thirty minutes and other captures stay at three', () => {
  assert.equal(MAX_SECONDS, 180);
  assert.equal(SESSION_CALL_SECONDS, 1800);
  assert.equal(captureLimitBytes(), MAX_SECONDS * SAMPLE_RATE * 2);
  assert.equal(captureLimitBytes(SESSION_CALL_SECONDS), SESSION_CALL_SECONDS * SAMPLE_RATE * 2);
  assert.throws(() => captureLimitBytes(0), /录音上限无效/);
  assert.throws(() => captureLimitBytes(3601), /录音上限无效/);
});
function stream(){const track={stopped:false,stop(){this.stopped=true;},addEventListener(){}};return {track,getTracks:()=>[track],getAudioTracks:()=>[track]};}
test('pre-aborted microphone never requests permission',async t=>{
  media(t,()=>assert.fail('requested permission after abort'));
  const ctrl=new AbortController();ctrl.abort();await assert.rejects(microphone(options(ctrl.signal)),{name:'AbortError'});
});
test('permission granted after cancellation releases the late stream without initializing audio',async t=>{
  let grant;media(t,()=>new Promise(resolve=>{grant=resolve;}),class{constructor(){assert.fail('initialized canceled audio');}});
  const ctrl=new AbortController(),pending=microphone(options(ctrl.signal)),acquired=stream();
  ctrl.abort();grant(acquired);await assert.rejects(pending,{name:'AbortError'});assert.equal(acquired.track.stopped,true);
});
test('cancel during AudioContext initialization releases tracks immediately',async t=>{
  let resume,context;const acquired=stream();
  media(t,async()=>acquired,class{
    constructor(){context=this;this.state='suspended';}
    resume(){return new Promise(resolve=>{resume=resolve;});}
    async close(){this.state='closed';}
  });
  const ctrl=new AbortController(),pending=microphone(options(ctrl.signal));await Promise.resolve();
  ctrl.abort();assert.equal(acquired.track.stopped,true);assert.equal(context.state,'closed');
  resume();await assert.rejects(pending,{name:'AbortError'});
});
