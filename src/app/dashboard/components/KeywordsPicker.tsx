"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Search, X, Link2 } from "lucide-react";
import { lookupsService } from "@/app/services";
import type { AgrovocTerm, KeywordValue } from "@/app/services";

/**
 * Normalize either stored shape into terms.
 *
 * Keywords used to be plain strings; they are now {label, uri} so a keyword can
 * point at an AGROVOC concept. Datasets saved before the change still hold
 * strings, so every reader has to accept both.
 */
export const toTerms = (value: KeywordValue[] | null | undefined): AgrovocTerm[] =>
  (Array.isArray(value) ? value : [])
    .map((k) => (typeof k === "string" ? { label: k, uri: null } : k))
    .filter((k) => k?.label);

/** Just the human-readable labels, for chips, search and CSV display. */
export const keywordLabels = (value: KeywordValue[] | null | undefined): string[] =>
  toTerms(value).map((k) => k.label);

/**
 * Keyword field with AGROVOC suggestions. The concept URI travels with the label
 * so the keyword is machine-resolvable ("soil" and "Suelo" are one concept);
 * free text is still accepted, and simply carries no URI.
 */
export default function KeywordsPicker({
  value,
  onChange,
}: {
  value: AgrovocTerm[];
  onChange: (terms: AgrovocTerm[]) => void;
}) {
  const t = useTranslations("upload.ficha");
  const locale = useLocale();
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<AgrovocTerm[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setOptions([]);
      return;
    }
    setSearching(true);
    const timer = setTimeout(() => {
      lookupsService
        .agrovoc(q, locale === "es" ? "es" : "en")
        .then(setOptions)
        .catch(() => setOptions([]))
        .finally(() => setSearching(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [query, locale]);

  const add = (term: AgrovocTerm) => {
    const label = term.label.trim();
    if (label && !value.some((k) => k.label.toLowerCase() === label.toLowerCase())) {
      onChange([...value, { label, uri: term.uri ?? null }]);
    }
    setQuery("");
    setOptions([]);
  };

  return (
    <div>
      {value.length > 0 ? (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {value.map((k) => (
            <span
              key={k.label}
              className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1 text-xs text-brand-900"
              title={k.uri ?? undefined}
            >
              {/* The link icon is the visible difference between a keyword tied to
                  an AGROVOC concept and one that is just a word. */}
              {k.uri ? <Link2 className="h-3 w-3 text-brand-700" aria-hidden /> : null}
              {k.label}
              <button
                type="button"
                onClick={() => onChange(value.filter((x) => x.label !== k.label))}
                aria-label={t("removeKeyword")}
                className="text-brand-700 hover:text-brand-900"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      ) : null}

      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add({ label: query, uri: null });
            }
          }}
          placeholder={t("searchKeywords")}
          className="h-9 w-full rounded-lg border border-gray-200 bg-gray-50 pl-8 pr-3 text-sm outline-none focus:border-brand-400 focus:bg-white"
        />
        {query.trim().length >= 2 ? (
          <div className="absolute z-10 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
            {searching ? (
              <p className="px-3 py-2 text-xs text-gray-500">…</p>
            ) : (
              <>
                {options.map((o) => (
                  <button
                    key={o.uri || o.label}
                    type="button"
                    onClick={() => add(o)}
                    className="block w-full px-3 py-2 text-left text-sm text-gray-800 hover:bg-gray-50"
                  >
                    {o.label}
                    <span className="ml-2 text-[10px] uppercase tracking-wide text-gray-400">AGROVOC</span>
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => add({ label: query, uri: null })}
                  className="block w-full border-t border-gray-100 px-3 py-2 text-left text-xs text-gray-600 hover:bg-gray-50"
                >
                  {t("addFreeKeyword", { term: query.trim() })}
                </button>
              </>
            )}
          </div>
        ) : null}
      </div>
      <p className="mt-1 text-[10px] text-gray-400">{t("keywordsHint")}</p>
    </div>
  );
}
