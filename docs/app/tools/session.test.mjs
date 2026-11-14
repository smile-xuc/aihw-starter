import test from 'node:test';
import assert from 'node:assert/strict';
import { SUMMARY_MODEL, buildUserContent, clipSummary, encodeWav, instructionsWithMemory, isSessionReturn, nextMemory, nextTextHistory, requestMessages, safeAudioUrl, spokenText, summaryMessages } from '../js/live/session-turn.js';

test('session return accepts only the exact page', () => {
  assert.equal(isSessionReturn('#/session'), true);
  for (const hash of ['#/session/extra', '#/session?x=1', '#/me', 'https://evil.test/#/session']) assert.equal(isSessionReturn(hash), false);
});

test('wav header matches 16-bit mono pcm', () => {
  const pcm = new Uint8Array([0, 0, 255, 127]);
  const view = new DataView(encodeWav(pcm, 16000));
  assert.equal(String.fromCharCode(...new Uint8Array(view.buffer, 0, 4)), 'RIFF');
  assert.equal(view.getUint32(4, true), 40);
  assert.equal(view.getUint32(24, true), 16000);
  assert.equal(view.getUint16(22, true), 1);
  assert.equal(view.getUint32(40, true), 4);
  assert.throws(() => encodeWav(new Uint8Array([1]), 16000), /不完整/);
});

test('turn content requires a frame and a question or voice', () => {
  const image = `data:image/jpeg;base64,${Buffer.from('jpeg').toString('base64')}`;
  const content = buildUserContent({ imageDataUrl: image, audioBase64: Buffer.from('wav').toString('base64'), question: '这是什么' });
  assert.equal(content[0].type, 'image_url');
  assert.equal(content[1].input_audio.format, 'wav');
  assert.equal(content[2].text, '这是什么');
  assert.throws(() => buildUserContent({ imageDataUrl: image }), /请说话或输入问题/);
  assert.throws(() => buildUserContent({ imageDataUrl: 'https://evil.test/a.jpg', question: '看' }), /当前画面/);
  assert.throws(() => buildUserContent({ imageDataUrl: image, question: '问'.repeat(501) }), /500/);
});

test('history keeps text only and the request puts the new frame last', () => {
  let history = [];
  for (let i = 0; i < 8; i++) history = nextTextHistory(history, `问题${i}`, `回答${i}`, 6);
  assert.equal(history.length, 12);
  assert.equal(history[0].content, '问题2');
  assert.equal(history.at(-1).content, '回答7');
  const voice = nextTextHistory([], '', '听见了');
  assert.match(voice[0].content, /语音提问/);
  const image = `data:image/png;base64,${Buffer.from('png').toString('base64')}`;
  const messages = requestMessages('系统', history, buildUserContent({ imageDataUrl: image, question: '现在呢' }));
  assert.equal(messages[0].role, 'system');
  assert.equal(messages.at(-1).content.at(-1).text, '现在呢');
  assert.ok(!JSON.stringify(history).includes('data:image'));
});

test('playback url stays on official https hosts', () => {
  assert.equal(safeAudioUrl('https://dashscope-result.oss-cn-beijing.aliyuncs.com/a.wav'), 'https://dashscope-result.oss-cn-beijing.aliyuncs.com/a.wav');
  assert.equal(safeAudioUrl('http://dashscope.aliyuncs.com/a.wav'), null);
  assert.equal(safeAudioUrl('https://user:secret@evil.aliyuncs.com/a.wav'), null);
  assert.equal(safeAudioUrl('https://evil.test/a.wav'), null);
  assert.equal(spokenText('**看**一下\n这张图'), '看 一下 这张图');
});

test('memory keeps recent text and leaves instructions unchanged when empty', () => {
  assert.deepEqual(nextMemory(['旧'], '', ''), ['旧']);
  assert.equal(nextMemory([], '看到杯子', '这是杯子')[0], '看到杯子 → 这是杯子');
  const trimmed = nextMemory(Array.from({ length: 10 }, (_, i) => `第${i}句`), '新', '', 8);
  assert.equal(trimmed.length, 8);
  assert.equal(trimmed.at(-1), '新');
  assert.equal(instructionsWithMemory('你好', []), '你好');
  assert.match(instructionsWithMemory('你好', ['记得这个']), /记得这个/);
  assert.match(instructionsWithMemory('你好', [], '上次说到杯子'), /上次说到杯子/);
  assert.match(instructionsWithMemory('你好', [], '', ['用户喜欢喝茶']), /0\. 用户喜欢喝茶/);
  assert.match(instructionsWithMemory('你好', [], '', [], '- 偏好：喝茶', '- [进行中] 赶项目'), /偏好：喝茶/);
  assert.match(instructionsWithMemory('你好', [], '', [], '- 偏好：喝茶', '- [进行中] 赶项目'), /赶项目/);
  assert.equal(clipSummary(`  ${'很'.repeat(700)}  `).length, 600);
  const messages = summaryMessages('旧摘要', ['看到杯子 → 这是杯子']);
  assert.equal(messages[0].role, 'system');
  assert.match(messages[1].content, /旧摘要/);
  assert.match(messages[1].content, /看到杯子/);
  assert.equal(SUMMARY_MODEL, 'qwen3.7-plus');
});
