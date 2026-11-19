import test from 'node:test';
import assert from 'node:assert/strict';
import { JPEG_LONG_EDGE, JPEG_QUALITY_MIN, JPEG_QUALITY_START, LOOK_TOOL, VISUAL_ATTEMPTS, VISUAL_QUERY_MAX, VISUAL_RETRY_INSTRUCTIONS, VISUAL_TIMEOUT_MS, analyzeFrame, canRetryVisual, captureSwitchPlan, nextJpegFit, pictureOpen, silencePcm, visualQueryPlan, visualQuestion, visualRetryPlan } from '../js/live/on-demand.js';
import { decodeBase64 } from '../js/live/realtime-omni.js';

class FakeSocket {
  static latest = null;
  static failCommit = false;
  static repeat = false;
  static tool = false;
  static sockets = [];
  constructor(url) { this.url = url; this.readyState = 1; this.sent = []; FakeSocket.latest = this; FakeSocket.sockets.push(this); }
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
        if (FakeSocket.tool) {
          this.onmessage?.({ data: JSON.stringify({ type: 'response.output_item.added', item: { type: 'function_call' } }) });
          this.onmessage?.({ data: JSON.stringify({ type: 'response.done', response: { status: 'completed', output: [{ type: 'function_call' }] } }) });
          return;
        }
        if (FakeSocket.repeat) {
          this.onmessage?.({ data: JSON.stringify({ type: 'response.done', response: { status: 'failed', output: [], error: { code: 'COMMON_ERROR', message: 'model repeat output happened', type: 'server_error', status: 500 } } }) });
          return;
        }
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
  assert.equal(visualQuestion('字'.repeat(500), '').length, 500);
  assert.equal(VISUAL_QUERY_MAX, 4096);
  assert.equal(visualQueryPlan({ query: '  杯子呢 ' }, '别的').question, '杯子呢');
  assert.equal(visualQueryPlan({}, '刚才那句').question, '刚才那句');
  assert.equal(visualQueryPlan({ query: '' }, '刚才那句').action, 'reject');
  assert.equal(visualQueryPlan({ query: '字', extra: 1 }, '').action, 'reject');
  assert.equal(visualQueryPlan({ query: '字'.repeat(4097) }, '').action, 'reject');
  assert.equal(silencePcm(16000, 1).byteLength, 32000);
  assert.equal(LOOK_TOOL.function.name, 'analyze_view');
  assert.equal(canRetryVisual(new Error('看画面超时')), true);
  assert.equal(canRetryVisual(new Error('请核对 Key、地域')), false);
  assert.equal(canRetryVisual(new DOMException('已停下', 'AbortError')), false);
  assert.equal(VISUAL_TIMEOUT_MS, 25000);
  assert.equal(VISUAL_ATTEMPTS, 2);
  assert.equal(visualRetryPlan({ message: '看画面超时', attempt: 1 }).action, 'retry');
  assert.equal(visualRetryPlan({ message: '看画面超时', attempt: 2 }).action, 'stop');
  assert.equal(visualRetryPlan({ code: 'COMMON_ERROR', message: 'model repeat output happened', type: 'server_error', status: 500, attempt: 1 }).action, 'retry');
  assert.equal(visualRetryPlan({ code: 'insufficient_quota', message: '额度不够', attempt: 1 }).action, 'stop');
  assert.equal(visualRetryPlan({ name: 'AbortError', message: '已停下', attempt: 1 }).action, 'stop');
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

test('an oversized frame shrinks before the round is skipped', () => {
  assert.equal(pictureOpen({ videoWidth: 1280, videoHeight: 720 }), true);
  assert.equal(pictureOpen({ videoWidth: 0, videoHeight: 720 }), false);
  const fitted = nextJpegFit({ edge: JPEG_LONG_EDGE, quality: JPEG_QUALITY_START, bytes: 1000, maxBytes: 194560, maxEdge: 1920 });
  assert.equal(fitted.done, true);
  const softer = nextJpegFit({ edge: JPEG_LONG_EDGE, quality: JPEG_QUALITY_START, bytes: 300000, maxBytes: 194560, maxEdge: 1920 });
  assert.equal(softer.done, false);
  assert.equal(softer.edge, JPEG_LONG_EDGE);
  assert.ok(softer.quality < JPEG_QUALITY_START);
  const smaller = nextJpegFit({ edge: JPEG_LONG_EDGE, quality: JPEG_QUALITY_MIN, bytes: 300000, maxBytes: 194560, maxEdge: 1920 });
  assert.equal(smaller.edge, 480);
  assert.equal(smaller.quality, JPEG_QUALITY_START);
  const stopped = nextJpegFit({ edge: 160, quality: JPEG_QUALITY_MIN, bytes: 300000, maxBytes: 194560, maxEdge: 1920 });
  assert.equal(stopped.done, false);
  assert.equal(stopped.edge, undefined);
});

test('on-demand retries a timed-out look once', async () => {
  FakeSocket.failCommit = true;
  FakeSocket.repeat = false;
  FakeSocket.sockets = [];
  const pending = analyzeFrame({ ...common, question: '再看' });
  open(FakeSocket.latest);
  await new Promise((resolve) => { setTimeout(resolve, 0); });
  FakeSocket.failCommit = false;
  const socket = FakeSocket.latest;
  open(socket);
  assert.equal(await pending, '桌上有杯子');
  const session = socket.sent.find((item) => item.type === 'session.update').session;
  assert.match(session.instructions, /两句短话/);
  assert.equal(FakeSocket.sockets.length, 2);
});

test('a repeated screen reading is looked at once more on the same frame', async () => {
  FakeSocket.failCommit = false;
  FakeSocket.repeat = true;
  FakeSocket.sockets = [];
  const pending = analyzeFrame({ ...common, question: '屏幕上有什么' });
  open(FakeSocket.latest);
  await new Promise((resolve) => { setTimeout(resolve, 0); });
  FakeSocket.repeat = false;
  const socket = FakeSocket.latest;
  open(socket);
  assert.equal(await pending, '桌上有杯子');
  assert.match(socket.sent.find((item) => item.type === 'session.update').session.instructions, new RegExp(VISUAL_RETRY_INSTRUCTIONS));
  assert.equal(FakeSocket.sockets.length, 2);
});

test('two repeated screen readings stop without a third look', async () => {
  FakeSocket.failCommit = false;
  FakeSocket.repeat = true;
  FakeSocket.sockets = [];
  const pending = analyzeFrame({ ...common, question: '屏幕上有什么' });
  open(FakeSocket.latest);
  await new Promise((resolve) => { setTimeout(resolve, 0); });
  open(FakeSocket.latest);
  await assert.rejects(pending, /看了两次/);
  assert.equal(FakeSocket.sockets.length, 2);
});

test('a tool call during a look is not treated as the picture', async () => {
  FakeSocket.failCommit = false;
  FakeSocket.repeat = false;
  FakeSocket.tool = true;
  FakeSocket.sockets = [];
  const pending = analyzeFrame({ ...common, question: '屏幕上有什么' });
  open(FakeSocket.latest);
  await assert.rejects(pending, /工具调用/);
  assert.equal(FakeSocket.sockets.length, 1);
  FakeSocket.tool = false;
});
