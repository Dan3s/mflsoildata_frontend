"use client";

import { X } from "lucide-react";
import { useTranslations } from "next-intl";

export type FilterChip = {
  key: string;
  /** What the filter is ("Institución"). */
  label: string;
  /** What it is set to. */
  value: string;
  onRemove: () => void;
};

/**
 * The filters that are narrowing what the person sees, always in plain view.
 * Some are inherited from another screen (they live in a cookie), and a filter the
 * user cannot see is a filter that makes data "disappear" for no reason they can
 * find. Each chip says what it is and removes itself; "Clear all" drops them all.
 */
export default function ActiveFilters({ chips, onClearAll }: { chips: FilterChip[]; onClearAll: () => void }) {
  const t = useTranslations("filters");

  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t("activeTitle")}>
      <span className="text-xs font-medium uppercase tracking-wide text-gray-500">{t("activeTitle")}</span>
      {chips.map((chip) => (
        <span
          key={chip.key}
          className="inline-flex max-w-full items-center gap-1 rounded-full border border-brand-200 bg-brand-50 py-1 pl-3 pr-1.5 text-xs text-brand-900"
        >
          <span className="truncate">
            <span className="text-brand-700">{chip.label}:</span> <span className="font-medium">{chip.value}</span>
          </span>
          <button
            type="button"
            onClick={chip.onRemove}
            aria-label={t("remove", { name: `${chip.label}: ${chip.value}` })}
            className="rounded-full p-0.5 text-brand-700 transition hover:bg-brand-100 hover:text-brand-900"
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      {chips.length > 1 ? (
        <button type="button" onClick={onClearAll} className="text-xs font-medium text-gray-600 underline underline-offset-2 hover:text-gray-900">
          {t("clearAll")}
        </button>
      ) : null}
    </div>
  );
}
