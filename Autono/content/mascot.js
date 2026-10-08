/**
 * Autono mascot (optional add-on).
 * Shows the progress of the running task on whatever tab the user is looking at, announces when it
 * finishes, and lets the user ask a quick side question (/btw) from here without touching the task.
 * The background worker decides when to show it and which animation to use (see mascotFromBroadcast).
 */
(function () {
  'use strict';
  if (window.__autonoMascotLoaded) return;
  window.__autonoMascotLoaded = true;

  // Animations (assets/mascot/<name>.gif). "box" is the part of the canvas that has the pixels and
  // "scale" makes every crab the same on-screen size (one art pixel is about 7.5 px in all of them).
  const GIFS = {
    bubble: { w: 480, h: 480, box: [90, 54, 476, 417], scale: 0.357 },
    coding: { w: 498, h: 498, box: [25, 98, 474, 401], scale: 0.278 },
    dancing: { w: 480, h: 480, box: [78, 113, 402, 390], scale: 0.312 },
    fire: { w: 498, h: 336, box: [133, 55, 450, 336], scale: 0.417 },
    soccer: { w: 498, h: 498, box: [26, 98, 473, 400], scale: 0.278 },
    thinking: { w: 480, h: 480, box: [79, 45, 383, 428], scale: 0.286 },
    waiting: { w: 480, h: 480, box: [40, 146, 445, 380], scale: 0.238 },
    working: { w: 480, h: 480, box: [81, 83, 480, 340], scale: 0.294 },
    lightbulb: { w: 480, h: 480, box: [98, 71, 344, 456], scale: 0.323 },
    // reading and debugging: an intro that plays once, then the part that keeps going
    reading_in: { w: 113, h: 108, box: [0, 0, 113, 108], scale: 1 },
    reading: { w: 113, h: 108, box: [0, 0, 113, 108], scale: 1 },
    debugging_in: { w: 133, h: 87, box: [0, 0, 133, 87], scale: 1 },
    debugging: { w: 133, h: 87, box: [0, 0, 133, 87], scale: 1 },
    // cut from the walking video (already at the right size)
    walk: { w: 84, h: 66, box: [0, 0, 84, 66], scale: 1 },
    look: { w: 84, h: 72, box: [0, 0, 84, 72], scale: 1 },
    jump: { w: 84, h: 135, box: [0, 0, 84, 135], scale: 1 },
  };

  // How long one loop of each animation lasts (ms); used to take turns between animations
  const DUR = { bubble: 2300, coding: 3650, dancing: 1700, fire: 4410, soccer: 4510, thinking: 2500, waiting: 700, working: 1500, lightbulb: 1100, look: 3150, jump: 1860, reading_in: 3070, reading: 990, debugging_in: 2730, debugging: 1320 };

  // state -> animation(s) + short text (red tone for errors). seq = [animation, loops] pairs that take
  // turns; loops 0 means "stay on this one and keep looping it".
  const ES = (navigator.language || '').toLowerCase().startsWith('es');
  const STATES = {
    start: { seq: [['lightbulb', 0]], en: 'On it!', es: '¡Manos a la obra!' }, // you asked for help
    reading: { seq: [['reading_in', 1], ['reading', 0]], en: 'Reading the page…', es: 'Leyendo la página…' },
    thinking: { seq: [['thinking', 0]], en: 'Thinking…', es: 'Pensando…' },
    working: { seq: [['working', 4], ['thinking', 1]], en: 'Working…', es: 'Trabajando…' },
    coding: { seq: [['coding', 0]], en: 'Writing code…', es: 'Programando…' },
    debugging: { seq: [['debugging_in', 1], ['debugging', 0]], en: 'Debugging…', es: 'Depurando…' },
    searching: { seq: [['look', 0]], en: 'Looking around…', es: 'Buscando…' },
    agents: { seq: [['working', 3], ['soccer', 1]], en: 'Agents at work', es: 'Agentes trabajando' },
    retry: { seq: [['lightbulb', 0]], en: 'Trying again…', es: 'Reintentando…' },
    waiting: { seq: [['waiting', 0]], en: 'Needs your OK', es: 'Necesito tu permiso', sticky: true }, // the clock
    waiting_long: { seq: [['waiting', 0]], en: 'Still waiting for you', es: 'Sigo esperándote', sticky: true },
    done: { seq: [['jump', 0]], en: 'Finished! Click for a /btw', es: '¡Terminé! Clic para un /btw', sticky: true }, // jumping, on repeat
    error: { seq: [['fire', 0]], en: 'It got stuck', es: 'Se trabó', sticky: true, tone: 'error' }, // the lit fuse
    idle: { seq: [['dancing', 2], ['soccer', 1], ['bubble', 1]], en: 'Hi! Ask me a /btw', es: '¡Hola! Pregúntame un /btw' },
  };

  const T = {
    btwTitle: ES ? '/btw · pregunta rápida' : '/btw · quick question',
    chatTitle: ES ? 'Mensaje' : 'Message',
    chatHint: ES ? 'Sigue la conversación de tu chat.' : 'Continues your chat conversation.',
    chatPlaceholder: ES ? 'Escribe un mensaje…' : 'Write a message…',
    btwHint: ES ? 'No ve tu tarea; solo responde lo que preguntes.' : 'It cannot see your task; it only answers what you ask.',
    placeholder: ES ? 'Pregunta algo…' : 'Ask something…',
    send: ES ? 'Enviar' : 'Send',
    close: ES ? 'Cerrar' : 'Close',
    thinking: ES ? 'Pensando…' : 'Thinking…',
  };

  let host = null;
  let els = null;
  let currentState = null;
  let panelOpen = false;
  let busy = false;
  let history = [];
  let autoHideTimer = null;

  const CSS = `
    :host { all: initial; }
    .wrap { position: fixed; right: 16px; bottom: 16px; z-index: 2147483647; display: flex; flex-direction: column; align-items: flex-end; gap: 6px; font-family: system-ui, -apple-system, 'Segoe UI', sans-serif; pointer-events: none; }
    .wrap > * { pointer-events: auto; }
    .wrap.hidden { display: none; }
    .wrap.moving { transition: transform 3.2s linear, opacity 0.7s ease; }
    .wrap.moving .bubble { visibility: hidden; }
    .bubble { max-width: 260px; padding: 6px 11px; border-radius: 12px; background: rgba(24, 24, 27, 0.94); color: #f4f4f5; font-size: 12px; line-height: 1.35; border: 1px solid rgba(255, 255, 255, 0.14); box-shadow: 0 6px 18px rgba(0, 0, 0, 0.35); cursor: pointer; animation: pop 0.25s cubic-bezier(0.22, 1, 0.36, 1); }
    .bubble.error { border-color: rgba(248, 113, 113, 0.6); color: #fecaca; }
    .sprite { position: relative; cursor: pointer; animation: pop 0.3s cubic-bezier(0.22, 1, 0.36, 1); filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.35)); }
    .frame { overflow: hidden; }
    .frame img { display: block; image-rendering: pixelated; max-width: none; }
    .x { position: absolute; top: -6px; right: -6px; width: 18px; height: 18px; border-radius: 50%; border: none; background: #27272a; color: #e4e4e7; font-size: 11px; line-height: 18px; padding: 0; cursor: pointer; opacity: 0; transition: opacity 0.15s ease; }
    .sprite:hover .x { opacity: 1; }
    .panel { width: 280px; border-radius: 14px; background: rgba(24, 24, 27, 0.97); border: 1px solid rgba(255, 255, 255, 0.14); box-shadow: 0 12px 30px rgba(0, 0, 0, 0.45); color: #f4f4f5; overflow: hidden; animation: pop 0.25s cubic-bezier(0.22, 1, 0.36, 1); }
    .panel.hidden { display: none; }
    .ph { display: flex; justify-content: space-between; align-items: center; padding: 8px 12px 0; font-size: 11px; font-weight: 700; letter-spacing: 0.04em; color: #38bdf8; }
    .ph button { background: none; border: none; color: #a1a1aa; cursor: pointer; font-size: 14px; padding: 0; }
    .hint { padding: 2px 12px 6px; font-size: 10px; color: #71717a; }
    .log { max-height: 260px; overflow-y: auto; padding: 0 12px; display: flex; flex-direction: column; gap: 6px; }
    .msg { font-size: 12px; line-height: 1.45; padding: 6px 9px; border-radius: 9px; white-space: pre-wrap; word-break: break-word; }
    .msg.me { align-self: flex-end; background: #2563eb; color: #fff; }
    .msg.bot { align-self: flex-start; background: rgba(255, 255, 255, 0.08); }
    .row { display: flex; gap: 6px; padding: 8px 10px 10px; }
    .row input { flex: 1; min-width: 0; background: rgba(255, 255, 255, 0.07); border: 1px solid rgba(255, 255, 255, 0.14); border-radius: 8px; color: #f4f4f5; font-size: 12px; padding: 6px 8px; outline: none; }
    .row input:focus { border-color: #38bdf8; }
    .row button { background: #38bdf8; color: #06202e; border: none; border-radius: 8px; font-size: 12px; font-weight: 700; padding: 0 10px; cursor: pointer; }
    .row button:disabled { opacity: 0.5; cursor: default; }
    @keyframes pop { from { opacity: 0; transform: translateY(8px) scale(0.94); } to { opacity: 1; transform: none; } }
  `;

  function ensureUi() {
    if (host) return;
    host = document.createElement('div');
    host.id = '__autono_mascot_host';
    const root = host.attachShadow({ mode: 'open' });
    root.innerHTML = `
      <style>${CSS}</style>
      <div class="wrap hidden">
        <div class="panel hidden">
          <div class="ph"><span class="ptitle">${T.btwTitle}</span><button type="button" class="pclose" title="${T.close}">✕</button></div>
          <div class="hint">${T.btwHint}</div>
          <div class="log"></div>
          <div class="row"><input type="text" placeholder="${T.placeholder}" autocomplete="off"><button type="button" class="send">${T.send}</button></div>
        </div>
        <div class="bubble"></div>
        <div class="sprite"><div class="frame"><img alt=""></div><button type="button" class="x" title="${T.close}">✕</button></div>
      </div>`;
    els = {
      wrap: root.querySelector('.wrap'),
      panel: root.querySelector('.panel'),
      bubble: root.querySelector('.bubble'),
      sprite: root.querySelector('.sprite'),
      frame: root.querySelector('.frame'),
      img: root.querySelector('.frame img'),
      log: root.querySelector('.log'),
      input: root.querySelector('.row input'),
      send: root.querySelector('.send'),
    };

    els.sprite.addEventListener('click', (e) => {
      if (e.target.classList.contains('x')) return;
      togglePanel();
    });
    els.bubble.addEventListener('click', togglePanel);
    // double click after it has finished: it walks away (the single clicks of the double click cancel out)
    els.sprite.addEventListener('dblclick', (e) => {
      if (e.target.classList.contains('x')) return;
      if (chatMode()) dismiss();
    });
    root.querySelector('.x').addEventListener('click', (e) => { e.stopPropagation(); dismiss(); });
    root.querySelector('.pclose').addEventListener('click', () => togglePanel(false));
    els.send.addEventListener('click', sendBtw);
    // Keep page shortcuts from reacting to typing in the box
    ['keydown', 'keyup', 'keypress'].forEach((t) => els.input.addEventListener(t, (e) => e.stopPropagation()));
    els.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); sendBtw(); }
      if (e.key === 'Escape') togglePanel(false);
    });
    // pages with a strict image policy can block the GIF: show nothing rather than a broken-image icon
    els.img.addEventListener('error', () => { els.frame.style.visibility = 'hidden'; });
    (document.documentElement || document.body).appendChild(host);
  }

  function drawSprite(gifName) {
    const g = GIFS[gifName] || GIFS.idle;
    const cw = g.box[2] - g.box[0];
    const ch = g.box[3] - g.box[1];
    const s = g.scale || Math.min(120 / cw, 96 / ch);
    els.img.style.imageRendering = s < 1 ? 'auto' : 'pixelated';
    els.frame.style.width = `${Math.round(cw * s)}px`;
    els.frame.style.height = `${Math.round(ch * s)}px`;
    els.img.style.width = `${Math.round(g.w * s)}px`;
    els.img.style.height = `${Math.round(g.h * s)}px`;
    els.img.style.marginLeft = `${-Math.round(g.box[0] * s)}px`;
    els.img.style.marginTop = `${-Math.round(g.box[1] * s)}px`;
    const url = chrome.runtime.getURL(`assets/mascot/${gifName}.gif`);
    if (els.img.getAttribute('src') !== url) {
      els.frame.style.visibility = '';
      els.img.setAttribute('src', url);
    }
  }

  let visible = false;
  let moveToken = 0;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  let currentText = '';

  let seqTimer = null;
  let lastPaintAt = 0;
  let pending = null;
  let pendingTimer = null;
  const MIN_HOLD = 2500; // a state stays at least this long so the animation is not cut short

  function playSeq(def) {
    clearTimeout(seqTimer);
    let i = 0;
    const step = () => {
      const [gif, loops] = def.seq[i % def.seq.length];
      drawSprite(gif);
      if (def.seq.length < 2 || loops === 0) return; // 0 = keep looping this one
      seqTimer = setTimeout(() => { i++; step(); }, (DUR[gif] || 2500) * loops);
    };
    step();
  }

  function paint(state) {
    const def = STATES[state];
    const changed = state !== currentState;
    currentState = state;
    els.bubble.textContent = currentText || (ES ? def.es : def.en);
    els.bubble.classList.toggle('error', def.tone === 'error');
    // the same state again (a new page step, a tab switch...) must not restart its animation
    if (changed || !els.img.getAttribute('src')) {
      lastPaintAt = Date.now();
      playSeq(def);
    }
  }

  // Replays whatever the current state shows (after the /btw box borrowed the sprite)
  function replayCurrent() {
    if (currentState && STATES[currentState]) playSeq(STATES[currentState]);
  }

  // Appearing: the critter walks in from the right edge and then plays the state's animation
  async function walkIn(state) {
    const token = ++moveToken;
    clearTimeout(seqTimer);
    clearTimeout(pendingTimer);
    pending = null;
    visible = true;
    els.wrap.classList.remove('hidden');
    els.wrap.classList.add('moving');
    els.wrap.style.transition = 'none';
    els.wrap.style.transform = 'translateX(260px)';
    els.wrap.style.opacity = '0';
    drawSprite('walk');
    void els.wrap.offsetWidth;
    els.wrap.style.transition = '';
    els.wrap.style.transform = 'translateX(0)';
    els.wrap.style.opacity = '1';
    await wait(3300);
    if (token !== moveToken) return;
    els.wrap.classList.remove('moving');
    els.wrap.style.transform = '';
    els.wrap.style.opacity = '';
    const finalState = currentState || state;
    currentState = null; // force the state's animation to start now
    paint(finalState);
  }

  // Leaving: walks back out to the right, unless the user is talking to it
  async function walkOut() {
    if (!visible || !els) return;
    const token = ++moveToken;
    clearTimeout(seqTimer);
    clearTimeout(pendingTimer);
    pending = null;
    visible = false;
    els.panel.classList.add('hidden');
    panelOpen = false;
    els.wrap.classList.add('moving');
    drawSprite('walk');
    els.wrap.style.transform = 'translateX(260px)';
    els.wrap.style.opacity = '0';
    await wait(3300);
    if (token !== moveToken) return;
    els.wrap.classList.add('hidden');
    els.wrap.classList.remove('moving');
    els.wrap.style.transform = '';
    els.wrap.style.opacity = '';
    currentState = null;
  }

  function show(state, enter, text) {
    const def = STATES[state];
    if (!def) return;
    ensureUi();
    currentText = text || '';
    clearTimeout(autoHideTimer);
    if (def.sticky) autoHideTimer = setTimeout(dismiss, 3 * 60 * 1000);
    if (!visible && enter !== false) {
      currentState = state;
      walkIn(state);
    } else if (!visible) {
      visible = true;
      moveToken++;
      els.wrap.classList.remove('hidden', 'moving');
      els.wrap.style.transform = '';
      els.wrap.style.opacity = '';
      paint(state);
    } else if (!els.wrap.classList.contains('moving')) {
      const urgent = def.sticky || (STATES[currentState] || {}).sticky;
      const wait2 = MIN_HOLD - (Date.now() - lastPaintAt);
      if (state !== currentState && !urgent && wait2 > 0) {
        // too soon after the last change: keep the animation and switch to the latest state afterwards
        pending = { state, text: currentText };
        clearTimeout(pendingTimer);
        pendingTimer = setTimeout(() => {
          if (!pending || !visible) return;
          currentText = pending.text;
          paint(pending.state);
          pending = null;
        }, wait2);
      } else {
        clearTimeout(pendingTimer);
        pending = null;
        paint(state);
      }
    } else {
      currentState = state; // still walking in: the final animation uses the latest state
    }
  }

  function hide() {
    clearTimeout(autoHideTimer);
    if (!visible || !els) return;
    if (panelOpen) return; // the user is typing to it: stay
    walkOut();
  }

  // Removes it right away (used by the close button)
  function hideNow() {
    clearTimeout(autoHideTimer);
    clearTimeout(seqTimer);
    clearTimeout(pendingTimer);
    pending = null;
    moveToken++;
    visible = false;
    currentState = null;
    panelOpen = false;
    if (els) {
      els.wrap.classList.add('hidden');
      els.wrap.classList.remove('moving');
      els.wrap.style.transform = '';
      els.wrap.style.opacity = '';
      els.panel.classList.add('hidden');
    }
  }

  // The close button (or the 3-minute timeout): it walks off the screen instead of vanishing
  function dismiss() {
    clearTimeout(autoHideTimer);
    try { chrome.runtime.sendMessage({ type: 'mascot_dismiss' }); } catch (_) {}
    if (visible && els) walkOut();
    else hideNow();
  }

  // Finished (or failed): the box continues the chat. While a task runs it is a side question (/btw).
  function chatMode() {
    return currentState === 'done' || currentState === 'error';
  }

  function applyPanelMode() {
    const chat = chatMode();
    els.panel.querySelector('.ptitle').textContent = chat ? T.chatTitle : T.btwTitle;
    els.panel.querySelector('.hint').textContent = chat ? T.chatHint : T.btwHint;
    els.input.placeholder = chat ? T.chatPlaceholder : T.placeholder;
  }

  function togglePanel(force) {
    panelOpen = typeof force === 'boolean' ? force : !panelOpen;
    if (panelOpen) applyPanelMode();
    els.panel.classList.toggle('hidden', !panelOpen);
    if (panelOpen) setTimeout(() => els.input.focus(), 30);
    // an open panel keeps the mascot on screen until it is closed
    try { chrome.runtime.sendMessage({ type: panelOpen ? 'mascot_pin' : 'mascot_unpin' }); } catch (_) {}
  }

  function addMsg(who, text) {
    const div = document.createElement('div');
    div.className = `msg ${who}`;
    div.textContent = text;
    els.log.appendChild(div);
    els.log.scrollTop = els.log.scrollHeight;
    return div;
  }

  function sendBtw() {
    const text = els.input.value.trim();
    if (!text || busy) return;
    busy = true;
    els.send.disabled = true;
    els.input.value = '';
    addMsg('me', text);
    const pending = addMsg('bot', T.thinking);
    const shownState = currentState;
    const asChat = chatMode();
    clearTimeout(seqTimer);
    drawSprite('thinking');
    try {
      const payload = asChat ? { type: 'mascot_followup', text } : { type: 'mascot_btw', text, history: history.slice(-6) };
      chrome.runtime.sendMessage(payload, (res) => {
        busy = false;
        els.send.disabled = false;
        const reply = chrome.runtime.lastError ? chrome.runtime.lastError.message : (res && res.success ? res.text : (res && res.error) || 'No answer');
        pending.textContent = reply || '…';
        if (res && res.success && !asChat) {
          history.push({ role: 'user', content: text }, { role: 'assistant', content: reply });
        }
        els.log.scrollTop = els.log.scrollHeight;
        // go back to the animation of whatever the task is doing now
        if (!currentState && shownState) currentState = shownState;
        replayCurrent();
      });
    } catch (err) {
      busy = false;
      els.send.disabled = false;
      pending.textContent = String(err && err.message || err);
    }
  }

  chrome.runtime.onMessage.addListener((msg) => {
    if (!msg) return;
    if (msg.type === 'mascot_update' && msg.state) show(msg.state, msg.enter, msg.text);
    else if (msg.type === 'mascot_hide') hide();
  });

  // A page that loads while a task is running should show the current state right away
  try {
    chrome.runtime.sendMessage({ type: 'mascot_ready' }, (res) => {
      if (chrome.runtime.lastError) return;
      if (res && res.state) show(res.state, false, res.text);
    });
  } catch (_) {}
})();
