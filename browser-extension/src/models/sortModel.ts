export type SortColumn = 'name' | 'lastMatchedTimestamp';
export type SortDirection = 'asc' | 'desc';

export type SortState = {
  column: SortColumn | null;
  direction: SortDirection;
};
