import { apiClient } from "./api-client";
import type {
  DatasetCatalogueItem,
  ProjectMetadata,
  ProjectMetadataUpsert,
} from "./api-types";

export const datasetService = {
  /** Dataset catalogue: one row per project (with its FAIR metadata summary). */
  getCatalogue: () => apiClient.get<DatasetCatalogueItem[]>("projects/catalogue"),

  /** Full FAIR metadata for a project (404 if none yet). */
  getMetadata: (projectId: number) =>
    apiClient.get<ProjectMetadata>(`projects/${projectId}/metadata`),

  /** Create or update (partial) a project's FAIR metadata. Editor+ only. */
  upsertMetadata: (projectId: number, payload: ProjectMetadataUpsert) =>
    apiClient.put<ProjectMetadata, ProjectMetadataUpsert>(`projects/${projectId}/metadata`, payload),
};
