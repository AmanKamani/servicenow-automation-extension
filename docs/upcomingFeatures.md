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
