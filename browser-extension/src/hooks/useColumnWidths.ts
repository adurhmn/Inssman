import { useState, useCallback, useEffect, useRef } from "react";
import {
  ColumnWidthPreferences,
  ColumnField,
  DEFAULT_COLUMN_WIDTHS,
  MIN_COLUMN_WIDTHS,
} from "@/utils/columnWidths";
import StorageService from "@services/StorageService";
import { StorageKey } from "@models/storageModel";

interface UseColumnWidthsReturn {
  columnWidths: ColumnWidthPreferences;
  handleResize: (field: ColumnField, delta: number) => void;
  handleResizeEnd: () => void;
  handleResetColumn: (field: ColumnField) => void;
}

const loadColumnWidths = async (): Promise<ColumnWidthPreferences> => {
  try {
    const saved = await StorageService.getSingleItem(StorageKey.COLUMN_WIDTHS);
    if (saved) {
      return { ...DEFAULT_COLUMN_WIDTHS, ...saved };
    }
  } catch {
    // Storage unavailable, fallback to defaults
  }
  return DEFAULT_COLUMN_WIDTHS;
};

const saveColumnWidths = async (widths: ColumnWidthPreferences): Promise<void> => {
  try {
    await StorageService.set({ [StorageKey.COLUMN_WIDTHS]: widths });
  } catch {
    // Storage unavailable, silently ignore
  }
};

export const useColumnWidths = (): UseColumnWidthsReturn => {
  const [columnWidths, setColumnWidths] = useState<ColumnWidthPreferences>(DEFAULT_COLUMN_WIDTHS);
  const columnWidthsRef = useRef<ColumnWidthPreferences>(columnWidths);

  useEffect(() => {
    columnWidthsRef.current = columnWidths;
  }, [columnWidths]);

  useEffect(() => {
    loadColumnWidths().then(setColumnWidths);
  }, []);

  const handleResize = useCallback((field: ColumnField, delta: number) => {
    setColumnWidths((prev) => {
      const newWidth = Math.max(MIN_COLUMN_WIDTHS[field], prev[field] + delta);
      return {
        ...prev,
        [field]: newWidth,
      };
    });
  }, []);

  const handleResizeEnd = useCallback(() => {
    saveColumnWidths(columnWidthsRef.current);
  }, []);

  const handleResetColumn = useCallback((field: ColumnField) => {
    setColumnWidths((prev) => {
      const newWidths = {
        ...prev,
        [field]: DEFAULT_COLUMN_WIDTHS[field],
      };
      saveColumnWidths(newWidths);
      return newWidths;
    });
  }, []);

  return {
    columnWidths,
    handleResize,
    handleResizeEnd,
    handleResetColumn,
  };
};
