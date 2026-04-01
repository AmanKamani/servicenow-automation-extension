importScripts("storage-defaults.js");

let runningTabId = null;
let runningFlowState = null; // { current, total, aborted }

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "RUN_AUTOMATION") {
    runOnActiveTab(msg.payload, msg.fieldConfigs)
      .then((res) => sendResponse(res))
      .catch((err) => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  if (msg.type === "RUN_FLOW") {
    runFlow(msg.configuration, msg.data, msg.startUrl)
      .then((res) => sendResponse(res))
      .catch((err) => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  if (msg.type === "STOP_AUTOMATION") {
    if (runningFlowState) runningFlowState.aborted = true;
    if (runningTabId !== null) {
      chrome.tabs.sendMessage(runningTabId, { type: "STOP_AUTOMATION" }, () => {
        if (chrome.runtime.lastError) { /* tab may be gone */ }
      });
      sendResponse({ ok: true });
    } else {
      sendResponse({ ok: false, error: "No automation running." });
    }
    return true;
  }

  if (msg.type === "IS_RUNNING") {
    const running = runningTabId !== null;
    const progress = runningFlowState
      ? { current: runningFlowState.current, total: runningFlowState.total }
      : null;
    sendResponse({ running, progress });
    return true;
  }
});

// ── Single template run (existing behavior) ──────────────────────

async function runOnActiveTab(payload, templateFieldConfigs) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) throw new Error("No active tab found");

  const data = await loadOrMigrateStorage();
  const domain = data[STORAGE_KEYS.DOMAIN];
  if (domain && !tab.url.includes(domain)) {
    throw new Error(`Active tab (${tab.url}) does not match configured domain (${domain})`);
  }

  const fieldConfigs = (templateFieldConfigs || data[STORAGE_KEYS.FIELD_CONFIGS] || DEFAULT_FIELD_CONFIGS)
    .filter((f) => f.enabled !== false);

  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ["src/selectors.js", "src/content-script.js"],
  });

  runningTabId = tab.id;

  return new Promise((resolve) => {
    const listener = (message) => {
      if (message.type === "AUTOMATION_RESULT") {
        chrome.runtime.onMessage.removeListener(listener);
        runningTabId = null;
        resolve({ ...message, tabId: tab.id });
      }
    };
    chrome.runtime.onMessage.addListener(listener);

    chrome.tabs.sendMessage(tab.id, {
      type: "FILL_FORM",
      payload,
      fieldConfigs,
    });
  });
}

// ── Flow / batch runner ──────────────────────────────────────────

async function runFlow(configuration, dataItems, startUrl) {
  if (!Array.isArray(dataItems) || dataItems.length === 0) {
    throw new Error("No data items to process.");
  }

  const fieldConfigs = configuration.filter((f) => f.enabled !== false);
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) throw new Error("No active tab found");

  const data = await loadOrMigrateStorage();
  const domain = data[STORAGE_KEYS.DOMAIN];

  runningTabId = tab.id;
  runningFlowState = { current: 0, total: dataItems.length, aborted: false };

  try {
    for (let i = 0; i < dataItems.length; i++) {
      if (runningFlowState.aborted) {
        throw new Error("STOPPED");
      }

      runningFlowState.current = i + 1;
      broadcastProgress(i + 1, dataItems.length);

      // Navigate to startUrl for items after the first
      if (i > 0 && startUrl) {
        await navigateAndWait(tab.id, startUrl);
      } else if (i > 0 && !startUrl) {
        const result = {
          ok: false,
          error: `No start URL configured. Batch stopped after item ${i}/${dataItems.length}.`,
          completed: i,
          total: dataItems.length,
        };
        broadcastFlowResult(result);
        return result;
      }

      // Inject content scripts (fresh context after navigation)
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["src/selectors.js", "src/content-script.js"],
      });

      // Run automation for this data item
      const itemResult = await runSingleItem(tab.id, fieldConfigs, dataItems[i]);

      if (itemResult.stopped) {
        const result = { ok: false, stopped: true, error: "Automation stopped by user.", completed: i, total: dataItems.length };
        broadcastFlowResult(result);
        return result;
      }

      if (!itemResult.ok) {
        const result = { ok: false, error: `Item ${i + 1} failed: ${itemResult.error}`, completed: i, total: dataItems.length };
        broadcastFlowResult(result);
        return result;
      }
    }

    const result = { ok: true, message: `All ${dataItems.length} request(s) completed.`, completed: dataItems.length, total: dataItems.length };
    broadcastFlowResult(result);
    return result;
  } finally {
    runningTabId = null;
    runningFlowState = null;
  }
}

function runSingleItem(tabId, fieldConfigs, payload) {
  return new Promise((resolve) => {
    const listener = (message) => {
      if (message.type === "AUTOMATION_RESULT") {
        chrome.runtime.onMessage.removeListener(listener);
        resolve(message);
      }
    };
    chrome.runtime.onMessage.addListener(listener);

    chrome.tabs.sendMessage(tabId, {
      type: "FILL_FORM",
      payload,
      fieldConfigs,
    });
  });
}

// ── Batch navigation ─────────────────────────────────────────────

function navigateAndWait(tabId, url) {
  return new Promise((resolve, reject) => {
    const onUpdated = (updatedTabId, changeInfo) => {
      if (updatedTabId === tabId && changeInfo.status === "complete") {
        chrome.tabs.onUpdated.removeListener(onUpdated);
        clearTimeout(timeout);
        setTimeout(resolve, 1500); // extra settle time after load
      }
    };

    const timeout = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(onUpdated);
      resolve(); // proceed even on timeout
    }, 30000);

    chrome.tabs.onUpdated.addListener(onUpdated);
    chrome.tabs.update(tabId, { url });
  });
}

// ── Progress broadcast ───────────────────────────────────────────

function broadcastProgress(current, total) {
  chrome.runtime.sendMessage({ type: "FLOW_PROGRESS", current, total }).catch(() => {});
}

function broadcastFlowResult(result) {
  chrome.runtime.sendMessage({ type: "FLOW_RESULT", ...result }).catch(() => {});
}
