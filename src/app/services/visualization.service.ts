import { apiClient } from "./api-client";
import type {
  VisualizationBySiteResponse,
  VisualizationCorrelationResponse,
  VisualizationQuery,
  VisualizationTimeSeriesResponse,
} from "./api-types";

export const visualizationService = {
  getTimeSeries: (query?: VisualizationQuery) =>
    apiClient.get<VisualizationTimeSeriesResponse>("visualization/timeseries", query),
  getBySite: (query?: VisualizationQuery) =>
    apiClient.get<VisualizationBySiteResponse>("visualization/by-site", query),
  getCorrelation: (query?: VisualizationQuery) =>
    apiClient.get<VisualizationCorrelationResponse>("visualization/correlation", query),
  exportChart: (query?: VisualizationQuery) => apiClient.buildUrl("visualization/export", query),
};
