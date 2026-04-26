# Data Model: Resizable Columns for All Rules Dashboard

**Feature**: 004-resizable-columns  
**Date**: 2026-04-26

## Entities

### ColumnWidthPreferences

Represents the persisted column width configuration for the All Rules table.

**Storage Location**: `chrome.storage.local` via `StorageService`  
**Storage Key**: `StorageKey.COLUMN_WIDTHS` (value: `"columnWidths"`)

**Schema**:

```typescript
interface ColumnWidthPreferences {
  name: number;              // Width in pixels for Name column
  pageType: number;          // Width in pixels for Type column
  source: number;            // Width in pixels for Source column
  lastMatchedTimestamp: number; // Width in pixels for Last Matched column
  enabled: number;           // Width in pixels for Status column
  actions: number;           // Width in pixels for Actions column
}
```

**Field Constraints**:
| Field | Type | Min Value | Default Value | Notes |
|-------|------|-----------|---------------|-------|
| name | number | 80 | 200 | Matches `LIST_ITEMS[0].field` |
| pageType | number | 60 | 120 | Matches `LIST_ITEMS[1].field` |
| source | number | 80 | 180 | Matches `LIST_ITEMS[2].field` |
| lastMatchedTimestamp | number | 100 | 140 | Matches `LIST_ITEMS[3].field` |
| enabled | number | 60 | 80 | Matches `LIST_ITEMS[4].field` |
| actions | number | 100 | 120 | Matches `LIST_ITEMS[5].field` |

**Validation Rules**:
- All values must be positive integers
- All values must be >= minimum width for that column
- Missing fields fallback to default values (forward compatibility)

### ColumnConfig (Enhanced)

Enhancement to existing `ListHeader` and `ListItems` types to support width configuration.

**Location**: `browser-extension/src/options/components/common/list/list.tsx`

**Enhanced Types**:

```typescript
export type ListHeader = {
  title: string;
  field: string;              // NEW: Links header to column for width lookup
  render: (sortState?: SortState | null, onSort?: (column: SortColumn) => void) => any;
  classes?: string;
  sortable?: boolean;
  sortKey?: SortColumn;
  minWidth?: number;          // NEW: Minimum resize width
  defaultWidth?: number;      // NEW: Initial width before customization
};

export type ListItems = {
  field: string;
  render: (value: any, item?: any) => any;
  classes?: string;
  minWidth?: number;          // NEW: Minimum resize width (mirrors header)
  defaultWidth?: number;      // NEW: Initial width (mirrors header)
};
```

### ResizeState (Runtime)

Runtime state for tracking active resize operations. Not persisted.

**Location**: `useColumnWidths` hook internal state

```typescript
interface ResizeState {
  isResizing: boolean;
  columnField: string | null;  // Which column is being resized
  startX: number;              // Mouse X position at drag start
  startWidth: number;          // Column width at drag start
}
```

## State Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        Page Load                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  StorageService.get(COLUMN_WIDTHS)                              │
│  ├─ Found? → Use stored widths                                  │
│  └─ Not found? → Use DEFAULT_COLUMN_WIDTHS                      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  useColumnWidths hook initializes state                         │
│  columnWidths: ColumnWidthPreferences                           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  List renders with explicit widths                              │
│  <div style={{ width: columnWidths[field] }}>                   │
└─────────────────────────────────────────────────────────────────┘


┌─────────────────────────────────────────────────────────────────┐
│                     User Resize Action                           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  mousedown on ResizeHandle                                       │
│  → Set resizeState: { isResizing: true, columnField, startX }   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  mousemove (document level)                                      │
│  → Calculate delta = currentX - startX                          │
│  → newWidth = max(minWidth, startWidth + delta)                 │
│  → Update columnWidths[columnField] in state                    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  mouseup (document level)                                        │
│  → Clear resizeState                                            │
│  → StorageService.set({ [COLUMN_WIDTHS]: columnWidths })        │
└─────────────────────────────────────────────────────────────────┘


┌─────────────────────────────────────────────────────────────────┐
│                     Double-Click Reset                           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  dblclick on ResizeHandle                                        │
│  → columnWidths[columnField] = DEFAULT_COLUMN_WIDTHS[columnField]│
│  → StorageService.set({ [COLUMN_WIDTHS]: columnWidths })        │
└─────────────────────────────────────────────────────────────────┘
```

## Storage Schema Changes

### StorageKey Enum Addition

**File**: `browser-extension/src/models/storageModel.ts`

```typescript
export enum StorageKey {
  USER_ID = "userId",
  NEXT_ID = "nextId",
  EXTENSION_STATUS = "extensionStatus",
  CONFIG = "config",           // deprecated
  COLUMN_WIDTHS = "columnWidths",  // NEW
}
```

## Constants

**File**: `browser-extension/src/utils/columnWidths.ts`

```typescript
export const DEFAULT_COLUMN_WIDTHS: ColumnWidthPreferences = {
  name: 200,
  pageType: 120,
  source: 180,
  lastMatchedTimestamp: 140,
  enabled: 80,
  actions: 120,
};

export const MIN_COLUMN_WIDTHS: ColumnWidthPreferences = {
  name: 80,
  pageType: 60,
  source: 80,
  lastMatchedTimestamp: 100,
  enabled: 60,
  actions: 100,
};

export const COLUMN_FIELDS = [
  'name',
  'pageType', 
  'source',
  'lastMatchedTimestamp',
  'enabled',
  'actions',
] as const;

export type ColumnField = typeof COLUMN_FIELDS[number];
```

## Migration

No data migration required. The feature is additive:
- If `COLUMN_WIDTHS` key doesn't exist → use defaults
- If `COLUMN_WIDTHS` key exists with partial fields → merge with defaults
- Existing storage data is untouched
