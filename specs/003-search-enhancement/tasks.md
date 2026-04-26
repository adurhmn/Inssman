# Tasks: Search Enhancement

**Input**: Design documents from `/specs/003-search-enhancement/`  
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md

**Tests**: Not requested in specification. Manual testing via quickstart.md.

**Organization**: Tasks organized by user story for independent verification.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Browser Extension**: `browser-extension/src/` at repository root
- Primary changes in `options/components/` directory

---

## Phase 1: Setup

**Purpose**: Verify development environment and understand current implementation

- [X] T001 Verify branch `003-search-enhancement` is checked out
- [X] T002 Run `npm run dev` in `browser-extension/` to start development build
- [ ] T003 Load unpacked extension from `dist/chrome/` in Chrome and verify current search behavior

---

## Phase 2: Foundational

**Purpose**: No foundational changes needed - this feature modifies existing UI filtering only

**⚠️ Note**: This feature has no blocking prerequisites. The existing search infrastructure (input field, state management, rule list) is already in place.

**Checkpoint**: Development environment ready - proceed to user story implementation

---

## Phase 3: User Story 1 - Case-Insensitive Search (Priority: P1) 🎯 MVP

**Goal**: Users can search for rules regardless of letter casing (uppercase, lowercase, mixed)

**Independent Test**: Create a rule named "BlockAds", search for "blockads" (lowercase) - rule should appear

### Implementation for User Story 1

- [X] T004 [US1] Update filter logic to use `toLowerCase()` for case-insensitive name matching in `browser-extension/src/options/components/ruleList/ruleList.tsx`

**Checkpoint**: Case-insensitive name search working. Verify by searching "blockads" for a rule named "BlockAds"

---

## Phase 4: User Story 2 - Search by Source Column (Priority: P1)

**Goal**: Users can search for rules by their Source/domain value

**Independent Test**: Create a rule with source "example.com", search for "example" - rule should appear

### Implementation for User Story 2

- [X] T005 [US2] Extend filter logic to check `conditions[].source` field with case-insensitive matching in `browser-extension/src/options/components/ruleList/ruleList.tsx`

**Checkpoint**: Source column search working. Verify by searching "example" for a rule with source "example.com"

---

## Phase 5: User Story 3 - Multi-Column Match Display (Priority: P1)

**Goal**: Search matches against both Name AND Source using OR logic - rule appears if either field matches

**Independent Test**: Create two rules - one with name containing "api", another with source containing "api" - both should appear when searching "api"

### Implementation for User Story 3

- [X] T006 [US3] Combine name and source matching with OR logic (rule shows if either matches) in `browser-extension/src/options/components/ruleList/ruleList.tsx`
- [X] T007 [US3] Handle edge cases: empty search shows all rules, whitespace-only treated as empty in `browser-extension/src/options/components/ruleList/ruleList.tsx`

**Checkpoint**: Full OR-logic search working across both columns

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: UI consistency and validation

- [X] T008 [P] Update search placeholder from "Search By Rule Name" to "Search by Name or Source" in `browser-extension/src/options/components/main/main.tsx`
- [ ] T009 Run full manual test suite from `specs/003-search-enhancement/quickstart.md`
- [ ] T010 Verify no duplicate rules appear when search term matches both Name and Source of same rule

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - start immediately
- **Foundational (Phase 2)**: Skipped - no foundational changes needed
- **User Stories (Phase 3-5)**: Sequential implementation (T004 → T005 → T006 → T007)
- **Polish (Phase 6)**: T008 can run in parallel with any task; T009-T010 after all stories complete

### User Story Dependencies

- **User Story 1 (P1)**: No dependencies - implements case-insensitive name search
- **User Story 2 (P1)**: Builds on US1 - adds source column to existing filter
- **User Story 3 (P1)**: Builds on US1+US2 - combines with OR logic and edge cases

### Within Each User Story

All tasks in Phases 3-5 modify the same function in `ruleList.tsx`, so they must be sequential.

### Parallel Opportunities

- T008 (placeholder update in `main.tsx`) can run in parallel with any implementation task
- Setup tasks T001-T003 are sequential (each depends on previous)

---

## Parallel Example: Implementation + UI Update

```bash
# These can run in parallel (different files):
Task T004: "Update filter logic in ruleList.tsx"
Task T008: "Update placeholder in main.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T003)
2. Complete Phase 3: User Story 1 (T004)
3. **STOP and VALIDATE**: Test case-insensitive search independently
4. Can deploy with just case-insensitive name search as immediate improvement

### Full Implementation

1. Complete Setup (T001-T003)
2. Implement all stories sequentially (T004 → T005 → T006 → T007)
3. Polish (T008-T010)
4. Full validation against quickstart.md test cases

### Single File Implementation (Recommended)

Since T004-T007 all modify the same filter function in `ruleList.tsx`, they can be implemented as a single cohesive change:

```typescript
const filteredList = sortRules(
  rules.filter((ruleMetaData) => {
    const searchLower = search.toLowerCase().trim();
    if (!searchLower) return true;
    
    const nameMatches = ruleMetaData.name.toLowerCase().includes(searchLower);
    const sourceMatches = ruleMetaData.conditions.some(
      (condition) => condition.source.toLowerCase().includes(searchLower)
    );
    
    return nameMatches || sourceMatches;
  }),
  sortState
);
```

---

## Notes

- All user stories are P1 priority and tightly coupled - best implemented together
- No test framework configured; use manual testing per quickstart.md
- Tasks T004-T007 modify same file/function - treat as logical sequence
- T008 is independent (different file) and can run anytime
- Commit after T007 completes for atomic feature delivery
