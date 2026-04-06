# Cross URL Automation

## Problem Statement

Today, automation effectively runs within one active page context at a time. While flows can start from a URL, there is no first-class concept of intentional mid-run URL transitions as part of the automation definition itself. This limits multi-page scenarios where the process must navigate to another route/site area between steps.

Examples:

- Open request form on URL A, submit, then continue enrichment on URL B.
- Fill data on one module page, then navigate to approval page and trigger actions.
- Perform repeated workflows where each item needs multiple page hops.

## Proposed Design

Introduce explicit navigation steps in template/flow execution so URL transitions become predictable, configurable actions instead of implicit behavior.

### 1) New Navigation Step Type

Add a dedicated action type for URL transitions (e.g. `navigate`) in configuration:

- Target URL (static or value-templated)
- Wait mode after navigation:
  - `domcontentloaded`
  - `networkidle` (bounded timeout)
  - custom selector wait (`waitForLabel` or `waitForSelector`)
- Optional domain/safety policy override

### 2) Flow-Level and Step-Level URL Control

Support both:

- **Flow-level start URL** (existing concept) for entry point
- **Step-level navigation** for explicit route changes during execution

Execution engine should treat navigation as a first-class step in ordered sequence.

### 3) Safety Controls

To avoid accidental navigation to unsafe/unexpected destinations:

- Default allowlist policy based on configured domain
- Optional per-flow allowlist additions
- Block and report when navigation target violates policy

### 4) Resilience and Recovery

When navigation fails:

- Honor flow error policy (`stop`, `skip`, `retry`)
- Emit clear logs:
  - attempted URL
  - wait condition
  - timeout/failure reason

## Risks and Constraints

- **Cross-origin restrictions:** content-script context and permissions differ by origin.
- **Timing instability:** post-navigation DOM readiness varies by app.
- **Redirect complexity:** final URL may differ from target URL.
- **Permission scope:** host permissions may need expansion for broader URL coverage.
- **State coupling:** page-level state (session/dialogs) may break between transitions.

## Phased Rollout

### Phase 1 — Basic Step Navigation

- Add `navigate` step with URL + basic load wait.
- Integrate with existing run/stop/error framework.
- Add logs and guardrails for blocked navigation.

### Phase 2 — Advanced Wait Conditions

- Add selector/label-driven readiness waits.
- Add redirect-aware success criteria.
- Add configurable timeouts per navigation step.

### Phase 3 — Dynamic URLs + Data Binding

- Allow URL templating from payload data (e.g. `/request/${requestId}`).
- Add validation and escaping rules for dynamic URL construction.

## Open Questions

- Should navigation support only same-domain initially, or configured multi-domain allowlist from day one?
- What should be default wait strategy for navigation steps (`domcontentloaded` vs selector-based)?
- Do we require per-step confirmation for domain changes in early rollout?

## Success Criteria

- Users can define and run multi-URL workflows without manual intervention.
- Navigation failures are diagnosable from logs without debugging code.
- No regression in existing single-URL template and flow behavior.
