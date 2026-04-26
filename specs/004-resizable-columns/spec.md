# Feature Specification: Resizable Columns for All Rules Dashboard

**Feature Branch**: `004-resizable-columns`  
**Created**: 2026-04-26  
**Status**: Draft  
**Input**: User description: "Name, Type, Source, Last Matched, Status & Actions columns in All Rules dashboard currently have static width. Longer source or name gets trimmed. I want to make the columns resizable for all columns in All Rules Dashboard. I want to persist each column width in browser storage so that on next visit I see the same layout. The column resize behavior should be similar to standard behavior we have in other products as well, for example, hovering over the end of column should surface a highlighted separator which can be moved around and placed."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Resize Column to View Full Content (Priority: P1)

A user has rules with long names or source URLs that are currently truncated. They want to widen the "Name" or "Source" column to see the full text without relying on tooltips or editing the rule.

**Why this priority**: This is the core value proposition—users cannot see important information due to fixed column widths. Enabling resize directly solves the primary pain point.

**Independent Test**: Can be fully tested by dragging the Name column wider and verifying long rule names are now visible in full.

**Acceptance Scenarios**:

1. **Given** the All Rules dashboard is displayed with rules containing long names, **When** the user hovers over the right edge of the "Name" column header, **Then** a visual resize handle/separator appears indicating the column is resizable.

2. **Given** the resize handle is visible, **When** the user clicks and drags the handle to the right, **Then** the "Name" column width increases and previously truncated text becomes visible.

3. **Given** the resize handle is visible, **When** the user clicks and drags the handle to the left, **Then** the "Name" column width decreases (down to a minimum width that keeps the column usable).

4. **Given** the user is resizing a column, **When** they release the mouse button, **Then** the column settles at the new width and adjacent columns adjust accordingly.

---

### User Story 2 - Persist Column Widths Across Sessions (Priority: P2)

A user has customized their column widths to fit their workflow. They close the browser or navigate away and return later. They expect to see the same column layout they configured.

**Why this priority**: Persistence transforms a one-time convenience into a lasting productivity improvement. Without it, users must re-adjust columns every session, negating most of the benefit.

**Independent Test**: Can be tested by resizing columns, closing the tab, reopening the All Rules dashboard, and verifying columns retain their custom widths.

**Acceptance Scenarios**:

1. **Given** the user has resized one or more columns, **When** they close the All Rules dashboard and reopen it, **Then** the columns display at their previously saved widths.

2. **Given** the user has customized column widths, **When** they restart the browser and navigate to All Rules, **Then** the column widths are restored from browser storage.

3. **Given** no previously saved column widths exist (first-time user), **When** the user opens All Rules, **Then** columns display with sensible default widths.

---

### User Story 3 - Reset Columns to Default Widths (Priority: P3)

A user has resized columns but wants to return to the original default layout, either because they made a mistake or prefer the defaults.

**Why this priority**: Provides a safety net and reduces anxiety about experimenting with column widths. Lower priority because users can manually resize back, but explicit reset improves UX.

**Independent Test**: Can be tested by resizing columns to custom widths, triggering reset, and verifying all columns return to default widths.

**Acceptance Scenarios**:

1. **Given** the user has customized column widths, **When** they trigger the reset action (e.g., double-click on a resize handle or use a reset option), **Then** all columns return to their default widths.

2. **Given** columns have been reset to defaults, **When** the user refreshes the page, **Then** columns remain at default widths (persisted reset state).

---

### Edge Cases

- What happens when the user resizes a column to its minimum width? The column should stop at a minimum width that keeps header text partially visible and the column functional.
- What happens when the user tries to resize beyond the available table width? The resize should be constrained so that all columns remain visible and functional.
- What happens when the browser window is resized after custom column widths are set? Columns should maintain their proportional widths or absolute widths (with horizontal scroll if needed).
- What happens if browser storage is cleared or unavailable? The table should gracefully fall back to default column widths.
- What happens when a new column is added in a future update? New columns should use default widths; existing column preferences should be preserved.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST display a visual resize handle when the user hovers over the boundary between two column headers.
- **FR-002**: System MUST allow users to drag the resize handle to adjust column width.
- **FR-003**: System MUST update column width in real-time during the drag operation (visual feedback).
- **FR-004**: System MUST enforce a minimum column width to prevent columns from becoming unusable.
- **FR-005**: System MUST persist column width preferences to browser storage after resize operations complete.
- **FR-006**: System MUST restore column width preferences from browser storage when the All Rules dashboard loads.
- **FR-007**: System MUST apply sensible default widths when no saved preferences exist.
- **FR-008**: System MUST allow resizing of all columns: Name, Type, Source, Last Matched, Status, and Actions.
- **FR-009**: System MUST ensure that resizing one column appropriately affects adjacent columns or table layout (columns don't overlap or leave gaps).
- **FR-010**: System MUST provide a way to reset columns to default widths (double-click on resize handle resets that column).

### Key Entities

- **Column Width Preference**: Represents a user's preferred width for a specific column. Includes column identifier and width value.
- **Column Configuration**: Represents the set of all column width preferences for the All Rules table, stored as a single unit in browser storage.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can resize any column in the All Rules dashboard within 2 seconds of hovering over the column boundary.
- **SC-002**: Column width changes persist across browser sessions with 100% reliability (when browser storage is available).
- **SC-003**: Visual resize handle appears within 100ms of hovering over the column boundary.
- **SC-004**: Column width updates visually in real-time during drag (no perceptible lag).
- **SC-005**: Users can view full content of long rule names and source URLs by widening the respective columns.
- **SC-006**: 100% of users who customize column widths see those widths preserved on their next visit.

## Assumptions

- Users have modern browsers that support local storage or equivalent browser storage APIs.
- The feature scope is limited to the All Rules dashboard in the browser extension options page; the popup rules list is out of scope for this specification.
- Horizontal scrolling is acceptable if the user makes columns wider than the viewport.
- The existing flex-based table layout can be adapted to support explicit column widths without a complete rewrite.
- Minimum column widths will be determined during implementation based on the shortest reasonable content for each column type.
- The resize behavior will follow platform conventions (similar to spreadsheet applications or database management tools).
