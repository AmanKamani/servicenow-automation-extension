const fileInput = document.getElementById("jsonFile");
const fileNameDisplay = document.getElementById("fileNameDisplay");
const preview = document.getElementById("preview");
const runBtn = document.getElementById("runBtn");
const stopBtn = document.getElementById("stopBtn");
const logList = document.getElementById("logList");
const templateSelect = document.getElementById("templateSelect");

let currentMode = "upload";
let parsedPayload = null;
let selectedFieldConfigs = null;
let storageData = {};
let isRunning = false;

// ── Init ─────────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", async () => {
  storageData = await loadOrMigrateStorage();

  currentMode = storageData[STORAGE_KEYS.LAST_INPUT_MODE] || "upload";
  activateMode(currentMode);
  populateTemplates();

  if (currentMode === "template") loadSelectedTemplate();

  // Check if automation is already running (popup was closed & reopened)
  chrome.runtime.sendMessage({ type: "IS_RUNNING" }, (response) => {
    if (chrome.runtime.lastError) return;
    if (response?.running) {
      setRunning(true);
      log("info", "Automation is running...");
    }
  });
});

// Listen for automation completion (handles the case where popup was reopened mid-run)
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "AUTOMATION_RESULT") {
    setRunning(false);
    if (msg.stopped) {
      log("warn", msg.error || "Automation stopped.");
    } else if (msg.ok) {
      log("ok", msg.message || "Automation completed.");
    } else {
      log("err", msg.error || "Unknown error.");
    }
  }
});

// ── Mode tabs ────────────────────────────────────────────────────

document.querySelectorAll(".mode-tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    currentMode = tab.dataset.mode;
    activateMode(currentMode);
    chrome.storage.sync.set({ [STORAGE_KEYS.LAST_INPUT_MODE]: currentMode });
    parsedPayload = null;
    selectedFieldConfigs = null;
    runBtn.disabled = true;
    preview.classList.add("hidden");

    if (currentMode === "template") loadSelectedTemplate();
  });
});

function activateMode(mode) {
  document.querySelectorAll(".mode-tab").forEach((t) => t.classList.toggle("active", t.dataset.mode === mode));
  document.getElementById("modeUpload").classList.toggle("hidden", mode !== "upload");
  document.getElementById("modeTemplate").classList.toggle("hidden", mode !== "template");
}

// ── Upload mode ──────────────────────────────────────────────────

fileInput.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const raw = JSON.parse(reader.result);

      let payloadObj = raw;
      let configs = null;

      // Detect exported format: { configuration: [...], data: [...] }
      if (Array.isArray(raw.configuration) && Array.isArray(raw.data)) {
        configs = raw.configuration;
        payloadObj = {};
        for (const entry of raw.data) {
          if (entry.key) payloadObj[entry.key] = entry.value;
        }
      }

      const result = validateInput(payloadObj);
      if (!result.valid) {
        showPreviewError(result.errors);
        parsedPayload = null;
        selectedFieldConfigs = null;
        runBtn.disabled = true;
        return;
      }
      parsedPayload = result.data;
      selectedFieldConfigs = configs;
      fileNameDisplay.textContent = file.name;
      fileInput.closest(".file-label").classList.add("loaded");
      showPreviewSuccess(parsedPayload);
      runBtn.disabled = false;
      clearLog();
    } catch (err) {
      showPreviewError([`Invalid JSON: ${err.message}`]);
      parsedPayload = null;
      selectedFieldConfigs = null;
      runBtn.disabled = true;
    }
  };
  reader.readAsText(file);
});

// ── Template mode ────────────────────────────────────────────────

function populateTemplates() {
  const tpls = storageData[STORAGE_KEYS.TEMPLATES] || [];
  templateSelect.innerHTML = '<option value="">Select a template...</option>';
  tpls.forEach((tpl) => {
    const opt = document.createElement("option");
    opt.value = tpl.id;
    opt.textContent = tpl.name;
    templateSelect.appendChild(opt);
  });

  const lastId = storageData[STORAGE_KEYS.LAST_TEMPLATE_ID];
  if (lastId) templateSelect.value = lastId;
}

templateSelect.addEventListener("change", () => {
  chrome.storage.sync.set({ [STORAGE_KEYS.LAST_TEMPLATE_ID]: templateSelect.value });
  loadSelectedTemplate();
});

function loadSelectedTemplate() {
  const tplId = templateSelect.value;
  if (!tplId) {
    parsedPayload = null;
    selectedFieldConfigs = null;
    runBtn.disabled = true;
    preview.classList.add("hidden");
    return;
  }
  chrome.storage.sync.get(STORAGE_KEYS.TEMPLATES, (data) => {
    const tpls = data[STORAGE_KEYS.TEMPLATES] || [];
    const tpl = tpls.find((t) => t.id === tplId);
    if (!tpl) {
      showPreviewError(["Template not found."]);
      parsedPayload = null;
      selectedFieldConfigs = null;
      runBtn.disabled = true;
      return;
    }
    const result = validateInput(tpl.payload);
    if (!result.valid) {
      showPreviewError(result.errors);
      parsedPayload = null;
      selectedFieldConfigs = null;
      runBtn.disabled = true;
      return;
    }
    parsedPayload = result.data;
    selectedFieldConfigs = tpl.fieldConfigs || null;
    showPreviewSuccess(parsedPayload);
    runBtn.disabled = false;
  });
}

// ── Run automation ───────────────────────────────────────────────

runBtn.addEventListener("click", () => {
  if (!parsedPayload) return;
  setRunning(true);
  clearLog();
  log("info", "Sending automation request...");

  const msg = { type: "RUN_AUTOMATION", payload: parsedPayload };
  if (selectedFieldConfigs) msg.fieldConfigs = selectedFieldConfigs;

  chrome.runtime.sendMessage(msg, (response) => {
    setRunning(false);
    if (chrome.runtime.lastError) {
      log("err", `Extension error: ${chrome.runtime.lastError.message}`);
      return;
    }
    if (!response) {
      log("err", "No response from background script.");
      return;
    }
    if (response.stopped) {
      log("warn", response.error || "Automation stopped.");
    } else if (response.ok) {
      log("ok", response.message || "Automation completed.");
    } else {
      log("err", response.error || "Unknown error.");
    }
  });
});

stopBtn.addEventListener("click", () => {
  log("warn", "Stopping automation...");
  chrome.runtime.sendMessage({ type: "STOP_AUTOMATION" }, (response) => {
    if (chrome.runtime.lastError || !response?.ok) {
      log("err", "Could not stop — automation may have already finished.");
    }
  });
});

function setRunning(running) {
  isRunning = running;
  runBtn.classList.toggle("hidden", running);
  stopBtn.classList.toggle("hidden", !running);
  if (!running) runBtn.disabled = !parsedPayload;
}

// ── Helpers ──────────────────────────────────────────────────────

function showPreviewSuccess(data) {
  preview.classList.remove("hidden");
  preview.textContent = JSON.stringify(data, null, 2);
  preview.style.color = "#166534";
}

function showPreviewError(errors) {
  preview.classList.remove("hidden");
  preview.textContent = errors.join("\n");
  preview.style.color = "#dc2626";
}

function log(level, message) {
  const li = document.createElement("li");
  const dot = document.createElement("span");
  dot.className = `dot dot-${level}`;
  li.appendChild(dot);
  li.appendChild(document.createTextNode(message));
  logList.appendChild(li);
  logList.scrollTop = logList.scrollHeight;
}

function clearLog() { logList.innerHTML = ""; }
