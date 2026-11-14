import test from 'node:test';
import assert from 'node:assert/strict';
import { connectRealtime, decodeBase64, pcmBase64, realtimeSocketUrl, redactSecret, SEMANTIC_TURN, sessionConfig, splitPcm } from '../js/live/realtime-omni.js';

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
  handle.send('response.create');
  assert.equal(socket.sent.at(-1).type, 'response.create');
  handle.close();
});
