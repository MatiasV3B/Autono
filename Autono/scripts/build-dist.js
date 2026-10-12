// Builds the distributable extension from an explicit allowlist (see shipped-files.js).
//   node scripts/build-dist.js              -> <repo>/dist/Autono, dist/autono-<ver>.zip, dist/SHA256SUMS
//   node scripts/build-dist.js --out DIR    -> DIR/Autono, DIR/autono-<ver>.zip, DIR/SHA256SUMS
//   node scripts/build-dist.js --tmp        -> build into a temp dir, verify, then delete it (used by `npm test`)
//   --no-zip                                -> skip the zip
// Dependency-free node. Exits non-zero if a forbidden file would ship.
import fs from 'fs';
import os from 'os';
import path from 'path';
import zlib from 'zlib';
import crypto from 'crypto';
import { ROOT, REPO_ROOT, collectShipped, forbiddenReason } from './shipped-files.js';

const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const val = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };

const useTmp = flag('--tmp');
const outRoot = useTmp
  ? fs.mkdtempSync(path.join(os.tmpdir(), 'autono-build-'))
  : path.resolve(val('--out') || path.join(REPO_ROOT, 'dist'));
const extDir = path.join(outRoot, 'Autono');

function fail(msg) {
  console.error(`BUILD FAILED: ${msg}`);
  if (useTmp) fs.rmSync(outRoot, { recursive: true, force: true });
  process.exit(1);
}

function walk(dir, rel = '', out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const r = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) walk(path.join(dir, e.name), r, out); else out.push(r);
  }
  return out;
}

// 1. clean destination (only the artefacts this script owns)
fs.rmSync(extDir, { recursive: true, force: true });
if (fs.existsSync(outRoot)) {
  for (const f of fs.readdirSync(outRoot)) {
    if (/^autono-.*\.zip$/.test(f) || f === 'SHA256SUMS') fs.rmSync(path.join(outRoot, f), { force: true });
  }
}
fs.mkdirSync(extDir, { recursive: true });

// 2. copy allowlist
const shipped = collectShipped(ROOT);
for (const rel of shipped) {
  const dest = path.join(extDir, rel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(path.join(ROOT, rel), dest);
}
console.log(`Copied ${shipped.length} files to ${extDir}`);

// 3. refuse to build if anything forbidden is in the output
const bad = walk(extDir).map((r) => [r, forbiddenReason(r)]).filter(([, why]) => why);
if (bad.length) {
  for (const [r, why] of bad) console.error(`  forbidden: ${r} (${why})`);
  fail(`${bad.length} forbidden file(s) in output`);
}

// 4. manifest sanity: every referenced file exists in the output
const manifest = JSON.parse(fs.readFileSync(path.join(extDir, 'manifest.json'), 'utf8'));
const refs = new Set();
const add = (p) => { if (typeof p === 'string' && !p.includes('*')) refs.add(p); };
Object.values(manifest.icons || {}).forEach(add);
add(manifest.action && manifest.action.default_icon);
add(manifest.background && manifest.background.service_worker);
add(manifest.side_panel && manifest.side_panel.default_path);
add(manifest.options_page);
(manifest.content_scripts || []).forEach((c) => [...(c.js || []), ...(c.css || [])].forEach(add));
const missing = [...refs].filter((r) => !fs.existsSync(path.join(extDir, r)));
if (missing.length) fail(`manifest references missing file(s): ${missing.join(', ')}`);

// 5. zip (own minimal writer: no dependencies)
const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();
function crc32(buf) { let c = 0xffffffff; for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
const STORED_EXT = new Set(['.png', '.gif', '.woff', '.woff2', '.bin', '.ttf']);

function makeZip(files, baseDir) {
  const DOS_TIME = 0;
  const DOS_DATE = (1 << 5) | 1 | ((2020 - 1980) << 9); // fixed timestamp: reproducible archives
  const parts = []; const central = []; let offset = 0;
  for (const rel of files) {
    const data = fs.readFileSync(path.join(baseDir, rel));
    const stored = STORED_EXT.has(path.extname(rel).toLowerCase());
    const comp = stored ? data : zlib.deflateRawSync(data, { level: 9 });
    const method = stored ? 0 : 8;
    const name = Buffer.from(rel, 'utf8');
    const crc = crc32(data);
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0x0800, 6); lh.writeUInt16LE(method, 8);
    lh.writeUInt16LE(DOS_TIME, 10); lh.writeUInt16LE(DOS_DATE, 12); lh.writeUInt32LE(crc, 14);
    lh.writeUInt32LE(comp.length, 18); lh.writeUInt32LE(data.length, 22); lh.writeUInt16LE(name.length, 26); lh.writeUInt16LE(0, 28);
    parts.push(lh, name, comp);
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(0x0800, 8); ch.writeUInt16LE(method, 10);
    ch.writeUInt16LE(DOS_TIME, 12); ch.writeUInt16LE(DOS_DATE, 14); ch.writeUInt32LE(crc, 16);
    ch.writeUInt32LE(comp.length, 20); ch.writeUInt32LE(data.length, 24); ch.writeUInt16LE(name.length, 28);
    ch.writeUInt32LE(offset, 42);
    central.push(ch, name);
    offset += lh.length + name.length + comp.length;
  }
  const cd = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, cd, end]);
}

const outputs = [];
if (!flag('--no-zip') && !useTmp) {
  const zipName = `autono-${manifest.version}.zip`;
  const files = walk(extDir).sort();
  fs.writeFileSync(path.join(outRoot, zipName), makeZip(files, extDir));
  console.log(`Wrote ${zipName} (${files.length} entries)`);
  outputs.push(zipName);
}

// 6. SHA256SUMS over every file in the output (+ zip)
const sha = (p) => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const lines = walk(extDir).sort().map((r) => `${sha(path.join(extDir, r))}  Autono/${r}`);
for (const z of outputs) lines.push(`${sha(path.join(outRoot, z))}  ${z}`);
fs.writeFileSync(path.join(outRoot, 'SHA256SUMS'), lines.join('\n') + '\n');
console.log(`Wrote SHA256SUMS (${lines.length} entries)`);

if (useTmp) { fs.rmSync(outRoot, { recursive: true, force: true }); console.log('Temp build verified and removed.'); }
console.log('Build complete.');
