import test from 'node:test';
import assert from 'node:assert/strict';
import { LOOK_TOOL, analyzeFrame, canRetryVisual, captureSwitchPlan, silencePcm, visualQuestion } from '../js/live/on-demand.js';
import { decodeBase64 } from '../js/live/realtime-omni.js';

class FakeSocket {
  static latest = null;
  static failCommit = false;
  constructor(url) { this.url = url; this.readyState = 1; this.sent = []; FakeSocket.latest = this; }
  send(data) {
    const message = JSON.parse(data);
    this.sent.push(message);
    if (message.type === 'input_audio_buffer.commit') {
      queueMicrotask(() => {
        if (FakeSocket.failCommit) this.onmessage?.({ data: JSON.stringify({ type: 'error', error: { message: '看画面超时' } }) });
        else this.onmessage?.({ data: JSON.stringify({ type: 'input_audio_buffer.committed' }) });
      });
    }
    if (message.type === 'response.create') {
      queueMicrotask(() => {
        this.onmessage?.({ data: JSON.stringify({ type: 'response.text.delta', delta: '桌上有杯子' }) });
        this.onmessage?.({ data: JSON.stringify({ type: 'response.done', response: { status: 'completed' } }) });
      });
    }
  }
  close() { this.readyState = 3; }
}

function open(socket) {
  socket.onmessage({ data: JSON.stringify({ type: 'session.created' }) });
  socket.onmessage({ data: JSON.stringify({ type: 'session.updated' }) });
}

const common = {
  url: 'wss://dashscope.aliyuncs.com/api-ws/v1/realtime?model=qwen3.8-omni-flash-realtime',
  secret: 'sk-not-a-real-key',
  jpeg: new Uint8Array([255, 216, 255]),
  voice: 'Tina',
  inputRate: 16000,
  outputRate: 24000,
  asrModel: 'qwen3-asr-flash-realtime',
  WebSocketImpl: FakeSocket,
};

test('on-demand question and silence stay bounded', () => {
  assert.equal(visualQuestion('', ''), '概述这张画面里看得到的内容。');
  assert.equal(visualQuestion('  杯子呢 ', '别的'), '杯子呢');
  assert.equal(silencePcm(16000, 1).byteLength, 32000);
  assert.equal(LOOK_TOOL.function.name, 'analyze_view');
  assert.equal(canRetryVisual(new Error('看画面超时')), true);
  assert.equal(canRetryVisual(new Error('请核对 Key、地域')), false);
  assert.equal(canRetryVisual(new DOMException('已停下', 'AbortError')), false);
});

test('on-demand sends one still twice and asks after commit', async () => {
  FakeSocket.failCommit = false;
  const pending = analyzeFrame({ ...common, question: '有什么' });
  const socket = FakeSocket.latest;
  open(socket);
  assert.equal(await pending, '桌上有杯子');
  const session = socket.sent.find((item) => item.type === 'session.update').session;
  assert.equal(session.turn_detection, null);
  assert.equal(session.tools, undefined);
  assert.equal(session.enable_search, undefined);
  assert.equal(session.video.input.representation_compact, 'normal');
  const media = socket.sent.filter((item) => item.type !== 'session.update');
  assert.deepEqual(media.map((item) => item.type), [
    'input_audio_buffer.append', 'input_image_buffer.append',
    'input_audio_buffer.append', 'input_image_buffer.append',
    'input_audio_buffer.commit', 'response.create',
  ]);
  assert.equal(media[0].audio, media[2].audio);
  assert.equal(media[1].image, media[3].image);
  assert.equal(decodeBase64(media[0].audio).byteLength, 32000);
  assert.equal(media[5].response.instructions, '有什么');
});

test('capture mode stays on this call unless video was never opened', () => {
  const liveToDemand = captureSwitchPlan({ mode: 'live', next: 'demand', videoOn: true, tools: true });
  assert.equal(liveToDemand.reconnect, false);
  assert.equal(liveToDemand.tools, 'demand');
  assert.match(liveToDemand.note, /还会留一会儿/);
  const back = captureSwitchPlan({ mode: 'demand', next: 'live', videoOn: true, tools: true });
  assert.equal(back.reconnect, false);
  assert.equal(back.tools, 'live');
  const firstLive = captureSwitchPlan({ mode: 'demand', next: 'live', videoOn: false, tools: true });
  assert.equal(firstLive.reconnect, true);
  assert.match(firstLive.note, /新开一条连接/);
  assert.match(firstLive.note, /计时接着算/);
  const plain = captureSwitchPlan({ mode: 'live', next: 'demand', videoOn: true, tools: false });
  assert.equal(plain.tools, 'omit');
  assert.match(plain.note, /没有工具/);
  assert.equal(captureSwitchPlan({ mode: 'live', next: 'live', videoOn: true, tools: true }).changed, false);
});

test('on-demand retries a timed-out look once', async () => {
  FakeSocket.failCommit = true;
  const pending = analyzeFrame({ ...common, question: '再看' });
  open(FakeSocket.latest);
  await new Promise((resolve) => { setTimeout(resolve, 0); });
  FakeSocket.failCommit = false;
  const socket = FakeSocket.latest;
  open(socket);
  assert.equal(await pending, '桌上有杯子');
  assert.notEqual(socket, null);
});
