// Temporary OSS addresses and credentials stay inside this call; only text and
// numeric usage leave it. Storage requests never receive the model API Key.
import { ApiError, getJson, postJson, validCount } from './client.js';
import { audioChannels } from './audio-channels.js';

function storageURL(value) {
  let url;
  try { url = new URL(value); } catch { throw new Error('百炼返回的文件地址无效'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.port || url.hash || !/^[a-z0-9][a-z0-9-]*\.oss-(?:cn-beijing|ap-southeast-1)\.aliyuncs\.com$/.test(url.hostname)) throw new Error('百炼返回了不支持的文件地址');
  return url.href;
}

const cleanId = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,160}$/.test(value) ? value : '';
const safeUsage = value => Object.fromEntries(['input_tokens', 'output_tokens', 'duration'].filter(key => validCount(value?.[key])).map(key => [key, value[key]]));

function pause(ms, signal) {
  return new Promise((resolve, reject) => {
    signal.throwIfAborted();
    const aborted = () => { clearTimeout(timer); reject(signal.reason); };
    const timer = setTimeout(() => { signal.removeEventListener('abort', aborted); resolve(); }, ms);
    signal.addEventListener('abort', aborted, { once: true });
  });
}

async function storageFetch(url, init, signal) {
  const response = await fetch(storageURL(url), { ...init, signal, mode: 'cors', credentials: 'omit', redirect: 'error', cache: 'no-store', referrerPolicy: 'no-referrer' });
  if (!response.ok) throw new ApiError(`文件传输失败（HTTP ${response.status}）`, { status: response.status });
  return response;
}

export async function transcribeFile(cred, audio, { model, signal, onFallback, onProgress, pollMs = 2000, timeoutMs = 600000 } = {}) {
  if (!model || !/^[a-z0-9.-]+$/.test(model)) throw new Error('文件识别模型无效');
  if (!(audio?.buffer instanceof ArrayBuffer) || !audio.buffer.byteLength || !['wav', 'mp3'].includes(audio.format)) throw new Error('录音文件无效');
  if (audio.buffer.byteLength > 7 * 1024 * 1024) throw new Error('录音文件不能超过 7 MiB');
  const channels = audioChannels(audio.buffer, audio.format);
  if (channels !== 1 && channels !== 2) throw new Error('仅支持单声道或双声道录音，请重新导出 WAV 或 MP3');
  const controller = new AbortController();
  const abort = () => controller.abort(signal.reason);
  if (signal?.aborted) abort();
  else signal?.addEventListener('abort', abort, { once: true });
  let timedOut = false, phase = '获取临时上传地址', taskSubmitted = false, requestId = '', usage = {};
  const timeout = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
  const options = { signal: controller.signal, onFallback };
  const progress = message => { phase = message; onProgress?.(message); };
  try {
    controller.signal.throwIfAborted();
    progress('获取临时上传地址');
    const policyBody = await getJson(cred, `/uploads?action=getPolicy&model=${encodeURIComponent(model)}`, { ...options, fallback404: true });
    const policy = policyBody.data;
    if (!policy || typeof policy.upload_dir !== 'string' || !/^[A-Za-z0-9_/-]+$/.test(policy.upload_dir) || policy.upload_dir.split('/').some(part => part === '.' || part === '..')) throw new Error('临时上传凭据格式无效');
    const uploadURL = new URL(storageURL(policy.upload_host));
    if (uploadURL.pathname !== '/' || uploadURL.search) throw new Error('临时上传地址必须是存储桶根地址');
    if (Number.isFinite(policy.max_file_size_mb) && policy.max_file_size_mb > 0 && audio.buffer.byteLength > policy.max_file_size_mb * 1024 * 1024) throw new Error('录音超过临时上传凭据允许的文件大小');
    const key = `${policy.upload_dir.replace(/\/$/, '')}/${crypto.randomUUID()}.${audio.format}`;
    const form = new FormData();
    for (const [field, value] of Object.entries({ OSSAccessKeyId: policy.oss_access_key_id, Signature: policy.signature, policy: policy.policy, 'x-oss-object-acl': policy.x_oss_object_acl, 'x-oss-forbid-overwrite': policy.x_oss_forbid_overwrite, key, success_action_status: '200' })) {
      if (typeof value !== 'string' || !value) throw new Error('临时上传凭据字段缺失');
      form.append(field, value);
    }
    form.append('file', new Blob([audio.buffer], { type: audio.mime }), `recording.${audio.format}`);
    controller.signal.throwIfAborted();
    progress('上传录音到百炼临时存储');
    await storageFetch(uploadURL.href, { method: 'POST', body: form }, controller.signal);
    controller.signal.throwIfAborted();
    progress('提交文件识别任务');
    // An interrupted POST may already have created a billable remote task.
    taskSubmitted = true;
    const submitted = await postJson(cred, 'api', '/services/audio/asr/transcription', {
      model, input: { file_urls: [`oss://${key}`] },
      parameters: { channel_id: channels === 1 ? [0] : [0, 1], diarization_enabled: channels === 1 },
    }, { ...options, allowNetworkFallback: false, headers: { 'X-DashScope-Async': 'enable', 'X-DashScope-OssResourceResolve': 'enable' } });
    const taskId = cleanId(submitted.output?.task_id);
    requestId = cleanId(submitted.request_id) || taskId;
    usage = safeUsage(submitted.usage);
    if (!taskId) throw new Error('识别任务编号无效');
    progress('正在转写录音');
    let task;
    for (;;) {
      controller.signal.throwIfAborted();
      task = await getJson(cred, `/tasks/${encodeURIComponent(taskId)}`, options);
      usage = { ...usage, ...safeUsage(task.usage) };
      const status = task.output?.task_status;
      if (status === 'SUCCEEDED') break;
      if (!['PENDING', 'RUNNING'].includes(status)) throw new Error(`识别任务未完成（${['FAILED', 'CANCELED', 'UNKNOWN'].includes(status) ? status : '状态无效'}）`);
      await pause(pollMs, controller.signal);
    }
    const results = task.output?.results;
    if (!Array.isArray(results) || results.length !== 1 || results[0]?.subtask_status !== 'SUCCEEDED') throw new Error('录音文件识别失败或结果缺失');
    progress('读取转写结果');
    const response = await storageFetch(results[0].transcription_url, { method: 'GET' }, controller.signal);
    const result = await response.json();
    controller.signal.throwIfAborted();
    if (!Array.isArray(result.transcripts) || result.transcripts.some(part => !part || !Array.isArray(part.sentences))) throw new Error('转写结果格式无效');
    if (result.transcripts.length !== channels || result.transcripts.some(part => !Number.isInteger(part.channel_id) || part.channel_id < 0 || part.channel_id >= channels) || new Set(result.transcripts.map(part => part.channel_id)).size !== channels) throw new Error('转写声道信息无效或声道结果缺失');
    const sentences = result.transcripts.flatMap(part => part.sentences.map(sentence => {
      if (!sentence || typeof sentence !== 'object' || Array.isArray(sentence)) throw new Error('转写句子格式无效');
      if (channels === 2) return { ...sentence, speaker_id: null, channel_id: part.channel_id };
      const mono = { ...sentence };
      delete mono.channel_id;
      return mono;
    }));
    sentences.sort((a,b) => (a.begin_time || 0) - (b.begin_time || 0) || (a.channel_id || 0) - (b.channel_id || 0));
    const duration = result.properties?.original_duration_in_milliseconds;
    return { output: { sentences }, usage, request_id: requestId, durationSeconds: validCount(duration) ? duration / 1000 : null };
  } catch (cause) {
    // Do not expose provider bodies: they can contain signed storage addresses.
    const stopped = signal?.aborted;
    const error = stopped ? new DOMException('已停止等待，已提交的云端任务可能继续运行并计费', 'AbortError') : new ApiError(timedOut ? '文件识别等待超时，已提交的云端任务可能继续运行并计费' : `${phase}失败${cause.status ? `（HTTP ${cause.status}）` : ''}；请检查网络、模型权限与跨域设置`, { status: cause.status || null, network: cause.network || cause instanceof TypeError });
    error.requestId = requestId || cleanId(cause.requestId);
    error.usage = { ...usage, ...safeUsage(cause.usage) };
    error.taskSubmitted = taskSubmitted;
    if (taskSubmitted) error.warnings = ['已提交的文件识别任务可能继续运行并计费；重试会创建新任务。'];
    throw error;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', abort);
  }
}
