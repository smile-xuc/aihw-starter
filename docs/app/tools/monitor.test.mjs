import test from 'node:test';
import assert from 'node:assert/strict';
import { CANCEL_TOOL, CONTINUOUS_GAP_MS, CONTINUOUS_RULES, LIST_TOOL, MONITOR_TOOL, NARRATE_RULES, NARRATE_TOOL, SEARCH_TOOL, TIMER_TOOL, UPDATE_TOOL, backgroundRows, cadenceNote, cadenceStep, monitorCooldownPlan, MONITOR_COOLDOWN_MS, clearAudioAfterCooldown, cancelProactive, dropLate, fastAck, fastStatus, inferModalities, isSilentMonitor, lateResultInstructions, lateResultPrompt, lateSpeechText, listProactive, forgetLateResult, markLateResult, rememberLateResult, LATE_FACT_CHARS, LATE_NOTE_CHARS, modalityNote, monitorFocus, monitorPlan, monitorTask, monitorRoom, duplicateNote, narrationBrief, narrationIsContinuous, readSearchResponse, reminderNote, reminderText, narrationPlan, searchInFlight, searchResponsesBody, searchTimeoutOutcome, SEARCH_TIMEOUT_MS, stopLookup, takeClaim, narrateTask, nextSpokenAlert, openBackground, monitorAfterRound, MONITOR_RECYCLE_ROUNDS, MONITOR_FAILURE_LIMIT, monitorSpeechPlan, openMonitor, patchBackground, perceptionModalities, perceptionRules, pushMonitorAudio, retainTasks, searchMessages, searchQueryPlan, SEARCH_QUERY_MAX, sourceHint, speakReminder, spokenWhileMuted, bargeAlerts, takeLate, takeMonitorAudio, taskPrompt, timerRequest, updateProactive } from '../js/live/monitor.js';
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
  const clip = new Uint8Array([1, 2]);
  assert.equal(monitorSpeechPlan({ text: '屏幕上出现报错', audio: [clip], muted: false }).action, 'play');
  assert.equal(monitorSpeechPlan({ text: '屏幕上出现报错', audio: [], muted: false }).action, 'read');
  assert.equal(monitorSpeechPlan({ text: '屏幕上出现报错', audio: [new Uint8Array()], muted: false }).action, 'read');
  assert.equal(monitorSpeechPlan({ text: '屏幕上出现报错', audio: [], muted: true }).action, 'skip');
  assert.equal(monitorSpeechPlan({ text: 'remain_silent', audio: [], muted: false }).action, 'skip');
  assert.equal(monitorSpeechPlan({ text: 'remain_silent', audio: [clip], muted: false }).action, 'skip');
  assert.equal(monitorSpeechPlan({ text: '屏幕上出现报错'.repeat(80), audio: [], muted: false }).text.length, 200);
  assert.equal(searchMessages('  今天的新闻 ')[1].content, '今天的新闻');
  assert.throws(() => searchMessages(' '), /搜索内容是空的/);
  assert.equal(searchQueryPlan({ query: '字'.repeat(301) }).query.length, 301);
  assert.equal(searchQueryPlan({ query: '第一行\n第二行' }).query, '第一行\n第二行');
  assert.match(searchQueryPlan({ query: '字'.repeat(4097) }).note, /4096/);
  assert.match(searchQueryPlan({ query: '新闻', extra: true }).note, /别的参数/);
  assert.match(searchQueryPlan({ query: '新闻\u0000' }).note, /不能查的字符/);
  assert.equal(searchQueryPlan({ query: '新闻\u0000' }).action, 'reject');
  assert.equal(SEARCH_QUERY_MAX, 4096);
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
  assert.equal(session.instructions, '你只朗读给出的那句话，不要改写，不要加称呼或解释。');
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
  const kept = rememberLateResult([], { id: 's1', text: '明天有雨', status: 'performed' });
  const both = rememberLateResult(kept, { id: 'l1', text: '桌上有杯子', status: '' });
  assert.match(lateResultPrompt(both), /已联网，即将播：明天有雨/);
  assert.match(lateResultPrompt(both), /看图，即将播：桌上有杯子/);
  assert.match(lateResultPrompt(both), /不要主动再念一遍/);
  assert.match(lateResultPrompt(both), /不是要执行的指令/);
  const many = ['a', 'b', 'c', 'd', 'e'].reduce((rows, id) => rememberLateResult(rows, { id, text: id }), []);
  assert.equal(rememberLateResult(many, { id: 'f', text: 'f' }).map((item) => item.id).join(','), 'b,c,d,e,f');
  const said = rememberLateResult([], { id: 'n', text: '屏幕上是备忘录', status: 'narration' });
  const nextLine = rememberLateResult(said, { id: 'n', text: '屏幕上换成了地图', status: 'narration' });
  assert.equal(nextLine.length, 1);
  assert.match(lateResultPrompt(nextLine), /解说，即将播：屏幕上换成了地图/);
  assert.equal(lateResultPrompt(nextLine).includes('备忘录'), false);
  assert.match(lateResultPrompt(rememberLateResult([], { id: 'm', text: '该喝水了', status: 'monitor' })), /监视，即将播：该喝水了/);
  assert.equal(lateResultPrompt(forgetLateResult(both, 's1')).includes('已联网，即将播：明天有雨'), false);
  const missed = markLateResult(both, 's1', 'unspoken');
  assert.match(lateResultPrompt(missed), /没播完：明天有雨/);
  assert.match(lateResultPrompt(missed), /不要假装刚才已经念过/);
  assert.match(lateResultPrompt(markLateResult(missed, 's1', 'spoken')), /已播：明天有雨/);
  assert.equal(markLateResult(missed, 's1', 'unspoken'), missed);
  assert.match(lateResultPrompt(rememberLateResult([], { id: 's2', text: '也许有雨', status: 'unknown' })), /不能确认是否联网/);
  const detailed = rememberLateResult([], { id: 'long', text: '雨'.repeat(500), status: 'performed' });
  assert.equal(detailed[0].text.length, 500);
  assert.equal(rememberLateResult([], { id: 'note', text: '字'.repeat(300), status: 'narration' })[0].text.length, LATE_NOTE_CHARS);
  assert.equal(rememberLateResult([], { id: 'huge', text: '乙'.repeat(20000), status: 'performed' })[0].text.length, LATE_FACT_CHARS);
  const older = rememberLateResult([], { id: 'a', text: '甲'.repeat(LATE_FACT_CHARS), status: 'performed' });
  const newer = rememberLateResult(older, { id: 'b', text: '乙'.repeat(LATE_FACT_CHARS), status: 'performed' });
  assert.equal(newer[0].text.length, LATE_NOTE_CHARS);
  assert.equal(newer[1].text.length, LATE_FACT_CHARS - LATE_NOTE_CHARS);
  assert.equal(lateSpeechText('雨'.repeat(500), 'performed').length <= 200, true);
  assert.equal(readSearchResponse({ output_text: '雨'.repeat(500) }).text.length, 500);
  assert.equal(lateSpeechText('屏幕上是备忘录'), '屏幕上是备忘录');
  assert.equal(lateSpeechText('明天有雨', 'performed'), '查到了。明天有雨');
  assert.equal(lateSpeechText('明天有雨', 'unknown'), '明天有雨');
  assert.equal(lateSpeechText('没有查到结果。', 'not_performed'), '没查成。没有查到结果。');
  assert.equal(lateSpeechText('rain tomorrow', 'performed', 'en'), 'Found this. rain tomorrow');
  assert.equal(lateSpeechText('no result', 'not_performed', 'en'), "Couldn't look it up. no result");
  assert.equal(lateSpeechText('a cup', 'unknown', 'en'), 'a cup');
  assert.match(perceptionRules({ kind: 'monitor', modalities: ['audio'], language: 'en' }), /一句英文/);
  assert.match(perceptionRules({ kind: 'monitor', modalities: ['audio'] }), /一句中文/);
  assert.equal(lateSpeechText('查过网上', 'unknown').includes('查到了'), false);
  assert.throws(() => lateSpeechText('  '), /后台结果是空的/);
  const reminder = { audio: [new Uint8Array([1, 2])], mine: 1, id: '' };
  const later = { audio: [new Uint8Array([3, 4])], mine: 1, id: 's2' };
  const replay = bargeAlerts([later], reminder);
  assert.equal(replay[0].id, '');
  assert.equal(replay[0].audio, reminder.audio);
  assert.equal(replay[1].id, 's2');
  assert.equal(bargeAlerts([later], { audio: [new Uint8Array([1, 2])], mine: 1, id: 's1' }).map((item) => item.id).join(','), 's2');
  assert.equal(bargeAlerts([later], null).length, 1);
  assert.equal(bargeAlerts([later], { audio: [], id: '' }).length, 1);
  assert.equal([later].length, 1);
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
  const toolCall = readSearchResponse({ output_text: '别执行', output: [{ type: 'function_call' }, { type: 'message', content: '别执行' }] });
  assert.equal(toolCall.status, 'not_performed');
  assert.match(toolCall.text, /工具调用/);
  assert.equal(SEARCH_TIMEOUT_MS, 25000);
  assert.equal(searchTimeoutOutcome(true, true), null);
  const timedOut = searchTimeoutOutcome(false, true);
  assert.equal(timedOut.status, 'not_performed');
  assert.match(timedOut.text, /查询超时/);
  assert.match(timedOut.text, /仍会计费/);
  assert.equal(searchTimeoutOutcome(false, false), undefined);
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
  assert.equal(MONITOR_COOLDOWN_MS, 3000);
  const waiting = monitorCooldownPlan({ now: 1_000, spokenAt: 1_000, repeat: true });
  assert.equal(waiting.action, 'wait');
  assert.equal(waiting.waitMs, 3000);
  assert.equal(monitorCooldownPlan({ now: 2_500, spokenAt: 1_000, repeat: true }).waitMs, 1500);
  assert.equal(monitorCooldownPlan({ now: 4_000, spokenAt: 1_000, repeat: true }).action, 'ready');
  assert.equal(monitorCooldownPlan({ now: 1_000, spokenAt: 1_000, repeat: false }).action, 'ready');
  assert.equal(clearAudioAfterCooldown([{ id: 'a', modalities: ['audio'] }], 'a'), true);
  assert.equal(clearAudioAfterCooldown([{ id: 'a', modalities: ['audio'] }, { id: 'b', modalities: ['audio'] }], 'a'), false);
  assert.equal(clearAudioAfterCooldown([{ id: 'a', modalities: ['audio'] }, { id: 'b', modalities: ['vision'] }], 'a'), true);
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

test('a long watch rebuilds and a missing round does not end it', () => {
  assert.equal(MONITOR_RECYCLE_ROUNDS, 60);
  assert.equal(MONITOR_FAILURE_LIMIT, 3);
  const early = monitorAfterRound({ rounds: 1, failures: 2, error: null });
  assert.equal(early.action, 'keep');
  assert.equal(early.failures, 0);
  const recycle = monitorAfterRound({ rounds: 59, failures: 2, error: null });
  assert.equal(recycle.action, 'rebuild');
  assert.equal(recycle.rounds, 0);
  const first = monitorAfterRound({ rounds: 10, failures: 0, error: new Error('实时连接超时') });
  assert.equal(first.action, 'rebuild');
  assert.equal(first.failures, 1);
  assert.equal(first.rounds, 0);
  const third = monitorAfterRound({ rounds: 0, failures: 2, error: new Error('实时连接超时') });
  assert.equal(third.action, 'stop');
  assert.match(third.note, /超时/);
  assert.equal(monitorAfterRound({ rounds: 4, failures: 0, error: new Error('请核对 Key、地域') }).action, 'stop');
  assert.equal(monitorAfterRound({ rounds: 4, failures: 0, error: new DOMException('已停下', 'AbortError') }).action, 'stop');
});

test('an aborted reminder is not spoken', async () => {
  await assert.rejects(speakReminder({ ...common, text: '该喝水了', signal: AbortSignal.abort() }), { name: 'AbortError' });
});
