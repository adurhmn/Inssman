import { FC, useRef, useCallback, useEffect } from "react";
import { ColumnField } from "@/utils/columnWidths";

type Props = {
  columnField: ColumnField;
  onResize: (field: ColumnField, delta: number) => void;
  onResizeEnd: () => void;
  onReset?: (field: ColumnField) => void;
};

const ResizeHandle: FC<Props> = ({ columnField, onResize, onResizeEnd, onReset }) => {
  const isResizingRef = useRef(false);
  const startXRef = useRef(0);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    isResizingRef.current = true;
    startXRef.current = e.clientX;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizingRef.current) return;
    const delta = e.clientX - startXRef.current;
    startXRef.current = e.clientX;
    onResize(columnField, delta);
  }, [columnField, onResize]);

  const handleMouseUp = useCallback(() => {
    if (!isResizingRef.current) return;
    isResizingRef.current = false;
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    onResizeEnd();
  }, [onResizeEnd]);

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onReset?.(columnField);
  }, [columnField, onReset]);

  useEffect(() => {
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  return (
    <div
      className="absolute -right-1 top-1 bottom-1 w-3 cursor-col-resize z-10 group flex items-center justify-center"
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDoubleClick}
    >
      <div className="h-full w-0.5 bg-slate-600 group-hover:w-1 group-hover:bg-sky-500 group-active:w-1 group-active:bg-sky-400 transition-all rounded-full" />
    </div>
  );
};

export default ResizeHandle;
