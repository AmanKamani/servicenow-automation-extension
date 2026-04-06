# Upcoming Features

Features planned for future development. Each links to a detailed plan document.

---

## 1. Migration Dashboard and Version Chains (Phase 2)

**Status:** Planned — to be built when `CONFIG_VERSION` is first bumped to 2 (i.e., when a config shape change actually happens).

**Summary:** A complete versioned migration system for config exports/imports, including:

- **Migration Registry** — Incremental upgrade/downgrade chain functions per version pair, enabling lossless auto-upgrade on import and optional downgrade on export with feature-loss warnings.
- **Storage Auto-Migration** — Silently upgrades all stored templates and flows in `chrome.storage.sync` when the extension updates to a newer config version.
- **Export Version Picker** — Dropdown in the Share buttons to export in older config formats, with warnings about what settings will be lost.
- **Import Preview** — Shows the upgrade path and changes before importing an older config file.
- **Migration Dashboard UI** — A dedicated panel in the options page for version management, previewing imports, and selecting export versions.
- **Migration Guidelines** — Developer reference for when/how to bump `CONFIG_VERSION` and write migration pairs.

**Detailed Plan:** [migration-dashboard.md](migration-dashboard.md)

---

## 2. Cross URL Automation

**Status:** Backlog

**Summary:** Add explicit support for URL transitions during automation execution, so flows/templates can navigate between pages as part of the configured step sequence.

- Introduce a first-class `navigate` action/step with URL + wait conditions.
- Add safety constraints (domain allowlist/policy checks) and clear error reporting.
- Support phased improvements: basic navigation, smarter waits, dynamic URL binding from payload.

**Detailed Plan:** [cross-url-automation.md](cross-url-automation.md)

---

## 3. Concurrent Automation Runs

**Status:** Backlog

**Summary:** Evolve from single-run execution to controlled concurrency with run isolation and per-run visibility.

- Add a run manager abstraction (`runId`, per-run progress/logs, cancellation).
- Support queue-first execution, then opt-in bounded parallel runs.
- Add sidepanel UX for multi-run monitoring and controls.

**Detailed Plan:** [concurrent-automation-runs.md](concurrent-automation-runs.md)

---

## 4. Recording to Template/Flow

**Status:** Backlog

**Summary:** Add an interaction recorder that captures user actions and generates draft templates/flows automatically.

- Capture key events (input, choice, toggle, click, navigation) in a recording session.
- Convert captured actions into editable draft configuration with suggested field metadata.
- Add review/confirmation UX before persisting generated templates/flows.

**Detailed Plan:** [recording-to-template-flow.md](recording-to-template-flow.md)
