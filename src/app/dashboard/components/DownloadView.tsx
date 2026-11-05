"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useInstitutionOptions } from "./useInstitutionOptions";
import ActiveFilters, { type FilterChip } from "./ActiveFilters";
import { Download, Info, Loader2, ChevronDown, Search, Check, Lock } from "lucide-react";
import type { FileFormat, FilterOption } from "@/app/services";
import { downloadService, sitesService } from "@/app/services";
import { MATRIX_OPTIONS } from "@/app/lib/matrixColors";
import { writeGlobalFilters } from "@/app/lib/globalFilters";

// ── Types ─────────────────────────────────────────────────────────────────────

type DownloadViewProps = {
  projectOptions: FilterOption[];
  variableOptions: FilterOption[];
  countryOptions: string[];
  /** Seeded from the MFL_FILTERS cookie, so a value picked on another screen carries over here. */
  initialInstitution?: string;
  initialCountry?: string;
  initialMatrix?: string;
  /** From a dataset's "Download" link: that project, with all its sites and variables, is chosen up front. */
  initialProjectId?: number;
  /** The download audit log (all users) is visible to admins only. */
  isAdmin?: boolean;
};

type StepKey = "projects" | "sites" | "variables" | "dates";

// ── Helpers ─────────────────────────────────────────────────────────────────

const optionKey = (option: FilterOption) => String(option.id ?? option.code ?? option.label);

// ── Sub-components ────────────────────────────────────────────────────────────

const filterOptions = (options: FilterOption[], query: string) => {
  const q = query.trim().toLowerCase();
  return q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;
};

/**
 * One step of the download, opened one at a time. A step stays locked until the one
 * before it has something chosen (there is nothing to pick sites from without a
 * project), says in its header what is chosen once closed, and offers "Continue".
 * All four open at once was a wall of options for anyone who did not already know the data.
 */
function StepSection({
  index,
  title,
  subtitle,
  locked,
  lockedHint,
  done,
  summary,
  open,
  onToggle,
  onSelectAll,
  onClear,
  selectedCount,
  onNext,
  children,
}: {
  index: number;
  title: string;
  subtitle: string;
  locked: boolean;
  lockedHint?: string;
  done: boolean;
  summary: string;
  open: boolean;
  onToggle: () => void;
  onSelectAll?: () => void;
  onClear?: () => void;
  selectedCount?: number;
  onNext?: () => void;
  children: React.ReactNode;
}) {
  const t = useTranslations("download");
  const isOpen = open && !locked;
  const circle = locked
    ? "bg-gray-100 text-gray-400"
    : done
    ? "bg-brand-700 text-white"
    : "border-2 border-blue-600 bg-white text-blue-700";

  return (
    <div className={`rounded-2xl border bg-white shadow-sm ${locked ? "border-gray-100" : "border-gray-200"}`}>
      <div className="flex items-start justify-between gap-3 p-5">
        <button
          type="button"
          onClick={onToggle}
          disabled={locked}
          aria-expanded={isOpen}
          className="flex flex-1 items-start gap-3 text-left disabled:cursor-not-allowed"
        >
          <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${circle}`}>
            {done && !locked ? <Check className="h-4 w-4" strokeWidth={3} aria-hidden /> : index}
          </span>
          <span className="min-w-0">
            <span className={`block text-base font-semibold ${locked ? "text-gray-400" : "text-gray-900"}`}>{title}</span>
            <span className="block text-sm text-gray-500">
              {locked ? (
                <span className="inline-flex items-center gap-1">
                  <Lock className="h-3 w-3" aria-hidden />
                  {lockedHint}
                </span>
              ) : !isOpen && done ? (
                <span className="font-medium text-brand-800">{summary}</span>
              ) : (
                subtitle
              )}
            </span>
          </span>
          {locked ? null : <ChevronDown className={`ml-auto mt-1 h-5 w-5 shrink-0 text-gray-400 transition-transform ${isOpen ? "" : "-rotate-90"}`} aria-hidden />}
        </button>
        {isOpen ? (
          <div className="flex shrink-0 items-center gap-3 pt-0.5">
            {onSelectAll ? (
              <button type="button" onClick={onSelectAll} className="text-sm font-medium text-brand-800 transition-colors hover:text-brand-900">
                {t("selectAll")}
              </button>
            ) : null}
            {onClear && selectedCount ? (
              <button type="button" onClick={onClear} className="text-sm font-medium text-gray-500 transition-colors hover:text-gray-700">
                {t("selectNone")}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
      {isOpen ? (
        <div className="px-5 pb-5">
          {children}
          {onNext ? (
            <div className="mt-5 flex justify-end border-t border-gray-100 pt-4">
              <button
                type="button"
                onClick={onNext}
                disabled={!done}
                className="inline-flex items-center gap-2 rounded-xl bg-brand-700 px-5 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {t("next")}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/** Search input used inside the Sites / Variables sections. */
function OptionSearch({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="relative mb-3">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-10 w-full rounded-xl border border-gray-200 bg-gray-50 pl-9 pr-3 text-sm text-gray-700 outline-none transition focus:border-brand-500 focus:bg-white"
      />
    </div>
  );
}

function OptionGrid({
  options,
  selected,
  onToggle,
  columns = 2,
  emptyLabel,
}: {
  options: FilterOption[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  columns?: number;
  emptyLabel?: string;
}) {
  if (options.length === 0) {
    return <p className="text-sm text-gray-400">{emptyLabel ?? "No hay opciones disponibles."}</p>;
  }

  return (
    <div
      className={`grid gap-3 ${
        columns === 2 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1"
      }`}
    >
      {options.map((opt) => {
        const key = optionKey(opt);
        const isSelected = selected.has(key);
        return (
          <label
            key={key}
            className={`relative flex items-center gap-3 rounded-xl border p-3.5 cursor-pointer transition-colors ${
              isSelected
                ? "border-brand-300 bg-brand-50"
                : "border-gray-200 bg-white hover:border-gray-300"
            }`}
          >
            {/* The input fills the label (transparent) instead of being off-screen
                (sr-only), so focusing it on click never scroll-jumps the page. */}
            <input
              type="checkbox"
              className="absolute inset-0 m-0 h-full w-full cursor-pointer opacity-0"
              checked={isSelected}
              onChange={() => onToggle(key)}
            />
            <div
              className={`h-5 w-5 rounded flex items-center justify-center border transition-colors shrink-0 ${
                isSelected
                  ? "border-brand-700 bg-brand-700"
                  : "border-gray-300 bg-white"
              }`}
            >
              {isSelected && (
                <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 12 12">
                  <path
                    d="M2 6l3 3 5-5"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </div>
            <span className="text-sm text-gray-700">{opt.label}</span>
          </label>
        );
      })}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function DownloadView({
  projectOptions,
  variableOptions,
  countryOptions,
  initialInstitution,
  initialCountry,
  initialMatrix,
  initialProjectId,
  isAdmin = false,
}: DownloadViewProps) {
  void isAdmin;
  const t = useTranslations("download");
  const tf = useTranslations("filters");
  const locale = useLocale();
  const [selectedProjects, setSelectedProjects] = useState<Set<string>>(
    () => new Set(initialProjectId && projectOptions.some((p) => p.id === initialProjectId) ? [String(initialProjectId)] : []),
  );
  const [selectedSites, setSelectedSites] = useState<Set<string>>(new Set());
  const [selectedVariables, setSelectedVariables] = useState<Set<string>>(new Set());
  const [format, setFormat] = useState<FileFormat>("xlsx");
  const [includeMetadata, setIncludeMetadata] = useState(true);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [institution, setInstitution] = useState(initialInstitution ?? "");
  const [country, setCountry] = useState(initialCountry ?? "");
  const [matrix, setMatrix] = useState(initialMatrix ?? "");
  const institutionOptions = useInstitutionOptions();

  const changeInstitution = (value: string) => {
    setInstitution(value);
    writeGlobalFilters({ institution: value || undefined });
  };
  const changeCountry = (value: string) => {
    setCountry(value);
    writeGlobalFilters({ country: value || undefined });
  };
  const changeMatrix = (value: string) => {
    setMatrix(value);
    writeGlobalFilters({ matrix: value || undefined });
  };

  const [siteOptions, setSiteOptions] = useState<FilterOption[]>([]);
  const [loadingSites, setLoadingSites] = useState(false);
  const [estimate, setEstimate] = useState<number | null>(null);
  const [estimating, setEstimating] = useState(false);
  const [siteSearch, setSiteSearch] = useState("");
  const [variableSearch, setVariableSearch] = useState("");
  const [openStep, setOpenStep] = useState<StepKey | null>("projects");
  // What has data under the choices so far; null until the first answer.
  const [facets, setFacets] = useState<{ projects: Set<number>; variables: Set<number>; dateMin: string | null; dateMax: string | null } | null>(null);
  // Arrived from a dataset's "Download" link: choose its sites and variables for the person, once.
  const deepLink = useRef<{ sites: boolean; variables: boolean }>({
    sites: Boolean(initialProjectId) && projectOptions.some((p) => p.id === initialProjectId),
    variables: Boolean(initialProjectId) && projectOptions.some((p) => p.id === initialProjectId),
  });
  const [fromDataset, setFromDataset] = useState(deepLink.current.sites);

  // Narrowed by what actually has data: a project, or a variable, that the filters would
  // leave without a single record is not offered, instead of being found out at "0 records".
  const visibleProjects = useMemo(
    () => (facets ? projectOptions.filter((o) => o.id !== undefined && facets.projects.has(o.id)) : projectOptions),
    [projectOptions, facets],
  );
  const visibleVariables = useMemo(
    () => (facets ? variableOptions.filter((o) => o.id !== undefined && facets.variables.has(o.id)) : variableOptions),
    [variableOptions, facets],
  );
  const filteredSites = useMemo(() => filterOptions(siteOptions, siteSearch), [siteOptions, siteSearch]);
  const filteredVariables = useMemo(() => filterOptions(visibleVariables, variableSearch), [visibleVariables, variableSearch]);

  const toggleItem = (
    setFn: React.Dispatch<React.SetStateAction<Set<string>>>,
    id: string,
  ) => {
    setFn((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = (
    options: FilterOption[],
    setFn: React.Dispatch<React.SetStateAction<Set<string>>>,
  ) => {
    setFn(new Set(options.map(optionKey)));
  };

  const clearAll = () => {
    setSelectedProjects(new Set());
    setSelectedSites(new Set());
    setSelectedVariables(new Set());
    setDateFrom("");
    setDateTo("");
    setOpenStep("projects");
  };

  const selectedProjectIds = useMemo(
    () => Array.from(selectedProjects).map(Number).filter(Number.isFinite),
    [selectedProjects],
  );
  const selectedSiteIds = useMemo(
    () => Array.from(selectedSites).map(Number).filter(Number.isFinite),
    [selectedSites],
  );
  const selectedVariableIds = useMemo(
    () => Array.from(selectedVariables).map(Number).filter(Number.isFinite),
    [selectedVariables],
  );

  // Every site of the chosen projects is the same as no site filter, and sending thousands of ids
  // in a GET URL breaks the request (a project can have 4,000+ sites).
  const effectiveSiteIds = useMemo(
    () => (siteOptions.length > 0 && selectedSiteIds.length === siteOptions.length ? [] : selectedSiteIds),
    [siteOptions.length, selectedSiteIds],
  );

  // Load sites whenever the set of selected projects changes.
  useEffect(() => {
    if (selectedProjectIds.length === 0) {
      setSiteOptions([]);
      setSelectedSites(new Set());
      return;
    }

    let active = true;
    setLoadingSites(true);

    Promise.all(selectedProjectIds.map((id) => sitesService.getOptions(id)))
      .then((results) => {
        if (!active) return;
        const byId = new Map<string, FilterOption>();
        results.flat().forEach((option) => {
          byId.set(optionKey(option), option);
        });
        const options = Array.from(byId.values());
        setSiteOptions(options);
        if (deepLink.current.sites) {
          deepLink.current.sites = false;
          setSelectedSites(new Set(options.map(optionKey)));
        } else {
          // Drop selected sites that no longer belong to the selected projects.
          const validKeys = new Set(options.map(optionKey));
          setSelectedSites((prev) => new Set(Array.from(prev).filter((key) => validKeys.has(key))));
        }
      })
      .catch(() => {
        if (active) setSiteOptions([]);
      })
      .finally(() => {
        if (active) setLoadingSites(false);
      });

    return () => {
      active = false;
    };
  }, [selectedProjectIds]);

  // Ask what has data under the choices so far (cascading filters + the real date span).
  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      downloadService
        .facets({
          institution: institution || undefined,
          country: country || undefined,
          matrix: matrix || undefined,
          project_ids: selectedProjectIds,
          site_ids: effectiveSiteIds,
          variable_ids: selectedVariableIds,
        })
        .then((response) => {
          if (!active) return;
          const projects = new Set(response.project_ids);
          const variables = new Set(response.variable_ids);
          setFacets({ projects, variables, dateMin: response.date_min ?? null, dateMax: response.date_max ?? null });
          // Whatever was chosen and no longer has data under the filters is dropped, not kept hidden.
          setSelectedProjects((prev) => {
            const kept = new Set(Array.from(prev).filter((key) => projects.has(Number(key))));
            return kept.size === prev.size ? prev : kept;
          });
          setSelectedVariables((prev) => {
            const kept = new Set(Array.from(prev).filter((key) => variables.has(Number(key))));
            return kept.size === prev.size ? prev : kept;
          });
        })
        .catch(() => {
          if (active) setFacets(null);
        });
    }, 300);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [institution, country, matrix, selectedProjectIds, effectiveSiteIds, selectedVariableIds]);

  // From a dataset's link: once its sites are chosen and its variables are known, choose them all.
  useEffect(() => {
    if (!deepLink.current.variables || !facets || selectedSiteIds.length === 0) return;
    deepLink.current.variables = false;
    setSelectedVariables(new Set(variableOptions.filter((o) => o.id !== undefined && facets.variables.has(o.id)).map(optionKey)));
    setOpenStep("variables");
  }, [facets, selectedSiteIds.length, variableOptions]);

  // (The download audit log lives in the Traceability section — /dashboard/logs.)

  const isComplete =
    selectedProjectIds.length > 0 && selectedSiteIds.length > 0 && selectedVariableIds.length > 0;

  const filters = useMemo(
    () => ({
      project_ids: selectedProjectIds,
      site_ids: effectiveSiteIds,
      variable_ids: selectedVariableIds,
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
      institution: institution || undefined,
      country: country || undefined,
      matrix: matrix || undefined,
    }),
    [selectedProjectIds, effectiveSiteIds, selectedVariableIds, dateFrom, dateTo, institution, country, matrix],
  );

  // Fetch a real estimate (debounced) whenever the selection is complete.
  useEffect(() => {
    if (!isComplete) {
      setEstimate(null);
      return;
    }

    let active = true;
    setEstimating(true);
    const timer = setTimeout(() => {
      downloadService
        .estimate(filters)
        .then((response) => {
          if (active) setEstimate(response.record_count);
        })
        .catch(() => {
          if (active) setEstimate(null);
        })
        .finally(() => {
          if (active) setEstimating(false);
        });
    }, 300);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [filters, isComplete]);

  const missing = [
    selectedProjectIds.length === 0 ? t("summary.missingProject") : null,
    selectedSiteIds.length === 0 ? t("summary.missingSite") : null,
    selectedVariableIds.length === 0 ? t("summary.missingVariable") : null,
  ].filter((item): item is string => item !== null);
  // The count is exact (the export runs the same query), so 0 means an empty file.
  const hasNoRecords = isComplete && !estimating && estimate === 0;

  const handleDownload = () => {
    if (!isComplete || hasNoRecords) return;
    const url = downloadService.buildExportUrl({
      ...filters,
      format,
      include_metadata: includeMetadata,
    });
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const chips: FilterChip[] = [
    institution ? { key: "institution", label: tf("institution"), value: institution, onRemove: () => changeInstitution("") } : null,
    country ? { key: "country", label: tf("country"), value: country, onRemove: () => changeCountry("") } : null,
    matrix ? { key: "matrix", label: tf("matrix"), value: matrix, onRemove: () => changeMatrix("") } : null,
    dateFrom || dateTo
      ? {
          key: "dates",
          label: tf("dates"),
          value: `${dateFrom || "…"} → ${dateTo || "…"}`,
          onRemove: () => {
            setDateFrom("");
            setDateTo("");
          },
        }
      : null,
  ].filter((chip): chip is FilterChip => chip !== null);

  const clearChips = () => {
    changeInstitution("");
    changeCountry("");
    changeMatrix("");
    setDateFrom("");
    setDateTo("");
  };

  const datasetName =
    initialProjectId !== undefined ? projectOptions.find((p) => p.id === initialProjectId)?.label ?? "" : "";
  const fmtSpan = (value: string | null) => value ?? "…";

  return (
    <div className="px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">{t("header.title")}</h1>
        <p className="mt-1 text-sm text-gray-500">{t("header.subtitle")}</p>
      </div>

      <div className="mb-4 space-y-3">
        <ActiveFilters chips={chips} onClearAll={clearChips} />
        {fromDataset && datasetName ? (
          <p className="flex items-start gap-2 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-900">
            <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            {t("fromDataset", { name: datasetName })}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* ── Left column ─────────────────────────────────────────────────── */}
        <div className="flex-1 space-y-4 min-w-0">
          {/* 1 · Projects (narrowed by Institution / Country / Matrix) */}
          <StepSection
            index={1}
            title={t("projects.title")}
            subtitle={t("projects.subtitle")}
            locked={false}
            done={selectedProjectIds.length > 0}
            summary={t("stepSummary", { count: selectedProjectIds.length })}
            open={openStep === "projects"}
            onToggle={() => setOpenStep(openStep === "projects" ? null : "projects")}
            onSelectAll={() => selectAll(visibleProjects, setSelectedProjects)}
            onClear={() => setSelectedProjects(new Set())}
            selectedCount={selectedProjects.size}
            onNext={() => setOpenStep("sites")}
          >
            <div className="mb-5 grid gap-4 sm:grid-cols-3">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-gray-700">{tf("institution")}</span>
                <select
                  value={institution}
                  onChange={(e) => changeInstitution(e.target.value)}
                  className="h-11 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm text-gray-700 outline-none transition focus:border-brand-500 focus:bg-white"
                >
                  <option value="">{tf("allInstitutions")}</option>
                  {institutionOptions.map((option) => (
                    <option key={option.label} value={option.label}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-gray-700">{tf("country")}</span>
                <select
                  value={country}
                  onChange={(e) => changeCountry(e.target.value)}
                  className="h-11 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm text-gray-700 outline-none transition focus:border-brand-500 focus:bg-white"
                >
                  <option value="">{tf("allCountries")}</option>
                  {countryOptions.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-gray-700">{tf("matrix")}</span>
                <select
                  value={matrix}
                  onChange={(e) => changeMatrix(e.target.value)}
                  className="h-11 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm text-gray-700 outline-none transition focus:border-brand-500 focus:bg-white"
                >
                  <option value="">{tf("allMatrices")}</option>
                  {MATRIX_OPTIONS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {facets && visibleProjects.length < projectOptions.length ? (
              <p className="mb-3 text-xs text-gray-500">
                {t("projects.narrowed", { shown: visibleProjects.length, total: projectOptions.length })}
              </p>
            ) : null}
            <OptionGrid
              options={visibleProjects}
              selected={selectedProjects}
              onToggle={(id) => toggleItem(setSelectedProjects, id)}
              columns={2}
              emptyLabel={facets && projectOptions.length > 0 ? t("projects.noneForFilters") : t("projects.empty")}
            />
          </StepSection>

          {/* 2 · Sampling sites */}
          <StepSection
            index={2}
            title={t("sites.title")}
            subtitle={t("sites.subtitle")}
            locked={selectedProjectIds.length === 0}
            lockedHint={t("locked.sites")}
            done={selectedSiteIds.length > 0}
            summary={t("stepSummary", { count: selectedSiteIds.length })}
            open={openStep === "sites"}
            onToggle={() => setOpenStep(openStep === "sites" ? null : "sites")}
            onSelectAll={() => selectAll(filteredSites, setSelectedSites)}
            onClear={() => setSelectedSites(new Set())}
            selectedCount={selectedSites.size}
            onNext={() => setOpenStep("variables")}
          >
            {loadingSites ? (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t("sites.loading")}
              </div>
            ) : (
              <>
                {siteOptions.length > 0 ? (
                  <OptionSearch value={siteSearch} onChange={setSiteSearch} placeholder={t("sites.searchPlaceholder")} />
                ) : null}
                <div className="max-h-96 overflow-y-auto pr-1">
                  <OptionGrid
                    options={filteredSites}
                    selected={selectedSites}
                    onToggle={(id) => toggleItem(setSelectedSites, id)}
                    columns={2}
                    emptyLabel={siteSearch ? t("noMatches") : t("sites.empty")}
                  />
                </div>
              </>
            )}
          </StepSection>

          {/* 3 · Variables (only those that exist in the chosen projects and sites) */}
          <StepSection
            index={3}
            title={t("variables.title")}
            subtitle={t("variables.subtitle")}
            locked={selectedSiteIds.length === 0}
            lockedHint={t("locked.variables")}
            done={selectedVariableIds.length > 0}
            summary={t("stepSummary", { count: selectedVariableIds.length })}
            open={openStep === "variables"}
            onToggle={() => setOpenStep(openStep === "variables" ? null : "variables")}
            onSelectAll={() => selectAll(filteredVariables, setSelectedVariables)}
            onClear={() => setSelectedVariables(new Set())}
            selectedCount={selectedVariables.size}
            onNext={() => setOpenStep("dates")}
          >
            {facets && visibleVariables.length < variableOptions.length ? (
              <p className="mb-3 text-xs text-gray-500">
                {t("variables.narrowed", { shown: visibleVariables.length, total: variableOptions.length })}
              </p>
            ) : null}
            {visibleVariables.length > 0 ? (
              <OptionSearch value={variableSearch} onChange={setVariableSearch} placeholder={t("variables.searchPlaceholder")} />
            ) : null}
            <div className="max-h-96 overflow-y-auto pr-1">
              <OptionGrid
                options={filteredVariables}
                selected={selectedVariables}
                onToggle={(id) => toggleItem(setSelectedVariables, id)}
                columns={1}
                emptyLabel={variableSearch ? t("noMatches") : t("variables.empty")}
              />
            </div>
          </StepSection>

          {/* 4 · Date range (optional) — with the span the data really covers */}
          <StepSection
            index={4}
            title={t("dateRange.title")}
            subtitle={t("dateRange.subtitle")}
            locked={selectedVariableIds.length === 0}
            lockedHint={t("locked.dates")}
            done={selectedVariableIds.length > 0}
            summary={dateFrom || dateTo ? `${dateFrom || "…"} → ${dateTo || "…"}` : t("allDates")}
            open={openStep === "dates"}
            onToggle={() => setOpenStep(openStep === "dates" ? null : "dates")}
          >
            {facets && (facets.dateMin || facets.dateMax) ? (
              <p className="mb-3 text-sm text-gray-600">
                {t("dateRange.available", { from: fmtSpan(facets.dateMin), to: fmtSpan(facets.dateMax) })}
              </p>
            ) : facets ? (
              <p className="mb-3 flex items-start gap-2 text-sm text-amber-700">
                <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                {t("dateRange.none")}
              </p>
            ) : null}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  {t("dateRange.from")}
                </label>
                <input
                  type="date"
                  value={dateFrom}
                  min={facets?.dateMin ?? undefined}
                  max={dateTo || facets?.dateMax || undefined}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-700 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  {t("dateRange.to")}
                </label>
                <input
                  type="date"
                  value={dateTo}
                  min={dateFrom || facets?.dateMin || undefined}
                  max={facets?.dateMax ?? undefined}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-700 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 focus:outline-none"
                />
              </div>
            </div>
            {dateFrom || dateTo ? (
              <button
                type="button"
                onClick={() => {
                  setDateFrom("");
                  setDateTo("");
                }}
                className="mt-3 text-sm font-medium text-brand-800 hover:text-brand-900"
              >
                {t("dateRange.all")}
              </button>
            ) : null}
          </StepSection>
        </div>

        {/* ── Right column (sidebar) ───────────────────────────────────────── */}
        <div className="w-full lg:w-80 space-y-4 shrink-0">
          {/* Export config */}
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <h3 className="text-base font-semibold text-gray-900 mb-0.5">
              {t("export.title")}
            </h3>
            <p className="text-sm text-gray-500 mb-5">{t("export.subtitle")}</p>

            {/* Format */}
            <p className="text-sm font-medium text-gray-700 mb-3">{t("export.fileFormat")}</p>
            <div className="space-y-2 mb-5">
              {(
                [
                  {
                    id: "xlsx" as FileFormat,
                    label: t("export.excelLabel"),
                    sub: t("export.excelSub"),
                  },
                  {
                    id: "csv" as FileFormat,
                    label: t("export.csvLabel"),
                    sub: t("export.csvSub"),
                  },
                ] as { id: FileFormat; label: string; sub: string }[]
              ).map((f) => (
                <label
                  key={f.id}
                  className={`flex items-start gap-3 rounded-xl border p-3.5 cursor-pointer transition-colors ${
                    format === f.id
                      ? "border-brand-300 bg-brand-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <div
                    className={`mt-0.5 h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                      format === f.id ? "border-brand-700" : "border-gray-300"
                    }`}
                  >
                    {format === f.id && (
                      <div className="h-2 w-2 rounded-full bg-brand-700" />
                    )}
                  </div>
                  <input
                    type="radio"
                    className="sr-only"
                    name="format"
                    value={f.id}
                    checked={format === f.id}
                    onChange={() => setFormat(f.id)}
                  />
                  <div>
                    <p className="text-sm font-medium text-gray-800">{f.label}</p>
                    <p className="text-xs text-gray-500">{f.sub}</p>
                  </div>
                </label>
              ))}
            </div>

            {/* Additional options */}
            <p className="text-sm font-medium text-gray-700 mb-3">{t("export.additionalOptions")}</p>
            <label className="flex items-start gap-3 rounded-xl border border-gray-200 p-3.5 cursor-pointer hover:border-gray-300 transition-colors">
              <div
                className={`h-5 w-5 rounded flex items-center justify-center border transition-colors shrink-0 mt-0.5 ${
                  includeMetadata
                    ? "border-brand-700 bg-brand-700"
                    : "border-gray-300 bg-white"
                }`}
              >
                {includeMetadata && (
                  <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 12 12">
                    <path
                      d="M2 6l3 3 5-5"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </div>
              <input
                type="checkbox"
                className="sr-only"
                checked={includeMetadata}
                onChange={(e) => setIncludeMetadata(e.target.checked)}
              />
              <div>
                <p className="text-sm font-medium text-gray-800">{t("export.includeMetadata")}</p>
                <p className="text-xs text-gray-500">{t("export.includeMetadataSub")}</p>
              </div>
            </label>
          </div>

          {/* Selection summary */}
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">
              {t("summary.title")}
            </h3>
            <div className="space-y-2 mb-4">
              {[
                { label: t("summary.projects"), count: selectedProjectIds.length },
                { label: t("summary.sites"), count: selectedSiteIds.length },
                { label: t("summary.variables"), count: selectedVariableIds.length },
              ].map((row) => (
                <div key={row.label} className="flex justify-between text-sm">
                  <span className="text-gray-600">{row.label}</span>
                  <span
                    className={`font-medium ${
                      row.count > 0 ? "text-brand-800" : "text-gray-400"
                    }`}
                  >
                    {row.count}
                  </span>
                </div>
              ))}
              <div className="pt-2 border-t border-gray-100 flex justify-between text-sm">
                <span className="text-gray-600">{t("summary.estimatedRecords")}</span>
                <span
                  className={`font-semibold ${
                    isComplete ? "text-brand-800" : "text-gray-400"
                  }`}
                >
                  {!isComplete
                    ? "—"
                    : estimating
                    ? t("summary.calculating")
                    : estimate === null
                    ? "—"
                    : estimate.toLocaleString(locale === "en" ? "en-US" : "es-CO")}
                </span>
              </div>
            </div>

            {!isComplete && (
              <div className="flex items-start gap-2 rounded-xl bg-gray-50 border border-gray-100 p-3 mb-4">
                <Info className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-medium text-gray-600">{t("summary.incompleteTitle")}</p>
                  <p className="text-xs text-gray-500">{t("summary.incompleteBody", { items: missing.join(", ") })}</p>
                </div>
              </div>
            )}

            {hasNoRecords && (
              <div className="flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-200 p-3 mb-4">
                <Info className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-medium text-amber-800">{t("summary.noRecordsTitle")}</p>
                  <p className="text-xs text-amber-700">{t("summary.noRecordsBody")}</p>
                </div>
              </div>
            )}

            <button
              disabled={!isComplete || hasNoRecords}
              onClick={handleDownload}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-brand-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Download className="h-4 w-4" />
              {t("summary.download")}
            </button>
            <button
              onClick={clearAll}
              className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              {t("summary.clear")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
