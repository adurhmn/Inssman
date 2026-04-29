# Feature Specification: Fix Hard-Reload Bug for Static Response Mocks

**Feature Branch**: `005-fix-mock-hard-reload`
**Created**: 2026-04-29
**Status**: Draft
**Input**: User description: "hard reload bug fix: Mocks not applied on normal reload (only after hard refresh). In some environments, mocks still fail after a hard refresh and the page receives 404s. Previously working mocks intermittently stop working."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Mocks apply reliably on a normal page reload (Priority: P1)

A developer has configured one or more "Modify Response" (static mock) rules in Inssman that match a URL pattern used by a page they have open. They press the browser's normal Reload button (or `Cmd/Ctrl+R`). The page must receive the mocked response, identical to what they get today only after a hard refresh.

**Why this priority**: This is the core promise of the product. Today users have to perform a hard refresh on every reload, which makes Inssman feel broken. Fixing this is the highest-impact change of this feature and on its own restores the product's primary value proposition.

**Independent Test**: With a known-good mock rule enabled and a target page already loaded, click the browser's Reload button (no cache bypass). The mocked response is delivered to every matching `fetch` and `XMLHttpRequest` call made during page load, on the very first attempt, with no retries or hard refresh required. Verifiable by inspecting the response payload in DevTools and matching it against the rule's configured response body.

**Acceptance Scenarios**:

1. **Given** a static "Modify Response" rule is enabled and matches a URL on the open tab, **When** the user performs a normal reload (no cache bypass), **Then** every matching request initiated during that page load receives the mocked response on the first attempt.
2. **Given** the same rule is enabled, **When** the user performs ten consecutive normal reloads in a row, **Then** all ten reloads deliver the mocked response without a single miss.
3. **Given** a rule that matches a request fired synchronously inside an inline `<script>` at the very top of the page (before any user interaction or `DOMContentLoaded`), **When** the user reloads the page, **Then** that request still receives the mocked response.
4. **Given** the rule matches a request fired from inside a same-origin iframe, **When** the user reloads the parent page, **Then** the iframe's matching requests also receive the mocked response.

---

### User Story 2 - Mocks apply reliably across all environments (no spurious 404s) (Priority: P1)

A developer has a mock rule whose match conditions are correct, but the upstream URL would otherwise return a 404 (e.g. an API path that doesn't exist on the dev backend, or a host that is unreachable). The mock must be returned to the page in place of the upstream 404 — consistently, regardless of the environment, browser profile, or which tab the rule was created in.

**Why this priority**: When a rule "fails open" and lets the real (404 / network-error) response through, the developer sees the upstream failure and reasonably assumes the rule itself is broken. This silently undermines trust in every rule the user has configured and is the second most impactful symptom reported.

**Independent Test**: Configure a static mock rule for a URL that is guaranteed to 404 from the real network (e.g. `https://example.com/this-does-not-exist`). Trigger a `fetch` to that URL on a normal reload. The page must receive the configured mock body with HTTP status 200 (or whatever the rule specifies), never the upstream 404, in every environment tested (fresh profile, multiple Chromium-based browsers, with and without DevTools open).

**Acceptance Scenarios**:

1. **Given** a mock rule whose target URL would otherwise return 404, **When** the page makes that request on reload, **Then** the page receives the mocked response, never the upstream 404.
2. **Given** a mock rule that worked successfully in a previous session, **When** the user opens the same page in a new browser session or new tab, **Then** the mock continues to work without requiring the rule to be re-saved or toggled off/on.
3. **Given** the network is offline or the upstream host is unreachable, **When** a request matches an enabled static mock rule, **Then** the page receives the mocked response instead of a network error.
4. **Given** Inssman's interception machinery encounters an internal error while evaluating a rule, **When** the request would have matched, **Then** the system surfaces a diagnostic the user can inspect (e.g. via the extension's logs or DevTools) rather than silently letting the upstream 404 / error reach the page.

---

### User Story 3 - Newly enabled or edited rules take effect on the next reload (Priority: P2)

A developer creates, edits, enables, or disables a rule in the Inssman UI while a target page is already open. On the next normal reload of that page, the change must be reflected — newly enabled rules begin mocking, disabled rules stop mocking, and edited match conditions or response bodies use the new values.

**Why this priority**: This is the workflow developers use when iterating on a mock. It is essential for a usable product but builds on User Story 1 — once the basic delivery mechanism is reliable, propagating changes is naturally easier. Marked P2 because the workaround (closing and reopening the tab) is more tolerable than the P1 issues.

**Independent Test**: Open a target page, then in the Inssman options UI enable a new mock rule that matches a request the page is about to make. Reload the page (normal reload). The newly enabled rule applies to the very next page load with no extra steps.

**Acceptance Scenarios**:

1. **Given** the user enables a rule while a target page is open, **When** they reload the page, **Then** the new rule applies on that first reload.
2. **Given** the user edits a rule's response body, **When** they reload the page, **Then** the new body is delivered, not the previous body.
3. **Given** the user disables a rule, **When** they reload the page, **Then** the upstream response is delivered (the mock no longer intercepts).

---

### Edge Cases

- A page issues a matching request synchronously during the very first inline `<script>` of the document, before any `load`/`DOMContentLoaded` event — the mock must still apply.
- A page issues a matching request from a same-origin iframe — the mock must still apply in that frame.
- The user has many rules configured (e.g. 50+) — rule matching must complete in time for the earliest request, with no observable delay relative to the upstream request.
- The user reloads the page while the extension's service worker is suspended (Manifest V3 idle behavior) — the mock must still apply once the worker wakes, or the request must be transparently delayed/retried until rules are available; under no circumstance should an unmocked upstream response leak through when a matching rule is enabled.
- The browser serves the document from the back/forward cache (bfcache) instead of triggering a full navigation — restored pages issuing new fetches must still see mocks applied.
- DevTools is open with "Disable cache" checked vs unchecked — behaviour must be identical.
- The page makes the same request twice (once during `document_start`-era inline script, once after `DOMContentLoaded`) — both must be mocked.
- A rule's match conditions are evaluated against URLs that are relative or protocol-relative — resolution to an absolute URL must be consistent regardless of when matching occurs.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST deliver matching mock responses to every interceptable request (`fetch` and `XMLHttpRequest`) made by a page on a normal reload, on the first attempt, without requiring the user to perform a hard refresh.
- **FR-002**: The system MUST guarantee that, when an enabled rule matches a request, the configured mock response is what reaches the page — never the upstream response, network error, or 404 — except in the explicit "rule disabled / not matching" path.
- **FR-003**: The system MUST have its rule set available to the request-interception layer before any interceptable request is allowed to leave the page on a fresh navigation. If rules are not yet available, matching requests MUST be deferred (held) until rules are loaded, rather than allowed to fall through to the network.
- **FR-004**: The system MUST apply mocks consistently across navigations, including: normal reload, hard reload, new tab, restored tab, back/forward navigation, and bfcache restoration.
- **FR-005**: The system MUST apply mocks inside same-origin iframes when an enabled rule matches a request made by that iframe.
- **FR-006**: The system MUST reflect rule changes (create / edit / enable / disable / delete) on the next page navigation without requiring the user to restart the browser, reinstall the extension, or perform a hard refresh.
- **FR-007**: The system MUST handle the Manifest V3 service worker idle/wake lifecycle without losing mocks: if the worker is suspended at the moment a matching navigation occurs, the request MUST still be mocked once the worker wakes (within a bounded time), or the user MUST see a clear, non-silent failure.
- **FR-008**: The system MUST NOT silently fall through to the upstream network when an internal error occurs during rule evaluation for a matching request. Such errors MUST be observable (e.g. logged in a way the developer can see in DevTools or extension logs) and the failure mode MUST be distinguishable from "no rule matched".
- **FR-009**: The system MUST resolve relative and protocol-relative request URLs to absolute URLs in the same way regardless of timing, so that match results are deterministic.
- **FR-010**: The fix MUST NOT regress any of the existing rule types (e.g. modify-request-body, inject-file, redirect, modify-headers) that share the interception infrastructure.
- **FR-011**: The system SHOULD complete rule matching for the earliest interceptable request with no developer-perceptible delay versus the upstream request under normal rule counts (target: indistinguishable in DevTools network timings up to 100 enabled rules).

### Key Entities *(include if feature involves data)*

- **Rule (existing)**: A user-configured mocking rule. Has match conditions (URL pattern, HTTP method, etc.), a response body / modification, and an enabled/disabled flag. This feature does not change the rule data model; it changes when and how reliably the rule set is made available to the page's request-interception layer.
- **Page Navigation**: Any event that causes a tab to load or restore a document — covers initial load, normal reload, hard reload, history navigation, and bfcache restoration. Each navigation must result in the current rule set being available before the page issues interceptable requests.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: On a fixed test page that fires a known-matching `fetch` request from an inline `<script>` at the top of the document, 100% of normal reloads (no cache bypass) result in the mocked response reaching the page, measured over 100 consecutive reloads in each of: a fresh browser profile, a profile with an active long-running session, and Incognito (with the extension allowed).
- **SC-002**: On the same test page, 0 reloads (out of 100 in each scenario above) result in an upstream 404 or upstream success leaking through when a matching enabled rule is configured.
- **SC-003**: After a user toggles a rule from disabled → enabled in the Inssman UI, the very next page reload reflects the new state in 100% of attempts, with no need for hard refresh, browser restart, or extension reload.
- **SC-004**: Across the three Chromium versions Inssman officially supports, the above two outcomes (SC-001, SC-002) hold without browser-specific regressions.
- **SC-005**: User-reported support tickets / GitHub issues mentioning "mock only works after hard refresh", "404 even though rule matches", or "mocks stopped working randomly" drop to zero new reports for 30 days following release.
- **SC-006**: Rule-matching latency (time from request initiation to either delivering the mock or releasing the request to the network) stays within 10 ms on a representative dev machine for rule sets up to 100 enabled rules.
- **SC-007**: No regression in the success rates of the other rule types (modify-request-body, inject-file, redirect, modify-headers) — measured via the existing manual / automated rule-type smoke checks before and after the fix.

## Assumptions

- The fix is scoped to the existing static "Modify Response" mocking flow and the shared request-interception infrastructure it uses; no change to the rule data model, the rule editor UI, or the rule storage format is required.
- The product continues to target Manifest V3 Chromium browsers; no fallback to Manifest V2 behaviour is in scope.
- "Static mock" means a user-configured response body (and optional status / headers) returned in place of the upstream response. Dynamic-modification rules (functions that transform the upstream response) are not the primary target of this fix but MUST not regress.
- Developers observe behaviour through the browser's standard reload affordances and DevTools Network panel; no new diagnostic UI is in scope unless required to satisfy FR-008 (in which case the minimum viable diagnostic — e.g. a console warning — suffices).
- "Normal reload" means the browser's default reload (`Cmd/Ctrl+R` or the reload button) without `Shift`, and without DevTools' "Disable cache" forcing a hard fetch.
- The user's reported intermittent failure in "some environments" stems from the same root cause as the hard-reload requirement (a timing / availability gap between the page's earliest interceptable requests and the moment the rule set becomes visible to the interceptor). If investigation reveals an unrelated second root cause, that finding is in scope to call out but a second fix may be tracked separately.
- The existing fall-through-to-original-network behaviour on internal interceptor errors is treated as a bug, not a feature, and is in scope to change per FR-008.
