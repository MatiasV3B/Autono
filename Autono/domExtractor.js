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

  // --- Autono security: rendered-text extraction ---
  // Everything the model sees must be something a human looking at the page could see: nodes that are
  // aria-hidden, zero-size, off-screen, opacity:0, font-size:0, transparent, visibility:hidden or
  // display:none are dropped, and attacker-controlled attribute strings are capped.
  const ATTR_CAP = 80;
  const TITLE_URL_CAP = 300;
  const capAttr = (s, n) => {
    const v = cleanText(s);
    return v.length > (n || ATTR_CAP) ? v.slice(0, n || ATTR_CAP) : v;
  };
  const SKIP_TEXT_PARENTS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'SVG', 'IFRAME', 'TEMPLATE', 'OBJECT', 'EMBED', 'CANVAS', 'HEAD', 'TITLE', 'META', 'LINK']);
  const hiddenCache = new WeakMap();

  // true when the element itself (not its ancestors) is not rendered visibly
  function selfHidden(el) {
    if (el.hidden || el.getAttribute('aria-hidden') === 'true' || el.hasAttribute('inert')) return true;
    let style;
    try { style = window.getComputedStyle(el); } catch (e) { return true; }
    if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse') return true;
    if (parseFloat(style.opacity) === 0) return true;
    const fontPx = parseFloat(style.fontSize);
    if (Number.isFinite(fontPx) && fontPx < 1) return true;
    const color = style.color || '';
    if (/^rgba\(.*,\s*0\)$/.test(color) || color === 'transparent') return true;
    return false;
  }

  function elementHidden(el) {
    if (!el || el.nodeType !== Node.ELEMENT_NODE) return false;
    if (hiddenCache.has(el)) return hiddenCache.get(el);
    let hidden = selfHidden(el);
    if (!hidden && el.parentElement && el.parentElement !== document.documentElement) {
      hidden = elementHidden(el.parentElement);
    }
    if (!hidden && window.getComputedStyle(el).display !== 'contents') {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) hidden = true;
      else if (rect.right + window.scrollX <= 0 || rect.bottom + window.scrollY <= 0) hidden = true; // parked off-screen
    }
    hiddenCache.set(el, hidden);
    return hidden;
  }

  function isVisible(el) {
    if (!el || el.nodeType !== Node.ELEMENT_NODE) return false;
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
      return false;
    }
    const rect = el.getBoundingClientRect();
    if (!(rect.width > 0 && rect.height > 0)) return false;
    return !elementHidden(el);
  }

  // Rendered text of the live document: honours CSS, unlike the innerText of a detached clone.
  function renderedText(maxLen) {
    const root = document.body || document.documentElement;
    if (!root) return '';
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    const chunks = [];
    let total = 0;
    let visited = 0;
    let node;
    while ((node = walker.nextNode())) {
      if (++visited > 40000) break;
      const raw = node.nodeValue;
      if (!raw || !raw.trim()) continue;
      const parent = node.parentElement;
      if (!parent || SKIP_TEXT_PARENTS.has(parent.tagName.toUpperCase())) continue;
      if (elementHidden(parent)) continue;
      const piece = cleanText(raw);
      if (!piece) continue;
      chunks.push(piece);
      total += piece.length + 1;
      if (total > maxLen + 1000) break;
    }
    return chunks.join(' ');
  }

  // attacker-controlled attribute values end up in selectors: keep them short
  function safeSelector(sel) {
    const s = String(sel || '');
    return s.length > 120 ? '' : s;
  }
  // --- end ---

  function extractScreenJSON(maxTextLength = 65536) {
    const title = capAttr(document.title || '', TITLE_URL_CAP);
    const url = capAttr(window.location.href, TITLE_URL_CAP);

    // 1. Meta information
    const meta = {};
    document.querySelectorAll('meta[name], meta[property]').forEach(tag => {
      const name = tag.getAttribute('name') || tag.getAttribute('property');
      const content = tag.getAttribute('content');
      if (name && content && (name.includes('description') || name.includes('keyword') || name.includes('title') || name.includes('og:'))) {
        meta[name] = capAttr(content, TITLE_URL_CAP);
      }
    });

    // 2. Headings hierarchy
    const headings = [];
    document.querySelectorAll('h1, h2, h3, h4').forEach(h => {
      if (isVisible(h)) {
        const text = capAttr(h.innerText, 200);
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
        const label = capAttr(btn.innerText || btn.value || btn.getAttribute('aria-label') || btn.title || '', ATTR_CAP);
        if (label && label.length > 0) {
          const idx = elemIndex++;
          window.__antigravity_dom_map.set(idx, btn);
          btn.setAttribute('data-highlight-index', String(idx));
          buttons.push({
            index: idx,
            label,
            selector: safeSelector(getElementSelector(btn)),
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
          label: capAttr(label || 'Campo sin etiqueta'),
          selector: safeSelector(getElementSelector(inp)),
          placeholder: placeholder ? capAttr(placeholder) : undefined,
          value: safeValue || undefined,
          isSensitive: isSensitive || undefined,
        });
      }
    });

    const navLinks = [];
    document.querySelectorAll('nav a, header a, main a').forEach(a => {
      if (isVisible(a)) {
        const txt = capAttr(a.innerText || a.getAttribute('aria-label') || '', ATTR_CAP);
        const href = a.getAttribute('href');
        if (txt && txt.length > 2 && href && !href.startsWith('javascript:')) {
          if (!navLinks.includes(txt)) navLinks.push(txt);
        }
      }
    });

    // 4. Main readable content: rendered text of the live DOM only (see renderedText above)
    let rawText = renderedText(maxTextLength);
    if (rawText.length > maxTextLength) {
      rawText = rawText.slice(0, maxTextLength) + '... [contenido continuo al límite de extracción]';
    }

    // 5. Selected text if any
    const selection = window.getSelection ? capAttr(window.getSelection().toString(), 1000) : '';

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
