"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  FilterOption,
  Site,
  VariableRead,
  VisualizationBySiteResponse,
  VisualizationCorrelationResponse,
  VisualizationTimeSeriesResponse,
} from "@/app/services";
import { ApiError, sitesService, visualizationService } from "@/app/services";
import PlotlyFigure from "./PlotlyFigure";
import type { PlotParams } from "react-plotly.js";

type VisualizationViewProps = {
  projectOptions: FilterOption[];
  variables: VariableRead[];
};

type TabKey = "serie" | "sitio" | "correlacion";

type SeriesChartMode = "Líneas" | "Barras" | "Boxplot" | "Histograma";
type SiteComparisonLimit = 10 | 20 | 50 | 0;

const tabs: Array<{ key: TabKey; label: string }> = [
  { key: "serie", label: "Serie Temporal" },
  { key: "sitio", label: "Comparación por Sitio" },
  { key: "correlacion", label: "Correlación" },
];

const seriesChartModes: SeriesChartMode[] = ["Líneas", "Barras", "Boxplot", "Histograma"];
const siteComparisonLimits: Array<{ label: string; value: SiteComparisonLimit }> = [
  { label: "10 sitios", value: 10 },
  { label: "20 sitios", value: 20 },
  { label: "50 sitios", value: 50 },
  { label: "Todos", value: 0 },
];

const seriesPalette = ["#16a34a", "#2563eb", "#f97316", "#7c3aed", "#0891b2", "#ef4444"];

const sitePalette = ["#2563eb", "#16a34a", "#f97316", "#7c3aed", "#0891b2", "#ef4444"];

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

const getFiniteNumbers = (values: number[]) => values.filter((value) => Number.isFinite(value));

const formatSiteLabel = (site: Site) => {
  const locationParts = [site.admin_3, site.admin_2, site.admin_1, site.country].filter(Boolean);
  const locationLabel = locationParts.length ? locationParts.join(" · ") : null;
  const altitudeLabel = site.altitude_m !== undefined && site.altitude_m !== null ? `${site.altitude_m} m` : null;
  const suffix = [locationLabel, altitudeLabel].filter(Boolean).join(" · ");

  return suffix ? `${site.site_code} · ${suffix}` : site.site_code;
};

const createPlotLayout = (overrides?: PlotParams["layout"]) : PlotParams["layout"] => ({
  autosize: true,
  margin: { l: 48, r: 24, t: 24, b: 48 },
  paper_bgcolor: "rgba(0,0,0,0)",
  plot_bgcolor: "rgba(0,0,0,0)",
  hovermode: "x unified",
  legend: {
    orientation: "h",
    x: 0,
    y: 1.12,
    font: { size: 11 },
  },
  ...overrides,
});

const createLineFigure = (data: VisualizationTimeSeriesResponse): Pick<PlotParams, "data" | "layout"> => ({
  data: data.series.map((series, seriesIndex) => ({
    x: data.labels,
    y: series.values,
    type: "scatter" as const,
    mode: "lines+markers",
    name: series.variable_name,
    line: { color: seriesPalette[seriesIndex % seriesPalette.length], width: 3 },
    marker: { size: 7, color: seriesPalette[seriesIndex % seriesPalette.length] },
    connectgaps: false,
  }) as PlotParams["data"][number]),
  layout: createPlotLayout({
    xaxis: { title: { text: "Tiempo" }, showgrid: true, gridcolor: "#eef2f7" },
    yaxis: { title: { text: "Valor" }, showgrid: true, gridcolor: "#eef2f7" },
  }),
});

const createBarFigure = (data: VisualizationTimeSeriesResponse): Pick<PlotParams, "data" | "layout"> => ({
  data: data.series.map((series, seriesIndex) => ({
    x: data.labels,
    y: series.values,
    type: "bar" as const,
    name: series.variable_name,
    marker: { color: seriesPalette[seriesIndex % seriesPalette.length] },
  }) as PlotParams["data"][number]),
  layout: createPlotLayout({
    barmode: "group",
    xaxis: { title: { text: "Tiempo" }, showgrid: true, gridcolor: "#eef2f7" },
    yaxis: { title: { text: "Valor" }, showgrid: true, gridcolor: "#eef2f7" },
  }),
});

const createBoxFigure = (data: VisualizationTimeSeriesResponse): Pick<PlotParams, "data" | "layout"> => ({
  data: data.series.map((series, seriesIndex) => ({
    y: getFiniteNumbers(series.values),
    type: "box" as const,
    name: series.variable_name,
    boxmean: "sd",
    marker: { color: seriesPalette[seriesIndex % seriesPalette.length] },
    line: { color: seriesPalette[seriesIndex % seriesPalette.length] },
  }) as PlotParams["data"][number]),
  layout: createPlotLayout({
    boxmode: "group",
    yaxis: { title: { text: "Valor" }, showgrid: true, gridcolor: "#eef2f7" },
    xaxis: { title: { text: "Variable" } },
  }),
});

const createHistogramFigure = (data: VisualizationTimeSeriesResponse): Pick<PlotParams, "data" | "layout"> => ({
  data: data.series.map((series, seriesIndex) => ({
    x: getFiniteNumbers(series.values),
    type: "histogram" as const,
    name: series.variable_name,
    opacity: 0.65,
    marker: { color: seriesPalette[seriesIndex % seriesPalette.length] },
    nbinsx: Math.min(40, Math.max(8, Math.ceil(getFiniteNumbers(series.values).length / 4))),
  }) as PlotParams["data"][number]),
  layout: createPlotLayout({
    barmode: "overlay",
    xaxis: { title: { text: "Valor" }, showgrid: true, gridcolor: "#eef2f7" },
    yaxis: { title: { text: "Frecuencia" }, showgrid: true, gridcolor: "#eef2f7" },
  }),
});

const createSiteComparisonFigure = (
  data: VisualizationBySiteResponse,
  labelsByCategory: Map<string, string>,
  limit: SiteComparisonLimit,
): Pick<PlotParams, "data" | "layout"> => {
  const rankedCategories = data.categories
    .map((category, index) => ({
      category,
      index,
      score: data.series.reduce((accumulator, series) => accumulator + Math.abs(series.values[index] ?? 0), 0),
    }))
    .sort((left, right) => right.score - left.score);

  const selectedCategories = limit > 0 ? rankedCategories.slice(0, limit) : rankedCategories;
  const selectedIndexes = selectedCategories.map((item) => item.index);
  const labels = selectedCategories.map((item) => labelsByCategory.get(item.category) ?? item.category);

  return {
    data: data.series.map((series, seriesIndex) => ({
      x: labels,
      y: selectedIndexes.map((index) => series.values[index]),
      type: "bar" as const,
      name: series.name,
      marker: { color: sitePalette[seriesIndex % sitePalette.length] },
      hovertemplate: `%{x}<br>${series.name}: %{y:.3f}<extra></extra>`,
    }) as PlotParams["data"][number]),
    layout: createPlotLayout({
      barmode: "group",
      xaxis: { title: { text: "Sitio" }, showgrid: false, tickangle: -25, automargin: true },
      yaxis: { title: { text: "Valor" }, showgrid: true, gridcolor: "#eef2f7" },
      margin: { l: 48, r: 24, t: 24, b: 120 },
    }),
  };
};

const buildTrendline = (points: VisualizationCorrelationResponse["points"]) => {
  if (!points.length) {
    return null;
  }

  const n = points.length;
  const sumX = points.reduce((accumulator, point) => accumulator + point.x, 0);
  const sumY = points.reduce((accumulator, point) => accumulator + point.y, 0);
  const sumXY = points.reduce((accumulator, point) => accumulator + point.x * point.y, 0);
  const sumXX = points.reduce((accumulator, point) => accumulator + point.x * point.x, 0);

  const denominator = n * sumXX - sumX * sumX;
  if (denominator === 0) {
    return null;
  }

  const slope = (n * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / n;
  const minX = Math.min(...points.map((point) => point.x));
  const maxX = Math.max(...points.map((point) => point.x));

  return {
    slope,
    intercept,
    x: [minX, maxX],
    y: [slope * minX + intercept, slope * maxX + intercept],
  };
};

const createCorrelationFigure = (
  data: VisualizationCorrelationResponse,
  showTrendline: boolean,
  xTitle: string,
  yTitle: string,
): Pick<PlotParams, "data" | "layout"> => {
  const points = data.points.filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
  const trendline = showTrendline ? buildTrendline(points) : null;

  return {
    data: [
      {
        x: points.map((point) => point.x),
        y: points.map((point) => point.y),
        type: "scatter" as const,
        mode: "markers" as const,
        name: "Observaciones",
        marker: { color: "#2563eb", size: 8, opacity: 0.8 },
        text: points.map((point) => `x: ${point.x.toFixed(3)}<br>y: ${point.y.toFixed(3)}`),
        hovertemplate: "%{text}<extra></extra>",
      } as PlotParams["data"][number],
      ...(trendline
        ? [
            {
              x: trendline.x,
              y: trendline.y,
              type: "scatter" as const,
              mode: "lines" as const,
              name: "Línea de tendencia",
              line: { color: "#991b1b", width: 3, dash: "dash" },
              hovertemplate: `y = ${trendline.slope.toFixed(4)}x + ${trendline.intercept.toFixed(4)}<extra></extra>`,
            } as PlotParams["data"][number],
          ]
        : []),
    ],
    layout: createPlotLayout({
      hovermode: "closest",
      xaxis: { title: { text: xTitle }, showgrid: true, gridcolor: "#eef2f7" },
      yaxis: { title: { text: yTitle }, showgrid: true, gridcolor: "#eef2f7" },
      annotations: trendline
        ? [
            {
              text: `y = ${trendline.slope.toFixed(4)}x + ${trendline.intercept.toFixed(4)}`,
              xref: "paper",
              yref: "paper",
              x: 0.02,
              y: 0.98,
              showarrow: false,
              bgcolor: "rgba(255,255,255,0.9)",
              bordercolor: "#d1d5db",
              borderwidth: 1,
              font: { color: "#111827", size: 12 },
            },
          ]
        : [],
    }),
  };
};

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

function VariableLegend({ primary, secondary }: { primary: string; secondary: string }) {
  return (
    <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-600">
      <span className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-3 py-1">
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-600" />
        {primary}
      </span>
      <span className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-3 py-1">
        <span className="h-2.5 w-2.5 rounded-full bg-blue-600" />
        {secondary}
      </span>
    </div>
  );
}

export default function VisualizationView({ projectOptions, variables }: VisualizationViewProps) {
  const [tab, setTab] = useState<TabKey>("serie");
  const [chartType, setChartType] = useState<SeriesChartMode>("Líneas");
  const [projectId, setProjectId] = useState<string>(projectOptions[0]?.id ? String(projectOptions[0].id) : "");
  const [primaryVariableId, setPrimaryVariableId] = useState<string>(variables[0]?.id ? String(variables[0].id) : "");
  const [secondaryVariableId, setSecondaryVariableId] = useState<string>(variables[1]?.id ? String(variables[1].id) : variables[0]?.id ? String(variables[0].id) : "");
  const [timeSeries, setTimeSeries] = useState<VisualizationTimeSeriesResponse | null>(null);
  const [siteComparison, setSiteComparison] = useState<VisualizationBySiteResponse | null>(null);
  const [correlation, setCorrelation] = useState<VisualizationCorrelationResponse | null>(null);
  const [siteMetadata, setSiteMetadata] = useState<Site[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emptyReason, setEmptyReason] = useState<string | null>(null);
  const [showTrendline, setShowTrendline] = useState(true);
  const [siteComparisonLimit, setSiteComparisonLimit] = useState<SiteComparisonLimit>(20);

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
    const projectIdNumber = projectId ? toNumber(projectId) : undefined;

    if (!projectIdNumber) {
      setSiteMetadata([]);
      return;
    }

    let active = true;

    sitesService
      .getByProject(projectIdNumber)
      .then((sites) => {
        if (active) {
          setSiteMetadata(sites);
        }
      })
      .catch(() => {
        if (active) {
          setSiteMetadata([]);
        }
      });

    return () => {
      active = false;
    };
  }, [projectId]);

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
      variable_ids: [primaryIdNumber, secondaryIdNumber].filter((value): value is number => typeof value === "number"),
      secondary_variable_id: secondaryIdNumber,
      variable_x_id: primaryIdNumber,
      variable_y_id: secondaryIdNumber,
      chart_type: tab === "serie" ? "Líneas" : tab === "sitio" ? "Barras" : "Dispersión",
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
  }, [primaryVariableId, projectId, secondaryVariableId, tab]);

  const primaryVariableLabel = variableChoices.find((variable) => variable.value === primaryVariableId)?.label ?? "Variable principal";
  const secondaryVariableLabel = variableChoices.find((variable) => variable.value === secondaryVariableId)?.label ?? "Variable secundaria";
  const siteLabelsByCode = useMemo(() => new Map(siteMetadata.map((site) => [site.site_code, formatSiteLabel(site)])), [siteMetadata]);
  const siteComparisonCaption = siteComparisonLimit > 0 ? `Mostrando los top ${siteComparisonLimit} sitios con mayor valor agregado` : "Mostrando todos los sitios disponibles";

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
      const figure =
        chartType === "Barras"
          ? createBarFigure(timeSeries)
          : chartType === "Boxplot"
            ? createBoxFigure(timeSeries)
            : chartType === "Histograma"
              ? createHistogramFigure(timeSeries)
              : createLineFigure(timeSeries);

      return (
        <div>
          <VariableLegend primary={primaryVariableLabel} secondary={secondaryVariableLabel} />
          <div className="h-[28rem]">
            <PlotlyFigure
              data={figure.data}
              layout={figure.layout}
              config={{ responsive: true, displayModeBar: true, displaylogo: false }}
            />
          </div>
        </div>
      );
    }

    if (tab === "sitio" && siteComparison) {
      const figure = createSiteComparisonFigure(siteComparison, siteLabelsByCode, siteComparisonLimit);

      return (
        <div className="h-[30rem]">
          <PlotlyFigure
            data={figure.data}
            layout={figure.layout}
            config={{ responsive: true, displayModeBar: true, displaylogo: false }}
          />
        </div>
      );
    }

    if (tab === "correlacion" && correlation) {
      const figure = createCorrelationFigure(correlation, showTrendline, primaryVariableLabel, secondaryVariableLabel);

      return (
        <div>
          <VariableLegend primary={primaryVariableLabel} secondary={secondaryVariableLabel} />
          <div className="h-[28rem]">
            <PlotlyFigure
              data={figure.data}
              layout={figure.layout}
              config={{ responsive: true, displayModeBar: true, displaylogo: false }}
            />
          </div>
        </div>
      );
    }

    return <div className="flex h-[24rem] items-center justify-center text-sm text-gray-500">No hay datos para mostrar con la configuración actual.</div>;
  }, [chartType, correlation, emptyReason, error, loading, showTrendline, siteComparison, siteComparisonLimit, siteLabelsByCode, tab, timeSeries]);

  const exportUrl = useMemo(() => {
    const projectIdNumber = projectId ? toNumber(projectId) : undefined;
    const primaryIdNumber = primaryVariableId ? toNumber(primaryVariableId) : undefined;
    const secondaryIdNumber = secondaryVariableId ? toNumber(secondaryVariableId) : undefined;

    return visualizationService.exportChart({
      project_id: projectIdNumber,
      variable_id: primaryIdNumber,
      variable_ids: chartType ? [primaryIdNumber, secondaryIdNumber].filter((value): value is number => typeof value === "number") : undefined,
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
              <select value={chartType} onChange={(event) => setChartType(event.target.value as SeriesChartMode)} className="h-11 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm text-gray-700 shadow-sm outline-none transition focus:border-green-500 focus:bg-white">
                {seriesChartModes.map((mode) => (
                  <option key={mode} value={mode}>
                    {mode}
                  </option>
                ))}
              </select>
            </label>

            {tab === "sitio" ? (
              <label className="block">
                <span className="mb-2 block text-sm text-gray-700">Sitios visibles</span>
                <select
                  value={siteComparisonLimit}
                  onChange={(event) => setSiteComparisonLimit(Number(event.target.value) as SiteComparisonLimit)}
                  className="h-11 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm text-gray-700 shadow-sm outline-none transition focus:border-green-500 focus:bg-white"
                >
                  {siteComparisonLimits.map((option) => (
                    <option key={option.label} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            {tab === "correlacion" ? (
              <label className="block">
                <span className="mb-2 block text-sm text-gray-700">Tendencia</span>
                <button
                  type="button"
                  onClick={() => setShowTrendline((current) => !current)}
                  className={`flex h-11 w-full items-center justify-center rounded-lg border px-3 text-sm shadow-sm transition ${showTrendline ? "border-green-200 bg-green-50 text-green-700" : "border-gray-200 bg-gray-50 text-gray-700"}`}
                >
                  {showTrendline ? "Ocultar línea" : "Mostrar línea"}
                </button>
              </label>
            ) : null}
          </div>

          <p className="mt-4 text-sm text-gray-500">
            Los filtros de proyecto y variables afectan a todos los tabs. El selector de tipo de gráfica solo cambia la representación del tab de Serie Temporal.
          </p>
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
          subtitle={tab === "serie" ? `Variación de ${primaryVariableLabel} y ${secondaryVariableLabel} a lo largo del tiempo` : tab === "sitio" ? `${siteComparisonCaption}. Se comparan ${primaryVariableLabel} y ${secondaryVariableLabel} por sitio.` : `Relación exploratoria entre ${primaryVariableLabel} y ${secondaryVariableLabel}`}
        >
          {chartBody}
        </ChartShell>
      </div>
    </div>
  );
}