import { describe, expect, it } from "vitest";
import { yearBounds, yearMatches, yearOptionsFrom } from "./datasetYear";

type Item = Parameters<typeof yearBounds>[0];
const item = (start?: string | null, end?: string | null, updated?: string | null): Item => ({
  temporal_coverage_start: start,
  temporal_coverage_end: end,
  updated_at: updated,
});

describe("yearBounds", () => {
  it("uses the temporal coverage when both ends are known, whatever their order", () => {
    expect(yearBounds(item("2019-03-01", "2022-10-05"))).toEqual([2019, 2022]);
    expect(yearBounds(item("2022-01-01", "2019-01-01"))).toEqual([2019, 2022]);
  });

  it("uses the one end that exists", () => {
    expect(yearBounds(item("2020-05-01", null))).toEqual([2020, 2020]);
    expect(yearBounds(item(null, "2021-05-01"))).toEqual([2021, 2021]);
  });

  it("falls back to the year it was last updated, then to nothing", () => {
    expect(yearBounds(item(null, null, "2026-06-15T10:00:00Z"))).toEqual([2026, 2026]);
    expect(yearBounds(item(null, null, null))).toBeNull();
  });
});

describe("yearMatches", () => {
  it("is inclusive at both ends", () => {
    const i = item("2019-01-01", "2021-12-31");
    expect(yearMatches(i, "2019")).toBe(true);
    expect(yearMatches(i, "2021")).toBe(true);
    expect(yearMatches(i, "2018")).toBe(false);
    expect(yearMatches(i, "2022")).toBe(false);
  });

  it("never matches a dataset with no date at all", () => {
    expect(yearMatches(item(null, null, null), "2020")).toBe(false);
  });
});

describe("yearOptionsFrom", () => {
  it("lists every covered year once, most recent first", () => {
    const years = yearOptionsFrom([item("2019-01-01", "2021-01-01"), item("2020-01-01", "2020-06-01"), item(null, null, null)]);
    expect(years).toEqual(["2021", "2020", "2019"]);
  });

  it("is empty when nothing is dated", () => {
    expect(yearOptionsFrom([item(null, null, null)])).toEqual([]);
  });
});
