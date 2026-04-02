/**
 * Multi-strategy field finder for web forms.
 *
 * Strategies are tried in order until one finds a matching element:
 *   1. labelFor         — match <label for="..."> text, then getElementById
 *   2. ariaLabel        — match elements with a matching aria-label attribute
 *   3. placeholder      — match input/textarea with a matching placeholder
 *   4. labelWrap        — match <label> wrapping a checkbox/radio/switch input
 *   5. textNearCheckbox — walk up from matching text to find a nearby checkbox
 *
 * After finding an element, widget detection runs to identify wrappers
 * like Select2 that need special interaction handling.
 */

// ── Strategy registry ────────────────────────────────────────────

const FIELD_STRATEGIES = [
  { name: "labelFor", find: findByLabelFor },
  { name: "ariaLabel", find: findByAriaLabel },
  { name: "placeholder", find: findByPlaceholder },
  { name: "labelWrap", find: findByLabelWrap },
  { name: "textNearCheckbox", find: findByTextNearCheckbox },
];

// ── Public API (called by content-script.js) ─────────────────────

/**
 * @param {Object} cfg  - { labelMatch: string[] }
 * @param {Set} [excludeEls] - elements to skip
 * @returns {{ el: HTMLElement, select2Container: HTMLElement|null } | null}
 */
function findFieldByCfg(cfg, excludeEls) {
  const exclude = excludeEls || new Set();
  const matchTexts = (cfg.labelMatch || []).map((m) => m.toLowerCase());
  if (matchTexts.length === 0) return null;

  for (const strategy of FIELD_STRATEGIES) {
    const el = strategy.find(matchTexts, exclude);
    if (el) {
      console.log(`[Selector:${strategy.name}] Matched →`, el.id || el.name || "?", `<${el.tagName.toLowerCase()}>`, el.className.substring(0, 50));
      return detectWidget(el);
    }
  }

  return null;
}

// ── Widget detection ─────────────────────────────────────────────

function detectWidget(el) {
  const isSelect2 = el.classList.contains("select2-offscreen");
  if (isSelect2) {
    const container = document.getElementById("s2id_" + el.id);
    console.log("[Selector] Select2 container:", container ? "found" : "not found");
    return { el, select2Container: container };
  }
  return { el, select2Container: null };
}

// ── Strategy: label[for] ─────────────────────────────────────────

function findByLabelFor(matchTexts, exclude) {
  const labels = document.querySelectorAll("label[for]");

  for (const label of labels) {
    const text = label.textContent.trim().toLowerCase();
    if (!matchTexts.some((m) => text.includes(m))) continue;

    const targetId = label.getAttribute("for");
    if (!targetId) continue;

    const el = document.getElementById(targetId);
    if (el && !exclude.has(el)) return el;
  }

  return null;
}

// ── Strategy: aria-label ─────────────────────────────────────────

function findByAriaLabel(matchTexts, exclude) {
  const candidates = document.querySelectorAll("[aria-label]");

  for (const el of candidates) {
    if (exclude.has(el)) continue;
    const ariaLabel = el.getAttribute("aria-label").trim().toLowerCase();
    if (matchTexts.some((m) => ariaLabel.includes(m))) return el;
  }

  return null;
}

// ── Strategy: placeholder ────────────────────────────────────────

function findByPlaceholder(matchTexts, exclude) {
  const candidates = document.querySelectorAll("input[placeholder], textarea[placeholder]");

  for (const el of candidates) {
    if (exclude.has(el)) continue;
    const ph = el.getAttribute("placeholder").trim().toLowerCase();
    if (matchTexts.some((m) => ph.includes(m))) return el;
  }

  return null;
}

// ── Strategy: wrapping label ──────────────────────────────────────
// Handles <label><input type="checkbox"> Some text...</label>
// where the label wraps the input instead of using a for attribute.

function findByLabelWrap(matchTexts, exclude) {
  const labels = document.querySelectorAll("label");

  for (const label of labels) {
    if (label.hasAttribute("for")) continue;
    const text = label.textContent.trim().toLowerCase();
    if (!matchTexts.some((m) => text.includes(m))) continue;

    const input = label.querySelector(
      'input[type="checkbox"], input[type="radio"], [role="checkbox"], [role="switch"]',
    );
    if (input && !exclude.has(input)) return input;
  }

  return null;
}

// ── Strategy: text near checkbox ──────────────────────────────────
// Walks up from a text node matching labelMatch to find a nearby
// checkbox/toggle within the same container (parent, grandparent, etc).
// Covers custom components where text and checkbox are siblings.

function findByTextNearCheckbox(matchTexts, exclude) {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);

  while (walker.nextNode()) {
    const text = walker.currentNode.textContent.trim().toLowerCase();
    if (!text || !matchTexts.some((m) => text.includes(m))) continue;

    let container = walker.currentNode.parentElement;
    for (let depth = 0; depth < 8 && container && container !== document.body; depth++) {
      const checkbox = container.querySelector(
        'input[type="checkbox"], input[type="radio"], [role="checkbox"], [role="switch"]',
      );
      if (checkbox && !exclude.has(checkbox)) return checkbox;
      container = container.parentElement;
    }
  }

  return null;
}

if (typeof module !== "undefined") {
  module.exports = {
    FIELD_STRATEGIES,
    findFieldByCfg,
    findByLabelFor,
    findByAriaLabel,
    findByPlaceholder,
    findByLabelWrap,
    findByTextNearCheckbox,
    detectWidget,
  };
}
