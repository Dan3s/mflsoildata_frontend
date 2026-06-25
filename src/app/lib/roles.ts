/** Shared role helpers (Keycloak realm roles: admin | editor | viewer). */

export function hasRole(roles: string[] | undefined, ...allowed: string[]): boolean {
  if (!roles?.length) return false;
  return roles.some((role) => allowed.includes(role));
}

/** Only editors and admins may upload data. */
export function canUpload(roles: string[] | undefined): boolean {
  return hasRole(roles, "editor", "admin");
}

export function isAdmin(roles: string[] | undefined): boolean {
  return hasRole(roles, "admin");
}
