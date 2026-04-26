# Low-level design (LLD)

This document describes **where code lives**, **how control flows**, and **important implementation details** for contributors.

## 1. Repository layout (extension-focused)

```
browser-extension/
  src/
    manifest.json              # MV3 manifest (version overwritten at build from package.json)
    serviceWorker/             # Background service worker entry
    options/                   # Options page React app (main editor/dashboard UI)
    popup/                     # Toolbar popup React app
    cotentScript/              # Note: folder name typo — content scripts (setup + interceptor)
    iframeContentScript/       # MAIN-world script for inssman.com /app iframe embedding
    HTTPLoggerWindow/          # Separate window for HTTP logging UI
    services/                  # Singleton-style services used from service worker / UI
    models/                    # Types, enums (rules, storage, postMessage actions)
    utils/                     # Shared helpers (matching, id generation, etc.)
  webpack/                     # Webpack configs (dev/prod, BROWSER=chrome|edge)
  scripts/                     # release zip, clean dist
web/
  src/pages/app/               # /app routes (iframe host)
  src/pages/docs/              # User-facing MDX docs
server/
  index.js                     # Express on port 4444
```

## 2. Build outputs

Webpack writes to:

- `browser-extension/dist/<browser>/` where `<browser>` is `chrome` or `edge` (from `BROWSER` env).

Artifacts:

- `manifest.json` (generated with version from `browser-extension/package.json`)
- Bundles: `serviceWorker/`, `options/`, `popup/`, `interceptor/`, `setupContentConfig/`, `iframeContentScript/`, `HTTPLoggerWindow/`, Monaco workers, etc.

## 3. Service worker composition

The service worker entry is [`serviceWorker.ts`](../browser-extension/src/serviceWorker/serviceWorker.ts).

**Side-effect imports** register subsystems:

- [`RegisterService.ts`](../browser-extension/src/services/RegisterService.ts) imports:
  - `ToggleExtensionService` — extension on/off and messaging to open options tabs
  - `WebRequestService` — `onConnect` long-lived ports for HTTP logger
  - `RuleService` — CRUD for rules, import/export, DNR sync when toggling

`ServiceWorker` class handles:

- **`webNavigation.onCommitted`** — injects rule metadata into tabs for modify-request-body / modify-response paths (`InjectCodeService.injectRules`).
- **`runtime.onMessage`** — subset: `GetUserId`, `GetExtensionStatus`, `URLChanged` (pushes pathname into page for iframe sync).

**Storage migration**: `onInstalled` runs `storgeDataConverter` (see `serviceWorker/storgeDataConverter`).

## 4. Listener indirection

[`ListenerService`](../browser-extension/src/services/ListenerService/ListenerService.ts) centralizes Chrome API subscriptions. [`listeners.ts`](../browser-extension/src/services/ListenerService/listeners.ts) maps:

- `chrome.runtime.onMessage` / `onMessageExternal` (returns `true` for async `sendResponse`)
- `chrome.tabs.onUpdated`, `onRemoved`
- `chrome.webRequest.*` (logger)
- `chrome.webNavigation.onCommitted`
- `chrome.storage.onChanged`

[`BaseService`](../browser-extension/src/services/BaseService.ts) exposes `addListener` / `removeListener` / `toggleListeners` to services.

## 5. Rule storage model

- **Keys**: stringified numeric rule id (e.g. `"42"`).
- **Rule records**: `IRuleMetaData` plus `type: StorageItemType.RULE` for filtering (see [`StorageService.getRules`](../browser-extension/src/services/StorageService.ts)).
- **Special keys**: `StorageKey` enum — `userId`, `nextId`, `extensionStatus`, etc. ([`storageModel.ts`](../browser-extension/src/models/storageModel.ts)).

### 5.1 Timestamps (“last matched”)

- `lastMatchedTimestamp` on a rule is updated from:
  - **DNR**: `declarativeNetRequest.getMatchedRules()` (throttled in `RuleService`) when tabs complete and URLs match enabled rules.
  - **Inject file**: `StorageService.updateRuleTimestamp` on successful DOM injection.

This is the hook for features like **“sort by recently applied mock”** (not exposed as UI sort at time of writing).

## 6. Rule → browser rules pipeline

[`generateRules.tsx`](../browser-extension/src/utils/generateRules.tsx) dispatches on `pageType` to feature-specific generators under `options/pages/forms/*/generate*.ts(x)`.

Each generator returns an array of **`chrome.declarativeNetRequest.Rule`**-shaped objects. Match metadata uses:

- `MatchType` → `urlFilter` vs `regexFilter` ([`MatchTypeMap`](../browser-extension/src/models/formFieldModel.tsx)).

[`BrowserRuleService`](../browser-extension/src/services/BrowserRuleService.ts) wraps `updateDynamicRules`, `getDynamicRules`, `getMatchedRules`.

**Important implementation note**: In [`RuleService.addRule` / `updateRule`](../browser-extension/src/services/RuleService.ts), calls to `BrowserRuleService.set` are largely **commented out** with a TODO; **`toggleExtension`** and **`toggleRule`** actively sync DNR. Behavior may differ by rule type and enabled state—verify when changing rule lifecycle.

## 7. Content scripts and page-world execution

### 7.1 Registered interceptor (`document_start`, MAIN world)

[`InjectCodeService.registerContentScripts`](../browser-extension/src/services/InjectCodeService.ts) registers `interceptor/interceptor.js` for `http(s)://*/*`.

[`interceptor.ts`](../browser-extension/src/cotentScript/interceptor.ts) imports [`fetch.ts`](../browser-extension/src/cotentScript/fetch.ts) and [`xhr.ts`](../browser-extension/src/cotentScript/xhr.ts) to wrap network APIs.

Rule data is provided separately via `injectRules`, which sets `window[INSSMAN].rules` and `runtimeId` in the page.

### 7.2 Setup script (isolated world)

[`setupContentConfig.ts`](../browser-extension/src/cotentScript/setupContentConfig.ts) listens for `postMessage` from page/window and responds with `chrome.runtime.getURL` for iframe URL generation and runtime id—bridging **page** and **extension** contexts.

### 7.3 Iframe host script (MAIN world, specific origins)

[`iframeContentScript.ts`](../browser-extension/src/iframeContentScript/iframeContentScript.ts) runs only on `*.inssman.com/app/*` and `localhost:3000/app/*` per `manifest.json`.

## 8. UI ↔ service worker messaging

[`PostMessageAction`](../browser-extension/src/models/postMessageActionModel.ts) is an **numeric enum** serialized as `action` in `sendMessage` payloads.

Options UI and popup call `chrome.runtime.sendMessage({ action, data }, callback)`.

**Routing**:

- `RuleService` handles most rule CRUD + import/export + toggle rule + extension-wide toggle (via `ToggleExntesion` spelling in enum).
- `ToggleExtensionService` duplicates handling for `ToggleExntesion` in practice—worth consolidating if you refactor.
- `ServiceWorker` class handles a small subset of actions.

**Iframe URL sync**: [`RouteListener`](../browser-extension/src/options/components/routeListener/routeListener.tsx) sends `URLChanged` when `window !== window.parent`.

## 9. HTTP logger

[`WebRequestService.ts`](../browser-extension/src/services/WebRequestService.ts) listens for `runtime.onConnect` ports named per [`WebRequestClients`](../browser-extension/src/models/WebRequestModel.ts). While connected, it attaches `webRequest` listeners and streams events to the UI client. Opening a dedicated window uses `HTTPLoggerWindow/HTTPLoggerWindow.html`.

## 10. Web app (`web/`) — `/app` route

- [`pages/app/app.tsx`](../web/src/pages/app/app.tsx) checks `globalThis.INSSMAN?.isExtensionInstalled`.
  - If **true**: shows loading while iframe bootstraps (extension injects iframe).
  - If **false**: shows install CTAs ([`installExtension.tsx`](../web/src/components/installExtension/installExtension.tsx)).
- Slug routing uses [`pages/app/[...slug]/index.tsx`](../web/src/pages/app/[...slug]/index.tsx) with `dynamic(..., { ssr: false })` because of `window`/`chrome` assumptions.

## 11. Known UI filter behavior (dashboard rule list)

[`ruleList.tsx`](../browser-extension/src/options/components/ruleList/ruleList.tsx) filters with:

`rules.filter((rule) => rule.name.includes(search))`

So search is **case-sensitive** and **name-only**—not URL/condition aware. This matches the reported bug; fixing it belongs in this component (and possibly shared list config).

## 12. Cross-references

- [Architecture](./ARCHITECTURE.md)
- [Local development](./LOCAL_DEVELOPMENT.md)
- [Deployment](./DEPLOYMENT.md)
