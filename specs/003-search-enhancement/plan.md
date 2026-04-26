# Implementation Plan: Search Enhancement

**Branch**: `003-search-enhancement` | **Date**: 2026-04-26 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/003-search-enhancement/spec.md`

## Summary

Enhance the rule search functionality to support case-insensitive matching across both Name and Source columns. Currently, search is case-sensitive and limited to the Name field only. The implementation requires modifying the filter logic in `ruleList.tsx` to normalize case and check against multiple fields using OR logic.

## Technical Context

**Language/Version**: TypeScript 5.3.x with React 18  
**Primary Dependencies**: React, react-router-dom, tailwind-merge  
**Storage**: N/A (search is client-side filtering of in-memory data)  
**Testing**: No test framework currently configured  
**Target Platform**: Chrome/Edge browser extension (Manifest V3)  
**Project Type**: Browser extension  
**Performance Goals**: Search results within 100ms for up to 500 rules  
**Constraints**: Must maintain real-time filtering as user types  
**Scale/Scope**: Typical rule count is <100 rules; max expected ~500

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Compliance | Notes |
|-----------|------------|-------|
| I. Service-Oriented Architecture | ✅ Pass | No service changes needed; this is UI filtering logic |
| II. Message-Driven Communication | ✅ Pass | No message protocol changes; data already fetched via existing messages |
| III. Dual Rule Execution Strategy | ✅ Pass | Not applicable; search is UI-only |
| IV. Storage as Source of Truth | ✅ Pass | No storage changes; filtering operates on fetched data |
| V. Type-Driven Rule Generation | ✅ Pass | No rule type changes |
| VI. Context Isolation Awareness | ✅ Pass | Change is in options page React context only |
| VII. Component Composition with HOCs | ✅ Pass | Modifying existing component, preserving patterns |
| VIII. React Context for Cross-Cutting State | ✅ Pass | Search state already managed via useState in parent |

**Gate Result**: ✅ PASSED - No violations

### Post-Design Re-Check

| Principle | Compliance | Notes |
|-----------|------------|-------|
| I. Service-Oriented Architecture | ✅ Pass | No service changes in design |
| II. Message-Driven Communication | ✅ Pass | No message changes needed |
| III. Dual Rule Execution Strategy | ✅ Pass | Not applicable |
| IV. Storage as Source of Truth | ✅ Pass | No storage changes |
| V. Type-Driven Rule Generation | ✅ Pass | No type changes |
| VI. Context Isolation Awareness | ✅ Pass | Options page only |
| VII. Component Composition with HOCs | ✅ Pass | Existing component modified |
| VIII. React Context for Cross-Cutting State | ✅ Pass | No context changes |

**Post-Design Gate Result**: ✅ PASSED

## Project Structure

### Documentation (this feature)

```text
specs/003-search-enhancement/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
└── checklists/
    └── requirements.md  # Spec validation checklist
```

### Source Code (repository root)

```text
browser-extension/src/
├── options/
│   └── components/
│       ├── main/
│       │   └── main.tsx           # Search input & placeholder text
│       └── ruleList/
│           └── ruleList.tsx       # Filter logic (PRIMARY CHANGE)
└── models/
    └── formFieldModel.tsx         # IRuleMetaData type definition (reference only)
```

**Structure Decision**: Single-file change in `ruleList.tsx` for filter logic. Placeholder text update in `main.tsx`. No new files needed.

## Complexity Tracking

> No violations - section not applicable
