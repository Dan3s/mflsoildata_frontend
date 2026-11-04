import { apiClient } from "./api-client";
import { projectsService } from "./projects.service";
import { sitesService } from "./sites.service";
import type {
  DashboardRecord,
  DashboardRecordFilters,
  DashboardRecordsResponse,
  DashboardSummary,
  FilterOption,
  PublicSummary,
  VariableRead,
  WideDatasetFilters,
  WideDatasetResponse,
} from "./api-types";

const toProjectOptions = async (): Promise<FilterOption[]> => {
  const projects = await projectsService.getAll({ skip: 0, limit: 100 });

  return projects.map((project) => ({
    id: project.id,
    label: project.name,
  }));
};

const toSiteOptions = async (projectId: number): Promise<FilterOption[]> => {
  const sites = await sitesService.getByProject(projectId, { skip: 0, limit: 100 });

  return sites.map((site) => ({
    id: site.id,
    label: site.site_code,
  }));
};

export const dashboardService = {
  getSummary: (institution?: string) =>
    apiClient.get<DashboardSummary>("dashboard/summary", institution ? { institution } : undefined),
  /** Anonymous, PUBLIC-only counts for the landing page's stats teaser. */
  getPublicSummary: () => apiClient.get<PublicSummary>("dashboard/public-summary"),
  getRecords: (filters?: DashboardRecordFilters) =>
    apiClient.get<DashboardRecordsResponse>("dashboard/records", filters),
  /**
   * Bounded row-level dataset for the Graphic Walker explorer. The `/dashboard/records`
   * endpoint caps `limit` at 200, so we fetch the first page (to learn the total) and
   * then request the remaining pages in parallel, up to `maxRows`.
   */
  getRecordsDataset: async (
    filters?: DashboardRecordFilters,
    maxRows = 5000,
  ): Promise<{ items: DashboardRecord[]; total: number; capped: boolean }> => {
    // Large pages on purpose: at 200 rows this fired 25 parallel requests for a
    // 5,000-row dataset (250 for 50,000), and that round-trip storm — not the
    // chart library — was what made the explorer feel slow. Gzip on the API keeps
    // each page around a megabyte.
    const pageSize = 10000;
    const first = await apiClient.get<DashboardRecordsResponse>("dashboard/records", {
      ...filters,
      skip: 0,
      limit: pageSize,
    });
    const target = Math.min(first.total, maxRows);
    const items = [...first.items];
    const pages: Promise<DashboardRecordsResponse>[] = [];
    for (let skip = pageSize; skip < target; skip += pageSize) {
      pages.push(
        apiClient.get<DashboardRecordsResponse>("dashboard/records", { ...filters, skip, limit: pageSize }),
      );
    }
    const rest = await Promise.all(pages);
    rest.forEach((page) => items.push(...page.items));
    return { items: items.slice(0, maxRows), total: first.total, capped: first.total > maxRows };
  },
  /** Pivoted (wide) dataset: one row per sample, one numeric column per requested variable. */
  getWideDataset: (filters: WideDatasetFilters) =>
    apiClient.get<WideDatasetResponse>("dashboard/wide", filters),
  exportRecords: (filters?: DashboardRecordFilters) =>
    apiClient.buildUrl("dashboard/export", filters),
  getProjectsOptions: () => toProjectOptions(),
  getSitesOptions: (projectId: number) => toSiteOptions(projectId),
  getSampleTypes: () => apiClient.get<FilterOption[]>("sample-types"),
  /** Institutions that own data (a dataset's `data_source`), for filtering. */
  getInstitutionOptions: () => apiClient.get<FilterOption[]>("institutions/options"),
  getMatrices: () => apiClient.get<FilterOption[]>("matrices"),
  getCountries: () => apiClient.get<string[]>("countries"),
  getVariables: (filters?: { matrix?: string; domain?: string; value_type?: string; search?: string }) =>
    apiClient.get<VariableRead[]>("variables", filters),
  getVariableOptions: (filters?: { project_id?: number; matrix?: string; domain?: string; value_type?: string; search?: string }) =>
    apiClient.get<FilterOption[]>("variables/options", filters),
  getMeasurementStatuses: () => apiClient.get<FilterOption[]>("measurement-statuses"),
  getLaboratories: () => apiClient.get<FilterOption[]>("laboratories"),
};
