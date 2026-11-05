import { apiClient } from "./api-client";
import type {
  ColumnMappingEntry,
  TemplateColumnsResponse,
  TemplateQuery,
  UploadImportRequest,
  UploadImportResponse,
  UploadValidationResponse,
} from "./api-types";

export const uploadService = {
  /** Catálogo de columnas disponibles para construir la plantilla (estructura + variables + EAV). */
  getTemplateColumns: (params?: { project_id?: number; lang?: string }) =>
    apiClient.get<TemplateColumnsResponse>("upload/template-columns", params),

  /**
   * URL para descargar la plantilla con las columnas seleccionadas.
   * Se abre/descarga directamente desde el navegador (devuelve un archivo binario).
   * `lang` localiza los encabezados del archivo ("en" por defecto en la API).
   */
  buildTemplateUrl: (query: TemplateQuery, lang?: string) =>
    apiClient.buildUrl("upload/template", {
      columns: query.columns,
      format: query.format ?? "xlsx",
      include_examples: query.include_examples,
      project_id: query.project_id,
      lang,
    }),

  /**
   * Sube el archivo y lo valida en modo "dry-run" (no escribe en la BD todavía).
   *
   * `columnMapping` (mapeo explícito de columnas propias) y `columns` (selección
   * del Paso 1 / atajo "ya tengo la plantilla") son mutuamente excluyentes:
   * si hay mapeo, éste manda. `headerRow` (1-based) aplica a ambos caminos.
   */
  validate: (file: File, options?: { columns?: string[]; columnMapping?: ColumnMappingEntry[]; headerRow?: number }) => {
    const form = new FormData();
    form.append("file", file);
    if (options?.columnMapping?.length) {
      form.append("column_mapping", JSON.stringify(options.columnMapping));
    } else if (options?.columns?.length) {
      form.append("columns", options.columns.join(","));
    }
    if (options?.headerRow) {
      form.append("header_row", String(options.headerRow));
    }
    return apiClient.postForm<UploadValidationResponse>("upload/validate", form);
  },

  /** Confirma e importa un archivo previamente validado. */
  commit: (payload: UploadImportRequest) =>
    apiClient.post<UploadImportResponse, UploadImportRequest>("upload/import", payload),
};
