// Runs on the audio thread: hands the microphone samples (mono, at the context's 16 kHz) to the page
// in blocks of 100 ms.
class PcmCollector extends AudioWorkletProcessor {
  constructor() {
    super();
    this.block = new Float32Array(1600);
    this.filled = 0;
  }

  process(inputs) {
    const channel = inputs[0] && inputs[0][0];
    if (channel) {
      for (let i = 0; i < channel.length; i++) {
        this.block[this.filled++] = channel[i];
        if (this.filled === this.block.length) {
          this.port.postMessage(this.block.slice(0));
          this.filled = 0;
        }
      }
    }
    return true;
  }
}

registerProcessor('pcm-collector', PcmCollector);
