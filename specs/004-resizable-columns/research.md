# Research: Resizable Columns for All Rules Dashboard

**Feature**: 004-resizable-columns  
**Date**: 2026-04-26

## Research Areas

### 1. Column Resize Implementation Strategy

**Decision**: Pure CSS/React implementation with mouse event handlers

**Rationale**:
- The existing `List` component uses flex layout with `flex-1` for equal column distribution
- Converting to explicit pixel widths allows precise control
- Native mouse events (`mousedown`, `mousemove`, `mouseup`) provide smooth drag behavior
- No external library needed - reduces bundle size and dependency maintenance

**Alternatives Considered**:
- **react-resizable-panels**: Overkill for a simple table; designed for complex panel layouts
- **react-table with resize plugin**: Would require rewriting the entire table structure
- **CSS resize property**: Only works on block elements, not suitable for table columns

**Implementation Approach**:
1. Replace `flex-1` with explicit `width` styles on header and row cells
2. Add invisible resize handle divs at column boundaries (right edge of each header)
3. Track drag state and calculate delta from initial mouse position
4. Update column width in real-time during drag
5. Persist final width on `mouseup`

### 2. Width Persistence Strategy

**Decision**: Store as JSON object in `chrome.storage.local` via `StorageService`

**Rationale**:
- Consistent with constitution principle IV (Storage as Source of Truth)
- Uses existing `StorageService` singleton pattern
- Single storage key for all column widths (atomic read/write)
- JSON object allows easy extension for future columns

**Storage Key**: `COLUMN_WIDTHS` added to `StorageKey` enum

**Data Format**:
```typescript
{
  "columnWidths": {
    "name": 200,
    "pageType": 120,
    "source": 150,
    "lastMatchedTimestamp": 140,
    "enabled": 80,
    "actions": 120
  }
}
```

**Alternatives Considered**:
- **localStorage**: Not accessible from service worker; would break if needed later
- **Individual keys per column**: More storage operations, harder to manage atomically
- **IndexedDB**: Overkill for simple key-value preferences

### 3. Resize Handle UX Pattern

**Decision**: Hover-activated vertical separator with cursor change

**Rationale**:
- Standard pattern used in Excel, database tools, browser DevTools
- Minimal visual footprint when not in use
- Clear affordance through cursor change (`col-resize`)
- Highlight on hover provides discoverability

**Visual Design**:
- **Default state**: Invisible 8px wide hit area at column boundary
- **Hover state**: 2px wide highlighted separator (sky-500 to match theme)
- **Active/dragging state**: Separator remains highlighted, cursor locked to `col-resize`

**Alternatives Considered**:
- **Always-visible separators**: Adds visual noise to clean table design
- **Drag handle icon**: Takes up space, unfamiliar pattern for tables
- **Context menu resize**: Hidden functionality, poor discoverability

### 4. Minimum Column Width Strategy

**Decision**: Per-column minimum widths based on content type

**Rationale**:
- Different columns have different minimum usable widths
- Header text should remain at least partially visible
- Prevents columns from becoming completely collapsed

**Minimum Widths**:
| Column | Min Width | Reasoning |
|--------|-----------|-----------|
| Name | 80px | Shows truncated name with ellipsis |
| Type | 60px | Shows icon at minimum |
| Source | 80px | Shows truncated URL |
| Last Matched | 100px | Shows abbreviated time |
| Status | 60px | Shows toggle switch |
| Actions | 100px | Shows all 3 action icons |

**Default Widths** (initial state):
| Column | Default Width |
|--------|---------------|
| Name | 200px |
| Type | 120px |
| Source | 180px |
| Last Matched | 140px |
| Status | 80px |
| Actions | 120px |

### 5. Table Layout Strategy

**Decision**: Fixed table width with horizontal scroll when columns exceed viewport

**Rationale**:
- User explicitly wants to see full content by widening columns
- Horizontal scroll is standard behavior for wide tables
- Simpler implementation than proportional redistribution

**Behavior**:
- Table container has `overflow-x: auto`
- Sum of column widths determines table width
- If sum exceeds viewport, horizontal scrollbar appears
- Column widths are absolute pixels, not percentages

**Alternatives Considered**:
- **Proportional resize**: Shrinking adjacent columns creates unpredictable behavior
- **Fixed table width with redistribution**: Frustrating UX when widening one column shrinks others
- **Minimum table width constraint**: Prevents users from seeing full content

### 6. Reset Functionality

**Decision**: Double-click on resize handle resets that single column to default width

**Rationale**:
- Standard pattern in spreadsheets and table components
- Low friction - doesn't require additional UI elements
- Column-specific reset is more useful than all-column reset
- Easily discoverable through exploration

**Implementation**:
- Track double-click on resize handle
- Reset only the column to the left of the handle
- Persist the reset width immediately

## Dependencies

No new external dependencies required. Implementation uses:
- React hooks (useState, useEffect, useCallback)
- Native DOM events (mousedown, mousemove, mouseup)
- Existing `StorageService` for persistence
- Existing Tailwind classes for styling

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Performance lag during drag | Low | Medium | Use `requestAnimationFrame` for smooth updates |
| Storage quota exceeded | Very Low | Low | Column widths are <1KB total |
| Conflict with row hover styles | Low | Low | Z-index management on resize handle |
| Touch device compatibility | Medium | Low | Out of scope per spec (desktop browser extension) |

## Open Questions (Resolved)

All research questions have been resolved. No blockers for implementation.
