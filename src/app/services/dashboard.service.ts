import { apiClient } from "./api-client";
import { projectsService } from "./projects.service";
import { sitesService } from "./sites.service";
import type {
  DashboardRecordFilters,
  DashboardRecordsResponse,
  DashboardSummary,
  FilterOption,
  VariableRead,
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
  getSummary: () => apiClient.get<DashboardSummary>("dashboard/summary"),
  getRecords: (filters?: DashboardRecordFilters) =>
    apiClient.get<DashboardRecordsResponse>("dashboard/records", filters),
  exportRecords: (filters?: DashboardRecordFilters) =>
    apiClient.buildUrl("dashboard/export", filters),
  getProjectsOptions: () => toProjectOptions(),
  getSitesOptions: (projectId: number) => toSiteOptions(projectId),
  getSampleTypes: () => apiClient.get<FilterOption[]>("sample-types"),
  getMatrices: () => apiClient.get<FilterOption[]>("matrices"),
  getVariables: (filters?: { matrix?: string; domain?: string; value_type?: string; search?: string }) =>
    apiClient.get<VariableRead[]>("variables", filters),
  getVariableOptions: (filters?: { matrix?: string; domain?: string; value_type?: string; search?: string }) =>
    apiClient.get<VariableRead[]>("variables", filters).then((variables) =>
      variables.map((variable) => ({
        id: variable.id,
        label: variable.name,
      })),
    ),
  getMeasurementStatuses: () => apiClient.get<FilterOption[]>("measurement-statuses"),
  getLaboratories: () => apiClient.get<FilterOption[]>("laboratories"),
};
