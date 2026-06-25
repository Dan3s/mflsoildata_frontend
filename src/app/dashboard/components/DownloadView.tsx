"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Download, FileSpreadsheet, Info, Clock, Loader2 } from "lucide-react";
import type { FileFormat, FilterOption, RecentDownload } from "@/app/services";
import { downloadService, sitesService } from "@/app/services";

// ── Types ─────────────────────────────────────────────────────────────────────

type DownloadViewProps = {
  projectOptions: FilterOption[];
  variableOptions: FilterOption[];
};

// ── Helpers ─────────────────────────────────────────────────────────────────

const optionKey = (option: FilterOption) => String(option.id ?? option.code ?? option.label);

const relativeTime = (iso: string) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const diffMs = Date.now() - date.getTime();
  const diffH = Math.round(diffMs / 3_600_000);
  if (diffH < 1) return "Hace menos de 1 hora";
  if (diffH < 24) return `Hace ${diffH} ${diffH === 1 ? "hora" : "horas"}`;
  const diffD = Math.round(diffH / 24);
  return diffD === 1 ? "Ayer" : `Hace ${diffD} días`;
};

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionHeader({
  title,
  subtitle,
  onSelectAll,
}: {
  title: string;
  subtitle: string;
  onSelectAll: () => void;
}) {
  return (
    <div className="flex items-start justify-between mb-4">
      <div>
        <h3 className="text-base font-semibold text-gray-900">{title}</h3>
        <p className="text-sm text-gray-500">{subtitle}</p>
      </div>
      <button
        onClick={onSelectAll}
        className="text-sm text-green-700 font-medium hover:text-green-800 transition-colors"
      >
        Seleccionar Todos
      </button>
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
            className={`flex items-center gap-3 rounded-xl border p-3.5 cursor-pointer transition-colors ${
              isSelected
                ? "border-green-300 bg-green-50"
                : "border-gray-200 bg-white hover:border-gray-300"
            }`}
          >
            <div
              className={`h-5 w-5 rounded flex items-center justify-center border transition-colors shrink-0 ${
                isSelected
                  ? "border-green-600 bg-green-600"
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
            <input
              type="checkbox"
              className="sr-only"
              checked={isSelected}
              onChange={() => onToggle(key)}
            />
            <span className="text-sm text-gray-700">{opt.label}</span>
          </label>
        );
      })}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function DownloadView({ projectOptions, variableOptions }: DownloadViewProps) {
  const [selectedProjects, setSelectedProjects] = useState<Set<string>>(new Set());
  const [selectedSites, setSelectedSites] = useState<Set<string>>(new Set());
  const [selectedVariables, setSelectedVariables] = useState<Set<string>>(new Set());
  const [format, setFormat] = useState<FileFormat>("xlsx");
  const [includeMetadata, setIncludeMetadata] = useState(true);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [siteOptions, setSiteOptions] = useState<FilterOption[]>([]);
  const [loadingSites, setLoadingSites] = useState(false);
  const [estimate, setEstimate] = useState<number | null>(null);
  const [estimating, setEstimating] = useState(false);
  const [recentDownloads, setRecentDownloads] = useState<RecentDownload[]>([]);

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
        // Drop selected sites that no longer belong to the selected projects.
        const validKeys = new Set(options.map(optionKey));
        setSelectedSites((prev) => new Set(Array.from(prev).filter((key) => validKeys.has(key))));
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

  // Load recent downloads (optional endpoint — fail silently if not available).
  useEffect(() => {
    let active = true;
    downloadService
      .getRecent()
      .then((items) => {
        if (active) setRecentDownloads(items);
      })
      .catch(() => {
        if (active) setRecentDownloads([]);
      });
    return () => {
      active = false;
    };
  }, []);

  const isComplete =
    selectedProjectIds.length > 0 && selectedSiteIds.length > 0 && selectedVariableIds.length > 0;

  const filters = useMemo(
    () => ({
      project_ids: selectedProjectIds,
      site_ids: selectedSiteIds,
      variable_ids: selectedVariableIds,
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
    }),
    [selectedProjectIds, selectedSiteIds, selectedVariableIds, dateFrom, dateTo],
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

  const handleDownload = () => {
    if (!isComplete) return;
    const url = downloadService.buildExportUrl({
      ...filters,
      format,
      include_metadata: includeMetadata,
    });
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Descarga de Datos</h1>
        <p className="mt-1 text-sm text-gray-500">
          Exporte datos filtrados en formatos estándar
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* ── Left column ─────────────────────────────────────────────────── */}
        <div className="flex-1 space-y-6 min-w-0">
          {/* Projects */}
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <SectionHeader
              title="Proyectos"
              subtitle="Seleccione los proyectos a incluir"
              onSelectAll={() => selectAll(projectOptions, setSelectedProjects)}
            />
            <OptionGrid
              options={projectOptions}
              selected={selectedProjects}
              onToggle={(id) => toggleItem(setSelectedProjects, id)}
              columns={2}
              emptyLabel="No hay proyectos disponibles."
            />
          </div>

          {/* Sampling sites */}
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <SectionHeader
              title="Sitios de Muestreo"
              subtitle="Seleccione los sitios a incluir"
              onSelectAll={() => selectAll(siteOptions, setSelectedSites)}
            />
            {loadingSites ? (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Cargando sitios…
              </div>
            ) : (
              <OptionGrid
                options={siteOptions}
                selected={selectedSites}
                onToggle={(id) => toggleItem(setSelectedSites, id)}
                columns={2}
                emptyLabel="Seleccione al menos un proyecto para ver sus sitios."
              />
            )}
          </div>

          {/* Variables */}
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <SectionHeader
              title="Variables"
              subtitle="Seleccione las variables a exportar"
              onSelectAll={() => selectAll(variableOptions, setSelectedVariables)}
            />
            <OptionGrid
              options={variableOptions}
              selected={selectedVariables}
              onToggle={(id) => toggleItem(setSelectedVariables, id)}
              columns={1}
              emptyLabel="No hay variables disponibles."
            />
          </div>

          {/* Date range */}
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="mb-4">
              <h3 className="text-base font-semibold text-gray-900">Rango de Fechas</h3>
              <p className="text-sm text-gray-500">Opcional: filtre por período de tiempo</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Fecha Desde
                </label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-700 focus:border-green-500 focus:ring-1 focus:ring-green-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Fecha Hasta
                </label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-700 focus:border-green-500 focus:ring-1 focus:ring-green-500 focus:outline-none"
                />
              </div>
            </div>
          </div>
        </div>

        {/* ── Right column (sidebar) ───────────────────────────────────────── */}
        <div className="w-full lg:w-80 space-y-4 shrink-0">
          {/* Export config */}
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <h3 className="text-base font-semibold text-gray-900 mb-0.5">
              Configuración de Exportación
            </h3>
            <p className="text-sm text-gray-500 mb-5">Opciones de formato y contenido</p>

            {/* Format */}
            <p className="text-sm font-medium text-gray-700 mb-3">Formato de Archivo</p>
            <div className="space-y-2 mb-5">
              {(
                [
                  {
                    id: "xlsx" as FileFormat,
                    label: "Excel (.xlsx)",
                    sub: "Recomendado para análisis",
                  },
                  {
                    id: "csv" as FileFormat,
                    label: "CSV (.csv)",
                    sub: "Compatible con sistemas externos",
                  },
                ] as { id: FileFormat; label: string; sub: string }[]
              ).map((f) => (
                <label
                  key={f.id}
                  className={`flex items-start gap-3 rounded-xl border p-3.5 cursor-pointer transition-colors ${
                    format === f.id
                      ? "border-green-300 bg-green-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <div
                    className={`mt-0.5 h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                      format === f.id ? "border-green-600" : "border-gray-300"
                    }`}
                  >
                    {format === f.id && (
                      <div className="h-2 w-2 rounded-full bg-green-600" />
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
            <p className="text-sm font-medium text-gray-700 mb-3">Opciones Adicionales</p>
            <label className="flex items-start gap-3 rounded-xl border border-gray-200 p-3.5 cursor-pointer hover:border-gray-300 transition-colors">
              <div
                className={`h-5 w-5 rounded flex items-center justify-center border transition-colors shrink-0 mt-0.5 ${
                  includeMetadata
                    ? "border-green-600 bg-green-600"
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
                <p className="text-sm font-medium text-gray-800">Incluir Metadatos</p>
                <p className="text-xs text-gray-500">
                  Información del proyecto, sitio y fecha de exportación
                </p>
              </div>
            </label>
          </div>

          {/* Selection summary */}
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">
              Resumen de Selección
            </h3>
            <div className="space-y-2 mb-4">
              {[
                { label: "Proyectos:", count: selectedProjectIds.length },
                { label: "Sitios:", count: selectedSiteIds.length },
                { label: "Variables:", count: selectedVariableIds.length },
              ].map((row) => (
                <div key={row.label} className="flex justify-between text-sm">
                  <span className="text-gray-600">{row.label}</span>
                  <span
                    className={`font-medium ${
                      row.count > 0 ? "text-green-700" : "text-gray-400"
                    }`}
                  >
                    {row.count}
                  </span>
                </div>
              ))}
              <div className="pt-2 border-t border-gray-100 flex justify-between text-sm">
                <span className="text-gray-600">Registros estimados:</span>
                <span
                  className={`font-semibold ${
                    isComplete ? "text-green-700" : "text-gray-400"
                  }`}
                >
                  {!isComplete
                    ? "—"
                    : estimating
                    ? "calculando…"
                    : estimate === null
                    ? "—"
                    : `~${estimate.toLocaleString("es-CO")}`}
                </span>
              </div>
            </div>

            {!isComplete && (
              <div className="flex items-start gap-2 rounded-xl bg-gray-50 border border-gray-100 p-3 mb-4">
                <Info className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-medium text-gray-600">Selección incompleta</p>
                  <p className="text-xs text-gray-500">
                    Debe seleccionar al menos un proyecto, sitio y variable para exportar
                  </p>
                </div>
              </div>
            )}

            <button
              disabled={!isComplete}
              onClick={handleDownload}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-green-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Download className="h-4 w-4" />
              Descargar Datos
            </button>
            <button
              onClick={clearAll}
              className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Limpiar Selección
            </button>
          </div>

          {/* Recent downloads */}
          {recentDownloads.length > 0 && (
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">
                Descargas Recientes
              </h3>
              <div className="space-y-3">
                {recentDownloads.map((d) => (
                  <div key={String(d.id ?? d.filename)} className="flex items-center gap-3">
                    <div className="rounded-lg bg-blue-50 p-2 shrink-0">
                      <FileSpreadsheet className="h-4 w-4 text-blue-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">
                        {d.filename}
                      </p>
                      <div className="flex items-center gap-1 text-xs text-gray-400">
                        <Clock className="h-3 w-3" />
                        {relativeTime(d.created_at)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
