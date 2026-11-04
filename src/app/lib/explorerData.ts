import type { WideColumn } from "@/app/services";

export const DATE_KEY = "event_date";
export const YEAR_KEY = "event_year";

/**
 * Graphic Walker's date filter reads every value of a temporal column as a date and
 * throws on an empty one ("Cannot read properties of null (reading 'getTime')"). Many
 * samples have no sampling date, so dragging Date to Filters broke the whole explorer.
 * A column with gaps is offered as plain categories instead, with the gap named, and
 * the year is added as its own column: the thing people actually want to filter by.
 */
export const prepareDates = (
  rows: Record<string, unknown>[],
  columns: WideColumn[],
  labels: { noDate: string; year: string },
): { rows: Record<string, unknown>[]; columns: WideColumn[] } => {
  if (!columns.some((c) => c.key === DATE_KEY)) return { rows, columns };

  const isBlank = (v: unknown) => v === null || v === undefined || v === "";
  const hasGaps = rows.some((r) => isBlank(r[DATE_KEY]));
  const yearOf = (v: unknown) => {
    const year = Number(String(v).slice(0, 4));
    return Number.isFinite(year) && year > 0 ? year : null;
  };

  const nextRows = rows.map((r) => ({
    ...r,
    [DATE_KEY]: isBlank(r[DATE_KEY]) ? labels.noDate : r[DATE_KEY],
    [YEAR_KEY]: isBlank(r[DATE_KEY]) ? labels.noDate : yearOf(r[DATE_KEY]),
  }));
  const nextColumns: WideColumn[] = columns.flatMap((c) =>
    c.key === DATE_KEY
      ? [
          { ...c, semantic: hasGaps ? ("nominal" as const) : c.semantic },
          { key: YEAR_KEY, label: labels.year, role: "dimension" as const, semantic: "nominal" as const },
        ]
      : [c],
  );
  return { rows: nextRows, columns: nextColumns };
};
