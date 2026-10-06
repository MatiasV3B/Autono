/**
 * ChatGPT Style Side Panel Controller for Antigravity Agent
 * Manages ModelPicker popover, Zylo Context Tools, TinyFish Web Search, and SSE streaming with AntigravityBridge.
 */

import { searchWithTinyFish, formatTinyFishForPrompt } from '../lib/tinyfish.js';
import katex from './vendor/katex.mjs';
import { marked } from './vendor/marked.esm.js';

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

  const toggleSearchBtn = document.getElementById('toggleSearchBtn');
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
  let isSearchActive = false;
  let isCoworkActive = false;
  let attachedImageDataUrl = null;
  let currentStreamingBubble = null;
  let currentStreamingText = '';
  let currentCoworkBubble = null;
  let currentPlanData = null;
  let currentIntroText = '';
  let allSessions = [];
  let lastUserPrompt = '';
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
          id: 'gemini-2.5-flash',
          name: 'Gemini 2.5 Flash',
          desc: 'High-speed official Google Gemini model for rapid web and text analysis.',
          contextWindow: '1.0M tokens',
          metrics: { intelligence: 8, speed: 9, context: 10, efficiency: 8 },
          caps: ['reasoning', 'image'],
          thinking: ['low', 'medium', 'high'],
          defaultThinking: 'medium',
          usageGroup: 'gemini',
        },
        {
          id: 'gemini-2.5-pro',
          name: 'Gemini 2.5 Pro',
          desc: 'Supreme analytical depth and frontier reasoning from Google AI Studio.',
          contextWindow: '2.0M tokens',
          metrics: { intelligence: 9, speed: 4, context: 10, efficiency: 7 },
          caps: ['reasoning', 'image'],
          thinking: ['low', 'high'],
          defaultThinking: 'high',
          usageGroup: 'gemini',
        },
        {
          id: 'gemini-2.0-flash',
          name: 'Gemini 2.0 Flash',
          desc: 'Fast, lightweight multimodal model for instant web interactions.',
          contextWindow: '1.0M tokens',
          metrics: { intelligence: 8, speed: 9, context: 10, efficiency: 8 },
          caps: ['reasoning', 'image'],
          thinking: ['low', 'medium', 'high'],
          defaultThinking: 'medium',
          usageGroup: 'gemini',
        },
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
      iconSvg: `<img src="../assets/claude-icon-32.png" width="16" height="16" style="object-fit:contain;vertical-align:middle;border-radius:3px;" alt="Claude">`,
      models: [
        {
          id: 'claude-3-7-sonnet-20250219',
          name: 'Claude 3.7 Sonnet',
          desc: 'Anthropic hybrid reasoning model with state-of-the-art coding and extended thinking.',
          contextWindow: '200K tokens',
          metrics: { intelligence: 9, speed: 8, context: 8, efficiency: 7 },
          caps: ['reasoning', 'image'],
          thinking: ['low', 'medium', 'high', 'x-high', 'max'],
          defaultThinking: 'high',
          usageGroup: 'claude_gpt',
        },
        {
          id: 'claude-3-5-sonnet-20241022',
          name: 'Claude 3.5 Sonnet',
          desc: 'Frontier code generation, deep comprehension and multi-turn workflows.',
          contextWindow: '200K tokens',
          metrics: { intelligence: 8, speed: 8, context: 8, efficiency: 7 },
          caps: ['reasoning', 'image'],
          thinking: ['low', 'medium', 'high'],
          defaultThinking: 'medium',
          usageGroup: 'claude_gpt',
        },
        {
          id: 'claude-3-5-haiku-20241022',
          name: 'Claude 3.5 Haiku',
          desc: 'Instant-speed lightweight response for browser actions and quick chats.',
          contextWindow: '200K tokens',
          metrics: { intelligence: 7, speed: 9, context: 7, efficiency: 9 },
          caps: ['reasoning', 'image'],
          thinking: ['fast', 'thinking'],
          defaultThinking: 'fast',
          usageGroup: 'claude_gpt',
        },
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
          metrics: { intelligence: 9, speed: 3, context: 10, efficiency: 8 },
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
          metrics: { intelligence: 7, speed: 7, context: 8, efficiency: 6 },
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
        {
          id: 'claude-sonnet-4-6',
          name: 'Claude Sonnet 4.6',
          desc: 'Leader in SWE-bench, clean code architecture and structured system design.',
          contextWindow: '1.0M tokens',
          metrics: { intelligence: 8, speed: 7, context: 10, efficiency: 6 },
          caps: ['reasoning', 'image'],
          thinking: ['low', 'medium', 'high', 'x-high', 'max'],
          defaultThinking: 'high',
          usageGroup: 'claude_gpt',
        },
        {
          id: 'claude-opus-4-6-thinking',
          name: 'Claude Opus 4.6',
          desc: 'Advanced mathematical challenges, security audit and critical reasoning.',
          contextWindow: '1.0M tokens',
          metrics: { intelligence: 9, speed: 3, context: 10, efficiency: 8 },
          caps: ['reasoning', 'image'],
          thinking: ['low', 'medium', 'high', 'x-high', 'max'],
          defaultThinking: 'high',
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
          id: 'gpt-4o',
          name: 'GPT-4o',
          desc: 'Omni-model flagship for high-intelligence multimodal tasks and vision.',
          contextWindow: '128K tokens',
          metrics: { intelligence: 9, speed: 8, context: 7, efficiency: 7 },
          caps: ['reasoning', 'image'],
          thinking: ['low', 'medium', 'high'],
          defaultThinking: 'medium',
          usageGroup: 'claude_gpt',
        },
        {
          id: 'gpt-4o-mini',
          name: 'GPT-4o Mini',
          desc: 'Fast, cost-effective vision and text model for nimble navigation.',
          contextWindow: '128K tokens',
          metrics: { intelligence: 7, speed: 9, context: 7, efficiency: 9 },
          caps: ['reasoning', 'image'],
          thinking: ['low', 'medium', 'high'],
          defaultThinking: 'medium',
          usageGroup: 'claude_gpt',
        },
        {
          id: 'o3-mini',
          name: 'o3-mini',
          desc: 'Specialized STEM reasoning, competitive math and code generation.',
          contextWindow: '200K tokens',
          metrics: { intelligence: 9, speed: 7, context: 8, efficiency: 8 },
          caps: ['reasoning', 'image'],
          thinking: ['low', 'medium', 'high'],
          defaultThinking: 'high',
          usageGroup: 'claude_gpt',
        },
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
        {
          id: 'gpt-oss-120b-medium',
          name: 'GPT-OSS 120B',
          desc: 'Open source inference (MoE), unrestricted throughput, local edge deployment and total privacy.',
          contextWindow: '128K tokens',
          metrics: { intelligence: 6, speed: 2, context: 5, efficiency: 6 },
          caps: ['reasoning', 'image'],
          thinking: ['low', 'medium', 'high'],
          defaultThinking: 'medium',
          usageGroup: 'claude_gpt',
        },
      ],
    },
  };

  let activeProvider = 'gemini';
  let activeModelTab = 'antigravity'; // 'antigravity', 'claude', or 'openai'

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

    // Cap at a maximum of 5 suggestions as requested
    const finalSuggestions = cleanedSuggestions.slice(0, 5);

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

  // ─── AI Error Handler Component Helper (Structured SVG card with Code, Desc & Retry) ───
  function createAiErrorCard(rawError = '') {
    const errString = typeof rawError === 'string' ? rawError : (rawError?.message || JSON.stringify(rawError));
    let code = 'ERROR';
    let title = 'Inference Request Failed';
    let desc = errString;

    if (errString.includes('404')) {
      code = '404';
      title = 'Endpoint Not Found';
      desc = 'The endpoint or model called does not exist on the configured bridge. Verify your bridge URL or external provider settings and try again.';
    } else if (errString.includes('429')) {
      code = '429';
      title = 'Quota Exceeded';
      desc = 'You have exceeded your Antigravity or provider quota. Please wait a moment or try again later.';
    } else if (errString.includes('401') || errString.includes('403')) {
      code = '401';
      title = 'Authentication Error';
      desc = 'Invalid or expired API credentials. Please check your provider API key in settings.';
    } else if (errString.includes('Failed to fetch') || errString.includes('NetworkError')) {
      code = 'NET';
      title = 'Connection Refused';
      desc = 'Could not reach the local bridge server or external provider. Ensure Model Bridge is running locally at http://127.0.0.1:8765.';
    }

    return `
      <div class="ai-error-card">
        <div class="ai-error-header">
          <div class="ai-error-icon-wrap">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path>
              <line x1="12" y1="9" x2="12" y2="13"></line>
              <line x1="12" y1="17" x2="12.01" y2="17"></line>
            </svg>
          </div>
          <div class="ai-error-title-wrap">
            <span class="ai-error-code-badge">Error ${escapeHtml(code)}</span>
            <span class="ai-error-title">${escapeHtml(title)}</span>
          </div>
          <button type="button" class="ai-error-dismiss-btn" title="Dismiss">&times;</button>
        </div>
        <div class="ai-error-desc">${escapeHtml(desc)}</div>
        <div class="ai-error-actions">
          <button type="button" class="ai-error-retry-btn">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"></path>
              <path d="M21 3v5h-5"></path>
              <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"></path>
              <path d="M8 16H3v5"></path>
            </svg>
            <span>Retry Request</span>
          </button>
        </div>
      </div>
    `;
  }

  function attachErrorCardRetryListener(container) {
    if (!container) return;
    const retryBtn = container.querySelector('.ai-error-retry-btn');
    const dismissBtn = container.querySelector('.ai-error-dismiss-btn');
    const errorCard = container.querySelector('.ai-error-card');

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

      case 'bridge_status':
        updateBridgeStatus(msg.online);
        break;

      case 'quota_update':
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
    if (baseModelId === 'claude-sonnet-4-6') {
      return 'claude-sonnet-4-6';
    }
    if (baseModelId === 'claude-opus-4-6-thinking') {
      return 'claude-opus-4-6-thinking';
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
    return baseModelId;
  }

  function findModelByAnyId(modelId) {
    if (!modelId) return null;
    const clean = modelId.toLowerCase().trim();

    // Check direct base ID match
    for (const pKey of Object.keys(PROVIDER_DATA)) {
      const p = PROVIDER_DATA[pKey];
      const m = p.models.find((item) => item.id === clean);
      if (m) {
        return { model: m, provider: p, effort: m.defaultThinking || 'medium' };
      }
    }

    // Check external providers models
    for (const extP of externalProviders) {
      const m = (extP.models || []).find((item) => item.id === clean);
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

    // Check Claude Sonnet (5.5 / 4.6)
    if (clean.includes('sonnet')) {
      const p = PROVIDER_DATA.claude;
      const m = (clean.includes('4.6') || clean.includes('4-6'))
        ? p.models.find((x) => x.id === 'claude-sonnet-4-6')
        : p.models.find((x) => x.id === 'claude-sonnet-5-5') || p.models[0];
      return { model: m, provider: p, effort: m.defaultThinking || 'high' };
    }

    // Check Claude Opus (5.5 / 4.6)
    if (clean.includes('opus')) {
      const p = PROVIDER_DATA.claude;
      const m = (clean.includes('4.6') || clean.includes('4-6'))
        ? p.models.find((x) => x.id === 'claude-opus-4-6-thinking')
        : p.models.find((x) => x.id === 'claude-opus-5-5') || p.models[1];
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
            ? 'X-High'
            : (effort === 'thinking' ? 'Thinking' : (effort === 'max' ? 'Max' : effort.charAt(0).toUpperCase() + effort.slice(1))));
        selectedModelLabel.textContent = `${currentModelObj.name} (${effortTitle})`;
      }
    }

    chrome.storage.local.set({
      antigravity_base_model: currentBaseModelId,
      antigravity_thinking_effort: currentThinkingEffort,
      antigravity_default_model: currentModel,
    });
  }

  function isClaudeModel(modelId) {
    if (!modelId) return false;
    const s = String(modelId).toLowerCase();
    return s.includes('claude') || s.includes('fable') || s.includes('haiku') || s.includes('sonnet') || s.includes('opus');
  }

  function isOpenAIModel(modelId) {
    if (!modelId) return false;
    const s = String(modelId).toLowerCase();
    return s.includes('gpt') || s.includes('codex') || s.includes('o3') || s.includes('oss');
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
        welcomeAvatarImg.src = '../assets/claude-card.png';
        welcomeAvatarImg.alt = 'Claude';
      } else if (isOpenAI) {
        welcomeAvatarImg.src = '../assets/chatgpt-logo.svg';
        welcomeAvatarImg.alt = 'ChatGPT';
      } else {
        welcomeAvatarImg.src = '../assets/antigravity-card.png';
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

    // 3. Top Trigger Icon in Header (shows active provider/Autono)
    const trigIcon = document.getElementById('modelTriggerIcon');
    if (trigIcon) {
      if (isOpenAI) {
        trigIcon.innerHTML = `<img src="../assets/chatgpt-icon-32.png" width="16" height="16" style="object-fit:contain;vertical-align:middle;border-radius:4px;" alt="ChatGPT">`;
      } else if (isClaude) {
        trigIcon.innerHTML = `<img src="../assets/claude-card-32.png" width="16" height="16" style="object-fit:contain;vertical-align:middle;border-radius:4px;" alt="Claude">`;
      } else {
        trigIcon.innerHTML = `<img src="../assets/icon-32.png" width="16" height="16" style="object-fit:contain;vertical-align:middle;border-radius:4px;" alt="Autono">`;
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
  function selectModel(modelId, preserveEffort = false) {
    const match = findModelByAnyId(modelId);
    if (!match) return;

    const { model, provider, effort } = match;
    currentBaseModelId = model.id;
    activeProvider = provider.id;

    if (!preserveEffort && effort && model.thinking && model.thinking.includes(effort)) {
      currentThinkingEffort = effort;
    } else if (model.thinking && !model.thinking.includes(currentThinkingEffort)) {
      currentThinkingEffort = model.defaultThinking || model.thinking[0];
    }

    currentModel = resolveAntigravityModelId(currentBaseModelId, currentThinkingEffort);

    // Update category tab & rail active state
    if (isClaudeModel(model.id)) {
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
            ? 'X-High'
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
    // Grounded & balanced ratings: scalable up to 10
    const adjustedIntel = Math.min(10, Math.max(1, Math.round(baseIntel + delta)));
    const speed = Math.min(10, Math.max(1, Math.round(model.metrics?.speed || 6)));
    const context = model.metrics?.context || 6;
    const efficiency = Math.min(10, Math.max(1, Math.round(model.metrics?.efficiency ?? 6)));
    const contextWin = model.contextWindow || '1.0M tokens';
    const isClaudeFamily = isClaudeModel(model.id);
    const isOpenAIFamily = !isClaudeFamily && (model.id === 'gpt-oss-120b-medium' ? (model.usageGroup !== 'gemini' && activeModelTab !== 'antigravity') : isOpenAIModel(model.id));
    const providerName = isClaudeFamily ? 'Anthropic' : (isOpenAIFamily ? 'OpenAI' : 'Antigravity');

    const formatEffortLabel = (lvl) => {
      if (lvl === 'fast') return 'Fast';
      if (lvl === 'x-high') return 'X-High';
      if (lvl === 'thinking') return 'Thinking';
      if (lvl === 'max') return 'Max';
      return lvl.charAt(0).toUpperCase() + lvl.slice(1);
    };

    const radioButtonsHtml = thinkingList.map((lvl) => `
      <button type="button" class="seg-radio-btn ${lvl === activeEffort ? 'active' : ''}" data-effort="${lvl}">
        ${formatEffortLabel(lvl)}
      </button>
    `).join('');

    const isGptOss = model.id === 'gpt-oss-120b-medium';
    let engineModeHtml = '';
    if (isGptOss) {
      const gptOssMode = currentOpenaiMode === 'api' ? 'api' : 'desktop';
      engineModeHtml = `
        <div class="preview-config-section" style="margin-top:8px;">
          <div class="preview-config-label">EXECUTION ENGINE</div>
          <div class="preview-config-sub">Execution Mode (via OpenAI in API mode)</div>
          <div class="segmented-radio-group" id="previewGptOssModeGroup" style="display:grid;grid-template-columns:1fr 1fr;gap:4px;">
            <button type="button" class="seg-radio-btn engine-mode-toggle-btn ${gptOssMode !== 'api' ? 'active' : ''}" data-provider="openai" data-mode="desktop" title="Use local terminal execution (no API key required)">
              💻 Local Terminal
            </button>
            <button type="button" class="seg-radio-btn engine-mode-toggle-btn ${gptOssMode === 'api' ? 'active' : ''}" data-provider="openai" data-mode="api" title="Use OpenAI API directly with your OpenAI API Key (not available via Gemini API)">
              ⚡ OpenAI API
            </button>
          </div>
          <div style="font-size:9.5px;color:#a1a1aa;margin-top:4px;line-height:1.35;" id="gptOssModePreviewNote">
            ${gptOssMode === 'api'
              ? (currentOpenaiApiKey ? '🟢 OpenAI API mode active (OpenAI Key configured).' : '⚠️ OpenAI API selected without OpenAI API Key. Configure in Settings.')
              : '🟢 Local Terminal mode active (runs locally via CLI/terminal).'}
          </div>
        </div>
      `;
    } else if (isClaudeFamily) {
      engineModeHtml = `
        <div class="preview-config-section" style="margin-top:8px;">
          <div class="preview-config-label">EXECUTION ENGINE</div>
          <div class="preview-config-sub">Claude Mode</div>
          <div class="segmented-radio-group" id="previewClaudeModeGroup" style="display:grid;grid-template-columns:1fr 1fr;gap:4px;">
            <button type="button" class="seg-radio-btn engine-mode-toggle-btn ${currentClaudeMode !== 'api' ? 'active' : ''}" data-provider="claude" data-mode="desktop" title="Use local terminal with Claude Terminal (no API key required)">
              💻 Local Terminal
            </button>
            <button type="button" class="seg-radio-btn engine-mode-toggle-btn ${currentClaudeMode === 'api' ? 'active' : ''}" data-provider="claude" data-mode="api" title="Use official Anthropic API directly with your Anthropic API Key">
              ⚡ Claude API
            </button>
          </div>
          <div style="font-size:9.5px;color:#a1a1aa;margin-top:4px;line-height:1.35;" id="claudeModePreviewNote">
            ${currentClaudeMode === 'api'
              ? (currentAnthropicApiKey ? '🟢 Claude API mode active (Anthropic Key configured).' : '⚠️ Claude API selected without Anthropic API Key. Configure in Settings.')
              : '🟢 Local Terminal mode active (runs locally via CLI/terminal).'}
          </div>
        </div>
      `;
    } else if (isOpenAIFamily) {
      engineModeHtml = `
        <div class="preview-config-section" style="margin-top:8px;">
          <div class="preview-config-label">EXECUTION ENGINE</div>
          <div class="preview-config-sub">OpenAI Mode</div>
          <div class="segmented-radio-group" id="previewOpenaiModeGroup" style="display:grid;grid-template-columns:1fr 1fr;gap:4px;">
            <button type="button" class="seg-radio-btn engine-mode-toggle-btn ${currentOpenaiMode !== 'api' ? 'active' : ''}" data-provider="openai" data-mode="desktop" title="Use local terminal execution">
              💻 Local Terminal
            </button>
            <button type="button" class="seg-radio-btn engine-mode-toggle-btn ${currentOpenaiMode === 'api' ? 'active' : ''}" data-provider="openai" data-mode="api" title="Use official OpenAI API directly with your OpenAI API Key">
              ⚡ ChatGPT API
            </button>
          </div>
          <div style="font-size:9.5px;color:#a1a1aa;margin-top:4px;line-height:1.35;" id="openaiModePreviewNote">
            ${currentOpenaiMode === 'api'
              ? (currentOpenaiApiKey ? '🟢 ChatGPT API mode active (OpenAI Key configured).' : '⚠️ ChatGPT API selected without OpenAI API Key. Configure in Settings.')
              : '🟢 Local Terminal mode active (runs locally via Codex CLI).'}
          </div>
        </div>
      `;
    } else {
      engineModeHtml = `
        <div class="preview-config-section" style="margin-top:8px;">
          <div class="preview-config-label">EXECUTION ENGINE</div>
          <div class="preview-config-sub">Antigravity Mode</div>
          <div class="segmented-radio-group" id="previewAntigravityModeGroup" style="display:grid;grid-template-columns:1fr 1fr;gap:4px;">
            <button type="button" class="seg-radio-btn engine-mode-toggle-btn ${currentAntigravityMode !== 'api' ? 'active' : ''}" data-provider="antigravity" data-mode="desktop" title="Use local terminal via local bridge">
              💻 Local Terminal
            </button>
            <button type="button" class="seg-radio-btn engine-mode-toggle-btn ${currentAntigravityMode === 'api' ? 'active' : ''}" data-provider="antigravity" data-mode="api" title="Use Google Gemini API directly with your Gemini API Key">
              ⚡ Gemini API
            </button>
          </div>
          <div style="font-size:9.5px;color:#a1a1aa;margin-top:4px;line-height:1.35;" id="antigravityModePreviewNote">
            ${currentAntigravityMode === 'api'
              ? (currentGeminiApiKey ? '🟢 Gemini API mode active (Gemini Key configured).' : '⚠️ Gemini API selected without Google Gemini API Key. Configure in Settings.')
              : '🟢 Local Terminal mode active (runs locally via Bridge).'}
          </div>
        </div>
      `;
    }

    previewCard.innerHTML = `
      <div class="preview-panel-content">
        <div class="preview-header">
          <div class="preview-title-row">
            <span class="preview-model-name">${escapeHtml(model.name)}</span>
            <span class="preview-provider-tag">${providerName}</span>
          </div>
          <p class="preview-model-desc">${escapeHtml(model.desc || '')}</p>
        </div>

        <div class="preview-metrics-grid">
          ${renderMetricBarHtml('INTELLIGENCE', adjustedIntel)}
          ${renderMetricBarHtml('SPEED', speed)}
          ${renderMetricBarHtml('CONTEXT', context, `${contextWin} context window`)}
          ${renderMetricBarHtml('EFFICIENCY', efficiency, 'Eficiencia computacional y de procesamiento')}
        </div>

        <div class="preview-config-section">
          <div class="preview-config-label">CONFIGURATION</div>
          <div class="preview-config-sub">Reasoning</div>
          <div class="segmented-radio-group" style="display:grid;grid-template-columns:repeat(${thinkingList.length}, minmax(0, 1fr));width:100%;gap:4px;">
            ${radioButtonsHtml}
          </div>
        </div>
        ${engineModeHtml}
      </div>
    `;

    // Trigger the grow animation from bottom up on next tick!
    requestAnimationFrame(() => {
      previewCard.querySelectorAll('.grow-segment').forEach((el) => {
        el.classList.add('grown');
      });
    });

    // Wire up segmented radio buttons in the preview card
    previewCard.querySelectorAll('.seg-radio-btn[data-effort]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const nextEffort = btn.getAttribute('data-effort');
        if (model.id !== currentBaseModelId) {
          currentBaseModelId = model.id;
          activeProvider = model.usageGroup === 'gemini' ? 'gemini' : (isClaudeFamily ? 'claude' : 'chatgpt');
        }
        updateThinkingEffort(nextEffort);
        renderModelPickerRows(modelSearchInput.value);
        renderModelPreviewPanel(model, nextEffort);
      });
    });

    // Wire up Execution Engine buttons in preview card (Antigravity, Claude, OpenAI)
    previewCard.querySelectorAll('.engine-mode-toggle-btn').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const prov = btn.getAttribute('data-provider');
        const targetMode = btn.getAttribute('data-mode');
        const bridgeUrl = (settingBridgeUrl?.value?.trim() || 'http://127.0.0.1:8765').replace(/\/+$/, '');
        let configPayload = {};

        if (prov === 'claude') {
          currentClaudeMode = targetMode;
          if (settingClaudeMode) settingClaudeMode.value = targetMode;
          try { localStorage.setItem('antigravity_claude_mode', targetMode); } catch (_) {}
          if (chrome.storage && chrome.storage.local) {
            chrome.storage.local.get(['antigravity_settings'], (res) => {
              const prev = res.antigravity_settings || {};
              prev.claudeMode = targetMode;
              chrome.storage.local.set({ antigravity_settings: prev, antigravity_claude_mode: targetMode });
            });
          }
          configPayload.claude_mode = targetMode;
          if (targetMode === 'api') {
            if (!currentAnthropicApiKey) {
              showToast('⚠️ Claude API active. Configure Anthropic API Key in Settings');
            } else {
              showToast('⚡ Claude API active');
            }
          } else {
            showToast('💻 Local Terminal active');
          }
        } else if (prov === 'openai') {
          currentOpenaiMode = targetMode;
          if (settingOpenaiMode) settingOpenaiMode.value = targetMode;
          try { localStorage.setItem('antigravity_openai_mode', targetMode); } catch (_) {}
          if (chrome.storage && chrome.storage.local) {
            chrome.storage.local.get(['antigravity_settings'], (res) => {
              const prev = res.antigravity_settings || {};
              prev.openaiMode = targetMode;
              chrome.storage.local.set({ antigravity_settings: prev, antigravity_openai_mode: targetMode });
            });
          }
          configPayload.openai_mode = targetMode;
          if (targetMode === 'api') {
            if (!currentOpenaiApiKey) {
              showToast('⚠️ ChatGPT API active. Configure OpenAI Key in Settings');
            } else {
              showToast('⚡ ChatGPT API active');
            }
          } else {
            showToast('💻 Local Terminal active');
          }
        } else {
          // Antigravity
          currentAntigravityMode = targetMode;
          if (settingAntigravityMode) settingAntigravityMode.value = targetMode;
          try { localStorage.setItem('antigravity_antigravity_mode', targetMode); } catch (_) {}
          if (chrome.storage && chrome.storage.local) {
            chrome.storage.local.get(['antigravity_settings'], (res) => {
              const prev = res.antigravity_settings || {};
              prev.antigravityMode = targetMode;
              chrome.storage.local.set({ antigravity_settings: prev, antigravity_antigravity_mode: targetMode });
            });
          }
          configPayload.antigravity_mode = targetMode;
          if (targetMode === 'api') {
            if (!currentGeminiApiKey) {
              showToast('⚠️ Gemini API active. Configure Gemini Key in Settings');
            } else {
              showToast('⚡ Gemini API active');
            }
          } else {
            showToast('💻 Local Terminal active');
          }
        }

        fetch(`${bridgeUrl}/api/config`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(configPayload)
        }).catch(() => null);

        renderModelPreviewPanel(model, effort);
      });
    });
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
        modelsToRender = PROVIDER_DATA.claude.models;
      } else if (activeModelTab === 'openai') {
        // OpenAI tab: all OpenAI models (Codex, GPT-4o, o3-mini, GPT-OSS)
        modelsToRender = PROVIDER_DATA.chatgpt.models;
      } else {
        // Antigravity models tab: Gemini + older Claude models (Sonnet 4.6, Opus 4.6)
        const olderClaudeModels = PROVIDER_DATA.claude.models.filter((m) =>
          ['claude-sonnet-4-6', 'claude-opus-4-6-thinking'].includes(m.id)
        );
        modelsToRender = [
          ...PROVIDER_DATA.gemini.models,
          ...olderClaudeModels,
        ];
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
      const row = document.createElement('div');
      const isSelected = m.id === currentBaseModelId;
      row.className = `model-row ${isSelected ? 'selected' : ''}`;
      row.setAttribute('data-model', m.id);

      row.innerHTML = `
        <div class="model-row-header">
          <div class="model-row-info">
            <div class="model-row-title">
              <span>${escapeHtml(m.name)}</span>
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
        selectModel(m.id);
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
    modelPickerTrigger.classList.add('open');
    modelPickerPopover.classList.remove('hidden');
    if (isClaudeModel(currentBaseModelId)) {
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

  // Reload Models from Cloud APIs & Bridge Button
  const refreshModelsBtn = document.getElementById('refreshModelsBtn');
  if (refreshModelsBtn) {
    refreshModelsBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      refreshModelsBtn.classList.add('spinning');
      const bridgeUrl = (settingBridgeUrl?.value?.trim() || 'http://127.0.0.1:8765').replace(/\/+$/, '');
      let loadedFromCloud = false;

      // 1. Fetch Google Gemini models directly via Google AI Studio API if API Key is configured
      const geminiKey = (settingGeminiApiKey?.value || currentGeminiApiKey || '').trim();
      if (geminiKey) {
        try {
          const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${geminiKey}`, {
            signal: AbortSignal.timeout(6000),
          });
          if (res.ok) {
            const data = await res.json();
            const models = data.models || [];
            models.forEach((m) => {
              const name = (m.name || '').replace('models/', '');
              if (!name) return;
              if (name.includes('gemini')) {
                const exists = PROVIDER_DATA.gemini.models.some(x => x.id === name);
                if (!exists) {
                  PROVIDER_DATA.gemini.models.push({
                    id: name,
                    name: m.displayName || name,
                    desc: m.description || 'Google Gemini Direct Cloud Model',
                    contextWindow: `${Math.round((m.inputTokenLimit || 1000000) / 1000)}K tokens`,
                    metrics: { intelligence: 8, speed: 8, context: 10, efficiency: 7 },
                    caps: ['reasoning', 'image'],
                    thinking: ['low', 'medium', 'high'],
                    defaultThinking: 'medium',
                    usageGroup: 'gemini',
                  });
                }
              }
            });
            loadedFromCloud = true;
          }
        } catch (geminiErr) {
          console.log('Direct Gemini models fetch note:', geminiErr);
        }
      }

      // 2. Fetch OpenAI models directly if OpenAI API Key is configured
      const openaiKey = (settingOpenaiApiKey?.value || currentOpenaiApiKey || '').trim();
      if (openaiKey) {
        try {
          const res = await fetch('https://api.openai.com/v1/models', {
            headers: { Authorization: `Bearer ${openaiKey}` },
            signal: AbortSignal.timeout(6000),
          });
          if (res.ok) {
            const data = await res.json();
            const list = data.data || [];
            list.filter(m => m.id && (m.id.startsWith('gpt-') || m.id.startsWith('o1') || m.id.startsWith('o3'))).forEach((m) => {
              const exists = PROVIDER_DATA.chatgpt.models.some(x => x.id === m.id);
              if (!exists) {
                PROVIDER_DATA.chatgpt.models.push({
                  id: m.id,
                  name: m.id.toUpperCase(),
                  desc: 'OpenAI Direct Cloud Model',
                  contextWindow: '128K tokens',
                  metrics: { intelligence: 8, speed: 8, context: 8, efficiency: 7 },
                  caps: ['reasoning', 'image'],
                  thinking: ['low', 'medium', 'high'],
                  defaultThinking: 'medium',
                  usageGroup: 'claude_gpt',
                });
              }
            });
            loadedFromCloud = true;
          }
        } catch (openaiErr) {
          console.log('Direct OpenAI models fetch note:', openaiErr);
        }
      }

      // 3. Also check Local Bridge if running
      let bridgeSucceeded = false;
      try {
        fetch(`${bridgeUrl}/api/models/refresh`, { method: 'POST', signal: AbortSignal.timeout(4000) }).catch(() => null);
        const res = await fetch(`${bridgeUrl}/v1/models`, { signal: AbortSignal.timeout(4000) });
        if (res.ok) {
          const data = await res.json();
          const fetchedList = data.data || data.models || [];
          if (Array.isArray(fetchedList) && fetchedList.length > 0) {
            fetchedList.forEach((m) => {
              const mId = m.id || m.model || m;
              if (typeof mId !== 'string') return;
              const isClaude = isClaudeModel(mId);
              const isOpenAI = isOpenAIModel(mId);
              const targetGroup = isClaude ? PROVIDER_DATA.claude.models : (isOpenAI ? PROVIDER_DATA.chatgpt.models : PROVIDER_DATA.gemini.models);
              const exists = targetGroup.some(x => x.id === mId);
              if (!exists) {
                targetGroup.push({
                  id: mId,
                  name: m.name || m.display_name || mId,
                  desc: m.description || `Dynamic model loaded from ${isClaude ? 'Claude' : (isOpenAI ? 'OpenAI / Codex' : 'Antigravity')}`,
                  contextWindow: m.context_window || '1.0M tokens',
                  metrics: { intelligence: 8, speed: 7, context: 8, efficiency: 7 },
                  caps: ['reasoning', 'image'],
                  thinking: ['low', 'medium', 'high'],
                  defaultThinking: 'medium',
                  usageGroup: isClaude || isOpenAI ? 'claude_gpt' : 'gemini',
                });
              }
            });
            bridgeSucceeded = true;
          }
        }
      } catch (bridgeErr) {
        // Bridge is offline; perfectly normal when using Direct APIs
      } finally {
        setTimeout(() => {
          refreshModelsBtn.classList.remove('spinning');
        }, 400);
        renderModelPickerRows(modelSearchInput.value);
      }

      if (bridgeSucceeded && loadedFromCloud) {
        showToast('✅ Modelos actualizados desde APIs en la nube y Bridge');
      } else if (bridgeSucceeded) {
        showToast('✅ Modelos actualizados desde Local Bridge');
      } else if (loadedFromCloud) {
        showToast('✅ Modelos actualizados directamente desde APIs en la nube');
      } else {
        showToast('✅ Catálogo de modelos listo');
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
  toggleSearchBtn.addEventListener('click', () => {
    isSearchActive = !isSearchActive;
    toggleSearchBtn.classList.toggle('active', isSearchActive);
  });

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

    lastUserPrompt = text;
    lastAttachedItems = Array.isArray(attachedItems) ? [...attachedItems] : [];
    lastSearchSources = [];

    // If Search is active, perform TinyFish search!
    if (isSearchActive && text) {
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

    const effectiveProvider = isClaudeModel(currentModel)
      ? 'claude'
      : (isOpenAIModel(currentModel) ? 'openai' : (activeModelTab || 'antigravity'));

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
        avatar.innerHTML = `<img src="../assets/claude-card-32.png" width="18" height="18" alt="Claude">`;
      } else if (isOpenAI) {
        avatar.innerHTML = `<img src="../assets/chatgpt-icon-32.png" width="18" height="18" alt="ChatGPT">`;
      } else {
        avatar.innerHTML = `<img src="../assets/antigravity-card-32.png" width="18" height="18" alt="Antigravity">`;
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
    if (isGeneric && lastUserPrompt) {
      const smartTitle = generateSmartTitle(lastUserPrompt, answerText);
      if (smartTitle && smartTitle !== 'New Chat' && smartTitle !== 'Nuevo Chat') {
        showTitleSuggestionBanner(smartTitle);
      }
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
      settingBridgeUrl.value = s.bridgeUrl || 'http://127.0.0.1:8765';
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
      desc: 'Coordinate multi-agent workflow for parallel tasks',
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

    let convTokens = 0;
    const activeSession = allSessions.find((s) => s.id === currentSessionId);
    if (activeSession && Array.isArray(activeSession.messages)) {
      activeSession.messages.forEach((m) => {
        const text = (m.content || '') + (m.intro || '') + (m.summary || '');
        convTokens += Math.round(text.length / 4);
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

    const pctBadge = document.getElementById('meterPercentBadge');
    if (pctBadge) {
      pctBadge.textContent = `${(fraction * 100).toFixed(1)}%`;
    }

    const meterTotalUsed = document.getElementById('meterTotalUsed');
    if (meterTotalUsed) {
      meterTotalUsed.textContent = `${formatTokens(used)} / ${formatTokens(limit)}`;
    }

    if (meterSysTokens) meterSysTokens.textContent = formatTokens(sysTokens);
    if (meterPageTokens) meterPageTokens.textContent = formatTokens(pageTokens);
    if (meterFileTokens) meterFileTokens.textContent = formatTokens(fileTokens);
    if (meterConvTokens) meterConvTokens.textContent = formatTokens(convTokens);
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
          latestModelSuggestions = parsed.filter(s => typeof s === 'string' && s.trim().length > 0).slice(0, 5);
        }
      } catch (_) {
        // Handle newline separated or non-strict json
        const lines = rawSuggestions.split('\n')
          .map(l => l.replace(/^[\s*"-]+/, '').replace(/["',]+$/, '').trim())
          .filter(l => l.length > 3 && !l.startsWith('[') && !l.startsWith(']'));
        if (lines.length > 0) {
          latestModelSuggestions = lines.slice(0, 5);
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

