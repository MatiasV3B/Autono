/**
 * Antigravity Agent - Background Service Worker
 * Manages AntigravityBridge connection, Chat & Cowork execution, background tasks, and session persistence.
 */

const DEFAULT_BRIDGE_URL = 'http://127.0.0.1:8000';
const DEFAULT_MODEL = 'gemini-3.8-flash-medium';

const PRELOADED_MODELS = [
  { id: 'gemini-3.8-flash-medium', name: 'Gemini 3.8 Flash (Medium)' },
  { id: 'gemini-3.8-flash-high', name: 'Gemini 3.8 Flash (High)' },
  { id: 'gemini-3.8-flash-low', name: 'Gemini 3.8 Flash (Low)' },
  { id: 'gemini-3.7-flash-medium', name: 'Gemini 3.7 Flash (Medium)' },
  { id: 'gemini-3.7-flash-high', name: 'Gemini 3.7 Flash (High)' },
  { id: 'gemini-3.7-flash-low', name: 'Gemini 3.7 Flash (Low)' },
  { id: 'gemini-3.6-flash-medium', name: 'Gemini 3.6 Flash (Medium)' },
  { id: 'gemini-3.6-flash-high', name: 'Gemini 3.6 Flash (High)' },
  { id: 'gemini-3.6-flash-low', name: 'Gemini 3.6 Flash (Low)' },
  { id: 'gemini-3.1-pro-high', name: 'Gemini 3.1 Pro (High)' },
  { id: 'gemini-3.1-pro-low', name: 'Gemini 3.1 Pro (Low)' },
  { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6 (Thinking)' },
  { id: 'claude-opus-4-6-thinking', name: 'Claude Opus 4.6 (Thinking)' },
  { id: 'gpt-oss-120b-medium', name: 'GPT-OSS 120B (Medium)' },
];

// In-memory state for fast access & live connections
let activePorts = new Set();
let bridgeOnline = false;
let availableModels = [...PRELOADED_MODELS];
let cachedCliQuota = null;
let runningTask = null; // { taskId, mode, tabId, status, abortController, steps: [] }

// ─── Setup Side Panel Behavior ──────────────────────────────────────────────
if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(console.error);
}

async function getSettings() {
  const data = await chrome.storage.local.get([
    'antigravity_settings',
    'antigravity_antigravity_mode',
    'antigravity_gemini_api_key',
    'antigravity_claude_mode',
    'antigravity_anthropic_api_key',
    'antigravity_openai_mode',
    'antigravity_openai_api_key',
    'autono_local_mcp_bridge_enabled',
  ]);
  const s = data.antigravity_settings || {};
  return {
    bridgeUrl: s.bridgeUrl || DEFAULT_BRIDGE_URL,
    selectedModel: s.selectedModel || DEFAULT_MODEL,
    localMcpBridgeEnabled: s.localMcpBridgeEnabled !== undefined ? s.localMcpBridgeEnabled : (data.autono_local_mcp_bridge_enabled !== undefined ? Boolean(data.autono_local_mcp_bridge_enabled) : false),
    antigravityMode: s.antigravityMode || data.antigravity_antigravity_mode || 'desktop',
    geminiApiKey: s.geminiApiKey || data.antigravity_gemini_api_key || '',
    claudeMode: s.claudeMode || data.antigravity_claude_mode || 'desktop',
    anthropicApiKey: s.anthropicApiKey || data.antigravity_anthropic_api_key || '',
    openaiMode: s.openaiMode || data.antigravity_openai_mode || 'desktop',
    openaiApiKey: s.openaiApiKey || data.antigravity_openai_api_key || '',
    temperature: s.temperature !== undefined ? s.temperature : 0.2,
    autoCaptureScreenshot: !!s.autoCaptureScreenshot,
    maxSteps: s.maxSteps || 30,
    maxOutputTokens: s.maxOutputTokens || 65536,
    displayMode: s.displayMode || 'side_panel',
    shadowEnabled: s.shadowEnabled !== undefined ? s.shadowEnabled : true,
    shadowPreventSleep: s.shadowPreventSleep !== undefined ? s.shadowPreventSleep : true,
    shadowAutoWake: s.shadowAutoWake !== undefined ? s.shadowAutoWake : true,
    shadowOnComplete: s.shadowOnComplete || 'sleep',
    tabGrouping: s.tabGrouping !== undefined ? s.tabGrouping : true,
    workingOverlay: s.workingOverlay !== undefined ? s.workingOverlay : true,
    tabLockedSidebar: s.tabLockedSidebar !== undefined ? s.tabLockedSidebar : false,
    waitMessageSentOutInstantly: s.waitMessageSentOutInstantly !== undefined ? s.waitMessageSentOutInstantly : true,
  };
}

async function getExternalProviders() {
  try {
    const data = await chrome.storage.local.get('antigravity_external_providers');
    return Array.isArray(data.antigravity_external_providers) ? data.antigravity_external_providers : [];
  } catch {
    return [];
  }
}

function getProviderModes(modelName, settings) {
  const isClaude = typeof modelName === 'string' && (modelName.toLowerCase().includes('claude') || modelName.toLowerCase().includes('opus') || modelName.toLowerCase().includes('sonnet') || modelName.toLowerCase().includes('haiku') || modelName.toLowerCase().includes('fable'));
  const isGptOss = typeof modelName === 'string' && modelName.toLowerCase().includes('oss');
  const isGemini = !isClaude && !isGptOss && typeof modelName === 'string' && modelName.toLowerCase().includes('gemini');

  return {
    antigravity_mode: isGemini ? (settings.antigravityMode || 'desktop') : 'desktop',
    gemini_api_key: isGemini ? (settings.geminiApiKey || undefined) : undefined,
    claude_mode: isClaude ? (settings.claudeMode || 'desktop') : undefined,
    anthropic_api_key: isClaude ? (settings.anthropicApiKey || undefined) : undefined,
    api_key: isClaude ? (settings.anthropicApiKey || undefined) : undefined,
    openai_mode: (!isClaude && !isGemini) ? (settings.openaiMode || 'desktop') : undefined,
    openai_api_key: (!isClaude && !isGemini) ? (settings.openaiApiKey || undefined) : undefined,
  };
}

async function resolveInferenceEndpoint(modelName, defaultBase) {
  const settings = await getSettings();
  if (!modelName) {
    const headers = { 'Content-Type': 'application/json', 'Authorization': 'Bearer sk-antigravity' };
    if (settings.antigravityMode) headers['x-antigravity-mode'] = settings.antigravityMode;
    if (settings.geminiApiKey) headers['x-gemini-key'] = settings.geminiApiKey;
    if (settings.claudeMode) headers['x-claude-mode'] = settings.claudeMode;
    if (settings.anthropicApiKey) headers['x-api-key'] = settings.anthropicApiKey;
    if (settings.openaiMode) headers['x-openai-mode'] = settings.openaiMode;
    if (settings.openaiApiKey) headers['x-openai-key'] = settings.openaiApiKey;
    return { url: `${defaultBase}/v1/chat/completions`, headers, model: DEFAULT_MODEL };
  }
  const extProviders = await getExternalProviders();
  for (const prov of extProviders) {
    const hasModel = (prov.models || []).some(m => m.id === modelName);
    if (hasModel || modelName.startsWith(`${prov.id}:`)) {
      const actualModel = modelName.includes(':') ? modelName.split(':')[1] : modelName;
      const cleanBase = (prov.baseUrl || '').replace(/\/+$/, '');
      const url = cleanBase.endsWith('/v1') ? `${cleanBase}/chat/completions` : `${cleanBase}/v1/chat/completions`;
      const headers = { 'Content-Type': 'application/json' };
      if (prov.apiKey) {
        headers['Authorization'] = `Bearer ${prov.apiKey}`;
      }
      return { url, headers, model: actualModel };
    }
  }
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer sk-antigravity',
  };
  const isClaude = typeof modelName === 'string' && (modelName.toLowerCase().includes('claude') || modelName.toLowerCase().includes('opus') || modelName.toLowerCase().includes('sonnet') || modelName.toLowerCase().includes('haiku') || modelName.toLowerCase().includes('fable'));
  const isGptOss = typeof modelName === 'string' && modelName.toLowerCase().includes('oss');
  const isGemini = !isClaude && !isGptOss && typeof modelName === 'string' && modelName.toLowerCase().includes('gemini');

  if (isGemini) {
    if (settings.antigravityMode) headers['x-antigravity-mode'] = settings.antigravityMode;
    if (settings.geminiApiKey) headers['x-gemini-key'] = settings.geminiApiKey;
  }
  if (isClaude) {
    if (settings.claudeMode) headers['x-claude-mode'] = settings.claudeMode;
    if (settings.anthropicApiKey) headers['x-api-key'] = settings.anthropicApiKey;
  }
  if (!isClaude && !isGemini) {
    if (settings.openaiMode) headers['x-openai-mode'] = settings.openaiMode;
    if (settings.openaiApiKey) headers['x-openai-key'] = settings.openaiApiKey;
  }

  return {
    url: `${defaultBase}/v1/chat/completions`,
    headers,
    model: modelName,
  };
}

// ─── Dynamic Extension Action Icon ──────────────────────────────────────────
function updateExtensionIcon(modelId) {
  const isClaude = typeof modelId === 'string' && modelId.toLowerCase().includes('claude');
  const path = isClaude ? {
    "16": "assets/claude-icon-16.png",
    "32": "assets/claude-icon-32.png",
    "48": "assets/claude-icon-48.png",
    "128": "assets/claude-icon-128.png"
  } : {
    "16": "assets/icon-16.png",
    "32": "assets/icon-32.png",
    "48": "assets/icon-48.png",
    "128": "assets/icon-128.png"
  };
  try {
    if (chrome.action && chrome.action.setIcon) {
      chrome.action.setIcon({ path }, () => {
        if (chrome.runtime.lastError) { /* ignore */ }
      });
    }
  } catch (err) {
    console.warn('Could not set extension icon:', err);
  }
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local') {
    if (changes.antigravity_base_model) {
      updateExtensionIcon(changes.antigravity_base_model.newValue);
    } else if (changes.antigravity_default_model) {
      updateExtensionIcon(changes.antigravity_default_model.newValue);
    }
  }
});

// ─── Context Menu (Right-Click: Ask Autono Anywhere) ────────────────────────
function setupContextMenus() {
  try {
    if (!chrome.contextMenus) return;
    chrome.contextMenus.removeAll(() => {
      chrome.contextMenus.create({
        id: 'antigravity_ask_page',
        title: 'Ask Autono',
        contexts: ['page', 'frame', 'link', 'image', 'selection']
      });
    });
  } catch (err) {
    console.warn('Context menu setup error:', err);
  }
}

chrome.runtime.onInstalled.addListener(() => {
  setupContextMenus();
  chrome.storage.local.get(['antigravity_base_model', 'antigravity_default_model'], (data) => {
    updateExtensionIcon(data?.antigravity_base_model || data?.antigravity_default_model || DEFAULT_MODEL);
  });
});

chrome.runtime.onStartup.addListener(() => {
  setupContextMenus();
  chrome.storage.local.get(['antigravity_base_model', 'antigravity_default_model'], (data) => {
    updateExtensionIcon(data?.antigravity_base_model || data?.antigravity_default_model || DEFAULT_MODEL);
  });
});

chrome.contextMenus?.onClicked?.addListener(async (info, tab) => {
  if (info.menuItemId === 'antigravity_ask_page' && tab?.id) {
    if (chrome.sidePanel && chrome.sidePanel.open) {
      await chrome.sidePanel.open({ tabId: tab.id }).catch(() => null);
    }
    broadcastMessage({
      type: 'CONTEXT_MENU_ASK_ANTIGRAVITY',
      tabId: tab.id,
      pageUrl: tab.url,
      pageTitle: tab.title,
      selectionText: info.selectionText || '',
    });
  }
});

// ─── Tab Grouping & Working Overlay Helpers ─────────────────────────────────
let currentAgentGroupId = null;

const TAB_GROUP_COLORS = ['cyan', 'purple', 'blue', 'orange', 'green', 'pink', 'yellow', 'red', 'grey'];

function pickGroupColorAndTitle(goalText) {
  const g = (goalText || '').toLowerCase();
  let color = 'blue';
  let title = 'Antigravity Work';

  if (g.includes('flight') || g.includes('travel') || g.includes('hotel') || g.includes('map') || g.includes('trip')) {
    color = 'cyan';
    title = 'Travel & Flights';
  } else if (g.includes('code') || g.includes('github') || g.includes('repo') || g.includes('pull') || g.includes('bug') || g.includes('commit') || g.includes('dev')) {
    color = 'purple';
    title = 'Dev & Code';
  } else if (g.includes('buy') || g.includes('shop') || g.includes('amazon') || g.includes('price') || g.includes('order') || g.includes('cart')) {
    color = 'orange';
    title = 'Shopping & Orders';
  } else if (g.includes('search') || g.includes('google') || g.includes('find') || g.includes('research') || g.includes('read')) {
    color = 'green';
    title = 'Research & Web';
  } else if (g.includes('youtube') || g.includes('music') || g.includes('video') || g.includes('media') || g.includes('stream')) {
    color = 'red';
    title = 'Media & Video';
  } else if (g.includes('design') || g.includes('figma') || g.includes('css') || g.includes('ui') || g.includes('color')) {
    color = 'pink';
    title = 'Design & UI';
  } else if (g.includes('mail') || g.includes('email') || g.includes('inbox') || g.includes('message')) {
    color = 'yellow';
    title = 'Email & Messages';
  } else {
    // Pick based on hash of goalText
    let hash = 0;
    for (let i = 0; i < g.length; i++) hash = (hash * 31 + g.charCodeAt(i)) & 0xffffffff;
    color = TAB_GROUP_COLORS[Math.abs(hash) % TAB_GROUP_COLORS.length];
    const words = (goalText || '').replace(/^\/\S+\s*/, '').trim().split(/\s+/).slice(0, 3).join(' ');
    title = words ? (words.charAt(0).toUpperCase() + words.slice(1)) : 'Antigravity Task';
  }

  return { color, title: title.slice(0, 24) };
}

async function handleAutoTabGrouping(tabId, goalText = '') {
  try {
    const settings = await getSettings();
    if (!settings.tabGrouping) return null;
    if (!chrome.tabs.group) return null;
    const tab = await chrome.tabs.get(tabId).catch(() => null);
    if (!tab) return null;

    const { color, title } = pickGroupColorAndTitle(goalText);

    let groupId = tab.groupId;
    if (!groupId || groupId === -1) {
      groupId = await chrome.tabs.group({ tabIds: [tabId] });
      await chrome.tabGroups.update(groupId, {
        title,
        color,
      });
    } else {
      // Update existing group with the AI selected title & color
      await chrome.tabGroups.update(groupId, {
        title,
        color,
      }).catch(() => null);
    }
    currentAgentGroupId = groupId;
    return groupId;
  } catch (err) {
    console.warn('Auto tab grouping error:', err);
    return null;
  }
}

async function triggerWorkOverlay(tabId, show = true, title = 'Antigravity is working') {
  try {
    const settings = await getSettings();
    if (!settings.workingOverlay && show) return;
    const cleanTitle = (title || 'Antigravity is working').replace(/^Code:\s*/i, '');
    await chrome.tabs.sendMessage(tabId, {
      type: show ? 'SHOW_WORK_OVERLAY' : 'HIDE_WORK_OVERLAY',
      title: cleanTitle
    }).catch(() => null);
  } catch (err) {
    console.warn('Work overlay trigger error:', err);
  }
}

// Persist overlay across link clicks, page navigations, and redirects during active cowork task
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  try {
    if (!runningTask || runningTask.status !== 'running' || runningTask.tabId !== tabId) return;

    if (changeInfo.status === 'complete') {
      const settings = await getSettings();
      if (settings.workingOverlay) {
        // Re-inject domExtractor and buildDomTree into new page
        await chrome.scripting.executeScript({
          target: { tabId },
          files: ['domExtractor.js', 'buildDomTree.js'],
        }).catch(() => null);

        // Restore overlay on newly loaded page
        await triggerWorkOverlay(tabId, true, runningTask.overlayTitle || 'Antigravity is working');
      }
    }
  } catch (err) {
    console.warn('Tab onUpdated overlay re-injection error:', err);
  }
});

// Tab-Locked Sidebar listener (auto closes/hides when navigating to unrelated tabs ONLY during active Cowork tasks)
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const activeTabId = activeInfo.tabId;
    const settings = await getSettings();
    const activeTab = await chrome.tabs.get(activeTabId).catch(() => null);

    // Chat mode or idle mode: ensure sidePanel stays enabled for all tabs and NEVER close it!
    const isCoworkActive = runningTask && runningTask.mode === 'cowork' && (runningTask.status === 'running' || runningTask.status === 'paused');

    if (!isCoworkActive || !runningTask?.tabId) {
      // In chat mode or when no cowork task is active, side panel remains fully accessible and never auto-closes
      if (chrome.sidePanel?.setOptions) {
        await chrome.sidePanel.setOptions({
          tabId: activeTabId,
          enabled: true,
          path: 'side-panel/index.html',
        }).catch(() => null);
      }
      return;
    }

    // Active Cowork task logic:
    const workTabId = runningTask.tabId;
    const isSameTab = activeTabId === workTabId;
    const isSameGroup = currentAgentGroupId && activeTab?.groupId === currentAgentGroupId;

    if (isSameTab || isSameGroup) {
      // Returned to cowork tab or cowork tab group: re-enable overlay and side panel
      triggerWorkOverlay(activeTabId, true, runningTask.overlayTitle || 'Antigravity is working');
      if (chrome.sidePanel?.setOptions) {
        await chrome.sidePanel.setOptions({
          tabId: activeTabId,
          enabled: true,
          path: 'side-panel/index.html',
        }).catch(() => null);
      }
      if (chrome.sidePanel?.open) {
        chrome.sidePanel.open({ tabId: activeTabId })
          .catch(() => activeTab?.windowId ? chrome.sidePanel.open({ windowId: activeTab.windowId }).catch(() => null) : null);
      }
    } else {
      // Navigated to an unrelated tab during active Cowork task:
      // Only close if user explicitly enabled tabLockedSidebar in settings
      if (settings.tabLockedSidebar) {
        if (chrome.sidePanel?.setOptions) {
          chrome.sidePanel.setOptions({
            tabId: activeTabId,
            enabled: false,
          }).catch(() => null);
        }
        if (chrome.sidePanel?.close) {
          chrome.sidePanel.close({ windowId: activeTab?.windowId }).catch(() => null);
        }
        broadcastMessage({ type: 'close_side_panel_for_tab', tabId: activeTabId });
      }
    }
  } catch (err) {
    console.warn('Tab-locked sidebar error:', err);
  }
});

// When working tab is closed -> pause task, save tab link, and pause chat
chrome.tabs.onRemoved.addListener(async (closedTabId) => {
  try {
    if (!runningTask || runningTask.tabId !== closedTabId) return;

    const savedUrl = runningTask.lastKnownUrl || 'https://google.com';
    runningTask.status = 'paused';
    runningTask.pausedReason = 'tab_closed';
    runningTask.savedTabUrl = savedUrl;

    if (runningTask.stepWaitResolver) {
      runningTask.stepWaitResolver('tab_closed');
    }

    const notice = `⏸ **Chat paused:** The linked tab was closed. Saved URL: ${savedUrl}\nYou can resume the session to reopen the tab and continue.`;
    await appendMessageToSession(runningTask.sessionId, {
      role: 'assistant',
      content: notice,
      timestamp: Date.now(),
      mode: 'cowork',
      isPausedNotice: true,
      savedUrl,
    });

    broadcastMessage({
      type: 'cowork_task_paused',
      taskId: runningTask.taskId,
      sessionId: runningTask.sessionId,
      reason: 'tab_closed',
      savedUrl,
    });
  } catch (err) {
    console.warn('Error handling tab onRemoved:', err);
  }
});

// User intervention handling (intervene while agent works, immediate vs queued)
function handleUserIntervention(text) {
  if (!runningTask || runningTask.status !== 'running') return;
  if (!runningTask.pendingInterventions) runningTask.pendingInterventions = [];
  runningTask.pendingInterventions.push(text);

  broadcastMessage({
    type: 'user_intervention_received',
    text,
    taskId: runningTask.taskId,
    sessionId: runningTask.sessionId,
  });

  getSettings().then((settings) => {
    if (settings.waitMessageSentOutInstantly) {
      // If "Wait message sent out instantly" is ON:
      // If waiting in sleep/wait, wake it up immediately!
      if (runningTask.stepWaitResolver) {
        runningTask.stepWaitResolver('instant_intervention');
      }
    }
  }).catch(() => null);
}

async function pauseCoworkTask(reason = 'user_pause') {
  if (!runningTask || runningTask.status !== 'running') return;
  runningTask.status = 'paused';
  runningTask.pausedReason = reason;
  runningTask.savedTabUrl = runningTask.lastKnownUrl || 'https://google.com';

  if (runningTask.tabId) {
    await triggerWorkOverlay(runningTask.tabId, false).catch(() => null);
  }

  if (runningTask.stepWaitResolver) {
    runningTask.stepWaitResolver('paused');
  }

  broadcastMessage({
    type: 'cowork_task_paused',
    taskId: runningTask.taskId,
    sessionId: runningTask.sessionId,
    reason,
    savedUrl: runningTask.savedTabUrl,
  });
}

async function resumeCoworkTask() {
  if (!runningTask) return;
  if (runningTask.status !== 'paused') return;

  const urlToOpen = runningTask.savedTabUrl || runningTask.lastKnownUrl || 'https://google.com';

  let tabToUse = null;
  if (runningTask.tabId) {
    tabToUse = await chrome.tabs.get(runningTask.tabId).catch(() => null);
  }

  if (!tabToUse || isRestrictedUrl(tabToUse.url)) {
    const newTab = await chrome.tabs.create({ url: urlToOpen, active: true });
    runningTask.tabId = newTab.id;
    await new Promise((resolve) => {
      const listener = (tid, changeInfo) => {
        if (tid === newTab.id && changeInfo.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(listener);
          resolve();
        }
      };
      chrome.tabs.onUpdated.addListener(listener);
      setTimeout(resolve, 4000);
    });
  } else {
    await chrome.tabs.update(runningTask.tabId, { active: true }).catch(() => null);
  }

  runningTask.status = 'running';
  runningTask.pausedReason = null;

  await chrome.scripting.executeScript({
    target: { tabId: runningTask.tabId },
    files: ['domExtractor.js', 'buildDomTree.js'],
  }).catch(() => null);

  await triggerWorkOverlay(runningTask.tabId, true, runningTask.overlayTitle || 'Antigravity is working');

  broadcastMessage({
    type: 'cowork_task_resumed',
    taskId: runningTask.taskId,
    sessionId: runningTask.sessionId,
    tabId: runningTask.tabId,
  });

  if (runningTask.stepWaitResolver) {
    runningTask.stepWaitResolver('resumed');
    runningTask.stepWaitResolver = null;
  }
}

function applyPowerKeepAwake(preventSleep) {
  try {
    if (chrome.power && chrome.power.requestKeepAwake) {
      if (preventSleep) {
        chrome.power.requestKeepAwake('system');
      } else {
        chrome.power.releaseKeepAwake();
      }
    }
  } catch (err) {
    console.warn('Chrome power keep-awake error:', err);
  }
}

async function handleShadowOnTaskComplete() {
  try {
    const settings = await getSettings();
    const action = settings.shadowOnComplete;
    if (!action || action === 'none' || !settings.shadowEnabled) return;
    const base = (settings.bridgeUrl || DEFAULT_BRIDGE_URL).replace(/\/+$/, '');
    if (action === 'sleep') {
      await fetch(`${base}/api/power/sleep`, { method: 'POST' }).catch(() => null);
    } else if (action === 'shutdown') {
      await fetch(`${base}/api/power/shutdown`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ delay_seconds: 30, action: 'shutdown' }),
      }).catch(() => null);
    } else if (action === 'hibernate') {
      await fetch(`${base}/api/power/shutdown`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ delay_seconds: 15, action: 'hibernate' }),
      }).catch(() => null);
    }
  } catch (err) {
    console.warn('Shadow completion action error:', err);
  }
}

async function applyDisplayMode(mode) {
  try {
    if (mode === 'popup') {
      if (chrome.action?.setPopup) {
        await chrome.action.setPopup({ popup: 'side-panel/index.html' });
      }
      if (chrome.sidePanel?.setPanelBehavior) {
        await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch(() => null);
      }
    } else {
      if (chrome.action?.setPopup) {
        await chrome.action.setPopup({ popup: '' });
      }
      if (chrome.sidePanel?.setPanelBehavior) {
        await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => null);
      }
    }
  } catch (err) {
    console.warn('Error applying display mode:', err);
  }
}

// Initial display mode and power setup
getSettings().then((s) => {
  applyDisplayMode(s.displayMode || 'side_panel');
  if (s.shadowPreventSleep) applyPowerKeepAwake(true);
}).catch(() => null);

async function saveSettings(settings) {
  await chrome.storage.local.set({ antigravity_settings: settings });
  await applyDisplayMode(settings.displayMode || 'side_panel');
  if (settings.shadowPreventSleep !== undefined) {
    applyPowerKeepAwake(settings.shadowPreventSleep);
  }
  if (settings.localMcpBridgeEnabled !== undefined) {
    await chrome.storage.local.set({ autono_local_mcp_bridge_enabled: Boolean(settings.localMcpBridgeEnabled) });
    if (settings.localMcpBridgeEnabled) {
      startMcpBridgePoller();
    } else {
      stopMcpBridgePoller();
    }
  }
}

async function getSessions() {
  const data = await chrome.storage.local.get('antigravity_sessions');
  return data.antigravity_sessions || [];
}

async function saveSessions(sessions) {
  await chrome.storage.local.set({ antigravity_sessions: sessions });
}

async function getActiveSessionId() {
  const data = await chrome.storage.local.get('antigravity_active_session_id');
  return data.antigravity_active_session_id || null;
}

async function setActiveSessionId(id) {
  await chrome.storage.local.set({ antigravity_active_session_id: id });
}

// ─── Live Quota Fetcher from Antigravity CLI via Bridge ─────────────────────
async function fetchBridgeQuota(baseUrl, force = false) {
  try {
    const res = await fetch(`${baseUrl}/v1/quota${force ? '?refresh=true' : ''}`, {
      signal: AbortSignal.timeout(6000),
    });
    if (res.ok) {
      const data = await res.json();
      cachedCliQuota = data;
      await chrome.storage.local.set({ antigravity_cli_quota: data });
      broadcastMessage({ type: 'quota_update', quota: data });
      return data;
    }
  } catch (err) {
    console.warn('Could not fetch live quota from Antigravity CLI via bridge:', err);
  }
  return cachedCliQuota;
}

// ─── AntigravityBridge Connection Watchdog ──────────────────────────────────
async function checkBridgeHealth() {
  const settings = await getSettings();
  const base = settings.bridgeUrl.replace(/\/+$/, '');
  try {
    const res = await fetch(`${base}/health`, { signal: AbortSignal.timeout(3000) });
    if (res.ok) {
      bridgeOnline = true;
      await refreshModelsList(base);
      await fetchBridgeQuota(base);
      broadcastMessage({ type: 'bridge_status', online: true, models: availableModels, quota: cachedCliQuota });
      return true;
    }
  } catch (err) {
    // try checking /v1/models directly
    try {
      const res2 = await fetch(`${base}/v1/models`, { signal: AbortSignal.timeout(3000) });
      if (res2.ok) {
        bridgeOnline = true;
        await refreshModelsList(base);
        await fetchBridgeQuota(base);
        broadcastMessage({ type: 'bridge_status', online: true, models: availableModels, quota: cachedCliQuota });
        return true;
      }
    } catch {
      // offline
    }
  }

  bridgeOnline = false;
  broadcastMessage({ type: 'bridge_status', online: false, models: PRELOADED_MODELS, quota: cachedCliQuota });
  return false;
}

async function refreshModelsList(baseUrl) {
  try {
    const res = await fetch(`${baseUrl}/v1/models`, { signal: AbortSignal.timeout(4000) });
    if (res.ok) {
      const json = await res.json();
      if (Array.isArray(json.data) && json.data.length > 0) {
        const filteredData = json.data.filter(m => {
          const id = m.id.toLowerCase();
          return !id.includes('4o') && !id.includes('gpt-4') && !id.includes('gpt-3.5') && !id.includes('o1');
        });
        const fetched = filteredData.map(m => ({
          id: m.id,
          name: m.display_name || m.name || m.id.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        }));

        // Merge with preloaded friendly names
        const merged = fetched.map(f => {
          const pre = PRELOADED_MODELS.find(p => p.id === f.id);
          return pre ? pre : f;
        });

        // Add any missing preloaded
        for (const p of PRELOADED_MODELS) {
          if (!merged.some(m => m.id === p.id)) {
            merged.push(p);
          }
        }
        availableModels = merged.length > 0 ? merged : [...PRELOADED_MODELS];
      }
    }
  } catch (e) {
    console.log('Using preloaded models fallback:', e);
  }
}

// Run initial check and set periodic ping
checkBridgeHealth();
setInterval(checkBridgeHealth, 20000);

// ─── Broadcast to Connected Panels & Internal Subsystems ────────────────────
const internalMessageListeners = new Set();
function addInternalListener(fn) {
  internalMessageListeners.add(fn);
}
function removeInternalListener(fn) {
  internalMessageListeners.delete(fn);
}

function broadcastMessage(payload) {
  for (const fn of internalMessageListeners) {
    try {
      fn(payload);
    } catch (e) {
      console.warn('Internal listener error:', e);
    }
  }
  for (const port of [...activePorts]) {
    try {
      port.postMessage(payload);
    } catch {
      activePorts.delete(port);
    }
  }
}

// ─── Restricted URL Check (Chrome Security Restrictions) ────────────────────
function isRestrictedUrl(url) {
  if (!url || typeof url !== 'string') return true;
  const lower = String(url).toLowerCase().trim();
  if (lower === '') return true;
  return (
    lower.startsWith('chrome://') ||
    lower.startsWith('chrome-extension://') ||
    lower.startsWith('edge://') ||
    lower.startsWith('about:') ||
    lower.startsWith('view-source:') ||
    lower.startsWith('devtools://') ||
    lower.startsWith('chrome-untrusted://') ||
    lower.startsWith('chrome-search://') ||
    lower.includes('chrome.google.com/webstore') ||
    lower.includes('chromewebstore.google.com')
  );
}

// Check if a URL is a normal web page usable for automation
function isUsableWebPage(url) {
  if (!url || typeof url !== 'string') return false;
  const lower = url.toLowerCase().trim();
  if (!lower.startsWith('http://') && !lower.startsWith('https://')) return false;
  return !isRestrictedUrl(lower);
}

// ─── Tab Load Helper ────────────────────────────────────────────────────────
async function waitForTabLoadComplete(tabId, timeoutMs = 12000) {
  return new Promise((resolve) => {
    let resolved = false;

    const cleanup = () => {
      chrome.tabs.onUpdated.removeListener(listener);
      clearTimeout(timer);
    };

    const timer = setTimeout(async () => {
      if (!resolved) {
        resolved = true;
        cleanup();
        const tab = await chrome.tabs.get(tabId).catch(() => null);
        resolve(tab);
      }
    }, timeoutMs);

    function listener(updatedTabId, changeInfo, tab) {
      if (updatedTabId === tabId && changeInfo.status === 'complete') {
        if (!resolved) {
          resolved = true;
          cleanup();
          resolve(tab);
        }
      }
    }

    chrome.tabs.onUpdated.addListener(listener);

    chrome.tabs.get(tabId).then((t) => {
      if (t && t.status === 'complete' && isUsableWebPage(t.url)) {
        if (!resolved) {
          resolved = true;
          cleanup();
          resolve(t);
        }
      }
    }).catch(() => {});
  });
}

// ─── Ensure Usable Tab for Cowork (Auto-navigate to google.com if unusable) ──
async function ensureUsableTabForCowork(tab) {
  const extPrefix = chrome.runtime.getURL('');
  const isExtTab = (t) => {
    if (!t?.url) return false;
    const u = t.url.toLowerCase();
    return u.startsWith(extPrefix.toLowerCase()) || u.startsWith('chrome-extension://');
  };

  // 1. If tab is already usable and not internal, return it
  if (tab && tab.id && isUsableWebPage(tab.url) && !isExtTab(tab)) {
    return tab;
  }

  let targetTabId = null;

  // 2. If tab is a normal browser tab (e.g. chrome://newtab), update its url to Google
  if (tab && tab.id && !isExtTab(tab)) {
    try {
      const updated = await chrome.tabs.update(tab.id, { url: 'https://www.google.com', active: true });
      if (updated && updated.id) {
        targetTabId = updated.id;
      }
    } catch (err) {
      console.warn('Could not update tab to google.com, will create new tab:', err);
    }
  }

  // 3. Fallback: find normal browser window and create a new tab on google.com
  if (!targetTabId) {
    try {
      const normalWindows = await chrome.windows.getAll({ windowTypes: ['normal'] }).catch(() => []);
      const focusedWin = normalWindows.find((w) => w.focused) || normalWindows[0];
      const createOpts = { url: 'https://www.google.com', active: true };
      if (focusedWin?.id) {
        createOpts.windowId = focusedWin.id;
      }
      const newTab = await chrome.tabs.create(createOpts);
      targetTabId = newTab.id;
    } catch (err) {
      console.warn('Fallback tab creation failed:', err);
      const fallbackTab = await chrome.tabs.create({ url: 'https://www.google.com', active: true }).catch(() => null);
      targetTabId = fallbackTab?.id;
    }
  }

  if (targetTabId) {
    const loadedTab = await waitForTabLoadComplete(targetTabId);
    await new Promise((r) => setTimeout(r, 600));
    return loadedTab || (await chrome.tabs.get(targetTabId).catch(() => null));
  }

  return tab;
}

// ─── Active Web Tab Resolver (Works seamlessly in Side Panel & Popup modes) ─
async function getActiveWebTab() {
  try {
    const extPrefix = chrome.runtime.getURL('');

    // 1. Check all normal browser windows (ignoring popup windows of this extension)
    const normalWindows = await chrome.windows.getAll({ populate: true, windowTypes: ['normal'] }).catch(() => []);
    if (normalWindows && normalWindows.length > 0) {
      // Prioritize the focused normal window, or the first normal window
      const focusedNormal = normalWindows.find((w) => w.focused) || normalWindows[0];
      const activeTab = focusedNormal?.tabs?.find((t) => t.active);
      if (activeTab && activeTab.id && !activeTab.url?.startsWith(extPrefix)) {
        return activeTab;
      }
      // If active tab in focused window was extension, find any normal tab
      for (const win of normalWindows) {
        const tab = win.tabs?.find((t) => t.active && !t.url?.startsWith(extPrefix));
        if (tab && tab.id) return tab;
      }
    }

    // 2. Fallback: query active tab across all windows, excluding our own extension
    const allTabs = await chrome.tabs.query({ active: true }).catch(() => []);
    const nonExtTab = allTabs.find((t) => t.url && !t.url.startsWith(extPrefix) && !t.url.startsWith('chrome-extension://'));
    if (nonExtTab && nonExtTab.id) {
      return nonExtTab;
    }

    // 3. Fallback: any active tab
    if (allTabs && allTabs.length > 0 && allTabs[0].id) {
      return allTabs[0];
    }
  } catch (err) {
    console.warn('Error resolving active web tab:', err);
  }
  return null;
}

// ─── Page DOM & Screenshot Context Gatherer ─────────────────────────────────
async function getPageContext(tabId, includeScreenshot = false) {
  let tab = null;
  if (tabId) {
    try {
      tab = await chrome.tabs.get(tabId);
    } catch {
      // Tab might be closed or invalid
    }
  }

  const url = tab?.url || tab?.pendingUrl || '';
  const title = tab?.title || 'Navegador general';

  // 1. Guard against internal and restricted browser URLs or missing tab
  if (!tabId || isRestrictedUrl(url)) {
    return {
      screenData: {
        title,
        url,
        pageContent: url ? `(Internal browser page: ${url}. Due to Google Chrome security policies, extensions cannot inspect DOM content on internal system pages).` : 'Direct chat mode (no active linked page).',
        headings: [title],
        interactiveSummary: { buttons: [], inputs: [] },
      },
      screenshotDataUrl: null,
    };
  }

  // 2. Normal Web Page: safely extract DOM context
  try {
    // Inject domExtractor if not already available
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['domExtractor.js'],
    }).catch(() => null);

    const execResults = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => (typeof window.__extractScreenJSON === 'function' ? window.__extractScreenJSON() : null),
    }).catch(() => []);

    const result = execResults?.[0];
    let screenData = result?.result;
    if (!screenData) {
      screenData = {
        title,
        url,
        pageContent: 'Could not extract DOM content directly.',
        headings: [title],
        interactiveSummary: { buttons: [], inputs: [] },
      };
    }

    let screenshotDataUrl = null;
    if (includeScreenshot) {
      try {
        screenshotDataUrl = await chrome.tabs.captureVisibleTab(tab?.windowId || null, {
          format: 'jpeg',
          quality: 70,
        });
      } catch (err) {
        // Screenshot capture not allowed or window inactive
      }
    }

    return { screenData, screenshotDataUrl };
  } catch (error) {
    console.warn('Contexto DOM no accesible directamente:', error.message || error);
    return {
      screenData: {
        title,
        url,
        pageContent: 'Web page loaded (no access to DOM elements).',
        headings: [title],
        interactiveSummary: { buttons: [], inputs: [] },
      },
      screenshotDataUrl: null,
    };
  }
}

// ─── Mode 1: Chat Execution (Fast, Full-Screen JSON, Streaming) ─────────────
async function handleChatStream(taskId, sessionId, userText, modelName, includeScreenshot, tabId, thinkingEffort) {
  const settings = await getSettings();
  const base = settings.bridgeUrl.replace(/\/+$/, '');
  const abortController = new AbortController();

  runningTask = {
    taskId,
    sessionId,
    mode: 'chat',
    tabId,
    status: 'running',
    abortController,
  };

  broadcastMessage({ type: 'task_start', taskId, sessionId, mode: 'chat' });

  try {
    // 1. Get Screen Context JSON
    const { screenData, screenshotDataUrl } = await getPageContext(tabId, includeScreenshot);

    // 2. Build Messages with explicit CoT prompt and strict Markdown / LaTeX
    const systemPrompt = `You are Autono, an advanced autonomous AI browser agent and navigation copilot connected to local Antigravity Bridge and running in Google Chrome.
Your goal is to solve whatever the user requests with maximum precision, depth, completeness, and clarity.

CRITICAL CONTROL DIRECTIVE (STRICT SUBAGENT PROHIBITION):
- Creating, invoking, or delegating to subagents is STRICTLY PROHIBITED (invoke_subagent, define_subagent, or parallel subagents are completely disabled).
- Under NO circumstances may you create subagents to edit files or browse the web.
- ALL actions, reasoning, analysis, and code MUST be executed directly by you in this single central execution thread.

CRITICAL UNLIMITED OUTPUT DIRECTIVE:
- You have NO length limits in your response. Do not over-summarize or truncate information.
- Always provide complete, detailed, in-depth, and thorough answers.
- If the user requests code, generate the complete end-to-end code without abbreviations, omitting functions, or using placeholders like '// rest of code...'.
- If analysis or tables are requested, build extensive, complete tables with all available data.
- Always deliver all necessary output to 100% fulfill the task without artificial token limitations.

MANDATORY MARKDOWN & LATEX FORMATTING INSTRUCTIONS:
- ALWAYS use GitHub Flavored Markdown (GFM):
  * Well-organized headings (##, ###)
  * Bulleted or numbered lists
  * Detailed Markdown tables for structuring data and comparisons
  * Bold text to highlight key concepts and findings
  * Fenced code blocks with their respective language identifier
- For any math calculations, variables, or scientific formulas, use LaTeX syntax:
  * Inline formulas: $...$ or \( ... \)
  * Block equations: $...$ or \[ ... \]

MANDATORY CHAIN-OF-THOUGHT (CoT) REASONING DIRECTIVE:
- At the start of your response, you MUST break down your thought process step by step inside <thought>...</thought> tags.
- In this block, evaluate the user request, the page context, attachments, and plan the best solution.
- ALL internal reasoning must stay STRICTLY inside <thought>...</thought>. NEVER place preliminary musings or raw plans outside.
- Close the </thought> tag before writing your response to the user, and deliver a clean, well-structured response in English with clear tables and formatting.

MANDATORY INSTRUCTIONS FOR COWORK MODE & INTERACTIVE APPROVAL CARDS:
1. AUTOMATIC WEB TASK DETECTION (PROMPT COWORK ACTIVATION):
If the user asks you to interact directly with the web (such as clicking buttons, filling forms, navigating links, active search, or DOM automation) and you are currently in standard Chat mode (NOT active Cowork):
You MUST inform the user that you can perform this autonomously via Cowork and present an interactive approval card.
Emit this structured block at the end of your response:
<approval_card>
{
  "action": "cowork_request",
  "goal": "Clear and concise description of the web task to execute",
  "questions": [
    {
      "q": "Would you like to activate Cowork mode to navigate and interact with the page automatically?",
      "type": "radio",
      "options": ["Yes, activate Cowork and execute", "No, just explain it in chat"]
    }
  ]
}
</approval_card>

2. INTERACTIVE QUESTIONS & HUMAN-IN-THE-LOOP DECISIONS:
If you need the user to choose options, configure parameters, clarify ambiguity, or approve a plan before/during the task:
Generate an <approval_card> block structured with one or more questions ('radio' for single select with auto-advance, or 'check' for multi-select):
<approval_card>
{
  "action": "question",
  "questions": [
    {
      "q": "Concise and direct question for the user",
      "type": "radio",
      "options": ["Option 1", "Option 2", "Option 3"]
    }
  ]
}
</approval_card>
The user will be able to select options or write custom responses directly in the UI.

3. MANDATORY NEXT STEPS PROMPT SUGGESTIONS (MAXIMUM 5 SUGGESTIONS):
At the very end of your response, after finishing your full explanation, code, or report, you MUST provide an array of between 2 and 5 highly relevant, contextual, space-efficient follow-up prompt suggestions that the user might want to ask or execute next.
CRITICAL BREVITY REQUIREMENTS FOR NEXT STEPS:
- Each suggestion MUST be extremely short, concise, and space-efficient: strictly 2 to 4 words maximum, and under 30 characters in total.
- NEVER output full sentences, long multi-clause queries, explanations, or paragraphs.
- Good short suggestions: ["Add unit tests", "Explain formula", "Refactor to TS", "Show chart", "Benchmark speed"].
- Forbidden verbose suggestions: ["Develop a quantitative portfolio rebalancing model using Black-Litterman...", "Can you please explain how to implement..."]
You MUST output them in this exact JSON block at the very end of your message:
<next_steps_suggestions>
[
  "Short prompt 1",
  "Short prompt 2",
  "Short prompt 3"
]
</next_steps_suggestions>
These must be tailored to the exact topic just discussed so the user can easily click them to continue.`;

    const userContentParts = [];
    
    // Structured JSON representation of the screen
    const screenSummary = `=== CURRENT SCREEN CONTEXT (JSON) ===
URL: ${screenData.url}
Title: ${screenData.title}
${screenData.selectedText ? `User selected text: "${screenData.selectedText}"\n` : ''}
Key Headings:
${screenData.headings ? screenData.headings.join('\n') : 'N/A'}

Visible Interactive Elements:
- Buttons: ${screenData.interactiveSummary?.buttons?.join(', ') || 'None'}
- Fields/Inputs: ${JSON.stringify(screenData.interactiveSummary?.inputs || [])}

Main Page Content:
${screenData.pageContent || '(Page without accessible textual content)'}
=============================================`;

    userContentParts.push({ type: 'text', text: `${screenSummary}\n\nUser question or instruction:\n${userText}` });

    if (screenshotDataUrl) {
      userContentParts.push({
        type: 'image_url',
        image_url: { url: screenshotDataUrl },
      });
    }

    // Build full conversation history (up to last 10 turns)
    const sessions = await getSessions();
    const currentSession = sessions.find((s) => s.id === sessionId);
    const historyMessages = [];
    if (currentSession && Array.isArray(currentSession.messages)) {
      // Slices prior messages (skipping the very latest user turn which was just added)
      const prior = currentSession.messages.slice(-10);
      for (const m of prior) {
        if (m.role === 'user' || m.role === 'assistant') {
          historyMessages.push({
            role: m.role,
            content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
          });
        }
      }
    }

    const currentTurnContent = userContentParts.length === 1 ? userContentParts[0].text : userContentParts;
    // Ensure the current user instruction is present at the end
    if (historyMessages.length === 0 || historyMessages[historyMessages.length - 1].role !== 'user') {
      historyMessages.push({ role: 'user', content: currentTurnContent });
    } else {
      historyMessages[historyMessages.length - 1].content = currentTurnContent;
    }

    const targetModel = modelName || settings.selectedModel || DEFAULT_MODEL;
    const { url: endpointUrl, headers: endpointHeaders, model: resolvedModel } = await resolveInferenceEndpoint(targetModel, base);

    const effortMap = {
      'fast': 0,
      'low': 1024,
      'medium': 4096,
      'thinking': 4096,
      'high': 8192,
      'x-high': 16384,
      'max': 32768,
    };
    const thinkingBudget = (thinkingEffort && effortMap[thinkingEffort] !== undefined)
      ? effortMap[thinkingEffort]
      : undefined;

    const payload = {
      model: resolvedModel,
      messages: [
        { role: 'system', content: systemPrompt },
        ...historyMessages,
      ],
      stream: true,
      temperature: settings.temperature || 0.2,
      max_tokens: settings.maxOutputTokens || 65536,
      max_output_tokens: settings.maxOutputTokens || 65536,
      ...getProviderModes(resolvedModel, settings),
      reasoning_effort: thinkingEffort || undefined,
      thinking_budget: thinkingBudget,
    };

    const response = await fetch(endpointUrl, {
      method: 'POST',
      headers: endpointHeaders,
      body: JSON.stringify(payload),
      signal: abortController.signal,
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error(`Error ${response.status}: ${errText || response.statusText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let fullAnswer = '';
    let buffer = '';
    let inSyntheticThought = false;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop(); // Keep partial line in buffer

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data:')) continue;
        const dataStr = trimmed.slice(5).trim();
        if (dataStr === '[DONE]') continue;

        try {
          const parsed = JSON.parse(dataStr);
          const delta = parsed.choices?.[0]?.delta;
          const content = delta?.content || '';
          const reasoning = delta?.reasoning_content || delta?.reasoning || delta?.thought || '';

          let chunk = '';
          if (reasoning) {
            if (!inSyntheticThought) {
              chunk += '<thought>' + reasoning;
              inSyntheticThought = true;
            } else {
              chunk += reasoning;
            }
          }

          if (content) {
            if (inSyntheticThought) {
              chunk += '</thought>\n\n';
              inSyntheticThought = false;
            }
            chunk += content;
          }

          if (chunk) {
            fullAnswer += chunk;
            if (runningTask) {
              runningTask.fullAnswer = fullAnswer;
            }
            broadcastMessage({
              type: 'stream_chunk',
              taskId,
              sessionId,
              chunk,
              fullAnswer,
            });
          }
        } catch {
          // ignore parse errors for partial chunks
        }
      }
    }

    if (inSyntheticThought) {
      fullAnswer += '</thought>\n\n';
      inSyntheticThought = false;
      if (runningTask) runningTask.fullAnswer = fullAnswer;
    }

    // Task completed successfully
    broadcastMessage({
      type: 'task_complete',
      taskId,
      sessionId,
      mode: 'chat',
      fullAnswer,
    });

    // Save into persistent session
    await appendMessageToSession(sessionId, {
      role: 'assistant',
      content: fullAnswer,
      timestamp: Date.now(),
      mode: 'chat',
    });

    // Refresh live quota from Antigravity CLI via bridge
    fetchBridgeQuota(base, true).catch(() => null);

    // Shadow completion action (sleep / shutdown if configured)
    handleShadowOnTaskComplete();
  } catch (err) {
    if (err.name === 'AbortError') {
      broadcastMessage({ type: 'task_aborted', taskId, sessionId });
    } else {
      console.error('Chat error:', err);
      broadcastMessage({
        type: 'task_error',
        taskId,
        sessionId,
        error: err.message || 'Error desconocido al procesar con Antigravity Bridge',
      });
    }
  } finally {
    runningTask = null;
  }
}

/// ─── Mode 2: Cowork Execution (Action Steps & Browser Control) ──────────────
async function handleCoworkTask(taskId, sessionId, goalText, modelName, tabId) {
  const settings = await getSettings();
  const base = settings.bridgeUrl.replace(/\/+$/, '');
  const abortController = new AbortController();

  runningTask = {
    taskId,
    sessionId,
    mode: 'cowork',
    tabId,
    status: 'running',
    abortController,
    plan: null,
    steps: [],
    pendingInterventions: [],
    overlayTitle: 'Antigravity is working',
    lastKnownUrl: '',
    savedTabUrl: '',
    stepWaitResolver: null,
  };

  broadcastMessage({ type: 'task_start', taskId, sessionId, mode: 'cowork' });

  const maxSteps = settings.maxSteps || 15;
  let currentStep = 0;
  let completed = false;
  let summary = '';

  try {
    let tabInfo = await chrome.tabs.get(tabId).catch(() => null);
    if (!isUsableWebPage(tabInfo?.url)) {
      tabInfo = await ensureUsableTabForCowork(tabInfo);
      if (tabInfo?.id) {
        tabId = tabInfo.id;
        runningTask.tabId = tabId;
      }
    }

    if (tabId) {
      await handleAutoTabGrouping(tabId, goalText);
      await triggerWorkOverlay(tabId, true, 'Antigravity is working');
    }

    if (isRestrictedUrl(tabInfo?.url)) {
      const restrictedNotice = `⚠️ **Cannot run Cowork Mode on internal system pages** (\`${tabInfo?.url || 'chrome://...'}\`).\n\nUnder Google Chrome security policies, extensions are prohibited from clicking, typing, or automating internal browser pages (such as \`chrome://*\`, extensions, settings, or new tab).\n\n💡 **Solution:** Open any standard website (e.g., https://google.com, Wikipedia, or any normal web page) and try again.`;

      broadcastMessage({
        type: 'task_error',
        taskId,
        sessionId,
        error: 'Internal page (chrome://) not supported for Cowork. Please open a standard web page.',
      });

      await appendMessageToSession(sessionId, {
        role: 'assistant',
        content: restrictedNotice,
        timestamp: Date.now(),
        mode: 'cowork',
      });
      return;
    }

    // Inject buildDomTree.js on the tab
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['buildDomTree.js'],
    }).catch(() => null);

    // 0. Pre-flight Planning Phase: Create multi-step plan before execution
    broadcastMessage({
      type: 'cowork_step_start',
      taskId,
      sessionId,
      stepNumber: 0,
      status: 'Formulating strategic execution plan...',
    });

    const { screenData: initScreen } = await getPageContext(tabId, false);

    const plannerPrompt = `You are Antigravity Agent in COWORK Mode, an autonomous browser control copilot connected to Antigravity Bridge.
Creating, invoking, or delegating tasks to subagents is STRICTLY PROHIBITED; all actions must be executed directly by you.
The user has assigned you the following goal in the browser:
GOAL: "${goalText}"

INITIAL PAGE STATE:
URL: ${initScreen.url}
Title: ${initScreen.title}
Visible buttons: ${initScreen.interactiveSummary?.buttons?.slice(0, 50).join(', ') || 'None'}
Input fields: ${JSON.stringify(initScreen.interactiveSummary?.inputs?.slice(0, 50) || [])}
Visible content: ${initScreen.pageContent?.slice(0, 30000) || 'N/A'}

You MUST reply ONLY with a valid JSON object with this structure:
{
  "intro": "Direct summary of the goal (optional, max 1 concise sentence)",
  "title": "Execution Plan: [concise goal summary]",
  "steps": [
    {
      "id": "step-1",
      "title": "Step title (e.g. Inspect page structure and fields)",
      "icon": "search",
      "details": "Technical details of what will be inspected"
    },
    {
      "id": "step-2",
      "title": "Step title (e.g. Interact with controls and fill forms)",
      "icon": "terminal",
      "details": "Details of clicks or typing actions to perform"
    },
    {
      "id": "step-3",
      "title": "Step title (e.g. Verify outcome and synthesize report)",
      "icon": "file-text",
      "details": "Details of final verification and data gathering"
    }
  ]
}
Allowed values for "icon": "search", "file-text", "brain", "terminal", "code", "alert".`;

    let planIntro = '';
    let planData = null;
    try {
      const { url: planUrl, headers: planHeaders, model: resolvedPlanModel } = await resolveInferenceEndpoint(modelName || settings.selectedModel || DEFAULT_MODEL, base);
      const planRes = await fetch(planUrl, {
        method: 'POST',
        headers: planHeaders,
        body: JSON.stringify({
          model: resolvedPlanModel,
          messages: [{ role: 'user', content: plannerPrompt }],
          temperature: 0.1,
          stream: false,
          max_tokens: settings.maxOutputTokens || 65536,
          max_output_tokens: settings.maxOutputTokens || 65536,
          ...getProviderModes(resolvedPlanModel, settings),
        }),
        signal: abortController.signal,
      });

      if (planRes.ok) {
        const planJson = await planRes.json();
        const rawContent = planJson.choices?.[0]?.message?.content || '';

        // Extract natural intro phrase if placed before the JSON block
        const firstBraceIdx = rawContent.indexOf('{');
        if (firstBraceIdx > 15) {
          const preText = rawContent.slice(0, firstBraceIdx).replace(/<[^>]+>/g, '').replace(/```[a-z]*/g, '').trim();
          if (preText.length > 15) {
            planIntro = preText;
          }
        }

        const match = rawContent.match(/\{[\s\S]*\}/);
        if (match) {
          try {
            const parsed = JSON.parse(match[0]);
            if (parsed.intro && typeof parsed.intro === 'string' && parsed.intro.trim().length > 10) {
              planIntro = parsed.intro.trim();
            }
            if (parsed && Array.isArray(parsed.steps) && parsed.steps.length > 0) {
              planData = {
                title: parsed.title || `Execution Plan: ${goalText.slice(0, 40)}`,
                steps: parsed.steps.map((st, i) => ({
                  id: st.id || `step-${i + 1}`,
                  title: st.title || `Paso ${i + 1}`,
                  icon: st.icon || (i === 0 ? 'search' : i === parsed.steps.length - 1 ? 'file-text' : 'terminal'),
                  status: i === 0 ? 'active' : 'pending',
                  duration: '',
                  details: st.details || '',
                })),
              };
            }
          } catch (jsonErr) {
            console.warn('JSON parsing error in planner output:', jsonErr);
          }
        }
      }
    } catch (err) {
      console.warn('Could not generate dynamic plan with model, using fallback plan:', err);
    }

    if (!planData) {
      planData = {
        title: `Execution Plan: ${goalText.slice(0, 45)}...`,
        steps: [
          { id: 'step-1', title: 'Inspect page and interactive elements', icon: 'search', status: 'active', details: 'Inspect DOM and visible fields' },
          { id: 'step-2', title: 'Execute actions and browser controls', icon: 'terminal', status: 'pending', details: 'Interact with buttons, fields, and navigation' },
          { id: 'step-3', title: 'Verify final state and generate report', icon: 'file-text', status: 'pending', details: 'Validate goal completion and synthesize report' },
        ],
      };
    }

    runningTask.intro = planIntro;
    runningTask.plan = planData;
    broadcastMessage({
      type: 'cowork_plan_created',
      taskId,
      sessionId,
      intro: planIntro,
      plan: planData,
    });

    let failureAdaptiveGuidance = '';

    while (currentStep < maxSteps && !completed) {
      if (abortController.signal.aborted) break;

      // Handle paused state (e.g. tab closed or manual pause)
      while (runningTask && runningTask.status === 'paused' && !abortController.signal.aborted) {
        await new Promise((resolve) => {
          runningTask.stepWaitResolver = resolve;
        });
        runningTask.stepWaitResolver = null;
      }
      if (!runningTask || abortController.signal.aborted) break;

      // Synchronize tabId in case a new tab was opened upon resume
      tabId = runningTask.tabId;

      currentStep++;
      const stepStartTime = Date.now();

      // Ensure corresponding plan step is marked active
      if (runningTask.plan && runningTask.plan.steps) {
        const planIdx = Math.min(currentStep - 1, runningTask.plan.steps.length - 1);
        runningTask.plan.steps.forEach((st, idx) => {
          if (idx < planIdx) {
            if (st.status === 'pending' || st.status === 'active') {
              st.status = 'success';
              if (!st.duration) st.duration = '0.5s';
            }
          } else if (idx === planIdx) {
            st.status = 'active';
          }
        });
        broadcastMessage({
          type: 'cowork_plan_update',
          taskId,
          sessionId,
          intro: runningTask.intro,
          plan: runningTask.plan,
        });
      }

      // 1. Inspect DOM & Clickable Elements
      broadcastMessage({
        type: 'cowork_step_start',
        taskId,
        sessionId,
        stepNumber: currentStep,
        status: 'Analyzing page elements...',
      });

      const { screenData } = await getPageContext(tabId, false);
      if (screenData?.url) {
        runningTask.lastKnownUrl = screenData.url;
      }

      // 2. Check for real-time user interventions
      let userInterventionPrompt = '';
      if (runningTask.pendingInterventions && runningTask.pendingInterventions.length > 0) {
        const interventions = runningTask.pendingInterventions.splice(0);
        userInterventionPrompt = `\n\n🚨 URGENT USER INSTRUCTIONS (Direct real-time intervention):\n${interventions.map((t, idx) => `${idx + 1}. "${t}"`).join('\n')}\nYou must prioritize these instructions and incorporate them immediately into your next navigation steps.`;
      }

      // 3. Ask model for next action
      const coworkerPrompt = `You are Antigravity Agent in COWORK Mode, an autonomous browser control agent connected to Antigravity Bridge.
Creating, invoking, or delegating tasks to subagents is STRICTLY PROHIBITED; all actions must be executed directly by you.
Your goal is to achieve the user's goal through action steps:
GOAL: "${goalText}"

CURRENT STEP: ${currentStep} of ${maxSteps}

SCREEN STATE:
URL: ${screenData.url}
Title: ${screenData.title}
Detected buttons: ${screenData.interactiveSummary?.buttons?.slice(0, 50).join(', ') || 'None'}
Input fields: ${JSON.stringify(screenData.interactiveSummary?.inputs?.slice(0, 50) || [])}
Summarized visible content: ${screenData.pageContent?.slice(0, 30000) || 'N/A'}

Previous action history:
${runningTask.steps.map(s => `- Step ${s.step}: [${s.action}] ${s.description} -> Result: ${s.result}`).join('\n') || 'No previous actions.'}${userInterventionPrompt}${failureAdaptiveGuidance}

You MUST reply ONLY with a JSON block with this strict format:
{
  "thought": "Brief explanation of what you see and why you are taking this step",
  "action": "click" | "type" | "scroll" | "navigate" | "wait" | "finish",
  "selector": "Visible text of button/link, or CSS selector",
  "value": "Text to type if type action, or URL if navigate",
  "description": "User-friendly description in English of what you are doing"
}`;

      const { url: stepUrl, headers: stepHeaders, model: resolvedStepModel } = await resolveInferenceEndpoint(modelName || settings.selectedModel || DEFAULT_MODEL, base);
      const res = await fetch(stepUrl, {
        method: 'POST',
        headers: stepHeaders,
        body: JSON.stringify({
          model: resolvedStepModel,
          messages: [{ role: 'user', content: coworkerPrompt }],
          temperature: 0.1,
          stream: false,
          max_tokens: settings.maxOutputTokens || 65536,
          max_output_tokens: settings.maxOutputTokens || 65536,
          ...getProviderModes(resolvedStepModel, settings),
        }),
        signal: abortController.signal,
      });

      if (!res.ok) throw new Error(`Antigravity Bridge failure on step ${currentStep}`);

      const data = await res.json();
      const rawAnswer = data.choices?.[0]?.message?.content || '{}';
      
      let stepPlan;
      try {
        const jsonMatch = rawAnswer.match(/\{[\s\S]*\}/);
        stepPlan = jsonMatch ? JSON.parse(jsonMatch[0]) : { action: 'finish', thought: 'Finished', description: rawAnswer };
      } catch {
        stepPlan = { action: 'finish', thought: 'Response completed', description: rawAnswer };
      }

      broadcastMessage({
        type: 'cowork_step_action',
        taskId,
        sessionId,
        stepNumber: currentStep,
        plan: stepPlan,
      });

      // 4. Execute the planned action
      let actionResult = 'Success';
      if (stepPlan.action === 'finish') {
        completed = true;
        summary = stepPlan.thought || stepPlan.description || 'Task completed successfully.';
      } else if (stepPlan.action === 'click') {
        actionResult = await executeClickAction(tabId, stepPlan.selector);
      } else if (stepPlan.action === 'type') {
        actionResult = await executeTypeAction(tabId, stepPlan.selector, stepPlan.value);
      } else if (stepPlan.action === 'scroll') {
        actionResult = await executeScrollAction(tabId, stepPlan.value || 'down');
      } else if (stepPlan.action === 'navigate') {
        await chrome.tabs.update(tabId, { url: stepPlan.value });
        await new Promise(r => {
          runningTask.stepWaitResolver = r;
          setTimeout(r, 2000);
        });
        runningTask.stepWaitResolver = null;
        actionResult = `Navigated to ${stepPlan.value}`;
      } else if (stepPlan.action === 'wait') {
        await new Promise(r => {
          runningTask.stepWaitResolver = r;
          setTimeout(r, 2000);
        });
        runningTask.stepWaitResolver = null;
        actionResult = 'Wait completed';
      }

      const stepDurationSec = ((Date.now() - stepStartTime) / 1000).toFixed(1) + 's';

      runningTask.steps.push({
        step: currentStep,
        action: stepPlan.action,
        description: stepPlan.description,
        thought: stepPlan.thought,
        result: actionResult,
        duration: stepDurationSec,
      });

      // Evaluate whether action encountered an issue, and generate adaptive guidance for the next step (Never get stuck!)
      const isFailed = typeof actionResult === 'string' && (
        actionResult.toLowerCase().includes('not found') ||
        actionResult.toLowerCase().includes('fail') ||
        actionResult.toLowerCase().includes('error') ||
        actionResult.toLowerCase().includes('no encontrado') ||
        actionResult.toLowerCase().includes('fallo')
      );

      if (isFailed) {
        failureAdaptiveGuidance = `\n\n⚠️ ADAPTIVE GUIDANCE (The previous step encountered an issue or could not find the element):
Previous step outcome: "${actionResult}".
STRICT RESILIENCE RULE: NEVER halt or repeat the exact same selector without changes. Proceed adaptively:
1. If the button or text field was not found: scroll down or up, try alternative text or attribute (name, placeholder, id), or use the numeric [index] from the DOM extractor.
2. If a search or submit button does not respond: append newline (\\n) to typed text or navigate directly to the destination URL via "navigate".
3. If a modal or cookie banner appeared: interact with it to clear the page.
ALWAYS continue progressing toward the goal.`;
      } else {
        failureAdaptiveGuidance = '';
      }

      // Update plan step with details and duration
      if (runningTask.plan && runningTask.plan.steps) {
        const planIdx = Math.min(currentStep - 1, runningTask.plan.steps.length - 1);
        const currentPlanStep = runningTask.plan.steps[planIdx];
        if (currentPlanStep) {
          currentPlanStep.status = isFailed ? 'error' : 'success';
          currentPlanStep.duration = stepDurationSec;
          currentPlanStep.details = `${stepPlan.thought ? stepPlan.thought + '\n\n' : ''}Action: [${stepPlan.action.toUpperCase()}] ${stepPlan.description}\nResult: ${actionResult}${isFailed ? '\n(Continuing with adaptive strategy...)' : ''}`;
        }
        broadcastMessage({
          type: 'cowork_plan_update',
          taskId,
          sessionId,
          intro: runningTask.intro,
          plan: runningTask.plan,
        });
      }

      // Small pause between steps for visual smoothness (interruptible instantly if user intervenes)
      await new Promise(r => {
        runningTask.stepWaitResolver = r;
        setTimeout(r, 800);
      });
      runningTask.stepWaitResolver = null;
    }

    if (!completed) {
      summary = `Maximum ${maxSteps} execution steps reached.`;
    }

    // Resolve any remaining plan steps
    if (runningTask.plan && runningTask.plan.steps) {
      runningTask.plan.steps.forEach(st => {
        if (st.status === 'pending' || st.status === 'active') {
          st.status = completed ? 'success' : 'error';
          if (!st.duration) st.duration = 'completado';
        }
      });
      broadcastMessage({
        type: 'cowork_plan_update',
        taskId,
        sessionId,
        intro: runningTask.intro,
        plan: runningTask.plan,
      });
    }

    // 4. Post-flight Comprehensive Markdown Report Generation
    broadcastMessage({
      type: 'cowork_step_start',
      taskId,
      sessionId,
      stepNumber: currentStep + 1,
      status: 'Synthesizing final report in Markdown...',
    });

    const { screenData: finalScreen } = await getPageContext(tabId, false).catch(() => ({ screenData: {} }));

    const reportPrompt = `You are Antigravity Agent in COWORK Mode. You have finished executing a task in the web browser.
Write a COMPREHENSIVE, PROFESSIONAL, DETAILED FINAL REPORT in GITHUB FLAVORED MARKDOWN (GFM).

REQUESTED GOAL: "${goalText}"
FINAL STATUS: ${completed ? 'Completed successfully' : 'Step limit reached or preventive completion'}
FINAL URL: ${finalScreen?.url || 'N/A'}
PAGE TITLE: ${finalScreen?.title || 'N/A'}

EXECUTED ACTIONS HISTORY:
${runningTask.steps.map(s => `- Step ${s.step} [${s.action}]: ${s.description} | Thought: ${s.thought || ''} | Result: ${s.result}`).join('\n') || 'No previous actions.'}

MANDATORY REPORT STRUCTURE:
# 📋 Cowork Execution Report

## 🎯 Objective & Executive Summary
(Concise and clear explanation of the goal and final outcome achieved)

## 📊 Actions Matrix
(Mandatory Markdown table with columns: | Step | Action | Description | Result | Duration |)

## 🔍 Findings & Extracted Data
(Details of information, key data, text or confirmations gathered during navigation)

## 💡 Conclusions & Recommendations
(Observations on navigation, possible next steps or suggestions for the user)

Formatting instructions:
- Use Markdown headers (##, ###), bold text, bullet/numbered lists and clean tables.
- For math expressions or metrics, use LaTeX ($...).
- Write in English with a clear, technical, professional tone.
- At the very end of your report, provide an array of between 2 and 5 follow-up prompt suggestions in this exact block (CRITICAL: each suggestion MUST be extremely short and space-efficient, strictly 2 to 4 words maximum, under 30 characters each):
<next_steps_suggestions>
[
  "Short next step 1",
  "Short next step 2",
  "Short next step 3"
]
</next_steps_suggestions>`;

    let finalReportMarkdown = '';
    try {
      const { url: repUrl, headers: repHeaders, model: resolvedRepModel } = await resolveInferenceEndpoint(modelName || settings.selectedModel || DEFAULT_MODEL, base);
      const repRes = await fetch(repUrl, {
        method: 'POST',
        headers: repHeaders,
        body: JSON.stringify({
          model: resolvedRepModel,
          messages: [{ role: 'user', content: reportPrompt }],
          temperature: 0.2,
          stream: false,
          max_tokens: settings.maxOutputTokens || 65536,
          max_output_tokens: settings.maxOutputTokens || 65536,
          ...getProviderModes(resolvedRepModel, settings),
        }),
        signal: abortController.signal,
      });

      if (repRes.ok) {
        const repJson = await repRes.json();
        finalReportMarkdown = repJson.choices?.[0]?.message?.content || '';
      }
    } catch (repErr) {
      console.warn('Failed to request report from model, generating fallback report:', repErr);
    }

    if (!finalReportMarkdown || finalReportMarkdown.trim().length < 40) {
      const rows = runningTask.steps.map(s => `| ${s.step} | \`${s.action}\` | ${s.description || '-'} | ${s.result || 'OK'} | ${s.duration || '0.5s'} |`).join('\n');
      finalReportMarkdown = `# 📋 Cowork Execution Report

## 🎯 Objective & Executive Summary
- **Goal:** ${goalText}
- **Status:** ${completed ? '✅ Task successfully completed' : '⚠️ Finished after reaching step limit'}
- **Current Page:** [${finalScreen?.title || 'Link'}](${finalScreen?.url || '#'})
- **Total steps executed:** ${runningTask.steps.length}

## 📊 Actions Matrix
| Step | Action | Description | Result | Duration |
| :---: | :---: | :--- | :--- | :---: |
${rows || '| 1 | `info` | Visual inspection | Completed | 0.5s |'}

## 🔍 Findings & Extracted Data
${summary ? `> ${summary}\n` : ''}
- Inspected the DOM tree and interactive elements on the active page.
- Planned actions were executed and verified via Antigravity Agent.

## 💡 Conclusions & Recommendations
- You can verify the visual outcome in the current browser tab.
- If you require additional steps or adjustments, send another instruction in this chat.`;
    }

    broadcastMessage({
      type: 'task_complete',
      taskId,
      sessionId,
      mode: 'cowork',
      intro: runningTask.intro,
      plan: runningTask.plan,
      steps: runningTask.steps,
      summary: finalReportMarkdown,
    });

    await appendMessageToSession(sessionId, {
      role: 'assistant',
      content: finalReportMarkdown,
      intro: runningTask.intro,
      plan: runningTask.plan,
      steps: runningTask.steps,
      timestamp: Date.now(),
      mode: 'cowork',
    });

    // Refresh live quota from Antigravity CLI via bridge
    fetchBridgeQuota(base, true).catch(() => null);

    // Shadow completion action (sleep / shutdown if configured)
    handleShadowOnTaskComplete();
  } catch (err) {
    if (err.name === 'AbortError') {
      broadcastMessage({ type: 'task_aborted', taskId, sessionId });
    } else {
      console.error('Cowork error:', err);
      broadcastMessage({
        type: 'task_error',
        taskId,
        sessionId,
        error: err.message || 'Error executing Cowork task',
      });
    }
  } finally {
    if (tabId) {
      await triggerWorkOverlay(tabId, false);
    }
    runningTask = null;
  }
}

// Action execution helpers (SiteLegend + Browserius / Browser-use Multi-Strategy Engine)
async function executeClickAction(tabId, target) {
  try {
    const tab = await chrome.tabs.get(tabId).catch(() => null);
    if (isRestrictedUrl(tab?.url)) {
      return 'Action omitted: not permitted on internal Chrome pages';
    }
    const execResults = await chrome.scripting.executeScript({
      target: { tabId },
      func: (targetSelector) => {
        function findInteractiveElement(target, isInputOnly = false) {
          if (!target && !isInputOnly) return null;
          const rawTarget = String(target || '').trim();
          const lowerTarget = rawTarget.toLowerCase();

          function isVisible(el) {
            if (!el || el.nodeType !== Node.ELEMENT_NODE) return false;
            const style = window.getComputedStyle(el);
            if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
            const rect = el.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0;
          }

          function clean(str) {
            return (str || '').replace(/\s+/g, ' ').trim();
          }

          // 1. Index match ([12], #12, 12, el-12)
          const indexMatch = rawTarget.match(/^(?:\[|#|el-)?(\d+)(?:\])?$/);
          if (indexMatch) {
            const idx = parseInt(indexMatch[1], 10);
            const indexedEl = document.querySelector(`[data-highlight-index="${idx}"], [data-index="${idx}"], [highlight-index="${idx}"]`);
            if (indexedEl && isVisible(indexedEl)) return indexedEl;
            if (window.__antigravity_dom_map && window.__antigravity_dom_map.has(idx)) {
              const el = window.__antigravity_dom_map.get(idx);
              if (el && isVisible(el)) return el;
            }
          }

          // 2. Safe CSS selector
          if (rawTarget && !rawTarget.includes('\n')) {
            try {
              const el = document.querySelector(rawTarget);
              if (el && isVisible(el)) return el;
            } catch (e) {}
          }

          // 3. XPath locator
          if (rawTarget.startsWith('/') || rawTarget.startsWith('./') || rawTarget.startsWith('(') || rawTarget.startsWith('xpath=')) {
            try {
              const cleanXpath = rawTarget.replace(/^xpath=/i, '');
              const res = document.evaluate(cleanXpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
              if (res.singleNodeValue && isVisible(res.singleNodeValue)) return res.singleNodeValue;
            } catch (e) {}
          }

          // Candidates pool
          const candidates = isInputOnly
            ? Array.from(document.querySelectorAll('input:not([type="hidden"]), textarea, [contenteditable="true"], [role="textbox"], [role="searchbox"], [role="combobox"], select'))
            : Array.from(document.querySelectorAll('button, a, input, textarea, select, [role="button"], [role="link"], [role="tab"], [role="menuitem"], [role="checkbox"], [role="radio"], [role="switch"], [role="textbox"], [role="searchbox"], [role="combobox"], [contenteditable="true"], summary, label, [tabindex]:not([tabindex="-1"])'));

          // 4. Semantic attribute match (id, name, placeholder, aria-label, data-testid, title, alt, value)
          for (const el of candidates) {
            if (!isVisible(el)) continue;
            const id = (el.id || '').toLowerCase();
            const name = (el.getAttribute('name') || '').toLowerCase();
            const ph = (el.getAttribute('placeholder') || '').toLowerCase();
            const aria = (el.getAttribute('aria-label') || '').toLowerCase();
            const testId = (el.getAttribute('data-testid') || el.getAttribute('data-qa') || el.getAttribute('data-cy') || '').toLowerCase();
            const title = (el.getAttribute('title') || '').toLowerCase();
            const alt = (el.getAttribute('alt') || '').toLowerCase();
            const val = (el.value || '').toLowerCase();

            if (id === lowerTarget || name === lowerTarget || ph === lowerTarget || aria === lowerTarget || testId === lowerTarget || title === lowerTarget || val === lowerTarget) {
              return el;
            }
            if ((ph && ph.includes(lowerTarget)) || (aria && aria.includes(lowerTarget)) || (name && name.includes(lowerTarget)) || (title && title.includes(lowerTarget)) || (testId && testId.includes(lowerTarget)) || (alt && alt.includes(lowerTarget))) {
              return el;
            }
          }

          // 5. Associated <label> match
          if (isInputOnly || candidates.some(c => c.tagName === 'INPUT' || c.tagName === 'TEXTAREA')) {
            const labels = Array.from(document.querySelectorAll('label'));
            for (const lbl of labels) {
              if (!isVisible(lbl)) continue;
              const lblText = clean(lbl.innerText).toLowerCase();
              if (lblText.includes(lowerTarget) || lowerTarget.includes(lblText)) {
                if (lbl.htmlFor) {
                  const inp = document.getElementById(lbl.htmlFor);
                  if (inp && isVisible(inp)) return inp;
                }
                const innerInp = lbl.querySelector('input, textarea, select');
                if (innerInp && isVisible(innerInp)) return innerInp;
              }
            }
          }

          // 6. Smart visible text match
          for (const el of candidates) {
            if (!isVisible(el)) continue;
            const txt = clean(el.innerText || el.textContent).toLowerCase();
            if (txt === lowerTarget) return el;
          }
          for (const el of candidates) {
            if (!isVisible(el)) continue;
            const txt = clean(el.innerText || el.textContent).toLowerCase();
            if (txt && (txt.startsWith(lowerTarget) || lowerTarget.startsWith(txt))) return el;
          }
          for (const el of candidates) {
            if (!isVisible(el)) continue;
            const txt = clean(el.innerText || el.textContent).toLowerCase();
            if (txt && (txt.includes(lowerTarget) || lowerTarget.includes(txt))) return el;
          }

          // 7. Heuristic interactivity (SiteLegend / Browserius / Browser-use)
          const allDivs = Array.from(document.querySelectorAll('div, span, p, li, td, th'));
          for (const el of allDivs) {
            if (!isVisible(el)) continue;
            const style = window.getComputedStyle(el);
            const hasPointer = style.cursor === 'pointer';
            const hasClass = /\b(btn|button|clickable|menu-item|item|entry|link|submit|search)\b/i.test(el.className || '');
            if (hasPointer || hasClass || el.onclick) {
              const txt = clean(el.innerText || el.textContent).toLowerCase();
              if (txt === lowerTarget || (txt && txt.includes(lowerTarget) && txt.length < 90)) {
                const btnParent = el.closest('button, a, [role="button"]');
                return btnParent || el;
              }
            }
          }

          // 8. Input fallback
          if (isInputOnly) {
            if (document.activeElement && (
              document.activeElement.tagName === 'INPUT' ||
              document.activeElement.tagName === 'TEXTAREA' ||
              document.activeElement.isContentEditable
            )) {
              return document.activeElement;
            }
            const visibleInputs = candidates.filter(c => {
              if (!isVisible(c)) return false;
              const type = (c.getAttribute('type') || '').toLowerCase();
              return type !== 'hidden' && type !== 'submit' && type !== 'button' && type !== 'checkbox' && type !== 'radio';
            });
            if (visibleInputs.length === 1) return visibleInputs[0];
          }

          return null;
        }

        const el = findInteractiveElement(targetSelector, false);
        if (!el) {
          return `Element not found: "${targetSelector}". Continuing with an alternative action.`;
        }

        el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });

        // Highlight ring animation for visual feedback
        const prevOutline = el.style.outline;
        const prevBoxShadow = el.style.boxShadow;
        el.style.outline = '3px solid #38bdf8';
        el.style.boxShadow = '0 0 16px rgba(56, 189, 248, 0.85)';
        setTimeout(() => {
          el.style.outline = prevOutline;
          el.style.boxShadow = prevBoxShadow;
        }, 1200);

        const isTextInput = el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable;
        if (isTextInput) {
          el.focus();
          if (typeof el.select === 'function') el.select();
        }

        const rect = el.getBoundingClientRect();
        const clientX = rect.left + rect.width / 2;
        const clientY = rect.top + rect.height / 2;
        const eventInit = { bubbles: true, cancelable: true, view: window, clientX, clientY };

        el.dispatchEvent(new PointerEvent('pointerdown', eventInit));
        el.dispatchEvent(new MouseEvent('mousedown', eventInit));
        if (isTextInput) el.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
        el.dispatchEvent(new PointerEvent('pointerup', eventInit));
        el.dispatchEvent(new MouseEvent('mouseup', eventInit));
        el.dispatchEvent(new MouseEvent('click', eventInit));

        try {
          el.click();
        } catch (e) {}

        const label = el.innerText || el.value || el.getAttribute('placeholder') || el.getAttribute('aria-label') || targetSelector;
        return `Click performed on "${(label || targetSelector).slice(0, 45)}"`;
      },
      args: [target],
    }).catch(e => [{ result: `Click failed: ${e.message}` }]);

    const res = execResults?.[0];
    return res?.result || 'Click command executed';
  } catch (e) {
    return `Click failed: ${e.message}`;
  }
}

async function executeTypeAction(tabId, target, value) {
  try {
    const tab = await chrome.tabs.get(tabId).catch(() => null);
    if (isRestrictedUrl(tab?.url)) {
      return 'Action omitted: not permitted on internal Chrome pages';
    }
    const execResults = await chrome.scripting.executeScript({
      target: { tabId },
      func: async (targetSelector, textToType) => {
        function findInteractiveElement(target, isInputOnly = true) {
          if (!target && !isInputOnly) return null;
          const rawTarget = String(target || '').trim();
          const lowerTarget = rawTarget.toLowerCase();

          function isVisible(el) {
            if (!el || el.nodeType !== Node.ELEMENT_NODE) return false;
            const style = window.getComputedStyle(el);
            if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
            const rect = el.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0;
          }

          function clean(str) {
            return (str || '').replace(/\s+/g, ' ').trim();
          }

          // 1. Index match ([12], #12, 12, el-12)
          const indexMatch = rawTarget.match(/^(?:\[|#|el-)?(\d+)(?:\])?$/);
          if (indexMatch) {
            const idx = parseInt(indexMatch[1], 10);
            const indexedEl = document.querySelector(`[data-highlight-index="${idx}"], [data-index="${idx}"], [highlight-index="${idx}"]`);
            if (indexedEl && isVisible(indexedEl)) return indexedEl;
            if (window.__antigravity_dom_map && window.__antigravity_dom_map.has(idx)) {
              const el = window.__antigravity_dom_map.get(idx);
              if (el && isVisible(el)) return el;
            }
          }

          // 2. Safe CSS selector
          if (rawTarget && !rawTarget.includes('\n')) {
            try {
              const el = document.querySelector(rawTarget);
              if (el && isVisible(el)) return el;
            } catch (e) {}
          }

          // 3. XPath locator
          if (rawTarget.startsWith('/') || rawTarget.startsWith('./') || rawTarget.startsWith('(') || rawTarget.startsWith('xpath=')) {
            try {
              const cleanXpath = rawTarget.replace(/^xpath=/i, '');
              const res = document.evaluate(cleanXpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
              if (res.singleNodeValue && isVisible(res.singleNodeValue)) return res.singleNodeValue;
            } catch (e) {}
          }

          const candidates = Array.from(document.querySelectorAll('input:not([type="hidden"]), textarea, [contenteditable="true"], [role="textbox"], [role="searchbox"], [role="combobox"], select'));

          // 4. Semantic attribute match (id, name, placeholder, aria-label, data-testid, title, alt, value)
          for (const el of candidates) {
            if (!isVisible(el)) continue;
            const id = (el.id || '').toLowerCase();
            const name = (el.getAttribute('name') || '').toLowerCase();
            const ph = (el.getAttribute('placeholder') || '').toLowerCase();
            const aria = (el.getAttribute('aria-label') || '').toLowerCase();
            const testId = (el.getAttribute('data-testid') || el.getAttribute('data-qa') || el.getAttribute('data-cy') || '').toLowerCase();
            const title = (el.getAttribute('title') || '').toLowerCase();
            const alt = (el.getAttribute('alt') || '').toLowerCase();
            const val = (el.value || '').toLowerCase();

            if (id === lowerTarget || name === lowerTarget || ph === lowerTarget || aria === lowerTarget || testId === lowerTarget || title === lowerTarget || val === lowerTarget) {
              return el;
            }
            if ((ph && ph.includes(lowerTarget)) || (aria && aria.includes(lowerTarget)) || (name && name.includes(lowerTarget)) || (title && title.includes(lowerTarget)) || (testId && testId.includes(lowerTarget)) || (alt && alt.includes(lowerTarget))) {
              return el;
            }
          }

          // 5. Associated <label> match
          const labels = Array.from(document.querySelectorAll('label'));
          for (const lbl of labels) {
            if (!isVisible(lbl)) continue;
            const lblText = clean(lbl.innerText).toLowerCase();
            if (lblText.includes(lowerTarget) || lowerTarget.includes(lblText)) {
              if (lbl.htmlFor) {
                const inp = document.getElementById(lbl.htmlFor);
                if (inp && isVisible(inp)) return inp;
              }
              const innerInp = lbl.querySelector('input, textarea, select');
              if (innerInp && isVisible(innerInp)) return innerInp;
            }
          }

          // 6. Smart visible text match
          for (const el of candidates) {
            if (!isVisible(el)) continue;
            const txt = clean(el.innerText || el.textContent).toLowerCase();
            if (txt === lowerTarget || txt.startsWith(lowerTarget) || txt.includes(lowerTarget)) return el;
          }

          // 7. Input fallback
          if (document.activeElement && (
            document.activeElement.tagName === 'INPUT' ||
            document.activeElement.tagName === 'TEXTAREA' ||
            document.activeElement.isContentEditable
          )) {
            return document.activeElement;
          }
          const visibleInputs = candidates.filter(c => {
            if (!isVisible(c)) return false;
            const type = (c.getAttribute('type') || '').toLowerCase();
            return type !== 'hidden' && type !== 'submit' && type !== 'button' && type !== 'checkbox' && type !== 'radio';
          });
          if (visibleInputs.length === 1) return visibleInputs[0];

          return null;
        }

        const el = findInteractiveElement(targetSelector, true);
        if (!el) {
          return `Text field not found: "${targetSelector}". Continuing with another action.`;
        }

        el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
        el.focus();
        if (typeof el.select === 'function') {
          try { el.select(); } catch (e) {}
        }

        // Brief natural hesitation upon focusing field
        await new Promise(r => setTimeout(r, 200 + Math.random() * 250));

        const rawText = textToType || '';
        const hasEnter = rawText.endsWith('\n') || rawText.includes('\n');
        const cleanText = rawText.replace(/\r?\n$/, '');

        // Flash outline ring for visual feedback
        const prevOutline = el.style.outline;
        el.style.outline = '3px solid #38bdf8';
        setTimeout(() => { el.style.outline = prevOutline; }, 1200);

        if (el.isContentEditable) {
          document.execCommand('selectAll', false, null);
          const chars = Array.from(cleanText);
          for (let i = 0; i < chars.length; i++) {
            const ch = chars[i];
            document.execCommand('insertText', false, ch);
            el.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true, inputType: 'insertText', data: ch }));

            // Human typing rhythm
            let delay = 45 + Math.random() * 55;
            if (ch === ' ') delay = 110 + Math.random() * 90;
            else if (ch === '.' || ch === ',' || ch === '?' || ch === '!') delay = 200 + Math.random() * 150;
            else if (i > 0 && i % 20 === 0) delay = 180 + Math.random() * 140;
            await new Promise(r => setTimeout(r, delay));
          }
          el.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
        } else {
          const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
          const descriptor = Object.getOwnPropertyDescriptor(proto, 'value');

          const chars = Array.from(cleanText);
          let currentTyped = '';

          for (let i = 0; i < chars.length; i++) {
            const ch = chars[i];
            currentTyped += ch;

            if (descriptor && descriptor.set) {
              descriptor.set.call(el, currentTyped);
            } else {
              el.value = currentTyped;
            }

            try {
              el.dispatchEvent(new InputEvent('beforeinput', {
                bubbles: true,
                cancelable: true,
                inputType: 'insertText',
                data: ch,
              }));
            } catch (e) {}

            el.dispatchEvent(new InputEvent('input', {
              bubbles: true,
              composed: true,
              inputType: 'insertText',
              data: ch,
            }));

            const keyInit = { key: ch, bubbles: true, cancelable: true };
            el.dispatchEvent(new KeyboardEvent('keydown', keyInit));
            el.dispatchEvent(new KeyboardEvent('keyup', keyInit));

            // Human typing cadence: realistic letter by letter with natural variances
            let delay = 45 + Math.random() * 55;
            if (ch === ' ') {
              delay = 110 + Math.random() * 90;
            } else if (ch === '.' || ch === ',' || ch === '?' || ch === '!') {
              delay = 200 + Math.random() * 150;
            } else if (i > 0 && i % 20 === 0) {
              delay = 180 + Math.random() * 140;
            }
            await new Promise(r => setTimeout(r, delay));
          }

          el.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
        }

        if (hasEnter) {
          // Human hesitation before pressing Enter to submit
          await new Promise(r => setTimeout(r, 300 + Math.random() * 250));
          const enterDown = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'Enter', code: 'Enter', keyCode: 13, which: 13 });
          const enterUp = new KeyboardEvent('keyup', { bubbles: true, cancelable: true, key: 'Enter', code: 'Enter', keyCode: 13, which: 13 });
          el.dispatchEvent(enterDown);
          el.dispatchEvent(enterUp);

          if (el.form && typeof el.form.requestSubmit === 'function') {
            try { el.form.requestSubmit(); } catch (e) {}
          }
        }

        const label = el.getAttribute('placeholder') || el.getAttribute('name') || el.id || targetSelector;
        return `Typed text in field "${label}": "${cleanText.slice(0, 30)}"`;
      },
      args: [target, value || ''],
    }).catch(e => [{ result: `Typing failed: ${e.message}` }]);

    const res = execResults?.[0];
    return res?.result || 'Typing command executed';
  } catch (e) {
    return `Typing failed: ${e.message}`;
  }
}

async function executeScrollAction(tabId, direction) {
  try {
    const tab = await chrome.tabs.get(tabId).catch(() => null);
    if (isRestrictedUrl(tab?.url)) {
      return 'Action omitted: not permitted on internal Chrome pages';
    }
    await chrome.scripting.executeScript({
      target: { tabId },
      func: (dir) => {
        const delta = dir === 'up' ? -window.innerHeight * 0.7 : window.innerHeight * 0.7;
        window.scrollBy({ top: delta, behavior: 'smooth' });
      },
      args: [direction],
    }).catch(() => null);

    return `Scrolled ${direction === 'up' ? 'up' : 'down'}`;
  } catch (e) {
    return `Scroll failed: ${e.message}`;
  }
}

// ─── Active Browser MCP Bridge Engine (Local Agent Control) ─────────────────
let mcpBridgePollerActive = false;
let mcpBridgeAbortController = null;

async function startMcpBridgePoller() {
  if (mcpBridgePollerActive) return;
  mcpBridgePollerActive = true;
  mcpBridgeAbortController = new AbortController();

  console.log('[MCP Bridge] Starting active browser action listener...');

  while (mcpBridgePollerActive) {
    try {
      const settings = await getSettings();
      if (!settings.localMcpBridgeEnabled) {
        mcpBridgePollerActive = false;
        break;
      }

      const bridgeUrl = (settings.bridgeUrl || DEFAULT_BRIDGE_URL).replace(/\/+$/, '');
      const resp = await fetch(`${bridgeUrl}/api/mcp/pending_actions?timeout=15`, {
        signal: mcpBridgeAbortController?.signal,
      }).catch(() => null);

      if (!resp || !resp.ok) {
        // Model bridge might be offline; pause before retrying
        await new Promise((r) => setTimeout(r, 3000));
        continue;
      }

      const data = await resp.json().catch(() => null);
      if (data && data.has_action && data.action) {
        const actionItem = data.action;
        console.log('[MCP Bridge] Received action from local agent:', actionItem);
        // Execute asynchronously so the poller doesn't get blocked
        handleMcpAction(actionItem, bridgeUrl).catch((err) => {
          console.error('[MCP Bridge] Error handling action:', err);
        });
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        break;
      }
      console.warn('[MCP Bridge] Polling error:', err);
      await new Promise((r) => setTimeout(r, 4000));
    }
  }

  mcpBridgePollerActive = false;
  console.log('[MCP Bridge] Active browser action listener stopped.');
}

function stopMcpBridgePoller() {
  mcpBridgePollerActive = false;
  if (mcpBridgeAbortController) {
    try {
      mcpBridgeAbortController.abort();
    } catch (_) {}
    mcpBridgeAbortController = null;
  }
}

async function handleMcpAction(actionItem, bridgeUrl) {
  const { action_id, action, params } = actionItem;
  let result = null;
  let error = null;

  try {
    switch (action) {
      case 'get_active_tab':
      case 'browser_get_active_tab': {
        const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
        if (!tab) throw new Error('No active browser tab found');

        const pageData = {
          id: tab.id,
          title: tab.title || '',
          url: tab.url || '',
          status: tab.status,
          textSnippet: '',
          headings: [],
        };

        if (!isRestrictedUrl(tab.url)) {
          try {
            const [evalRes] = await chrome.scripting.executeScript({
              target: { tabId: tab.id },
              func: () => ({
                text: document.body ? document.body.innerText.slice(0, 5000) : '',
                headings: Array.from(document.querySelectorAll('h1, h2, h3'))
                  .slice(0, 10)
                  .map((h) => h.innerText.trim())
                  .filter(Boolean),
              }),
            });
            if (evalRes?.result) {
              pageData.textSnippet = evalRes.result.text;
              pageData.headings = evalRes.result.headings;
            }
          } catch (_) {}
        }
        result = pageData;
        break;
      }

      case 'navigate':
      case 'browser_navigate': {
        let destUrl = params?.url || '';
        if (!destUrl) throw new Error('Missing url parameter');
        if (!/^https?:\/\//i.test(destUrl)) destUrl = 'https://' + destUrl;
        const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
        if (tab?.id) {
          await chrome.tabs.update(tab.id, { url: destUrl });
          result = { success: true, navigatedTo: destUrl, tabId: tab.id };
        } else {
          const newTab = await chrome.tabs.create({ url: destUrl });
          result = { success: true, createdTabId: newTab.id, navigatedTo: destUrl };
        }
        break;
      }

      case 'click':
      case 'browser_click': {
        const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
        if (!tab?.id) throw new Error('No active browser tab found to click');
        const selector = params?.selector || '';
        if (!selector) throw new Error('Missing selector parameter');
        const clickRes = await executeClickAction(tab.id, selector);
        result = { success: true, clicked: selector, details: clickRes };
        break;
      }

      case 'type':
      case 'browser_type': {
        const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
        if (!tab?.id) throw new Error('No active browser tab found to type');
        const selector = params?.selector || '';
        const text = params?.text !== undefined ? String(params.text) : '';
        if (!selector) throw new Error('Missing selector parameter');
        const typeRes = await executeTypeAction(tab.id, selector, text);
        result = { success: true, selector, text, details: typeRes };
        break;
      }

      case 'screenshot':
      case 'browser_screenshot': {
        const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
        if (!tab) throw new Error('No active tab to capture');
        const screenshotDataUrl = await chrome.tabs.captureVisibleTab(null, { format: 'png' });
        result = { success: true, screenshot: screenshotDataUrl };
        break;
      }

      case 'browser_task': {
        const goal = params?.goal || '';
        const mode = params?.mode || 'cowork';
        if (!goal) throw new Error('Missing goal parameter');

        let [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
        if (!tab || !tab.id) {
          const tabs = await chrome.tabs.query({ active: true });
          tab = tabs[0];
        }
        if (!tab || !tab.id) {
          throw new Error('No active browser tab found to execute task');
        }

        const taskId = 'mcp-task-' + Date.now();
        const sessionId = 'mcp-session-' + Date.now();
        const settings = await getSettings();
        const modelName = settings.selectedModel || DEFAULT_MODEL;

        if (mode === 'chat') {
          result = await new Promise(async (resolve, reject) => {
            let finalContent = '';
            const listener = (msg) => {
              if (msg.taskId === taskId) {
                if (msg.type === 'token') {
                  finalContent += msg.token;
                } else if (msg.type === 'chat_complete') {
                  removeInternalListener(listener);
                  resolve({ taskId, content: finalContent || msg.content });
                } else if (msg.type === 'task_error') {
                  removeInternalListener(listener);
                  reject(new Error(msg.error || 'Chat task failed'));
                }
              }
            };
            addInternalListener(listener);
            handleChatStream(taskId, sessionId, goal, modelName, false, tab.id).catch((err) => {
              removeInternalListener(listener);
              reject(err);
            });
          });
        } else {
          result = await new Promise(async (resolve, reject) => {
            const listener = (msg) => {
              if (msg.taskId === taskId) {
                if (msg.type === 'task_complete') {
                  removeInternalListener(listener);
                  resolve({
                    taskId,
                    status: 'completed',
                    steps: msg.steps || [],
                    summary: msg.summary || 'Task completed successfully',
                  });
                } else if (msg.type === 'task_error') {
                  removeInternalListener(listener);
                  reject(new Error(msg.error || 'Cowork task failed'));
                } else if (msg.type === 'task_aborted') {
                  removeInternalListener(listener);
                  reject(new Error('Task was aborted'));
                }
              }
            };
            addInternalListener(listener);
            handleCoworkTask(taskId, sessionId, goal, modelName, tab.id).catch((err) => {
              removeInternalListener(listener);
              reject(err);
            });
          });
        }
        break;
      }

      default:
        throw new Error(`Unsupported browser action: ${action}`);
    }
  } catch (e) {
    error = e.message || String(e);
  }

  // Report result back to Model Bridge
  const payload = {
    action_id,
    status: error ? 'error' : 'ok',
    result: error ? null : result,
    error: error || null,
  };

  try {
    await fetch(`${bridgeUrl}/api/mcp/action_result`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (postErr) {
    console.warn('[MCP Bridge] Failed to post action result to bridge:', postErr);
  }
}

// ─── Session Persistence ───────────────────────────────────────────────────
function cleanPromptForHistory(text) {
  if (!text || typeof text !== 'string') return '';
  return text
    .replace(/<active_session_files>[\s\S]*?<\/active_session_files>/gi, '')
    .replace(/\[Instrucción de archivos:[\s\S]*?\]/gi, '')
    .replace(/<nano_attached_files>[\s\S]*?<\/nano_attached_files>/gi, '')
    .replace(/<approval_response>[\s\S]*?<\/approval_response>/gi, '')
    .trim();
}

async function appendMessageToSession(sessionId, message) {
  const sessions = await getSessions();
  let session = sessions.find(s => s.id === sessionId);
  if (!session) {
    const cleanContent = cleanPromptForHistory(message.content || '');
    session = {
      id: sessionId,
      title: cleanContent ? (cleanContent.replace(/^\/\S+\s*/, '').slice(0, 35) + '...') : 'New Chat',
      folder: 'General',
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    sessions.unshift(session);
  }
  if (!session.folder) session.folder = 'General';
  session.messages.push(message);
  session.updatedAt = Date.now();
  await saveSessions(sessions);
}

// ─── Port Connection Listener (Side Panel communication) ───────────────────
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'antigravity-panel') {
    activePorts.add(port);

    // Send immediate initial handshake status
    (async () => {
      const settings = await getSettings();
      const sessions = await getSessions();
      const activeId = await getActiveSessionId();
      
      port.postMessage({
        type: 'init_state',
        bridgeOnline,
        models: availableModels,
        quota: cachedCliQuota,
        settings,
        sessions,
        activeSessionId: activeId,
        runningTask: runningTask ? {
          taskId: runningTask.taskId,
          sessionId: runningTask.sessionId,
          mode: runningTask.mode,
          status: runningTask.status,
          tabId: runningTask.tabId,
          plan: runningTask.plan || null,
          intro: runningTask.intro || '',
          fullAnswer: runningTask.fullAnswer || '',
          steps: runningTask.steps || [],
        } : null,
      });
    })();

    port.onMessage.addListener(async (msg) => {
      try {
        switch (msg.type) {
          case 'heartbeat':
          case 'ping': {
            try {
              port.postMessage({ type: 'pong', timestamp: Date.now() });
            } catch (_) {}
            break;
          }

          case 'ping_bridge': {
            const ok = await checkBridgeHealth();
            port.postMessage({ type: 'bridge_status', online: ok, models: availableModels, quota: cachedCliQuota });
            break;
          }

          case 'refresh_quota': {
            const settings = await getSettings();
            const base = settings.bridgeUrl.replace(/\/+$/, '');
            const quota = await fetchBridgeQuota(base, true);
            port.postMessage({ type: 'quota_update', quota });
            break;
          }

          case 'start_chat': {
            const tab = await getActiveWebTab();
            const textToSave = msg.displayPrompt || cleanPromptForHistory(msg.userText);
            await appendMessageToSession(msg.sessionId, {
              role: 'user',
              content: textToSave,
              timestamp: Date.now(),
              hasScreenshot: !!msg.includeScreenshot,
            });
            handleChatStream(msg.taskId, msg.sessionId, msg.userText, msg.modelName, msg.includeScreenshot, tab?.id || null, msg.thinkingEffort);
            break;
          }

          case 'start_cowork': {
            let tab = await getActiveWebTab();
            tab = await ensureUsableTabForCowork(tab);
            if (!tab?.id) {
              return port.postMessage({
                type: 'task_error',
                error: 'No active web tab detected for Cowork. Please open a web page (e.g. google.com) and try again.',
              });
            }

            const textToSave = msg.displayGoal || cleanPromptForHistory(msg.goalText);
            await appendMessageToSession(msg.sessionId, {
              role: 'user',
              content: textToSave,
              timestamp: Date.now(),
              mode: 'cowork',
            });
            handleCoworkTask(msg.taskId, msg.sessionId, msg.goalText, msg.modelName, tab.id, msg.thinkingEffort);
            break;
          }

          case 'ensure_usable_tab': {
            const tab = await getActiveWebTab();
            await ensureUsableTabForCowork(tab);
            break;
          }

          case 'cancel_task': {
            if (runningTask && runningTask.abortController) {
              runningTask.abortController.abort();
            }
            break;
          }

          case 'user_intervention': {
            handleUserIntervention(msg.text);
            break;
          }

          case 'pause_cowork_task': {
            await pauseCoworkTask(msg.reason || 'user_pause');
            break;
          }

          case 'resume_cowork_task': {
            await resumeCoworkTask();
            break;
          }

          case 'save_settings': {
            await saveSettings(msg.settings);
            await checkBridgeHealth();
            break;
          }

          case 'set_active_session': {
            await setActiveSessionId(msg.sessionId);
            break;
          }

          case 'delete_session': {
            let sessions = await getSessions();
            sessions = sessions.filter(s => s.id !== msg.sessionId);
            await saveSessions(sessions);
            break;
          }

          case 'rename_session': {
            let sessions = await getSessions();
            const session = sessions.find(s => s.id === msg.sessionId);
            if (session) {
              session.title = (msg.title || session.title).trim();
              session.updatedAt = Date.now();
              await saveSessions(sessions);
            }
            break;
          }

          case 'update_session_folder': {
            let sessions = await getSessions();
            const session = sessions.find(s => s.id === msg.sessionId);
            if (session) {
              session.folder = msg.folder || 'General';
              session.updatedAt = Date.now();
              await saveSessions(sessions);
            }
            break;
          }

          case 'update_session': {
            let sessions = await getSessions();
            const idx = sessions.findIndex(s => s.id === msg.session?.id);
            if (idx >= 0) {
              sessions[idx] = { ...sessions[idx], ...msg.session, updatedAt: Date.now() };
              await saveSessions(sessions);
            }
            break;
          }
        }
      } catch (err) {
        console.error('Error handling port message:', err);
      }
    });

    port.onDisconnect.addListener(() => {
      const _err = chrome.runtime.lastError;
      activePorts.delete(port);
      // NOTE: We DO NOT cancel runningTask when the side panel is closed!
      // This guarantees background execution continues and saves results.
    });
  }
});

// ─── Popup Window Management ────────────────────────────────────────────────
let popupWindowId = null;

if (chrome.windows && chrome.windows.onRemoved) {
  chrome.windows.onRemoved.addListener((winId) => {
    if (winId === popupWindowId) {
      popupWindowId = null;
    }
  });
}

async function openOrFocusPopupWindow() {
  if (popupWindowId !== null) {
    try {
      const win = await chrome.windows.get(popupWindowId);
      if (win) {
        await chrome.windows.update(popupWindowId, { focused: true, state: 'normal' });
        return popupWindowId;
      }
    } catch {
      popupWindowId = null;
    }
  }

  const currentWin = await chrome.windows.getCurrent().catch(() => null);
  const width = 430;
  const height = 750;
  let left = currentWin ? currentWin.left + currentWin.width - width - 20 : 1000;
  let top = currentWin ? currentWin.top + 60 : 100;

  try {
    const win = await chrome.windows.create({
      url: chrome.runtime.getURL('side-panel/index.html?mode=popup'),
      type: 'popup',
      width,
      height,
      left: Math.max(0, left),
      top: Math.max(0, top),
      focused: true,
    });
    popupWindowId = win.id;
    return win.id;
  } catch (err) {
    console.warn('Error creating popup window:', err);
    return null;
  }
}

// ─── Selection Ask, Shortcuts & Fragment Picker Listeners from Web Pages ─────
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'CHECK_ACTIVE_TASK') {
    const tabId = sender.tab?.id;
    const isActive = runningTask && runningTask.status === 'running' && (runningTask.tabId === tabId);
    sendResponse?.({
      isRunning: !!isActive,
      active: !!isActive,
      title: runningTask?.overlayTitle || 'Autono is working',
      status: runningTask?.status,
    });
    return true;
  }

  if (message?.type === 'update_extension_icon') {
    updateExtensionIcon(message.model);
    sendResponse?.({ success: true });
    return true;
  }

  if (message?.type === 'user_intervention') {
    handleUserIntervention(message.text);
    sendResponse?.({ success: true });
    return true;
  }

  if (message?.type === 'AGENT_WORK_PAUSED' || message?.type === 'pause_cowork_task') {
    if (message.type === 'AGENT_WORK_PAUSED') {
      if (message.paused) {
        pauseCoworkTask('user_overlay');
      } else {
        resumeCoworkTask();
      }
    } else {
      pauseCoworkTask(message.reason || 'user_action');
    }
    sendResponse?.({ success: true });
    return true;
  }

  if (message?.type === 'resume_cowork_task') {
    resumeCoworkTask();
    sendResponse?.({ success: true });
    return true;
  }

  if (message?.type === 'open_side_panel') {
    (async () => {
      try {
        const settings = await getSettings();
        if (settings.displayMode === 'popup') {
          // Open or focus dedicated popup window
          await openOrFocusPopupWindow();
        } else {
          // Try standard sidePanel.open
          let opened = false;
          if (sender.tab?.id && chrome.sidePanel?.open) {
            try {
              await chrome.sidePanel.open({ tabId: sender.tab.id });
              opened = true;
            } catch (gestureErr) {
              console.warn('sidePanel.open gesture restriction:', gestureErr);
            }
          }
          if (!opened && chrome.sidePanel?.open) {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tab?.id) {
              try {
                await chrome.sidePanel.open({ tabId: tab.id });
                opened = true;
              } catch (gestureErr) {
                console.warn('sidePanel.open fallback error:', gestureErr);
              }
            }
          }
          // Fallback: If sidePanel.open was rejected by Chrome (e.g. no user gesture),
          // immediately open the popup window so 09 ALWAYS displays the interface!
          if (!opened) {
            await openOrFocusPopupWindow();
          }
        }
      } catch (err) {
        console.warn('Error opening side panel or popup:', err);
      }
    })();
    sendResponse?.({ success: true });
    return true;
  }

  if (message?.type === 'close_side_panel') {
    (async () => {
      try {
        // 1. Close popup window if open
        if (popupWindowId !== null) {
          await chrome.windows.remove(popupWindowId).catch(() => null);
          popupWindowId = null;
        }

        // 2. Broadcast to active side panel ports to call window.close()
        broadcastMessage({ type: 'close_side_panel' });

        // 3. Close side panel natively if supported
        if (chrome.sidePanel && typeof chrome.sidePanel.close === 'function') {
          if (sender.tab?.id) {
            await chrome.sidePanel.close({ tabId: sender.tab.id }).catch(() => null);
          }
          const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
          if (tab?.id) {
            await chrome.sidePanel.close({ tabId: tab.id }).catch(() => null);
          }
          if (tab?.windowId) {
            await chrome.sidePanel.close({ windowId: tab.windowId }).catch(() => null);
          }
        }
      } catch (err) {
        console.warn('Error closing side panel or popup:', err);
      }
    })();
    sendResponse?.({ success: true });
    return true;
  }

  if (message?.type === 'antigravity_ask_selection' || message?.type === 'zylo_ask_selection') {
    (async () => {
      if (sender.tab?.id && chrome.sidePanel?.open) {
        await chrome.sidePanel.open({ tabId: sender.tab.id }).catch(() => null);
      }
      broadcastMessage({
        type: 'preset_prompt',
        selectedText: message.text,
        text: `Respecto a este fragmento seleccionado: "${message.text}"\n\n`,
        url: message.url,
        title: message.title,
      });
    })();
    return true;
  }

  if (message?.type === 'antigravity_picked_fragment' || message?.type === 'zylo_picked_fragment') {
    broadcastMessage({
      type: 'page_fragment_picked',
      text: message.text,
      element: message.element,
      url: message.url,
      title: message.title,
    });
    return true;
  }

  if (message?.type === 'antigravity_picker_cancelled' || message?.type === 'zylo_picker_cancelled') {
    broadcastMessage({
      type: 'page_picker_cancelled',
    });
    return true;
  }

  if (message?.type === 'zylo_group_tabs' && Array.isArray(message.tabIds)) {
    chrome.tabs.group({ tabIds: message.tabIds }).catch(() => null);
    return true;
  }
});

// ─── Chrome Commands Listener (Ctrl+Alt+C) ──────────────────────────────────
if (chrome.commands && chrome.commands.onCommand) {
  chrome.commands.onCommand.addListener(async (command) => {
    if (command === '_execute_action' || command === 'open_side_panel') {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab?.id && chrome.sidePanel?.open) {
          await chrome.sidePanel.open({ tabId: tab.id });
        }
      } catch (err) {
        console.warn('Error opening side panel from command:', err);
      }
    }
  });
}

// ─── Service Worker Keepalive Alarm ─────────────────────────────────────────
if (chrome.alarms) {
  try {
    chrome.alarms.create('autono_sw_keepalive', { periodInMinutes: 1 });
    chrome.alarms.onAlarm.addListener((alarm) => {
      if (alarm.name === 'autono_sw_keepalive') {
        checkBridgeHealth().catch(() => null);
        getSettings().then((s) => {
          if (s.localMcpBridgeEnabled && !mcpBridgePollerActive) {
            startMcpBridgePoller();
          }
        }).catch(() => null);
      }
    });
  } catch (_) {}
}

// ─── Storage Changes Listener for MCP Bridge ───────────────────────────────
if (chrome.storage && chrome.storage.onChanged) {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.autono_local_mcp_bridge_enabled) {
      if (changes.autono_local_mcp_bridge_enabled.newValue) {
        startMcpBridgePoller();
      } else {
        stopMcpBridgePoller();
      }
    }
  });
}

// Start MCP poller on initial boot if enabled
getSettings().then((s) => {
  if (s.localMcpBridgeEnabled) {
    startMcpBridgePoller();
  }
}).catch(() => null);

console.log('⚡ Autono background service worker initialized with Active Browser MCP Bridge support');
