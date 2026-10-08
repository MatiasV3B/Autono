# whisper.wasm (vendored)

- Source: https://github.com/timur00kh/whisper.wasm, npm package `@timur00kh/whisper.wasm@canary` (0.1.1-canary.70ff9bf). MIT license (see LICENSE).
- It wraps whisper.cpp (https://github.com/ggml-org/whisper.cpp, MIT) compiled to WebAssembly. The model is bundled in `models/ggml-tiny-q5_1.bin` (Whisper Tiny, multilingual, quantised, 31 MB; OpenAI Whisper weights, MIT) from https://huggingface.co/ggerganov/whisper.cpp, so nothing is downloaded.
- One local change in `libmain-D9-QM3iM.mjs`: the two places where the Emscripten/embind glue evaluated generated source with `new Function(...)` (marked with `autono:`) were replaced by equivalent closures. Chrome extensions (Manifest V3) forbid evaluating strings as code, so the original file cannot run there.
