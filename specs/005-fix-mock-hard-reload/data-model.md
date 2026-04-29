# Phase 1 Data Model: Fix Hard-Reload Bug for Static Response Mocks

**Date**: 2026-04-29
**Branch**: `005-fix-mock-hard-reload`

This feature adds **no persistent data**. The rule data model (`IRuleMetaData`, `chrome.storage.local`) is unchanged. The only new state is **in-memory, per-frame, interceptor-private** state inside the page's MAIN world.

## Entity 1: `WindowNamespace` (MAIN-world global, per frame)

The `window[NAMESPACE]` object (`NAMESPACE = "INSSMAN"`) gains three fields. Two of them are interceptor-private (prefixed `__`).

### Fields

| Field | Type | Owner / Writer | Reader | Lifetime | Validation |
|------|------|----------------|--------|----------|-----------|
| `rules` | `IRuleMetaData[]` | Bootstrap script + service-worker `executeScript` | `getMatchedRuleByUrl` (in interceptor) | From bootstrap until frame teardown | MUST be an array (never `undefined` after bootstrap). Empty array is a valid "no rules" state. |
| `runtimeId` | `string` | Bootstrap script + service-worker `executeScript` | `updateTimestamp` and any `chrome.runtime.sendMessage` from MAIN world | Same as `rules` | Non-empty when extension is connected. |
| `ready` | `boolean` | Bootstrap (sets `false`) → SW rule-push (sets `true`) | Interceptor's queue release path | Until next rule-push (which sets `true` again) | MUST be `false` until the first rule push completes. |
| `__queue` | `QueuedRequest[]` | Interceptor (push on intercept while `!ready`); ready-handler (drains) | Ready-handler | Per-frame, lives until queue is drained or frame is torn down | Empty array allowed. Bounded only by in-flight requests of one navigation. |
| `__readyPromise` | `Promise<void>` | Interceptor (creates synchronously at patch time); resolves when `ready` flips to `true` | Interceptor's `await` in queued requests | Per-frame | Created exactly once per `interceptor.js` execution. |

### State transitions

```text
[bootstrap runs] → ready=false, rules=[], __queue=[], __readyPromise=pending
       │
       │  interceptor.js runs synchronously, patches fetch/XHR
       │  (any matching request now → __queue.push() and awaits __readyPromise)
       │
       ▼
[SW rule-push lands] → ready=true, rules=[...active], __readyPromise=resolved
       │
       │  __queue is drained: each held request is matched against the now-present rules
       │  and either receives the mock or is released to the network
       │
       ▼
[steady state]
       │
       │  on rule edit: SW pushes new rules → rules=[...new]
       │  ready stays true (no need to re-queue)
       │
       ▼
[frame torn down] → all state GC'd with the page
```

### Invariants

- **I1**: `rules` is **never** `undefined` after bootstrap completes. (This is the single most important fix; it eliminates the `Cannot read properties of undefined (reading 'forEach')` throw.)
- **I2**: `ready === true ⟹ __readyPromise` is settled.
- **I3**: A request can sit in `__queue` for at most `QUEUE_TIMEOUT_MS` (default 1500); after that it is released to the network with a `console.warn`.
- **I4**: `__queue` is **never** observed by anything outside the interceptor.

## Entity 2: `QueuedRequest` (interceptor-private)

A held request waiting for `ready`.

### Fields

| Field | Type | Description |
|------|------|-------------|
| `kind` | `'fetch' \| 'xhr'` | Which API path the request came from. |
| `url` | `string` | Absolute URL (already resolved via `getAbsoluteUrl`). |
| `method` | `string` | Uppercase HTTP method. |
| `enqueuedAt` | `number` | `performance.now()` timestamp; used for timeout enforcement. |
| `release` | `() => void` | Callback the ready-handler invokes to wake the awaiter. |
| `timeout` | `() => void` | Callback the queue invokes when `QUEUE_TIMEOUT_MS` expires. |

### Validation rules

- `url` MUST be an absolute URL. Relative/protocol-relative URLs are converted before enqueue.
- `method` MUST be uppercase. Normalized at enqueue.
- `enqueuedAt` MUST be a finite number.

### Lifetime

Created when the interceptor reads `getMatchedRuleByUrl(url)` and gets `{ status: "rules-not-ready" }`. Removed when either `release()` or `timeout()` fires (whichever comes first).

## Entity 3: `MatchResult` (function return type, interceptor-internal)

Replaces the previous untyped/truthy-checked return of `getMatchedRuleByUrl`.

### Variants

```text
type MatchResult =
  | { status: "matched"; pageType: PageType; rule: IRuleMetaData }
  | { status: "no-match" }
  | { status: "rules-not-ready" }
```

### Decision matrix in callers

| Caller | `matched` action | `no-match` action | `rules-not-ready` action |
|-------|------------------|------------------|--------------------------|
| fetch interceptor | Apply mock; return `Response`. | Pass through to original `fetch`. | Enqueue, await `__readyPromise`, then re-evaluate (one retry only). |
| XHR interceptor | Apply mock via existing `onReadyStateChange` plumbing. | Pass through to original `send`. | Enqueue, await `__readyPromise`, then re-evaluate. |

### Validation

- A given URL/method combination MUST produce the same `status` for the duration of one navigation, **unless** rules change (User Story 3) — in which case the next call returns the new result deterministically.

## Entity 4: `PostMessageAction` additions

Two new enum values added to `models/postMessageActionModel.ts`. Payloads are JSON-serializable per constitution principle II.

| Action | Direction | Payload |
|-------|-----------|---------|
| `RulesReceived` | MAIN-world page → service worker (via `chrome.runtime.sendMessage`) | `{ tabId?: number, frameId?: number, count: number }` — diagnostic, optional handler. |
| `InterceptorError` | MAIN-world page → service worker | `{ url: string, message: string, stack?: string }` — surfaced for telemetry; SW handler MAY no-op. |

These are **optional** signals — the fix does not require the SW to act on them; they exist so that future telemetry / a "diagnostics" UI can subscribe without further protocol changes.

## What is intentionally NOT in this data model

- No new `chrome.storage.local` keys.
- No changes to `IRuleMetaData`, `PageType`, `StorageItemType`, or `StorageKey`.
- No new React Context or component state.
- No persistence of the queue across navigations (per-frame in-memory only).
