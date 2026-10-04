import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {audioChannels} from '../js/live/audio-channels.js';

function wave(channels, junk = false) {
  // PCM: two 16-bit samples per channel. An optional odd-sized JUNK chunk
  // exercises real RIFF alignment rather than assuming a 44-byte header.
  const bytes = new Uint8Array(44 + channels*4 + (junk?10:0)),view=new DataView(bytes.buffer);
  const put=(offset,text)=>bytes.set(new TextEncoder().encode(text),offset);
  put(0,'RIFF');view.setUint32(4,bytes.length-8,true);put(8,'WAVE');
  let offset=12;if(junk){put(offset,'JUNK');view.setUint32(offset+4,1,true);bytes[offset+8]=7;offset+=10;}
  put(offset,'fmt ');view.setUint32(offset+4,16,true);view.setUint16(offset+8,1,true);view.setUint16(offset+10,channels,true);
  view.setUint32(offset+12,16000,true);view.setUint32(offset+16,16000*channels*2,true);view.setUint16(offset+20,channels*2,true);view.setUint16(offset+22,16,true);
  put(offset+24,'data');view.setUint32(offset+28,channels*4,true);return bytes.buffer;
}
function mp3(mode,{tag=false,footer=false}={}) {
  // MPEG-1 Layer III, 128 kbit/s at 44.1 kHz: a complete 417-byte frame.
  const id3=tag?[73,68,51,4,0,footer?16:0,0,0,0,3,1,2,3]:[];
  const end=footer?[51,68,73,4,0,16,0,0,0,3]:[];
  return new Uint8Array([...id3,...end,255,251,144,mode<<6,...new Array(413).fill(0)]).buffer;
}

test('WAV mono and stereo stay distinct even when RIFF contains an odd-sized metadata chunk', () => {
  for(const junk of [false,true]) {
    assert.equal(audioChannels(wave(1,junk),'wav'),1);
    assert.equal(audioChannels(wave(2,junk),'wav'),2);
  }
  assert.equal(audioChannels(wave(6),'wav'),6,'multichannel must not silently become mono/stereo');
});
test('malformed WAV headers fail instead of choosing a default channel', () => {
  const noChannels=wave(1);new DataView(noChannels).setUint16(22,0,true);
  const oversizedChunk=wave(1);new DataView(oversizedChunk).setUint32(16,500,true);
  const noFmt=wave(1);new Uint8Array(noFmt).set(new TextEncoder().encode('JUNK'),12);
  const shortFmt=wave(1);new DataView(shortFmt).setUint32(16,2,true);
  for(const value of [new ArrayBuffer(0),wave(2).slice(0,-1),noChannels,oversizedChunk,noFmt,shortFmt]) assert.throws(()=>audioChannels(value,'wav'),/声道/);
});
test('MP3 mono, stereo, joint stereo and dual channel retain both channels with or without ID3', () => {
  for(const options of [{},{tag:true},{tag:true,footer:true}]) {
    assert.equal(audioChannels(mp3(3,options),'mp3'),1);
    for(const mode of [0,1,2]) assert.equal(audioChannels(mp3(mode,options),'mp3'),2);
  }
});
test('invalid or truncated MP3 metadata/frame cannot silently select the first channel', () => {
  const badSize=mp3(0,{tag:true});new Uint8Array(badSize)[6]=128;
  const outside=mp3(0,{tag:true});new Uint8Array(outside)[8]=127;
  const noSync=mp3(0);new Uint8Array(noSync)[0]=0;
  const badVersion=mp3(0);new Uint8Array(badVersion)[1]=235;
  const badRate=mp3(0);new Uint8Array(badRate)[2]=156;
  const wrongFooter=mp3(0,{tag:true,footer:true});new Uint8Array(wrongFooter)[13]=0;
  for(const value of [new ArrayBuffer(0),mp3(1).slice(0,20),badSize,outside,noSync,badVersion,badRate,wrongFooter]) assert.throws(()=>audioChannels(value,'mp3'),/声道/);
  assert.throws(()=>audioChannels(wave(1),'ogg'),/声道/);
  assert.throws(()=>audioChannels(new Uint8Array(mp3(1)),'mp3'),/声道/);
});
test('bundled meeting recording channel count is read from the real MP3 asset', () => {
  const file=readFileSync(new URL('../data/assets/07-recorder.bailian/samples/meeting.mp3',import.meta.url));
  assert.equal(audioChannels(file.buffer.slice(file.byteOffset,file.byteOffset+file.byteLength),'mp3'),1);
});
