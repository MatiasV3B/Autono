# Bridge security contract

This is what the Autono extension now sends and expects, and what the (separate) Bridge repository must
enforce for the end-to-end trust model to hold. The extension half is implemented; the Bridge half cannot
be verified from this repo.

## 1. Pairing token handshake (implemented in the extension)

1. The user turns on "external control (MCP)" in the side panel, or presses **Generate** next to
   "Pairing token". The panel generates 32 random bytes (hex, 64 chars) with `crypto.getRandomValues`.
2. The token is stored in `chrome.storage.local` under `autono_pairing_token` and shown once in the panel.
   The user copies it into the Bridge configuration. The extension never logs it and never puts it in a URL.
3. The Bridge stores the token (or its hash) per install.

### Headers the extension sends

| Call | Header |
|---|---|
| Every call from the background worker and the side panel to the Bridge origin (`/health`, `/v1/*`, `/{provider}/v1/chat/completions`, `/{provider}/v1/agents/run`, `/api/config`, `/api/power/*`, `/api/code/execute`, `/v1/update/*`, `/v1/stt/*`, ...) | `Authorization: Bearer <pairing token>` (falls back to the legacy public constant `Bearer sk-antigravity` only while no token exists, so old Bridges keep working) |
| MCP long-poll `GET {origin}/api/mcp/pending_actions?timeout=15` | `X-Autono-Token: <pairing token>` |
| MCP result `POST {origin}/api/mcp/action_result` | `X-Autono-Token: <pairing token>`, `Content-Type: application/json` |
| Provider API keys (`x-gemini-key`, `x-api-key`, `x-openai-key`, body `*_api_key`, `POST /api/config`) | Sent **only** when the user enabled `forwardKeysToBridge` (default off) |

All credentialed requests use `redirect: 'error'` (the Bridge must not redirect them).

### Request shapes the Bridge must handle

- Chat / planner / report / tab-agent calls now carry the rules and JSON schema in a `system` role message.
  The Bridge must pass the `system` role through to the model (or prepend it) and must not drop it.
- Page-derived data is inside `<<<UNTRUSTED_WEB_DATA nonce=...>>> ... <<<END nonce=...>>>`. The Bridge must
  not strip, reorder or rewrite these markers.
- `start_chat` / `start_cowork` context (search results, attachments) is already inside that block; the
  Bridge never receives it as part of the goal text.
- MCP actions: `action_id` must match `^[A-Za-z0-9_-]{8,128}$`; actions outside
  `get_active_tab, navigate, click, type, screenshot, browser_task` (and their `browser_` aliases) are
  rejected by the extension.

## 2. What the Bridge must enforce

1. **Per-install bearer token on every route**, including the GET long-poll (`/api/mcp/pending_actions`),
   `/mcp/sse`, `/api/mcp/status`, `/health` details, `/v1/*`, `/api/*`. Constant-time comparison. Reject
   the legacy public `sk-antigravity` once a token is configured.
2. **Reject web origins**: if `Origin` is present and is not `chrome-extension://<id>` of the paired
   extension, answer 403. No request may be served to a page-origin browser context.
3. **Host header**: require `Host` to be exactly `127.0.0.1:<port>` or `localhost:<port>` (DNS-rebinding
   defence).
4. **JSON only**: state-changing routes accept only `Content-Type: application/json`; reject
   `text/plain`, form and multipart posts (CSRF with "simple" requests).
5. **CORS**: no wildcard and no reflected `Origin`. Allow only the paired extension origin, or no CORS at all
   (the extension has host permissions and does not need it).
6. **Bind**: listen exclusively on loopback (`127.0.0.1` / `::1`), never `0.0.0.0`; take the port with an
   exclusive bind so another local process cannot share it.
7. **`/api/code/execute`**: sandbox it (no network, no home directory, resource limits, short timeout) or
   remove it. It must require the token and must never be reachable without it.
8. **`/api/power/*`** (sleep, shutdown, hibernate, prevent-sleep, schedule-wake): token required; shutdown
   and hibernate should also show a local OS notification with a cancel path.
9. **Unguessable `action_id`**: at least 128 bits of randomness; one-shot; expire unclaimed actions
   (for example after 60 s); accept a result only for an id that was issued, once.
10. **Signed, tagged release updates** (`/v1/update/extension`, `/v1/update/bridge`):
    - fetch only from a pinned release URL (tagged releases, not the moving `main`);
    - verify a detached signature (minisign/cosign) over a SHA-256 manifest with a **public key pinned in
      the Bridge**; refuse unsigned or mismatching content;
    - **reject downgrades** (version must be greater than the installed one);
    - report the version and commit/hash to the panel so the user confirms exactly what is installed;
    - require the token on `/v1/update/*`.
11. **`ext_path` validation** for `/v1/update/extension`: derive the extension folder from the extension id
    itself where possible; otherwise canonicalise the path, require that it contains an Autono
    `manifest.json` (name and id match), forbid traversal and symlink escapes, and refuse system folders.
12. **Never persist provider keys it does not need.** With `forwardKeysToBridge` off (the default) the
    extension does not send keys; the Bridge must not store keys it receives unless the user configured a
    mode in which the Bridge itself calls the provider, and must keep them out of logs.
13. **Do not log** request bodies (they contain page text, prompts, screenshots) or the token.

## 3. Extension-side behaviours the Bridge can rely on

- URLs: `bridgeUrl`, `localMcpUrl` and provider `baseUrl` must be `http://` on `127.0.0.1`/
  `localhost`, or `https://` elsewhere (with a warning); credentials in the URL are rejected.
- The remote-control poller only runs against loopback hosts (a non-loopback host needs an explicit
  per-host confirmation), requires the pairing token, stops after 10 consecutive failures, and starts only
  at worker start (setting on) or from an explicit toggle in the panel.
- External `navigate`, `click`, `type`, `screenshot` and `browser_task` actions ask for approval in the
  panel unless the user enabled "auto-allow external actions" (default off). If no panel is open the action
  is refused with an error result. The result `error` string is "The user did not allow this external
  action" in that case.
- A cancel in the panel aborts every in-flight model call, sub-agent and typing loop; no power action is
  requested after a cancelled task.
