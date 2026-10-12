// Plain-node tests (no dependencies): node tests/background-gates.test.js
// Loads Autono/background.js in a vm sandbox with a stateful chrome.storage stub and checks the security gates
// that decide who may talk to the service worker (sender validation) and what `save_settings` may write.
'use strict';
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const crypto = require('crypto');

const root = path.join(__dirname, '..', 'Autono');
const EXT_ID = 'abcdefghijklmnop';
const listeners = {};
const store = {};

function pick(keys) {
  if (keys === null || keys === undefined) return { ...store };
  const list = typeof keys === 'string' ? [keys] : Array.isArray(keys) ? keys : Object.keys(keys);
  const out = {};
  for (const k of list) if (k in store) out[k] = JSON.parse(JSON.stringify(store[k]));
  return out;
}
const storageArea = {
  get: (keys, cb) => { const r = pick(keys); if (cb) cb(r); return Promise.resolve(r); },
  set: (obj, cb) => { for (const [k, v] of Object.entries(obj)) store[k] = JSON.parse(JSON.stringify(v)); if (cb) cb(); return Promise.resolve(); },
  remove: (k, cb) => { [].concat(k).forEach((x) => delete store[x]); if (cb) cb(); return Promise.resolve(); },
  setAccessLevel: () => Promise.resolve(),
};
const storage = { local: storageArea, session: storageArea, onChanged: { addListener() {} } };

function mk(pathName) {
  const fn = function () {};
  return new Proxy(fn, {
    get(_, prop) {
      if (prop === 'then') return undefined;
      if (prop === 'addListener') return (cb) => { (listeners[pathName] = listeners[pathName] || []).push(cb); };
      if (prop === 'getURL') return (p) => 'chrome-extension://' + EXT_ID + '/' + (p || '');
      if (prop === 'id') return EXT_ID;
      if (prop === 'getManifest') return () => ({ version: '1.0.0' });
      return mk(pathName + '.' + String(prop));
    },
    apply() { return Promise.resolve([]); },
  });
}
const chromeBase = mk('chrome');
const chrome = new Proxy(chromeBase, { get: (t, p) => (p === 'storage' ? storage : t[p]) });

class ExtURL extends URL {
  get origin() { return this.protocol === 'chrome-extension:' ? 'chrome-extension://' + this.host : super.origin; }
}
const ctx = {
  console: { log() {}, warn() {}, error() {}, info() {}, debug() {} },
  URL: ExtURL, URLSearchParams, setTimeout, clearTimeout, setInterval: () => 0, clearInterval,
  TextEncoder, TextDecoder, Uint8Array, Promise, Date, Math, JSON, Object, Array, String, Number, Set, Map, Error, DOMException,
  AbortController, AbortSignal, Headers, ReadableStream, atob, btoa, crypto: crypto.webcrypto,
  fetch: () => Promise.reject(new Error('offline')),
  chrome,
};
ctx.self = ctx; ctx.globalThis = ctx;
ctx.importScripts = (p) => { vm.runInContext(fs.readFileSync(path.join(root, p), 'utf8'), ctx, { filename: p }); };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root, 'background.js'), 'utf8'), ctx, { filename: 'background.js' });

let passed = 0;
let failed = 0;
function ok(cond, name) {
  if (cond) { passed += 1; console.log('ok   - ' + name); } else { failed += 1; console.log('FAIL - ' + name); }
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const extPanel = { id: EXT_ID, url: 'chrome-extension://' + EXT_ID + '/side-panel/index.html' };
const webTab = { id: EXT_ID, url: 'https://evil.example/', tab: { id: 7, url: 'https://evil.example/' }, frameId: 0 };
const otherExt = { id: 'zzzzzzzzzzzzzzzz', url: 'chrome-extension://zzzzzzzzzzzzzzzz/page.html' };

function send(message, sender) {
  const handlers = listeners['chrome.runtime.onMessage'] || [];
  let response; let called = false;
  for (const h of handlers) {
    h(message, sender, (r) => { response = r; called = true; });
  }
  return { response, called };
}

function makePort(sender, name = 'antigravity-panel') {
  const port = {
    name, sender, disconnected: false, sent: [], handlers: [],
    disconnect() { this.disconnected = true; },
    postMessage(m) { this.sent.push(m); },
    onMessage: { addListener(cb) { port.handlers.push(cb); } },
    onDisconnect: { addListener() {} },
  };
  return port;
}
function connect(port) { for (const h of listeners['chrome.runtime.onConnect'] || []) h(port); }

(async () => {
  await wait(50);

  // ---- onMessage: content scripts on web pages may only use their own small allowlist
  for (const type of ['user_intervention', 'resume_cowork_task', 'quick_inference', 'bridge_relay', 'mascot_test', 'zylo_group_tabs']) {
    const r = send({ type, text: 'x', path: '/v1/stt/status' }, webTab);
    ok(!r.response || r.response.success === false || r.response.paused === false || r.response.ok === false, `tab sender cannot use ${type}`);
  }
  const paused = send({ type: 'AGENT_WORK_PAUSED', paused: false }, webTab);
  ok(!paused.response || paused.response.paused === false, 'a page cannot un-pause a Cowork task');

  // a different extension's id is rejected for everything
  const foreign = send({ type: 'mascot_test' }, otherExt);
  ok(!foreign.response || foreign.response.success !== true, 'another extension cannot use mascot_test');

  // the extension's own page is accepted
  const own = send({ type: 'mascot_test' }, extPanel);
  ok(own.response && own.response.success === true, 'the side panel can use mascot_test');

  // ---- onConnect: only the extension's own pages keep the port
  const webPort = makePort(webTab);
  connect(webPort);
  ok(webPort.disconnected === true, 'a content-script port is disconnected');
  ok(!webPort.sent.some((m) => m && m.type === 'init_state'), 'a content-script port never receives init_state (keys, history)');

  const wrongName = makePort(extPanel, 'something-else');
  connect(wrongName);
  ok(!wrongName.sent.some((m) => m && m.type === 'init_state'), 'a port with another name gets no state');

  const panelPort = makePort(extPanel);
  connect(panelPort);
  await wait(100);
  ok(panelPort.disconnected === false && panelPort.sent.some((m) => m && m.type === 'init_state'), 'the side panel port gets init_state');

  // ---- save_settings: whitelist, validation, no remote-control toggle, merged not replaced
  store.antigravity_settings = { tinyFishApiKey: 'tf-existing', localMcpBridgeEnabled: false, bridgeUrl: 'http://127.0.0.1:8765' };
  const onPanelMessage = panelPort.handlers[0];
  ok(typeof onPanelMessage === 'function', 'port message handler registered');
  await onPanelMessage({
    type: 'save_settings',
    settings: {
      bridgeUrl: 'javascript:alert(1)',
      evilKey: 'x',
      maxSteps: 9999,
      localMcpBridgeEnabled: true,
      geminiApiKey: 'gk',
      webSearchEnabled: true,
      autonomyMode: 'full',
    },
  });
  await wait(100);
  const saved = store.antigravity_settings || {};
  ok(saved.evilKey === undefined, 'unknown keys are dropped');
  ok(saved.bridgeUrl === 'http://127.0.0.1:8765', 'a javascript: bridge URL is rejected and the previous value kept');
  ok(saved.maxSteps >= 1 && saved.maxSteps <= 100, 'maxSteps is clamped to 1..100');
  ok(saved.localMcpBridgeEnabled === false, 'save_settings cannot turn the remote-control poller on');
  ok(saved.geminiApiKey === 'gk' && saved.webSearchEnabled === true && saved.autonomyMode === 'full', 'known keys are saved');
  ok(saved.tinyFishApiKey === 'tf-existing', 'existing settings are merged, not wiped');

  // settings sent from a tab never get that far
  const before = JSON.stringify(store.antigravity_settings);
  const tabResp = send({ type: 'save_settings', settings: { bridgeUrl: 'https://evil.example' } }, webTab);
  await wait(50);
  ok(JSON.stringify(store.antigravity_settings) === before, 'a tab sender cannot change settings');
  void tabResp;

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
