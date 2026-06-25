import { apiClient } from "./api-client";
import type {
  TemplateColumnsResponse,
  TemplateQuery,
  UploadImportRequest,
  UploadImportResponse,
  UploadValidationResponse,
} from "./api-types";

export const uploadService = {
  /** Catálogo de columnas disponibles para construir la plantilla (estructura + variables + EAV). */
  getTemplateColumns: (params?: { project_id?: number }) =>
    apiClient.get<TemplateColumnsResponse>("upload/template-columns", params),

  /**
   * URL para descargar la plantilla con las columnas seleccionadas.
   * Se abre/descarga directamente desde el navegador (devuelve un archivo binario).
   */
  buildTemplateUrl: (query: TemplateQuery) =>
    apiClient.buildUrl("upload/template", {
      columns: query.columns,
      format: query.format ?? "xlsx",
      include_examples: query.include_examples,
      project_id: query.project_id,
    }),

  /** Sube el archivo y lo valida en modo "dry-run" (no escribe en la BD todavía). */
  validate: (file: File, options?: { columns?: string[] }) => {
    const form = new FormData();
    form.append("file", file);
    if (options?.columns?.length) {
      form.append("columns", options.columns.join(","));
    }
    return apiClient.postForm<UploadValidationResponse>("upload/validate", form);
  },

  /** Confirma e importa un archivo previamente validado. */
  commit: (payload: UploadImportRequest) =>
    apiClient.post<UploadImportResponse, UploadImportRequest>("upload/import", payload),
};
