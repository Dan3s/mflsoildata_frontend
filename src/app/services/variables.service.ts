import { apiClient } from "./api-client";
import type { FilterOption, VariableCreate, VariableRead } from "./api-types";

export const variablesService = {
  /** Catalog list (also exposed via dashboardService.getVariables). */
  getAll: (filters?: { matrix?: string; domain?: string; value_type?: string; search?: string }) =>
    apiClient.get<VariableRead[]>("variables", filters),
  /** Create a new variable in the controlled catalog (new-variable form). */
  create: (payload: VariableCreate) =>
    apiClient.post<VariableRead, VariableCreate>("variables", payload),
  /** Unit catalog for the new-variable form (id + symbol label). */
  getUnits: (search?: string) => apiClient.get<FilterOption[]>("units", { search }),
  /** Existing domains, to suggest values in the new-variable form. */
  getDomains: () => apiClient.get<string[]>("variable-domains"),
};
