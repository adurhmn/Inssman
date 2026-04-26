# Feature Specification: Sort Rules

**Feature Branch**: `002-sort-rules`  
**Created**: April 24, 2026  
**Status**: Draft  
**Input**: User description: "Add a sorting feature to the All Rules dashboard. The table includes the following columns: Name, Type, Source, Last Matched, Status, and Actions. Enable ascending and descending sorting for Name and Last Matched columns. Only one sorting criterion should be active at a time."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Sort Rules by Name (Priority: P1)

As a user viewing the All Rules dashboard, I want to sort rules alphabetically by name so that I can quickly locate a specific rule when I have many rules configured.

**Why this priority**: Name-based sorting is the most common way users organize and find items in a list. Users typically remember rule names, making this the primary discovery method.

**Independent Test**: Can be fully tested by clicking the Name column header sort control and verifying rules reorder alphabetically. Delivers immediate value for rule discovery.

**Acceptance Scenarios**:

1. **Given** I am on the All Rules dashboard with multiple rules displayed, **When** I click the sort control on the Name column header, **Then** the rules are sorted in ascending alphabetical order (A-Z)
2. **Given** rules are sorted by Name in ascending order, **When** I click the sort control on the Name column header again, **Then** the rules are sorted in descending alphabetical order (Z-A)
3. **Given** rules are sorted by Name in descending order, **When** I click the sort control on the Name column header again, **Then** the sorting is removed and rules return to their default order

---

### User Story 2 - Sort Rules by Last Matched (Priority: P2)

As a user viewing the All Rules dashboard, I want to sort rules by their last matched date so that I can identify which rules are actively being triggered and which may be dormant.

**Why this priority**: Sorting by Last Matched helps users understand rule activity patterns, identify stale rules, and prioritize maintenance efforts. This is critical for rule hygiene.

**Independent Test**: Can be fully tested by clicking the Last Matched column header sort control and verifying rules reorder by date. Delivers value for identifying active vs inactive rules.

**Acceptance Scenarios**:

1. **Given** I am on the All Rules dashboard with multiple rules displayed, **When** I click the sort control on the Last Matched column header, **Then** the rules are sorted by last matched date (most recent first)
2. **Given** rules are sorted by Last Matched in descending order (most recent first), **When** I click the sort control on the Last Matched column header again, **Then** the rules are sorted in ascending order (oldest first)
3. **Given** rules are sorted by Last Matched in ascending order, **When** I click the sort control on the Last Matched column header again, **Then** the sorting is removed and rules return to their default order

---

### User Story 3 - Single Active Sort Criterion (Priority: P1)

As a user, I want only one sorting criterion to be active at a time so that the sorting behavior is predictable and easy to understand.

**Why this priority**: This is a usability requirement that ensures consistent behavior. Users should always know exactly how rules are currently sorted without confusion from multiple active sorts.

**Independent Test**: Can be fully tested by applying a sort on one column and then applying a sort on another column, verifying the first sort is replaced.

**Acceptance Scenarios**:

1. **Given** rules are sorted by Name, **When** I click the sort control on the Last Matched column, **Then** the Name sort is removed and rules are now sorted only by Last Matched
2. **Given** rules are sorted by Last Matched, **When** I click the sort control on the Name column, **Then** the Last Matched sort is removed and rules are now sorted only by Name
3. **Given** a sort is active on any column, **When** I view the table, **Then** only the active sort column displays a sort indicator (ascending or descending icon)

---

### Edge Cases

- What happens when rules have identical names? Rules with the same name should maintain their relative order (stable sort).
- What happens when a rule has never been matched (null/empty Last Matched)? Rules with no Last Matched value should appear at the end when sorting ascending, and at the beginning when sorting descending.
- What happens when the rules list is empty? Sort controls should be visible but non-functional (no error should occur).
- What happens when there is only one rule? Sort controls should be visible and functional but produce no visible change.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST display a sort control adjacent to the Name column header
- **FR-002**: System MUST display a sort control adjacent to the Last Matched column header
- **FR-003**: System MUST NOT display sort controls for Type, Source, Status, or Actions columns
- **FR-004**: Sort control MUST support three states: unsorted, ascending, and descending
- **FR-005**: System MUST sort rules in ascending alphabetical order (A-Z) when Name ascending sort is activated
- **FR-006**: System MUST sort rules in descending alphabetical order (Z-A) when Name descending sort is activated
- **FR-007**: System MUST sort rules by most recent match date first when Last Matched descending sort is activated
- **FR-008**: System MUST sort rules by oldest match date first when Last Matched ascending sort is activated
- **FR-009**: System MUST allow only one sort criterion to be active at any given time
- **FR-010**: System MUST automatically deactivate the current sort when a different column's sort is activated
- **FR-011**: System MUST visually indicate the current sort state (ascending/descending) on the active sort column
- **FR-012**: System MUST handle rules with null/empty Last Matched values by placing them at the end for ascending sort and at the beginning for descending sort
- **FR-013**: Sort MUST be stable (preserve relative order of items with equal sort values)

### Key Entities

- **Rule**: Represents a configured rule with attributes including Name (string), Type, Source, Last Matched (date/timestamp, nullable), and Status
- **Sort State**: Represents the current sorting configuration with attributes: active column (Name or Last Matched or none) and direction (ascending or descending)

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can sort rules by Name in under 1 second from clicking the sort control
- **SC-002**: Users can sort rules by Last Matched in under 1 second from clicking the sort control
- **SC-003**: Sort indicator correctly reflects the current sort state 100% of the time
- **SC-004**: Users can find a specific rule 50% faster when using name sorting compared to scrolling through an unsorted list (for lists with 20+ rules)
- **SC-005**: Zero confusion about active sort state - only one column shows a sort indicator at any time

## Assumptions

- Users have an existing All Rules dashboard with a table displaying rules
- The table already displays Name, Type, Source, Last Matched, Status, and Actions columns
- The default order of rules (when no sort is active) is the order they are returned from the data source
- Sorting is performed client-side on the currently loaded rules (pagination, if present, is handled separately)
- The Last Matched field stores a date/timestamp that can be compared for sorting purposes
- Name sorting is case-insensitive (e.g., "Apple" and "apple" are treated as equal for sorting purposes)
