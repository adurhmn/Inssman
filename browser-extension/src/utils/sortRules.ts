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

  if (!currentState || currentState.column !== clickedColumn) {
    return { column: clickedColumn, direction: defaultDirection[clickedColumn] };
  }

  if (currentState.direction === defaultDirection[clickedColumn]) {
    return {
      column: clickedColumn,
      direction: currentState.direction === 'asc' ? 'desc' : 'asc'
    };
  }

  return null;
}
