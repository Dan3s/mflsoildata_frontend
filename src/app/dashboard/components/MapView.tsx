"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { mapService, type FilterOption, type MapSite, type MapSiteDetail, type MapSummary } from "@/app/services";

type MapViewProps = {
  projectOptions: FilterOption[];
  initialSites: MapSite[];
  initialSummary: MapSummary | null;
};

type MapDraftFilters = {
  projectId: string;
  search: string;
};

const LeafletMap = dynamic(() => import("./LeafletMap"), { ssr: false });

const formatNumber = (value: number | null | undefined) => {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "—";
  }

  return new Intl.NumberFormat("es-CO").format(value);
};

const formatDateTime = (value?: string | null) => {
  if (!value) {
    return "—";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("es-CO", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
};

const toQuery = (filters: MapDraftFilters) => ({
  project_id: filters.projectId ? Number(filters.projectId) : undefined,
  search: filters.search || undefined,
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
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-2xl border p-4 text-left transition ${selected ? "border-green-500 bg-green-50 shadow-sm ring-2 ring-green-500/30" : "border-gray-200 bg-white hover:border-green-200 hover:bg-green-50/40"}`}
    >
      <div className="flex items-start gap-3">
        <span className={`mt-1 h-3 w-3 rounded-full ${selected ? "bg-green-500 ring-4 ring-green-500/30" : "bg-green-400"}`} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <h4 className="truncate text-sm font-semibold text-gray-900">{site.site_code}</h4>
          </div>
          <p className="mt-1 text-xs text-gray-500">{site.project_name ?? `Proyecto ${site.project_id}`}</p>
          <div className="mt-3 flex items-center justify-between gap-3 text-xs text-gray-500">
            <span>{site.latitude ?? "—"}, {site.longitude ?? "—"}</span>
            <span>{formatNumber(site.measurement_count)} mediciones</span>
          </div>
        </div>
      </div>
    </button>
  );
}

export default function MapView({ projectOptions, initialSites, initialSummary }: MapViewProps) {
  const router = useRouter();
  const [draftFilters, setDraftFilters] = useState<MapDraftFilters>({ projectId: "", search: "" });
  const [activeFilters, setActiveFilters] = useState<MapDraftFilters>({ projectId: "", search: "" });
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
  const displayedSites = useMemo(() => sites.slice(0, listLimit), [listLimit, sites]);

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
    const query = toQuery(activeFilters);

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
          setError("No fue posible cargar los sitios del mapa.");
          setSites([]);
        }
      }).catch(() => {
        if (!cancelled) {
          setError("No fue posible refrescar la información del mapa.");
        }
      });
    });

    return () => {
      cancelled = true;
    };
  }, [activeFilters, startTransition]);

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
  };

  const handleReset = () => {
    const resetFilters = { projectId: "", search: "" };
    setDraftFilters(resetFilters);
    setActiveFilters(resetFilters);
  };

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
    router.push(`/dashboard/visualizacion?${params.toString()}`);
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

    const appendRecord = (record?: Record<string, string | number | boolean | null> | null) => {
      Object.entries(record ?? {}).forEach(([key, value]) => {
        if (!key.toLowerCase().includes("status") && value !== null && value !== undefined) {
          entries.push([key, value]);
        }
      });
    };

    appendRecord(selectedSite.attributes);
    appendRecord(selectedSite.metadata);

    return entries;
  }, [selectedSite]);

  const exportLabel = isRefreshing ? "Actualizando..." : "Exportar";
  const hasMoreSites = sites.length > displayedSites.length;

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      <section className="relative overflow-hidden rounded-[2rem] border border-gray-200 bg-white shadow-sm">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(34,197,94,0.08),_transparent_32%),radial-gradient(circle_at_bottom_left,_rgba(15,23,42,0.08),_transparent_28%)]" />
        <div className="relative p-6 sm:p-8">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-3xl">
              <p className="text-sm font-semibold uppercase tracking-[0.35em] text-green-700">Mapa Geográfico</p>
              <h1 className="mt-2 text-3xl font-semibold text-gray-900 sm:text-4xl">Sitios de muestreo sobre el territorio</h1>
              <p className="mt-3 max-w-3xl text-base text-gray-600">Explora los sitios con coordenadas, filtra por proyecto y abre cada punto para revisar su detalle completo sin salir de la vista.</p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleOpenExport}
                className="inline-flex h-11 items-center justify-center rounded-full border border-gray-200 bg-white px-5 text-sm font-medium text-gray-700 shadow-sm transition hover:border-green-200 hover:text-green-700"
              >
                {exportLabel}
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="inline-flex h-11 items-center justify-center rounded-full bg-green-600 px-5 text-sm font-medium text-white shadow-sm transition hover:bg-green-700"
              >
                Limpiar filtros
              </button>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Sitios" value={formatNumber(summaryValues.totalSites)} helper="Resultado del endpoint de mapa" />
            <StatCard label="Coordenadas" value={formatNumber(summaryValues.coordinateSites)} helper="Sitios listos para marcar" />
            <StatCard label="Mediciones" value={formatNumber(summaryValues.measurementCount)} helper="Acumulado en el conjunto filtrado" />
            <StatCard label="Último evento" value={formatDateTime(summaryValues.lastEventDate)} helper="Fecha más reciente disponible" />
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(320px,0.9fr)]">
            <div className="space-y-6">
              <form onSubmit={handleSubmit} className="grid gap-4 rounded-3xl border border-gray-200 bg-gray-50 p-5 lg:grid-cols-[1.15fr_1.25fr_auto]">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-gray-700">Proyecto</span>
                  <select
                    value={draftFilters.projectId}
                    onChange={(event) => setDraftFilters((current) => ({ ...current, projectId: event.target.value }))}
                    className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-700 outline-none transition focus:border-green-500"
                  >
                    <option value="">Todos los proyectos</option>
                    {projectOptions.map((option) => (
                      <option key={option.id ?? option.label} value={option.id ?? option.label}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block lg:col-span-1">
                  <span className="mb-2 block text-sm font-medium text-gray-700">Búsqueda</span>
                  <input
                    value={draftFilters.search}
                    onChange={(event) => setDraftFilters((current) => ({ ...current, search: event.target.value }))}
                    placeholder="Código de sitio, país o región..."
                    className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-700 outline-none transition focus:border-green-500"
                  />
                </label>

                <div className="flex items-end gap-3">
                  <button
                    type="submit"
                    className="inline-flex h-11 flex-1 items-center justify-center rounded-xl bg-green-600 px-4 text-sm font-medium text-white shadow-sm transition hover:bg-green-700 disabled:opacity-60"
                    disabled={isRefreshing}
                  >
                    Aplicar
                  </button>
                </div>
              </form>

              {error ? <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">{error}</div> : null}

              <div className="rounded-[2rem] border border-gray-200 bg-white p-4 shadow-sm">
                <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">Mapa interactivo</h2>
                    <p className="text-sm text-gray-500">Leaflet con tiles reales de OpenStreetMap y marcadores en canvas</p>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs text-gray-500">
                    <span className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1">{visibleSites.length} con coordenadas</span>
                    <span className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1">{sites.length} filtrados</span>
                  </div>
                </div>

                <div className="overflow-hidden rounded-[1.5rem] border border-gray-200">
                  <LeafletMap sites={visibleSites} selectedSiteId={selectedSiteId} onSelectSite={setSelectedSiteId} />
                </div>
              </div>

              <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Sitios filtrados</h3>
                    <p className="text-sm text-gray-500">Selecciona un sitio para ver su información completa</p>
                  </div>
                  <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">{sites.length} resultados</span>
                </div>

                <div className="mt-4 grid gap-3 lg:grid-cols-2">
                  {displayedSites.length ? (
                    displayedSites.map((site) => <SiteListItem key={site.id} site={site} selected={site.id === selectedSiteId} onClick={() => setSelectedSiteId(site.id)} />)
                  ) : (
                    <div className="rounded-2xl border border-dashed border-gray-200 px-4 py-10 text-center text-sm text-gray-500 lg:col-span-2">No hay sitios que coincidan con los filtros seleccionados.</div>
                  )}
                </div>

                {hasMoreSites ? (
                  <div className="mt-4 flex justify-center">
                    <button
                      type="button"
                      onClick={() => setListLimit((currentLimit) => currentLimit + 24)}
                      className="inline-flex h-10 items-center justify-center rounded-full border border-gray-200 bg-white px-4 text-sm font-medium text-gray-700 shadow-sm hover:border-green-200 hover:text-green-700"
                    >
                      Ver más sitios
                    </button>
                  </div>
                ) : null}
              </div>
            </div>

            <aside className="space-y-6">
              <div className="rounded-[2rem] border border-amber-200 bg-amber-50/50 p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-amber-700">Detalle del sitio</p>
                    <h3 className="mt-2 text-2xl font-semibold text-gray-900">{selectedSite?.site_code ?? "Selecciona un punto"}</h3>
                    <p className="mt-1 text-sm text-gray-500">{selectedSite?.project_name ?? "El panel lateral se llena desde el endpoint de detalle"}</p>
                  </div>
                </div>

                {selectedSite ? (
                  <button
                    type="button"
                    onClick={handleViewInCharts}
                    className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-amber-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-amber-700"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                      <path d="M4 19h16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                      <path d="M7 16V9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                      <path d="M12 16V5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                      <path d="M17 16v-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                    Ver en gráficas
                  </button>
                ) : null}

                {detailLoading ? <div className="mt-4 rounded-2xl bg-white/70 px-4 py-3 text-sm text-gray-500">Cargando detalle del sitio...</div> : null}

                <div className="mt-5 grid gap-3">
                  <DetailRow label="Proyecto" value={selectedSite?.project_name ?? (selectedSite ? `Proyecto ${selectedSite.project_id}` : "—")} />
                  <DetailRow label="Coordenadas" value={selectedSite ? `${selectedSite.latitude ?? "—"}, ${selectedSite.longitude ?? "—"}` : "—"} />
                  <DetailRow label="País / Región" value={selectedSite ? [selectedSite.country, selectedSite.admin_1, selectedSite.admin_2].filter(Boolean).join(" · ") || "—" : "—"} />
                  <DetailRow label="Altitud" value={selectedSite?.altitude_m !== undefined && selectedSite?.altitude_m !== null ? `${selectedSite.altitude_m} m` : "—"} />
                  <DetailRow label="Mediciones" value={selectedSite ? formatNumber(selectedSite.measurement_count) : "—"} />
                  <DetailRow label="Última actualización" value={formatDateTime(selectedSite?.last_updated)} />
                  <DetailRow label="Último evento" value={formatDateTime(selectedSite?.last_event_date ?? selectedSite?.last_updated)} />
                </div>

                {selectedSite?.description ? <p className="mt-4 rounded-2xl bg-gray-50 px-4 py-3 text-sm text-gray-600">{selectedSite.description}</p> : null}

                {selectedSite?.variables?.length ? (
                  <div className="mt-5">
                    <h4 className="text-sm font-semibold text-gray-900">Variables destacadas</h4>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {selectedSite.variables.map((variable, index) => (
                        <span key={`${variable.id ?? variable.variable_code ?? index}`} className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs text-gray-600">{(variable.name ?? variable.variable_code ?? `Variable ${index + 1}`) + (variable.unit ? ` · ${variable.unit}` : "")}</span>
                      ))}
                    </div>
                  </div>
                ) : null}

                {selectedSite?.recent_measurements?.length ? (
                  <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                    <h4 className="text-sm font-semibold text-amber-800">Mediciones recientes</h4>
                    <div className="mt-3 space-y-2">
                      {selectedSite.recent_measurements.map((measurement) => (
                        <div key={measurement.id} className="rounded-2xl border border-amber-100 bg-white px-4 py-3">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-medium text-gray-900">{measurement.variable_name ?? `Variable ${measurement.variable_id}`}</p>
                              <p className="mt-1 text-xs text-gray-500">{formatDateTime(measurement.event_date)}</p>
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
                    <h4 className="text-sm font-semibold text-gray-900">Atributos adicionales</h4>
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