"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import type {
  DashboardRecord,
  FilterOption,
  Site,
  VariableRead,
  VisualizationBySiteResponse,
  VisualizationCorrelationResponse,
  VisualizationTimeSeriesResponse,
} from "@/app/services";
import { ApiError, dashboardService, sitesService, visualizationService } from "@/app/services";
import PlotlyFigure from "./PlotlyFigure";
import type { PlotParams } from "react-plotly.js";

/** Axis/trace labels handed to the module-level Plotly figure builders. */
type FigureLabels = {
  time: string;
  value: string;
  frequency: string;
  variable: string;
  site: string;
  depth: string;
  observations: string;
  trendline: string;
};

type ProfileColorBy = "site" | "date";

type VisualizationViewProps = {
  projectOptions: FilterOption[];
  variables: VariableRead[];
  initialProjectId?: string;
  initialSiteId?: string;
  initialSiteCode?: string;
  initialVariableId?: string;
};

type TabKey = "serie" | "sitio" | "correlacion" | "perfil";

type SeriesChartMode = "Líneas" | "Barras" | "Boxplot" | "Histograma";
type SiteComparisonLimit = 10 | 20 | 50 | 0;

const TAB_KEYS: TabKey[] = ["serie", "sitio", "correlacion", "perfil"];

const seriesChartModes: SeriesChartMode[] = ["Líneas", "Barras", "Boxplot", "Histograma"];
const siteComparisonLimitValues: SiteComparisonLimit[] = [10, 20, 50, 0];

const seriesPalette = ["#16a34a", "#2563eb", "#f97316", "#7c3aed", "#0891b2", "#ef4444"];

const sitePalette = ["#2563eb", "#16a34a", "#f97316", "#7c3aed", "#0891b2", "#ef4444"];

const formatVariableLabel = (variable: VariableRead) => {
  const baseLabel =
    variable.name?.trim() || variable.label?.trim() || variable.variable_code?.trim() || `Variable ${variable.id}`;
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

// `barmode` is a valid Plotly layout key that the Layout type in the installed plotly.js typings
// no longer declares, so it is allowed here explicitly.
type LayoutOverrides = PlotParams["layout"] & { barmode?: "group" | "stack" | "overlay" | "relative" };

const createPlotLayout = (overrides?: LayoutOverrides): PlotParams["layout"] => ({
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

const createLineFigure = (data: VisualizationTimeSeriesResponse, L: FigureLabels): Pick<PlotParams, "data" | "layout"> => ({
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
    xaxis: { title: { text: L.time }, showgrid: true, gridcolor: "#eef2f7" },
    yaxis: { title: { text: L.value }, showgrid: true, gridcolor: "#eef2f7" },
  }),
});

const createBarFigure = (data: VisualizationTimeSeriesResponse, L: FigureLabels): Pick<PlotParams, "data" | "layout"> => ({
  data: data.series.map((series, seriesIndex) => ({
    x: data.labels,
    y: series.values,
    type: "bar" as const,
    name: series.variable_name,
    marker: { color: seriesPalette[seriesIndex % seriesPalette.length] },
  }) as PlotParams["data"][number]),
  layout: createPlotLayout({
    barmode: "group",
    xaxis: { title: { text: L.time }, showgrid: true, gridcolor: "#eef2f7" },
    yaxis: { title: { text: L.value }, showgrid: true, gridcolor: "#eef2f7" },
  }),
});

// Boxplot describes the distribution of a SINGLE variable, so it only renders the
// primary series (series[0]); the secondary variable is ignored for this chart.
const createBoxFigure = (data: VisualizationTimeSeriesResponse, L: FigureLabels): Pick<PlotParams, "data" | "layout"> => ({
  data: data.series.slice(0, 1).map((series) => ({
    y: getFiniteNumbers(series.values),
    type: "box" as const,
    name: series.variable_name,
    boxmean: "sd",
    boxpoints: "outliers",
    marker: { color: seriesPalette[0] },
    line: { color: seriesPalette[0] },
  }) as PlotParams["data"][number]),
  layout: createPlotLayout({
    yaxis: { title: { text: L.value }, showgrid: true, gridcolor: "#eef2f7" },
    xaxis: { title: { text: L.variable } },
  }),
});

const createHistogramFigure = (data: VisualizationTimeSeriesResponse, L: FigureLabels): Pick<PlotParams, "data" | "layout"> => ({
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
    xaxis: { title: { text: L.value }, showgrid: true, gridcolor: "#eef2f7" },
    yaxis: { title: { text: L.frequency }, showgrid: true, gridcolor: "#eef2f7" },
  }),
});

const createSiteComparisonFigure = (
  data: VisualizationBySiteResponse,
  labelsByCategory: Map<string, string>,
  limit: SiteComparisonLimit,
  L: FigureLabels,
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
      xaxis: { title: { text: L.site }, showgrid: false, tickangle: -25, automargin: true },
      yaxis: { title: { text: L.value }, showgrid: true, gridcolor: "#eef2f7" },
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
  L: FigureLabels,
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
        name: L.observations,
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
              name: L.trendline,
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

// Depth profile: X = value, Y = depth (cm) with the axis reversed so 0 (surface)
// is at the top. One trace per group (site or date), points ordered by depth.
const createProfileFigure = (
  records: DashboardRecord[],
  colorBy: ProfileColorBy,
  L: FigureLabels,
): Pick<PlotParams, "data" | "layout"> => {
  const groups = new Map<string, { x: number; y: number }[]>();
  for (const r of records) {
    const value = Number(r.value);
    const depth = r.depth_cm;
    if (!Number.isFinite(value) || depth === null || depth === undefined) {
      continue;
    }
    const key = colorBy === "date" ? String(r.event_date ?? r.date ?? "—") : String(r.site_code ?? "—");
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push({ x: value, y: Number(depth) });
  }

  const data = Array.from(groups.entries()).map(([name, points], index) => {
    const ordered = [...points].sort((a, b) => a.y - b.y);
    const color = sitePalette[index % sitePalette.length];
    return {
      x: ordered.map((p) => p.x),
      y: ordered.map((p) => p.y),
      type: "scatter" as const,
      mode: "lines+markers" as const,
      name,
      line: { color },
      marker: { color, size: 7 },
    } as PlotParams["data"][number];
  });

  return {
    data,
    layout: createPlotLayout({
      hovermode: "closest",
      xaxis: { title: { text: L.value }, showgrid: true, gridcolor: "#eef2f7" },
      yaxis: { title: { text: L.depth }, autorange: "reversed", showgrid: true, gridcolor: "#eef2f7" },
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

function VariableLegend({ primary, secondary }: { primary: string; secondary?: string }) {
  return (
    <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-600">
      <span className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-3 py-1">
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-600" />
        {primary}
      </span>
      {secondary ? (
        <span className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-3 py-1">
          <span className="h-2.5 w-2.5 rounded-full bg-blue-600" />
          {secondary}
        </span>
      ) : null}
    </div>
  );
}

export default function VisualizationView({
  projectOptions,
  variables,
  initialProjectId,
  initialSiteId,
  initialSiteCode,
  initialVariableId,
}: VisualizationViewProps) {
  const t = useTranslations("visualization");
  const figureLabels = useMemo<FigureLabels>(
    () => ({
      time: t("axis.time"),
      value: t("axis.value"),
      frequency: t("axis.frequency"),
      variable: t("axis.variable"),
      site: t("axis.site"),
      depth: t("axis.depth"),
      observations: t("trace.observations"),
      trendline: t("trace.trendline"),
    }),
    [t],
  );
  const [tab, setTab] = useState<TabKey>("serie");
  const [chartType, setChartType] = useState<SeriesChartMode>("Líneas");
  const [projectId, setProjectId] = useState<string>(
    initialProjectId || (projectOptions[0]?.id ? String(projectOptions[0].id) : ""),
  );
  const [siteId, setSiteId] = useState<string>(initialSiteId ?? "");
  const [siteOptions, setSiteOptions] = useState<FilterOption[]>([]);
  // Only variables of the same matrix can be compared (a sample is one matrix).
  const [matrix, setMatrix] = useState<string>("");
  const [primaryVariableId, setPrimaryVariableId] = useState<string>(
    initialVariableId || (variables[0]?.id ? String(variables[0].id) : ""),
  );
  const [secondaryVariableId, setSecondaryVariableId] = useState<string>(variables[1]?.id ? String(variables[1].id) : variables[0]?.id ? String(variables[0].id) : "");
  const [timeSeries, setTimeSeries] = useState<VisualizationTimeSeriesResponse | null>(null);
  const [siteComparison, setSiteComparison] = useState<VisualizationBySiteResponse | null>(null);
  const [correlation, setCorrelation] = useState<VisualizationCorrelationResponse | null>(null);
  const [profile, setProfile] = useState<DashboardRecord[] | null>(null);
  const [profileColorBy, setProfileColorBy] = useState<ProfileColorBy>("site");
  const [siteMetadata, setSiteMetadata] = useState<Site[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emptyReason, setEmptyReason] = useState<string | null>(null);
  const [showTrendline, setShowTrendline] = useState(true);
  const [siteComparisonLimit, setSiteComparisonLimit] = useState<SiteComparisonLimit>(20);

  // A specific site filters the time-series and correlation charts ("site mode").
  // "Comparación por Sitio" compares across sites, so it is disabled while a site
  // is selected.
  const selectedSiteLabel =
    siteOptions.find((option) => String(option.id) === siteId)?.label ?? initialSiteCode ?? siteId;

  const matrixOptions = useMemo(
    () => Array.from(new Set(variables.map((v) => v.matrix).filter((m): m is string => Boolean(m)))).sort(),
    [variables],
  );

  const variableChoices = useMemo(
    () =>
      variables
        .filter((variable) => !matrix || variable.matrix === matrix)
        .map((variable) => ({ value: String(variable.id), label: formatVariableLabel(variable) })),
    [variables, matrix],
  );

  // Switching matrix resets the two variable selections to valid same-matrix ones.
  const onMatrixChange = (next: string) => {
    setMatrix(next);
    const filtered = variables.filter((v) => !next || v.matrix === next);
    setPrimaryVariableId(filtered[0]?.id ? String(filtered[0].id) : "");
    setSecondaryVariableId(
      filtered[1]?.id ? String(filtered[1].id) : filtered[0]?.id ? String(filtered[0].id) : "",
    );
  };

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

  // Site catalog for the "Sitio" selector (uncapped). Drops the active site if it
  // no longer belongs to the selected project.
  useEffect(() => {
    const projectIdNumber = projectId ? toNumber(projectId) : undefined;

    if (!projectIdNumber) {
      setSiteOptions([]);
      return;
    }

    let active = true;

    sitesService
      .getOptions(projectIdNumber)
      .then((options) => {
        if (!active) {
          return;
        }
        setSiteOptions(options);
        setSiteId((current) => (current && options.some((option) => String(option.id) === current) ? current : ""));
      })
      .catch(() => {
        if (active) {
          setSiteOptions([]);
        }
      });

    return () => {
      active = false;
    };
  }, [projectId]);

  // "Comparación por Sitio" is meaningless for a single site → leave that tab.
  useEffect(() => {
    if (siteId && tab === "sitio") {
      setTab("serie");
    }
  }, [siteId, tab]);

  // Depth profile uses the long records dataset (it carries depth_cm), so it has
  // its own loader; the shared effect below handles the other three tabs.
  useEffect(() => {
    if (tab !== "perfil") {
      return;
    }
    const projectIdNumber = projectId ? toNumber(projectId) : undefined;
    const primaryIdNumber = primaryVariableId ? toNumber(primaryVariableId) : undefined;

    if (!projectIdNumber || !primaryIdNumber) {
      setProfile(null);
      setError(null);
      setEmptyReason(t("states.selectProjectVariable"));
      return;
    }

    let active = true;
    setLoading(true);
    setError(null);
    setEmptyReason(null);

    dashboardService
      .getRecordsDataset(
        {
          project_id: projectIdNumber,
          variable_id: primaryIdNumber,
          site_id: siteId ? toNumber(siteId) : undefined,
        },
        5000,
      )
      .then((response) => {
        if (!active) {
          return;
        }
        const withDepth = response.items.filter(
          (r) => r.depth_cm !== null && r.depth_cm !== undefined && Number.isFinite(Number(r.value)),
        );
        const distinctDepths = new Set(withDepth.map((r) => r.depth_cm));
        if (!withDepth.length) {
          setProfile(null);
          setEmptyReason(t("states.noDepthData"));
          return;
        }
        setProfile(withDepth);
        // Single depth layer → nothing to profile; warn but still show the point.
        setEmptyReason(distinctDepths.size <= 1 ? t("states.singleDepth") : null);
      })
      .catch((requestError) => {
        if (!active) {
          return;
        }
        setError(requestError instanceof Error ? requestError.message : t("states.genericError"));
        setProfile(null);
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [tab, projectId, primaryVariableId, siteId, t]);

  useEffect(() => {
    if (tab === "perfil") {
      return;
    }
    const projectIdNumber = projectId ? toNumber(projectId) : undefined;
    const primaryIdNumber = primaryVariableId ? toNumber(primaryVariableId) : undefined;
    const secondaryIdNumber = secondaryVariableId ? toNumber(secondaryVariableId) : undefined;
    const siteIdNumber = siteId ? toNumber(siteId) : undefined;

    if (!projectIdNumber || !primaryIdNumber) {
      setTimeSeries(null);
      setSiteComparison(null);
      setCorrelation(null);
      setError(null);
      setEmptyReason(t("states.selectProjectVariable"));
      return;
    }

    let active = true;
    setLoading(true);
    setError(null);
    setEmptyReason(null);

    const baseQuery = {
      project_id: projectIdNumber,
      // Only the time-series and correlation charts are filtered by site; the
      // by-site comparison is disabled while a site is selected.
      site_id: tab === "sitio" ? undefined : siteIdNumber,
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
            setEmptyReason(siteId ? t("states.noSiteData") : t("states.noValidDates"));
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
        const errorMessage = requestError instanceof Error ? requestError.message : t("states.genericError");
        const isUnsupportedAggregation = errorMessage.toLowerCase().includes("unsupported aggregation") || apiError?.status === 400;
        const isTemporalDataIssue = isDateFormattingError(errorMessage) || /strftime/i.test(JSON.stringify(apiError?.payload ?? ""));

        if (isUnsupportedAggregation || isTemporalDataIssue) {
          setError(null);
          setEmptyReason(t("states.tempIssue"));
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
  }, [primaryVariableId, projectId, secondaryVariableId, siteId, tab]);

  const primaryVariableLabel = variableChoices.find((variable) => variable.value === primaryVariableId)?.label ?? t("legend.primaryFallback");
  const secondaryVariableLabel = variableChoices.find((variable) => variable.value === secondaryVariableId)?.label ?? t("legend.secondaryFallback");
  const siteLabelsByCode = useMemo(() => new Map(siteMetadata.map((site) => [site.site_code, formatSiteLabel(site)])), [siteMetadata]);
  const siteComparisonCaption = siteComparisonLimit > 0 ? t("chart.topSites", { count: siteComparisonLimit }) : t("chart.allSitesCaption");

  const chartBody = useMemo(() => {
    if (loading) {
      return <div className="flex h-[24rem] items-center justify-center text-sm text-gray-500">{t("states.loading")}</div>;
    }

    if (error) {
      return <div className="flex h-[24rem] items-center justify-center text-sm text-red-600">{error}</div>;
    }

    if (emptyReason) {
      return <div className="flex h-[24rem] items-center justify-center text-center text-sm text-amber-600">{emptyReason}</div>;
    }

    if (tab === "serie" && timeSeries && !isUsableSeries(timeSeries)) {
      return (
        <div className="flex h-[24rem] items-center justify-center text-center text-sm text-amber-600">
          {siteId ? t("states.noSiteData") : t("states.noValidDates")}
        </div>
      );
    }

    // Line/bar charts need time variation; a single date has no evolution to show.
    if (tab === "serie" && timeSeries && (chartType === "Líneas" || chartType === "Barras")) {
      const distinctTimes = new Set((timeSeries.labels ?? []).map((label) => (label ?? "").trim()).filter(Boolean));
      if (distinctTimes.size <= 1) {
        return (
          <div className="flex h-[24rem] items-center justify-center text-center text-sm text-amber-600">
            {t("states.noTimeVariation")}
          </div>
        );
      }
    }

    if (tab === "serie" && timeSeries) {
      const figure =
        chartType === "Barras"
          ? createBarFigure(timeSeries, figureLabels)
          : chartType === "Boxplot"
            ? createBoxFigure(timeSeries, figureLabels)
            : chartType === "Histograma"
              ? createHistogramFigure(timeSeries, figureLabels)
              : createLineFigure(timeSeries, figureLabels);

      // Boxplot is single-variable: only the primary shows in the legend.
      return (
        <div>
          <VariableLegend primary={primaryVariableLabel} secondary={chartType === "Boxplot" ? undefined : secondaryVariableLabel} />
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
      const figure = createSiteComparisonFigure(siteComparison, siteLabelsByCode, siteComparisonLimit, figureLabels);

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
      const figure = createCorrelationFigure(correlation, showTrendline, primaryVariableLabel, secondaryVariableLabel, figureLabels);

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

    if (tab === "perfil" && profile) {
      const figure = createProfileFigure(profile, profileColorBy, figureLabels);

      return (
        <div>
          <VariableLegend primary={primaryVariableLabel} secondary={undefined} />
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

    return <div className="flex h-[24rem] items-center justify-center text-sm text-gray-500">{t("states.noData")}</div>;
  }, [chartType, correlation, emptyReason, error, figureLabels, loading, primaryVariableLabel, profile, profileColorBy, secondaryVariableLabel, showTrendline, siteComparison, siteComparisonLimit, siteId, siteLabelsByCode, t, tab, timeSeries]);

  const exportUrl = useMemo(() => {
    const projectIdNumber = projectId ? toNumber(projectId) : undefined;
    const primaryIdNumber = primaryVariableId ? toNumber(primaryVariableId) : undefined;
    const secondaryIdNumber = secondaryVariableId ? toNumber(secondaryVariableId) : undefined;
    const siteIdNumber = siteId ? toNumber(siteId) : undefined;

    // The profile tab is not a chart-endpoint chart type; export its underlying
    // records (value + depth) instead.
    if (tab === "perfil") {
      return dashboardService.exportRecords({
        project_id: projectIdNumber,
        variable_id: primaryIdNumber,
        site_id: siteIdNumber,
      });
    }

    // The export endpoint keys off the active tab (timeseries|by-site|correlation),
    // not the series render style (Líneas/Barras/…).
    const exportChartType = tab === "serie" ? "timeseries" : tab === "sitio" ? "by-site" : "correlation";

    return visualizationService.exportChart({
      project_id: projectIdNumber,
      site_id: tab === "sitio" ? undefined : siteIdNumber,
      variable_id: primaryIdNumber,
      variable_ids: [primaryIdNumber, secondaryIdNumber].filter((value): value is number => typeof value === "number"),
      secondary_variable_id: secondaryIdNumber,
      variable_x_id: primaryIdNumber,
      variable_y_id: secondaryIdNumber,
      chart_type: exportChartType,
    });
  }, [primaryVariableId, projectId, secondaryVariableId, siteId, tab]);

  return (
    <div className="px-4 py-4 sm:px-6 lg:px-8 lg:py-6">
      <div className="mx-auto max-w-[1400px] space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-gray-900">{t("title")}</h1>
            <p className="mt-1 text-base text-gray-500">{t("subtitle")}</p>
          </div>

          <button
            type="button"
            onClick={() => window.open(exportUrl, "_blank", "noopener,noreferrer")}
            className="inline-flex w-fit items-center gap-2 rounded-xl border border-gray-200 bg-white px-5 py-3 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M12 4v10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              <path d="M7 10l5 5 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M4 20h16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            {t("exportChart")}
          </button>
        </div>

        {siteId ? (
          <div className="flex flex-col gap-3 rounded-3xl border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path d="M12 21s-6-5.2-6-10a6 6 0 1 1 12 0c0 4.8-6 10-6 10Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                  <circle cx="12" cy="11" r="2" stroke="currentColor" strokeWidth="1.5" />
                </svg>
              </span>
              <div>
                <p className="text-sm font-semibold text-amber-800">{t("siteMode.title")}</p>
                <p className="text-sm text-amber-700">
                  {t.rich("siteMode.showing", {
                    site: selectedSiteLabel,
                    b: (chunks) => <span className="font-medium">{chunks}</span>,
                  })}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSiteId("")}
              className="inline-flex w-fit items-center gap-2 rounded-xl border border-amber-300 bg-white px-4 py-2 text-sm font-medium text-amber-700 shadow-sm transition hover:bg-amber-100"
            >
              {t("siteMode.viewAll")}
            </button>
          </div>
        ) : null}

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
              <h2 className="text-lg font-medium text-gray-900">{t("config.title")}</h2>
              <p className="mt-1 text-sm text-gray-500">{t("config.subtitle")}</p>
            </div>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-4">
            <label className="block">
              <span className="mb-2 block text-sm text-gray-700">{t("config.project")}</span>
              <select
                value={projectId}
                onChange={(event) => {
                  setProjectId(event.target.value);
                  setSiteId("");
                }}
                className="h-11 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm text-gray-700 shadow-sm outline-none transition focus:border-brand-500 focus:bg-white"
              >
                {projectOptions.map((option) => (
                  <option key={option.id ?? option.label} value={String(option.id ?? option.label)}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm text-gray-700">{t("config.site")}</span>
              <select
                value={siteId}
                onChange={(event) => setSiteId(event.target.value)}
                className="h-11 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm text-gray-700 shadow-sm outline-none transition focus:border-brand-500 focus:bg-white"
              >
                <option value="">{t("config.allSites")}</option>
                {siteOptions.map((option) => (
                  <option key={option.id ?? option.label} value={String(option.id ?? "")}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            {matrixOptions.length > 0 ? (
              <label className="block">
                <span className="mb-2 block text-sm text-gray-700">{t("config.matrix")}</span>
                <select
                  value={matrix}
                  onChange={(event) => onMatrixChange(event.target.value)}
                  className="h-11 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm text-gray-700 shadow-sm outline-none transition focus:border-brand-500 focus:bg-white"
                >
                  <option value="">{t("config.allMatrices")}</option>
                  {matrixOptions.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            <label className="block">
              <span className="mb-2 block text-sm text-gray-700">{t("config.primaryVariable")}</span>
              <select value={primaryVariableId} onChange={(event) => setPrimaryVariableId(event.target.value)} className="h-11 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm text-gray-700 shadow-sm outline-none transition focus:border-brand-500 focus:bg-white">
                {variableChoices.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            {/* Boxplot and Profile are single-variable, so the secondary selector is hidden. */}
            {(tab === "serie" && chartType === "Boxplot") || tab === "perfil" ? null : (
              <label className="block">
                <span className="mb-2 block text-sm text-gray-700">{t("config.secondaryVariable")}</span>
                <select value={secondaryVariableId} onChange={(event) => setSecondaryVariableId(event.target.value)} className="h-11 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm text-gray-700 shadow-sm outline-none transition focus:border-brand-500 focus:bg-white">
                  {variableChoices.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {tab === "serie" ? (
              <label className="block">
                <span className="mb-2 block text-sm text-gray-700">{t("config.chartType")}</span>
                <select value={chartType} onChange={(event) => setChartType(event.target.value as SeriesChartMode)} className="h-11 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm text-gray-700 shadow-sm outline-none transition focus:border-brand-500 focus:bg-white">
                  {seriesChartModes.map((mode) => (
                    <option key={mode} value={mode}>
                      {t(`seriesMode.${mode}`)}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            {tab === "sitio" ? (
              <label className="block">
                <span className="mb-2 block text-sm text-gray-700">{t("config.visibleSites")}</span>
                <select
                  value={siteComparisonLimit}
                  onChange={(event) => setSiteComparisonLimit(Number(event.target.value) as SiteComparisonLimit)}
                  className="h-11 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm text-gray-700 shadow-sm outline-none transition focus:border-brand-500 focus:bg-white"
                >
                  {siteComparisonLimitValues.map((value) => (
                    <option key={value} value={value}>
                      {value > 0 ? t("siteLimit.sites", { count: value }) : t("siteLimit.all")}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            {tab === "correlacion" ? (
              <label className="block">
                <span className="mb-2 block text-sm text-gray-700">{t("config.trend")}</span>
                <button
                  type="button"
                  onClick={() => setShowTrendline((current) => !current)}
                  className={`flex h-11 w-full items-center justify-center rounded-lg border px-3 text-sm shadow-sm transition ${showTrendline ? "border-brand-200 bg-brand-50 text-brand-800" : "border-gray-200 bg-gray-50 text-gray-700"}`}
                >
                  {showTrendline ? t("config.hideLine") : t("config.showLine")}
                </button>
              </label>
            ) : null}

            {tab === "perfil" ? (
              <label className="block">
                <span className="mb-2 block text-sm text-gray-700">{t("config.colorBy")}</span>
                <select
                  value={profileColorBy}
                  onChange={(event) => setProfileColorBy(event.target.value as ProfileColorBy)}
                  className="h-11 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm text-gray-700 shadow-sm outline-none transition focus:border-brand-500 focus:bg-white"
                >
                  <option value="site">{t("config.colorBySite")}</option>
                  <option value="date">{t("config.colorByDate")}</option>
                </select>
              </label>
            ) : null}
          </div>

          <p className="mt-4 text-sm text-gray-500">
            {t("config.note")}
          </p>
        </section>

        <div className="flex w-fit flex-wrap gap-1 rounded-full border border-gray-200 bg-white p-1 shadow-sm">
          {TAB_KEYS.map((key) => {
            const disabled = key === "sitio" && Boolean(siteId);
            return (
              <button
                key={key}
                type="button"
                disabled={disabled}
                title={disabled ? t("tabDisabledHint") : undefined}
                onClick={() => setTab(key)}
                className={`rounded-full px-4 py-2 text-sm transition ${
                  tab === key ? "bg-gray-100 text-gray-900 shadow-sm" : "text-gray-600 hover:bg-gray-50"
                } ${disabled ? "cursor-not-allowed opacity-40 hover:bg-transparent" : ""}`}
              >
                {t(`tabs.${key}`)}
              </button>
            );
          })}
        </div>

        <ChartShell
          title={
            tab === "serie"
              ? chartType === "Boxplot" ? t("chart.boxplotTitle") : t("chart.serieTitle")
              : tab === "sitio" ? t("chart.sitioTitle") : tab === "perfil" ? t("chart.perfilTitle") : t("chart.correlacionTitle")
          }
          subtitle={
            tab === "serie"
              ? chartType === "Boxplot"
                ? t("chart.boxplotSubtitle", { primary: primaryVariableLabel })
                : t("chart.serieSubtitle", { primary: primaryVariableLabel, secondary: secondaryVariableLabel })
              : tab === "sitio"
                ? t("chart.sitioSubtitle", { caption: siteComparisonCaption, primary: primaryVariableLabel, secondary: secondaryVariableLabel })
                : tab === "perfil"
                  ? t("chart.perfilSubtitle", { primary: primaryVariableLabel })
                  : t("chart.correlacionSubtitle", { primary: primaryVariableLabel, secondary: secondaryVariableLabel })
          }
        >
          {chartBody}
        </ChartShell>
      </div>
    </div>
  );
}