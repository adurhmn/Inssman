# Tasks: Resizable Columns for All Rules Dashboard

**Input**: Design documents from `/specs/004-resizable-columns/`  
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, quickstart.md

**Tests**: Not requested in specification. Manual testing via extension reload (existing pattern).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Browser Extension**: `browser-extension/src/`
- Structure based on plan.md: models/, options/components/, hooks/, utils/

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Add storage key and create shared utilities that all user stories depend on

- [X] T001 Add `COLUMN_WIDTHS` to StorageKey enum in browser-extension/src/models/storageModel.ts
- [X] T002 [P] Create ColumnWidthPreferences interface and ColumnField type in browser-extension/src/utils/columnWidths.ts
- [X] T003 [P] Add DEFAULT_COLUMN_WIDTHS constant in browser-extension/src/utils/columnWidths.ts
- [X] T004 [P] Add MIN_COLUMN_WIDTHS constant in browser-extension/src/utils/columnWidths.ts
- [X] T005 [P] Add COLUMN_FIELDS array constant in browser-extension/src/utils/columnWidths.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core components and hooks that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T006 Add `field` property to ListHeader type in browser-extension/src/options/components/common/list/list.tsx
- [X] T007 Update LIST_HEADERS in browser-extension/src/options/components/ruleList/list.config.tsx to include field property matching LIST_ITEMS fields
- [X] T008 Create ResizeHandle component with hover/active states in browser-extension/src/options/components/common/list/resizeHandle.tsx
- [X] T009 Create useColumnWidths hook skeleton (state only, no persistence yet) in browser-extension/src/hooks/useColumnWidths.ts

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - Resize Column to View Full Content (Priority: P1) 🎯 MVP

**Goal**: Users can drag column boundaries to resize columns and see previously truncated content

**Independent Test**: Hover over Name column boundary, drag to widen, verify long rule names become visible

### Implementation for User Story 1

- [X] T010 [US1] Add columnWidths prop to List component Props type in browser-extension/src/options/components/common/list/list.tsx
- [X] T011 [US1] Replace flex-1 with explicit width styles in List header rendering in browser-extension/src/options/components/common/list/list.tsx
- [X] T012 [US1] Replace flex-1 with explicit width styles in List row cell rendering in browser-extension/src/options/components/common/list/list.tsx
- [X] T013 [US1] Add onColumnResize callback prop to List component in browser-extension/src/options/components/common/list/list.tsx
- [X] T014 [US1] Render ResizeHandle between column headers (except after last column) in browser-extension/src/options/components/common/list/list.tsx
- [X] T015 [US1] Implement mousedown handler in ResizeHandle to start resize in browser-extension/src/options/components/common/list/resizeHandle.tsx
- [X] T016 [US1] Implement document-level mousemove handler for drag tracking in browser-extension/src/options/components/common/list/resizeHandle.tsx
- [X] T017 [US1] Implement mouseup handler to complete resize in browser-extension/src/options/components/common/list/resizeHandle.tsx
- [X] T018 [US1] Enforce minimum width constraint during resize in browser-extension/src/hooks/useColumnWidths.ts
- [X] T019 [US1] Add overflow-x-auto to table container for horizontal scroll in browser-extension/src/options/components/common/list/list.tsx
- [X] T020 [US1] Wire useColumnWidths hook to RuleList component in browser-extension/src/options/components/ruleList/ruleList.tsx
- [X] T021 [US1] Pass columnWidths and onColumnResize to List from RuleList in browser-extension/src/options/components/ruleList/ruleList.tsx

**Checkpoint**: User Story 1 complete - columns can be resized interactively with minimum width enforcement

---

## Phase 4: User Story 2 - Persist Column Widths Across Sessions (Priority: P2)

**Goal**: Column width preferences are saved to browser storage and restored on page load

**Independent Test**: Resize columns, close tab, reopen All Rules, verify columns retain custom widths

### Implementation for User Story 2

- [X] T022 [US2] Add loadColumnWidths function using StorageService.get() in browser-extension/src/hooks/useColumnWidths.ts
- [X] T023 [US2] Add saveColumnWidths function using StorageService.set() in browser-extension/src/hooks/useColumnWidths.ts
- [X] T024 [US2] Load saved widths on hook initialization (useEffect) in browser-extension/src/hooks/useColumnWidths.ts
- [X] T025 [US2] Merge saved widths with defaults for forward compatibility in browser-extension/src/hooks/useColumnWidths.ts
- [X] T026 [US2] Save widths to storage on mouseup (after resize completes) in browser-extension/src/hooks/useColumnWidths.ts
- [X] T027 [US2] Handle storage unavailable gracefully (fallback to defaults) in browser-extension/src/hooks/useColumnWidths.ts

**Checkpoint**: User Story 2 complete - widths persist across browser sessions

---

## Phase 5: User Story 3 - Reset Columns to Default Widths (Priority: P3)

**Goal**: Users can double-click a resize handle to reset that column to its default width

**Independent Test**: Resize Name column, double-click its resize handle, verify it returns to default width

### Implementation for User Story 3

- [X] T028 [US3] Add onColumnReset callback prop to ResizeHandle component in browser-extension/src/options/components/common/list/resizeHandle.tsx
- [X] T029 [US3] Implement double-click detection on ResizeHandle in browser-extension/src/options/components/common/list/resizeHandle.tsx
- [X] T030 [US3] Add resetColumn function to useColumnWidths hook in browser-extension/src/hooks/useColumnWidths.ts
- [X] T031 [US3] Pass onColumnReset callback from List to ResizeHandle in browser-extension/src/options/components/common/list/list.tsx
- [X] T032 [US3] Persist reset width immediately to storage in browser-extension/src/hooks/useColumnWidths.ts

**Checkpoint**: User Story 3 complete - double-click resets individual columns to default

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Edge cases, refinements, and validation

- [X] T033 [P] Add cursor: col-resize style during active resize (document body) in browser-extension/src/options/components/common/list/resizeHandle.tsx
- [X] T034 [P] Prevent text selection during drag operation in browser-extension/src/options/components/common/list/resizeHandle.tsx
- [X] T035 [P] Add smooth transition for width changes (CSS transition) in browser-extension/src/options/components/common/list/list.tsx
- [X] T036 Validate all acceptance scenarios from spec.md manually
- [X] T037 Run quickstart.md validation steps

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-5)**: All depend on Foundational phase completion
  - US1 can proceed immediately after Foundational
  - US2 depends on US1 (needs resize to work before persistence matters)
  - US3 depends on US1 (needs resize handles to exist)
- **Polish (Phase 6)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Can start after US1 core resize works (T021) - Adds persistence layer
- **User Story 3 (P3)**: Can start after US1 ResizeHandle exists (T017) - Adds reset behavior

### Within Each User Story

- List component changes before RuleList integration
- Hook implementation before component wiring
- Core functionality before edge case handling

### Parallel Opportunities

- T002, T003, T004, T005 can run in parallel (different constants in same new file)
- T033, T034, T035 can run in parallel (different concerns, different code paths)
- After Foundational, US2 and US3 can be worked on in parallel once US1 T017 is complete

---

## Parallel Example: Phase 1 Setup

```bash
# Launch all constant definitions together:
Task: "Create ColumnWidthPreferences interface in browser-extension/src/utils/columnWidths.ts"
Task: "Add DEFAULT_COLUMN_WIDTHS constant in browser-extension/src/utils/columnWidths.ts"
Task: "Add MIN_COLUMN_WIDTHS constant in browser-extension/src/utils/columnWidths.ts"
Task: "Add COLUMN_FIELDS array constant in browser-extension/src/utils/columnWidths.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T005)
2. Complete Phase 2: Foundational (T006-T009)
3. Complete Phase 3: User Story 1 (T010-T021)
4. **STOP and VALIDATE**: Test column resize manually
5. Deploy/demo if ready - users can resize columns!

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → **MVP with interactive resize**
3. Add User Story 2 → Test independently → **Widths now persist**
4. Add User Story 3 → Test independently → **Reset via double-click**
5. Add Polish → Final validation → **Production ready**

### Single Developer Strategy

Recommended order for solo implementation:

1. T001 → T002-T005 (parallel) → T006-T009 (sequential)
2. T010-T021 (sequential, US1)
3. T022-T027 (sequential, US2)
4. T028-T032 (sequential, US3)
5. T033-T037 (polish)

---

## Notes

- [P] tasks = different files or independent code paths, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story is independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- No external dependencies - all implementation uses React hooks and native DOM events
