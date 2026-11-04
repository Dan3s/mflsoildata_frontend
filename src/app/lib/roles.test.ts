import { describe, expect, it } from "vitest";
import { canManageCatalog, canUpload, hasRole, isAdmin, primaryRoleLabel } from "./roles";

describe("roles", () => {
  it("treats a missing or empty role list as no access", () => {
    for (const roles of [undefined, []]) {
      expect(hasRole(roles, "admin")).toBe(false);
      expect(canUpload(roles)).toBe(false);
      expect(canManageCatalog(roles)).toBe(false);
      expect(isAdmin(roles)).toBe(false);
    }
  });

  it("lets editors upload but not change the catalogue", () => {
    expect(canUpload(["editor"])).toBe(true);
    expect(canManageCatalog(["editor"])).toBe(false);
  });

  it("lets database editors and admins manage the catalogue", () => {
    expect(canManageCatalog(["database_editor"])).toBe(true);
    expect(canManageCatalog(["admin"])).toBe(true);
    expect(canUpload(["database_editor"])).toBe(true);
  });

  it("keeps viewers read-only", () => {
    expect(canUpload(["viewer"])).toBe(false);
    expect(canManageCatalog(["viewer"])).toBe(false);
  });

  it("labels the highest-privilege role", () => {
    expect(primaryRoleLabel(["editor", "admin"])).toBe("Admin");
    expect(primaryRoleLabel(["editor", "database_editor"])).toBe("Database Editor");
    expect(primaryRoleLabel(["editor"])).toBe("Editor");
    expect(primaryRoleLabel(undefined)).toBe("Viewer");
  });
});
