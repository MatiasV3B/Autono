// Static security checks for the shipped extension. Exits non-zero on violations.
//   node scripts/check-csp.js
//
// 1. First-party shipped JS/HTML (vendored code is skipped) must not use dynamic code, inline
//    handlers, javascript: URLs, remote scripts, importScripts(http...), or world:'MAIN'.
// 2. innerHTML/outerHTML/insertAdjacentHTML sinks are counted and listed (advisory for now).
// 3. manifest.json permissions / hosts are validated against the declared allowlist below.
// 4. The vendored whisper glue must not contain the code-evaluation patterns patched by `autono:`.
import fs from 'fs';
import path from 'path';
import { ROOT, collectShipped, isVendored } from './shipped-files.js';

// ---------------------------------------------------------------------------
// Declared allowlists (edit deliberately; every entry needs a reason).
// ---------------------------------------------------------------------------
const ALLOWED_PERMISSIONS = {
  storage: 'settings, sessions, API keys',
  activeTab: 'user-gesture grant for the current tab',
  scripting: 'on-demand injection of the page agent',
  tabs: 'tab url/title/group; removable once host access is narrowed (audit M3)',
  tabGroups: 'group tabs opened by the agent',
  unlimitedStorage: 'chat history incl. page text; removable once a retention cap exists (audit M3)',
  sidePanel: 'the UI',
  power: 'keep-awake while a task runs',
  alarms: 'service-worker keep-alive / pollers',
  contextMenus: 'right-click entries',
};
const ALLOWED_HOSTS = {
  '<all_urls>': 'page access for the agent; move to optional_host_permissions (audit M3)',
  'http://127.0.0.1:*/*': 'local Bridge',
  'http://localhost:*/*': 'local Bridge',
  'https://generativelanguage.googleapis.com/*': 'Gemini API',
  'https://api.anthropic.com/*': 'Anthropic API',
  'https://api.openai.com/*': 'OpenAI API',
  'https://api.search.tinyfish.ai/*': 'TinyFish (opt-in)',
};
const REQUIRE_MANIFEST = { incognito: 'not_allowed' };

// Intentional exceptions: { rule, file, includes, reason }. `includes` must appear in the offending line.
const RULE_ALLOWLIST = [
  // (empty: the sandboxed preview and the dead `new Function` in sidepanel.js are NOT allowlisted;
  //  they are expected to be fixed by the side-panel branch.)
];

// ---------------------------------------------------------------------------
const RULES = [
  { id: 'eval', re: /(^|[^.\w$])eval\s*\(/, why: 'eval()' },
  { id: 'new-function', re: /\bnew\s+Function\b|(^|[^.\w$])Function\s*\(\s*['"`]/, why: 'new Function' },
  { id: 'string-timer', re: /\bset(Timeout|Interval)\s*\(\s*['"`]/, why: 'setTimeout/setInterval with a string' },
  { id: 'inline-handler', re: /<[a-zA-Z][^>]*\son[a-z]+\s*=\s*["'`]/i, why: 'inline on*= handler' },
  { id: 'javascript-url', re: /(\b(href|src|action|formaction)\s*=|\blocation(\.href)?\s*=|\bopen\s*\()\s*\\?["'`]\s*javascript:/i, why: 'javascript: URL' },
  { id: 'remote-script', re: /<script[^>]+\bsrc\s*=\s*["']?https?:\/\//i, why: 'remote <script src>' },
  { id: 'import-scripts-remote', re: /importScripts\s*\(\s*['"`]https?:/, why: 'importScripts(http...)' },
  { id: 'world-main', re: /world\s*:\s*['"`]MAIN['"`]/, why: "world: 'MAIN'" },
];
const SINK = /\.(innerHTML|outerHTML)\s*(\+?=)(?!=)\s*(.*)$|\.insertAdjacentHTML\s*\(/;
const SAFE_SINK_RHS = /^(['"`]\s*['"`]|null)\s*;?\s*$/; // clearing a node is not an injection

const isComment = (l) => /^\s*(\/\/|\*|\/\*)/.test(l);

let failures = 0;
const sinks = [];

function report(rel, ln, why, line) {
  const allowed = RULE_ALLOWLIST.some((a) => a.file === rel && a.rule === why && line.includes(a.includes));
  if (allowed) return;
  failures++;
  console.log(`[VIOLATION] ${rel}:${ln}  ${why}\n    ${line.trim().slice(0, 160)}`);
}

const shipped = collectShipped(ROOT).filter((r) => /\.(js|mjs|html)$/.test(r) && !isVendored(r));
for (const rel of shipped) {
  const lines = fs.readFileSync(path.join(ROOT, rel), 'utf8').split(/\r?\n/);
  lines.forEach((line, i) => {
    if (isComment(line)) return;
    for (const r of RULES) if (r.re.test(line)) report(rel, i + 1, r.why, line);
    const m = SINK.exec(line);
    if (m && !(m[3] && SAFE_SINK_RHS.test(m[3].trim()))) sinks.push(`${rel}:${i + 1}`);
  });
}

// ---- manifest ----
const manifestPath = path.join(ROOT, 'manifest.json');
let manifest;
try { manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')); } catch (e) {
  console.log(`[VIOLATION] manifest.json is not valid JSON: ${e.message}`); process.exit(1);
}
const mv = (msg) => { failures++; console.log(`[VIOLATION] manifest.json  ${msg}`); };

for (const p of [...(manifest.permissions || []), ...(manifest.optional_permissions || [])]) {
  if (!(p in ALLOWED_PERMISSIONS)) mv(`permission "${p}" is not on the declared allowlist (scripts/check-csp.js)`);
}
for (const h of [...(manifest.host_permissions || []), ...(manifest.optional_host_permissions || [])]) {
  if (!(h in ALLOWED_HOSTS)) mv(`host permission "${h}" is not on the declared allowlist (scripts/check-csp.js)`);
}
for (const [k, v] of Object.entries(REQUIRE_MANIFEST)) {
  if (manifest[k] !== v) mv(`expected "${k}": "${v}", found ${JSON.stringify(manifest[k])}`);
}
if (!manifest.minimum_chrome_version) mv('minimum_chrome_version is missing');
const csp = (manifest.content_security_policy && manifest.content_security_policy.extension_pages) || '';
if (/(?<!wasm-)unsafe-eval/.test(csp)) mv("CSP contains 'unsafe-eval'");
if (/script-src[^;]*https?:/.test(csp)) mv('CSP script-src allows a remote origin');
if (manifest.externally_connectable) mv('externally_connectable is set');
for (const w of manifest.web_accessible_resources || []) {
  for (const r of w.resources || []) if (r === '*' || r === 'assets/*' || /\.js$/.test(r)) mv(`web_accessible_resources exposes "${r}"`);
  if ((w.matches || []).includes('<all_urls>')) mv('web_accessible_resources matches <all_urls>');
}
const cs = manifest.content_scripts || [];
if (cs.length) console.log(`[note] manifest declares ${cs.length} static content_scripts block(s) (audit M2: replace with on-demand injection)`);

// ---- vendored whisper glue must stay free of string evaluation ----
for (const rel of collectShipped(ROOT).filter((r) => r.startsWith('vendor/whisper/') && /\.(mjs|js)$/.test(r))) {
  const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  const hits = src.match(/new\s+Function\s*\(|(^|[^.\w$])eval\s*\(/g) || [];
  if (hits.length) { failures++; console.log(`[VIOLATION] ${rel}  ${hits.length} string-evaluation call(s) in vendored code`); }
}

// ---- report ----
console.log(`\nScanned ${shipped.length} first-party files.`);
console.log(`innerHTML/outerHTML/insertAdjacentHTML sinks with a non-empty right-hand side: ${sinks.length} (advisory, not failing)`);
sinks.forEach((s) => console.log(`  ${s}`));
if (failures) {
  console.log(`\nFAILED: ${failures} violation(s).`);
  process.exit(1);
}
console.log('\nOK: no violations.');
