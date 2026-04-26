# Quickstart: Resizable Columns for All Rules Dashboard

**Feature**: 004-resizable-columns  
**Date**: 2026-04-26

## Overview

This feature adds resizable columns to the All Rules table in the browser extension options page. Users can drag column boundaries to adjust widths, and their preferences are persisted to browser storage.

## Key Files

| File | Purpose |
|------|---------|
| `browser-extension/src/options/components/common/list/list.tsx` | Main table component - add width props and resize handles |
| `browser-extension/src/options/components/common/list/resizeHandle.tsx` | **NEW** - Draggable resize handle component |
| `browser-extension/src/hooks/useColumnWidths.ts` | **NEW** - Hook for width state management and persistence |
| `browser-extension/src/utils/columnWidths.ts` | **NEW** - Constants for default/min widths |
| `browser-extension/src/options/components/ruleList/list.config.tsx` | Column configuration - add field to headers |
| `browser-extension/src/models/storageModel.ts` | Add `COLUMN_WIDTHS` storage key |

## Development Setup

```bash
# From repository root
cd browser-extension
npm install
npm run dev:chrome   # or dev:edge

# Load extension in browser
# Chrome: chrome://extensions → Load unpacked → select dist/chrome
```

## Testing the Feature

1. Open the extension options page (click extension icon → "Options")
2. Navigate to All Rules dashboard
3. Hover over column header boundaries - resize handle should appear
4. Drag to resize columns
5. Refresh page - widths should persist
6. Double-click resize handle - column should reset to default

## Implementation Order

1. **Storage** - Add `COLUMN_WIDTHS` to `StorageKey` enum
2. **Constants** - Create `columnWidths.ts` with defaults/minimums
3. **Hook** - Create `useColumnWidths` hook for state + persistence
4. **Component** - Create `ResizeHandle` component
5. **Integration** - Update `List` component to use widths
6. **Config** - Update `list.config.tsx` with field mapping on headers

## Code Patterns

### Using the Hook

```typescript
// In RuleList or parent component
const { columnWidths, handleResize, handleResetColumn } = useColumnWidths();

return (
  <List
    headers={LIST_HEADERS}
    items={LIST_ITEMS}
    data={rules}
    columnWidths={columnWidths}
    onColumnResize={handleResize}
    onColumnReset={handleResetColumn}
  />
);
```

### Resize Handle Usage

```typescript
// In List header rendering
{headers.map((header, index) => (
  <div key={header.field} style={{ width: columnWidths[header.field] }}>
    {header.render(sortState, onSort)}
    {index < headers.length - 1 && (
      <ResizeHandle
        columnField={header.field}
        onResize={onColumnResize}
        onReset={onColumnReset}
      />
    )}
  </div>
))}
```

## Debugging Tips

- Check `chrome.storage.local` via DevTools → Application → Storage
- Look for `columnWidths` key to verify persistence
- Console log in `useColumnWidths` hook to trace resize events
- Verify minimum widths are enforced (try dragging very small)
