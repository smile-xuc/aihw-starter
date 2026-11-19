import { liveConstants } from '../data.js';
import { ApiError, chat, postJson, toBase64 } from '../live/client.js';
import { microphone } from '../live/microphone.js';
import { SAMPLE_RATE, SESSION_CALL_SECONDS } from '../live/pcm.js';
import { BIO_TOOL, EMBED_MODEL, OBSERVE_EVERY_MS, RETRIEVE_TOOL, UPDATER_PROMPT, activeLibrary, applyBio, applyMemoryPatch, bioReceipt, cleanObservation, clearLibrary, createLibrary, datedEntries, dialogueEntries, dialogueLines, envCorpus, finishDialogue, formatUpdaterInput, isEmptyPatch, localDate, memoryLabel as libraryStatus, mergeVectorHits, observerPrompt, parsePatch, rankWithTime, readStore, recordExchange, recordObservation, redactOperations, rememberTurn, renameLibrary, renderProfile, renderRecent, replaceActive, retrieveMemory, sessionFacts, switchLibrary, vectorMatches, vectorsForTexts, vectorsFromEmbedding, writeStore, normalizeVector } from '../live/memory-libraries.js';
import { CANCEL_TOOL, LIST_TOOL, MONITOR_TOOL, NARRATE_TOOL, SEARCH_TOOL, TIMER_TOOL, UPDATE_TOOL, backgroundRows, cadenceNote, cadenceStep, cancelProactive, fastAck, fastStatus, isSilentMonitor, forgetLateResult, lateResultPrompt, lateSpeechText, listProactive, rememberLateResult, modalityNote, monitorFocus, monitorPlan, duplicateNote, monitorRoom, narrationBrief, narrationPlan, readSearchResponse, reminderNote, reminderText, searchInFlight, searchResponsesBody, takeClaim, narrateTask, nextSpokenAlert, openBackground, openMonitor, patchBackground, perceptionRules, pushMonitorAudio, retainTasks, searchMessages, sourceHint, speakReminder, spokenWhileMuted, dropLate, stopLookup, takeLate, takeMonitorAudio, taskPrompt, timerRequest, toolArguments, updateProactive } from '../live/monitor.js';
import { BACKEND_TOOLS, isBackendTool, noBackendReceipt, noBackendTitle } from '../live/no-backend.js';
import { DEMAND_INSTRUCTIONS, LOOK_TOOL, analyzeFrame, visualQuestion } from '../live/on-demand.js';
import { openToolRound, responseFunctionCalls } from '../live/product-session.js';
import { MUTE_HEARTBEAT_MS, OMNI_38_VOICES, chooseVoice, connectRealtime, decodeBase64, pcmBase64, readVoice, realtimeSocketUrl, redactSecret, SEMANTIC_TURN, sessionConfig, silenceFrame, splitPcm, writeVoice } from '../live/realtime-omni.js';
import { browserSupport } from '../live/index.js';
import {
  SUMMARY_MODEL, SYSTEM_PROMPT, buildUserContent, clipSummary, encodeWav, instructionsWithMemory, isSessionReturn, nextMemory, nextTextHistory, requestMessages, safeAudioUrl, spokenText, summaryMessages, withRetrieved,
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
需要事实或最新信息时调用 web_search。回执里没有答案，这一轮只说你去查了，结果稍后另说。同一轮里已经在查的问题不要再调用。已经开始的监视、解说或到点提醒也不要再创建一次。稍后的结果只有明确写了已经联网，才可以说查过网上；不能确认时不要说已经查过，也不要编造链接。
用户说从现在开始关注身体、咳嗽了提醒，或盯着以后才发生的声音和画面时，调用 create_proactive_monitor。说「提醒我一次」时 repeat 设为 false；说「从现在开始关注」或「一直盯着」时 repeat 设为 true。用户说咳嗽了就提醒我喝水时，condition 写听到咳嗽，trigger_response 写该喝水了。报告屏幕、画面时 modalities 只写 ["vision"]；咳嗽、身体或声音只写 ["audio"]；又要看又要听才两项都写。回执不表示条件已经发生，这一轮不要说已经听到或看到，也不要把提醒原文说成已经发生。
用户明确说了多久以后提醒时，调用 create_proactive_timer。没有调用成功就不要说已经设好。
用户说持续报告屏幕或画面内容，或解说变化时，调用 create_live_narration，把要报告的内容写进 narration_focus。报告屏幕、画面时 modalities 只写 ["vision"]；只听声音时只写 ["audio"]。回执里没有画面，这一轮不要描述画面。持续报告由后台按自己的节奏开口。这一轮听到的原话会交给后台，句子长短和语气按原话来。narration_focus 只写要看或要听的内容。
持续报告和身体提醒可以同时进行。同一句话里两项都要时，把 create_live_narration 和 create_proactive_monitor 都调用，不要只做一个。两项监视也可以同时留着，后说的一项不要取消前一项，除非用户明确要求停下。这个页面同时最多两项监视，满了就告诉用户先停掉一项。
用户要求改代码、跑命令、操作网页，或交给编码助手时，调用 handoff，task 写用户原话。回执是 no_backend。这一轮只说明这个页面没有编码后台，不要说已经开始或已经做完。
前台要一直能接话。后台结果没到时，不要停下来等，也不要编造结果。
用户明确要求停下某一项监视、解说或到点提醒时，调用 cancel_proactive_task。停下说话、换话题或纠正回答都不算取消。没有调用成功就不要说已经停下。
用户明确要求修改某一项正在进行的监视、解说或到点提醒时，调用 update_proactive_task。不能把一种任务改成另一种。没有调用成功就不要说已经改了。
用户说出会在以后多次用到的个人事实时，调用 omnibio 记下。改掉或取消已有事实时，按提示里的编号 update 或 delete。已经记下的不要重复。名单满了就不要再加，不要删掉更早的事实来腾位置。
用户问起更早的对话、而当前记忆里没有时，调用 omniretrieve，source 用 dialogue。问起以前看到的环境时，source 用 env。用户提到昨天、上周这类时间时，把时间放进 time_range，例如昨天用 [2, 0]，上周用 [14, 1]，不要写进 query。
不识别画面中人的身份；看不清就直说，不要编造。
用户可以随时插话。`;
const SESSION_TOOLS = [SEARCH_TOOL, MONITOR_TOOL, TIMER_TOOL, NARRATE_TOOL, UPDATE_TOOL, CANCEL_TOOL, LIST_TOOL, BIO_TOOL, RETRIEVE_TOOL, ...BACKEND_TOOLS];

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
  let muted = false;
  return {
    resume() { return ctx.resume(); },
    playing() { return sources.size > 0 && next > ctx.currentTime + 0.05; },
    setMuted(on) { muted = Boolean(on); if (muted) this.interrupt(); },
    interrupt() {
      for (const source of sources) {
        try { source.stop(); } catch { /* 已经播完 */ }
      }
      sources.clear();
      next = ctx.currentTime;
    },
    push(bytes, rate) {
      if (muted) return;
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
      <h1>前台接着聊，后台慢慢做。</h1>
      <p>打开摄像头，或点「屏幕」共享手机画面。接通后直接说话。说「从现在开始持续报告我手机屏幕里的内容」，前台先答应，后台过一会儿再讲屏幕上有什么，这一项只看画面。说「从现在开始关注我的身体」，会一直听，同一次里不重复说，这一项只听声音。说「咳嗽了提醒我一次」，说过就停。这两项可以同时开。说「把这个交给编码助手」，前台马上说明这个页面没有编码后台，不会假装已经开始。说「咳嗽了就提醒我喝水」，提醒的是喝水，不是只说听到了咳嗽。说「有人叫我名字就说我在」，已经在听的咳嗽提醒会继续。这个页面同时最多两项监视。说「持续报告屏幕，每次只说一句很短的话」，后台按这句原话的详略来讲。同一轮里已经在查的问题，或已经开始的提醒，不会再开一条。同一句话里要持续报告屏幕、又要咳嗽提醒时，两项都会开始。问到事实时，只有确认这次联网了，才会说查过网上。这一通最长 30 分钟，到点会结束通话，持续报告和监视也停下。正在查或正在看的一项可以停下，停下后结果不再说出来。已经发出的请求仍会计费。查询和看图的结果由单独的播报说出，不再占用主对话。查到或看到的结果会留给这一通对话，之后追问可以直接用。持续报告和咳嗽提醒说过的话也会留下。播报静音时，还没说的查询和看图也不再补播。费用记在你的百炼账号上。</p>
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
      <p class="small" data-realtime-note>实时通话会把 Key 放进发往百炼官方域名的 WebSocket 连接参数。浏览器不能设置 Authorization 头，换临时 Key 的接口也没有跨域。qwen3.8 实时模型通常还要填写业务空间 ID。页面地址、历史和导出不会写入 Key。接通后麦克风保持打开，这一通最长 30 分钟，到点会结束通话，持续报告和监视也停下。正在查或正在看的一项可以停下，停下后结果不再说出来。已经发出的请求仍会计费。查询和看图的结果由单独的播报说出，不再占用主对话。查到或看到的结果会留给这一通对话，之后追问可以直接用。持续报告和咳嗽提醒说过的话也会留下。播报静音时，还没说的查询和看图也不再补播。实时画面大约每秒送一帧。问到事实时会另查一次公开信息。主动提醒和连续解说各走一条后台连接，可以同时进行。后说的一项不会把另一项停掉。说「咳嗽了提醒我一次」，提醒过就停。说「从现在开始关注」，会一直听，同一次里不重复说。报告屏幕时只看画面，不把麦克风送进这一项。咳嗽和身体提醒只听声音，不送画面。说「把这个交给编码助手」，前台马上说明这个页面没有编码后台，不会假装已经开始。说「咳嗽了就提醒我喝水」，提醒的是喝水，不是只说听到了咳嗽。说「有人叫我名字就说我在」，已经在听的咳嗽提醒会继续。这个页面同时最多两项监视。说「持续报告屏幕，每次只说一句很短的话」，后台按这句原话的详略来讲。同一轮里已经在查的问题，或已经开始的提醒，不会再开一条。同一句话里要持续报告屏幕、又要咳嗽提醒时，两项都会开始。问到事实时，只有确认这次联网了，才会说查过网上。咳嗽没发生就不出声。只解说变化时，没有明显变化也不出声。到点提醒会另读一句。说出来的提醒会排好队，等当前这句话播完再依次播出。可以说「不用盯了」，或点停止监视、停止解说，只停这一项，不用结束通话。通话中可以麦克风静音或播报静音。麦克风静音后声音不再送进通话和监视，大约每 30 秒送一秒静音来保持连接。播报静音会立刻停掉正在说的话，还没播的提醒不再补播。音色默认 Tina，可换成 qwen3.8 支持的预设。这一通已经接通时，主对话仍用接通时的音色；监视、到点提醒和下一次通话用新的。复刻音色仍在 Mac 上。可以说「把条件改成只看红字」，正在进行的这一项会按新的来，不用先取消。改提醒时间会从现在重新计。可以说「持续报告我手机屏幕里的内容」，或「关注我的身体，咳嗽了就提醒」。前台先接住，后台再看再查，结果稍后才说。这些都另计费。按需看一眼只在问到画面时另开一次看图。最近对话的文字留在这台浏览器。结束通话后用 qwen3.7-plus 更新长期资料和近期事项，给不出可用更新时才收成一段摘要，另计费，不含 Key、画面和录音。可以新建、切换和重命名记忆库，通话中不能换。长期事实记在当前这一套；问更早的对话时用 text-embedding-v4 做向量检索，并和关键词结果合在一起，另计费；向量失败才只留关键词。提到昨天或上周时按时间把对应对话排在前面，最多留 40 句，窗口外的结果仍会保留。对话会按最多 4 句、约 1000 字或停顿 60 秒收成片段，这台浏览器最多留 80 段，这些片段会计算向量，问更早的对话时和关键词、时间一起用，另计费，向量只留在这台浏览器。近期事项超过 90 天，或即将发生的日期过了 2 天，就不再放进通话。快到的事会优先写进提示，并带上记下的时间。这台浏览器最多留 40 条。长期事实最多 128 条、每条 200 字，按编号修改或删除；满了不再新增，也不会把更早的挤掉。结束通话时，这一通新记下的事实最多取 64 条交给整理；这一通没有新事实时才用对话摘录。通话中记下的事实和刚查到的内容会立刻写进这一通，不必等挂断。打开视觉记忆后，接通时先记一帧，之后大约每 60 秒再用看图模型记一帧，另计费。屏幕会标明这是屏幕内容。</p>
      <label class="field">音色<select data-voice></select></label>
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
        <button type="button" class="secondary-action" data-stop-task hidden>停止监视</button>
        <button type="button" class="secondary-action" data-mute-mic hidden aria-pressed="false">麦克风静音</button>
        <button type="button" class="secondary-action" data-mute-speaker hidden aria-pressed="false">播报静音</button>
        <button type="button" class="secondary-action" data-talk>按住说话</button>
        <button type="button" class="secondary-action" data-send>只发这一帧</button>
        <button type="button" class="secondary-action" data-stop hidden>停止</button>
      </div>
      <div class="background-lane" data-background>
        <h2>后台</h2>
        <p class="small">前台先接住这句话。持续报告和咳嗽提醒可以同时开，两项监视也可以同时留着，结果稍后才说。查询和看图由单独的播报说出。正在查或正在看时，可以点「停止这项」。</p>
        <ol data-background-list></ol>
      </div>
      <audio data-player controls hidden></audio>
    </section>
    <section class="panel"><h2>这一轮对话</h2><ol data-log></ol></section>
    <section class="panel">
      <h2>还能用 Key 直接跑的玩法</h2>
      <div class="link-list">${runnable.map((item) => html`<a href="${item.href}">${item.label}</a>`)}</div>
      <p class="small">上面这些都能用同一把 Key 在浏览器里跑。可以说「持续报告我手机屏幕里的内容」「关注我的身体，咳嗽了就提醒」「一分钟后提醒我喝水」或「记住我喜欢喝茶」。前台先接住，结果稍后才说。记忆库在通话前切换。编码委托要在 Mac 上用 <a href="https://github.com/QwenLM/Qwen-Live-Harness" rel="noopener">Qwen-Live-Harness</a>。</p>
    </section>`);

  const video = page.querySelector('[data-preview]');
  const status = page.querySelector('[data-status]');
  const questionEl = page.querySelector('[data-question]');
  const log = page.querySelector('[data-log]');
  const player = page.querySelector('[data-player]');
  const stopButton = page.querySelector('[data-stop]');
  const liveButton = page.querySelector('[data-live]');
  const voiceSelect = page.querySelector('[data-voice]');
  function currentVoice() {
    return chooseVoice(voiceSelect?.value);
  }
  {
    const chosen = readVoice(localStorage);
    for (const name of OMNI_38_VOICES) {
      const option = document.createElement('option');
      option.value = name;
      option.textContent = name;
      voiceSelect.append(option);
    }
    voiceSelect.value = chosen;
  }
  voiceSelect.addEventListener('change', () => {
    let chosen;
    try { chosen = writeVoice(localStorage, voiceSelect.value); }
    catch (error) {
      say(error.message);
      voiceSelect.value = readVoice(localStorage);
      return;
    }
    voiceSelect.value = chosen;
    say(call ? `音色已改为 ${chosen}。这一通的主对话仍用接通时的音色，监视、到点提醒和下一次通话会用它。` : `音色已改为 ${chosen}。`);
  });
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
  let callUsesTools = false;
  let retrieved = '';
  let sentInstructions = '';
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
  let bioAtStart = [];
  let memoryAtStart = '[]';
  let folding = false;
  let captureMode = 'live';
  let liveValues = null;
  let lastHeard = '';
  let turnHeard = '';
  let toolRounds = 0;
  let toolRound = null;
  let lookGeneration = 0;
  const watches = new Map();
  let tasks = [];
  let adjacentId = null;
  let background = [];
  let lateQueue = [];
  let lateResults = [];
  let speakingLateId = '';
  let playingAlertId = '';
  const lookupStops = new Map();
  const workClaims = new Set();
  let pumpingLate = false;
  let foregroundBusy = false;
  let lateResponse = false;
  const timers = new Map();
  const spokenAlerts = [];
  let drainingAlerts = false;
  let userTurn = false;
  let inputMuted = false;
  let outputMuted = false;
  let muteHeartbeat = null;
  let embedAbort = null;
  let vectorAbort = null;
  let vectorJob = 0;
  let vectorNotice = false;
  let vectorDbPromise = null;
  let observeTimer = null;
  let observeGeneration = 0;
  let observeAbort = null;
  let videoSource = 'camera';
  let monitorAudio = { parts: [], total: 0 };
  let captureMonitorAudio = false;
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
    const safeHeard = redactSecret(heard, secret);
    const safeAnswer = redactSecret(answer, secret);
    memory = nextMemory(memory, safeHeard, safeAnswer);
    const library = activeLibrary(store);
    const at = Date.now() / 1000;
    const beforeSegments = cleanDialogueCount(library);
    if (JSON.stringify(memory) !== before && memory.at(-1)) library.turns = rememberTurn(library.turns, memory.at(-1), at);
    library.dialogue = recordExchange(library.dialogue, safeHeard, safeAnswer, at);
    saveActive();
    showMemory();
    refreshLiveMemory();
    if (cleanDialogueCount(library) > beforeSegments) scheduleSegmentVectors(library.id);
  }
  function cleanDialogueCount(library) {
    return Array.isArray(library?.dialogue?.segments) ? library.dialogue.segments.length : 0;
  }
  function archiveDialogue() {
    const library = activeLibrary(store);
    const beforeSegments = cleanDialogueCount(library);
    library.dialogue = finishDialogue(library.dialogue);
    saveActive();
    if (cleanDialogueCount(library) > beforeSegments) scheduleSegmentVectors(library.id);
  }
  function livePrompt(tools) {
    const library = activeLibrary(store);
    const demand = captureMode === 'demand';
    const base = demand ? DEMAND_INSTRUCTIONS : (tools ? LIVE_TOOL_INSTRUCTIONS : LIVE_INSTRUCTIONS);
    return withRetrieved(instructionsWithMemory(base, memory, summary, bio, renderProfile(library.ltm), renderRecent(library.stm, localDate())), retrieved) + taskPrompt(tasks) + lateResultPrompt(lateResults);
  }
  function refreshLiveMemory() {
    if (!call || !callReady) return;
    const next = livePrompt(callUsesTools);
    if (next === sentInstructions) return;
    try { call.send('session.update', { session: { instructions: next } }); }
    catch { return; }
    sentInstructions = next;
  }
  syncMemory();
  if (loaded.migrated) saveActive();
  bioAtStart = bio.slice();
  memoryAtStart = JSON.stringify(memory);
  showMemory();
  function clearMuteHeartbeat() {
    if (muteHeartbeat) clearInterval(muteHeartbeat);
    muteHeartbeat = null;
  }
  function startMuteHeartbeat() {
    clearMuteHeartbeat();
    muteHeartbeat = setInterval(() => {
      if (!inputMuted || !call || !callReady || !liveSpec) return;
      try { call.send('input_audio_buffer.append', { audio: pcmBase64(silenceFrame(liveSpec.IN_RATE, 1)) }); }
      catch { /* 静音心跳只保持连接，失败不结束通话 */ }
    }, MUTE_HEARTBEAT_MS);
  }
  const setLiveLabel = (on) => {
    liveButton.textContent = on ? '结束实时通话' : '开始实时通话';
    liveButton.setAttribute('aria-pressed', on ? 'true' : 'false');
    const talkButton = page.querySelector('[data-talk]');
    if (talkButton) talkButton.disabled = on;
    for (const button of page.querySelectorAll('[data-capture]')) button.disabled = on;
    inputMuted = false;
    outputMuted = false;
    clearMuteHeartbeat();
    playback?.setMuted(false);
    const micMute = page.querySelector('[data-mute-mic]');
    const speakerMute = page.querySelector('[data-mute-speaker]');
    if (micMute) { micMute.hidden = !on; micMute.textContent = '麦克风静音'; micMute.setAttribute('aria-pressed', 'false'); }
    if (speakerMute) { speakerMute.hidden = !on; speakerMute.textContent = '播报静音'; speakerMute.setAttribute('aria-pressed', 'false'); }
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
    for (const item of timers.values()) clearTimeout(item.handle);
    timers.clear();
  }

  function showTaskButton() {
    const perception = tasks.filter((item) => item.kind === 'monitor' || item.kind === 'narration');
    const button = page.querySelector('[data-stop-task]');
    if (!button) return;
    button.hidden = perception.length === 0;
    if (perception.length > 1) button.textContent = '停止最近这项';
    else if (perception[0]?.kind === 'narration') button.textContent = '停止解说';
    else if (perception.length) button.textContent = '停止监视';
  }

  function stopWatch(id) {
    watches.get(id)?.stop();
  }
  function stopAllWatches() {
    for (const watch of watches.values()) watch.stop();
  }
  function syncWatchAudio() {
    captureMonitorAudio = tasks.some((item) => item.kind !== 'timer' && (!item.modalities || item.modalities.includes('audio')));
  }
  function alongsideNote(kind, title = '') {
    const needle = String(title || '').trim().toLocaleLowerCase();
    const others = tasks.filter((item) => {
      if (item.kind !== 'monitor' && item.kind !== 'narration') return false;
      if (kind === 'narration' && item.kind === 'narration') return false;
      if (kind === 'monitor' && item.kind === 'monitor' && item.title.trim().toLocaleLowerCase() === needle) return false;
      return true;
    });
    return others.length ? '另一项后台会继续。' : '';
  }

  function rememberTask(task) {
    tasks = retainTasks(tasks, task);
    adjacentId = task.id;
    showTaskButton();
    refreshLiveMemory();
  }

  function dropTask(id) {
    const before = tasks.length;
    tasks = tasks.filter((item) => item.id !== id);
    if (adjacentId === id) adjacentId = null;
    if (tasks.length === before) return;
    showTaskButton();
    refreshLiveMemory();
  }

  function stopTask(id) {
    const timer = timers.get(id);
    if (timer) {
      clearTimeout(timer.handle);
      timers.delete(id);
      dropTask(id);
      return;
    }
    if (!tasks.some((item) => item.id === id && item.kind !== 'timer')) return;
    stopWatch(id);
    dropTask(id);
  }

  function resetTasks() {
    tasks = [];
    adjacentId = null;
    showTaskButton();
  }

  function endCall(message) {
    archiveDialogue();
    clearTimers();
    stopObserver();
    stopAllWatches();
    resetTasks();
    clearSpokenAlerts();
    workClaims.clear();
    clearBackground();
    embedAbort?.abort();
    retrieved = '';
    sentInstructions = '';
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

  function settleBio(origin) {
    if (bioAtStart === origin) bioAtStart = bio.slice();
  }
  async function foldMemory() {
    const origin = bioAtStart;
    const facts = sessionFacts(origin, activeLibrary(store).bio);
    if (folding || (!facts.length && (JSON.stringify(memory) === memoryAtStart || !memory.length))) return;
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
            facts: facts.map((line) => redactSecret(line, values.DASHSCOPE_API_KEY)),
            today,
          }) },
        ],
        enable_thinking: false,
      }, { allowNetworkFallback: false });
      const patch = parsePatch(redactSecret(turn.text, values.DASHSCOPE_API_KEY));
      if (!patch) throw new Error('没有给出可用的更新');
      if (isEmptyPatch(patch)) {
        memoryAtStart = JSON.stringify(memory);
        settleBio(origin);
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
      settleBio(origin);
      showMemory();
      say('长期资料和近期事项已更新，留在这台浏览器。');
    } catch (error) {
      try {
        await foldSummary(stack, values);
        settleBio(origin);
      }
      catch (summaryError) { say(`通话已结束。记忆没有写成：${summaryError.message}`); }
    } finally {
      folding = false;
    }
  }

  function onRealtime(event, mine) {
    if (!active || mine !== callGeneration) return;
    if (event.type === 'error') { say(event.message); return; }
    if (event.type === 'socket.close') {
      archiveDialogue();
      clearTimers();
      stopObserver();
      stopAllWatches();
      resetTasks();
      embedAbort?.abort();
      retrieved = '';
      sentInstructions = '';
      clearSpokenAlerts();
      workClaims.clear();
      clearBackground();
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
      adjacentId = null;
      userTurn = true;
      turnHeard = '';
      workClaims.clear();
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
      turnHeard = event.transcript;
      const item = document.createElement('li');
      item.textContent = redactSecret(`听到：${event.transcript}`, secret);
      log.append(item);
      remember(event.transcript, '');
      return;
    }
    if (event.type === 'response.audio.delta' && event.delta) {
      if (outputMuted) return;
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
      if (lateResponse) {
        lateResponse = false;
        speakingLateId = '';
        foregroundBusy = false;
        remember('', assistantText);
        assistantText = '';
        assistantLine = null;
        void drainAlerts();
        void pumpLate();
        return;
      }
      const calls = responseFunctionCalls(event, toolRounds);
      if (calls.length && call) {
        toolRounds += 1;
        foregroundBusy = true;
        toolRound = openToolRound(calls.map((item) => item.call_id));
        for (const item of calls) void runToolCall(item, mine);
        return;
      }
      remember('', assistantText);
      assistantText = '';
      assistantLine = null;
      userTurn = false;
      foregroundBusy = false;
      const failed = event.response?.status && event.response.status !== 'completed';
      say(failed ? `这一轮没有完成（${event.response.status}）。可以继续说话。` : '可以继续说话。');
      void drainAlerts();
      void pumpLate();
    }
  }

  function showBackground() {
    const list = page.querySelector('[data-background-list]');
    if (!list) return;
    const rows = backgroundRows(background);
    list.replaceChildren();
    if (!rows.length) {
      const item = document.createElement('li');
      item.textContent = '还没有后台任务。可以说「持续报告我手机屏幕里的内容」，或「咳嗽了就提醒我喝水」。';
      list.append(item);
      return;
    }
    for (const job of background.filter((item) => item && item.id)) {
      const item = document.createElement('li');
      item.textContent = backgroundRows([job])[0];
      const waiting = lateQueue.some((entry) => entry.id === job.id) || speakingLateId === job.id || playingAlertId === job.id || spokenAlerts.some((entry) => entry.id === job.id);
      if ((job.lane === 'search' || job.lane === 'look') && (job.state === 'accepted' || job.state === 'running' || waiting)) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'secondary-action';
        button.dataset.stopLookup = job.id;
        button.textContent = '停止这项';
        item.append(button);
      }
      list.append(item);
    }
  }
  function noteJob(id, patch) {
    if (!id) return;
    background = patchBackground(background, id, patch);
    showBackground();
  }
  function clearBackground() {
    for (const stop of lookupStops.values()) stop.abort();
    lookupStops.clear();
    background = [];
    lateQueue = [];
    lateResults = [];
    speakingLateId = '';
    foregroundBusy = false;
    lateResponse = false;
    showBackground();
  }
  function stopLookupJob(id) {
    let next;
    try { next = stopLookup(background, id); }
    catch (error) { say(error.message); return; }
    background = next;
    lookupStops.get(id)?.abort();
    lookupStops.delete(id);
    lateQueue = dropLate(lateQueue, id);
    lateResults = forgetLateResult(lateResults, id);
    refreshLiveMemory();
    spokenAlerts.splice(0, spokenAlerts.length, ...spokenAlerts.filter((item) => item.id !== id));
    if (playingAlertId === id) playback?.interrupt();
    if (speakingLateId === id || playingAlertId === id) {
      speakingLateId = '';
      playingAlertId = '';
    }
    showBackground();
    say('这项已停下，结果不再说出来。已经发出的请求仍会计费。');
  }
  showBackground();

  async function answerLook(item, mine, generation) {
    const jpeg = liveSpec ? captureJpeg(video, liveSpec.MAX_FRAME_BYTES) : null;
    const question = visualQuestion(toolArguments(item.arguments).query, lastHeard);
    const accepted = Boolean(jpeg);
    const output = accepted ? fastAck('look') : '没有打开摄像头或屏幕，看不到画面。';
    if (!active || mine !== callGeneration || !call) return;
    const id = `look-${mine}-${Date.now()}`;
    if (accepted) {
      background = openBackground(background, { id, lane: 'look', title: question });
      showBackground();
    }
    try { replyTool(item, output, accepted ? fastStatus('look') : output); }
    catch (error) { say(error.message); return; }
    if (!accepted) return;
    noteJob(id, { state: 'running', note: '正在看这一帧' });
    const stop = new AbortController();
    lookupStops.set(id, stop);
    let result;
    try {
      result = await analyzeFrame({
        url: realtimeSocketUrl(reg.stacks.get('bailian'), liveValues, liveSpec.REALTIME_MODEL),
        secret,
        jpeg,
        question,
        voice: currentVoice(),
        inputRate: liveSpec.IN_RATE,
        outputRate: liveSpec.OUT_RATE,
        asrModel: liveSpec.ASR_MODEL,
        signal: stop.signal,
      }) || '看图没有返回文字。';
    } catch (error) {
      if (stop.signal.aborted) return;
      result = `看图失败：${error.message}`;
    } finally {
      lookupStops.delete(id);
    }
    if (stop.signal.aborted) return;
    if (!active || mine !== callGeneration || generation !== lookGeneration) {
      noteJob(id, { state: 'delivered', note: '你又说话了，这次不送了' });
      return;
    }
    noteJob(id, { state: result.startsWith('看图失败') ? 'failed' : 'delivered', note: result });
    queueLate(result, mine, '', id);
  }

  function answerNoBackend(item, mine) {
    if (!active || mine !== callGeneration || !call) return;
    const id = `backend-${mine}-${Date.now()}`;
    const title = noBackendTitle(item.name, toolArguments(item.arguments));
    background = patchBackground(
      openBackground(background, { id, lane: 'delegate', title }),
      id,
      { state: 'failed', note: '没有编码后台，没有创建会话，也没有执行。' },
    );
    showBackground();
    try { replyTool(item, noBackendReceipt(), '编码委托没有开始：这个页面没有编码后台。'); }
    catch (error) { say(error.message); }
  }

  function speakToolRound() {
    try { call.send('response.create'); }
    catch (error) {
      foregroundBusy = false;
      say(error.message);
    }
  }
  function replyTool(item, output, display = output) {
    const shown = redactSecret(display, secret);
    const line = document.createElement('li');
    line.textContent = shown;
    log.append(line);
    foregroundBusy = true;
    try {
      call.send('conversation.item.create', { item: { type: 'function_call_output', call_id: item.call_id, output: redactSecret(output, secret) } });
    } catch (error) {
      foregroundBusy = false;
      throw error;
    }
    const step = toolRound ? toolRound.finish(item.call_id) : 'speak';
    if (step === 'speak') speakToolRound();
  }
  function startTool(item, mine) {
    if (item.name === 'analyze_view') return answerLook(item, mine, lookGeneration);
    if (item.name === 'web_search') return answerSearch(item, mine);
    if (item.name === 'create_proactive_monitor') return answerMonitor(item, mine);
    if (item.name === 'create_proactive_timer') return answerTimer(item, mine);
    if (item.name === 'create_live_narration') return answerNarrate(item, mine);
    if (item.name === 'update_proactive_task') return answerUpdate(item, mine);
    if (item.name === 'cancel_proactive_task') return answerCancel(item, mine);
    if (item.name === 'list_proactive_tasks') return answerList(item, mine);
    if (item.name === 'omnibio') return answerBio(item, mine);
    if (item.name === 'omniretrieve') return answerRetrieve(item, mine);
    if (isBackendTool(item.name)) return answerNoBackend(item, mine);
    replyTool(item, '没有这个工具');
  }
  async function runToolCall(item, mine) {
    try {
      await startTool(item, mine);
    } catch (error) {
      if (toolRound?.waiting(item.call_id) && active && mine === callGeneration && call) {
        try { replyTool(item, error.message); return; }
        catch (sendError) { say(sendError.message); }
      }
    }
    if (!toolRound?.waiting(item.call_id)) return;
    if (active && mine === callGeneration && call) {
      try { replyTool(item, '这项没有完成。'); return; }
      catch (error) { say(error.message); }
    }
    if (toolRound.finish(item.call_id) === 'speak' && active && call) speakToolRound();
  }

  function queueLate(text, mine, status = '', id = '') {
    const clean = redactSecret(String(text || ''), secret).replace(/\s+/g, ' ').trim();
    if (!clean) return;
    const line = document.createElement('li');
    line.textContent = `后台送到：${clean}`;
    log.append(line);
    lateQueue.push({ text: clean, mine, status, id });
    lateResults = rememberLateResult(lateResults, { text: clean, status, id });
    refreshLiveMemory();
    void pumpLate();
  }
  async function pumpLate() {
    if (pumpingLate) return;
    pumpingLate = true;
    try {
      while (active && lateQueue.length) {
        const ready = Boolean(call && callReady && !userTurn && !playback?.playing() && !foregroundBusy);
        const step = takeLate(lateQueue, ready);
        if (!step.item) {
          await new Promise((resolve) => setTimeout(resolve, 200));
          continue;
        }
        lateQueue = step.queue;
        if (step.item.mine !== callGeneration || !call || !liveSpec || !liveValues) continue;
        if (outputMuted) continue;
        const id = step.item.id || '';
        const speech = new AbortController();
        if (id) lookupStops.set(id, speech);
        speakingLateId = id;
        showBackground();
        try {
          const spoken = await speakReminder({
            url: realtimeSocketUrl(reg.stacks.get('bailian'), liveValues, liveSpec.REALTIME_MODEL),
            secret,
            text: lateSpeechText(step.item.text, step.item.status),
            limit: 200,
            voice: currentVoice(),
            inputRate: liveSpec.IN_RATE,
            outputRate: liveSpec.OUT_RATE,
            asrModel: liveSpec.ASR_MODEL,
            signal: speech.signal,
          });
          if (speech.signal.aborted || !active || step.item.mine !== callGeneration || outputMuted) continue;
          enqueueAlert(spoken.audio, step.item.mine, id);
        } catch (error) {
          if (speech.signal.aborted) continue;
          say(`结果到了，但没有读出来：${error.message}`);
        } finally {
          if (lookupStops.get(id) === speech) lookupStops.delete(id);
          if (speakingLateId === id) speakingLateId = '';
          showBackground();
        }
      }
    } finally {
      pumpingLate = false;
      if (active && lateQueue.length) void pumpLate();
    }
  }

  async function answerSearch(item, mine) {
    let query = '';
    let output;
    try {
      query = searchMessages(toolArguments(item.arguments).query)[1].content;
      output = searchInFlight(background, query) || !takeClaim(workClaims, 'search', query) ? duplicateNote('search') : fastAck('search');
    } catch (error) {
      output = error.message;
    }
    if (!active || mine !== callGeneration || !call) return;
    const id = `search-${mine}-${Date.now()}`;
    const started = output.startsWith('已交给');
    if (started) {
      background = openBackground(background, { id, lane: 'search', title: query });
      showBackground();
    }
    try { replyTool(item, output, started ? fastStatus('search', query) : output); }
    catch (error) { say(error.message); return; }
    if (!started) return;
    noteJob(id, { state: 'running', note: '正在查' });
    const stop = new AbortController();
    lookupStops.set(id, stop);
    let result = '没有查到结果。';
    let status = 'unknown';
    try {
      const cred = { stack: reg.stacks.get('bailian'), values: liveValues };
      let body;
      try {
        body = await postJson(cred, 'compatible', '/responses', searchResponsesBody(liveSpec.OMNI_MODEL, query), { signal: stop.signal, allowNetworkFallback: false });
      } catch (error) {
        if (stop.signal.aborted || !(error instanceof ApiError) || error.status !== 404) throw error;
        const turn = await chat(cred, {
          model: liveSpec.OMNI_MODEL,
          messages: searchMessages(query),
          enable_search: true,
          search_options: { search_strategy: 'agent' },
          enable_thinking: false,
        }, { signal: stop.signal, allowNetworkFallback: false });
        body = { output_text: turn.text };
      }
      const parsed = readSearchResponse(body);
      result = redactSecret(parsed.text, secret).replace(/\s+/g, ' ').trim() || '没有查到结果。';
      status = parsed.status;
    } catch (error) {
      if (stop.signal.aborted) return;
      result = `搜索失败：${error.message}`;
      status = 'not_performed';
    } finally {
      lookupStops.delete(id);
    }
    if (stop.signal.aborted) return;
    if (!active || mine !== callGeneration) {
      noteJob(id, { state: 'delivered', note: '通话已结束' });
      return;
    }
    noteJob(id, { state: status === 'not_performed' ? 'failed' : 'delivered', note: result });
    queueLate(result, mine, status, id);
  }

  async function answerMonitor(item, mine) {
    let output;
    let display = '';
    let condition = '';
    let repeat = true;
    let modalities = ['vision', 'audio'];
    let response = '';
    try {
      const plan = monitorPlan(toolArguments(item.arguments));
      condition = plan.condition;
      repeat = plan.repeat;
      modalities = plan.modalities;
      response = plan.response;
      const needsFrame = modalities.includes('vision');
      const room = monitorRoom(tasks, condition);
      if (needsFrame && !(liveSpec && captureJpeg(video, liveSpec.MAX_FRAME_BYTES))) output = '没有打开摄像头或屏幕，无法看画面。';
      else if (!room.ok) output = '已经有两项监视在听。先停掉一项，再加新的。';
      else if (!takeClaim(workClaims, 'monitor', condition)) output = duplicateNote('monitor');
      else {
        output = [fastAck('monitor'), cadenceNote(repeat), reminderNote(plan.response), modalityNote(modalities), needsFrame ? sourceHint(videoSource, condition) : '', alongsideNote('monitor', condition)].filter(Boolean).join('');
        display = [fastStatus('monitor', condition), cadenceNote(repeat), reminderNote(plan.response), modalityNote(modalities), needsFrame ? sourceHint(videoSource, condition) : '', alongsideNote('monitor', condition)].filter(Boolean).join('');
      }
    } catch (error) {
      output = error.message;
    }
    if (!active || mine !== callGeneration || !call) return;
    const id = `monitor-${mine}-${Date.now()}`;
    if (output.startsWith('已交给')) {
      background = openBackground(background, { id, lane: 'monitor', title: condition });
      showBackground();
    }
    try { replyTool(item, output, display || output); } catch (error) { say(error.message); return; }
    if (output.startsWith('已交给')) void runMonitor(condition, mine, { jobId: id, repeat, modalities, response });
  }

  function waitForTurnHeard() {
    const started = Date.now();
    return new Promise((resolve) => {
      const tick = () => {
        if (turnHeard || !active || Date.now() - started >= 1500) resolve(turnHeard);
        else setTimeout(tick, 100);
      };
      tick();
    });
  }

  async function answerNarrate(item, mine) {
    const args = toolArguments(item.arguments);
    let plan;
    try { plan = narrationPlan(args.narration_focus, args.modalities); }
    catch (error) {
      if (!active || mine !== callGeneration || !call) return;
      try { replyTool(item, error.message); } catch (sendError) { say(sendError.message); }
      return;
    }
    const focus = args.narration_focus;
    const needsFrame = plan.modalities.includes('vision');
    const hint = [modalityNote(plan.modalities), needsFrame ? sourceHint(videoSource, focus) : '', alongsideNote('narration', focus)].filter(Boolean).join('');
    const ready = !needsFrame || Boolean(liveSpec && captureJpeg(video, liveSpec.MAX_FRAME_BYTES));
    const fresh = ready && takeClaim(workClaims, 'narration', plan.task);
    const output = !ready
      ? '没有打开摄像头或屏幕，无法解说。'
      : (fresh ? [fastAck(plan.continuous ? 'narration' : 'narrationChange'), hint].filter(Boolean).join('') : duplicateNote('narration'));
    const display = fresh
      ? [fastStatus(plan.continuous ? 'narration' : 'narrationChange', focus), hint].filter(Boolean).join('')
      : output;
    if (!active || mine !== callGeneration || !call) return;
    const id = `narration-${mine}-${Date.now()}`;
    if (fresh) {
      background = openBackground(background, { id, lane: 'narration', title: plan.task });
      showBackground();
    }
    try { replyTool(item, output, display); } catch (error) { say(error.message); return; }
    if (!fresh) return;
    const source = await waitForTurnHeard();
    if (!active || mine !== callGeneration) {
      noteJob(id, { state: 'delivered', note: '通话已结束' });
      return;
    }
    void runMonitor(plan.task, mine, { rules: plan.rules, task: plan.task, label: '解说', gapMs: plan.gapMs, jobId: id, modalities: plan.modalities, focus: String(focus || ''), style: narrationBrief(source) });
  }

  async function answerBio(item, mine) {
    let output;
    try {
      const applied = applyBio(activeLibrary(store), redactOperations(toolArguments(item.arguments).operations, (value) => redactSecret(value, secret)));
      output = bioReceipt(applied);
      if (applied.result.succeeded) {
        bio = applied.entries;
        saveActive();
        showMemory();
        refreshLiveMemory();
      }
    } catch (error) {
      output = error.message;
    }
    if (!active || mine !== callGeneration || !call) return;
    try { replyTool(item, output); } catch (error) { say(error.message); }
  }

  function openVectorDb() {
    if (typeof indexedDB !== 'object' || !indexedDB) return Promise.reject(new Error('没有本地向量库'));
    if (!vectorDbPromise) {
      vectorDbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open('aihw-segment-vectors', 1);
        request.onupgradeneeded = () => {
          if (!request.result.objectStoreNames.contains('vectors')) request.result.createObjectStore('vectors');
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error || new Error('向量库没有打开'));
      });
      vectorDbPromise.catch(() => { vectorDbPromise = null; });
    }
    return vectorDbPromise;
  }
  function vectorKey(libraryId, text) {
    return `${libraryId}\u0000${text}`;
  }
  async function readSegmentVectors(libraryId, texts) {
    const found = new Map();
    const unique = [...new Set(texts.filter(Boolean))];
    if (!unique.length) return found;
    try {
      const db = await openVectorDb();
      await new Promise((resolve, reject) => {
        const tx = db.transaction('vectors', 'readonly');
        const store = tx.objectStore('vectors');
        for (const text of unique) {
          const request = store.get(vectorKey(libraryId, text));
          request.onsuccess = () => {
            const vector = normalizeVector(request.result);
            if (vector) found.set(text, vector);
          };
        }
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch { /* 读不到向量时退回当场计算或关键词 */ }
    return found;
  }
  async function writeSegmentVectors(libraryId, pairs) {
    const rows = pairs.filter((pair) => pair[0] && normalizeVector(pair[1]));
    if (!rows.length) return;
    const db = await openVectorDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction('vectors', 'readwrite');
      const store = tx.objectStore('vectors');
      for (const [text, vector] of rows) store.put(vector, vectorKey(libraryId, text));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
  async function dropSegmentVectors(libraryId) {
    const db = await openVectorDb();
    const prefix = `${libraryId}\u0000`;
    await new Promise((resolve, reject) => {
      const tx = db.transaction('vectors', 'readwrite');
      const request = tx.objectStore('vectors').openCursor();
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) return;
        if (String(cursor.key).startsWith(prefix)) cursor.delete();
        cursor.continue();
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
  function scheduleSegmentVectors(libraryId) {
    const job = ++vectorJob;
    void fillSegmentVectors(libraryId, job);
  }
  async function fillSegmentVectors(libraryId, job) {
    if (job !== vectorJob || !liveValues?.DASHSCOPE_API_KEY) return;
    const library = store.libraries.find((item) => item.id === libraryId);
    if (!library) return;
    const texts = [...new Set(dialogueEntries(library).map((item) => item.text))];
    const cached = await readSegmentVectors(libraryId, texts);
    if (job !== vectorJob) return;
    const { missing } = vectorsForTexts(texts, cached);
    const batch = missing.slice(0, 10);
    if (!batch.length) return;
    if (!vectorNotice && log) {
      vectorNotice = true;
      const line = document.createElement('li');
      line.textContent = '正在为对话片段计算向量，另计费，只留在这台浏览器。';
      log.append(line);
    }
    vectorAbort?.abort();
    vectorAbort = new AbortController();
    try {
      const signal = AbortSignal.any([vectorAbort.signal, AbortSignal.timeout(20000)]);
      const vectors = await embedTexts(batch, signal);
      if (job !== vectorJob) return;
      await writeSegmentVectors(libraryId, batch.map((text, index) => [text, vectors[index]]));
    } catch {
      return;
    }
    if (job === vectorJob && missing.length > batch.length) void fillSegmentVectors(libraryId, job);
  }
  async function embedTexts(texts, signal) {
    const stack = reg.stacks.get('bailian');
    if (!stack || !liveValues?.DASHSCOPE_API_KEY) throw new Error('没有百炼 Key');
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
  async function embedMemory(texts) {
    embedAbort?.abort();
    vectorAbort?.abort();
    embedAbort = new AbortController();
    const signal = AbortSignal.any([embedAbort.signal, AbortSignal.timeout(8000)]);
    return embedTexts(texts, signal);
  }

  async function answerRetrieve(item, mine) {
    let output;
    try {
      const request = toolArguments(item.arguments);
      const library = activeLibrary(store);
      const keyword = retrieveMemory(library, request);
      const corpus = request.source === 'env' ? envCorpus(library) : dialogueLines(library);
      const archive = request.source === 'dialogue' ? dialogueEntries(library) : [];
      const query = redactSecret(String(request.query || ''), secret).replace(/\s+/g, ' ').trim();
      let hits = [];
      let note = '';
      if ((corpus.length || archive.length) && query) {
        try {
          const cached = archive.length ? await readSegmentVectors(library.id, archive.map((item) => item.text)) : new Map();
          const separated = vectorsForTexts(archive.map((item) => item.text), cached);
          const fresh = separated.missing.filter((text) => !corpus.includes(text)).slice(0, 9);
          const vectors = await embedMemory([query, ...corpus, ...fresh]);
          const learned = fresh.map((text, index) => [text, vectors[1 + corpus.length + index]]);
          for (const [text, vector] of learned) separated.ready.set(text, vector);
          if (learned.length) {
            try { await writeSegmentVectors(library.id, learned); }
            catch { /* 这次回答仍使用刚算好的向量 */ }
          }
          const lineHits = vectorMatches(corpus, vectors[0], vectors.slice(1, 1 + corpus.length));
          const archiveHits = vectorMatches(archive.map((item) => item.text), vectors[0], archive.map((item) => separated.ready.get(item.text) || null));
          hits = mergeVectorHits([lineHits, archiveHits]);
          if (separated.missing.length > fresh.length) scheduleSegmentVectors(library.id);
        } catch (error) {
          note = '向量检索没有完成，这次只按关键词查找。';
        }
      }
      output = [note, rankWithTime(keyword, hits, datedEntries(library, request.source), request.time_range)].filter(Boolean).join('\n');
      const kept = output.replace(/^向量检索没有完成，这次只按关键词查找。\n?/u, '').trim();
      retrieved = kept === '没有找到相关记忆。' || kept === '这套记忆库还没有视觉观察。' ? '' : redactSecret(kept, secret).slice(0, 600);
      refreshLiveMemory();
    } catch (error) { output = error.message; }
    if (!active || mine !== callGeneration || !call) return;
    try { replyTool(item, output); } catch (error) { say(error.message); }
  }

  async function answerTimer(item, mine) {
    let plan = null;
    let output;
    try {
      plan = timerRequest(toolArguments(item.arguments));
      output = takeClaim(workClaims, 'timer', `${plan.seconds}|${plan.text}`)
        ? `${plan.seconds} 秒后提醒。到点会另读这一句，费用另计。结束通话会取消还没到点的提醒。`
        : duplicateNote('timer');
    } catch (error) {
      output = error.message;
    }
    if (!active || mine !== callGeneration || !call) return;
    try { replyTool(item, output); } catch (error) { say(error.message); return; }
    if (!plan || output === duplicateNote('timer')) return;
    const taskId = `timer-${mine}-${Date.now()}`;
    armTimer(taskId, plan.text, plan.seconds, mine);
    rememberTask({ id: taskId, kind: 'timer', title: plan.text, reminder: plan.text });
  }

  function armTimer(taskId, text, seconds, mine) {
    const previous = timers.get(taskId);
    if (previous) clearTimeout(previous.handle);
    const handle = setTimeout(() => {
      const spoken = timers.get(taskId)?.text || text;
      timers.delete(taskId);
      dropTask(taskId);
      void fireTimer(spoken, mine);
    }, seconds * 1000);
    timers.set(taskId, { handle, text });
  }

  function watchFocus(task) {
    if (task.kind === 'narration') {
      const base = task.focus ? narrateTask(task.focus) : task.title;
      return task.style ? `${base}\n${task.style}` : base;
    }
    return monitorFocus(task.condition || task.title, task.response);
  }

  function applyTaskUpdate(id, patch) {
    const task = tasks.find((item) => item.id === id);
    if (!task) return;
    if (patch.title) task.title = patch.title;
    if (patch.condition) task.condition = patch.condition;
    if (patch.response) task.response = patch.response;
    if (patch.focus) {
      task.focus = patch.focus;
      if (!patch.title) task.title = narrateTask(patch.focus);
    }
    if (patch.style) task.style = patch.style;
    if (patch.reminder) {
      task.reminder = patch.reminder;
      if (!patch.title) task.title = patch.reminder;
    }
    if (patch.repeat !== undefined) task.repeat = patch.repeat;
    if (patch.modalities) {
      task.modalities = patch.modalities.slice();
      syncWatchAudio();
    }
    if (task.kind === 'timer') {
      const text = task.reminder || task.title;
      const record = timers.get(task.id);
      if (record) record.text = text;
      if (patch.seconds) armTimer(task.id, text, patch.seconds, callGeneration);
    } else {
      try { watches.get(task.id)?.handle?.setFocus(watchFocus(task)); }
      catch (error) { say(error.message); }
    }
    showTaskButton();
    refreshLiveMemory();
  }

  function answerUpdate(item, mine) {
    const decision = updateProactive(tasks, toolArguments(item.arguments));
    if (decision.patch) applyTaskUpdate(decision.id, decision.patch);
    if (!active || mine !== callGeneration || !call) return;
    try { replyTool(item, decision.receipt); } catch (error) { say(error.message); }
  }

  function answerCancel(item, mine) {
    const decision = cancelProactive(tasks, toolArguments(item.arguments), adjacentId);
    for (const id of decision.ids) stopTask(id);
    if (!active || mine !== callGeneration || !call) return;
    try { replyTool(item, decision.receipt); } catch (error) { say(error.message); }
  }

  function answerList(item, mine) {
    const output = listProactive(tasks);
    if (!active || mine !== callGeneration || !call) return;
    try { replyTool(item, output); } catch (error) { say(error.message); }
  }

  function clearSpokenAlerts() {
    spokenAlerts.length = 0;
    userTurn = false;
  }
  function enqueueAlert(chunks, mine, id = '') {
    const audio = (Array.isArray(chunks) ? chunks : []).filter((chunk) => chunk && chunk.byteLength >= 2);
    if (!audio.length || mine !== callGeneration || outputMuted) return;
    spokenAlerts.push({ audio, mine, id });
    spokenAlerts.splice(0, spokenAlerts.length, ...spokenWhileMuted(spokenAlerts, outputMuted));
    void drainAlerts();
  }
  async function drainAlerts() {
    if (drainingAlerts) return;
    drainingAlerts = true;
    try {
      while (active && spokenAlerts.length) {
        const head = spokenAlerts[0];
        if (outputMuted) { spokenAlerts.splice(0, spokenAlerts.length, ...spokenWhileMuted(spokenAlerts, true)); continue; }
        if (!head || head.mine !== callGeneration || !playback) { spokenAlerts.shift(); continue; }
        const step = nextSpokenAlert(spokenAlerts, Boolean(playback.playing() || userTurn));
        if (!step.audio) {
          await new Promise((resolve) => setTimeout(resolve, 200));
          continue;
        }
        spokenAlerts.splice(0, spokenAlerts.length, ...step.waiting);
        playingAlertId = head.id || '';
        for (const chunk of step.audio) {
          if ((head.id && playingAlertId !== head.id) || head.mine !== callGeneration || !playback || userTurn || outputMuted) break;
          playback.push(chunk, liveSpec.OUT_RATE);
        }
        while (playback?.playing() && playingAlertId === (head.id || '') && head.mine === callGeneration && active && !userTurn && !outputMuted) {
          await new Promise((resolve) => setTimeout(resolve, 200));
        }
        if (playingAlertId === (head.id || '')) playingAlertId = '';
      }
    } finally {
      drainingAlerts = false;
      if (active && spokenAlerts.length) void drainAlerts();
    }
  }

  async function fireTimer(text, mine) {
    if (!active || mine !== callGeneration) return;
    const line = document.createElement('li');
    line.textContent = redactSecret(`提醒：${text}`, secret);
    log.append(line);
    if (!active || mine !== callGeneration || !liveSpec || !liveValues) return;
    try {
      const spoken = await speakReminder({
        url: realtimeSocketUrl(reg.stacks.get('bailian'), liveValues, liveSpec.REALTIME_MODEL),
        secret,
        text,
        voice: currentVoice(),
        inputRate: liveSpec.IN_RATE,
        outputRate: liveSpec.OUT_RATE,
        asrModel: liveSpec.ASR_MODEL,
      });
      if (!active || mine !== callGeneration) return;
      enqueueAlert(spoken.audio, mine);
    } catch (error) {
      if (active && mine === callGeneration) say(`到点了，但没有读出来：${error.message}`);
    }
  }

  async function runMonitor(condition, mine, extra = {}) {
    const id = `watch-${mine}-${Date.now()}`;
    const kind = extra.label === '解说' ? 'narration' : 'monitor';
    const title = String(extra.task || condition || '').replace(/\s+/g, ' ').trim().slice(0, 200) || (kind === 'narration' ? '解说' : '监视');
    const needle = title.trim().toLocaleLowerCase();
    for (const task of [...tasks]) {
      if (kind === 'narration' ? task.kind === 'narration' : task.kind === 'monitor' && task.title.trim().toLocaleLowerCase() === needle) stopWatch(task.id);
    }
    let stopped = false;
    let monitor = null;
    const stop = () => { stopped = true; monitor?.close(); };
    watches.set(id, { stop, handle: null });
    const initialModalities = Array.isArray(extra.modalities) && extra.modalities.length ? extra.modalities : ['vision', 'audio'];
    rememberTask({
      id,
      kind,
      title,
      condition: kind === 'monitor' ? title : '',
      repeat: kind === 'monitor' ? extra.repeat === false ? false : true : undefined,
      response: kind === 'monitor' ? (extra.response || '') : undefined,
      focus: kind === 'narration' ? String(extra.focus || '') : undefined,
      style: kind === 'narration' ? (extra.style || '') : undefined,
      modalities: initialModalities,
    });
    const rulesFor = (modalities) => perceptionRules({ kind, continuous: Boolean(extra.gapMs), modalities });
    const signatureFor = (modalities) => `${modalities.includes('vision') ? 'v' : ''}${modalities.includes('audio') ? 'a' : ''}|${rulesFor(modalities)}`;
    let signature = signatureFor(initialModalities);
    const connectWatch = (modalities, taskText) => openMonitor({
      url: realtimeSocketUrl(reg.stacks.get('bailian'), liveValues, liveSpec.REALTIME_MODEL),
      secret,
      condition,
      rules: rulesFor(modalities),
      task: taskText,
      voice: currentVoice(),
      inputRate: liveSpec.IN_RATE,
      outputRate: liveSpec.OUT_RATE,
      asrModel: liveSpec.ASR_MODEL,
      video: modalities.includes('vision'),
    });
    try {
      const opened = tasks.find((item) => item.id === id);
      monitor = connectWatch(initialModalities, opened ? watchFocus(opened) : extra.task);
      const slot = watches.get(id);
      if (slot) slot.handle = monitor;
      await monitor.ready;
      if (watches.size === 1) monitorAudio = { parts: [], total: 0 };
      syncWatchAudio();
      const sees = initialModalities.includes('vision');
      const hears = initialModalities.includes('audio');
      const openingBase = !sees ? '只听声音' : (!hears ? '只看画面' : (kind === 'narration' ? '正在看这一路画面' : (extra.repeat === false ? '只提醒一次' : '条件没发生时不出声')));
      const openingSpoken = kind === 'monitor' && extra.response ? `${openingBase}，发生时说${extra.response}` : openingBase;
      const opening = kind === 'narration' && extra.style ? `${openingSpoken}，按你刚才的说法` : openingSpoken;
      noteJob(extra.jobId, { state: 'running', note: opening });
      const oneSecond = liveSpec.IN_RATE * 2;
      let endNote = '';
      let endState = 'delivered';
      let armed = true;
      const onceNow = () => {
        if (kind !== 'monitor') return false;
        const task = tasks.find((item) => item.id === id);
        return task ? task.repeat === false : extra.repeat === false;
      };
      while (!stopped && mine === callGeneration && active) {
        const task = tasks.find((item) => item.id === id);
        const liveModalities = task?.modalities || initialModalities;
        const nextSignature = signatureFor(liveModalities);
        if (nextSignature !== signature) {
          monitor?.close();
          monitor = connectWatch(liveModalities, task ? watchFocus(task) : extra.task);
          const nextSlot = watches.get(id);
          if (nextSlot) nextSlot.handle = monitor;
          signature = nextSignature;
          await monitor.ready;
          syncWatchAudio();
          if (stopped || mine !== callGeneration || !active) break;
        }
        const sees = liveModalities.includes('vision');
        const hears = liveModalities.includes('audio');
        const mark = monitorAudio.total;
        const first = sees ? captureJpeg(video, liveSpec.MAX_FRAME_BYTES) : null;
        if (hears) await waitForAudio(mark + oneSecond, 1200);
        else if (sees) await new Promise((resolve) => setTimeout(resolve, 1000));
        if (stopped || mine !== callGeneration || !active) break;
        const second = sees ? captureJpeg(video, liveSpec.MAX_FRAME_BYTES) : null;
        if (hears) await waitForAudio(mark + oneSecond * 2, 1300);
        if (sees && (!first || !second)) {
          endNote = '画面中断';
          endState = 'failed';
          say('主动提醒停了：画面中断。');
          break;
        }
        const result = await monitor.round(sees ? [first, second] : null, hears ? takeMonitorAudio(monitorAudio, liveSpec.IN_RATE) : null, { vision: sees, audio: hears });
        if (stopped || mine !== callGeneration || !active) break;
        const step = cadenceStep({ kind, silent: isSilentMonitor(result.text), once: onceNow(), armed });
        armed = step.armed;
        if (!step.speak) noteJob(extra.jobId, { state: 'running', note: step.note });
        else {
          const reminder = kind === 'monitor' ? reminderText(task?.condition || title, task?.response) : '';
          const spokenText = reminder || result.text;
          noteJob(extra.jobId, { state: 'running', note: spokenText });
          const cleanSpoken = redactSecret(String(spokenText || ''), secret).replace(/\s+/g, ' ').trim();
          if (cleanSpoken && !isSilentMonitor(cleanSpoken)) {
            lateResults = rememberLateResult(lateResults, { id, text: cleanSpoken, status: kind === 'narration' ? 'narration' : 'monitor' });
            refreshLiveMemory();
          }
          const line = document.createElement('li');
          line.textContent = redactSecret(`${extra.label || '提醒'}：${spokenText}`, secret);
          log.append(line);
          if (reminder && !outputMuted && liveSpec && liveValues) {
            try {
              const spoken = await speakReminder({
                url: realtimeSocketUrl(reg.stacks.get('bailian'), liveValues, liveSpec.REALTIME_MODEL),
                secret,
                text: reminder,
                voice: currentVoice(),
                inputRate: liveSpec.IN_RATE,
                outputRate: liveSpec.OUT_RATE,
                asrModel: liveSpec.ASR_MODEL,
              });
              if (stopped || mine !== callGeneration || !active) break;
              enqueueAlert(spoken.audio, mine);
            } catch {
              if (stopped || mine !== callGeneration || !active) break;
              enqueueAlert(result.audio, mine);
            }
          } else enqueueAlert(result.audio, mine);
          if (step.stop) {
            endNote = step.note;
            break;
          }
        }
        if (extra.gapMs) {
          const deadline = Date.now() + extra.gapMs;
          while (!stopped && mine === callGeneration && active && Date.now() < deadline) {
            await new Promise((resolve) => setTimeout(resolve, 200));
          }
        }
      }
      if (extra.jobId) noteJob(extra.jobId, { state: endState, note: endNote || '已停下' });
    } catch (error) {
      const ended = stopped || error.message === '主动提醒已停止';
      if (!ended && mine === callGeneration && active) {
        say(`主动提醒停了：${error.message}`);
        noteJob(extra.jobId, { state: 'failed', note: error.message });
      } else noteJob(extra.jobId, { state: 'delivered', note: '已停下' });
    } finally {
      monitor?.close();
      if (watches.get(id)?.stop === stop) watches.delete(id);
      syncWatchAudio();
      dropTask(id);
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
      maxSeconds: SESSION_CALL_SECONDS,
      onPCM: (buffer) => {
        if (mine !== callGeneration || !call || !callReady) return;
        try {
          const bytes = new Uint8Array(buffer);
          for (const piece of splitPcm(bytes, liveSpec.CHUNK_BYTES)) {
            if (piece.byteLength < 2 || piece.byteLength % 2) continue;
            if (!inputMuted) {
              call.send('input_audio_buffer.append', { audio: pcmBase64(piece) });
              if (captureMonitorAudio) monitorAudio = pushMonitorAudio(monitorAudio, piece, liveSpec.IN_RATE);
            }
            if (captureMode === 'live' && audioPackets % liveSpec.FRAME_EVERY === 0) pushFrame();
            audioPackets += 1;
          }
        } catch (error) {
          say(error.message);
          endCall('实时连接已不可用');
        }
      },
      onDuration: (seconds) => {
        if (meter && mine === callGeneration) meter.textContent = `已通话 ${Math.floor(seconds)} 秒，上限 ${SESSION_CALL_SECONDS} 秒。实时语音按百炼账单计费。`;
      },
      onLimit: () => endCall('已到 30 分钟上限，实时通话结束。持续报告和监视也停下。'),
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
          instructions: livePrompt(tools),
          voice: currentVoice(),
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
      callUsesTools = true;
      sentInstructions = livePrompt(true);
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
        callUsesTools = false;
        sentInstructions = livePrompt(false);
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
      bioAtStart = bio.slice();
      setLiveLabel(true);
      say('实时通话已接通，正在打开麦克风…');
      await openLiveMic(mine);
      if (mine !== callGeneration || !active) return;
      say(demand ? '对着麦克风说话即可。问到画面时会交给后台看，结果稍后才说。' : '对着画面说话即可。也可以说持续报告屏幕，或咳嗽了提醒我。前台先接住，结果稍后才说。');
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
      bioAtStart = bio.slice();
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
      bioAtStart = bio.slice();
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
      vectorJob += 1;
      vectorAbort?.abort();
      void dropSegmentVectors(store.activeId).catch(() => {});
      syncMemory();
      bioAtStart = bio.slice();
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
    const lookupButton = event.target.closest('[data-stop-lookup]');
    if (lookupButton) { stopLookupJob(lookupButton.dataset.stopLookup); return; }
    if (event.target.closest('[data-stop]')) abort?.abort();
    const taskButton = event.target.closest('[data-stop-task]');
    if (taskButton && !taskButton.hidden) {
      const task = tasks.find((item) => item.id === adjacentId && item.kind !== 'timer')
        || [...tasks].reverse().find((item) => item.kind === 'monitor' || item.kind === 'narration');
      if (!task) return;
      const label = task.kind === 'narration' ? '解说' : '监视';
      stopTask(task.id);
      say(`已停止${label}。`);
    }
    const micMute = event.target.closest('[data-mute-mic]');
    if (micMute && !micMute.hidden) {
      inputMuted = !inputMuted;
      micMute.setAttribute('aria-pressed', inputMuted ? 'true' : 'false');
      micMute.textContent = inputMuted ? '取消麦克风静音' : '麦克风静音';
      if (inputMuted) startMuteHeartbeat();
      else clearMuteHeartbeat();
      say(inputMuted ? '麦克风已静音。声音不再送出，画面仍在。' : '麦克风已打开。');
    }
    const speakerMute = event.target.closest('[data-mute-speaker]');
    if (speakerMute && !speakerMute.hidden) {
      outputMuted = !outputMuted;
      speakerMute.setAttribute('aria-pressed', outputMuted ? 'true' : 'false');
      speakerMute.textContent = outputMuted ? '取消播报静音' : '播报静音';
      playback?.setMuted(outputMuted);
      if (outputMuted) {
        spokenAlerts.splice(0, spokenAlerts.length, ...spokenWhileMuted(spokenAlerts, true));
        lateQueue = [];
        if (speakingLateId && call) {
          try { call.send('response.cancel'); } catch { /* 当前没有可打断的回答 */ }
          speakingLateId = '';
          foregroundBusy = false;
          lateResponse = false;
        }
      }
      say(outputMuted ? '播报已静音。正在说的话已停下，还没播的提醒、查询和看图不再补播。' : '播报已打开。');
    }
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
    archiveDialogue();
    vectorJob += 1;
    vectorAbort?.abort();
    stopObserver();
    clearTimers();
    stopAllWatches();
    clearMuteHeartbeat();
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
