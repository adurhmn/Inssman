# Phase 0 Research: Fix Hard-Reload Bug for Static Response Mocks

**Date**: 2026-04-29
**Branch**: `005-fix-mock-hard-reload`
**Status**: Complete — all NEEDS CLARIFICATION items resolved.

## R0. Root-cause confirmation

### Decision

The bug is a **MAIN-world ordering race** between two independently-scheduled `document_start`-era code paths, not a matching-logic bug, not a storage bug, and not a manifest-permission bug.

### Rationale

Tracing the existing code:

1. `serviceWorker.ts` (line 19) calls `InjectCodeService.registerContentScripts()` once at SW startup, registering `interceptor/interceptor.js` for `runAt: "document_start"` in MAIN world for all `http(s)://*/*` frames.
2. The same `serviceWorker.ts` (lines 33–52) listens for `chrome.webNavigation.onCommitted` and on each fire reads `chrome.storage.local`, then calls `InjectCodeService.injectRules(tabId, rules)` which does another `chrome.scripting.executeScript({ func: ..., world: "MAIN", injectImmediately: true })` to set `window[NAMESPACE].rules = rules`.
3. The interceptor (`cotentScript/interceptor.ts` → `fetch.ts` + `xhr.ts`) calls `initFetchInterceptor()` / `initXhrInterceptor()` synchronously at module top level, patching `window.fetch` and `XMLHttpRequest` immediately.
4. `getMatchedRuleByUrl` in `utils/contentScript.ts` (line 164) executes `window[NAMESPACE].rules.forEach(...)` — which throws `TypeError: Cannot read properties of undefined (reading 'forEach')` whenever `window[NAMESPACE]` or `.rules` is not yet populated.
5. Both `fetch.ts` (lines 26–189, outer `try/catch`) and `xhr.ts` (line 382 catch) swallow that throw and fall back to the original `fetch`/`send`. The user sees the upstream response — which, in dev/test setups where the path doesn't exist, is a 404. This perfectly matches the reported symptom set: "needs hard refresh", "404 even though rule matches", "stops working intermittently".

Why hard refresh sometimes "fixes" it: a hard refresh forces a full network round-trip for the document and main resources, giving the `onCommitted`-triggered `executeScript` extra wall-clock time to land before the page issues its first `fetch`/XHR. A normal reload served fast from cache (or with no network latency to the document) closes that window and the race is lost. This also explains the environment-dependent intermittency.

### Alternatives considered (and rejected)

- **"Rules aren't actually saved correctly."** Falsified: `StorageService.getFilteredRules` reads them fine; the same `rules` array is what gets passed into `injectRules`.
- **"`MatcherService.isUrlsMatch` is broken."** Falsified: same matcher works after a hard refresh on the same rule.
- **"Manifest content_scripts ordering is wrong."** Partially related (see R3), but the root failure is the *executeScript* delivery of rules, not the registered content script itself.
- **"declarativeNetRequest can replace this."** Rejected for response-body modification: DNR cannot mock arbitrary response bodies; only redirects/blocks/header changes (constitution III). Static mock bodies require page-world fetch/XHR patching.

## R1. Where to source rules synchronously enough for the first request

### Decision

Use a **two-tier strategy**:

- **Tier A (fast path, covers ≥ 99 % of cases)**: Re-register the dynamic content script (`chrome.scripting.registerContentScripts` with `world: "MAIN"`, `runAt: "document_start"`) every time the rule set changes, with the **rules embedded as a serialized literal** inside a tiny bootstrap script that runs immediately before `interceptor.js`. Because both scripts in a single registration entry execute in declared order at `document_start`, this guarantees that `window[NAMESPACE].rules` is populated synchronously before any page script runs.
- **Tier B (correctness fallback)**: The interceptor still installs a request **queue** at patch time. If for any reason `window[NAMESPACE].ready !== true` when an interceptable request fires (e.g. a service-worker-cold-start race where re-registration hasn't propagated), the queue holds the request and only releases it after a `RulesReceived` MAIN-world signal lands. With a configurable timeout (default 1500 ms), unresolved queued requests fall back to the network *and* surface a `console.warn` — never a silent fallback.

### Rationale

- **Tier A** removes the race entirely on the happy path: registered content scripts are scheduled by Chrome before any page scripts, and bundling rules into the same registration entry means there is no second async hop.
- **Tier B** is necessary because Chrome's `registerContentScripts` is itself async on the worker side, and a brand-new browser session might fire a navigation before the worker finishes its first registration. The queue makes the system *correct*, not *fast* — the fast path is what makes it fast.
- A single-tier approach (queue-only) would work but would always add at least one event-loop tick of latency to the first request after page load, which violates the "no developer-perceptible delay" goal in FR-011 and SC-006 for the common case.
- A single-tier approach (registration-only) would be vulnerable to the race on the very first navigation after install, on profile resume, and on rule-edit-during-load — exactly the "intermittent" symptoms the user reports.

### Alternatives considered

- **Bundle rules as a `chrome.storage` snapshot read from the ISOLATED-world content script and `postMessage`'d into MAIN world.** Rejected: `postMessage` is a microtask and races against synchronous page scripts at `document_start`. Requires the queue anyway, and adds an extra hop.
- **Persist rules in a `<meta>` or `<script>` tag injected by an ISOLATED-world content script before the page parses.** Rejected: cannot mutate the document before the parser sees it; ISOLATED-world content scripts can only read.
- **Use `chrome.storage.session` and read it from the MAIN world directly.** Rejected: MAIN world has no `chrome.*` API access.
- **Re-architect to use service-worker `fetch` event listening for the document-level navigation only.** Rejected: this is a major architectural change explicitly deprioritized by the spec author.

## R2. How to express "ready" + "queue" without leaking globals or breaking other rule types

### Decision

Extend the existing `window[NAMESPACE]` (`INSSMAN`) object with three new fields, all owned by the bootstrap script (Tier A) and the interceptor:

```text
window[NAMESPACE] = {
  rules: IRuleMetaData[],          // existing — populated by bootstrap
  runtimeId: string,               // existing — populated by bootstrap
  ready: boolean,                  // NEW — true once bootstrap completes
  __queue: QueuedRequest[],        // NEW — interceptor-private; "__" hints at private
  __readyPromise: Promise<void>,   // NEW — interceptor-private; resolved when ready flips true
}
```

The interceptor reads `__readyPromise` synchronously (it is created the moment the interceptor runs) and only releases held requests when it resolves. The bootstrap script owns flipping `ready` and resolving the promise. Other rule types (modify-request-body, inject-file, redirect, modify-headers) are not affected because they either run through DNR (browser-managed, no race) or already share the same `window[NAMESPACE].rules` read site (which we make safer in R4).

### Rationale

- Stays within the existing namespace convention defined in `options/constant/index.ts` (`NAMESPACE = "INSSMAN"`); zero new top-level globals.
- `__queue` and `__readyPromise` are interceptor-private; nothing else in the codebase reads them.
- Avoids introducing a new event-emitter abstraction for one signal.

### Alternatives considered

- **Custom DOM event (`dispatchEvent('inssman:ready')`).** Rejected: forces every consumer to subscribe; promise is simpler.
- **`MessageChannel`.** Rejected: overkill for same-realm signalling.

## R3. How to handle service-worker idle/wake (MV3) at navigation time

### Decision

Two complementary measures:

1. **Static manifest content script** for the bootstrap: in addition to dynamic registration, declare a static MAIN-world content script entry in `manifest.json` that runs the bootstrap *only*. Static entries are scheduled by Chrome without any worker round-trip, eliminating the cold-start race entirely.
   - *Update*: After re-reading the manifest, this is preferred over `chrome.scripting.registerContentScripts` for the bootstrap because static entries are honoured even when the SW is suspended at navigation start. We keep dynamic registration only for the rules payload (which is data, not behaviour).
2. **`chrome.runtime.onStartup` and `chrome.runtime.onInstalled`** in `serviceWorker.ts` to eagerly `executeScript` rules into all eligible open tabs after a SW wake. This covers the case where the SW was suspended *and* the tab was already open.
3. The Tier B queue is the absolute backstop: even if neither (1) nor (2) wins, queued requests will be released as soon as the rules payload arrives, with a bounded timeout.

### Rationale

- Static content_scripts entries don't depend on the SW being awake at navigation time — Chrome reads them from the manifest directly.
- The bootstrap script's only job is to *initialize* the namespace (`{ rules: [], ready: false, __queue: [], __readyPromise: ... }`); it does not need rules to be present yet.
- The rules payload still requires either re-registration (Tier A) or an `onCommitted` `executeScript` (legacy path); both go through the SW. The queue covers any window where the SW hasn't arrived.

### Alternatives considered

- **Keep the SW alive with a no-op alarm.** Rejected: violates MV3 spirit and Chrome may still suspend; not a real fix.
- **Move all logic to a long-lived offscreen document.** Rejected: significant architectural change and out of scope per the spec author's deprioritization.

## R4. How to make interceptor errors observable instead of silent fall-through

### Decision

Replace the single outer `try/catch` in `fetch.ts` (and equivalent in `xhr.ts`) that returns `getOriginalResponse()` on any throw with a **structured error path**:

```text
try {
  // ...interception logic, including queue wait...
} catch (err) {
  console.warn(
    "[Inssman] Interceptor error — request fell through to network. " +
      "If you expected a mock to apply, this is a bug. URL: %s",
    request.url,
    err
  );
  // Optionally also: chrome.runtime.sendMessage(runtimeId, { action: PostMessageAction.InterceptorError, data: { url, err: String(err) } })
  return getOriginalResponse();
}
```

Additionally, `getMatchedRuleByUrl` (in `utils/contentScript.ts`) returns a **tagged result** instead of `undefined`/`{}`:

```text
type MatchResult =
  | { status: "matched"; rule: IRuleMetaData; pageType: PageType }
  | { status: "no-match" }
  | { status: "rules-not-ready" };  // window[NAMESPACE].rules undefined
```

Callers branch on `status`. The `"rules-not-ready"` branch routes through the queue (Tier B) instead of falling through.

### Rationale

- Per FR-008: "internal errors must be observable". `console.warn` is the minimum-viable diagnostic; it shows in the page's DevTools console where developers debug their own mocks.
- The tagged result eliminates the historical truthy-check ambiguity (where an empty object `{}` and `undefined` were both "no match", but only the latter actually meant "we don't know yet").
- Optional `chrome.runtime.sendMessage` to the SW lets us surface aggregate diagnostics later without coupling this fix to a UI feature.

### Alternatives considered

- **Throw the error to the caller.** Rejected: would break page scripts that don't expect `fetch` to throw synchronously.
- **Always show a toast in the extension UI.** Rejected: noisy and out of scope; logged warning is sufficient.

## R5. How to refresh rules in already-open tabs after a rule edit

### Decision

In `InjectCodeService` (or directly in `serviceWorker.ts`), subscribe to `chrome.storage.onChanged` (existing `BaseService` `ListenerType.ON_CHANGE_STORAGE` pattern). On any change to a rule of `pageType ∈ { MODIFY_RESPONSE, MODIFY_REQUEST_BODY }`:

1. Recompute the active rule set via `StorageService.getFilteredRules`.
2. Re-call `chrome.scripting.registerContentScripts` (with `update: true` semantics — actually `unregister` + `register` because `update` doesn't allow changing JS) so that **future** navigations get the new rules baked in.
3. For all currently-open tabs, push a `RulesRefreshRequested` `executeScript` that overwrites `window[NAMESPACE].rules` and re-emits `ready`.

### Rationale

- Same mechanism the codebase already uses for inject-file rules in `InjectCodeService.onChangeStorage`. Keeps the architecture consistent.
- Both branches (future navs + open tabs) covered, satisfying User Story 3 (P2).
- No new persistence or messaging primitives.

### Alternatives considered

- **Force a tab reload on every rule edit.** Rejected: bad UX; users frequently edit rules with the target page open mid-debug.

## R6. Performance budget

### Decision

Targets to measure in `quickstart.md`:

- **First-request matching latency**: ≤ 10 ms over baseline for ≤ 100 enabled rules (FR-011, SC-006).
- **Queue hold time when rules are not yet present**: ≤ 50 ms p95 on the happy path; hard timeout 1500 ms before fall-through-with-warning.
- **Memory**: queue is interceptor-local and bounded by in-flight requests of one navigation; no leak risk.

### Rationale

`MatcherService.isUrlsMatch` is a string/regex comparison; 100 rules × O(conditions) is microseconds-scale. The dominant cost is the JS engine boundary, not the matching itself. The 50 ms / 1500 ms numbers are derived from typical document_start → first XHR latencies on dev machines (commonly 30–80 ms).

## R7. Test/verification approach

### Decision

Because `browser-extension/package.json` has no test runner and adding one is out of scope, verification is **manual via a checked-in harness**:

- A static `mock-harness.html` page under `specs/005-fix-mock-hard-reload/` (referenced by `quickstart.md`) that:
  - Issues a synchronous-as-possible `fetch` and `XMLHttpRequest` from inline `<script>`s at the top of the document.
  - Issues a request from an inline same-origin iframe.
  - Issues a delayed request triggered by a button (for rule-edit-while-open scenarios).
- A reload-matrix walkthrough in `quickstart.md` covering: cold start, normal reload ×10, hard reload, restored tab, bfcache, cache-disabled DevTools, offline, rule-toggle-while-open, 100-rule set.
- A pass criterion of "100 / 100 reloads return the mock body, 0 leak the upstream response" per SC-001/SC-002.

This harness can later be wrapped by an automated runner (Playwright + extension load) when the project adopts one.

### Rationale

Aligns with constitution's "Testing Rule Changes" workflow which already calls for manual extension reload + DevTools inspection.

## Open questions

None remaining. All NEEDS CLARIFICATION items from Technical Context have been resolved.
