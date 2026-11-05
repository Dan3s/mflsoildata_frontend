import type { DatasetCatalogueItem } from "@/app/services";

/** [min, max] year a dataset covers, from its temporal coverage (falls back to when it was last updated). */
export const yearBounds = (item: Pick<DatasetCatalogueItem, "temporal_coverage_start" | "temporal_coverage_end" | "updated_at">): [number, number] | null => {
  const start = item.temporal_coverage_start ? Number(item.temporal_coverage_start.slice(0, 4)) : undefined;
  const end = item.temporal_coverage_end ? Number(item.temporal_coverage_end.slice(0, 4)) : undefined;
  if (start && end) return [Math.min(start, end), Math.max(start, end)];
  if (start) return [start, start];
  if (end) return [end, end];
  const updated = item.updated_at ? Number(item.updated_at.slice(0, 4)) : undefined;
  return updated ? [updated, updated] : null;
};

export const yearMatches = (item: Pick<DatasetCatalogueItem, "temporal_coverage_start" | "temporal_coverage_end" | "updated_at">, year: string): boolean => {
  const bounds = yearBounds(item);
  if (!bounds) return false;
  const y = Number(year);
  return y >= bounds[0] && y <= bounds[1];
};

/** Distinct years covered by any item, most recent first — for a year filter's option list. */
export const yearOptionsFrom = (items: Pick<DatasetCatalogueItem, "temporal_coverage_start" | "temporal_coverage_end" | "updated_at">[]): string[] => {
  const years = new Set<number>();
  for (const item of items) {
    const bounds = yearBounds(item);
    if (!bounds) continue;
    for (let y = bounds[0]; y <= bounds[1]; y += 1) years.add(y);
  }
  return Array.from(years).sort((a, b) => b - a).map(String);
};
