import { apiClient } from "./api-client";
import type {
  DownloadEstimateResponse,
  DownloadExportQuery,
  DownloadFilters,
  RecentDownload,
} from "./api-types";

const toQuery = (filters: DownloadFilters) => ({
  project_ids: filters.project_ids,
  site_ids: filters.site_ids,
  variable_ids: filters.variable_ids,
  date_from: filters.date_from,
  date_to: filters.date_to,
  matrix: filters.matrix,
});

export const downloadService = {
  /** Conteo estimado de registros que arrojaría la exportación con los filtros actuales. */
  estimate: (filters: DownloadFilters) =>
    apiClient.get<DownloadEstimateResponse>("download/estimate", toQuery(filters)),

  /**
   * URL de descarga del export filtrado. Devuelve un archivo binario (xlsx/csv)
   * con Content-Disposition, por lo que se abre directamente desde el navegador.
   */
  buildExportUrl: (query: DownloadExportQuery) =>
    apiClient.buildUrl("download/export", {
      ...toQuery(query),
      format: query.format ?? "xlsx",
      include_metadata: query.include_metadata,
    }),

  /** Descargas recientes del usuario (opcional, para el panel lateral). */
  getRecent: () => apiClient.get<RecentDownload[]>("download/recent"),
};
