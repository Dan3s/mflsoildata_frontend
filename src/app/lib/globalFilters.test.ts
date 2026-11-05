import { afterEach, describe, expect, it } from "vitest";
import { GLOBAL_FILTERS_COOKIE, readGlobalFiltersClient, writeGlobalFilters } from "./globalFilters";

const clearCookie = () => {
  document.cookie = `${GLOBAL_FILTERS_COOKIE}=;path=/;max-age=0`;
};

afterEach(clearCookie);

describe("global filters cookie", () => {
  it("reads nothing when no filter was ever set", () => {
    expect(readGlobalFiltersClient()).toEqual({});
  });

  it("round-trips a value, including characters that need escaping", () => {
    writeGlobalFilters({ institution: "Alliance of Bioversity & CIAT" });
    expect(readGlobalFiltersClient()).toEqual({ institution: "Alliance of Bioversity & CIAT" });
  });

  it("merges a patch into what is already there", () => {
    writeGlobalFilters({ institution: "CIAT", country: "Colombia" });
    writeGlobalFilters({ country: "Peru" });
    expect(readGlobalFiltersClient()).toEqual({ institution: "CIAT", country: "Peru" });
  });

  it("drops a filter when it is set to undefined", () => {
    writeGlobalFilters({ matrix: "SOIL", country: "Peru" });
    writeGlobalFilters({ matrix: undefined });
    expect(readGlobalFiltersClient()).toEqual({ country: "Peru" });
  });

  it("ignores a corrupted cookie instead of throwing", () => {
    document.cookie = `${GLOBAL_FILTERS_COOKIE}=%7Bnot-json;path=/`;
    expect(readGlobalFiltersClient()).toEqual({});
  });
});
