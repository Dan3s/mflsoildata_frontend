"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Search, Download, Info } from "lucide-react";
import {
  columnGlossary,
  describeColumn,
  columnMatches,
  type GlossaryColumn,
  type GlossaryTable,
} from "@/app/lib/columnGlossary";

/** Public path of the editable Word version (served from /public). */
const DOCX_HREF = "/Glosario_Columnas_BD_MFL.docx";

function Tag({ column }: { column: GlossaryColumn }) {
  const t = useTranslations("glossary");
  if (column.auto) {
    return <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">{t("tagAuto")}</span>;
  }
  if (column.required) {
    return <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">{t("tagRequired")}</span>;
  }
  return <span className="inline-flex rounded-full bg-gray-50 px-2 py-0.5 text-xs font-medium text-gray-400">{t("tagOptional")}</span>;
}

function TableCard({ table, query }: { table: GlossaryTable; query: string }) {
  const t = useTranslations("glossary");
  const columns = table.columns.filter((c) => columnMatches(c, table, query));
  if (columns.length === 0) return null;

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <h3 className="font-mono text-base font-semibold text-gray-900">{table.label}</h3>
      <p className="mt-0.5 text-sm text-gray-500">{table.description}</p>

      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
          <thead>
            <tr className="text-xs uppercase tracking-wide text-gray-500">
              <th className="border-b border-gray-200 px-3 py-2 font-medium">{t("colColumn")}</th>
              <th className="border-b border-gray-200 px-3 py-2 font-medium">{t("colType")}</th>
              <th className="border-b border-gray-200 px-3 py-2 font-medium">{t("colUsage")}</th>
              <th className="border-b border-gray-200 px-3 py-2 font-medium">{t("colMeaning")}</th>
            </tr>
          </thead>
          <tbody>
            {columns.map((c) => (
              <tr key={c.name} className="align-top text-gray-700">
                <td className="border-b border-gray-100 px-3 py-2 font-mono text-[13px] text-gray-900">{c.name}</td>
                <td className="border-b border-gray-100 px-3 py-2 text-gray-500">{c.type}</td>
                <td className="border-b border-gray-100 px-3 py-2"><Tag column={c} /></td>
                <td className="border-b border-gray-100 px-3 py-2">{describeColumn(c) || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function ColumnGlossary() {
  const t = useTranslations("glossary");
  const [query, setQuery] = useState("");

  const modules = useMemo(
    () =>
      columnGlossary.modules
        .map((m) => ({
          ...m,
          tables: columnGlossary.tables.filter((t) => t.module === m.key),
        }))
        .filter((m) => m.tables.length > 0),
    [],
  );

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{t("title")}</h2>
            <p className="mt-1 text-sm text-gray-500">{t("subtitle")}</p>
          </div>
          <a
            href={DOCX_HREF}
            download
            className="inline-flex w-fit items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50"
          >
            <Download className="h-4 w-4" />
            {t("downloadWord")}
          </a>
        </div>

        <div className="mt-4 space-y-2">
          {columnGlossary.intro.map((p, i) => (
            <p key={i} className="flex items-start gap-2 text-sm text-gray-500">
              {i === 0 ? <Info className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" /> : <span className="w-4 shrink-0" />}
              {p}
            </p>
          ))}
        </div>

        <div className="relative mt-4">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("searchPlaceholder")}
            className="h-10 w-full rounded-lg border border-gray-200 bg-gray-50 pl-9 pr-3 text-sm text-gray-700 outline-none transition focus:border-brand-500 focus:bg-white"
          />
        </div>
      </div>

      {modules.map((m) => {
        const cards = m.tables
          .map((t) => <TableCard key={t.table} table={t} query={query} />)
          .filter(Boolean);
        if (cards.length === 0) return null;
        return (
          <section key={m.key} className="space-y-3">
            <h2 className="px-1 text-sm font-semibold uppercase tracking-wide text-gray-500">{m.label}</h2>
            {cards}
          </section>
        );
      })}
    </div>
  );
}
