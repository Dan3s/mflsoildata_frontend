import type { TemplateColumn } from "@/app/services";
import { normalizeCode } from "./normalizeCode";

/** One row of the file being mapped — the user's real header, an example value, and its target. */
export type FileColumn = { index: number; header: string; example: string };

/**
 * Pre-assigns the file columns whose header is, ignoring case, accents and symbols, exactly the
 * name of one of our fields. Anything ambiguous or already taken is left for the person to choose.
 */
export const suggestMapping = (
  columns: FileColumn[],
  targets: TemplateColumn[],
  labelOf: (column: TemplateColumn) => string,
): Record<number, string> => {
  const byName = new Map<string, string>();
  const ambiguous = new Set<string>();
  for (const target of targets) {
    const names = [labelOf(target), target.label, target.id.includes(":") ? "" : target.id];
    for (const name of names) {
      const key = normalizeCode(name);
      if (!key) continue;
      if (byName.has(key) && byName.get(key) !== target.id) ambiguous.add(key);
      else byName.set(key, target.id);
    }
  }
  const used = new Set<string>();
  const result: Record<number, string> = {};
  for (const column of columns) {
    const key = normalizeCode(column.header);
    const id = key ? byName.get(key) : undefined;
    if (!id || ambiguous.has(key) || used.has(id)) continue;
    result[column.index] = id;
    used.add(id);
  }
  return result;
};
