# Quickstart: Verifying the Hard-Reload Mock Fix

**Date**: 2026-04-29
**Branch**: `005-fix-mock-hard-reload`
**Audience**: Engineers reviewing this fix; QA running the verification matrix.

This is a **manual verification harness** because the project does not yet have an automated test runner (`browser-extension/package.json` has no Jest/Vitest/Playwright). Each scenario maps to one or more functional requirements (FR) or success criteria (SC) in `spec.md`.

## 0. Prerequisites

1. Build the extension:

   ```bash
   cd browser-extension
   npm run build:chrome
   ```

2. In Chrome → `chrome://extensions` → enable Developer Mode → "Load unpacked" → select `browser-extension/dist/chrome/`.
3. Open the Inssman options page → create the rule below.

## 1. Test rule

Create a single **Modify Response** rule (PageType `MODIFY_RESPONSE`):

- **URL match**: contains `/api/test-mock`
- **Modification type**: Static
- **Response body**:

  ```json
  { "mocked": true, "from": "inssman", "marker": "MOCK-OK" }
  ```

- **Status**: 200
- **Enabled**: yes

> Verifying the marker string `MOCK-OK` in the response body is the single source of truth for "mock applied".

## 2. Test harness page

Create a static file at any path that the browser can load directly (file:// or local server):

`mock-harness.html`:

```html
<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>Inssman Mock Harness</title>
  <script>
    // (A) Synchronous-as-possible fetch from inline document_start-era script
    const earlyFetch = fetch("/api/test-mock?from=inline-script")
      .then(r => r.json())
      .then(j => window.__earlyResult = j)
      .catch(e => window.__earlyResult = { error: String(e) });

    // (B) Synchronous-ish XHR from inline script
    const xhr = new XMLHttpRequest();
    xhr.open("GET", "/api/test-mock?from=xhr-inline", true);
    xhr.onload = () => { window.__xhrResult = xhr.responseText; };
    xhr.onerror = () => { window.__xhrResult = "xhr-error"; };
    xhr.send();
  </script>
</head>
<body>
  <h1>Inssman Mock Harness</h1>
  <pre id="out"></pre>

  <iframe srcdoc='
    <script>
      fetch("/api/test-mock?from=iframe").then(r=>r.json()).then(j=>{
        parent.postMessage({ kind: "iframe-result", body: j }, "*");
      }).catch(e=>{
        parent.postMessage({ kind: "iframe-result", body: { error: String(e) } }, "*");
      });
    </script>
  '></iframe>

  <button id="late">Late fetch (post-load)</button>

  <script>
    window.addEventListener("message", (e) => {
      if (e.data && e.data.kind === "iframe-result") window.__iframeResult = e.data.body;
    });

    document.getElementById("late").addEventListener("click", () => {
      fetch("/api/test-mock?from=late-click").then(r=>r.json()).then(j => window.__lateResult = j);
    });

    Promise.all([earlyFetch, new Promise(r => setTimeout(r, 200))]).then(() => {
      document.getElementById("out").textContent = JSON.stringify({
        early: window.__earlyResult,
        xhr: window.__xhrResult,
        iframe: window.__iframeResult,
        namespaceReady: window.INSSMAN && window.INSSMAN.ready,
        ruleCount: window.INSSMAN && window.INSSMAN.rules && window.INSSMAN.rules.length,
      }, null, 2);
    });
  </script>
</body>
</html>
```

Serve it at any URL whose origin matches your match pattern (any origin works — match on path).

## 3. Verification matrix

For each scenario below, the **PASS criterion** is:

- `window.__earlyResult.marker === "MOCK-OK"` AND
- `JSON.parse(window.__xhrResult).marker === "MOCK-OK"` AND
- `window.__iframeResult.marker === "MOCK-OK"` AND
- The page never shows `"error"` in any of the three results.

### Scenario A — Cold start (FR-007, SC-001)

1. Restart Chrome (forces SW idle/wake).
2. Open `mock-harness.html`.
3. **Expect**: PASS on first load.

### Scenario B — 100 normal reloads (FR-001, SC-001)

1. With the page already open, hit the browser's reload button (NOT shift-reload) 100 times in a row using `Cmd/Ctrl+R`.
2. After each reload, copy the JSON output.
3. **Expect**: 100 / 100 reloads produce PASS results. Zero leak the upstream `404`.

> Practical tip: open DevTools → Console → `for (let i = 0; i < 10; i++) location.reload()` is **not** appropriate here because we want to test browser-level reload, not programmatic. Do this in batches of 10 manually and tally.

### Scenario C — Hard reload (FR-004)

1. `Cmd/Ctrl+Shift+R` 10 times.
2. **Expect**: 10 / 10 PASS.

### Scenario D — Restored / bfcache navigation (FR-004 edge case)

1. Open `mock-harness.html`.
2. Navigate forward to another origin.
3. Click browser back button.
4. **Expect**: Restored page also PASSes (re-evaluate `window.__earlyResult` if it was preserved, or trigger the late button).

### Scenario E — DevTools "Disable cache" toggled both ways (FR-004 edge case)

1. With DevTools open, run Scenario B with **Disable cache** OFF, then ON.
2. **Expect**: Both modes PASS identically.

### Scenario F — Offline upstream (FR-002, SC-002)

1. DevTools → Network → throttling → "Offline".
2. Reload `mock-harness.html`.
3. **Expect**: Page still receives the mock (PASS), even though there is no network. The mock body is the actual response, not a network error.

### Scenario G — Rule edit while page is open (User Story 3, FR-006)

1. Open `mock-harness.html` (already PASSes).
2. In Inssman options, change the response body's marker from `"MOCK-OK"` to `"MOCK-V2"`.
3. Reload the page (normal reload).
4. **Expect**: `__earlyResult.marker === "MOCK-V2"` on the very next load — no hard refresh needed.

### Scenario H — Rule disabled while page is open (FR-006)

1. With the page open, disable the rule in Inssman options.
2. Reload the page.
3. **Expect**: The page receives the upstream response (typically 404). No fall-through-with-mock.
4. Re-enable the rule and reload → PASS.

### Scenario I — 100 enabled rules (SC-006, FR-011)

1. Bulk-create 99 additional rules with non-matching URL patterns (so only the original test rule actually matches).
2. Reload `mock-harness.html` 10 times.
3. Compare DevTools Network panel timing for the `/api/test-mock` request to the same request without the extra rules.
4. **Expect**: Median delta ≤ 10 ms; 10 / 10 PASS.

### Scenario J — Synchronous early `fetch` race (FR-003, edge case)

1. Add a second inline `<script>` to `mock-harness.html` *above* the existing one that does its own `fetch("/api/test-mock?from=top")`.
2. Reload normally.
3. **Expect**: Response body for `?from=top` includes `MOCK-OK`. Verifies the queue (Tier B) actually holds the request when the SW rule push hasn't landed yet.

### Scenario K — Other rule types not regressed (FR-010, SC-007)

1. Create a redirect rule (`PageType.REDIRECT`), an inject-file rule, a modify-headers rule, and a modify-request-body rule, each with simple, observable behaviour.
2. Smoke-test each in isolation on a separate page.
3. **Expect**: Each behaves identically to its pre-fix behaviour. No new console warnings from the interceptor unless explicitly triggered.

## 4. DevTools checks

In the page's DevTools console after loading `mock-harness.html`:

```text
> window.INSSMAN
{ rules: Array(N), runtimeId: "<id>", ready: true, __queue: [], __readyPromise: Promise }

> Array.isArray(window.INSSMAN.rules)
true

> window.INSSMAN.__queue.length
0
```

If `ready` is `false` after the load event has fired, that is a **FAIL** — Tier A failed and Tier B did not catch it.

## 5. Console log expectations

- **Normal operation**: No `[Inssman] Interceptor error` warnings.
- **Forced error case** (kill the SW mid-navigation via `chrome://serviceworker-internals` and reload): one or more `[Inssman] Interceptor error — request fell through to network` warnings; the request body is the upstream response, NOT a silent mock-failure. This proves FR-008 (errors are observable, not silent).

## 6. Pass/Fail summary template

When running the matrix, copy this template into your verification notes:

```text
| Scenario | Result | Notes |
|----------|--------|-------|
| A — Cold start                  | PASS / FAIL |  |
| B — 100 normal reloads          | __ / 100    |  |
| C — Hard reload (10x)           | __ / 10     |  |
| D — bfcache restore             | PASS / FAIL |  |
| E — DevTools disable-cache both | PASS / FAIL |  |
| F — Offline upstream            | PASS / FAIL |  |
| G — Rule edit live              | PASS / FAIL |  |
| H — Rule disable live           | PASS / FAIL |  |
| I — 100 rules perf              | PASS / FAIL | median delta __ ms |
| J — Synchronous early fetch     | PASS / FAIL |  |
| K — Other rule types            | PASS / FAIL |  |
```

A release goes out only when all rows are PASS or 100/100 / 10/10 as applicable.
