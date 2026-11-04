import { describe, expect, it } from "vitest";
import { apiClient } from "./api-client";

const query = (url: string) => new URL(url).searchParams;

describe("apiClient.buildUrl", () => {
  it("goes through the Next proxy from the browser", () => {
    const url = new URL(apiClient.buildUrl("download/estimate"));
    expect(url.pathname).toBe("/api/backend/download/estimate");
  });

  it("leaves out undefined, null and empty values", () => {
    const params = query(apiClient.buildUrl("map/sites", { country: "Peru", search: "", institution: undefined, admin_1: null }));
    expect([...params.keys()]).toEqual(["country"]);
  });

  it("repeats a key for each item of an array, skipping blanks", () => {
    const params = query(apiClient.buildUrl("download/facets", { project_ids: [14, 18, ""] }));
    expect(params.getAll("project_ids")).toEqual(["14", "18"]);
  });

  it("keeps zero and false, which are real filter values", () => {
    const params = query(apiClient.buildUrl("x", { altitude_min: 0, include_metadata: false }));
    expect(params.get("altitude_min")).toBe("0");
    expect(params.get("include_metadata")).toBe("false");
  });

  it("accepts the services' filter interfaces", () => {
    interface Filters {
      project_id?: number;
    }
    const filters: Filters = { project_id: 18 };
    expect(query(apiClient.buildUrl("map/sites", filters)).get("project_id")).toBe("18");
  });
});
