# Implementation Plan: Sort Rules

**Branch**: `002-sort-rules` | **Date**: April 25, 2026 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/002-sort-rules/spec.md`

## Summary

Add sorting functionality to the All Rules dashboard table, enabling users to sort by Name (alphabetically) and Last Matched (by date). Only one sort criterion can be active at a time, with visual indicators showing the current sort state.

## Technical Context

**Language/Version**: TypeScript 5.x with React 18  
**Primary Dependencies**: React, tailwind-merge, react-router-dom  
**Storage**: chrome.storage.local (via StorageService)  
**Testing**: Manual testing via extension DevTools  
**Target Platform**: Chrome/Edge browser extension (Manifest V3)  
**Project Type**: Browser extension with React options page  
**Performance Goals**: Sort operation < 100ms for typical rule sets (< 1000 rules)  
**Constraints**: Client-side sorting only; must maintain existing List component API compatibility  
**Scale/Scope**: Typical user has 10-50 rules; edge case up to 1000 rules

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Service-Oriented Architecture | ✅ N/A | No new services required; sorting is UI-only |
| II. Message-Driven Communication | ✅ N/A | No new message types; using existing data flow |
| III. Dual Rule Execution Strategy | ✅ N/A | Feature is UI-only, does not affect rule execution |
| IV. Storage as Source of Truth | ✅ Pass | No storage changes; sort state is ephemeral UI state |
| V. Type-Driven Rule Generation | ✅ N/A | No new rule types |
| VI. Context Isolation Awareness | ✅ Pass | Feature lives entirely in options page context |
| VII. Component Composition with HOCs | ✅ Pass | Will extend existing List/RuleList pattern |
| VIII. React Context for Cross-Cutting State | ✅ Pass | Sort state is local to RuleList; no context needed |

**Gate Result**: ✅ PASS - No violations. Feature is a straightforward UI enhancement.

## Project Structure

### Documentation (this feature)

```text
specs/002-sort-rules/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
└── contracts/           # Phase 1 output (N/A - no external interfaces)
```

### Source Code (repository root)

```text
browser-extension/src/
├── options/components/
│   ├── common/
│   │   └── list/
│   │       └── list.tsx           # Extend ListHeader type for sort config
│   ├── ruleList/
│   │   ├── ruleList.tsx           # Add sort state management
│   │   └── list.config.tsx        # Update headers with sort controls
│   └── common/sortIndicator/
│       └── sortIndicator.tsx      # NEW: Sort indicator component
├── utils/
│   └── sortRules.ts               # NEW: Sorting utility functions
└── models/
    └── sortModel.ts               # NEW: Sort state types
```

**Structure Decision**: Minimal footprint approach - add sort state to existing RuleList component, create reusable sort indicator and utility. No new services or context providers needed.

## Complexity Tracking

> No violations requiring justification.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| (none) | - | - |
