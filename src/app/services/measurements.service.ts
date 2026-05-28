import { apiClient } from "./api-client";
import type { Measurement, MeasurementCreate, MeasurementFilters } from "./api-types";

export const measurementsService = {
  getAll: (filters?: MeasurementFilters) =>
    apiClient.get<Measurement[]>("measurements/", {
      ...filters,
      offset: filters?.offset ?? filters?.skip,
    }),
  getById: (measurementId: number) => apiClient.get<Measurement>(`measurements/${measurementId}`),
  create: (payload: MeasurementCreate) => apiClient.post<Measurement, MeasurementCreate>("measurements/", payload),
};
