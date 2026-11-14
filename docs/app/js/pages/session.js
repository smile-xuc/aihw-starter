import { liveConstants } from '../data.js';
import { chat, postJson, toBase64 } from '../live/client.js';
import { microphone } from '../live/microphone.js';
import { SAMPLE_RATE } from '../live/pcm.js';
import { DEMAND_INSTRUCTIONS, LOOK_TOOL, analyzeFrame, visualQuestion } from '../live/on-demand.js';
import { functionCalls } from '../live/product-session.js';
import { connectRealtime, decodeBase64, pcmBase64, realtimeSocketUrl, redactSecret, SEMANTIC_TURN, sessionConfig, splitPcm } from '../live/realtime-omni.js';
import { browserSupport } from '../live/index.js';
import {
  SUMMARY_MODEL, SYSTEM_PROMPT, buildUserContent, clipSummary, encodeWav, instructionsWithMemory, isSessionReturn, nextMemory, nextTextHistory, requestMessages, safeAudioUrl, spokenText, summaryMessages,
} from '../live/session-turn.js';
import { fieldValues, loadCredentials } from '../settings.js';
import { html, mount, mountPage } from '../ui.js';

export { isSessionReturn };

const SETUP = `#/me?return=${encodeURIComponent('#/session')}`;
const LIVE_INSTRUCTIONS = `你是看说体验里的语音助手，能看到用户打开的摄像头或屏幕，大约每秒一帧。
用口语化中文回答，每次两三句话，先给结论。画面和问题有关时结合画面回答。
需要事实或最新信息时可以联网搜索，并用口语说明依据。
不识别画面中人的身份；看不清就直说，不要编造。
用户可以随时插话。`;
const MEMORY_KEY = 'aihw.session.memory';
const SUMMARY_KEY = 'aihw.session.summary';

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
      <p class="small" data-realtime-note>实时通话会把 Key 放进发往百炼官方域名的 WebSocket 连接参数。浏览器不能设置 Authorization 头，换临时 Key 的接口也没有跨域。qwen3.8 实时模型通常还要填写业务空间 ID。页面地址、历史和导出不会写入 Key。接通后麦克风保持打开，单次最长 3 分钟。实时画面大约每秒送一帧，主会话可以联网。按需看一眼只在问到画面时另开一次看图，主会话这一档不联网。最近对话的文字留在这台浏览器。结束通话后用 qwen3.7-plus 收成一段摘要，另计费，不含 Key、画面和录音。</p>
      <p class="small" data-memory></p>
      <button type="button" class="secondary-action" data-forget>清空本机记忆</button>
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
      <p class="small">上面这些都能用同一把 Key 在浏览器里跑。主动提醒和后台委托要在 Mac 上用 <a href="https://github.com/QwenLM/Qwen-Live-Harness" rel="noopener">Qwen-Live-Harness</a>。</p>
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
  let memory = readMemory();
  let summary = readSummary();
  let memoryAtStart = JSON.stringify(memory);
  let folding = false;
  let captureMode = 'live';
  let liveValues = null;
  let lastHeard = '';
  let lookRounds = 0;
  let lookGeneration = 0;
  const memoryLabel = page.querySelector('[data-memory]');

  const say = (text) => { if (active) status.textContent = redactSecret(text, secret); };
  function readMemory() {
    try {
      const raw = JSON.parse(localStorage.getItem(MEMORY_KEY) || '[]');
      return Array.isArray(raw) ? raw.filter((line) => typeof line === 'string') : [];
    } catch { return []; }
  }
  function readSummary() {
    try { return clipSummary(localStorage.getItem(SUMMARY_KEY) || ''); } catch { return ''; }
  }
  function showMemory() {
    if (!memoryLabel) return;
    if (!memory.length && !summary) memoryLabel.textContent = '这台浏览器还没有记住对话。';
    else memoryLabel.textContent = `这台浏览器记得最近 ${memory.length} 句对话${summary ? '，并保留一段更早的摘要' : ''}。`;
  }
  function remember(heard, answer) {
    memory = nextMemory(memory, redactSecret(heard, secret), redactSecret(answer, secret));
    try { localStorage.setItem(MEMORY_KEY, JSON.stringify(memory)); } catch { /* 存不下就只留在这一次通话 */ }
    showMemory();
  }
  showMemory();
  const setLiveLabel = (on) => {
    liveButton.textContent = on ? '结束实时通话' : '开始实时通话';
    liveButton.setAttribute('aria-pressed', on ? 'true' : 'false');
    const talkButton = page.querySelector('[data-talk]');
    if (talkButton) talkButton.disabled = on;
    for (const button of page.querySelectorAll('[data-capture]')) button.disabled = on;
  };
  const setBusy = (on) => {
    busy = on;
    stopButton.hidden = !on;
    for (const button of page.querySelectorAll('[data-source],[data-talk],[data-send],[data-live]')) {
      button.disabled = on || (button.hasAttribute('data-talk') && callReady);
    }
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

  function endCall(message) {
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

  async function foldMemory() {
    if (folding || JSON.stringify(memory) === memoryAtStart || !memory.length) return;
    folding = true;
    const stack = reg.stacks.get('bailian');
    const stored = loadCredentials('bailian');
    const values = stack && stored?.values ? fieldValues(stack, stored.values) : null;
    if (!values?.DASHSCOPE_API_KEY) { folding = false; return; }
    say('正在用 qwen3.7-plus 整理记忆…');
    try {
      const turn = await chat({ stack, values }, {
        model: SUMMARY_MODEL,
        messages: summaryMessages(summary, memory.map((line) => redactSecret(line, values.DASHSCOPE_API_KEY))),
        enable_thinking: false,
      }, { allowNetworkFallback: false });
      summary = clipSummary(redactSecret(turn.text, values.DASHSCOPE_API_KEY));
      try { localStorage.setItem(SUMMARY_KEY, summary); } catch { /* 存不下就只留在这一次 */ }
      memoryAtStart = JSON.stringify(memory);
      showMemory();
      say('记忆已整理，留在这台浏览器。');
    } catch (error) {
      say(`通话已结束。记忆摘要没有写成：${error.message}`);
    } finally {
      folding = false;
    }
  }

  function onRealtime(event, mine) {
    if (!active || mine !== callGeneration) return;
    if (event.type === 'error') { say(event.message); return; }
    if (event.type === 'socket.close') {
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
      lookRounds = 0;
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
      const calls = captureMode === 'demand' ? functionCalls(event, 1, lookRounds) : [];
      if (calls.length && call) {
        lookRounds += 1;
        void answerLook(calls[0], mine, lookGeneration);
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
      say('正在接通实时通话…');
      const url = realtimeSocketUrl(stack, values, constants.REALTIME_MODEL);
      const demand = captureMode === 'demand';
      liveValues = values;
      const openSocket = (search) => connectRealtime({
        url,
        secret,
        session: sessionConfig({
          instructions: instructionsWithMemory(demand ? DEMAND_INSTRUCTIONS : LIVE_INSTRUCTIONS, memory, summary),
          voice: constants.REALTIME_VOICE,
          inputRate: constants.IN_RATE,
          outputRate: constants.OUT_RATE,
          asrModel: constants.ASR_MODEL,
          turnDetection: SEMANTIC_TURN,
          search: demand ? false : search,
          video: !demand,
          tools: demand ? [LOOK_TOOL] : null,
        }),
        onEvent: (event) => onRealtime(event, mine),
      });
      let handle = openSocket(!demand);
      call = handle;
      liveSpec = constants;
      playback = speaker;
      try {
        await handle.ready;
      } catch (error) {
        const blocked = /search|enable_search|联网/.test(error.message || '');
        if (demand || !blocked || mine !== callGeneration || !active) throw error;
        handle.close();
        if (call === handle) call = null;
        say('当前账号不能联网搜索，改为只对话。');
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
    } catch (error) {
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

  page.addEventListener('click', (event) => {
    const capture = event.target.closest('[data-capture]');
    if (capture && !call) {
      captureMode = capture.dataset.capture === 'demand' ? 'demand' : 'live';
      for (const button of page.querySelectorAll('[data-capture]')) button.setAttribute('aria-pressed', String(button === capture));
      say(captureMode === 'demand' ? '已改为按需看一眼。问到画面时才会另开一次看图，主会话不联网。' : '已改为实时画面。接通后大约每秒送一帧，主会话可以联网。');
    }
    const source = event.target.closest('[data-source]');
    if (source) void openSource(source.dataset.source);
    if (event.target.closest('[data-live]')) void (call ? endCall('已结束实时通话') : startCall());
    if (event.target.closest('[data-send]')) void ask(null);
    if (event.target.closest('[data-forget]')) {
      memory = [];
      summary = '';
      memoryAtStart = '[]';
      try { localStorage.removeItem(MEMORY_KEY); localStorage.removeItem(SUMMARY_KEY); } catch { /* 清不掉就只清这一页的显示 */ }
      showMemory();
      say('已清空这台浏览器记住的对话。');
    }
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
