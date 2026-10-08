/**
 * ChatGPT Style Side Panel Controller for Antigravity Agent
 * Manages ModelPicker popover, Zylo Context Tools, TinyFish Web Search, and SSE streaming with AntigravityBridge.
 */

import { searchWithTinyFish, formatTinyFishForPrompt } from '../lib/tinyfish.js';
import katex from './vendor/katex.mjs';
import { marked } from './vendor/marked.esm.js';
import { SpeechSegmenter, cleanTranscript, SAMPLE_RATE } from './dictation-vad.js';

marked.setOptions({
  gfm: true,
  breaks: true,
});

(function () {
  'use strict';

  // ─── DOM References ─────────────────────────────────────────────────────────
  const modelPickerTrigger = document.getElementById('modelPickerTrigger');
  const selectedModelLabel = document.getElementById('selectedModelLabel');
  const modelPickerPopover = document.getElementById('modelPickerPopover');
  const modelSearchInput = document.getElementById('modelSearchInput');
  const modelRowsList = document.getElementById('modelRowsList');

  const newChatBtn = document.getElementById('newChatBtn');
  const historyBtn = document.getElementById('historyBtn');
  const settingsBtn = document.getElementById('settingsBtn');

  const chatViewport = document.getElementById('chatViewport');
  const welcomeHero = document.getElementById('welcomeHero');
  const messagesContainer = document.getElementById('messagesContainer');
  const liveActivityBox = document.getElementById('liveActivityBox');
  const activityDetails = document.getElementById('activityDetails');

  // PromptInputBox & Context Elements (Zylo Feature Set)
  const promptBox = document.getElementById('promptBox');
  const promptInput = document.getElementById('promptInput');
  const promptBeamContainer = document.getElementById('promptBeamContainer');
  const uploadBtn = document.getElementById('uploadBtn');
  const toastNoticeBox = document.getElementById('toastNoticeBox');
  const attachedChipsContainer = document.getElementById('attachedChipsContainer');
  const attachMenuPopover = document.getElementById('attachMenuPopover');
  const attachFilesBtn = document.getElementById('attachFilesBtn');
  const attachPickerBtn = document.getElementById('attachPickerBtn');
  const attachTabsBtn = document.getElementById('attachTabsBtn');
  const attachScreenshotBtn = document.getElementById('attachScreenshotBtn');
  const hiddenMultiFileInput = document.getElementById('hiddenMultiFileInput');

  // Open Tabs Modal (Zylo Feature)
  const tabsModal = document.getElementById('tabsModal');
  const closeTabsBtn = document.getElementById('closeTabsBtn');
  const cancelTabsBtn = document.getElementById('cancelTabsBtn');
  const confirmAttachTabsBtn = document.getElementById('confirmAttachTabsBtn');
  const tabsListContainer = document.getElementById('tabsListContainer');

  const micBtn = document.getElementById('micBtn');
  const toggleCoworkBtn = document.getElementById('toggleCoworkBtn');

  const sendBtn = document.getElementById('sendBtn');
  const arrowIcon = document.getElementById('arrowIcon');
  const stopBtn = document.getElementById('stopBtn');

  const historyDrawer = document.getElementById('historyDrawer');
  const closeHistoryBtn = document.getElementById('closeHistoryBtn');
  const sessionsList = document.getElementById('sessionsList');

  const settingsModal = document.getElementById('settingsModal');
  const closeSettingsBtn = document.getElementById('closeSettingsBtn');
  const settingBridgeUrl = document.getElementById('settingBridgeUrl');
  const settingDefaultModel = document.getElementById('settingDefaultModel');
  const settingMaxSteps = document.getElementById('settingMaxSteps');
  const settingMaxOutputTokens = document.getElementById('settingMaxOutputTokens');
  const settingTinyFishKey = document.getElementById('settingTinyFishKey');
  const settingDisplayMode = document.getElementById('settingDisplayMode');
  const settingAntigravityMode = document.getElementById('settingAntigravityMode');
  const settingGeminiApiKey = document.getElementById('settingGeminiApiKey');
  const toggleGeminiKeyVisibility = document.getElementById('toggleGeminiKeyVisibility');
  const settingClaudeMode = document.getElementById('settingClaudeMode');
  const settingAnthropicApiKey = document.getElementById('settingAnthropicApiKey');
  const toggleAnthropicKeyVisibility = document.getElementById('toggleAnthropicKeyVisibility');
  const settingOpenaiMode = document.getElementById('settingOpenaiMode');
  const settingOpenaiApiKey = document.getElementById('settingOpenaiApiKey');
  const toggleOpenaiKeyVisibility = document.getElementById('toggleOpenaiKeyVisibility');
  const saveSettingsBtn = document.getElementById('saveSettingsBtn');

  // AI Context Meter DOM References
  const aiContextMeter = document.getElementById('aiContextMeter');
  const contextMeterBtn = document.getElementById('contextMeterBtn');
  const contextRingCircle = document.getElementById('contextRingCircle');
  const contextMeterLabel = document.getElementById('contextMeterLabel');
  const contextMeterPopover = document.getElementById('contextMeterPopover');
  const meterSysTokens = document.getElementById('meterSysTokens');
  const meterPageTokens = document.getElementById('meterPageTokens');
  const meterFileTokens = document.getElementById('meterFileTokens');
  const meterConvTokens = document.getElementById('meterConvTokens');

  // Active Approval Cards Registry
  const activeApprovalCards = new Map();

  // ─── State ──────────────────────────────────────────────────────────────────
  let port = null;
  let attachedItems = []; // { id, type: 'file'|'fragment'|'tab'|'image', name, content, dataUrl }
  let isPickingFragment = false;
  let openTabsList = [];
  let selectedTabIds = new Set();
  let tinyFishApiKey = '';
  let currentBaseModelId = 'gemini-3.8-flash';
  let currentThinkingEffort = 'medium';
  let currentModel = 'gemini-3.8-flash-medium';
  let currentSessionId = generateId();
  let currentTaskId = null;
  let isGenerating = false;
  const isSearchActive = true; // web search (TinyFish) is always on; there is no switch any more
  let isCoworkActive = false;
  let attachedImageDataUrl = null;
  let currentStreamingBubble = null;
  let currentStreamingText = '';
  let currentCoworkBubble = null;
  let currentPlanData = null;
  let currentIntroText = '';
  let allSessions = [];
  let lastUserPrompt = '';
  let lastTaskProvider = null;
  let lastAttachedItems = [];
  let lastSearchSources = [];
  let latestModelSuggestions = [];
  let currentGridOpacity = 0.065;
  let currentSquareSize = 44;
  let currentTrailDecay = 0.022;
  let currentAntigravityMode = 'api';
  let currentGeminiApiKey = '';
  let currentClaudeMode = 'api';
  let currentAnthropicApiKey = '';
  let currentOpenaiMode = 'api';
  let currentOpenaiApiKey = '';
  try {
    const savedAntigravityMode = localStorage.getItem('antigravity_antigravity_mode');
    if (savedAntigravityMode) currentAntigravityMode = savedAntigravityMode;
    const savedGeminiKey = localStorage.getItem('antigravity_gemini_api_key');
    if (savedGeminiKey) currentGeminiApiKey = savedGeminiKey;

    const savedClaudeMode = localStorage.getItem('antigravity_claude_mode');
    if (savedClaudeMode) currentClaudeMode = savedClaudeMode;
    const savedAnthropicKey = localStorage.getItem('antigravity_anthropic_api_key');
    if (savedAnthropicKey) currentAnthropicApiKey = savedAnthropicKey;

    const savedOpenaiMode = localStorage.getItem('antigravity_openai_mode');
    if (savedOpenaiMode) currentOpenaiMode = savedOpenaiMode;
    const savedOpenaiKey = localStorage.getItem('antigravity_openai_api_key');
    if (savedOpenaiKey) currentOpenaiApiKey = savedOpenaiKey;
  } catch (_) {}
  let customSkills = [];
  try {
    const savedSkills = localStorage.getItem('antigravity_custom_skills');
    if (savedSkills) {
      const parsed = JSON.parse(savedSkills);
      if (Array.isArray(parsed)) customSkills = parsed;
    }
  } catch (_) {}

  // External OpenAI-compatible providers state (max 5)
  let externalProviders = [];
  try {
    const savedProviders = localStorage.getItem('antigravity_external_providers');
    if (savedProviders) {
      const parsedProv = JSON.parse(savedProviders);
      if (Array.isArray(parsedProv)) externalProviders = parsedProv;
    }
  } catch (_) {}

  // Active files in current session (created by model or attached by user)
  const sessionActiveFiles = new Map();

  // Provider hierarchy: 1. Gemini, 2. Claude, 3. GPT / OSS
  const PROVIDER_DATA = {
    gemini: {
      id: 'gemini',
      name: 'Gemini',
      iconSvg: `<svg viewBox="0 0 296 298" width="16" height="16" fill="none">
        <mask id="trig-gemini-mask" width="296" height="298" x="0" y="0" maskUnits="userSpaceOnUse" style="mask-type: alpha">
          <path fill="#3186FF" d="M141.201 4.886c2.282-6.17 11.042-6.071 13.184.148l5.985 17.37a184.004 184.004 0 0 0 111.257 113.049l19.304 6.997c6.143 2.227 6.156 10.91.02 13.155l-19.35 7.082a184.001 184.001 0 0 0-109.495 109.385l-7.573 20.629c-2.241 6.105-10.869 6.121-13.133.025l-7.908-21.296a184 184 0 0 0-109.02-108.658l-19.698-7.239c-6.102-2.243-6.118-10.867-.025-13.132l20.083-7.467A183.998 183.998 0 0 0 133.291 26.28l7.91-21.394Z" />
        </mask>
        <g mask="url(#trig-gemini-mask)">
          <ellipse cx="163" cy="149" fill="#3689FF" rx="196" ry="159" />
          <ellipse cx="33.5" cy="142.5" fill="#F6C013" rx="68.5" ry="72.5" />
          <path fill="#FA4340" d="M194 10.5C172 82.5 65.5 134.333 22.5 135L144-66l50 76.5Z" />
          <path fill="#14BB69" d="M194.5 279.5C172.5 207.5 66 155.667 23 155l121.5 201 50-76.5Z" />
        </g>
      </svg>`,
      models: [
        {
          id: 'gemini-3.8-flash',
          name: 'Gemini 3.8 Flash',
          desc: 'Agile navigation, multimodal vision and rapid web page analysis.',
          contextWindow: '1.0M tokens',
          metrics: { intelligence: 8, speed: 8, context: 10, efficiency: 5 },
          caps: ['reasoning', 'image'],
          thinking: ['low', 'medium', 'high'],
          defaultThinking: 'medium',
          usageGroup: 'gemini',
        },
        {
          id: 'gemini-3.7-flash',
          name: 'Gemini 3.7 Flash',
          desc: 'Hybrid speed with adaptable deep deduction and agile response.',
          contextWindow: '1.0M tokens',
          metrics: { intelligence: 8, speed: 8, context: 10, efficiency: 5 },
          caps: ['reasoning', 'image'],
          thinking: ['low', 'medium', 'high'],
          defaultThinking: 'medium',
          usageGroup: 'gemini',
        },
        {
          id: 'gemini-3.6-flash',
          name: 'Gemini 3.6 Flash',
          desc: 'Efficient model for direct data extraction and lightweight background tasks.',
          contextWindow: '1.0M tokens',
          metrics: { intelligence: 7, speed: 8, context: 10, efficiency: 6 },
          caps: ['reasoning', 'image'],
          thinking: ['low', 'medium', 'high'],
          defaultThinking: 'medium',
          usageGroup: 'gemini',
        },
        {
          id: 'gemini-3.1-pro',
          name: 'Gemini 3.1 Pro',
          desc: 'Peak analytical depth, massive 2.0M token window and complex codebase reasoning.',
          contextWindow: '2.0M tokens',
          metrics: { intelligence: 9, speed: 3, context: 10, efficiency: 8 },
          caps: ['reasoning', 'image'],
          thinking: ['low', 'high'],
          defaultThinking: 'high',
          usageGroup: 'gemini',
        },
        {
          id: 'gpt-oss-120b-medium',
          name: 'GPT-OSS 120B',
          desc: 'Open source inference (MoE), unrestricted throughput, local edge deployment and total privacy.',
          contextWindow: '128K tokens',
          metrics: { intelligence: 6, speed: 2, context: 5, efficiency: 6 },
          caps: ['reasoning', 'image'],
          thinking: ['low', 'medium', 'high'],
          defaultThinking: 'medium',
          usageGroup: 'gemini',
        },
      ],
    },
    claude: {
      id: 'claude',
      name: 'Claude',
      iconSvg: `<img src="../assets/claude-icon-32.png" width="16" height="16" style="object-fit:contain;vertical-align:middle;" alt="Claude">`,
      models: [
        {
          id: 'claude-sonnet-5-5',
          name: 'Claude Sonnet 5.5',
          desc: 'Next-generation flagship for agentic workflows, autonomous reasoning and state-of-the-art coding.',
          contextWindow: '1.0M tokens',
          metrics: { intelligence: 8, speed: 8, context: 10, efficiency: 6 },
          caps: ['reasoning', 'image'],
          thinking: ['low', 'medium', 'high', 'x-high', 'max'],
          defaultThinking: 'high',
          usageGroup: 'claude_gpt',
        },
        {
          id: 'claude-opus-5-5',
          name: 'Claude Opus 5.5',
          desc: 'Frontier supreme intelligence for ultra-complex multi-turn reasoning, safety and deep architecture.',
          contextWindow: '1.0M tokens',
          metrics: { intelligence: 9, speed: 6, context: 10, efficiency: 8 },
          caps: ['reasoning', 'image'],
          thinking: ['low', 'medium', 'high', 'x-high', 'max'],
          defaultThinking: 'high',
          usageGroup: 'claude_gpt',
        },
        {
          id: 'claude-fable-5-1',
          name: 'Claude Fable 5.1',
          desc: 'Specialized for agentic storytelling, sequence-of-thought workflows and dynamic web tasks.',
          contextWindow: '500K tokens',
          metrics: { intelligence: 7, speed: 2, context: 8, efficiency: 6 },
          caps: ['reasoning', 'image'],
          thinking: ['low', 'medium', 'high', 'x-high', 'max'],
          defaultThinking: 'high',
          usageGroup: 'claude_gpt',
        },
        {
          id: 'claude-haiku-4-5',
          name: 'Claude Haiku 4.5',
          desc: 'High-velocity instant response for real-time web actions, DOM extraction and responsive chats.',
          contextWindow: '500K tokens',
          metrics: { intelligence: 6, speed: 9, context: 8, efficiency: 8 },
          caps: ['reasoning', 'image'],
          thinking: ['fast', 'thinking'],
          defaultThinking: 'fast',
          usageGroup: 'claude_gpt',
        },
      ],
    },
    chatgpt: {
      id: 'chatgpt',
      name: 'OpenAI',
      iconSvg: `<svg viewBox="0 0 24 24" width="16" height="16" fill="#ffffff" style="color:#ffffff;">
        <path fill="#ffffff" d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1683a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4947zm-9.66-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1402-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.02 1.1683a.0757.0757 0 0 1-.071 0l-4.8303-2.7866A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1636a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z"/>
      </svg>`,
      models: [
        {
          id: 'gpt-6-astra',
          name: 'GPT-6 Astra',
          desc: 'Frontier cosmic reasoning, multimodal perception and state-of-the-art autonomous execution.',
          contextWindow: '2.0M tokens',
          metrics: { intelligence: 9, speed: 6, context: 10, efficiency: 6 },
          caps: ['reasoning', 'image'],
          thinking: ['low', 'medium', 'high', 'x-high', 'max'],
          defaultThinking: 'high',
          usageGroup: 'claude_gpt',
        },
        {
          id: 'gpt-6-sol',
          name: 'GPT-6 Sol',
          desc: 'Solar-speed frontier inference, low-latency reasoning and reactive browser copilot.',
          contextWindow: '1.0M tokens',
          metrics: { intelligence: 8, speed: 8, context: 10, efficiency: 6 },
          caps: ['reasoning', 'image'],
          thinking: ['low', 'medium', 'high', 'x-high', 'max'],
          defaultThinking: 'medium',
          usageGroup: 'claude_gpt',
        },
        {
          id: 'gpt-6-luna',
          name: 'GPT-6 Luna',
          desc: 'Deep contemplative logic, rigorous mathematical proof and complex architecture.',
          contextWindow: '1.0M tokens',
          metrics: { intelligence: 9, speed: 3, context: 10, efficiency: 8 },
          caps: ['reasoning', 'image'],
          thinking: ['low', 'medium', 'high', 'x-high', 'max'],
          defaultThinking: 'high',
          usageGroup: 'claude_gpt',
        },
        {
          id: 'gpt-6-terra',
          name: 'GPT-6 Terra',
          desc: 'Grounded web navigation, tool orchestration and robust real-world automation.',
          contextWindow: '1.0M tokens',
          metrics: { intelligence: 8, speed: 7, context: 10, efficiency: 6 },
          caps: ['reasoning', 'image'],
          thinking: ['low', 'medium', 'high', 'x-high', 'max'],
          defaultThinking: 'medium',
          usageGroup: 'claude_gpt',
        },
        {
          id: 'gpt-5-6-terra',
          name: 'GPT-5.6 Terra',
          desc: 'Grounded web navigation, tool orchestration and robust real-world automation.',
          contextWindow: '1.0M tokens',
          metrics: { intelligence: 7, speed: 7, context: 10, efficiency: 6 },
          caps: ['reasoning', 'image'],
          thinking: ['low', 'medium', 'high', 'x-high', 'max'],
          defaultThinking: 'medium',
          usageGroup: 'claude_gpt',
        },
        {
          id: 'gpt-5-6-sol',
          name: 'GPT-5.6 Sol',
          desc: 'Solar-speed agile inference, low-latency reasoning and reactive web workflow execution.',
          contextWindow: '1.0M tokens',
          metrics: { intelligence: 7, speed: 8, context: 10, efficiency: 6 },
          caps: ['reasoning', 'image'],
          thinking: ['low', 'medium', 'high', 'x-high', 'max'],
          defaultThinking: 'medium',
          usageGroup: 'claude_gpt',
        },
        {
          id: 'gpt-5-6-luna',
          name: 'GPT-5.6 Luna',
          desc: 'Deep contemplative deduction, structured mathematical proof and systematic logic.',
          contextWindow: '1.0M tokens',
          metrics: { intelligence: 8, speed: 3, context: 10, efficiency: 8 },
          caps: ['reasoning', 'image'],
          thinking: ['low', 'medium', 'high', 'x-high', 'max'],
          defaultThinking: 'high',
          usageGroup: 'claude_gpt',
        },
      ],
    },
  };

  // OpenAI tab rule: only <number>-<Astra|Sol|Luna|Terra> models from 5.6 on, and GPT-6 always has all four
  const GPT6_REQUIRED = PROVIDER_DATA.chatgpt.models.filter((m) => /^gpt-6-/.test(m.id)).map((m) => ({ ...m }));
  function openAiModelInfo(id) {
    const m = /^gpt-(\d+)(?:-(\d+))?-(astra|sol|luna|terra)/.exec(String(id || '').toLowerCase().replace(/\./g, '-'));
    return m ? { major: parseInt(m[1], 10), minor: m[2] ? parseInt(m[2], 10) : 0, tier: m[3] } : null;
  }
  function isAllowedOpenAiModel(id) {
    const info = openAiModelInfo(id);
    return !!info && (info.major > 5 || (info.major === 5 && info.minor >= 6));
  }

  let activeProvider = 'gemini';
  let activeModelTab = 'antigravity'; // 'antigravity', 'claude', or 'openai'
  // Tab the current model was picked from. It decides the engine: Claude/GPT models picked under
  // 'antigravity' run on the local terminal; the Claude/OpenAI APIs only apply from their own tabs.
  let modelRoute = null;
  try {
    const savedRoute = localStorage.getItem('antigravity_model_route');
    if (['antigravity', 'claude', 'openai'].includes(savedRoute)) modelRoute = savedRoute;
  } catch (_) {}

  function generateId() {
    return 'chat-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6);
  }

  // ─── Connect to Service Worker ──────────────────────────────────────────────
  let heartbeatTimer = null;
  let reconnectTimeout = null;

  function isContextValid() {
    try {
      return Boolean(chrome?.runtime?.id);
    } catch (_) {
      return false;
    }
  }

  function showContextInvalidatedNotice() {
    if (toastNoticeBox) {
      toastNoticeBox.innerHTML = `<span>Autono was updated. <a href="#" id="reloadSidePanelLink" style="color:#60a5fa;text-decoration:underline;font-weight:600;">Click to reload panel</a></span>`;
      toastNoticeBox.classList.remove('hidden');
      document.getElementById('reloadSidePanelLink')?.addEventListener('click', (e) => {
        e.preventDefault();
        location.reload();
      });
    }
  }

  function setupPort() {
    if (!isContextValid()) {
      showContextInvalidatedNotice();
      return;
    }

    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout);
      reconnectTimeout = null;
    }

    try {
      port = chrome.runtime.connect({ name: 'antigravity-panel' });

      port.onMessage.addListener((msg) => {
        if (msg && msg.type === 'pong') {
          return;
        }
        handleBackgroundMessage(msg);
      });

      port.onDisconnect.addListener(() => {
        const _err = chrome.runtime.lastError;
        if (heartbeatTimer) {
          clearInterval(heartbeatTimer);
          heartbeatTimer = null;
        }
        port = null;

        if (!isContextValid()) {
          showContextInvalidatedNotice();
          return;
        }

        reconnectTimeout = setTimeout(() => {
          reconnectTimeout = null;
          if (isContextValid()) {
            setupPort();
          }
        }, 1000);
      });

      // Keep service worker alive while side panel is actively open (every 20s)
      heartbeatTimer = setInterval(() => {
        if (!isContextValid()) {
          if (heartbeatTimer) clearInterval(heartbeatTimer);
          heartbeatTimer = null;
          return;
        }
        if (port) {
          try {
            port.postMessage({ type: 'heartbeat' });
          } catch (_) {
            if (heartbeatTimer) clearInterval(heartbeatTimer);
            heartbeatTimer = null;
            port = null;
            if (isContextValid()) {
              setupPort();
            }
          }
        }
      }, 20000);
    } catch (e) {
      const _ = chrome.runtime.lastError;
      port = null;
      if (isContextValid()) {
        reconnectTimeout = setTimeout(() => {
          reconnectTimeout = null;
          setupPort();
        }, 1500);
      }
    }
  }

  function sendPortMessage(payload) {
    if (!isContextValid()) {
      showContextInvalidatedNotice();
      return false;
    }
    try {
      if (!port) {
        setupPort();
      }
      if (port) {
        port.postMessage(payload);
        return true;
      }
    } catch (err) {
      const _ = chrome.runtime.lastError;
      port = null;
      try {
        setupPort();
        if (port) {
          port.postMessage(payload);
          return true;
        }
      } catch (retryErr) {
        console.error('Retry postMessage failed:', retryErr);
      }
    }
    return false;
  }

  setupPort();

  // ─── Clickable Space-Efficient AI Prompt Suggestions Chips (Model-Generated) ───
  function renderAiPromptSuggestions(contextText = '') {
    const row = document.getElementById('aiPromptSuggestionsRow');
    if (!row) return;

    let suggestions = [];

    // 1. Check if model provided dedicated next steps suggestions
    if (Array.isArray(latestModelSuggestions) && latestModelSuggestions.length > 0) {
      suggestions = [...latestModelSuggestions];
    } else if (contextText && typeof contextText === 'string') {
      // 2. Try parsing <next_steps_suggestions> JSON directly from contextText
      const m = contextText.match(/<next_steps_suggestions>([\s\S]*?)(?:<\/next_steps_suggestions>|$)/i);
      if (m) {
        try {
          const raw = m[1].trim().replace(/```[a-z]*\n?/g, '').replace(/```$/g, '').trim();
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            suggestions = parsed.filter(s => typeof s === 'string' && s.trim().length > 0);
          }
        } catch (_) {
          const lines = m[1].split('\n')
            .map(l => l.replace(/^[\s*•"-]+/, '').replace(/["',]+$/, '').trim())
            .filter(l => l.length > 2 && !l.startsWith('[') && !l.startsWith(']'));
          if (lines.length > 0) suggestions = lines;
        }
      }
    }

    // 3. Fallback: If model did not emit suggestions block, synthesize dynamic contextual next steps (short 2-4 words)
    if (suggestions.length === 0 && contextText) {
      const lower = contextText.toLowerCase();
      if (lower.includes('code') || lower.includes('function') || lower.includes('error') || lower.includes('bug') || lower.includes('react')) {
        suggestions = [
          'Add unit tests',
          'Refactor to TS',
          'Explain logic',
          'Add edge cases',
          'Optimize speed',
        ];
      } else if (lower.includes('search') || lower.includes('price') || lower.includes('flight') || lower.includes('compare')) {
        suggestions = [
          'Compare options',
          'Key tradeoffs',
          'User reviews',
          'Find cheaper',
          'Export table',
        ];
      } else if (lower.includes('explain') || lower.includes('what is') || lower.includes('how to')) {
        suggestions = [
          'Show example',
          'Explain simply',
          'Key pros & cons',
          'Best practices',
          'Deep dive',
        ];
      } else {
        suggestions = [
          'More details',
          'Key bullet points',
          'Next steps',
          'Concrete examples',
          'Identify risks',
        ];
      }
    }

    // 4. Sanitize and strictly enforce short, compact pill format (max 2-5 words, strictly under 35 chars)
    const cleanedSuggestions = suggestions
      .map(s => {
        if (typeof s !== 'string') return '';
        let cleaned = s
          .replace(/^[\s*•"-]+/, '')
          .replace(/["',.]+$|[\n\r]+/g, '')
          .replace(/[*_`]/g, '')
          .trim();
        // If string is too long, truncate to first 4 words or 32 chars
        if (cleaned.length > 35) {
          const words = cleaned.split(/\s+/);
          if (words.length > 4) {
            cleaned = words.slice(0, 4).join(' ');
          }
          if (cleaned.length > 35) {
            cleaned = cleaned.slice(0, 32).trim() + '...';
          }
        }
        return cleaned;
      })
      .filter(s => s && s.length >= 2 && s.length <= 40);

    if (cleanedSuggestions.length === 0) {
      hideAiPromptSuggestions();
      return;
    }

    // Keep the row short: three suggestions at most
    const finalSuggestions = cleanedSuggestions.slice(0, 3);

    row.innerHTML = '';
    finalSuggestions.forEach((cleanText) => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'ai-prompt-chip';
      chip.title = cleanText;
      chip.innerHTML = `
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"></circle>
          <polyline points="12 16 16 12 12 8"></polyline>
          <line x1="8" y1="12" x2="16" y2="12"></line>
        </svg>
        <span>${escapeHtml(cleanText)}</span>
      `;
      chip.addEventListener('click', (e) => {
        e.stopPropagation();
        if (promptInput) {
          promptInput.value = cleanText;
          handleInputStateChange();
          hideAiPromptSuggestions();
          handleSend();
        }
      });
      row.appendChild(chip);
    });

    row.classList.remove('hidden');
  }

  function hideAiPromptSuggestions() {
    const row = document.getElementById('aiPromptSuggestionsRow');
    if (row) {
      row.classList.add('hidden');
      row.innerHTML = '';
    }
  }

  // ─── AI Error Handler Component Helper (Structured SVG card with Code, Explanation, Copy & Retry) ───
  function createAiErrorCard(rawError = '') {
    const errString = typeof rawError === 'string' ? rawError : (rawError?.message || JSON.stringify(rawError));
    let code = 'ERR_INFERENCE';
    let title = 'Fallo en la Petición de Inferencia';
    let explanation = 'La API o el servicio local devolvió un error durante la generación. Puedes copiar el código de error y el reporte técnico para analizarlo o consultar con soporte.';
    let recommendation = 'Revisa los detalles técnicos y haz clic en Reintentar.';

    if (errString.includes('thinking.type.enabled') || errString.includes('thinking.type.adaptive') || errString.includes('output_config.effort')) {
      code = '400_THINKING_ADAPTIVE';
      title = 'Parámetro de Pensamiento no Soportado (Claude)';
      explanation = 'El modelo Claude seleccionado requiere el nuevo estándar de razonamiento adaptativo ("thinking.type: adaptive" y "output_config.effort") en vez del presupuesto fijo de tokens antiguo ("thinking.type: enabled"). Autono y Model Bridge se han actualizado para adaptar este parámetro automáticamente.';
      recommendation = 'Haz clic en "Reintentar Petición" para continuar con los nuevos parámetros adaptativos aplicados.';
    } else if (errString.includes('temperature') && errString.includes('not supported')) {
      code = '400_TEMPERATURE_O1';
      title = 'Parámetro Incompatible en Modelo de Razonamiento (OpenAI)';
      explanation = 'Los modelos de razonamiento de OpenAI (o1, o3-mini) no permiten configurar el parámetro "temperature". Solo admiten el parámetro "reasoning_effort" (low, medium, high). Autono omite automáticamente la temperatura para estos modelos.';
      recommendation = 'Haz clic en "Reintentar Petición" para enviar sin el parámetro temperature.';
    } else if (errString.includes('Unknown name') || errString.includes('max_output_tokens') || errString.includes('antigravity_mode')) {
      code = '400_INVALID_PAYLOAD';
      title = 'Parámetros no estándar rechazados por la API Directa';
      explanation = 'La API directa de Google Gemini rechazó parámetros que no forman parte del esquema oficial (como "max_output_tokens" o "antigravity_mode"). Autono limpia automáticamente los payloads directos para ajustarse al estándar oficial.';
      recommendation = 'Haz clic en "Reintentar Petición" con los campos normalizados.';
    } else if (errString.includes('401') || errString.includes('403') || errString.includes('Unauthorized') || errString.includes('Authentication Error')) {
      code = '401_AUTH_ERROR';
      title = 'Error de Autenticación / API Key Inválida';
      explanation = 'La clave de API provista para este proveedor no es válida, ha expirado o no tiene saldo/permisos suficientes. Verifica la API Key en el menú de Configuración (engranaje ⚙️).';
      recommendation = 'Ve a Ajustes, ingresa una clave de API válida y vuelve a intentar.';
    } else if (errString.includes('429') || errString.includes('Quota Exceeded') || errString.includes('rate_limit') || errString.includes('RESOURCE_EXHAUSTED')) {
      code = '429_RATE_LIMIT';
      title = 'Límite de Cuota o Velocidad Alcanzado';
      explanation = 'Has superado el límite de peticiones o tokens permitidos por minuto/semana para este modelo. Este límite es impuesto directamente por el proveedor de IA.';
      recommendation = 'Espera unos instantes o cambia a otro modelo disponible en el selector superior.';
    } else if (errString.includes('404')) {
      code = '404_NOT_FOUND';
      title = 'Modelo o Endpoint no Encontrado';
      explanation = 'El modelo o la URL solicitada no existe en la API configurada o el Bridge. Si usas API Directa, verifica que el ID del modelo exista en tu nivel de cuenta.';
      recommendation = 'Presiona el botón de recargar modelos o selecciona un modelo estándar.';
    } else if (errString.includes('Failed to fetch') || errString.includes('NetworkError') || errString.includes('Connection Refused') || errString.includes('No es posible conectar')) {
      code = 'NET_CONN_REFUSED';
      title = 'No se puede conectar con Local Bridge';
      explanation = 'No fue posible establecer conexión con el servidor local en http://127.0.0.1:8765. Asegúrate de que el proceso Antigravity Bridge esté encendido, o cambia el modelo a "API Directa" en Ajustes.';
      recommendation = 'Inicia el servidor local o activa el modo API Directa con tu clave de API.';
    }

    const activeModelName = currentModel || currentBaseModelId || 'Modelo Activo';

    return `
      <div class="ai-error-card" data-error-code="${escapeHtml(code)}" data-raw-error="${escapeHtml(errString)}">
        <div class="ai-error-header">
          <div class="ai-error-icon-wrap">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path>
              <line x1="12" y1="9" x2="12" y2="13"></line>
              <line x1="12" y1="17" x2="12.01" y2="17"></line>
            </svg>
          </div>
          <div class="ai-error-title-wrap">
            <span class="ai-error-code-badge">${escapeHtml(code)}</span>
            <span class="ai-error-title">${escapeHtml(title)}</span>
          </div>
          <button type="button" class="ai-error-dismiss-btn" title="Descartar">&times;</button>
        </div>

        <div class="ai-error-explanation">
          <div class="ai-error-explanation-title">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M9 18h6"></path><path d="M10 22h4"></path>
              <path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14"></path>
            </svg>
            <span>¿Qué está pasando?</span>
          </div>
          <div class="ai-error-explanation-body">${escapeHtml(explanation)}</div>
        </div>

        <div class="ai-error-tech-wrap">
          <div class="ai-error-tech-header">
            <span>Mensaje Técnico</span>
            <span class="ai-error-model-tag">${escapeHtml(activeModelName)}</span>
          </div>
          <pre class="ai-error-tech-pre">${escapeHtml(errString)}</pre>
        </div>

        <div class="ai-error-actions">
          <button type="button" class="ai-error-copy-btn" title="Copiar código y reporte de error para analizarlo">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect width="14" height="14" x="8" y="8" rx="2" ry="2"></rect>
              <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"></path>
            </svg>
            <span>Copiar Código de Error</span>
          </button>
          <button type="button" class="ai-error-retry-btn">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"></path>
              <path d="M21 3v5h-5"></path>
              <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"></path>
              <path d="M8 16H3v5"></path>
            </svg>
            <span>Reintentar Petición</span>
          </button>
        </div>
      </div>
    `;
  }

  function attachErrorCardRetryListener(container) {
    if (!container) return;
    const retryBtn = container.querySelector('.ai-error-retry-btn');
    const dismissBtn = container.querySelector('.ai-error-dismiss-btn');
    const copyBtn = container.querySelector('.ai-error-copy-btn');
    const errorCard = container.querySelector('.ai-error-card');

    // ─── Copy Error Code & Diagnostic Handler ─────────────────────────────
    copyBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      const code = errorCard?.getAttribute('data-error-code') || 'ERROR';
      const raw = errorCard?.getAttribute('data-raw-error') || '';
      const exp = errorCard?.querySelector('.ai-error-explanation-body')?.textContent || '';
      const modelTag = errorCard?.querySelector('.ai-error-model-tag')?.textContent || currentModel || 'N/A';
      const title = errorCard?.querySelector('.ai-error-title')?.textContent || 'Error';

      const diagnosticReport = [
        `=== DIAGNÓSTICO DE ERROR DE AUTONO ===`,
        `Código de Error: ${code}`,
        `Título: ${title}`,
        `Modelo Activo: ${modelTag}`,
        `Pestaña/Proveedor: ${activeModelTab || 'N/A'}`,
        `Fecha y Hora: ${new Date().toISOString()}`,
        ``,
        `¿QUÉ ESTÁ PASANDO?:`,
        `${exp}`,
        ``,
        `DETALLE TÉCNICO RAW:`,
        `${raw}`,
        `=======================================`,
      ].join('\n');

      navigator.clipboard.writeText(diagnosticReport).then(() => {
        const originalHtml = copyBtn.innerHTML;
        copyBtn.classList.add('copied');
        copyBtn.innerHTML = `
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
          <span>✓ Copiado</span>
        `;
        showToast('✓ Código y reporte de error copiado al portapapeles. ¡Listo para analizar!');
        setTimeout(() => {
          copyBtn.classList.remove('copied');
          copyBtn.innerHTML = originalHtml;
        }, 2500);
      }).catch(() => {
        showToast('Error al copiar al portapapeles');
      });
    });

    retryBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      const parentRow = errorCard?.closest('.message-row');
      if (parentRow) parentRow.remove();
      if (lastUserPrompt && promptInput) {
        promptInput.value = lastUserPrompt;
        if (Array.isArray(lastAttachedItems) && lastAttachedItems.length > 0) {
          attachedItems = [...lastAttachedItems];
          renderAttachedChips();
        }
        handleInputStateChange();
        handleSend();
      }
    });

    dismissBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      const parentRow = errorCard?.closest('.message-row');
      if (parentRow) parentRow.remove();
      else errorCard?.remove();
    });
  }

  // ─── Background Message Handler ─────────────────────────────────────────────
  function handleBackgroundMessage(msg) {
    switch (msg.type) {
      case 'init_state':
        updateBridgeStatus(msg.bridgeOnline);
        if (msg.settings) {
          applyLoadedSettings(msg.settings);
        }
        allSessions = msg.sessions || [];

        if (msg.activeSessionId) {
          const session = allSessions.find((s) => s.id === msg.activeSessionId);
          if (session) {
            currentSessionId = session.id;
            renderSessionMessages(session.messages);
          }
        }

        // Restore task if it was running or paused in background
        if (msg.runningTask && (msg.runningTask.status === 'running' || msg.runningTask.status === 'paused')) {
          currentTaskId = msg.runningTask.taskId;
          currentSessionId = msg.runningTask.sessionId;
          isGenerating = true;
          toggleInputState(true);
          const isPaused = msg.runningTask.status === 'paused';
          showLiveActivity(isPaused ? '⏸ Task paused' : (msg.runningTask.mode === 'cowork' ? '⚡ Cowork running...' : '✦ Generating response...'));
          if (msg.runningTask.mode === 'chat') {
            if (msg.runningTask.fullAnswer) {
              currentStreamingBubble = createMessageRow('assistant', msg.runningTask.fullAnswer);
              currentStreamingText = msg.runningTask.fullAnswer;
            } else {
              currentStreamingBubble = createMessageRow('assistant', '');
              if (currentStreamingBubble) {
                currentStreamingBubble.innerHTML = renderThinkingBubbleHtml('Thinking and analyzing screen...');
              }
            }
          } else if (msg.runningTask.mode === 'cowork') {
            currentPlanData = msg.runningTask.plan || null;
            currentIntroText = msg.runningTask.intro || '';
            currentCoworkBubble = createMessageRow('assistant', '', null, null, currentPlanData, currentIntroText);
            if (isPaused && currentCoworkBubble) {
              const pauseCardId = 'resume-btn-' + Date.now();
              const pauseBanner = document.createElement('div');
              pauseBanner.className = 'session-paused-banner';
              pauseBanner.style.cssText = 'margin:12px 0;padding:12px 14px;background:rgba(234,179,8,0.12);border:1px solid rgba(234,179,8,0.35);border-radius:10px;color:#fef08a;font-size:12.5px;';
              pauseBanner.innerHTML = `
                <div style="font-weight:600;margin-bottom:4px;display:flex;align-items:center;gap:6px;">
                  <span>⏸</span> <span>Session Paused</span>
                </div>
                <div style="color:#d1d5db;font-size:12px;margin-bottom:10px;line-height:1.4;">
                  ${msg.runningTask.pausedReason === 'tab_closed' ? 'The linked work tab was closed.' : 'Execution has been paused.'}
                  ${msg.runningTask.savedTabUrl ? `<br>Saved URL: <a href="${escapeHtml(msg.runningTask.savedTabUrl)}" target="_blank" style="color:#38bdf8;word-break:break-all;">${escapeHtml(msg.runningTask.savedTabUrl)}</a>` : ''}
                </div>
                <button type="button" id="${pauseCardId}" style="background:#0284c7;color:#ffffff;border:none;padding:6px 14px;border-radius:6px;cursor:pointer;font-size:12px;font-weight:600;display:inline-flex;align-items:center;gap:6px;transition:background 0.15s ease;">
                  <span>▶</span> <span>Resume & Open Tab</span>
                </button>
              `;
              currentCoworkBubble.appendChild(pauseBanner);
              setTimeout(() => {
                document.getElementById(pauseCardId)?.addEventListener('click', () => {
                  sendPortMessage({ type: 'resume_cowork_task' });
                  pauseBanner.remove();
                });
              }, 50);
            }
          }
          scrollToBottom(true);
        }
        break;

      case 'session_title':
        if (msg.sessionId === currentSessionId && msg.title) {
          showTitleSuggestionBanner(msg.title);
        }
        pendingTitleSessions.delete(msg.sessionId);
        break;

      case 'session_title_failed':
        if (msg.sessionId === currentSessionId) {
          const fallbackTitle = generateSmartTitle(lastUserPrompt, '');
          if (fallbackTitle && fallbackTitle !== 'New Chat') showTitleSuggestionBanner(fallbackTitle);
        }
        pendingTitleSessions.delete(msg.sessionId);
        break;

      case 'bridge_status':
        updateBridgeStatus(msg.online);
        if (msg.online && msg.outdated && !window.__bridgeOutdatedWarned) {
          window.__bridgeOutdatedWarned = true;
          showToast('Your Bridge is running old code. Close it and open it again (or run Actualizar-AntigravityBridge).');
        }
        break;

      case 'quota_update':
        break;

      case 'external_user_message':
        if (msg.sessionId && msg.sessionId !== currentSessionId) break;
        createMessageRow('user', msg.text || '');
        break;

      case 'agent_permission_request':
        if (msg.sessionId && msg.sessionId !== currentSessionId) break;
        showAgentPermissionCard(msg);
        break;

      case 'task_start':
        isGenerating = true;
        currentTaskId = msg.taskId;
        toggleInputState(true);
        hideLiveActivity();
        if (msg.mode === 'chat') {
          if (!currentStreamingBubble) {
            currentStreamingText = '';
            currentStreamingBubble = createMessageRow('assistant', '');
            if (currentStreamingBubble) {
              currentStreamingBubble.innerHTML = renderThinkingBubbleHtml('Thinking and analyzing screen...');
            }
          }
        } else if (msg.mode === 'cowork') {
          if (!currentCoworkBubble) {
            currentPlanData = null;
            currentIntroText = '';
            currentCoworkBubble = createMessageRow('assistant', '', null, null, null, '');
            if (currentCoworkBubble) {
              currentCoworkBubble.innerHTML = renderThinkingBubbleHtml('Analyzing page...');
            }
          }
        }
        scrollToBottom();
        break;

      case 'stream_chunk':
        if (msg.sessionId && msg.sessionId !== currentSessionId) {
          break;
        }
        if (!currentStreamingBubble) {
          currentStreamingBubble = createMessageRow('assistant', '');
        }
        if (currentStreamingBubble) {
          currentStreamingText = msg.fullAnswer;
          if (!currentStreamingText || currentStreamingText.trim() === '') {
            currentStreamingBubble.innerHTML = renderThinkingBubbleHtml('Thinking and analyzing screen...');
          } else {
            currentStreamingBubble.innerHTML = renderMarkdown(currentStreamingText, true);
            mountAllApprovalCards(currentStreamingBubble);
            updateContextMeter();
          }
          scrollToBottom();
        }
        break;

      case 'cowork_plan_created':
        if (msg.sessionId && msg.sessionId !== currentSessionId) {
          break;
        }
        currentPlanData = msg.plan;
        if (msg.intro) {
          currentIntroText = msg.intro;
        }
        if (currentCoworkBubble) {
          const introHtml = currentIntroText ? `<div class="cowork-intro-phrase">${renderMarkdown(currentIntroText, false)}</div>` : '';
          const planHtml = renderAgentPlanningHtml(currentPlanData, true);
          currentCoworkBubble.innerHTML = introHtml + planHtml;
          mountAllApprovalCards(currentCoworkBubble);
          updateContextMeter();
        } else {
          currentCoworkBubble = createMessageRow('assistant', '', null, null, currentPlanData, currentIntroText);
        }
        scrollToBottom();
        break;

      case 'cowork_plan_update':
        if (msg.sessionId && msg.sessionId !== currentSessionId) {
          break;
        }
        if (msg.plan) {
          currentPlanData = msg.plan;
          if (msg.intro) {
            currentIntroText = msg.intro;
          }
          if (!currentCoworkBubble) {
            currentCoworkBubble = createMessageRow('assistant', '', null, null, currentPlanData, currentIntroText);
          } else {
            const planContainer = currentCoworkBubble.querySelector('.agent-planning-container');
            if (planContainer) {
              const temp = document.createElement('div');
              temp.innerHTML = renderAgentPlanningHtml(currentPlanData, true);
              const newElem = temp.firstElementChild;
              if (newElem) {
                planContainer.replaceWith(newElem);
              }
            } else {
              const introHtml = currentIntroText ? `<div class="cowork-intro-phrase">${renderMarkdown(currentIntroText, false)}</div>` : '';
              const planHtml = renderAgentPlanningHtml(currentPlanData, true);
              currentCoworkBubble.innerHTML = introHtml + planHtml;
            }
          }
          mountAllApprovalCards(currentCoworkBubble);
          updateContextMeter();
        }
        break;

      case 'task_complete':
        if (msg.taskId === currentTaskId) {
          isGenerating = false;
          currentTaskId = null;
          toggleInputState(false);
          hideLiveActivity();
        }

        if (msg.sessionId && msg.sessionId !== currentSessionId) {
          // Task completed in another background session, saved by background worker
          break;
        }

        if (msg.mode === 'chat' && currentStreamingBubble) {
          currentStreamingBubble.innerHTML = renderMarkdown(msg.fullAnswer, false);
          mountAllApprovalCards(currentStreamingBubble);
          appendStreamingResponseBar(currentStreamingBubble, msg.fullAnswer, lastSearchSources);
          updateContextMeter();
          currentStreamingBubble = null;
        } else if (msg.mode === 'chat' && msg.fullAnswer && msg.fullAnswer.trim()) {
          // No stream chunk created a bubble (e.g. the provider answered in a single piece): render it now
          const answerRow = createMessageRow('assistant', msg.fullAnswer);
          if (answerRow) {
            appendStreamingResponseBar(answerRow, msg.fullAnswer, lastSearchSources);
            updateContextMeter();
          }
        } else if (msg.mode === 'cowork') {
          const finalPlan = msg.plan || currentPlanData || convertLegacyStepsToPlan(msg.steps);
          const reportMd = msg.summary || 'Goal achieved.';
          const finalIntro = msg.intro || currentIntroText;
          const introHtml = finalIntro ? `<div class="cowork-intro-phrase">${renderMarkdown(finalIntro, false)}</div>` : '';
          if (currentCoworkBubble) {
            const planHtml = renderAgentPlanningHtml(finalPlan, false);
            const reportHtml = `<div class="cowork-report-container">${renderMarkdown(reportMd, false)}</div>`;
            currentCoworkBubble.innerHTML = introHtml + planHtml + reportHtml;
            mountAllApprovalCards(currentCoworkBubble);
            appendStreamingResponseBar(currentCoworkBubble, reportMd, lastSearchSources);
            updateContextMeter();
            currentCoworkBubble = null;
            currentPlanData = null;
            currentIntroText = '';
          } else {
            createMessageRow('assistant', reportMd, null, msg.steps, finalPlan, finalIntro);
          }
        }
        renderAiPromptSuggestions(msg.fullAnswer || msg.summary || lastUserPrompt);
        if (localStorage.getItem(PIPER_AUTO_KEY) === '1' && (msg.mode === 'chat' || msg.mode === 'cowork')) {
          speakText(msg.fullAnswer || msg.summary || '');
        }
        scrollToBottom();
        handleAutoNamingAfterTask(msg.fullAnswer || msg.summary || '');
        break;

      case 'cowork_step_start':
        if (msg.sessionId && msg.sessionId !== currentSessionId) break;
        showLiveActivity(`⚡ Step ${msg.stepNumber}: ${msg.status || 'Analyzing elements...'}`);
        break;

      case 'cowork_step_action':
        if (msg.sessionId && msg.sessionId !== currentSessionId) break;
        showLiveActivity(`⚡ Step ${msg.stepNumber}: [${(msg.plan?.action || '').toUpperCase()}] ${msg.plan?.description || ''}`);
        break;

      case 'task_aborted':
        if (msg.taskId === currentTaskId) {
          isGenerating = false;
          currentTaskId = null;
          toggleInputState(false);
          hideLiveActivity();
        }
        if (msg.sessionId && msg.sessionId !== currentSessionId) break;
        if (currentStreamingBubble) {
          currentStreamingBubble.innerHTML = currentStreamingText ? renderMarkdown(currentStreamingText, false) : '*[Generation cancelled]*';
          currentStreamingBubble = null;
        }
        if (currentCoworkBubble) {
          const finalIntro = msg.intro || currentIntroText;
          const introHtml = finalIntro ? `<div class="cowork-intro-phrase">${renderMarkdown(finalIntro, false)}</div>` : '';
          const planHtml = currentPlanData ? renderAgentPlanningHtml(currentPlanData, false) : '';
          currentCoworkBubble.innerHTML = introHtml + planHtml + `<div class="cowork-report-container">*[Generation cancelled]*</div>`;
          currentCoworkBubble = null;
          currentPlanData = null;
          currentIntroText = '';
        } else {
          createMessageRow('assistant', '*[Generation cancelled]*');
        }
        break;

      case 'task_error':
        if (msg.taskId === currentTaskId) {
          isGenerating = false;
          currentTaskId = null;
          toggleInputState(false);
          hideLiveActivity();
        }
        if (msg.sessionId && msg.sessionId !== currentSessionId) break;
        const errorCardHtml = createAiErrorCard(msg.error || 'Unexpected error occurred.');
        if (currentStreamingBubble) {
          currentStreamingBubble.innerHTML = errorCardHtml;
          attachErrorCardRetryListener(currentStreamingBubble);
          currentStreamingBubble = null;
        } else if (currentCoworkBubble) {
          const planHtml = renderAgentPlanningHtml(currentPlanData, false);
          currentCoworkBubble.innerHTML = planHtml + `<div class="cowork-report-container">${errorCardHtml}</div>`;
          attachErrorCardRetryListener(currentCoworkBubble);
          currentCoworkBubble = null;
          currentPlanData = null;
        } else {
          const errRow = createMessageRow('assistant', errorCardHtml);
          if (errRow) attachErrorCardRetryListener(errRow);
        }
        scrollToBottom();
        break;

      case 'cowork_task_paused':
        if (msg.sessionId && msg.sessionId !== currentSessionId) break;
        showLiveActivity('⏸ Task paused');
        showToast('⏸ Session paused (linked tab closed or user pause)');
        if (currentCoworkBubble) {
          const pauseCardId = 'resume-btn-' + Date.now();
          const pauseBanner = document.createElement('div');
          pauseBanner.className = 'session-paused-banner';
          pauseBanner.style.cssText = 'margin:12px 0;padding:12px 14px;background:rgba(234,179,8,0.12);border:1px solid rgba(234,179,8,0.35);border-radius:10px;color:#fef08a;font-size:12.5px;';
          pauseBanner.innerHTML = `
            <div style="font-weight:600;margin-bottom:4px;display:flex;align-items:center;gap:6px;">
              <span>⏸</span> <span>Session Paused</span>
            </div>
            <div style="color:#d1d5db;font-size:12px;margin-bottom:10px;line-height:1.4;">
              ${msg.reason === 'tab_closed' ? 'The linked work tab was closed.' : 'Execution has been paused.'}
              ${msg.savedUrl ? `<br>Saved URL: <a href="${escapeHtml(msg.savedUrl)}" target="_blank" style="color:#38bdf8;word-break:break-all;">${escapeHtml(msg.savedUrl)}</a>` : ''}
            </div>
            <button type="button" id="${pauseCardId}" style="background:#0284c7;color:#ffffff;border:none;padding:6px 14px;border-radius:6px;cursor:pointer;font-size:12px;font-weight:600;display:inline-flex;align-items:center;gap:6px;transition:background 0.15s ease;">
              <span>▶</span> <span>Resume & Open Tab</span>
            </button>
          `;
          currentCoworkBubble.appendChild(pauseBanner);
          setTimeout(() => {
            document.getElementById(pauseCardId)?.addEventListener('click', () => {
              sendPortMessage({ type: 'resume_cowork_task' });
              pauseBanner.remove();
            });
          }, 50);
        }
        break;

      case 'cowork_task_resumed':
        showLiveActivity('⚡ Task resumed');
        showToast('▶ Session resumed in active tab');
        break;

      case 'user_intervention_received':
        showLiveActivity(`✍ Instruction: "${(msg.text || '').slice(0, 30)}..."`);
        break;

      case 'page_fragment_picked':
        isPickingFragment = false;
        if (msg.text) {
          addAttachedItem({
            type: 'fragment',
            name: `Page: ${(msg.element || 'Element').slice(0, 30)}`,
            content: `Fragment captured from ${msg.url || ''}\nElement: ${msg.element || ''}\n\n${msg.text}`,
          });
          showToast('Page element captured and attached as context');
          promptInput.focus();
        }
        break;

      case 'page_picker_cancelled':
        isPickingFragment = false;
        showToast('Element picker cancelled');
        break;

      case 'preset_prompt':
        if (msg.selectedText || (msg.text && msg.text.includes('Respecto a este fragmento'))) {
          const selText = msg.selectedText || msg.text.replace(/^Respecto a este fragmento seleccionado:\s*"?/, '').replace(/"?\s*$/, '').trim();
          const previewName = selText.length > 25 ? selText.slice(0, 22) + '...' : selText;
          addAttachedItem({
            type: 'fragment',
            name: `Selección: "${previewName}"`,
            content: `Texto seleccionado de ${msg.title || msg.url || 'la página'}:\nURL: ${msg.url || ''}\n\n"${selText}"`,
            url: msg.url,
            title: msg.title,
          });
          promptInput.value = '';
          promptInput.placeholder = 'Haz una pregunta sobre el texto seleccionado...';
          promptInput.focus();
          handleInputStateChange();
          showToast('Texto seleccionado adjuntado como contexto');
        } else if (msg.text) {
          promptInput.value = msg.text;
          promptInput.focus();
          handleInputStateChange();
        }
        if (promptBeamContainer) {
          promptBeamContainer.style.filter = 'drop-shadow(0 0 8px rgba(56, 189, 248, 0.6))';
          setTimeout(() => {
            promptBeamContainer.style.filter = '';
          }, 1800);
        }
        break;

      case 'close_side_panel':
        window.close();
        break;
    }
  }

  // ─── Bridge Status ──────────────────────────────────────────────────────────
  function updateBridgeStatus(isOnline) {
    // Discreet background bridge status monitoring
  }

  // ─── Model Picker Popover Logic (Hierarchical Rail: Gemini, Claude, ChatGPT) ──
  // ─── Model Helper Functions & Resolution ────────────────────────────────────
  function getCurrentModelObject() {
    for (const pKey of Object.keys(PROVIDER_DATA)) {
      const m = PROVIDER_DATA[pKey].models.find((item) => item.id === currentBaseModelId);
      if (m) return m;
    }
    return PROVIDER_DATA.gemini.models[0];
  }

  function resolveAntigravityModelId(baseModelId, effort) {
    if (baseModelId === 'gemini-3.8-flash') {
      if (effort === 'low') return 'gemini-3.8-flash-low';
      if (effort === 'high') return 'gemini-3.8-flash-high';
      return 'gemini-3.8-flash-medium';
    }
    if (baseModelId === 'gemini-3.7-flash') {
      if (effort === 'low') return 'gemini-3.7-flash-low';
      if (effort === 'high') return 'gemini-3.7-flash-high';
      return 'gemini-3.7-flash-medium';
    }
    if (baseModelId === 'gemini-3.6-flash') {
      if (effort === 'low') return 'gemini-3.6-flash-low';
      if (effort === 'high') return 'gemini-3.6-flash-high';
      return 'gemini-3.6-flash-medium';
    }
    if (baseModelId === 'gemini-3.1-pro') {
      if (effort === 'low') return 'gemini-3.1-pro-low';
      return 'gemini-3.1-pro-high';
    }
    if (baseModelId === 'claude-sonnet-5-5') {
      return 'claude-sonnet-5-5';
    }
    if (baseModelId === 'claude-opus-5-5') {
      return 'claude-opus-5-5';
    }
    if (baseModelId === 'claude-fable-5-1') {
      return 'claude-fable-5-1';
    }
    if (baseModelId === 'claude-haiku-4-5') {
      return 'claude-haiku-4-5';
    }
    if (baseModelId === 'gpt-6-astra') {
      return 'gpt-6-astra';
    }
    if (baseModelId === 'gpt-6-sol') {
      return 'gpt-6-sol';
    }
    if (baseModelId === 'gpt-6-luna') {
      return 'gpt-6-luna';
    }
    if (baseModelId === 'gpt-5-6-terra') {
      return 'gpt-5-6-terra';
    }
    if (baseModelId === 'gpt-5-6-sol' || baseModelId === 'gpt-6') {
      return 'gpt-5-6-sol';
    }
    if (baseModelId === 'gpt-5-6-luna' || baseModelId === 'gpt-5-6') {
      return 'gpt-5-6-luna';
    }
    if (baseModelId === 'gpt-oss-120b-medium') {
      return 'gpt-oss-120b-medium';
    }
    for (const pKey of Object.keys(PROVIDER_DATA)) {
      const dyn = PROVIDER_DATA[pKey].models.find((x) => x.id === baseModelId);
      if (dyn && dyn.variants && dyn.variants[effort]) return dyn.variants[effort];
    }
    return baseModelId;
  }

  function findModelByAnyId(modelId) {
    if (!modelId) return null;
    const clean = modelId.toLowerCase().trim();

    // Check direct base ID match
    for (const pKey of Object.keys(PROVIDER_DATA)) {
      const p = PROVIDER_DATA[pKey];
      const m = p.models.find((item) => String(item.id).toLowerCase() === clean);
      if (m) {
        return { model: m, provider: p, effort: m.defaultThinking || 'medium' };
      }
    }

    // Check external providers models
    for (const extP of externalProviders) {
      const m = (extP.models || []).find((item) => String(item.id).toLowerCase() === clean);
      if (m) {
        const provObj = PROVIDER_DATA[extP.id] || {
          id: extP.id,
          name: extP.name,
          iconSvg: extP.iconUrl ? `<img src="${escapeHtml(extP.iconUrl)}" style="width:16px;height:16px;object-fit:contain;border-radius:4px;">` : '',
          isExternal: true,
          models: extP.models || [],
        };
        return { model: m, provider: provObj, effort: 'medium' };
      }
    }

    // Check Gemini 3.8 Flash variants
    if (clean.includes('3.8') && clean.includes('flash')) {
      const p = PROVIDER_DATA.gemini;
      const m = p.models.find((x) => x.id === 'gemini-3.8-flash');
      let effort = 'medium';
      if (clean.endsWith('-low') || clean.includes('low')) effort = 'low';
      else if (clean.endsWith('-high') || clean.includes('high')) effort = 'high';
      return { model: m, provider: p, effort };
    }

    // Check Gemini 3.7 Flash variants
    if (clean.includes('3.7') && clean.includes('flash')) {
      const p = PROVIDER_DATA.gemini;
      const m = p.models.find((x) => x.id === 'gemini-3.7-flash');
      let effort = 'medium';
      if (clean.endsWith('-low') || clean.includes('low')) effort = 'low';
      else if (clean.endsWith('-high') || clean.includes('high')) effort = 'high';
      return { model: m, provider: p, effort };
    }

    // Check Gemini 3.6 Flash variants
    if (clean.includes('3.6') && clean.includes('flash')) {
      const p = PROVIDER_DATA.gemini;
      const m = p.models.find((x) => x.id === 'gemini-3.6-flash');
      let effort = 'medium';
      if (clean.endsWith('-low') || clean.includes('low')) effort = 'low';
      else if (clean.endsWith('-high') || clean.includes('high')) effort = 'high';
      return { model: m, provider: p, effort };
    }

    // Check generic flash
    if (clean.includes('flash')) {
      const p = PROVIDER_DATA.gemini;
      const m = p.models.find((x) => x.id === 'gemini-3.8-flash');
      let effort = clean.includes('low') ? 'low' : clean.includes('high') ? 'high' : 'medium';
      return { model: m, provider: p, effort };
    }

    // Check Gemini 3.1 Pro variants
    if (clean.includes('pro') || clean.startsWith('gemini-3.1-pro')) {
      const p = PROVIDER_DATA.gemini;
      const m = p.models.find((x) => x.id === 'gemini-3.1-pro');
      let effort = clean.includes('low') ? 'low' : 'high';
      return { model: m, provider: p, effort };
    }

    // Check Claude Sonnet (5.5; older ids resolve to it)
    if (clean.includes('sonnet')) {
      const p = PROVIDER_DATA.claude;
      const m = p.models.find((x) => x.id === 'claude-sonnet-5-5') || p.models[0];
      return { model: m, provider: p, effort: m.defaultThinking || 'high' };
    }

    // Check Claude Opus (5.5; older ids resolve to it)
    if (clean.includes('opus')) {
      const p = PROVIDER_DATA.claude;
      const m = p.models.find((x) => x.id === 'claude-opus-5-5') || p.models[1];
      return { model: m, provider: p, effort: m.defaultThinking || 'high' };
    }

    // Check Claude Fable 5.1
    if (clean.includes('fable')) {
      const p = PROVIDER_DATA.claude;
      const m = p.models.find((x) => x.id === 'claude-fable-5-1') || p.models[2];
      return { model: m, provider: p, effort: m.defaultThinking || 'medium' };
    }

    // Check Claude Haiku 4.5
    if (clean.includes('haiku')) {
      const p = PROVIDER_DATA.claude;
      const m = p.models.find((x) => x.id === 'claude-haiku-4-5') || p.models[3];
      return { model: m, provider: p, effort: m.defaultThinking || 'fast' };
    }

    // Check GPT-6 Astra
    if (clean.includes('astra')) {
      const p = PROVIDER_DATA.chatgpt;
      const m = p.models.find((x) => x.id === 'gpt-6-astra') || p.models[0];
      return { model: m, provider: p, effort: m.defaultThinking || 'high' };
    }

    // Check GPT-6 Sol
    if ((clean.includes('gpt-6') || clean.includes('6')) && clean.includes('sol')) {
      const p = PROVIDER_DATA.chatgpt;
      const m = p.models.find((x) => x.id === 'gpt-6-sol') || p.models[1];
      return { model: m, provider: p, effort: m.defaultThinking || 'medium' };
    }

    // Check GPT-6 Luna
    if ((clean.includes('gpt-6') || clean.includes('6')) && clean.includes('luna')) {
      const p = PROVIDER_DATA.chatgpt;
      const m = p.models.find((x) => x.id === 'gpt-6-luna') || p.models[2];
      return { model: m, provider: p, effort: m.defaultThinking || 'high' };
    }

    // Check GPT-5.6 Terra
    if (clean.includes('terra')) {
      const p = PROVIDER_DATA.chatgpt;
      const m = p.models.find((x) => x.id === 'gpt-5-6-terra') || p.models[3];
      return { model: m, provider: p, effort: m.defaultThinking || 'medium' };
    }

    // Check GPT-5.6 Sol (or legacy gpt-6 alias)
    if (clean.includes('sol') || clean === 'gpt-6') {
      const p = PROVIDER_DATA.chatgpt;
      const m = p.models.find((x) => x.id === 'gpt-5-6-sol') || p.models[4];
      return { model: m, provider: p, effort: m.defaultThinking || 'medium' };
    }

    // Check GPT-5.6 Luna (or legacy gpt-5-6 alias)
    if (clean.includes('luna') || clean === 'gpt-5-6' || clean.includes('5.6') || clean.includes('5-6') || clean.includes('gpt-5')) {
      const p = PROVIDER_DATA.chatgpt;
      const m = p.models.find((x) => x.id === 'gpt-5-6-luna') || p.models[5];
      return { model: m, provider: p, effort: m.defaultThinking || 'high' };
    }

    // Check GPT-OSS / GPT-SS
    if (clean.includes('oss') || clean.includes('120b') || clean.includes('gpt-ss') || clean.includes('chatgpt')) {
      const p = PROVIDER_DATA.chatgpt;
      const m = p.models.find((x) => x.id === 'gpt-oss-120b-medium') || p.models[6];
      let effort = clean.includes('low') ? 'low' : 'medium';
      return { model: m, provider: p, effort };
    }

    return {
      model: PROVIDER_DATA.gemini.models[0],
      provider: PROVIDER_DATA.gemini,
      effort: 'medium',
    };
  }

  // ─── Thinking & Reasoning Configuration (Single source of truth in ModelPreviewPanel) ─
  function updateThinkingEffort(effort) {
    currentThinkingEffort = effort;
    currentModel = resolveAntigravityModelId(currentBaseModelId, currentThinkingEffort);

    const currentModelObj = getCurrentModelObject();
    if (currentModelObj && selectedModelLabel) {
      if (currentModelObj.isExternal) {
        selectedModelLabel.textContent = currentModelObj.name;
      } else {
        const effortTitle = effort === 'fast'
          ? 'Fast'
          : (effort === 'x-high'
            ? 'Extra'
            : (effort === 'thinking' ? 'Thinking' : (effort === 'max' ? 'Max' : effort.charAt(0).toUpperCase() + effort.slice(1))));
        selectedModelLabel.textContent = `${currentModelObj.name} (${effortTitle})`;
      }
    }

    chrome.storage.local.set({
      antigravity_base_model: currentBaseModelId,
      antigravity_thinking_effort: currentThinkingEffort,
      antigravity_default_model: currentModel,
    });
    renderReasoningSlider();
  }

  // ─── Simple & Robust Model Recognition Engine ──────────────────────────────
  function recognizeModel(modelId) {
    const raw = String(modelId || '').trim();
    const lower = raw.toLowerCase();

    let baseId = raw;
    let effort = null;
    if (lower.endsWith('-high')) {
      baseId = raw.slice(0, -5);
      effort = 'high';
    } else if (lower.endsWith('-medium')) {
      baseId = raw.slice(0, -7);
      effort = 'medium';
    } else if (lower.endsWith('-low')) {
      baseId = raw.slice(0, -4);
      effort = 'low';
    } else if (lower.endsWith('-thinking')) {
      baseId = raw.slice(0, -9);
      effort = 'medium';
    }

    const baseLower = baseId.toLowerCase();
    let provider = 'gemini';
    let providerName = 'Google Gemini / Antigravity';

    if (baseLower.includes('claude') || baseLower.includes('sonnet') || baseLower.includes('opus') || baseLower.includes('haiku') || baseLower.includes('fable')) {
      provider = 'claude';
      providerName = 'Anthropic Claude';
    } else if (baseLower.includes('gpt') || baseLower.includes('codex') || baseLower.includes('o1') || baseLower.includes('o3') || baseLower.includes('o4') || baseLower.includes('davinci')) {
      provider = 'openai';
      providerName = 'OpenAI';
    }

    let thinkingType = 'none';
    let isReasoningModel = false;
    let supportsTemperature = true;

    if (provider === 'claude') {
      if (baseLower.includes('3-7') || baseLower.includes('3.7')) {
        thinkingType = 'budget';
        isReasoningModel = true;
        supportsTemperature = true;
      } else if (
        baseLower.includes('5-5') || baseLower.includes('5.5') ||
        baseLower.includes('4-6') || baseLower.includes('4.6') ||
        baseLower.includes('4-7') || baseLower.includes('4.7') ||
        baseLower.includes('opus') || baseLower.includes('sonnet') ||
        baseLower.includes('fable') || baseLower.includes('haiku')
      ) {
        if (baseLower.includes('3-5') || baseLower.includes('3.5')) {
          thinkingType = 'none';
          isReasoningModel = false;
        } else {
          thinkingType = 'adaptive';
          isReasoningModel = true;
          supportsTemperature = false;
        }
      }
    } else if (provider === 'openai') {
      if (baseLower.startsWith('o1') || baseLower.startsWith('o3') || baseLower.startsWith('o4') || baseLower.includes('gpt-5')) {
        thinkingType = 'reasoning_effort';
        isReasoningModel = true;
        supportsTemperature = false;
      } else {
        thinkingType = 'none';
        isReasoningModel = false;
        supportsTemperature = true;
      }
    } else {
      if (baseLower.includes('3.8') || baseLower.includes('3.7') || baseLower.includes('3.6') || baseLower.includes('3.1')) {
        thinkingType = 'budget';
        isReasoningModel = true;
        supportsTemperature = true;
      }
    }

    return {
      rawId: raw,
      baseId,
      provider,
      providerName,
      isReasoningModel,
      thinkingType,
      effort: effort || 'medium',
      supportsTemperature,
    };
  }

  function isClaudeModel(modelId) {
    if (!modelId) return false;
    return recognizeModel(modelId).provider === 'claude';
  }

  function isOpenAIModel(modelId) {
    if (!modelId) return false;
    return recognizeModel(modelId).provider === 'openai';
  }

  function updateDynamicBranding(modelId) {
    let isClaude = activeModelTab === 'claude' || isClaudeModel(modelId);
    let isOpenAI = activeModelTab === 'openai' || (!isClaude && isOpenAIModel(modelId));
    let isAntigravity = activeModelTab === 'antigravity' || (!isClaude && !isOpenAI);

    if (activeModelTab === 'claude') {
      isClaude = true;
      isOpenAI = false;
      isAntigravity = false;
    } else if (activeModelTab === 'openai') {
      isClaude = false;
      isOpenAI = true;
      isAntigravity = false;
    } else if (activeModelTab === 'antigravity') {
      isClaude = false;
      isOpenAI = false;
      isAntigravity = true;
    }

    // 1. Welcome hero avatar & title
    const welcomeAvatarImg = document.getElementById('welcomeAvatarImg');
    const welcomeHeading = document.getElementById('welcomeHeading');
    if (welcomeAvatarImg) {
      if (isClaude) {
        welcomeAvatarImg.src = '../assets/claude-logo.png';
        welcomeAvatarImg.alt = 'Claude';
      } else if (isOpenAI) {
        welcomeAvatarImg.src = '../assets/chatgpt-logo.svg';
        welcomeAvatarImg.alt = 'ChatGPT';
      } else {
        welcomeAvatarImg.src = '../assets/antigravity-logo.png';
        welcomeAvatarImg.alt = 'Antigravity';
      }
    }
    if (welcomeHeading) {
      welcomeHeading.textContent = isClaude 
        ? 'How can Claude help you today?' 
        : (isOpenAI ? 'How can ChatGPT help you today?' : 'How can Antigravity help you today?');
    }

    // 2. Input placeholder (when not in Cowork mode)
    if (!isCoworkActive && promptInput) {
      promptInput.placeholder = isClaude 
        ? 'Send a message to Claude...' 
        : (isOpenAI ? 'Send a message to ChatGPT...' : 'Send a message to Antigravity...');
    }

    // 3. Top Trigger Icon in Header (shows active provider)
    const trigIcon = document.getElementById('modelTriggerIcon');
    if (trigIcon) {
      if (isOpenAI) {
        trigIcon.innerHTML = `<img src="../assets/chatgpt-icon-32.png" width="16" height="16" style="object-fit:contain;vertical-align:middle;" alt="ChatGPT">`;
      } else if (isClaude) {
        trigIcon.innerHTML = `<img src="../assets/claude-icon-32.png" width="16" height="16" style="object-fit:contain;vertical-align:middle;" alt="Claude">`;
      } else {
        trigIcon.innerHTML = `<img src="../assets/antigravity-icon-32.png" width="16" height="16" style="object-fit:contain;vertical-align:middle;" alt="Antigravity">`;
      }
    }

    // 4. Document title & Favicon
    try {
      if (isClaude) {
        document.title = 'Claude - Autono';
      } else if (isOpenAI) {
        document.title = 'ChatGPT - Autono';
      } else {
        document.title = 'Antigravity - Autono';
      }
      let linkFavicon = document.querySelector("link[rel*='icon']");
      if (!linkFavicon) {
        linkFavicon = document.createElement('link');
        linkFavicon.rel = 'icon';
        document.head.appendChild(linkFavicon);
      }
      linkFavicon.href = isClaude 
        ? '../assets/claude-icon-32.png' 
        : (isOpenAI ? '../assets/chatgpt-icon-32.png' : '../assets/antigravity-icon-32.png');
    } catch (_) {}

    // 5. Extension Action Icon in Chrome toolbar
    try {
      if (chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage({
          type: 'update_extension_icon',
          model: isOpenAI ? 'gpt' : (isClaude ? 'claude' : 'antigravity')
        }).catch(() => null);
      }
    } catch (_) {}
  }

  // ─── Model Picker Popover Logic (Hierarchical Rail: Gemini, Claude, OpenAI) ───
  function selectModel(modelId, preserveEffort = false, route = null) {
    let match = findModelByAnyId(modelId);
    if (!match || !match.model) {
      const latest = findLatestModelInFamily(modelId);
      match = latest ? findModelByAnyId(latest.id) : null;
    }
    if (!match || !match.model) return;

    const { model, provider, effort } = match;
    if (model.dynamicSource === 'gemini') setAntigravityModeQuiet('api');
    if (!preserveEffort && currentBaseModelId !== model.id) setReasoningChosen(false);
    currentBaseModelId = model.id;
    activeProvider = provider.id;

    if (!preserveEffort && effort && model.thinking && model.thinking.includes(effort)) {
      currentThinkingEffort = effort;
    } else if (model.thinking && !model.thinking.includes(currentThinkingEffort)) {
      currentThinkingEffort = model.defaultThinking || model.thinking[0];
    }

    currentModel = resolveAntigravityModelId(currentBaseModelId, currentThinkingEffort);

    // Update category tab & rail active state
    const routeFits = (r) => r === 'antigravity'
      || (r === 'claude' && isClaudeModel(model.id))
      || (r === 'openai' && !isClaudeModel(model.id) && isOpenAIModel(model.id));
    const wantedRoute = route || modelRoute;
    if (wantedRoute && routeFits(wantedRoute)) {
      activeModelTab = wantedRoute;
    } else if (isClaudeModel(model.id)) {
      activeModelTab = 'claude';
    } else if (model.id === 'gpt-oss-120b-medium') {
      if (model.usageGroup === 'gemini' || activeModelTab === 'antigravity') {
        activeModelTab = 'antigravity';
      } else {
        activeModelTab = 'openai';
      }
    } else if (isOpenAIModel(model.id)) {
      activeModelTab = 'openai';
    } else {
      activeModelTab = 'antigravity';
    }
    modelRoute = activeModelTab;
    try { localStorage.setItem('antigravity_model_route', modelRoute); } catch (_) {}
    updatePickerTabsUI();

    document.querySelectorAll('.picker-rail .rail-btn').forEach((b) => {
      b.classList.toggle('active', b.getAttribute('data-provider') === activeProvider);
    });

    // Update provider label in picker
    const provLabel = document.getElementById('pickerProviderLabel');
    if (provLabel) {
      if (activeModelTab === 'claude') {
        provLabel.textContent = 'Claude (Anthropic)';
      } else if (activeModelTab === 'openai') {
        provLabel.textContent = 'OpenAI (GPT-6 & GPT-5.6)';
      } else {
        provLabel.textContent = 'Antigravity (Google Gemini)';
      }
    }

    // Update dynamic branding (Header icon, Welcome hero avatar, heading, placeholder, extension icon, title)
    updateDynamicBranding(model.id);

    // Update trigger label
    if (selectedModelLabel) {
      if (model.isExternal) {
        selectedModelLabel.textContent = model.name;
      } else {
        const effortTitle = currentThinkingEffort === 'fast'
          ? 'Fast'
          : (currentThinkingEffort === 'x-high'
            ? 'Extra'
            : (currentThinkingEffort === 'thinking' ? 'Thinking' : (currentThinkingEffort === 'max' ? 'Max' : currentThinkingEffort.charAt(0).toUpperCase() + currentThinkingEffort.slice(1))));
        selectedModelLabel.textContent = `${model.name} (${effortTitle})`;
      }
    }

    // Update dynamic branding (Welcome hero avatar, heading, placeholder, extension icon)
    updateDynamicBranding(model.id);

    // Re-render rows to update selection highlight and specs
    renderModelPickerRows(modelSearchInput.value);

    // Render preview panel for the selected model
    renderModelPreviewPanel(model, currentThinkingEffort);
    renderReasoningSlider();
    updateProviderButton();

    // Persist
    chrome.storage.local.set({
      antigravity_base_model: currentBaseModelId,
      antigravity_thinking_effort: currentThinkingEffort,
      antigravity_default_model: currentModel,
    });

    // Popover remains open so the user sees the specs and can select thinking with 1 click
  }

  // ─── SVG Capability Icons (Replacing Emojis) ─────────────────────────────────
  const SVG_CAPS = {
    reasoning: `<span class="cap-chip cap-reasoning" title="Razonamiento">
      <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z"/>
        <path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z"/>
        <path d="M12 3v18"/>
      </svg>
    </span>`,
    image: `<span class="cap-chip cap-vision" title="Visión">
      <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect width="18" height="18" x="3" y="3" rx="2" ry="2"/>
        <circle cx="9" cy="9" r="2"/>
        <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
      </svg>
    </span>`,
  };

  const REASONING_INTELLIGENCE_DELTA = {
    fast: 0,
    low: -1,
    medium: 0,
    thinking: 1,
    high: 1,
    'x-high': 2,
    max: 2,
  };

  function getMetricColor(value, invert = false) {
    const score = invert ? (11 - value) : value;
    if (score >= 8) return '#30a46c'; // green-9
    if (score >= 6) return '#46a758'; // grass-9
    if (score >= 4) return '#f76b15'; // orange-9
    return '#e5484d'; // red-9
  }

  function clampMetric(val) {
    return Math.min(10, Math.max(1, Math.round(val)));
  }

  function renderMetricBarHtml(label, value, info = '', invert = false) {
    const clampedVal = clampMetric(value);
    const color = getMetricColor(clampedVal, invert);
    let segments = '';
    for (let i = 0; i < 10; i++) {
      const isFilled = i < clampedVal;
      const delay = i * 25;
      segments += `
        <div class="metric-segment-slot">
          ${isFilled ? `<div class="grow-segment" style="background-color: ${color}; transition-delay: ${delay}ms;"></div>` : ''}
        </div>
      `;
    }
    return `
      <div class="metric-bar-group">
        <div class="metric-bar-header">
          <span class="metric-bar-label">${label}</span>
          ${info ? `<span class="metric-bar-info" title="${escapeHtml(info)}">&#9432;</span>` : ''}
        </div>
        <div class="metric-bar-grid">
          ${segments}
        </div>
      </div>
    `;
  }

  function renderModelPreviewPanel(model, effort = currentThinkingEffort) {
    const previewCard = document.getElementById('modelPreviewCard');
    if (!previewCard || !model) return;

    if (model.isExternal) {
      // Clean, simplified preview panel for external 3rd-party models
      const provName = model.providerName || (PROVIDER_DATA[model.providerId]?.name) || 'External Provider';
      previewCard.innerHTML = `
        <div class="preview-panel-content">
          <div class="preview-header">
            <div class="preview-title-row">
              <span class="preview-model-name">${escapeHtml(model.name)}</span>
              <span class="preview-provider-tag" style="background:rgba(56,189,248,0.15);color:#38bdf8;border:1px solid rgba(56,189,248,0.3);">${escapeHtml(provName)}</span>
            </div>
            <p class="preview-model-desc">${escapeHtml(model.desc || 'Third-party OpenAI-compatible model.')}</p>
          </div>
          <div style="padding:16px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06);border-radius:10px;margin-top:12px;font-size:12.5px;color:#a1a1aa;line-height:1.6;">
            <div style="margin-bottom:8px;display:flex;align-items:center;gap:6px;">
              <span style="font-weight:600;color:#ffffff;">Model Identifier:</span>
              <code style="background:rgba(255,255,255,0.06);padding:2px 6px;border-radius:4px;color:#38bdf8;font-size:11.5px;">${escapeHtml(model.id)}</code>
            </div>
            <div>This model is hosted on an external inference endpoint configured in your External Providers settings.</div>
          </div>
        </div>
      `;
      return;
    }

    const thinkingList = model.thinking || ['low', 'medium', 'high'];
    const activeEffort = thinkingList.includes(effort) ? effort : (model.defaultThinking || thinkingList[0]);

    const delta = REASONING_INTELLIGENCE_DELTA[activeEffort] || 0;
    const baseIntel = model.metrics?.intelligence || 7;
    const adjustedIntel = Math.min(10, Math.max(1, Math.round(baseIntel + delta)));
    const speed = Math.min(10, Math.max(1, Math.round(model.metrics?.speed || 6)));
    const context = model.metrics?.context || 6;
    const efficiency = Math.min(10, Math.max(1, Math.round(model.metrics?.efficiency ?? 6)));
    const contextWin = model.contextWindow || '1.0M tokens';
    const isClaudeFamily = isClaudeModel(model.id);
    const isOpenAIFamily = !isClaudeFamily && (model.id === 'gpt-oss-120b-medium' ? (model.usageGroup !== 'gemini' && activeModelTab !== 'antigravity') : isOpenAIModel(model.id));
    const providerName = isClaudeFamily ? 'Anthropic' : (isOpenAIFamily ? 'OpenAI' : 'Antigravity');

    const apiOnly = model.dynamicSource === 'gemini';
    const pricing = getModelPricing(model.id);
    const priceLine = (activeModelTab === 'antigravity' && !apiOnly && currentEngineIsLocal())
      ? 'Local terminal · no per-token charge'
      : `~${formatRate(pricing.in)} in · ${formatRate(pricing.out)} out per 1M tokens (estimate)`;

    // The picker only describes the model: name, price and benchmarks. Reasoning and provider live elsewhere.
    previewCard.innerHTML = `
      <div class="preview-panel-content">
        <div class="preview-header">
          <div class="preview-title-row">
            <span class="preview-model-name">${escapeHtml(model.name)}</span>
            <span class="preview-provider-tag">${providerName}</span>
          </div>
          <p class="preview-model-desc">${escapeHtml(model.desc || '')}</p>
          <span class="preview-price-line">${escapeHtml(priceLine)}</span>
        </div>

        <div class="preview-metrics-grid" id="benchMetricsGrid">
          ${renderMetricBarHtml('INTELLIGENCE', adjustedIntel)}
          ${renderMetricBarHtml('SPEED', speed)}
          ${renderMetricBarHtml('CONTEXT', context, `${contextWin} context window`)}
          ${renderMetricBarHtml('EFFICIENCY', efficiency, 'Eficiencia computacional y de procesamiento')}
        </div>
      </div>
    `;

    // Trigger the grow animation from bottom up on next tick!
    requestAnimationFrame(() => {
      previewCard.querySelectorAll('.grow-segment').forEach((el) => {
        el.classList.add('grown');
      });
    });
  }

  // ─── Reasoning slider (button in the prompt box) ─────────────────────────────
  function effortLabel(lvl) {
    if (lvl === 'fast') return 'Fast';
    if (lvl === 'x-high') return 'Extra';
    if (lvl === 'thinking') return 'Thinking';
    if (lvl === 'max') return 'Max';
    return String(lvl).charAt(0).toUpperCase() + String(lvl).slice(1);
  }

  function getReasoningOptions() {
    const m = getCurrentModelObject();
    return (m && !m.isExternal && Array.isArray(m.thinking)) ? m.thinking : [];
  }

  let reasoningPendingIndex = null;
  let reasoningChosen = false;
  try { reasoningChosen = localStorage.getItem('autono_reasoning_chosen') === '1'; } catch (_) {}

  function setReasoningChosen(value) {
    reasoningChosen = value;
    try { localStorage.setItem('autono_reasoning_chosen', value ? '1' : '0'); } catch (_) {}
    updateReasoningButton();
  }

  // Grey "Reasoning" until the user picks a level; then blue and named after the level
  function updateReasoningButton() {
    const btn = document.getElementById('reasoningBtn');
    const label = document.getElementById('reasoningBtnLabel');
    if (!btn || !label) return;
    const options = getReasoningOptions();
    const chosen = reasoningChosen && options.includes(currentThinkingEffort);
    btn.classList.toggle('active', chosen);
    label.textContent = chosen ? effortLabel(currentThinkingEffort) : 'Reasoning';
  }

  function renderReasoningSlider(previewIndex = null) {
    updateReasoningButton();
    const panel = document.getElementById('reasoningPanel');
    if (!panel) return;
    const options = getReasoningOptions();
    const slider = document.getElementById('reasoningSlider');
    const empty = document.getElementById('reasoningEmpty');
    const labelsEl = document.getElementById('reasoningLabels');
    const stopsEl = document.getElementById('reasoningStops');
    const thumb = document.getElementById('reasoningThumb');
    const fill = document.getElementById('reasoningFill');
    const current = document.getElementById('reasoningCurrent');
    if (options.length < 2) {
      slider.classList.add('hidden');
      labelsEl.classList.add('hidden');
      empty.classList.remove('hidden');
      current.textContent = options[0] ? effortLabel(options[0]) : '';
      return;
    }
    slider.classList.remove('hidden');
    labelsEl.classList.remove('hidden');
    empty.classList.add('hidden');

    let idx = options.indexOf(currentThinkingEffort);
    if (idx < 0) idx = Math.max(0, options.indexOf(getCurrentModelObject()?.defaultThinking));
    const shown = previewIndex === null ? idx : previewIndex;
    const pct = (i) => (i / (options.length - 1)) * 100;

    stopsEl.innerHTML = options.map((_, i) => `<span class="reasoning-stop${i <= shown ? ' on' : ''}" style="left:${pct(i)}%"></span>`).join('');
    labelsEl.innerHTML = options.map((o, i) => `<button type="button" class="reasoning-label${i === shown ? ' active' : ''}" data-index="${i}" style="left:${pct(i)}%">${effortLabel(o)}</button>`).join('');
    labelsEl.querySelectorAll('.reasoning-label').forEach((btn) => {
      btn.addEventListener('click', () => commitReasoning(parseInt(btn.dataset.index, 10)));
    });
    thumb.style.left = `${pct(shown)}%`;
    fill.style.width = `${pct(shown)}%`;
    thumb.setAttribute('data-label', effortLabel(options[shown]));
    thumb.setAttribute('aria-valuetext', effortLabel(options[shown]));
    current.textContent = effortLabel(options[shown]);
  }

  function commitReasoning(index) {
    const options = getReasoningOptions();
    setReasoningChosen(true);
    const next = options[Math.max(0, Math.min(options.length - 1, index))];
    if (next && next !== currentThinkingEffort) {
      updateThinkingEffort(next); // re-renders the slider
      const m = getCurrentModelObject();
      if (m) renderModelPreviewPanel(m, next);
    } else {
      renderReasoningSlider();
    }
  }

  (function wireReasoningSlider() {
    const btn = document.getElementById('reasoningBtn');
    const panel = document.getElementById('reasoningPanel');
    const slider = document.getElementById('reasoningSlider');
    const thumb = document.getElementById('reasoningThumb');
    if (!btn || !panel || !slider || !thumb) return;
    let dragging = false;

    const indexFromEvent = (e) => {
      const options = getReasoningOptions();
      const rect = slider.getBoundingClientRect();
      const frac = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      return { frac, index: Math.round(frac * (options.length - 1)), count: options.length };
    };

    const follow = (e) => {
      const { frac, index, count } = indexFromEvent(e);
      if (count < 2) return;
      reasoningPendingIndex = index;
      const snapped = (index / (count - 1)) * 100;
      thumb.style.left = `${snapped}%`;
      document.getElementById('reasoningFill').style.width = `${snapped}%`;
      renderReasoningLabelsOnly(index);
    };

    // While dragging the thumb snaps to the nearest level, so it never rests between two of them
    function renderReasoningLabelsOnly(index) {
      const options = getReasoningOptions();
      document.querySelectorAll('#reasoningStops .reasoning-stop').forEach((el, i) => el.classList.toggle('on', i <= index));
      document.querySelectorAll('#reasoningLabels .reasoning-label').forEach((el, i) => el.classList.toggle('active', i === index));
      thumb.setAttribute('data-label', effortLabel(options[index]));
      document.getElementById('reasoningCurrent').textContent = effortLabel(options[index]);
    }

    slider.addEventListener('pointerdown', (e) => {
      if (getReasoningOptions().length < 2) return;
      dragging = true;
      slider.setPointerCapture(e.pointerId);
      thumb.classList.add('dragging');
      follow(e);
    });
    slider.addEventListener('pointermove', (e) => { if (dragging) follow(e); });
    const end = () => {
      if (!dragging) return;
      dragging = false;
      thumb.classList.remove('dragging');
      const idx = reasoningPendingIndex;
      reasoningPendingIndex = null;
      if (idx !== null) commitReasoning(idx);
    };
    slider.addEventListener('pointerup', end);
    slider.addEventListener('pointercancel', end);

    thumb.addEventListener('keydown', (e) => {
      const options = getReasoningOptions();
      const idx = Math.max(0, options.indexOf(currentThinkingEffort));
      if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); commitReasoning(idx + 1); }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); commitReasoning(idx - 1); }
    });

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const open = panel.classList.contains('hidden');
      panel.classList.toggle('hidden', !open);
      btn.classList.toggle('open', open);
      if (open) {
        renderReasoningSlider();
        panel.classList.remove('reasoning-open');
        void panel.offsetWidth; // restart the entrance animation
        panel.classList.add('reasoning-open');
      }
    });
    document.addEventListener('click', (e) => {
      if (!panel.classList.contains('hidden') && !panel.contains(e.target) && !btn.contains(e.target)) {
        panel.classList.add('hidden');
        btn.classList.remove('open');
      }
    });
  })();

  // ─── Engine: Local Terminal or the provider's API ────────────────────────────
  function getProviderContext() {
    const id = currentBaseModelId || currentModel || '';
    const modelObj = findModelByAnyId(id)?.model || null;
    const gptOss = /gpt-oss/i.test(id);
    const claude = isClaudeModel(id);
    const openai = !claude && !gptOss && isOpenAIModel(id);
    const prov = claude ? 'claude' : (openai ? 'openai' : 'antigravity');
    const route = modelRoute || activeModelTab;
    const forcedLocal = route === 'antigravity' && (claude || openai || gptOss);
    const apiOnly = modelObj?.dynamicSource === 'gemini';
    const stored = prov === 'claude' ? currentClaudeMode : (prov === 'openai' ? currentOpenaiMode : currentAntigravityMode);
    const mode = forcedLocal ? 'desktop' : (apiOnly ? 'api' : (stored === 'api' ? 'api' : 'desktop'));
    const apiName = prov === 'claude' ? 'Claude API' : (prov === 'openai' ? 'OpenAI API' : 'Gemini API');
    const hasKey = prov === 'claude' ? !!currentAnthropicApiKey : (prov === 'openai' ? !!currentOpenaiApiKey : !!currentGeminiApiKey);
    return { prov, mode, forcedLocal, apiOnly, apiName, hasKey };
  }

  // Logo for an engine: Antigravity for its terminal, Gemini for its API, Claude Code / Codex for
  // their local terminals, and the Claude / OpenAI logos for their APIs
  function providerIconHtml(ctx, mode) {
    const img = (src, alt) => `<img src="${src}" alt="${alt}">`;
    if (ctx.forcedLocal && mode !== 'api') return img('../assets/antigravity-icon-32.png', 'Antigravity');
    if (ctx.prov === 'claude') return mode === 'api' ? img('../assets/claude-icon-32.png', 'Claude API') : img('../assets/claude-code-logo.svg', 'Claude Code');
    if (ctx.prov === 'openai') return mode === 'api' ? img('../assets/chatgpt-icon-32.png', 'OpenAI API') : img('../assets/codex-logo.svg', 'Codex');
    return mode === 'api' ? img(getGeminiLogoSrc(), 'Gemini API') : img('../assets/antigravity-icon-32.png', 'Antigravity');
  }

  // Same engine choice as the Engine menu, one row per provider in Settings
  function renderSettingsEngineChoices() {
    document.querySelectorAll('.engine-choice-group').forEach((group) => {
      const prov = group.dataset.prov;
      const ctx = { prov, forcedLocal: false };
      const stored = prov === 'claude' ? currentClaudeMode : (prov === 'openai' ? currentOpenaiMode : currentAntigravityMode);
      const mode = stored === 'api' ? 'api' : 'desktop';
      const apiName = prov === 'claude' ? 'Claude API' : (prov === 'openai' ? 'OpenAI API' : 'Gemini API');
      const choice = (m, label) => `<button type="button" class="engine-choice${mode === m ? ' active' : ''}" data-mode="${m}"><span class="provider-option-icon">${providerIconHtml(ctx, m)}</span><span>${label}</span></button>`;
      group.innerHTML = choice('desktop', 'Local Terminal') + choice('api', apiName);
      group.querySelectorAll('.engine-choice').forEach((btn) => {
        btn.addEventListener('click', () => applyProviderMode(prov, btn.dataset.mode));
      });
    });
  }

  function updateProviderButton() {
    renderSettingsEngineChoices();
    const btn = document.getElementById('providerBtn');
    if (!btn) return;
    const ctx = getProviderContext();
    btn.title = `Engine: ${ctx.mode === 'api' ? ctx.apiName : 'Local Terminal'}`;
    const icon = document.getElementById('providerBtnIcon');
    if (icon) icon.innerHTML = providerIconHtml(ctx, ctx.mode);
  }

  function renderProviderPopover() {
    const pop = document.getElementById('providerPopover');
    if (!pop) return;
    const ctx = getProviderContext();
    const localDisabled = ctx.apiOnly;
    const apiDisabled = ctx.forcedLocal;
    const note = ctx.forcedLocal
      ? 'This model was picked under Antigravity, so it runs in the local terminal. Pick it from its own tab to use the official API.'
      : (ctx.apiOnly ? 'Gemini API models only run through the API.' : (ctx.mode === 'api' && !ctx.hasKey ? `⚠️ Add your ${ctx.apiName} key in Settings.` : ''));
    pop.innerHTML = `
      <div class="provider-pop-title">Engine</div>
      <button type="button" class="provider-option${ctx.mode === 'desktop' ? ' active' : ''}" data-mode="desktop" ${localDisabled ? 'disabled' : ''}>
        <span class="provider-option-icon">${providerIconHtml(ctx, 'desktop')}</span>
        <span class="provider-option-text">
          <span class="provider-option-name">Local Terminal</span>
          <span class="provider-option-sub">Runs through the Bridge with your own subscription</span>
        </span>
      </button>
      <button type="button" class="provider-option${ctx.mode === 'api' ? ' active' : ''}" data-mode="api" ${apiDisabled ? 'disabled' : ''}>
        <span class="provider-option-icon">${providerIconHtml(ctx, 'api')}</span>
        <span class="provider-option-text">
          <span class="provider-option-name">${escapeHtml(ctx.apiName)}</span>
          <span class="provider-option-sub">Direct API call with your key</span>
        </span>
      </button>
      ${note ? `<div class="provider-note">${escapeHtml(note)}</div>` : ''}`;
    pop.querySelectorAll('.provider-option').forEach((opt) => {
      opt.addEventListener('click', (e) => {
        e.stopPropagation();
        if (opt.disabled) return;
        applyProviderMode(ctx.prov, opt.getAttribute('data-mode'));
        renderProviderPopover();
      });
    });
  }

  function applyProviderMode(prov, targetMode) {
    const bridgeUrl = (settingBridgeUrl?.value?.trim() || 'http://127.0.0.1:8765').replace(/\/+$/, '');
    const configPayload = {};
    const persist = (field, storageKey, localKey) => {
      try { localStorage.setItem(localKey, targetMode); } catch (_) {}
      if (chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(['antigravity_settings'], (res) => {
          const prev = res.antigravity_settings || {};
          prev[field] = targetMode;
          chrome.storage.local.set({ antigravity_settings: prev, [storageKey]: targetMode });
        });
      }
    };

    if (prov === 'claude') {
      currentClaudeMode = targetMode;
      if (settingClaudeMode) settingClaudeMode.value = targetMode;
      persist('claudeMode', 'antigravity_claude_mode', 'antigravity_claude_mode');
      configPayload.claude_mode = targetMode;
      showToast(targetMode === 'api' ? (currentAnthropicApiKey ? '⚡ Claude API active' : '⚠️ Claude API active. Configure Anthropic API Key in Settings') : '💻 Local Terminal active');
    } else if (prov === 'openai') {
      currentOpenaiMode = targetMode;
      if (settingOpenaiMode) settingOpenaiMode.value = targetMode;
      persist('openaiMode', 'antigravity_openai_mode', 'antigravity_openai_mode');
      configPayload.openai_mode = targetMode;
      showToast(targetMode === 'api' ? (currentOpenaiApiKey ? '⚡ OpenAI API active' : '⚠️ OpenAI API active. Configure OpenAI Key in Settings') : '💻 Local Terminal active');
    } else {
      currentAntigravityMode = targetMode;
      if (settingAntigravityMode) settingAntigravityMode.value = targetMode;
      persist('antigravityMode', 'antigravity_antigravity_mode', 'antigravity_antigravity_mode');
      configPayload.antigravity_mode = targetMode;
      showToast(targetMode === 'api' ? (currentGeminiApiKey ? '⚡ Gemini API active' : '⚠️ Gemini API active. Configure Gemini Key in Settings') : '💻 Local Terminal active');
    }

    fetch(`${bridgeUrl}/api/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(configPayload),
    }).catch(() => null);

    updateProviderButton();
    updateContextMeter();
    const m = getCurrentModelObject();
    if (m) renderModelPreviewPanel(m, currentThinkingEffort);
  }

  (function wireProviderButton() {
    const btn = document.getElementById('providerBtn');
    const pop = document.getElementById('providerPopover');
    if (!btn || !pop) return;
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const open = pop.classList.contains('hidden');
      pop.classList.toggle('hidden', !open);
      if (open) {
        closeModelPicker();
        renderProviderPopover();
      }
    });
    document.addEventListener('click', (e) => {
      if (!pop.classList.contains('hidden') && !pop.contains(e.target) && !btn.contains(e.target)) {
        pop.classList.add('hidden');
      }
    });
  })();

  let geminiLogoSrcCache = '';
  function getGeminiLogoSrc() {
    if (!geminiLogoSrcCache) {
      const svg = String(PROVIDER_DATA.gemini.iconSvg).replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ');
      geminiLogoSrcCache = 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
    }
    return geminiLogoSrcCache;
  }

  function setAntigravityModeQuiet(mode) {
    if (currentAntigravityMode === mode) return;
    currentAntigravityMode = mode;
    if (settingAntigravityMode) settingAntigravityMode.value = mode;
    try { localStorage.setItem('antigravity_antigravity_mode', mode); } catch (_) {}
    if (chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(['antigravity_settings'], (res) => {
        const prev = res.antigravity_settings || {};
        prev.antigravityMode = mode;
        chrome.storage.local.set({ antigravity_settings: prev, antigravity_antigravity_mode: mode });
      });
    }
    if (mode === 'api') {
      showToast(currentGeminiApiKey ? '⚡ Gemini API active' : '⚠️ Gemini API active. Configure Gemini Key in Settings');
    } else {
      showToast('💻 Local Terminal active');
    }
  }

  function renderModelPickerRows(searchQuery = '') {
    modelRowsList.innerHTML = '';
    const q = typeof searchQuery === 'string' ? searchQuery.toLowerCase().trim() : '';

    let modelsToRender = [];
    if (q) {
      // Search across all providers
      for (const pKey of Object.keys(PROVIDER_DATA)) {
        const p = PROVIDER_DATA[pKey];
        p.models.forEach((m) => {
          if (
            m.name.toLowerCase().includes(q) ||
            m.id.toLowerCase().includes(q) ||
            (m.desc && m.desc.toLowerCase().includes(q))
          ) {
            modelsToRender.push({ ...m, providerName: p.name });
          }
        });
      }
    } else {
      if (activeModelTab === 'claude') {
        // Claude tab: all Claude models
        modelsToRender = PROVIDER_DATA.claude.models.filter((m) => !m.localOnly);
      } else if (activeModelTab === 'openai') {
        // OpenAI tab: all OpenAI models (Codex, GPT-4o, o3-mini, GPT-OSS)
        modelsToRender = PROVIDER_DATA.chatgpt.models;
      } else {
        // Antigravity models tab
        // Section 1: everything the Bridge runs locally. Section 2: Gemini API models (only when loaded)
        const seen = new Set();
        const localModels = [
          ...PROVIDER_DATA.gemini.models.filter((m) => m.dynamicSource !== 'gemini'),
          ...PROVIDER_DATA.claude.models.filter(isLocalAntigravityModel),
          ...PROVIDER_DATA.chatgpt.models.filter(isLocalAntigravityModel),
        ].filter((m) => (seen.has(m.id) ? false : (seen.add(m.id), true)));
        const apiModels = PROVIDER_DATA.gemini.models.filter((m) => m.dynamicSource === 'gemini');
        modelsToRender = apiModels.length > 0
          ? [{ __header: 'Antigravity · Local Terminal', __logo: 'antigravity' }, ...localModels, { __header: 'Gemini API', __logo: 'gemini' }, ...apiModels]
          : localModels;
      }
    }

    if (modelsToRender.length === 0) {
      const emptyMsg = document.createElement('div');
      emptyMsg.className = 'model-row-desc';
      emptyMsg.style.padding = '12px';
      emptyMsg.style.textAlign = 'center';
      emptyMsg.textContent = 'No se encontraron modelos';
      modelRowsList.appendChild(emptyMsg);
      return;
    }

    modelsToRender.forEach((m) => {
      if (m.__header) {
        const isGeminiHeader = m.__logo === 'gemini';
        const header = document.createElement('div');
        header.className = 'model-section-header';
        header.style.cssText = [
          'display:flex',
          'align-items:center',
          'gap:8px',
          'margin:' + (isGeminiHeader ? '12px' : '2px') + ' 0 4px',
          'padding:7px 10px',
          'font-size:11px',
          'font-weight:600',
          'letter-spacing:.06em',
          'text-transform:uppercase',
          'border-radius:8px',
          'border-left:3px solid ' + (isGeminiHeader ? 'rgba(255,255,255,.22)' : '#3b82f6'),
          'background:' + (isGeminiHeader ? 'rgba(255,255,255,.05)' : 'rgba(59,130,246,.12)'),
          'color:' + (isGeminiHeader ? '#d4d4d8' : '#60a5fa'),
        ].join(';');
        const logo = document.createElement('img');
        logo.src = isGeminiHeader ? getGeminiLogoSrc() : '../assets/antigravity-icon-32.png';
        logo.alt = '';
        logo.width = 16;
        logo.height = 16;
        logo.style.cssText = 'width:16px;height:16px;object-fit:contain;flex:none;';
        const label = document.createElement('span');
        label.textContent = m.__header;
        header.append(logo, label);
        modelRowsList.appendChild(header);
        return;
      }
      const row = document.createElement('div');
      const isSelected = m.id === currentBaseModelId;
      row.className = `model-row ${isSelected ? 'selected' : ''}`;
      row.setAttribute('data-model', m.id);

      row.innerHTML = `
        <div class="model-row-header">
          <div class="model-row-info">
            <div class="model-row-title">
              <span>${escapeHtml(m.name)}</span>
              ${m.dynamicSource === 'gemini' ? `<img src="${getGeminiLogoSrc()}" width="14" height="14" alt="Gemini API" title="Gemini API" style="margin-left:6px;vertical-align:middle;">` : ''}
              ${isSelected ? '<span class="check-mark">✓</span>' : ''}
            </div>
          </div>
          <div class="capability-chips">
            ${m.caps?.includes('reasoning') ? SVG_CAPS.reasoning : ''}
            ${m.caps?.includes('image') ? SVG_CAPS.image : ''}
          </div>
        </div>
      `;

      row.addEventListener('mouseenter', () => {
        renderModelPreviewPanel(m, currentThinkingEffort);
      });

      row.addEventListener('click', () => {
        // Antigravity tab: Gemini API section -> API mode, local section -> local terminal
        if (!q && activeModelTab === 'antigravity' && m.usageGroup === 'gemini' && PROVIDER_DATA.gemini.models.includes(m)) {
          setAntigravityModeQuiet(m.dynamicSource === 'gemini' ? 'api' : 'desktop');
        }
        selectModel(m.id, false, q ? null : activeModelTab);
      });

      modelRowsList.appendChild(row);
    });

    const activeModelObj = getCurrentModelObject();
    if (activeModelObj) {
      renderModelPreviewPanel(activeModelObj, currentThinkingEffort);
    }
  }

  function updatePickerTabsUI() {
    const tabsBar = document.getElementById('pickerTopTabs');
    if (!tabsBar) return;
    tabsBar.querySelectorAll('.picker-tab-btn').forEach((btn) => {
      const tab = btn.getAttribute('data-tab');
      if (tab === activeModelTab) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    const provLabel = document.getElementById('pickerProviderLabel');
    if (provLabel) {
      if (activeModelTab === 'claude') {
        provLabel.textContent = 'Claude (Anthropic)';
      } else if (activeModelTab === 'openai') {
        provLabel.textContent = 'OpenAI (GPT-6 & GPT-5.6)';
      } else {
        provLabel.textContent = 'Antigravity (Google Gemini)';
      }
    }
  }

  function openModelPicker() {
    document.getElementById('providerPopover')?.classList.add('hidden');
    document.getElementById('reasoningPanel')?.classList.add('hidden');
    document.getElementById('reasoningBtn')?.classList.remove('open');
    modelPickerTrigger.classList.add('open');
    modelPickerPopover.classList.remove('hidden');
    if (modelRoute) {
      activeModelTab = modelRoute;
    } else if (isClaudeModel(currentBaseModelId)) {
      activeModelTab = 'claude';
    } else if (currentBaseModelId === 'gpt-oss-120b-medium') {
      if (activeModelTab !== 'openai') {
        activeModelTab = 'antigravity';
      }
    } else if (isOpenAIModel(currentBaseModelId)) {
      activeModelTab = 'openai';
    } else {
      activeModelTab = 'antigravity';
    }
    updatePickerTabsUI();
    modelSearchInput.value = '';
    modelSearchInput.focus();
    renderModelPickerRows();
  }

  function closeModelPicker() {
    modelPickerTrigger.classList.remove('open');
    modelPickerPopover.classList.add('hidden');
  }

  modelPickerTrigger.addEventListener('click', (e) => {
    e.stopPropagation();
    if (modelPickerPopover.classList.contains('hidden')) {
      openModelPicker();
    } else {
      closeModelPicker();
    }
  });

  document.addEventListener('click', (e) => {
    if (!modelPickerPopover.contains(e.target) && !modelPickerTrigger.contains(e.target)) {
      closeModelPicker();
    }
  });

  // Top Tabs: Antigravity vs Claude Code
  const pickerTopTabs = document.getElementById('pickerTopTabs');
  if (pickerTopTabs) {
    pickerTopTabs.addEventListener('click', (e) => {
      const btn = e.target.closest('.picker-tab-btn');
      if (!btn) return;
      e.stopPropagation();
      const tab = btn.getAttribute('data-tab');
      if (!tab || tab === activeModelTab) return;
      activeModelTab = tab;
      updatePickerTabsUI();
      modelSearchInput.value = '';
      renderModelPickerRows();
    });
  }

  // ─── Dynamic model loading: Bridge / local terminal + direct provider APIs ───
  const DYNAMIC_MODELS_KEY = 'antigravity_dynamic_models';
  const API_MODEL_ENDPOINTS = {
    gemini: 'https://generativelanguage.googleapis.com/v1beta/openai/models',
    claude: 'https://api.anthropic.com/v1/models?limit=1000',
    openai: 'https://api.openai.com/v1/models',
  };

  // Gemini API models that can't be used as chat/agent models here
  function isUnusableGeminiApiModel(m) {
    const text = `${m.id || ''} ${m.name || ''}`.toLowerCase();
    return /computer[-_ ]?use|robotics|transcribe|omni|nano[-_ ]?banana|custom[-_ ]?tools/.test(text);
  }

  function prettifyModelId(id) {
    return String(id)
      .split(/[-_]/)
      .filter(Boolean)
      .map((p) => (/^\d/.test(p) ? p : p.charAt(0).toUpperCase() + p.slice(1)))
      .join(' ');
  }

  function getDynamicTargetGroup(source, modelId, owner) {
    if (source === 'gemini') return PROVIDER_DATA.gemini.models;
    // The Bridge says which tab owns each model (owned_by: antigravity | claude | openai)
    if (source === 'bridge' && owner === 'claude') return PROVIDER_DATA.claude.models;
    if (source === 'bridge' && owner === 'openai') return PROVIDER_DATA.chatgpt.models;
    if (source === 'bridge' && owner === 'antigravity') {
      return isClaudeModel(modelId) ? PROVIDER_DATA.claude.models : PROVIDER_DATA.gemini.models;
    }
    if (source === 'claude') return PROVIDER_DATA.claude.models;
    if (source === 'openai') return PROVIDER_DATA.chatgpt.models;
    if (isClaudeModel(modelId)) return PROVIDER_DATA.claude.models;
    if (isOpenAIModel(modelId)) return PROVIDER_DATA.chatgpt.models;
    return PROVIDER_DATA.gemini.models;
  }

  // Remove models previously injected from a source so a refresh replaces (not accumulates) them
  function clearDynamicModels(source) {
    for (const pKey of ['gemini', 'claude', 'chatgpt']) {
      const group = PROVIDER_DATA[pKey]?.models;
      if (!Array.isArray(group)) continue;
      for (let i = group.length - 1; i >= 0; i--) {
        if (group[i].dynamicSource === source) {
          group.splice(i, 1);
        } else if (source === 'bridge') {
          delete group[i].bridgeTabs;
          delete group[i].bridgeMatched;
        }
      }
    }
  }

  // entries: [{ id, name?, thinking?, defaultThinking?, desc?, contextWindow? }]
  function applyDynamicModels(source, entries, normalizeEffort) {
    clearDynamicModels(source);
    let added = 0;
    entries.forEach((m) => {
      let baseId = String(m.id || '').trim();
      if (!baseId) return;
      if (source === 'gemini' && isUnusableGeminiApiModel(m)) return;
      let effort = null;
      if (normalizeEffort) {
        const suffix = baseId.match(/-(high|medium|low|thinking)$/);
        if (suffix) {
          effort = suffix[1];
          baseId = baseId.slice(0, -suffix[0].length);
        }
        if (baseId === 'gpt-oss-120b') baseId = 'gpt-oss-120b-medium';
      }

      const owner = source === 'bridge' ? String(m.owner || '').toLowerCase() : '';
      const group = getDynamicTargetGroup(source, baseId, owner);
      const normId = (s) => String(s).toLowerCase().replace(/\./g, '-');
      const existing = group.find((x) => normId(x.id) === normId(baseId));
      const tagBridgeTab = (model) => {
        if (source !== 'bridge' || !owner) return;
        if (!Array.isArray(model.bridgeTabs)) model.bridgeTabs = [];
        if (!model.bridgeTabs.includes(owner)) model.bridgeTabs.push(owner);
      };
      if (existing) {
        if (source === 'bridge') {
          existing.bridgeMatched = true;
          // Use the exact id the Bridge knows, otherwise requests would carry a name it does not recognise
          if (existing.id !== baseId) existing.id = baseId;
        }
        tagBridgeTab(existing);
        if (m.variants && !existing.variants) existing.variants = m.variants;
        if (!Array.isArray(existing.thinking)) existing.thinking = [];
        const extra = Array.isArray(m.thinking) ? m.thinking : (effort ? [effort] : []);
        extra.forEach((th) => {
          if (!existing.thinking.includes(th)) existing.thinking.push(th);
        });
        return;
      }

      const thinkingOpts = Array.isArray(m.thinking) && m.thinking.length > 0
        ? [...m.thinking]
        : (effort ? [effort] : ['low', 'medium', 'high']);
      const claude = group === PROVIDER_DATA.claude.models;
      const openai = group === PROVIDER_DATA.chatgpt.models;
      const cleanName = String(m.name || baseId).replace(/\s*\((High|Medium|Low|Thinking)\)\s*$/i, '').trim();
      group.push({
        id: baseId,
        name: cleanName || baseId,
        desc: m.desc || `Dynamic model loaded from ${source === 'bridge' ? 'Antigravity Bridge' : source + ' API'}`,
        contextWindow: m.contextWindow || '1.0M tokens',
        metrics: { intelligence: 8, speed: 7, context: 8, efficiency: 7 },
        caps: ['reasoning', 'image'],
        thinking: thinkingOpts,
        defaultThinking: m.defaultThinking || (thinkingOpts.includes('medium') ? 'medium' : thinkingOpts[0]),
        usageGroup: claude || openai ? 'claude_gpt' : 'gemini',
        dynamicSource: source,
        variants: m.variants || undefined,
      });
      tagBridgeTab(group[group.length - 1]);
      added++;
    });
    // the price list follows the model list (it is not ready yet while the panel is still starting up)
    try { renderPricingSettings(); } catch (_) { /* later */ }
    return added;
  }

  function persistDynamicModels(source, entries, normalizeEffort) {
    try {
      const all = JSON.parse(localStorage.getItem(DYNAMIC_MODELS_KEY) || '{}');
      all[source] = { entries, normalizeEffort: !!normalizeEffort };
      localStorage.setItem(DYNAMIC_MODELS_KEY, JSON.stringify(all));
    } catch (_) {}
  }

  // Claude models Antigravity runs on the local terminal. They are always offered in the Antigravity
  // section, whatever the Bridge happens to report. localOnly ones are hidden from the Claude tab.
  [
    ['claude-sonnet-5-5', false],
    ['claude-opus-5-5', false],
  ].forEach(([id, localOnly]) => {
    const m = PROVIDER_DATA.claude.models.find((x) => x.id === id);
    if (!m) return;
    m.antigravityLocal = true;
    if (localOnly) m.localOnly = true;
  });

  // Restore the last successfully loaded catalogs so the picker isn't empty before the first refresh
  try {
    const saved = JSON.parse(localStorage.getItem(DYNAMIC_MODELS_KEY) || '{}');
    Object.keys(saved).forEach((source) => {
      const s = saved[source];
      if (s && Array.isArray(s.entries)) applyDynamicModels(source, s.entries, s.normalizeEffort);
    });
  } catch (_) {}

  // ─── Keep only the newest model of each family (max 10 per group) ───
  const MAX_MODELS_PER_GROUP = 10;
  const PRUNED_GROUPS = ['gemini', 'claude', 'chatgpt'];

  // "claude-opus-4-8" -> { family: 'claude-opus', version: [4, 8] }; effort/alias/date tokens are ignored
  function modelFamilyInfo(id) {
    const family = [];
    const version = [];
    String(id).toLowerCase().split(/[-_\s]+/).filter(Boolean).forEach((t) => {
      if (/^\d{8}$/.test(t)) return; // date stamp (20250514)
      if (/^(low|medium|high|thinking|max|active|latest|preview|exp|experimental)$/.test(t)) return;
      if (/^\d+(\.\d+)*[a-z]?$/.test(t)) {
        t.replace(/[a-z]$/, '').split('.').forEach((n) => version.push(parseInt(n, 10)));
        return;
      }
      const o = t.match(/^o(\d+)$/); // o3, o4-mini
      if (o) {
        family.push('o');
        version.push(parseInt(o[1], 10));
        return;
      }
      family.push(t);
    });
    return { family: family.join('-'), version };
  }

  function compareModelVersions(a, b) {
    const len = Math.max(a.length, b.length);
    for (let i = 0; i < len; i++) {
      const d = (a[i] || 0) - (b[i] || 0);
      if (d !== 0) return d;
    }
    return 0;
  }

  // Keeps the newest model of each family inside one group (max 10).
  //  - inScope: models that compete with each other (others are never touched)
  //  - isExempt: models that stay even if they are not the newest of their family
  function pruneGroup(group, inScope, isExempt) {
    const best = new Map();
    group.filter(inScope).forEach((m) => {
      const { family, version } = modelFamilyInfo(m.id);
      const cur = best.get(family);
      const cmp = cur ? compareModelVersions(version, cur.version) : 1;
      if (!cur || cmp > 0 || (cmp === 0 && String(m.id).length < String(cur.model.id).length)) {
        best.set(family, { model: m, version });
      }
    });
    const keep = new Set(
      [...best.values()]
        .sort((a, b) => compareModelVersions(b.version, a.version))
        .slice(0, MAX_MODELS_PER_GROUP)
        .map((x) => x.model)
    );
    for (let i = group.length - 1; i >= 0; i--) {
      const m = group[i];
      if (!inScope(m) || isExempt(m) || keep.has(m)) continue;
      group.splice(i, 1);
    }
  }

  function isLocalAntigravityModel(m) {
    return !!m.antigravityLocal || (Array.isArray(m.bridgeTabs) && m.bridgeTabs.includes('antigravity'));
  }

  function pruneModelGroups() {
    const openaiGroup = PROVIDER_DATA.chatgpt.models;
    for (let i = openaiGroup.length - 1; i >= 0; i--) {
      if (!isAllowedOpenAiModel(openaiGroup[i].id)) openaiGroup.splice(i, 1);
    }
    // Claude / OpenAI: newest per family; models the Bridge assigns to Antigravity (local terminal) are kept as-is
    pruneGroup(PROVIDER_DATA.claude.models, () => true, isLocalAntigravityModel);
    pruneGroup(PROVIDER_DATA.chatgpt.models, () => true, isLocalAntigravityModel);
    // GPT-6 must always offer Astra, Sol, Luna and Terra, whatever the Bridge or the API reported
    GPT6_REQUIRED.forEach((req) => {
      const tier = openAiModelInfo(req.id).tier;
      const present = PROVIDER_DATA.chatgpt.models.some((m) => {
        const info = openAiModelInfo(m.id);
        return info && info.major === 6 && info.tier === tier;
      });
      if (!present) PROVIDER_DATA.chatgpt.models.unshift({ ...req });
    });
    // Gemini: the local (Antigravity) list is never trimmed; only the API section uses the "newest" rule
    pruneGroup(PROVIDER_DATA.gemini.models, (m) => m.dynamicSource === 'gemini', () => false);
  }

  function findLatestModelInFamily(modelId) {
    const { family } = modelFamilyInfo(modelId);
    let bestModel = null;
    let bestVersion = null;
    PRUNED_GROUPS.forEach((pKey) => {
      (PROVIDER_DATA[pKey]?.models || []).forEach((m) => {
        const info = modelFamilyInfo(m.id);
        if (info.family === family && (!bestVersion || compareModelVersions(info.version, bestVersion) > 0)) {
          bestModel = m;
          bestVersion = info.version;
        }
      });
    });
    return bestModel;
  }

  // If the selected model was discarded, move to the newest model of its family
  function ensureSelectedModelStillExists() {
    const exists = PRUNED_GROUPS.some((pKey) => (PROVIDER_DATA[pKey]?.models || []).some((m) => m.id === currentBaseModelId));
    if (exists) return;
    const replacement = findLatestModelInFamily(currentBaseModelId) || PROVIDER_DATA.gemini.models[0];
    if (replacement) selectModel(replacement.id, false, modelRoute);
  }

  // Drop outdated models from the built-in catalog and the restored one right away
  pruneModelGroups();

  async function fetchBridgeModels(bridgeUrl) {
    // Ask the Bridge to rescan its CLIs; failure here is non-fatal, the catalog fetch decides the outcome
    await fetch(`${bridgeUrl}/api/models/refresh`, { method: 'POST', signal: AbortSignal.timeout(10000) }).catch(() => null);
    const res = await fetch(`${bridgeUrl}/v1/models`, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) throw new Error(`Bridge returned status ${res.status}`);
    const data = await res.json();
    const list = data.data || data.models || [];
    if (!Array.isArray(list)) return [];
    return list
      .map((m) => (typeof m === 'string' ? { id: m } : {
        id: m.id || m.model,
        name: m.display_name || m.name,
        thinking: m.thinking,
        defaultThinking: m.default_thinking,
        desc: m.desc || m.description,
        contextWindow: m.context_window,
        owner: m.owned_by,
        variants: m.variants,
        alias: m.owned_by?.includes?.('alias'),
      }))
      .filter((m) => typeof m.id === 'string' && !m.alias && !m.id.includes('->'));
  }

  async function fetchGeminiApiModels(apiKey) {
    const entries = [];
    let pageToken = '';
    for (let page = 0; page < 10; page++) {
      const url = 'https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000' + (pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : '');
      const res = await fetch(url, { headers: { 'x-goog-api-key': apiKey }, signal: AbortSignal.timeout(15000) });
      if (!res.ok) {
        throw new Error(res.status === 400 || res.status === 401 || res.status === 403 ? 'invalid API key' : `status ${res.status}`);
      }
      const json = await res.json();
      (json.models || []).forEach((m) => {
        const id = String(m.name || '').replace(/^models\//, '');
        const methods = m.supportedGenerationMethods || [];
        if (!/^gemini/i.test(id) || !methods.includes('generateContent')) return;
        if (/embedding|tts|image|live|native-audio|aqa/i.test(id)) return;
        entries.push({
          id,
          name: m.displayName || prettifyModelId(id),
          desc: m.description ? String(m.description).slice(0, 140) : undefined,
          contextWindow: m.inputTokenLimit ? `${Math.round(m.inputTokenLimit / 1000)}K tokens` : undefined,
        });
      });
      pageToken = json.nextPageToken || '';
      if (!pageToken) break;
    }
    return entries.filter((e) => !isUnusableGeminiApiModel(e));
  }

  async function fetchApiModels(source, apiKey) {
    if (source === 'gemini') return fetchGeminiApiModels(apiKey);
    let headers;
    if (source === 'claude') {
      headers = {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      };
    } else {
      headers = { Authorization: `Bearer ${apiKey}` };
    }
    const res = await fetch(API_MODEL_ENDPOINTS[source], { headers, signal: AbortSignal.timeout(15000) });
    if (!res.ok) {
      throw new Error(res.status === 401 || res.status === 403 || res.status === 400 ? 'invalid API key' : `status ${res.status}`);
    }
    const json = await res.json();
    const list = Array.isArray(json.data) ? json.data : (Array.isArray(json.models) ? json.models : []);
    let entries = list.map((m) => {
      const id = String(m.id || m.name || '').replace(/^models\//, '');
      return { id, name: m.display_name || prettifyModelId(id) };
    }).filter((m) => m.id);

    if (source === 'gemini') {
      entries = entries.filter((m) => /^gemini/i.test(m.id) && !/embedding|aqa|imagen|veo|tts|image|live|audio/i.test(m.id));
    } else if (source === 'openai') {
      entries = entries.filter((m) => /^(gpt-|o\d|chatgpt-|codex)/i.test(m.id) && !/instruct|embedding|audio|realtime|transcribe|tts|image|moderation|search|whisper|dall/i.test(m.id));
    }
    return entries;
  }

  // Reload Models: Bridge / local terminal (desktop mode) + direct provider APIs (API mode)
  const refreshModelsBtn = document.getElementById('refreshModelsBtn');
  if (refreshModelsBtn) {
    refreshModelsBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (refreshModelsBtn.dataset.loading === '1') return;
      refreshModelsBtn.dataset.loading = '1';
      refreshModelsBtn.classList.add('spinning');

      const bridgeUrl = (settingBridgeUrl?.value?.trim() || 'http://127.0.0.1:8765').replace(/\/+$/, '');
      const providers = [
        { source: 'gemini', label: 'Gemini', mode: settingAntigravityMode?.value || currentAntigravityMode, key: (settingGeminiApiKey?.value || currentGeminiApiKey || '').trim() },
        { source: 'claude', label: 'Claude', mode: settingClaudeMode?.value || currentClaudeMode, key: (settingAnthropicApiKey?.value || currentAnthropicApiKey || '').trim() },
        { source: 'openai', label: 'OpenAI', mode: settingOpenaiMode?.value || currentOpenaiMode, key: (settingOpenaiApiKey?.value || currentOpenaiApiKey || '').trim() },
      ];
      const apiProviders = providers.filter((p) => p.mode === 'api' && p.key);
      const missingKey = providers.filter((p) => p.mode === 'api' && !p.key).map((p) => p.label);

      try {
        const tasks = [
          fetchBridgeModels(bridgeUrl).then((entries) => ({ source: 'bridge', label: 'Bridge', entries, normalize: true })),
          ...apiProviders.map((p) => fetchApiModels(p.source, p.key).then((entries) => ({ source: p.source, label: p.label, entries, normalize: false }))),
        ];
        const labels = ['Bridge', ...apiProviders.map((p) => p.label)];
        const results = await Promise.allSettled(tasks);

        const loaded = [];
        const failed = [];
        results.forEach((r, i) => {
          if (r.status === 'fulfilled') {
            applyDynamicModels(r.value.source, r.value.entries, r.value.normalize);
            persistDynamicModels(r.value.source, r.value.entries, r.value.normalize);
            loaded.push(`${r.value.label} (${r.value.entries.length})`);
          } else {
            console.warn(`Refresh models error [${labels[i]}]:`, r.reason);
            // An offline Bridge is expected when only API providers are used
            if (labels[i] !== 'Bridge' || apiProviders.length === 0) {
              failed.push(labels[i] === 'Bridge' ? 'Bridge (offline)' : `${labels[i]} (${r.reason?.message || 'error'})`);
            }
          }
        });

        if (loaded.length) {
          pruneModelGroups();
          ensureSelectedModelStillExists();
        }
        renderModelPickerRows(modelSearchInput.value);

        let msg = loaded.length ? `✅ Models loaded (latest versions only): ${loaded.join(', ')}` : '⚠️ No models loaded';
        if (failed.length) msg += ` — ⚠️ ${failed.join(', ')}`;
        if (missingKey.length) msg += ` — add API key for ${missingKey.join(', ')}`;
        showToast(msg, 6000);
      } catch (err) {
        console.warn('Refresh models error:', err);
        showToast('⚠️ Could not reload models');
      } finally {
        setTimeout(() => {
          refreshModelsBtn.classList.remove('spinning');
          refreshModelsBtn.dataset.loading = '0';
        }, 300);
      }
    });
  }

  // Left rail provider buttons: delegated to #pickerRail to handle dynamic external providers seamlessly
  const pickerRail = document.getElementById('pickerRail');
  if (pickerRail) {
    pickerRail.addEventListener('click', (e) => {
      const btn = e.target.closest('.rail-btn');
      if (!btn) return;
      e.stopPropagation();

      const provId = btn.getAttribute('data-provider');
      if (!provId || provId === activeProvider) return;

      pickerRail.querySelectorAll('.rail-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      activeProvider = provId;

      const prov = PROVIDER_DATA[provId];
      const provLabel = document.getElementById('pickerProviderLabel');
      if (provLabel && prov) {
        provLabel.textContent = prov.name;
      }

      modelSearchInput.value = '';
      renderModelPickerRows();
    });
  }

  modelSearchInput.addEventListener('input', () => {
    renderModelPickerRows(modelSearchInput.value);
  });

  // ─── PromptInputBox Tools Toggles ───────────────────────────────────────────
  // ─── Voice: Piper text-to-speech, run by the Bridge ─────────────────────────
  const PIPER_VOICE_KEY = 'autono_piper_voice';
  const PIPER_AUTO_KEY = 'autono_piper_auto';
  const PIPER_SPEED_KEY = 'autono_piper_speed';
  const LANG_NAMES = { en: 'English', es: 'Español', pt: 'Português', fr: 'Français', de: 'Deutsch', zh: '中文' };
  let piperPoll = null;
  let piperAudio = null;
  let piperVoices = [];

  function bridgeBase() {
    return (settingBridgeUrl?.value?.trim() || 'http://127.0.0.1:8765').replace(/\/+$/, '').replace(/\/v1$/, '');
  }

  async function piperApi(path, options) {
    const res = await fetch(`${bridgeBase()}${path}`, options);
    if (!res.ok) {
      let detail = '';
      try { detail = (await res.json()).detail || ''; } catch (_) { /* not JSON */ }
      const err = new Error(detail || `Bridge answered ${res.status}`);
      err.status = res.status;
      throw err;
    }
    return res;
  }

  // With a fixed language the voice list is for that language; with auto-detect you pick one voice for each
  function piperLang() {
    const fixed = dictationLanguage();
    if (fixed !== 'auto') return fixed;
    const chosen = document.getElementById('piperVoiceLangSelect')?.value;
    return chosen === 'en' || chosen === 'es' ? chosen : 'es';
  }

  const savedVoiceFor = (lang) => {
    const own = localStorage.getItem(PIPER_VOICE_KEY + '_' + lang);
    if (own) return own;
    const legacy = localStorage.getItem(PIPER_VOICE_KEY);
    return legacy && legacy.startsWith(lang + '_') ? legacy : '';
  };

  // Spanish or English? Accents, ñ, ¿¡ and common words decide
  function guessTextLanguage(text) {
    const sample = String(text || '').slice(0, 600).toLowerCase();
    if (/[ñ¿¡áéíóú]/.test(sample)) return 'es';
    const es = (sample.match(/\b(el|la|los|las|de|que|y|en|un|una|es|para|con|por|como|pero|más|esto|puedes|hola)\b/g) || []).length;
    const en = (sample.match(/\b(the|and|of|to|is|in|that|for|with|this|you|are|can|it|your|hello)\b/g) || []).length;
    return es > en ? 'es' : 'en';
  }

  function voiceForText(text) {
    const fixed = dictationLanguage();
    const lang = fixed === 'auto' ? guessTextLanguage(text) : fixed;
    return savedVoiceFor(lang) || savedVoiceFor(lang === 'es' ? 'en' : 'es');
  }

  function setPiperStatus(text, tone = '') {
    const el = document.getElementById('piperStatus');
    if (el) { el.textContent = text; el.className = `piper-status ${tone}`.trim(); }
  }

  async function piperRefresh() {
    const installBtn = document.getElementById('piperInstallBtn');
    const controls = document.getElementById('piperControls');
    if (!installBtn || !controls) return;
    clearTimeout(piperPoll);
    let status;
    try {
      status = await (await piperApi('/v1/tts/status')).json();
    } catch (err) {
      installBtn.classList.add('hidden');
      controls.classList.add('hidden');
      setPiperStatus(err.status === 404
        ? 'Your Bridge is too old for voices. Close it and open it again (or run Actualizar-AntigravityBridge).'
        : 'The Bridge is not running, so there is nothing to speak with.', 'bad');
      return;
    }
    if (!status.engine_installed) {
      controls.classList.add('hidden');
      installBtn.classList.remove('hidden');
      installBtn.disabled = status.engine_installing;
      if (status.engine_installing) {
        setPiperStatus('Installing the voice engine… this takes about a minute.');
        piperPoll = setTimeout(piperRefresh, 2000);
      } else {
        setPiperStatus(status.engine_error ? `The engine could not be installed: ${status.engine_error}` : 'The voice engine is not installed yet.', status.engine_error ? 'bad' : '');
      }
      return;
    }
    installBtn.classList.add('hidden');
    controls.classList.remove('hidden');
    document.getElementById('piperLangName').textContent = LANG_NAMES[piperLang()] || piperLang();
    document.getElementById('piperVoiceLangField')?.classList.toggle('hidden', dictationLanguage() !== 'auto');
    try {
      piperVoices = (await (await piperApi(`/v1/tts/voices?lang=${encodeURIComponent(piperLang())}`)).json()).voices || [];
    } catch (err) {
      setPiperStatus(`Could not load the voice list: ${err.message}`, 'bad');
      return;
    }
    renderPiperVoices(status);
  }

  function renderPiperVoices(status) {
    const select = document.getElementById('piperVoiceSelect');
    const saved = savedVoiceFor(piperLang());
    const previous = saved || select.value;
    select.innerHTML = piperVoices.map((v) => {
      const mark = v.installed ? '✓ ' : '';
      return `<option value="${escapeHtml(v.key)}">${mark}${escapeHtml(v.name)} · ${escapeHtml(v.country || v.language)} · ${escapeHtml(v.quality)} · ${v.size_mb} MB</option>`;
    }).join('');
    if (previous && piperVoices.some((v) => v.key === previous)) select.value = previous;
    else {
      const firstInstalled = piperVoices.find((v) => v.installed);
      if (firstInstalled) select.value = firstInstalled.key;
    }
    updatePiperButtons(status);
  }

  function updatePiperButtons(status) {
    const select = document.getElementById('piperVoiceSelect');
    const voice = piperVoices.find((v) => v.key === select.value);
    const download = status?.downloads?.[select.value];
    const busy = download && download.state === 'downloading';
    document.getElementById('piperDownloadBtn').disabled = !voice || voice.installed || busy;
    document.getElementById('piperTestBtn').disabled = !voice || !voice.installed;
    document.getElementById('piperDeleteBtn').disabled = !voice || !voice.installed;
    const progress = document.getElementById('piperProgress');
    progress.classList.toggle('hidden', !busy);
    if (busy) {
      const pct = download.total ? Math.min(100, Math.round((download.done / download.total) * 100)) : 0;
      const bar = document.getElementById('piperProgressBar');
      bar.style.width = `${Math.max(pct, 3)}%`;
      bar.classList.toggle('indeterminate', !download.total);
      const mb = (n) => (n / 1048576).toFixed(1);
      setPiperStatus(`Downloading ${voice?.name || select.value}… ${download.total ? `${pct}% (${mb(download.done)} of ${mb(download.total)} MB)` : ''}`);
      piperPoll = setTimeout(piperRefresh, 1000);
    } else if (download && download.state === 'error') {
      setPiperStatus(`The download failed: ${download.error}`, 'bad');
    } else if (voice && voice.installed) {
      localStorage.setItem(PIPER_VOICE_KEY + '_' + (voice.language_code || voice.key.slice(0, 2)), voice.key);
      setPiperStatus(`Ready: ${voice.name} will read your answers.`, 'ok');
    } else {
      setPiperStatus('Pick a voice and download it. Each one is a one-time download.');
    }
  }

  document.getElementById('piperInstallBtn')?.addEventListener('click', async () => {
    try {
      await piperApi('/v1/tts/engine/install', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      piperRefresh();
    } catch (err) {
      setPiperStatus(`Could not start the install: ${err.message}`, 'bad');
    }
  });
  document.getElementById('piperVoiceSelect')?.addEventListener('change', () => piperRefresh());
  document.getElementById('piperRefreshBtn')?.addEventListener('click', () => {
    setPiperStatus('Updating the voice list…');
    piperRefresh();
  });
  document.getElementById('piperDownloadBtn')?.addEventListener('click', async () => {
    const key = document.getElementById('piperVoiceSelect').value;
    try {
      await piperApi('/v1/tts/voices/download', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ voice: key }) });
      piperRefresh();
    } catch (err) {
      setPiperStatus(`Could not start the download: ${err.message}`, 'bad');
    }
  });
  document.getElementById('piperDeleteBtn')?.addEventListener('click', async () => {
    const key = document.getElementById('piperVoiceSelect').value;
    try {
      await piperApi(`/v1/tts/voices/${encodeURIComponent(key)}`, { method: 'DELETE' });
      ['en', 'es'].forEach((l) => { if (localStorage.getItem(PIPER_VOICE_KEY + '_' + l) === key) localStorage.removeItem(PIPER_VOICE_KEY + '_' + l); });
      if (localStorage.getItem(PIPER_VOICE_KEY) === key) localStorage.removeItem(PIPER_VOICE_KEY);
      piperRefresh();
    } catch (err) {
      setPiperStatus(`Could not delete it: ${err.message}`, 'bad');
    }
  });
  document.getElementById('piperTestBtn')?.addEventListener('click', () => {
    const sample = { en: 'Hello, I am Autono. I can read your answers aloud.', es: 'Hola, soy Autono. Puedo leerte las respuestas en voz alta.', pt: 'Olá, eu sou o Autono. Posso ler as respostas em voz alta.', fr: 'Bonjour, je suis Autono. Je peux lire vos réponses à voix haute.', de: 'Hallo, ich bin Autono. Ich kann dir die Antworten vorlesen.', zh: '你好，我是 Autono。我可以为你朗读回答。' };
    speakText(sample[piperLang()] || sample.en, document.getElementById('piperVoiceSelect').value);
  });
  const piperSpeedSelect = document.getElementById('piperSpeed');
  const piperAutoToggle = document.getElementById('piperAutoRead');
  if (piperSpeedSelect) {
    piperSpeedSelect.value = localStorage.getItem(PIPER_SPEED_KEY) || '1';
    piperSpeedSelect.addEventListener('change', () => localStorage.setItem(PIPER_SPEED_KEY, piperSpeedSelect.value));
  }
  if (piperAutoToggle) {
    piperAutoToggle.checked = localStorage.getItem(PIPER_AUTO_KEY) === '1';
    piperAutoToggle.addEventListener('change', () => localStorage.setItem(PIPER_AUTO_KEY, piperAutoToggle.checked ? '1' : '0'));
  }
  document.getElementById('piperVoiceLangSelect')?.addEventListener('change', () => piperRefresh());
  document.getElementById('dictationLangSelect')?.addEventListener('change', () => {
    if (!settingsModal.classList.contains('hidden')) piperRefresh();
  });

  // What is worth reading aloud: no code, no tags, no markdown symbols
  function speakableText(raw) {
    return String(raw || '')
      .replace(/<(thought|think)>[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<(next_steps_suggestions|approval_card|agent_run|mascot_note|spawn_agents)>[\s\S]*?(<\/\1>|$)/gi, ' ')
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/`([^`]*)`/g, '$1')
      .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      .replace(/^\s*[|:\-\s]+$/gm, ' ')
      .replace(/[#*_>|~]+/g, ' ')
      .replace(/https?:\/\/\S+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 5000);
  }

  function stopSpeaking() {
    if (piperAudio) {
      piperAudio.pause();
      piperAudio = null;
    }
    document.querySelectorAll('.streaming-action-btn.speaking').forEach((b) => b.classList.remove('speaking'));
  }

  // Asks the Bridge to speak and plays the WAV it sends back. Returns true if it started.
  async function speakText(raw, voiceOverride) {
    const text = voiceOverride ? raw : speakableText(raw);
    const voice = voiceOverride || voiceForText(text);
    if (!voice) {
      showToast('Pick and download a voice in Settings → Voice first.');
      return false;
    }
    if (!text) return false;
    stopSpeaking();
    try {
      const res = await piperApi('/v1/tts/speak', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voice, speed: parseFloat(localStorage.getItem(PIPER_SPEED_KEY) || '1') }),
      });
      const url = URL.createObjectURL(await res.blob());
      const audio = new Audio(url);
      piperAudio = audio;
      audio.addEventListener('ended', () => { URL.revokeObjectURL(url); if (piperAudio === audio) piperAudio = null; stopSpeaking(); });
      await audio.play();
      return true;
    } catch (err) {
      showToast(err.status === 409 ? 'Install the voice engine in Settings → Voice first.' : `Could not speak: ${err.message}`);
      return false;
    }
  }

  // ─── Dictation (speech to text) ─────────────────────────────────────────────
  const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
  const DICTATION_LANGS = { en: 'en-US', es: 'es-ES', pt: 'pt-BR', fr: 'fr-FR', de: 'de-DE', zh: 'zh-CN' };
  let recognizer = null;
  let dictating = false;

  function dictationLang() {
    const lang = dictationLanguage();
    if (lang === 'auto') return navigator.language || 'en-US';
    return DICTATION_LANGS[lang] || 'en-US';
  }

  function setDictating(on) {
    dictating = on;
    if (micBtn) {
      micBtn.classList.toggle('listening', on);
      micBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
      micBtn.title = on ? 'Listening… click to stop' : 'Dictate (click to start, click again to stop)';
    }
  }

  // ─── Dictation bar: live sound waves, the words heard so far (ghost text) and a "working" state ───
  const dictationBar = document.getElementById('dictationBar');
  const dictationWave = document.getElementById('dictationWave');
  const dictationStateEl = document.getElementById('dictationState');
  const dictationGhostEl = document.getElementById('dictationGhost');
  let dictationStarting = false;
  let dictationFinishing = false; // after "stop": the last words are still being turned into text

  function showDictationBar(state) {
    if (!dictationBar) return;
    dictationBar.classList.toggle('hidden', !state);
    dictationBar.classList.toggle('working', state === 'working');
    if (dictationStateEl) dictationStateEl.textContent = state === 'working' ? 'Turning your voice into text…' : 'Listening…';
    if (!state) setGhost('');
    dictationFinishing = state === 'working';
    if (micBtn) micBtn.classList.toggle('transcribing', dictationFinishing);
  }

  function setGhost(text) {
    if (!dictationGhostEl) return;
    const clean = String(text || '').trim();
    dictationGhostEl.textContent = clean.length > 240 ? '…' + clean.slice(-240) : clean;
    dictationGhostEl.classList.toggle('hidden', !clean);
  }

  // Draws a scrolling bar graph of the microphone level on the canvas. Returns a function that stops it.
  function startWaveform(analyser) {
    if (!dictationWave || !analyser) return () => {};
    const ctx = dictationWave.getContext('2d');
    const data = new Uint8Array(analyser.fftSize);
    const BAR = 3, GAP = 2;
    let levels = [];
    let raf = 0;
    let lastPush = 0;
    const draw = (now) => {
      raf = requestAnimationFrame(draw);
      const width = dictationWave.clientWidth || 280;
      const height = dictationWave.clientHeight || 34;
      if (dictationWave.width !== width * 2) { dictationWave.width = width * 2; dictationWave.height = height * 2; }
      analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) { const v = (data[i] - 128) / 128; sum += v * v; }
      const level = Math.min(1, Math.sqrt(sum / data.length) * 5);
      if (now - lastPush > 55) { levels.push(level); lastPush = now; }
      const slots = Math.floor((width * 2) / ((BAR + GAP) * 2));
      if (levels.length > slots) levels = levels.slice(levels.length - slots);
      ctx.clearRect(0, 0, dictationWave.width, dictationWave.height);
      ctx.fillStyle = getComputedStyle(dictationWave).color || '#38bdf8';
      const mid = dictationWave.height / 2;
      levels.forEach((l, i) => {
        const h = Math.max(4, l * dictationWave.height * 0.9);
        const x = dictationWave.width - (levels.length - i) * (BAR + GAP) * 2;
        ctx.globalAlpha = 0.35 + 0.65 * (i / Math.max(1, levels.length));
        ctx.fillRect(x, mid - h / 2, BAR * 2, h);
      });
      ctx.globalAlpha = 1;
    };
    raf = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(raf); ctx.clearRect(0, 0, dictationWave.width, dictationWave.height); };
  }

  // The words come out of the box only when dictation ends: write them in and say so
  function commitDictation(base, spoken) {
    const text = String(spoken || '').trim();
    showDictationBar(null);
    if (text) {
      promptInput.value = base + text;
      handleInputStateChange();
      showToast('Done');
    } else {
      showToast('I did not hear anything.');
    }
    promptInput.focus();
  }

  // The side panel cannot show the microphone prompt by itself: a normal tab asks once and Chrome remembers it
  function openMicPermissionPage() {
    chrome.tabs.create({ url: chrome.runtime.getURL('side-panel/mic-permission.html') });
    showToast('Allow the microphone in the tab that just opened, then click the mic again.');
  }

  function stopDictation() {
    if (whisperRun) stopWhisperDictation();
    if (recognizer) {
      showDictationBar('working');
      try { recognizer.stop(); } catch (_) { /* already stopped */ }
    }
  }

  // ─── Local Whisper (whisper.cpp compiled to WebAssembly, runs inside the panel) ───
  const WHISPER_ENGINE_KEY = 'autono_dictation_engine';
  const WHISPER_MODEL_KEY = 'autono_whisper_model';
  const DICT_LANG_KEY = 'autono_dictation_lang';
  // Whisper Tiny (multilingual, 31 MB, MIT) ships inside the extension
  const WHISPER_MODEL_PATH = 'vendor/whisper/models/ggml-tiny-q5_1.bin';
  const WHISPER_LOAD_TIMEOUT_MS = 60000;
  const WHISPER_DOWNLOADED_KEY = 'autono_whisper_downloaded';
  let whisperEngine = null; // { service, modelId }
  let whisperRun = null; // the dictation in progress
  let whisperQueue = Promise.resolve();
  let whisperPending = 0;

  function whisperDownloaded() {
    try { return JSON.parse(localStorage.getItem(WHISPER_DOWNLOADED_KEY) || '[]'); } catch (_) { return []; }
  }

  function whisperModelId() {
    return localStorage.getItem(WHISPER_MODEL_KEY) || 'tiny-q5_1';
  }

  // Local Whisper is the default; the browser engine is only used when chosen (or as a fallback when Whisper cannot run)
  function whisperReady() {
    return localStorage.getItem(WHISPER_ENGINE_KEY) !== 'browser';
  }

  // English and Spanish for now; more languages are coming
  // The language of your voice and of the voice that reads answers: 'en', 'es' or 'auto' (detect it)
  function dictationLanguage() {
    const saved = localStorage.getItem(DICT_LANG_KEY);
    if (saved === 'en' || saved === 'es' || saved === 'auto') return saved;
    const response = document.getElementById('settingAgentLanguage')?.value;
    return response === 'en' || response === 'es' ? response : 'auto';
  }

  // Whisper runs WebAssembly threads, which Chrome only gives to pages that are cross-origin isolated
  function whisperPreflight() {
    if (typeof WebAssembly !== 'object') return 'WebAssembly is not available in this browser.';
    if (!self.crossOriginIsolated || typeof SharedArrayBuffer === 'undefined') {
      return 'Chrome is not giving this panel the threads Whisper needs. Open chrome://extensions and press Reload on Autono, then try again.';
    }
    return '';
  }

  async function loadWhisper() {
    const modelId = 'tiny-q5_1';
    if (whisperEngine && whisperEngine.modelId === modelId) return whisperEngine;
    const problem = whisperPreflight();
    if (problem) throw new Error(problem);
    const load = (async () => {
      const lib = await import('../vendor/whisper/index.es.js');
      const res = await fetch(chrome.runtime.getURL(WHISPER_MODEL_PATH));
      if (!res.ok) throw new Error('The Whisper model file is missing from the extension (' + res.status + ').');
      const data = new Uint8Array(await res.arrayBuffer());
      const service = new lib.WhisperWasmService({ logLevel: 3 });
      await service.initModel(data);
      return { service, modelId };
    })();
    const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Loading the Whisper model took too long.')), WHISPER_LOAD_TIMEOUT_MS));
    whisperEngine = await Promise.race([load, timeout]);
    return whisperEngine;
  }

  async function transcribeWhisper(samples) {
    const { service } = await loadWhisper();
    const threads = Math.max(2, Math.min(8, Math.floor((navigator.hardwareConcurrency || 4) / 2)));
    let text = '';
    for await (const part of service.createSession().streaming(samples, { language: dictationLanguage(), threads, translate: false, sleepMsBetweenChunks: 0 })) {
      text += part.text;
    }
    return cleanTranscript(text);
  }

  // ─── Parakeet (NVIDIA, English + Spanish) runs in the Bridge; the panel only records and sends 16 kHz audio ───
  function samplesToWav(samples) {
    const pcm = new DataView(new ArrayBuffer(44 + samples.length * 2));
    const text = (offset, s) => { for (let i = 0; i < s.length; i++) pcm.setUint8(offset + i, s.charCodeAt(i)); };
    text(0, 'RIFF'); pcm.setUint32(4, 36 + samples.length * 2, true); text(8, 'WAVE'); text(12, 'fmt ');
    pcm.setUint32(16, 16, true); pcm.setUint16(20, 1, true); pcm.setUint16(22, 1, true);
    pcm.setUint32(24, SAMPLE_RATE, true); pcm.setUint32(28, SAMPLE_RATE * 2, true); pcm.setUint16(32, 2, true); pcm.setUint16(34, 16, true);
    text(36, 'data'); pcm.setUint32(40, samples.length * 2, true);
    for (let i = 0; i < samples.length; i++) {
      const v = Math.max(-1, Math.min(1, samples[i]));
      pcm.setInt16(44 + i * 2, v < 0 ? v * 0x8000 : v * 0x7fff, true);
    }
    return pcm.buffer;
  }

  const bufferToBase64 = (buffer) => {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(binary);
  };

  // Talk to the Bridge's speech routes. The panel asks directly; if the browser refuses that request (for example
  // because of cross-origin rules), the extension's background worker, which is not subject to them, asks instead.
  async function sttRequest(path, { method = 'GET', body, contentType, timeoutMs = 60000 } = {}) {
    let direct;
    try {
      const res = await fetch(`${bridgeBase()}${path}`, {
        method, body, headers: contentType ? { 'Content-Type': contentType } : undefined, signal: AbortSignal.timeout(timeoutMs),
      });
      return { ok: res.ok, status: res.status, text: await res.text() };
    } catch (err) {
      direct = err;
    }
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage({ type: 'bridge_relay', path, method, contentType, bodyB64: body ? bufferToBase64(body instanceof ArrayBuffer ? body : new TextEncoder().encode(String(body))) : undefined }, (reply) => {
          const lastError = chrome.runtime.lastError;
          resolve(reply && reply.status !== undefined ? reply : { ok: false, status: 0, text: '', error: (reply && reply.error) || (lastError && lastError.message) || (direct && direct.message) || 'no answer' });
        });
      } catch (err) {
        resolve({ ok: false, status: 0, text: '', error: err.message || String(direct) });
      }
    });
  }

  async function sttJson(path, options) {
    const res = await sttRequest(path, options);
    if (!res.ok) {
      let detail = '';
      try { detail = JSON.parse(res.text).detail || ''; } catch (_) { /* not JSON */ }
      const err = new Error(detail || res.error || `Bridge answered ${res.status}`);
      err.status = res.status;
      throw err;
    }
    try { return JSON.parse(res.text || '{}'); } catch (_) { return {}; }
  }

  async function transcribeParakeet(samples) {
    const data = await sttJson('/v1/stt/transcribe', { method: 'POST', contentType: 'audio/wav', body: samplesToWav(samples) });
    return cleanTranscript(data.text || '');
  }

  // Is Parakeet usable right now? Says why not, so the message is never a mystery
  async function parakeetCheck() {
    const base = bridgeBase();
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await sttRequest('/v1/stt/status', { timeoutMs: 4000 });
        if (res.status === 0) throw new Error(res.error || 'no answer');
        if (res.status === 404) return { ready: false, reason: `the Bridge at ${base} does not know speech yet: restart or update it (Settings → Updates and Bridge)` };
        if (!res.ok) return { ready: false, reason: `the Bridge answered ${res.status}` };
        const status = JSON.parse(res.text || '{}');
        if (!status.engine_installed) return { ready: false, reason: 'the speech engine is not installed (Settings → Dictation)' };
        if (!status.model_installed) return { ready: false, reason: 'the model is not downloaded (Settings → Dictation)' };
        return { ready: true, reason: '' };
      } catch (err) {
        if (attempt === 1) return { ready: false, reason: `cannot reach the Bridge at ${base} (${err.message || err})` };
        await new Promise((r) => setTimeout(r, 600));
      }
    }
    return { ready: false, reason: 'unknown' };
  }

  // What the Settings select shows: the saved choice, or Parakeet (the recommended one) when nothing was chosen
  function dictationEnginePreference() {
    const saved = localStorage.getItem(WHISPER_ENGINE_KEY);
    return saved === 'browser' || saved === 'whisper' ? saved : 'parakeet';
  }

  // What is actually used right now: Parakeet when it is ready, else Whisper Tiny, else the browser
  async function pickDictationEngine() {
    const preferred = dictationEnginePreference();
    if (preferred === 'browser') return 'browser';
    if (preferred === 'parakeet') {
      const check = await parakeetCheck();
      if (check.ready) return 'parakeet';
      if (localStorage.getItem(WHISPER_ENGINE_KEY) === 'parakeet') showToast(`Parakeet is not ready: ${check.reason}. Using Whisper Tiny.`, 9000);
    }
    return 'whisper';
  }

  const transcribeSamples = (samples, engine) => (engine === 'parakeet' ? transcribeParakeet(samples) : transcribeWhisper(samples));

  function showTranscribing() {
    if (micBtn) micBtn.classList.toggle('transcribing', dictationFinishing);
  }

  function queueTranscription(samples, run) {
    whisperPending++;
    showTranscribing();
    whisperQueue = whisperQueue.then(async () => {
      try {
        const text = await transcribeSamples(samples, run.engine);
        if (text) {
          run.text = (run.text ? run.text + ' ' : '') + text;
          setGhost(run.text);
        }
      } catch (err) {
        console.warn('Whisper failed:', err);
        showToast('Dictation failed: ' + (err.message || err));
      } finally {
        whisperPending--;
        showTranscribing();
      }
    });
    return whisperQueue;
  }

  async function startLocalDictation(engine) {
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } });
    } catch (err) {
      if (err && (err.name === 'NotAllowedError' || err.name === 'SecurityError')) openMicPermissionPage();
      else showToast('No microphone found.');
      return;
    }
    const context = new AudioContext({ sampleRate: SAMPLE_RATE });
    if (context.state === 'suspended') await context.resume();
    await context.audioWorklet.addModule(chrome.runtime.getURL('side-panel/pcm-worklet.js'));
    const source = context.createMediaStreamSource(stream);
    const node = new AudioWorkletNode(context, 'pcm-collector');
    const segmenter = new SpeechSegmenter();
    const base = promptInput.value ? promptInput.value.replace(/\s*$/, ' ') : '';
    const run = { stream, context, node, source, segmenter, base, text: '', engine };
    whisperRun = run;
    node.port.onmessage = (event) => {
      for (const phrase of segmenter.push(event.data)) queueTranscription(phrase, run);
    };
    source.connect(node);
    const analyser = context.createAnalyser();
    analyser.fftSize = 512;
    source.connect(analyser);
    showDictationBar('listening');
    run.stopWave = startWaveform(analyser);
    setDictating(true);
    // load the model while the user starts talking (the first load takes a few seconds)
    const warmUp = engine === 'parakeet' ? transcribeParakeet(new Float32Array(SAMPLE_RATE)) : loadWhisper();
    warmUp.catch((err) => {
      showToast((engine === 'parakeet' ? 'Parakeet' : 'Whisper') + ' could not load: ' + (err.message || err));
      whisperEngine = null;
      stopWhisperDictation();
    });
  }

  async function stopWhisperDictation() {
    const run = whisperRun;
    if (!run) return;
    whisperRun = null;
    run.node.port.onmessage = null;
    run.source.disconnect();
    run.stream.getTracks().forEach((t) => t.stop());
    run.context.close().catch(() => null);
    setDictating(false);
    if (run.stopWave) run.stopWave();
    showDictationBar('working');
    const last = run.segmenter.flush();
    if (last) queueTranscription(last, run);
    await whisperQueue;
    commitDictation(run.base, run.text);
  }

  async function startDictation() {
    if (dictationFinishing || dictationStarting) return;
    dictationStarting = true;
    try {
      const engine = await pickDictationEngine();
      if (engine === 'browser') { startBrowserDictation(); return; }
      if (engine === 'whisper') {
        const problem = whisperPreflight();
        if (problem) {
          showToast(problem + ' Using the browser dictation meanwhile.');
          startBrowserDictation();
          return;
        }
      }
      try {
        await startLocalDictation(engine);
      } catch (err) {
        setDictating(false);
        showDictationBar(null);
        showToast(engine + ' could not start (' + (err.message || err) + '). Using the browser dictation.');
        startBrowserDictation();
      }
    } finally {
      dictationStarting = false;
    }
  }

  function startBrowserDictation() {
    if (!SpeechRecognitionCtor) {
      showToast('Dictation is not available in this browser.');
      return;
    }
    const rec = new SpeechRecognitionCtor();
    rec.lang = dictationLang();
    rec.continuous = true;
    rec.interimResults = true;
    const base = promptInput.value ? promptInput.value.replace(/\s*$/, ' ') : '';
    let heard = '';
    let stopWave = () => {};
    let waveStream = null;

    rec.onresult = (event) => {
      let spoken = '';
      for (let i = 0; i < event.results.length; i++) spoken += event.results[i][0].transcript;
      heard = spoken.trimStart();
      setGhost(heard);
    };
    rec.onerror = (event) => {
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') openMicPermissionPage();
      else if (event.error === 'audio-capture') showToast('No microphone found.');
      else if (event.error === 'network') showToast('Dictation needs an internet connection.');
      // "no-speech" and "aborted" just end the session
    };
    rec.onend = () => {
      setDictating(false);
      recognizer = null;
      stopWave();
      if (waveStream) waveStream.getTracks().forEach((t) => t.stop());
      commitDictation(base, heard);
    };
    try {
      rec.start();
      recognizer = rec;
      setDictating(true);
      showDictationBar('listening');
      // the sound waves come from a second look at the microphone
      navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
        if (!recognizer) { stream.getTracks().forEach((t) => t.stop()); return; }
        waveStream = stream;
        const ctx = new AudioContext();
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        ctx.createMediaStreamSource(stream).connect(analyser);
        const stopDraw = startWaveform(analyser);
        stopWave = () => { stopDraw(); ctx.close().catch(() => null); };
      }).catch(() => null);
    } catch (err) {
      setDictating(false);
      showDictationBar(null);
      showToast('Could not start dictation: ' + (err.message || err));
    }
  }

  // ─── Dictation settings: engine (Parakeet via the Bridge / Whisper built in / browser), language, tests ───
  function setWhisperStatus(text, tone = '') {
    const el = document.getElementById('whisperStatus');
    if (el) { el.textContent = text; el.className = `piper-status ${tone}`.trim(); }
  }

  function setParakeetStatus(text, tone = '') {
    const el = document.getElementById('parakeetStatus');
    if (el) { el.textContent = text; el.className = `piper-status ${tone}`.trim(); }
  }

  let parakeetPoll = null;

  async function parakeetRefresh() {
    clearTimeout(parakeetPoll);
    const panel = document.getElementById('parakeetPanel');
    if (!panel || panel.classList.contains('hidden')) return;
    const installBtn = document.getElementById('parakeetInstallBtn');
    const downloadBtn = document.getElementById('parakeetDownloadBtn');
    const testBtn = document.getElementById('parakeetTestBtn');
    const deleteBtn = document.getElementById('parakeetDeleteBtn');
    const progress = document.getElementById('parakeetProgress');
    const bar = document.getElementById('parakeetProgressBar');
    let s;
    try {
      s = await sttJson('/v1/stt/status');
    } catch (err) {
      [installBtn, downloadBtn, testBtn, deleteBtn].forEach((b) => b.classList.add('hidden'));
      progress.classList.add('hidden');
      setParakeetStatus(err.status === 404
        ? 'Your Bridge is too old for this. Use "Restart the Bridge" or "Update" below, then come back.'
        : 'The Bridge is not running, so Parakeet is not available. Whisper Tiny is used meanwhile.', 'bad');
      return;
    }
    const dl = s.download || {};
    const busy = dl.state === 'downloading';
    installBtn.classList.toggle('hidden', s.engine_installed);
    installBtn.disabled = s.engine_installing;
    downloadBtn.classList.toggle('hidden', !s.engine_installed || s.model_installed);
    downloadBtn.disabled = busy;
    testBtn.classList.toggle('hidden', !(s.engine_installed && s.model_installed));
    deleteBtn.classList.toggle('hidden', !s.model_installed && !busy);
    deleteBtn.disabled = busy;
    progress.classList.toggle('hidden', !(busy || s.engine_installing));
    if (s.engine_installing) {
      bar.classList.add('indeterminate');
      setParakeetStatus('Installing the speech engine… about a minute.');
      parakeetPoll = setTimeout(parakeetRefresh, 2000);
    } else if (!s.engine_installed) {
      setParakeetStatus(s.engine_error ? `The engine could not be installed: ${s.engine_error}` : 'Step 1 of 2: install the speech engine (about 150 MB).', s.engine_error ? 'bad' : '');
    } else if (busy) {
      const pct = dl.total ? Math.min(100, Math.round((dl.done / dl.total) * 100)) : 0;
      bar.classList.remove('indeterminate');
      bar.style.width = `${Math.max(pct, 3)}%`;
      const mb = (n) => (n / 1048576).toFixed(0);
      setParakeetStatus(`Downloading the model… ${pct}% (${mb(dl.done)} of ${mb(dl.total)} MB). You can keep using Autono.`);
      parakeetPoll = setTimeout(parakeetRefresh, 1000);
    } else if (dl.state === 'error') {
      setParakeetStatus(`The download failed: ${dl.error}`, 'bad');
    } else if (!s.model_installed) {
      setParakeetStatus('Step 2 of 2: download the model (about 650 MB, one time).');
    } else {
      setParakeetStatus('Ready: Parakeet understands English and Spanish by itself and is used for dictation.', 'ok');
    }
  }

  function renderWhisperSettings() {
    const engineSelect = document.getElementById('whisperEngineSelect');
    const langSelect = document.getElementById('dictationLangSelect');
    if (!engineSelect) return;
    engineSelect.value = dictationEnginePreference();
    if (langSelect) langSelect.value = dictationLanguage();
    document.getElementById('parakeetPanel')?.classList.toggle('hidden', engineSelect.value !== 'parakeet');
    document.getElementById('whisperLocal')?.classList.toggle('hidden', engineSelect.value !== 'whisper');
    if (engineSelect.value === 'parakeet') parakeetRefresh();
    if (engineSelect.value === 'whisper') {
      const problem = whisperPreflight();
      setWhisperStatus(problem || 'Whisper Tiny is built into Autono: nothing to download, and your voice never leaves this computer. Press "Test dictation" to check it.', problem ? 'bad' : '');
    }
  }

  document.getElementById('whisperEngineSelect')?.addEventListener('change', (e) => {
    localStorage.setItem(WHISPER_ENGINE_KEY, e.target.value);
    renderWhisperSettings();
  });
  document.getElementById('dictationLangSelect')?.addEventListener('change', (e) => {
    localStorage.setItem(DICT_LANG_KEY, e.target.value);
  });
  document.getElementById('whisperTestBtn')?.addEventListener('click', async () => {
    const button = document.getElementById('whisperTestBtn');
    button.disabled = true;
    try {
      const problem = whisperPreflight();
      if (problem) throw new Error(problem);
      setWhisperStatus('Loading the Whisper model…');
      const started = performance.now();
      whisperEngine = null;
      await loadWhisper();
      setWhisperStatus('Model loaded. Running a short test…');
      await transcribeWhisper(new Float32Array(SAMPLE_RATE)); // one second of silence
      setWhisperStatus(`Dictation works: the model loaded and ran in ${((performance.now() - started) / 1000).toFixed(1)} s.`, 'ok');
    } catch (err) {
      setWhisperStatus(`Dictation failed: ${err.message || err}`, 'bad');
    } finally {
      button.disabled = false;
    }
  });

  document.getElementById('parakeetInstallBtn')?.addEventListener('click', async () => {
    try {
      await sttJson('/v1/stt/engine/install', { method: 'POST', contentType: 'application/json', body: '{}' });
      parakeetRefresh();
    } catch (err) {
      setParakeetStatus(`Could not start the install: ${err.message}`, 'bad');
    }
  });
  document.getElementById('parakeetDownloadBtn')?.addEventListener('click', async () => {
    try {
      await sttJson('/v1/stt/model/download', { method: 'POST', contentType: 'application/json', body: '{}' });
      parakeetRefresh();
    } catch (err) {
      setParakeetStatus(`Could not start the download: ${err.message}`, 'bad');
    }
  });
  document.getElementById('parakeetDeleteBtn')?.addEventListener('click', async () => {
    try {
      await sttJson('/v1/stt/model', { method: 'DELETE' });
      parakeetRefresh();
    } catch (err) {
      setParakeetStatus(`Could not delete it: ${err.message}`, 'bad');
    }
  });
  document.getElementById('parakeetTestBtn')?.addEventListener('click', async () => {
    const button = document.getElementById('parakeetTestBtn');
    button.disabled = true;
    setParakeetStatus('Loading Parakeet and running a short test…');
    try {
      const started = performance.now();
      await transcribeParakeet(new Float32Array(SAMPLE_RATE * 2));
      setParakeetStatus(`Dictation works: Parakeet loaded and ran in ${((performance.now() - started) / 1000).toFixed(1)} s.`, 'ok');
    } catch (err) {
      setParakeetStatus(`Dictation failed: ${err.message || err}`, 'bad');
    } finally {
      button.disabled = false;
    }
  });

  // The panel is cross-origin isolated (local Whisper needs it), so a remote image whose server does not allow
  // embedding cannot load: hide it instead of showing a broken-image icon.
  document.addEventListener('error', (e) => {
    const el = e.target;
    if (el && el.tagName === 'IMG' && /^https?:/i.test(el.getAttribute('src') || '')) el.style.visibility = 'hidden';
  }, true);

  if (micBtn) {
    micBtn.addEventListener('click', () => (dictating ? stopDictation() : startDictation()));
  }

  toggleCoworkBtn.addEventListener('click', () => {
    isCoworkActive = !isCoworkActive;
    toggleCoworkBtn.classList.toggle('active', isCoworkActive);
    if (isCoworkActive) {
      promptInput.placeholder = 'Asigna una meta para que el agente la realice en el navegador...';
      sendPortMessage({ type: 'ensure_usable_tab' });
    } else {
      promptInput.placeholder = 'Envía un mensaje a Antigravity...';
    }
  });

  // ─── Toast Notice Helper ───────────────────────────────────────────────────
  function showToast(message, duration = 4000) {
    if (!toastNoticeBox) return;
    toastNoticeBox.textContent = message;
    toastNoticeBox.classList.remove('hidden');
    clearTimeout(toastNoticeBox._timeout);
    toastNoticeBox._timeout = setTimeout(() => {
      toastNoticeBox.classList.add('hidden');
    }, duration);
  }

  // ─── Attached Context Chips Management (Zylo Feature) ─────────────────────
  function addAttachedItem(item) {
    attachedItems.push({
      id: generateId(),
      ...item,
    });
    renderAttachedChips();
    handleInputStateChange();
  }

  function removeAttachedItem(id) {
    attachedItems = attachedItems.filter(x => x.id !== id);
    renderAttachedChips();
    handleInputStateChange();
  }

  function renderAttachedChips() {
    if (!attachedChipsContainer) return;
    attachedChipsContainer.innerHTML = '';

    if (attachedItems.length === 0) {
      attachedChipsContainer.classList.add('hidden');
      uploadBtn.classList.remove('active');
      return;
    }

    attachedChipsContainer.classList.remove('hidden');
    uploadBtn.classList.add('active');

    attachedItems.forEach(item => {
      const chip = document.createElement('div');
      chip.className = `attached-chip chip-${item.type || 'file'}`;

      let iconHtml = '';
      if (item.type === 'fragment') {
        iconHtml = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"></circle><path d="M3 7V5a2 2 0 0 1 2-2h2"></path><path d="M17 3h2a2 2 0 0 1 2 2v2"></path><path d="M21 17v2a2 2 0 0 1-2 2h-2"></path><path d="M7 21H5a2 2 0 0 1-2-2v-2"></path></svg>`;
      } else if (item.type === 'tab') {
        iconHtml = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline></svg>`;
      } else if (item.type === 'image' && item.dataUrl) {
        iconHtml = `<img src="${item.dataUrl}" class="attached-chip-thumb" alt="thumb">`;
      } else {
        iconHtml = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg>`;
      }

      chip.innerHTML = `
        ${iconHtml}
        <span class="attached-chip-name" title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</span>
        <button type="button" class="attached-chip-remove" title="Remove">&times;</button>
      `;

      chip.querySelector('.attached-chip-remove').addEventListener('click', (e) => {
        e.stopPropagation();
        removeAttachedItem(item.id);
      });

      attachedChipsContainer.appendChild(chip);
    });
  }

  // ─── Attach Context Menu & Actions ─────────────────────────────────────────
  uploadBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    attachMenuPopover.classList.toggle('hidden');
  });

  document.addEventListener('click', (e) => {
    if (attachMenuPopover && !attachMenuPopover.contains(e.target) && e.target !== uploadBtn) {
      attachMenuPopover.classList.add('hidden');
    }
  });

  // 1. Local Files (Multi-File: text, code, json, markdown, images)
  attachFilesBtn.addEventListener('click', () => {
    attachMenuPopover.classList.add('hidden');
    hiddenMultiFileInput.click();
  });

  hiddenMultiFileInput.addEventListener('change', async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      if (f.size > 3 * 1024 * 1024) {
        showToast(`El archivo ${f.name} excede el límite recomendado de 3MB.`);
        continue;
      }

      if (f.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (event) => {
          addAttachedItem({
            type: 'image',
            name: f.name,
            dataUrl: event.target.result,
            content: `[Attached Image: ${f.name}]`,
          });
        };
        reader.readAsDataURL(f);
      } else {
        try {
          const text = await f.text();
          addAttachedItem({
            type: 'file',
            name: f.name,
            content: text,
          });
          const ext = f.name.split('.').pop() || 'txt';
          sessionActiveFiles.set(f.name, {
            filename: f.name,
            content: text,
            type: ext,
            ext: ext,
            lang: ext,
            version: 1,
            isModified: false,
            uploaded: true,
            sizeBytes: f.size,
          });
        } catch (err) {
          console.error('Error reading file:', err);
        }
      }
    }
    hiddenMultiFileInput.value = '';
  });

  // 2. Interactive Page Fragment Picker (Zylo Feature)
  attachPickerBtn.addEventListener('click', async () => {
    attachMenuPopover.classList.add('hidden');
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) {
        showToast('No active tab found.');
        return;
      }
      if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('edge://')) {
        showToast('Element picker does not work on internal browser pages. Open a regular web page.');
        return;
      }

      isPickingFragment = true;
      try {
        await chrome.tabs.sendMessage(tab.id, { type: 'antigravity_start_picker' });
        showToast('Picker mode active: Click on an element or press Esc to cancel.');
      } catch {
        // Tab was opened before extension load: inject content script on demand and retry
        await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content/content.js'] });
        await chrome.tabs.sendMessage(tab.id, { type: 'antigravity_start_picker' });
        showToast('Picker mode active: Click on an element or press Esc to cancel.');
      }
    } catch (err) {
      isPickingFragment = false;
      showToast('Could not activate element picker on this tab.');
    }
  });

  // 3. Open Tabs Context (Zylo Feature)
  attachTabsBtn.addEventListener('click', async () => {
    attachMenuPopover.classList.add('hidden');
    try {
      const tabs = await chrome.tabs.query({ currentWindow: true });
      openTabsList = tabs.filter(t => t.id !== undefined && t.url && /^https?:/.test(t.url));
      selectedTabIds.clear();
      renderTabsModalList();
      tabsModal.classList.remove('hidden');
    } catch (err) {
      console.error('Error fetching tabs:', err);
      showToast('Error retrieving tabs list.');
    }
  });

  function renderTabsModalList() {
    tabsListContainer.innerHTML = '';
    if (openTabsList.length === 0) {
      tabsListContainer.innerHTML = '<div style="color:#71717a;font-size:12px;padding:12px;text-align:center;">No open web tabs found.</div>';
      confirmAttachTabsBtn.disabled = true;
      confirmAttachTabsBtn.textContent = 'Attach (0)';
      return;
    }

    openTabsList.forEach(t => {
      const row = document.createElement('label');
      row.className = 'tab-select-item';
      const isChecked = selectedTabIds.has(t.id);
      row.innerHTML = `
        <input type="checkbox" value="${t.id}" ${isChecked ? 'checked' : ''}>
        <span class="tab-select-title" title="${escapeHtml(t.title || t.url)}">${escapeHtml(t.title || t.url)}</span>
      `;

      row.querySelector('input').addEventListener('change', (e) => {
        if (e.target.checked) {
          selectedTabIds.add(t.id);
        } else {
          selectedTabIds.delete(t.id);
        }
        confirmAttachTabsBtn.disabled = selectedTabIds.size === 0;
        confirmAttachTabsBtn.textContent = `Attach (${selectedTabIds.size})`;
      });

      tabsListContainer.appendChild(row);
    });

    confirmAttachTabsBtn.disabled = selectedTabIds.size === 0;
    confirmAttachTabsBtn.textContent = `Attach (${selectedTabIds.size})`;
  }

  closeTabsBtn.addEventListener('click', () => tabsModal.classList.add('hidden'));
  cancelTabsBtn.addEventListener('click', () => tabsModal.classList.add('hidden'));

  confirmAttachTabsBtn.addEventListener('click', async () => {
    confirmAttachTabsBtn.disabled = true;
    confirmAttachTabsBtn.textContent = 'Attaching...';

    const chosenTabs = openTabsList.filter(t => selectedTabIds.has(t.id));
    for (const t of chosenTabs) {
      let pageText = '';
      try {
        const [result] = await chrome.scripting.executeScript({
          target: { tabId: t.id },
          func: () => document.body?.innerText?.slice(0, 65536) ?? '',
        });
        pageText = String(result?.result ?? '');
      } catch {
        pageText = '(Textual content not accessible)';
      }

      addAttachedItem({
        type: 'tab',
        name: `Tab: ${(t.title || t.url || 'Web').slice(0, 30)}`,
        content: `Tab attached as context:\nTitle: ${t.title || ''}\nURL: ${t.url || ''}\n\nVisible text:\n${pageText}`,
      });
    }

    // Optional grouping in Chrome
    try {
      const tabIds = chosenTabs.map(t => t.id);
      chrome.runtime.sendMessage({ type: 'zylo_group_tabs', tabIds }).catch(() => null);
    } catch {}

    tabsModal.classList.add('hidden');
    showToast(`${chosenTabs.length} tab(s) attached as context.`);
  });

  // 4. Capture Visible Tab Screenshot
  attachScreenshotBtn.addEventListener('click', async () => {
    attachMenuPopover.classList.add('hidden');
    try {
      const screenshotUrl = await chrome.tabs.captureVisibleTab(null, { format: 'jpeg', quality: 75 });
      if (screenshotUrl) {
        addAttachedItem({
          type: 'image',
          name: 'Visible Screenshot',
          dataUrl: screenshotUrl,
          content: '[Captured visible tab screenshot]',
        });
        showToast('Visible screenshot attached.');
      }
    } catch (err) {
      console.warn('Screenshot failed:', err);
      showToast('Could not capture screenshot on this tab.');
    }
  });

  // Textarea state & auto-resize (ultra-compact 22px single-line, auto-growing up to 140px)
  function handleInputStateChange() {
    promptInput.style.height = '22px';
    const scrollH = promptInput.scrollHeight;
    if (scrollH > 26) {
      promptInput.style.overflowY = 'auto';
      promptInput.style.height = Math.min(scrollH, 140) + 'px';
    } else {
      promptInput.style.overflowY = 'hidden';
      promptInput.style.height = '22px';
    }

    const hasText = promptInput.value.trim().length > 0 || attachedItems.length > 0;
    sendBtn.disabled = !hasText || isGenerating;
    if (hasText && !isGenerating) {
      sendBtn.classList.add('active');
    } else {
      sendBtn.classList.remove('active');
    }
  }

  promptInput.addEventListener('input', () => {
    handleInputStateChange();
    handleSlashInput();
  });

  promptInput.addEventListener('keydown', (e) => {
    if (handleSlashKeydown(e)) return;
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  });

  // ─── Send / Stop Execution (with TinyFish Web Search & CoT) ─────────────────
  async function handleSend() {
    const text = promptInput.value.trim();
    if (!text && attachedItems.length === 0) return;

    // Real-time user intervention while agent is executing
    if (isGenerating) {
      if (text) {
        sendPortMessage({ type: 'user_intervention', text });
        createMessageRow('user', `✍ **Instruction:** ${text}`);
        promptInput.value = '';
        handleInputStateChange();
        showLiveActivity(`✍ Instruction sent: "${text.slice(0, 30)}..."`);
      }
      return;
    }

    // Direct /btw sidecar shortcut handling
    if (text.startsWith('/btw')) {
      const sideQuestion = text.replace(/^\/btw\s*/i, '').trim();
      openBtwPopup(sideQuestion);
      promptInput.value = '';
      hideSlashMenu();
      handleInputStateChange();
      return;
    }

    // Direct /skill reusable skill creator shortcut handling
    if (text.startsWith('/skill')) {
      const remainder = text.replace(/^\/skill\s*/i, '').trim();
      promptInput.value = '';
      hideSlashMenu();
      handleInputStateChange();
      openSkillCreatorModal(remainder);
      return;
    }

    hideAiPromptSuggestions();

    let displayPrompt = text;
    let finalPrompt = text;

    // Check if prompt is a direct invocation of a custom skill
    if (text.startsWith('/')) {
      const firstWord = text.split(/\s+/)[0].slice(1).toLowerCase();
      const matchedSkill = customSkills.find(s => s.name.toLowerCase() === firstWord);
      if (matchedSkill) {
        if (matchedSkill.mode === 'cowork' && !isCoworkActive) {
          toggleCoworkMode(true);
        } else if (matchedSkill.mode === 'chat' && isCoworkActive) {
          toggleCoworkMode(false);
        }
        const userArg = text.slice(firstWord.length + 1).trim();
        finalPrompt = userArg ? `${matchedSkill.prompt}\n\nDetalles del usuario: ${userArg}` : matchedSkill.prompt;
        displayPrompt = userArg ? `⚡ /${matchedSkill.name} ${userArg}` : `⚡ /${matchedSkill.name}`;
      }
    }

    let searchCardHtml = '';

    if (dictating) stopDictation();
    stopSpeaking();
    lastUserPrompt = text;
    lastAttachedItems = Array.isArray(attachedItems) ? [...attachedItems] : [];
    lastSearchSources = [];

    // If Search is active, perform TinyFish search!
    // (greetings and slash commands are not worth a web search)
    if (isSearchActive && text && text.length >= 8 && !text.startsWith('/')) {
      showLiveActivity('🔍 Buscando en la web con TinyFish AI...');
      try {
        const searchResp = await searchWithTinyFish(text, {
          apiKey: tinyFishApiKey,
          purpose: 'Asistencia al usuario y consulta web',
        });
        if (searchResp && searchResp.results && searchResp.results.length > 0) {
          const searchContext = formatTinyFishForPrompt(searchResp);
          finalPrompt = `${finalPrompt}\n\n${searchContext}`;

          lastSearchSources = searchResp.results.map(r => {
            let domain = r.site_name || '';
            try {
              if (!domain && r.url) domain = new URL(r.url).hostname.replace(/^www\./, '');
            } catch (e) {
              domain = 'web';
            }
            return {
              title: r.title,
              url: r.url,
              domain: domain || 'web',
              snippet: r.snippet,
              favicon: `https://www.google.com/s2/favicons?domain=${domain}&sz=32`,
            };
          });

          // Create visual search sources card for the user
          const sourcesList = searchResp.results.slice(0, 4).map(r => `
            <a href="${escapeHtml(r.url)}" target="_blank" rel="noopener noreferrer" class="tinyfish-source-item">
              <span class="tinyfish-source-title">${escapeHtml(r.title)} (${escapeHtml(r.site_name || 'Web')})</span>
              <span class="tinyfish-source-snippet">${escapeHtml(r.snippet?.slice(0, 110) || '')}...</span>
            </a>
          `).join('');

          searchCardHtml = `
            <div class="tinyfish-search-box">
              <div class="tinyfish-search-header">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="2" y1="12" x2="22" y2="12"></line>
                  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1 4-10z"></path>
                </svg>
                <span>Fuentes de TinyFish AI (${searchResp.results.length} resultados)</span>
              </div>
              <div class="tinyfish-sources-list">${sourcesList}</div>
            </div>
          `;
        }
      } catch (searchErr) {
        console.warn('TinyFish search error:', searchErr);
      }
    }

    // Format attached files, fragments and tabs (Zylo structured tags)
    let firstImageDataUrl = null;
    if (attachedItems.length > 0) {
      const fileParts = [];
      const userDisplayList = [];

      for (const item of attachedItems) {
        if (item.type === 'image' && item.dataUrl) {
          if (!firstImageDataUrl) firstImageDataUrl = item.dataUrl;
          userDisplayList.push(`📷 ${item.name}`);
        } else {
          fileParts.push(`<nano_file_content type="${item.type || 'file'}" name="${item.name}">\n${item.content}\n</nano_file_content>`);
          userDisplayList.push(`📎 ${item.name}`);
        }
      }

      if (fileParts.length > 0) {
        const attachedXml = `\n\n<nano_attached_files>\n${fileParts.join('\n')}\n</nano_attached_files>`;
        finalPrompt += attachedXml;
      }

      const filesHeader = userDisplayList.join('\n');
      displayPrompt = displayPrompt ? `${displayPrompt}\n\n${filesHeader}` : filesHeader;
    }

    // Feed active session files context for modifications and file tools
    if (sessionActiveFiles.size > 0 && !finalPrompt.includes('<active_session_files>')) {
      const activeFileList = Array.from(sessionActiveFiles.entries()).slice(-6).map(([fname, a]) => {
        return `<file name="${fname}" version="${a.version}">\n${a.content.slice(0, 3000)}\n</file>`;
      }).join('\n');
      finalPrompt += `\n\n<active_session_files>\n${activeFileList}\n</active_session_files>\n[Instrucción de archivos: Puedes crear y modificar archivos PDF, DOCX, HTML, SVG, Markdown y scripts de código. Si el usuario pide modificar un archivo existente, genera la versión actualizada completa usando el bloque con el mismo nombre ej: \`\`\`ext:nombre.ext]`;
    }

    // Create user message row
    const userRowBubble = createMessageRow('user', displayPrompt, firstImageDataUrl);
    if (searchCardHtml && userRowBubble) {
      const cardContainer = document.createElement('div');
      cardContainer.innerHTML = searchCardHtml;
      userRowBubble.parentElement?.appendChild(cardContainer);
    }

    // Clear composer
    promptInput.value = '';
    attachedItems = [];
    renderAttachedChips();
    handleInputStateChange();

    const taskId = generateId();
    const mode = isCoworkActive ? 'cowork' : 'chat';
    const screenshotToSend = firstImageDataUrl;

    // IMMEDIATE VISUAL FEEDBACK: Show thinking indicator right away!
    isGenerating = true;
    currentTaskId = taskId;
    toggleInputState(true);
    hideLiveActivity();

    if (mode === 'chat') {
      currentStreamingText = '';
      currentStreamingBubble = createMessageRow('assistant', '');
      if (currentStreamingBubble) {
        currentStreamingBubble.innerHTML = renderThinkingBubbleHtml('Thinking and analyzing screen...');
      }
    } else {
      currentCoworkBubble = null;
      currentPlanData = null;
      currentIntroText = '';
      currentCoworkBubble = createMessageRow('assistant', '', null, null, null, '');
      if (currentCoworkBubble) {
        currentCoworkBubble.innerHTML = renderThinkingBubbleHtml('Analyzing page...');
      }
    }
    scrollToBottom();

    const effectiveProvider = modelRoute || (isClaudeModel(currentModel)
      ? 'claude'
      : (isOpenAIModel(currentModel) ? 'openai' : (activeModelTab || 'antigravity')));

    lastTaskProvider = effectiveProvider;
    if (mode === 'chat') {
      sendPortMessage({
        type: 'start_chat',
        taskId,
        sessionId: currentSessionId,
        userText: finalPrompt,
        displayPrompt: displayPrompt,
        modelName: currentModel,
        thinkingEffort: currentThinkingEffort,
        includeScreenshot: !!screenshotToSend,
        provider: effectiveProvider,
      });
    } else {
      sendPortMessage({
        type: 'start_cowork',
        taskId,
        sessionId: currentSessionId,
        goalText: finalPrompt,
        displayGoal: displayPrompt,
        modelName: currentModel,
        thinkingEffort: currentThinkingEffort,
        provider: effectiveProvider,
      });
    }

    sendPortMessage({
      type: 'set_active_session',
      sessionId: currentSessionId,
    });
  }

  function handleStop() {
    if (!isGenerating) return;
    sendPortMessage({ type: 'cancel_task' });
  }

  sendBtn.addEventListener('click', () => {
    if (promptInput.value.trim() || attachedImageDataUrl) {
      handleSend();
    }
  });

  stopBtn.addEventListener('click', handleStop);

  function toggleInputState(generating) {
    if (generating) {
      stopBtn.classList.remove('hidden');
      sendBtn.classList.remove('hidden');
      sendBtn.title = 'Enviar intervención';
      promptInput.disabled = false;
      promptInput.placeholder = 'Escribe para intervenir o dar una indicación...';
    } else {
      sendBtn.classList.remove('hidden');
      sendBtn.title = 'Enviar mensaje';
      stopBtn.classList.add('hidden');
      promptInput.disabled = false;
      promptInput.placeholder = isCoworkActive
        ? 'Asigna una meta para que el agente la realice en el navegador...'
        : 'Envía un mensaje a Antigravity...';
      promptInput.focus();
      handleInputStateChange();
    }
  }

  // ─── Viewport & Message Rendering ───────────────────────────────────────────
  let isUserScrolledUp = false;
  if (chatViewport) {
    chatViewport.addEventListener('scroll', () => {
      const distanceFromBottom = chatViewport.scrollHeight - chatViewport.scrollTop - chatViewport.clientHeight;
      isUserScrolledUp = distanceFromBottom > 90;
    }, { passive: true });
  }

  function scrollToBottom(force = false) {
    if (chatViewport) {
      if (force) {
        isUserScrolledUp = false;
        chatViewport.scrollTop = chatViewport.scrollHeight;
      } else if (!isUserScrolledUp) {
        chatViewport.scrollTop = chatViewport.scrollHeight;
      }
    }
  }

  function showLiveActivity(text) {
    const cleanText = (text || '').replace(/^[⚡✦]\s*/, '');
    const activeBubble = currentCoworkBubble || currentStreamingBubble;
    const shimmerEl = activeBubble?.querySelector?.('.thinking-shimmer-text');
    if (shimmerEl) {
      shimmerEl.textContent = cleanText;
    }
    if (liveActivityBox) {
      liveActivityBox.classList.add('hidden');
    }
    scrollToBottom();
  }

  function hideLiveActivity() {
    if (liveActivityBox) {
      liveActivityBox.classList.add('hidden');
    }
  }

  // ─── Agent Planning Timeline UI Helpers ─────────────────────────────────────
  const PLANNING_ICONS = {
    search: `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><path d="m21 21-4.3-4.3"></path></svg>`,
    'file-text': `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"></path><path d="M14 2v4a2 2 0 0 0 2 2h4"></path><path d="M10 9H8"></path><path d="M16 13H8"></path><path d="M16 17H8"></path></svg>`,
    brain: `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z"></path><path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z"></path><path d="M12 3v18"></path></svg>`,
    terminal: `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 17 10 11 4 5"></polyline><line x1="12" x2="20" y1="19" y2="19"></line></svg>`,
    code: `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>`,
    alert: `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`,
    check: `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`,
    loader: `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="agent-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"></path></svg>`,
    chevronDown: `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>`,
  };

  function convertLegacyStepsToPlan(steps) {
    if (!steps || !Array.isArray(steps) || steps.length === 0) return null;
    return {
      title: 'Execution Steps Plan',
      steps: steps.map((s, idx) => ({
        id: `step-${s.step || idx + 1}`,
        title: s.description || `Step ${s.step || idx + 1}: ${s.action || 'Action'}`,
        status: 'success',
        duration: s.duration || `${(0.4 + idx * 0.3).toFixed(1)}s`,
        details: `${s.thought ? s.thought + '\n\n' : ''}Action: [${(s.action || 'action').toUpperCase()}]\nResult: ${s.result || 'Completed'}`,
        icon: s.action === 'click' ? 'terminal' : s.action === 'type' ? 'code' : s.action === 'navigate' ? 'search' : 'file-text',
      })),
    };
  }

  function renderAgentPlanningHtml(plan, isGenerating = false) {
    if (!plan || !plan.steps || plan.steps.length === 0) return '';

    const title = escapeHtml(plan.title || 'Execution Plan');
    const hasActive = plan.steps.some(s => s.status === 'active') || isGenerating;
    const allSuccess = plan.steps.every(s => s.status === 'success');

    let headerBadgeSvg = PLANNING_ICONS.brain;
    let headerBadgeClass = 'pending';
    if (hasActive) {
      headerBadgeSvg = PLANNING_ICONS.loader;
      headerBadgeClass = 'active';
    } else if (allSuccess) {
      headerBadgeSvg = PLANNING_ICONS.check;
      headerBadgeClass = 'success';
    }

    const stepsHtml = plan.steps.map((step, idx) => {
      const status = step.status || 'pending';
      let stepIconSvg = step.icon && PLANNING_ICONS[step.icon] ? PLANNING_ICONS[step.icon] : PLANNING_ICONS.brain;
      if (status === 'success') stepIconSvg = PLANNING_ICONS.check;
      else if (status === 'active') stepIconSvg = PLANNING_ICONS.loader;
      else if (status === 'error') stepIconSvg = PLANNING_ICONS.alert;

      const hasDetails = !!step.details;
      const isExpanded = step.defaultExpanded || false;

      return `
        <div class="agent-planning-step ${status} ${isExpanded ? 'expanded' : ''}" data-step-id="${escapeHtml(step.id)}">
          <div class="agent-step-icon-col">
            <div class="agent-step-badge ${status}">
              ${stepIconSvg}
            </div>
          </div>
          <div class="agent-step-content-col">
            <div class="agent-step-header-row" ${hasDetails ? 'role="button" tabindex="0"' : ''}>
              <span class="agent-step-title">${escapeHtml(step.title)}</span>
              <div class="agent-step-meta">
                ${step.duration ? `<span class="agent-step-duration">${escapeHtml(step.duration)}</span>` : ''}
                ${hasDetails ? `<span class="agent-step-chevron">${PLANNING_ICONS.chevronDown}</span>` : ''}
              </div>
            </div>
            ${hasDetails ? `
              <div class="agent-step-detail-box">
                ${escapeHtml(step.details)}
              </div>
            ` : ''}
          </div>
        </div>
      `;
    }).join('');

    return `
      <div class="agent-planning-container">
        <div class="agent-planning-card">
          <div class="agent-planning-header" role="button" tabindex="0">
            <div class="agent-planning-header-left">
              <span class="agent-step-badge ${headerBadgeClass}" style="width:20px;height:20px;">
                ${headerBadgeSvg}
              </span>
              <span class="agent-planning-title">${title}</span>
            </div>
            <span class="agent-planning-chevron">${PLANNING_ICONS.chevronDown}</span>
          </div>
          <div class="agent-planning-body">
            ${stepsHtml}
          </div>
        </div>
      </div>
    `;
  }

  function cleanUserPromptForDisplay(text) {
    if (!text || typeof text !== 'string') return '';
    return text
      .replace(/<active_session_files>[\s\S]*?<\/active_session_files>/gi, '')
      .replace(/\[Instrucción de archivos:[\s\S]*?\]/gi, '')
      .replace(/<nano_attached_files>[\s\S]*?<\/nano_attached_files>/gi, '')
      .replace(/<approval_response>[\s\S]*?<\/approval_response>/gi, '')
      .trim();
  }

  function createMessageRow(role, rawContent = '', imageUrl = null, steps = null, plan = null, intro = null) {
    if (typeof rawContent !== 'string') {
      rawContent = rawContent ? String(rawContent) : '';
    }

    welcomeHero.classList.add('hidden');
    messagesContainer.classList.remove('hidden');

    const row = document.createElement('div');
    row.className = `message-row ${role}`;

    if (role === 'user') {
      const bubble = document.createElement('div');
      bubble.className = 'user-bubble';
      if (imageUrl) {
        const img = document.createElement('img');
        img.src = imageUrl;
        img.className = 'user-attachment-thumb';
        bubble.appendChild(img);
      }
      const textSpan = document.createElement('div');
      textSpan.textContent = cleanUserPromptForDisplay(rawContent);
      bubble.appendChild(textSpan);
      row.appendChild(bubble);
    } else {
      // Assistant
      const avatar = document.createElement('div');
      avatar.className = 'assistant-avatar';
      const activeModelKey = currentBaseModelId || currentModel;
      const isClaude = isClaudeModel(activeModelKey);
      const isOpenAI = isOpenAIModel(activeModelKey);
      if (isClaude) {
        avatar.innerHTML = `<img src="../assets/claude-icon-32.png" width="18" height="18" alt="Claude">`;
      } else if (isOpenAI) {
        avatar.innerHTML = `<img src="../assets/chatgpt-icon-32.png" width="18" height="18" alt="ChatGPT">`;
      } else {
        avatar.innerHTML = `<img src="../assets/antigravity-icon-32.png" width="18" height="18" alt="Antigravity">`;
      }
      row.appendChild(avatar);

      const content = document.createElement('div');
      content.className = 'assistant-content';

      const activePlan = plan || (steps && steps.length > 0 ? convertLegacyStepsToPlan(steps) : null);
      let introHtml = '';
      if (intro) {
        introHtml = `<div class="cowork-intro-phrase">${renderMarkdown(intro)}</div>`;
      }

      let planHtml = '';
      if (activePlan) {
        planHtml = renderAgentPlanningHtml(activePlan, false);
      }

      let reportHtml = '';
      if (rawContent) {
        reportHtml = renderMarkdown(rawContent);
        if (activePlan) {
          reportHtml = `<div class="cowork-report-container">${reportHtml}</div>`;
        }
      }

      content.innerHTML = introHtml + planHtml + reportHtml;
      row.appendChild(content);
      mountAllApprovalCards(content);
      if (rawContent) {
        appendStreamingResponseBar(content, rawContent, (activePlan?.sources || []));
      }
      updateContextMeter();
    }

    messagesContainer.appendChild(row);
    scrollToBottom();
    return role === 'user' ? row.querySelector('.user-bubble') : row.querySelector('.assistant-content');
  }

  function renderSessionMessages(messages) {
    messagesContainer.innerHTML = '';
    if (!Array.isArray(messages) || messages.length === 0) {
      welcomeHero.classList.remove('hidden');
      messagesContainer.classList.add('hidden');
      hideAiPromptSuggestions();
      return;
    }
    welcomeHero.classList.add('hidden');
    messagesContainer.classList.remove('hidden');
    messages.forEach(m => {
      try {
        if (!m || typeof m !== 'object') return;
        createMessageRow(m.role || 'assistant', m.content || '', m.hasScreenshot ? 'attached' : null, m.steps, m.plan, m.intro);
      } catch (err) {
        console.warn('Error rendering session message:', err, m);
      }
    });

    // Render suggestions from the latest assistant message so chips persist upon reopening!
    const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant' && m.content);
    if (lastAssistant && lastAssistant.content) {
      renderAiPromptSuggestions(lastAssistant.content);
    } else {
      hideAiPromptSuggestions();
    }
    scrollToBottom(true);
  }

  // Suggestion chips & 3-Up Grid Cards
  document.querySelectorAll('.chatgpt-suggestion-chip, .suggestion-grid-card').forEach(chip => {
    chip.addEventListener('click', () => {
      const p = chip.getAttribute('data-prompt');
      if (p) {
        promptInput.value = p;
        handleInputStateChange();
        handleSend();
      }
    });
  });

  // ─── Intelligent Title Suggestion Banner & Auto-Naming ───────────────────────
  const titleSuggestionBanner = document.getElementById('titleSuggestionBanner');
  const suggestedTitleText = document.getElementById('suggestedTitleText');
  const acceptTitleBtn = document.getElementById('acceptTitleBtn');
  const editTitleBtn = document.getElementById('editTitleBtn');
  const dismissTitleBtn = document.getElementById('dismissTitleBtn');
  let currentSuggestedTitle = '';
  const pendingTitleSessions = new Set();

  function generateSmartTitle(promptText, summaryText) {
    let raw = (promptText || '').replace(/^\/\S+\s*/, '').trim();
    // Remove common conversational prefixes
    raw = raw.replace(/^(por favor|porfa|necesito que|quiero que|ayúdame a|hazme|crea|resume|analiza|explica|busca|investiga|dime|puedes|generate|summarize|please)\s+/i, '');
    if (!raw && summaryText) {
      raw = summaryText.split('\n')[0].replace(/^#+\s*/, '').trim();
    }
    const words = raw.split(/\s+/).filter(w => w.length > 1).slice(0, 5);
    if (words.length === 0) return 'New Chat';
    const title = words.join(' ').replace(/[.,;:!?]+$/, '');
    return title.charAt(0).toUpperCase() + title.slice(1);
  }

  function showTitleSuggestionBanner(title) {
    if (!titleSuggestionBanner || !suggestedTitleText) return;
    currentSuggestedTitle = title;
    suggestedTitleText.textContent = title;
    titleSuggestionBanner.classList.remove('hidden');

    // Also proactively update the active session's title in memory and storage so history reflects it
    const session = allSessions.find(s => s.id === currentSessionId);
    if (session) {
      session.title = title;
      session.updatedAt = Date.now();
      sendPortMessage({ type: 'rename_session', sessionId: currentSessionId, title });
    }
  }

  function hideTitleSuggestionBanner() {
    if (titleSuggestionBanner) {
      titleSuggestionBanner.classList.add('hidden');
    }
  }

  if (acceptTitleBtn) {
    acceptTitleBtn.addEventListener('click', () => {
      const session = allSessions.find(s => s.id === currentSessionId);
      if (session && currentSuggestedTitle) {
        session.title = currentSuggestedTitle;
        session.updatedAt = Date.now();
        sendPortMessage({ type: 'rename_session', sessionId: currentSessionId, title: currentSuggestedTitle });
        showToast(`Title accepted: "${currentSuggestedTitle}"`);
      }
      hideTitleSuggestionBanner();
    });
  }

  if (editTitleBtn) {
    editTitleBtn.addEventListener('click', () => {
      const custom = prompt('Edit chat title:', currentSuggestedTitle);
      if (custom && custom.trim()) {
        const clean = custom.trim();
        const session = allSessions.find(s => s.id === currentSessionId);
        if (session) {
          session.title = clean;
          session.updatedAt = Date.now();
          sendPortMessage({ type: 'rename_session', sessionId: currentSessionId, title: clean });
          showToast(`Title updated: "${clean}"`);
        }
      }
      hideTitleSuggestionBanner();
    });
  }

  if (dismissTitleBtn) {
    dismissTitleBtn.addEventListener('click', hideTitleSuggestionBanner);
  }

  function handleAutoNamingAfterTask(answerText) {
    const session = allSessions.find(s => s.id === currentSessionId);
    const isGeneric = !session || !session.title || session.title === 'New Chat' || session.title === 'Nuevo Chat' || session.title.endsWith('...') || session.title === 'Chat';
    if (isGeneric && lastUserPrompt && !pendingTitleSessions.has(currentSessionId)) {
      // Ask the model for the title; the background replies with session_title (or session_title_failed → heuristic fallback)
      pendingTitleSessions.add(currentSessionId);
      sendPortMessage({
        type: 'generate_title',
        sessionId: currentSessionId,
        prompt: lastUserPrompt,
        answer: String(answerText || '').slice(0, 1200),
        modelName: currentModel,
        provider: lastTaskProvider,
      });
    }
  }

  // ─── Format Session Timestamp (e.g. "Today, 14:32", "Yesterday, 10:15", "21 Sep, 11:00") ──
  function formatSessionTimestamp(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    if (isNaN(d.getTime())) return '';
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday = d.toDateString() === yesterday.toDateString();

    const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (isToday) return `Today, ${timeStr}`;
    if (isYesterday) return `Yesterday, ${timeStr}`;
    return `${d.toLocaleDateString([], { day: 'numeric', month: 'short' })}, ${timeStr}`;
  }

  // ─── New Chat & Advanced History Drawer (Folders, Inline Rename, Search) ───
  let historyFolders = ['General', 'Coding', 'Investigación'];
  try {
    const savedFolders = localStorage.getItem('antigravity_history_folders');
    if (savedFolders) historyFolders = JSON.parse(savedFolders);
  } catch (_) {}

  let currentHistoryFolder = 'all';
  let historySearchQuery = '';

  function startNewChat() {
    if (isGenerating) {
      currentStreamingBubble = null;
      currentCoworkBubble = null;
      currentPlanData = null;
      currentIntroText = '';
      isGenerating = false;
      currentTaskId = null;
      toggleInputState(false);
      hideLiveActivity();
    }
    currentSessionId = generateId();
    messagesContainer.innerHTML = '';
    welcomeHero.classList.remove('hidden');
    messagesContainer.classList.add('hidden');
    hideTitleSuggestionBanner();
    sendPortMessage({ type: 'set_active_session', sessionId: currentSessionId });
    if (promptInput) {
      promptInput.value = '';
      handleInputStateChange();
      promptInput.focus();
    }
  }

  newChatBtn.addEventListener('click', startNewChat);

  const drawerNewChatBtn = document.getElementById('drawerNewChatBtn');
  if (drawerNewChatBtn) {
    drawerNewChatBtn.addEventListener('click', () => {
      startNewChat();
      historyDrawer.classList.add('hidden');
    });
  }

  historyBtn.addEventListener('click', () => {
    renderHistoryList();
    historyDrawer.classList.remove('hidden');
  });

  closeHistoryBtn.addEventListener('click', () => {
    historyDrawer.classList.add('hidden');
  });

  const historySearchInput = document.getElementById('historySearchInput');
  if (historySearchInput) {
    historySearchInput.addEventListener('input', (e) => {
      historySearchQuery = (e.target.value || '').trim();
      renderHistoryList();
    });
  }

  function renderHistoryFoldersBar() {
    const bar = document.getElementById('historyFoldersBar');
    if (!bar) return;
    bar.innerHTML = '';

    // "All" Pill
    const allPill = document.createElement('button');
    allPill.type = 'button';
    allPill.className = `folder-pill ${currentHistoryFolder === 'all' ? 'active' : ''}`;
    allPill.textContent = 'All';
    allPill.addEventListener('click', () => {
      currentHistoryFolder = 'all';
      renderHistoryFoldersBar();
      renderHistoryList();
    });
    bar.appendChild(allPill);

    // Dynamic Folder Pills
    historyFolders.forEach((f) => {
      const pill = document.createElement('button');
      pill.type = 'button';
      pill.className = `folder-pill ${currentHistoryFolder.toLowerCase() === f.toLowerCase() ? 'active' : ''}`;
      pill.textContent = f;
      pill.addEventListener('click', () => {
        currentHistoryFolder = f;
        renderHistoryFoldersBar();
        renderHistoryList();
      });
      bar.appendChild(pill);
    });

    // Add Folder Button
    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.id = 'addFolderBtn';
    addBtn.className = 'folder-pill add-folder-btn';
    addBtn.title = 'Create new folder';
    addBtn.textContent = '+ Folder';
    addBtn.addEventListener('click', () => {
      const name = prompt('Name of new folder:');
      if (name && name.trim()) {
        const clean = name.trim();
        if (!historyFolders.some(f => f.toLowerCase() === clean.toLowerCase())) {
          historyFolders.push(clean);
          try {
            localStorage.setItem('antigravity_history_folders', JSON.stringify(historyFolders));
          } catch (_) {}
          currentHistoryFolder = clean;
          renderHistoryFoldersBar();
          renderHistoryList();
        }
      }
    });
    bar.appendChild(addBtn);
  }

  function renderHistoryList() {
    if (!sessionsList) return;
    sessionsList.innerHTML = '';
    renderHistoryFoldersBar();

    let list = [...(allSessions || [])];

    // Sort by updatedAt descending (most recent first)
    list.sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0));

    // Filter by Folder
    if (currentHistoryFolder !== 'all') {
      list = list.filter(s => (s.folder || 'General').toLowerCase() === currentHistoryFolder.toLowerCase());
    }

    // Filter by Search Query
    if (historySearchQuery) {
      const q = historySearchQuery.toLowerCase();
      list = list.filter(s => {
        const tMatch = (s.title || '').toLowerCase().includes(q);
        const mMatch = Array.isArray(s.messages) && s.messages.some(m => (m.content || '').toLowerCase().includes(q));
        return tMatch || mMatch;
      });
    }

    const countBadge = document.getElementById('historySessionsCount');
    if (countBadge) {
      countBadge.textContent = `${list.length} chat${list.length === 1 ? '' : 's'}`;
    }

    if (list.length === 0) {
      sessionsList.innerHTML = '<p style="color:#737373;text-align:center;padding:28px 16px;font-size:12.5px;">No chats found.</p>';
      return;
    }

    list.forEach((s) => {
      const item = document.createElement('div');
      item.className = `session-item ${s.id === currentSessionId ? 'active' : ''}`;
      const folderName = s.folder || 'General';
      const timeStr = formatSessionTimestamp(s.updatedAt || s.createdAt || Date.now());

      item.innerHTML = `
        <div class="session-top-row">
          <span class="session-item-title" title="Click to open, double click to rename">${escapeHtml(s.title || 'New Chat')}</span>
          <div class="session-item-actions">
            <button type="button" class="session-action-btn edit-name" title="Rename chat">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
            </button>
            <button type="button" class="session-action-btn delete" title="Delete chat">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </div>
        </div>
        <div class="session-bottom-row">
          <span class="session-folder-tag" title="Click to change folder">📁 ${escapeHtml(folderName)}</span>
          <span class="session-time-text">${escapeHtml(timeStr)}</span>
        </div>
      `;

      // Open session on click
      item.addEventListener('click', (e) => {
        if (e.target.closest('.session-action-btn') || e.target.closest('.session-folder-tag') || e.target.tagName === 'INPUT') {
          return;
        }
        if (isGenerating) {
          currentStreamingBubble = null;
          currentCoworkBubble = null;
          currentPlanData = null;
          currentIntroText = '';
          isGenerating = false;
          currentTaskId = null;
          toggleInputState(false);
          hideLiveActivity();
        }
        currentSessionId = s.id;
        renderSessionMessages(s.messages);
        sendPortMessage({ type: 'set_active_session', sessionId: s.id });
        historyDrawer.classList.add('hidden');
      });

      // Inline rename triggers
      const titleSpan = item.querySelector('.session-item-title');
      const editBtn = item.querySelector('.session-action-btn.edit-name');

      function startInlineRename() {
        const currentTitle = s.title || 'New Chat';
        const inp = document.createElement('input');
        inp.type = 'text';
        inp.className = 'session-rename-input';
        inp.value = currentTitle;
        titleSpan.replaceWith(inp);
        inp.focus();
        inp.select();

        let saved = false;
        function commitRename() {
          if (saved) return;
          saved = true;
          const newTitle = inp.value.trim() || currentTitle;
          s.title = newTitle;
          s.updatedAt = Date.now();
          sendPortMessage({ type: 'rename_session', sessionId: s.id, title: newTitle });
          renderHistoryList();
        }

        inp.addEventListener('keydown', (ke) => {
          if (ke.key === 'Enter') {
            ke.preventDefault();
            commitRename();
          } else if (ke.key === 'Escape') {
            ke.preventDefault();
            saved = true;
            renderHistoryList();
          }
        });
        inp.addEventListener('blur', commitRename);
      }

      editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        startInlineRename();
      });
      titleSpan.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        startInlineRename();
      });

      // Move folder on folder tag click
      const folderTag = item.querySelector('.session-folder-tag');
      folderTag.addEventListener('click', (e) => {
        e.stopPropagation();
        const curIdx = historyFolders.findIndex(f => f.toLowerCase() === folderName.toLowerCase());
        const nextFolder = historyFolders[(curIdx + 1) % historyFolders.length] || 'General';
        s.folder = nextFolder;
        s.updatedAt = Date.now();
        sendPortMessage({ type: 'update_session_folder', sessionId: s.id, folder: nextFolder });
        showToast(`Moved to folder "${nextFolder}"`);
        renderHistoryList();
      });

      // Delete session
      const delBtn = item.querySelector('.session-action-btn.delete');
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const deletedId = s.id;
        sendPortMessage({ type: 'delete_session', sessionId: deletedId });
        allSessions = allSessions.filter(x => x.id !== deletedId);
        renderHistoryList();
        showToast('Chat deleted');
        if (currentSessionId === deletedId) {
          startNewChat();
        }
      });

      sessionsList.appendChild(item);
    });
  }

  // ─── MCP Servers (Full Management: Inspector, Editor, Deletion, Reset) ──────
  const DEFAULT_MCP_SERVERS = [
    {
      id: 'stitch-mcp',
      name: 'StitchMCP',
      desc: 'UI screen generation, layout variations and component architecture',
      transport: 'Stdio',
      command: 'npx -y @modelcontextprotocol/server-stitch',
      toolsCount: 15,
      slashCmd: '/mcp:stitch',
      status: 'active',
      tools: [
        { name: 'create_project', desc: 'Creates a new project within Stitch' },
        { name: 'get_project', desc: 'Retrieves project details and screen inventory' },
        { name: 'delete_project', desc: 'Deletes a specified Stitch project' },
        { name: 'list_projects', desc: 'Lists all active projects' },
        { name: 'list_screens', desc: 'Lists all screens in a project' },
        { name: 'get_screen', desc: 'Retrieves metadata and visual elements for a screen' },
        { name: 'generate_screen_from_text', desc: 'Generates interactive screen UI from natural language' },
        { name: 'edit_screens', desc: 'Batch modifies screen layout and components' },
        { name: 'generate_variants', desc: 'Generates responsive design variants' },
        { name: 'upload_design_md', desc: 'Uploads design guidelines markdown documentation' },
        { name: 'create_design_system', desc: 'Initializes a design system for components' },
        { name: 'create_design_system_from_design_md', desc: 'Generates design tokens and themes from design.md' },
        { name: 'update_design_system', desc: 'Updates existing design system tokens and colors' },
        { name: 'list_design_systems', desc: 'Lists all registered design systems' },
        { name: 'apply_design_system', desc: 'Applies design system tokens to screens' }
      ]
    },
    {
      id: 'chrome-devtools',
      name: 'chrome-devtools',
      desc: 'Live DOM inspection, console logs, network events and screenshot capture',
      transport: 'Stdio',
      command: 'npx -y @modelcontextprotocol/server-chrome-devtools',
      toolsCount: 25,
      slashCmd: '/mcp:devtools',
      status: 'active',
      tools: [
        { name: 'click', desc: 'Clicks on an element matching selector or coordinates' },
        { name: 'close_page', desc: 'Closes a targeted browser tab' },
        { name: 'drag', desc: 'Drags an element across the viewport' },
        { name: 'emulate', desc: 'Emulates device viewport, DPR, and user agent' },
        { name: 'evaluate_script', desc: 'Evaluates JavaScript in page context' },
        { name: 'fill', desc: 'Fills an input, textarea, or contenteditable' },
        { name: 'fill_form', desc: 'Submits batch key-value pairs into form fields' },
        { name: 'get_console_message', desc: 'Retrieves specific browser console messages' },
        { name: 'get_network_request', desc: 'Inspects HTTP request and response payloads' },
        { name: 'handle_dialog', desc: 'Accepts or dismisses alert, confirm, or prompt dialogs' },
        { name: 'hover', desc: 'Hovers cursor over an element' },
        { name: 'lighthouse_audit', desc: 'Runs automated performance and accessibility audit' },
        { name: 'list_console_messages', desc: 'Streams all live console errors and warnings' },
        { name: 'list_network_requests', desc: 'Lists active and recent network HTTP transactions' },
        { name: 'list_pages', desc: 'Lists all open browser targets and tabs' },
        { name: 'navigate_page', desc: 'Navigates active tab to specified URL' },
        { name: 'new_page', desc: 'Opens a new blank or targeted browser tab' },
        { name: 'performance_analyze_insight', desc: 'Analyzes Web Vitals performance insights' },
        { name: 'performance_start_trace', desc: 'Begins DevTools performance profiling trace' },
        { name: 'performance_stop_trace', desc: 'Stops and analyzes performance recording' },
        { name: 'press_key', desc: 'Sends keypress events with modifiers' },
        { name: 'resize_page', desc: 'Resizes window dimensions' },
        { name: 'select_page', desc: 'Focuses a specific browser tab' },
        { name: 'take_heapsnapshot', desc: 'Takes memory heap profile snapshot' },
        { name: 'take_screenshot', desc: 'Captures full page or visible viewport PNG screenshot' },
        { name: 'take_snapshot', desc: 'Extracts accessibility and DOM tree snapshot' },
        { name: 'type_text', desc: 'Types raw characters into focused element' },
        { name: 'upload_file', desc: 'Attaches file paths to file input elements' },
        { name: 'wait_for', desc: 'Waits for element selector or page condition to resolve' }
      ]
    },
    {
      id: 'gemini-api-docs',
      name: 'gemini-api_gemini-api-docs',
      desc: 'Official upstream Google Gemini API, SDK methods and models documentation',
      transport: 'Stdio',
      command: 'gemini-api-docs-mcp',
      toolsCount: 2,
      slashCmd: '/mcp:docs',
      status: 'active',
      tools: [
        { name: 'gemini_search_docs', desc: 'Search current upstream Google Gemini API and SDK documentation' },
        { name: 'gemini_get_doc', desc: 'Retrieve full content of a documentation page by its chunk_id' }
      ]
    },
    {
      id: 'pencil',
      name: 'pencil',
      desc: 'Visual canvas, batch wireframing, node manipulation and layout design',
      transport: 'Stdio',
      command: 'pencil-mcp-server',
      toolsCount: 12,
      slashCmd: '/mcp:pencil',
      status: 'active',
      tools: [
        { name: 'batch_design', desc: 'Batch creates and arranges canvas wireframe nodes' },
        { name: 'batch_get', desc: 'Fetches properties for multiple canvas nodes' },
        { name: 'export_nodes', desc: 'Exports selected visual canvas nodes as SVG or PNG' },
        { name: 'find_empty_space_on_canvas', desc: 'Calculates free canvas coordinates for new designs' },
        { name: 'get_editor_state', desc: 'Retrieves current viewport zoom and selected elements' },
        { name: 'get_guidelines', desc: 'Fetches style and layout guidelines' },
        { name: 'get_screenshot', desc: 'Renders snapshot image of the visual canvas' },
        { name: 'get_variables', desc: 'Retrieves document color and typography variables' },
        { name: 'open_document', desc: 'Loads a vector document into canvas workspace' },
        { name: 'replace_all_matching_properties', desc: 'Global search and replace for canvas styling' },
        { name: 'search_all_unique_properties', desc: 'Finds unique colors, fonts, and dimensions' },
        { name: 'set_variables', desc: 'Updates document variables and theme tokens' },
        { name: 'snapshot_layout', desc: 'Generates structured JSON hierarchy of canvas elements' }
      ]
    },
    {
      id: 'stitch',
      name: 'stitch',
      desc: 'Design systems, tokens, multi-variant generation and asset pipelines',
      transport: 'Stdio',
      command: 'stitch-cli mcp',
      toolsCount: 15,
      slashCmd: '/mcp:design',
      status: 'active',
      tools: [
        { name: 'create_project', desc: 'Creates a new project within Stitch' },
        { name: 'get_project', desc: 'Retrieves project details and screen inventory' },
        { name: 'delete_project', desc: 'Deletes a specified Stitch project' },
        { name: 'list_projects', desc: 'Lists all active projects' },
        { name: 'list_screens', desc: 'Lists all screens in a project' },
        { name: 'get_screen', desc: 'Retrieves metadata and visual elements for a screen' },
        { name: 'generate_screen_from_text', desc: 'Generates interactive screen UI from natural language' },
        { name: 'edit_screens', desc: 'Batch modifies screen layout and components' },
        { name: 'generate_variants', desc: 'Generates responsive design variants' },
        { name: 'upload_design_md', desc: 'Uploads design guidelines markdown documentation' },
        { name: 'create_design_system', desc: 'Initializes a design system for components' },
        { name: 'create_design_system_from_design_md', desc: 'Generates design tokens and themes from design.md' },
        { name: 'update_design_system', desc: 'Updates existing design system tokens and colors' },
        { name: 'list_design_systems', desc: 'Lists all registered design systems' },
        { name: 'apply_design_system', desc: 'Applies design system tokens to screens' }
      ]
    }
  ];

  let allMcpServers = [];
  try {
    const savedMcp = localStorage.getItem('antigravity_mcp_servers_all_v2');
    if (savedMcp) {
      const parsed = JSON.parse(savedMcp);
      if (Array.isArray(parsed) && parsed.length > 0) {
        allMcpServers = parsed;
      } else {
        allMcpServers = JSON.parse(JSON.stringify(DEFAULT_MCP_SERVERS));
        localStorage.setItem('antigravity_mcp_servers_all_v2', JSON.stringify(allMcpServers));
      }
    } else {
      allMcpServers = JSON.parse(JSON.stringify(DEFAULT_MCP_SERVERS));
      localStorage.setItem('antigravity_mcp_servers_all_v2', JSON.stringify(allMcpServers));
    }
  } catch (_) {
    allMcpServers = JSON.parse(JSON.stringify(DEFAULT_MCP_SERVERS));
  }
  const BUILTIN_MCP_SERVERS = allMcpServers;
  let customMcpServers = [];

  function saveMcpServersToStorage() {
    try {
      localStorage.setItem('antigravity_mcp_servers_all_v2', JSON.stringify(allMcpServers));
    } catch (_) {}
  }

  function renderMcpServersList() {
    const listEl = document.getElementById('mcpServersList');
    if (!listEl) return;
    listEl.innerHTML = '';

    if (!Array.isArray(allMcpServers) || allMcpServers.length === 0) {
      allMcpServers = JSON.parse(JSON.stringify(DEFAULT_MCP_SERVERS));
      saveMcpServersToStorage();
    }

    allMcpServers.forEach((srv) => {
      const toolList = Array.isArray(srv.tools) ? srv.tools : [];
      const toolCount = toolList.length || srv.toolsCount || 0;
      const item = document.createElement('div');
      item.className = 'mcp-server-item';
      item.innerHTML = `
        <div class="mcp-server-info" style="flex:1;min-width:0;">
          <div class="mcp-server-name-row">
            <span class="mcp-server-name">${escapeHtml(srv.name)}</span>
            <span class="mcp-status-pill"><span class="status-dot">●</span> Connected</span>
          </div>
          <span class="mcp-server-desc">${escapeHtml(srv.desc || srv.command || '')}</span>
        </div>
        <div class="mcp-server-actions">
          <button type="button" class="mcp-pill-btn tools" title="View available tools">
            🔍 Tools (${toolCount})
          </button>
          <button type="button" class="mcp-pill-btn edit" title="Edit MCP server">
            ✏️ Edit
          </button>
          <button type="button" class="mcp-pill-btn delete" title="Delete MCP server">
            🗑️
          </button>
        </div>
      `;

      // Tools button
      item.querySelector('.mcp-pill-btn.tools')?.addEventListener('click', (e) => {
        e.stopPropagation();
        openMcpToolsModal(srv);
      });

      // Edit button
      item.querySelector('.mcp-pill-btn.edit')?.addEventListener('click', (e) => {
        e.stopPropagation();
        openMcpEditModal(srv);
      });

      // Delete button
      item.querySelector('.mcp-pill-btn.delete')?.addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm(`Delete MCP server "${srv.name}"?`)) {
          allMcpServers = allMcpServers.filter(x => x.id !== srv.id);
          saveMcpServersToStorage();
          renderMcpServersList();
          showToast(`MCP server "${srv.name}" deleted`);
        }
      });

      listEl.appendChild(item);
    });
  }

  // MCP Tools Inspector Modal logic
  const mcpToolsModal = document.getElementById('mcpToolsModal');
  const mcpToolsModalTitle = document.getElementById('mcpToolsModalTitle');
  const mcpToolsModalSubtitle = document.getElementById('mcpToolsModalSubtitle');
  const mcpToolsListContainer = document.getElementById('mcpToolsListContainer');
  const closeMcpToolsBtn = document.getElementById('closeMcpToolsBtn');

  function openMcpToolsModal(srv) {
    if (!mcpToolsModal || !mcpToolsListContainer) return;
    const tools = Array.isArray(srv.tools) ? srv.tools : [];
    if (mcpToolsModalTitle) mcpToolsModalTitle.textContent = `${srv.name} — Tools`;
    if (mcpToolsModalSubtitle) mcpToolsModalSubtitle.textContent = `${tools.length} tool(s) registered and ready to use`;

    mcpToolsListContainer.innerHTML = '';
    if (tools.length === 0) {
      mcpToolsListContainer.innerHTML = '<p style="color:#71717a;font-size:12px;padding:12px;">No detailed tool specifications available for this server.</p>';
    } else {
      tools.forEach((t) => {
        const card = document.createElement('div');
        card.className = 'mcp-tool-card';
        card.innerHTML = `
          <div class="mcp-tool-name">${escapeHtml(typeof t === 'object' ? t.name : String(t))}</div>
          <div class="mcp-tool-desc">${escapeHtml((typeof t === 'object' && t.desc) ? t.desc : 'Registered tool')}</div>
        `;
        mcpToolsListContainer.appendChild(card);
      });
    }

    mcpToolsModal.classList.remove('hidden');
  }

  if (closeMcpToolsBtn) {
    closeMcpToolsBtn.addEventListener('click', () => {
      mcpToolsModal?.classList.add('hidden');
    });
  }

  // MCP Edit Modal logic
  const mcpEditModal = document.getElementById('mcpEditModal');
  const editMcpServerId = document.getElementById('editMcpServerId');
  const editMcpName = document.getElementById('editMcpName');
  const editMcpTransport = document.getElementById('editMcpTransport');
  const editMcpCommand = document.getElementById('editMcpCommand');
  const editMcpDesc = document.getElementById('editMcpDesc');
  const editMcpTools = document.getElementById('editMcpTools');
  const closeMcpEditBtn = document.getElementById('closeMcpEditBtn');
  const cancelMcpEditBtn = document.getElementById('cancelMcpEditBtn');
  const saveMcpEditBtn = document.getElementById('saveMcpEditBtn');

  function openMcpEditModal(srv) {
    if (!mcpEditModal) return;
    if (editMcpServerId) editMcpServerId.value = srv.id;
    if (editMcpName) editMcpName.value = srv.name || '';
    if (editMcpTransport) editMcpTransport.value = srv.transport || 'Stdio';
    if (editMcpCommand) editMcpCommand.value = srv.command || '';
    if (editMcpDesc) editMcpDesc.value = srv.desc || '';
    if (editMcpTools) {
      const toolNames = (srv.tools || []).map(t => (typeof t === 'object' && t ? t.name : String(t))).join(', ');
      editMcpTools.value = toolNames;
    }
    mcpEditModal.classList.remove('hidden');
  }

  function closeMcpEditModal() {
    if (mcpEditModal) mcpEditModal.classList.add('hidden');
  }

  if (closeMcpEditBtn) closeMcpEditBtn.addEventListener('click', closeMcpEditModal);
  if (cancelMcpEditBtn) cancelMcpEditBtn.addEventListener('click', closeMcpEditModal);

  if (saveMcpEditBtn) {
    saveMcpEditBtn.addEventListener('click', () => {
      const sId = editMcpServerId?.value;
      const srv = allMcpServers.find(x => x.id === sId);
      if (srv) {
        srv.name = editMcpName?.value?.trim() || srv.name;
        srv.transport = editMcpTransport?.value || srv.transport;
        srv.command = editMcpCommand?.value?.trim() || srv.command;
        srv.desc = editMcpDesc?.value?.trim() || srv.desc;
        if (editMcpTools) {
          const rawTools = editMcpTools.value.split(',').map(s => s.trim()).filter(Boolean);
          srv.tools = rawTools.map(name => {
            const existing = (srv.tools || []).find(t => (typeof t === 'object' ? t.name : t) === name);
            return existing && typeof existing === 'object' ? existing : { name, desc: `Tool ${name}` };
          });
          srv.toolsCount = srv.tools.length;
        }
        saveMcpServersToStorage();
        renderMcpServersList();
        closeMcpEditModal();
        showToast(`Server "${srv.name}" updated`);
      }
    });
  }

  // Restore Default MCP Servers button
  const resetMcpDefaultsBtn = document.getElementById('resetMcpDefaultsBtn');
  if (resetMcpDefaultsBtn) {
    resetMcpDefaultsBtn.addEventListener('click', () => {
      if (confirm('Restore all default MCP servers (StitchMCP, devtools, gemini-docs, pencil, stitch)?')) {
        allMcpServers = JSON.parse(JSON.stringify(DEFAULT_MCP_SERVERS));
        saveMcpServersToStorage();
        renderMcpServersList();
        showToast('Default MCP servers restored');
      }
    });
  }

  // Add custom MCP Server listener
  const addMcpServerBtn = document.getElementById('addMcpServerBtn');
  if (addMcpServerBtn) {
    addMcpServerBtn.addEventListener('click', () => {
      const nameInput = document.getElementById('newMcpName');
      const transportInput = document.getElementById('newMcpTransport');
      const cmdInput = document.getElementById('newMcpCommand');
      const name = nameInput?.value?.trim();
      const command = cmdInput?.value?.trim();
      if (!name) {
        showToast('Please specify a server name');
        return;
      }
      const newSrv = {
        id: `mcp-${Date.now()}`,
        name,
        desc: command || 'Custom MCP server',
        transport: transportInput?.value || 'Stdio',
        command: command || '',
        slashCmd: `/mcp:${name.toLowerCase().replace(/[^a-z0-9_-]/g, '-')}`,
        toolsCount: 0,
        tools: [],
        status: 'active'
      };
      allMcpServers.push(newSrv);
      saveMcpServersToStorage();
      if (nameInput) nameInput.value = '';
      if (cmdInput) cmdInput.value = '';
      renderMcpServersList();
      showToast(`MCP server "${name}" added successfully`);
    });
  }

  // ─── Local Agent MCP Server (Active Browser Bridge) ───────────────────────
  const settingLocalMcpBridgeEnabled = document.getElementById('settingLocalMcpBridgeEnabled');
  const localMcpStatusBadge = document.getElementById('localMcpStatusBadge');
  const copyMcpConfigSnippetBtn = document.getElementById('copyMcpConfigSnippetBtn');
  const copyMcpUrlBtn = document.getElementById('copyMcpUrlBtn');
  const mcpConfigSnippetCode = document.getElementById('mcpConfigSnippetCode');
  const settingLocalMcpUrl = document.getElementById('settingLocalMcpUrl');
  const testMcpUrlBtn = document.getElementById('testMcpUrlBtn');
  const syncMcpWithBridgeBtn = document.getElementById('syncMcpWithBridgeBtn');

  function getActiveBridgeBaseUrl() {
    return (localStorage.getItem('antigravity_bridge_url') || settingBridgeUrl?.value?.trim() || 'http://127.0.0.1:8765').replace(/\/+$/, '');
  }

  function getFullMcpSseUrl() {
    let url = settingLocalMcpUrl?.value?.trim() || localStorage.getItem('autono_local_mcp_url') || `${getActiveBridgeBaseUrl()}/mcp/sse`;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = `http://${url}`;
    }
    if (!url.includes('/mcp')) {
      url = url.replace(/\/+$/, '') + '/mcp/sse';
    } else if (url.endsWith('/mcp')) {
      url = `${url}/sse`;
    }
    return url;
  }

  function getMcpBaseUrl() {
    const full = getFullMcpSseUrl();
    try {
      const u = new URL(full);
      return `${u.protocol}//${u.host}`;
    } catch (_) {
      return getActiveBridgeBaseUrl();
    }
  }

  function refreshMcpSnippet() {
    if (!mcpConfigSnippetCode) return;
    const mcpUrl = getFullMcpSseUrl();
    const snippet = {
      "mcpServers": {
        "autono-browser": {
          "url": mcpUrl
        }
      }
    };
    mcpConfigSnippetCode.textContent = JSON.stringify(snippet, null, 2);
  }

  function onMcpUrlChanged(notifySave = true) {
    const val = getFullMcpSseUrl();
    localStorage.setItem('autono_local_mcp_url', val);
    chrome.storage.local.set({ autono_local_mcp_url: val });
    refreshMcpSnippet();
    const isEnabled = document.getElementById('settingLocalMcpBridgeEnabled')?.checked ?? false;
    updateLocalMcpStatusUI(isEnabled);

    if (notifySave) {
      const saved = JSON.parse(localStorage.getItem('antigravity_settings') || '{}');
      saved.localMcpUrl = val;
      localStorage.setItem('antigravity_settings', JSON.stringify(saved));
      sendPortMessage({ type: 'save_settings', settings: saved });
    }
  }

  if (settingLocalMcpUrl) {
    settingLocalMcpUrl.addEventListener('input', refreshMcpSnippet);
    settingLocalMcpUrl.addEventListener('change', () => onMcpUrlChanged(true));
  }

  // Quick port preset buttons (8765, 8888, 9000, 9090)
  document.querySelectorAll('.mcp-port-preset-btn[data-port]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const targetPort = btn.getAttribute('data-port');
      if (!targetPort) return;
      const targetInput = document.getElementById('settingLocalMcpUrl');
      if (!targetInput) return;
      try {
        const cur = targetInput.value.trim() || 'http://127.0.0.1:8765/mcp/sse';
        const u = new URL(cur.startsWith('http') ? cur : `http://${cur}`);
        u.port = targetPort;
        if (!u.pathname || u.pathname === '/') u.pathname = '/mcp/sse';
        targetInput.value = `${u.protocol}//${u.hostname}:${targetPort}${u.pathname.endsWith('/mcp/sse') ? u.pathname : '/mcp/sse'}`;
      } catch (_) {
        targetInput.value = `http://127.0.0.1:${targetPort}/mcp/sse`;
      }
      onMcpUrlChanged(true);
      showToast(`Puerto MCP cambiado a :${targetPort}`);
    });
  });

  // Sync MCP port with Bridge URL
  if (syncMcpWithBridgeBtn) {
    syncMcpWithBridgeBtn.addEventListener('click', () => {
      const bridgeBase = getActiveBridgeBaseUrl();
      const targetInput = document.getElementById('settingLocalMcpUrl');
      if (targetInput) {
        targetInput.value = `${bridgeBase}/mcp/sse`;
        onMcpUrlChanged(true);
        showToast('URL MCP sincronizada con el Bridge');
      }
    });
  }

  // Test connection to MCP URL endpoint
  if (testMcpUrlBtn) {
    testMcpUrlBtn.addEventListener('click', async () => {
      const base = getMcpBaseUrl();
      const orig = testMcpUrlBtn.textContent;
      testMcpUrlBtn.textContent = '...';
      try {
        const resp = await fetch(`${base}/api/mcp/status`, { signal: AbortSignal.timeout(2500) });
        if (resp.ok) {
          showToast(`✓ Conectado a ${base} (MCP Online)`);
          updateLocalMcpStatusUI(true);
        } else {
          showToast(`⚠️ Servidor respondió con código ${resp.status}`);
        }
      } catch (err) {
        showToast(`❌ No se pudo conectar a ${base}. Verifica que Model Bridge esté ejecutándose en ese puerto.`);
      } finally {
        testMcpUrlBtn.textContent = orig;
      }
    });
  }

  if (settingBridgeUrl) {
    settingBridgeUrl.addEventListener('input', () => {
      refreshMcpSnippet();
    });
  }

  async function updateLocalMcpStatusUI(isActive) {
    if (!localMcpStatusBadge) return;
    refreshMcpSnippet();
    if (!isActive) {
      localMcpStatusBadge.className = 'local-mcp-status-pill inactive';
      localMcpStatusBadge.textContent = '● Desactivado';
      return;
    }

    localMcpStatusBadge.className = 'local-mcp-status-pill active';
    localMcpStatusBadge.textContent = '● Activo (Verificando...)';

    try {
      const currentMcpBase = getMcpBaseUrl();
      const resp = await fetch(`${currentMcpBase}/api/mcp/status`, { signal: AbortSignal.timeout(2000) });
      if (resp.ok) {
        const data = await resp.json().catch(() => ({}));
        let displayHostPort = '8765';
        try {
          const u = new URL(currentMcpBase);
          displayHostPort = u.port || (u.protocol === 'https:' ? '443' : '80');
        } catch (_) {}
        if (data.port) displayHostPort = data.port;
        localMcpStatusBadge.className = 'local-mcp-status-pill active';
        localMcpStatusBadge.textContent = `● Activo (:${displayHostPort})`;
      } else {
        localMcpStatusBadge.className = 'local-mcp-status-pill active';
        localMcpStatusBadge.textContent = '● Activo (Bridge listo)';
      }
    } catch (_) {
      localMcpStatusBadge.className = 'local-mcp-status-pill active';
      localMcpStatusBadge.textContent = '● Activo (Inicia Bridge)';
    }
  }

  if (settingLocalMcpBridgeEnabled) {
    settingLocalMcpBridgeEnabled.addEventListener('change', () => {
      const isEnabled = settingLocalMcpBridgeEnabled.checked;
      localStorage.setItem('autono_local_mcp_bridge_enabled', String(isEnabled));
      chrome.storage.local.set({ autono_local_mcp_bridge_enabled: isEnabled });
      updateLocalMcpStatusUI(isEnabled);

      // Save into settings object as well
      const saved = JSON.parse(localStorage.getItem('antigravity_settings') || '{}');
      saved.localMcpBridgeEnabled = isEnabled;
      saved.localMcpUrl = getFullMcpSseUrl();
      localStorage.setItem('antigravity_settings', JSON.stringify(saved));
      sendPortMessage({ type: 'save_settings', settings: saved });

      showToast(isEnabled ? 'Servidor MCP para agentes locales activado' : 'Servidor MCP desactivado');
    });
  }

  if (copyMcpUrlBtn) {
    copyMcpUrlBtn.addEventListener('click', async () => {
      try {
        const urlToCopy = getFullMcpSseUrl();
        await navigator.clipboard.writeText(urlToCopy);
        const originalText = copyMcpUrlBtn.textContent;
        copyMcpUrlBtn.textContent = '✓ Copiado';
        copyMcpUrlBtn.style.color = '#34d399';
        showToast('URL MCP (SSE) copiada al portapapeles');
        setTimeout(() => {
          copyMcpUrlBtn.textContent = originalText;
          copyMcpUrlBtn.style.color = '#93c5fd';
        }, 2200);
      } catch (err) {
        showToast('Error al copiar URL MCP');
      }
    });
  }

  if (copyMcpConfigSnippetBtn && mcpConfigSnippetCode) {
    copyMcpConfigSnippetBtn.addEventListener('click', async () => {
      try {
        refreshMcpSnippet();
        const textToCopy = mcpConfigSnippetCode.innerText.trim();
        await navigator.clipboard.writeText(textToCopy);
        const originalText = copyMcpConfigSnippetBtn.textContent;
        copyMcpConfigSnippetBtn.textContent = '✓ Copiado';
        copyMcpConfigSnippetBtn.style.color = '#34d399';
        showToast('Configuración MCP copiada al portapapeles');
        setTimeout(() => {
          copyMcpConfigSnippetBtn.textContent = originalText;
          copyMcpConfigSnippetBtn.style.color = '#bfdbfe';
        }, 2200);
      } catch (err) {
        showToast('Error al copiar configuración');
      }
    });
  }

  // ─── External Providers Management (Up to 5 third-party providers) ─────────
  function saveExternalProvidersToStorage() {
    try {
      localStorage.setItem('antigravity_external_providers', JSON.stringify(externalProviders));
      chrome.storage.local.set({ antigravity_external_providers: externalProviders });
    } catch (_) {}
    syncExternalProvidersToPicker();
  }

  function syncExternalProvidersToPicker() {
    // 1. Remove old external provider entries from PROVIDER_DATA
    for (const key of Object.keys(PROVIDER_DATA)) {
      if (PROVIDER_DATA[key]?.isExternal) {
        delete PROVIDER_DATA[key];
      }
    }

    // 2. Inject current external providers into PROVIDER_DATA
    externalProviders.forEach((prov) => {
      const iconHtml = prov.iconUrl
        ? `<img src="${escapeHtml(prov.iconUrl)}" style="width:16px;height:16px;object-fit:contain;border-radius:4px;">`
        : `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><path d="M9 3v18"/><path d="M15 9h6"/></svg>`;

      const models = (prov.models || []).map((m) => ({
        id: m.id,
        name: m.name || m.id,
        desc: m.desc || `Model provided by ${prov.name}`,
        contextWindow: m.contextWindow || '128K tokens',
        caps: ['reasoning', 'image'],
        isExternal: true,
        providerId: prov.id,
        providerName: prov.name,
      }));

      PROVIDER_DATA[prov.id] = {
        id: prov.id,
        name: prov.name,
        iconSvg: iconHtml,
        isExternal: true,
        baseUrl: prov.baseUrl,
        apiKey: prov.apiKey || '',
        models,
      };
    });

    // 3. Dynamically update left rail buttons in ModelPicker
    const rail = document.getElementById('pickerRail');
    if (rail) {
      // Remove previously rendered external rail buttons
      rail.querySelectorAll('.rail-btn.ext-rail-btn').forEach((b) => b.remove());

      externalProviders.forEach((prov) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `rail-btn ext-rail-btn ${activeProvider === prov.id ? 'active' : ''}`;
        btn.setAttribute('data-provider', prov.id);
        btn.setAttribute('title', prov.name);

        const iconWrap = prov.iconUrl
          ? `<img src="${escapeHtml(prov.iconUrl)}" style="width:18px;height:18px;object-fit:contain;border-radius:4px;">`
          : `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#38bdf8" stroke-width="2"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>`;

        btn.innerHTML = iconWrap;
        rail.appendChild(btn);
      });
    }
  }

  function renderExternalProvidersList() {
    const listEl = document.getElementById('externalProvidersList');
    const badge = document.getElementById('externalProvidersCountBadge');
    if (badge) {
      badge.textContent = `${externalProviders.length} / 5 Active`;
      badge.className = `shadow-status-pill ${externalProviders.length >= 5 ? 'active' : 'ready'}`;
    }
    if (!listEl) return;

    listEl.innerHTML = '';
    if (!Array.isArray(externalProviders) || externalProviders.length === 0) {
      listEl.innerHTML = '<span class="field-hint" style="color:#71717a;font-size:11.5px;padding:6px 0;display:block;">No external providers added yet. Use the form below to connect up to 5 providers.</span>';
      return;
    }

    externalProviders.forEach((prov, idx) => {
      const card = document.createElement('div');
      card.className = 'ext-prov-card';

      const iconImg = prov.iconUrl
        ? `<img src="${escapeHtml(prov.iconUrl)}" alt="${escapeHtml(prov.name)}">`
        : `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#38bdf8" stroke-width="2"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><path d="M8 12h8"/></svg>`;

      const modelsCount = Array.isArray(prov.models) ? prov.models.length : 0;
      const chipsHtml = (prov.models || []).slice(0, 4).map((m) => `
        <span class="ext-model-chip">${escapeHtml(m.name || m.id)}</span>
      `).join('');

      card.innerHTML = `
        <div class="ext-prov-header">
          <div class="ext-prov-info">
            <div class="ext-prov-icon-wrap">${iconImg}</div>
            <div>
              <div style="display:flex;align-items:center;">
                <span class="ext-prov-name">${escapeHtml(prov.name)}</span>
                <span class="ext-prov-id">${escapeHtml(prov.id)}</span>
              </div>
              <div class="ext-prov-url">${escapeHtml(prov.baseUrl || '')}</div>
            </div>
          </div>
          <button type="button" class="skill-chip-del" title="Delete Provider" data-index="${idx}">&times;</button>
        </div>
        <div class="ext-prov-models-chips">
          ${chipsHtml}
          ${modelsCount > 4 ? `<span class="ext-model-chip" style="background:rgba(255,255,255,0.06);color:#a1a1aa;">+${modelsCount - 4} more</span>` : ''}
        </div>
      `;

      card.querySelector('.skill-chip-del')?.addEventListener('click', (e) => {
        e.stopPropagation();
        const delName = prov.name;
        externalProviders.splice(idx, 1);
        saveExternalProvidersToStorage();
        renderExternalProvidersList();
        renderModelPickerRows();
        showToast(`Provider "${delName}" removed`);
      });

      listEl.appendChild(card);
    });
  }

  // Wire up External Providers form elements
  const extProvIconFileInput = document.getElementById('extProvIconFileInput');
  const extProvIconUploadBtn = document.getElementById('extProvIconUploadBtn');
  const extProvIconUrl = document.getElementById('extProvIconUrl');
  const extProvIconPreview = document.getElementById('extProvIconPreview');
  const extProvFetchModelsBtn = document.getElementById('extProvFetchModelsBtn');
  const addExternalProviderBtn = document.getElementById('addExternalProviderBtn');

  if (extProvIconUploadBtn && extProvIconFileInput) {
    extProvIconUploadBtn.addEventListener('click', () => extProvIconFileInput.click());
    extProvIconFileInput.addEventListener('change', () => {
      const file = extProvIconFileInput.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const dataUrl = ev.target?.result;
        if (typeof dataUrl === 'string') {
          if (extProvIconUrl) extProvIconUrl.value = dataUrl;
          if (extProvIconPreview) {
            extProvIconPreview.innerHTML = `<img src="${dataUrl}" style="width:100%;height:100%;object-fit:contain;">`;
          }
        }
      };
      reader.readAsDataURL(file);
    });
  }

  if (extProvIconUrl) {
    extProvIconUrl.addEventListener('input', () => {
      const url = extProvIconUrl.value.trim();
      if (extProvIconPreview) {
        if (url) {
          extProvIconPreview.innerHTML = '';
          const img = document.createElement('img');
          img.src = url;
          img.style.cssText = 'width:100%;height:100%;object-fit:contain;';
          img.onerror = () => {
            if (extProvIconPreview) extProvIconPreview.innerHTML = '<span style="font-size:11px;color:#71717a;">Icon</span>';
          };
          extProvIconPreview.appendChild(img);
        } else {
          extProvIconPreview.innerHTML = '<span style="font-size:11px;color:#71717a;">Icon</span>';
        }
      }
    });
  }

  if (extProvFetchModelsBtn) {
    extProvFetchModelsBtn.addEventListener('click', async () => {
      const baseUrlInput = document.getElementById('extProvBaseUrl');
      const apiKeyInput = document.getElementById('extProvApiKey');
      const modelsTextarea = document.getElementById('extProvModelsList');

      const rawBase = (baseUrlInput?.value || '').trim().replace(/\/+$/, '');
      if (!rawBase) {
        showToast('Please specify a Base URL first');
        return;
      }

      extProvFetchModelsBtn.disabled = true;
      extProvFetchModelsBtn.textContent = 'Fetching...';

      try {
        const fetchUrl = rawBase.endsWith('/v1') ? `${rawBase}/models` : `${rawBase}/v1/models`;
        const headers = { 'Content-Type': 'application/json' };
        const key = (apiKeyInput?.value || '').trim();
        if (key) headers['Authorization'] = `Bearer ${key}`;

        const res = await fetch(fetchUrl, { headers, signal: AbortSignal.timeout(6000) });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const models = Array.isArray(data.data) ? data.data : (Array.isArray(data.models) ? data.models : []);

        if (models.length > 0 && modelsTextarea) {
          const lines = models.map((m) => {
            const id = typeof m === 'string' ? m : (m.id || m.name);
            const name = typeof m === 'object' && m.name ? m.name : id;
            return `${id}: ${name}`;
          });
          modelsTextarea.value = lines.join('\n');
          showToast(`Fetched ${models.length} models successfully`);
        } else {
          showToast('No models list found in response');
        }
      } catch (err) {
        showToast(`Failed to fetch models: ${err.message}`);
      } finally {
        extProvFetchModelsBtn.disabled = false;
        extProvFetchModelsBtn.textContent = 'Fetch /v1/models';
      }
    });
  }

  if (addExternalProviderBtn) {
    addExternalProviderBtn.addEventListener('click', () => {
      if (externalProviders.length >= 5) {
        showToast('Maximum of 5 external providers reached');
        return;
      }

      const nameInput = document.getElementById('extProvName');
      const idInput = document.getElementById('extProvId');
      const baseUrlInput = document.getElementById('extProvBaseUrl');
      const apiKeyInput = document.getElementById('extProvApiKey');
      const modelsTextarea = document.getElementById('extProvModelsList');

      const name = (nameInput?.value || '').trim();
      let provId = (idInput?.value || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-');
      const baseUrl = (baseUrlInput?.value || '').trim().replace(/\/+$/, '');
      const apiKey = (apiKeyInput?.value || '').trim();
      const iconUrl = (extProvIconUrl?.value || '').trim();

      if (!name) {
        showToast('Please specify a Provider Name');
        return;
      }
      if (!baseUrl) {
        showToast('Please specify a Base URL');
        return;
      }
      if (!provId) {
        provId = name.toLowerCase().replace(/[^a-z0-9_-]/g, '-');
      }

      const parsedModels = [];
      const lines = (modelsTextarea?.value || '').split('\n');
      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line) continue;
        if (line.includes(':')) {
          const [mId, ...rest] = line.split(':');
          parsedModels.push({
            id: mId.trim(),
            name: rest.join(':').trim() || mId.trim(),
            isExternal: true,
            providerId: provId,
          });
        } else {
          parsedModels.push({
            id: line,
            name: line,
            isExternal: true,
            providerId: provId,
          });
        }
      }

      if (parsedModels.length === 0) {
        parsedModels.push({
          id: `${provId}-default`,
          name: `${name} Default`,
          isExternal: true,
          providerId: provId,
        });
      }

      const newProvider = {
        id: provId,
        name,
        baseUrl,
        apiKey,
        iconUrl,
        models: parsedModels,
        createdAt: Date.now(),
      };

      const existingIndex = externalProviders.findIndex((p) => p.id === provId);
      if (existingIndex >= 0) {
        externalProviders[existingIndex] = newProvider;
      } else {
        externalProviders.push(newProvider);
      }

      saveExternalProvidersToStorage();
      renderExternalProvidersList();

      if (nameInput) nameInput.value = '';
      if (idInput) idInput.value = '';
      if (baseUrlInput) baseUrlInput.value = '';
      if (apiKeyInput) apiKeyInput.value = '';
      if (extProvIconUrl) extProvIconUrl.value = '';
      if (modelsTextarea) modelsTextarea.value = '';
      if (extProvIconPreview) extProvIconPreview.innerHTML = '<span style="font-size:11px;color:#71717a;">Icon</span>';

      showToast(`Provider "${name}" added with ${parsedModels.length} models`);
    });
  }

  // Initialize external providers into picker on boot
  syncExternalProvidersToPicker();

  function applyLoadedSettings(s) {
    if (settingBridgeUrl) {
      // the Bridge moved from port 8000 to 8765 long ago: fix an address saved by an old version
      const savedUrl = /^https?:\/\/(127\.0\.0\.1|localhost):8000\/?$/i.test(s.bridgeUrl || '') ? s.bridgeUrl.replace(':8000', ':8765').replace(/\/$/, '') : s.bridgeUrl;
      settingBridgeUrl.value = savedUrl || 'http://127.0.0.1:8765';
      refreshMcpSnippet();
    }
    if (settingMaxSteps) settingMaxSteps.value = s.maxSteps || 30;
    if (settingTinyFishKey) {
      settingTinyFishKey.value = s.tinyFishApiKey || '';
      tinyFishApiKey = s.tinyFishApiKey || '';
    }
    if (settingAntigravityMode && s.antigravityMode) {
      settingAntigravityMode.value = s.antigravityMode;
      currentAntigravityMode = s.antigravityMode;
    }
    if (settingGeminiApiKey && s.geminiApiKey !== undefined) {
      settingGeminiApiKey.value = s.geminiApiKey;
      currentGeminiApiKey = s.geminiApiKey;
    }
    if (settingClaudeMode && s.claudeMode) {
      settingClaudeMode.value = s.claudeMode;
      currentClaudeMode = s.claudeMode;
    }
    if (settingAnthropicApiKey && s.anthropicApiKey !== undefined) {
      settingAnthropicApiKey.value = s.anthropicApiKey;
      currentAnthropicApiKey = s.anthropicApiKey;
    }
    if (settingOpenaiMode && s.openaiMode) {
      settingOpenaiMode.value = s.openaiMode;
      currentOpenaiMode = s.openaiMode;
    }
    if (settingOpenaiApiKey && s.openaiApiKey !== undefined) {
      settingOpenaiApiKey.value = s.openaiApiKey;
      currentOpenaiApiKey = s.openaiApiKey;
    }
    if (settingDisplayMode) settingDisplayMode.value = s.displayMode || 'side_panel';
    if (s.selectedModel) selectModel(s.selectedModel);

    const langInput = document.getElementById('settingAgentLanguage');
    if (langInput && s.agentLanguage) langInput.value = s.agentLanguage;

    const thinkingInput = document.getElementById('settingDefaultThinking');
    if (thinkingInput && s.defaultThinking) thinkingInput.value = s.defaultThinking;

    const sysPromptInput = document.getElementById('settingSystemPrompt');
    if (sysPromptInput && s.systemPrompt) sysPromptInput.value = s.systemPrompt;

    const autonomyInput = document.getElementById('settingAutonomyMode');
    if (autonomyInput && s.autonomyMode) autonomyInput.value = s.autonomyMode;

    const visionInput = document.getElementById('settingVisionScreenshots');
    if (visionInput && s.visionScreenshots !== undefined) visionInput.checked = Boolean(s.visionScreenshots);

    const delayInput = document.getElementById('settingActionDelay');
    if (delayInput && s.actionDelay) delayInput.value = s.actionDelay;

    const opacityInput = document.getElementById('settingGridOpacity');
    if (opacityInput && s.gridOpacity !== undefined) {
      opacityInput.value = s.gridOpacity;
      currentGridOpacity = parseFloat(s.gridOpacity);
    }

    const squareInput = document.getElementById('settingSquareSize');
    if (squareInput && s.squareSize) {
      squareInput.value = s.squareSize;
      currentSquareSize = parseInt(s.squareSize, 10);
    }

    const trailInput = document.getElementById('settingTrailDuration');
    if (trailInput && s.trailDuration) {
      trailInput.value = s.trailDuration;
      currentTrailDecay = parseFloat(s.trailDuration);
    }

    const soundInput = document.getElementById('settingCompletionSound');
    if (soundInput && s.completionSound !== undefined) soundInput.checked = Boolean(s.completionSound);

    // Appearance settings restoration
    if (s.borderBeamGlow) applyBorderBeam(s.borderBeamGlow);
    if (s.chatFontSize) applyChatFontSize(s.chatFontSize);
    if (s.chatSpacing) applyChatSpacing(s.chatSpacing);
    if (s.colorTheme) applyTheme(s.colorTheme);

    // User Profile fields (Synchronized with onboarding localStorage)
    const userNameInput = document.getElementById('settingUserName');
    const savedLocalName = localStorage.getItem('antigravity_user_name') || '';
    if (userNameInput) userNameInput.value = s.userName || savedLocalName;

    const userNickInput = document.getElementById('settingUserNickname') || document.getElementById('settingUserNick');
    const savedLocalNick = localStorage.getItem('antigravity_user_nick') || '';
    if (userNickInput) userNickInput.value = s.userNickname || savedLocalNick;

    const topAuthLabel = document.getElementById('topAuthLabel');
    if (topAuthLabel) {
      const displayLabel = s.userNickname || savedLocalNick || s.userName || savedLocalName;
      if (displayLabel) topAuthLabel.textContent = displayLabel;
    }

    // Shadow Mode settings restoration
    const shadowEnabledInput = document.getElementById('settingShadowEnabled');
    if (shadowEnabledInput && s.shadowEnabled !== undefined) shadowEnabledInput.checked = Boolean(s.shadowEnabled);

    const shadowPreventSleepInput = document.getElementById('settingShadowPreventSleep');
    if (shadowPreventSleepInput && s.shadowPreventSleep !== undefined) {
      shadowPreventSleepInput.checked = Boolean(s.shadowPreventSleep);
      applyKeepAwake(shadowPreventSleepInput.checked);
    }

    const shadowAutoWakeInput = document.getElementById('settingShadowAutoWake');
    if (shadowAutoWakeInput && s.shadowAutoWake !== undefined) shadowAutoWakeInput.checked = Boolean(s.shadowAutoWake);

    const shadowOnCompleteInput = document.getElementById('settingShadowOnComplete');
    if (shadowOnCompleteInput && s.shadowOnComplete) shadowOnCompleteInput.value = s.shadowOnComplete;

    // Customization Mode settings
    const tabGroupingInput = document.getElementById('settingTabGrouping');
    if (tabGroupingInput && s.tabGrouping !== undefined) tabGroupingInput.checked = Boolean(s.tabGrouping);

    const workingOverlayInput = document.getElementById('settingWorkingOverlay');
    if (workingOverlayInput && s.workingOverlay !== undefined) workingOverlayInput.checked = Boolean(s.workingOverlay);
    const multiAgentInput = document.getElementById('settingMultiAgent');
    if (multiAgentInput) multiAgentInput.checked = Boolean(s.multiAgent);
    const mascotInput = document.getElementById('settingMascot');
    if (mascotInput) mascotInput.checked = s.mascot !== false;
    const agentConfirmInput = document.getElementById('settingAgentConfirm');
    if (agentConfirmInput) agentConfirmInput.checked = s.agentConfirm !== false;

    const tabLockedSidebarInput = document.getElementById('settingTabLockedSidebar');
    if (tabLockedSidebarInput && s.tabLockedSidebar !== undefined) tabLockedSidebarInput.checked = Boolean(s.tabLockedSidebar);

    const waitInstantInput = document.getElementById('settingWaitMessageSentOutInstantly');
    if (waitInstantInput && s.waitMessageSentOutInstantly !== undefined) waitInstantInput.checked = Boolean(s.waitMessageSentOutInstantly);

    // Local Agent MCP Server (Active Browser Bridge)
    const localMcpEnabledInput = document.getElementById('settingLocalMcpBridgeEnabled');
    const savedLocalMcp = localStorage.getItem('autono_local_mcp_bridge_enabled');
    const isLocalMcpActive = s.localMcpBridgeEnabled !== undefined ? Boolean(s.localMcpBridgeEnabled) : (savedLocalMcp === 'true');
    if (localMcpEnabledInput) {
      localMcpEnabledInput.checked = isLocalMcpActive;
    }
    const localMcpUrlInput = document.getElementById('settingLocalMcpUrl');
    const savedLocalMcpUrl = s.localMcpUrl || localStorage.getItem('autono_local_mcp_url');
    if (localMcpUrlInput && savedLocalMcpUrl) {
      localMcpUrlInput.value = savedLocalMcpUrl;
    }
    updateLocalMcpStatusUI(isLocalMcpActive);

    renderSkillChips();
    renderMcpServersList();
    renderExternalProvidersList();
    initScratchpad();
  }

  // ─── Custom Skills & /skill Engine ───────────────────────────────────────────
  function renderCustomSkillsList() {
    const container = document.getElementById('customSkillsList') || document.getElementById('skillsChipsContainer');
    if (!container) return;
    container.innerHTML = '';
    if (!Array.isArray(customSkills) || customSkills.length === 0) {
      container.innerHTML = `
        <div style="text-align:center;padding:22px 14px;color:#71717a;font-size:12px;border:1px dashed rgba(255,255,255,0.08);border-radius:10px;">
          <span>No hay skills personalizadas todavía.</span><br>
          <span style="font-size:11px;opacity:0.8;margin-top:4px;display:inline-block;">Escribe una tarea y usa <code>/skill</code> para crear tu primera skill repetible.</span>
        </div>
      `;
      return;
    }

    customSkills.forEach((sk, idx) => {
      const item = document.createElement('div');
      item.className = 'custom-skill-item';
      item.innerHTML = `
        <div class="custom-skill-meta">
          <div style="display:flex;align-items:center;gap:6px;">
            <span class="custom-skill-cmd">/${escapeHtml(sk.name)}</span>
            <span style="font-size:10px;padding:1px 6px;border-radius:4px;background:rgba(255,255,255,0.08);color:#a1a1aa;text-transform:uppercase;">${escapeHtml(sk.mode || 'chat')}</span>
          </div>
          <span class="custom-skill-desc">${escapeHtml(sk.desc || sk.prompt?.slice(0, 60) || '')}</span>
        </div>
        <div class="custom-skill-actions">
          <button type="button" class="custom-skill-action-btn run-btn" title="Cargar esta skill en el chat">▶ Usar</button>
          <button type="button" class="custom-skill-action-btn delete" title="Eliminar skill">&times;</button>
        </div>
      `;

      item.querySelector('.run-btn')?.addEventListener('click', () => {
        if (sk.mode === 'cowork' && !isCoworkActive) {
          toggleCoworkMode(true);
        } else if (sk.mode === 'chat' && isCoworkActive) {
          toggleCoworkMode(false);
        }
        promptInput.value = sk.prompt || '';
        handleInputStateChange();
        settingsModal?.classList.add('hidden');
        promptInput?.focus();
        showToast(`Skill "/${sk.name}" lista en el chat`);
      });

      item.querySelector('.delete')?.addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm(`¿Eliminar la skill "/${sk.name}"?`)) {
          customSkills.splice(idx, 1);
          try {
            localStorage.setItem('antigravity_custom_skills', JSON.stringify(customSkills));
          } catch (_) {}
          renderCustomSkillsList();
          showToast(`Skill "/${sk.name}" eliminada`);
        }
      });

      container.appendChild(item);
    });
  }

  function renderSkillChips() {
    renderCustomSkillsList();
  }

  // Skill Creator Modal Controls
  const skillCreatorModal = document.getElementById('skillCreatorModal');
  const closeSkillCreatorBtn = document.getElementById('closeSkillCreatorBtn');
  const cancelSkillCreatorBtn = document.getElementById('cancelSkillCreatorBtn');
  const saveSkillModalBtn = document.getElementById('saveSkillModalBtn');
  const openCreateSkillModalBtn = document.getElementById('openCreateSkillModalBtn');
  const newSkillNameInput = document.getElementById('newSkillName');
  const newSkillDescInput = document.getElementById('newSkillDesc');
  const newSkillPromptInput = document.getElementById('newSkillPrompt');
  const newSkillModeInput = document.getElementById('newSkillMode');
  const newSkillCommandPreview = document.getElementById('newSkillCommandPreview');

  function openSkillCreatorModal(prefillPrompt = '') {
    if (!skillCreatorModal) return;
    const currentVal = promptInput ? promptInput.value.replace(/^\/skill\s*/i, '').trim() : '';
    const promptToUse = prefillPrompt || currentVal;

    if (newSkillPromptInput && promptToUse) {
      newSkillPromptInput.value = promptToUse;
    }
    updateSkillCmdPreview();
    skillCreatorModal.classList.remove('hidden');
    if (newSkillNameInput) newSkillNameInput.focus();
  }

  function closeSkillCreatorModal() {
    if (!skillCreatorModal) return;
    skillCreatorModal.classList.add('hidden');
    if (newSkillNameInput) newSkillNameInput.value = '';
    if (newSkillDescInput) newSkillDescInput.value = '';
    if (newSkillPromptInput) newSkillPromptInput.value = '';
    if (newSkillModeInput) newSkillModeInput.value = 'chat';
  }

  function updateSkillCmdPreview() {
    if (!newSkillCommandPreview || !newSkillNameInput) return;
    const slug = (newSkillNameInput.value.trim() || 'my-skill').toLowerCase().replace(/[^a-z0-9_-]/g, '-');
    newSkillCommandPreview.textContent = `/${slug}`;
  }

  newSkillNameInput?.addEventListener('input', updateSkillCmdPreview);
  closeSkillCreatorBtn?.addEventListener('click', closeSkillCreatorModal);
  cancelSkillCreatorBtn?.addEventListener('click', closeSkillCreatorModal);
  openCreateSkillModalBtn?.addEventListener('click', () => openSkillCreatorModal());

  saveSkillModalBtn?.addEventListener('click', () => {
    let name = (newSkillNameInput?.value || '').trim().toLowerCase().replace(/^\//, '').replace(/[^a-z0-9_-]/g, '-');
    const desc = (newSkillDescInput?.value || '').trim() || 'Custom reusable skill';
    const prompt = (newSkillPromptInput?.value || '').trim();
    const mode = newSkillModeInput?.value || 'chat';

    if (!name) {
      showToast('Por favor escribe un nombre para la skill');
      newSkillNameInput?.focus();
      return;
    }
    if (!prompt) {
      showToast('Por favor escribe las instrucciones o prompt de la skill');
      newSkillPromptInput?.focus();
      return;
    }

    const existingIdx = customSkills.findIndex(s => s.name.toLowerCase() === name);
    const newSkill = { name, desc, prompt, mode };
    if (existingIdx >= 0) {
      customSkills[existingIdx] = newSkill;
    } else {
      customSkills.push(newSkill);
    }

    try {
      localStorage.setItem('antigravity_custom_skills', JSON.stringify(customSkills));
    } catch (_) {}

    closeSkillCreatorModal();
    renderCustomSkillsList();
    showToast(`Skill "/${name}" guardada con éxito`);
  });

  const uploadSkillBtn = document.getElementById('uploadSkillBtn');
  const skillFileInput = document.getElementById('skillFileInput');
  if (uploadSkillBtn && skillFileInput) {
    uploadSkillBtn.addEventListener('click', () => skillFileInput.click());
    skillFileInput.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        let name = file.name.replace(/\.[^/.]+$/, '').toLowerCase().replace(/[^a-z0-9_-]/g, '-');
        let desc = 'Custom skill';
        let prompt = text;

        if (file.name.endsWith('.json')) {
          try {
            const parsed = JSON.parse(text);
            name = (parsed.name || name).toLowerCase().replace(/[^a-z0-9_-]/g, '-');
            desc = parsed.desc || parsed.description || desc;
            prompt = parsed.prompt || parsed.instructions || text;
          } catch (_) {}
        } else if (text.startsWith('---')) {
          const parts = text.split('---');
          if (parts.length >= 3) {
            const yamlPart = parts[1];
            prompt = parts.slice(2).join('---').trim();
            const nameMatch = yamlPart.match(/name:\s*([^\n\r]+)/);
            if (nameMatch) name = nameMatch[1].trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-');
            const descMatch = yamlPart.match(/description:\s*([^\n\r]+)/);
            if (descMatch) desc = descMatch[1].trim();
          }
        }

        const existingIdx = customSkills.findIndex(s => s.name === name);
        if (existingIdx >= 0) {
          customSkills[existingIdx] = { name, desc, prompt };
        } else {
          customSkills.push({ name, desc, prompt });
        }
        localStorage.setItem('antigravity_custom_skills', JSON.stringify(customSkills));
        renderCustomSkillsList();
        showToast(`Skill "/${name}" importada`);
      } catch (err) {
        showToast('Error reading skill file');
      }
      skillFileInput.value = '';
    });
  }

  // ─── Theme & Appearance Controls ─────────────────────────────────────────────
  const THEME_PALETTES = {
    cyan: { accent: '#00f2fe', glow: 'rgba(0, 242, 254, 0.35)', search: '#00f2fe' },
    purple: { accent: '#a855f7', glow: 'rgba(168, 85, 247, 0.35)', search: '#a855f7' },
    emerald: { accent: '#10b981', glow: 'rgba(16, 185, 129, 0.35)', search: '#10b981' },
    crimson: { accent: '#f43f5e', glow: 'rgba(244, 63, 94, 0.35)', search: '#f43f5e' },
    amber: { accent: '#f59e0b', glow: 'rgba(245, 158, 11, 0.35)', search: '#f59e0b' },
  };

  function applyTheme(themeKey) {
    const palette = THEME_PALETTES[themeKey] || THEME_PALETTES.cyan;
    document.documentElement.style.setProperty('--accent-color', palette.accent);
    document.documentElement.style.setProperty('--accent-glow', palette.glow);
    document.documentElement.style.setProperty('--accent-search', palette.search);
    document.documentElement.setAttribute('data-theme', themeKey);
    try {
      localStorage.setItem('antigravity_theme', themeKey);
    } catch (_) {}

    document.querySelectorAll('.theme-preset-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-theme') === themeKey);
    });
  }

  function applyBorderBeam(beamStyle) {
    document.documentElement.setAttribute('data-beam-style', beamStyle || 'dynamic');
    try {
      localStorage.setItem('antigravity_border_beam', beamStyle || 'dynamic');
    } catch (_) {}
    const el = document.getElementById('settingBorderBeamGlow');
    if (el && el.value !== beamStyle) el.value = beamStyle;
  }

  function applyChatFontSize(fontSize) {
    document.documentElement.style.setProperty('--chat-font-size', fontSize || '14px');
    try {
      localStorage.setItem('antigravity_chat_font_size', fontSize || '14px');
    } catch (_) {}
    const el = document.getElementById('settingChatFontSize');
    if (el && el.value !== fontSize) el.value = fontSize;
  }

  function applyChatSpacing(spacing) {
    document.documentElement.setAttribute('data-chat-spacing', spacing || 'comfortable');
    try {
      localStorage.setItem('antigravity_chat_spacing', spacing || 'comfortable');
    } catch (_) {}
    const el = document.getElementById('settingChatSpacing');
    if (el && el.value !== spacing) el.value = spacing;
  }

  // Theme preset buttons click listener
  document.querySelectorAll('.theme-preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const theme = btn.getAttribute('data-theme');
      if (theme) applyTheme(theme);
    });
  });

  const settingBorderBeamGlowEl = document.getElementById('settingBorderBeamGlow');
  settingBorderBeamGlowEl?.addEventListener('change', () => {
    applyBorderBeam(settingBorderBeamGlowEl.value);
  });

  const settingChatFontSizeEl = document.getElementById('settingChatFontSize');
  settingChatFontSizeEl?.addEventListener('change', () => {
    applyChatFontSize(settingChatFontSizeEl.value);
  });

  const settingChatSpacingEl = document.getElementById('settingChatSpacing');
  settingChatSpacingEl?.addEventListener('change', () => {
    applyChatSpacing(settingChatSpacingEl.value);
  });

  // Initialize appearance presets
  try {
    const savedTheme = localStorage.getItem('antigravity_theme') || 'cyan';
    applyTheme(savedTheme);
    const savedBeam = localStorage.getItem('antigravity_border_beam') || 'dynamic';
    applyBorderBeam(savedBeam);
    const savedFontSize = localStorage.getItem('antigravity_chat_font_size') || '14px';
    applyChatFontSize(savedFontSize);
    const savedSpacing = localStorage.getItem('antigravity_chat_spacing') || 'comfortable';
    applyChatSpacing(savedSpacing);
  } catch (_) {}

  // Realtime Grid Controls Sync
  const settingGridOpacityEl = document.getElementById('settingGridOpacity');
  if (settingGridOpacityEl) {
    settingGridOpacityEl.addEventListener('change', () => {
      currentGridOpacity = parseFloat(settingGridOpacityEl.value);
    });
  }
  const settingSquareSizeEl = document.getElementById('settingSquareSize');
  if (settingSquareSizeEl) {
    settingSquareSizeEl.addEventListener('change', () => {
      currentSquareSize = parseInt(settingSquareSizeEl.value, 10);
      initBlueprintCanvas();
    });
  }
  const settingTrailDurationEl = document.getElementById('settingTrailDuration');
  if (settingTrailDurationEl) {
    settingTrailDurationEl.addEventListener('change', () => {
      currentTrailDecay = parseFloat(settingTrailDurationEl.value);
    });
  }

  // Underline Tabs Navigation (v-tabs-6 pattern)
  const settingsTabTriggers = document.querySelectorAll('.settings-tab-trigger');
  const settingsTabContents = document.querySelectorAll('.settings-tab-content');

  settingsTabTriggers.forEach((trigger) => {
    trigger.addEventListener('click', () => {
      const tabName = trigger.getAttribute('data-tab');
      settingsTabTriggers.forEach((t) => t.classList.toggle('active', t === trigger));
      settingsTabContents.forEach((c) => {
        if (c.id === `tabContent-${tabName}`) {
          c.classList.remove('hidden');
          c.classList.add('active');
        } else {
          c.classList.add('hidden');
          c.classList.remove('active');
        }
      });
    });
  });

  // Toggle API Key Visibility
  const toggleApiKeyVisibility = document.getElementById('toggleApiKeyVisibility');
  if (toggleApiKeyVisibility && settingTinyFishKey) {
    toggleApiKeyVisibility.addEventListener('click', () => {
      const isPwd = settingTinyFishKey.type === 'password';
      settingTinyFishKey.type = isPwd ? 'text' : 'password';
      toggleApiKeyVisibility.textContent = isPwd ? '🔒' : '👁';
    });
  }

  // Toggle Gemini API Key Visibility
  if (toggleGeminiKeyVisibility && settingGeminiApiKey) {
    toggleGeminiKeyVisibility.addEventListener('click', () => {
      const isPwd = settingGeminiApiKey.type === 'password';
      settingGeminiApiKey.type = isPwd ? 'text' : 'password';
      toggleGeminiKeyVisibility.textContent = isPwd ? '🔒' : '👁';
    });
  }

  // Toggle Anthropic API Key Visibility
  if (toggleAnthropicKeyVisibility && settingAnthropicApiKey) {
    toggleAnthropicKeyVisibility.addEventListener('click', () => {
      const isPwd = settingAnthropicApiKey.type === 'password';
      settingAnthropicApiKey.type = isPwd ? 'text' : 'password';
      toggleAnthropicKeyVisibility.textContent = isPwd ? '🔒' : '👁';
    });
  }

  // Toggle OpenAI API Key Visibility
  if (toggleOpenaiKeyVisibility && settingOpenaiApiKey) {
    toggleOpenaiKeyVisibility.addEventListener('click', () => {
      const isPwd = settingOpenaiApiKey.type === 'password';
      settingOpenaiApiKey.type = isPwd ? 'text' : 'password';
      toggleOpenaiKeyVisibility.textContent = isPwd ? '🔒' : '👁';
    });
  }

  // Test Bridge Button
  const testBridgeBtn = document.getElementById('testBridgeBtn');
  const bridgeStatusBadge = document.getElementById('bridgeStatusBadge');
  if (testBridgeBtn && bridgeStatusBadge) {
    testBridgeBtn.addEventListener('click', async () => {
      const url = settingBridgeUrl.value.trim() || 'http://127.0.0.1:8765';
      bridgeStatusBadge.innerHTML = `<span class="status-dot" style="color:#eab308">●</span> Testing connection...`;
      try {
        const resp = await fetch(`${url}/health`, { method: 'GET', signal: AbortSignal.timeout(3000) });
        if (resp.ok) {
          bridgeStatusBadge.innerHTML = `<span class="status-dot" style="color:#22c55e">●</span> Connected`;
        } else {
          bridgeStatusBadge.innerHTML = `<span class="status-dot" style="color:#ef4444">●</span> Status ${resp.status}`;
        }
      } catch (err) {
        bridgeStatusBadge.innerHTML = `<span class="status-dot" style="color:#ef4444">●</span> Connection failed`;
      }
    });
  }

  // ─── User Settings → Preferences: the same controls as the other tabs, kept in sync both ways ───
  // (the originals keep working and keep being what Save reads; these just change them)
  function syncUserPrefs() {
    document.querySelectorAll('[data-mirror]').forEach((mirror) => {
      const src = document.getElementById(mirror.dataset.mirror);
      if (!src) { mirror.closest('.setting-field, .setting-field-toggle')?.classList.add('hidden'); return; }
      if (mirror.tagName === 'SELECT') {
        if (mirror.options.length !== src.options.length || mirror.dataset.sig !== Array.from(src.options).map((o) => o.value).join('|')) {
          mirror.innerHTML = src.innerHTML;
          mirror.dataset.sig = Array.from(src.options).map((o) => o.value).join('|');
        }
        mirror.value = src.value;
      } else if (mirror.type === 'checkbox') {
        mirror.checked = src.checked;
      } else {
        mirror.value = src.value;
      }
    });
  }

  document.querySelectorAll('[data-mirror]').forEach((mirror) => {
    const src = document.getElementById(mirror.dataset.mirror);
    if (!src) return;
    const push = () => {
      if (mirror.type === 'checkbox') src.checked = mirror.checked;
      else src.value = mirror.value;
      src.dispatchEvent(new Event('input', { bubbles: true }));
      src.dispatchEvent(new Event('change', { bubbles: true }));
    };
    mirror.addEventListener(mirror.tagName === 'SELECT' || mirror.type === 'checkbox' ? 'change' : 'input', push);
    src.addEventListener('change', () => { if (document.activeElement !== mirror) syncUserPrefs(); });
  });

  document.getElementById('userRerunSetupBtn')?.addEventListener('click', () => {
    settingsModal.classList.add('hidden');
    openOnboarding();
  });

  // Open / Close Settings Modal
  settingsBtn.addEventListener('click', () => {
    const savedLocalName = localStorage.getItem('antigravity_user_name') || '';
    const savedLocalNick = localStorage.getItem('antigravity_user_nick') || '';
    const nameInp = document.getElementById('settingUserName');
    const nickInp = document.getElementById('settingUserNickname');
    if (nameInp && !nameInp.value && savedLocalName) nameInp.value = savedLocalName;
    if (nickInp && !nickInp.value && savedLocalNick) nickInp.value = savedLocalNick;
    settingsModal.classList.remove('hidden');
    renderSkillChips();
    renderMcpServersList();
    renderExternalProvidersList();
    renderSettingsEngineChoices();
    renderPricingSettings();
    piperRefresh();
    renderWhisperSettings();
    checkForUpdates({ force: false });
    syncUserPrefs();
  });

  // The mascot switch applies immediately (no need to press Save)
  document.getElementById('settingMascot')?.addEventListener('change', (e) => {
    const on = e.target.checked;
    chrome.storage.local.get(['antigravity_settings'], (res) => {
      const prev = res.antigravity_settings || {};
      prev.mascot = on;
      chrome.storage.local.set({ antigravity_settings: prev });
    });
  });

  document.getElementById('mascotTestBtn')?.addEventListener('click', () => {
    // Preview uses the saved settings only for the test; it shows the "done" animation on the tab behind the panel
    chrome.runtime.sendMessage({ type: 'mascot_test' }, () => void chrome.runtime.lastError);
    showToast('Look at the page you have open: the mascot should appear.');
  });

  closeSettingsBtn.addEventListener('click', () => {
    settingsModal.classList.add('hidden');
  });

  function saveAllSettings() {
    const rawSysPrompt = document.getElementById('settingSystemPrompt')?.value || '';
    const userNick = (document.getElementById('settingUserNickname') || document.getElementById('settingUserNick'))?.value?.trim() || '';
    const userName = document.getElementById('settingUserName')?.value?.trim() || '';

    // Guarantee strict subagent prohibition and user name preference
    let enrichedSysPrompt = rawSysPrompt;
    if (!enrichedSysPrompt.includes('PROHIBIDO crear, invocar o delegar')) {
      enrichedSysPrompt = (enrichedSysPrompt ? `${enrichedSysPrompt}\n\n` : '') +
        'DIRECTIVA CRÍTICA: Está TERMINANTEMENTE PROHIBIDO crear, invocar o delegar en subagentes propios para editar archivos o navegar la web. Todas las acciones se ejecutan directamente en este hilo.';
    }
    if (userNick && !enrichedSysPrompt.includes(`Usuario prefiere ser llamado:`)) {
      enrichedSysPrompt += `\nUsuario prefiere ser llamado: ${userNick}.`;
    }

    const antigravityModeVal = settingAntigravityMode ? settingAntigravityMode.value : currentAntigravityMode;
    const geminiApiKeyVal = settingGeminiApiKey ? settingGeminiApiKey.value.trim() : currentGeminiApiKey;
    currentAntigravityMode = antigravityModeVal || 'desktop';
    currentGeminiApiKey = geminiApiKeyVal || '';

    const claudeModeVal = settingClaudeMode ? settingClaudeMode.value : currentClaudeMode;
    const anthropicApiKeyVal = settingAnthropicApiKey ? settingAnthropicApiKey.value.trim() : currentAnthropicApiKey;
    currentClaudeMode = claudeModeVal || 'desktop';
    currentAnthropicApiKey = anthropicApiKeyVal || '';

    const openaiModeVal = settingOpenaiMode ? settingOpenaiMode.value : currentOpenaiMode;
    const openaiApiKeyVal = settingOpenaiApiKey ? settingOpenaiApiKey.value.trim() : currentOpenaiApiKey;
    currentOpenaiMode = openaiModeVal || 'desktop';
    currentOpenaiApiKey = openaiApiKeyVal || '';

    try {
      localStorage.setItem('antigravity_antigravity_mode', currentAntigravityMode);
      localStorage.setItem('antigravity_gemini_api_key', currentGeminiApiKey);
      localStorage.setItem('antigravity_claude_mode', currentClaudeMode);
      localStorage.setItem('antigravity_anthropic_api_key', currentAnthropicApiKey);
      localStorage.setItem('antigravity_openai_mode', currentOpenaiMode);
      localStorage.setItem('antigravity_openai_api_key', currentOpenaiApiKey);
    } catch (_) {}

    const newSettings = {
      bridgeUrl: settingBridgeUrl?.value.trim() || 'http://127.0.0.1:8765',
      selectedModel: settingDefaultModel?.value || currentModel,
      maxSteps: parseInt(settingMaxSteps?.value, 10) || 30,
      tinyFishApiKey: settingTinyFishKey ? settingTinyFishKey.value.trim() : '',
      displayMode: settingDisplayMode ? settingDisplayMode.value : 'side_panel',
      antigravityMode: currentAntigravityMode,
      geminiApiKey: currentGeminiApiKey,
      claudeMode: currentClaudeMode,
      anthropicApiKey: currentAnthropicApiKey,
      openaiMode: currentOpenaiMode,
      openaiApiKey: currentOpenaiApiKey,
      agentLanguage: document.getElementById('settingAgentLanguage')?.value || 'en',
      defaultThinking: document.getElementById('settingDefaultThinking')?.value || 'medium',
      systemPrompt: enrichedSysPrompt,
      autonomyMode: document.getElementById('settingAutonomyMode')?.value || 'supervised',
      visionScreenshots: document.getElementById('settingVisionScreenshots')?.checked ?? true,
      actionDelay: parseInt(document.getElementById('settingActionDelay')?.value || '350', 10),
      gridOpacity: document.getElementById('settingGridOpacity')?.value || '0.065',
      squareSize: parseInt(document.getElementById('settingSquareSize')?.value || '44', 10),
      trailDuration: document.getElementById('settingTrailDuration')?.value || '0.022',
      completionSound: document.getElementById('settingCompletionSound')?.checked ?? true,
      borderBeamGlow: document.getElementById('settingBorderBeamGlow')?.value || 'dynamic',
      chatFontSize: document.getElementById('settingChatFontSize')?.value || '14px',
      chatSpacing: document.getElementById('settingChatSpacing')?.value || 'comfortable',
      colorTheme: localStorage.getItem('antigravity_theme') || 'cyan',
      shadowEnabled: document.getElementById('settingShadowEnabled')?.checked ?? true,
      shadowPreventSleep: document.getElementById('settingShadowPreventSleep')?.checked ?? true,
      shadowAutoWake: document.getElementById('settingShadowAutoWake')?.checked ?? true,
      shadowOnComplete: document.getElementById('settingShadowOnComplete')?.value || 'sleep',
      tabGrouping: document.getElementById('settingTabGrouping')?.checked ?? true,
      workingOverlay: document.getElementById('settingWorkingOverlay')?.checked ?? true,
      multiAgent: document.getElementById('settingMultiAgent')?.checked ?? false,
      agentConfirm: document.getElementById('settingAgentConfirm')?.checked ?? true,
      mascot: document.getElementById('settingMascot')?.checked ?? true,
      tabLockedSidebar: document.getElementById('settingTabLockedSidebar')?.checked ?? false,
      waitMessageSentOutInstantly: document.getElementById('settingWaitMessageSentOutInstantly')?.checked ?? true,
      localMcpBridgeEnabled: document.getElementById('settingLocalMcpBridgeEnabled')?.checked ?? false,
      localMcpUrl: getFullMcpSseUrl(),
      userName,
      userNickname: userNick,
      customSkills,
    };

    tinyFishApiKey = newSettings.tinyFishApiKey;
    currentGridOpacity = parseFloat(newSettings.gridOpacity);
    currentSquareSize = newSettings.squareSize;
    currentTrailDecay = parseFloat(newSettings.trailDuration);

    if (userName) localStorage.setItem('antigravity_user_name', userName);
    if (userNick) localStorage.setItem('antigravity_user_nick', userNick);
    const topAuthLabel = document.getElementById('topAuthLabel');
    if (topAuthLabel && (userNick || userName)) {
      topAuthLabel.textContent = userNick || userName;
    }

    try {
      localStorage.setItem('antigravity_settings', JSON.stringify(newSettings));
    } catch (_) {}

    localStorage.setItem('autono_local_mcp_bridge_enabled', String(newSettings.localMcpBridgeEnabled));
    localStorage.setItem('autono_local_mcp_url', newSettings.localMcpUrl);
    chrome.storage.local.set({ autono_local_mcp_url: newSettings.localMcpUrl });
    updateLocalMcpStatusUI(newSettings.localMcpBridgeEnabled);
    refreshMcpSnippet();

    sendPortMessage({ type: 'save_settings', settings: newSettings });

    const bridgeUrl = (newSettings.bridgeUrl || 'http://127.0.0.1:8765').replace(/\/+$/, '');
    fetch(`${bridgeUrl}/api/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        antigravity_mode: currentAntigravityMode,
        gemini_api_key: currentGeminiApiKey,
        claude_mode: currentClaudeMode,
        anthropic_api_key: currentAnthropicApiKey,
        openai_mode: currentOpenaiMode,
        openai_api_key: currentOpenaiApiKey,
      }),
    }).catch(() => null);
    applyKeepAwake(newSettings.shadowPreventSleep);
    selectModel(newSettings.selectedModel);
    renderModelPickerRows(modelSearchInput.value);
    settingsModal.classList.add('hidden');
    showToast('Settings saved');
    updateContextMeter();

    initBlueprintCanvas();
  }

  document.querySelectorAll('.save-settings-btn').forEach((btn) => {
    btn.addEventListener('click', saveAllSettings);
  });

  // ─── Shadow Execution & Power Management Controller ────────────────────────
  async function applyKeepAwake(enable) {
    const shadowStatusPill = document.getElementById('shadowStatusPill');
    const bridgeUrl = settingBridgeUrl?.value?.trim() || 'http://127.0.0.1:8765';
    try {
      if (enable) {
        if (chrome.power && chrome.power.requestKeepAwake) {
          chrome.power.requestKeepAwake('system');
        }
        if (shadowStatusPill) {
          shadowStatusPill.className = 'shadow-status-pill awake';
          shadowStatusPill.textContent = '● Desvelo Activo';
        }
        fetch(`${bridgeUrl}/api/power/prevent-sleep`, { method: 'POST' }).catch(() => null);
      } else {
        if (chrome.power && chrome.power.releaseKeepAwake) {
          chrome.power.releaseKeepAwake();
        }
        if (shadowStatusPill) {
          shadowStatusPill.className = 'shadow-status-pill ready';
          shadowStatusPill.textContent = '● Shadow Listo';
        }
        fetch(`${bridgeUrl}/api/power/release-sleep`, { method: 'POST' }).catch(() => null);
      }
    } catch (e) {
      console.warn('Keep awake error:', e);
    }
  }

  const shadowSleepNowBtn = document.getElementById('shadowSleepNowBtn');
  const shadowShutdownNowBtn = document.getElementById('shadowShutdownNowBtn');
  const shadowTestWakeBtn = document.getElementById('shadowTestWakeBtn');
  const shadowCancelShutdownBtn = document.getElementById('shadowCancelShutdownBtn');
  const shadowActionFeedback = document.getElementById('shadowActionFeedback');
  const settingShadowPreventSleep = document.getElementById('settingShadowPreventSleep');
  let shutdownCountdownTimer = null;

  function showShadowFeedback(msg, isError = false) {
    if (!shadowActionFeedback) return;
    shadowActionFeedback.classList.remove('hidden');
    shadowActionFeedback.style.borderColor = isError ? 'rgba(239, 68, 68, 0.4)' : 'rgba(56, 189, 248, 0.3)';
    shadowActionFeedback.style.color = isError ? '#fca5a5' : '#bae6fd';
    shadowActionFeedback.textContent = msg;
  }

  if (settingShadowPreventSleep) {
    settingShadowPreventSleep.addEventListener('change', () => {
      applyKeepAwake(settingShadowPreventSleep.checked);
    });
  }

  if (shadowSleepNowBtn) {
    shadowSleepNowBtn.addEventListener('click', async () => {
      const ok = confirm('Put computer to Sleep now?');
      if (!ok) return;
      const bridgeUrl = settingBridgeUrl?.value?.trim() || 'http://127.0.0.1:8765';
      showShadowFeedback('Sending sleep command to system...');
      try {
        const resp = await fetch(`${bridgeUrl}/api/power/sleep`, { method: 'POST' });
        const data = await resp.json();
        showShadowFeedback(data.message || 'Computer is now sleeping.');
      } catch (err) {
        showShadowFeedback(`Could not put computer to sleep. Is AntigravityBridge running? (${err.message})`, true);
      }
    });
  }

  if (shadowShutdownNowBtn) {
    shadowShutdownNowBtn.addEventListener('click', async () => {
      const ok = confirm('Start countdown to shut down the computer in 30 seconds? You can cancel at any time.');
      if (!ok) return;
      const bridgeUrl = settingBridgeUrl?.value?.trim() || 'http://127.0.0.1:8765';
      try {
        const resp = await fetch(`${bridgeUrl}/api/power/shutdown`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ delay_seconds: 30, action: 'shutdown' }),
        });
        const data = await resp.json();
        if (resp.ok) {
          if (shadowCancelShutdownBtn) shadowCancelShutdownBtn.classList.remove('hidden');
          const shadowStatusPill = document.getElementById('shadowStatusPill');
          if (shadowStatusPill) {
            shadowStatusPill.className = 'shadow-status-pill counting';
            shadowStatusPill.textContent = '● Shutting down (30s)';
          }
          let remaining = 30;
          clearInterval(shutdownCountdownTimer);
          shutdownCountdownTimer = setInterval(() => {
            remaining--;
            if (remaining > 0) {
              showShadowFeedback(`⚠️ PC will shut down in ${remaining}s. Click "Cancel Shutdown" to abort.`);
            } else {
              clearInterval(shutdownCountdownTimer);
              showShadowFeedback('Shutting down PC...');
            }
          }, 1000);
          showShadowFeedback(`⚠️ PC will shut down in 30s. Click "Cancel Shutdown" to abort.`);
        } else {
          showShadowFeedback(data.detail || 'Error ordering shutdown.', true);
        }
      } catch (err) {
        showShadowFeedback(`Error connecting to AntigravityBridge: ${err.message}`, true);
      }
    });
  }

  if (shadowCancelShutdownBtn) {
    shadowCancelShutdownBtn.addEventListener('click', async () => {
      clearInterval(shutdownCountdownTimer);
      const bridgeUrl = settingBridgeUrl?.value?.trim() || 'http://127.0.0.1:8765';
      try {
        const resp = await fetch(`${bridgeUrl}/api/power/cancel-shutdown`, { method: 'POST' });
        const data = await resp.json();
        shadowCancelShutdownBtn.classList.add('hidden');
        const shadowStatusPill = document.getElementById('shadowStatusPill');
        if (shadowStatusPill) {
          shadowStatusPill.className = 'shadow-status-pill ready';
          shadowStatusPill.textContent = '● Shadow Ready';
        }
        showShadowFeedback(data.message || 'Shutdown cancelled successfully.');
      } catch (err) {
        showShadowFeedback(`Error cancelling shutdown: ${err.message}`, true);
      }
    });
  }

  if (shadowTestWakeBtn) {
    shadowTestWakeBtn.addEventListener('click', async () => {
      const bridgeUrl = settingBridgeUrl?.value?.trim() || 'http://127.0.0.1:8765';
      showShadowFeedback('Scheduling test RTC wake timer...');
      try {
        const resp = await fetch(`${bridgeUrl}/api/power/schedule-wake`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ delay_minutes: 2 }),
        });
        const data = await resp.json();
        if (resp.ok) {
          showShadowFeedback(`✓ RTC wake alarm configured for 2 minutes from now. If you put your PC to sleep now, Windows will wake up automatically to run tasks.`);
        } else {
          showShadowFeedback(data.detail || 'Could not configure RTC wake timer.', true);
        }
      } catch (err) {
        showShadowFeedback(`Connection error with Bridge: ${err.message}`, true);
      }
    });
  }

  // ─── Scratchpad Logic ──────────────────────────────────────────────────────
  const scratchpadTextarea = document.getElementById('scratchpadTextarea');
  const scratchpadSaveStatus = document.getElementById('scratchpadSaveStatus');
  const scratchpadStats = document.getElementById('scratchpadStats');
  const scratchpadInsertBtn = document.getElementById('scratchpadInsertBtn');
  const scratchpadCopyBtn = document.getElementById('scratchpadCopyBtn');
  const scratchpadDownloadBtn = document.getElementById('scratchpadDownloadBtn');
  const scratchpadClearBtn = document.getElementById('scratchpadClearBtn');
  const scratchpadTemplateSelect = document.getElementById('scratchpadTemplateSelect');

  const SCRATCHPAD_TEMPLATES = {
    custom: '',
    code_review: `# Code Review Plan
- [ ] Architecture and separation of concerns
- [ ] Error handling and edge cases
- [ ] Security and input validation
- [ ] Performance and memory usage
- [ ] Unit and integration tests`,
    research_plan: `# Research Plan
## Objective
Explore and summarize state of the art regarding: 

## Key Questions
1. What are current industry best practices?
2. What alternatives exist and what are their trade-offs?
3. How does this integrate with our technical stack?`,
    task_goals: `# Task List / Goal Tracker (/goal)
- [ ] Scope definition
- [ ] Task 1: 
- [ ] Task 2: 
- [ ] Verification and automated tests
- [ ] Final documentation`,
    bug_debug: `# Bug Analysis & Root Cause Hypotheses
## Observed Behavior
- What happens: 
- What should happen: 

## Reproduction Steps
1. 
2. 

## Root Cause Hypotheses
- 

## Solution Plan
- `,
    system_instructions: `# Personality and Directives
You are a world-class principal software engineer.
- Always respond with high technical precision and concise clarity.
- Never invent undocumented APIs.
- Prioritize well-tested and secure architectural patterns.`,
  };

  function updateScratchpadStats() {
    if (!scratchpadTextarea || !scratchpadStats) return;
    const text = scratchpadTextarea.value || '';
    const chars = text.length;
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    scratchpadStats.textContent = `${chars} characters • ${words} words`;
  }

  let scratchpadDebounceTimer = null;
  function initScratchpad() {
    if (!scratchpadTextarea) return;
    const saved = localStorage.getItem('antigravity_scratchpad');
    if (saved && !scratchpadTextarea.value) {
      scratchpadTextarea.value = saved;
      updateScratchpadStats();
    }

    scratchpadTextarea.removeEventListener('input', onScratchpadInput);
    scratchpadTextarea.addEventListener('input', onScratchpadInput);

    if (scratchpadInsertBtn && !scratchpadInsertBtn._bound) {
      scratchpadInsertBtn._bound = true;
      scratchpadInsertBtn.addEventListener('click', () => {
        const text = scratchpadTextarea.value.trim();
        if (!text) {
          alert('Scratchpad is empty. Write something first.');
          return;
        }
        if (promptInput) {
          const prev = promptInput.value;
          promptInput.value = prev ? `${text}\n\n${prev}` : text;
          autoResizePrompt();
          promptInput.focus();
        }
        settingsModal.classList.add('hidden');
      });
    }

    if (scratchpadCopyBtn && !scratchpadCopyBtn._bound) {
      scratchpadCopyBtn._bound = true;
      scratchpadCopyBtn.addEventListener('click', async () => {
        const text = scratchpadTextarea.value;
        if (!text) return;
        try {
          await navigator.clipboard.writeText(text);
          const orig = scratchpadCopyBtn.innerHTML;
          scratchpadCopyBtn.innerHTML = '✓ Copied';
          setTimeout(() => { scratchpadCopyBtn.innerHTML = orig; }, 1800);
        } catch (e) {
          console.warn('Clipboard copy failed:', e);
        }
      });
    }

    if (scratchpadDownloadBtn && !scratchpadDownloadBtn._bound) {
      scratchpadDownloadBtn._bound = true;
      scratchpadDownloadBtn.addEventListener('click', () => {
        const text = scratchpadTextarea.value;
        if (!text) return;
        const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `antigravity-scratchpad-${new Date().toISOString().slice(0, 10)}.md`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      });
    }

    if (scratchpadClearBtn && !scratchpadClearBtn._bound) {
      scratchpadClearBtn._bound = true;
      scratchpadClearBtn.addEventListener('click', () => {
        if (!scratchpadTextarea.value) return;
        if (confirm('Do you want to clear all scratchpad content?')) {
          scratchpadTextarea.value = '';
          localStorage.removeItem('antigravity_scratchpad');
          updateScratchpadStats();
        }
      });
    }

    if (scratchpadTemplateSelect && !scratchpadTemplateSelect._bound) {
      scratchpadTemplateSelect._bound = true;
      scratchpadTemplateSelect.addEventListener('change', () => {
        const tmplKey = scratchpadTemplateSelect.value;
        const templateContent = SCRATCHPAD_TEMPLATES[tmplKey];
        if (templateContent !== undefined) {
          if (scratchpadTextarea.value.trim() && !confirm('Do you want to replace current content with the selected template?')) {
            return;
          }
          scratchpadTextarea.value = templateContent;
          localStorage.setItem('antigravity_scratchpad', templateContent);
          updateScratchpadStats();
        }
      });
    }
  }

  function onScratchpadInput() {
    updateScratchpadStats();
    if (scratchpadSaveStatus) {
      scratchpadSaveStatus.textContent = 'Saving...';
      scratchpadSaveStatus.style.opacity = '0.7';
    }
    clearTimeout(scratchpadDebounceTimer);
    scratchpadDebounceTimer = setTimeout(() => {
      localStorage.setItem('antigravity_scratchpad', scratchpadTextarea.value);
      if (scratchpadSaveStatus) {
        scratchpadSaveStatus.textContent = '✓ Saved';
        scratchpadSaveStatus.style.opacity = '1';
      }
    }, 350);
  }

  initScratchpad();

  // ─── Onboarding / Sign In Multi-Step Wizard Controller ──────────────────────
  const onboardingModal = document.getElementById('onboardingModal');
  const authBtn = document.getElementById('authBtn');
  const closeOnboardingBtn = document.getElementById('closeOnboardingBtn');
  const wizardBackBtn = document.getElementById('wizardBackBtn');
  const wizardNextBtn = document.getElementById('wizardNextBtn');
  const onboardFinishBtn = document.getElementById('onboardFinishBtn');
  const onboardTestBridgeBtn = document.getElementById('onboardTestBridgeBtn');
  const onboardBridgeStatus = document.getElementById('onboardBridgeStatus');
  const wizardProgressBar = document.getElementById('wizardProgressBar');
  const wizardStepTitle = document.getElementById('wizardStepTitle');
  const wizardStepSubtitle = document.getElementById('wizardStepSubtitle');
  const onboardGreetingPreview = document.getElementById('onboardGreetingPreview');
  const onboardNameInput = document.getElementById('onboardName');
  const onboardNicknameInput = document.getElementById('onboardNickname');

  let currentWizardStep = 1;
  let selectedOnboardLang = 'en';

  const stepMeta = [
    { title: 'Welcome to Antigravity', subtitle: 'Step 1 of 3: Choose your language' },
    { title: 'Personal Profile', subtitle: 'Step 2 of 3: How should we call you?' },
    { title: 'Bridge & Intelligence', subtitle: 'Step 3 of 3: Connect local backend' }
  ];

  function updateWizardGreetingPreview() {
    if (!onboardGreetingPreview) return;
    const nick = onboardNicknameInput?.value?.trim() || onboardNameInput?.value?.trim() || '';
    if (nick) {
      if (selectedOnboardLang === 'es') {
        onboardGreetingPreview.textContent = `"¡Hola, ${nick}! Soy Antigravity. ¿Qué vamos a construir hoy?"`;
      } else if (selectedOnboardLang === 'pt') {
        onboardGreetingPreview.textContent = `"Olá, ${nick}! Sou o Antigravity. O que vamos construir hoje?"`;
      } else if (selectedOnboardLang === 'fr') {
        onboardGreetingPreview.textContent = `"Bonjour ${nick} ! Je suis Antigravity. Que construisons-nous aujourd'hui ?"`;
      } else if (selectedOnboardLang === 'de') {
        onboardGreetingPreview.textContent = `"Hallo ${nick}! Ich bin Antigravity. Was bauen wir heute?"`;
      } else if (selectedOnboardLang === 'zh') {
        onboardGreetingPreview.textContent = `"你好，${nick}！我是 Antigravity。今天我们来构建什么？"`;
      } else {
        onboardGreetingPreview.textContent = `"Hello ${nick}! I am Antigravity. What should we build today?"`;
      }
    } else {
      onboardGreetingPreview.textContent = '"Hello! I am Antigravity. What should we build today?"';
    }
  }

  function goToWizardStep(step) {
    if (step < 1) step = 1;
    if (step > 3) step = 3;
    currentWizardStep = step;

    // Update Progress Bar
    if (wizardProgressBar) {
      const pct = (step / 3) * 100;
      wizardProgressBar.style.width = `${pct}%`;
    }

    // Update Titles
    const meta = stepMeta[step - 1];
    if (wizardStepTitle && meta) wizardStepTitle.textContent = meta.title;
    if (wizardStepSubtitle && meta) wizardStepSubtitle.textContent = meta.subtitle;

    // Update Step Indicator Dots
    const dots = document.querySelectorAll('.wizard-step-dot');
    dots.forEach((dot) => {
      const dStep = parseInt(dot.getAttribute('data-step'), 10);
      dot.classList.toggle('active', dStep === step);
      dot.classList.toggle('completed', dStep < step);
    });

    // Update Step Panes with slide animation
    for (let i = 1; i <= 3; i++) {
      const pane = document.getElementById(`wizardPane-${i}`);
      if (pane) {
        if (i === step) {
          pane.classList.remove('hidden');
          pane.classList.add('active');
        } else {
          pane.classList.add('hidden');
          pane.classList.remove('active');
        }
      }
    }

    // Update Navigation Buttons
    if (wizardBackBtn) {
      wizardBackBtn.classList.toggle('hidden', step === 1);
    }
    if (wizardNextBtn) {
      wizardNextBtn.classList.toggle('hidden', step === 3);
    }
    if (onboardFinishBtn) {
      onboardFinishBtn.classList.toggle('hidden', step !== 3);
    }

    if (step === 2) {
      updateWizardGreetingPreview();
      setTimeout(() => onboardNicknameInput?.focus(), 150);
    }
  }

  function openOnboarding() {
    if (!onboardingModal) return;
    onboardingModal.classList.remove('hidden');
    goToWizardStep(1);

    const savedName = localStorage.getItem('antigravity_user_name') || '';
    const savedNick = localStorage.getItem('antigravity_user_nick') || '';
    const savedBridge = localStorage.getItem('antigravity_bridge_url') || (settingBridgeUrl ? settingBridgeUrl.value : 'http://127.0.0.1:8765');
    if (onboardNameInput && savedName) onboardNameInput.value = savedName;
    if (onboardNicknameInput && savedNick) onboardNicknameInput.value = savedNick;
    if (document.getElementById('onboardBridgeUrl')) document.getElementById('onboardBridgeUrl').value = savedBridge;

    const savedLang = localStorage.getItem('antigravity_lang') || 'en';
    selectedOnboardLang = savedLang;
    const flagButtons = document.querySelectorAll('.lang-flag-card');
    flagButtons.forEach((c) => {
      c.classList.toggle('active', c.getAttribute('data-lang') === savedLang);
    });
  }

  function closeOnboarding() {
    if (onboardingModal) {
      onboardingModal.classList.add('hidden');
    }
  }

  if (authBtn) {
    authBtn.addEventListener('click', openOnboarding);
  }

  if (closeOnboardingBtn) {
    closeOnboardingBtn.addEventListener('click', closeOnboarding);
  }

  if (wizardNextBtn) {
    wizardNextBtn.addEventListener('click', () => {
      goToWizardStep(currentWizardStep + 1);
    });
  }

  if (wizardBackBtn) {
    wizardBackBtn.addEventListener('click', () => {
      goToWizardStep(currentWizardStep - 1);
    });
  }

  // Allow clicking directly on stepper dots
  document.querySelectorAll('.wizard-step-dot').forEach((dot) => {
    dot.addEventListener('click', () => {
      const targetStep = parseInt(dot.getAttribute('data-step'), 10);
      if (targetStep) goToWizardStep(targetStep);
    });
  });

  // Flag selection: highlight clicked card and proactively advance to step 2
  const flagButtons = document.querySelectorAll('.lang-flag-card');
  flagButtons.forEach((card) => {
    card.addEventListener('click', () => {
      flagButtons.forEach((c) => c.classList.remove('active'));
      card.classList.add('active');
      selectedOnboardLang = card.getAttribute('data-lang') || 'en';
      // Smooth proactive step transition
      setTimeout(() => {
        if (currentWizardStep === 1) {
          goToWizardStep(2);
        }
      }, 220);
    });
  });

  // Live preview typing listeners
  if (onboardNicknameInput) {
    onboardNicknameInput.addEventListener('input', updateWizardGreetingPreview);
  }
  if (onboardNameInput) {
    onboardNameInput.addEventListener('input', updateWizardGreetingPreview);
  }

  // Local Bridge Test in Step 3
  if (onboardTestBridgeBtn) {
    onboardTestBridgeBtn.addEventListener('click', async () => {
      const bridgeUrlInput = document.getElementById('onboardBridgeUrl');
      const testUrl = (bridgeUrlInput?.value || 'http://127.0.0.1:8765').trim();
      if (onboardBridgeStatus) {
        onboardBridgeStatus.innerHTML = '<span class="status-dot" style="color:#eab308">●</span> Testing connection...';
      }
      try {
        const resp = await fetch(`${testUrl.replace(/\/$/, '')}/health`, { method: 'GET', signal: AbortSignal.timeout(3000) });
        if (resp.ok) {
          if (onboardBridgeStatus) {
            onboardBridgeStatus.innerHTML = '<span class="status-dot" style="color:#22c55e">●</span> Connected to local bridge!';
          }
          showToast('Local bridge is healthy and running');
        } else {
          throw new Error('Non-200 response');
        }
      } catch (_) {
        if (onboardBridgeStatus) {
          onboardBridgeStatus.innerHTML = '<span class="status-dot" style="color:#ef4444">●</span> Bridge unreachable (check port 8765)';
        }
        showToast('Could not reach bridge on port 8765');
      }
    });
  }

  // Complete Setup / Sign In
  if (onboardFinishBtn) {
    onboardFinishBtn.addEventListener('click', () => {
      const name = onboardNameInput?.value?.trim() || '';
      const nickname = onboardNicknameInput?.value?.trim() || name || 'User';
      const bridgeUrl = document.getElementById('onboardBridgeUrl')?.value?.trim() || 'http://127.0.0.1:8765';
      const defaultModel = document.getElementById('onboardDefaultModel')?.value || 'gemini-3.8-flash-medium';
      const tinyKey = document.getElementById('onboardTinyFishKey')?.value?.trim() || '';

      try {
        localStorage.setItem('antigravity_onboarded', 'true');
        localStorage.setItem('antigravity_user_name', name);
        localStorage.setItem('antigravity_user_nick', nickname);
        localStorage.setItem('antigravity_bridge_url', bridgeUrl);
        localStorage.setItem('antigravity_lang', selectedOnboardLang);
      } catch (_) {}

      // Update Settings fields as well
      const settingName = document.getElementById('settingUserName');
      if (settingName) settingName.value = name;
      const settingNick = document.getElementById('settingUserNickname');
      if (settingNick) settingNick.value = nickname;
      if (settingBridgeUrl) settingBridgeUrl.value = bridgeUrl;
      if (settingTinyFishKey && tinyKey) {
        settingTinyFishKey.value = tinyKey;
        tinyFishApiKey = tinyKey;
      }
      const langInput = document.getElementById('settingAgentLanguage');
      if (langInput) langInput.value = selectedOnboardLang;

      // Update header auth button label
      const topAuthLabel = document.getElementById('topAuthLabel');
      if (topAuthLabel) {
        topAuthLabel.textContent = nickname;
      }

      selectModel(defaultModel);
      closeOnboarding();
      showToast(`Welcome to Antigravity, ${nickname}!`);
    });
  }

  // Check initial onboarding state & restore user nickname
  try {
    const isOnboarded = localStorage.getItem('antigravity_onboarded');
    const savedNick = localStorage.getItem('antigravity_user_nick');
    if (savedNick) {
      const topAuthLabel = document.getElementById('topAuthLabel');
      if (topAuthLabel) topAuthLabel.textContent = savedNick;
    }
    if (!isOnboarded) {
      setTimeout(openOnboarding, 800);
    }
  } catch (_) {}

  // ─── Slash Commands Engine (/goal, /schedule, /grill-me, /teamwork, /learn, /btw, +skills) ──
  const BUILTIN_SLASH_COMMANDS = [
    {
      name: '/goal',
      desc: 'Run task autonomously until completion without stopping',
      tag: 'Goal',
      prefix: '/goal ',
      enabled: true,
    },
    {
      name: '/schedule',
      desc: 'Create a scheduled or recurring automated task',
      tag: 'Schedule',
      prefix: '/schedule ',
      enabled: true,
    },
    {
      name: '/grill-me',
      desc: 'Deep context interview: asks clarifying questions before proceeding',
      tag: 'Interview',
      prefix: '/grill-me ',
      enabled: true,
    },
    {
      name: '/teamwork',
      desc: 'Run this request with parallel sub-agents',
      tag: 'Team',
      prefix: '/teamwork ',
      enabled: true,
    },
    {
      name: '/learn',
      desc: 'Synthesize completed work and extract reusable skill',
      tag: 'Skill',
      prefix: '/learn ',
      enabled: true,
    },
    {
      name: '/btw',
      desc: 'Ask side questions to an external agent without task access',
      tag: 'Sidecar',
      prefix: '/btw ',
      enabled: true,
      action: 'open_btw',
    },
    {
      name: '/skill',
      desc: 'Crear o gestionar una skill reusable para repetir esta tarea',
      tag: 'Skill',
      prefix: '/skill ',
      enabled: true,
      action: 'open_skill_creator',
    },
  ];

  function getAllSlashCommands() {
    const list = [...BUILTIN_SLASH_COMMANDS];

    // MCP Servers
    try {
      const allServers = Array.isArray(allMcpServers) ? allMcpServers : [];
      allServers.forEach((srv) => {
        if (!srv || !srv.name) return;
        const slash = srv.slashCmd || `/mcp:${srv.name.toLowerCase().replace(/[^a-z0-9_-]/g, '-')}`;
        list.push({
          name: slash,
          desc: srv.desc || `MCP Server: ${srv.name}`,
          tag: 'MCP',
          prefix: `${slash} `,
          enabled: true,
          isMcpServer: true,
          mcpServer: srv,
        });
      });
    } catch (_) {}

    // Custom Skills
    try {
      const skillsList = Array.isArray(customSkills) ? customSkills : [];
      skillsList.forEach((sk) => {
        if (!sk || !sk.name) return;
        list.push({
          name: `/${sk.name}`,
          desc: sk.desc || (sk.prompt ? sk.prompt.slice(0, 50) + '...' : 'Custom Skill'),
          tag: 'Skill',
          prefix: `/${sk.name} `,
          enabled: true,
          isCustomSkill: true,
          skill: sk,
        });
      });
    } catch (_) {}

    return list;
  }

  const slashCommandsMenu = document.getElementById('slashCommandsMenu');
  const slashCommandsList = document.getElementById('slashCommandsList');
  let activeSlashIndex = 0;
  let filteredSlashCommands = [];

  function showSlashMenu(filterText = '') {
    if (!slashCommandsMenu || !slashCommandsList) return;
    const all = getAllSlashCommands();
    const cleanQuery = filterText.replace(/^\//, '').toLowerCase().trim();
    filteredSlashCommands = all.filter((c) => {
      const cmdName = c.name.replace(/^\//, '').toLowerCase();
      // Support alias /tmarked for /teamwork
      if (cleanQuery === 'tmarked' && (cmdName === 'teamwork' || cmdName.includes('team'))) {
        return true;
      }
      return cmdName.includes(cleanQuery) || c.desc.toLowerCase().includes(cleanQuery);
    });

    if (filteredSlashCommands.length === 0) {
      hideSlashMenu();
      return;
    }

    activeSlashIndex = 0;
    renderSlashMenuItems();
    slashCommandsMenu.classList.remove('hidden');
  }

  function hideSlashMenu() {
    if (slashCommandsMenu) {
      slashCommandsMenu.classList.add('hidden');
    }
  }

  function renderSlashMenuItems() {
    if (!slashCommandsList) return;
    slashCommandsList.innerHTML = '';
    filteredSlashCommands.forEach((cmd, idx) => {
      const item = document.createElement('div');
      item.className = `slash-command-item ${idx === activeSlashIndex ? 'active' : ''} ${!cmd.enabled ? 'disabled' : ''}`;
      item.setAttribute('role', 'option');
      item.setAttribute('aria-selected', idx === activeSlashIndex ? 'true' : 'false');

      item.innerHTML = `
        <div class="slash-cmd-left">
          <span class="slash-cmd-badge">${escapeHtml(cmd.name)}</span>
          <span class="slash-cmd-desc">${escapeHtml(cmd.desc)}</span>
        </div>
        <span class="slash-cmd-tag">${escapeHtml(cmd.tag)}</span>
      `;

      if (cmd.enabled) {
        item.addEventListener('mouseenter', () => {
          activeSlashIndex = idx;
          slashCommandsList.querySelectorAll('.slash-command-item').forEach((el, i) => {
            el.classList.toggle('active', i === idx);
            el.setAttribute('aria-selected', i === idx ? 'true' : 'false');
          });
        });

        // Instant autocomplete on click or mousedown
        item.addEventListener('mousedown', (e) => {
          e.preventDefault();
          e.stopPropagation();
          selectSlashCommand(cmd);
        });
        item.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          selectSlashCommand(cmd);
        });
      }
      slashCommandsList.appendChild(item);
    });

    const activeEl = slashCommandsList.querySelector('.slash-command-item.active');
    if (activeEl) {
      activeEl.scrollIntoView({ block: 'nearest' });
    }
  }

  function selectSlashCommand(cmd) {
    if (!cmd || !cmd.enabled) return;

    if (cmd.action === 'open_btw') {
      openBtwPopup();
      hideSlashMenu();
      promptInput.value = promptInput.value.replace(/^\/btw\s*/i, '').trim();
      handleInputStateChange();
      return;
    }

    if (cmd.action === 'open_skill_creator') {
      hideSlashMenu();
      const currentVal = promptInput.value.replace(/^\/skill\s*/i, '').trim();
      promptInput.value = '';
      handleInputStateChange();
      openSkillCreatorModal(currentVal);
      return;
    }

    if (cmd.isCustomSkill && cmd.skill) {
      hideSlashMenu();
      if (cmd.skill.mode === 'cowork' && !isCoworkActive) {
        toggleCoworkMode(true);
      } else if (cmd.skill.mode === 'chat' && isCoworkActive) {
        toggleCoworkMode(false);
      }
      promptInput.value = cmd.skill.prompt || '';
      promptInput.focus();
      promptInput.setSelectionRange(promptInput.value.length, promptInput.value.length);
      handleInputStateChange();
      showToast(`Skill "/${cmd.skill.name}" cargada`);
      return;
    }

    const currentVal = promptInput.value;
    const rest = currentVal.replace(/^\/\S*\s*/, '').trim();

    // Autocomplete command at the beginning of the prompt
    promptInput.value = `${cmd.prefix}${rest ? rest + ' ' : ''}`;
    hideSlashMenu();
    promptInput.focus();
    promptInput.setSelectionRange(promptInput.value.length, promptInput.value.length);
    handleInputStateChange();
  }

  function handleSlashInput() {
    const val = promptInput.value;
    if (val.startsWith('/')) {
      const slashWord = val.split(/\s+/)[0];
      showSlashMenu(slashWord);
    } else {
      hideSlashMenu();
    }
  }

  function updateActiveSlashItem() {
    if (!slashCommandsList) return;
    const items = slashCommandsList.querySelectorAll('.slash-command-item');
    items.forEach((el, i) => {
      const isActive = i === activeSlashIndex;
      el.classList.toggle('active', isActive);
      el.setAttribute('aria-selected', isActive ? 'true' : 'false');
      if (isActive) {
        el.scrollIntoView({ block: 'nearest' });
      }
    });
  }

  function handleSlashKeydown(e) {
    if (!slashCommandsMenu || slashCommandsMenu.classList.contains('hidden')) {
      return false;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (filteredSlashCommands.length > 0) {
        activeSlashIndex = (activeSlashIndex + 1) % filteredSlashCommands.length;
        updateActiveSlashItem();
      }
      return true;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (filteredSlashCommands.length > 0) {
        activeSlashIndex = (activeSlashIndex - 1 + filteredSlashCommands.length) % filteredSlashCommands.length;
        updateActiveSlashItem();
      }
      return true;
    }

    if (e.key === 'Enter' || e.key === 'Tab') {
      if (filteredSlashCommands.length > 0 && filteredSlashCommands[activeSlashIndex]) {
        const cmd = filteredSlashCommands[activeSlashIndex];
        if (cmd.enabled) {
          e.preventDefault();
          selectSlashCommand(cmd);
          return true;
        }
      }
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      hideSlashMenu();
      return true;
    }

    return false;
  }

  document.addEventListener('click', (e) => {
    if (slashCommandsMenu && !slashCommandsMenu.contains(e.target) && e.target !== promptInput) {
      hideSlashMenu();
    }
  });

  if (promptInput) {
    promptInput.addEventListener('focus', () => {
      if (promptInput.value.startsWith('/')) {
        handleSlashInput();
      }
    });
  }

  // ─── BTW (By The Way) External Assistant Popup ──────────────────────────────
  const btwSidecarPopup = document.getElementById('btwSidecarPopup');
  const closeBtwBtn = document.getElementById('closeBtwBtn');
  const btwInput = document.getElementById('btwInput');
  const btwSendBtn = document.getElementById('btwSendBtn');
  const btwMessagesContainer = document.getElementById('btwMessagesContainer');

  function openBtwPopup(initialQuery = '') {
    if (!btwSidecarPopup) return;
    btwSidecarPopup.classList.remove('hidden');
    if (initialQuery && btwInput) {
      btwInput.value = initialQuery;
      handleBtwSend();
    } else if (btwInput) {
      btwInput.focus();
    }
  }

  function closeBtwPopup() {
    if (btwSidecarPopup) btwSidecarPopup.classList.add('hidden');
  }

  if (closeBtwBtn) closeBtwBtn.addEventListener('click', closeBtwPopup);

  async function handleBtwSend() {
    if (!btwInput) return;
    const q = btwInput.value.trim();
    if (!q) return;

    const userBubble = document.createElement('div');
    userBubble.className = 'btw-msg-bubble btw-msg-user';
    userBubble.textContent = q;
    btwMessagesContainer.appendChild(userBubble);
    btwInput.value = '';
    btwMessagesContainer.scrollTop = btwMessagesContainer.scrollHeight;

    const botBubble = document.createElement('div');
    botBubble.className = 'btw-msg-bubble btw-msg-bot';
    botBubble.innerHTML = '<em>Consultando agente externo...</em>';
    btwMessagesContainer.appendChild(botBubble);
    btwMessagesContainer.scrollTop = btwMessagesContainer.scrollHeight;

    try {
      const provider = activeModelTab || 'antigravity';
      chrome.runtime.sendMessage({
        type: 'quick_inference',
        messages: [
          {
            role: 'system',
            content: 'You are an external sidecar AI assistant ("By The Way"). The user is asking a quick question while working on an isolated task. Answer accurately, concisely, and helpfully in English.',
          },
          { role: 'user', content: q },
        ],
        model: currentModel || 'gemini-3.8-flash-medium',
        explicitProvider: provider,
        temperature: 0.7,
      }, (res) => {
        if (chrome.runtime.lastError) {
          botBubble.textContent = `Error: ${chrome.runtime.lastError.message}`;
          return;
        }
        if (res && res.success) {
          const reply = res.text || 'Response completed.';
          botBubble.innerHTML = escapeHtml(reply).replace(/\n/g, '<br>');
        } else {
          botBubble.textContent = res?.error || 'Could not connect to AI provider.';
        }
        btwMessagesContainer.scrollTop = btwMessagesContainer.scrollHeight;
      });
    } catch (err) {
      botBubble.textContent = `External assistant error: ${err.message || 'Unable to connect to bridge.'}`;
    }
    btwMessagesContainer.scrollTop = btwMessagesContainer.scrollHeight;
  }

  if (btwSendBtn && btwInput) {
    btwSendBtn.addEventListener('click', handleBtwSend);
    btwInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleBtwSend();
      }
    });
  }

  // ─── Model pricing (USD per 1M tokens: input / output) ──────────────────────
  // List prices from the providers' own pricing pages, checked on 2026-10-07:
  //   Anthropic  https://platform.claude.com/docs/en/about-claude/pricing
  //   Google     https://ai.google.dev/gemini-api/docs/pricing
  //   OpenAI     https://developers.openai.com/api/docs/pricing
  // They are only used for ESTIMATES (never a real bill) and the user can edit every price in Settings.
  // Rules are matched in order against the model id with "." turned into "-".
  const PRICING_CHECKED_ON = '2026-10-07';
  const MODEL_PRICING = [
    { key: 'claude-fable', label: 'Claude Fable / Mythos', re: /(fable|mythos)/, in: 10, out: 50 },
    { key: 'claude-opus-5-5', label: 'Claude Opus 5.5', re: /opus-5-5/, in: 4, out: 20 },
    { key: 'claude-opus', label: 'Claude Opus (other)', re: /opus/, in: 5, out: 25 },
    { key: 'claude-sonnet-5', label: 'Claude Sonnet 5 / 5.5', re: /sonnet-5/, in: 2, out: 10 },
    { key: 'claude-sonnet', label: 'Claude Sonnet (older)', re: /sonnet/, in: 3, out: 15 },
    { key: 'claude-haiku-5', label: 'Claude Haiku 5.5 (prompts up to 100k)', re: /haiku-5/, in: 0.1, out: 0.5 },
    { key: 'claude-haiku', label: 'Claude Haiku 4.5', re: /haiku/, in: 1, out: 5 },
    { key: 'claude-other', label: 'Claude (other)', re: /claude/, in: 3, out: 15 },
    { key: 'gpt-6-astra', label: 'GPT-6 Astra', re: /gpt-6-astra/, in: 10, out: 50 },
    { key: 'gpt-6-sol', label: 'GPT-6 Sol', re: /gpt-6(-1)?-sol/, in: 2, out: 10 },
    { key: 'gpt-6-luna', label: 'GPT-6 Luna', re: /gpt-6-luna/, in: 0.1, out: 0.5 },
    { key: 'gpt-5-6-sol', label: 'GPT-5.6 Sol (promo until 2026-11-21)', re: /gpt-5-6-sol/, in: 4, out: 20 },
    { key: 'gpt-5-6-terra', label: 'GPT-5.6 Terra', re: /gpt-5-6-terra/, in: 2, out: 12 },
    { key: 'gpt-5-6-luna', label: 'GPT-5.6 Luna', re: /gpt-5-6-luna/, in: 0.2, out: 1.2 },
    { key: 'gpt-5-5', label: 'GPT-5.5', re: /gpt-5-5/, in: 5, out: 30 },
    { key: 'gpt-5-4', label: 'GPT-5.4', re: /gpt-5-4/, in: 2.5, out: 15 },
    { key: 'codex', label: 'Codex', re: /codex/, in: 1.75, out: 14 },
    { key: 'gpt-oss', label: 'GPT-OSS (no official price found)', re: /gpt-oss/, in: 0.15, out: 0.6 },
    { key: 'o3-mini', label: 'o3-mini', re: /o3-mini/, in: 1.1, out: 4.4 },
    { key: 'o3', label: 'o3', re: /(^|-)o3/, in: 2, out: 8 },
    { key: 'gpt-5', label: 'GPT-5', re: /gpt-5/, in: 1.25, out: 10 },
    { key: 'gemini-pro', label: 'Gemini 3.1 Pro (up to 200k)', re: /gemini.*pro/, in: 2, out: 12 },
    { key: 'gemini-flash-lite', label: 'Gemini Flash-Lite', re: /flash-lite/, in: 0.25, out: 1.5 },
    { key: 'gemini-flash', label: 'Gemini 3.6 / 3.7 / 3.8 Flash (promo until 2026-12-31)', re: /gemini/, in: 0.75, out: 3.75 },
  ];
  const PRICE_OVERRIDES_KEY = 'autono_price_overrides';

  // ─── Updates and Bridge hard reset ────────────────────────────────────────────────────────────────
  const UPDATE_PATH_KEY = 'autono_extension_path';
  const UPDATE_DISMISS_KEY = 'autono_update_dismissed';
  let updateState = null;
  let updateBusy = false;

  const shortSha = (sha) => (sha ? String(sha).slice(0, 7) : '?');

  function setUpdateProgress(pct, text) {
    const wrap = document.getElementById('updateProgress');
    const bar = document.getElementById('updateProgressBar');
    if (wrap) wrap.classList.toggle('hidden', pct === null);
    if (bar && pct !== null) {
      bar.classList.toggle('indeterminate', pct < 0);
      bar.style.width = `${pct < 0 ? 100 : Math.max(3, pct)}%`;
    }
    const line = document.getElementById('updateStatusLines');
    if (line && text) { line.textContent = text; line.className = 'piper-status'; }
    const banner = document.getElementById('updateBannerText');
    if (banner && text && updateBusy) banner.textContent = text;
  }

  function renderUpdateStatus() {
    const line = document.getElementById('updateStatusLines');
    const applyBtn = document.getElementById('updateApplyBtn');
    const banner = document.getElementById('updateBanner');
    if (!line || !updateState) return;
    const { bridge, extension } = updateState;
    const version = chrome.runtime.getManifest().version;
    const parts = [
      `Autono ${version}: ${extension?.error ? extension.error : extension?.update_available ? 'a new version is available' : 'up to date'}`,
      `Bridge: ${bridge?.error ? bridge.error : bridge?.update_available ? 'a new version is available' : 'up to date'}`,
    ];
    const pending = Boolean(extension?.update_available || bridge?.update_available);
    line.textContent = parts.join('\n');
    line.style.whiteSpace = 'pre-line';
    line.className = 'piper-status' + (pending ? '' : ' ok');
    applyBtn?.classList.toggle('hidden', !pending);
    const key = `${extension?.latest || ''}|${bridge?.latest || ''}`;
    let dismissed = '';
    try { dismissed = sessionStorage.getItem(UPDATE_DISMISS_KEY) || ''; } catch (_) { /* ignore */ }
    const text = document.getElementById('updateBannerText');
    if (text && !updateBusy) {
      text.textContent = extension?.update_available && bridge?.update_available ? 'New update available for Autono and the Bridge'
        : extension?.update_available ? 'New update available for Autono' : 'New update available for the Bridge';
    }
    banner?.classList.toggle('hidden', !(pending && dismissed !== key) && !updateBusy);
  }

  async function checkForUpdates({ force = false, silent = false } = {}) {
    const line = document.getElementById('updateStatusLines');
    if (updateBusy) return;
    if (!silent && line) { line.textContent = 'Checking…'; line.className = 'piper-status'; }
    try {
      const folder = (localStorage.getItem(UPDATE_PATH_KEY) || '').trim();
      const url = `/v1/update/status?ext_id=${encodeURIComponent(chrome.runtime.id)}&force=${force ? 'true' : 'false'}&ext_path=${encodeURIComponent(folder)}`;
      updateState = await (await piperApi(url)).json();
      renderUpdateStatus();
    } catch (err) {
      updateState = null;
      if (line) {
        line.style.whiteSpace = '';
        line.textContent = err.status === 404
          ? 'Your Bridge is too old to update itself. Run Reiniciar-Servicio-Fondo.bat once (or Actualizar-AntigravityBridge.bat), then check again.'
          : 'The Bridge is not running, so updates cannot be checked.';
        line.className = 'piper-status bad';
      }
      document.getElementById('updateApplyBtn')?.classList.add('hidden');
    }
  }

  async function waitForBridge(minUptimeOk = true, timeoutMs = 90000) {
    const started = Date.now();
    await new Promise((r) => setTimeout(r, 2500));
    while (Date.now() - started < timeoutMs) {
      try {
        const res = await fetch(`${bridgeBase()}/health`, { signal: AbortSignal.timeout(2500) });
        if (res.ok) {
          const health = await res.json();
          if (!minUptimeOk || (health.uptime_seconds ?? 999) < 60) return health;
        }
      } catch (_) { /* still restarting */ }
      await new Promise((r) => setTimeout(r, 1000));
    }
    return null;
  }

  async function restartBridgeHard() {
    const btn = document.getElementById('bridgeRestartBtn');
    if (updateBusy) return;
    updateBusy = true;
    if (btn) btn.disabled = true;
    try {
      setUpdateProgress(-1, 'Closing the Bridge and opening it again…');
      try {
        await piperApi('/v1/bridge/restart', { method: 'POST' });
      } catch (err) {
        if (err.status === 404) throw new Error('This Bridge is too old to restart itself. Run Reiniciar-Servicio-Fondo.bat once.');
        // a refused connection means it is not running at all: nothing to close
        if (err.status) throw err;
        throw new Error('The Bridge is not running. Open Iniciar-Servicio-Fondo.bat (or Reiniciar-Servicio-Fondo.bat) to start it.');
      }
      const health = await waitForBridge(true);
      if (!health) throw new Error('The Bridge did not come back. Run Reiniciar-Servicio-Fondo.bat.');
      setUpdateProgress(null, 'The Bridge was restarted and is ready.');
      showToast('Bridge restarted');
      sendPortMessage({ type: 'ping_bridge' });
      piperRefresh();
    } catch (err) {
      setUpdateProgress(null, err.message);
      document.getElementById('updateStatusLines')?.classList.add('bad');
    } finally {
      updateBusy = false;
      if (btn) btn.disabled = false;
      renderUpdateStatus();
    }
  }

  async function applyUpdates() {
    if (updateBusy || !updateState) return;
    const doExt = Boolean(updateState.extension?.update_available);
    const doBridge = Boolean(updateState.bridge?.update_available);
    updateBusy = true;
    document.getElementById('updateBanner')?.classList.remove('hidden');
    const folder = (localStorage.getItem(UPDATE_PATH_KEY) || '').trim();
    try {
      if (doBridge) {
        setUpdateProgress(-1, 'Updating the Bridge…');
        await piperApi('/v1/update/bridge', { method: 'POST' });
        setUpdateProgress(-1, 'Restarting the Bridge with the new code…');
        const health = await waitForBridge(true);
        if (!health) throw new Error('The Bridge did not come back after updating. Run Reiniciar-Servicio-Fondo.bat.');
      }
      if (doExt) {
        setUpdateProgress(-1, 'Updating Autono…');
        await piperApi('/v1/update/extension', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ext_id: chrome.runtime.id, ext_path: folder }),
        });
        setUpdateProgress(100, 'Updated. Reloading Autono…');
        try { await chrome.storage.local.set({ autono_just_updated: Date.now() }); } catch (_) { /* ignore */ }
        setTimeout(() => chrome.runtime.reload(), 900);
        return;
      }
      setUpdateProgress(100, 'The Bridge was updated and restarted.');
      showToast('Bridge updated');
      updateBusy = false;
      await checkForUpdates({ force: true });
    } catch (err) {
      updateBusy = false;
      setUpdateProgress(null, `The update failed: ${err.message}`);
      document.getElementById('updateStatusLines')?.classList.add('bad');
      document.getElementById('updateBanner')?.classList.add('hidden');
    }
  }

  document.getElementById('updateCheckBtn')?.addEventListener('click', () => checkForUpdates({ force: true }));
  document.getElementById('updateApplyBtn')?.addEventListener('click', applyUpdates);
  document.getElementById('updateBannerBtn')?.addEventListener('click', applyUpdates);
  document.getElementById('bridgeRestartBtn')?.addEventListener('click', restartBridgeHard);
  document.getElementById('updateBannerClose')?.addEventListener('click', () => {
    document.getElementById('updateBanner')?.classList.add('hidden');
    try {
      sessionStorage.setItem(UPDATE_DISMISS_KEY, `${updateState?.extension?.latest || ''}|${updateState?.bridge?.latest || ''}`);
    } catch (_) { /* ignore */ }
  });
  const updatePathInput = document.getElementById('updatePathInput');
  if (updatePathInput) {
    updatePathInput.value = localStorage.getItem(UPDATE_PATH_KEY) || '';
    updatePathInput.addEventListener('change', () => {
      try { localStorage.setItem(UPDATE_PATH_KEY, updatePathInput.value.trim()); } catch (_) { /* ignore */ }
    });
  }
  // Every time the panel opens: look for something new (quietly), and welcome the user back after an update
  chrome.storage.local.get(['autono_just_updated'], (res) => {
    if (res?.autono_just_updated && Date.now() - res.autono_just_updated < 5 * 60 * 1000) {
      showToast(`Autono was updated to the latest version (${chrome.runtime.getManifest().version})`);
    }
    chrome.storage.local.remove('autono_just_updated');
  });
  setTimeout(() => checkForUpdates({ force: true, silent: true }), 2500);

  function loadPriceOverrides() {
    try {
      const parsed = JSON.parse(localStorage.getItem(PRICE_OVERRIDES_KEY) || '{}');
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (_) {
      return {};
    }
  }

  function savePriceOverrides(overrides) {
    try { localStorage.setItem(PRICE_OVERRIDES_KEY, JSON.stringify(overrides)); } catch (_) {}
  }

  function normalizePriceId(modelId) {
    return String(modelId || '').toLowerCase().replace(/\./g, '-');
  }

  function getModelPricing(modelId) {
    const id = normalizePriceId(modelId);
    const rule = MODEL_PRICING.find((r) => r.re.test(id));
    const edited = loadPriceOverrides()[rule ? rule.key : id];
    if (edited && Number.isFinite(edited.in) && Number.isFinite(edited.out)) {
      return { in: edited.in, out: edited.out, known: Boolean(rule), edited: true };
    }
    if (!rule) return { in: 1, out: 5, known: false };
    return { in: rule.in, out: rule.out, known: true };
  }

  // The rows follow the models the Bridge really offers (the same list as the model picker), so there is never
  // a price for a model you cannot use, and a model without a known price still gets an editable row.
  function pricedModelGroups() {
    const groups = new Map();
    const seen = new Set();
    for (const p of Object.values(PROVIDER_DATA)) {
      for (const m of (p.models || [])) {
        if (!m || !m.id || seen.has(m.id)) continue;
        seen.add(m.id);
        const id = normalizePriceId(m.id);
        const rule = MODEL_PRICING.find((r) => r.re.test(id));
        const key = rule ? rule.key : id;
        if (!groups.has(key)) groups.set(key, { key, rule, names: [] });
        const group = groups.get(key);
        const name = String(m.name || m.id).replace(/\s*\((low|medium|high|x-high|max|none|minimal)\)\s*$/i, '');
        if (!group.names.includes(name)) group.names.push(name);
      }
    }
    return [...groups.values()];
  }

  function renderPricingSettings() {
    const box = document.getElementById('pricingTable');
    if (!box) return;
    const overrides = loadPriceOverrides();
    const groups = pricedModelGroups();
    if (!groups.length) {
      box.innerHTML = '<div class="field-hint">No models are loaded yet. Open the Bridge and reopen Settings.</div>';
      return;
    }
    box.innerHTML = groups.map((g) => {
      const o = overrides[g.key];
      const base = g.rule || { in: 1, out: 5 };
      const inV = o ? o.in : base.in;
      const outV = o ? o.out : base.out;
      const title = g.rule ? g.rule.label : `${g.names[0]} (no official price found)`;
      const used = g.names.slice(0, 6).join(', ') + (g.names.length > 6 ? ` +${g.names.length - 6}` : '');
      return `<div class="price-row${o ? ' edited' : ''}" data-key="${escapeHtml(g.key)}" data-in="${base.in}" data-out="${base.out}">
        <span class="price-name">${escapeHtml(title)}<small class="price-used">${escapeHtml(used)}</small></span>
        <input type="number" class="price-in" min="0" step="0.01" value="${inV}" aria-label="Input price per million tokens">
        <input type="number" class="price-out" min="0" step="0.01" value="${outV}" aria-label="Output price per million tokens">
      </div>`;
    }).join('');
    box.querySelectorAll('.price-row').forEach((row) => {
      const save = () => {
        const pin = parseFloat(row.querySelector('.price-in').value);
        const pout = parseFloat(row.querySelector('.price-out').value);
        if (!Number.isFinite(pin) || !Number.isFinite(pout) || pin < 0 || pout < 0) return;
        const next = loadPriceOverrides();
        if (pin === Number(row.dataset.in) && pout === Number(row.dataset.out)) delete next[row.dataset.key];
        else next[row.dataset.key] = { in: pin, out: pout };
        savePriceOverrides(next);
        row.classList.toggle('edited', Boolean(next[row.dataset.key]));
        updateContextMeter();
      };
      row.querySelectorAll('input').forEach((inp) => inp.addEventListener('change', save));
    });
    const stamp = document.getElementById('pricingCheckedOn');
    if (stamp) stamp.textContent = PRICING_CHECKED_ON;
  }

  const resetPricesBtn = document.getElementById('resetPricesBtn');
  if (resetPricesBtn) {
    resetPricesBtn.addEventListener('click', () => {
      savePriceOverrides({});
      renderPricingSettings();
      updateContextMeter();
      showToast('Prices reset to the list prices');
    });
  }
  renderPricingSettings();

  function formatUsd(value) {
    if (!value || value <= 0) return '$0';
    if (value < 0.001) return '<$0.001';
    if (value < 0.1) return '$' + value.toFixed(3);
    if (value < 100) return '$' + value.toFixed(2);
    return '$' + Math.round(value);
  }

  function formatRate(n) {
    return '$' + (n >= 1 ? String(Math.round(n * 100) / 100) : String(n));
  }

  function estimateTextTokens(text) {
    return Math.ceil(String(text || '').length / 4);
  }

  // True when the current model runs through the local terminal (no per-token billing)
  function currentEngineIsLocal() {
    const id = currentModel || '';
    const obj = (findModelByAnyId(id)?.model || null);
    if (obj && obj.dynamicSource === 'gemini') return false;
    if (isClaudeModel(id)) return activeModelTab === 'antigravity' || currentClaudeMode !== 'api';
    if (isOpenAIModel(id)) return activeModelTab === 'antigravity' || currentOpenaiMode !== 'api';
    return currentAntigravityMode !== 'api';
  }

  // ─── AI Context Meter Helpers & Updates ─────────────────────────────────────
  function formatTokens(tokens) {
    if (tokens >= 1000000) {
      return `${(tokens / 1000000).toFixed(1)}M`;
    }
    if (tokens >= 10000) {
      return `${Math.round(tokens / 1000)}k`;
    }
    if (tokens >= 1000) {
      return `${(tokens / 1000).toFixed(1)}k`;
    }
    return String(tokens);
  }

  function updateContextMeter() {
    if (!contextMeterLabel || !contextRingCircle) return;
    const sysTokens = 1800;

    let pageTokens = 0;
    if (window.__lastScreenContextLength) {
      pageTokens = Math.round(window.__lastScreenContextLength / 4);
    } else {
      pageTokens = 2400; // estimated DOM context
    }

    let fileTokens = 0;
    attachedItems.forEach((item) => {
      const len = (item.content ? item.content.length : 0) + (item.dataUrl ? item.dataUrl.length / 4 : 0);
      fileTokens += Math.round(len / 4);
    });

    // Conversation tokens + estimated spend so far (each answer re-reads the whole history as input)
    const pricing = getModelPricing(currentModel);
    const inRate = pricing.in / 1e6;
    const outRate = pricing.out / 1e6;
    let convTokens = 0;
    let sessionCost = 0;
    const activeSession = allSessions.find((s) => s.id === currentSessionId);
    if (activeSession && Array.isArray(activeSession.messages)) {
      activeSession.messages.forEach((m) => {
        const text = (m.content || '') + (m.intro || '') + (m.summary || '');
        const t = estimateTextTokens(text);
        if (m.role === 'assistant') {
          sessionCost += (sysTokens + convTokens) * inRate + t * outRate;
        }
        if (m.agentUsage) {
          sessionCost += (m.agentUsage.inputTokens || 0) * inRate + (m.agentUsage.outputTokens || 0) * outRate;
        }
        convTokens += t;
      });
    }

    const used = sysTokens + pageTokens + fileTokens + convTokens;
    const isPro = currentModel.toLowerCase().includes('pro');
    const limit = isPro ? 2000000 : 1000000;
    const fraction = Math.min(1, Math.max(0.002, used / limit));

    contextRingCircle.setAttribute('stroke-dasharray', `${fraction.toFixed(4)} ${(1 - fraction).toFixed(4)}`);

    let strokeColor = '#38bdf8'; // Blue/Cyan
    if (fraction >= 0.95) {
      strokeColor = '#ef4444'; // Red (danger)
    } else if (fraction >= 0.8) {
      strokeColor = '#f59e0b'; // Amber (warning)
    }
    contextRingCircle.setAttribute('stroke', strokeColor);

    contextMeterLabel.textContent = `${formatTokens(used)}/${formatTokens(limit)}`;

    const setText = (id, value) => {
      const el = document.getElementById(id);
      if (el) el.textContent = value;
    };
    setText('meterPercentBadge', `${(fraction * 100).toFixed(1)}%`);
    setText('meterTotalUsed', `${formatTokens(used)} / ${formatTokens(limit)}`);

    setText('meterSysTokens', formatTokens(sysTokens));
    setText('meterPageTokens', formatTokens(pageTokens));
    setText('meterFileTokens', formatTokens(fileTokens));
    setText('meterConvTokens', formatTokens(convTokens));
    setText('meterSysCost', formatUsd(sysTokens * inRate));
    setText('meterPageCost', formatUsd(pageTokens * inRate));
    setText('meterFileCost', formatUsd(fileTokens * inRate));
    setText('meterConvCost', formatUsd(convTokens * inRate));

    const modelObj = (findModelByAnyId(currentBaseModelId)?.model || null);
    setText('meterModelName', modelObj?.name || currentBaseModelId || 'Model');
    setText('meterPriceLabel', `${formatRate(pricing.in)} in · ${formatRate(pricing.out)} out / 1M`);
    setText('meterNextCost', '~' + formatUsd(used * inRate));
    setText('meterSessionCost', '~' + formatUsd(sessionCost));
    setText('meterCostNote', currentEngineIsLocal()
      ? 'Estimate only, not a real bill. Local Terminal runs on your own subscription, so nothing is billed per token; figures are the API-equivalent.'
      : 'Estimate only, not a real bill. Based on list prices you can review in Settings; real usage, caching and discounts change the total.');
  }

  // Popover trigger listeners (Hover & Click)
  if (contextMeterBtn && contextMeterPopover) {
    let hoverTimeout = null;

    contextMeterBtn.addEventListener('mouseenter', () => {
      clearTimeout(hoverTimeout);
      contextMeterPopover.classList.remove('hidden');
    });

    contextMeterBtn.addEventListener('mouseleave', () => {
      hoverTimeout = setTimeout(() => {
        if (!contextMeterPopover.matches(':hover')) {
          contextMeterPopover.classList.add('hidden');
        }
      }, 180);
    });

    contextMeterPopover.addEventListener('mouseenter', () => {
      clearTimeout(hoverTimeout);
    });

    contextMeterPopover.addEventListener('mouseleave', () => {
      contextMeterPopover.classList.add('hidden');
    });

    contextMeterBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      contextMeterPopover.classList.toggle('hidden');
    });

    document.addEventListener('click', (e) => {
      if (!contextMeterPopover.contains(e.target) && !contextMeterBtn.contains(e.target)) {
        contextMeterPopover.classList.add('hidden');
      }
    });
  }

  // ─── Direct Automation / Cowork Triggers & Helpers ──────────────────────────
  function sendUserMessage(text) {
    if (!text || isGenerating) return;
    promptInput.value = text;
    handleInputStateChange();
    handleSend();
  }

  function triggerCoworkExecution(goalText) {
    isCoworkActive = true;
    toggleCoworkBtn.classList.add('active');
    promptInput.placeholder = 'Assign a goal for the agent to execute in the browser...';
    showToast('Cowork mode active. Starting execution...');
    sendPortMessage({ type: 'ensure_usable_tab' });
    sendUserMessage(goalText);
  }

  // ─── ApprovalCard (Human-in-the-Loop) Mount & Interactivity ─────────────────
  function mountAllApprovalCards(container = document) {
    if (!container) return;
    const mounts = container.querySelectorAll('.approval-card-mount:not([data-mounted="true"])');
    mounts.forEach((el) => {
      const cardId = el.getAttribute('data-approval-id');
      const cardData = activeApprovalCards.get(cardId);
      if (!cardData) return;
      el.setAttribute('data-mounted', 'true');
      mountApprovalCard(el, cardData);
    });
  }

  function mountApprovalCard(containerEl, cardData) {
    const questions = Array.isArray(cardData.questions) && cardData.questions.length > 0
      ? cardData.questions
      : [{
          q: cardData.action === 'cowork_request' 
            ? 'Do you want to enable Cowork mode to perform this task in the browser?'
            : 'Do you want to proceed with this action?',
          type: 'radio',
          options: ['Yes, start Cowork execution', 'No, answer in chat only']
        }];

    let qi = 0;
    const answers = {};
    const custom = {};
    let sent = false;
    let open = true;

    function render() {
      if (!open) {
        containerEl.innerHTML = `
          <button type="button" class="approval-open-btn">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
            <span>Open options</span>
          </button>
        `;
        const openBtn = containerEl.querySelector('.approval-open-btn');
        openBtn?.addEventListener('click', () => {
          open = true;
          render();
        });
        return;
      }

      if (sent) {
        containerEl.innerHTML = `
          <div class="approval-card-box">
            <div class="approval-card-sent">
              <span class="approval-sent-icon">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
              </span>
              <span class="approval-sent-text">Answers submitted</span>
              <button type="button" class="approval-reset-btn">Reset options</button>
            </div>
          </div>
        `;
        const resetBtn = containerEl.querySelector('.approval-reset-btn');
        resetBtn?.addEventListener('click', () => {
          qi = 0;
          Object.keys(answers).forEach((k) => delete answers[k]);
          Object.keys(custom).forEach((k) => delete custom[k]);
          sent = false;
          open = true;
          render();
        });
        return;
      }

      const q = questions[qi] || questions[0];
      const isLast = qi === questions.length - 1;
      const selected = answers[qi] || [];
      const hasAnswer = selected.length > 0 || Boolean(custom[qi]?.trim());

      const optionsHtml = q.options.map((opt, i) => {
        const isSelected = selected.includes(i);
        return `
          <button type="button" class="approval-option-row ${isSelected ? 'selected' : ''}" data-opt-idx="${i}">
            <span class="approval-option-indicator ${q.type}">
              ${q.type === 'radio' ? '<span class="approval-radio-dot"></span>' : '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>'}
            </span>
            <span class="approval-option-text">${escapeHtml(opt)}</span>
          </button>
        `;
      }).join('');

      const dotsHtml = questions.map((_, idx) => `
        <button type="button" class="approval-dot ${idx === qi ? 'active' : (idx < qi ? 'done' : '')}" data-dot-idx="${idx}" title="Question ${idx + 1}"></button>
      `).join('');

      containerEl.innerHTML = `
        <div class="approval-card-box">
          <div class="approval-card-body">
            <div class="approval-header">
              <span class="approval-q-title">${escapeHtml(q.q)}</span>
              <button type="button" class="approval-dismiss-btn" title="Dismiss">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>
            <div class="approval-options-list">
              ${optionsHtml}
              <label class="approval-custom-row">
                <span class="approval-custom-spacer"></span>
                <input type="text" class="approval-custom-input" placeholder="Type your answer..." value="${escapeHtml(custom[qi] || '')}">
              </label>
            </div>
          </div>
          <div class="approval-footer">
            <div class="approval-pager">
              <button type="button" class="approval-nav-btn prev" ${qi === 0 ? 'disabled' : ''} title="Previous">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
              </button>
              <div class="approval-dots">${dotsHtml}</div>
              <button type="button" class="approval-nav-btn next" ${isLast ? 'disabled' : ''} title="Next">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>
              </button>
            </div>
            <button type="button" class="approval-submit-btn ${hasAnswer ? 'ready' : ''}" ${!hasAnswer ? 'disabled' : ''} title="${isLast ? 'Submit answers' : 'Next question'}">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>
            </button>
          </div>
        </div>
      `;

      // Event listeners
      const dismissBtn = containerEl.querySelector('.approval-dismiss-btn');
      dismissBtn?.addEventListener('click', () => {
        open = false;
        render();
      });

      const optBtns = containerEl.querySelectorAll('.approval-option-row');
      optBtns.forEach((btn) => {
        btn.addEventListener('click', () => {
          const idx = parseInt(btn.getAttribute('data-opt-idx'), 10);
          const picked = answers[qi] || [];
          if (q.type === 'radio') {
            answers[qi] = [idx];
            custom[qi] = '';
            render();
            // Single-choice auto advances after 480ms
            setTimeout(() => {
              if (qi === questions.length - 1) {
                handleFinish();
              } else {
                qi = Math.min(questions.length - 1, qi + 1);
                render();
              }
            }, 480);
          } else {
            answers[qi] = picked.includes(idx) ? picked.filter(i => i !== idx) : [...picked, idx];
            render();
          }
        });
      });

      const customInput = containerEl.querySelector('.approval-custom-input');
      customInput?.addEventListener('input', (e) => {
        custom[qi] = e.target.value;
        if (q.type === 'radio') {
          answers[qi] = [];
        }
        const ready = Boolean(custom[qi]?.trim()) || ((answers[qi] || []).length > 0);
        const submitBtn = containerEl.querySelector('.approval-submit-btn');
        if (submitBtn) {
          submitBtn.classList.toggle('ready', ready);
          submitBtn.disabled = !ready;
        }
      });

      const prevBtn = containerEl.querySelector('.approval-nav-btn.prev');
      prevBtn?.addEventListener('click', () => {
        qi = Math.max(0, qi - 1);
        render();
      });

      const nextBtn = containerEl.querySelector('.approval-nav-btn.next');
      nextBtn?.addEventListener('click', () => {
        qi = Math.min(questions.length - 1, qi + 1);
        render();
      });

      const dotBtns = containerEl.querySelectorAll('.approval-dot');
      dotBtns.forEach((dot) => {
        dot.addEventListener('click', () => {
          qi = parseInt(dot.getAttribute('data-dot-idx'), 10);
          render();
        });
      });

      const submitBtn = containerEl.querySelector('.approval-submit-btn');
      submitBtn?.addEventListener('click', () => {
        if (isLast) {
          handleFinish();
        } else {
          qi = qi + 1;
          render();
        }
      });
    }

    function handleFinish() {
      sent = true;
      render();

      if (cardData.action === 'cowork_request') {
        const picked = answers[0] || [];
        const customText = (custom[0] || '').toLowerCase();
        const isAffirmative = picked.includes(0) || customText.includes('yes') || customText.includes('sí') || customText.includes('si') || customText.includes('start') || customText.includes('enable');

        if (isAffirmative) {
          const goal = cardData.goal || 'Execute browser automation actions';
          triggerCoworkExecution(goal);
        } else {
          showToast('Continuing in standard conversation mode');
        }
      } else {
        const formatted = [];
        questions.forEach((qu, i) => {
          const selectedIndices = answers[i] || [];
          const customVal = (custom[i] || '').trim();
          const chosenOpts = selectedIndices.map(si => qu.options[si]).filter(Boolean);
          if (customVal) chosenOpts.push(customVal);
          formatted.push(`- **${qu.q}**: ${chosenOpts.join(', ') || 'No answer'}`);
        });
        const responseText = `I have selected the following options:\n${formatted.join('\n')}`;
        setTimeout(() => {
          sendUserMessage(responseText);
        }, 500);
      }
    }

    render();
  }

  // ─── File Artifacts Engine & Code Execution ─────────────────────────────────
  function getFileIcon(type, ext) {
    const t = (type || '').toLowerCase();
    const e = (ext || '').toLowerCase();
    if (t === 'svg' || e === 'svg') return '🎨';
    if (t === 'html' || e === 'html' || e === 'htm') return '🌐';
    if (t === 'pdf' || e === 'pdf') return '📄';
    if (t === 'docx' || e === 'docx' || e === 'doc') return '📝';
    if (t === 'markdown' || e === 'md') return '📑';
    if (['py', 'python'].includes(t) || e === 'py') return '🐍';
    if (['js', 'javascript', 'ts', 'typescript'].includes(t) || ['js', 'ts'].includes(e)) return '⚡';
    if (t === 'json' || e === 'json') return '📦';
    return '💻';
  }

  function getFileMimeType(type, ext) {
    const t = (type || '').toLowerCase();
    const e = (ext || '').toLowerCase();
    if (t === 'svg' || e === 'svg') return 'image/svg+xml;charset=utf-8';
    if (t === 'html' || e === 'html') return 'text/html;charset=utf-8';
    if (t === 'pdf' || e === 'pdf') return 'application/pdf';
    if (t === 'docx' || e === 'docx' || e === 'doc') return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    if (t === 'markdown' || e === 'md') return 'text/markdown;charset=utf-8';
    if (t === 'json' || e === 'json') return 'application/json;charset=utf-8';
    return 'text/plain;charset=utf-8';
  }

  function extractFileArtifacts(text) {
    if (!text || typeof text !== 'string') return [];
    const artifacts = [];
    const codeBlockRegex = /```([a-zA-Z0-9_\-\.]+)?(?::([a-zA-Z0-9_\-\.]+))?\n([\s\S]*?)```/g;
    let match;
    let fallbackIdx = 1;

    while ((match = codeBlockRegex.exec(text)) !== null) {
      let rawLang = (match[1] || '').trim().toLowerCase();
      let rawFilename = (match[2] || '').trim();
      const content = match[3] || '';

      if (!content.trim()) continue;

      // Detect SVG
      if (rawLang === 'svg' || content.trim().startsWith('<svg') || content.includes('xmlns="http://www.w3.org/2000/svg"')) {
        const fname = rawFilename || `grafico_${fallbackIdx++}.svg`;
        artifacts.push({
          filename: fname.endsWith('.svg') ? fname : `${fname}.svg`,
          content: content.trim(),
          type: 'svg',
          ext: 'svg',
          lang: 'svg',
          sizeBytes: new Blob([content]).size,
        });
        continue;
      }

      // Detect HTML
      if (rawLang === 'html' || rawLang === 'htm' || content.trim().startsWith('<!DOCTYPE html') || content.trim().startsWith('<html')) {
        const fname = rawFilename || `pagina_${fallbackIdx++}.html`;
        artifacts.push({
          filename: fname.endsWith('.html') || fname.endsWith('.htm') ? fname : `${fname}.html`,
          content: content.trim(),
          type: 'html',
          ext: 'html',
          lang: 'html',
          sizeBytes: new Blob([content]).size,
        });
        continue;
      }

      // Detect PDF
      if (rawLang === 'pdf' || (rawFilename && rawFilename.endsWith('.pdf'))) {
        const fname = rawFilename || `documento_${fallbackIdx++}.pdf`;
        artifacts.push({
          filename: fname.endsWith('.pdf') ? fname : `${fname}.pdf`,
          content: content.trim(),
          type: 'pdf',
          ext: 'pdf',
          lang: 'pdf',
          sizeBytes: new Blob([content]).size,
        });
        continue;
      }

      // Detect DOCX
      if (rawLang === 'docx' || rawLang === 'doc' || (rawFilename && (rawFilename.endsWith('.docx') || rawFilename.endsWith('.doc')))) {
        const fname = rawFilename || `documento_${fallbackIdx++}.docx`;
        artifacts.push({
          filename: fname.endsWith('.docx') || fname.endsWith('.doc') ? fname : `${fname}.docx`,
          content: content.trim(),
          type: 'docx',
          ext: 'docx',
          lang: 'docx',
          sizeBytes: new Blob([content]).size,
        });
        continue;
      }

      // Detect Python, JS, TS, JSON, MD, CSS, etc.
      const isKnownLang = ['python', 'py', 'javascript', 'js', 'typescript', 'ts', 'markdown', 'md', 'json', 'css', 'sql', 'sh', 'bash'].includes(rawLang);
      if (rawFilename || isKnownLang) {
        const ext = rawFilename ? (rawFilename.split('.').pop() || rawLang) : (rawLang || 'txt');
        const fname = rawFilename || `archivo_${fallbackIdx++}.${ext === 'python' ? 'py' : (ext === 'javascript' ? 'js' : ext)}`;
        artifacts.push({
          filename: fname,
          content: content.trim(),
          type: ext,
          ext: ext,
          lang: rawLang || ext,
          sizeBytes: new Blob([content]).size,
        });
      }
    }

    // Process versions & update sessionActiveFiles
    return artifacts.map((art) => {
      let version = 1;
      let isModified = false;
      if (sessionActiveFiles.has(art.filename)) {
        const prev = sessionActiveFiles.get(art.filename);
        version = (prev.version || 1) + 1;
        isModified = true;
      }
      const finalArt = {
        ...art,
        version,
        isModified,
        mimeType: getFileMimeType(art.type, art.ext),
      };
      sessionActiveFiles.set(art.filename, finalArt);
      return finalArt;
    });
  }

  function triggerFileDownload(artifact) {
    if (!artifact) return;
    const { filename, content, type, ext } = artifact;

    if (type === 'pdf' || ext === 'pdf') {
      downloadPdfDocument(filename, filename, content);
      return;
    }
    if (type === 'docx' || ext === 'docx' || ext === 'doc') {
      downloadDocxDocument(filename, filename, content);
      return;
    }

    const mime = getFileMimeType(type, ext);
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(`✓ File downloaded: ${filename}`);
  }

  function downloadPdfDocument(filename, title, content) {
    const renderedBody = content.startsWith('<') ? content : marked.parse(content);
    const printDoc = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${title || filename}</title>
  <style>
    @page { size: A4; margin: 18mm; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; line-height: 1.6; margin: 0; padding: 24px; }
    h1 { color: #0f172a; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; font-size: 24pt; margin-top: 0; }
    h2 { color: #1e293b; margin-top: 18pt; font-size: 16pt; }
    h3 { color: #334155; font-size: 13pt; }
    pre, code { font-family: ui-monospace, Consolas, Monaco, monospace; font-size: 9.5pt; background: #f8fafc; border-radius: 4px; }
    pre { padding: 12px; border: 1px solid #e2e8f0; overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; margin: 16px 0; }
    th, td { border: 1px solid #cbd5e1; padding: 8px 12px; text-align: left; }
    th { background: #f1f5f9; font-weight: 600; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  ${renderedBody}
</body>
</html>`;
    const blob = new Blob([printDoc], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, '_blank');
    if (win) {
      win.addEventListener('load', () => {
        try { win.print(); } catch (_) {}
      });
      setTimeout(() => {
        try { win.print(); } catch (_) {}
      }, 500);
    } else {
      const a = document.createElement('a');
      a.href = url;
      a.download = filename.endsWith('.pdf') ? filename.replace(/\.pdf$/, '.html') : `${filename}.html`;
      a.click();
    }
    showToast(`✓ Opening PDF to print or save: ${filename}`);
  }

  function downloadDocxDocument(filename, title, content) {
    const renderedBody = content.startsWith('<') ? content : marked.parse(content);
    const wordDoc = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
<head>
  <meta charset="utf-8">
  <title>${title || filename}</title>
  <!--[if gte mso 9]>
  <xml>
    <w:WordDocument>
      <w:View>Print</w:View>
      <w:Zoom>100</w:Zoom>
      <w:DoNotOptimizeForBrowser/>
    </w:WordDocument>
  </xml>
  <![endif]-->
  <style>
    body { font-family: Calibri, Arial, sans-serif; font-size: 11pt; line-height: 1.5; color: #111; margin: 1in; }
    h1 { font-size: 18pt; color: #1e40af; }
    h2 { font-size: 14pt; color: #2563eb; }
    table { border-collapse: collapse; width: 100%; margin: 12pt 0; }
    th, td { border: 1pt solid #94a3b8; padding: 6pt 10pt; }
    th { background-color: #f1f5f9; font-weight: bold; }
    code { font-family: Consolas, monospace; background: #f8fafc; }
  </style>
</head>
<body>
  ${renderedBody}
</body>
</html>`;
    const blob = new Blob([wordDoc], { type: 'application/msword;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename.endsWith('.docx') || filename.endsWith('.doc') ? filename : `${filename}.doc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(`✓ Word document downloaded: ${a.download}`);
  }

  async function executeCodeArtifact(artifact, consoleEl, previewEl) {
    if (!artifact) return;
    const { lang, content, type } = artifact;

    if (type === 'html' || lang === 'html') {
      if (previewEl) {
        const isShown = !previewEl.classList.contains('hidden');
        if (isShown) {
          previewEl.classList.add('hidden');
          previewEl.innerHTML = '';
        } else {
          previewEl.classList.remove('hidden');
          previewEl.innerHTML = `<iframe sandbox="allow-scripts" srcdoc="${escapeHtml(content)}"></iframe>`;
        }
      }
      return;
    }

    if (type === 'svg' || lang === 'svg') {
      if (previewEl) {
        const isShown = !previewEl.classList.contains('hidden');
        if (isShown) {
          previewEl.classList.add('hidden');
          previewEl.innerHTML = '';
        } else {
          previewEl.classList.remove('hidden');
          previewEl.innerHTML = content;
        }
      }
      return;
    }

    if (lang === 'javascript' || lang === 'js') {
      if (!consoleEl) return;
      consoleEl.classList.remove('hidden');
      consoleEl.classList.remove('error');
      consoleEl.textContent = '⏳ Running JavaScript...';
      const logs = [];
      const fakeConsole = {
        log: (...args) => logs.push(args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')),
        error: (...args) => logs.push('[ERROR] ' + args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')),
        warn: (...args) => logs.push('[WARN] ' + args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')),
      };
      try {
        const runFn = new Function('console', content);
        const result = runFn(fakeConsole);
        if (result !== undefined) logs.push(`=> ${typeof result === 'object' ? JSON.stringify(result) : String(result)}`);
        consoleEl.textContent = logs.length > 0 ? logs.join('\n') : '✓ Executed successfully — no console output';
      } catch (err) {
        consoleEl.classList.add('error');
        consoleEl.textContent = `❌ Execution error: ${err.message}`;
      }
      return;
    }

    // Python / Bash / Shell via AntigravityBridge
    if (!consoleEl) return;
    consoleEl.classList.remove('hidden');
    consoleEl.classList.remove('error');
    consoleEl.textContent = `⏳ Running ${lang} via AntigravityBridge...`;
    const bridgeUrl = settingBridgeUrl?.value?.trim() || 'http://127.0.0.1:8765';
    try {
      const resp = await fetch(`${bridgeUrl}/api/code/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: content, language: lang }),
      });
      if (resp.status === 404) {
        consoleEl.classList.add('error');
        consoleEl.textContent = `❌ AntigravityBridge endpoint not found. Make sure the Bridge server is running at ${bridgeUrl}`;
        return;
      }
      const data = await resp.json();
      if (resp.ok && data.status === 'ok') {
        const out = (data.stdout || '').trim();
        const err = (data.stderr || '').trim();
        if (data.returncode !== 0) {
          consoleEl.classList.add('error');
          consoleEl.textContent = `❌ Exit code ${data.returncode} (${data.execution_time_ms}ms):\n${err || out}`;
        } else {
          consoleEl.textContent = `✓ Executed in ${data.execution_time_ms}ms:\n${out || '— no output —'}`;
        }
      } else {
        consoleEl.classList.add('error');
        consoleEl.textContent = `❌ Error: ${data.detail || data.stderr || 'Execution failed'}`;
      }
    } catch (err) {
      consoleEl.classList.add('error');
      consoleEl.textContent = `❌ Cannot connect to AntigravityBridge at ${bridgeUrl}. Start the Bridge server to run ${lang} code.`;
    }
  }

  function appendFileArtifactCards(container, rawText) {
    if (!container || !rawText || !rawText.trim()) return;
    if (container.querySelector('.file-artifacts-container')) return;

    const artifacts = extractFileArtifacts(rawText);
    if (!artifacts || artifacts.length === 0) return;

    const artifactsContainer = document.createElement('div');
    artifactsContainer.className = 'file-artifacts-container';

    artifacts.forEach((art) => {
      const card = document.createElement('div');
      card.className = 'file-artifact-card';
      card.setAttribute('data-filename', art.filename);

      const sizeKb = (art.sizeBytes / 1024).toFixed(1);
      const icon = getFileIcon(art.type, art.ext);
      const badgeText = art.isModified ? `v${art.version} (Modificado)` : `v${art.version}`;
      const badgeClass = art.isModified ? 'file-artifact-badge modified' : 'file-artifact-badge';

      card.innerHTML = `
        <div class="file-artifact-header">
          <div class="file-artifact-icon-wrap">
            <span class="file-artifact-icon">${icon}</span>
            <div class="file-artifact-info">
              <span class="file-artifact-name" title="${escapeHtml(art.filename)}">${escapeHtml(art.filename)}</span>
              <span class="file-artifact-meta">${art.ext.toUpperCase()} • ${sizeKb} KB</span>
            </div>
          </div>
          <span class="${badgeClass}">${badgeText}</span>
        </div>
        <div class="file-artifact-actions">
          <button type="button" class="file-artifact-btn btn-download" title="Descargar ${escapeHtml(art.filename)}">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            <span>Descargar</span>
          </button>
          ${['svg', 'html', 'md'].includes(art.ext) ? `
          <button type="button" class="file-artifact-btn btn-preview" title="Vista Previa de ${escapeHtml(art.filename)}">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"/></svg>
            <span>Vista Previa</span>
          </button>
          ` : ''}
          ${['py', 'python', 'js', 'javascript', 'html', 'svg', 'sh', 'bash'].includes(art.lang) ? `
          <button type="button" class="file-artifact-btn btn-run" title="Ejecutar código de ${escapeHtml(art.filename)}">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            <span>Ejecutar</span>
          </button>
          ` : ''}
          <button type="button" class="file-artifact-btn btn-copy" title="Copiar código al portapapeles">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
          </button>
        </div>
        <div class="file-artifact-preview-box hidden"></div>
        <div class="file-artifact-console hidden"></div>
      `;

      const downloadBtn = card.querySelector('.btn-download');
      const previewBtn = card.querySelector('.btn-preview');
      const runBtn = card.querySelector('.btn-run');
      const copyBtn = card.querySelector('.btn-copy');
      const previewBox = card.querySelector('.file-artifact-preview-box');
      const consoleBox = card.querySelector('.file-artifact-console');

      if (downloadBtn) {
        downloadBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          triggerFileDownload(art);
        });
      }

      if (previewBtn) {
        previewBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          executeCodeArtifact(art, consoleBox, previewBox);
        });
      }

      if (runBtn) {
        runBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          executeCodeArtifact(art, consoleBox, previewBox);
        });
      }

      if (copyBtn) {
        copyBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          try {
            await navigator.clipboard.writeText(art.content);
            const orig = copyBtn.innerHTML;
            copyBtn.innerHTML = '✓';
            setTimeout(() => { copyBtn.innerHTML = orig; }, 1600);
          } catch (_) {}
        });
      }

      artifactsContainer.appendChild(card);
    });

    container.appendChild(artifactsContainer);
  }

  // ─── Streaming Response Action Bar (Sources & Controls) ──────────────────────
  function appendStreamingResponseBar(container, rawText, sources = []) {
    if (!container || !rawText || !rawText.trim()) return;

    // Append File Artifact cards if any were generated in the response
    appendFileArtifactCards(container, rawText);

    if (container.querySelector('.streaming-response-bar')) return;

    // Detect sources: prefer explicit sources, then lastSearchSources, then parse markdown links
    let finalSources = Array.isArray(sources) && sources.length > 0 ? [...sources] : [];
    if (finalSources.length === 0 && Array.isArray(lastSearchSources) && lastSearchSources.length > 0) {
      finalSources = [...lastSearchSources];
    }
    if (finalSources.length === 0) {
      const linkRegex = /\[([^\]]+)\]\((https?:\/\/[^\s\)]+)\)/g;
      let match;
      const seen = new Set();
      while ((match = linkRegex.exec(rawText)) !== null) {
        const title = match[1];
        const url = match[2];
        if (!seen.has(url) && !url.includes('google.com/search')) {
          seen.add(url);
          try {
            const domain = new URL(url).hostname.replace(/^www\./, '');
            finalSources.push({
              title,
              url,
              domain,
              favicon: `https://www.google.com/s2/favicons?domain=${domain}&sz=32`,
            });
          } catch (e) {}
        }
      }
    }

    const bar = document.createElement('div');
    bar.className = 'streaming-response-bar';

    // 1. Copy Action
    const copyBtn = document.createElement('button');
    copyBtn.type = 'button';
    copyBtn.className = 'streaming-action-btn';
    copyBtn.setAttribute('title', 'Copiar respuesta');
    copyBtn.innerHTML = `
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
        <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
      </svg>
    `;
    copyBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const textToCopy = rawText
        .replace(/<(thought|think)>[\s\S]*?<\/\1>/gi, '')
        .replace(/<approval_card>[\s\S]*?<\/approval_card>/gi, '')
        .replace(/<next_steps_suggestions>[\s\S]*?<\/next_steps_suggestions>/gi, '')
        .trim();
      navigator.clipboard.writeText(textToCopy).then(() => {
        copyBtn.classList.add('copied');
        copyBtn.innerHTML = `
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        `;
        copyBtn.setAttribute('title', 'Copied');
        setTimeout(() => {
          copyBtn.classList.remove('copied');
          copyBtn.innerHTML = `
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
              <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
            </svg>
          `;
          copyBtn.setAttribute('title', 'Copy response');
        }, 1600);
      });
    });
    bar.appendChild(copyBtn);

    // Read aloud (Piper, through the Bridge); click again to stop
    const speakBtn = document.createElement('button');
    speakBtn.type = 'button';
    speakBtn.className = 'streaming-action-btn';
    speakBtn.setAttribute('title', 'Read aloud');
    speakBtn.innerHTML = `
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
        <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
        <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
      </svg>
    `;
    speakBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (speakBtn.classList.contains('speaking')) { stopSpeaking(); return; }
      stopSpeaking();
      speakBtn.classList.add('speaking');
      const started = await speakText(rawText);
      if (!started) speakBtn.classList.remove('speaking');
    });
    bar.appendChild(speakBtn);

    // 2. Retry Action
    const retryBtn = document.createElement('button');
    retryBtn.type = 'button';
    retryBtn.className = 'streaming-action-btn';
    retryBtn.setAttribute('title', 'Retry response');
    retryBtn.innerHTML = `
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
        <path d="M21 3v5h-5"/>
        <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
        <path d="M8 16H3v5"/>
      </svg>
    `;
    retryBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (lastUserPrompt) {
        promptInput.value = lastUserPrompt;
        handleInputStateChange();
        handleSend();
      }
    });
    bar.appendChild(retryBtn);

    // 3. Feedback Bar Component (Matching React component spec: Info, Helpful, Unhelpful, Dismiss)
    const fbContainer = document.createElement('div');
    fbContainer.className = 'feedback-bar-container';
    fbContainer.innerHTML = `
      <div class="feedback-bar">
        <div class="feedback-bar-left">
          <div class="feedback-bar-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="16" x2="12" y2="12"></line>
              <line x1="12" y1="8" x2="12.01" y2="8"></line>
            </svg>
          </div>
          <span class="feedback-bar-title">Was this response helpful?</span>
        </div>
        <div class="feedback-bar-actions">
          <button type="button" class="feedback-bar-btn fb-up" title="Helpful">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M7 10v12"></path>
              <path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h3"></path>
            </svg>
          </button>
          <button type="button" class="feedback-bar-btn fb-down" title="Not helpful">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M17 14V2"></path>
              <path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-3"></path>
            </svg>
          </button>
        </div>
        <div class="feedback-bar-divider">
          <button type="button" class="feedback-bar-close-btn" title="Dismiss">&times;</button>
        </div>
      </div>
    `;

    const fbBarEl = fbContainer.querySelector('.feedback-bar');
    const fbUp = fbContainer.querySelector('.fb-up');
    const fbDown = fbContainer.querySelector('.fb-down');
    const fbClose = fbContainer.querySelector('.feedback-bar-close-btn');

    fbUp?.addEventListener('click', (e) => {
      e.stopPropagation();
      const active = fbUp.classList.toggle('active-helpful');
      if (active) fbDown?.classList.remove('active-unhelpful');
    });

    fbDown?.addEventListener('click', (e) => {
      e.stopPropagation();
      const active = fbDown.classList.toggle('active-unhelpful');
      if (active) fbUp?.classList.remove('active-helpful');
    });

    fbClose?.addEventListener('click', (e) => {
      e.stopPropagation();
      fbBarEl?.classList.add('closing');
      setTimeout(() => fbContainer.remove(), 200);
    });

    // 4. Sources Disclosure Button
    if (finalSources.length > 0) {
      const sourcesBtn = document.createElement('button');
      sourcesBtn.type = 'button';
      sourcesBtn.className = 'streaming-sources-trigger';

      const favs = finalSources.slice(0, 3).map((s) => {
        const fav = s.favicon || (s.url ? `https://www.google.com/s2/favicons?domain=${new URL(s.url).hostname}&sz=32` : '');
        return fav ? `<img src="${fav}" alt="" class="citation-fav-img">` : '<span class="fav-placeholder"></span>';
      }).join('');

      sourcesBtn.innerHTML = `
        <span class="citation-favicons">${favs}</span>
        <span>${finalSources.length} ${finalSources.length === 1 ? 'source' : 'sources'}</span>
        <svg class="sources-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      `;

      const drawer = document.createElement('div');
      drawer.className = 'streaming-sources-drawer hidden';
      drawer.innerHTML = finalSources.map((s) => {
        const domain = s.domain || (s.url ? new URL(s.url).hostname.replace(/^www\./, '') : 'web');
        const fav = s.favicon || (s.url ? `https://www.google.com/s2/favicons?domain=${domain}&sz=32` : '');
        return `
          <a href="${escapeHtml(s.url || '#')}" target="_blank" rel="noopener noreferrer" class="citation-card">
            ${fav ? `<img src="${fav}" alt="" class="citation-card-fav">` : ''}
            <div class="citation-card-info">
              <div class="citation-card-title">${escapeHtml(s.title || domain)}</div>
              <div class="citation-card-domain">${escapeHtml(domain)}</div>
              ${s.snippet ? `<div class="citation-card-snippet">${escapeHtml(s.snippet)}</div>` : ''}
            </div>
          </a>
        `;
      }).join('');

      sourcesBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isHidden = drawer.classList.toggle('hidden');
        sourcesBtn.querySelector('.sources-chevron')?.classList.toggle('open', !isHidden);
      });

      bar.appendChild(sourcesBtn);
      bar.appendChild(drawer);
    }

    container.appendChild(bar);
    container.appendChild(fbContainer);
  }

  // ─── Blueprint Grid Background with Interactive Mouse Trail ─────────────────
  // Static single grid over custom blue gradient background with smooth cursor trail
  let blueprintAnimationId = null;

  function renderFloatingPathsBackground() {
    const container = document.getElementById('floatingPathsBackground');
    if (!container) return;

    if (blueprintAnimationId) {
      cancelAnimationFrame(blueprintAnimationId);
      blueprintAnimationId = null;
    }

    container.innerHTML = `
      <!-- Single Clean Blueprint Canvas with Interactive Trail -->
      <canvas id="blueprintCanvas" class="blueprint-canvas"></canvas>
      <div class="blueprint-vignette-layer"></div>
    `;

    initBlueprintCanvas();
  }

  function initBlueprintCanvas() {
    const canvas = document.getElementById('blueprintCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const baseSquareSize = currentSquareSize || 44;

    // Active trail cells map: key -> { gx, gy, alpha }
    const trailCells = new Map();

    function resizeCanvas() {
      const parent = canvas.parentElement;
      const cw = Math.max(280, (parent?.clientWidth || window.innerWidth || 400) | 0);
      const ch = Math.max(300, (parent?.clientHeight || window.innerHeight || 600) | 0);
      const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
      canvas.width = Math.floor(cw * dpr);
      canvas.height = Math.floor(ch * dpr);
      canvas.style.width = cw + 'px';
      canvas.style.height = ch + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Track mouse over entire document and record square trail
    window.addEventListener('mousemove', (e) => {
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const cw = canvas.clientWidth || (canvas.parentElement?.clientWidth || window.innerWidth) || 400;
      const ch = canvas.clientHeight || (canvas.parentElement?.clientHeight || window.innerHeight) || 600;
      if (mouseX < 0 || mouseY < 0 || mouseX > cw || mouseY > ch) {
        return;
      }
      const cols = Math.max(1, Math.round(cw / (currentSquareSize || 44)));
      const rows = Math.max(1, Math.round(ch / (currentSquareSize || 44)));
      const cellW = cw / cols;
      const cellH = ch / rows;

      const gx = Math.min(cols - 1, Math.max(0, Math.floor(mouseX / cellW)));
      const gy = Math.min(rows - 1, Math.max(0, Math.floor(mouseY / cellH)));
      const key = `${gx},${gy}`;
      trailCells.set(key, { gx, gy, alpha: 1.0 });
    });

    function tick() {
      const cw = canvas.clientWidth || (canvas.parentElement?.clientWidth || window.innerWidth) || 400;
      const ch = canvas.clientHeight || (canvas.parentElement?.clientHeight || window.innerHeight) || 600;
      ctx.clearRect(0, 0, cw, ch);

      const baseSquareSize = currentSquareSize || 44;
      const cols = Math.max(1, Math.round(cw / baseSquareSize));
      const rows = Math.max(1, Math.round(ch / baseSquareSize));
      const cellW = cw / cols;
      const cellH = ch / rows;

      // 1. Draw STATIC Clean Blueprint Grid Lines (Perfect integer count, no half-cut edge cells!)
      const opacity = typeof currentGridOpacity === 'number' ? currentGridOpacity : 0.065;
      if (opacity > 0.001) {
        ctx.strokeStyle = `rgba(148, 163, 184, ${opacity})`;
        ctx.lineWidth = 1;

        for (let i = 0; i <= cols; i++) {
          const x = Math.round(i * cellW);
          ctx.beginPath();
          ctx.moveTo(x + 0.5, 0);
          ctx.lineTo(x + 0.5, ch);
          ctx.stroke();
        }

        for (let j = 0; j <= rows; j++) {
          const y = Math.round(j * cellH);
          ctx.beginPath();
          ctx.moveTo(0, y + 0.5);
          ctx.lineTo(cw, y + 0.5);
          ctx.stroke();
        }
      }

      // 2. Draw & Decay Interactive Mouse Trail Cells with soft, transparent borders
      const decay = currentTrailDecay || 0.022;
      trailCells.forEach((cell, key) => {
        cell.alpha -= decay;
        if (cell.alpha <= 0.01) {
          trailCells.delete(key);
          return;
        }

        const cellX = cell.gx * cellW;
        const cellY = cell.gy * cellH;
        const a = cell.alpha;

        // Soft Glowing Blue Shadow
        ctx.save();
        ctx.shadowBlur = 10 * a;
        ctx.shadowColor = `rgba(59, 130, 246, ${0.45 * a})`;
        ctx.fillStyle = `rgba(37, 99, 235, ${0.12 * a})`;
        ctx.fillRect(cellX, cellY, cellW, cellH);
        ctx.restore();

        // Transparent, delicate border for the square
        ctx.lineWidth = 1;
        ctx.strokeStyle = `rgba(147, 197, 253, ${0.28 * a})`;
        ctx.strokeRect(cellX + 0.5, cellY + 0.5, cellW - 1, cellH - 1);

        // Soft Gradient Sheen
        const grad = ctx.createLinearGradient(cellX, cellY, cellX, cellY + cellH);
        grad.addColorStop(0, `rgba(255, 255, 255, ${0.08 * a})`);
        grad.addColorStop(1, `rgba(255, 255, 255, ${0.01 * a})`);
        ctx.fillStyle = grad;
        ctx.fillRect(cellX, cellY, cellW, cellH);
      });

      blueprintAnimationId = requestAnimationFrame(tick);
    }

    blueprintAnimationId = requestAnimationFrame(tick);
  }

  // ─── Markdown Parser & Reasoning UI ─────────────────────────────────────────
  function escapeHtml(str) {
    if (typeof str !== 'string') {
      str = str ? String(str) : '';
    }
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function renderThinkingBubbleHtml(label = 'Thinking and analyzing screen...') {
    return `
      <div class="assistant-thinking-indicator">
        <div class="typing-indicator">
          <span></span><span></span><span></span>
        </div>
        <span class="thinking-sparkle">✦</span>
        <span class="thinking-shimmer-text">${escapeHtml(label)}</span>
      </div>
    `;
  }

  function formatReasoningAccordion(thoughtContent, isOpen = true) {
    const rawTrim = (thoughtContent || '').trim();
    const escaped = escapeHtml(rawTrim);
    const formattedBody = escaped
      ? escaped.replace(/\n/g, '<br>')
      : '<span class="thinking-shimmer-text">Analyzing context and formulating response...</span>';
    const statusLabel = isOpen ? 'Thinking...' : 'Reasoning';
    const pingIndicator = isOpen ? `
      <span class="reasoning-ping-container">
        <span class="reasoning-ping-dot"></span>
        <span class="reasoning-dot"></span>
      </span>
    ` : `
      <span class="reasoning-done-icon">
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
      </span>
    `;

    return `
      <div class="chat-reasoning-accordion ${isOpen ? 'open active-thinking' : ''}">
        <div class="chat-reasoning-trigger" role="button" tabindex="0">
          <div class="chat-reasoning-status">
            ${pingIndicator}
            <span class="${isOpen ? 'thinking-shimmer-text' : ''}">${statusLabel}</span>
          </div>
          <svg class="reasoning-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </div>
        <div class="chat-reasoning-content">
          <div class="chat-reasoning-tree">
            <div class="chat-reasoning-line"></div>
            <div class="chat-reasoning-item">
              <div class="chat-reasoning-marker"></div>
              <div class="chat-reasoning-body">${formattedBody}</div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // Asks the user before the assistant creates agents; the answer goes back to the background worker
  function showAgentPermissionCard(req) {
    welcomeHero.classList.add('hidden');
    messagesContainer.classList.remove('hidden');
    const card = document.createElement('div');
    card.className = 'agent-permission-card';
    const list = (req.agents || []).slice(0, 12).map((a) => `<li><strong>${escapeHtml(a.name)}</strong>${a.task ? ` <span>${escapeHtml(a.task)}</span>` : ''}</li>`).join('');
    const more = (req.count || 0) > 12 ? `<li class="more">and ${(req.count || 0) - 12} more...</li>` : '';
    card.innerHTML = `
      <div class="agent-permission-title">Create ${req.count} agent${req.count === 1 ? '' : 's'}?</div>
      <ul class="agent-permission-list">${list}${more}</ul>
      <div class="agent-permission-warning">Every agent makes its own model calls (in Cowork it also opens its own browser tab). This can use a lot of tokens.</div>
      <div class="agent-permission-actions">
        <button type="button" data-act="allow" class="agent-perm-btn allow">Allow</button>
        <button type="button" data-act="deny" class="agent-perm-btn">Deny</button>
        <button type="button" data-act="always" class="agent-perm-btn subtle" title="Stop asking from now on (you can turn it back on in Settings)">Allow and don't ask again</button>
      </div>`;
    card.querySelectorAll('button').forEach((btn) => {
      btn.addEventListener('click', () => {
        const act = btn.getAttribute('data-act');
        const allow = act !== 'deny';
        sendPortMessage({ type: 'agent_permission_response', requestId: req.requestId, allow });
        if (act === 'always') {
          const input = document.getElementById('settingAgentConfirm');
          if (input) input.checked = false;
          chrome.storage.local.get(['antigravity_settings'], (res) => {
            const prev = res.antigravity_settings || {};
            prev.agentConfirm = false;
            chrome.storage.local.set({ antigravity_settings: prev });
          });
        }
        card.className = 'agent-permission-card resolved';
        card.innerHTML = `<div class="agent-permission-title">${allow ? 'Agents approved' : 'Agents denied'}</div>`;
      });
    });
    messagesContainer.appendChild(card);
    scrollToBottom();
  }

  function renderAgentRunHtml(data) {
    const agents = Array.isArray(data.agents) ? data.agents : [];
    if (agents.length === 0) {
      return '<div class="agent-run-card"><div class="agent-run-head">Starting sub-agents...</div></div>';
    }
    const finished = agents.filter((a) => a.status === 'done' || a.status === 'error').length;
    const rows = agents.map((a) => {
      const indent = Math.max(0, (a.depth || 1) - 1) * 14;
      const body = a.status === 'error'
        ? `<div class="agent-run-output error">${escapeHtml(a.error || 'Failed')}</div>`
        : (a.text ? `<div class="agent-run-output">${escapeHtml(a.text)}</div>` : '');
      const time = typeof a.elapsed === 'number' ? `${a.elapsed}s` : '';
      return `<details class="agent-run-item">
        <summary style="padding-left:${12 + indent}px">
          <span class="agent-run-dot ${escapeHtml(a.status || 'running')}"></span>
          <span class="agent-run-name">${escapeHtml(a.name || 'Agent')}</span>
          <span class="agent-run-role">${escapeHtml(a.role || '')}</span>
          <span class="agent-run-time">${time}</span>
        </summary>${body}
      </details>`;
    }).join('');
    return `<div class="agent-run-card">
      <div class="agent-run-head">Sub-agents<span class="agent-run-count">${finished}/${agents.length} done</span></div>
      ${rows}
    </div>`;
  }

  function renderMarkdown(text, isStreaming = false) {
    if (typeof text !== 'string') {
      text = text ? String(text) : '';
    }
    if (!text || text.trim() === '') {
      return isStreaming ? renderThinkingBubbleHtml('Thinking and analyzing screen...') : '';
    }

    let reasoningHtml = '';
    let responseText = text;

    // 1. Extract all CoT Reasoning (<thought>...</thought> or <think>...</think>)
    const thoughtBlocks = [];
    let isThinkingInProgress = false;

    // Match all closed thought blocks
    const closedThoughtRegex = /<(thought|think)>([\s\S]*?)<\/\1>/gi;
    let match;
    while ((match = closedThoughtRegex.exec(responseText)) !== null) {
      if (match[2] && match[2].trim()) {
        thoughtBlocks.push(match[2].trim());
      }
    }
    responseText = responseText.replace(closedThoughtRegex, '').trim();

    // Check if there is an unclosed thought block in progress while streaming
    const unclosedThoughtMatch = responseText.match(/<(thought|think)>([\s\S]*)$/i);
    if (unclosedThoughtMatch) {
      isThinkingInProgress = true;
      if (unclosedThoughtMatch[2] && unclosedThoughtMatch[2].trim()) {
        thoughtBlocks.push(unclosedThoughtMatch[2].trim());
      }
      responseText = responseText.replace(unclosedThoughtMatch[0], '').trim();
    }

    // Strip any orphaned closing tags
    responseText = responseText.replace(/<\/(thought|think)>/gi, '').trim();

    if (thoughtBlocks.length > 0 || isThinkingInProgress) {
      reasoningHtml = formatReasoningAccordion(thoughtBlocks.join('\n\n'), isThinkingInProgress);
    }

    // 1.4 Sub-agent cards (<agent_run>JSON</agent_run>) and the delegation request itself (<spawn_agents>)
    const agentRunMap = new Map();
    let agentRunIdx = 0;
    responseText = responseText.replace(/<agent_run>([\s\S]*?)<\/agent_run>/gi, (_, json) => {
      const id = `%%%AGENTRUN_${agentRunIdx++}%%%`;
      let data = null;
      try { data = JSON.parse(json); } catch (_) { /* incomplete card: skip */ }
      agentRunMap.set(id, data ? renderAgentRunHtml(data) : '');
      return `\n\n${id}\n\n`;
    });
    responseText = responseText
      .replace(/<spawn_agents>[\s\S]*?<\/spawn_agents>/gi, '')
      .replace(/<spawn_agents>[\s\S]*$/i, '')
      .replace(/<mascot_note>[\s\S]*?<\/mascot_note>/gi, '')
      .replace(/<mascot_note>[\s\S]*$/i, '')
      .replace(/<agent_run>[\s\S]*$/i, '')
      .trim();

    // 1.5 Extract Approval Card (<approval_card>...</approval_card>)
    const approvalMatch = responseText.match(/<approval_card>([\s\S]*?)(?:<\/approval_card>|$)/i);
    let approvalHtml = '';
    if (approvalMatch) {
      const isComplete = responseText.includes('</approval_card>');
      if (!isComplete && isStreaming) {
        approvalHtml = `
          <div class="approval-card-loading">
            <div class="typing-indicator"><span></span><span></span><span></span></div>
            <span>Generating interactive options...</span>
          </div>
        `;
      } else {
        const rawJson = approvalMatch[1].trim().replace(/```[a-z]*\n?/g, '').replace(/```$/g, '').trim();
        try {
          const cardData = JSON.parse(rawJson);
          const cardId = `appr_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
          activeApprovalCards.set(cardId, cardData);
          approvalHtml = `<div class="approval-card-root approval-card-mount" data-approval-id="${cardId}"></div>`;
        } catch (e) {
          console.warn('ApprovalCard JSON parse error:', e);
        }
      }
      responseText = responseText.replace(approvalMatch[0], '').trim();
    }

    // 1.6 Extract Model Next Steps Prompt Suggestions (<next_steps_suggestions>...</next_steps_suggestions>)
    const nextStepsMatch = responseText.match(/<next_steps_suggestions>([\s\S]*?)(?:<\/next_steps_suggestions>|$)/i);
    if (nextStepsMatch) {
      const rawSuggestions = nextStepsMatch[1].trim().replace(/```[a-z]*\n?/g, '').replace(/```$/g, '').trim();
      try {
        const parsed = JSON.parse(rawSuggestions);
        if (Array.isArray(parsed) && parsed.length > 0) {
          latestModelSuggestions = parsed.filter(s => typeof s === 'string' && s.trim().length > 0).slice(0, 3);
        }
      } catch (_) {
        // Handle newline separated or non-strict json
        const lines = rawSuggestions.split('\n')
          .map(l => l.replace(/^[\s*"-]+/, '').replace(/["',]+$/, '').trim())
          .filter(l => l.length > 3 && !l.startsWith('[') && !l.startsWith(']'));
        if (lines.length > 0) {
          latestModelSuggestions = lines.slice(0, 3);
        }
      }
      responseText = responseText.replace(nextStepsMatch[0], '').trim();
    }

    if (!responseText) {
      if (isStreaming && (thoughtBlocks.length > 0 || isThinkingInProgress)) {
        reasoningHtml += `
          <div class="thinking-sub-status">
            <span class="typing-indicator">
              <span></span><span></span><span></span>
            </span>
            <span>Composing response...</span>
          </div>
        `;
      }
      return (reasoningHtml + approvalHtml) || (isStreaming ? renderThinkingBubbleHtml('Thinking and analyzing screen...') : '');
    }

    // 2. Protect Code Blocks & Inline Code from math parsing
    const codeBlocks = [];
    let processed = responseText.replace(/(```[\s\S]*?```|`[^`\n]+`)/g, (match) => {
      const id = `%%%CODE_${codeBlocks.length}%%%`;
      codeBlocks.push(match);
      return id;
    });

    const mathMap = new Map();
    let mathIdx = 0;

    // 3. Display Math: $$...$$ and \[...\]
    processed = processed.replace(/\$\$([\s\S]*?)\$\$/g, (_, math) => {
      const id = `%%%MATH_BLOCK_${mathIdx++}%%%`;
      try {
        const rendered = katex.renderToString(math.trim(), { displayMode: true, throwOnError: false });
        mathMap.set(id, `<div class="math-block">${rendered}</div>`);
      } catch (e) {
        mathMap.set(id, `<pre class="math-error">${escapeHtml(math)}</pre>`);
      }
      return id;
    });

    processed = processed.replace(/\\\[([\s\S]*?)\\\]/g, (_, math) => {
      const id = `%%%MATH_BLOCK_${mathIdx++}%%%`;
      try {
        const rendered = katex.renderToString(math.trim(), { displayMode: true, throwOnError: false });
        mathMap.set(id, `<div class="math-block">${rendered}</div>`);
      } catch (e) {
        mathMap.set(id, `<pre class="math-error">${escapeHtml(math)}</pre>`);
      }
      return id;
    });

    // 4. Inline Math: \(...\) and $...$
    processed = processed.replace(/\\\(([\s\S]*?)\\\)/g, (_, math) => {
      const id = `%%%MATH_INLINE_${mathIdx++}%%%`;
      try {
        const rendered = katex.renderToString(math.trim(), { displayMode: false, throwOnError: false });
        mathMap.set(id, rendered);
      } catch (e) {
        mathMap.set(id, escapeHtml(math));
      }
      return id;
    });

    // Dollar math: single line, cannot start or end with space, cannot end with digit (avoids currency)
    processed = processed.replace(/(?<!\\|\$)\$(?!\s)((?:\\\$|[^\$\n])+?)(?<!\s|\$)\$(?!\d)/g, (_, math) => {
      const id = `%%%MATH_INLINE_${mathIdx++}%%%`;
      try {
        const rendered = katex.renderToString(math.trim(), { displayMode: false, throwOnError: false });
        mathMap.set(id, rendered);
      } catch (e) {
        mathMap.set(id, `$${escapeHtml(math)}$`);
      }
      return id;
    });

    // 5. Restore Code Blocks
    processed = processed.replace(/%%%CODE_(\d+)%%%/g, (_, idx) => codeBlocks[parseInt(idx, 10)]);

    // 6. Full Markdown Parsing with marked
    let html = '';
    try {
      html = marked.parse(processed);
    } catch (err) {
      console.warn('Marked parse error, fallback:', err);
      html = escapeHtml(processed).replace(/\n/g, '<br>');
    }

    // 7. Restore Math Tokens in HTML safely without regex substitution collision
    for (const [id, val] of mathMap.entries()) {
      const pWrapped = `<p>${id}</p>`;
      if (html.includes(pWrapped)) {
        html = html.replaceAll(pWrapped, () => val);
      } else {
        html = html.replaceAll(id, () => val);
      }
    }

    for (const [id, val] of agentRunMap.entries()) {
      const pWrapped = `<p>${id}</p>`;
      html = html.includes(pWrapped) ? html.replaceAll(pWrapped, () => val) : html.replaceAll(id, () => val);
    }

    // Ensure links open safely in a new tab
    html = html.replace(/<a /g, '<a target="_blank" rel="noopener noreferrer" ');

    // Wrap tables in responsive scroll container with interactive actions header
    const tableHeaderHtml = '<div class="table-actions-header">' +
      '<span class="table-label">' +
        '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/></svg>' +
        '<span>Table</span>' +
      '</span>' +
      '<div class="table-buttons">' +
        '<button type="button" class="table-action-mini-btn table-scroll-left-btn" title="Scroll left">‹</button>' +
        '<button type="button" class="table-action-mini-btn table-scroll-right-btn" title="Scroll right">›</button>' +
        '<button type="button" class="table-action-mini-btn table-open-tab-btn" title="Open table in new tab">⤢ Full View</button>' +
      '</div>' +
    '</div>';
    html = html.replace(/<table>/g, `<div class="table-scroll-container">${tableHeaderHtml}<table class="markdown-table">`);
    html = html.replace(/<\/table>/g, '</table></div>');

    const finalHtml = (reasoningHtml ? reasoningHtml : '') + html + (approvalHtml ? approvalHtml : '');
    if (isStreaming) {
      return finalHtml + '<span class="streaming-cursor"></span>';
    }
    return finalHtml;
  }

  // Initialize view
  renderFloatingPathsBackground();
  handleInputStateChange();
  chrome.storage.local.get(
    ['antigravity_base_model', 'antigravity_thinking_effort', 'antigravity_default_model'],
    (data) => {
      if (data?.antigravity_base_model) {
        if (data.antigravity_thinking_effort) {
          currentThinkingEffort = data.antigravity_thinking_effort;
        }
        selectModel(data.antigravity_base_model, true);
      } else if (data?.antigravity_default_model) {
        selectModel(data.antigravity_default_model);
      } else {
        selectModel(currentModel);
      }
    }
  );

  // ─── Open Full Tab & Table Viewer Utilities ──────────────────────────────
  const openInNewTabBtn = document.getElementById('openInNewTabBtn');
  if (openInNewTabBtn) {
    openInNewTabBtn.addEventListener('click', () => {
      chrome.tabs.create({ url: chrome.runtime.getURL('side-panel/index.html') });
    });
  }

  function sanitizeTableHtml(rawHtml) {
    if (!rawHtml || typeof rawHtml !== 'string') return '';
    const temp = document.createElement('div');
    temp.innerHTML = rawHtml;

    // Disallow dangerous elements completely
    const forbiddenTags = ['script', 'iframe', 'object', 'embed', 'link', 'style', 'form', 'input', 'button', 'svg', 'math'];
    forbiddenTags.forEach(tag => {
      temp.querySelectorAll(tag).forEach(el => el.remove());
    });

    // Remove all event handler attributes and unsafe hrefs/srcs
    temp.querySelectorAll('*').forEach(el => {
      const attrs = Array.from(el.attributes);
      for (const attr of attrs) {
        const name = attr.name.toLowerCase();
        const val = attr.value.trim().toLowerCase();
        if (name.startsWith('on') || val.startsWith('javascript:') || val.startsWith('data:text/html')) {
          el.removeAttribute(attr.name);
        }
      }
    });

    return temp.innerHTML;
  }

  function openTableInFullTab(tableHtml) {
    const cleanTableHtml = sanitizeTableHtml(tableHtml);
    const pageHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src https: data:;">
  <title>Autono — Table View</title>
  <style>
    body {
      background: #0d0e11;
      color: #f1f5f9;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      padding: 32px;
      margin: 0;
    }
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 24px;
      padding-bottom: 12px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }
    h2 { margin: 0; font-size: 18px; color: #38bdf8; }
    .table-wrapper {
      overflow-x: auto;
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 12px;
      background: #18191d;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 14px;
      line-height: 1.6;
    }
    th, td {
      border: 1px solid rgba(255, 255, 255, 0.08);
      padding: 12px 16px;
      text-align: left;
    }
    th {
      background: #202227;
      color: #38bdf8;
      font-weight: 600;
    }
    tr:nth-child(even) { background: rgba(255, 255, 255, 0.02); }
    tr:hover { background: rgba(56, 189, 248, 0.04); }
    code { font-family: monospace; background: rgba(255, 255, 255, 0.1); padding: 2px 6px; border-radius: 4px; }
  </style>
</head>
<body>
  <div class="header">
    <h2>Autono Table Viewer</h2>
    <span style="color:#94a3b8;font-size:13px;">Full View</span>
  </div>
  <div class="table-wrapper">
    ${cleanTableHtml}
  </div>
</body>
</html>`;
    const blob = new Blob([pageHtml], { type: 'text/html' });
    const blobUrl = URL.createObjectURL(blob);
    chrome.tabs.create({ url: blobUrl });
  }

  // ─── Direct Runtime Message Listener for Panel Close & Context Menu ────────
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.type === 'close_side_panel') {
      window.close();
    } else if (msg?.type === 'CONTEXT_MENU_ASK_ANTIGRAVITY') {
      if (promptInput) {
        promptInput.focus();
        if (msg.selectionText) {
          const previewName = msg.selectionText.length > 25 ? msg.selectionText.slice(0, 22) + '...' : msg.selectionText;
          addAttachedItem({
            type: 'fragment',
            name: `Selección: "${previewName}"`,
            content: `Texto seleccionado de ${msg.pageTitle || msg.pageUrl || 'la página'}:\nURL: ${msg.pageUrl || ''}\n\n"${msg.selectionText}"`,
            url: msg.pageUrl,
            title: msg.pageTitle,
          });
          promptInput.value = '';
          promptInput.placeholder = 'Haz una pregunta sobre el texto seleccionado...';
          handleInputStateChange();
          showToast('Texto seleccionado adjuntado como contexto');
        } else if (msg.pageTitle) {
          promptInput.placeholder = `Preguntar a Antigravity sobre "${msg.pageTitle.slice(0, 35)}"...`;
        }
      }
    }
  });

  // ─── CSP-Safe Delegated Click & Keyboard Handlers for Dynamic Elements ─────
  document.addEventListener('click', (e) => {
    // 1. Chat reasoning / thinking accordion toggle
    const reasoningTrigger = e.target.closest('.chat-reasoning-trigger');
    if (reasoningTrigger) {
      const accordion = reasoningTrigger.closest('.chat-reasoning-accordion');
      if (accordion) accordion.classList.toggle('open');
      return;
    }

    // 2. Agent planning card header collapse/expand
    const planHeader = e.target.closest('.agent-planning-header');
    if (planHeader) {
      const card = planHeader.closest('.agent-planning-card');
      if (card) card.classList.toggle('collapsed');
      return;
    }

    // 3. Agent planning step detail toggle
    const stepHeader = e.target.closest('.agent-step-header-row');
    if (stepHeader) {
      const step = stepHeader.closest('.agent-planning-step');
      if (step && step.querySelector('.agent-step-detail-box')) {
        step.classList.toggle('expanded');
        return;
      }
    }

    // 4. Table action: Scroll left
    const scrollLeftBtn = e.target.closest('.table-scroll-left-btn');
    if (scrollLeftBtn) {
      const container = scrollLeftBtn.closest('.table-scroll-container');
      if (container) container.scrollBy({ left: -260, behavior: 'smooth' });
      return;
    }

    // 5. Table action: Scroll right
    const scrollRightBtn = e.target.closest('.table-scroll-right-btn');
    if (scrollRightBtn) {
      const container = scrollRightBtn.closest('.table-scroll-container');
      if (container) container.scrollBy({ left: 260, behavior: 'smooth' });
      return;
    }

    // 6. Table action: Open table in full new tab
    const openTableBtn = e.target.closest('.table-open-tab-btn');
    if (openTableBtn) {
      const container = openTableBtn.closest('.table-scroll-container');
      const table = container?.querySelector('table');
      if (table) {
        openTableInFullTab(table.outerHTML);
      }
      return;
    }
  });

  // Free Drag-to-Scroll on Tables
  let isTableDragging = false;
  let tableDragStartX = 0;
  let tableDragScrollLeft = 0;
  let activeDragTable = null;

  document.addEventListener('mousedown', (e) => {
    if (e.target.closest('button, a, input, select, textarea')) return;
    const container = e.target.closest('.table-scroll-container');
    if (container) {
      isTableDragging = true;
      activeDragTable = container;
      tableDragStartX = e.pageX - container.offsetLeft;
      tableDragScrollLeft = container.scrollLeft;
    }
  });

  document.addEventListener('mousemove', (e) => {
    if (!isTableDragging || !activeDragTable) return;
    e.preventDefault();
    const x = e.pageX - activeDragTable.offsetLeft;
    const walk = (x - tableDragStartX) * 1.5;
    activeDragTable.scrollLeft = tableDragScrollLeft - walk;
  });

  document.addEventListener('mouseup', () => {
    isTableDragging = false;
    activeDragTable = null;
  });

  // Keyboard accessibility (Enter / Space to toggle accordion triggers)
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      const target = e.target;
      if (target && (target.classList.contains('chat-reasoning-trigger') ||
                     target.classList.contains('agent-planning-header') ||
                     target.classList.contains('agent-step-header-row'))) {
        e.preventDefault();
        target.click();
      }
    }
  });

  // Safe global image error listener (avoids all inline onerror attributes)
  document.addEventListener('error', (e) => {
    if (e.target && e.target.tagName === 'IMG') {
      e.target.style.display = 'none';
    }
  }, true);

  // ─── Keyboard Shortcuts Inside Panel (90 to Close/Hide) ─────────────────────
  let panelLastPressedKey = '';
  let panelLastKeyTime = 0;
  const panelHeldKeys = new Set();

  function isPanelNineKey(e) {
    return e.key === '9' || e.code === 'Digit9' || e.code === 'Numpad9';
  }

  function isPanelZeroKey(e) {
    return e.key === '0' || e.code === 'Digit0' || e.code === 'Numpad0';
  }

  function isPanelEditableElement(target) {
    if (!target) return false;
    const tagName = target.tagName ? target.tagName.toLowerCase() : '';
    return (
      target.isContentEditable ||
      tagName === 'input' ||
      tagName === 'textarea' ||
      tagName === 'select'
    );
  }

  window.addEventListener(
    'keydown',
    (e) => {
      const isEditable = isPanelEditableElement(e.target);
      const isFieldNearlyEmpty = isEditable && (!e.target.value || e.target.value.trim().length <= 1);
      const now = Date.now();

      // Check key '0'
      if (isPanelZeroKey(e)) {
        panelHeldKeys.add('0');

        // Check if '9' was pressed before '0' within 750ms -> "90" (Hide/Close)
        const is90Sequence = panelLastPressedKey === '9' && (now - panelLastKeyTime < 750);
        const is90Chord = panelHeldKeys.has('9'); // holding 9 and hit 0

        if (is90Chord || (!isEditable && is90Sequence) || (isFieldNearlyEmpty && is90Sequence)) {
          e.preventDefault();
          e.stopPropagation();
          panelHeldKeys.clear();
          panelLastPressedKey = '';
          try {
            chrome.runtime.sendMessage({ type: 'close_side_panel' });
          } catch {}
          window.close();
          return;
        }

        panelLastPressedKey = '0';
        panelLastKeyTime = now;
        return;
      }

      // Check key '9'
      if (isPanelNineKey(e)) {
        panelHeldKeys.add('9');
        panelLastPressedKey = '9';
        panelLastKeyTime = now;
        return;
      }

      panelLastPressedKey = '';
    },
    true
  );

  window.addEventListener(
    'keyup',
    (e) => {
      if (isPanelZeroKey(e)) panelHeldKeys.delete('0');
      if (isPanelNineKey(e)) panelHeldKeys.delete('9');
    },
    true
  );

  window.addEventListener('blur', () => {
    panelHeldKeys.clear();
    panelLastPressedKey = '';
  });

  // ─── Prompt Optimizer / Enhancer Feature ──────────────────────────────────
  const promptEnhanceBtn = document.getElementById('promptEnhanceBtn');
  const promptEnhanceModal = document.getElementById('promptEnhanceModal');
  const closeEnhanceModalBtn = document.getElementById('closeEnhanceModalBtn');
  const cancelEnhanceBtn = document.getElementById('cancelEnhanceBtn');
  const confirmEnhanceBtn = document.getElementById('confirmEnhanceBtn');
  const skipEnhanceWarningCheckbox = document.getElementById('skipEnhanceWarning');

  function openEnhanceModal() {
    if (!promptEnhanceModal) return;
    if (skipEnhanceWarningCheckbox) {
      skipEnhanceWarningCheckbox.checked = false;
    }
    promptEnhanceModal.classList.remove('hidden');
  }

  function closeEnhanceModal() {
    if (!promptEnhanceModal) return;
    promptEnhanceModal.classList.add('hidden');
  }

  closeEnhanceModalBtn?.addEventListener('click', closeEnhanceModal);
  cancelEnhanceBtn?.addEventListener('click', closeEnhanceModal);
  promptEnhanceModal?.addEventListener('click', (e) => {
    if (e.target === promptEnhanceModal) closeEnhanceModal();
  });

  promptEnhanceBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    const rawText = (promptInput?.value || '').trim();
    if (!rawText) {
      showToast('Type a prompt or task idea first to optimize it');
      promptInput?.focus();
      return;
    }

    const skipWarning = localStorage.getItem('antigravity_skip_enhance_warning') === 'true';
    if (skipWarning) {
      executePromptEnhancement();
    } else {
      openEnhanceModal();
    }
  });

  confirmEnhanceBtn?.addEventListener('click', () => {
    if (skipEnhanceWarningCheckbox?.checked) {
      try {
        localStorage.setItem('antigravity_skip_enhance_warning', 'true');
      } catch (_) {}
    }
    closeEnhanceModal();
    executePromptEnhancement();
  });

  async function executePromptEnhancement() {
    const rawText = (promptInput?.value || '').trim();
    if (!rawText) return;

    if (promptEnhanceBtn) {
      promptEnhanceBtn.disabled = true;
      promptEnhanceBtn.classList.add('enhancing');
    }

    showToast('✦ Enhancing prompt for maximum performance...');

    try {
      const targetModel = currentModel || 'gemini-2.5-flash';

      const promptOptimizationInstruction = `You are a world-class prompt engineering expert. 
Your task is to take the user's rough query or task description and transform it into a high-performance, well-structured, production-grade LLM prompt.

Follow these strict guidelines:
1. Provide clear context, explicit role framing, unambiguous objectives, detailed step-by-step instructions, constraints/edge cases to avoid, and exact output schema/format.
2. Maximize model reasoning depth, precision, and avoid vague language.
3. Keep the prompt concise yet comprehensive and self-contained.
4. Return ONLY the enhanced prompt text itself. Do NOT include any intro ("Here is the enhanced prompt:"), meta-commentary, explanations, quotes, or markdown backticks enclosing the entire prompt.`;

      const provider = activeModelTab || 'antigravity';
      const enhancedText = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({
          type: 'quick_inference',
          messages: [
            { role: 'system', content: promptOptimizationInstruction },
            { role: 'user', content: `Enhance and optimize this prompt for peak LLM performance:\n\n${rawText}` },
          ],
          model: targetModel,
          explicitProvider: provider,
          temperature: 0.3,
          maxTokens: 4096,
        }, (res) => {
          if (chrome.runtime.lastError) {
            return reject(new Error(chrome.runtime.lastError.message));
          }
          if (res && res.success) {
            resolve(res.text?.trim());
          } else {
            reject(new Error(res?.error || 'Empty response from model'));
          }
        });
      });

      if (enhancedText && promptInput) {
        promptInput.value = enhancedText;
        handleInputStateChange();
        promptInput.focus();

        // Trigger beam animation highlight
        if (promptBeamContainer) {
          promptBeamContainer.style.boxShadow = '0 0 18px rgba(245, 158, 11, 0.6)';
          setTimeout(() => {
            promptBeamContainer.style.boxShadow = '';
          }, 1500);
        }

        showToast('✓ Prompt optimized for best performance!');
      } else {
        throw new Error('Empty response from model');
      }
    } catch (err) {
      console.warn('Prompt enhancement failed:', err);
      showToast(`Could not optimize prompt: ${err.message || 'Check provider API connection'}`);
    } finally {
      if (promptEnhanceBtn) {
        promptEnhanceBtn.disabled = false;
        promptEnhanceBtn.classList.remove('enhancing');
      }
    }
  }
})();

