/**
 * Antigravity Agent - DOM & Screen Extractor
 * Fast, structured screen serialization for ultra-fast Chat mode without heavy image processing.
 */

(function () {
  'use strict';

  function cleanText(str) {
    if (!str) return '';
    return str.replace(/\s+/g, ' ').trim();
  }

  function isVisible(el) {
    if (!el || el.nodeType !== Node.ELEMENT_NODE) return false;
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
      return false;
    }
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function extractScreenJSON(maxTextLength = 65536) {
    const title = document.title || '';
    const url = window.location.href;

    // 1. Meta information
    const meta = {};
    document.querySelectorAll('meta[name], meta[property]').forEach(tag => {
      const name = tag.getAttribute('name') || tag.getAttribute('property');
      const content = tag.getAttribute('content');
      if (name && content && (name.includes('description') || name.includes('keyword') || name.includes('title') || name.includes('og:'))) {
        meta[name] = cleanText(content);
      }
    });

    // 2. Headings hierarchy
    const headings = [];
    document.querySelectorAll('h1, h2, h3, h4').forEach(h => {
      if (isVisible(h)) {
        const text = cleanText(h.innerText);
        if (text) {
          headings.push(`${h.tagName.toUpperCase()}: ${text}`);
        }
      }
    });

    // Helper to generate a clean, reliable CSS selector for an element
    function getElementSelector(el) {
      if (!el) return '';
      if (el.id) {
        try { return `#${CSS.escape(el.id)}`; } catch (e) { return `#${el.id}`; }
      }
      const name = el.getAttribute('name');
      if (name) {
        try { return `${el.tagName.toLowerCase()}[name="${CSS.escape(name)}"]`; } catch (e) { return `${el.tagName.toLowerCase()}[name="${name}"]`; }
      }
      const aria = el.getAttribute('aria-label');
      if (aria) {
        try { return `[aria-label="${CSS.escape(aria)}"]`; } catch (e) { return `[aria-label="${aria}"]`; }
      }
      const placeholder = el.getAttribute('placeholder');
      if (placeholder) {
        try { return `[placeholder="${CSS.escape(placeholder)}"]`; } catch (e) { return `[placeholder="${placeholder}"]`; }
      }
      const testId = el.getAttribute('data-testid') || el.getAttribute('data-qa') || el.getAttribute('data-cy');
      if (testId) {
        try { return `[data-testid="${CSS.escape(testId)}"]`; } catch (e) { return `[data-testid="${testId}"]`; }
      }
      if (el.classList && el.classList.length > 0) {
        const cls = Array.from(el.classList).find(c => !c.startsWith('ng-') && !c.includes(':') && c.length > 2 && c.length < 30);
        if (cls) {
          try { return `${el.tagName.toLowerCase()}.${CSS.escape(cls)}`; } catch (e) { return `${el.tagName.toLowerCase()}.${cls}`; }
        }
      }
      return el.tagName.toLowerCase();
    }

    // 3. Interactive Elements (buttons, inputs, key links)
    const buttons = [];
    let elemIndex = 1;
    if (!window.__antigravity_dom_map) {
      window.__antigravity_dom_map = new Map();
    } else {
      window.__antigravity_dom_map.clear();
    }

    document.querySelectorAll('button, [role="button"], input[type="button"], input[type="submit"], a.btn, a.button').forEach(btn => {
      if (isVisible(btn)) {
        const label = cleanText(btn.innerText || btn.value || btn.getAttribute('aria-label') || btn.title || '');
        if (label && label.length > 0 && label.length < 90) {
          const idx = elemIndex++;
          window.__antigravity_dom_map.set(idx, btn);
          btn.setAttribute('data-highlight-index', String(idx));
          buttons.push({
            index: idx,
            label,
            selector: getElementSelector(btn),
          });
        }
      }
    });

    const inputs = [];
    document.querySelectorAll('input:not([type="hidden"]), textarea, select, [contenteditable="true"]').forEach(inp => {
      if (isVisible(inp)) {
        const type = inp.tagName.toLowerCase() === 'textarea' ? 'textarea' : inp.isContentEditable ? 'contenteditable' : (inp.getAttribute('type') || 'text');
        const placeholder = inp.getAttribute('placeholder') || '';
        const name = inp.getAttribute('name') || inp.getAttribute('id') || '';
        const ariaLabel = inp.getAttribute('aria-label') || '';
        const labelEl = inp.id ? document.querySelector(`label[for="${inp.id}"]`) : inp.closest('label');
        const label = labelEl ? cleanText(labelEl.innerText) : (ariaLabel || placeholder || name || 'Campo de texto');
        // Check for sensitive fields to prevent credential and PII leakage
        const isPassword = type === 'password';
        const autocomplete = (inp.getAttribute('autocomplete') || '').toLowerCase();
        const isSensitivePattern = /(password|passwd|pwd|passcode|token|secret|pin|cvv|cvc|creditcard|cardnumber|ssn|auth)/i.test(`${name} ${placeholder} ${ariaLabel}`);
        const isSensitive = isPassword || autocomplete.includes('password') || autocomplete.includes('cc-') || isSensitivePattern;

        let safeValue = '';
        if (inp.value) {
          safeValue = isSensitive ? '[PROTECTED_INPUT]' : cleanText(inp.value).slice(0, 300);
        }

        const idx = elemIndex++;
        window.__antigravity_dom_map.set(idx, inp);
        inp.setAttribute('data-highlight-index', String(idx));

        inputs.push({
          index: idx,
          type: isSensitive ? 'password' : type,
          label: label || 'Campo sin etiqueta',
          selector: getElementSelector(inp),
          placeholder: placeholder || undefined,
          value: safeValue || undefined,
          isSensitive: isSensitive || undefined,
        });
      }
    });

    const navLinks = [];
    document.querySelectorAll('nav a, header a, main a').forEach(a => {
      if (isVisible(a)) {
        const txt = cleanText(a.innerText || a.getAttribute('aria-label') || '');
        const href = a.getAttribute('href');
        if (txt && txt.length > 2 && txt.length < 80 && href && !href.startsWith('javascript:')) {
          if (!navLinks.includes(txt)) navLinks.push(txt);
        }
      }
    });

    // 4. Main readable content
    // Remove scripts, styles, noscript, etc.
    const clone = document.body ? document.body.cloneNode(true) : document.documentElement.cloneNode(true);
    clone.querySelectorAll('script, style, noscript, svg, iframe').forEach(n => n.remove());

    let rawText = cleanText(clone.innerText || clone.textContent || '');
    if (rawText.length > maxTextLength) {
      rawText = rawText.slice(0, maxTextLength) + '... [contenido continuo al límite de extracción]';
    }

    // 5. Selected text if any
    const selection = window.getSelection ? cleanText(window.getSelection().toString()) : '';

    return {
      title,
      url,
      meta,
      headings: headings.slice(0, 60),
      interactiveSummary: {
        totalButtons: buttons.length,
        buttons: buttons.slice(0, 60),
        totalInputs: inputs.length,
        inputs: inputs.slice(0, 60),
        navLinks: navLinks.slice(0, 60),
      },
      selectedText: selection || undefined,
      screenDimensions: {
        width: window.innerWidth,
        height: window.innerHeight,
        scrollX: window.scrollX,
        scrollY: window.scrollY,
      },
      pageContent: rawText,
      timestamp: new Date().toISOString(),
    };
  }

  // Expose globally for scripting injection
  window.__extractScreenJSON = extractScreenJSON;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { extractScreenJSON };
  }
})();
