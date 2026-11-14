import { liveConstants } from '../data.js';
import { chat, toBase64 } from '../live/client.js';
import { microphone } from '../live/microphone.js';
import {
  appendCaption, applyTool, formatDiaryPrompt, functionCalls, instructionsWithPetMemory, mergeMemories, parseDiary, petFace, phraseMap, renderDiary,
} from '../live/product-session.js';
import { connectRealtime, decodeBase64, pcmBase64, realtimeSocketUrl, redactSecret, SEMANTIC_TURN, sessionConfig, splitPcm, translationSession } from '../live/realtime-omni.js';
import { fieldValues, loadCredentials } from '../settings.js';
import { html, mountPage } from '../ui.js';

const MEMORY_KEY = 'aihw.pet.memory';

function createSpeaker() {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) throw new Error('这个浏览器不能播放实时语音');
  const ctx = new Ctx();
  let next = 0;
  const sources = new Set();
  return {
    resume() { return ctx.resume(); },
    playing() { return sources.size > 0 && next > ctx.currentTime + 0.05; },
    interrupt() {
      for (const source of sources) { try { source.stop(); } catch { /* 已经播完 */ } }
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

function captureJpeg(video, maxBytes) {
  const width = video.videoWidth;
  const height = video.videoHeight;
  if (!width || !height) return null;
  const scale = Math.min(1, 640 / Math.max(width, height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  canvas.getContext('2d', { alpha: false }).drawImage(video, 0, 0, canvas.width, canvas.height);
  const url = canvas.toDataURL('image/jpeg', 0.7);
  const binary = atob(url.split(',')[1] || '');
  if (binary.length > maxBytes) return null;
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function readPetMemory() {
  try {
    const raw = JSON.parse(localStorage.getItem(MEMORY_KEY) || '{}');
    return raw && typeof raw === 'object' ? raw : {};
  } catch { return {}; }
}

export function renderProductLive(view, reg, product) {
  document.title = `${product.title} · AIHW`;
  const saved = loadCredentials('bailian');
  const setup = `#/me?return=${encodeURIComponent(product.href)}`;
  const page = mountPage(view, html`
    <header class="app-top"><a class="back" href="#/">← 体验中心</a></header>
    <section class="intro" data-product-live="${product.id}">
      <p class="eyebrow">百炼 Key · ${product.title}</p>
      <h1>${product.lead}</h1>
      <p>${product.note} 费用记在你的百炼账号上。声音、画面和到点提醒在看说体验里。后台委托仍在 Mac 上的 Qwen-Live-Harness。</p>
    </section>
    ${saved?.values?.DASHSCOPE_API_KEY ? html`<p class="inline-ok">已读取本机百炼 Key。接通后才会调用模型。</p>` : html`<div class="mode-banner"><div><strong>还没有百炼 Key</strong><p>保存后回到这里，不会自动调用模型。qwen3.8 实时模型通常还要填写业务空间 ID。</p><a href="${setup}">去填写 Key</a></div></div>`}
    <section class="panel session-stage">
      ${product.camera ? html`<video data-preview playsinline autoplay muted></video><div class="btn-row"><button type="button" class="secondary-action" data-source="camera">摄像头</button><button type="button" class="secondary-action" data-source="screen">屏幕</button></div>` : ''}
      ${product.id === 'pet' ? html`<pre class="device-face" data-face>${petFace('calm', ['o     o', ' --- '])}</pre>` : ''}
      <p class="device-state" data-device></p>
      <p class="small" data-status role="status" aria-live="polite">${saved?.values?.DASHSCOPE_API_KEY ? '可以开始通话。' : '填写 Key 后才能接通。'}</p>
      <p class="small" data-meter></p>
      ${product.kind === 'translate' ? html`<label class="field">目标语<select data-language></select></label><p class="small"><label><input type="checkbox" data-text-only> 只出字幕，不播放译音</label></p><label class="field">热词，一行一个，源词=译词<textarea data-phrases rows="3" maxlength="500" placeholder="降噪=noise cancellation"></textarea></label>` : ''}
      ${product.diary ? html`<p class="small" data-memory></p><button type="button" class="secondary-action" data-forget>清空本机记忆</button>` : ''}
      <div class="btn-row">
        <button type="button" class="primary-action" data-live>开始通话</button>
        <a class="secondary-action" href="#/s/${product.solution}/${product.variant}">看回放</a>
      </div>
    </section>
    <section class="panel"><h2>这一轮</h2><ol data-log></ol><pre class="device-face" data-diary hidden></pre></section>`);

  const status = page.querySelector('[data-status]');
  const log = page.querySelector('[data-log]');
  const device = page.querySelector('[data-device]');
  const face = page.querySelector('[data-face]');
  const video = page.querySelector('[data-preview]');
  const liveButton = page.querySelector('[data-live]');
  const diaryBox = page.querySelector('[data-diary]');
  let stream = null;
  let active = true;
  let call = null;
  let callReady = false;
  let callGeneration = 0;
  let playback = null;
  let recorder = null;
  let secret = '';
  let constants = null;
  let audioPackets = 0;
  let toolRounds = 0;
  let assistantText = '';
  let assistantLine = null;
  let captions = {};
  const captionLines = new Map();
  let history = [];
  let finishWait = null;
  let memory = product.diary ? readPetMemory() : {};
  const memoryLabel = page.querySelector('[data-memory]');
  const say = (text) => { if (active) status.textContent = redactSecret(text, secret); };
  const showMemory = () => {
    if (!memoryLabel) return;
    const count = Array.isArray(memory.memories) ? memory.memories.length : 0;
    memoryLabel.textContent = count ? `这台浏览器记得豆豆的 ${count} 条记忆。` : '这台浏览器还没有豆豆的记忆。';
  };
  showMemory();
  if (product.kind === 'translate') {
    liveConstants(product.solution).then((data) => { if (active) fillLanguages(data.AUDIO_LANGS || []); }).catch(() => {});
  }

  function showTool(result) {
    if (device) device.textContent = result.label || '';
    if (face && result.face) face.textContent = petFace(result.emotion, result.face);
    const item = document.createElement('li');
    item.textContent = redactSecret(result.label || '', secret);
    log.append(item);
  }

  async function openSource(kind) {
    stream?.getTracks().forEach((track) => track.stop());
    try {
      const media = kind === 'screen'
        ? await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false })
        : await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
      if (!active) { media.getTracks().forEach((track) => track.stop()); return; }
      stream = media;
      video.srcObject = media;
      await video.play();
      say(kind === 'screen' ? '正在共享屏幕。通话会持续发送这一路画面。' : '摄像头已打开。通话会持续发送这一路画面。');
    } catch (error) {
      say(error.name === 'NotAllowedError' ? '没有获得画面权限。允许后重新打开。' : `打不开画面：${error.message}`);
    }
  }

  function pushFrame() {
    if (!call || !video) return;
    const jpeg = captureJpeg(video, constants.MAX_IMAGE_BYTES || 194560);
    if (!jpeg) return;
    call.send('input_image_buffer.append', { image: toBase64(jpeg) });
  }

  function onRealtime(event, mine) {
    if (!active || mine !== callGeneration) return;
    if (event.type === 'session.finished' && finishWait) finishWait();
    if (event.type === 'error') { say(event.message); return; }
    if (event.type === 'socket.close') {
      call = null;
      callReady = false;
      liveButton.textContent = '开始通话';
      playback?.close();
      playback = null;
      say('实时连接已断开');
      return;
    }
    if (event.type === 'input_audio_buffer.speech_started') {
      toolRounds = 0;
      if (product.kind !== 'translate' && playback?.playing()) {
        playback.interrupt();
        try { call?.send('response.cancel'); } catch { /* 当前没有可打断的回答 */ }
        say('你开始说话了，已停下当前回答。');
      }
      return;
    }
    if (event.type === 'conversation.item.input_audio_transcription.completed' && event.transcript) {
      const item = document.createElement('li');
      item.textContent = redactSecret(`${product.kind === 'translate' ? '原文' : '听到'}：${event.transcript}`, secret);
      log.append(item);
      history.push({ heard: event.transcript, answer: '' });
      return;
    }
    if (event.type === 'response.audio.delta' && event.delta && !page.querySelector('[data-text-only]')?.checked) {
      try { playback?.push(decodeBase64(event.delta), constants.OUT_RATE || constants.DEFAULT_OUT_RATE); }
      catch (error) { say(error.message); }
      return;
    }
    if (event.type === 'response.audio_transcript.delta' || event.type === 'response.text.delta') {
      if (product.kind === 'translate') {
        captions = appendCaption(captions, event);
        const id = String(event.item_id || 'current');
        let line = captionLines.get(id);
        if (!line) { line = document.createElement('li'); captionLines.set(id, line); log.append(line); }
        line.textContent = redactSecret(`译文：${captions[id]}`, secret);
      } else {
        assistantText += event.delta || '';
        if (!assistantLine) { assistantLine = document.createElement('li'); log.append(assistantLine); }
        assistantLine.textContent = redactSecret(assistantText, secret);
      }
      return;
    }
    if (event.type === 'response.done') {
      const calls = product.kind === 'omni' ? functionCalls(event, constants.MAX_TOOL_ROUNDS || 2, toolRounds) : [];
      if (calls.length && call) {
        for (const item of calls) {
          const result = applyTool(constants, item.name, item.arguments);
          showTool(result);
          call.send('conversation.item.create', { item: { type: 'function_call_output', call_id: item.call_id, output: result.output } });
        }
        toolRounds += 1;
        try { call.send('response.create'); } catch (error) { say(error.message); }
        return;
      }
      if (history.length && assistantText) history[history.length - 1].answer = assistantText;
      assistantText = '';
      assistantLine = null;
      const failed = event.response?.status && event.response.status !== 'completed';
      if (failed) say(`这一轮没有完成（${event.response.status}）。可以继续说话。`);
    }
  }

  async function openLiveMic(mine) {
    const meter = page.querySelector('[data-meter]');
    const handle = await microphone({
      onPCM: (buffer) => {
        if (mine !== callGeneration || !call || !callReady) return;
        try {
          for (const piece of splitPcm(new Uint8Array(buffer), constants.CHUNK_BYTES)) {
            if (piece.byteLength < 2 || piece.byteLength % 2) continue;
            call.send('input_audio_buffer.append', { audio: pcmBase64(piece) });
            if (product.camera && audioPackets % 10 === 0) pushFrame();
            audioPackets += 1;
          }
        } catch (error) {
          say(error.message);
        }
      },
      onDuration: (seconds) => {
        if (meter && mine === callGeneration) meter.textContent = `已通话 ${Math.floor(seconds)} 秒，上限 180 秒。实时语音按百炼账单计费。`;
      },
      onLimit: () => { void endCall('已到 3 分钟上限，通话结束。'); },
      onError: (error) => say(error.message),
    });
    if (mine !== callGeneration || !active) { await handle.discard(); return; }
    recorder = handle;
    handle.resume();
  }

  function waitFinished(ms) {
    return new Promise((resolve) => {
      const timer = setTimeout(() => { finishWait = null; resolve(); }, ms);
      finishWait = () => { clearTimeout(timer); finishWait = null; resolve(); };
    });
  }

  async function writeDiary() {
    if (!product.diary || !history.length || !constants) return;
    const stack = reg.stacks.get('bailian');
    const stored = loadCredentials('bailian');
    const values = stack && stored?.values ? fieldValues(stack, stored.values) : null;
    if (!values?.DASHSCOPE_API_KEY) return;
    const turns = history.filter((item) => item.heard || item.answer);
    if (!turns.length) return;
    say('正在写陪伴日记…');
    const today = new Date();
    const date = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const name = constants.PET_NAME || '豆豆';
    const logText = turns.map((item) => `主人：${item.heard}\n${name}：${item.answer}`).join('\n');
    const facts = { date, turns: turns.length, known_memories: (memory.memories || []).slice(-10).map((item) => item.content) };
    try {
      const turn = await chat({ stack, values }, {
        model: constants.DIARY_MODEL,
        messages: [
          { role: 'system', content: formatDiaryPrompt(constants.PROMPT, name) },
          { role: 'user', content: `${JSON.stringify(facts)}\n\n对话记录：\n${logText}` },
        ],
        response_format: { type: 'json_object' },
        enable_thinking: false,
      }, { allowNetworkFallback: false });
      const diary = parseDiary(redactSecret(turn.text, secret));
      memory = mergeMemories(memory, diary, date, constants.MAX_MEMORIES || 20);
      memory.pet = name;
      try { localStorage.setItem(MEMORY_KEY, JSON.stringify(memory)); } catch { /* 存不下就只显示这一次 */ }
      showMemory();
      if (diaryBox) {
        diaryBox.hidden = false;
        diaryBox.textContent = redactSecret(renderDiary(diary, { today: date, name, turns: turns.length }), secret);
      }
      say('日记已写好，记在这台浏览器。');
    } catch (error) {
      say(`通话已结束。日记没有写成：${error.message}`);
    }
  }

  async function endCall(message) {
    const handle = call;
    callReady = false;
    const mic = recorder;
    recorder = null;
    if (mic) { try { await mic.stop(); } catch { /* 麦克风已经停了 */ } }
    if (product.kind === 'translate' && handle) {
      try { handle.send('session.finish'); say('正在收尾最后一句…'); await waitFinished(8000); } catch { /* 收尾失败也结束 */ }
    }
    callGeneration += 1;
    call = null;
    handle?.close();
    liveButton.textContent = '开始通话';
    const speaker = playback;
    playback = null;
    void speaker?.close();
    const meter = page.querySelector('[data-meter]');
    if (meter) meter.textContent = '';
    say(message);
    if (product.diary) await writeDiary();
  }

  async function startCall() {
    if (call || recorder) return;
    const stored = loadCredentials('bailian');
    const stack = reg.stacks.get('bailian');
    const values = stack && stored?.values ? fieldValues(stack, stored.values) : null;
    if (!values?.DASHSCOPE_API_KEY) { say('先保存百炼 Key'); return; }
    const mine = ++callGeneration;
    secret = values.DASHSCOPE_API_KEY;
    history = [];
    assistantText = '';
    toolRounds = 0;
    audioPackets = 0;
    liveButton.disabled = true;
    let speaker = null;
    try {
      constants = await liveConstants(product.solution);
      if (product.kind === 'translate') fillLanguages(constants.AUDIO_LANGS || []);
      speaker = createSpeaker();
      await speaker.resume();
      if (mine !== callGeneration || !active) { await speaker.close(); return; }
      say('正在接通…');
      const session = product.kind === 'translate'
        ? translationSession({
          language: page.querySelector('[data-language]')?.value || 'en',
          textOnly: Boolean(page.querySelector('[data-text-only]')?.checked),
          phrases: phraseMap(page.querySelector('[data-phrases]')?.value),
        })
        : sessionConfig({
          instructions: product.diary ? instructionsWithPetMemory(constants.INSTRUCTIONS, memory, constants.MEMORY_SLOT, constants.RECALL_MEMORIES) : constants.INSTRUCTIONS,
          voice: constants.DEFAULT_VOICE,
          inputRate: constants.IN_RATE,
          outputRate: constants.OUT_RATE,
          asrModel: constants.ASR_MODEL,
          turnDetection: SEMANTIC_TURN,
          tools: constants.TOOLS,
          video: product.camera,
        });
      const handle = connectRealtime({
        url: realtimeSocketUrl(stack, values, constants.MODEL),
        secret,
        session,
        onEvent: (event) => onRealtime(event, mine),
      });
      call = handle;
      playback = speaker;
      await handle.ready;
      if (mine !== callGeneration || !active) {
        handle.close();
        if (call === handle) call = null;
        if (playback === speaker) playback = null;
        await speaker.close();
        return;
      }
      callReady = true;
      liveButton.textContent = '结束通话';
      say('已接通，正在打开麦克风…');
      await openLiveMic(mine);
      if (mine === callGeneration && active) say(product.kind === 'translate' ? '开始说话。译文会跟着出来。' : '开始说话。说完稍停就会回答。');
    } catch (error) {
      if (call && mine === callGeneration) { call.close(); call = null; }
      callReady = false;
      liveButton.textContent = '开始通话';
      if (playback === speaker) playback = null;
      await speaker?.close()?.catch(() => {});
      if (mine === callGeneration && active) say(error.message);
    } finally {
      if (active) liveButton.disabled = false;
    }
  }

  function fillLanguages(langs) {
    const select = page.querySelector('[data-language]');
    if (!select || select.options.length) return;
    const ordered = [...langs].sort((a, b) => (a === 'en' ? -1 : b === 'en' ? 1 : String(a).localeCompare(String(b))));
    for (const code of ordered) {
      const option = document.createElement('option');
      option.value = code;
      option.textContent = code;
      if (code === 'en') option.selected = true;
      select.append(option);
    }
  }

  page.addEventListener('click', (event) => {
    const source = event.target.closest('[data-source]');
    if (source) void openSource(source.dataset.source);
    if (event.target.closest('[data-live]')) void (call ? endCall('已结束通话') : startCall());
    if (event.target.closest('[data-forget]')) {
      memory = {};
      try { localStorage.removeItem(MEMORY_KEY); } catch { /* 清不掉就只清这一页 */ }
      showMemory();
      if (diaryBox) { diaryBox.hidden = true; diaryBox.textContent = ''; }
      say('已清空这台浏览器记住的豆豆记忆。');
    }
  });

  return { cleanup() {
    active = false;
    callGeneration += 1;
    call?.close();
    call = null;
    secret = '';
    void playback?.close();
    stream?.getTracks().forEach((track) => track.stop());
    recorder?.discard();
  } };
}
