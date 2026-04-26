import { FC } from "react";
import { twMerge } from "tailwind-merge";
import { SortState, SortColumn } from "@models/sortModel";
import { ColumnWidthPreferences, ColumnField } from "@/utils/columnWidths";
import ResizeHandle from "./resizeHandle";

export type ListHeader = {
  title: string;
  field?: string;
  render: (sortState?: SortState | null, onSort?: (column: SortColumn) => void) => any;
  classes?: string;
  sortable?: boolean;
  sortKey?: SortColumn;
};

export type ListItems = {
  field: string;
  render: (value: any, item?: any) => any;
  classes?: string;
};

type Item<T> = T;

type Props = {
  headers: ListHeader[];
  items: ListItems[];
  listClasses?: string;
  rowClasses?: string;
  headerClasses?: string;
  activeRow?: Item<any> | null;
  data: Item<any>[];
  options?: Record<string, unknown>;
  onRowClick?: <T>(data: T) => void;
  texts?: {
    title?: string;
    description?: string;
  };
  sortState?: SortState | null;
  onSort?: (column: SortColumn) => void;
  columnWidths?: ColumnWidthPreferences;
  onColumnResize?: (field: ColumnField, delta: number) => void;
  onColumnResizeEnd?: () => void;
  onColumnReset?: (field: ColumnField) => void;
};

const List: FC<Props> = ({
  onRowClick = () => {},
  headers,
  items,
  data,
  options,
  listClasses = "",
  rowClasses = "",
  headerClasses = "",
  activeRow,
  texts = {
    title: "Seems You Have No Item",
    description: "",
  },
  sortState,
  onSort,
  columnWidths,
  onColumnResize,
  onColumnResizeEnd,
  onColumnReset,
}) => {
  const getColumnStyle = (field: string | undefined) => {
    if (field && columnWidths && columnWidths[field as ColumnField] !== undefined) {
      return { width: columnWidths[field as ColumnField], minWidth: columnWidths[field as ColumnField], flexShrink: 0 };
    }
    return {};
  };

  const hasResizableColumns = columnWidths && onColumnResize;

  return (
    <div className={hasResizableColumns ? "overflow-x-auto" : ""}>
      <div className={twMerge("flex items-center w-full px-6 py-3 border-b border-slate-700 bg-slate-700 bg-opacity-40", hasResizableColumns ? "min-w-max" : "justify-between")}>
        {headers.map((item, index) => {
          const isLastColumn = index === headers.length - 1;
          const headerKey = item.field || item.title;
          return (
            <div
              key={headerKey}
              className={twMerge(`relative ${item.classes || ""}`, headerClasses, !columnWidths ? "flex-1" : "", "pl-3")}
              style={getColumnStyle(item.field)}
            >
              {item.render(sortState, onSort)}
              {hasResizableColumns && onColumnResizeEnd && !isLastColumn && item.field && (
                <ResizeHandle
                  columnField={item.field as ColumnField}
                  onResize={onColumnResize}
                  onResizeEnd={onColumnResizeEnd}
                  onReset={onColumnReset}
                />
              )}
            </div>
          );
        })}
      </div>
      {data.length ? (
        <ul className={twMerge(`w-full overflow-y-auto min-h-[350px]`, listClasses, hasResizableColumns ? "min-w-max" : "")}>
          {data.map((row) => (
            <li
              onClick={() => onRowClick(row)}
              key={row.id}
              className={twMerge(
                "py-5 max-h-[90%] flex items-center px-6 border-b border-slate-700 w-full hover:bg-slate-800 hover:bg-opacity-40",
                rowClasses,
                activeRow?.id === row.id ? "text-sky-500" : "",
                hasResizableColumns ? "" : "justify-between"
              )}
            >
              {items.map((item, index) => {
                const isFirstColumn = index === 0;
                return (
                  <div
                    key={item.field}
                    className={twMerge("flex overflow-hidden", item.classes || "", !columnWidths ? "flex-1" : "", hasResizableColumns && !isFirstColumn ? "pl-3" : "")}
                    style={getColumnStyle(item.field)}
                  >
                    {item.render(row, options)}
                  </div>
                );
              })}
            </li>
          ))}
        </ul>
      ) : (
        <div className="min-h-[350px] flex items-center justify-center w-full">
          <div className="w-full text-center">
            <p className="text-2xl">{texts.title}</p>
            <p className="mt-3">{texts.description}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default List;
