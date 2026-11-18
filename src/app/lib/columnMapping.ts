import type { TemplateColumn } from "@/app/services";
import { normalizeCode } from "./normalizeCode";

/** One row of the file being mapped — the user's real header, an example value, and its target. */
export type FileColumn = { index: number; header: string; example: string };

/**
 * Does this file come from the platform's own template? Its second row (hidden) holds technical
 * column ids, and the API recognises it by that — so this mirrors the API: one of the first two
 * rows where at least half the filled cells are known ids. A file that does not has to have its
 * columns matched by hand.
 */
export const looksLikeTemplate = (rows: unknown[][], structuralIds: ReadonlySet<string>): boolean => {
  for (const row of rows.slice(0, 2)) {
    const tokens = row.map((cell) => (cell == null ? "" : String(cell).trim())).filter((t) => t !== "");
    if (tokens.length === 0) continue;
    const known = tokens.filter((t) => structuralIds.has(t) || /^(var|attr|newvar):/.test(t)).length;
    if (known > 0 && known >= Math.max(1, Math.floor(tokens.length / 2))) return true;
  }
  return false;
};

/**
 * Pre-assigns the file columns whose header is, ignoring case, accents and symbols, exactly the
 * name of one of our fields. Anything ambiguous or already taken is left for the person to choose.
 *
 * A field is known by its label in the screen's language, by `otherLabelOf` (the other language:
 * a Spanish file opened from the English screen) and by its technical id. A variable is also known
 * as "<name> — <MATRIX>", which is how our own templates head its column, so the same analyte in
 * soil, leaf and grain can be told apart.
 */
export const suggestMapping = (
  columns: FileColumn[],
  targets: TemplateColumn[],
  labelOf: (column: TemplateColumn) => string,
  otherLabelOf?: (column: TemplateColumn) => string | undefined,
): Record<number, string> => {
  const byName = new Map<string, string>();
  const ambiguous = new Set<string>();
  for (const target of targets) {
    const labels = [labelOf(target), target.label, otherLabelOf?.(target) ?? ""];
    const names = [
      ...labels,
      ...(target.matrix ? labels.filter(Boolean).map((label) => `${label} — ${target.matrix}`) : []),
      target.id.includes(":") ? "" : target.id,
    ];
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
