// Verifies vendored third-party files against vendor/hashes.json (full sha256).
//   node scripts/verify-vendor.js           -> verify (exit 1 on any mismatch / missing / unlisted file)
//   node scripts/verify-vendor.js --write   -> regenerate vendor/hashes.json from the CURRENT files
//                                              (only do this deliberately, after reviewing an upgrade)
// Text files (.js .mjs .css .md) are hashed with line endings normalised (CRLF -> LF) so the
// result does not depend on git autocrlf; binary files are hashed as-is.
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { ROOT } from './shipped-files.js';

const HASHES = path.join(ROOT, 'vendor', 'hashes.json');
const VENDOR_DIRS = ['side-panel/vendor', 'vendor/whisper'];
const SOURCES = [
  { prefix: 'side-panel/vendor/marked.esm.js', source: 'marked@18.0.13 (npm, lib/marked.esm.js)' },
  { prefix: 'side-panel/vendor/katex.mjs', source: 'katex@0.18.7 (npm, dist/katex.mjs)' },
  { prefix: 'side-panel/vendor/katex.min.css', source: 'katex@0.18.7 (npm, dist/katex.min.css)' },
  { prefix: 'side-panel/vendor/fonts/', source: 'katex@0.18.7 (npm, dist/fonts)' },
  { prefix: 'vendor/whisper/index.es.js', source: '@timur00kh/whisper.wasm@0.1.1-canary.70ff9bf (npm, unmodified)' },
  { prefix: 'vendor/whisper/libmain-D9-QM3iM.mjs', source: '@timur00kh/whisper.wasm@0.1.1-canary.70ff9bf (npm) + 2 `autono:` patches' },
  { prefix: 'vendor/whisper/models/', source: 'ggerganov/whisper.cpp ggml-tiny-q5_1.bin (Hugging Face LFS oid)' },
  { prefix: 'vendor/whisper/LICENSE', source: 'whisper.wasm MIT license' },
  { prefix: 'vendor/whisper/NOTICE.md', source: 'Autono notice (first-party)' },
];
const TEXT = /\.(m?js|css|md)$/i;

function walk(dir, rel, out) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const r = `${rel}/${e.name}`;
    if (e.isDirectory()) walk(path.join(dir, e.name), r, out); else out.push(r);
  }
}
function hashOf(rel) {
  let buf = fs.readFileSync(path.join(ROOT, rel));
  if (TEXT.test(rel)) buf = Buffer.from(buf.toString('utf8').replace(/\r\n/g, '\n'), 'utf8');
  return { sha256: crypto.createHash('sha256').update(buf).digest('hex'), bytes: buf.length };
}

const files = [];
for (const d of VENDOR_DIRS) if (fs.existsSync(path.join(ROOT, d))) walk(path.join(ROOT, d), d, files);
files.sort();
// NOTICE.md documents the hashes, so it is not itself pinned.
for (let i = files.length - 1; i >= 0; i--) if (path.basename(files[i]) === 'NOTICE.md') files.splice(i, 1);

if (process.argv.includes('--write')) {
  const out = {
    note: 'sha256 of vendored files; text files hashed with CRLF normalised to LF. Regenerate with `node scripts/verify-vendor.js --write` only after reviewing an upgrade.',
    files: {},
  };
  for (const rel of files) {
    const src = SOURCES.find((s) => rel === s.prefix || (s.prefix.endsWith('/') && rel.startsWith(s.prefix)));
    out.files[rel] = { ...hashOf(rel), normalized: TEXT.test(rel), source: src ? src.source : 'unknown' };
  }
  fs.writeFileSync(HASHES, JSON.stringify(out, null, 2) + '\n');
  console.log(`Wrote ${path.relative(ROOT, HASHES)} (${files.length} files)`);
  process.exit(0);
}

if (!fs.existsSync(HASHES)) { console.error('vendor/hashes.json is missing'); process.exit(1); }
const expected = JSON.parse(fs.readFileSync(HASHES, 'utf8')).files;
let bad = 0;
for (const [rel, meta] of Object.entries(expected)) {
  if (!fs.existsSync(path.join(ROOT, rel))) { bad++; console.error(`MISSING   ${rel}`); continue; }
  const got = hashOf(rel).sha256;
  if (got !== meta.sha256) { bad++; console.error(`MISMATCH  ${rel}\n  expected ${meta.sha256}\n  actual   ${got}`); }
}
for (const rel of files) if (!(rel in expected)) { bad++; console.error(`UNLISTED  ${rel} (not in vendor/hashes.json)`); }
if (bad) { console.error(`\nvendor verification FAILED: ${bad} problem(s)`); process.exit(1); }
console.log(`vendor verification OK: ${Object.keys(expected).length} files match vendor/hashes.json`);
