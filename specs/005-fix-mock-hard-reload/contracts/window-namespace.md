# Contract: `window[NAMESPACE]` (MAIN-world page global)

**Surface**: Page MAIN-world global object exposed by the extension's content scripts.
**Namespace constant**: `NAMESPACE = "INSSMAN"` (defined in `browser-extension/src/options/constant/index.ts`)
**Constitution principle covered**: VI. Context Isolation Awareness

This contract specifies the shape and ownership rules for the page-world global object that the interceptor reads from. **No code outside `browser-extension/src/cotentScript/` and `browser-extension/src/services/InjectCodeService.ts` may write to this object.**

## Pre-fix shape (current)

```text
window["INSSMAN"] = {
  rules: IRuleMetaData[] | undefined,   // populated asynchronously; undefined until SW pushes
  runtimeId: string | undefined,         // populated asynchronously
}
```

Problems:
- `rules` is `undefined` for an unbounded window after `document_start`, which causes `getMatchedRuleByUrl` to throw (root cause of this bug).
- No way to signal "rules are ready" to held requests.
- No way for the interceptor to coordinate a queue.

## Post-fix shape (this fix)

```text
window["INSSMAN"] = {
  rules: IRuleMetaData[],                 // ALWAYS an array after bootstrap; never undefined
  runtimeId: string,                       // set by bootstrap to chrome.runtime.id mirror
  ready: boolean,                          // false until first rule push lands
  __queue: QueuedRequest[],                // interceptor-private; "__" prefix = do not touch
  __readyPromise: Promise<void>,           // interceptor-private
}
```

### Field contracts

#### `rules: IRuleMetaData[]`

- **Writers**: Bootstrap script (initial `[]`); `InjectCodeService.injectRules` (overwrites with active rule set on each navigation and on rule edits).
- **Readers**: `getMatchedRuleByUrl` in `utils/contentScript.ts`.
- **Invariant**: After bootstrap completes, `Array.isArray(window[NAMESPACE].rules)` MUST be `true`. Empty array is valid.
- **Mutation policy**: Replace by reference (`window[NAMESPACE].rules = newArray`); do not push/splice in place. Avoids torn reads if a request is mid-match.

#### `runtimeId: string`

- **Writers**: Bootstrap script and `InjectCodeService.injectRules`.
- **Readers**: `updateTimestamp` and any future MAIN-world → SW messaging.
- **Invariant**: Equals `chrome.runtime.id` of the installed extension at the time of bootstrap. May become stale across extension reload, in which case `chrome.runtime.sendMessage` calls fail silently (acceptable per `RulesReceived` / `InterceptorError` contracts).

#### `ready: boolean`

- **Initial value**: `false` (set by bootstrap).
- **Transitions**: Flips to `true` exactly once per page load when the first rule push from the SW completes. After that, remains `true` even on subsequent rule edits.
- **Readers**: Interceptor's enqueue-or-execute decision.
- **Writers**: Bootstrap (`false`) and `InjectCodeService.injectRules`-injected snippet (`true`).

#### `__queue: QueuedRequest[]`

- **Visibility**: Interceptor-private. Documented here only to fix the contract; **no other code may read or write it**.
- **Initial value**: `[]`.
- **Mutation**: Push when a request arrives while `ready === false`; splice/clear when the ready-handler drains it.
- **Bounded by**: number of in-flight interceptable requests during the pre-ready window of one navigation. No persistent growth.

#### `__readyPromise: Promise<void>`

- **Visibility**: Interceptor-private.
- **Created by**: `interceptor.ts` synchronously when it runs.
- **Resolved by**: The same module, via a captured `resolve` function, when `ready` flips to `true`.
- **Behaviour after resolve**: Subsequent `await` calls resolve immediately; no resource leak.

## Bootstrap script contract

A new tiny script (≤ 30 lines) runs **before** `interceptor.js` at `document_start`. Two delivery options are supported (for redundancy per Phase 0 R3):

1. **Static manifest entry** — recommended primary.
2. **Dynamic registration via `chrome.scripting.registerContentScripts`** — fallback / for backwards compatibility with installs that have not yet refreshed the manifest.

The bootstrap MUST:

```text
(function (NAMESPACE) {
  var ns = (window[NAMESPACE] = window[NAMESPACE] || {});
  if (!Array.isArray(ns.rules)) ns.rules = [];
  if (typeof ns.ready !== "boolean") ns.ready = false;
  if (!ns.__queue) ns.__queue = [];
  if (!ns.__readyPromise) {
    var resolveRef;
    ns.__readyPromise = new Promise(function (resolve) { resolveRef = resolve; });
    ns.__resolveReady = function () {
      ns.ready = true;
      if (resolveRef) { resolveRef(); resolveRef = null; }
    };
  }
})("INSSMAN");
```

The bootstrap is **idempotent** (safe to run twice, e.g. once via static manifest and once via dynamic registration).

## Rule-push script contract

When the SW pushes rules (`InjectCodeService.injectRules`), the injected function MUST:

```text
(function (rules, NAMESPACE, runtimeId) {
  var ns = (window[NAMESPACE] = window[NAMESPACE] || {});
  ns.rules = rules;                  // replace by reference
  ns.runtimeId = runtimeId;
  if (typeof ns.__resolveReady === "function") {
    ns.__resolveReady();              // flips ready=true exactly once
  } else {
    ns.ready = true;                  // bootstrap not yet run — degraded but safe
  }
  // Optional diagnostic
  try {
    chrome.runtime.sendMessage(runtimeId, {
      action: PostMessageAction.RulesReceived,
      data: { count: rules.length, receivedAt: Date.now() }
    });
  } catch (_) {}
})(rules, NAMESPACE, runtimeId);
```

## Forbidden patterns

- ❌ Reading `window[NAMESPACE].rules` without first checking `Array.isArray(...)` is no longer required because the bootstrap guarantees it — but defensive code MUST still tolerate the (now-impossible) `undefined` case for safety.
- ❌ Writing to `window[NAMESPACE]` from any code outside `cotentScript/` and `services/InjectCodeService.ts`.
- ❌ Reading `__queue` or `__readyPromise` from outside `cotentScript/`.

## Test contract

The harness in `quickstart.md` MUST verify:

1. `window.INSSMAN.rules` is an `Array` synchronously after the first inline `<script>` of `mock-harness.html` runs (proves bootstrap order).
2. `window.INSSMAN.ready` is `false` immediately after bootstrap and `true` after the first navigation event has settled.
3. A `fetch` issued before `ready` is `true` is held in `__queue` and resolves with the mock body, not the upstream 404 (proves Tier B queue).
4. After 100 reloads, `__queue.length === 0` at `load` event time (proves no leak).
