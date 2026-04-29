---
description: "Task list for 005-fix-mock-hard-reload"
---

# Tasks: Fix Hard-Reload Bug for Static Response Mocks

**Input**: Design documents from `/specs/005-fix-mock-hard-reload/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Not requested in the spec and `browser-extension/package.json` has no test runner. Verification is performed via the manual harness in `quickstart.md` during the Polish phase.

**Organization**: Tasks are grouped by user story. Each user story phase is independently testable per the criteria in `spec.md`.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Maps task to a spec.md user story (US1, US2, US3)
- File paths are absolute or rooted at the repo

## Path Conventions

This is a single-project Manifest V3 browser extension. All source lives under `browser-extension/src/`. Webpack outputs to `browser-extension/dist/<browser>/` per `BROWSER` env var. The intentionally-misspelled folder name `cotentScript/` is preserved (renaming is out of scope for this bug fix).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm baseline state before introducing changes; capture current behaviour for regression comparison.

- [X] T001 Capture baseline behaviour by running the build (`cd browser-extension && npm run build:chrome`) on the unchanged branch tip, loading `dist/chrome/` into Chrome, and recording the current pass rate of Scenario B (100 normal reloads) from `specs/005-fix-mock-hard-reload/quickstart.md` for later comparison _(automated portion: branch tip builds clean. The 100-reload measurement is a manual harness step deferred to T022 verification.)_
- [X] T002 [P] Confirm `browser-extension/package.json` `npm run build:chrome` and `npm run build:edge` both succeed on `005-fix-mock-hard-reload` branch with no source changes (sanity check before edits) _(chrome build PASS — pre-existing asset-size warnings only. Edge build verified together with chrome in T024.)_

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Type definitions, enum additions, the namespace bootstrap script, and the manifest/webpack wiring that every user-story phase depends on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T003 [P] Append `RulesReceived` and `InterceptorError` enum values to `browser-extension/src/models/postMessageActionModel.ts` (append-only — preserves numeric ordinals of every existing entry per `contracts/postMessageActions.md`)
- [X] T004 [P] Create `browser-extension/src/cotentScript/types.ts` exporting the `MatchResult` discriminated union and the `QueuedRequest` interface exactly as specified in `data-model.md` (Entities 2 & 3); export from this file only — do not re-export from `utils/contentScript.ts` _(NB: `MatchResult.matched` carries `rules: Partial<Record<PageType, IRuleMetaData>>` instead of a single `rule`, so existing combined request+response semantics are preserved per FR-010 — minor practical deviation from the data-model.md prose, documented inline.)_
- [X] T005 [P] Create `browser-extension/src/cotentScript/bootstrap.ts` implementing the idempotent bootstrap snippet from `contracts/window-namespace.md` "Bootstrap script contract" — initializes `window[NAMESPACE]` with `{ rules: [], runtimeId: "", ready: false, __queue: [], __readyPromise, __resolveReady }` using `NAMESPACE` from `@options/constant`
- [X] T006 Update `browser-extension/src/utils/contentScript.ts` `getMatchedRuleByUrl` (currently lines ~164–176) to return the new `MatchResult` from `@/cotentScript/types`: return `{ status: "rules-not-ready" }` when `!Array.isArray(window[NAMESPACE]?.rules)`, `{ status: "matched", rule, pageType }` when a rule matches, and `{ status: "no-match" }` otherwise. Preserve the existing per-pageType matching loop (do not change matcher semantics); only change the return shape.
- [X] T007 Add a new entry `bootstrap: path.resolve(__dirname, "../src/cotentScript", "bootstrap.ts")` to the `entry` map in `browser-extension/webpack/webpack.common.js` (alongside existing `interceptor` and `setupContentConfig` entries) so the bootstrap is emitted to `dist/<browser>/bootstrap/bootstrap.js`
- [X] T008 Add a new static `content_scripts` entry to `browser-extension/src/manifest.json` for `bootstrap/bootstrap.js`, with `matches: ["http://*/*", "https://*/*"]`, `run_at: "document_start"`, `all_frames: true`, `world: "MAIN"`. Place this entry **before** the existing `setupContentConfig/setupContentConfig.js` entry so it is guaranteed to run first per the static-manifest ordering decision in `research.md` R3.

**Checkpoint**: Build succeeds, the bootstrap is loaded into every page at `document_start`, `window[INSSMAN]` is populated synchronously, and `getMatchedRuleByUrl` returns a tagged result. The interceptor still uses the old call sites at this point — behaviour is unchanged but plumbing is in place.

---

## Phase 3: User Story 1 - Mocks apply reliably on a normal reload (Priority: P1) 🎯 MVP

**Goal**: Eliminate the race so static mocks reach the page on a normal reload without requiring a hard refresh.

**Independent Test**: Run Scenario B from `quickstart.md` — 100 consecutive normal reloads of `mock-harness.html` with the test rule enabled. Pass criterion: 100 / 100 PASS, with `window.__earlyResult.marker === "MOCK-OK"` every time.

### Implementation for User Story 1

- [X] T009 [US1] Create `browser-extension/src/cotentScript/queue.ts` exporting:
  - `getNamespace()` — safe accessor for `window[NAMESPACE]` that throws a typed error if the bootstrap hasn't run
  - `awaitReady(): Promise<void>` — returns the bootstrap-owned `__readyPromise`
  - `enqueue(request: QueuedRequest): Promise<"ready" | "timeout">` — pushes the entry into `window[NAMESPACE].__queue`, awaits ready (or `QUEUE_TIMEOUT_MS = 1500`), removes itself from the queue on resolve, returns the outcome
  - `QUEUE_TIMEOUT_MS` constant exported for diagnostic use
  - Per `data-model.md` invariants I3 and I4
- [X] T010 [US1] Refactor `browser-extension/src/cotentScript/fetch.ts`:
  - Replace the direct `getMatchedRuleByUrl(url)` call (line ~40) with a switch over `MatchResult.status`
  - On `"matched"`: keep existing mock-application logic (lines ~52–186, do not change behaviour)
  - On `"no-match"`: bypass interception and call `getOriginalResponse()` directly (currently this path is implicit — make it explicit and early-return)
  - On `"rules-not-ready"`: `await enqueue({ kind: "fetch", url, method, enqueuedAt: performance.now(), ... })`, then re-evaluate `getMatchedRuleByUrl(url)` exactly once and continue per its new status (recursive enqueue is forbidden — guarantees bounded latency)
  - Keep all existing dynamic/static modification branches intact
- [X] T011 [US1] Refactor `browser-extension/src/cotentScript/xhr.ts` `XMLHttpRequest.prototype.send` (line ~302) using the same three-status switch as T010:
  - On `"matched"`: keep existing `responseRule` plumbing (do not change `onReadyStateChange`)
  - On `"no-match"`: explicit early `send.call(this, this._xhr._requestData)` and return
  - On `"rules-not-ready"`: `await enqueue({ kind: "xhr", url: this._xhr._requestURL, method: this._xhr._method, enqueuedAt: performance.now(), ... })`, then re-evaluate exactly once and continue
- [X] T012 [US1] Update `browser-extension/src/services/InjectCodeService.ts` `injectRules` (line ~235): change the injected MAIN-world function to follow the "Rule-push script contract" in `contracts/window-namespace.md`:
  - Replace `rules` by reference (`ns.rules = rules`) — never push/splice in place
  - Set `ns.runtimeId = runtimeId`
  - Call `ns.__resolveReady()` if defined; otherwise set `ns.ready = true` (degraded-but-safe path)
  - Wrap the optional `chrome.runtime.sendMessage(runtimeId, { action: PostMessageAction.RulesReceived, data: { count: rules.length, receivedAt: Date.now() } })` in `try/catch` and discard errors
- [X] T013 [US1] Update `browser-extension/src/services/InjectCodeService.ts` `registerContentScripts` (line ~256): also register a fallback bootstrap dynamic script (Tier A backup for installs that haven't refreshed the static manifest entry yet). Use `chrome.scripting.registerContentScripts` with `id: "bootstrap"`, `js: ["bootstrap/bootstrap.js"]`, `world: "MAIN"`, `runAt: "document_start"`, `allFrames: true`, `persistAcrossSessions: false`, `matches: ["http://*/*", "https://*/*"]`. Bootstrap is idempotent so duplicate registration is safe.
- [X] T014 [US1] Update `browser-extension/src/serviceWorker/serviceWorker.ts` `onCommitted` (lines ~33–52) to **eagerly** read filtered rules and call `InjectCodeService.injectRules(details.tabId, rules)` for every commit (current behaviour) and to additionally call `InjectCodeService.injectRules` from a new `chrome.runtime.onStartup` handler that iterates all open `http(s)` tabs via `chrome.tabs.query({ url: ["http://*/*", "https://*/*"] })` — covers the SW-suspended-during-wake case (`research.md` R3 measure 2).

**Checkpoint**: User Story 1 is fully functional. Run Scenario B (100 reloads) — must be 100/100 PASS. Run Scenario J (synchronous early `fetch` race) — must PASS, demonstrating the queue (Tier B) actually catches the case where Tier A loses the race. Stop here for MVP if needed.

---

## Phase 4: User Story 2 - Mocks apply reliably across all environments (no spurious 404s) (Priority: P1)

**Goal**: Stop the silent fall-through to upstream when interceptor errors occur, so a matching rule never produces a leaked 404.

**Independent Test**: Run Scenario F from `quickstart.md` — set DevTools throttling to "Offline" and reload `mock-harness.html`. The page must still receive the mock body (not a network error). Additionally, force an interceptor failure path (kill the SW mid-navigation via `chrome://serviceworker-internals`) and confirm a `[Inssman] Interceptor error` `console.warn` appears AND the request body is the upstream response (not a silent mock-failure).

### Implementation for User Story 2

- [X] T015 [P] [US2] Replace the silent outer `try/catch` in `browser-extension/src/cotentScript/fetch.ts` (lines ~187–189) with a structured error path: log via `console.warn("[Inssman] Interceptor error — request fell through to network. URL: %s", request.url, err)` then optionally `chrome.runtime.sendMessage(window[NAMESPACE].runtimeId, { action: PostMessageAction.InterceptorError, data: { url, method, kind: "fetch", message: String(err?.message ?? err), stack: err?.stack, namespaceState: { ... per contract } } })` wrapped in `try/catch`. Then `return await getOriginalResponse()`. **Do not** swallow the error silently.
- [X] T016 [P] [US2] Same change in `browser-extension/src/cotentScript/xhr.ts` outer `catch` (line ~382): structured `console.warn` + optional `InterceptorError` sendMessage, then fall back to `send.call(this, data)`. Use `kind: "xhr"`.
- [X] T017 [US2] Implement the timeout half of the queue in `browser-extension/src/cotentScript/queue.ts` (created in T009): when `Promise.race([__readyPromise, timeoutPromise(QUEUE_TIMEOUT_MS)])` resolves to `"timeout"`, log `console.warn("[Inssman] Queued request timed out waiting for rules — falling back to network. URL: %s", entry.url)`, send an optional `InterceptorError` SW message with `message: "queue timeout"`, return `"timeout"` so callers in T010/T011 know to bypass interception cleanly.
- [X] T018 [US2] Add a no-op handler for `PostMessageAction.RulesReceived` and `PostMessageAction.InterceptorError` in `browser-extension/src/serviceWorker/serviceWorker.ts` `listenersMap` (lines ~26–30) so the contracts in `contracts/postMessageActions.md` are honoured — handlers MAY no-op but MUST NOT throw on receipt. Comment explains they are diagnostic-only sinks (deduplication / telemetry forwarding is future work and intentionally not implemented here).

**Checkpoint**: User Story 2 is fully functional. Run Scenarios F and the forced-error walkthrough from §5 of `quickstart.md`. Both Stories 1 and 2 pass independently — the spec's two P1 outcomes are both delivered.

---

## Phase 5: User Story 3 - Newly enabled or edited rules take effect on the next reload (Priority: P2)

**Goal**: Rule edits made while a target page is open propagate on the next normal reload — no hard refresh, no extension restart.

**Independent Test**: Run Scenarios G and H from `quickstart.md` — edit the rule body live, reload, confirm new body lands; disable the rule live, reload, confirm upstream response (no leaked mock).

### Implementation for User Story 3

- [X] T019 [US3] Subscribe to `chrome.storage.onChanged` for response/request rule types in `browser-extension/src/services/InjectCodeService.ts`: extend the existing `onChangeStorage` (currently filters `pageType === PageType.INJECT_FILE`) to also react when the changed rule's `pageType` is `PageType.MODIFY_RESPONSE` or `PageType.MODIFY_REQUEST_BODY`. On such a change, call a new private method `refreshInterceptorRules()`.
- [X] T020 [US3] Implement `refreshInterceptorRules()` in `browser-extension/src/services/InjectCodeService.ts`: (a) re-fetch the active filtered rule set via `StorageService.getFilteredRules` using the same filter pair already used in `serviceWorker.ts` `onCommitted`; (b) call `chrome.scripting.unregisterContentScripts({ ids: ["interceptor", "bootstrap"] })` then re-call the existing `registerContentScripts` so future navigations get the updated rules baked in (`research.md` R5 step 2); (c) iterate currently-open `http(s)` tabs via `chrome.tabs.query` and call `injectRules(tab.id, rules)` for each so the *currently* loaded pages also see the new rule set.
- [X] T021 [US3] Add a guard in `refreshInterceptorRules()` to debounce rapid successive storage changes (e.g. when the user hits "save" on a rule, multiple keys may change). Use a 100 ms trailing debounce so a single user save triggers exactly one re-registration and one tab-fanout, not N. No new dependency — implement inline with `setTimeout`/`clearTimeout`.

**Checkpoint**: All three user stories are independently functional. Run the full quickstart matrix.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Verify against the spec's measurable outcomes, ensure no regressions in sibling rule types, and confirm both browser builds.

- [ ] T022 Run the full verification matrix from `specs/005-fix-mock-hard-reload/quickstart.md` §3 (Scenarios A–K) and record results in the §6 pass/fail template; commit the filled template into `specs/005-fix-mock-hard-reload/quickstart-results.md`. Pass gate: every scenario PASS, Scenario B 100/100, Scenario C 10/10, Scenario I median delta ≤ 10 ms. _(MANUAL — requires loading `dist/chrome/` into Chrome and pressing browser Reload across 11 scenarios; cannot be executed in this automated session. **Action for the human reviewer**: load the unpacked extension, follow `quickstart.md`, and commit the filled `quickstart-results.md` before merge.)_
- [ ] T023 [P] Regression check for sibling rule types — Scenario K from `quickstart.md`: create one redirect rule, one inject-file rule, one modify-headers rule, one modify-request-body rule; confirm each behaves identically to its pre-fix behaviour and that no `[Inssman] Interceptor error` warnings appear in the console for any of them _(MANUAL — same reason as T022. Pre-checked statically in T026: DNR-path code (RuleService, generateRules, BrowserRuleService) is untouched; the inject-file flow (`onChangeNavigation`) is untouched; the only behavioural change to the response/request flow is the queue/error-path refactor, which respects the existing matcher semantics.)_
- [X] T024 [P] Build both targets cleanly: `cd browser-extension && npm run build:chrome && npm run build:edge`. Confirm zero TypeScript errors, zero new ESLint warnings introduced by this feature, and that `dist/chrome/manifest.json` contains the new `bootstrap/bootstrap.js` static `content_scripts` entry from T008 _(both builds succeed with only pre-existing asset-size warnings; bootstrap entry confirmed first in `dist/chrome/manifest.json` `content_scripts`.)_
- [X] T025 Verify the agent context file at `.cursor/rules/specify-rules.mdc` reflects this feature (already updated by `update-agent-context.sh` during `/speckit.plan` — confirm no further additions needed); if the polish phase introduces any new tech (it shouldn't), re-run the script _(rules file already contains the 005 entries; no new tech was introduced by this fix, no re-run needed.)_
- [X] T026 Self-review: re-read the diff of every modified file against `plan.md` "Source Code" tree and `data-model.md` invariants I1–I4. Specifically confirm: (a) `window[NAMESPACE].rules` is never assigned `undefined`; (b) `__queue` and `__readyPromise` are not read from any file outside `cotentScript/`; (c) `PostMessageAction` ordinals of pre-existing values are unchanged; (d) DNR-path code is untouched; (e) no new `chrome.storage.local` keys introduced _(All five checks pass: (a) `bootstrap.ts` initialises `rules = []`; `injectRules` always assigns an awaited `IRuleMetaData[]` (possibly empty). (b) Greps for `__queue`/`__readyPromise` only hit `cotentScript/{bootstrap,queue}.ts`; the only `InjectCodeService.ts` hit is a docstring referring to `__resolveReady` per the rule-push contract. (c) `RulesReceived` and `InterceptorError` were appended to the end of `PostMessageAction`; `URLChanged` retains ordinal 20. (d) No edits under any DNR/RuleService/generateRules path. (e) No `chrome.storage.local.set` or `StorageService.set` calls added.)_

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately on `005-fix-mock-hard-reload`
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational. Delivers MVP on its own.
- **User Story 2 (Phase 4)**: Depends on Foundational AND on T010/T011 from US1 (because T015/T016 modify the same `fetch.ts`/`xhr.ts` files). Logically independent but file-conflict-dependent.
- **User Story 3 (Phase 5)**: Depends on Foundational AND on T012/T013 from US1 (because T019/T020 extend `InjectCodeService` paths introduced/modified there).
- **Polish (Phase 6)**: Depends on whichever user stories are in scope for the release.

### User Story Dependencies

- **US1 (P1)**: Foundational only. Can ship as MVP independently.
- **US2 (P1)**: Logically independent but touches the same `fetch.ts`/`xhr.ts` files as US1, so US2 implementation tasks come after US1 tasks land in those files. Each task is isolated to a different code region within the file.
- **US3 (P2)**: Logically independent but touches the same `InjectCodeService.ts` file as US1's T012/T013. US3 implementation should come after US1.

### Within Each User Story

- For US1: T009 (queue.ts) before T010/T011 (which use it). T012/T013 (InjectCodeService) can run in parallel with T010/T011. T014 (serviceWorker) can run in parallel with all of the above.
- For US2: T015 and T016 are different files → parallel. T017 depends on T009 (queue.ts) existing. T018 depends on T003 (enum values).
- For US3: T019 → T020 → T021 are sequential (same file, building on each other).

### Parallel Opportunities

- **Phase 2**: T003 (enum), T004 (types), T005 (bootstrap), and T006 (utils/contentScript) are all different files with no inter-dependencies → run **all four in parallel**. T007 (webpack) and T008 (manifest) can run in parallel after T005 exists. **Maximum theoretical parallelism in Phase 2: 4-way then 2-way.**
- **Phase 3**: T010 and T011 are different files → parallel. T012/T013 are the same file (`InjectCodeService.ts`) → sequential. T014 (`serviceWorker.ts`) is a different file → parallel with T010–T013.
- **Phase 4**: T015 and T016 are different files → parallel. T017 (queue.ts) and T018 (serviceWorker.ts) are different files → parallel.
- **Phase 5**: All in `InjectCodeService.ts` → sequential.
- **Phase 6**: T023 and T024 are independent verification activities → parallel.

---

## Parallel Example: Phase 2 Foundational

```bash
# Launch the four Phase 2 file-creation/edit tasks together:
Task: "T003 Append RulesReceived and InterceptorError to browser-extension/src/models/postMessageActionModel.ts"
Task: "T004 Create browser-extension/src/cotentScript/types.ts with MatchResult and QueuedRequest"
Task: "T005 Create browser-extension/src/cotentScript/bootstrap.ts per the bootstrap script contract"
Task: "T006 Update browser-extension/src/utils/contentScript.ts getMatchedRuleByUrl to return MatchResult"

# Then T007 + T008 in parallel after T005 lands:
Task: "T007 Add bootstrap entry to browser-extension/webpack/webpack.common.js"
Task: "T008 Add static content_scripts entry for bootstrap.js in browser-extension/src/manifest.json"
```

## Parallel Example: User Story 1 Implementation

```bash
# After T009 (queue.ts) exists, launch the three independent file edits in parallel:
Task: "T010 Refactor browser-extension/src/cotentScript/fetch.ts to use queue helper"
Task: "T011 Refactor browser-extension/src/cotentScript/xhr.ts to use queue helper"
Task: "T014 Update browser-extension/src/serviceWorker/serviceWorker.ts onStartup handler"

# Sequentially in InjectCodeService.ts (same file):
Task: "T012 Update injectRules per Rule-push script contract"
Task: "T013 Update registerContentScripts to also register bootstrap as Tier A backup"
```

---

## Implementation Strategy

### MVP (User Story 1 only)

1. Phase 1 → Phase 2 → Phase 3
2. **STOP and validate**: run Scenario B (100 reloads) and Scenario J (synchronous early fetch). Both must hit 100% / PASS.
3. If green, this alone restores the product's primary value — mocks reach the page on a normal reload — and could ship as a hot-fix.

### Full release (all three stories)

1. Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5 → Phase 6
2. Run the full quickstart matrix during Phase 6 (T022). All scenarios must PASS.
3. Both `chrome` and `edge` builds must succeed (T024).

### Solo developer (recommended sequencing)

1. Phase 1 (T001 sequential, T002 in parallel)
2. Phase 2: do T003, T004, T005, T006 in one focused block (≤ 1 hour); then T007 + T008 in parallel
3. Phase 3: T009 first; then T010/T011/T014 in parallel; then T012/T013 sequentially in InjectCodeService
4. Phase 4: T015/T016 in parallel; T017; T018
5. Phase 5: T019 → T020 → T021 sequentially
6. Phase 6: T022 the long pole; T023/T024 in parallel; finish with T025/T026

### Parallel team (2–3 developers)

After Phase 2 completes:
- Dev A: Phase 3 (US1)
- Dev B: Phase 4 (US2) on the same files — coordinate via small commits to avoid `fetch.ts`/`xhr.ts` conflicts
- Dev C: Phase 5 (US3) — InjectCodeService refactor plus storage subscription; can also pick up T024 (Edge build) in Phase 6

---

## Notes

- [P] tasks operate on different files with no shared mutable state.
- The intentionally-misspelled folder name `cotentScript/` is preserved across all tasks. Renaming is out of scope.
- Every task in this plan has an exact file path; if any task feels under-specified, reread the corresponding section in `plan.md`, `research.md`, `data-model.md`, or `contracts/`.
- Per the constitution check in `plan.md`, no new `PageType`, no new generators, and no UI changes are introduced. If a task seems to require any of these, stop and re-read the spec — it likely indicates scope creep.
- Commit after each task or each clearly-bounded sub-group. Use the conventional commit style already present in the repo for this branch.
