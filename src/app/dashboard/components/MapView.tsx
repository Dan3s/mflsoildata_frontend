"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useInstitutionOptions } from "./useInstitutionOptions";
import { dashboardService, mapService, type FilterOption, type MapFacets, type MapSite, type MapSiteDetail, type MapSummary } from "@/app/services";
import { writeGlobalFilters } from "@/app/lib/globalFilters";
import ActiveFilters, { type FilterChip } from "./ActiveFilters";

const PROJECT_PALETTE = ["#16a34a", "#2563eb", "#f97316", "#7c3aed", "#0891b2", "#ef4444", "#ca8a04", "#db2777", "#0d9488", "#4f46e5"];

const intlLocale = (locale: string) => (locale === "en" ? "en-US" : "es-CO");

type MapViewProps = {
  projectOptions: FilterOption[];
  initialSites: MapSite[];
  initialSummary: MapSummary | null;
  variableOptions: FilterOption[];
  /** Seeded from the MFL_FILTERS cookie, so a value picked on another screen carries over here. */
  initialInstitution?: string;
  initialCountry?: string;
  /** From a dataset's "View on map" link. */
  initialProjectId?: string;
};

type MapDraftFilters = {
  projectId: string;
  institution: string;
  search: string;
  country: string;
  admin1: string;
  admin2: string;
  altitudeMin: string;
  altitudeMax: string;
};

type ColorMode = "project" | "variable";

const EMPTY_FILTERS: MapDraftFilters = { projectId: "", institution: "", search: "", country: "", admin1: "", admin2: "", altitudeMin: "", altitudeMax: "" };

// Sequential color ramp (YlOrRd) for "color by variable".
const RAMP = ["#ffffb2", "#fecc5c", "#fd8d3c", "#f03b20", "#bd0026"];
const rampColor = (t: number): string => {
  const clamped = Math.max(0, Math.min(1, t));
  const scaled = clamped * (RAMP.length - 1);
  const i = Math.min(RAMP.length - 2, Math.floor(scaled));
  const f = scaled - i;
  const hex = (c: string) => [1, 3, 5].map((k) => parseInt(c.slice(k, k + 2), 16));
  const [r1, g1, b1] = hex(RAMP[i]);
  const [r2, g2, b2] = hex(RAMP[i + 1]);
  const mix = (a: number, b: number) => Math.round(a + (b - a) * f);
  return `rgb(${mix(r1, r2)}, ${mix(g1, g2)}, ${mix(b1, b2)})`;
};

const LeafletMap = dynamic(() => import("./LeafletMap"), { ssr: false });

const formatNumber = (value: number | null | undefined, locale: string) => {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "—";
  }

  return new Intl.NumberFormat(intlLocale(locale)).format(value);
};

const formatDateTime = (value: string | null | undefined, locale: string) => {
  if (!value) {
    return "—";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(intlLocale(locale), {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
};

const toQuery = (filters: MapDraftFilters, colorVariableId?: number) => ({
  project_id: filters.projectId ? Number(filters.projectId) : undefined,
  institution: filters.institution || undefined,
  search: filters.search || undefined,
  country: filters.country || undefined,
  admin_1: filters.admin1 || undefined,
  admin_2: filters.admin2 || undefined,
  altitude_min: filters.altitudeMin ? Number(filters.altitudeMin) : undefined,
  altitude_max: filters.altitudeMax ? Number(filters.altitudeMax) : undefined,
  color_variable_id: colorVariableId,
});

const isRenderableCoordinate = (site: MapSite) =>
  typeof site.latitude === "number" && Number.isFinite(site.latitude) && typeof site.longitude === "number" && Number.isFinite(site.longitude);

const summarizeSummary = (summary: MapSummary | null, sites: MapSite[]) => {
  const coordinateSites = sites.filter(isRenderableCoordinate);

  return {
    totalSites: summary?.total_sites ?? sites.length,
    selectedSites: summary?.selected_sites ?? sites.filter((site) => site.is_selected).length,
    coordinateSites: summary?.sites_with_coordinates ?? coordinateSites.length,
    measurementCount: summary?.measurement_count ?? sites.reduce((accumulator, site) => accumulator + (site.measurement_count ?? 0), 0),
    lastEventDate: summary?.last_event_date ?? sites.find((site) => site.last_event_date)?.last_event_date ?? null,
  };
};

function StatCard({ label, value, helper }: { label: string; value: string; helper?: string }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <p className="text-xs uppercase tracking-[0.25em] text-gray-400">{label}</p>
      <div className="mt-2 text-2xl font-semibold text-gray-900">{value}</div>
      {helper ? <p className="mt-1 text-xs text-gray-500">{helper}</p> : null}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3">
      <p className="text-[11px] uppercase tracking-[0.2em] text-gray-400">{label}</p>
      <p className="mt-1 text-sm font-medium text-gray-800">{value}</p>
    </div>
  );
}

function SiteListItem({
  site,
  selected,
  onClick,
}: {
  site: MapSite;
  selected: boolean;
  onClick: () => void;
}) {
  const t = useTranslations("map");
  const locale = useLocale();
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-2xl border p-4 text-left transition ${selected ? "border-brand-500 bg-brand-50 shadow-sm ring-2 ring-brand-500/30" : "border-gray-200 bg-white hover:border-brand-200 hover:bg-brand-50/40"}`}
    >
      <div className="flex items-start gap-3">
        <span className={`mt-1 h-3 w-3 rounded-full ${selected ? "bg-brand-500 ring-4 ring-brand-500/30" : "bg-brand-400"}`} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <h4 className="truncate text-sm font-semibold text-gray-900">{site.site_code}</h4>
          </div>
          <p className="mt-1 text-xs text-gray-500">{site.project_name ?? t("projectFallback", { id: site.project_id })}</p>
          <div className="mt-3 flex items-center justify-between gap-3 text-xs text-gray-500">
            <span>{site.latitude ?? "—"}, {site.longitude ?? "—"}</span>
            <span>{t("measurementsLabel", { count: formatNumber(site.measurement_count, locale) })}</span>
          </div>
        </div>
      </div>
    </button>
  );
}

export default function MapView({ projectOptions, initialSites, initialSummary, variableOptions, initialInstitution, initialCountry, initialProjectId }: MapViewProps) {
  const tf = useTranslations("filters");
  const institutionOptions = useInstitutionOptions();
  const router = useRouter();
  const t = useTranslations("map");
  const locale = useLocale();
  const seededFilters: MapDraftFilters = { ...EMPTY_FILTERS, institution: initialInstitution ?? "", country: initialCountry ?? "", projectId: initialProjectId ?? "" };
  const [draftFilters, setDraftFilters] = useState<MapDraftFilters>(seededFilters);
  const [activeFilters, setActiveFilters] = useState<MapDraftFilters>(seededFilters);
  const [countryOptions, setCountryOptions] = useState<string[]>([]);
  // What each selector can offer under the others' values (null until the first answer).
  const [facets, setFacets] = useState<MapFacets | null>(null);
  const [regions, setRegions] = useState<{ admin_1: string[]; admin_2: string[] }>({ admin_1: [], admin_2: [] });
  const [colorMode, setColorMode] = useState<ColorMode>("project");
  const [colorVariableId, setColorVariableId] = useState<string>("");
  const [mapVariables, setMapVariables] = useState<FilterOption[]>(variableOptions);
  const [sites, setSites] = useState<MapSite[]>(initialSites);
  const [summary, setSummary] = useState<MapSummary | null>(initialSummary);
  const [selectedSiteId, setSelectedSiteId] = useState<number | null>(initialSites[0]?.id ?? null);
  const [selectedSite, setSelectedSite] = useState<MapSiteDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [isRefreshing, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [listLimit, setListLimit] = useState(24);
  const hasHydratedRef = useRef(false);

  const summaryValues = useMemo(() => summarizeSummary(summary, sites), [sites, summary]);
  const visibleSites = useMemo(() => sites.filter(isRenderableCoordinate), [sites]);
  const displayedSites = useMemo(() => {
    const selected = sites.find((site) => site.id === selectedSiteId);
    const rest = selected ? sites.filter((site) => site !== selected) : sites;
    return selected ? [selected, ...rest.slice(0, Math.max(listLimit - 1, 0))] : rest.slice(0, listLimit);
  }, [listLimit, sites, selectedSiteId]);

  useEffect(() => {
    let active = true;
    dashboardService
      .getCountries()
      .then((countries) => {
        if (active) setCountryOptions(countries);
      })
      .catch(() => {
        if (active) setCountryOptions([]);
      });
    return () => {
      active = false;
    };
  }, []);

  // Assign a stable color to each project so markers are colored by project.
  // Indexed over *all* projects (not just the filtered ones) so a project keeps its
  // color when the filters change.
  const projectColors = useMemo(() => {
    const known = projectOptions.map((option) => Number(option.id)).filter((id) => Number.isFinite(id));
    const ids = Array.from(new Set([...known, ...sites.map((site) => site.project_id)])).sort((a, b) => a - b);
    const colors: Record<number, string> = {};
    ids.forEach((id, index) => {
      colors[id] = PROJECT_PALETTE[index % PROJECT_PALETTE.length];
    });
    return colors;
  }, [sites, projectOptions]);

  const projectLegend = useMemo(() => {
    const byId = new Map<number, string>();
    sites.forEach((site) => {
      if (!byId.has(site.project_id)) byId.set(site.project_id, site.project_name ?? t("projectFallback", { id: site.project_id }));
    });
    return Array.from(byId.entries()).map(([id, name]) => ({ id, name, color: projectColors[id] }));
  }, [sites, projectColors, t]);

  useEffect(() => {
    if (!sites.length) {
      setSelectedSiteId(null);
      return;
    }

    setSelectedSiteId((currentSelectedId) => {
      if (currentSelectedId && sites.some((site) => site.id === currentSelectedId)) {
        return currentSelectedId;
      }

      return sites[0]?.id ?? null;
    });
    setListLimit((currentLimit) => Math.min(Math.max(currentLimit, 24), sites.length));
  }, [sites]);

  useEffect(() => {
    if (!hasHydratedRef.current) {
      hasHydratedRef.current = true;
      return;
    }

    let cancelled = false;
    const colorVarId = colorMode === "variable" && colorVariableId ? Number(colorVariableId) : undefined;
    const query = toQuery(activeFilters, colorVarId);

    setError(null);
    startTransition(() => {
      Promise.allSettled([mapService.getSummary(query), mapService.getSites(query)]).then(([summaryResult, sitesResult]) => {
        if (cancelled) {
          return;
        }

        if (summaryResult.status === "fulfilled") {
          setSummary(summaryResult.value);
        }

        if (sitesResult.status === "fulfilled") {
          setSites(sitesResult.value.items);
        } else {
          setError(t("errors.loadSites"));
          setSites([]);
        }
      }).catch(() => {
        if (!cancelled) {
          setError(t("errors.refresh"));
        }
      });
    });

    return () => {
      cancelled = true;
    };
  }, [activeFilters, colorMode, colorVariableId, startTransition]);

  // Variables actually present in the current scope (so the color picker only
  // offers relevant ones, not the whole catalog).
  useEffect(() => {
    let active = true;
    mapService
      .getVariables(toQuery(activeFilters))
      .then((vars) => {
        if (active) setMapVariables(vars);
      })
      .catch(() => {
        if (active) setMapVariables([]);
      });
    return () => {
      active = false;
    };
  }, [activeFilters]);

  // Cascading selectors: institution, project and country only offer what has sites under the others.
  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      mapService
        .getFacets({
          institution: draftFilters.institution || undefined,
          project_id: draftFilters.projectId ? Number(draftFilters.projectId) : undefined,
          country: draftFilters.country || undefined,
          admin_1: draftFilters.admin1 || undefined,
          admin_2: draftFilters.admin2 || undefined,
        })
        .then((response) => {
          if (active) setFacets(response);
        })
        .catch(() => {
          if (active) setFacets(null);
        });
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [draftFilters.institution, draftFilters.projectId, draftFilters.country, draftFilters.admin1, draftFilters.admin2]);

  // Region options (admin_1 by country, admin_2 by admin_1) for the geo filters.
  useEffect(() => {
    let active = true;
    mapService
      .getRegions({ country: draftFilters.country || undefined, admin_1: draftFilters.admin1 || undefined })
      .then((r) => {
        if (active) setRegions(r);
      })
      .catch(() => {
        if (active) setRegions({ admin_1: [], admin_2: [] });
      });
    return () => {
      active = false;
    };
  }, [draftFilters.country, draftFilters.admin1]);

  // Color-by-variable scale: map each site's color_value onto the RAMP; sites
  // without a value for the chosen variable are shown in a neutral grey.
  const NO_VALUE_COLOR = "#cbd5e1";
  const siteColors = useMemo(() => {
    if (colorMode !== "variable" || !colorVariableId) return undefined;
    const values = sites.map((s) => s.color_value).filter((v): v is number => typeof v === "number" && Number.isFinite(v));
    const min = values.length ? Math.min(...values) : 0;
    const max = values.length ? Math.max(...values) : 1;
    const span = max - min || 1;
    const colors: Record<number, string> = {};
    for (const s of sites) {
      colors[s.id] =
        typeof s.color_value === "number" && Number.isFinite(s.color_value)
          ? rampColor((s.color_value - min) / span)
          : NO_VALUE_COLOR;
    }
    return colors;
  }, [sites, colorMode, colorVariableId]);

  const colorScale = useMemo(() => {
    if (colorMode !== "variable") return null;
    const values = sites.map((s) => s.color_value).filter((v): v is number => typeof v === "number" && Number.isFinite(v));
    if (!values.length) return null;
    return { min: Math.min(...values), max: Math.max(...values) };
  }, [sites, colorMode]);

  useEffect(() => {
    if (!selectedSiteId) {
      setSelectedSite(null);
      return;
    }

    let cancelled = false;
    setDetailLoading(true);

    mapService
      .getSiteById(selectedSiteId)
      .then((detail) => {
        if (!cancelled) {
          setSelectedSite(detail);
        }
      })
      .catch(() => {
        if (!cancelled) {
          const fallback = sites.find((site) => site.id === selectedSiteId);
          setSelectedSite(fallback ? { ...fallback } : null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setDetailLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedSiteId, sites]);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setActiveFilters({ ...draftFilters });
    writeGlobalFilters({ institution: draftFilters.institution || undefined, country: draftFilters.country || undefined });
  };

  const handleReset = () => {
    setDraftFilters(EMPTY_FILTERS);
    setActiveFilters(EMPTY_FILTERS);
    writeGlobalFilters({ institution: undefined, country: undefined });
  };

  /** Drops one filter from both the form and what is applied, so the chip and the map agree at once. */
  const clearFilter = (patch: Partial<MapDraftFilters>) => {
    setDraftFilters((current) => ({ ...current, ...patch }));
    setActiveFilters((current) => ({ ...current, ...patch }));
    const shared: { institution?: undefined; country?: undefined } = {};
    if ("institution" in patch) shared.institution = undefined;
    if ("country" in patch) shared.country = undefined;
    if (Object.keys(shared).length) writeGlobalFilters(shared);
  };

  const appliedChips: FilterChip[] = [
    activeFilters.institution ? { key: "institution", label: tf("institution"), value: activeFilters.institution, onRemove: () => clearFilter({ institution: "" }) } : null,
    activeFilters.projectId
      ? {
          key: "project",
          label: t("filters.project"),
          value: projectOptions.find((option) => String(option.id) === activeFilters.projectId)?.label ?? `#${activeFilters.projectId}`,
          onRemove: () => clearFilter({ projectId: "" }),
        }
      : null,
    activeFilters.country ? { key: "country", label: t("filters.country"), value: activeFilters.country, onRemove: () => clearFilter({ country: "", admin1: "", admin2: "" }) } : null,
    activeFilters.admin1 ? { key: "admin1", label: t("filters.region"), value: activeFilters.admin1, onRemove: () => clearFilter({ admin1: "", admin2: "" }) } : null,
    activeFilters.admin2 ? { key: "admin2", label: t("filters.municipality"), value: activeFilters.admin2, onRemove: () => clearFilter({ admin2: "" }) } : null,
    activeFilters.altitudeMin || activeFilters.altitudeMax
      ? {
          key: "altitude",
          label: t("filters.altitude"),
          value: `${activeFilters.altitudeMin || "…"} – ${activeFilters.altitudeMax || "…"}`,
          onRemove: () => clearFilter({ altitudeMin: "", altitudeMax: "" }),
        }
      : null,
    activeFilters.search ? { key: "search", label: t("filters.search"), value: activeFilters.search, onRemove: () => clearFilter({ search: "" }) } : null,
  ].filter((chip): chip is FilterChip => chip !== null);

  const handleOpenExport = () => {
    const url = mapService.exportSites(toQuery(activeFilters));
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleViewInCharts = () => {
    if (!selectedSite) {
      return;
    }
    const params = new URLSearchParams({
      project_id: String(selectedSite.project_id),
      site_id: String(selectedSite.id),
      site_code: selectedSite.site_code,
    });
    // Preselect a variable the site actually has data for, so the chart lands on
    // real data instead of the (likely empty) default variable.
    const seedVariableId = selectedSite.recent_measurements?.find((m) => m.variable_id)?.variable_id ?? selectedSite.recent_variables?.find((v) => v.id)?.id;
    if (seedVariableId) {
      params.set("variable_id", String(seedVariableId));
    }
    router.push(`/dashboard/visualization?${params.toString()}`);
  };

  const detailExtras = useMemo(() => {
    if (!selectedSite) {
      return [] as Array<[string, string | number | boolean | null]>;
    }

    const knownKeys = new Set([
      "id",
      "project_id",
      "site_code",
      "project_name",
      "latitude",
      "longitude",
      "measurement_count",
      "last_updated",
      "last_event_date",
      "is_selected",
      "country",
      "admin_1",
      "admin_2",
      "admin_3",
      "altitude_m",
      "description",
      "attributes",
      "metadata",
      "variables",
      "recent_variables",
    ]);

    const entries: Array<[string, string | number | boolean | null]> = [];

    Object.entries(selectedSite as unknown as Record<string, unknown>).forEach(([key, value]) => {
      if (knownKeys.has(key) || key.toLowerCase().includes("status") || value === null || value === undefined) {
        return;
      }

      if (value === null || value === undefined) {
        return;
      }

      if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
        entries.push([key, value]);
      }
    });

    // The API returns `attributes` as a list of {attribute_code, attribute_name,
    // value, ...}, so render each as name → value (scalars only).
    const attrs = selectedSite.attributes;
    if (Array.isArray(attrs)) {
      for (const a of attrs as Array<{ attribute_code?: string; attribute_name?: string; value?: unknown }>) {
        const value = a?.value;
        if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
          entries.push([a.attribute_name || a.attribute_code || "—", value]);
        }
      }
    }

    return entries;
  }, [selectedSite]);

  const exportLabel = isRefreshing ? t("exporting") : t("export");
  const hasMoreSites = sites.length > displayedSites.length;

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      <section className="relative overflow-hidden rounded-[2rem] border border-gray-200 bg-white shadow-sm">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(34,197,94,0.08),_transparent_32%),radial-gradient(circle_at_bottom_left,_rgba(15,23,42,0.08),_transparent_28%)]" />
        <div className="relative p-6 sm:p-8">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-3xl">
              <p className="text-sm font-semibold uppercase tracking-[0.35em] text-brand-800">{t("eyebrow")}</p>
              <h1 className="mt-2 text-3xl font-semibold text-gray-900 sm:text-4xl">{t("title")}</h1>
              <p className="mt-3 max-w-3xl text-base text-gray-600">{t("subtitle")}</p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleOpenExport}
                className="inline-flex h-11 items-center justify-center rounded-xl border border-gray-200 bg-white px-5 text-sm font-medium text-gray-700 shadow-sm transition hover:border-brand-200 hover:text-brand-800"
              >
                {exportLabel}
              </button>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard label={t("stats.sites")} value={formatNumber(summaryValues.totalSites, locale)} helper={t("stats.sitesHelper")} />
            <StatCard label={t("stats.coordinates")} value={formatNumber(summaryValues.coordinateSites, locale)} helper={t("stats.coordinatesHelper")} />
            <StatCard label={t("stats.measurements")} value={formatNumber(summaryValues.measurementCount, locale)} helper={t("stats.measurementsHelper")} />
            <StatCard label={t("stats.lastEvent")} value={formatDateTime(summaryValues.lastEventDate, locale)} helper={t("stats.lastEventHelper")} />
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(320px,0.9fr)]">
            <div className="space-y-6">
              <form onSubmit={handleSubmit} className="grid gap-4 rounded-3xl border border-gray-200 bg-gray-50 p-5 sm:grid-cols-2 xl:grid-cols-3">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-gray-700">{tf("institution")}</span>
                  <select
                    value={draftFilters.institution}
                    onChange={(event) => setDraftFilters((current) => ({ ...current, institution: event.target.value }))}
                    className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-700 outline-none transition focus:border-brand-500"
                  >
                    <option value="">{tf("allInstitutions")}</option>
                    {institutionOptions
                      .filter((option) => !facets || facets.institutions.includes(option.label) || option.label === draftFilters.institution)
                      .map((option) => (
                        <option key={option.label} value={option.label}>
                          {option.label}
                        </option>
                      ))}
                  </select>
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-gray-700">{t("filters.project")}</span>
                  <select
                    value={draftFilters.projectId}
                    onChange={(event) => setDraftFilters((current) => ({ ...current, projectId: event.target.value }))}
                    className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-700 outline-none transition focus:border-brand-500"
                  >
                    <option value="">{t("filters.allProjects")}</option>
                    {projectOptions
                      .filter((option) => !facets || facets.projects.some((p) => p.id === option.id) || String(option.id) === draftFilters.projectId)
                      .map((option) => {
                        const count = facets?.projects.find((p) => p.id === option.id)?.count;
                        return (
                          <option key={option.id ?? option.label} value={option.id ?? option.label}>
                            {count === undefined ? option.label : `${option.label} (${formatNumber(count, locale)})`}
                          </option>
                        );
                      })}
                  </select>
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-gray-700">{t("filters.country")}</span>
                  <select
                    value={draftFilters.country}
                    onChange={(event) => setDraftFilters((current) => ({ ...current, country: event.target.value, admin1: "", admin2: "" }))}
                    className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-700 outline-none transition focus:border-brand-500"
                  >
                    <option value="">{t("filters.allCountries")}</option>
                    {(facets
                      ? facets.countries
                      : countryOptions.map((value) => ({ value, count: undefined as number | undefined }))
                    ).map((entry) => (
                      <option key={entry.value} value={entry.value}>
                        {entry.count === undefined ? entry.value : `${entry.value} (${formatNumber(entry.count, locale)})`}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-gray-700">{t("filters.region")}</span>
                  <select
                    value={draftFilters.admin1}
                    onChange={(event) => setDraftFilters((current) => ({ ...current, admin1: event.target.value, admin2: "" }))}
                    className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-700 outline-none transition focus:border-brand-500"
                  >
                    <option value="">{t("filters.allRegions")}</option>
                    {regions.admin_1.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-gray-700">{t("filters.municipality")}</span>
                  <select
                    value={draftFilters.admin2}
                    onChange={(event) => setDraftFilters((current) => ({ ...current, admin2: event.target.value }))}
                    disabled={regions.admin_2.length === 0}
                    className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-700 outline-none transition focus:border-brand-500 disabled:opacity-60"
                  >
                    <option value="">{t("filters.allMunicipalities")}</option>
                    {regions.admin_2.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-gray-700">{t("filters.altitude")}</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={draftFilters.altitudeMin}
                      onChange={(event) => setDraftFilters((current) => ({ ...current, altitudeMin: event.target.value }))}
                      placeholder={t("filters.min")}
                      className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-700 outline-none transition focus:border-brand-500"
                    />
                    <span className="text-gray-400">–</span>
                    <input
                      type="number"
                      value={draftFilters.altitudeMax}
                      onChange={(event) => setDraftFilters((current) => ({ ...current, altitudeMax: event.target.value }))}
                      placeholder={t("filters.max")}
                      className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-700 outline-none transition focus:border-brand-500"
                    />
                  </div>
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-gray-700">{t("filters.search")}</span>
                  <input
                    value={draftFilters.search}
                    onChange={(event) => setDraftFilters((current) => ({ ...current, search: event.target.value }))}
                    placeholder={t("filters.searchPlaceholder")}
                    className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-700 outline-none transition focus:border-brand-500"
                  />
                </label>

                <div className="flex flex-wrap items-end gap-3 sm:col-span-2 xl:col-span-3">
                  <button
                    type="submit"
                    className="inline-flex h-11 items-center justify-center rounded-xl bg-brand-700 px-6 text-sm font-medium text-white shadow-sm transition hover:bg-brand-800 disabled:opacity-60"
                    disabled={isRefreshing}
                  >
                    {t("filters.apply")}
                  </button>
                  <button
                    type="button"
                    onClick={handleReset}
                    className="inline-flex h-11 items-center justify-center rounded-xl border border-gray-200 bg-white px-5 text-sm font-medium text-gray-700 shadow-sm transition hover:border-brand-200 hover:text-brand-800"
                  >
                    {t("clearFilters")}
                  </button>
                </div>
              </form>

              <ActiveFilters chips={appliedChips} onClearAll={handleReset} />

              {error ? <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">{error}</div> : null}

              <div className="rounded-[2rem] border border-gray-200 bg-white p-4 shadow-sm">
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">{t("interactive.title")}</h2>
                    <p className="text-sm text-gray-500">{t("interactive.subtitle")}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                    <span className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1">{t("interactive.withCoordinates", { count: visibleSites.length })}</span>
                    <span className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1">{t("interactive.filtered", { count: sites.length })}</span>
                  </div>
                </div>

                {/* Color by: project (default) or a variable's per-site mean */}
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <span className="text-xs font-medium text-gray-600">{t("color.label")}</span>
                  <div className="flex rounded-full border border-gray-200 bg-gray-50 p-0.5">
                    <button type="button" onClick={() => setColorMode("project")} className={`rounded-full px-3 py-1 text-xs font-medium transition ${colorMode === "project" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"}`}>{t("color.byProject")}</button>
                    <button type="button" onClick={() => setColorMode("variable")} className={`rounded-full px-3 py-1 text-xs font-medium transition ${colorMode === "variable" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"}`}>{t("color.byVariable")}</button>
                  </div>
                  {colorMode === "variable" ? (
                    <select
                      value={colorVariableId}
                      onChange={(event) => setColorVariableId(event.target.value)}
                      className="h-9 rounded-lg border border-gray-200 bg-white px-2 text-xs text-gray-700 outline-none focus:border-brand-500"
                    >
                      <option value="">{t("color.pickVariable")}</option>
                      {mapVariables.map((v) => (
                        <option key={v.id ?? v.label} value={String(v.id ?? "")}>{v.label}</option>
                      ))}
                    </select>
                  ) : null}
                </div>

                <div className="overflow-hidden rounded-[1.5rem] border border-gray-200">
                  <LeafletMap sites={visibleSites} selectedSiteId={selectedSiteId} onSelectSite={setSelectedSiteId} projectColors={projectColors} siteColors={siteColors} />
                </div>

                {colorMode === "variable" && colorVariableId ? (
                  colorScale ? (
                    <div className="mt-4 flex items-center gap-3 text-xs text-gray-500">
                      <span>{formatNumber(colorScale.min, locale)}</span>
                      <span className="h-2.5 flex-1 rounded-full" style={{ background: `linear-gradient(to right, ${RAMP.join(", ")})` }} />
                      <span>{formatNumber(colorScale.max, locale)}</span>
                    </div>
                  ) : (
                    <p className="mt-4 text-xs text-amber-600">{t("color.noValues")}</p>
                  )
                ) : projectLegend.length > 1 ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {projectLegend.map((item) => (
                      <span key={item.id} className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs text-gray-600">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                        {item.name}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{t("list.title")}</h3>
                    <p className="text-sm text-gray-500">{t("list.subtitle")}</p>
                  </div>
                  <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">{t("list.results", { count: sites.length })}</span>
                </div>

                <div className="mt-4 grid gap-3 lg:grid-cols-2">
                  {displayedSites.length ? (
                    displayedSites.map((site) => <SiteListItem key={site.id} site={site} selected={site.id === selectedSiteId} onClick={() => setSelectedSiteId(site.id)} />)
                  ) : (
                    <div className="rounded-2xl border border-dashed border-gray-200 px-4 py-10 text-center text-sm text-gray-500 lg:col-span-2">{t("list.empty")}</div>
                  )}
                </div>

                {hasMoreSites ? (
                  <div className="mt-4 flex justify-center">
                    <button
                      type="button"
                      onClick={() => setListLimit((currentLimit) => currentLimit + 24)}
                      className="inline-flex h-10 items-center justify-center rounded-xl border border-gray-200 bg-white px-4 text-sm font-medium text-gray-700 shadow-sm hover:border-brand-200 hover:text-brand-800"
                    >
                      {t("list.viewMore")}
                    </button>
                  </div>
                ) : null}
              </div>
            </div>

            <aside className="space-y-6">
              <div className="rounded-[2rem] border border-amber-200 bg-amber-50/50 p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-amber-700">{t("detail.eyebrow")}</p>
                    <h3 className="mt-2 text-2xl font-semibold text-gray-900">{selectedSite?.site_code ?? t("detail.selectPoint")}</h3>
                    <p className="mt-1 text-sm text-gray-500">{selectedSite?.project_name ?? t("detail.sidebarHint")}</p>
                  </div>
                </div>

                {selectedSite ? (
                  <button
                    type="button"
                    onClick={handleViewInCharts}
                    className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-amber-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-amber-700"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                      <path d="M4 19h16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                      <path d="M7 16V9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                      <path d="M12 16V5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                      <path d="M17 16v-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                    {t("detail.viewInCharts")}
                  </button>
                ) : null}

                {detailLoading ? <div className="mt-4 rounded-2xl bg-white/70 px-4 py-3 text-sm text-gray-500">{t("detail.loading")}</div> : null}

                <div className="mt-5 grid gap-3">
                  <DetailRow label={t("detail.project")} value={selectedSite?.project_name ?? (selectedSite ? t("projectFallback", { id: selectedSite.project_id }) : "—")} />
                  <DetailRow label={t("detail.coordinates")} value={selectedSite ? `${selectedSite.latitude ?? "—"}, ${selectedSite.longitude ?? "—"}` : "—"} />
                  <DetailRow label={t("detail.countryRegion")} value={selectedSite ? [selectedSite.country, selectedSite.admin_1, selectedSite.admin_2].filter(Boolean).join(" · ") || "—" : "—"} />
                  <DetailRow label={t("detail.altitude")} value={selectedSite?.altitude_m !== undefined && selectedSite?.altitude_m !== null ? `${selectedSite.altitude_m} m` : "—"} />
                  <DetailRow label={t("detail.measurements")} value={selectedSite ? formatNumber(selectedSite.measurement_count, locale) : "—"} />
                  <DetailRow label={t("detail.lastUpdated")} value={formatDateTime(selectedSite?.last_updated, locale)} />
                  <DetailRow label={t("detail.lastEvent")} value={formatDateTime(selectedSite?.last_event_date ?? selectedSite?.last_updated, locale)} />
                </div>

                {selectedSite?.description ? <p className="mt-4 rounded-2xl bg-gray-50 px-4 py-3 text-sm text-gray-600">{selectedSite.description}</p> : null}

                {selectedSite?.variables?.length ? (
                  <div className="mt-5">
                    <h4 className="text-sm font-semibold text-gray-900">{t("detail.featuredVariables")}</h4>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {selectedSite.variables.map((variable, index) => (
                        <span key={`${variable.id ?? variable.variable_code ?? index}`} className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs text-gray-600">{(variable.name ?? variable.variable_code ?? t("variableFallback", { n: index + 1 })) + (variable.unit ? ` · ${variable.unit}` : "")}</span>
                      ))}
                    </div>
                  </div>
                ) : null}

                {selectedSite?.recent_measurements?.length ? (
                  <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                    <h4 className="text-sm font-semibold text-amber-800">{t("detail.recentMeasurements")}</h4>
                    <p className="mt-1 text-xs text-amber-800/80">
                      {t("detail.recentMeasurementsHelp", {
                        count: selectedSite.recent_measurements.length,
                        total: formatNumber(selectedSite.measurement_count, locale),
                      })}
                    </p>
                    <div className="mt-3 space-y-2">
                      {selectedSite.recent_measurements.map((measurement) => (
                        <div key={measurement.id} className="rounded-2xl border border-amber-100 bg-white px-4 py-3">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-medium text-gray-900">{measurement.variable_name ?? t("variableFallback", { n: measurement.variable_id })}</p>
                              <p className="mt-1 text-xs text-gray-500">{formatDateTime(measurement.event_date, locale)}</p>
                            </div>
                            <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700 shadow-sm">{measurement.unit ?? "—"}</span>
                          </div>
                          <p className="mt-2 text-sm text-gray-700">{measurement.value === null || measurement.value === undefined ? "—" : String(measurement.value)}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {detailExtras.length ? (
                  <div className="mt-5">
                    <h4 className="text-sm font-semibold text-gray-900">{t("detail.additionalAttributes")}</h4>
                    <div className="mt-3 grid gap-2">
                      {detailExtras.slice(0, 10).map(([label, value]) => (
                        <DetailRow key={label} label={label.replace(/_/g, " ")} value={String(value)} />
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>

            </aside>
          </div>
        </div>
      </section>
    </div>
  );
}