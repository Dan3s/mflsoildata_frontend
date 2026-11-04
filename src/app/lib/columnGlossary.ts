import glossary from "./column-glossary.json";

export type GlossaryColumn = {
  name: string;
  type: string;
  required?: boolean;
  auto?: boolean;
  description?: string;
};

export type GlossaryTable = {
  table: string;
  module: string;
  label: string;
  description: string;
  columns: GlossaryColumn[];
};

export type GlossaryModule = { key: string; label: string };

export type ColumnGlossary = {
  title: string;
  intro: string[];
  generic: Record<string, string>;
  modules: GlossaryModule[];
  tables: GlossaryTable[];
};

export const columnGlossary = glossary as ColumnGlossary;

/** Resolve a column's description: explicit override → generic (by column name) → "". */
export function describeColumn(column: GlossaryColumn): string {
  return column.description ?? columnGlossary.generic[column.name] ?? "";
}

/** Whether a column matches a free-text search (column name, table, or description). */
export function columnMatches(column: GlossaryColumn, table: GlossaryTable, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    column.name.toLowerCase().includes(q) ||
    table.table.toLowerCase().includes(q) ||
    table.label.toLowerCase().includes(q) ||
    describeColumn(column).toLowerCase().includes(q)
  );
}
