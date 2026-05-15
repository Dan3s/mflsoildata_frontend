import { apiClient } from "./api-client";
import type { Site, SiteCreate, SiteUpdate } from "./api-types";

export const sitesService = {
  getByProject: (projectId: number, params?: { skip?: number; limit?: number }) =>
    apiClient.get<Site[]>("sites/", { project_id: projectId, ...params }),
  getById: (siteId: number) => apiClient.get<Site>(`sites/${siteId}`),
  create: (payload: SiteCreate) => apiClient.post<Site, SiteCreate>("sites/", payload),
  update: (siteId: number, payload: SiteUpdate) => apiClient.put<Site, SiteUpdate>(`sites/${siteId}`, payload),
};
