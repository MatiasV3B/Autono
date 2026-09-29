/**
 * Antigravity Agent - Options Controller
 */

(function () {
  'use strict';

  const bridgeUrlInput = document.getElementById('bridgeUrl');
  const defaultModelSelect = document.getElementById('defaultModel');
  const tempInput = document.getElementById('temperature');
  const tempValue = document.getElementById('tempValue');
  const maxOutputTokensInput = document.getElementById('maxOutputTokens');
  const maxStepsInput = document.getElementById('maxSteps');
  const bridgeStatusNotice = document.getElementById('bridgeStatusNotice');
  const testConnectionBtn = document.getElementById('testConnectionBtn');
  const limitSonnetInput = document.getElementById('limitSonnet');
  const limitOpusInput = document.getElementById('limitOpus');
  const limitGptInput = document.getElementById('limitGpt');
  const saveBtn = document.getElementById('saveBtn');
  const savedNotice = document.getElementById('savedNotice');

  tempInput.addEventListener('input', () => {
    tempValue.textContent = `${parseFloat(tempInput.value).toFixed(2)}`;
  });

  async function loadSettings() {
    const data = await chrome.storage.local.get(['antigravity_settings', 'antigravity_custom_limits']);
    const s = data.antigravity_settings || {};
    const limits = data.antigravity_custom_limits || {};

    if (s.bridgeUrl) bridgeUrlInput.value = s.bridgeUrl;
    if (s.selectedModel) defaultModelSelect.value = s.selectedModel;
    if (s.temperature !== undefined) {
      tempInput.value = s.temperature;
      tempValue.textContent = `${parseFloat(s.temperature).toFixed(2)}`;
    }
    if (s.maxSteps) maxStepsInput.value = s.maxSteps;
    if (s.maxOutputTokens && maxOutputTokensInput) {
      maxOutputTokensInput.value = s.maxOutputTokens;
    }

    if (limitSonnetInput) limitSonnetInput.value = limits['claude-sonnet-4-6'] || 45;
    if (limitOpusInput) limitOpusInput.value = limits['claude-opus-4-6-thinking'] || 20;
    if (limitGptInput) limitGptInput.value = limits['gpt-oss-120b-medium'] || 80;

    await testBridge();
  }

  async function testBridge() {
    const url = bridgeUrlInput.value.trim().replace(/\/+$/, '');
    bridgeStatusNotice.textContent = `Probando ${url}...`;
    bridgeStatusNotice.className = 'status-notice';

    try {
      const res = await fetch(`${url}/health`, { signal: AbortSignal.timeout(3000) });
      if (res.ok) {
        const json = await res.json();
        bridgeStatusNotice.textContent = `🟢 Antigravity Bridge Activo (${json.service || 'Conectado'})`;
        bridgeStatusNotice.className = 'status-notice online';
        return true;
      }
    } catch {
      // try fallback
      try {
        const res2 = await fetch(`${url}/v1/models`, { signal: AbortSignal.timeout(3000) });
        if (res2.ok) {
          bridgeStatusNotice.textContent = `🟢 Antigravity Bridge Activo (OpenAI Gateway)`;
          bridgeStatusNotice.className = 'status-notice online';
          return true;
        }
      } catch {
        // fail
      }
    }

    bridgeStatusNotice.textContent = `🔴 No se pudo conectar a ${url}. Asegúrate de que Iniciar-AntigravityBridge.bat esté corriendo.`;
    bridgeStatusNotice.className = 'status-notice offline';
    return false;
  }

  async function saveSettings() {
    const settings = {
      bridgeUrl: bridgeUrlInput.value.trim() || 'http://127.0.0.1:8000',
      selectedModel: defaultModelSelect.value,
      temperature: parseFloat(tempInput.value),
      maxSteps: parseInt(maxStepsInput.value, 10) || 20,
      maxOutputTokens: parseInt(maxOutputTokensInput.value, 10) || 65536,
    };

    const customLimits = {
      'claude-sonnet-4-6': parseInt(limitSonnetInput.value, 10) || 45,
      'claude-opus-4-6-thinking': parseInt(limitOpusInput.value, 10) || 20,
      'gpt-oss-120b-medium': parseInt(limitGptInput.value, 10) || 80,
    };

    await chrome.storage.local.set({
      antigravity_settings: settings,
      antigravity_custom_limits: customLimits,
    });

    savedNotice.classList.remove('hidden');
    setTimeout(() => {
      savedNotice.classList.add('hidden');
    }, 2500);

    await testBridge();
  }

  testConnectionBtn.addEventListener('click', testBridge);
  saveBtn.addEventListener('click', saveSettings);

  loadSettings();
})();
