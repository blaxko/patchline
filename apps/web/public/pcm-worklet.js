// AudioWorkletProcessor: accumulates mic input into ~100ms PCM16LE chunks
// and posts them to the main thread, matching AssemblyAI's 50-1000ms frame
// window (PRD.md §9 Step 3, DECISIONS.md D1/D9).
class PcmWorkletProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.targetSamples = 1600; // ~100ms at 16kHz
    this.buffer = new Float32Array(this.targetSamples);
    this.offset = 0;
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || input.length === 0) return true;
    const channel = input[0];
    if (!channel) return true;

    for (let i = 0; i < channel.length; i++) {
      this.buffer[this.offset++] = channel[i];
      if (this.offset >= this.targetSamples) {
        this.flush();
      }
    }

    return true;
  }

  flush() {
    const pcm16 = new Int16Array(this.offset);
    for (let i = 0; i < this.offset; i++) {
      const s = Math.max(-1, Math.min(1, this.buffer[i]));
      pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    this.port.postMessage(pcm16.buffer, [pcm16.buffer]);
    this.offset = 0;
  }
}

registerProcessor("pcm-worklet-processor", PcmWorkletProcessor);
