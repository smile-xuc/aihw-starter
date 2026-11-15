import { liveConstants } from '../data.js';
import { chat, postJson, toBase64 } from '../live/client.js';
import { microphone } from '../live/microphone.js';
import { SAMPLE_RATE } from '../live/pcm.js';
import { BIO_TOOL, EMBED_MODEL, OBSERVE_EVERY_MS, RETRIEVE_TOOL, UPDATER_PROMPT, activeLibrary, applyBio, applyMemoryPatch, bioResult, cleanObservation, clearLibrary, createLibrary, datedEntries, dialogueLines, envCorpus, formatUpdaterInput, isEmptyPatch, localDate, memoryLabel as libraryStatus, observerPrompt, parsePatch, rankWithTime, readStore, recordObservation, redactOperations, rememberTurn, renameLibrary, renderProfile, renderRecent, replaceActive, retrieveMemory, switchLibrary, vectorMatches, vectorsFromEmbedding, writeStore } from '../live/memory-libraries.js';
import { MONITOR_TOOL, NARRATE_RULES, NARRATE_TOOL, SEARCH_TOOL, TIMER_TOOL, isSilentMonitor, monitorTask, narrateTask, openMonitor, pushMonitorAudio, searchMessages, speakReminder, takeMonitorAudio, timerRequest, toolArguments } from '../live/monitor.js';
import { DEMAND_INSTRUCTIONS, LOOK_TOOL, analyzeFrame, visualQuestion } from '../live/on-demand.js';
import { functionCalls } from '../live/product-session.js';
import { connectRealtime, decodeBase64, pcmBase64, realtimeSocketUrl, redactSecret, SEMANTIC_TURN, sessionConfig, splitPcm } from '../live/realtime-omni.js';
import { browserSupport } from '../live/index.js';
import {
  SUMMARY_MODEL, SYSTEM_PROMPT, buildUserContent, clipSummary, encodeWav, instructionsWithMemory, isSessionReturn, nextMemory, nextTextHistory, requestMessages, safeAudioUrl, spokenText, summaryMessages,
} from '../live/session-turn.js';
import { fieldValues, loadCredentials } from '../settings.js';
import { html, mount, mountPage, sheet } from '../ui.js';

export { isSessionReturn };

const SETUP = `#/me?return=${encodeURIComponent('#/session')}`;
const LIVE_INSTRUCTIONS = `你是看说体验里的语音助手，能看到用户打开的摄像头或屏幕，大约每秒一帧。
用口语化中文回答，每次两三句话，先给结论。画面和问题有关时结合画面回答。
需要事实或最新信息时可以联网搜索，并用口语说明依据。
不识别画面中人的身份；看不清就直说，不要编造。
用户可以随时插话。`;
const LIVE_TOOL_INSTRUCTIONS = `你是看说体验里的语音助手，能看到用户打开的摄像头或屏幕，大约每秒一帧。
用口语化中文回答，每次两三句话，先给结论。画面和问题有关时结合画面回答。
需要事实或最新信息时调用 web_search，并用口语说明依据。
用户要求盯着画面或听某种声音、出现情况就提醒时，调用 create_proactive_monitor。没有调用成功就不要说已经在监视。
用户明确说了多久以后提醒时，调用 create_proactive_timer。没有调用成功就不要说已经设好。
用户要求连续解说画面或声音的变化时，调用 create_live_narration。没有明显变化就不要主动开口。
用户说出会在以后多次用到的个人事实时，调用 omnibio 记下。已经记下的不要重复。
用户问起更早的对话、而当前记忆里没有时，调用 omniretrieve，source 用 dialogue。问起以前看到的环境时，source 用 env。用户提到昨天、上周这类时间时，把时间放进 time_range，例如昨天用 [2, 0]，上周用 [14, 1]，不要写进 query。
不识别画面中人的身份；看不清就直说，不要编造。
用户可以随时插话。`;
const SESSION_TOOLS = [SEARCH_TOOL, MONITOR_TOOL, TIMER_TOOL, NARRATE_TOOL, BIO_TOOL, RETRIEVE_TOOL];

function frameDataUrl(video) {
  const width = video.videoWidth;
  const height = video.videoHeight;
  if (!width || !height) throw new Error('画面还没准备好');
  const scale = Math.min(1, 960 / Math.max(width, height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  canvas.getContext('2d', { alpha: false }).drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.8);
}

function captureJpeg(video, maxBytes) {
  const width = video.videoWidth;
  const height = video.videoHeight;
  if (!width || !height) return null;
  const scale = Math.min(1, 640 / Math.max(width, height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  canvas.getContext('2d', { alpha: false }).drawImage(video, 0, 0, canvas.width, canvas.height);
  let quality = 0.72;
  let bytes = null;
  while (quality >= 0.35) {
    const url = canvas.toDataURL('image/jpeg', quality);
    const payload = url.slice(url.indexOf(',') + 1);
    const binary = atob(payload);
    bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    if (bytes.byteLength <= maxBytes) return bytes;
    quality -= 0.12;
  }
  throw new Error('画面太大，实时通话发不出去');
}

function createSpeaker() {
  const Ctx = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (!Ctx) throw new Error('这个浏览器不能播放实时语音');
  const ctx = new Ctx();
  let next = 0;
  const sources = new Set();
  return {
    resume() { return ctx.resume(); },
    playing() { return sources.size > 0 && next > ctx.currentTime + 0.05; },
    interrupt() {
      for (const source of sources) {
        try { source.stop(); } catch { /* 已经播完 */ }
      }
      sources.clear();
      next = ctx.currentTime;
    },
    push(bytes, rate) {
      const even = bytes.byteLength - (bytes.byteLength % 2);
      if (even < 2 || !rate) return;
      const view = new DataView(bytes.buffer, bytes.byteOffset, even);
      const audio = ctx.createBuffer(1, even / 2, rate);
      const channel = audio.getChannelData(0);
      for (let i = 0; i < channel.length; i += 1) {
        const sample = view.getInt16(i * 2, true);
        channel[i] = sample < 0 ? sample / 32768 : sample / 32767;
      }
      const source = ctx.createBufferSource();
      source.buffer = audio;
      source.connect(ctx.destination);
      source.onended = () => sources.delete(source);
      sources.add(source);
      const start = Math.max(ctx.currentTime, next);
      source.start(start);
      next = start + audio.duration;
    },
    close() { this.interrupt(); return ctx.close(); },
  };
}

function joinPcm(chunks) {
  const total = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
  if (!total) return null;
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { out.set(chunk, offset); offset += chunk.byteLength; }
  return out;
}

export function renderSession(view, reg) {
  document.title = '看说体验 · AIHW';
  const saved = loadCredentials('bailian');
  const runnable = [];
  for (const sol of reg.solutions || []) {
    for (const variant of sol.variants || []) {
      const support = browserSupport(reg, sol, variant);
      if (support.status === 'runnable') {
        const href = support.href || `#/s/${sol.id}/${variant.id}`;
        if (href !== '#/session') runnable.push({ href, label: variant.title && variant.title !== '默认' ? `${sol.title} · ${variant.title}` : sol.title });
      }
    }
  }
  const page = mountPage(view, html`
    <header class="app-top"><a class="back" href="#/">← 体验中心</a></header>
    <section class="intro" data-live-session>
      <p class="eyebrow">百炼 Key · 实时看说</p>
      <h1>对着当前画面说话。</h1>
      <p>打开摄像头或屏幕，接通后直接对着画面说话。说完稍停就会回答，插话会停下当前回答。费用记在你的百炼账号上。</p>
    </section>
    ${saved?.values?.DASHSCOPE_API_KEY ? html`<p class="inline-ok">已读取本机百炼 Key。发送前请再看一眼画面。</p>` : html`<div class="mode-banner"><div><strong>还没有百炼 Key</strong><p>看说和下面的网页真跑都要用你自己的 Key。保存后回到这里，不会自动调用模型。</p><a href="${SETUP}">去填写 Key</a></div></div>`}
    <section class="panel session-stage">
      <video data-preview playsinline autoplay muted></video>
      <p class="small" data-status role="status" aria-live="polite">${saved?.values?.DASHSCOPE_API_KEY ? '先打开摄像头或屏幕，再开始实时通话。' : '填写 Key 后才能接通。'}</p>
      <div class="btn-row">
        <button type="button" class="secondary-action" data-source="camera">摄像头</button>
        <button type="button" class="secondary-action" data-source="screen">屏幕</button>
      </div>
      <div class="btn-row" role="group" aria-label="采集模式">
        <button type="button" class="secondary-action" data-capture="live" aria-pressed="true">实时画面</button>
        <button type="button" class="secondary-action" data-capture="demand" aria-pressed="false">按需看一眼</button>
      </div>
      <p class="small" data-meter></p>
      <p class="small" data-realtime-note>实时通话会把 Key 放进发往百炼官方域名的 WebSocket 连接参数。浏览器不能设置 Authorization 头，换临时 Key 的接口也没有跨域。qwen3.8 实时模型通常还要填写业务空间 ID。页面地址、历史和导出不会写入 Key。接通后麦克风保持打开，单次最长 3 分钟。实时画面大约每秒送一帧。问到事实时会另查一次公开信息。主动提醒和连续解说共用一条连接，送上这两秒的麦克风和画面。条件没发生、或画面没有明显变化时不出声。到点提醒会另读一句。这些都另计费。按需看一眼只在问到画面时另开一次看图。最近对话的文字留在这台浏览器。结束通话后用 qwen3.7-plus 更新长期资料和近期事项，给不出可用更新时才收成一段摘要，另计费，不含 Key、画面和录音。可以新建、切换和重命名记忆库，通话中不能换。长期事实记在当前这一套；问更早的对话时用 text-embedding-v4 做向量检索，并和关键词结果合在一起，另计费；向量失败才只留关键词。提到昨天或上周时按时间把对应对话排在前面，最多留 40 句，窗口外的结果仍会保留。打开视觉记忆后，接通时先记一帧，之后大约每 60 秒再用看图模型记一帧，另计费。屏幕会标明这是屏幕内容。</p>
      <label class="field">记忆库<select data-library></select></label>
      <div class="btn-row">
        <button type="button" class="secondary-action" data-library-new>新建记忆库</button>
        <button type="button" class="secondary-action" data-library-rename>重命名</button>
        <button type="button" class="secondary-action" data-forget>清空当前记忆库</button>
        <button type="button" class="secondary-action" data-visual aria-pressed="false">视觉记忆</button>
      </div>
      <p class="small" data-memory></p>
      <label class="field">补充问题，可留空<textarea data-question rows="3" maxlength="500" placeholder="实时通话直接说话；文字只用于「只发这一帧」"></textarea></label>
      <div class="btn-row">
        <button type="button" class="primary-action" data-live>开始实时通话</button>
        <button type="button" class="secondary-action" data-talk>按住说话</button>
        <button type="button" class="secondary-action" data-send>只发这一帧</button>
        <button type="button" class="secondary-action" data-stop hidden>停止</button>
      </div>
      <audio data-player controls hidden></audio>
    </section>
    <section class="panel"><h2>这一轮对话</h2><ol data-log></ol></section>
    <section class="panel">
      <h2>还能用 Key 直接跑的玩法</h2>
      <div class="link-list">${runnable.map((item) => html`<a href="${item.href}">${item.label}</a>`)}</div>
      <p class="small">上面这些都能用同一把 Key 在浏览器里跑。可以说「盯着画面，出现报错就提醒我」「听到警报就提醒我」「一分钟后提醒我喝水」或「解说画面上的变化」或「记住我喜欢喝茶」。记忆库在通话前切换。后台委托要在 Mac 上用 <a href="https://github.com/QwenLM/Qwen-Live-Harness" rel="noopener">Qwen-Live-Harness</a>。</p>
    </section>`);

  const video = page.querySelector('[data-preview]');
  const status = page.querySelector('[data-status]');
  const questionEl = page.querySelector('[data-question]');
  const log = page.querySelector('[data-log]');
  const player = page.querySelector('[data-player]');
  const stopButton = page.querySelector('[data-stop]');
  const liveButton = page.querySelector('[data-live]');
  let stream = null;
  let history = [];
  let chunks = [];
  let recorder = null;
  let stopping = false;
  let wantStop = false;
  let busy = false;
  let abort = null;
  let active = true;
  let call = null;
  let callReady = false;
  let callGeneration = 0;
  let playback = null;
  let liveSpec = null;
  let secret = '';
  let pendingCommit = false;
  let audioPackets = 0;
  let framesSent = 0;
  let assistantLine = null;
  let assistantText = '';
  const loaded = readStore(localStorage);
  let store = loaded.store;
  let memory = [];
  let summary = '';
  let bio = [];
  let memoryAtStart = '[]';
  let folding = false;
  let captureMode = 'live';
  let liveValues = null;
  let lastHeard = '';
  let toolRounds = 0;
  let lookGeneration = 0;
  let monitorStop = null;
  let embedAbort = null;
  let observeTimer = null;
  let observeGeneration = 0;
  let observeAbort = null;
  let videoSource = 'camera';
  let monitorAudio = { parts: [], total: 0 };
  let captureMonitorAudio = false;
  const timers = new Set();
  const memoryLabel = page.querySelector('[data-memory]');
  const librarySelect = page.querySelector('[data-library]');

  const say = (text) => { if (active) status.textContent = redactSecret(text, secret); };
  function syncMemory() {
    const library = activeLibrary(store);
    memory = library.notes;
    summary = library.summary;
    bio = library.bio;
  }
  function saveActive() {
    try { store = writeStore(localStorage, replaceActive(store, { ...activeLibrary(store), bio, notes: memory, summary })); }
    catch { /* 存不下就只留在这一次通话 */ }
    syncMemory();
  }
  function showMemory() {
    if (memoryLabel) memoryLabel.textContent = libraryStatus(store);
    showVisual();
    if (!librarySelect) return;
    const selected = store.activeId;
    librarySelect.replaceChildren();
    for (const item of store.libraries) {
      const option = document.createElement('option');
      option.value = item.id;
      option.textContent = item.name;
      librarySelect.append(option);
    }
    librarySelect.value = selected;
  }
  function showVisual() {
    const button = page.querySelector('[data-visual]');
    if (!button) return;
    const on = store.visual === true;
    button.setAttribute('aria-pressed', on ? 'true' : 'false');
    button.textContent = on ? '视觉记忆开' : '视觉记忆';
  }
  function stopObserver() {
    observeGeneration += 1;
    if (observeTimer) clearInterval(observeTimer);
    observeTimer = null;
    observeAbort?.abort();
    observeAbort = null;
  }
  function startObserver(mine) {
    stopObserver();
    if (!store.visual || !call || mine !== callGeneration) return;
    const generation = observeGeneration;
    void observeFrame(mine, generation);
    observeTimer = setInterval(() => { void observeFrame(mine, generation); }, OBSERVE_EVERY_MS);
  }
  async function observeFrame(mine, generation) {
    if (!store.visual || !call || busy || mine !== callGeneration || generation !== observeGeneration || !liveSpec || !liveValues) return;
    const stack = reg.stacks.get('bailian');
    if (!stack) return;
    let jpeg = null;
    try { jpeg = captureJpeg(video, liveSpec.MAX_FRAME_BYTES); }
    catch (error) {
      if (active && mine === callGeneration && generation === observeGeneration) say(`这一帧没有记下：${redactSecret(error.message, secret)}`);
      return;
    }
    if (!jpeg || generation !== observeGeneration || !call) return;
    const controller = new AbortController();
    observeAbort = controller;
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(20000)]);
    try {
      const turn = await chat({ stack, values: liveValues }, {
        model: liveSpec.OMNI_MODEL,
        messages: [
          { role: 'system', content: observerPrompt(videoSource) },
          { role: 'user', content: buildUserContent({ imageDataUrl: `data:image/jpeg;base64,${toBase64(jpeg)}`, question: '记录这一帧。' }) },
        ],
        modalities: ['text'],
        enable_thinking: false,
      }, { allowNetworkFallback: false, signal });
      if (!active || mine !== callGeneration || generation !== observeGeneration || !store.visual || !call) return;
      const text = cleanObservation(redactSecret(turn.text, secret));
      if (!text) { say('这一帧没有记下：模型没有给出可用的一句。'); return; }
      const library = activeLibrary(store);
      library.env = recordObservation(library, text, Date.now() / 1000);
      saveActive();
      showMemory();
      const line = document.createElement('li');
      line.textContent = `看到：${text}`;
      log.append(line);
    } catch (error) {
      if (!active || mine !== callGeneration || generation !== observeGeneration || error.name === 'AbortError') return;
      say(`这一帧没有记下：${redactSecret(error.message, secret)}`);
    }
  }
  function lockLibrary(on) {
    if (librarySelect) librarySelect.disabled = on;
    for (const button of page.querySelectorAll('[data-library-new],[data-library-rename],[data-forget]')) button.disabled = on;
  }
  function remember(heard, answer) {
    const before = JSON.stringify(memory);
    memory = nextMemory(memory, redactSecret(heard, secret), redactSecret(answer, secret));
    if (JSON.stringify(memory) !== before && memory.at(-1)) {
      const library = activeLibrary(store);
      library.turns = rememberTurn(library.turns, memory.at(-1), Date.now() / 1000);
    }
    saveActive();
    showMemory();
  }
  syncMemory();
  if (loaded.migrated) saveActive();
  memoryAtStart = JSON.stringify(memory);
  showMemory();
  const setLiveLabel = (on) => {
    liveButton.textContent = on ? '结束实时通话' : '开始实时通话';
    liveButton.setAttribute('aria-pressed', on ? 'true' : 'false');
    const talkButton = page.querySelector('[data-talk]');
    if (talkButton) talkButton.disabled = on;
    for (const button of page.querySelectorAll('[data-capture]')) button.disabled = on;
    lockLibrary(on);
  };
  const setBusy = (on) => {
    busy = on;
    stopButton.hidden = !on;
    for (const button of page.querySelectorAll('[data-source],[data-talk],[data-send],[data-live]')) {
      button.disabled = on || (button.hasAttribute('data-talk') && callReady);
    }
    lockLibrary(on || Boolean(call));
  };

  async function openSource(kind) {
    if (busy) return;
    stream?.getTracks().forEach((track) => track.stop());
    try {
      const media = kind === 'screen'
        ? await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false })
        : await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
      if (!active) { media.getTracks().forEach((track) => track.stop()); return; }
      stream = media;
      videoSource = kind === 'screen' ? 'screen' : 'camera';
      video.srcObject = media;
      await video.play();
      media.getVideoTracks()[0]?.addEventListener('ended', () => {
        if (stream === media) { stream = null; video.removeAttribute('src'); video.srcObject = null; say('画面已关闭'); }
      });
      say(kind === 'screen' ? '正在共享屏幕。实时通话会持续发送这一路画面。' : '摄像头已打开。实时通话会持续发送这一路画面。');
    } catch (error) {
      say(error.name === 'NotAllowedError' ? '没有获得画面权限。允许后重新打开。' : `打不开画面：${error.message}`);
    }
  }

  function pushFrame() {
    if (!call || !liveSpec) return;
    const jpeg = captureJpeg(video, liveSpec.MAX_FRAME_BYTES);
    if (!jpeg) return;
    call.send('input_image_buffer.append', { image: toBase64(jpeg) });
    framesSent += 1;
  }

  function submitLiveTurn() {
    if (!framesSent) {
      try { pushFrame(); } catch (error) { say(error.message); }
    }
    if (!framesSent) say('这一轮没有画面，只提交语音。');
    pendingCommit = true;
    assistantText = '';
    assistantLine = null;
    call.send('input_audio_buffer.commit');
    say(framesSent ? `正在提交这一轮（${framesSent} 帧画面）…` : '正在提交这一轮…');
  }

  function clearTimers() {
    for (const id of timers) clearTimeout(id);
    timers.clear();
  }

  function endCall(message) {
    clearTimers();
    stopObserver();
    monitorStop?.();
    embedAbort?.abort();
    callGeneration += 1;
    const handle = call;
    call = null;
    callReady = false;
    pendingCommit = false;
    setLiveLabel(false);
    handle?.close();
    const speaker = playback;
    playback = null;
    void speaker?.close();
    if (recorder) { wantStop = true; void finishTalk(false); }
    const meter = page.querySelector('[data-meter]');
    if (meter) meter.textContent = '';
    say(message);
    void foldMemory();
  }

  async function foldSummary(stack, values) {
    const turn = await chat({ stack, values }, {
      model: SUMMARY_MODEL,
      messages: summaryMessages(summary, memory.map((line) => redactSecret(line, values.DASHSCOPE_API_KEY))),
      enable_thinking: false,
    }, { allowNetworkFallback: false });
    summary = clipSummary(redactSecret(turn.text, values.DASHSCOPE_API_KEY));
    saveActive();
    memoryAtStart = JSON.stringify(memory);
    showMemory();
    say('没有整理成长期资料，已改成一段摘要，留在这台浏览器。');
  }

  async function foldMemory() {
    if (folding || JSON.stringify(memory) === memoryAtStart || !memory.length) return;
    folding = true;
    const stack = reg.stacks.get('bailian');
    const stored = loadCredentials('bailian');
    const values = stack && stored?.values ? fieldValues(stack, stored.values) : null;
    if (!values?.DASHSCOPE_API_KEY) { folding = false; return; }
    say('正在用 qwen3.7-plus 整理长期资料和近期事项…');
    const today = localDate();
    try {
      const library = activeLibrary(store);
      const turn = await chat({ stack, values }, {
        model: SUMMARY_MODEL,
        messages: [
          { role: 'system', content: UPDATER_PROMPT },
          { role: 'user', content: formatUpdaterInput({
            ltm: library.ltm,
            stm: library.stm,
            notes: memory.map((line) => redactSecret(line, values.DASHSCOPE_API_KEY)),
            today,
          }) },
        ],
        enable_thinking: false,
      }, { allowNetworkFallback: false });
      const patch = parsePatch(redactSecret(turn.text, values.DASHSCOPE_API_KEY));
      if (!patch) throw new Error('没有给出可用的更新');
      if (isEmptyPatch(patch)) {
        memoryAtStart = JSON.stringify(memory);
        showMemory();
        say('这次通话没有新的长期资料或近期事项。');
        return;
      }
      const next = applyMemoryPatch(library, patch, today);
      library.ltm = next.ltm;
      library.stm = next.stm;
      library.stmSeq = next.stmSeq;
      saveActive();
      memoryAtStart = JSON.stringify(memory);
      showMemory();
      say('长期资料和近期事项已更新，留在这台浏览器。');
    } catch (error) {
      try { await foldSummary(stack, values); }
      catch (summaryError) { say(`通话已结束。记忆没有写成：${summaryError.message}`); }
    } finally {
      folding = false;
    }
  }

  function onRealtime(event, mine) {
    if (!active || mine !== callGeneration) return;
    if (event.type === 'error') { say(event.message); return; }
    if (event.type === 'socket.close') {
      stopObserver();
      embedAbort?.abort();
      call = null;
      callReady = false;
      pendingCommit = false;
      setLiveLabel(false);
      const speaker = playback;
      playback = null;
      void speaker?.close();
      say('实时连接已断开');
      void foldMemory();
      return;
    }
    if (event.type === 'input_audio_buffer.speech_started') {
      toolRounds = 0;
      lookGeneration += 1;
      if (playback?.playing()) {
        playback.interrupt();
        try { call?.send('response.cancel'); } catch { /* 当前没有可打断的回答 */ }
        say('你开始说话了，已停下当前回答。');
      } else say('正在听…');
      return;
    }
    if (event.type === 'input_audio_buffer.speech_stopped') {
      assistantText = '';
      assistantLine = null;
      say('正在回答…');
      return;
    }
    if (event.type === 'input_audio_buffer.committed') {
      if (!pendingCommit || !call) return;
      pendingCommit = false;
      try { call.send('response.create'); say('正在回答…'); }
      catch (error) { say(error.message); }
      return;
    }
    if (event.type === 'conversation.item.input_audio_transcription.completed' && event.transcript) {
      lastHeard = event.transcript;
      const item = document.createElement('li');
      item.textContent = redactSecret(`听到：${event.transcript}`, secret);
      log.append(item);
      remember(event.transcript, '');
      return;
    }
    if (event.type === 'response.audio.delta' && event.delta) {
      try { playback?.push(decodeBase64(event.delta), liveSpec?.OUT_RATE); }
      catch (error) { say(error.message); }
      return;
    }
    if (event.type === 'response.audio_transcript.delta' || event.type === 'response.text.delta') {
      assistantText += event.delta || '';
      if (!assistantLine) { assistantLine = document.createElement('li'); log.append(assistantLine); }
      assistantLine.textContent = redactSecret(assistantText, secret);
      return;
    }
    if (event.type === 'response.done') {
      const calls = functionCalls(event, 2, toolRounds);
      if (calls.length && call) {
        toolRounds += 1;
        const item = calls[0];
        if (item.name === 'analyze_view') void answerLook(item, mine, lookGeneration);
        else if (item.name === 'web_search') void answerSearch(item, mine);
        else if (item.name === 'create_proactive_monitor') void answerMonitor(item, mine);
        else if (item.name === 'create_proactive_timer') void answerTimer(item, mine);
        else if (item.name === 'create_live_narration') void answerNarrate(item, mine);
        else if (item.name === 'omnibio') void answerBio(item, mine);
        else if (item.name === 'omniretrieve') void answerRetrieve(item, mine);
        else {
          try {
            call.send('conversation.item.create', { item: { type: 'function_call_output', call_id: item.call_id, output: '没有这个工具' } });
            call.send('response.create');
          } catch (error) { say(error.message); }
        }
        return;
      }
      remember('', assistantText);
      assistantText = '';
      assistantLine = null;
      const failed = event.response?.status && event.response.status !== 'completed';
      say(failed ? `这一轮没有完成（${event.response.status}）。可以继续说话。` : '可以继续说话。');
    }
  }

  async function answerLook(item, mine, generation) {
    let args = {};
    try { args = JSON.parse(item.arguments || '{}'); } catch { args = {}; }
    const question = visualQuestion(args.query, lastHeard);
    const jpeg = liveSpec ? captureJpeg(video, liveSpec.MAX_FRAME_BYTES) : null;
    let output = '没有打开摄像头或屏幕，看不到画面。';
    if (jpeg) {
      say('正在另开一次看图…');
      try {
        output = await analyzeFrame({
          url: realtimeSocketUrl(reg.stacks.get('bailian'), liveValues, liveSpec.REALTIME_MODEL),
          secret,
          jpeg,
          question,
          voice: liveSpec.REALTIME_VOICE,
          inputRate: liveSpec.IN_RATE,
          outputRate: liveSpec.OUT_RATE,
          asrModel: liveSpec.ASR_MODEL,
        }) || '看图没有返回文字。';
      } catch (error) {
        output = `看图失败：${error.message}`;
      }
    }
    if (!active || mine !== callGeneration || generation !== lookGeneration || !call) return;
    const line = document.createElement('li');
    line.textContent = redactSecret(`画面：${output}`, secret);
    log.append(line);
    try {
      call.send('conversation.item.create', { item: { type: 'function_call_output', call_id: item.call_id, output: redactSecret(output, secret) } });
      call.send('response.create');
    } catch (error) {
      say(error.message);
    }
  }

  function replyTool(item, output) {
    const text = redactSecret(output, secret);
    const line = document.createElement('li');
    line.textContent = text;
    log.append(line);
    call.send('conversation.item.create', { item: { type: 'function_call_output', call_id: item.call_id, output: text } });
    call.send('response.create');
  }

  async function answerSearch(item, mine) {
    let output;
    try {
      const messages = searchMessages(toolArguments(item.arguments).query);
      say('正在联网搜索…');
      const turn = await chat({ stack: reg.stacks.get('bailian'), values: liveValues }, {
        model: liveSpec.OMNI_MODEL,
        messages,
        enable_search: true,
        enable_thinking: false,
      }, { allowNetworkFallback: false });
      output = redactSecret(turn.text, secret).replace(/\s+/g, ' ').trim() || '没有查到结果。';
    } catch (error) {
      output = `搜索失败：${error.message}`;
    }
    if (!active || mine !== callGeneration || !call) return;
    try { replyTool(item, output); } catch (error) { say(error.message); }
  }

  async function answerMonitor(item, mine) {
    let output;
    let condition = '';
    try {
      condition = monitorTask(toolArguments(item.arguments).condition).replace(/^只判断这个条件：/, '');
      output = liveSpec && captureJpeg(video, liveSpec.MAX_FRAME_BYTES)
        ? '已开始听这两秒的声音并看画面。没有发生时不会出声。这会另开一条实时连接，费用另计。'
        : '没有打开摄像头或屏幕，无法监视。';
    } catch (error) {
      output = error.message;
    }
    if (!active || mine !== callGeneration || !call) return;
    try { replyTool(item, output); } catch (error) { say(error.message); return; }
    if (output.startsWith('已开始')) void runMonitor(condition, mine);
  }

  async function answerNarrate(item, mine) {
    const task = narrateTask(toolArguments(item.arguments).narration_focus);
    const output = liveSpec && captureJpeg(video, liveSpec.MAX_FRAME_BYTES)
      ? '已开始连续解说。没有明显变化时不会出声。同一时间只有一条监视或解说，费用另计。'
      : '没有打开摄像头或屏幕，无法解说。';
    if (!active || mine !== callGeneration || !call) return;
    try { replyTool(item, output); } catch (error) { say(error.message); return; }
    if (output.startsWith('已开始')) void runMonitor(task, mine, { rules: NARRATE_RULES, task, label: '解说' });
  }

  async function answerBio(item, mine) {
    let output;
    try {
      bio = applyBio(activeLibrary(store), redactOperations(toolArguments(item.arguments).operations, (value) => redactSecret(value, secret)));
      saveActive();
      showMemory();
      output = `已更新长期事实：\n${bioResult(bio)}`;
    } catch (error) {
      output = error.message;
    }
    if (!active || mine !== callGeneration || !call) return;
    try { replyTool(item, output); } catch (error) { say(error.message); }
  }

  async function embedMemory(texts) {
    const stack = reg.stacks.get('bailian');
    if (!stack || !liveValues?.DASHSCOPE_API_KEY) throw new Error('没有百炼 Key');
    embedAbort?.abort();
    embedAbort = new AbortController();
    const signal = AbortSignal.any([embedAbort.signal, AbortSignal.timeout(8000)]);
    const vectors = [];
    for (let start = 0; start < texts.length; start += 10) {
      const batch = texts.slice(start, start + 10);
      const body = await postJson({ stack, values: liveValues }, 'compatible', '/embeddings', {
        model: EMBED_MODEL,
        input: batch,
      }, { allowNetworkFallback: false, signal });
      const parsed = vectorsFromEmbedding(body, batch.length);
      if (!parsed) throw new Error('向量结果无效');
      vectors.push(...parsed);
    }
    return vectors;
  }

  async function answerRetrieve(item, mine) {
    let output;
    try {
      const request = toolArguments(item.arguments);
      const library = activeLibrary(store);
      const keyword = retrieveMemory(library, request);
      const corpus = request.source === 'env' ? envCorpus(library) : dialogueLines(library);
      const query = redactSecret(String(request.query || ''), secret).replace(/\s+/g, ' ').trim();
      let hits = [];
      let note = '';
      if (corpus.length && query) {
        try {
          const vectors = await embedMemory([query, ...corpus]);
          hits = vectorMatches(corpus, vectors[0], vectors.slice(1));
        } catch (error) {
          note = '向量检索没有完成，这次只按关键词查找。';
        }
      }
      output = [note, rankWithTime(keyword, hits, datedEntries(library, request.source), request.time_range)].filter(Boolean).join('\n');
    } catch (error) { output = error.message; }
    if (!active || mine !== callGeneration || !call) return;
    try { replyTool(item, output); } catch (error) { say(error.message); }
  }

  async function answerTimer(item, mine) {
    let plan = null;
    let output;
    try {
      plan = timerRequest(toolArguments(item.arguments));
      output = `${plan.seconds} 秒后提醒。到点会另读这一句，费用另计。结束通话会取消还没到点的提醒。`;
    } catch (error) {
      output = error.message;
    }
    if (!active || mine !== callGeneration || !call) return;
    try { replyTool(item, output); } catch (error) { say(error.message); return; }
    if (!plan) return;
    const id = setTimeout(() => { timers.delete(id); void fireTimer(plan.text, mine); }, plan.seconds * 1000);
    timers.add(id);
  }

  async function fireTimer(text, mine) {
    if (!active || mine !== callGeneration) return;
    const line = document.createElement('li');
    line.textContent = redactSecret(`提醒：${text}`, secret);
    log.append(line);
    const deadline = Date.now() + 30000;
    while (playback?.playing() && Date.now() < deadline && mine === callGeneration && active) {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    if (!active || mine !== callGeneration || !liveSpec || !liveValues) return;
    try {
      const spoken = await speakReminder({
        url: realtimeSocketUrl(reg.stacks.get('bailian'), liveValues, liveSpec.REALTIME_MODEL),
        secret,
        text,
        voice: liveSpec.REALTIME_VOICE,
        inputRate: liveSpec.IN_RATE,
        outputRate: liveSpec.OUT_RATE,
        asrModel: liveSpec.ASR_MODEL,
      });
      if (!active || mine !== callGeneration || !playback || playback.playing()) return;
      for (const chunk of spoken.audio) playback.push(chunk, liveSpec.OUT_RATE);
    } catch (error) {
      if (active && mine === callGeneration) say(`到点了，但没有读出来：${error.message}`);
    }
  }

  async function runMonitor(condition, mine, extra = {}) {
    monitorStop?.();
    let stopped = false;
    let monitor = null;
    const stop = () => { stopped = true; monitor?.close(); };
    monitorStop = stop;
    try {
      monitor = openMonitor({
        url: realtimeSocketUrl(reg.stacks.get('bailian'), liveValues, liveSpec.REALTIME_MODEL),
        secret,
        condition,
        rules: extra.rules,
        task: extra.task,
        voice: liveSpec.REALTIME_VOICE,
        inputRate: liveSpec.IN_RATE,
        outputRate: liveSpec.OUT_RATE,
        asrModel: liveSpec.ASR_MODEL,
      });
      await monitor.ready;
      monitorAudio = { parts: [], total: 0 };
      captureMonitorAudio = true;
      const oneSecond = liveSpec.IN_RATE * 2;
      while (!stopped && mine === callGeneration && active) {
        const mark = monitorAudio.total;
        const first = captureJpeg(video, liveSpec.MAX_FRAME_BYTES);
        await waitForAudio(mark + oneSecond, 1200);
        if (stopped || mine !== callGeneration || !active) return;
        const second = captureJpeg(video, liveSpec.MAX_FRAME_BYTES);
        await waitForAudio(mark + oneSecond * 2, 1300);
        if (!first || !second) { say('主动提醒停了：画面中断。'); return; }
        const result = await monitor.round([first, second], takeMonitorAudio(monitorAudio, liveSpec.IN_RATE));
        if (stopped || mine !== callGeneration || !active || isSilentMonitor(result.text)) continue;
        const line = document.createElement('li');
        line.textContent = redactSecret(`${extra.label || '提醒'}：${result.text}`, secret);
        log.append(line);
        if (playback && !playback.playing()) {
          for (const chunk of result.audio) playback.push(chunk, liveSpec.OUT_RATE);
        }
      }
    } catch (error) {
      if (!stopped && mine === callGeneration && active && error.message !== '主动提醒已停止') say(`主动提醒停了：${error.message}`);
    } finally {
      captureMonitorAudio = false;
      monitor?.close();
      if (monitorStop === stop) monitorStop = null;
    }
  }

  function waitForAudio(need, ms) {
    const deadline = Date.now() + ms;
    return new Promise((resolve) => {
      const tick = () => {
        if (monitorAudio.total >= need || Date.now() >= deadline) resolve();
        else setTimeout(tick, 100);
      };
      tick();
    });
  }

  async function openLiveMic(mine) {
    const meter = page.querySelector('[data-meter]');
    const handle = await microphone({
      onPCM: (buffer) => {
        if (mine !== callGeneration || !call || !callReady) return;
        try {
          const bytes = new Uint8Array(buffer);
          for (const piece of splitPcm(bytes, liveSpec.CHUNK_BYTES)) {
            if (piece.byteLength < 2 || piece.byteLength % 2) continue;
            call.send('input_audio_buffer.append', { audio: pcmBase64(piece) });
            if (captureMonitorAudio) monitorAudio = pushMonitorAudio(monitorAudio, piece, liveSpec.IN_RATE);
            if (captureMode === 'live' && audioPackets % liveSpec.FRAME_EVERY === 0) pushFrame();
            audioPackets += 1;
          }
        } catch (error) {
          say(error.message);
          endCall('实时连接已不可用');
        }
      },
      onDuration: (seconds) => {
        if (meter && mine === callGeneration) meter.textContent = `已通话 ${Math.floor(seconds)} 秒，上限 180 秒。实时语音按百炼账单计费。`;
      },
      onLimit: () => endCall('已到 3 分钟上限，实时通话结束。'),
      onError: (error) => say(error.message),
    });
    if (mine !== callGeneration || !active) { await handle.discard(); return; }
    recorder = handle;
    handle.resume();
  }

  async function startCall() {
    if (call || busy || recorder) return;
    const stored = loadCredentials('bailian');
    const stack = reg.stacks.get('bailian');
    const values = stack && stored?.values ? fieldValues(stack, stored.values) : null;
    if (!values?.DASHSCOPE_API_KEY) { say('先保存百炼 Key'); return; }
    const mine = ++callGeneration;
    secret = values.DASHSCOPE_API_KEY;
    let speaker = null;
    liveButton.disabled = true;
    try {
      speaker = createSpeaker();
      await speaker.resume();
      const constants = await liveConstants('02-ai-glasses.bailian');
      if (mine !== callGeneration || !active) { await speaker.close(); return; }
      lockLibrary(true);
      say('正在接通实时通话…');
      const url = realtimeSocketUrl(stack, values, constants.REALTIME_MODEL);
      const demand = captureMode === 'demand';
      liveValues = values;
      const openSocket = (tools) => connectRealtime({
        url,
        secret,
        session: sessionConfig({
          instructions: instructionsWithMemory(demand ? DEMAND_INSTRUCTIONS : (tools ? LIVE_TOOL_INSTRUCTIONS : LIVE_INSTRUCTIONS), memory, summary, bio, renderProfile(activeLibrary(store).ltm), renderRecent(activeLibrary(store).stm, localDate())),
          voice: constants.REALTIME_VOICE,
          inputRate: constants.IN_RATE,
          outputRate: constants.OUT_RATE,
          asrModel: constants.ASR_MODEL,
          turnDetection: SEMANTIC_TURN,
          search: tools ? false : !demand,
          video: !demand,
          tools: tools ? (demand ? [LOOK_TOOL, ...SESSION_TOOLS] : SESSION_TOOLS) : null,
        }),
        onEvent: (event) => onRealtime(event, mine),
      });
      let handle = openSocket(true);
      call = handle;
      liveSpec = constants;
      playback = speaker;
      try {
        await handle.ready;
      } catch (error) {
        const blocked = /tool|function|工具/.test(error.message || '');
        if (!blocked || mine !== callGeneration || !active) throw error;
        handle.close();
        if (call === handle) call = null;
        say('当前账号不能使用工具，改为只对话。');
        handle = openSocket(false);
        call = handle;
        await handle.ready;
      }
      if (mine !== callGeneration || !active) {
        handle.close();
        if (call === handle) call = null;
        if (playback === speaker) playback = null;
        await speaker.close();
        return;
      }
      callReady = true;
      setLiveLabel(true);
      say('实时通话已接通，正在打开麦克风…');
      await openLiveMic(mine);
      if (mine !== callGeneration || !active) return;
      say(demand ? '对着麦克风说话即可。问到画面时才会另看一眼。' : '对着画面说话即可。说完稍停就会回答，插话会停下当前回答。');
      if (store.visual) startObserver(mine);
    } catch (error) {
      stopObserver();
      if (call && mine === callGeneration) { call.close(); call = null; }
      callReady = false;
      setLiveLabel(false);
      if (playback === speaker) playback = null;
      await speaker?.close()?.catch(() => {});
      if (mine === callGeneration && active) say(error.message);
    } finally {
      if (active && !busy) liveButton.disabled = false;
    }
  }

  async function finishTalk(sendNow) {
    if (stopping || !recorder) return null;
    stopping = true;
    const handle = recorder;
    recorder = null;
    const live = Boolean(call && callReady);
    try {
      await handle.stop();
      if (live) {
        if (sendNow && audioPackets) {
          try { submitLiveTurn(); } catch (error) { say(error.message); }
        } else if (sendNow) say('没有录到声音');
        audioPackets = 0;
        framesSent = 0;
        return null;
      }
      const pcm = joinPcm(chunks);
      chunks = [];
      if (sendNow && pcm) await ask(pcm);
      else if (sendNow) say('没有录到声音');
      return pcm;
    } finally {
      stopping = false;
    }
  }

  async function speak(cred, constants, text) {
    const response = await postJson(cred, 'api', '/services/audio/tts/SpeechSynthesizer', {
      model: constants.TTS_MODEL,
      input: { text, voice: constants.TTS_VOICE, format: 'wav', sample_rate: constants.OUT_RATE },
    }, {}, { signal: abort.signal, allowNetworkFallback: false });
    if (response.code || response.error) throw new Error(response.message || response.error?.message || '语音合成失败');
    const url = safeAudioUrl(response.output?.audio?.url || '');
    if (!url) throw new Error('语音合成没有返回可播放的官方地址，文字回答已保留');
    player.hidden = false;
    player.src = url;
    await player.play().catch(() => say('文字已显示。浏览器拦住了自动播放，可以点播放器。'));
  }

  async function ask(pcm) {
    if (call) { say('请先结束实时通话'); return; }
    if (busy) return;
    const stored = loadCredentials('bailian');
    const stack = reg.stacks.get('bailian');
    if (!stored?.values?.DASHSCOPE_API_KEY || !stack) { say('先保存百炼 Key'); return; }
    const question = questionEl.value.trim();
    if (!pcm && !question) { say('请说话或输入问题'); return; }
    setBusy(true);
    abort = new AbortController();
    try {
      const image = frameDataUrl(video);
      const content = buildUserContent({ imageDataUrl: image, audioBase64: pcm ? toBase64(encodeWav(pcm, SAMPLE_RATE)) : '', question });
      const constants = await liveConstants('02-ai-glasses.bailian');
      const cred = { stack, values: fieldValues(stack, stored.values) };
      say('正在请求百炼…');
      const turn = await chat(cred, {
        model: constants.OMNI_MODEL,
        messages: requestMessages(SYSTEM_PROMPT, history, content),
        modalities: ['text'],
        reasoning_effort: 'none',
      }, {
        signal: abort.signal,
        allowNetworkFallback: false,
        onText: (_, all) => say(`正在回答…已收到 ${all.length} 字`),
      });
      const answer = String(turn.text || '').trim();
      history = nextTextHistory(history, question, answer);
      questionEl.value = '';
      const item = document.createElement('li');
      item.textContent = redactSecret(`${question || '语音提问'} → ${answer || '（没有文字回答）'}`, stored.values.DASHSCOPE_API_KEY);
      log.append(item);
      const speech = spokenText(answer);
      if (cred.values.DASHSCOPE_API_REGION === 'cn-beijing' && speech) {
        say('正在合成语音…');
        await speak(cred, constants, speech);
      }
      const usage = turn.usage?.known ? `输入 ${turn.usage.prompt}、输出 ${turn.usage.completion} Token。` : '接口没有返回完整 Token。';
      say(`${usage}费用以百炼账单为准。${cred.values.DASHSCOPE_API_REGION === 'cn-beijing' ? '' : '当前地域只出文字。'}`);
    } catch (error) {
      const text = error.name === 'AbortError' ? '已停止。已经发出的请求仍可能计费。' : (error.hint ? `${error.message} ${error.hint}` : error.message);
      say(redactSecret(text, stored?.values?.DASHSCOPE_API_KEY || secret));
    } finally {
      if (active) setBusy(false);
      abort = null;
    }
  }

  function askLibraryName(title, current = '') {
    const dialog = sheet(html`<h2>${title}</h2><label class="field">名称<input data-name maxlength="40" data-autofocus></label><div class="btn-row"><button type="button" class="primary-action" data-sheet="save">保存</button><button type="button" class="secondary-action" data-sheet="cancel">取消</button></div>`, { label: title });
    const input = dialog.el.querySelector('[data-name]');
    input.value = current;
    let chosen = '';
    input.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      chosen = input.value;
      dialog.close('save');
    });
    dialog.el.addEventListener('click', (event) => {
      if (event.target.closest('[data-sheet="save"]')) chosen = input.value;
    });
    return dialog.done.then((action) => (action === 'save' ? chosen : null));
  }

  async function changeLibrary(id) {
    if (call || busy || folding) { showMemory(); return; }
    if (!store.libraries.some((item) => item.id === id)) { say('没有这个记忆库'); showMemory(); return; }
    lockLibrary(true);
    try {
      await foldMemory();
      store = writeStore(localStorage, switchLibrary(store, id));
      syncMemory();
      memoryAtStart = JSON.stringify(memory);
      showMemory();
      say(`当前记忆库是「${activeLibrary(store).name}」。`);
    } catch (error) {
      say(error.message);
      showMemory();
    } finally {
      if (!call) lockLibrary(false);
    }
  }

  async function addLibrary() {
    if (call || busy) return;
    const name = await askLibraryName('新建记忆库');
    if (!active || name == null || call || busy) return;
    lockLibrary(true);
    try {
      await foldMemory();
      store = writeStore(localStorage, createLibrary(store, name));
      syncMemory();
      memoryAtStart = JSON.stringify(memory);
      showMemory();
      say(`当前记忆库是「${activeLibrary(store).name}」。`);
    } catch (error) {
      say(error.message);
      showMemory();
    } finally {
      if (!call) lockLibrary(false);
    }
  }

  async function renameCurrentLibrary() {
    if (call || busy) return;
    const current = activeLibrary(store);
    const name = await askLibraryName('重命名记忆库', current.name);
    if (!active || name == null || call) return;
    try {
      store = writeStore(localStorage, renameLibrary(store, current.id, name));
      showMemory();
      say(`记忆库已改名为「${activeLibrary(store).name}」。`);
    } catch (error) { say(error.message); }
  }

  librarySelect?.addEventListener('change', () => {
    if (call || busy) { showMemory(); return; }
    if (librarySelect.value === store.activeId) return;
    void changeLibrary(librarySelect.value);
  });

  page.addEventListener('click', (event) => {
    const capture = event.target.closest('[data-capture]');
    if (capture && !call) {
      captureMode = capture.dataset.capture === 'demand' ? 'demand' : 'live';
      for (const button of page.querySelectorAll('[data-capture]')) button.setAttribute('aria-pressed', String(button === capture));
      say(captureMode === 'demand' ? '已改为按需看一眼。问到画面时才会另开一次看图。' : '已改为实时画面。接通后大约每秒送一帧。');
    }
    const source = event.target.closest('[data-source]');
    if (source) void openSource(source.dataset.source);
    if (event.target.closest('[data-live]')) void (call ? endCall('已结束实时通话') : startCall());
    if (event.target.closest('[data-send]')) void ask(null);
    if (event.target.closest('[data-forget]')) {
      if (call || busy) return;
      try { store = writeStore(localStorage, clearLibrary(store, store.activeId)); }
      catch (error) { say(error.message); return; }
      syncMemory();
      memoryAtStart = JSON.stringify(memory);
      showMemory();
      say(`已清空记忆库「${activeLibrary(store).name}」。`);
    }
    const visual = event.target.closest('[data-visual]');
    if (visual) {
      try { store = writeStore(localStorage, { ...store, visual: store.visual !== true }); }
      catch (error) { say(error.message); return; }
      showMemory();
      if (store.visual && call && callReady) startObserver(callGeneration);
      else stopObserver();
      say(store.visual ? '视觉记忆已打开。接通后会先记一帧，之后大约每 60 秒再记一帧，另计费。' : '视觉记忆已关闭。已记下的观察还在当前记忆库。');
    }
    if (event.target.closest('[data-library-new]')) void addLibrary();
    if (event.target.closest('[data-library-rename]')) void renameCurrentLibrary();
    if (event.target.closest('[data-stop]')) abort?.abort();
  });
  const talk = page.querySelector('[data-talk]');
  talk.addEventListener('pointerdown', async (event) => {
    if (busy || recorder || event.button !== 0 || call) return;
    event.preventDefault();
    chunks = [];
    audioPackets = 0;
    framesSent = 0;
    wantStop = false;
    try {
      talk.setPointerCapture(event.pointerId);
      const handle = await microphone({
        onPCM: (buffer) => { chunks.push(new Uint8Array(buffer)); },
        onDuration: (seconds) => { say(`正在听 ${seconds.toFixed(1)} 秒`); if (seconds >= 20) void finishTalk(true); },
        onLimit: () => { void finishTalk(true); },
        onError: (error) => say(error.message),
      });
      if (!active || busy || wantStop) { await handle.discard(); if (wantStop) say('没有录到声音'); return; }
      recorder = handle;
      handle.resume();
      say('正在听…松开后发送当前画面和这句话');
    } catch (error) {
      say(error.message);
    }
  });
  const release = () => { wantStop = true; void finishTalk(true); };
  talk.addEventListener('pointerup', release);
  talk.addEventListener('pointercancel', release);

  return { cleanup() {
    active = false;
    stopObserver();
    clearTimers();
    callGeneration += 1;
    abort?.abort();
    call?.close();
    call = null;
    secret = '';
    void playback?.close();
    stream?.getTracks().forEach((track) => track.stop());
    recorder?.discard();
    player.pause();
  } };
}
