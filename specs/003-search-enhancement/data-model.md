# Data Model: Search Enhancement

**Feature**: 003-search-enhancement  
**Date**: 2026-04-26

## Overview

This feature does not introduce new data entities. It operates on the existing `IRuleMetaData` structure. This document captures the relevant fields for search matching.

## Existing Entities (Reference)

### IRuleMetaData

The primary entity representing a user-created rule.

| Field | Type | Search Relevance |
|-------|------|------------------|
| `name` | `string` | ✅ Searchable (existing) |
| `conditions` | `Condition[]` | Contains searchable `source` field |
| `id` | `number` | Not searchable |
| `pageType` | `string` | Not searchable |
| `enabled` | `boolean` | Not searchable |
| *other fields* | various | Not relevant to search |

### Condition

Nested within `IRuleMetaData.conditions` array.

| Field | Type | Search Relevance |
|-------|------|------------------|
| `source` | `string` | ✅ Searchable (new) |
| `matchType` | `string` | Not searchable |

## Search Query (Conceptual)

The search query is a transient UI state, not persisted.

| Attribute | Value |
|-----------|-------|
| Source | User input from search text field |
| Normalization | Trimmed, lowercased for comparison |
| Scope | Single component state (`useState` in `main.tsx`) |

## Matching Logic

```
MATCH = (
  rule.name CONTAINS search_term (case-insensitive)
  OR
  ANY rule.condition.source CONTAINS search_term (case-insensitive)
)
```

## Validation Rules

| Rule | Description |
|------|-------------|
| Empty search | Shows all rules (no filter applied) |
| Whitespace-only | Treated as empty search |
| Special characters | Matched literally (not as regex) |
| Multiple conditions | Rule matches if ANY condition's source matches |

## State Transitions

Not applicable - search is stateless filtering. No persistence, no state machine.

## Relationships

```
IRuleMetaData (1) ──contains──> (N) Condition
                                     └── source: string (searchable)
```

## No Schema Changes

This feature requires no changes to:
- Storage schema
- Chrome storage keys
- Message protocol
- Type definitions
