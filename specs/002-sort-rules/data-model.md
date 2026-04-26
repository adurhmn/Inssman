# Data Model: Sort Rules

**Feature**: 002-sort-rules  
**Date**: April 25, 2026

## New Types

### SortColumn

Enum representing sortable columns.

```typescript
type SortColumn = 'name' | 'lastMatchedTimestamp';
```

### SortDirection

Enum representing sort direction.

```typescript
type SortDirection = 'asc' | 'desc';
```

### SortState

Represents the current sorting configuration. When `column` is null, no sorting is applied.

```typescript
type SortState = {
  column: SortColumn | null;
  direction: SortDirection;
} | null;
```

**States**:
- `null` or `{ column: null, ... }`: No active sort (default order)
- `{ column: 'name', direction: 'asc' }`: Sorted by name A-Z
- `{ column: 'name', direction: 'desc' }`: Sorted by name Z-A
- `{ column: 'lastMatchedTimestamp', direction: 'asc' }`: Sorted by oldest match first
- `{ column: 'lastMatchedTimestamp', direction: 'desc' }`: Sorted by most recent match first

## Extended Types

### ListHeader (extended)

Extended from existing type in `list.tsx` to support sort configuration.

```typescript
export type ListHeader = {
  title: string;
  render: () => any;
  classes?: string;
  // New optional properties
  sortable?: boolean;
  sortKey?: SortColumn;
};
```

**Validation**:
- If `sortable` is true, `sortKey` must be provided
- `sortKey` must match a field in `IRuleMetaData`

## Existing Types (No Changes)

### IRuleMetaData

No changes to existing type. Relevant fields for sorting:

| Field | Type | Sort Behavior |
|-------|------|---------------|
| `name` | `string` | Case-insensitive alphabetical |
| `lastMatchedTimestamp` | `number \| null` | Numeric comparison; null handled specially |

## State Transitions

### Sort Toggle State Machine

```
[No Sort] --(click Name)--> [Name ASC]
[Name ASC] --(click Name)--> [Name DESC]
[Name DESC] --(click Name)--> [No Sort]

[No Sort] --(click Last Matched)--> [Last Matched DESC]
[Last Matched DESC] --(click Last Matched)--> [Last Matched ASC]
[Last Matched ASC] --(click Last Matched)--> [No Sort]

[Any Sort] --(click different column)--> [New Column default direction]
```

**Default Directions**:
- Name: Ascending first (A-Z is most natural)
- Last Matched: Descending first (most recent is most useful)

## Storage

Sort state is **not persisted**. It is ephemeral React component state that resets when:
- User navigates away from All Rules page
- User refreshes the page
- Extension reloads

This is intentional - sort preference is a transient UI state, not user data.
