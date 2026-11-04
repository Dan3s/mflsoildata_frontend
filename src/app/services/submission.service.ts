import { apiClient } from "./api-client";
import type {
  SubmissionItem,
  SubmissionRowsResponse,
  SubmissionStatus,
  VariableResolution,
} from "./api-types";

export const submissionService = {
  /** List dataset submissions (database_editor / admin). */
  list: (status?: SubmissionStatus) =>
    apiClient.get<SubmissionItem[]>("submissions", status ? { status } : undefined),
  /** Staged rows of a submission, for the reviewer to inspect before deciding. */
  rows: (id: number, params?: { search?: string; offset?: number; limit?: number }) =>
    apiClient.get<SubmissionRowsResponse>(`submissions/${id}/rows`, {
      ...(params?.search ? { search: params.search } : {}),
      offset: params?.offset ?? 0,
      limit: params?.limit ?? 25,
    }),
  /** `variableResolutions`: per new variable, edit-and-create or merge into an existing one. */
  approve: (id: number, notes?: string, variableResolutions?: VariableResolution[]) =>
    apiClient.post<SubmissionItem, { notes?: string; variable_resolutions?: VariableResolution[] }>(
      `submissions/${id}/approve`,
      { notes, variable_resolutions: variableResolutions },
    ),
  reject: (id: number, notes?: string) =>
    apiClient.post<SubmissionItem, { notes?: string }>(`submissions/${id}/reject`, { notes }),
};
