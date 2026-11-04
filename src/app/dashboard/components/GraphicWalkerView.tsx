"use client";

import { useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import dynamic from "next/dynamic";
import { useLocale, useTranslations } from "next-intl";
import { useInstitutionOptions } from "./useInstitutionOptions";
import { useGraphicWalkerTour } from "./useGraphicWalkerTour";
import { StyleSheetManager } from "styled-components";
import isPropValid from "@emotion/is-prop-valid";
import { Loader2, TableProperties, AlertTriangle, Info, Search, SlidersHorizontal, X } from "lucide-react";
import type { IMutField } from "@kanaries/graphic-walker";
import type { FilterOption, VariableRead, WideColumn } from "@/app/services";
import { dashboardService, downloadService } from "@/app/services";
import { writeGlobalFilters } from "@/app/lib/globalFilters";
import ActiveFilters, { type FilterChip } from "./ActiveFilters";

/**
 * Minimal prop contract for GraphicWalker. The library types it as an overloaded
 * function (local vs remote computation); next/dynamic collapses that to one
 * overload, so we cast to this local-computation shape.
 */
type GraphicWalkerProps = {
  data: Record<string, unknown>[];
  fields: IMutField[];
  chart?: unknown[];
  appearance?: "light" | "dark" | "media";
  i18nLang?: string;
  className?: string;
  /** Applied to every chart tab (first one and any "+" added afterwards). */
  defaultConfig?: { layout?: { size?: { mode?: "auto" | "fixed" | "full" } } };
};

/** "full" is the library's internal name for what its own UI calls "Container"
 * layout mode (vs. "Fixed" or "Auto") — see node_modules/@kanaries/graphic-walker's
 * locales/en-US.json under layout_type. */
const CONTAINER_LAYOUT = { layout: { size: { mode: "full" as const } } };

const GraphicWalker = dynamic(
  () =>
    import("@kanaries/graphic-walker").then(
      (m) => m.GraphicWalker as unknown as ComponentType<GraphicWalkerProps>,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center gap-2 text-sm text-gray-500">
        <Loader2 className="h-4 w-4 animate-spin" />
      </div>
    ),
  },
);

/**
 * Client-side row budget for the explorer. Set to the top of Graphic Walker's
 * own "10K-100K: Good" bracket (its docs), since gzip on the API keeps the
 * transfer cheap — the real ceiling is browser memory, not the network.
 *
 * Datasets bigger than this need server-side computation (Graphic Walker's
 * "computation" prop) rather than a higher number here.
 */
const MAX_ROWS = 100000;
const MAX_WIDE_VARS = 12;

/** GET /variables returns the display name as `label` (sometimes `name` is null). */
const variableLabel = (v: VariableRead) => {
  const base = v.name?.trim() || v.label?.trim() || v.variable_code?.trim() || `Variable ${v.id}`;
  return v.matrix ? `${base} — ${v.matrix}` : base;
};

const DATE_KEY = "event_date";
const YEAR_KEY = "event_year";

/**
 * Graphic Walker's date filter reads every value of a temporal column as a date and
 * throws on an empty one ("Cannot read properties of null (reading 'getTime')"). Many
 * samples have no sampling date, so dragging Date to Filters broke the whole explorer.
 * A column with gaps is offered as plain categories instead, with the gap named, and
 * the year is added as its own column: the thing people actually want to filter by.
 */
const prepareDates = (
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

const wideColumnsToFields = (columns: WideColumn[]): IMutField[] =>
  columns.map((c) => ({
    fid: c.key,
    name: c.label,
    semanticType: c.semantic,
    analyticType: c.role,
  }));

/** Build a starter chart from a terse spec; normalize() lives in the client-only package. */
async function buildStarter(spec: object, fields: IMutField[]): Promise<unknown[] | undefined> {
  try {
    const { normalize } = await import("@kanaries/graphic-walker");
    return [normalize(spec, fields)];
  } catch {
    return undefined;
  }
}

const inputCls =
  "h-10 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm text-gray-700 outline-none transition focus:border-brand-500 focus:bg-white";
const labelCls = "mb-1 block text-sm font-medium text-gray-700";

type Props = {
  projectOptions: FilterOption[];
  variables: VariableRead[];
  /** Seeded from the MFL_FILTERS cookie, so a value picked on another screen carries over here. */
  initialInstitution?: string;
  /** From a dataset's "Chart it" link, or the map's site detail ("View in charts"). */
  initialProjectId?: string;
  initialSiteId?: string;
  initialSiteCode?: string;
  initialVariableId?: string;
  initialMatrix?: string;
};

/** How many of a dataset's variables are picked for someone who arrives without choosing any. */
const AUTO_PICK = 4;

export default function GraphicWalkerView({
  projectOptions,
  variables,
  initialInstitution,
  initialProjectId,
  initialSiteId,
  initialSiteCode,
  initialVariableId,
  initialMatrix,
}: Props) {
  const tf = useTranslations("filters");
  const t = useTranslations("graphicWalker");
  const locale = useLocale();
  const nf = (value: number) => value.toLocaleString(locale === "en" ? "en-US" : "es-CO");
  const [projectId, setProjectId] = useState(initialProjectId ?? "");
  const [siteId, setSiteId] = useState(initialSiteId ?? "");
  const [institution, setInstitution] = useState(initialInstitution ?? "");
  const institutionOptions = useInstitutionOptions();
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedVars, setSelectedVars] = useState<Set<number>>(() => {
    const id = Number(initialVariableId);
    return Number.isFinite(id) && id > 0 ? new Set([id]) : new Set();
  });
  const [allVariables, setAllVariables] = useState(false); // expose every variable
  const [wideMatrix, setWideMatrix] = useState(initialMatrix ?? ""); // only compare within one matrix
  // Variables that exist under the chosen project/site (null = not narrowed). A variable the
  // dataset does not have can only ever produce an empty chart, so it is not offered.
  const [scopeVariableIds, setScopeVariableIds] = useState<Set<number> | null>(null);
  const [autoPicked, setAutoPicked] = useState(0);
  // Measurements per variable under the chosen project/site, to start from the ones with data.
  const [scopeCounts, setScopeCounts] = useState<Record<string, number>>({});
  // Projects with data under the institution / matrix chosen, and the real span of the dates.
  const [facetProjects, setFacetProjects] = useState<Set<number> | null>(null);
  const [dateSpan, setDateSpan] = useState<{ min: string | null; max: string | null } | null>(null);
  const [reloadTick, setReloadTick] = useState(0);
  // Bumped to re-mount the explorer on a different starter chart.
  const [explorerKey, setExplorerKey] = useState(0);
  const [quickMeasure, setQuickMeasure] = useState("");
  const [varSearch, setVarSearch] = useState("");

  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [fields, setFields] = useState<IMutField[]>([]);
  const [initialChart, setInitialChart] = useState<unknown[] | undefined>(undefined);
  const [capped, setCapped] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  // Filters + guide start open (nothing loaded yet); a successful load collapses
  // them so the explorer gets the full screen. "Mostrar/Ocultar filtros" reopens
  // them to change the data scope.
  const [filtersOpen, setFiltersOpen] = useState(true);

  const variableChoices = useMemo(
    () =>
      variables.map((v) => ({
        id: v.id,
        label: variableLabel(v),
        matrix: v.matrix ?? null,
        numeric: (v.value_type ?? "").toLowerCase().startsWith("num"),
      })),
    [variables],
  );
  const matrixOptions = useMemo(
    () => Array.from(new Set(variables.map((v) => v.matrix).filter((m): m is string => Boolean(m)))).sort(),
    [variables],
  );
  // Variables are compared within a sample, and a sample is a single matrix, so
  // only same-matrix variables can be cross-plotted. Restrict the list accordingly.
  const filteredChoices = useMemo(() => {
    const q = varSearch.trim().toLowerCase();
    return variableChoices.filter(
      (v) =>
        (!wideMatrix || v.matrix === wideMatrix) &&
        (!scopeVariableIds || scopeVariableIds.has(v.id)) &&
        (!q || v.label.toLowerCase().includes(q)),
    );
  }, [variableChoices, varSearch, wideMatrix, scopeVariableIds]);

  // The checklist below scrolls, so a ticked box can be out of sight: echo the choice as chips.
  const selectedChoices = useMemo(
    () => variableChoices.filter((v) => selectedVars.has(v.id)),
    [variableChoices, selectedVars],
  );

  // What the one-click charts can be built from, read from the data that is on screen.
  const quick = useMemo(() => {
    const measures = fields.filter((f) => f.analyticType === "measure" && f.fid !== "gw_mea_key_fid");
    const nameOf = (fid: string) => fields.find((f) => f.fid === fid)?.name;
    const distinct = (key: string) => new Set(rows.map((r) => r[key]).filter((v) => v !== null && v !== undefined && v !== "")).size;
    return {
      measures,
      siteName: nameOf("site_code"),
      depthName: nameOf("depth_cm"),
      yearName: nameOf(YEAR_KEY),
      hasDepth: rows.some((r) => typeof r.depth_cm === "number"),
      sites: distinct("site_code"),
      years: new Set(rows.map((r) => r[YEAR_KEY]).filter((v) => typeof v === "number")).size,
    };
  }, [fields, rows]);

  const openQuickChart = async (kind: "depth" | "compare" | "perSite" | "overTime") => {
    const m = quick.measures.find((f) => f.fid === quickMeasure) ?? quick.measures[0];
    if (!m) return;
    const second = quick.measures.find((f) => f.fid !== m.fid);
    const spec =
      kind === "depth" && quick.depthName
        ? { mark: "point", x: m.name, y: quick.depthName, aggregate: false }
        : kind === "compare" && second
        ? { mark: "point", x: m.name, y: second.name, aggregate: false }
        : kind === "perSite" && quick.siteName
        ? { mark: "bar", x: quick.siteName, y: { field: m.name, aggregate: "mean" }, sort: "descending", limit: 30 }
        : kind === "overTime" && quick.yearName
        ? { mark: "line", x: quick.yearName, y: { field: m.name, aggregate: "mean" } }
        : null;
    if (!spec) return;
    const chart = await buildStarter({ name: t(`quick.${kind}`), ...spec, ...CONTAINER_LAYOUT }, fields);
    if (!chart) return;
    setInitialChart(chart);
    setExplorerKey((n) => n + 1);
  };

  const toggleVar = (id: number) => {
    setSelectedVars((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < MAX_WIDE_VARS) next.add(id);
      return next;
    });
  };

  /** Returns the row count, so `load()` can tell an empty result apart from a
   * real one without waiting on the (batched, possibly stale) `rows` state.
   * `institutionOverride` lets a caller force a value in the same tick it
   * clears `institution` state, instead of racing that state update. */
  const loadWide = async (institutionOverride?: string): Promise<number> => {
    const result = await dashboardService.getWideDataset({
      variable_ids: allVariables ? [] : Array.from(selectedVars),
      all_variables: allVariables || undefined,
      matrix: wideMatrix || undefined,
      project_id: projectId ? Number(projectId) : undefined,
      site_id: siteId ? Number(siteId) : undefined,
      institution: (institutionOverride ?? institution) || undefined,
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
      limit: MAX_ROWS,
      lang: locale === "en" ? "en" : "es",
    });
    const prepared = prepareDates(result.rows as Record<string, unknown>[], result.columns, {
      noDate: t("noDate"),
      year: t("yearColumn"),
    });
    const nextFields = wideColumnsToFields(prepared.columns);
    setRows(prepared.rows);
    setFields(nextFields);
    setCapped(result.total_samples >= MAX_ROWS);

    const measures = prepared.columns.filter((c) => c.role === "measure");
    const starter =
      measures.length >= 2
        ? await buildStarter(
            {
              name: t("starter.scatter"),
              mark: "point",
              x: measures[0].label,
              y: measures[1].label,
              aggregate: false,
              ...CONTAINER_LAYOUT,
            },
            nextFields,
          )
        : undefined;
    setInitialChart(starter);
    return result.rows.length;
  };

  const load = async (institutionOverride?: string) => {
    if (!allVariables && selectedVars.size < 1) {
      setError(t("selectAtLeastOne"));
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const count = await loadWide(institutionOverride);
      setLoaded(true);
      // An empty result is easy to mistake for "still loading", especially once
      // Institution (set on another screen — see writeGlobalFilters) silently
      // zeroes out a project/variable combination that does have data elsewhere.
      // Keep the filter bar open (Institution included) instead of collapsing
      // it, so the likely culprit is right there instead of hidden.
      setFiltersOpen(count === 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("loadError"));
    } finally {
      setLoading(false);
    }
  };

  // What has data under the institution / matrix / project / site chosen: the project list, the
  // variable list and the date span all narrow to it, so no combination ends in an empty chart.
  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      downloadService
        .facets({
          institution: institution || undefined,
          matrix: wideMatrix || undefined,
          project_ids: projectId ? [Number(projectId)] : undefined,
          site_ids: siteId ? [Number(siteId)] : undefined,
        })
        .then((facets) => {
          if (!active) return;
          const ids = new Set(facets.variable_ids);
          setScopeVariableIds(ids);
          setScopeCounts(facets.variable_counts ?? {});
          setFacetProjects(new Set(facets.project_ids));
          setDateSpan({ min: facets.date_min ?? null, max: facets.date_max ?? null });
          setSelectedVars((prev) => {
            const kept = new Set(Array.from(prev).filter((id) => ids.has(id)));
            return kept.size === prev.size ? prev : kept;
          });
        })
        .catch(() => {
          if (!active) return;
          setScopeVariableIds(null);
          setFacetProjects(null);
          setDateSpan(null);
        });
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [institution, wideMatrix, projectId, siteId]);

  // Arriving with only a dataset (no variables): start from some of its own, so the explorer
  // opens on data instead of on an empty "pick variables" form.
  const autoPickDone = useRef(false);
  useEffect(() => {
    if (autoPickDone.current || !initialProjectId || initialVariableId || !scopeVariableIds) return;
    autoPickDone.current = true;
    // Variables only compare when they come from the same kind of sample, and an empty chart is
    // what a random pick gives: take the best-measured variable and its neighbours in that matrix.
    const ranked = variableChoices
      .filter((v) => scopeVariableIds.has(v.id) && v.numeric)
      .sort((a, b) => (scopeCounts[b.id] ?? 0) - (scopeCounts[a.id] ?? 0));
    const matrix = ranked[0]?.matrix;
    const picks = ranked
      .filter((v) => v.matrix === matrix)
      .slice(0, AUTO_PICK)
      .map((v) => v.id);
    if (!picks.length) return;
    setSelectedVars(new Set(picks));
    setAutoPicked(picks.length);
    setReloadTick((n) => n + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeVariableIds]);

  // Coming from the map's site detail with a variable already chosen: load it right away.
  const deepLinkLoaded = useRef(false);
  useEffect(() => {
    if (deepLinkLoaded.current || !initialVariableId || selectedVars.size === 0) return;
    deepLinkLoaded.current = true;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A filter removed from the chips applies to the data on screen straight away.
  useEffect(() => {
    if (reloadTick === 0) return;
    if (selectedVars.size > 0 || allVariables) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadTick]);

  const removeChip = (apply: () => void) => {
    apply();
    setReloadTick((n) => n + 1);
  };

  const chips: FilterChip[] = [
    institution
      ? {
          key: "institution",
          label: tf("institution"),
          value: institution,
          onRemove: () =>
            removeChip(() => {
              setInstitution("");
              writeGlobalFilters({ institution: undefined });
            }),
        }
      : null,
    projectId
      ? {
          key: "project",
          label: t("project"),
          value: projectOptions.find((p) => String(p.id) === projectId)?.label ?? `#${projectId}`,
          onRemove: () =>
            removeChip(() => {
              setProjectId("");
              setSiteId("");
            }),
        }
      : null,
    siteId
      ? { key: "site", label: tf("site"), value: initialSiteCode && siteId === initialSiteId ? initialSiteCode : `#${siteId}`, onRemove: () => removeChip(() => setSiteId("")) }
      : null,
    wideMatrix
      ? {
          key: "matrix",
          label: t("matrixLabel"),
          value: wideMatrix,
          onRemove: () =>
            removeChip(() => {
              setWideMatrix("");
              setSelectedVars(new Set());
            }),
        }
      : null,
    dateFrom || dateTo
      ? {
          key: "dates",
          label: tf("dates"),
          value: `${dateFrom || "…"} → ${dateTo || "…"}`,
          onRemove: () =>
            removeChip(() => {
              setDateFrom("");
              setDateTo("");
            }),
        }
      : null,
  ].filter((chip): chip is FilterChip => chip !== null);

  const clearAllChips = () =>
    removeChip(() => {
      setInstitution("");
      writeGlobalFilters({ institution: undefined });
      setProjectId("");
      setSiteId("");
      setWideMatrix("");
      setDateFrom("");
      setDateTo("");
    });

  const clearInstitutionAndReload = () => {
    setInstitution("");
    writeGlobalFilters({ institution: undefined });
    void load("");
  };

  useGraphicWalkerTour(
    {
      project: { title: t("tour.project.title"), description: t("tour.project.description") },
      variables: { title: t("tour.variables.title"), description: t("tour.variables.description") },
      loadButton: { title: t("tour.loadButton.title"), description: t("tour.loadButton.description") },
      canvas: { title: t("tour.canvas.title"), description: t("tour.canvas.description") },
      next: t("tour.next"),
      done: t("tour.done"),
      close: t("tour.close"),
    },
    loaded && rows.length > 0,
  );

  // Once data is loaded, the filter bar and the how-to guide have done their job
  // (Graphic Walker's own Filters shelf takes over from here) — collapse them so
  // the explorer gets the full screen. "Mostrar filtros" reopens them to change
  // the data scope and reload.
  const focusMode = !filtersOpen;

  return (
    <div
      className={`flex flex-col gap-4 px-4 py-4 sm:px-6 lg:px-8 lg:py-6 ${focusMode ? "h-screen overflow-hidden" : ""}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold text-gray-900">{t("title")}</h1>
          <p className="mt-1 text-base text-gray-500">{t("subtitle")}</p>
        </div>

        <button
          type="button"
          onClick={() => setFiltersOpen((open) => !open)}
          className="inline-flex h-10 shrink-0 items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50"
        >
          <SlidersHorizontal className="h-4 w-4" />
          {filtersOpen ? t("hideFilters") : t("showFilters")}
        </button>
      </div>

      <ActiveFilters chips={chips} onClearAll={clearAllChips} />

      {autoPicked > 0 ? (
        <p className="flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-800">
          <Info className="h-4 w-4 shrink-0" aria-hidden />
          {t("autoPicked", { count: autoPicked })}
        </p>
      ) : null}

      {/* Status line — kept visible even with filters collapsed, so the user still
          sees what's loaded (and the row cap warning) without reopening them. */}
      {(error || loaded || capped) && (
        <div className="flex flex-col gap-1 text-sm">
          {error && <p className="text-red-600">{error}</p>}
          {loaded && !error && rows.length === 0 ? (
            <div className="flex flex-wrap items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-amber-700">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <p>{t("noDataForFilters")}</p>
              {institution && (
                <>
                  <span>{t("noDataInstitutionHint", { institution })}</span>
                  <button
                    type="button"
                    onClick={clearInstitutionAndReload}
                    className="font-medium underline underline-offset-2 hover:text-amber-900"
                  >
                    {t("clearInstitutionFilter")}
                  </button>
                </>
              )}
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              {loaded && !error && (
                <p className="text-gray-500">{t("samplesLoaded", { count: nf(rows.length) })}</p>
              )}
              {capped && (
                <p className="flex items-center gap-1.5 text-amber-600">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  {t("cappedWarning", { max: nf(MAX_ROWS) })}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {filtersOpen && (
        <>
        {/* Filter bar */}
        <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className={labelCls}>{tf("institution")}</label>
              <select
                value={institution}
                onChange={(e) => {
                  setInstitution(e.target.value);
                  writeGlobalFilters({ institution: e.target.value || undefined });
                }}
                className={inputCls}
              >
                <option value="">{tf("allInstitutions")}</option>
                {institutionOptions.map((o) => (
                  <option key={o.label} value={o.label}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            <div data-tour="gw-project">
              <label className={labelCls}>{t("project")}</label>
              <select
                value={projectId}
                onChange={(e) => {
                  setProjectId(e.target.value);
                  setSiteId("");
                }}
                className={inputCls}
              >
                <option value="">{t("all")}</option>
                {projectOptions
                  .filter((p) => !facetProjects || (p.id !== undefined && facetProjects.has(p.id)) || String(p.id) === projectId)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label className={labelCls}>{t("dateFrom")}</label>
              <input
                type="date"
                value={dateFrom}
                min={dateSpan?.min ?? undefined}
                max={dateTo || dateSpan?.max || undefined}
                onChange={(e) => setDateFrom(e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>{t("dateTo")}</label>
              <input
                type="date"
                value={dateTo}
                min={dateFrom || dateSpan?.min || undefined}
                max={dateSpan?.max ?? undefined}
                onChange={(e) => setDateTo(e.target.value)}
                className={inputCls}
              />
            </div>
          </div>
          {dateSpan && (dateSpan.min || dateSpan.max) ? (
            <p className="mt-2 text-xs text-gray-500">{t("dateSpan", { from: dateSpan.min ?? "…", to: dateSpan.max ?? "…" })}</p>
          ) : dateSpan ? (
            <p className="mt-2 text-xs text-amber-700">{t("noDatesRecorded")}</p>
          ) : null}

          {/* Matrix filter — only same-matrix variables can be cross-plotted */}
          {matrixOptions.length > 0 ? (
            <div className="mt-4 sm:max-w-xs">
              <label className={labelCls}>{t("matrixLabel")}</label>
              <select
                value={wideMatrix}
                onChange={(e) => {
                  setWideMatrix(e.target.value);
                  setSelectedVars(new Set());
                }}
                className={inputCls}
              >
                <option value="">{t("matrixAllOption")}</option>
                {matrixOptions.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          {/* Variable selection */}
          <div className="mt-4">
            <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-gray-700">
              <input
                type="checkbox"
                checked={allVariables}
                onChange={(e) => setAllVariables(e.target.checked)}
                className="accent-brand-700"
              />
              {t("allVariablesCheckbox")}
            </label>
            {allVariables ? (
              <p className="mt-1 flex items-start gap-1.5 text-sm text-amber-600">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                {t("allVariablesWarning")}
              </p>
            ) : null}
          </div>

          {/* Variable multi-select (hidden when "all variables") */}
          {!allVariables ? (
            <div className="mt-4" data-tour="gw-variables">
              <label className={labelCls}>
                {t("varsToCompare", { count: selectedVars.size, max: MAX_WIDE_VARS })}
              </label>
              <div className="mb-2 flex flex-wrap gap-1.5" aria-live="polite">
                {selectedChoices.length ? (
                  selectedChoices.map((v) => (
                    <span
                      key={v.id}
                      className="inline-flex items-center gap-1 rounded-full border border-brand-200 bg-brand-50 py-0.5 pl-2.5 pr-1 text-xs font-medium text-brand-800"
                    >
                      {v.label}
                      <button
                        type="button"
                        onClick={() => toggleVar(v.id)}
                        aria-label={t("removeVar", { name: v.label })}
                        className="rounded-full p-0.5 text-brand-700 transition hover:bg-brand-100"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-gray-400">{t("noVarsSelected")}</span>
                )}
              </div>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  value={varSearch}
                  onChange={(e) => setVarSearch(e.target.value)}
                  placeholder={t("searchVar")}
                  className={`${inputCls} pl-9`}
                />
              </div>
              <div className="mt-2 max-h-48 space-y-0.5 overflow-auto rounded-lg border border-gray-200 bg-gray-50 p-2">
                {filteredChoices.map((v) => {
                  const checked = selectedVars.has(v.id);
                  const disabled = !checked && selectedVars.size >= MAX_WIDE_VARS;
                  return (
                    <label
                      key={v.id}
                      className={`flex items-center gap-2 rounded px-2 py-1 text-sm ${
                        disabled ? "cursor-not-allowed text-gray-300" : "cursor-pointer text-gray-700 hover:bg-white"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={disabled}
                        onChange={() => toggleVar(v.id)}
                        className="accent-brand-700"
                      />
                      {v.label}
                    </label>
                  );
                })}
              </div>
            </div>
          ) : null}

          <div className="mt-4" data-tour="gw-load-button">
            <button
              type="button"
              onClick={() => load()}
              disabled={loading}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-brand-700 px-5 text-sm font-medium text-white shadow-sm transition hover:bg-brand-800 disabled:opacity-40"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <TableProperties className="h-4 w-4" />}
              {loading ? t("loadingData") : t("loadData")}
            </button>
          </div>
        </section>

        {/* How-to guide */}
        <section className="rounded-3xl border border-blue-100 bg-blue-50/50 p-5 shadow-sm">
          <div className="flex items-start gap-2">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
            <div className="space-y-2 text-sm text-gray-600">
              <p className="font-medium text-gray-800">{t("guide.title")}</p>
              <ol className="list-decimal space-y-1 pl-5">
                <li>{t.rich("guide.step1", { b: (chunks) => <span className="font-medium">{chunks}</span> })}</li>
                <li>{t.rich("guide.step2", { b: (chunks) => <span className="font-medium">{chunks}</span> })}</li>
                <li>{t.rich("guide.step3", { b: (chunks) => <span className="font-medium">{chunks}</span> })}</li>
              </ol>
              <div className="flex items-start gap-1.5 text-amber-700">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <p>{t.rich("guide.axisWarning", { b: (chunks) => <span className="font-medium">{chunks}</span> })}</p>
              </div>
            </div>
          </div>
        </section>
        </>
      )}

      {loaded && rows.length > 0 && quick.measures.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t("quick.title")}>
          <span className="text-xs font-medium uppercase tracking-wide text-gray-500">{t("quick.title")}</span>
          {quick.measures.length > 1 ? (
            <select
              value={quickMeasure || quick.measures[0].fid}
              onChange={(e) => setQuickMeasure(e.target.value)}
              aria-label={t("quick.variable")}
              className="h-8 max-w-[14rem] rounded-lg border border-gray-200 bg-white px-2 text-xs text-gray-700"
            >
              {quick.measures.map((m) => (
                <option key={m.fid} value={m.fid}>{m.name}</option>
              ))}
            </select>
          ) : null}
          {(
            [
              { kind: "depth", ok: quick.hasDepth && Boolean(quick.depthName), why: t("quick.needDepth") },
              { kind: "compare", ok: quick.measures.length >= 2, why: t("quick.needTwo") },
              { kind: "perSite", ok: quick.sites > 1 && Boolean(quick.siteName), why: t("quick.needSites") },
              { kind: "overTime", ok: quick.years > 1 && Boolean(quick.yearName), why: t("quick.needYears") },
            ] as const
          ).map((b) => (
            <button
              key={b.kind}
              type="button"
              disabled={!b.ok}
              title={b.ok ? t("quick.hint") : b.why}
              onClick={() => void openQuickChart(b.kind)}
              className="rounded-full border border-brand-200 bg-white px-3 py-1 text-xs font-medium text-brand-800 transition hover:border-brand-400 hover:bg-brand-50 disabled:cursor-not-allowed disabled:border-gray-200 disabled:text-gray-400 disabled:hover:bg-white"
            >
              {t(`quick.${b.kind}`)}
            </button>
          ))}
        </div>
      ) : null}

      {/* Explorer — takes the full remaining screen once filters are collapsed.
          overflow-auto (not hidden): a chart faceted on a high-cardinality field
          (e.g. Variable dropped on an axis) renders wider than this card — auto
          gives it a contained scrollbar instead of silently clipping the rest. */}
      <section
        data-tour="gw-canvas"
        className={`overflow-auto rounded-3xl border border-gray-200 bg-white p-2 shadow-sm ${focusMode ? "flex-1 min-h-0" : ""}`}
      >
        {loaded ? (
          <StyleSheetManager shouldForwardProp={(prop) => isPropValid(prop)}>
            <GraphicWalker
              key={explorerKey}
              data={rows}
              fields={fields}
              chart={initialChart}
              appearance="light"
              i18nLang={locale === "en" ? "en" : "es"}
              className={focusMode ? "h-full" : undefined}
              defaultConfig={CONTAINER_LAYOUT}
            />
          </StyleSheetManager>
        ) : (
          <div
            className={`flex flex-col items-center justify-center gap-2 text-center text-sm text-gray-500 ${focusMode ? "h-full" : "h-[400px]"}`}
          >
            <TableProperties className="h-8 w-8 text-gray-300" />
            <p>{t.rich("emptyState", { b: (chunks) => <span className="font-medium text-gray-700">{chunks}</span> })}</p>
          </div>
        )}
      </section>
    </div>
  );
}
