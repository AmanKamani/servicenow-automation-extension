(() => {
  const RETRY_INTERVAL = 600;
  const MAX_RETRIES = 25;
  const TYPING_DELAY = 60;
  const DROPDOWN_POLL = 400;
  const DEFAULT_AJAX_WAIT = 1500;
  const DEFAULT_DROPDOWN_RETRIES = 15;

  let _aborted = false;

  function checkAborted() {
    if (_aborted) throw new Error("STOPPED");
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type === "FILL_FORM") {
      _aborted = false;
      handleFillForm(msg.payload, msg.fieldConfigs)
        .then((result) => {
          chrome.runtime.sendMessage(result);
          sendResponse({ ok: true });
        })
        .catch((err) => {
          const stopped = err.message === "STOPPED";
          chrome.runtime.sendMessage({
            type: "AUTOMATION_RESULT",
            ok: false,
            stopped,
            error: stopped ? "Automation stopped by user." : err.message,
          });
          sendResponse({ ok: false, error: err.message });
        });
      return true;
    }

    if (msg.type === "STOP_AUTOMATION") {
      _aborted = true;
      reportStep("Stop requested — aborting after current step.");
      sendResponse({ ok: true });
      return true;
    }
  });

  // ────────────────────────────────────────────────────────────────
  // Main orchestration
  // ────────────────────────────────────────────────────────────────

  async function handleFillForm(payload, fieldConfigs) {
    reportStep("Starting automation...");
    reportStep(`Processing ${fieldConfigs.length} field(s) in configured order.`);

    const usedElements = new Set();

    for (let i = 0; i < fieldConfigs.length; i++) {
      checkAborted();
      const cfg = fieldConfigs[i];
      const name = cfg.displayName || cfg.key;
      const value = payload[cfg.key];

      // ── Button field type — find and click a button by its text ──
      if (cfg.fieldType === "button") {
        const btnText = value || cfg.displayName || cfg.key;
        if (!btnText) {
          reportStep(`Skipping button "${name}" — no button text specified.`);
          continue;
        }
        reportStep(`[${i + 1}/${fieldConfigs.length}] Clicking button "${btnText}"...`);
        const btn = await waitForButton(btnText);
        simulateClick(btn);
        reportStep(`  Clicked button "${btnText}".`);
        await sleep(1500);
        continue;
      }

      if (value === null || value === undefined || value === "") {
        reportStep(`Skipping "${name}" — no value in payload for key "${cfg.key}".`);
        continue;
      }

      reportStep(`[${i + 1}/${fieldConfigs.length}] Processing "${name}" (${cfg.fieldType})...`);

      const ajaxWait = cfg.ajaxWait || DEFAULT_AJAX_WAIT;
      const retries = cfg.dropdownRetries || DEFAULT_DROPDOWN_RETRIES;

      const found = await waitForFieldByCfg(cfg, usedElements);
      const el = found.el;
      const s2Container = found.select2Container;
      usedElements.add(el);

      const isSelect2 = el.classList.contains("select2-offscreen");
      const tagInfo = `<${el.tagName.toLowerCase()}#${el.id || el.name || "?"}>`;
      reportStep(`  Found ${tagInfo} ${isSelect2 ? "(Select2)" : ""}`);

      if (el.tagName === "SELECT" && isSelect2) {
        await fillSelect2Choice(el, s2Container, String(value), name);
        reportStep(`  Select2 choice set: "${value}"`);
      }
      else if (isSelect2 && s2Container) {
        if (Array.isArray(value)) {
          for (const item of value) {
            await fillSelect2Typeahead(s2Container, el, item, name, ajaxWait, retries);
            reportStep(`  Select2 typeahead selected: "${item}"`);
            await sleep(600);
          }
        } else {
          await fillSelect2Typeahead(s2Container, el, String(value), name, ajaxWait, retries);
          reportStep(`  Select2 typeahead selected: "${value}"`);
        }
      }
      else if (cfg.fieldType === "typeahead") {
        if (Array.isArray(value)) {
          for (const item of value) {
            await fillTypeahead(el, item, name, ajaxWait, retries);
            reportStep(`  Typeahead selected: "${item}"`);
            await sleep(600);
          }
        } else {
          await fillTypeahead(el, String(value), name, ajaxWait, retries);
          reportStep(`  Typeahead selected: "${value}"`);
        }
      }
      else if (el.tagName === "SELECT") {
        await fillNativeSelect(el, String(value), name);
        reportStep(`  Native select set: "${value}"`);
      }
      else {
        await fillPlainText(el, String(value));
        reportStep(`  Text filled.`);
      }

      await sleep(800);
    }

    reportStep("Automation complete — all fields processed.");
    return { type: "AUTOMATION_RESULT", ok: true, message: "All fields processed successfully." };
  }

  // ────────────────────────────────────────────────────────────────
  // Field finder
  // ────────────────────────────────────────────────────────────────

  function waitForFieldByCfg(cfg, excludeEls) {
    const name = cfg.displayName || cfg.key;
    return new Promise((resolve, reject) => {
      let attempt = 0;
      const check = () => {
        const result = findFieldByCfg(cfg, excludeEls);
        if (result) return resolve(result);
        attempt++;
        if (attempt >= MAX_RETRIES) {
          reject(new Error(
            `Could not find field "${name}" after ${MAX_RETRIES} retries.\n` +
            `  labelMatch: ${JSON.stringify(cfg.labelMatch)}\n` +
            `Verify the label text in Options matches the text on the SN page.`
          ));
          return;
        }
        setTimeout(check, RETRY_INTERVAL);
      };
      check();
    });
  }

  // ────────────────────────────────────────────────────────────────
  // Select2 choice dropdown (hidden <select>)
  // ────────────────────────────────────────────────────────────────

  async function fillSelect2Choice(selectEl, s2Container, value, fieldName) {
    const normalised = value.toLowerCase().trim();

    // Strategy 1: Open the Select2 dropdown via UI and click the option
    if (s2Container) {
      const choiceLink = s2Container.querySelector(".select2-choice");
      if (choiceLink) {
        simulateClick(choiceLink);
        await sleep(500);

        // The dropdown appears as .select2-drop-active with .select2-results
        const picked = await pickSelect2ChoiceResult(normalised, 10);
        if (picked) { await sleep(300); return; }
      }
    }

    // Strategy 2: Open via jQuery Select2 API
    try {
      const $ = window.jQuery || window.$;
      if ($) {
        $(selectEl).select2("open");
        await sleep(500);
        const picked = await pickSelect2ChoiceResult(normalised, 10);
        if (picked) { await sleep(300); return; }
      }
    } catch (_) {}

    // Strategy 3: Set hidden <select> value directly
    let matchedValue = null;
    for (const opt of selectEl.options) {
      const label = opt.textContent.toLowerCase().trim();
      const val = opt.value.toLowerCase().trim();
      if (label === normalised || val === normalised || label.includes(normalised) || normalised.includes(label)) {
        matchedValue = opt.value;
        break;
      }
    }

    if (matchedValue === null) {
      const available = Array.from(selectEl.options).map((o) => `"${o.textContent.trim()}"`).join(", ");
      throw new Error(`No option matches "${value}" in "${fieldName}". Available: ${available}`);
    }

    try {
      const $ = window.jQuery || window.$;
      if ($ && $(selectEl).select2) {
        $(selectEl).select2("val", matchedValue);
        $(selectEl).trigger("change");
        await sleep(300);
        return;
      }
    } catch (_) {}

    selectEl.value = matchedValue;
    selectEl.dispatchEvent(new Event("change", { bubbles: true }));
    try { if (typeof angular !== "undefined") angular.element(selectEl).triggerHandler("change"); } catch (_) {}
    await sleep(300);
  }

  async function pickSelect2ChoiceResult(normalised, retries) {
    for (let attempt = 0; attempt < retries; attempt++) {
      const items = document.querySelectorAll(
        ".select2-drop-active .select2-results .select2-result-selectable, " +
        ".select2-drop-active .select2-results li"
      );
      for (const item of items) {
        const text = item.textContent.toLowerCase().trim();
        if (text.includes(normalised) || normalised.includes(text)) {
          simulateClick(item);
          await sleep(200);
          return true;
        }
      }
      await sleep(DROPDOWN_POLL);
    }
    return false;
  }

  // ────────────────────────────────────────────────────────────────
  // Select2 typeahead (hidden <input> with Select2 search)
  // ────────────────────────────────────────────────────────────────

  async function fillSelect2Typeahead(s2Container, hiddenEl, value, fieldName, ajaxWait, retries) {
    // Find the Select2 search input inside the container
    let searchInput = s2Container.querySelector("input.select2-input");
    if (!searchInput) {
      // For single-select Select2, need to open dropdown first
      const choice = s2Container.querySelector(".select2-choice, .select2-choices");
      if (choice) {
        choice.click();
        await sleep(400);
      }
      // The search input appears in the dropdown (appended to body)
      const dropdownId = hiddenEl.id ? `select2-drop` : null;
      searchInput = document.querySelector(".select2-drop-active input.select2-input");
    }

    if (!searchInput) {
      // Last resort: open via Select2 API
      try {
        const $ = window.jQuery || window.$;
        if ($) {
          $(hiddenEl).select2("open");
          await sleep(400);
          searchInput = document.querySelector(".select2-drop-active input.select2-input");
        }
      } catch (_) {}
    }

    if (!searchInput) {
      throw new Error(`Could not find Select2 search input for "${fieldName}".`);
    }

    // Clear and type into the Select2 search input
    searchInput.focus();
    searchInput.value = "";
    searchInput.dispatchEvent(new Event("input", { bubbles: true }));
    await sleep(100);

    // Type character by character
    for (const char of value) {
      document.execCommand("insertText", false, char);
      await sleep(TYPING_DELAY);
    }

    reportStep(`  Typed "${value}" in Select2 search, waiting ${ajaxWait}ms...`);
    await sleep(ajaxWait);

    // Look for results in the Select2 dropdown
    const picked = await pickSelect2Result(value, retries);
    if (!picked) {
      reportStep(`  Warn: no Select2 result for "${value}", pressing Enter.`);
      pressKey(searchInput, "Enter");
      await sleep(500);
    }

    await sleep(500);
  }

  async function pickSelect2Result(value, retries) {
    const normalised = value.toLowerCase().trim();

    for (let attempt = 0; attempt < retries; attempt++) {
      // Select2 results appear in .select2-results inside .select2-drop-active
      const resultItems = document.querySelectorAll(
        ".select2-drop-active .select2-results li.select2-result, " +
        ".select2-drop-active .select2-results .select2-result-selectable"
      );

      if (resultItems.length > 0) {
        // Find best text match
        for (const item of resultItems) {
          const text = item.textContent.toLowerCase().trim();
          if (text.includes(normalised) || normalised.includes(text)) {
            item.click();
            simulateClick(item);
            await sleep(300);
            return true;
          }
        }
        // If only one result, click it
        if (resultItems.length === 1) {
          resultItems[0].click();
          simulateClick(resultItems[0]);
          await sleep(300);
          return true;
        }
      }

      // Also check for generic dropdown items
      const genericItems = document.querySelectorAll(
        ".select2-drop-active li, " +
        "[role='listbox'] [role='option']"
      );
      for (const item of genericItems) {
        const text = item.textContent.toLowerCase().trim();
        if (text.includes(normalised)) {
          simulateClick(item);
          await sleep(300);
          return true;
        }
      }

      await sleep(DROPDOWN_POLL);
    }
    return false;
  }

  // ────────────────────────────────────────────────────────────────
  // Plain typeahead (non-Select2 inputs)
  // ────────────────────────────────────────────────────────────────

  async function fillTypeahead(el, value, fieldName, ajaxWait, retries) {
    await clearField(el);
    await sleep(300);

    const domBefore = new Set(document.querySelectorAll("*"));
    el.focus();
    el.click();
    await sleep(100);

    for (const char of value) {
      document.execCommand("insertText", false, char);
      await sleep(TYPING_DELAY);
    }

    reportStep(`  Typed "${value}", waiting ${ajaxWait}ms...`);
    await sleep(ajaxWait);

    const picked = await pickFromDropdown(value, domBefore, retries);
    if (!picked) {
      reportStep(`  Warn: no dropdown match, pressing Enter.`);
      pressKey(el, "Enter");
      await sleep(800);
    }

    await sleep(500);
  }

  async function pickFromDropdown(value, domBefore, retries) {
    const normalised = value.toLowerCase().trim();

    for (let attempt = 0; attempt < retries; attempt++) {
      // New elements that appeared after typing
      const newItems = [];
      const allNow = document.querySelectorAll("li, tr, a, td, div[role='option'], [role='option'], [role='menuitem']");
      for (const el of allNow) {
        if (!domBefore.has(el) && _isVisibleCS(el)) {
          const text = el.textContent.trim();
          if (text.length > 0 && text.length < 500) newItems.push(el);
        }
      }

      if (newItems.length > 0) {
        for (const item of newItems) {
          const text = item.textContent.toLowerCase().trim();
          if (text.includes(normalised) || normalised.includes(text)) {
            simulateClick(item);
            await sleep(500);
            return true;
          }
        }
        if (newItems.length <= 3) {
          simulateClick(newItems[0]);
          await sleep(500);
          return true;
        }
      }

      await sleep(DROPDOWN_POLL);
    }
    return false;
  }

  // ────────────────────────────────────────────────────────────────
  // Native <select> and plain text
  // ────────────────────────────────────────────────────────────────

  async function fillNativeSelect(el, value, fieldName) {
    const normalised = value.toLowerCase().trim();
    for (const opt of el.options) {
      if (opt.textContent.toLowerCase().trim().includes(normalised) || opt.value.toLowerCase() === normalised) {
        el.value = opt.value;
        el.dispatchEvent(new Event("change", { bubbles: true }));
        await sleep(200);
        return;
      }
    }
    throw new Error(`No option matches "${value}" in "${fieldName}".`);
  }

  async function fillPlainText(el, value) {
    await clearField(el);
    el.focus();
    el.click();
    await sleep(100);
    document.execCommand("insertText", false, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    await sleep(100);
    el.dispatchEvent(new Event("blur", { bubbles: true }));
  }

  // ────────────────────────────────────────────────────────────────
  // Utilities
  // ────────────────────────────────────────────────────────────────

  async function clearField(el) {
    el.focus(); el.click(); await sleep(50);
    el.dispatchEvent(new KeyboardEvent("keydown", { key: "a", code: "KeyA", ctrlKey: true, metaKey: true, bubbles: true }));
    document.execCommand("selectAll");
    document.execCommand("delete");
    await sleep(50);
    if ("value" in el) {
      const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), "value")?.set;
      if (setter) setter.call(el, ""); else el.value = "";
    }
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function simulateClick(el) {
    el.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
    el.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true }));
    el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    el.click();
  }

  function pressKey(el, key) {
    const opts = { key, code: key, keyCode: key === "Enter" ? 13 : 0, bubbles: true, cancelable: true };
    el.dispatchEvent(new KeyboardEvent("keydown", opts));
    el.dispatchEvent(new KeyboardEvent("keypress", opts));
    el.dispatchEvent(new KeyboardEvent("keyup", opts));
  }

  function sleep(ms) {
    return new Promise((resolve, reject) => {
      const check = () => {
        if (_aborted) return reject(new Error("STOPPED"));
        resolve();
      };
      if (ms <= 200) return setTimeout(check, ms);
      // For longer sleeps, poll every 200ms so stop is responsive
      let elapsed = 0;
      const tick = () => {
        if (_aborted) return reject(new Error("STOPPED"));
        elapsed += 200;
        if (elapsed >= ms) return resolve();
        setTimeout(tick, 200);
      };
      setTimeout(tick, 200);
    });
  }

  function _isVisibleCS(el) {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) return false;
    const s = window.getComputedStyle(el);
    return s.display !== "none" && s.visibility !== "hidden" && s.opacity !== "0";
  }

  // ────────────────────────────────────────────────────────────────
  // Button finder
  // ────────────────────────────────────────────────────────────────

  function waitForButton(text, retries = MAX_RETRIES) {
    return new Promise((resolve, reject) => {
      let attempt = 0;
      const check = () => {
        const buttons = document.querySelectorAll("button, input[type='submit'], a.btn, a.button, [role='button']");
        for (const btn of buttons) {
          const t = (btn.textContent || btn.value || "").trim();
          if (t.toLowerCase() === text.toLowerCase()) return resolve(btn);
        }
        for (const btn of buttons) {
          const t = (btn.textContent || btn.value || "").trim();
          if (t.toLowerCase().includes(text.toLowerCase())) return resolve(btn);
        }
        attempt++;
        if (attempt >= retries) { reject(new Error(`Button "${text}" not found.`)); return; }
        setTimeout(check, RETRY_INTERVAL);
      };
      check();
    });
  }

  function reportStep(msg) { console.log("[SN Group Join]", msg); }
})();
