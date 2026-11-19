import test from 'node:test';
import assert from 'node:assert/strict';
import { MUTE_HEARTBEAT_MS, OMNI_38_VOICES, callRecoveryPlan, chooseVoice, connectRealtime, decodeBase64, pcmBase64, readVoice, realtimeSocketUrl, redactSecret, responseWaitPlan, SEMANTIC_TURN, sessionConfig, silenceFrame, splitPcm, translationSession, writeVoice } from '../js/live/realtime-omni.js';

const stack = {
  fields: [
    { key: 'DASHSCOPE_API_KEY', pattern: '^s[kt]-\\S{8,}$' },
    { key: 'DASHSCOPE_API_REGION' },
    { key: 'DASHSCOPE_WORKSPACE_ID', pattern: '^[A-Za-z0-9-]+$' },
  ],
  endpoints: { roots: [
    { when: { DASHSCOPE_WORKSPACE_ID: '*' }, ws: 'wss://{DASHSCOPE_WORKSPACE_ID}.{DASHSCOPE_API_REGION}.maas.aliyuncs.com' },
    { when: { DASHSCOPE_API_REGION: 'cn-beijing' }, ws: 'wss://dashscope.aliyuncs.com' },
    { when: { DASHSCOPE_API_REGION: 'ap-southeast-1' }, ws: 'wss://dashscope-intl.aliyuncs.com' },
  ] },
};
const key = 'sk-not-a-real-key';

class FakeSocket {
  static latest = null;
  constructor(url) { this.url = url; this.readyState = 1; this.sent = []; FakeSocket.latest = this; }
  send(data) { this.sent.push(JSON.parse(data)); }
  close() { this.readyState = 3; this.onclose?.(); }
}

test('realtime url uses the official host and hides the key from page text', () => {
  const href = realtimeSocketUrl(stack, { DASHSCOPE_API_KEY: key, DASHSCOPE_API_REGION: 'cn-beijing' }, 'qwen3.8-omni-flash-realtime');
  const url = new URL(href);
  assert.equal(url.protocol, 'wss:');
  assert.equal(url.host, 'dashscope.aliyuncs.com');
  assert.equal(url.pathname, '/api-ws/v1/realtime');
  assert.equal(url.searchParams.get('model'), 'qwen3.8-omni-flash-realtime');
  assert.equal(url.searchParams.get('api_key'), key);
  const workspace = realtimeSocketUrl(stack, { DASHSCOPE_API_KEY: key, DASHSCOPE_API_REGION: 'cn-beijing', DASHSCOPE_WORKSPACE_ID: 'llm-demo' }, 'qwen3.8-omni-flash-realtime');
  assert.equal(new URL(workspace).host, 'llm-demo.cn-beijing.maas.aliyuncs.com');
  assert.equal(redactSecret(`失败 ${href}`, key).includes(key), false);
  assert.match(redactSecret(`失败 ${href}`, key), /api_key=\[已隐藏\]/);
  assert.throws(() => realtimeSocketUrl(stack, { DASHSCOPE_API_KEY: 'short', DASHSCOPE_API_REGION: 'cn-beijing' }, 'qwen3.8-omni-flash-realtime'), /先保存百炼 Key/);
});

test('session config is manual turn with audio and one compact video stream', () => {
  const session = sessionConfig({ instructions: '看画面', voice: 'Tina', inputRate: 16000, outputRate: 24000, asrModel: 'qwen3-asr-flash-realtime' });
  assert.equal(session.turn_detection, null);
  assert.equal(session.audio.output.voice, 'Tina');
  assert.equal(session.video.input.representation_compact, 'normal');
  const semantic = sessionConfig({ instructions: '看画面', voice: 'Tina', inputRate: 16000, outputRate: 24000, asrModel: 'qwen3-asr-flash-realtime', turnDetection: SEMANTIC_TURN });
  assert.equal(semantic.turn_detection.type, 'semantic_vad');
  assert.equal(semantic.turn_detection.silence_duration_ms, 800);
  assert.equal(session.enable_search, undefined);
  assert.equal(sessionConfig({ instructions: '看画面', voice: 'Tina', inputRate: 16000, outputRate: 24000, asrModel: 'qwen3-asr-flash-realtime', turnDetection: SEMANTIC_TURN, search: true }).enable_search, true);
  const withTools = sessionConfig({ instructions: '玩具', voice: 'Tina', inputRate: 16000, outputRate: 24000, asrModel: 'qwen3-asr-flash-realtime', search: true, video: false, tools: [{ type: 'function', function: { name: 'toy_action' } }] });
  assert.equal(withTools.tools[0].function.name, 'toy_action');
  assert.equal(withTools.enable_search, undefined);
  assert.equal(withTools.video, undefined);
  const translation = translationSession({ language: 'ja', phrases: { 降噪: 'noise cancellation' } });
  assert.deepEqual(translation.output_modalities, ['text', 'audio']);
  assert.equal(translation.translation.language, 'ja');
  assert.equal(translation.translation.corpus.phrases.降噪, 'noise cancellation');
  assert.deepEqual(translationSession({ textOnly: true }).output_modalities, ['text']);
  assert.equal(splitPcm(new Uint8Array(10), 4).length, 3);
  const audio = new Uint8Array([0, 1, 2, 3]);
  assert.deepEqual(decodeBase64(pcmBase64(audio)), audio);
});

test('ready handshake sends session.update and later errors stay redacted', async () => {
  const href = realtimeSocketUrl(stack, { DASHSCOPE_API_KEY: key, DASHSCOPE_API_REGION: 'ap-southeast-1' }, 'qwen3.8-omni-flash-realtime');
  const seen = [];
  const handle = connectRealtime({ url: href, secret: key, session: { instructions: 'hi' }, WebSocketImpl: FakeSocket, onEvent: (event) => seen.push(event) });
  const socket = FakeSocket.latest;
  assert.equal(socket.url.includes(key), true);
  socket.onmessage({ data: JSON.stringify({ type: 'session.created' }) });
  assert.equal(socket.sent[0].type, 'session.update');
  assert.equal(socket.sent[0].session.instructions, 'hi');
  socket.onmessage({ data: JSON.stringify({ type: 'session.updated' }) });
  await handle.ready;
  assert.equal(Object.hasOwn(handle, 'url'), false);
  socket.onmessage({ data: JSON.stringify({ type: 'error', error: { message: `bad ${key}` } }) });
  const failure = seen.find((event) => event.type === 'error');
  assert.equal(failure.message.includes(key), false);
  assert.match(failure.message, /bad \[已隐藏\]/);
  assert.equal(failure.code, '');
  const serving = '<50002> InternalError.Algo.ModelServingError: model failed';
  assert.equal(callRecoveryPlan({ code: 'COMMON_ERROR', message: serving, attempts: 0 }).action, 'reconnect');
  assert.equal(callRecoveryPlan({ code: 'COMMON_ERROR', message: serving, attempts: 1 }).action, 'reconnect');
  assert.equal(callRecoveryPlan({ code: 'COMMON_ERROR', message: serving, attempts: 2 }).action, 'stop');
  assert.equal(callRecoveryPlan({ code: 'InvalidApiKey', message: serving, attempts: 0 }).action, 'fail');
  assert.equal(callRecoveryPlan({ code: 'COMMON_ERROR', message: '其他错误', attempts: 0 }).action, 'fail');
  assert.equal(callRecoveryPlan({ code: 'response_created_timeout', message: '', attempts: 0 }).action, 'reconnect');
  assert.equal(callRecoveryPlan({ code: 'response_done_timeout', message: '', attempts: 2 }).action, 'stop');
  assert.equal(responseWaitPlan({ phase: 'created', authority: 'direct', elapsedMs: 14999 }).action, 'wait');
  assert.equal(responseWaitPlan({ phase: 'created', authority: 'direct', elapsedMs: 15000 }).code, 'response_created_timeout');
  assert.equal(responseWaitPlan({ phase: 'done', authority: 'direct', elapsedMs: 120000 }).action, 'wait');
  assert.equal(responseWaitPlan({ phase: 'done', authority: 'tool', elapsedMs: 119999 }).action, 'wait');
  assert.equal(responseWaitPlan({ phase: 'done', authority: 'tool', elapsedMs: 120000 }).code, 'response_done_timeout');
  assert.equal(responseWaitPlan({ phase: 'cancel', authority: 'direct', elapsedMs: 1999 }).action, 'wait');
  assert.equal(responseWaitPlan({ phase: 'cancel', authority: 'direct', elapsedMs: 2000 }).code, 'response_cancel_timeout');
  socket.onmessage({ data: JSON.stringify({ type: 'error', error: { code: 'COMMON_ERROR', message: serving } }) });
  assert.equal(seen.filter((event) => event.type === 'error').at(-1).code, 'COMMON_ERROR');
  handle.send('response.create');
  assert.equal(socket.sent.at(-1).type, 'response.create');
  handle.close();
});

test('mic mute keeps the socket alive with one silent second', () => {
  assert.equal(MUTE_HEARTBEAT_MS, 30000);
  const frame = silenceFrame(16000, 1);
  assert.equal(frame.byteLength, 32000);
  assert.equal(frame.some((byte) => byte !== 0), false);
  const encoded = pcmBase64(frame);
  assert.equal(decodeBase64(encoded).byteLength, 32000);
});

test('qwen3.8 voice stays on a supported preset', () => {
  assert.equal(OMNI_38_VOICES.includes('Tina'), true);
  assert.equal(OMNI_38_VOICES.includes('Liora Mira'), true);
  assert.equal(chooseVoice('Ryan'), 'Ryan');
  assert.equal(chooseVoice('Chelsie'), 'Tina');
  assert.equal(chooseVoice(''), 'Tina');
  const memory = { value: null, getItem() { return this.value; }, setItem(_key, value) { this.value = value; } };
  assert.equal(writeVoice(memory, 'Mia'), 'Mia');
  assert.equal(readVoice(memory), 'Mia');
  assert.equal(writeVoice(memory, 'Cherry'), 'Tina');
  assert.equal(readVoice(memory), 'Tina');
});
