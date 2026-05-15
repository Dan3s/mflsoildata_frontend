"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  FilterOption,
  VariableRead,
  VisualizationBySiteResponse,
  VisualizationCorrelationResponse,
  VisualizationTimeSeriesResponse,
} from "@/app/services";
import { ApiError, visualizationService } from "@/app/services";

type VisualizationViewProps = {
  projectOptions: FilterOption[];
  variables: VariableRead[];
};

type TabKey = "serie" | "sitio" | "correlacion";

type ChartType = "Líneas" | "Barras" | "Dispersión";

const tabs: Array<{ key: TabKey; label: string }> = [
  { key: "serie", label: "Serie Temporal" },
  { key: "sitio", label: "Comparación por Sitio" },
  { key: "correlacion", label: "Correlación" },
];

const formatTick = (value: number) => value.toFixed(1).replace(".0", "");

const formatVariableLabel = (variable: VariableRead) => {
  const baseLabel = variable.name?.trim() || variable.variable_code?.trim() || `Variable ${variable.id}`;
  return variable.matrix ? `${baseLabel} (${variable.matrix})` : baseLabel;
};

const toNumber = (value: string) => Number(value);

const isUsableSeries = (data: VisualizationTimeSeriesResponse) =>
  data.labels.some((label) => Boolean(label?.trim())) &&
  data.series.some((series) => series.values.some((value) => Number.isFinite(value)));

const isDateFormattingError = (message: string) =>
  /nonetype/i.test(message) || /strftime/i.test(message) || /date/i.test(message) || /null/i.test(message);

function ChartShell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="mb-4">
        <h3 className="text-lg font-medium text-gray-900">{title}</h3>
        <p className="text-sm text-gray-500">{subtitle}</p>
      </div>
      {children}
    </section>
  );
}

function LineChart({ data }: { data: VisualizationTimeSeriesResponse }) {
  const width = 920;
  const height = 380;
  const padding = 48;
  const allValues = data.series.flatMap((series) => series.values);
  const maxValue = Math.max(8, ...allValues, 1);
  const minValue = Math.min(0, ...allValues, 0);

  const scaleX = (index: number) => padding + (index * (width - padding * 2)) / Math.max(data.labels.length - 1, 1);
  const scaleY = (value: number) => height - padding - ((value - minValue) * (height - padding * 2)) / Math.max(maxValue - minValue, 1);

  const colors = ["#22c55e", "#3b82f6", "#f97316", "#8b5cf6"];

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-[22rem] w-full">
      {[0, 2, 4, 6, 8].map((tick) => {
        const y = scaleY(tick);

        return (
          <g key={tick}>
            <line x1={padding} x2={width - padding} y1={y} y2={y} stroke="#e5e7eb" strokeDasharray="3 4" />
            <text x={padding - 10} y={y + 4} textAnchor="end" className="fill-gray-400 text-[10px]">
              {formatTick(tick)}
            </text>
          </g>
        );
      })}

      {data.labels.map((label, index) => {
        const x = scaleX(index);

        return (
          <g key={label}>
            <line x1={x} x2={x} y1={padding} y2={height - padding} stroke="#e5e7eb" strokeDasharray="3 4" />
            <text x={x} y={height - 18} textAnchor="middle" className="fill-gray-500 text-[10px]">
              {label}
            </text>
          </g>
        );
      })}

      {data.series.map((series, seriesIndex) => {
        const path = series.values
          .map((value, index) => `${index === 0 ? "M" : "L"} ${scaleX(index)} ${scaleY(value)}`)
          .join(" ");

        return (
          <g key={series.variable_id}>
            <path d={path} fill="none" stroke={colors[seriesIndex % colors.length]} strokeWidth="2.5" />
            {series.values.map((value, index) => (
              <circle
                key={`${series.variable_id}-${index}`}
                cx={scaleX(index)}
                cy={scaleY(value)}
                r="4"
                fill="white"
                stroke={colors[seriesIndex % colors.length]}
                strokeWidth="2"
              />
            ))}
          </g>
        );
      })}
    </svg>
  );
}

function BarChart({ data }: { data: VisualizationBySiteResponse }) {
  const width = 920;
  const height = 380;
  const padding = 48;
  const colors = ["#3b82f6", "#22c55e", "#f97316", "#8b5cf6"];
  const hasVisibleBars = data.series.some((series) => series.values.some((value) => Number.isFinite(value) && value > 0));
  const maxValue = Math.max(8, ...data.series.flatMap((series) => series.values), 1);
  const chartHeight = height - padding * 2;
  const groupWidth = (width - padding * 2) / Math.max(data.categories.length, 1);
  const barWidth = Math.max(3, Math.min(26, groupWidth / Math.max(data.series.length, 1) - 8));

  if (!data.categories.length || !data.series.length || !hasVisibleBars) {
    return <div className="flex h-[22rem] items-center justify-center text-center text-sm text-amber-600">No hay valores de sitio suficientes para construir esta comparación.</div>;
  }

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-[22rem] w-full">
      {[0, 2, 4, 6, 8].map((tick) => {
        const y = height - padding - (tick / 8) * chartHeight;

        return (
          <g key={tick}>
            <line x1={padding} x2={width - padding} y1={y} y2={y} stroke="#e5e7eb" strokeDasharray="3 4" />
            <text x={padding - 10} y={y + 4} textAnchor="end" className="fill-gray-400 text-[10px]">
              {formatTick(tick)}
            </text>
          </g>
        );
      })}

      {data.categories.map((category, categoryIndex) => {
        const groupStart = padding + categoryIndex * groupWidth;
        const labelX = groupStart + groupWidth / 2;
        const label = category.length > 14 ? `${category.slice(0, 11)}...` : category;

        return (
          <g key={category}>
            <line x1={labelX} x2={labelX} y1={padding} y2={height - padding} stroke="#e5e7eb" strokeDasharray="3 4" />
            <text x={labelX} y={height - 16} textAnchor="middle" className="fill-gray-500 text-[10px]">
              <title>{category}</title>
              {label}
            </text>
            {data.series.map((series, seriesIndex) => {
              const value = series.values[categoryIndex];
              if (!Number.isFinite(value ?? NaN)) {
                return null;
              }

              const barHeight = (value / maxValue) * chartHeight;
              const x = groupStart + seriesIndex * (barWidth + 6) + 4;
              const y = height - padding - barHeight;

              return <rect key={`${series.name}-${category}`} x={x} y={y} width={barWidth} height={barHeight} rx="3" fill={colors[seriesIndex % colors.length]} />;
            })}
          </g>
        );
      })}
    </svg>
  );
}

function ScatterChart({ data }: { data: VisualizationCorrelationResponse }) {
  const points = data.points;
  const width = 100;
  const height = 100;
  const minX = Math.min(...points.map((point) => point.x), 0);
  const maxX = Math.max(...points.map((point) => point.x), 1);
  const minY = Math.min(...points.map((point) => point.y), 0);
  const maxY = Math.max(...points.map((point) => point.y), 1);

  const scaleX = (value: number) => 10 + ((value - minX) / Math.max(maxX - minX, 1)) * 80;
  const scaleY = (value: number) => 90 - ((value - minY) / Math.max(maxY - minY, 1)) * 80;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-[22rem] w-full">
      {[20, 40, 60, 80].map((tick) => (
        <g key={tick}>
          <line x1={10} x2={90} y1={tick} y2={tick} stroke="#e5e7eb" strokeDasharray="3 4" />
          <line x1={tick} x2={tick} y1={10} y2={90} stroke="#e5e7eb" strokeDasharray="3 4" />
        </g>
      ))}

      {points.map((point, index) => (
        <circle key={`${point.x}-${point.y}-${index}`} cx={scaleX(point.x)} cy={scaleY(point.y)} r="2.6" fill="#3b82f6" />
      ))}
    </svg>
  );
}

export default function VisualizationView({ projectOptions, variables }: VisualizationViewProps) {
  const [tab, setTab] = useState<TabKey>("serie");
  const [chartType, setChartType] = useState<ChartType>("Líneas");
  const [projectId, setProjectId] = useState<string>(projectOptions[0]?.id ? String(projectOptions[0].id) : "");
  const [primaryVariableId, setPrimaryVariableId] = useState<string>(variables[0]?.id ? String(variables[0].id) : "");
  const [secondaryVariableId, setSecondaryVariableId] = useState<string>(variables[1]?.id ? String(variables[1].id) : variables[0]?.id ? String(variables[0].id) : "");
  const [timeSeries, setTimeSeries] = useState<VisualizationTimeSeriesResponse | null>(null);
  const [siteComparison, setSiteComparison] = useState<VisualizationBySiteResponse | null>(null);
  const [correlation, setCorrelation] = useState<VisualizationCorrelationResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emptyReason, setEmptyReason] = useState<string | null>(null);

  const variableChoices = useMemo(
    () => variables.map((variable) => ({ value: String(variable.id), label: formatVariableLabel(variable) })),
    [variables],
  );

  useEffect(() => {
    if (!projectId && projectOptions[0]?.id) {
      setProjectId(String(projectOptions[0].id));
    }
  }, [projectId, projectOptions]);

  useEffect(() => {
    if (!primaryVariableId && variableChoices[0]) {
      setPrimaryVariableId(variableChoices[0].value);
    }

    if (!secondaryVariableId && variableChoices[1]) {
      setSecondaryVariableId(variableChoices[1].value);
    }
  }, [primaryVariableId, secondaryVariableId, variableChoices]);

  useEffect(() => {
    const projectIdNumber = projectId ? toNumber(projectId) : undefined;
    const primaryIdNumber = primaryVariableId ? toNumber(primaryVariableId) : undefined;
    const secondaryIdNumber = secondaryVariableId ? toNumber(secondaryVariableId) : undefined;

    if (!projectIdNumber || !primaryIdNumber) {
      setTimeSeries(null);
      setSiteComparison(null);
      setCorrelation(null);
      setError(null);
      setEmptyReason("Selecciona un proyecto y una variable principal.");
      return;
    }

    let active = true;
    setLoading(true);
    setError(null);
    setEmptyReason(null);

    const baseQuery = {
      project_id: projectIdNumber,
      variable_id: primaryIdNumber,
      secondary_variable_id: secondaryIdNumber,
      variable_x_id: primaryIdNumber,
      variable_y_id: secondaryIdNumber,
      chart_type: chartType,
    };

    const request =
      tab === "serie"
        ? visualizationService.getTimeSeries(baseQuery)
        : tab === "sitio"
          ? visualizationService.getBySite(baseQuery)
          : visualizationService.getCorrelation(baseQuery);

    request
      .then((response) => {
        if (!active) {
          return;
        }

        if (tab === "serie") {
          const seriesResponse = response as VisualizationTimeSeriesResponse;

          if (!isUsableSeries(seriesResponse)) {
            setTimeSeries(null);
            setSiteComparison(null);
            setCorrelation(null);
            setError(null);
            setEmptyReason("No hay fechas válidas o valores suficientes para construir la serie temporal.");
            return;
          }

          setTimeSeries(seriesResponse);
        } else if (tab === "sitio") {
          setSiteComparison(response as VisualizationBySiteResponse);
        } else {
          setCorrelation(response as VisualizationCorrelationResponse);
        }
      })
      .catch((requestError) => {
        if (!active) {
          return;
        }

        const apiError = requestError instanceof ApiError ? requestError : null;
        const errorMessage = requestError instanceof Error ? requestError.message : "No se pudo cargar la visualización.";
        const isUnsupportedAggregation = errorMessage.toLowerCase().includes("unsupported aggregation") || apiError?.status === 400;
        const isTemporalDataIssue = isDateFormattingError(errorMessage) || /strftime/i.test(JSON.stringify(apiError?.payload ?? ""));

        if (isUnsupportedAggregation || isTemporalDataIssue) {
          setError(null);
          setEmptyReason("Todavía no hay fechas válidas o datos temporales suficientes para construir la visualización.");
        } else {
          setError(errorMessage);
          setEmptyReason(null);
        }

        setTimeSeries(null);
        setSiteComparison(null);
        setCorrelation(null);
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [chartType, primaryVariableId, projectId, secondaryVariableId, tab]);

  const primaryVariableLabel = variableChoices.find((variable) => variable.value === primaryVariableId)?.label ?? "Variable principal";
  const secondaryVariableLabel = variableChoices.find((variable) => variable.value === secondaryVariableId)?.label ?? "Variable secundaria";

  const chartBody = useMemo(() => {
    if (loading) {
      return <div className="flex h-[24rem] items-center justify-center text-sm text-gray-500">Cargando datos de la gráfica...</div>;
    }

    if (error) {
      return <div className="flex h-[24rem] items-center justify-center text-sm text-red-600">{error}</div>;
    }

    if (emptyReason) {
      return <div className="flex h-[24rem] items-center justify-center text-center text-sm text-amber-600">{emptyReason}</div>;
    }

    if (tab === "serie" && timeSeries && !isUsableSeries(timeSeries)) {
      return <div className="flex h-[24rem] items-center justify-center text-center text-sm text-amber-600">No hay fechas válidas o valores suficientes para construir la serie temporal.</div>;
    }

    if (tab === "serie" && timeSeries) {
      return chartType === "Barras" ? <BarChart data={{ categories: timeSeries.labels, series: timeSeries.series.map((series) => ({ name: series.variable_name, values: series.values })) }} /> : <LineChart data={timeSeries} />;
    }

    if (tab === "sitio" && siteComparison) {
      return <BarChart data={siteComparison} />;
    }

    if (tab === "correlacion" && correlation) {
      return <ScatterChart data={correlation} />;
    }

    return <div className="flex h-[24rem] items-center justify-center text-sm text-gray-500">No hay datos para mostrar con la configuración actual.</div>;
  }, [chartType, correlation, error, loading, siteComparison, tab, timeSeries]);

  const legend = useMemo(() => {
    if (tab === "serie") {
      return timeSeries?.series.map((series, index) => ({ label: series.variable_name, color: index === 0 ? "bg-green-500" : "bg-blue-500" })) ?? [];
    }

    if (tab === "sitio") {
      return siteComparison?.series.map((series, index) => ({ label: series.name, color: index === 0 ? "bg-blue-500" : "bg-green-500" })) ?? [];
    }

    return [
      { label: `${primaryVariableLabel} vs ${secondaryVariableLabel}`, color: "bg-blue-500" },
    ];
  }, [primaryVariableLabel, secondaryVariableLabel, siteComparison?.series, tab, timeSeries?.series]);

  const exportUrl = useMemo(() => {
    const projectIdNumber = projectId ? toNumber(projectId) : undefined;
    const primaryIdNumber = primaryVariableId ? toNumber(primaryVariableId) : undefined;
    const secondaryIdNumber = secondaryVariableId ? toNumber(secondaryVariableId) : undefined;

    return visualizationService.exportChart({
      project_id: projectIdNumber,
      variable_id: primaryIdNumber,
      secondary_variable_id: secondaryIdNumber,
      variable_x_id: primaryIdNumber,
      variable_y_id: secondaryIdNumber,
      chart_type: chartType,
    });
  }, [chartType, primaryVariableId, projectId, secondaryVariableId]);

  return (
    <div className="px-4 py-4 sm:px-6 lg:px-8 lg:py-6">
      <div className="mx-auto max-w-[1400px] space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-gray-900">Visualización de Datos</h1>
            <p className="mt-1 text-base text-gray-500">Gráficas configurables de variables de suelo</p>
          </div>

          <button
            type="button"
            onClick={() => window.open(exportUrl, "_blank", "noopener,noreferrer")}
            className="inline-flex w-fit items-center gap-2 rounded-full border border-gray-200 bg-white px-5 py-3 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M12 4v10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              <path d="M7 10l5 5 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M4 20h16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            Exportar Gráfica
          </button>
        </div>

        <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="mt-1 text-gray-500">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M4 19h16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                <path d="M6 17V7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                <path d="M12 17V4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                <path d="M18 17V10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-medium text-gray-900">Configuración de Visualización</h2>
              <p className="mt-1 text-sm text-gray-500">Seleccione el proyecto, variables y tipo de gráfica a visualizar</p>
            </div>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-4">
            <label className="block">
              <span className="mb-2 block text-sm text-gray-700">Proyecto</span>
              <select value={projectId} onChange={(event) => setProjectId(event.target.value)} className="h-11 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm text-gray-700 shadow-sm outline-none transition focus:border-green-500 focus:bg-white">
                {projectOptions.map((option) => (
                  <option key={option.id ?? option.label} value={String(option.id ?? option.label)}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm text-gray-700">Variable Principal</span>
              <select value={primaryVariableId} onChange={(event) => setPrimaryVariableId(event.target.value)} className="h-11 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm text-gray-700 shadow-sm outline-none transition focus:border-green-500 focus:bg-white">
                {variableChoices.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm text-gray-700">Variable Secundaria</span>
              <select value={secondaryVariableId} onChange={(event) => setSecondaryVariableId(event.target.value)} className="h-11 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm text-gray-700 shadow-sm outline-none transition focus:border-green-500 focus:bg-white">
                {variableChoices.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm text-gray-700">Tipo de Gráfica</span>
              <select value={chartType} onChange={(event) => setChartType(event.target.value as ChartType)} className="h-11 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm text-gray-700 shadow-sm outline-none transition focus:border-green-500 focus:bg-white">
                <option value="Líneas">Líneas</option>
                <option value="Barras">Barras</option>
                <option value="Dispersión">Dispersión</option>
              </select>
            </label>
          </div>
        </section>

        <div className="flex w-fit flex-wrap gap-1 rounded-full border border-gray-200 bg-white p-1 shadow-sm">
          {tabs.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setTab(item.key)}
              className={`rounded-full px-4 py-2 text-sm transition ${tab === item.key ? "bg-gray-100 text-gray-900 shadow-sm" : "text-gray-600 hover:bg-gray-50"}`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <ChartShell
          title={tab === "serie" ? "Evolución Temporal de Variables" : tab === "sitio" ? "Comparación por Sitio de Muestreo" : "Correlación entre Variables"}
          subtitle={tab === "serie" ? `Variación de ${primaryVariableLabel} y ${secondaryVariableLabel} a lo largo del tiempo` : tab === "sitio" ? "Comparación de valores entre diferentes sitios para las variables seleccionadas" : "Relación exploratoria entre variables seleccionadas"}
        >
          <div className="mb-4 flex flex-wrap gap-4 text-sm">
            {legend.map((item) => (
              <div key={item.label} className="flex items-center gap-2 text-gray-600">
                <span className={`h-2.5 w-2.5 rounded-sm ${item.color}`} />
                <span>{item.label}</span>
              </div>
            ))}
          </div>

          {chartBody}
        </ChartShell>
      </div>
    </div>
  );
}