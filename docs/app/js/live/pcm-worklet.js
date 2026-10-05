import { PCMResampler } from './pcm.js';
class Capture extends AudioWorkletProcessor {
  constructor() {
    super(); this.encoder = new PCMResampler(sampleRate); this.paused = true;
    this.port.onmessage = ({ data }) => {
      if (data.type === 'pause') this.paused = data.paused;
      if (data.type === 'flush') { this.paused = true; this.port.postMessage({ type: 'flushed' }); }
    };
  }
  process(inputs) {
    if (!this.paused && inputs[0]?.[0]) {
      const buffer = this.encoder.push(inputs[0][0]);
      if (buffer.byteLength) this.port.postMessage({ type: 'pcm', buffer }, [buffer]);
    }
    return true;
  }
}
registerProcessor('aihw-pcm-capture', Capture);
