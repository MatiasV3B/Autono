// Speech segmentation for local dictation: cuts a continuous 16 kHz microphone stream into phrases
// (speech followed by a pause) so each phrase can be transcribed on its own. Pure functions, no browser APIs.

export const SAMPLE_RATE = 16000;

function rms(chunk) {
  let sum = 0;
  for (let i = 0; i < chunk.length; i++) sum += chunk[i] * chunk[i];
  return Math.sqrt(sum / Math.max(1, chunk.length));
}

function concat(chunks) {
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const out = new Float32Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out;
}

export class SpeechSegmenter {
  /**
   * @param {object} [o]
   * @param {number} [o.threshold]    loudness (RMS) above which a chunk counts as speech
   * @param {number} [o.silenceMs]    pause that ends a phrase
   * @param {number} [o.maxSegmentMs] a phrase is cut anyway at this length
   * @param {number} [o.minSpeechMs]  shorter bursts (a click, a cough) are dropped
   * @param {number} [o.preRollMs]    audio kept from just before the speech started
   * @param {number} [o.tailMs]       silence kept after the speech
   */
  constructor({ threshold = 0.012, silenceMs = 1100, maxSegmentMs = 25000, minSpeechMs = 350, preRollMs = 300, tailMs = 250 } = {}) {
    const ms = (v) => Math.round((v / 1000) * SAMPLE_RATE);
    this.threshold = threshold;
    this.silenceSamples = ms(silenceMs);
    this.maxSamples = ms(maxSegmentMs);
    this.minSpeechSamples = ms(minSpeechMs);
    this.preRollSamples = ms(preRollMs);
    this.tailSamples = ms(tailMs);
    this.reset();
  }

  reset() {
    this.preRoll = [];
    this.preRollLength = 0;
    this.chunks = [];
    this.length = 0;
    this.inSpeech = false;
    this.silent = 0;
    this.speech = 0;
  }

  /** Feed a chunk of samples; returns the phrases (Float32Array) that were completed by it. */
  push(chunk) {
    const done = [];
    const loud = rms(chunk) > this.threshold;

    if (!this.inSpeech) {
      if (!loud) {
        this.preRoll.push(chunk);
        this.preRollLength += chunk.length;
        while (this.preRollLength - this.preRoll[0].length >= this.preRollSamples) {
          this.preRollLength -= this.preRoll.shift().length;
        }
        return done;
      }
      this.inSpeech = true;
      this.chunks = [...this.preRoll];
      this.length = this.preRollLength;
      this.preRoll = [];
      this.preRollLength = 0;
      this.silent = 0;
      this.speech = 0;
    }

    this.chunks.push(chunk);
    this.length += chunk.length;
    if (loud) {
      this.silent = 0;
      this.speech += chunk.length;
    } else {
      this.silent += chunk.length;
    }

    if (this.silent >= this.silenceSamples) {
      const segment = this._finish();
      if (segment) done.push(segment);
    } else if (this.length >= this.maxSamples) {
      const segment = this._finish(true);
      if (segment) done.push(segment);
    }
    return done;
  }

  /** The phrase in progress (when the user stops dictating), or null. */
  flush() {
    return this.inSpeech ? this._finish() : null;
  }

  _finish(keepListening = false) {
    const speech = this.speech;
    let audio = concat(this.chunks);
    // drop most of the trailing silence, keep a short tail so the last word is not clipped
    const trim = Math.max(0, this.silent - this.tailSamples);
    if (trim > 0 && trim < audio.length) audio = audio.subarray(0, audio.length - trim);
    this.reset();
    this.inSpeech = keepListening;
    return speech >= this.minSpeechSamples ? audio : null;
  }
}

// Whisper invents text for silence and noise ("Gracias por ver el video", "[BLANK_AUDIO]"): drop those.
const NOISE_ONLY = /^(?:\[[^\]]*\]|\([^)]*\)|\*[^*]*\*|♪+|\.+)$/;
const HALLUCINATIONS = /^(?:gracias por (?:ver|mirar)(?: el video| este video)?\.?|subt[ií]tulos?.*|suscr[ií]bete.*|thank(?:s| you)(?: for watching)?\.?|you\.?|amara\.org.*)$/i;

export function cleanTranscript(text) {
  const t = String(text || '').replace(/\s+/g, ' ').trim();
  if (!t || NOISE_ONLY.test(t) || HALLUCINATIONS.test(t)) return '';
  return t;
}
