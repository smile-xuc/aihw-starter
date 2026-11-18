import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  appendCaption, applyTool, formatDiaryPrompt, functionCalls, instructionsWithPetMemory, liveProduct, liveProductFor, liveReturn,
  openToolRound, responseFunctionCalls,
  mergeMemories, parseDiary, petFace, phraseMap, renderDiary,
} from '../js/live/product-session.js';

const toy = {
  MOTIONS: { wave: '挥挥手', nod: '点点头' },
  LIGHTS: { warm: '暖黄光' },
};
const pet = {
  EMOTIONS: { calm: '平静', smile: '微笑' },
  ACTIONS: { none: '不动', nod: '点点头' },
  LIGHTS: { smile: '暖白常亮', calm: '白光常亮' },
  FACES: { calm: ['o     o', ' --- '], smile: ['o     o', ' \\_/ '] },
};

test('live routes point at the product pages and the glasses call', () => {
  assert.equal(liveProduct('toy').href, '#/live/toy');
  assert.equal(liveProduct('glasses'), null);
  assert.equal(liveProductFor('06-ai-earphone.bailian', 'default').kind, 'translate');
  assert.equal(liveProductFor('02-ai-glasses.bailian', 'realtime').href, '#/session');
  assert.equal(liveReturn('#/live/pet').title, '桌宠豆豆');
  assert.equal(liveReturn('#/session'), null);
});

test('tools and diary stay local and bounded', () => {
  const wave = applyTool(toy, 'toy_action', '{"motion":"wave","light":"warm"}');
  assert.equal(wave.ok, true);
  assert.match(wave.label, /挥挥手/);
  assert.match(wave.label, /暖黄光/);
  const unknown = applyTool(toy, 'other', '{}');
  assert.equal(unknown.ok, false);
  const smile = applyTool(pet, 'pet_expression', '{"emotion":"smile","action":"nod"}');
  assert.equal(smile.emotion, 'smile');
  assert.match(petFace('sleepy', smile.face), /zZ/);
  assert.equal(petFace('calm', pet.FACES.calm).split('\n')[1], '|  o     o  |');
  assert.deepEqual(phraseMap(`降噪=noise cancellation\nbad\n=skip\n${'词'.repeat(41)}=x`), { 降噪: 'noise cancellation' });
  const calls = functionCalls({ response: { output: [
    { type: 'function_call', call_id: 'a', name: 'toy_action' },
    { type: 'message' },
    { type: 'function_call', name: 'missing' },
  ] } }, 2, 1);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].call_id, 'a');
  const batch = responseFunctionCalls({ response: { output: [
    { type: 'function_call', call_id: 'narrate', name: 'create_live_narration' },
    { type: 'function_call', call_id: 'watch', name: 'create_proactive_monitor' },
    { type: 'function_call', name: 'missing' },
  ] } }, 0);
  assert.deepEqual(batch.map((item) => item.call_id), ['narrate', 'watch']);
  assert.equal(responseFunctionCalls({ response: { output: batch } }, 2).length, 0);
  const round = openToolRound(['narrate', 'watch']);
  assert.equal(round.finish('narrate'), 'hold');
  assert.equal(round.waiting('watch'), true);
  assert.equal(round.finish('watch'), 'speak');
  assert.equal(round.finish('watch'), 'closed');
  const first = appendCaption({}, { item_id: 'a', delta: 'Hello' });
  const second = appendCaption(first, { item_id: 'b', delta: '你好' });
  assert.equal(second.a, 'Hello');
  assert.equal(appendCaption(second, { item_id: 'a', delta: ' world' }).a, 'Hello world');
  const prompt = formatDiaryPrompt('你好{name}\n{{"title": "{name}"}}', '豆豆');
  assert.equal(prompt, '你好豆豆\n{"title": "豆豆"}');
  const diary = parseDiary('```json\n{"title":"今天","diary":"聊了画画","mood":"开心","mood_stars":4,"memories":[{"type":"兴趣偏好","content":"喜欢画画"}],"follow_up":"问画"}\n```');
  const memory = mergeMemories({ pet: '豆豆', memories: [{ date: '2026-11-14', type: '兴趣偏好', content: '喜欢画画' }] }, diary, '2026-11-15', 20);
  assert.equal(memory.memories.length, 1);
  assert.equal(memory.follow_up, '问画');
  assert.match(renderDiary(diary, { today: '2026-11-15', name: '豆豆', turns: 2 }), /喜欢画画/);
  const instructions = instructionsWithPetMemory('你是豆豆', memory, '\n\n[记忆]\n{lines}', 10);
  assert.match(instructions, /喜欢画画/);
  assert.equal(instructionsWithPetMemory('你是豆豆', {}, '\n{lines}'), '你是豆豆');
});

test('live-data carries the demo constants the pages call', async () => {
  const toyData = JSON.parse(await readFile(new URL('../live-data/03-toys-companion.bailian.json', import.meta.url), 'utf8'));
  const petData = JSON.parse(await readFile(new URL('../live-data/05-desktop-pet.bailian.json', import.meta.url), 'utf8'));
  const earData = JSON.parse(await readFile(new URL('../live-data/06-ai-earphone.bailian.json', import.meta.url), 'utf8'));
  assert.equal(toyData.MODEL, 'qwen3.8-omni-flash-realtime');
  assert.equal(toyData.TOOLS[0].function.name, 'toy_action');
  assert.equal(petData.DIARY_MODEL, 'qwen3.7-flash');
  assert.match(petData.PROMPT, /\{name\}/);
  assert.equal(earData.MODEL, 'qwen3.8-livetranslate-flash-realtime');
  assert.ok(earData.AUDIO_LANGS.includes('en'));
});
