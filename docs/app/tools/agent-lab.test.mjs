import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {buildCommand,initialTask,transition,taskToken} from '../js/agent-lab.js';
const step=(s,type,extra={})=>transition(s,{type,token:taskToken(s),...extra});
test('commands validate empty, controls, type and local media; shell metacharacters remain data',()=>{
  for(const text of ['', '  ', 'hello\nworld','x\0y','a'.repeat(2001)])assert.throws(()=>buildCommand('text',text));
  for(const text of ['https://example.test/a.wav','--key foo','./a.exe'])assert.throws(()=>buildCommand('asr',text));
  assert.throws(()=>buildCommand('constructor','x'));
  const text="it's $(echo INJECTED) `echo INJECTED`; <b>&";
  const command=buildCommand('text',text);
  // Shell function prints argv only: this cannot call bl or a provider.
  const args=execFileSync('/bin/sh',['-c',`bl() { printf '%s\\n' "$@"; }; ${command}`],{encoding:'utf8'}).split('\n');
  assert.equal(args[3],text);assert.equal(args[4],'--output');
  assert.match(buildCommand('asr','./my recording.wav'),/--url '\.\/my recording.wav'/);
});
test('stop speech is independent of cancellation; late results cannot resurrect cancelled task',()=>{
  let s=step(initialTask(),'start');const token=taskToken(s);
  s=step(s,'stop-speech');assert.equal(s.task,'running');assert.equal(s.speech,'silent');
  s=step(s,'cancel');assert.equal(s.task,'cancelling');
  s=step(s,'result',{token});assert.equal(s.task,'cancelling');assert.equal(s.result,null);
  s=step(s,'cancelled');assert.equal(s.task,'cancelled');
  s=step(s,'result',{token});assert.equal(s.result,null);
  s=step(s,'retry');assert.equal(s.task,'running');s=step(s,'result',{token});assert.equal(s.result,null);
});
test('requirement and context revisions fence old approvals and results',()=>{
  for(const event of ['update','context']){
    let s=step(initialTask(),'start');s=step(s,'permission');const token=s.approval.token;
    const old=structuredClone(s);s=step(s,event);assert.equal(s.revision,2);assert.equal(s.approval,null);assert.equal(old.revision,1);
    s=step(s,'permission');s=step(s,'approve',{token});assert.equal(s.task,'awaiting_approval');
    s=step(s,'approve');assert.equal(s.task,'running');s=step(s,'result',{token});assert.equal(s.result,null);
    s=step(s,'result');assert.equal(s.task,'completed');if(event==='update')assert.doesNotMatch(s.result,/样本观察/);s=step(s,event);assert.equal(s.result,null);
  }
});
test('results wait for speech window and delivery acknowledgment is separate and idempotent',()=>{
  let s=step(initialTask(),'start');s=step(s,'result');assert.equal(s.delivered,false);
  s=step(s,'deliver');assert.equal(s.delivered,false);
  s=step(s,'stop-speech');s=step(s,'talk');s=step(s,'deliver');assert.equal(s.delivered,false);
  s=step(s,'talk');s=step(s,'deliver');assert.equal(s.delivered,true);
  const n=s.log.length;s=step(s,'deliver');assert.equal(s.log.length,n);
});
test('approval is a gate; reject and failure support explicit retry',()=>{
  let s=step(initialTask(),'start');s=step(s,'permission');s=step(s,'result');assert.equal(s.task,'awaiting_approval');
  s=step(s,'deny');assert.equal(s.task,'failed');s=step(s,'retry');assert.equal(s.attempt,2);
  s=step(s,'fail');assert.equal(s.task,'failed');s=step(s,'retry');assert.equal(s.attempt,3);
});

test('visual samples carry provenance and expiry blocks results, approvals and stale retries',()=>{
  let s=step(initialTask({visual:true}),'start');s=step(s,'permission');const old=s.approval.token;
  s=step(s,'expire-context');assert.equal(s.task,'awaiting_context');assert.equal(s.clock-s.observedAt,20);assert.equal(s.approval,null);
  s=step(s,'approve',{token:old});s=step(s,'result');assert.equal(s.task,'awaiting_context');assert.equal(s.result,null);
  s=step(s,'cancel');s=step(s,'cancelled');s=step(s,'retry');assert.equal(s.task,'awaiting_context');
  s=step(s,'refresh-context');assert.equal(s.task,'running');assert.equal(s.clock-s.observedAt,0);
  s=step(s,'result',{token:old});assert.equal(s.result,null);s=step(s,'result');assert.equal(s.task,'completed');
  s=step(s,'context');assert.equal(s.context,'B');assert.equal(s.result,null);
});
