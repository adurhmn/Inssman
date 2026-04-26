# Research: Sort Rules

**Feature**: 002-sort-rules  
**Date**: April 25, 2026

## Research Tasks

### 1. Sorting Algorithm Selection

**Decision**: Use JavaScript's native `Array.prototype.sort()` with custom comparator functions

**Rationale**:
- Built-in sort is stable in modern browsers (ECMAScript 2019+)
- Sufficient performance for expected data sizes (< 1000 rules)
- No external library dependency needed
- Familiarity for maintainers

**Alternatives Considered**:
- lodash `_.orderBy`: Rejected - adds dependency for simple use case
- Custom quicksort: Rejected - unnecessary complexity, native sort is optimized

### 2. Sort State Management

**Decision**: Use React `useState` hook within RuleList component

**Rationale**:
- Sort state is ephemeral (doesn't need persistence)
- Scoped to single component - no need for Context
- Simple to implement and test
- Follows existing component patterns in codebase

**Alternatives Considered**:
- React Context: Rejected - overkill for single-component state
- URL query params: Rejected - not needed; user doesn't need to share sorted views
- localStorage persistence: Rejected - sort preference doesn't need to persist across sessions

### 3. Sort UI Pattern

**Decision**: Clickable column header with tri-state toggle (unsorted → ascending → descending → unsorted)

**Rationale**:
- Familiar pattern from spreadsheets and data tables
- Minimal UI footprint - no additional controls needed
- Single click interaction
- Clear visual feedback via sort indicator icons

**Alternatives Considered**:
- Dropdown menu per column: Rejected - more clicks, more UI complexity
- Separate sort controls row: Rejected - takes vertical space, less intuitive
- Sort button outside table: Rejected - disconnected from column context

### 4. Sort Indicator Icons

**Decision**: Use existing `arrowUpLong` and `arrowDownLong` icons from `@assets/icons`

**Rationale**:
- Icons already exist in the codebase
- Consistent with existing visual language
- Clear directionality (up = ascending, down = descending)

**Alternatives Considered**:
- Add new chevron icons: Rejected - unnecessary when arrows exist
- Text labels ("A-Z", "Z-A"): Rejected - takes more space, harder to localize

### 5. Null Value Handling for Last Matched

**Decision**: Treat null/undefined `lastMatchedTimestamp` as maximum value for ascending sort (appears last), minimum value for descending sort (appears first)

**Rationale**:
- Matches spec requirement: "Rules with no Last Matched value should appear at the end when sorting ascending, and at the beginning when sorting descending"
- Intuitive: unmatched rules are "never matched" = infinitely old or not yet relevant
- Common convention in data applications

**Implementation**:
```typescript
// In sort comparator
const aValue = a.lastMatchedTimestamp ?? (direction === 'asc' ? Infinity : -Infinity);
const bValue = b.lastMatchedTimestamp ?? (direction === 'asc' ? Infinity : -Infinity);
```

### 6. Case-Insensitive Name Sorting

**Decision**: Use `localeCompare` with case-insensitive option

**Rationale**:
- Spec requires case-insensitive sorting
- `localeCompare` handles international characters correctly
- Native browser support

**Implementation**:
```typescript
a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
```

### 7. Integration with Existing Filter

**Decision**: Apply sort AFTER search filter

**Rationale**:
- Current code: `filter().reverse()`
- New code: `filter().sort().reverse()` or just `filter().sort()` (remove hardcoded reverse)
- Sorting a smaller filtered set is more performant
- User expects to see filtered results in sorted order

**Note**: The current `.reverse()` in RuleList appears to be for displaying newest rules first. The sort feature will replace this behavior when a sort is active.

## Technical Findings

### Existing Code Analysis

1. **List Component** (`list.tsx`): 
   - `ListHeader` type needs extension for sort configuration
   - Header render function can be enhanced to include sort controls
   - No breaking changes to existing API needed

2. **RuleList Component** (`ruleList.tsx`):
   - Currently applies `.reverse()` to show newest first
   - Will add sort state and pass sorted data to List
   - Existing filter logic remains unchanged

3. **list.config.tsx**:
   - Headers defined as static array
   - Will update Name and Last Matched headers to include sort controls
   - Other headers remain unchanged

### Dependencies

No new npm dependencies required. All functionality achievable with:
- React hooks (useState)
- Native Array.sort()
- Existing icon components
- tailwind-merge for styling

## Resolved Clarifications

All technical decisions made. No outstanding clarifications needed.
