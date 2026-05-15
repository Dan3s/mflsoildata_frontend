import { apiClient } from "./api-client";
import type { Project, ProjectCreate, ProjectUpdate } from "./api-types";

export const projectsService = {
  getAll: (params?: { skip?: number; limit?: number }) =>
    apiClient.get<Project[]>("projects/", params),
  getById: (projectId: number) => apiClient.get<Project>(`projects/${projectId}`),
  create: (payload: ProjectCreate) => apiClient.post<Project, ProjectCreate>("projects/", payload),
  update: (projectId: number, payload: ProjectUpdate) =>
    apiClient.put<Project, ProjectUpdate>(`projects/${projectId}`, payload),
  remove: (projectId: number) => apiClient.delete<{ message: string }>(`projects/${projectId}`),
};
