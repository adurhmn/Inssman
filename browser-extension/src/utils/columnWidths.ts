export const COLUMN_FIELDS = [
  'name',
  'pageType',
  'source',
  'lastMatchedTimestamp',
  'enabled',
  'actions',
] as const;

export type ColumnField = typeof COLUMN_FIELDS[number];

export interface ColumnWidthPreferences {
  name: number;
  pageType: number;
  source: number;
  lastMatchedTimestamp: number;
  enabled: number;
  actions: number;
}

export const DEFAULT_COLUMN_WIDTHS: ColumnWidthPreferences = {
  name: 150,
  pageType: 150,
  source: 150,
  lastMatchedTimestamp: 150,
  enabled: 150,
  actions: 150,
};

export const MIN_COLUMN_WIDTHS: ColumnWidthPreferences = {
  name: 80,
  pageType: 60,
  source: 80,
  lastMatchedTimestamp: 100,
  enabled: 60,
  actions: 100,
};
