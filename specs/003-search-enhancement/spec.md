# Feature Specification: Search Enhancement

**Feature Branch**: `003-search-enhancement`  
**Created**: 2026-04-26  
**Status**: Draft  
**Input**: User description: "The current rule search ('Search by Rule Name') functionality is limited. It only searches based on Name column. It is case-sensitive. Requirement: I want the search to be case insensitive. Search should consider both Name & Source column, if atleast one matches it should show the record"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Case-Insensitive Search (Priority: P1)

As a user, I want to search for rules without worrying about letter casing so that I can find rules quickly regardless of how I type my search query.

**Why this priority**: This is the core usability improvement. Currently, users must remember the exact casing of rule names, which creates friction and failed searches. Case-insensitive search is a fundamental user expectation for any search functionality.

**Independent Test**: Can be fully tested by typing a rule name in different cases (uppercase, lowercase, mixed) and verifying results appear. Delivers immediate value by reducing search failures.

**Acceptance Scenarios**:

1. **Given** a rule named "BlockAds" exists, **When** user searches for "blockads" (all lowercase), **Then** the "BlockAds" rule is displayed in results
2. **Given** a rule named "BlockAds" exists, **When** user searches for "BLOCKADS" (all uppercase), **Then** the "BlockAds" rule is displayed in results
3. **Given** a rule named "BlockAds" exists, **When** user searches for "bLoCkAdS" (mixed case), **Then** the "BlockAds" rule is displayed in results

---

### User Story 2 - Search by Source Column (Priority: P1)

As a user, I want to search for rules by their Source value so that I can find all rules associated with a specific source/domain.

**Why this priority**: Equally critical as case-insensitive search. Users often need to find rules by source (e.g., domain or URL pattern) rather than by name. This expands the search utility significantly.

**Independent Test**: Can be fully tested by searching for a known source value and verifying matching rules appear. Delivers value by enabling a new way to discover rules.

**Acceptance Scenarios**:

1. **Given** a rule with Source "example.com" exists, **When** user searches for "example.com", **Then** the rule is displayed in results
2. **Given** a rule with Source "example.com" exists, **When** user searches for "EXAMPLE.COM" (case-insensitive), **Then** the rule is displayed in results
3. **Given** a rule with Source "api.github.com" exists, **When** user searches for "github", **Then** the rule is displayed in results (partial match)

---

### User Story 3 - Multi-Column Match Display (Priority: P1)

As a user, I want search to match against both Name and Source columns simultaneously so that any relevant rule is found if my search term appears in either field.

**Why this priority**: This combines the two search enhancements into a unified experience. Without this, users would need to know which column contains their search term.

**Independent Test**: Can be tested by searching a term that exists in one rule's Name and another rule's Source, verifying both rules appear.

**Acceptance Scenarios**:

1. **Given** Rule A has Name "APIProxy" and Rule B has Source "api.service.com", **When** user searches for "api", **Then** both Rule A and Rule B are displayed in results
2. **Given** a rule has Name "TestRule" and Source "localhost:3000", **When** user searches for "test", **Then** the rule is displayed (matched by Name)
3. **Given** a rule has Name "TestRule" and Source "localhost:3000", **When** user searches for "localhost", **Then** the rule is displayed (matched by Source)

---

### Edge Cases

- What happens when search term matches both Name and Source of the same rule? → Rule should appear once (no duplicates)
- What happens when search term is empty? → All rules should be displayed (no filter applied)
- What happens when search term matches no rules? → Empty results state should be shown
- What happens when search term contains special characters (e.g., ".", "*", "?")? → Should be treated as literal characters, not regex patterns
- What happens with whitespace-only search? → Should be treated as empty search (show all rules)
- What happens with very long search terms? → Should function normally; no match if nothing contains the term

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST perform case-insensitive matching when comparing search term against rule Name
- **FR-002**: System MUST perform case-insensitive matching when comparing search term against rule Source
- **FR-003**: System MUST display a rule if the search term matches either Name OR Source (logical OR)
- **FR-004**: System MUST support partial matching (substring search) for both Name and Source columns
- **FR-005**: System MUST display each matching rule only once, even if search term matches both Name and Source
- **FR-006**: System MUST display all rules when search term is empty or contains only whitespace
- **FR-007**: System MUST treat special characters in search term as literal characters (not regex patterns)
- **FR-008**: System MUST update search results in real-time as user types (existing behavior to maintain)

### Key Entities

- **Rule**: Represents a user-defined rule with attributes including Name (display identifier) and Source (target domain/URL pattern)
- **Search Query**: The text input by user to filter rules; matched against multiple columns

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can find rules regardless of casing in 100% of cases where the rule name or source contains the search term
- **SC-002**: Search returns results within 100ms for typical rule lists (up to 500 rules)
- **SC-003**: Zero duplicate rules appear in search results when a term matches both Name and Source
- **SC-004**: Users can find rules by source domain, reducing time to locate domain-specific rules by enabling direct source search

## Assumptions

- Existing search input field and UI components will be reused; only the filtering logic changes
- The current real-time search behavior (filtering as user types) will be preserved
- Search is performed client-side on already-loaded rule data
- The rule list displayed is the same table/list component currently in use
- No additional UI indicators are needed to show which column matched (Name vs Source)
- Source column values are always present for rules (not null/undefined)
