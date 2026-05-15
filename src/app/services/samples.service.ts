import { apiClient } from "./api-client";
import type { Sample, SampleCreate, SampleUpdate } from "./api-types";

export const samplesService = {
  getAll: (params?: { event_id?: number; site_id?: number; skip?: number; limit?: number }) =>
    apiClient.get<Sample[]>("samples/", params),
  getById: (sampleId: number) => apiClient.get<Sample>(`samples/${sampleId}`),
  create: (payload: SampleCreate) => apiClient.post<Sample, SampleCreate>("samples/", payload),
  update: (sampleId: number, payload: SampleUpdate) =>
    apiClient.put<Sample, SampleUpdate>(`samples/${sampleId}`, payload),
};
