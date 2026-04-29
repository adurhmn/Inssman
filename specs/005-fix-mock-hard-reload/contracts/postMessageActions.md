# Contract: New `PostMessageAction` Values

**Surface**: Internal extension messaging (page MAIN world → service worker via `chrome.runtime.sendMessage(runtimeId, ...)`)
**Constitution principle covered**: II. Message-Driven Communication

This contract documents the two new `PostMessageAction` enum values introduced by this fix. Both are **optional handlers** — the SW may receive them and no-op; receivers MUST ignore unknown variants.

## Existing enum (excerpt, for reference)

```text
export enum PostMessageAction {
  AddRule,
  UpdateRule,
  // ...
  URLChanged,
}
```

Source: `browser-extension/src/models/postMessageActionModel.ts`

## Additions

```text
export enum PostMessageAction {
  // ...existing values, unchanged...
  URLChanged,
  RulesReceived,        // NEW
  InterceptorError,     // NEW
}
```

> Enum values are appended to preserve numeric ordinals of all existing entries. Critical because numeric `PostMessageAction` ordinals are used as routing keys in `serviceWorker.ts` `listenersMap`.

---

## Action: `RulesReceived`

### Purpose

Diagnostic-only signal sent by the MAIN-world bootstrap (or interceptor) to the service worker when it has successfully received and stored the active rule set into `window[NAMESPACE].rules`. Allows the SW to confirm propagation reached the frame.

### Direction

MAIN-world page → service worker.

### Payload

```text
{
  action: PostMessageAction.RulesReceived,
  data: {
    tabId?: number,       // optional; SW can also infer from sender
    frameId?: number,     // optional; populated when called from sub-frame
    count: number,        // number of rules in window[NAMESPACE].rules at receipt time
    receivedAt: number,   // performance.timeOrigin + performance.now() (ms epoch)
  }
}
```

### Response

```text
// SW MAY return an empty object or omit response entirely.
// MUST NOT throw.
{} | undefined
```

### Error semantics

- Send may fail silently if the SW is suspended at send time. **This is acceptable** — the message is diagnostic, and the actual rule set has already been installed in `window[NAMESPACE]`.
- Senders MUST wrap `chrome.runtime.sendMessage` in `try/catch` and discard errors.

### Backwards compatibility

- Old SW builds will not have `RulesReceived` in their `listenersMap` → message is dropped silently. New page code MUST tolerate that.

---

## Action: `InterceptorError`

### Purpose

Surface internal interceptor errors to the SW for optional logging / future telemetry. Per spec FR-008, internal errors MUST NOT silently fall through; this is the SW-side half of that requirement (the page-side half is `console.warn`).

### Direction

MAIN-world page → service worker.

### Payload

```text
{
  action: PostMessageAction.InterceptorError,
  data: {
    url: string,            // absolute URL of the request that errored
    method: string,         // uppercase HTTP method
    kind: "fetch" | "xhr",
    message: string,        // err.message or String(err)
    stack?: string,         // err.stack if present
    namespaceState: {       // diagnostic snapshot
      hasNamespace: boolean,    // typeof window[NAMESPACE] !== 'undefined'
      hasRules: boolean,        // Array.isArray(window[NAMESPACE]?.rules)
      ready: boolean,           // window[NAMESPACE]?.ready === true
      ruleCount: number,        // window[NAMESPACE]?.rules?.length ?? -1
    }
  }
}
```

### Response

```text
{} | undefined
```

### Error semantics

- Send failures are silently swallowed. The page-side `console.warn` is the user-visible diagnostic; the SW-side message is for telemetry.
- This action MUST NOT cause the request to be retried or otherwise altered.

### Rate limiting

- Recommended SW-side: dedup by `url + message` within a 1-second window to avoid log spam if a page makes many failing requests in a tight loop.
- Out of scope for this fix to implement; recommendation only.

### Backwards compatibility

- Same as `RulesReceived`: old SW builds drop the message silently.

---

## Test contract for both actions

A test/manual-verification step (see `quickstart.md`) MUST verify:

1. Sending `RulesReceived` from a page where the extension is installed does NOT cause an uncaught error in the service worker.
2. Sending `InterceptorError` does NOT cause the request to retry or otherwise change behaviour.
3. Both messages can be received and dropped silently by an SW that does not register a handler.
