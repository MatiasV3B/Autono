// Plain-node self-test (no dependencies) for the Sprint 2 security helpers in Autono/background.js.
// Run: node tests/security-sprint2.test.js
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const src = fs.readFileSync(path.join(__dirname, '..', 'Autono', 'background.js'), 'utf8');
function block(name) {
  const re = new RegExp('// --- Autono security: ' + name + ' ---([\\s\\S]*?)// --- end ---');
  const m = re.exec(src);
  if (!m) throw new Error('block not found: ' + name);
  return m[1];
}
const code = block('url validation') + '\n' + block('sensitive action classifier') +
  '\n;({ validateAgentUrl, agentSensitiveSiteReason, agentLabelIsSensitive, agentFieldIsSensitive, agentRegistrableDomain, agentInternalOrigins })';
const api = vm.runInContext(code, vm.createContext({ URL }));
const { validateAgentUrl, agentSensitiveSiteReason, agentLabelIsSensitive, agentFieldIsSensitive, agentRegistrableDomain, agentInternalOrigins } = api;

let passed = 0;
function t(name, fn) {
  try { fn(); passed++; } catch (e) { console.error('FAIL ' + name + '\n  ' + e.message); process.exitCode = 1; }
}
const blocked = (u, o) => { const r = validateAgentUrl(u, o); return !r.ok; };
const confirm = (u, o) => { const r = validateAgentUrl(u, o); return r.ok && !!r.needsConfirm; };
const plain = (u, o) => { const r = validateAgentUrl(u, o); return r.ok && !r.needsConfirm; };

// Hard rejects (never navigated, no approval can fix them)
for (const u of ['javascript:alert(1)', 'data:text/html,<script>1</script>', 'file:///etc/passwd', 'file:///C:/Windows/win.ini',
  'blob:https://example.com/1234', 'ftp://example.com/x', 'filesystem:https://example.com/temporary/a', 'chrome://settings',
  'chrome-extension://abc/page.html', 'about:blank', 'https://user:pw@host.example/', 'https://user@host.example/',
  'http://' + 'a'.repeat(2100) + '.com', '', '   ', 'https://exa\nmple.com', 42, null]) {
  t('reject ' + String(u).slice(0, 40), () => assert.ok(blocked(u), 'should be rejected'));
}

// Needs the user's explicit confirmation (local / private / Autono's own services)
for (const u of ['http://127.0.0.1:8765/docs', 'http://localhost:8765/', 'http://foo.localhost/', 'http://192.168.1.1/admin',
  'http://10.0.0.5/', 'http://172.16.0.1/', 'http://172.31.255.255/', 'http://169.254.169.254/latest/meta-data/',
  'http://printer.local/', 'http://[::1]/', 'http://[::]/', 'http://[fc00::1]/', 'http://[fd12:3456::1]/', 'http://[fe80::1]/',
  'http://[::ffff:127.0.0.1]/', 'http://[::ffff:7f00:1]/', 'http://[::ffff:c0a8:101]/',
  'http://2130706433/', 'http://0x7f.1/', 'http://0x7f000001/', 'http://0177.0.0.1/', 'http://127.1/', 'http://017700000001/',
  'http://0/', 'http://router/', 'http://localhost./', 'http://LOCALHOST:3000/', 'http://100.64.0.1/', 'http://127.0.0.2/',
  'http://[64:ff9b::7f00:1]/', 'http://[2002:7f00:1::]/']) {
  t('confirm ' + u, () => assert.ok(confirm(u), JSON.stringify(validateAgentUrl(u))));
}

// Normal destinations stay allowed (the agent must still work), including a data-exfil looking URL: it is a valid
// public URL, so it is handled by the new-site approval, not by this validator.
for (const u of ['https://example.com/', 'http://example.org/a?b=c', 'https://evil.example/?d=x', 'https://www.google.com/search?q=hello world',
  'https://sub.domain.co.uk/path', 'https://[2606:4700:4700::1111]/', 'http://8.8.8.8/']) {
  t('allow ' + u, () => assert.ok(plain(u), JSON.stringify(validateAgentUrl(u))));
}
t('url is normalised', () => assert.strictEqual(validateAgentUrl('https://Example.COM').url, 'https://example.com/'));
t('assumeHttps adds scheme', () => assert.strictEqual(validateAgentUrl('example.com/x', { assumeHttps: true }).url, 'https://example.com/x'));
t('assumeHttps keeps rejecting javascript:', () => assert.ok(blocked('javascript:alert(1)', { assumeHttps: true })));
t('assumeHttps host:port', () => assert.ok(confirm('localhost:8765/docs', { assumeHttps: true })));
t('assumeHttps protocol-relative', () => assert.strictEqual(validateAgentUrl('//example.com/a', { assumeHttps: true }).origin, 'https://example.com'));
t('without assumeHttps a bare host is invalid', () => assert.ok(blocked('example.com')));
t('length cap is 2000', () => {
  assert.ok(plain('https://example.com/' + 'a'.repeat(1900)));
  assert.ok(blocked('https://example.com/' + 'a'.repeat(2000)));
});

// Configured Bridge / MCP origins
const internal = agentInternalOrigins({ bridgeUrl: 'https://bridge.example.net:9000', localMcpUrl: '192.168.0.9:8765/mcp/sse' });
t('internal origins parsed', () => assert.strictEqual(JSON.stringify(internal), JSON.stringify(['https://bridge.example.net:9000', 'http://192.168.0.9:8765'])));
t('bridge origin needs confirmation', () => assert.ok(confirm('https://bridge.example.net:9000/v1/models', { blockedOrigins: [...internal] })));
t('other port of the same host does not', () => assert.ok(plain('https://bridge.example.net:9001/', { blockedOrigins: [...internal] })));

// Registrable domain heuristic
t('registrable', () => {
  assert.strictEqual(agentRegistrableDomain('www.mail.example.com'), 'example.com');
  assert.strictEqual(agentRegistrableDomain('a.b.example.co.uk'), 'example.co.uk');
  assert.strictEqual(agentRegistrableDomain('127.0.0.1'), '127.0.0.1');
});

// Sensitive label matcher (en + es)
for (const l of ['Pay now', 'Buy', 'Place order', 'Complete purchase', 'Send', 'Delete account', 'Remove', 'Transfer funds', 'Authorize', 'Allow',
  'Grant access', 'Publish', 'Confirm', 'Submit', 'Checkout', 'Pagar', 'Comprar ahora', 'Enviar mensaje', 'Eliminar', 'Borrar', 'Transferir',
  'Autorizar', 'Permitir', 'Publicar', 'Confirmar']) {
  t('sensitive label ' + l, () => assert.ok(agentLabelIsSensitive(l)));
}
for (const l of ['Search', 'Next', 'Read more', 'Open menu', 'Buscar', 'Siguiente', '', 'Sender info card']) {
  t('benign label ' + l, () => assert.ok(!agentLabelIsSensitive(l)));
}

// Sensitive field matcher
t('password field', () => assert.ok(agentFieldIsSensitive({ type: 'password' })));
t('autocomplete password', () => assert.ok(agentFieldIsSensitive({ type: 'text', autocomplete: 'new-password' })));
t('autocomplete cc-number', () => assert.ok(agentFieldIsSensitive({ type: 'text', autocomplete: 'cc-number' })));
t('one-time-code', () => assert.ok(agentFieldIsSensitive({ type: 'text', autocomplete: 'one-time-code' })));
t('name otp', () => assert.ok(agentFieldIsSensitive({ type: 'text', name: 'otp_code' })));
t('label iban', () => assert.ok(agentFieldIsSensitive({ type: 'text', labelText: 'IBAN' })));
t('search box is fine', () => assert.ok(!agentFieldIsSensitive({ type: 'search', name: 'q', placeholder: 'Search' })));
t('shipping address is fine', () => assert.ok(!agentFieldIsSensitive({ type: 'text', name: 'shipping_address' })));

// Always-ask site list
for (const [u, why] of [['https://mail.google.com/mail/u/0/', 'webmail'], ['https://outlook.live.com/mail', 'webmail'], ['https://www.paypal.com/', 'banking'],
  ['https://github.com/settings', 'code'], ['https://console.aws.amazon.com/', 'cloud'], ['https://accounts.google.com/signin', 'account'],
  ['https://example.com/oauth2/authorize?x=1', 'sign-in'], ['https://vault.bitwarden.com/', 'password'], ['https://app.1password.com/', 'password']]) {
  t('sensitive site ' + u, () => assert.ok(agentSensitiveSiteReason(u), why));
}
for (const u of ['https://en.wikipedia.org/wiki/Bank', 'https://example.com/', 'https://news.ycombinator.com/']) {
  t('normal site ' + u, () => assert.strictEqual(agentSensitiveSiteReason(u), ''));
}

console.log(process.exitCode ? 'FAILED' : `OK: ${passed} checks passed`);
