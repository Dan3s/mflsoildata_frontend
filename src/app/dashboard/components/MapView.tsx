"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState, useTransition } from "react";
import { mapService, type FilterOption, type MapSite, type MapSiteDetail, type MapSummary } from "@/app/services";

type MapViewProps = {
  projectOptions: FilterOption[];
  initialSites: MapSite[];
  initialSummary: MapSummary | null;
};

type MapDraftFilters = {
  projectId: string;
  status: string;
  search: string;
};

const STATUS_COLORS: Record<string, { dot: string; border: string; ring: string; text: string }> = {
  activo: { dot: "bg-emerald-400", border: "border-emerald-400/60", ring: "ring-emerald-400/30", text: "text-emerald-300" },
  active: { dot: "bg-emerald-400", border: "border-emerald-400/60", ring: "ring-emerald-400/30", text: "text-emerald-300" },
  validado: { dot: "bg-sky-400", border: "border-sky-400/60", ring: "ring-sky-400/30", text: "text-sky-300" },
  pendiente: { dot: "bg-amber-400", border: "border-amber-400/60", ring: "ring-amber-400/30", text: "text-amber-300" },
  inactivo: { dot: "bg-slate-400", border: "border-slate-400/60", ring: "ring-slate-400/30", text: "text-slate-300" },
  inactive: { dot: "bg-slate-400", border: "border-slate-400/60", ring: "ring-slate-400/30", text: "text-slate-300" },
};

const DEFAULT_COLORS = { dot: "bg-fuchsia-400", border: "border-fuchsia-400/60", ring: "ring-fuchsia-400/30", text: "text-fuchsia-300" };

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
  status: filters.status || undefined,
  search: filters.search || undefined,
});

const isRenderableCoordinate = (site: MapSite) =>
  typeof site.latitude === "number" && Number.isFinite(site.latitude) && typeof site.longitude === "number" && Number.isFinite(site.longitude);

const getStatusKey = (status?: string | null) => (status?.trim().toLowerCase() || "sin estado");

const getStatusPalette = (status?: string | null) => STATUS_COLORS[getStatusKey(status)] ?? DEFAULT_COLORS;


const summarizeSummary = (summary: MapSummary | null, sites: MapSite[]) => {
  const coordinateSites = sites.filter(isRenderableCoordinate);
  const activeSites = sites.filter((site) => {
    const status = getStatusKey(site.status);
    return site.is_active === true || status.includes("activo") || status.includes("active");
  });

  return {
    totalSites: summary?.total_sites ?? sites.length,
    activeSites: summary?.active_sites ?? activeSites.length,
    selectedSites: summary?.selected_sites ?? sites.filter((site) => site.is_selected).length,
    coordinateSites: summary?.sites_with_coordinates ?? coordinateSites.length,
    measurementCount: summary?.measurement_count ?? sites.reduce((accumulator, site) => accumulator + (site.measurement_count ?? 0), 0),
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
  const palette = getStatusPalette(site.status);

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-2xl border p-4 text-left transition ${selected ? `border-green-500 bg-green-50 shadow-sm ring-2 ${palette.ring}` : "border-gray-200 bg-white hover:border-green-200 hover:bg-green-50/40"}`}
    >
      <div className="flex items-start gap-3">
        <span className={`mt-1 h-3 w-3 rounded-full ${palette.dot} ${selected ? `ring-4 ${palette.ring}` : ""}`} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <h4 className="truncate text-sm font-semibold text-gray-900">{site.site_code}</h4>
            <span className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] ${palette.border} ${palette.text}`}>{site.status ?? "Sin estado"}</span>
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
  const [draftFilters, setDraftFilters] = useState<MapDraftFilters>({ projectId: "", status: "", search: "" });
  const [activeFilters, setActiveFilters] = useState<MapDraftFilters>({ projectId: "", status: "", search: "" });
  const [sites, setSites] = useState<MapSite[]>(initialSites);
  const [summary, setSummary] = useState<MapSummary | null>(initialSummary);
  const [selectedSiteId, setSelectedSiteId] = useState<number | null>(initialSites[0]?.id ?? null);
  const [selectedSite, setSelectedSite] = useState<MapSiteDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [isRefreshing, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [listLimit, setListLimit] = useState(24);

  const statusOptions = useMemo(() => {
    const statuses = new Map<string, string>();

    sites.forEach((site) => {
      const status = site.status?.trim();
      if (status) {
        statuses.set(status.toLowerCase(), status);
      }
    });

    return Array.from(statuses.values()).sort((left, right) => left.localeCompare(right));
  }, [sites]);

  const summaryValues = useMemo(() => summarizeSummary(summary, sites), [sites, summary]);
  const visibleSites = useMemo(() => sites.filter(isRenderableCoordinate), [sites]);
  const displayedSites = useMemo(() => sites.slice(0, listLimit), [listLimit, sites]);

  useEffect(() => {
    setMounted(true);
  }, []);

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
    if (!mounted) {
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
  }, [activeFilters, mounted, startTransition]);

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
    const resetFilters = { projectId: "", status: "", search: "" };
    setDraftFilters(resetFilters);
    setActiveFilters(resetFilters);
  };

  const handleOpenExport = () => {
    const url = mapService.exportSites(toQuery(activeFilters));
    window.open(url, "_blank", "noopener,noreferrer");
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
      "status",
      "measurement_count",
      "last_updated",
      "is_selected",
      "is_active",
      "country",
      "admin_1",
      "admin_2",
      "admin_3",
      "altitude_m",
      "description",
      "attributes",
      "metadata",
      "variables",
    ]);

    const entries: Array<[string, string | number | boolean | null]> = [];

    Object.entries(selectedSite as unknown as Record<string, unknown>).forEach(([key, value]) => {
      if (knownKeys.has(key) || value === null || value === undefined) {
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
        if (value !== null && value !== undefined) {
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
              <p className="mt-3 max-w-3xl text-base text-gray-600">Explora los sitios con coordenadas, filtra por proyecto o estado y abre cada punto para revisar su detalle completo sin salir de la vista.</p>
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
            <StatCard label="Activos" value={formatNumber(summaryValues.activeSites)} helper="Sitios con estado activo" />
            <StatCard label="Coordenadas" value={formatNumber(summaryValues.coordinateSites)} helper="Sitios listos para marcar" />
            <StatCard label="Mediciones" value={formatNumber(summaryValues.measurementCount)} helper="Acumulado en el conjunto filtrado" />
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(320px,0.9fr)]">
            <div className="space-y-6">
              <form onSubmit={handleSubmit} className="grid gap-4 rounded-3xl border border-gray-200 bg-gray-50 p-5 lg:grid-cols-[1.15fr_0.9fr_1.25fr_auto]">
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

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-gray-700">Estado</span>
                  <select
                    value={draftFilters.status}
                    onChange={(event) => setDraftFilters((current) => ({ ...current, status: event.target.value }))}
                    className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-700 outline-none transition focus:border-green-500"
                  >
                    <option value="">Todos los estados</option>
                    {statusOptions.map((status) => (
                      <option key={status} value={status}>
                        {status}
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

                <div className="mt-4 flex flex-wrap gap-3 text-xs text-gray-500">
                  {Object.entries(STATUS_COLORS).slice(0, 4).map(([key, palette]) => (
                    <span key={key} className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-3 py-1">
                      <span className={`h-2.5 w-2.5 rounded-full ${palette.dot}`} />
                      {key}
                    </span>
                  ))}
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
              <div className="rounded-[2rem] border border-gray-200 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-green-700">Detalle del sitio</p>
                    <h3 className="mt-2 text-2xl font-semibold text-gray-900">{selectedSite?.site_code ?? "Selecciona un punto"}</h3>
                    <p className="mt-1 text-sm text-gray-500">{selectedSite?.project_name ?? "El panel lateral se llena desde el endpoint de detalle"}</p>
                  </div>
                  <span className={`rounded-full border px-3 py-1 text-xs font-medium ${getStatusPalette(selectedSite?.status).border} ${getStatusPalette(selectedSite?.status).text}`}>{selectedSite?.status ?? "Sin estado"}</span>
                </div>

                {detailLoading ? <div className="mt-4 rounded-2xl bg-gray-50 px-4 py-3 text-sm text-gray-500">Cargando detalle del sitio...</div> : null}

                <div className="mt-5 grid gap-3">
                  <DetailRow label="Proyecto" value={selectedSite?.project_name ?? (selectedSite ? `Proyecto ${selectedSite.project_id}` : "—")} />
                  <DetailRow label="Coordenadas" value={selectedSite ? `${selectedSite.latitude ?? "—"}, ${selectedSite.longitude ?? "—"}` : "—"} />
                  <DetailRow label="País / Región" value={selectedSite ? [selectedSite.country, selectedSite.admin_1, selectedSite.admin_2].filter(Boolean).join(" · ") || "—" : "—"} />
                  <DetailRow label="Altitud" value={selectedSite?.altitude_m !== undefined && selectedSite?.altitude_m !== null ? `${selectedSite.altitude_m} m` : "—"} />
                  <DetailRow label="Mediciones" value={selectedSite ? formatNumber(selectedSite.measurement_count) : "—"} />
                  <DetailRow label="Última actualización" value={formatDateTime(selectedSite?.last_updated)} />
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

              <div className="rounded-[2rem] border border-gray-200 bg-white p-5 shadow-sm">
                <p className="text-xs uppercase tracking-[0.3em] text-gray-400">Cobertura</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
                  <StatCard label="Sitios seleccionados" value={formatNumber(summaryValues.selectedSites)} helper="Marca los puntos resaltados en la API" />
                  <StatCard label="Con coordenadas" value={formatNumber(summaryValues.coordinateSites)} helper="Sitios que se pintan en el mapa" />
                  <StatCard label="Estado activo" value={formatNumber(summaryValues.activeSites)} helper="Útil para el panel superior" />
                </div>
              </div>
            </aside>
          </div>
        </div>
      </section>
    </div>
  );
}