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
  name: string;
  domain: string;
  value_type: string;
  matrix?: string | null;
  default_unit_id?: number | null;
  description?: string | null;
}

export interface DashboardSummary {
  projects: number;
  sites: number;
  samples: number;
  variables: number;
  measurements: number;
}

export interface DashboardRecord {
  sample_code: string;
  project_id: number;
  project_name: string;
  site_id: number;
  site_name: string;
  sample_type: string;
  matrix: string;
  variable_id: number;
  variable_name: string;
  value: string | number | boolean | null;
  unit: string | null;
  date: string | null;
  event_date?: string | null;
  laboratory: string | null;
  status: string;
}

export interface DashboardRecordsResponse {
  items: DashboardRecord[];
  total: number;
  skip: number;
  limit: number;
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
  active_sites?: number;
  inactive_sites?: number;
  selected_sites?: number;
  sites_with_coordinates?: number;
  sites_without_coordinates?: number;
  measurement_count?: number;
  last_updated?: string | null;
}

export interface MapSite {
  id: number;
  project_id: number;
  site_code: string;
  project_name?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  status?: string | null;
  measurement_count?: number | null;
  last_updated?: string | null;
  is_selected?: boolean | null;
  is_active?: boolean | null;
  country?: string | null;
  admin_1?: string | null;
  admin_2?: string | null;
  admin_3?: string | null;
  altitude_m?: number | null;
}

export interface MapSiteDetail extends MapSite {
  description?: string | null;
  attributes?: Record<string, string | number | boolean | null> | null;
  metadata?: Record<string, string | number | boolean | null> | null;
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
  project_id?: number;
  status?: string;
  search?: string;
  bbox?: string;
  north?: number;
  south?: number;
  east?: number;
  west?: number;
  skip?: number;
  limit?: number;
}

