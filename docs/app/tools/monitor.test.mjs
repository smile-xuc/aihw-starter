import test from 'node:test';
import assert from 'node:assert/strict';
import { CANCEL_TOOL, CONTINUOUS_GAP_MS, CONTINUOUS_RULES, LIST_TOOL, MONITOR_TOOL, NARRATE_RULES, NARRATE_TOOL, SEARCH_TOOL, TIMER_TOOL, UPDATE_TOOL, backgroundRows, cadenceNote, cadenceStep, cancelProactive, dropLate, fastAck, fastStatus, inferModalities, isSilentMonitor, lateResultInstructions, listProactive, modalityNote, monitorFocus, monitorPlan, monitorTask, monitorRoom, duplicateNote, narrationBrief, narrationIsContinuous, readSearchResponse, reminderNote, reminderText, narrationPlan, searchInFlight, searchResponsesBody, stopLookup, takeClaim, narrateTask, nextSpokenAlert, openBackground, openMonitor, patchBackground, perceptionModalities, perceptionRules, pushMonitorAudio, retainTasks, searchMessages, sourceHint, speakReminder, spokenWhileMuted, takeLate, takeMonitorAudio, taskPrompt, timerRequest, updateProactive } from '../js/live/monitor.js';
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

test('cancel stops one named task, or every task only when asked', () => {
  const tasks = [
    { id: 'm', kind: 'monitor', title: '出现报错' },
    { id: 't', kind: 'timer', title: '喝水' },
  ];
  assert.equal(CANCEL_TOOL.function.name, 'cancel_proactive_task');
  assert.equal(LIST_TOOL.function.name, 'list_proactive_tasks');
  const one = cancelProactive(tasks, { target_title: '出现报错' });
  assert.deepEqual(one.ids, ['m']);
  assert.match(one.receipt, /已停下：监视「出现报错」/);
  const partial = cancelProactive(tasks, { target_title_contains: '喝' });
  assert.deepEqual(partial.ids, ['t']);
  const all = cancelProactive(tasks, { all: true });
  assert.deepEqual(all.ids, ['m', 't']);
  const mixed = cancelProactive(tasks, { all: true, target_title: '喝水' });
  assert.deepEqual(mixed.ids, []);
  assert.match(mixed.receipt, /没有停下/);
  const ambiguous = cancelProactive([
    { id: 'a', kind: 'timer', title: '喝水' },
    { id: 'b', kind: 'timer', title: '喝水提醒' },
  ], { target_title_contains: '喝水' });
  assert.deepEqual(ambiguous.ids, []);
  assert.match(ambiguous.receipt, /不止一项/);
  const adjacent = cancelProactive(tasks, {}, 't');
  assert.deepEqual(adjacent.ids, ['t']);
  const missing = cancelProactive(tasks, {});
  assert.match(missing.receipt, /没有刚创建的任务/);
  assert.equal(listProactive([]), '现在没有主动任务。');
  assert.match(listProactive(tasks), /监视「出现报错」/);
  assert.match(taskPrompt(tasks), /cancel_proactive_task/);
  assert.equal(taskPrompt([]), '');
  assert.equal(cancelProactive(tasks, { all: true }).ids.length, tasks.length);
  assert.deepEqual(tasks.map((item) => item.id), ['m', 't']);
});

test('speaker mute drops queued alerts instead of replaying them', () => {
  const queued = [{ audio: [new Uint8Array([1, 2])] }, { audio: [] }];
  assert.equal(spokenWhileMuted(queued, true).length, 0);
  assert.equal(spokenWhileMuted(queued, false).length, 1);
  assert.equal(queued.length, 2);
});

test('update changes one active task and refuses a different kind', () => {
  assert.equal(UPDATE_TOOL.function.name, 'update_proactive_task');
  const tasks = [
    { id: 'm', kind: 'monitor', title: '出现报错' },
    { id: 't', kind: 'timer', title: '喝水', reminder: '喝水' },
  ];
  const changed = updateProactive(tasks, { target_title: '出现报错', condition: '只看红字' });
  assert.equal(changed.id, 'm');
  assert.deepEqual(changed.patch, { condition: '只看红字' });
  assert.match(changed.receipt, /下一轮按新的来/);
  const wrong = updateProactive(tasks, { target_title_contains: '报错', narration_focus: '红字' });
  assert.equal(wrong.patch, null);
  assert.match(wrong.receipt, /监视不能改成解说/);
  const repeat = updateProactive(tasks, { target_title: '出现报错', repeat: false });
  assert.equal(repeat.patch.repeat, false);
  assert.match(repeat.receipt, /只提醒一次/);
  assert.match(updateProactive(tasks, { target_title: '出现报错', repeat: 'once' }).receipt, /必须是布尔值/);
  const timer = updateProactive(tasks, { target_title: '喝水', duration_sec: 90, reminder_text: '站起来' });
  assert.equal(timer.patch.seconds, 90);
  assert.equal(timer.patch.reminder, '站起来');
  assert.match(updateProactive(tasks, { target_title_contains: '喝', condition: '红字' }).receipt, /不止一项|到点提醒不能改/);
  assert.match(updateProactive(tasks, { condition: '红字' }).receipt, /请说明要改哪一项/);
  assert.equal(updateProactive(tasks, { target_title: '出现报错', condition: '出现报错' }).patch, null);
  assert.deepEqual(tasks[0], { id: 'm', kind: 'monitor', title: '出现报错' });
});

test('an updated monitor focus is sent on the next round', async () => {
  const monitor = openMonitor(common);
  open(FakeSocket.latest);
  await monitor.ready;
  await monitor.round(frames);
  monitor.setFocus('只判断这个条件：只看红字');
  await monitor.round(frames);
  const creates = FakeSocket.latest.sent.filter((item) => item.type === 'response.create');
  assert.equal(creates[0].response.instructions, '只判断这个条件：出现报错时提醒');
  assert.equal(creates[1].response.instructions, '只判断这个条件：只看红字');
  monitor.close();
});

test('continuous screen reports and body alerts are accepted before the result exists', () => {
  assert.equal(narrationIsContinuous('从现在开始持续的报告我手机屏幕里的内容'), true);
  assert.equal(narrationIsContinuous('手机屏幕里的内容'), true);
  assert.equal(narrationIsContinuous('画面上的变化'), false);
  const screen = narrationPlan('手机屏幕里的内容');
  assert.equal(screen.continuous, true);
  assert.equal(screen.gapMs, CONTINUOUS_GAP_MS);
  assert.deepEqual(screen.modalities, ['vision']);
  assert.match(screen.rules, /不要输出 remain_silent/);
  assert.match(screen.rules, /没有声音/);
  assert.equal(narrationPlan('持续报告声音和画面').rules, CONTINUOUS_RULES);
  assert.deepEqual(narrationPlan('持续报告声音和画面').modalities, ['vision', 'audio']);
  assert.match(narrationPlan('画面上的变化').rules, /没有声音/);
  assert.equal(narrationPlan('画面上的变化').gapMs, 0);
  assert.equal(narrationPlan('声音和画面').rules, NARRATE_RULES);
  assert.equal(narrationBrief(''), '');
  assert.match(narrationBrief('  持续报告屏幕，每次只说一句很短的话  '), /按用户原话的详略来讲：持续报告屏幕，每次只说一句很短的话/);
  assert.ok(narrationBrief('字'.repeat(300)).length <= '按用户原话的详略来讲：'.length + 200);
  assert.match(narrationPlan('手机屏幕里的内容').rules, /用户原话/);
  const claims = new Set();
  assert.equal(takeClaim(claims, 'monitor', '听到咳嗽'), true);
  assert.equal(takeClaim(claims, 'monitor', ' 听到咳嗽 '), false);
  assert.equal(takeClaim(claims, 'monitor', '有人叫我名字'), true);
  assert.equal(takeClaim(claims, 'search', ''), false);
  assert.equal(searchInFlight([{ id: 's', lane: 'search', title: '今天天气', state: 'running' }], ' 今天天气 '), true);
  assert.equal(searchInFlight([{ id: 's', lane: 'search', title: '今天天气', state: 'delivered' }], '今天天气'), false);
  assert.match(duplicateNote('search'), /不要再查一次/);
  assert.match(duplicateNote('monitor'), /不要再开一条/);
  assert.match(duplicateNote('timer'), /不要再设一次/);
  assert.match(fastAck('narration'), /已交给后台持续报告/);
  assert.match(fastAck('monitor'), /不要说已经听到或看到了/);
  assert.match(fastAck('search'), /这一轮不要回答问题/);
  assert.match(fastStatus('narration', '手机屏幕里的内容'), /后台已受理：持续报告/);
  assert.match(fastStatus('monitor', '咳嗽了就提醒'), /监视「咳嗽了就提醒」/);
  assert.match(sourceHint('camera', '手机屏幕里的内容'), /点「屏幕」共享/);
  assert.equal(sourceHint('screen', '手机屏幕里的内容'), '');
  assert.equal(sourceHint('camera', '咳嗽了就提醒'), '');
  const jobs = openBackground([], { id: 'n1', lane: 'narration', title: '手机屏幕里的内容' });
  const running = patchBackground(jobs, 'n1', { state: 'running', note: '正在看这一路画面' });
  assert.match(backgroundRows(running)[0], /解说「手机屏幕里的内容」进行中。正在看这一路画面/);
  const search = openBackground([], { id: 's1', lane: 'search', title: '今天天气' });
  const stopped = stopLookup(patchBackground(search, 's1', { state: 'running', note: '正在查' }), 's1');
  assert.match(backgroundRows(stopped)[0], /查询「今天天气」已停下。已停下，结果不说了/);
  assert.deepEqual(dropLate([{ id: 's1', text: '晴' }, { id: 's2', text: '杯子' }], 's1'), [{ id: 's2', text: '杯子' }]);
  assert.match(backgroundRows(stopLookup(patchBackground(search, 's1', { state: 'delivered', note: '晴' }), 's1'))[0], /已停下/);
  assert.throws(() => stopLookup(stopped, 's1'), /这项已经结束/);
  assert.throws(() => stopLookup(running, 'n1'), /这项不能停/);
  assert.equal(patchBackground(running, 'missing', { state: 'failed' }).length, 1);
  const waiting = [{ text: '屏幕上是备忘录' }];
  assert.equal(takeLate(waiting, false).item, null);
  assert.equal(takeLate(waiting, true).item.text, '屏幕上是备忘录');
  assert.equal(waiting.length, 1);
  assert.match(lateResultInstructions('屏幕上是备忘录'), /不要调用工具/);
  assert.match(lateResultInstructions('明天有雨', 'performed'), /刚联网查到/);
  assert.match(lateResultInstructions('明天有雨', 'unknown'), /不要说已经查过网上/);
  assert.match(lateResultInstructions('没有查到结果。', 'not_performed'), /没有完成联网/);
  assert.throws(() => lateResultInstructions('  '), /后台结果是空的/);
  const request = searchResponsesBody('qwen3.8-omni-flash', '今天天气');
  assert.deepEqual(request.tools, [{ type: 'web_search' }]);
  assert.equal(request.input, '今天天气');
  assert.equal(readSearchResponse({
    output_text: '明天有雨',
    output: [{ type: 'web_search_call', status: 'completed' }, { type: 'message', content: [{ text: '明天有雨' }] }],
  }).status, 'performed');
  assert.equal(readSearchResponse({ output_text: '也许会下雨' }).status, 'unknown');
  assert.equal(readSearchResponse({ output: [{ type: 'web_search_call', status: 'failed' }] }).status, 'not_performed');
  assert.equal(readSearchResponse({ usage: { x_tools: { web_search: 1 } }, output_text: '有记录' }).status, 'performed');
  assert.match(MONITOR_TOOL.function.description, /咳嗽/);
  assert.match(NARRATE_TOOL.function.description, /持续报告/);
  assert.match(SEARCH_TOOL.function.description, /回执里没有答案/);
  const tasks = retainTasks(
    [{ id: 'n', kind: 'narration', title: '屏幕' }, { id: 't', kind: 'timer', title: '喝水' }],
    { id: 'm', kind: 'monitor', title: '咳嗽' },
  );
  assert.deepEqual(tasks.map((item) => item.id), ['n', 't', 'm']);
  const replaced = retainTasks(tasks, { id: 'n2', kind: 'narration', title: '新的屏幕' });
  assert.deepEqual(replaced.map((item) => item.id), ['t', 'm', 'n2']);
  const second = retainTasks(replaced, { id: 'm2', kind: 'monitor', title: '有人叫我名字' });
  assert.deepEqual(second.map((item) => item.id), ['t', 'm', 'n2', 'm2']);
  assert.equal(monitorRoom(second, '门铃响了').ok, false);
  assert.deepEqual(monitorRoom(second, '咳嗽'), { ok: true, replace: true });
  const renewed = retainTasks(second, { id: 'm3', kind: 'monitor', title: '咳嗽' });
  assert.deepEqual(renewed.map((item) => item.id), ['t', 'n2', 'm2', 'm3']);
});

test('a cough reminder speaks the requested sentence instead of only reporting the cough', () => {
  const explicit = monitorPlan({ condition: '听到咳嗽', trigger_response: '该喝水了' });
  assert.equal(explicit.response, '该喝水了');
  assert.equal(monitorPlan({ condition: '咳嗽了就提醒我喝水' }).response, '喝水');
  assert.equal(monitorPlan({ condition: '咳嗽了提醒我一次' }).response, '');
  assert.equal(monitorPlan({ condition: '从现在开始关注我的身体' }).response, '');
  assert.equal(reminderText('听到咳嗽', '一次'), '');
  assert.match(monitorFocus('听到咳嗽', '该喝水了'), /条件发生时只说这句提醒：该喝水了/);
  assert.match(reminderNote('该喝水了'), /发生时会说「该喝水了」/);
  assert.equal(reminderNote(''), '');
  assert.match(MONITOR_TOOL.function.parameters.properties.trigger_response.description, /该喝水了/);
  assert.match(listProactive([{ id: 'm', kind: 'monitor', title: '听到咳嗽', response: '该喝水了', modalities: ['audio'] }]), /提醒：该喝水了/);
  const said = updateProactive(
    [{ id: 'm', kind: 'monitor', title: '听到咳嗽', condition: '听到咳嗽', modalities: ['audio'] }],
    { target_title: '听到咳嗽', trigger_response: '该喝水了' },
  );
  assert.equal(said.patch.response, '该喝水了');
  assert.match(said.receipt, /说法「该喝水了」/);
});

test('a one-time cough alert stops after it speaks, and an ongoing watch waits out the same occurrence', () => {
  assert.equal(monitorPlan({ condition: '咳嗽了提醒我一次' }).repeat, false);
  assert.equal(monitorPlan({ condition: '从现在开始关注身体', repeat: true }).repeat, true);
  assert.equal(monitorPlan({ condition: '从现在开始关注', repeat: false }).repeat, false);
  assert.equal(monitorPlan({ condition: '出现报错' }).repeat, true);
  assert.match(cadenceNote(false), /只提醒一次/);
  assert.match(cadenceNote(true), /同一次里不重复说/);
  assert.match(MONITOR_TOOL.function.description, /一次/);
  assert.match(listProactive([{ id: 'm', kind: 'monitor', title: '咳嗽', repeat: false }]), /只提醒一次/);
  const onceSilent = cadenceStep({ kind: 'monitor', silent: true, once: true, armed: true });
  assert.equal(onceSilent.speak, false);
  assert.equal(onceSilent.stop, false);
  const onceHit = cadenceStep({ kind: 'monitor', silent: false, once: true, armed: onceSilent.armed });
  assert.equal(onceHit.speak, true);
  assert.equal(onceHit.stop, true);
  assert.match(onceHit.note, /已经提醒过一次/);
  const first = cadenceStep({ kind: 'monitor', silent: false, once: false, armed: true });
  assert.equal(first.speak, true);
  assert.equal(first.stop, false);
  const same = cadenceStep({ kind: 'monitor', silent: false, once: false, armed: first.armed });
  assert.equal(same.speak, false);
  assert.match(same.note, /不重复提醒/);
  const gap = cadenceStep({ kind: 'monitor', silent: true, once: false, armed: same.armed });
  assert.equal(gap.armed, true);
  const again = cadenceStep({ kind: 'monitor', silent: false, once: false, armed: gap.armed });
  assert.equal(again.speak, true);
  const narrate = cadenceStep({ kind: 'narration', silent: false, once: false, armed: false });
  assert.equal(narrate.speak, true);
  assert.equal(narrate.stop, false);
  const narrateQuiet = cadenceStep({ kind: 'narration', silent: true, once: false, armed: true });
  assert.equal(narrateQuiet.speak, false);
  assert.match(narrateQuiet.note, /没有要补充的/);
});

test('screen reports look without the microphone, and a cough watch listens without frames', async () => {
  assert.deepEqual(inferModalities('从现在开始持续的报告我手机屏幕里的内容'), ['vision']);
  assert.deepEqual(inferModalities('从现在开始关注我的身体'), ['audio']);
  assert.deepEqual(inferModalities('咳嗽了提醒我一次'), ['audio']);
  assert.deepEqual(inferModalities('出现报错'), ['vision', 'audio']);
  assert.deepEqual(monitorPlan({ condition: '手机屏幕', modalities: ['audio'] }).modalities, ['audio']);
  assert.deepEqual(perceptionModalities(['视频', '声音']), ['vision', 'audio']);
  assert.throws(() => perceptionModalities(['text']), /只能用 vision 或 audio/);
  assert.match(modalityNote(['vision']), /只看画面/);
  assert.match(modalityNote(['audio']), /只听声音/);
  assert.equal(modalityNote(['vision', 'audio']), '');
  const cough = monitorPlan({ condition: '咳嗽了提醒我一次' });
  assert.equal(cough.repeat, false);
  assert.deepEqual(cough.modalities, ['audio']);
  const listen = openMonitor({ ...common, video: false, condition: '咳嗽', rules: perceptionRules({ kind: 'monitor', continuous: false, modalities: ['audio'] }) });
  open(FakeSocket.latest);
  await listen.ready;
  const listenSession = FakeSocket.latest.sent.find((item) => item.type === 'session.update').session;
  assert.equal(listenSession.video, undefined);
  assert.match(listenSession.instructions, /没有画面/);
  const heard = [new Uint8Array(32000), new Uint8Array(32000)];
  heard[0][0] = 4;
  await listen.round(null, heard, { vision: false, audio: true });
  assert.equal(FakeSocket.latest.sent.filter((item) => item.type === 'input_image_buffer.append').length, 0);
  assert.equal(decodeBase64(FakeSocket.latest.sent.find((item) => item.type === 'input_audio_buffer.append').audio)[0], 4);
  listen.close();
  const screen = openMonitor({ ...common, condition: '手机屏幕', rules: narrationPlan('手机屏幕里的内容').rules });
  open(FakeSocket.latest);
  await screen.ready;
  await screen.round(frames, heard, { vision: true, audio: false });
  assert.equal(FakeSocket.latest.sent.filter((item) => item.type === 'input_image_buffer.append').length, 2);
  assert.equal(decodeBase64(FakeSocket.latest.sent.find((item) => item.type === 'input_audio_buffer.append').audio)[0], 0);
  screen.close();
  const tasks = [{ id: 'm', kind: 'monitor', title: '咳嗽', modalities: ['audio'] }];
  const widened = updateProactive(tasks, { target_title: '咳嗽', modalities: ['vision', 'audio'] });
  assert.deepEqual(widened.patch.modalities, ['vision', 'audio']);
  assert.match(widened.receipt, /又看又听/);
  const narration = updateProactive([{ id: 'n', kind: 'narration', title: '屏幕', focus: '屏幕', modalities: ['vision'] }], { target_title: '屏幕', modalities: ['audio'] });
  assert.deepEqual(narration.patch.modalities, ['audio']);
  assert.match(narration.receipt, /只听声音/);
  assert.match(updateProactive(tasks, { target_title: '咳嗽', modalities: ['text'] }).receipt, /没有改/);
  assert.match(updateProactive([{ id: 't', kind: 'timer', title: '喝水' }], { target_title: '喝水', modalities: ['audio'] }).receipt, /到点提醒不能改/);
  assert.match(listProactive([{ id: 'm', kind: 'monitor', title: '咳嗽', repeat: false, modalities: ['audio'] }]), /只听声音/);
  assert.match(listProactive([{ id: 'n', kind: 'narration', title: '屏幕', modalities: ['vision'] }]), /只看画面/);
});
