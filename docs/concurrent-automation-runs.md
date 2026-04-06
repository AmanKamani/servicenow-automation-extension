# Concurrent Automation Runs

## Problem Statement

Current execution is single-run oriented: only one automation can run at a time. This creates throughput limits for teams/users handling multiple independent requests, tabs, or workflows in parallel.

Limitations today:

- A second run request is blocked while another run is active.
- One long-running flow can delay unrelated work.
- Operators cannot isolate independent jobs by tab/window.

## Proposed Design

Enable controlled concurrency with explicit run isolation, resource limits, and operational visibility.

### 1) Run Manager Abstraction

Replace single global run state with a run manager maintaining multiple run contexts:

- `runId`
- target `tabId`
- mode (`template`/`flow`)
- progress state
- cancellation token
- per-run logs/errors

### 2) Concurrency Model

Support two policy modes:

- **Queue mode (safe default):** serialize runs but avoid “busy” rejection.
- **Parallel mode (opt-in):** run multiple contexts concurrently with configurable max active runs.

### 3) Isolation Rules

Each run must be isolated by:

- tab/session context
- config snapshot at start
- progress/log channel
- stop/cancel controls

No shared mutable run state beyond run manager registry.

### 4) UI/UX Enhancements

Expose per-run visibility in sidepanel:

- active runs list
- per-run status/progress
- run-specific stop/retry controls

Optionally include “Start in new tab” helper for safe parallel execution.

## Risks and Constraints

- **Browser API contention:** concurrent messaging/script injection can collide if not scoped by `tabId` + `runId`.
- **Resource pressure:** many runs may increase CPU/memory and degrade reliability.
- **User confusion:** mixed logs/progress without clear run separation.
- **Data races:** if two runs act on same tab/page, actions may interfere.

## Phased Rollout

### Phase 1 — Queue First

- Introduce run manager and queued execution.
- Add run lifecycle events and per-run IDs.
- Preserve current behavior while removing hard “single-run only” bottleneck.

### Phase 2 — Controlled Parallelism

- Add parallel mode with small default limit (e.g. 2 or 3).
- Enforce “one active run per tab” safety rule.
- Add per-run status cards in sidepanel.

### Phase 3 — Advanced Scheduling

- Priority/ordering controls.
- Retry policies per run.
- Optional persisted run history and summary metrics.

## Open Questions

- Should parallel mode be global toggle, per-run choice, or both?
- What default max concurrency is safe for typical enterprise forms?
- Do we allow same-domain multi-tab parallel runs by default?

## Success Criteria

- Users can start additional automations without waiting for unrelated runs.
- Run logs/progress remain clear and attributable by run ID.
- No regressions in stop behavior, dialog handling, or flow completion accuracy.
