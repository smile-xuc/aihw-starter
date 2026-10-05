import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateInput} from '../js/live/input.js';
import {audioChannels} from '../js/live/audio-channels.js';
import {validateTranscript} from '../js/meeting-evidence.js';

test('quality package has complete public inputs within current upload limits and separates summary-only coverage',()=>{
  const dataset=JSON.parse(readFileSync(new URL('./quality-fixtures/cases.json',import.meta.url)));
  const provenance=JSON.parse(readFileSync(new URL('./quality-fixtures/provenance.json',import.meta.url)));
  assert.equal(dataset.status,'not-run');assert.equal(dataset.cases.length,20);assert.equal(new Set(dataset.cases.map(c=>c.id)).size,20);
  assert.deepEqual(['photo','asr+summary','summary'].map(layer=>dataset.cases.filter(c=>c.layer===layer).length),[8,8,4]);
  for(const c of dataset.cases){
    assert.ok(c.expected.length>0 && c.expected.every(text=>typeof text==='string'&&text.trim()));
    if(c.layer==='summary'){validateTranscript(c.input.transcript);assert.equal(c.input.kind,'transcript');continue;}
    assert.ok(!c.input.asset.startsWith('/') && !c.input.asset.includes('..'));
    const buffer=readFileSync(new URL('../'+c.input.asset,import.meta.url));
    const bytes=buffer.buffer.slice(buffer.byteOffset,buffer.byteOffset+buffer.byteLength),name=c.input.asset.split('/').at(-1);
    if(c.layer==='photo')validateInput({kind:'image',mime:'image/jpeg',name,buffer:bytes,question:c.input.question});
    else{
      const isWav=name.endsWith('.wav'),meta=provenance.files.find(f=>f.file==='audio/'+name);
      const durationSeconds=meta?.duration_seconds || (name==='meeting.mp3'?55:3.15);
      validateInput({kind:'audio',mime:isWav?'audio/wav':'audio/mpeg',format:isWav?'wav':'mp3',name,buffer:bytes,durationSeconds});
      assert.equal(audioChannels(bytes,isWav?'wav':'mp3'),name==='stereo-duplicate.mp3'?2:1);
    }
  }
});
