# Implementation Plan: Fix Hard-Reload Bug for Static Response Mocks

**Branch**: `005-fix-mock-hard-reload` | **Date**: 2026-04-29 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/005-fix-mock-hard-reload/spec.md`

## Summary

Static "Modify Response" mocks unreliably reach the page on a normal reload (today they require a hard refresh, and even then sometimes leak through as upstream 404s). Root cause is a timing race between two MV3 components that both run in the page MAIN world at `document_start`:

1. The **interceptor** content script (registered via `chrome.scripting.registerContentScripts` from `serviceWorker.ts`), which patches `window.fetch` and `XMLHttpRequest` at document start.
2. The **rules payload** (pushed by the service worker from `chrome.webNavigation.onCommitted` → `chrome.scripting.executeScript({ func: ..., world: "MAIN" })`), which sets `window[NAMESPACE].rules`.

These two are dispatched from independent event sources and have no ordering guarantee. The interceptor frequently runs before the rules arrive; in `getMatchedRuleByUrl` (`src/utils/contentScript.ts`) the read `window[NAMESPACE].rules.forEach(...)` then throws (because `.rules` is `undefined`), the surrounding `try/catch` in `cotentScript/fetch.ts` swallows the error and falls through to the original `fetch`, and the user observes the upstream response (often 404) instead of the mock. Hard refreshes mask this because the larger network round-trip gives the rules-injection executeScript time to land first; cache-served reloads make it worse.

The fix is **deterministic ordering, not bigger windows**: install the interceptor with a built-in **request queue** that holds matching requests until rules are guaranteed available, eagerly load rules from a synchronous source path so they reach the MAIN world *before* the first interceptable request, and replace silent fall-through-on-error with explicit, observable failure modes. No rule schema, storage, or UI changes; the entire diff is contained in the interceptor and the service-worker injection path.

## Technical Context

**Language/Version**: TypeScript 5.3.x (existing); compiles to ES output via Webpack + Babel
**Primary Dependencies**: React 18 (UI only — not touched by this fix); `@types/chrome` 0.0.287; existing internal services (`StorageService`, `MatcherService`, `InjectCodeService`, `BaseService`/`ListenerService`)
**Storage**: `chrome.storage.local` (canonical for rules — not modified by this fix); page-world `window[NAMESPACE]` (read-only mirror exposed to interceptor)
**Testing**: No automated test runner is configured in `browser-extension/package.json`. This fix uses (a) a checked-in manual-verification harness (`specs/005-fix-mock-hard-reload/quickstart.md` + a static `mock-harness.html`) and (b) targeted runtime assertions surfaced via `console.warn` to make race-window collapses observable in DevTools.
**Target Platform**: Manifest V3 Chromium (Chrome + Edge), as compiled by `webpack.development.js` / `webpack.production.js` to `dist/<browser>/`
**Project Type**: Browser extension (single project, MV3)
**Performance Goals**: Rule matching for the first interceptable request adds ≤ 10 ms over upstream baseline for rule sets up to 100 enabled rules (SC-006). Hold/release of queued requests adds ≤ 50 ms wall-clock when rules are not yet present at first call.
**Constraints**:
- MV3 service worker is non-persistent (idle/wake) — solution MUST tolerate worker suspension at navigation time.
- Page MAIN-world code has no `chrome.*` API access (must rely on registered content scripts or `executeScript` injections to import data).
- Interceptor MUST install patches synchronously at `document_start` (any deferred patch loses early `document.write`-era requests).
- Modify-response MUST not regress modify-request-body, inject-file, redirect, or modify-headers paths (FR-010).
**Scale/Scope**: ≤ 100 enabled rules in normal usage; per-tab interceptor instance; no persistent state added.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Pre-Phase-0 evaluation

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Service-Oriented Architecture | PASS | All changes localized to `InjectCodeService` (rules injection ordering, storage subscription) and the `cotentScript/` interceptor entrypoint. No new singleton services introduced. `BaseService` listener pattern preserved. |
| II. Message-Driven Communication | PASS | New rule pushes from worker→page use `chrome.scripting.executeScript` (existing pattern in `InjectCodeService.injectRules`). New ack from page→worker (when rules are received) uses `chrome.runtime.sendMessage` with a new `PostMessageAction` enum value, consistent with `URLChanged` precedent. |
| III. Dual Rule Execution Strategy | PASS | Fix is exclusively on the page-world (fetch/XHR) branch. DNR path is untouched. |
| IV. Storage as Source of Truth | PASS | `StorageService` remains canonical. New early-load uses `StorageService.getFilteredRules`; no direct `chrome.storage` calls added. |
| V. Type-Driven Rule Generation | PASS | No new `PageType` values; no new `generate*Rule.ts`; no `generateRuleMap` change. |
| VI. Context Isolation Awareness | PASS | This principle is what we are *fixing*. Plan explicitly separates: ISOLATED-world bootstrap (`setupContentConfig.ts` extension) vs MAIN-world interceptor (`interceptor.ts`) vs service worker (`serviceWorker.ts`). |
| VII. Component Composition with HOCs | N/A | No UI changes. |
| VIII. React Context for Cross-Cutting State | N/A | No UI changes. |

### Technical Constraints check

| Constraint | Status | Notes |
|-----------|--------|-------|
| MV3 compliance | PASS | No background pages introduced; all injection via `chrome.scripting`; `declarativeNetRequest` paths untouched. |
| Build/Output | PASS | New entry not added; `interceptor` and `setupContentConfig` entries already exist in `webpack.common.js`. |
| Path aliases | PASS | All new code will use `@services/`, `@utils/`, `@models/`, `@options/` aliases. |

**Verdict**: All gates pass. No Complexity Tracking entries needed.

## Project Structure

### Documentation (this feature)

```text
specs/005-fix-mock-hard-reload/
├── plan.md                          # This file
├── research.md                      # Phase 0: race-condition diagnosis + option matrix
├── data-model.md                    # Phase 1: in-memory state shapes (window[NAMESPACE], queue entry)
├── contracts/
│   ├── postMessageActions.md        # New PostMessageAction values + payloads
│   └── window-namespace.md          # MAIN-world window[NAMESPACE] contract
├── quickstart.md                    # Phase 1: manual verification harness + reload matrix
├── checklists/
│   └── requirements.md              # Spec quality checklist (already passing)
└── tasks.md                         # Created later by /speckit.tasks
```

### Source Code (repository root)

```text
browser-extension/
├── src/
│   ├── manifest.json                                  # No changes (interceptor is registered dynamically)
│   ├── serviceWorker/
│   │   └── serviceWorker.ts                           # MODIFIED: register interceptor pre-`onCommitted`; pass initial rules via registered script's args path; subscribe to storage changes to refresh injected rule set
│   ├── services/
│   │   ├── InjectCodeService.ts                       # MODIFIED: `registerContentScripts` includes a tiny pre-script that bootstraps `window[NAMESPACE]` with `{ rules: [], ready: false, queue: [] }` BEFORE `interceptor.js` loads; `injectRules` now flips `ready=true` and drains queue; new `refreshRulesForAllTabs` triggered on rule storage change
│   │   ├── StorageService.ts                          # No structural change (read-only consumer)
│   │   └── MatcherService.ts                          # No change
│   ├── cotentScript/
│   │   ├── interceptor.ts                             # MODIFIED: orchestrates fetch + xhr + queue; installs patches synchronously, queues calls until ready, exposes `__inssmanReady` promise
│   │   ├── fetch.ts                                   # MODIFIED: routes through queue helper instead of direct `getMatchedRuleByUrl`; replaces silent catch with structured warning
│   │   ├── xhr.ts                                     # MODIFIED: same pattern as fetch.ts
│   │   ├── intercept.ts                               # No change (legacy path; stays as fallback)
│   │   └── setupContentConfig.ts                      # No change
│   ├── utils/
│   │   └── contentScript.ts                           # MODIFIED: `getMatchedRuleByUrl` returns a tagged result `{ status: 'matched'|'no-match'|'rules-not-ready', rule? }` instead of relying on truthiness; safe-guards undefined `window[NAMESPACE]`
│   ├── models/
│   │   ├── postMessageActionModel.ts                  # MODIFIED: add `RulesReceived`, `RulesRefreshRequested`
│   │   └── formFieldModel.tsx                         # No change
│   └── options/
│       └── constant/index.ts                          # No change
└── webpack/
    ├── webpack.common.js                              # No change
    ├── webpack.development.js                         # No change
    └── webpack.production.js                          # No change

specs/005-fix-mock-hard-reload/
└── (see Documentation tree above)
```

**Structure Decision**: Single-project MV3 browser extension; all source under `browser-extension/src/`. The fix is surgical — touching one new utility, two existing services, three content-script files, and one model — and adds no new entry points to webpack. Test verification lives next to the spec (`specs/005-fix-mock-hard-reload/quickstart.md` + a static harness page) because the project does not yet have an automated test runner; introducing one is out of scope.

## Complexity Tracking

> No constitution violations. Section intentionally empty.
