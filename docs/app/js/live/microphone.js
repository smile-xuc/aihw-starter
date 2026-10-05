import { SAMPLE_RATE, MAX_SECONDS } from './pcm.js';

export async function microphone({ onPCM, onDuration, onLimit, onError, signal }) {
  if (!navigator.mediaDevices?.getUserMedia || !globalThis.AudioWorkletNode || !isSecureContext) throw Error('此浏览器不支持安全的麦克风录音；请使用 HTTPS 页面和支持 AudioWorklet 的浏览器');
  let stream, context, node, input, muted, ended = false, paused = true, count = 0, queue = [], bytes = 0;
  const flush = () => { if (!bytes) return; const out = new Uint8Array(bytes); let offset = 0; for (const b of queue) { out.set(b, offset); offset += b.length; } queue = []; bytes = 0; onPCM(out.buffer); };
  let releasing;
  const release = () => releasing ||= (async () => { ended = true; stream?.getTracks().forEach(t => t.stop()); input?.disconnect(); node?.disconnect(); muted?.disconnect(); if (context && context.state !== 'closed') await context.close(); signal?.removeEventListener('abort', abort); })();
  const abort = () => { void release(); };
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true }, video: false });
    if (signal?.aborted) throw new DOMException('已停止', 'AbortError');
    stream.getAudioTracks().forEach(t => { t.enabled = false; t.addEventListener('ended', () => { if (!ended) onError(Error('麦克风已断开；已确认转写会保留')); }); });
    context = new AudioContext(); await context.resume();
    await context.audioWorklet.addModule(new URL('./pcm-worklet.js', import.meta.url));
    if (signal?.aborted) throw new DOMException('已停止', 'AbortError');
    input = context.createMediaStreamSource(stream); node = new AudioWorkletNode(context, 'aihw-pcm-capture'); muted = context.createGain(); muted.gain.value = 0;
    input.connect(node); node.connect(muted); muted.connect(context.destination);
    let acknowledge;
    node.port.onmessage = ({ data }) => {
      if (data.type === 'flushed') { acknowledge?.(); return; }
      if (data.type !== 'pcm' || ended || paused) return;
      const allowed = Math.min(data.buffer.byteLength, MAX_SECONDS * SAMPLE_RATE * 2 - count);
      if (allowed > 0) { queue.push(new Uint8Array(data.buffer, 0, allowed)); bytes += allowed; count += allowed; if (bytes >= 3200) flush(); onDuration(count / (SAMPLE_RATE * 2)); }
      if (count >= MAX_SECONDS * SAMPLE_RATE * 2) { paused = true; flush(); onLimit(); }
    };
    signal?.addEventListener('abort', abort, { once: true });
    return {
      resume() { if (ended) return; paused = false; stream.getAudioTracks().forEach(t => { t.enabled = true; }); node.port.postMessage({ type: 'pause', paused: false }); },
      pause() { paused = true; stream.getAudioTracks().forEach(t => { t.enabled = false; }); node.port.postMessage({ type: 'pause', paused: true }); flush(); },
      async stop() {
        if (ended) return;
        // Port messages are ordered: all preceding PCM reaches onPCM before the
        // flush acknowledgement. Stop tracks immediately, then drain that tail.
        stream.getTracks().forEach(t => t.stop());
        await new Promise(resolve => { const timer = setTimeout(resolve, 800); acknowledge = () => { clearTimeout(timer); resolve(); }; node.port.postMessage({ type: 'flush' }); });
        paused = true; flush(); await release();
      },
      discard: release,
    };
  } catch (error) {
    await release();
    if(error.name==='NotAllowedError')throw Error('未获麦克风权限；请在浏览器设置中允许后手动开始');
    if(error.name==='NotFoundError')throw Error('没有找到麦克风；请连接设备后手动开始');
    if(error.name==='NotReadableError')throw Error('麦克风不可用或被其他应用占用；请检查后手动开始');
    throw error;
  }
}
