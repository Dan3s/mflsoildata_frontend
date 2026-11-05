import { apiClient } from "./api-client";
import type { AppRole, UserItem, UserOption } from "./api-types";

export const userService = {
  /** List realm users with their roles (admin only). */
  list: (search?: string) =>
    apiClient.get<UserItem[]>("users", search ? { search } : undefined),
  /** Minimal lookup for the authorized-users picker (editor+). Needs 2+ chars. */
  search: (q: string) => apiClient.get<UserOption[]>("users/search", { q }),
  /** Roles this app manages, lowest privilege first. */
  roles: () => apiClient.get<AppRole[]>("users/roles"),
  /** Replace the user's managed roles (not a merge). */
  setRoles: (id: string, roles: AppRole[]) =>
    apiClient.put<AppRole[], { roles: AppRole[] }>(`users/${id}/roles`, { roles }),
};
