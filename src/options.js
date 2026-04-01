let fieldConfigs = [];
let templates = [];
let payloadValues = {};

// The template currently being edited, or null for a brand-new template
let activeTemplateId = null;
let _autoSaveTimer = null;

document.addEventListener("DOMContentLoaded", async () => {
  const data = await loadOrMigrateStorage();

  document.getElementById("domain").value = data.domain || "";
  fieldConfigs = data[STORAGE_KEYS.FIELD_CONFIGS] || JSON.parse(JSON.stringify(DEFAULT_FIELD_CONFIGS));
  templates = data[STORAGE_KEYS.TEMPLATES] || [];

  renderTemplateList();

  // Wire sidebar click (once, uses event delegation)
  document.getElementById("templateList").addEventListener("click", handleSidebarClick);

  // Wire field list events (once, uses event delegation)
  const fieldListEl = document.getElementById("fieldList");
  fieldListEl.addEventListener("click", handleFieldAction);
  fieldListEl.addEventListener("change", handleFieldChange);
  fieldListEl.addEventListener("input", handleFieldChange);

  // Wire payload form events (once, uses event delegation)
  document.getElementById("payloadForm").addEventListener("input", handlePayloadInput);

  // Wire buttons
  document.getElementById("newTemplateBtn").addEventListener("click", startNewTemplate);
  document.getElementById("saveNewBtn").addEventListener("click", handleSaveNew);
  document.getElementById("updateBtn").addEventListener("click", handleUpdate);
  document.getElementById("duplicateBtn").addEventListener("click", handleDuplicate);
  document.getElementById("deleteCurrentBtn").addEventListener("click", handleDeleteCurrent);
  document.getElementById("addFieldBtn").addEventListener("click", addField);
  document.getElementById("addFieldBtnBottom").addEventListener("click", addField);
  document.getElementById("resetFieldsBtn").addEventListener("click", resetFields);
  document.getElementById("importFieldsFile").addEventListener("change", importFields);
  document.getElementById("exportFieldsBtn").addEventListener("click", exportFields);
  document.getElementById("exportPayloadBtn").addEventListener("click", exportPayload);
  document.getElementById("templateNameInput").addEventListener("input", scheduleAutoSave);
  document.getElementById("domain").addEventListener("change", persistDomain);
  document.getElementById("reloadExtLink").addEventListener("click", (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: "chrome://extensions" });
  });
});

// ── Template sidebar ─────────────────────────────────────────────

function renderTemplateList() {
  const container = document.getElementById("templateList");
  container.innerHTML = "";

  if (templates.length === 0) {
    container.innerHTML = '<div class="template-list-empty">No templates yet.<br>Click <strong>+ New</strong> to create one.</div>';
    return;
  }

  templates.forEach((tpl, idx) => {
    const fieldCount = (tpl.fieldConfigs || []).length;
    const isActive = activeTemplateId === tpl.id;

    const item = document.createElement("div");
    item.className = "tpl-item" + (isActive ? " active" : "");
    item.dataset.tplIdx = idx;
    item.innerHTML = `
      <div class="tpl-item-info">
        <span class="tpl-item-name">${esc(tpl.name)}</span>
        <span class="tpl-item-meta">${fieldCount} field(s)</span>
      </div>
    `;
    container.appendChild(item);
  });
}

function handleSidebarClick(e) {
  const item = e.target.closest(".tpl-item");
  if (item) {
    const idx = parseInt(item.dataset.tplIdx, 10);
    loadTemplate(templates[idx]);
  }
}

// ── Editor state ─────────────────────────────────────────────────

function showEmptyState() {
  document.getElementById("emptyState").classList.remove("hidden");
  document.getElementById("editorContent").classList.add("hidden");
  updateActionButtons();
}

function showEditor() {
  document.getElementById("emptyState").classList.add("hidden");
  document.getElementById("editorContent").classList.remove("hidden");
  updateActionButtons();
}

function updateActionButtons() {
  const isNew = activeTemplateId === null;
  const hasEditor = !document.getElementById("editorContent").classList.contains("hidden");

  document.getElementById("saveNewBtn").classList.toggle("hidden", !hasEditor || !isNew);
  document.getElementById("updateBtn").classList.toggle("hidden", !hasEditor || isNew);
  document.getElementById("duplicateBtn").classList.toggle("hidden", !hasEditor || isNew);
  document.getElementById("deleteCurrentBtn").classList.toggle("hidden", !hasEditor || isNew);

  document.getElementById("editingBadge").classList.toggle("hidden", isNew);
  document.getElementById("newBadge").classList.toggle("hidden", !isNew);
}

// ── New template ─────────────────────────────────────────────────

function startNewTemplate() {
  activeTemplateId = null;
  fieldConfigs = [];
  payloadValues = {};

  document.getElementById("templateNameInput").value = "";
  renderFieldList();
  renderPayloadForm();
  renderTemplateList();
  showEditor();

  document.getElementById("templateNameInput").focus();
}

// ── Load existing template ───────────────────────────────────────

function loadTemplate(tpl) {
  activeTemplateId = tpl.id;

  document.getElementById("templateNameInput").value = tpl.name || "";
  fieldConfigs = JSON.parse(JSON.stringify(tpl.fieldConfigs || []));
  payloadValues = JSON.parse(JSON.stringify(tpl.payload || {}));

  renderFieldList();
  renderPayloadForm();
  renderTemplateList();
  showEditor();
}

// ── Save / Update / Duplicate / Delete ───────────────────────────

function handleSaveNew() {
  const name = document.getElementById("templateNameInput").value.trim();
  if (!name) { alert("Enter a template name."); document.getElementById("templateNameInput").focus(); return; }

  const newTpl = {
    id: "tpl_" + Date.now(),
    name,
    payload: readPayloadFromForm(),
    fieldConfigs: JSON.parse(JSON.stringify(fieldConfigs)),
  };

  templates.push(newTpl);
  activeTemplateId = newTpl.id;
  persistTemplates();
  renderTemplateList();
  updateActionButtons();
  showToast(`Template "${name}" saved.`);
}

function handleUpdate() {
  const tpl = templates.find((t) => t.id === activeTemplateId);
  if (!tpl) return;

  const name = document.getElementById("templateNameInput").value.trim();
  if (!name) { alert("Template name cannot be empty."); return; }

  tpl.name = name;
  tpl.payload = readPayloadFromForm();
  tpl.fieldConfigs = JSON.parse(JSON.stringify(fieldConfigs));

  persistTemplates();
  renderTemplateList();
  showToast(`Template "${name}" updated.`);
}

function handleDuplicate() {
  const name = document.getElementById("templateNameInput").value.trim() + " (copy)";
  const dup = {
    id: "tpl_" + Date.now(),
    name,
    payload: readPayloadFromForm(),
    fieldConfigs: JSON.parse(JSON.stringify(fieldConfigs)),
  };

  templates.push(dup);
  activeTemplateId = dup.id;
  document.getElementById("templateNameInput").value = name;
  persistTemplates();
  renderTemplateList();
  updateActionButtons();
  showToast(`Duplicated as "${name}".`);
}

function handleDeleteCurrent() {
  const tpl = templates.find((t) => t.id === activeTemplateId);
  if (!tpl) return;
  if (!confirm(`Delete template "${tpl.name}"?`)) return;

  templates = templates.filter((t) => t.id !== activeTemplateId);
  activeTemplateId = null;
  persistTemplates();
  renderTemplateList();
  showEmptyState();
  showToast("Template deleted.");
}

// ── Dynamic payload form ─────────────────────────────────────────

function renderPayloadForm() {
  const container = document.getElementById("payloadForm");
  const emptyMsg = document.getElementById("payloadEmpty");
  container.innerHTML = "";

  if (fieldConfigs.length === 0) {
    container.classList.add("hidden");
    emptyMsg.classList.remove("hidden");
    return;
  }

  container.classList.remove("hidden");
  emptyMsg.classList.add("hidden");

  fieldConfigs.forEach((cfg) => {
    const key = cfg.key;
    const label = cfg.displayName || key;
    const currentValue = payloadValues[key];
    const isMulti = cfg.fieldType === "typeahead";
    const isButton = cfg.fieldType === "button";

    const row = document.createElement("div");
    row.className = "payload-row" + (isButton ? " payload-row-button" : "");

    const labelEl = document.createElement("label");
    labelEl.textContent = label;
    if (isButton) {
      const small = document.createElement("small");
      small.textContent = " (button text)";
      labelEl.appendChild(small);
    } else if (isMulti) {
      const small = document.createElement("small");
      small.textContent = " (one per line)";
      labelEl.appendChild(small);
    }

    let inputEl;
    if (isMulti && Array.isArray(currentValue)) {
      inputEl = document.createElement("textarea");
      inputEl.rows = 3;
      inputEl.value = currentValue.join("\n");
    } else if (isMulti) {
      inputEl = document.createElement("textarea");
      inputEl.rows = 3;
      inputEl.value = currentValue || "";
    } else {
      inputEl = document.createElement("input");
      inputEl.type = "text";
      inputEl.value = currentValue || "";
    }

    inputEl.dataset.payKey = key;
    inputEl.placeholder = isButton ? `e.g. Next, Submit, Order Now` : `Enter ${label.toLowerCase()}`;

    row.appendChild(labelEl);
    row.appendChild(inputEl);
    container.appendChild(row);
  });
}

function handlePayloadInput(e) {
  const key = e.target.dataset.payKey;
  if (!key) return;
  payloadValues[key] = e.target.value;
  scheduleAutoSave();
}

function readPayloadFromForm() {
  const result = {};
  fieldConfigs.forEach((cfg) => {
    const key = cfg.key;
    const raw = payloadValues[key] || "";

    if (cfg.fieldType === "typeahead" && typeof raw === "string" && raw.includes("\n")) {
      result[key] = raw.split("\n").map((s) => s.trim()).filter(Boolean);
    } else if (Array.isArray(raw)) {
      result[key] = raw;
    } else {
      result[key] = typeof raw === "string" ? raw.trim() : raw;
    }
  });
  return result;
}

// ── Field config UI ──────────────────────────────────────────────

function renderFieldList() {
  const container = document.getElementById("fieldList");
  container.innerHTML = "";

  fieldConfigs.forEach((cfg, idx) => {
    const item = document.createElement("div");
    item.className = "field-item" + (cfg.enabled === false ? " disabled-field" : "");
    item.innerHTML = `
      <div class="field-arrows">
        <button data-dir="up" data-idx="${idx}" title="Move up">&uarr;</button>
        <button data-dir="down" data-idx="${idx}" title="Move down">&darr;</button>
      </div>
      <div class="field-body">
        <div>
          <label title="Unique identifier used as the key in payload JSON. Keep it short, e.g. groupName, members.">Key</label>
          <input type="text" data-field="key" data-idx="${idx}" value="${esc(cfg.key)}">
        </div>
        <div>
          <label title="Friendly name shown in the UI and console logs. Does not affect field matching on the page.">Display Name</label>
          <input type="text" data-field="displayName" data-idx="${idx}" value="${esc(cfg.displayName)}">
        </div>
        <div class="full-width" style="${cfg.fieldType === "button" ? "display:none" : ""}">
          <label title="Text to match against <label> elements on the ServiceNow page. Can be the full label or a unique partial fragment. Multiple values are comma-separated — any match wins.">Label Match <small>(full label or partial text, comma-separated)</small></label>
          <input type="text" data-field="labelMatch" data-idx="${idx}" value="${esc((cfg.labelMatch || []).join(", "))}">
        </div>
        <div>
          <label title="Typeahead: dropdowns that search as you type. Text: plain input/textarea. Choice: native HTML select. Button: finds and clicks a button by its visible text.">Field Type</label>
          <select data-field="fieldType" data-idx="${idx}">
            <option value="typeahead" ${cfg.fieldType === "typeahead" ? "selected" : ""}>Typeahead</option>
            <option value="text" ${cfg.fieldType === "text" ? "selected" : ""}>Text</option>
            <option value="choice" ${cfg.fieldType === "choice" ? "selected" : ""}>Choice (native select)</option>
            <option value="button" ${cfg.fieldType === "button" ? "selected" : ""}>Button (click)</option>
          </select>
        </div>
        <div class="timeout-field" style="${(cfg.fieldType === "text" || cfg.fieldType === "button") ? "display:none" : ""}">
          <label title="How long (ms) to wait after typing for AJAX search results to load. Slow fields like member lookup may need 5000–10000ms. Max: 60000ms.">Search Wait <small>(ms, max 60s)</small></label>
          <input type="number" data-field="ajaxWait" data-idx="${idx}" value="${cfg.ajaxWait || 1500}" min="500" max="60000" step="500">
        </div>
        <div class="timeout-field" style="${(cfg.fieldType === "text" || cfg.fieldType === "button") ? "display:none" : ""}">
          <label title="After the search wait, how many times to poll for dropdown items (~400ms each). More retries = more time for slow-rendering results. e.g. 15 retries ≈ 6s of polling.">Dropdown Retries</label>
          <input type="number" data-field="dropdownRetries" data-idx="${idx}" value="${cfg.dropdownRetries || 15}" min="1" step="1">
        </div>
        <div class="full-width field-footer">
          <label class="toggle-label">
            <input type="checkbox" data-field="enabled" data-idx="${idx}" ${cfg.enabled !== false ? "checked" : ""}>
            Enabled
          </label>
          <button class="btn btn-sm btn-danger" data-action="delete" data-idx="${idx}">Remove</button>
        </div>
      </div>
    `;
    container.appendChild(item);
  });
}

function handleFieldAction(e) {
  const btn = e.target.closest("button");
  if (!btn) return;
  const idx = parseInt(btn.dataset.idx, 10);

  if (btn.dataset.dir === "up" && idx > 0) {
    [fieldConfigs[idx - 1], fieldConfigs[idx]] = [fieldConfigs[idx], fieldConfigs[idx - 1]];
    renderFieldList();
    renderPayloadForm();
    scheduleAutoSave();
  } else if (btn.dataset.dir === "down" && idx < fieldConfigs.length - 1) {
    [fieldConfigs[idx], fieldConfigs[idx + 1]] = [fieldConfigs[idx + 1], fieldConfigs[idx]];
    renderFieldList();
    renderPayloadForm();
    scheduleAutoSave();
  } else if (btn.dataset.action === "delete") {
    if (confirm(`Remove field "${fieldConfigs[idx].displayName}"?`)) {
      fieldConfigs.splice(idx, 1);
      renderFieldList();
      renderPayloadForm();
      scheduleAutoSave();
    }
  }
}

function handleFieldChange(e) {
  const el = e.target;
  const idx = parseInt(el.dataset.idx, 10);
  const field = el.dataset.field;
  if (isNaN(idx) || !field) return;

  if (field === "labelMatch") {
    fieldConfigs[idx].labelMatch = el.value.split(",").map((s) => s.trim()).filter(Boolean);
  } else if (field === "enabled") {
    fieldConfigs[idx].enabled = el.checked;
  } else if (field === "ajaxWait") {
    let val = parseInt(el.value, 10) || 1500;
    if (val > 60000) { val = 60000; el.value = 60000; }
    if (val < 500) { val = 500; el.value = 500; }
    fieldConfigs[idx].ajaxWait = val;
  } else if (field === "dropdownRetries") {
    fieldConfigs[idx].dropdownRetries = parseInt(el.value, 10) || 15;
  } else if (field === "fieldType") {
    fieldConfigs[idx].fieldType = el.value;
    const item = el.closest(".field-item");
    if (item) {
      const timeoutFields = item.querySelectorAll(".timeout-field");
      const hideTimeout = el.value === "text" || el.value === "button";
      timeoutFields.forEach((tf) => { tf.style.display = hideTimeout ? "none" : ""; });
      const labelMatchField = item.querySelector("[data-field='labelMatch']");
      if (labelMatchField) {
        const lmRow = labelMatchField.closest(".full-width");
        if (lmRow) lmRow.style.display = el.value === "button" ? "none" : "";
      }
    }
    renderPayloadForm();
  } else {
    const oldKey = fieldConfigs[idx][field];
    fieldConfigs[idx][field] = el.value;
    // If the key changed, migrate the payload value
    if (field === "key" && oldKey !== el.value) {
      if (payloadValues[oldKey] !== undefined) {
        payloadValues[el.value] = payloadValues[oldKey];
        delete payloadValues[oldKey];
      }
      renderPayloadForm();
    }
    if (field === "displayName") {
      renderPayloadForm();
    }
  }

  scheduleAutoSave();
}

function addField() {
  fieldConfigs.push({
    key: `field_${Date.now()}`,
    displayName: "New Field",
    labelMatch: [],
    fieldType: "typeahead",
    ajaxWait: 1500,
    dropdownRetries: 15,
    enabled: true,
  });
  renderFieldList();
  renderPayloadForm();
  scheduleAutoSave();
}

function resetFields() {
  if (confirm("Reset field configuration to defaults?")) {
    fieldConfigs = JSON.parse(JSON.stringify(DEFAULT_FIELD_CONFIGS));
    renderFieldList();
    renderPayloadForm();
    scheduleAutoSave();
  }
}

function importFields(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const imported = JSON.parse(reader.result);
      if (!Array.isArray(imported)) throw new Error("Must be an array.");
      fieldConfigs = imported;
      renderFieldList();
      renderPayloadForm();
    } catch (err) {
      alert("Invalid field config JSON: " + err.message);
    }
  };
  reader.readAsText(file);
  e.target.value = "";
}

function exportFields() {
  const blob = new Blob([JSON.stringify(fieldConfigs, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "field-configs.json";
  a.click();
  URL.revokeObjectURL(url);
}

function exportPayload() {
  const payload = readPayloadFromForm();
  const enabledConfigs = fieldConfigs.filter((f) => f.enabled !== false);

  const data = enabledConfigs.map((cfg) => ({
    key: cfg.key,
    value: payload[cfg.key] ?? ""
  }));

  const exportData = { configuration: enabledConfigs, data };
  const name = document.getElementById("templateNameInput").value.trim() || "payload";
  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name.replace(/\s+/g, "-").toLowerCase() + ".json";
  a.click();
  URL.revokeObjectURL(url);
}

// ── Auto-save (debounced) ────────────────────────────────────────

function scheduleAutoSave() {
  if (activeTemplateId === null) return;
  clearTimeout(_autoSaveTimer);
  _autoSaveTimer = setTimeout(autoSave, 800);
}

function autoSave() {
  if (activeTemplateId === null) return;
  const tpl = templates.find((t) => t.id === activeTemplateId);
  if (!tpl) return;

  const name = document.getElementById("templateNameInput").value.trim();
  if (name) tpl.name = name;
  tpl.payload = readPayloadFromForm();
  tpl.fieldConfigs = JSON.parse(JSON.stringify(fieldConfigs));

  persistTemplates();
  renderTemplateList();
  showToast("Auto-saved.");
}

// ── Persistence ──────────────────────────────────────────────────

function persistTemplates() {
  chrome.storage.sync.set({ [STORAGE_KEYS.TEMPLATES]: templates });
}

function persistDomain() {
  const domain = document.getElementById("domain").value.trim();
  chrome.storage.sync.set({ [STORAGE_KEYS.DOMAIN]: domain });
}

// ── Utilities ────────────────────────────────────────────────────

function showToast(msg) {
  const toast = document.getElementById("toast");
  toast.textContent = msg;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2500);
}

function esc(str) {
  return String(str).replace(/&/g, "&amp;").replace(/"/g, "&quot;")
    .replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
