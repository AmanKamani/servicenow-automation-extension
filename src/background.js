importScripts("storage-defaults.js");

let runningTabId = null;

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "RUN_AUTOMATION") {
    runOnActiveTab(msg.payload, msg.fieldConfigs)
      .then((res) => sendResponse(res))
      .catch((err) => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  if (msg.type === "STOP_AUTOMATION") {
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
    sendResponse({ running: runningTabId !== null });
    return true;
  }
});

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
