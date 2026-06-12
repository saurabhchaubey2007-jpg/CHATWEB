(() => {
  if (globalThis.__chatwebContentScriptInstalled) {
    return;
  }

  globalThis.__chatwebContentScriptInstalled = true;

  const BLOCKED_TAGS = new Set([
    'SCRIPT',
    'STYLE',
    'NOSCRIPT',
    'IFRAME',
    'SVG',
    'CANVAS',
    'TEMPLATE',
    'NAV',
    'HEADER',
    'FOOTER',
    'ASIDE',
    'FORM',
    'BUTTON',
    'INPUT',
    'SELECT',
    'TEXTAREA',
    'OPTION',
    'VIDEO',
    'AUDIO'
  ]);

  const BLOCKED_SELECTORS = [
    '[aria-hidden="true"]',
    '[hidden]',
    '[data-nosnippet]',
    '[role="navigation"]',
    '[role="banner"]',
    '[role="contentinfo"]',
    '[role="dialog"]',
    '[role="alertdialog"]',
    '[class*="cookie" i]',
    '[id*="cookie" i]',
    '[class*="consent" i]',
    '[id*="consent" i]',
    '[class*="banner" i]',
    '[id*="banner" i]',
    '[class*="promo" i]',
    '[id*="promo" i]',
    '[class*="advert" i]',
    '[id*="advert" i]',
    '[class*="ads" i]',
    '[id*="ads" i]'
  ];

  const CANDIDATE_ROOT_SELECTORS = ['article', 'main', '[role="main"]', '[role="article"]'];

  function isVisibleElement(element) {
    if (!element || element.nodeType !== Node.ELEMENT_NODE) {
      return false;
    }

    if (BLOCKED_TAGS.has(element.tagName)) {
      return false;
    }

    if (element.closest(BLOCKED_SELECTORS.join(','))) {
      return false;
    }

    const style = window.getComputedStyle(element);

    if (
      style.display === 'none' ||
      style.visibility === 'hidden' ||
      style.opacity === '0' ||
      style.contentVisibility === 'hidden'
    ) {
      return false;
    }

    const rect = element.getBoundingClientRect();

    if (rect.width === 0 || rect.height === 0) {
      return false;
    }

    return true;
  }

  function shouldRemoveElement(element) {
    if (!element || element.nodeType !== Node.ELEMENT_NODE) {
      return false;
    }

    if (BLOCKED_TAGS.has(element.tagName)) {
      return true;
    }

    if (element.matches(BLOCKED_SELECTORS.join(','))) {
      return true;
    }

    const tagName = element.tagName;
    const className = element.className;
    const idName = element.id;
    const classText = typeof className === 'string' ? className : '';

    return /cookie|consent|banner|advert|promo|popup|modal|subscribe|newsletter|overlay|paywall/i.test(
      `${tagName} ${classText} ${idName}`
    );
  }

  function getCandidateRoots() {
    const roots = CANDIDATE_ROOT_SELECTORS.map((selector) => document.querySelector(selector)).filter(Boolean);

    if (roots.length > 0) {
      return roots;
    }

    return [document.body].filter(Boolean);
  }

  function cloneAndClean(root) {
    const clonedRoot = root.cloneNode(true);
    const elements = clonedRoot.querySelectorAll('*');

    elements.forEach((element) => {
      if (shouldRemoveElement(element)) {
        element.remove();
        return;
      }

      if (!isVisibleElement(element)) {
        element.remove();
      }
    });

    return clonedRoot;
  }

  function extractReadableText(root) {
    const cleanedRoot = cloneAndClean(root);
    const text = cleanedRoot.innerText || cleanedRoot.textContent || '';

    return text
      .replace(/\r\n/g, '\n')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \t]{2,}/g, ' ')
      .trim();
  }

  function extractBestText() {
    const roots = getCandidateRoots();
    const texts = roots
      .map((root) => extractReadableText(root))
      .filter((text) => text.length > 0)
      .sort((a, b) => b.length - a.length);

    if (texts.length > 0) {
      return texts[0];
    }

    const body = document.body;
    if (!body) {
      return '';
    }

    const bodyText = body.innerText || body.textContent || '';
    return bodyText
      .replace(/\r\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \t]{2,}/g, ' ')
      .trim();
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.type !== 'CHATWEB_EXTRACT_CONTENT') {
      return;
    }

    try {
      const text = extractBestText();
      sendResponse({
        text,
        url: window.location.href,
        title: document.title || ''
      });
    } catch (error) {
      sendResponse({
        text: '',
        error: error instanceof Error ? error.message : 'Failed to extract content.'
      });
    }
  });
})();