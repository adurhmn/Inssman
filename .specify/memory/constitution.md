<!--
## Sync Impact Report
- Version change: 0.0.0 → 1.0.0 (initial ratification)
- Added principles:
  - I. Service-Oriented Architecture
  - II. Message-Driven Communication
  - III. Dual Rule Execution Strategy
  - IV. Storage as Source of Truth
  - V. Type-Driven Rule Generation
  - VI. Context Isolation Awareness
  - VII. Component Composition with HOCs
  - VIII. React Context for Cross-Cutting State
- Added sections:
  - Technical Constraints (MV3, Build, Aliases)
  - Development Workflow (Adding Rules, Testing)
  - Governance
- Templates status:
  - ✅ plan-template.md - Compatible (Constitution Check section works with new principles)
  - ✅ spec-template.md - Compatible (requirements/scenarios generic)
  - ✅ tasks-template.md - Compatible (phase structure aligns with workflow)
- Follow-up TODOs: None
-->

# Inssman Browser Extension Constitution

## Core Principles

### I. Service-Oriented Architecture

Services are singleton classes that encapsulate Chrome API interactions and business logic. Each service extends `BaseService` for listener management and exports a single instance (`export default new ServiceClass()`). Services register their message handlers via `listenersMap` patterns and coordinate through the central `ListenerService`. Keep services focused on a single domain (rules, storage, injection, tracking).

### II. Message-Driven Communication

All UI-to-background and cross-context communication uses `chrome.runtime.sendMessage` with `PostMessageAction` enum-based routing. Message handlers MUST return `true` for async `sendResponse`. Use the established pattern:

- **Requests**: `{ action: PostMessageAction.X, data: {...} }`
- **Error responses**: `{ error: boolean, info?: {...} }`

### III. Dual Rule Execution Strategy

Rules execute through two complementary mechanisms depending on capability requirements:

- **DNR (Declarative Net Request)**: For redirects, blocks, header/query modifications where the browser API suffices
- **Page-world injection**: For fetch/XHR interception requiring access to page globals (request/response body modification)

The service worker coordinates which mechanism applies via `BrowserRuleService` for DNR and `InjectCodeService` for script injection. New rule types MUST evaluate which execution path fits their requirements.

### IV. Storage as Source of Truth

`chrome.storage.local` is the canonical store for all rule metadata (`IRuleMetaData`) and extension state. Rules are stored by numeric ID as key (`{ [id]: ruleMetaData }`). Use `StorageService` for all storage operations. Special keys are defined in `StorageKey` enum; rule records MUST include `type: StorageItemType.RULE` for filtering. NEVER bypass `StorageService` for direct `chrome.storage` calls.

### V. Type-Driven Rule Generation

Each `PageType` has a dedicated generator function (`generate*Rule.ts`) that transforms `IRuleMetaData` into Chrome DNR rules. The `generateRules` utility dispatches to the appropriate generator via `generateRuleMap`. When adding new rule types: define the `PageType` enum value, create the generator, register in the map, and add corresponding form UI.

### VI. Context Isolation Awareness

Browser extensions operate across isolated contexts (service worker, options page, popup, content scripts, page world). Code MUST be explicit about which context it runs in:

- **Service worker**: No DOM, event-driven lifecycle, use for background coordination
- **Options/Popup**: Full React apps with `chrome.runtime.sendMessage` to background
- **Content scripts (isolated)**: Bridge between page and extension via `postMessage`
- **Content scripts (MAIN world)**: Access page globals, inject interceptors

### VII. Component Composition with HOCs

Form pages use the `FormHOC` pattern for consistent CRUD behavior (create/update detection, keyboard shortcuts, submission handling, navigation). Common UI components live in `options/components/common/` with variant/size props and Tailwind styling via `twMerge`. Prefer composition over inheritance for component reuse.

### VIII. React Context for Cross-Cutting State

Use React Context (`*Context.tsx` in `/context`) for state that spans component trees (sidebar state, overlays, feature toggles). Context providers wrap the app at appropriate levels. Keep context focused; avoid putting unrelated state in the same context.

## Technical Constraints

### Manifest V3 Compliance

- Service worker is the only background context (no persistent background pages)
- Use `declarativeNetRequest` for network interception where possible
- Content script registration via `chrome.scripting.registerContentScripts` for dynamic injection
- Respect `externally_connectable` scope for cross-origin messaging

### Build and Output Structure

- Webpack outputs to `dist/<browser>/` (chrome or edge via `BROWSER` env)
- Entry points: `serviceWorker/`, `options/`, `popup/`, `interceptor/`, content scripts
- Monaco editor workers bundled separately
- Version pulled from `package.json` into generated `manifest.json`

### Path Aliases

Use configured TypeScript path aliases (`@services/`, `@models/`, `@options/`, `@utils/`, `@context/`, `@assets/`) for imports. Keep imports consistent across the codebase.

## Development Workflow

### Adding a New Rule Type

1. Add `PageType` enum value in `formFieldModel.tsx`
2. Create generator in `options/pages/forms/<type>/generate*Rule.ts`
3. Register generator in `generateRuleMap` (`utils/generateRules.tsx`)
4. Create form component with `FormHOC` wrapper
5. Add route in `options/components/app/routes.tsx`
6. Update sidebar navigation if needed
7. Add icon mapping in `IconsMap` and name in `PageName`

### Testing Rule Changes

1. Load unpacked extension from `dist/chrome/`
2. Use HTTP Logger for request/response inspection
3. Verify both DNR and injected interceptor paths as applicable
4. Check `chrome.storage.local` via DevTools for persisted state

## Governance

This constitution defines architectural decisions that ensure consistency across the Inssman browser extension. Deviations require documented justification and MUST be discussed before implementation. The architecture prioritizes MV3 compliance, maintainability, and clear separation between execution contexts.

**Version**: 1.0.0 | **Ratified**: 2026-04-24 | **Last Amended**: 2026-04-24
