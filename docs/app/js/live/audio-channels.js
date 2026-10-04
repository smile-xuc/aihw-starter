const at = (bytes, offset, value) => [...value].every((letter, index) => bytes[offset + index] === letter.charCodeAt(0));
const invalid = () => new Error('无法可靠识别录音声道，请重新导出有效的 WAV 或 MP3');

// Read container/frame metadata only. The material picker independently decodes
// uploads; this check prevents the file transcription request from silently
// selecting only the first channel of a stereo recording.
export function audioChannels(buffer, format) {
  if (!(buffer instanceof ArrayBuffer) || !buffer.byteLength) throw invalid();
  const bytes = new Uint8Array(buffer), view = new DataView(buffer);
  if (format === 'wav') {
    if (bytes.length < 44 || !at(bytes,0,'RIFF') || !at(bytes,8,'WAVE') || view.getUint32(4,true) + 8 !== bytes.length) throw invalid();
    let channels = null;
    for (let offset = 12; offset < bytes.length;) {
      if (offset + 8 > bytes.length) throw invalid();
      const size = view.getUint32(offset+4,true), end = offset + 8 + size;
      if (end + size % 2 > bytes.length) throw invalid();
      if (at(bytes,offset,'fmt ')) {
        if (size < 16 || channels !== null) throw invalid();
        channels = view.getUint16(offset+10,true);
        if (!channels) throw invalid();
      }
      offset = end + size % 2;
    }
    if (channels === null) throw invalid();
    return channels;
  }
  if (format !== 'mp3') throw invalid();
  let offset = 0;
  if (at(bytes,0,'ID3')) {
    if (bytes.length < 10 || bytes[3] < 2 || bytes[3] > 4 || bytes[4] === 255 || bytes.slice(6,10).some(value=>value>=128)) throw invalid();
    const allowedFlags = {2:0xc0,3:0xe0,4:0xf0}[bytes[3]];
    if (bytes[5] & ~allowedFlags) throw invalid();
    const tagBytes = bytes.slice(6,10).reduce((size,value)=>(size*128)+value,0);
    offset = 10 + tagBytes;
    if (bytes[3] === 4 && (bytes[5] & 0x10)) {
      if (!at(bytes,offset,'3DI') || offset + 10 > bytes.length) throw invalid();
      offset += 10;
    }
  }
  if (bytes.length < offset + 4 || bytes[offset] !== 255 || (bytes[offset+1]&0xe0) !== 0xe0) throw invalid();
  const version = (bytes[offset+1]>>3)&3, layer = (bytes[offset+1]>>1)&3;
  const bitrateIndex = bytes[offset+2]>>4, rateIndex = (bytes[offset+2]>>2)&3;
  if (version === 1 || layer !== 1 || bitrateIndex === 0 || bitrateIndex === 15 || rateIndex === 3) throw invalid();
  const rates = version === 3 ? [0,32,40,48,56,64,80,96,112,128,160,192,224,256,320] : [0,8,16,24,32,40,48,56,64,80,96,112,128,144,160];
  const sampleRate = [44100,48000,32000][rateIndex] / (version === 3 ? 1 : version === 2 ? 2 : 4);
  const frameBytes = Math.floor((version === 3 ? 144 : 72)*rates[bitrateIndex]*1000/sampleRate) + ((bytes[offset+2]>>1)&1);
  if (bytes.length < offset + frameBytes) throw invalid();
  return (bytes[offset+3]>>6) === 3 ? 1 : 2;
}
