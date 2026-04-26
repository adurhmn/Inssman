# Quickstart: Search Enhancement

**Feature**: 003-search-enhancement  
**Date**: 2026-04-26

## Overview

Enhance rule search to be case-insensitive and match against both Name and Source columns.

## Files to Modify

| File | Change |
|------|--------|
| `browser-extension/src/options/components/ruleList/ruleList.tsx` | Update filter logic |
| `browser-extension/src/options/components/main/main.tsx` | Update placeholder text |

## Implementation

### 1. Update Filter Logic (ruleList.tsx)

**Location**: Line 51-54

**Before**:
```typescript
const filteredList = sortRules(
  rules.filter((ruleMetaData) => ruleMetaData.name.includes(search)),
  sortState
);
```

**After**:
```typescript
const filteredList = sortRules(
  rules.filter((ruleMetaData) => {
    const searchLower = search.toLowerCase().trim();
    if (!searchLower) return true;
    
    const nameMatches = ruleMetaData.name.toLowerCase().includes(searchLower);
    const sourceMatches = ruleMetaData.conditions.some(
      (condition) => condition.source.toLowerCase().includes(searchLower)
    );
    
    return nameMatches || sourceMatches;
  }),
  sortState
);
```

### 2. Update Placeholder Text (main.tsx)

**Location**: Line 157

**Before**:
```typescript
placeholder="Search By Rule Name"
```

**After**:
```typescript
placeholder="Search by Name or Source"
```

## Testing

### Manual Test Cases

1. **Case-insensitive name search**
   - Create rule named "BlockAds"
   - Search "blockads" → should find rule
   - Search "BLOCKADS" → should find rule

2. **Source search**
   - Create rule with source "example.com"
   - Search "example" → should find rule
   - Search "EXAMPLE" → should find rule (case-insensitive)

3. **OR logic**
   - Create Rule A with name "APIProxy", source "localhost"
   - Create Rule B with name "TestRule", source "api.service.com"
   - Search "api" → should find both rules

4. **Edge cases**
   - Empty search → shows all rules
   - Whitespace search → shows all rules
   - Search with "." → matches literal dot in URLs
   - No match → shows empty state

## Build & Run

```bash
cd browser-extension
npm run dev
```

Load unpacked extension from `dist/chrome/` in Chrome.
