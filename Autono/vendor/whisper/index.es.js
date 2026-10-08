const M = class M {
  constructor(t = M.levels.INFO, e = "") {
    this.level = t, this.prefix = e;
  }
  debug(...t) {
    this.level <= M.levels.DEBUG && console.debug(`[${this.prefix}] [DEBUG]`, ...t);
  }
  info(...t) {
    this.level <= M.levels.INFO && console.info(`[${this.prefix}] [INFO]`, ...t);
  }
  warn(...t) {
    this.level <= M.levels.WARN && console.warn(`[${this.prefix}] [WARN]`, ...t);
  }
  error(...t) {
    this.level <= M.levels.ERROR && console.error(`[${this.prefix}] [ERROR]`, ...t);
  }
  setLevel(t) {
    this.level = t;
  }
  getLevel() {
    return this.level;
  }
};
M.levels = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3
};
let y = M;
const F = async () => WebAssembly.validate(new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11])), L = {
  language: "auto",
  threads: 4,
  translate: !1
};
function q(n) {
  const t = String(n).trim().replace(",", "."), e = t.split(":").map(Number);
  if (e.some(Number.isNaN)) throw new Error(`Bad time: "${n}"`);
  let r = 0, o = 0, i = 0;
  if (e.length === 3)
    [r, o] = e, i = parseFloat(t.split(":").pop() || "0");
  else if (e.length === 2)
    [o] = e, i = parseFloat(t.split(":").pop() || "0");
  else
    throw new Error(`Bad time format: "${n}"`);
  return Math.floor(((r * 60 + o) * 60 + i) * 1e3);
}
function W(n) {
  const e = /^\s*\[?\s*([0-9]{1,2}:[0-9]{2}:(?:[0-9]{2}[.,][0-9]{1,3})|[0-9]{1,2}:[0-9]{2}[.,][0-9]{1,3})\s*-->\s*([0-9]{1,2}:[0-9]{2}:(?:[0-9]{2}[.,][0-9]{1,3})|[0-9]{1,2}:[0-9]{2}[.,][0-9]{1,3})\s*\]?\s*(.*)\s*$/.exec(n);
  if (!e)
    throw new Error("Line does not match VTT-like pattern: " + n);
  const r = e[1], o = e[2], i = e[3] || "", s = q(r), a = q(o);
  if (a < s)
    throw new Error("End time is before start time");
  return {
    startMs: s,
    endMs: a,
    start: r,
    end: o,
    text: i
  };
}
function O(n) {
  return new Promise((t) => setTimeout(t, n));
}
function D(n, t) {
  let e = null, r = !1, o = null, i = null;
  return { timeoutError: () => new Promise((u, h) => {
    i = u, o = h, e = setTimeout(() => {
      !r && o && (r = !0, o(new Error(t)));
    }, n);
  }), clear: () => {
    e && (clearTimeout(e), e = null), i && (i(), i = null), r = !0, o = null;
  } };
}
function I(n, t = 16e3 * 100) {
  const e = [];
  for (let r = 0; r < n.length; r += t)
    e.push(n.subarray(r, r + t));
  return e;
}
class $ {
  constructor(t, e) {
    this.whisperService = t, this.logger = new y((e == null ? void 0 : e.logLevel) || y.levels.ERROR, "TranscriptionSession");
  }
  async *streaming(t, e = {}) {
    const { timeoutMs: r = 3e4 } = e, o = I(t);
    let i = 0;
    for await (const s of o) {
      const a = [];
      let u = null, h = !1, d, l = 0;
      const { timeoutError: m, clear: c } = D(r, "Transcribe timeout"), w = () => this.whisperService.transcribe(
        s,
        (g) => {
          l = g.timeEnd, g.timeStart += i, g.timeEnd += i, this.logger.debug("Transcription segment in session:", g), u ? (u(g), u = null) : a.push(g), c();
        },
        e
      ).then(() => {
        this.logger.debug("Transcription done in session then"), h = !0, i += l, c(), u == null || u(void 0);
      }).catch((g) => {
        this.logger.debug("Transcription error in session catch:", g), d = g, c(), u == null || u(void 0);
      });
      for (w(); ; ) {
        if (d) {
          if (e.restartModelOnError) {
            this.whisperService.restartModel(), w();
            continue;
          }
          throw d;
        }
        if (h) break;
        if (a.length)
          yield a.shift();
        else
          try {
            const g = await Promise.race([
              new Promise(
                (f) => u = f
              ),
              m()
            ]);
            g && (yield g);
          } catch (g) {
            d = g;
          }
      }
      e.sleepMsBetweenChunks && await O(e.sleepMsBetweenChunks);
    }
  }
  /**
   * @deprecated Use `streaming()` instead.
   */
  async *streamimg(t, e = {}) {
    yield* this.streaming(t, e);
  }
}
class U extends EventTarget {
  on(t, e) {
    return this.addEventListener(t, e), () => this.removeEventListener(t, e);
  }
  emit(t, e) {
    this.dispatchEvent(new CustomEvent(t, { detail: e }));
  }
}
class Z {
  constructor(t) {
    this.wasmModule = null, this.instance = null, this.modelFileName = "whisper.bin", this.isTranscribing = !1, this.bus = new U(), this.modelData = null, this.logger = new y((t == null ? void 0 : t.logLevel) ?? y.levels.ERROR, "WhisperWasmService"), t != null && t.init && this.loadWasmScript();
  }
  async checkWasmSupport() {
    return await F();
  }
  async loadWasmScript() {
    this.wasmModule = await (await import("./libmain-D9-QM3iM.mjs")).default({
      print: (t, ...e) => {
        e.length > 0 && this.logger.debug(e), t.startsWith("[") ? (this.logger.info(t), this.bus.emit("transcribe", t)) : (this.logger.debug(t), this.bus.emit("system_info", t));
      },
      printErr: (t, ...e) => {
        e.length > 0 && this.logger.debug(e), this.logger.warn(t), this.bus.emit("transcribeError", t);
      }
    });
  }
  async initModel(t) {
    if (!await this.checkWasmSupport())
      throw new Error("WASM is not supported");
    return this.modelData = t, this.wasmModule && (this.wasmModule.FS_unlink(this.modelFileName), this.wasmModule.free()), await this.loadWasmScript(), await O(100), this.storeFS(this.modelFileName, t), this.instance = this.wasmModule.init(this.modelFileName), Promise.resolve();
  }
  restartModel() {
    if (!this.modelData)
      throw new Error("Model not loaded");
    return this.initModel(this.modelData);
  }
  storeFS(t, e) {
    if (!this.wasmModule)
      throw new Error("WASM module not loaded");
    try {
      this.wasmModule.FS_unlink(t);
    } catch {
    }
    this.wasmModule.FS_createDataFile("/", t, e, !0, !0, !0);
  }
  async transcribe(t, e, r = {}) {
    if (this.isTranscribing)
      throw new Error("Already transcribing");
    if (!this.wasmModule)
      throw new Error("WASM module not loaded");
    if (!this.instance)
      throw new Error("WASM instance not loaded");
    const o = 120;
    t.length > 16e3 * o && this.logger.warn(
      "It's not recommended to transcribe audio data that is longer than 120 seconds"
    ), this.isTranscribing = !0;
    const {
      language: i = "auto",
      threads: s = 4,
      translate: a = !1
    } = {
      ...L,
      ...r
    }, u = [], h = Date.now();
    return this.wasmModule.full_default(this.instance, t, i, s, a), await new Promise((d, l) => {
      const m = this.bus.on("transcribe", (g) => {
        const { startMs: f, endMs: v, text: B } = W(g.detail), T = {
          timeStart: f,
          timeEnd: v,
          text: B,
          raw: g.detail
        };
        u.push(T), e == null || e(T);
      }), c = setTimeout(
        () => {
          this.isTranscribing = !1, m(), w(), this.logger.error("Transcribe timeout"), l(new Error("Transcribe timeout")), this.bus.emit("transcribeError", "Transcribe timeout");
        },
        o * 2 * 1e3
      ), w = this.bus.on("transcribeError", (g) => {
        this.isTranscribing = !1, m(), w(), clearTimeout(c), this.logger.debug("Transcribe error", g.detail), d({ segments: u, transcribeDurationMs: Date.now() - h });
      });
    });
  }
  createSession() {
    return new $(this, { logLevel: this.logger.getLevel() });
  }
}
const _ = {
  "tiny.en": {
    id: "tiny.en",
    name: "Tiny English",
    size: 75,
    language: "en",
    quantized: !1,
    url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.en.bin"
  },
  tiny: {
    id: "tiny",
    name: "Tiny Multilingual",
    size: 75,
    language: "multilingual",
    quantized: !1,
    url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin"
  },
  "base.en": {
    id: "base.en",
    name: "Base English",
    size: 142,
    language: "en",
    quantized: !1,
    url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin"
  },
  base: {
    id: "base",
    name: "Base Multilingual",
    size: 142,
    language: "multilingual",
    quantized: !1,
    url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin"
  },
  "small.en": {
    id: "small.en",
    name: "Small English",
    size: 466,
    language: "en",
    quantized: !1,
    url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.en.bin"
  },
  small: {
    id: "small",
    name: "Small Multilingual",
    size: 466,
    language: "multilingual",
    quantized: !1,
    url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin"
  },
  "tiny.en-q5_1": {
    id: "tiny.en-q5_1",
    name: "Tiny English (Q5_1)",
    size: 31,
    language: "en",
    quantized: !0,
    url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.en-q5_1.bin"
  },
  "tiny-q5_1": {
    id: "tiny-q5_1",
    name: "Tiny Multilingual (Q5_1)",
    size: 31,
    language: "multilingual",
    quantized: !0,
    url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny-q5_1.bin"
  },
  "base.en-q5_1": {
    id: "base.en-q5_1",
    name: "Base English (Q5_1)",
    size: 57,
    language: "en",
    quantized: !0,
    url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en-q5_1.bin"
  },
  "base-q5_1": {
    id: "base-q5_1",
    name: "Base Multilingual (Q5_1)",
    size: 57,
    language: "multilingual",
    quantized: !0,
    url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base-q5_1.bin"
  },
  "small.en-q5_1": {
    id: "small.en-q5_1",
    name: "Small English (Q5_1)",
    size: 182,
    language: "en",
    quantized: !0,
    url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.en-q5_1.bin"
  },
  "small-q5_1": {
    id: "small-q5_1",
    name: "Small Multilingual (Q5_1)",
    size: 182,
    language: "multilingual",
    quantized: !0,
    url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small-q5_1.bin"
  },
  "medium.en-q5_0": {
    id: "medium.en-q5_0",
    name: "Medium English (Q5_0)",
    size: 515,
    language: "en",
    quantized: !0,
    url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium.en-q5_0.bin"
  },
  "medium-q5_0": {
    id: "medium-q5_0",
    name: "Medium Multilingual (Q5_0)",
    size: 515,
    language: "multilingual",
    quantized: !0,
    url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium-q5_0.bin"
  },
  "large-q5_0": {
    id: "large-q5_0",
    name: "Large Multilingual (Q5_0)",
    size: 1030,
    language: "multilingual",
    quantized: !0,
    url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-q5_0.bin"
  }
};
function N() {
  return Object.values(_).map(({ url: n, ...t }) => t);
}
function x(n) {
  return _[n];
}
class b {
  constructor(t = { logLevel: y.levels.ERROR }) {
    this.cacheEnabled = !0, this.models = N(), this.logger = new y(t.logLevel, "ModelManager");
  }
  /**
   * Loads model by name
   */
  async loadModel(t, e = !0, r) {
    var w;
    const o = x(t);
    if (!o)
      throw new Error(`Model ${t} not found in config`);
    if (this.cacheEnabled && e) {
      const g = await this.getCachedModel(t);
      if (g)
        return this.logger.info(`Model ${t} loaded from cache`), r && r(100), g;
    }
    this.logger.info(`Loading model ${t} from ${o.url}`);
    const i = await fetch(o.url);
    if (!i.ok)
      throw new Error(`Failed to load model: ${i.statusText}`);
    const s = i.headers.get("content-length"), a = s ? parseInt(s, 10) : 0;
    let u = 0;
    const h = (w = i.body) == null ? void 0 : w.getReader();
    if (!h)
      throw new Error("Response body is not readable");
    const d = [];
    try {
      let g = !1;
      for (; !g; ) {
        const f = await h.read();
        if (g = f.done, !g && f.value && (d.push(f.value), u += f.value.length, r && a > 0)) {
          const v = Math.round(u / a * 100);
          r(v);
        }
      }
    } finally {
      h.releaseLock();
    }
    const l = d.reduce((g, f) => g + f.length, 0), m = new Uint8Array(l);
    let c = 0;
    for (const g of d)
      m.set(g, c), c += g.length;
    return this.cacheEnabled && e && await this.saveModelToCache(t, m), r && r(100), m;
  }
  /**
   * Loads WASM model by URL and saves it to IndexedDB using the URL itself as key.
   */
  async loadModelByUrl(t, e) {
    var r;
    try {
      if (this.cacheEnabled) {
        const c = await this.getCachedModelByUrl(t);
        if (c)
          return this.logger.info(`WASM module loaded from cache by URL: ${t}`), e && e(100), c;
      }
      this.logger.info(`Loading WASM module from URL: ${t}`);
      const o = await fetch(t);
      if (!o.ok)
        throw new Error(`Failed to load WASM module: ${o.statusText}`);
      const i = o.headers.get("content-length"), s = i ? parseInt(i, 10) : 0;
      let a = 0;
      const u = (r = o.body) == null ? void 0 : r.getReader();
      if (!u)
        throw new Error("Response body is not readable");
      const h = [];
      try {
        let c = !1;
        for (; !c; ) {
          const w = await u.read();
          if (c = w.done, !c && w.value && (h.push(w.value), a += w.value.length, e && s > 0)) {
            const g = Math.round(a / s * 100);
            e(g);
          }
        }
      } finally {
        u.releaseLock();
      }
      const d = h.reduce((c, w) => c + w.length, 0), l = new Uint8Array(d);
      let m = 0;
      for (const c of h)
        l.set(c, m), m += c.length;
      return this.cacheEnabled && await this.saveModelToCacheByUrl(t, l), e && e(100), l;
    } catch (o) {
      throw this.logger.error(o), new Error("Failed to load WASM module");
    }
  }
  /**
   * Get model from IndexedDB by URL (key is the URL itself)
   */
  async getCachedModelByUrl(t) {
    try {
      const o = (await this.openIndexedDB()).transaction(["modelsByUrl"], "readonly").objectStore("modelsByUrl");
      return new Promise((i, s) => {
        const a = o.get(t);
        a.onsuccess = () => {
          const u = a.result;
          u && u.data ? i(u.data) : i(null);
        }, a.onerror = () => s(a.error);
      });
    } catch (e) {
      return this.logger.error("Error reading model from cache by URL:", e), null;
    }
  }
  /**
   * Saves model to IndexedDB by URL (key is the URL itself)
   */
  async saveModelToCacheByUrl(t, e) {
    try {
      const i = (await this.openIndexedDB()).transaction(["modelsByUrl"], "readwrite").objectStore("modelsByUrl");
      await new Promise((s, a) => {
        const u = i.put({
          url: t,
          data: e,
          timestamp: Date.now(),
          size: e.length
        });
        u.onsuccess = () => s(), u.onerror = () => a(u.error);
      }), this.logger.info(`Model saved to cache by URL: ${t}`);
    } catch (r) {
      this.logger.error("Error saving model to cache by URL:", r);
    }
  }
  /**
   * Gets list of available models with cache information
   */
  async getAvailableModels() {
    const t = [...this.models];
    if (!this.cacheEnabled)
      return t;
    try {
      const e = await this.getCachedModelNames();
      return t.map((r) => ({
        ...r,
        cached: e.includes(r.id)
      }));
    } catch (e) {
      return this.logger.error("Error checking cache status:", e), t;
    }
  }
  /**
   * Gets list of available models without cache check (synchronously)
   */
  getAvailableModelsSync() {
    return [...this.models];
  }
  /**
   * Gets model by name from config
   */
  getModelConfig(t) {
    return x(t);
  }
  /**
   * Saves model to IndexedDB
   */
  async saveModelToCache(t, e) {
    try {
      const i = (await this.openIndexedDB()).transaction(["models"], "readwrite").objectStore("models");
      await new Promise((s, a) => {
        const u = i.put({
          name: t,
          data: e,
          timestamp: Date.now(),
          size: e.length
        });
        u.onsuccess = () => s(), u.onerror = () => a(u.error);
      }), this.logger.info(`Model ${t} saved to cache`);
    } catch (r) {
      this.logger.error("Error saving model to cache:", r);
    }
  }
  /**
   * Gets model from IndexedDB cache
   */
  async getCachedModel(t) {
    try {
      const o = (await this.openIndexedDB()).transaction(["models"], "readonly").objectStore("models");
      return new Promise((i, s) => {
        const a = o.get(t);
        a.onsuccess = () => {
          const u = a.result;
          u && u.data ? i(u.data) : i(null);
        }, a.onerror = () => s(a.error);
      });
    } catch (e) {
      return this.logger.error("Error getting cached model:", e), null;
    }
  }
  /**
   * Gets list of model names loaded in cache
   */
  async getCachedModelNames() {
    try {
      const r = (await this.openIndexedDB()).transaction(["models"], "readonly").objectStore("models");
      return new Promise((o, i) => {
        const s = r.getAllKeys();
        s.onsuccess = () => {
          const a = s.result;
          o(a);
        }, s.onerror = () => i(s.error);
      });
    } catch (t) {
      return this.logger.error("Error getting cached model names:", t), [];
    }
  }
  /**
   * Opens IndexedDB for model caching
   */
  async openIndexedDB() {
    return new Promise((t, e) => {
      const r = indexedDB.open("WhisperModels", 2);
      r.onerror = () => e(r.error), r.onsuccess = () => t(r.result), r.onupgradeneeded = (o) => {
        const i = o.target.result;
        if (!i.objectStoreNames.contains("models")) {
          const s = i.createObjectStore("models", { keyPath: "name" });
          s.createIndex("timestamp", "timestamp", { unique: !1 }), s.createIndex("size", "size", { unique: !1 });
        }
        if (!i.objectStoreNames.contains("modelsByUrl")) {
          const s = i.createObjectStore("modelsByUrl", { keyPath: "url" });
          s.createIndex("timestamp", "timestamp", { unique: !1 }), s.createIndex("size", "size", { unique: !1 });
        }
      };
    });
  }
  /**
   * Clears model cache
   */
  async clearCache() {
    try {
      const e = (await this.openIndexedDB()).transaction(["models", "modelsByUrl"], "readwrite"), r = e.objectStore("models");
      await new Promise((i, s) => {
        const a = r.clear();
        a.onsuccess = () => i(), a.onerror = () => s(a.error);
      });
      const o = e.objectStore("modelsByUrl");
      await new Promise((i, s) => {
        const a = o.clear();
        a.onsuccess = () => i(), a.onerror = () => s(a.error);
      }), this.logger.info("Model cache cleared");
    } catch (t) {
      this.logger.error("Error clearing cache:", t);
    }
  }
  /**
   * Gets cache information
   */
  async getCacheInfo() {
    try {
      const r = (await this.openIndexedDB()).transaction(["models"], "readonly").objectStore("models");
      return new Promise((o, i) => {
        const s = r.getAll();
        s.onsuccess = () => {
          const a = s.result, u = a.reduce((h, d) => h + (d.size || 0), 0);
          o({ count: a.length, totalSize: u });
        }, s.onerror = () => i(s.error);
      });
    } catch (t) {
      return this.logger.error("Error getting cache info:", t), { count: 0, totalSize: 0 };
    }
  }
}
var p = /* @__PURE__ */ ((n) => (n.MP3 = "mp3", n.WAV = "wav", n.OGG = "ogg", n.M4A = "m4a", n.AAC = "aac", n.FLAC = "flac", n.MP4 = "mp4", n.WEBM = "webm", n.AVI = "avi", n.MOV = "mov", n.MKV = "mkv", n.RAW_PCM = "raw_pcm", n.MICROPHONE = "microphone", n.AUDIO_ELEMENT = "audio_element", n))(p || {});
const A = {
  targetSampleRate: 16e3,
  // Whisper требует 16kHz
  targetChannels: 1,
  // Моно аудио
  inputSampleRate: 16e3,
  normalize: !0,
  noiseReduction: !1,
  logLevel: y.levels.ERROR,
  signal: void 0,
  recordingDurationMs: 1e4
};
function j(n) {
  return typeof n == "number" ? n : n ? y.levels[n] : y.levels.ERROR;
}
function S(n) {
  return new y(j(n.logLevel), "AudioConverter");
}
function E(n) {
  if (n != null && n.aborted)
    throw new DOMException("Aborted", "AbortError");
}
function R() {
  return typeof window > "u" ? !1 : !!(window.AudioContext || window.webkitAudioContext || window.OfflineAudioContext || window.webkitOfflineAudioContext);
}
function k() {
  return [
    p.MP3,
    p.WAV,
    p.OGG,
    p.M4A,
    p.AAC,
    p.FLAC,
    p.MP4,
    p.WEBM,
    p.AVI,
    p.MOV,
    p.MKV,
    p.RAW_PCM,
    p.MICROPHONE,
    p.AUDIO_ELEMENT
  ];
}
async function ee(n, t = {}, e = {}) {
  var s, a, u, h, d;
  if (!R())
    throw new Error("Web Audio API is not supported in this browser");
  const r = { ...A, ...t }, o = S(r), i = [];
  try {
    E(r.signal), o.info(`Converting file: ${n.name}`), (s = e.onProgress) == null || s.call(e, 0, `Loading file: ${n.name}`);
    const l = await H(n);
    (a = e.onProgress) == null || a.call(e, 20, "File loaded, decoding..."), E(r.signal);
    const m = await P(l, r, e, o);
    (u = e.onProgress) == null || u.call(e, 40, "Audio decoded, processing...");
    const c = await C(m, r, e, o, i);
    return (h = e.onProgress) == null || h.call(e, 100, "Conversion completed"), o.info("File conversion completed successfully"), c;
  } catch (l) {
    throw o.error("File conversion failed:", l), (d = e.onError) == null || d.call(e, l), l;
  }
}
async function z(n, t = {}, e = {}) {
  var s, a, u, h, d;
  if (!R())
    throw new Error("Web Audio API is not supported in this browser");
  const r = { ...A, ...t }, o = S(r), i = [];
  try {
    E(r.signal), o.info("Converting from MediaStream"), (s = e.onProgress) == null || s.call(e, 0, "Starting recording...");
    const l = await X(n, r, e, o);
    (a = e.onProgress) == null || a.call(e, 50, "Recording completed, decoding...");
    const m = await l.arrayBuffer(), c = await P(m, r, e, o);
    (u = e.onProgress) == null || u.call(e, 70, "Audio decoded, processing...");
    const w = await C(c, r, e, o, i);
    return (h = e.onProgress) == null || h.call(e, 100, "Conversion completed"), w;
  } catch (l) {
    throw o.error("MediaStream conversion failed:", l), (d = e.onError) == null || d.call(e, l), l;
  }
}
async function te(n, t = {}, e = {}) {
  var s, a, u, h, d, l;
  if (!R())
    throw new Error("Web Audio API is not supported in this browser");
  const r = { ...A, ...t }, o = S(r), i = [];
  try {
    E(r.signal), o.info("Converting from HTMLAudioElement"), (s = e.onProgress) == null || s.call(e, 0, "Capturing audio from element...");
    const m = n.srcObject;
    if (m && m instanceof MediaStream) {
      i.push("Using HTMLAudioElement.srcObject MediaStream");
      const f = await z(m, r, e);
      return {
        ...f,
        warnings: [...i, ...f.warnings ?? []]
      };
    }
    const c = n.currentSrc || n.src;
    if (c)
      try {
        (a = e.onProgress) == null || a.call(e, 10, "Fetching audio source...");
        const f = await Y(c, r.signal);
        (u = e.onProgress) == null || u.call(e, 30, "Fetched, decoding...");
        const v = await P(f, r, e, o);
        (h = e.onProgress) == null || h.call(e, 60, "Decoded, processing...");
        const B = await C(v, r, e, o, i);
        return (d = e.onProgress) == null || d.call(e, 100, "Conversion completed"), B;
      } catch (f) {
        if ((f == null ? void 0 : f.name) === "AbortError")
          throw f;
        i.push(
          `Failed to fetch element src (CORS?) – falling back to captureStream: ${f.message}`
        );
      }
    const w = n.captureStream || n.mozCaptureStream;
    if (typeof w != "function")
      throw new Error(
        "Unable to capture audio from HTMLAudioElement: no srcObject, fetch failed, and captureStream() is not supported"
      );
    i.push("Using HTMLAudioElement.captureStream() fallback");
    const g = w.call(n);
    try {
      const f = await z(g, r, e);
      return {
        ...f,
        warnings: [...i, ...f.warnings ?? []]
      };
    } finally {
      g.getTracks().forEach((f) => f.stop());
    }
  } catch (m) {
    throw o.error("HTMLAudioElement conversion failed:", m), (l = e.onError) == null || l.call(e, m), m;
  }
}
async function re(n, t = {}, e = {}) {
  var i, s, a, u;
  if (!R())
    throw new Error("Web Audio API is not supported in this browser");
  const r = { ...A, ...t }, o = S(r);
  try {
    E(r.signal), o.info("Converting from Float32Array"), (i = e.onProgress) == null || i.call(e, 0, "Processing Float32Array...");
    const h = window.AudioContext || window.webkitAudioContext, d = r.inputSampleRate ?? r.targetSampleRate, l = new h({ sampleRate: d });
    try {
      const m = l.createBuffer(1, n.length, l.sampleRate);
      m.getChannelData(0).set(n), (s = e.onProgress) == null || s.call(e, 30, "AudioBuffer created, processing...");
      const w = [];
      d !== r.targetSampleRate && w.push(
        `Float32Array sample rate (${d}Hz) will be converted to ${r.targetSampleRate}Hz`
      );
      const g = await C(m, r, e, o, w);
      return (a = e.onProgress) == null || a.call(e, 100, "Conversion completed"), o.info("Float32Array conversion completed successfully"), g;
    } finally {
      try {
        await l.close();
      } catch {
      }
    }
  } catch (h) {
    throw o.error("Float32Array conversion failed:", h), (u = e.onError) == null || u.call(e, h), h;
  }
}
async function ne(n, t = {}, e = {}) {
  var s, a, u, h;
  if (!R())
    throw new Error("Web Audio API is not supported in this browser");
  const r = { ...A, ...t }, o = S(r), i = [];
  try {
    E(r.signal), o.info("Converting from ArrayBuffer"), (s = e.onProgress) == null || s.call(e, 0, "Processing ArrayBuffer...");
    const d = await P(n, r, e, o);
    (a = e.onProgress) == null || a.call(e, 40, "Audio decoded, processing...");
    const l = await C(d, r, e, o, i);
    return (u = e.onProgress) == null || u.call(e, 100, "Conversion completed"), o.info("ArrayBuffer conversion completed successfully"), l;
  } catch (d) {
    throw o.error("ArrayBuffer conversion failed:", d), (h = e.onError) == null || h.call(e, d), d;
  }
}
async function H(n) {
  return new Promise((t, e) => {
    const r = new FileReader();
    r.onload = (o) => {
      var i;
      return t((i = o.target) == null ? void 0 : i.result);
    }, r.onerror = (o) => e(o), r.readAsArrayBuffer(n);
  });
}
async function P(n, t, e, r) {
  var s;
  (s = e.onProgress) == null || s.call(e, 15, "Decoding audio data");
  const o = window.AudioContext || window.webkitAudioContext, i = new o({
    sampleRate: t.targetSampleRate
  });
  try {
    return await i.decodeAudioData(n);
  } catch (a) {
    throw r.error("Audio decoding failed:", a), new Error(`Failed to decode audio: ${a.message}`);
  } finally {
    try {
      await i.close();
    } catch {
    }
  }
}
async function C(n, t, e, r, o) {
  var a, u, h, d;
  (a = e.onProgress) == null || a.call(e, 50, "Converting audio format..."), J(n, t, o);
  const i = await Q(n, t, e);
  (u = e.onProgress) == null || u.call(e, 70, "Converting to Float32Array...");
  const s = V(i);
  return (h = e.onProgress) == null || h.call(e, 80, "Applying effects..."), t.normalize && G(s), t.noiseReduction && K(s), (d = e.onProgress) == null || d.call(e, 90, "Finalizing..."), {
    audioData: s,
    audioInfo: {
      sampleRate: i.sampleRate,
      duration: i.duration,
      channels: i.numberOfChannels,
      bitDepth: 32,
      // Float32
      format: "float32"
    },
    warnings: o.length > 0 ? o : void 0
  };
}
async function Q(n, t, e) {
  var s;
  (s = e.onProgress) == null || s.call(e, 60, "Converting audio format...");
  const r = window.OfflineAudioContext || window.webkitOfflineAudioContext, o = new r(
    t.targetChannels,
    Math.floor(n.length * t.targetSampleRate / n.sampleRate),
    t.targetSampleRate
  ), i = o.createBufferSource();
  return i.buffer = n, i.connect(o.destination), i.start(0), await o.startRendering();
}
function V(n) {
  if (n.numberOfChannels === 1)
    return n.getChannelData(0);
  {
    const t = n.getChannelData(0), e = n.getChannelData(1), r = new Float32Array(t.length);
    for (let o = 0; o < t.length; o++)
      r[o] = (t[o] + e[o]) / 2;
    return r;
  }
}
function G(n) {
  let t = 0;
  for (let e = 0; e < n.length; e++)
    t = Math.max(t, Math.abs(n[e]));
  if (t > 0) {
    const e = 0.95 / t;
    for (let r = 0; r < n.length; r++)
      n[r] *= e;
  }
}
function K(n) {
  const t = new Float32Array(n.length), e = 3;
  for (let r = 0; r < n.length; r++) {
    let o = 0, i = 0;
    for (let s = Math.max(0, r - e); s <= Math.min(n.length - 1, r + e); s++)
      o += n[s], i++;
    t[r] = o / i;
  }
  n.set(t);
}
function J(n, t, e) {
  n.numberOfChannels > 2 && e.push(`Audio has ${n.numberOfChannels} channels, will be mixed to mono`), n.sampleRate !== t.targetSampleRate && e.push(
    `Audio sample rate (${n.sampleRate}Hz) will be converted to ${t.targetSampleRate}Hz`
  );
}
async function X(n, t, e, r) {
  var w;
  if (typeof window > "u")
    throw new Error("MediaStream recording is only supported in browser environments");
  if (!window.MediaRecorder)
    throw new Error("MediaRecorder is not supported in this browser");
  const o = window.MediaRecorder, s = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/ogg"
  ].find((g) => o.isTypeSupported(g)), a = new o(n, s ? { mimeType: s } : void 0), u = [], h = new Promise((g, f) => {
    a.ondataavailable = (v) => {
      v.data && v.data.size > 0 && u.push(v.data);
    }, a.onerror = () => f(new Error("MediaRecorder error")), a.onstop = () => {
      const v = s || a.mimeType || "application/octet-stream";
      g(new Blob(u, { type: v }));
    };
  }), d = t.signal, l = () => {
    try {
      a.state !== "inactive" && a.stop();
    } catch {
    }
  };
  d == null || d.addEventListener("abort", l, { once: !0 });
  const m = t.recordingDurationMs ?? 1e4, c = setTimeout(() => {
    try {
      a.state !== "inactive" && a.stop();
    } catch {
    }
  }, m);
  (w = e.onProgress) == null || w.call(e, 20, "Recording audio..."), r.debug("Starting MediaRecorder", { mimeType: s ?? a.mimeType, durationMs: m }), a.start(250);
  try {
    return await h;
  } finally {
    clearTimeout(c), d == null || d.removeEventListener("abort", l);
  }
}
async function Y(n, t) {
  E(t);
  const e = await fetch(n, { signal: t });
  if (!e.ok)
    throw new Error(`Failed to fetch (${e.status}): ${e.statusText}`);
  return await e.arrayBuffer();
}
export {
  p as AudioFormat,
  b as ModelManager,
  Z as WhisperWasmService,
  ne as convertFromArrayBuffer,
  te as convertFromAudioElement,
  ee as convertFromFile,
  re as convertFromFloat32Array,
  z as convertFromMediaStream,
  N as getAllModels,
  k as getSupportedFormats,
  R as isWebAudioSupported
};
