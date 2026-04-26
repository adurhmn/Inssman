# Implementation Plan: Resizable Columns for All Rules Dashboard

**Branch**: `004-resizable-columns` | **Date**: 2026-04-26 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/004-resizable-columns/spec.md`

## Summary

Add resizable columns to the All Rules dashboard table in the browser extension options page. Users will be able to drag column boundaries to adjust widths, with preferences persisted to `chrome.storage.local` for session continuity. The implementation will enhance the existing `List` component with resize handles and width state management.

## Technical Context

**Language/Version**: TypeScript 5.3.x with React 18  
**Primary Dependencies**: React, react-router-dom, tailwind-merge  
**Storage**: `chrome.storage.local` via existing `StorageService`  
**Testing**: Manual testing via extension reload (existing pattern)  
**Target Platform**: Chrome/Edge browser extension (Manifest V3)  
**Project Type**: Browser extension (options page UI)  
**Performance Goals**: <100ms resize handle appearance, real-time visual feedback during drag  
**Constraints**: Must work within existing flex-based layout, no external dependencies preferred  
**Scale/Scope**: Single table (6 columns), single storage key for preferences

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Service-Oriented Architecture | ✓ Pass | Storage access via `StorageService` singleton |
| II. Message-Driven Communication | ✓ N/A | Feature is UI-only in options page context, no cross-context messaging needed |
| III. Dual Rule Execution Strategy | ✓ N/A | Not a rule type feature |
| IV. Storage as Source of Truth | ✓ Pass | Column preferences stored via `StorageService.set()` with new `StorageKey` |
| V. Type-Driven Rule Generation | ✓ N/A | Not a rule type feature |
| VI. Context Isolation Awareness | ✓ Pass | Runs only in options page context (full React app) |
| VII. Component Composition with HOCs | ✓ Pass | Enhances existing `List` component via composition |
| VIII. React Context for Cross-Cutting State | ✓ Consider | Column widths could use context if shared across components, but local state sufficient for single table |

**MV3 Compliance**: ✓ Pass - No background page requirements, uses approved storage APIs

**Gate Result**: PASS - No violations. Proceed to Phase 0.

## Project Structure

### Documentation (this feature)

```text
specs/004-resizable-columns/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
└── tasks.md             # Phase 2 output (created by /speckit.tasks)
```

### Source Code (repository root)

```text
browser-extension/src/
├── models/
│   └── storageModel.ts          # Add COLUMN_WIDTHS to StorageKey enum
├── options/components/
│   ├── common/
│   │   └── list/
│   │       ├── list.tsx         # Enhance with resize handles and width props
│   │       └── resizeHandle.tsx # NEW: Resize handle component
│   └── ruleList/
│       └── list.config.tsx      # Add default widths to column config
├── hooks/
│   └── useColumnWidths.ts       # NEW: Custom hook for width state + persistence
└── utils/
    └── columnWidths.ts          # NEW: Default widths, min widths, storage helpers
```

**Structure Decision**: Enhances existing component structure. New files are minimal and focused:
- One new component (`resizeHandle.tsx`)
- One new hook (`useColumnWidths.ts`)
- One new utility file (`columnWidths.ts`)
- Updates to existing files (`list.tsx`, `list.config.tsx`, `storageModel.ts`)

## Complexity Tracking

> No violations - section not applicable.
