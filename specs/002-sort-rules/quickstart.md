# Quickstart: Sort Rules

**Feature**: 002-sort-rules  
**Date**: April 25, 2026

## Overview

Add sorting functionality to the All Rules dashboard table for Name and Last Matched columns.

## Files to Create

### 1. `browser-extension/src/models/sortModel.ts`

New file containing sort-related type definitions.

```typescript
export type SortColumn = 'name' | 'lastMatchedTimestamp';
export type SortDirection = 'asc' | 'desc';

export type SortState = {
  column: SortColumn | null;
  direction: SortDirection;
};
```

### 2. `browser-extension/src/utils/sortRules.ts`

New file containing the sorting logic.

```typescript
import { IRuleMetaData } from '@models/formFieldModel';
import { SortState, SortColumn, SortDirection } from '@models/sortModel';

export function sortRules(
  rules: IRuleMetaData[],
  sortState: SortState | null
): IRuleMetaData[] {
  if (!sortState || !sortState.column) {
    return rules;
  }

  const { column, direction } = sortState;
  const sorted = [...rules].sort((a, b) => {
    const result = compareByColumn(a, b, column, direction);
    return direction === 'asc' ? result : -result;
  });

  return sorted;
}

function compareByColumn(
  a: IRuleMetaData,
  b: IRuleMetaData,
  column: SortColumn,
  direction: SortDirection
): number {
  switch (column) {
    case 'name':
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    
    case 'lastMatchedTimestamp':
      const aVal = a.lastMatchedTimestamp ?? (direction === 'asc' ? Infinity : -Infinity);
      const bVal = b.lastMatchedTimestamp ?? (direction === 'asc' ? Infinity : -Infinity);
      return aVal - bVal;
    
    default:
      return 0;
  }
}

export function getNextSortState(
  currentState: SortState | null,
  clickedColumn: SortColumn
): SortState | null {
  const defaultDirection: Record<SortColumn, SortDirection> = {
    name: 'asc',
    lastMatchedTimestamp: 'desc',
  };

  // Different column clicked - start fresh with default direction
  if (!currentState || currentState.column !== clickedColumn) {
    return { column: clickedColumn, direction: defaultDirection[clickedColumn] };
  }

  // Same column clicked - cycle through states
  if (currentState.direction === defaultDirection[clickedColumn]) {
    // Default -> Opposite
    return { 
      column: clickedColumn, 
      direction: currentState.direction === 'asc' ? 'desc' : 'asc' 
    };
  }

  // Opposite -> No sort
  return null;
}
```

### 3. `browser-extension/src/options/components/common/sortIndicator/sortIndicator.tsx`

New component for displaying sort state.

```typescript
import { FC } from 'react';
import Icon from '@options/components/common/icon/icon';
import { SortDirection } from '@models/sortModel';

type Props = {
  direction: SortDirection | null;
  onClick: () => void;
};

const SortIndicator: FC<Props> = ({ direction, onClick }) => {
  return (
    <button
      onClick={onClick}
      className="ml-1 p-1 hover:bg-slate-600 rounded transition-colors inline-flex items-center"
      aria-label={`Sort ${direction === 'asc' ? 'ascending' : direction === 'desc' ? 'descending' : 'none'}`}
    >
      {direction === 'asc' && <Icon name="arrowUpLong" className="w-4 text-sky-400" />}
      {direction === 'desc' && <Icon name="arrowDownLong" className="w-4 text-sky-400" />}
      {!direction && <Icon name="arrowUpLong" className="w-4 opacity-30" />}
    </button>
  );
};

export default SortIndicator;
```

## Files to Modify

### 1. `browser-extension/src/options/components/common/list/list.tsx`

Extend `ListHeader` type:

```typescript
export type ListHeader = {
  title: string;
  render: (sortState?: any, onSort?: (key: string) => void) => any;
  classes?: string;
  sortable?: boolean;
  sortKey?: string;
};
```

Update header rendering to pass sort props.

### 2. `browser-extension/src/options/components/ruleList/ruleList.tsx`

Add sort state management:

```typescript
import { useState } from 'react';
import { sortRules, getNextSortState } from '@/utils/sortRules';
import { SortState, SortColumn } from '@models/sortModel';

// Inside component:
const [sortState, setSortState] = useState<SortState | null>(null);

const handleSort = (column: SortColumn) => {
  setSortState(getNextSortState(sortState, column));
};

// Update filteredList:
const filteredList = sortRules(
  rules.filter((ruleMetaData) => ruleMetaData.name.includes(search)),
  sortState
);
// Remove .reverse() - sort handles ordering now
```

### 3. `browser-extension/src/options/components/ruleList/list.config.tsx`

Update Name and Last Matched headers to include sort controls:

```typescript
import SortIndicator from '@options/components/common/sortIndicator/sortIndicator';

export const LIST_HEADERS: ListHeader[] = [
  {
    title: "Name",
    sortable: true,
    sortKey: "name",
    render: function (sortState, onSort) {
      const direction = sortState?.column === 'name' ? sortState.direction : null;
      return (
        <span className="flex items-center">
          {this.title}
          <SortIndicator direction={direction} onClick={() => onSort?.('name')} />
        </span>
      );
    },
  },
  // ... Type, Source unchanged ...
  {
    title: "Last Matched",
    sortable: true,
    sortKey: "lastMatchedTimestamp",
    render: function (sortState, onSort) {
      const direction = sortState?.column === 'lastMatchedTimestamp' ? sortState.direction : null;
      return (
        <span className="flex items-center">
          {this.title}
          <sup className="inline-block text-xs text-red-500 bottom-4">Beta</sup>
          <SortIndicator direction={direction} onClick={() => onSort?.('lastMatchedTimestamp')} />
        </span>
      );
    },
  },
  // ... Status, Actions unchanged ...
];
```

## Testing Checklist

1. **Name Sort**
   - [ ] Click Name header → sorts A-Z
   - [ ] Click again → sorts Z-A
   - [ ] Click again → returns to default order

2. **Last Matched Sort**
   - [ ] Click Last Matched header → sorts most recent first
   - [ ] Click again → sorts oldest first
   - [ ] Click again → returns to default order

3. **Single Active Sort**
   - [ ] With Name sorted, click Last Matched → only Last Matched sorted
   - [ ] Visual indicator only shows on active column

4. **Edge Cases**
   - [ ] Empty list shows no errors
   - [ ] Single rule shows no errors
   - [ ] Rules with same name maintain relative order
   - [ ] Rules with null Last Matched appear correctly

5. **Filter Integration**
   - [ ] Search filter + sort work together correctly
