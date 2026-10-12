# whisper.wasm (vendored)

- Source: https://github.com/timur00kh/whisper.wasm, npm package `@timur00kh/whisper.wasm@canary`, resolved to version `0.1.1-canary.70ff9bf` (upstream commit `70ff9bf`). MIT license (see LICENSE).
- It wraps whisper.cpp (https://github.com/ggml-org/whisper.cpp, MIT) compiled to WebAssembly. The model is bundled in `models/ggml-tiny-q5_1.bin` (Whisper Tiny, multilingual, quantised, 31 MB; OpenAI Whisper weights, MIT) from https://huggingface.co/ggerganov/whisper.cpp, so nothing is downloaded at runtime.
- This is a prebuilt WASM from a single-maintainer canary release; it was not built from source by this project. Prefer a stable or source-built release when one is available.

## Hashes (SHA-256, text files with CRLF normalised to LF)

Full list for every vendored file: `vendor/HASHES.md` and `vendor/hashes.json`. Checked in CI by `scripts/verify-vendor.js`.

| File | SHA-256 | Relation to upstream |
|---|---|---|
| `index.es.js` | `0d37558743e3b1c97265b77ec0131caf8c803c93f24a36a74c670d163c19aeab` | byte-identical to the npm package |
| `libmain-D9-QM3iM.mjs` | `35f4464ed9bf19822a8feebdf8a621999c201a14c975be68a7738d01b1de12dd` | npm file (`990792a9...67e3`) plus the two `autono:` patches below; embedded WASM unchanged |
| `models/ggml-tiny-q5_1.bin` | `818710568da3ca15689e31a743197b520007872ff9576237bda97bd1b469c3d7` | 32,152,673 bytes; equals the Hugging Face LFS oid for `ggerganov/whisper.cpp` `ggml-tiny-q5_1.bin` |

## Local patches (marked with `autono:` in `libmain-D9-QM3iM.mjs`)

Chrome extensions (Manifest V3) forbid evaluating strings as code, so the two places where the Emscripten/embind glue built functions with `new Function(...)` were replaced by equivalent closures:

1. `/* autono: no-eval invoker */` (function `_g`, embind "function invoker" generator): the generated invoker is now a closure that wires the arguments, calls the function, runs destructors and wires the result.
2. `/* autono: no-eval method caller */` (the `PC` method-caller generator): the generated method caller is now a closure that reads the arguments from memory, calls, and wires the result back.

`scripts/check-csp.js` fails if `new Function(` or `eval(` reappears in this vendored directory.

## Known dead code

`ModelManager` / `loadModelByUrl` in the upstream package reference mutable `huggingface.co/.../resolve/main/` URLs. Autono never calls them (the model is loaded from the packaged file), but they are still present in the bundle. Stripping them is tracked as a follow-up; if it is done, regenerate the hashes.
