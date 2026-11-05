/** Shared role helpers (Keycloak realm roles: admin | database_editor | editor | viewer). */

export function hasRole(roles: string[] | undefined, ...allowed: string[]): boolean {
  if (!roles?.length) return false;
  return roles.some((role) => allowed.includes(role));
}

/**
 * May add data *values* (measurements, EAV values, file uploads) and access the
 * upload area. Editors, database editors and admins.
 */
export function canUpload(roles: string[] | undefined): boolean {
  return hasRole(roles, "editor", "database_editor", "admin");
}

/**
 * May extend the *catalog/schema*: create new variables and EAV attribute
 * definitions (site/sample/soil-profile attributes). Database editors and admins.
 * Plain editors can only add values to existing catalog entries.
 */
export function canManageCatalog(roles: string[] | undefined): boolean {
  return hasRole(roles, "database_editor", "admin");
}

export function isAdmin(roles: string[] | undefined): boolean {
  return hasRole(roles, "admin");
}

/** Human-readable label for the user's highest-privilege role. */
export function primaryRoleLabel(roles: string[] | undefined): string {
  if (hasRole(roles, "admin")) return "Admin";
  if (hasRole(roles, "database_editor")) return "Database Editor";
  if (hasRole(roles, "editor")) return "Editor";
  return "Viewer";
}
