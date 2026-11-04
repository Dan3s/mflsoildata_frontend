"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import type { FilterOption } from "@/app/services";
import { MATRIX_OPTIONS } from "@/app/lib/matrixColors";
import { writeGlobalFilters } from "@/app/lib/globalFilters";
import ActiveFilters, { type FilterChip } from "./ActiveFilters";

export type DashboardFilterValues = {
  institution?: string;
  matrix?: string;
  year?: string;
};

type DashboardFiltersProps = {
  values: DashboardFilterValues;
  institutionOptions: FilterOption[];
  yearOptions: string[];
  /** Datasets that match the other two filters, per value: only values with some are offered. */
  counts?: { institution: Record<string, number>; matrix: Record<string, number>; year: Record<string, number> };
};

/**
 * The single filter bar for the merged Dashboard + Datasets page: Institución,
 * Matrix and Año — styled the same as every other filter in the app. Matrix
 * colors are for display only (dataset cards, badges), not for filter controls.
 * Filters sync to the URL (so links stay shareable) and to the global filters
 * cookie (so Institution/Matrix persist when navigating to other screens — see
 * src/app/lib/globalFilters.ts).
 */
export default function DashboardFilters({ values, institutionOptions, yearOptions, counts }: DashboardFiltersProps) {
  const t = useTranslations("filters");
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const setParam = (key: "institution" | "matrix" | "year", value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);

    if (key === "institution" || key === "matrix") {
      writeGlobalFilters({ [key]: value || undefined });
    }

    startTransition(() => {
      router.replace(params.toString() ? `/dashboard?${params.toString()}` : "/dashboard");
    });
  };

  const clearAll = () => {
    writeGlobalFilters({ institution: undefined, matrix: undefined });
    startTransition(() => router.replace("/dashboard"));
  };

  const chips: FilterChip[] = [
    values.institution ? { key: "institution", label: t("institution"), value: values.institution, onRemove: () => setParam("institution", "") } : null,
    values.matrix ? { key: "matrix", label: t("matrix"), value: values.matrix, onRemove: () => setParam("matrix", "") } : null,
    values.year ? { key: "year", label: t("year"), value: values.year, onRemove: () => setParam("year", "") } : null,
  ].filter((chip): chip is FilterChip => chip !== null);

  return (
    <>
    <div className="mt-6 flex flex-wrap items-end gap-5">
      <label className="block">
        <span className="mb-2 block text-sm text-gray-700">{t("institution")}</span>
        <select
          value={values.institution ?? ""}
          onChange={(e) => setParam("institution", e.target.value)}
          disabled={isPending}
          className="h-11 min-w-[14rem] rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm text-gray-700 shadow-sm outline-none transition focus:border-brand-500 focus:bg-white"
        >
          <option value="">{t("allInstitutions")}</option>
          {institutionOptions
            .filter((option) => !counts || (counts.institution[option.label] ?? 0) > 0 || option.label === values.institution)
            .map((option) => (
              <option key={option.label} value={option.label}>
                {counts ? `${option.label} (${counts.institution[option.label] ?? 0})` : option.label}
              </option>
            ))}
        </select>
      </label>

      <label className="block">
        <span className="mb-2 block text-sm text-gray-700">{t("matrix")}</span>
        <select
          value={values.matrix ?? ""}
          onChange={(e) => setParam("matrix", e.target.value)}
          disabled={isPending}
          className="h-11 min-w-[10rem] rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm text-gray-700 shadow-sm outline-none transition focus:border-brand-500 focus:bg-white"
        >
          <option value="">{t("allMatrices")}</option>
          {MATRIX_OPTIONS.filter((m) => !counts || (counts.matrix[m] ?? 0) > 0 || m === values.matrix).map((m) => (
            <option key={m} value={m}>
              {counts ? `${m} (${counts.matrix[m] ?? 0})` : m}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="mb-2 block text-sm text-gray-700">{t("year")}</span>
        <select
          value={values.year ?? ""}
          onChange={(e) => setParam("year", e.target.value)}
          disabled={isPending}
          className="h-11 min-w-[8rem] rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm text-gray-700 shadow-sm outline-none transition focus:border-brand-500 focus:bg-white"
        >
          <option value="">{t("allYears")}</option>
          {yearOptions.map((year) => (
            <option key={year} value={year}>
              {counts ? `${year} (${counts.year[year] ?? 0})` : year}
            </option>
          ))}
        </select>
      </label>
    </div>
    {chips.length ? (
      <div className="mt-4">
        <ActiveFilters chips={chips} onClearAll={clearAll} />
      </div>
    ) : null}
    </>
  );
}
