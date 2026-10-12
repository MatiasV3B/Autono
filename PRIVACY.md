# Autono privacy notice

Autono is a browser extension that lets an AI model read the page you are on and act in your browser. This document says what data it handles, where that data can go, how long it is kept, and how to delete it.

- **No Autono server.** There is no Autono backend, account or telemetry. The extension does not phone home with analytics, crash reports or usage statistics.
- **You choose the recipients.** Page content and your prompts go to the model provider you configure (and only that one), or to the local Bridge you run on your own computer.
- **Everything else stays on your device**, in the browser's extension storage.

> Statements marked `<!-- verify after merge -->` describe the intended behaviour after the security-hardening branches (Sprint 1 to 3) are merged. They are written in that target state and must be re-checked against the merged code before a release.

## 1. Data inventory

| Data | Why it is processed | Where it goes | When | Retention | How to delete |
|---|---|---|---|---|---|
| Your prompts and chat messages | To get an answer from the model | The model provider you selected (Google Gemini, Anthropic, OpenAI, or a custom/OpenAI-compatible endpoint) directly, or your local Bridge | Each time you send a message or a task runs | Provider's own retention (see their policy); locally kept in the chat history until you delete it | Delete conversations in the side panel history; "Delete all data" in settings <!-- verify after merge --> |
| Content of the current page (URL, title, up to about 30,000 characters of text, interactive elements, form field values) | The agent needs to see the page to answer or act | Same recipient as the prompt | When you ask a question about a page or run Chat/Cowork on it | As above | As above |
| Screenshots of the visible tab | Vision-capable models | Same recipient as the prompt | Only when a task needs it | As above | As above |
| Sessions / history (messages and the page text captured with them) | Resume and review conversations | Not sent anywhere; stored locally in `chrome.storage.local` (`antigravity_sessions`) | Continuously | Until you delete it; a retention limit is applied <!-- verify after merge --> | History delete, "Delete all data", or remove the extension |
| Settings, API keys (Gemini, Anthropic, OpenAI, TinyFish), custom providers, MCP server list | Operate the extension | Stored locally (`chrome.storage.local`, and `localStorage` of the side panel). Keys are sent only to the provider they belong to. They are not pushed to the Bridge automatically <!-- verify after merge --> | When you save settings | Until you clear them | Clear the key fields; remove the extension (removes all local data) |
| Web search queries (opt-in) | Optional web-search tool | TinyFish (`api.search.tinyfish.ai`) with the TinyFish key you provide | Only after you enable it and consent <!-- verify after merge --> | TinyFish's policy | Disable the feature; revoke the key |
| Voice audio (dictation) | Speech to text | Processed on your device (bundled Whisper Tiny model in the extension) or by your local Bridge (Parakeet/Whisper). If neither is available the browser's built-in speech service may be used, which sends audio to the browser vendor (Google for Chrome); this requires your confirmation first <!-- verify after merge --> | While the microphone button is active | Audio is not stored by Autono | Stop dictation; choose a local engine in settings |
| Text to speech ("read aloud") | Read answers aloud | Your local Bridge (Piper) or the browser's speech synthesis | When you press read aloud | Not stored by Autono | n/a |
| Cited site domains (favicons) | Show a small icon next to sources | Previously the domain was sent to Google's favicon service; this request is removed and icons are fetched without a third party <!-- verify after merge --> | n/a | n/a | n/a |
| Update checks | Tell you a new version exists | Your local Bridge, which in turn contacts GitHub (see section 3) | When the side panel opens | Not stored | Do not use the updater |

## 2. Recipients

1. **The model provider you choose.** Google Gemini (`generativelanguage.googleapis.com`), Anthropic (`api.anthropic.com`), OpenAI (`api.openai.com`), or a custom endpoint you add. They receive your prompts, the page content and screenshots included in a request, and your API key as the authentication credential. Their terms govern what they do with it.
2. **The local Antigravity Bridge** (`http://127.0.0.1:<port>` or `localhost`). A separate program on your computer. Autono sends chat requests, speech-to-text audio, text-to-speech requests, power and update commands to it. Anything that listens on that port receives the data, so only run software you trust there. Authentication of this channel is being added <!-- verify after merge -->.
3. **TinyFish** (optional). Search queries, only when you have enabled the feature and provided a key. <!-- verify after merge -->
4. **Browser speech service** (fallback only, with confirmation). <!-- verify after merge -->
5. **Websites you visit.** The agent acts on pages as you would. Anything it types or submits goes to those sites.

There are no advertising, analytics, or data-broker recipients.

## 3. Self-update behaviour

The side panel can ask the local Bridge to update the unpacked extension folder from the project's GitHub repository and then reload the extension. This is only relevant to sideloaded (unpacked) installs; it is hidden for Web Store installs, which update through the Chrome Web Store. <!-- verify after merge -->
Updates are fetched from a tagged release and verified against a published SHA-256 list before they are written. <!-- verify after merge --> Nothing is downloaded or run without you pressing the update button.

## 4. Where data is stored

| Location | Content |
|---|---|
| `chrome.storage.local` (extension) | Settings, API keys, sessions/history, usage counters, MCP/provider configuration |
| `localStorage` of the side panel | UI preferences, theme, cached model lists, some settings mirrors |
| Memory only | The current page snapshot while a task runs |

Autono is disabled in incognito windows (`"incognito": "not_allowed"`), so incognito browsing is not captured.

## 5. Deleting your data

- Delete individual conversations from the history list in the side panel.
- Use **Delete all data** in settings to clear sessions, settings and keys. <!-- verify after merge -->
- Removing the extension in `chrome://extensions` deletes everything it stored locally.
- Data already sent to a provider (or TinyFish) must be deleted through that provider.

## 6. Contact

Report privacy or security issues privately: <https://github.com/MatiasV3B/Autono/security/advisories/new>. See [SECURITY.md](SECURITY.md).
