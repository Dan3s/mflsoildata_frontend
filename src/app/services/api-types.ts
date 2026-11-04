export interface ChatTurn {
  role: "user" | "assistant";
  text: string;
}

export interface ChatRequest {
  message: string;
  history: ChatTurn[];
}

export interface ChatResponse {
  reply: string;
}

export interface Project {
  id: number;
  code: string;
  name: string;
  country?: string | null;
  donor?: string | null;
  description?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface ProjectCreate {
  code: string;
  name: string;
  country?: string | null;
  donor?: string | null;
  description?: string | null;
}

export interface ProjectUpdate {
  name?: string | null;
  country?: string | null;
  donor?: string | null;
  description?: string | null;
}

export interface Site {
  id: number;
  project_id: number;
  site_code: string;
  country?: string | null;
  admin_1?: string | null;
  admin_2?: string | null;
  admin_3?: string | null;
  altitude_m?: number | null;
  created_at?: string;
  updated_at?: string;
}

export interface SiteCreate {
  project_id: number;
  site_code: string;
  country?: string | null;
  admin_1?: string | null;
  admin_2?: string | null;
  admin_3?: string | null;
  altitude_m?: number | null;
  latitude: number;
  longitude: number;
}

export interface SiteUpdate {
  site_code?: string | null;
  country?: string | null;
  admin_1?: string | null;
  admin_2?: string | null;
  admin_3?: string | null;
  altitude_m?: number | null;
}

export interface Sample {
  id: number;
  sample_code: string;
  sample_type_id: number;
  event_id?: number | null;
  site_id?: number | null;
  parent_sample_id?: number | null;
  created_at?: string;
  updated_at?: string;
}

export interface SampleCreate {
  sample_code: string;
  sample_type_id: number;
  event_id?: number | null;
  site_id?: number | null;
  parent_sample_id?: number | null;
}

export interface SampleUpdate {
  sample_code?: string | null;
  parent_sample_id?: number | null;
}

export interface Measurement {
  id: number;
  sample_id: number;
  variable_id: number;
  lab_batch_id?: number | null;
  unit_id?: number | null;
  measurement_code?: string | null;
  qualifier_result?: string | null;
  value_numeric?: number | null;
  value_text?: string | null;
  value_boolean?: boolean | null;
  value_date?: string | null;
  event_date?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface MeasurementCreate {
  sample_id: number;
  variable_id: number;
  lab_batch_id?: number | null;
  unit_id?: number | null;
  measurement_code?: string | null;
  qualifier_result?: string | null;
  value_numeric?: number | null;
  value_text?: string | null;
  value_boolean?: boolean | null;
  value_date?: string | null;
}

export interface MeasurementFilters {
  sample_id?: number;
  variable_id?: number;
  start_date?: string;
  end_date?: string;
  offset?: number;
  skip?: number;
  limit?: number;
}

export interface VariableRead {
  id: number;
  variable_code: string;
  /** Some catalog endpoints (e.g. GET /variables) return the display name as `label`. */
  name?: string | null;
  label?: string | null;
  domain: string;
  value_type: string;
  matrix?: string | null;
  default_unit_id?: number | null;
  description?: string | null;
}

export interface VariableCreate {
  variable_code: string;
  name: string;
  domain: string;
  value_type: string;
  matrix?: string | null;
  default_unit_id?: number | null;
  description?: string | null;
}

// ── EAV attributes & soil profiles ───────────────────────────────────────────

/** Attribute definition (site / sample / soil-profile) — shared shape. */
export interface AttributeDefinition {
  id: number;
  code: string;
  name: string;
  description?: string | null;
  value_type: TemplateValueType;
  default_unit_id?: number | null;
  category?: string | null;
}

export interface AttributeDefinitionCreate {
  code: string;
  name: string;
  description?: string | null;
  value_type: string;
  default_unit_id?: number | null;
  category?: string | null;
}

/** Value payload shared by all EAV values (only one value_* should be set). */
export interface AttributeValuePayload {
  value_numeric?: number | null;
  value_text?: string | null;
  value_boolean?: boolean | null;
  value_date?: string | null;
  unit_id?: number | null;
  effective_date?: string | null;
  source_name?: string | null;
  source_ref?: string | null;
  confidence?: number | null;
}

export interface SiteAttributeValueCreate extends AttributeValuePayload {
  site_id: number;
  site_attribute_id: number;
}

export interface SampleAttributeValueCreate extends AttributeValuePayload {
  sample_id: number;
  sample_attribute_id: number;
}

export interface SoilProfileAttributeValueCreate extends AttributeValuePayload {
  soil_profile_id: number;
  soil_profile_attribute_id: number;
}

export interface AttributeValue extends AttributeValuePayload {
  id: number;
}

export interface SoilProfile {
  id: number;
  project_id: number;
  profile_code: string;
  site_id?: number | null;
  event_id?: number | null;
}

export interface SoilProfileCreate {
  project_id: number;
  profile_code: string;
  site_id?: number | null;
  event_id?: number | null;
  notes?: unknown;
}

export interface DashboardSummary {
  projects: number;
  sites: number;
  samples: number;
  variables: number;
  measurements: number;
}

/** Counts for the anonymous landing-page teaser — PUBLIC-access data only. */
export interface PublicSummary {
  datasets: number;
  sites: number;
  samples: number;
  countries: number;
}

export interface DashboardRecord {
  sample_code: string;
  project_id: number;
  project_name: string;
  site_id: number;
  site_code: string;
  latitude?: number | null;
  longitude?: number | null;
  sample_type: string;
  matrix: string;
  variable_id: number;
  variable_name: string;
  value: string | number | boolean | null;
  unit: string | null;
  date: string | null;
  event_date?: string | null;
  /** Sampling depth (cm), from EAV attributes; null when the sample has no depth. */
  depth_from?: number | null;
  depth_to?: number | null;
  depth_cm?: number | null;
  laboratory: string | null;
  status: string;
}

export interface DashboardRecordDetailMeasurement {
  id: number;
  measurement_code?: string | null;
  variable_id: number;
  variable_name?: string | null;
  value: string | number | boolean | null;
  unit?: string | null;
  event_date?: string | null;
  status?: string | null;
}

export interface DashboardRecordsResponse {
  items: DashboardRecord[];
  total: number;
  skip: number;
  limit: number;
}

// ── Dataset submissions (approval / traceability) ─────────────────────────────

export type SubmissionStatus = "PENDING" | "APPROVED" | "REJECTED";

/** A variable described in the template's "New variables" sheet, staged with a submission. */
export interface NewVariableDef {
  code: string;
  name: string;
  value_type: string;
  matrix?: string | null;
  /** Unit as typed by the uploader; `unit_id` is set when it matched the catalogue. */
  unit?: string | null;
  unit_id?: number | null;
  /** General category that groups variables (e.g. LAB_RESULT); CUSTOM when left empty. */
  domain?: string | null;
  description?: string | null;
  /** An existing variable this one resembles (a likely duplicate). */
  similar_to?: { id: number; name: string; matrix?: string | null } | null;
}

/** The reviewer's decision for one new variable when approving a submission. */
export interface VariableResolution {
  code: string;
  action: "create" | "merge";
  /** Merge target (existing variable). */
  variable_id?: number | null;
  name?: string;
  matrix?: string | null;
  unit_id?: number | null;
  domain?: string | null;
  description?: string | null;
}

export interface SubmissionItem {
  id: number;
  project_id?: number | null;
  project_code?: string | null;
  project_name?: string | null;
  project_codes?: string[] | null;
  filename?: string | null;
  total_rows?: number | null;
  /** Dry-run estimate shown while PENDING; `inserted` is filled on approval. */
  summary?: Record<string, number> | null;
  warning_count?: number | null;
  /** Variables the uploader defined; they join the catalogue only on approval. */
  new_variables?: NewVariableDef[] | null;
  submitted_by_email?: string | null;
  submitted_by_name?: string | null;
  organization?: string | null;
  country?: string | null;
  status: SubmissionStatus;
  inserted?: Record<string, number> | null;
  submitted_at: string;
  reviewed_at?: string | null;
  reviewed_by_email?: string | null;
  reviewed_by_name?: string | null;
  review_notes?: string | null;
}

// ── Users & roles (Keycloak-backed, admin only) ───────────────────────────────

/** Realm roles this app manages, lowest privilege first. */
export type AppRole = "viewer" | "editor" | "database_editor" | "admin";

export interface UserItem {
  id: string;
  username?: string | null;
  email?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  enabled: boolean;
  organization?: string | null;
  country?: string | null;
  roles: AppRole[];
}

/** A concept label from FAO's AGROVOC thesaurus. */
export interface AgrovocTerm {
  label: string;
  uri?: string | null;
}

/**
 * A keyword as stored. Datasets saved before AGROVOC support hold plain strings,
 * so both shapes must be accepted on read.
 */
export type KeywordValue = string | AgrovocTerm;

/** Minimal identity used by the authorized-users picker. */
export interface UserOption {
  email: string;
  name?: string | null;
  organization?: string | null;
}

/** A staged row of a submission, as shown to the reviewer before deciding. */
export interface SubmissionRowItem {
  row_number?: number | null;
  project_code?: string | null;
  site_code?: string | null;
  sample_code?: string | null;
  data: Record<string, unknown>;
}

export interface SubmissionRowsResponse {
  total: number;
  offset: number;
  limit: number;
  rows: SubmissionRowItem[];
}

// ── Project metadata (FAIR) + dataset catalogue ───────────────────────────────

export type AccessLevel = "PUBLIC" | "RESTRICTED" | "PRIVATE" | "EMBARGOED" | "LICENSED" | "CONFIDENTIAL";
export type QcStatus = "NOT_REVIEWED" | "IN_REVIEW" | "PASSED" | "FAILED";

/** One row per project in the dataset catalogue (project + metadata summary). */
export interface DatasetCatalogueItem {
  project_id: number;
  code: string;
  name: string;
  /** Countries derived from the project's sites (a project can span several). */
  countries: string[];
  title?: string | null;
  abstract?: string | null;
  access_level?: AccessLevel | null;
  quality_controlled?: boolean | null;
  qc_status?: QcStatus | null;
  keywords?: KeywordValue[] | null;
  expected_matrices?: string[] | null;
  data_source?: string | null;
  version?: string | null;
  temporal_coverage_start?: string | null;
  temporal_coverage_end?: string | null;
  has_metadata: boolean;
  updated_at?: string | null;
}

/** Full FAIR metadata record for a project (read). */
export interface ProjectMetadata {
  id: number;
  project_id: number;
  title?: string | null;
  abstract?: string | null;
  keywords?: KeywordValue[] | null;
  persistent_id?: string | null;
  related_publications?: unknown;
  version?: string | null;
  temporal_coverage_start?: string | null;
  temporal_coverage_end?: string | null;
  spatial_coverage?: string | null;
  spatial_data_type?: string | null;
  expected_matrices?: string[] | null;
  expected_variables?: string | null;
  sampling_design?: string | null;
  access_level: AccessLevel;
  authorized_users?: string[] | null;
  embargo_until?: string | null;
  license?: string | null;
  access_conditions?: string | null;
  data_source?: string | null;
  provenance?: string | null;
  methodology?: string | null;
  citation?: string | null;
  usage_notes?: string | null;
  contact_name?: string | null;
  contact_email?: string | null;
  /** Backup contact, in case the primary one doesn't answer. */
  contact_name_2?: string | null;
  contact_email_2?: string | null;
  /** Authors/creators for citation, "Name (Affiliation)" per entry — distinct from the contact above. */
  authors?: string[] | null;
  /** Grant + funder, free text (e.g. "INV-12345 — Bill & Melinda Gates Foundation"). */
  funding_information?: string | null;
  language?: string | null;
  /** Other datasets this one relates to/continues (ours, Dataverse, CGSpace…). */
  related_datasets?: string[] | null;
  /** Discipline — see DATAVERSE_SUBJECTS for suggested values; stored as free text. */
  subject?: string | null;
  /** Geographic extent as declared by the dataset's source, display string. */
  geographic_bounding_box?: string | null;
  quality_controlled: boolean;
  qc_status: QcStatus;
  qc_date?: string | null;
  qc_by?: string | null;
  qc_notes?: string | null;
  data_last_updated?: string | null;
  notes?: unknown;
  created_at: string;
  updated_at: string;
}

/** Partial payload for creating/updating metadata (only sent fields change). */
export type ProjectMetadataUpsert = Partial<
  Omit<ProjectMetadata, "id" | "project_id" | "created_at" | "updated_at" | "access_level" | "quality_controlled" | "qc_status">
> & {
  access_level?: AccessLevel;
  quality_controlled?: boolean;
  qc_status?: QcStatus;
};

/** Wide/pivoted dataset for the Graphic Walker explorer (one row per sample). */
export interface WideColumn {
  key: string;
  label: string;
  role: "dimension" | "measure";
  semantic: "nominal" | "quantitative" | "temporal";
}

export interface WideDatasetResponse {
  columns: WideColumn[];
  rows: Record<string, string | number | null>[];
  total_samples: number;
}

export interface WideDatasetFilters {
  /** Institution that owns the data (a dataset's data_source). */
  institution?: string;
  variable_ids: number[];
  all_variables?: boolean;
  matrix?: string;
  project_id?: number;
  site_id?: number;
  sample_type_id?: number;
  date_from?: string;
  date_to?: string;
  limit?: number;
  /** Dimension label language for the returned columns ('en' | 'es'). */
  lang?: string;
}

export interface DashboardRecordFilters {
  project_id?: number;
  site_id?: number;
  sample_type_id?: number;
  matrix?: string;
  variable_id?: number;
  date_from?: string;
  date_to?: string;
  search?: string;
  country?: string;
  /** Institution that owns the data (a dataset's data_source). */
  institution?: string;
  depth_from?: number;
  depth_to?: number;
  skip?: number;
  limit?: number;
}

export interface FilterOption {
  id?: number;
  code?: string;
  label: string;
}

export interface VisualizationQuery {
  project_id?: number;
  site_id?: number;
  variable_id?: number;
  variable_ids?: number[];
  secondary_variable_id?: number;
  variable_x_id?: number;
  variable_y_id?: number;
  date_from?: string;
  date_to?: string;
  matrix?: string;
  aggregation?: string;
  chart_type?: string;
}

export interface VisualizationSeriesItem {
  variable_id: number;
  variable_name: string;
  values: number[];
}

export interface VisualizationTimeSeriesResponse {
  labels: string[];
  series: VisualizationSeriesItem[];
}

export interface VisualizationSiteSeriesItem {
  name: string;
  values: number[];
}

export interface VisualizationBySiteResponse {
  categories: string[];
  series: VisualizationSiteSeriesItem[];
}

export interface VisualizationPoint {
  x: number;
  y: number;
}

export interface VisualizationCorrelationResponse {
  points: VisualizationPoint[];
  correlation?: number;
}

export interface MapSummary {
  total_sites?: number;
  selected_sites?: number;
  sites_with_coordinates?: number;
  sites_without_coordinates?: number;
  measurement_count?: number;
  last_updated?: string | null;
  last_event_date?: string | null;
}

export interface MapSite {
  id: number;
  project_id: number;
  site_code: string;
  project_name?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  measurement_count?: number | null;
  last_updated?: string | null;
  last_event_date?: string | null;
  is_selected?: boolean | null;
  country?: string | null;
  admin_1?: string | null;
  admin_2?: string | null;
  admin_3?: string | null;
  altitude_m?: number | null;
  /** Per-site mean of the "color by variable" (present only when requested). */
  color_value?: number | null;
}

export interface MapSiteDetail extends MapSite {
  description?: string | null;
  /** Latest site attributes (EAV) as a list, from GET /map/sites/{id}. */
  attributes?: Array<{
    attribute_code?: string;
    attribute_name?: string;
    value?: string | number | boolean | null;
    value_type?: string;
    unit?: string | null;
  }> | null;
  metadata?: Record<string, string | number | boolean | null> | null;
  recent_variables?: Array<{
    id?: number;
    name?: string | null;
    variable_code?: string | null;
    unit?: string | null;
    value?: string | number | boolean | null;
    event_date?: string | null;
  }> | null;
  recent_measurements?: DashboardRecordDetailMeasurement[] | null;
  variables?: Array<{
    id?: number;
    name?: string | null;
    variable_code?: string | null;
    unit?: string | null;
    value?: string | number | boolean | null;
  }> | null;
}

export interface MapSitesResponse {
  items: MapSite[];
  total?: number;
  skip?: number;
  limit?: number;
}

export interface MapFilters {
  /** Institution that owns the data (a dataset's data_source). */
  institution?: string;
  project_id?: number;
  country?: string;
  search?: string;
  bbox?: string;
  north?: number;
  south?: number;
  east?: number;
  west?: number;
  admin_1?: string;
  admin_2?: string;
  altitude_min?: number;
  altitude_max?: number;
  color_variable_id?: number;
  skip?: number;
  limit?: number;
}

/** What each map selector can offer under the others' current values (GET /map/facets). */
export interface MapFacets {
  projects: { id: number; count: number }[];
  countries: { value: string; count: number }[];
  institutions: string[];
}

export interface MapRegions {
  admin_1: string[];
  admin_2: string[];
}

// ── Upload (carga de datos) ─────────────────────────────────────────────────

export type FileFormat = "xlsx" | "csv";

export type TemplateValueType = "numeric" | "text" | "boolean" | "date";

/**
 * Una columna candidata para la plantilla de carga.
 * `id` es el identificador estable que el front envía al backend al generar la
 * plantilla. Para mediciones usa el prefijo `var:<variable_id>`, para atributos
 * EAV usa `attr:<ATTRIBUTE_CODE>`, y para campos estructurales un código plano.
 */
export interface TemplateColumn {
  id: string;
  label: string;
  required: boolean;
  value_type: TemplateValueType;
  /** Tabla/campo destino en la BD (informativo, p.ej. "measurements", "sites.geom"). */
  db_target?: string | null;
  unit?: string | null;
  matrix?: string | null;
  variable_id?: number | null;
  variable_code?: string | null;
  attribute_code?: string | null;
  description?: string | null;
  example?: string | null;
}

export interface TemplateColumnGroup {
  key: string;
  label: string;
  description?: string | null;
  columns: TemplateColumn[];
}

export interface TemplateColumnsResponse {
  groups: TemplateColumnGroup[];
}

export interface TemplateQuery {
  columns: string[];
  format?: FileFormat;
  include_examples?: boolean;
  project_id?: number;
}

/**
 * Una fila del mapeo de columnas propio del usuario: "la columna en esta
 * posición de mi archivo corresponde a este campo nuestro". `target_id` usa
 * los mismos ids que `TemplateColumn.id` (o null/"" para ignorar la columna).
 */
export interface ColumnMappingEntry {
  source_index: number;
  source_header?: string | null;
  target_id: string | null;
}

export type UploadIssueSeverity = "error" | "warning";

export interface UploadIssue {
  row: number;
  column: string;
  value: string | null;
  message: string;
  severity: UploadIssueSeverity;
  code?: string | null;
  /** Set when `row` belongs to another sheet than the data one (e.g. "New variables"). */
  sheet?: string | null;
}

/** Conteos de las entidades que se crearían/afectarían al importar. */
export interface UploadAffectedCounts {
  projects?: number;
  sites?: number;
  sampling_events?: number;
  samples?: number;
  measurements?: number;
  new_variables?: number;
}

export interface UploadValidationResponse {
  upload_id: string;
  filename: string;
  total_rows: number;
  valid_rows: number;
  error_count: number;
  warning_count: number;
  summary: UploadAffectedCounts;
  issues: UploadIssue[];
  /** Matrices/variables actually present in the file, used to prefill the ficha. */
  detected_matrices?: string[];
  detected_variables?: string[];
}

export interface UploadImportRequest {
  upload_id: string;
  /** Si true, los warnings no bloquean la importación. */
  ignore_warnings?: boolean;
  /**
   * Ficha FAIR del dataset, capturada en el asistente de carga. Se estaciona con
   * la submission y se aplica al proyecto cuando se aprueba (el proyecto puede no
   * existir todavía). Los campos de QC no se aceptan aquí (403).
   */
  metadata?: ProjectMetadataUpsert;
}

export interface UploadImportResponse {
  /** Uploads are staged for review, so a successful submit returns "pending_review". */
  status: "pending_review" | "completed" | "partial" | "failed";
  inserted: UploadAffectedCounts;
  skipped_rows: number;
  message?: string | null;
}

// ── Dataverse import ─────────────────────────────────────────────────────────

export interface DataverseFileInfo {
  id: number;
  filename: string;
  content_type?: string | null;
  size?: number | null;
  restricted: boolean;
  /** Name the file was originally uploaded under, if Dataverse ingested/converted it. */
  original_filename?: string | null;
  /** Depositor-assigned tags (e.g. "Documentation", "Data", "Code") — most
   * datasets never set these, so treat as an optional badge. */
  categories?: string[] | null;
}

export interface DataversePreviewResponse {
  doi: string;
  persistent_id: string;
  /** Best-effort display citation, not authoritative. */
  citation?: string | null;
  license?: string | null;
  license_uri?: string | null;
  /** Ficha-shaped dict (same keys as ProjectMetadataUpsert) to prefill the upload wizard. */
  ficha: Record<string, unknown>;
  files: DataverseFileInfo[];
  /** Dataset has a Guestbook attached — downloading any file below requires
   * answering it first (fetch via GuestbookInfo, see getGuestbook). */
  requires_guestbook?: boolean;
  guestbook_id?: number | null;
}

export interface GuestbookQuestion {
  id: number;
  question: string;
  required: boolean;
  type: string;
}

export interface GuestbookInfo {
  id: number;
  name: string;
  email_required: boolean;
  name_required: boolean;
  institution_required: boolean;
  position_required: boolean;
  custom_questions: GuestbookQuestion[];
}

export interface GuestbookAnswer {
  id: number;
  value: string;
}

export interface GuestbookResponseInput {
  name?: string;
  email?: string;
  institution?: string;
  position?: string;
  answers?: GuestbookAnswer[];
}

export interface DataverseDownloadRequest {
  file_id: number;
  filename?: string;
  token?: string;
  guestbook_response?: GuestbookResponseInput;
}

// ── Download (descarga de datos) ────────────────────────────────────────────

export interface DownloadFilters {
  /** Institution that owns the data (a dataset's data_source). */
  institution?: string;
  project_ids?: number[];
  site_ids?: number[];
  variable_ids?: number[];
  date_from?: string;
  date_to?: string;
  matrix?: string;
  country?: string;
}

export interface DownloadEstimateResponse {
  record_count: number;
  sample_count?: number;
  site_count?: number;
}

/** Options that have data under the current choices (GET /download/facets). */
export interface DownloadFacets {
  project_ids: number[];
  variable_ids: number[];
  /** Measurements per variable within the chosen scope. */
  variable_counts?: Record<string, number>;
  date_min?: string | null;
  date_max?: string | null;
}

export interface DownloadExportQuery extends DownloadFilters {
  format?: FileFormat;
  include_metadata?: boolean;
}

export interface RecentDownload {
  id?: number | string;
  filename: string;
  created_at: string;
  format?: FileFormat;
  record_count?: number | null;
  username?: string | null;
  user_email?: string | null;
  organization?: string | null;
  country?: string | null;
}

