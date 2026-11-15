import test from 'node:test';
import assert from 'node:assert/strict';
import { MONITOR_TOOL, NARRATE_RULES, NARRATE_TOOL, SEARCH_TOOL, TIMER_TOOL, isSilentMonitor, monitorTask, narrateTask, nextSpokenAlert, openMonitor, pushMonitorAudio, searchMessages, speakReminder, takeMonitorAudio, timerRequest } from '../js/live/monitor.js';
import { decodeBase64 } from '../js/live/realtime-omni.js';

class FakeSocket {
  static latest = null;
  constructor(url) { this.url = url; this.readyState = 1; this.sent = []; FakeSocket.latest = this; }
  send(data) {
    const message = JSON.parse(data);
    this.sent.push(message);
    if (message.type === 'input_audio_buffer.commit') {
      queueMicrotask(() => this.onmessage?.({ data: JSON.stringify({ type: 'input_audio_buffer.committed' }) }));
    }
    if (message.type === 'response.create') {
      const silent = message.response?.instructions;
      queueMicrotask(() => {
        this.onmessage?.({ data: JSON.stringify({ type: 'response.text.delta', delta: silent ? 'remain_silent' : '屏幕上出现报错' }) });
        this.onmessage?.({ data: JSON.stringify({ type: 'response.audio.delta', delta: 'AAA=' }) });
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

const frames = [new Uint8Array([1, 2, 3]), new Uint8Array([4, 5, 6])];
const common = {
  url: 'wss://dashscope.aliyuncs.com/api-ws/v1/realtime?model=qwen3.8-omni-flash-realtime',
  secret: 'sk-not-a-real-key',
  condition: '出现报错时提醒',
  voice: 'Tina',
  inputRate: 16000,
  outputRate: 24000,
  asrModel: 'qwen3-asr-flash-realtime',
  WebSocketImpl: FakeSocket,
};

test('monitor task and search query stay bounded', () => {
  assert.equal(monitorTask('  出现报错  '), '只判断这个条件：出现报错');
  assert.throws(() => monitorTask('   '), /提醒条件是空的/);
  assert.equal(isSilentMonitor('remain_silent'), true);
  assert.equal(isSilentMonitor('屏幕上出现报错'), false);
  assert.equal(searchMessages('  今天的新闻 ')[1].content, '今天的新闻');
  assert.throws(() => searchMessages(' '), /搜索内容是空的/);
  assert.equal(MONITOR_TOOL.function.name, 'create_proactive_monitor');
  assert.equal(SEARCH_TOOL.function.name, 'web_search');
  assert.equal(TIMER_TOOL.function.name, 'create_proactive_timer');
  assert.deepEqual(timerRequest({ delay_sec: '30', message: ' 喝水 ' }), { seconds: 30, text: '喝水' });
  assert.equal(timerRequest({ minutes: 2, text: '休息' }).seconds, 120);
  assert.throws(() => timerRequest({ delay_sec: 2, message: '太短' }), /5 秒到 1 小时/);
  assert.throws(() => timerRequest({ delay_sec: 30, message: ' ' }), /提醒内容是空的/);
});

test('timer speech sends one silent second and the sentence', async () => {
  const pending = speakReminder({ ...common, text: '该喝水了' });
  open(FakeSocket.latest);
  assert.deepEqual((await pending).audio.length, 1);
  const session = FakeSocket.latest.sent.find((item) => item.type === 'session.update').session;
  assert.equal(session.video, undefined);
  assert.equal(session.tools, undefined);
  const created = FakeSocket.latest.sent.find((item) => item.type === 'response.create');
  assert.equal(created.response.instructions, '该喝水了');
  assert.equal(decodeBase64(FakeSocket.latest.sent.find((item) => item.type === 'input_audio_buffer.append').audio).byteLength, 32000);
});

test('monitor sends two new frames and only the first round carries the condition', async () => {
  const monitor = openMonitor(common);
  open(FakeSocket.latest);
  await monitor.ready;
  const session = FakeSocket.latest.sent.find((item) => item.type === 'session.update').session;
  assert.equal(session.turn_detection, null);
  assert.equal(session.tools, undefined);
  assert.equal(session.enable_search, undefined);
  const first = await monitor.round(frames);
  assert.equal(isSilentMonitor(first.text), true);
  const second = await monitor.round([new Uint8Array([7]), new Uint8Array([8])]);
  assert.equal(second.text, '屏幕上出现报错');
  assert.equal(second.audio.length, 1);
  const creates = FakeSocket.latest.sent.filter((item) => item.type === 'response.create');
  assert.equal(creates[0].response.instructions, '只判断这个条件：出现报错时提醒');
  assert.equal(creates[1].response, undefined);
  const images = FakeSocket.latest.sent.filter((item) => item.type === 'input_image_buffer.append').map((item) => item.image);
  assert.equal(new Set(images).size, 4);
  const silence = FakeSocket.latest.sent.filter((item) => item.type === 'input_audio_buffer.append').at(-1).audio;
  assert.equal(decodeBase64(silence)[0], 0);
  monitor.close();
});

test('monitor forwards two seconds of microphone audio', async () => {
  const monitor = openMonitor(common);
  open(FakeSocket.latest);
  await monitor.ready;
  const heard = [new Uint8Array(32000), new Uint8Array(32000)];
  heard[0][0] = 4;
  heard[1][0] = 9;
  await monitor.round(frames, heard);
  const audio = FakeSocket.latest.sent.filter((item) => item.type === 'input_audio_buffer.append');
  assert.equal(decodeBase64(audio[0].audio)[0], 4);
  assert.equal(decodeBase64(audio[1].audio)[0], 9);
  monitor.close();
});

test('monitor keeps the latest two seconds of microphone audio', () => {
  const one = new Uint8Array(32000);
  const two = new Uint8Array(32000);
  one[0] = 4;
  two[0] = 9;
  let state = pushMonitorAudio(null, one, 16000);
  assert.equal(takeMonitorAudio(state, 16000), null);
  state = pushMonitorAudio(state, two, 16000);
  const clips = takeMonitorAudio(state, 16000);
  assert.equal(clips[0][0], 4);
  assert.equal(clips[1][0], 9);
  assert.equal(clips[0].byteLength, 32000);
});

test('narration uses its own rules and only speaks about the focus', async () => {
  assert.equal(narrateTask('  屏幕变化 '), '解说重点：屏幕变化');
  assert.equal(narrateTask(''), '解说刚发生的变化。');
  assert.equal(narrateTask('x'.repeat(300)).length, '解说重点：'.length + 200);
  assert.equal(NARRATE_TOOL.function.name, 'create_live_narration');
  const monitor = openMonitor({ ...common, rules: NARRATE_RULES, task: narrateTask('报错') });
  open(FakeSocket.latest);
  await monitor.ready;
  const session = FakeSocket.latest.sent.find((item) => item.type === 'session.update').session;
  assert.equal(session.instructions, NARRATE_RULES);
  assert.equal(session.turn_detection, null);
  await monitor.round(frames);
  const created = FakeSocket.latest.sent.find((item) => item.type === 'response.create');
  assert.equal(created.response.instructions, '解说重点：报错');
  monitor.close();
});

test('spoken alerts wait out the current utterance and then play in order', () => {
  const first = new Uint8Array([1, 2]);
  const second = new Uint8Array([3, 4]);
  const held = nextSpokenAlert([{ audio: [first] }, { audio: [second] }, { audio: [] }], true);
  assert.equal(held.audio, null);
  assert.equal(held.waiting.length, 2);
  const ready = nextSpokenAlert(held.waiting, false);
  assert.equal(ready.audio[0], first);
  assert.equal(ready.waiting[0].audio[0], second);
  assert.equal(nextSpokenAlert([], false).audio, null);
});
