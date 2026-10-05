export const SAMPLE_RATE = 16000;
export const MAX_SECONDS = 180;

// Keep phase across render quanta. Averaging avoids dropping input samples at
// non-integer ratios such as 44.1 kHz -> 16 kHz.
export class PCMResampler {
  constructor(rate) {
    if (!Number.isFinite(rate) || rate < SAMPLE_RATE) throw Error('麦克风采样率不支持');
    this.ratio = rate / SAMPLE_RATE;
    this.phase = 0; this.sum = 0; this.count = 0;
  }
  push(input) {
    const values = [];
    for (const value of input) {
      this.sum += Number.isFinite(value) ? Math.max(-1, Math.min(1, value)) : 0;
      this.count++; this.phase++;
      if (this.phase >= this.ratio) {
        const sample = this.sum / this.count;
        values.push(Math.round(sample * (sample < 0 ? 32768 : 32767)));
        this.phase -= this.ratio; this.sum = 0; this.count = 0;
      }
    }
    const buffer = new ArrayBuffer(values.length * 2), view = new DataView(buffer);
    values.forEach((value, i) => view.setInt16(i * 2, value, true));
    return buffer;
  }
}
