# Research: Search Enhancement

**Feature**: 003-search-enhancement  
**Date**: 2026-04-26

## Research Summary

This feature has minimal technical unknowns. The implementation is straightforward client-side string filtering with well-established JavaScript patterns.

## Decisions

### 1. Case-Insensitive Comparison Method

**Decision**: Use `toLowerCase()` on both search term and target fields

**Rationale**: 
- Native JavaScript method with no dependencies
- Consistent behavior across all browsers
- Negligible performance impact (string normalization is O(n))
- Simpler than locale-aware `localeCompare()` which is overkill for URL/domain matching

**Alternatives Considered**:
- `toUpperCase()`: Equivalent behavior; `toLowerCase()` is more common convention
- `localeCompare()` with sensitivity option: Unnecessary complexity for technical strings (URLs, rule names)
- Regular expressions with `i` flag: More overhead for simple substring matching

### 2. Multi-Field Matching Strategy

**Decision**: Check each field sequentially with early return on first match (OR logic)

**Rationale**:
- Simplest implementation: `name.includes(term) || source.includes(term)`
- Early return optimizes for common case (match found in first field)
- No need for scoring or ranking since all matches are displayed equally

**Alternatives Considered**:
- Build combined search string (e.g., `${name} ${source}`): Creates unnecessary intermediate strings
- Parallel field checking: Overcomplicated for 2 fields

### 3. Source Field Access Pattern

**Decision**: Iterate through `conditions` array and check each `source` value

**Rationale**:
- Rules can have multiple conditions, each with its own source
- Match if ANY condition's source matches (consistent with OR logic for multi-column)
- Data structure from `IRuleMetaData.conditions: { matchType: string; source: string }[]`

**Implementation Pattern**:
```typescript
conditions.some(condition => 
  condition.source.toLowerCase().includes(searchLower)
)
```

### 4. Empty/Whitespace Search Handling

**Decision**: Trim search input and treat empty/whitespace-only as "show all"

**Rationale**:
- Matches user expectation that clearing search shows all rules
- `trim()` handles edge cases like accidental spaces
- Current behavior already shows all rules when search is empty

### 5. Special Characters Handling

**Decision**: Treat all characters as literals (no regex interpretation)

**Rationale**:
- `String.includes()` already treats characters literally
- URLs commonly contain `.`, `?`, `*`, `&` - these should match exactly
- No special escaping needed with `includes()` method

## Performance Analysis

**Current Implementation**: O(n) where n = number of rules
**New Implementation**: O(n × m) where m = average conditions per rule

For 500 rules with 2 conditions each:
- Worst case: 500 × 2 = 1000 string comparisons
- Each comparison: ~1-10μs (depending on string length)
- Total: <10ms (well under 100ms target)

**Conclusion**: No performance concerns.

## Existing Code Analysis

### Current Filter Logic
**File**: `browser-extension/src/options/components/ruleList/ruleList.tsx` (line 51-54)

```typescript
const filteredList = sortRules(
  rules.filter((ruleMetaData) => ruleMetaData.name.includes(search)),
  sortState
);
```

### Data Structure
**File**: `browser-extension/src/models/formFieldModel.tsx` (line 30-56)

```typescript
type IRuleMetaData = {
  name: string;
  conditions: {
    matchType: string;
    source: string;
  }[];
  // ... other fields
};
```

### Search Input Placeholder
**File**: `browser-extension/src/options/components/main/main.tsx` (line 157)

```typescript
placeholder="Search By Rule Name"
```

Should be updated to reflect multi-column search capability.

## No Outstanding Clarifications

All technical decisions resolved. Ready for Phase 1 design.
