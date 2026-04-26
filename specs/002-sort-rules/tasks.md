# Tasks: Sort Rules

**Input**: Design documents from `/specs/002-sort-rules/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md

**Tests**: Manual testing only (per plan.md - no automated tests specified)

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Browser Extension**: `browser-extension/src/`
- Options components: `browser-extension/src/options/components/`
- Models: `browser-extension/src/models/`
- Utils: `browser-extension/src/utils/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create new types and utilities that will be shared across user stories

- [X] T001 [P] Create sort type definitions in `browser-extension/src/models/sortModel.ts`
- [X] T002 [P] Create SortIndicator component in `browser-extension/src/options/components/common/sortIndicator/sortIndicator.tsx`
- [X] T003 Create sort utility functions (`sortRules`, `getNextSortState`) in `browser-extension/src/utils/sortRules.ts`

**Checkpoint**: Core sorting infrastructure ready for integration

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Extend existing components to support sort functionality

**⚠️ CRITICAL**: User story implementation depends on these modifications

- [X] T004 Extend `ListHeader` type to include `sortable` and `sortKey` properties in `browser-extension/src/options/components/common/list/list.tsx`
- [X] T005 Update `List` component to pass `sortState` and `onSort` callback to header render functions in `browser-extension/src/options/components/common/list/list.tsx`
- [X] T006 Add sort state (`useState`) and `handleSort` function to `RuleList` component in `browser-extension/src/options/components/ruleList/ruleList.tsx`
- [X] T007 Pass `sortState` and `onSort` props from `RuleList` to `List` component in `browser-extension/src/options/components/ruleList/ruleList.tsx`
- [X] T008 Update `filteredList` logic to use `sortRules` utility and remove hardcoded `.reverse()` in `browser-extension/src/options/components/ruleList/ruleList.tsx`

**Checkpoint**: Foundation ready - sort state flows through components, user story columns can be enabled

---

## Phase 3: User Story 1 - Sort Rules by Name (Priority: P1) 🎯 MVP

**Goal**: Enable users to sort rules alphabetically by name (A-Z, Z-A)

**Independent Test**: Click Name column header → rules reorder alphabetically. Click again → reverse order. Click again → default order.

### Implementation for User Story 1

- [X] T009 [US1] Update Name header in `LIST_HEADERS` to include SortIndicator and handle sort clicks in `browser-extension/src/options/components/ruleList/list.config.tsx`
- [X] T010 [US1] Verify case-insensitive alphabetical sorting works correctly (localeCompare with sensitivity: 'base')
- [X] T011 [US1] Verify stable sort behavior for rules with identical names

**Checkpoint**: User Story 1 complete - Name sorting fully functional and testable

---

## Phase 4: User Story 2 - Sort Rules by Last Matched (Priority: P2)

**Goal**: Enable users to sort rules by their last matched timestamp (most recent first, oldest first)

**Independent Test**: Click Last Matched column header → rules sorted by most recent. Click again → oldest first. Click again → default order.

### Implementation for User Story 2

- [X] T012 [US2] Update Last Matched header in `LIST_HEADERS` to include SortIndicator and handle sort clicks in `browser-extension/src/options/components/ruleList/list.config.tsx`
- [X] T013 [US2] Verify null/undefined `lastMatchedTimestamp` values are handled correctly (at end for ascending, at beginning for descending)

**Checkpoint**: User Story 2 complete - Last Matched sorting fully functional and testable

---

## Phase 5: User Story 3 - Single Active Sort Criterion (Priority: P1)

**Goal**: Ensure only one sort criterion is active at a time with clear visual indication

**Independent Test**: With Name sorted, click Last Matched → Name indicator disappears, only Last Matched shows indicator

### Implementation for User Story 3

- [X] T014 [US3] Verify `getNextSortState` correctly replaces sort when different column clicked (already implemented in T003, verify integration)
- [X] T015 [US3] Verify only the active column displays sort indicator (ascending/descending icon visible, others show muted state)
- [X] T016 [US3] Verify clicking a sorted column cycles through: default direction → opposite direction → no sort

**Checkpoint**: User Story 3 complete - Single sort behavior fully functional

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Edge cases, accessibility, and final verification

- [X] T017 [P] Verify sort controls work correctly when rules list is empty (no errors)
- [X] T018 [P] Verify sort controls work correctly with single rule (no visible change, no errors)
- [X] T019 [P] Verify sort works correctly with search filter active (filter first, then sort)
- [X] T020 Verify accessibility: SortIndicator button has appropriate aria-label
- [ ] T021 Run manual testing checklist from `quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on T001, T002, T003 from Setup
- **User Story 1 (Phase 3)**: Depends on Phase 2 completion
- **User Story 2 (Phase 4)**: Depends on Phase 2 completion (can run parallel to US1)
- **User Story 3 (Phase 5)**: Depends on T003 from Setup, verifies integration (can run parallel to US1/US2)
- **Polish (Phase 6)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Independent - requires only foundational phase
- **User Story 2 (P2)**: Independent - requires only foundational phase
- **User Story 3 (P1)**: Cross-cutting behavior - verifies US1 and US2 interact correctly

### Within Each Phase

- Phase 1: T001 and T002 can run in parallel; T003 depends on T001
- Phase 2: T004 → T005 (same file); T006 → T007 → T008 (same file)
- User Stories: Each task in sequence within story

### Parallel Opportunities

- **Phase 1**: T001 and T002 can run in parallel
- **Phase 2**: T004-T005 (list.tsx) can run parallel to T006-T008 (ruleList.tsx)
- **User Stories**: US1 and US2 can be implemented in parallel after Phase 2
- **Polish**: T017, T018, T019 can run in parallel

---

## Parallel Example: Setup Phase

```bash
# Launch in parallel:
Task: "Create sort type definitions in browser-extension/src/models/sortModel.ts"
Task: "Create SortIndicator component in browser-extension/src/options/components/common/sortIndicator/sortIndicator.tsx"

# Then sequentially:
Task: "Create sort utility functions in browser-extension/src/utils/sortRules.ts" (needs sortModel.ts)
```

## Parallel Example: User Stories

```bash
# After Phase 2 completes, can run in parallel:
# Developer A:
Task: "Update Name header in LIST_HEADERS..." (US1)

# Developer B:
Task: "Update Last Matched header in LIST_HEADERS..." (US2)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T003)
2. Complete Phase 2: Foundational (T004-T008)
3. Complete Phase 3: User Story 1 (T009-T011)
4. **STOP and VALIDATE**: Test Name sorting independently
5. Can ship with just Name sorting as MVP

### Incremental Delivery

1. Setup + Foundational → Infrastructure ready
2. Add User Story 1 (Name sort) → Test → Can deploy
3. Add User Story 2 (Last Matched sort) → Test → Can deploy
4. Verify User Story 3 (single sort) → Test → Final validation
5. Polish → Production ready

### Single Developer Strategy

Recommended execution order:
1. T001, T002 (parallel) → T003
2. T004 → T005 → T006 → T007 → T008
3. T009 → T010 → T011 (US1 complete, test here)
4. T012 → T013 (US2 complete, test here)
5. T014 → T015 → T016 (US3 complete, test here)
6. T017-T021 (polish)

---

## Notes

- All tasks modify files within `browser-extension/src/`
- No new npm dependencies required
- Manual testing via Chrome DevTools (load unpacked extension from `dist/chrome/`)
- Uses existing icons: `arrowUpLong`, `arrowDownLong`
- Sort state is ephemeral (not persisted to storage)
- Commit after each checkpoint for easy rollback
