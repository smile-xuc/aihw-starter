// 先检查上传字节的文件头；页面还会解码媒体用于预览和时长核验。
const MAX_BYTES = 7 * 1024 * 1024;
const TYPES = {
  'image/jpeg': { kind: 'image', extensions: ['jpg', 'jpeg'] },
  'image/png': { kind: 'image', extensions: ['png'] },
  'image/webp': { kind: 'image', extensions: ['webp'] },
  'audio/wav': { kind: 'audio', extensions: ['wav'], format: 'wav' },
  'audio/mpeg': { kind: 'audio', extensions: ['mp3'], format: 'mp3' },
};
const at = (b, offset, text) => [...text].every((ch, i) => b[offset + i] === ch.charCodeAt(0));
const prefix = (b, values) => values.every((value, i) => b[i] === value);
function signature(b, mime) {
  if (mime === 'image/jpeg') return b.length >= 4 && prefix(b, [255, 216, 255]) && b[b.length - 2] === 255 && b[b.length - 1] === 217;
  if (mime === 'image/png') return b.length >= 33 && prefix(b, [137, 80, 78, 71, 13, 10, 26, 10]) && at(b, 12, 'IHDR') && new DataView(b.buffer).getUint32(8) === 13 && new DataView(b.buffer).getUint32(16) > 0 && new DataView(b.buffer).getUint32(20) > 0;
  if (mime === 'image/webp') return b.length >= 20 && at(b, 0, 'RIFF') && at(b, 8, 'WEBP') && ['VP8 ', 'VP8L', 'VP8X'].some((s) => at(b, 12, s)) && new DataView(b.buffer).getUint32(4, true) + 8 === b.length;
  if (mime === 'audio/wav') {
    if (b.length < 44 || !at(b, 0, 'RIFF') || !at(b, 8, 'WAVE')) return false;
    const view = new DataView(b.buffer);
    if (view.getUint32(4, true) + 8 !== b.length) return false;
    let fmt = false, data = false;
    for (let i = 12; i + 8 <= b.length;) {
      const size = view.getUint32(i + 4, true);
      if (i + 8 + size > b.length) return false;
      if (at(b, i, 'fmt ')) fmt = size >= 16 && view.getUint16(i + 10, true) > 0 && view.getUint32(i + 12, true) > 0;
      if (at(b, i, 'data')) data = size > 0;
      i += 8 + size + (size % 2);
    }
    return fmt && data;
  }
  if (mime === 'audio/mpeg') {
    let i = 0;
    if (at(b, 0, 'ID3')) {
      if (b.length < 10 || b[3] < 2 || b[3] > 4 || b.slice(6, 10).some((n) => n >= 128)) return false;
      i = 10 + b.slice(6, 10).reduce((n, part) => (n << 7) + part, 0) + (b[5] & 16 ? 10 : 0);
    }
    if (b.length < i + 4 || b[i] !== 255 || (b[i + 1] & 224) !== 224 || (b[i + 1] & 24) === 8 || (b[i + 1] & 6) !== 2 || (b[i + 2] & 240) === 0 || (b[i + 2] & 240) === 240 || (b[i + 2] & 12) === 12) return false;
    const version = (b[i + 1] >> 3) & 3;
    const rates = version === 3 ? [0,32,40,48,56,64,80,96,112,128,160,192,224,256,320] : [0,8,16,24,32,40,48,56,64,80,96,112,128,144,160];
    const sampleRate = [44100,48000,32000][(b[i + 2] >> 2) & 3] / (version === 3 ? 1 : version === 2 ? 2 : 4);
    const frameBytes = Math.floor((version === 3 ? 144 : 72) * rates[b[i + 2] >> 4] * 1000 / sampleRate) + ((b[i + 2] >> 1) & 1);
    return b.length >= i + frameBytes;
  }
  return false;
}

export function validateInput(input) {
  if (input == null) return undefined;
  const label = input.kind === 'audio' ? '录音' : '图片';
  const type = TYPES[input.mime];
  if (!type || type.kind !== input.kind) throw new Error('媒体类型不支持：图片仅支持 JPEG、PNG、WebP，录音仅支持 WAV、MP3');
  if (!(input.buffer instanceof ArrayBuffer) || !input.buffer.byteLength) throw new Error(`${label}文件为空或字节无效`);
  if (input.buffer.byteLength > MAX_BYTES) throw new Error(`${label}不能超过 7 MiB`);
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  const extension = name.split('.').pop().toLowerCase();
  if (!name.includes('.') || !type.extensions.includes(extension)) throw new Error(`${label}文件扩展名与媒体类型不一致`);
  if (!signature(new Uint8Array(input.buffer), input.mime)) throw new Error(`${label}文件头无效或与媒体类型不一致`);
  if (input.kind === 'image') {
    const question = typeof input.question === 'string' ? input.question.trim() : '';
    if (!question || question.length > 2000) throw new Error('提问不能为空，且不能超过 2000 字符');
    return { kind: 'image', buffer: input.buffer, mime: input.mime, name, question };
  }
  if (input.format !== type.format) throw new Error('录音格式与媒体类型不一致');
  if (!Number.isFinite(input.durationSeconds) || input.durationSeconds <= 0 || input.durationSeconds > 180) throw new Error('录音时长必须大于 0 秒，且不能超过 180 秒');
  return { kind: 'audio', buffer: input.buffer, mime: input.mime, format: type.format, name, durationSeconds: input.durationSeconds };
}
