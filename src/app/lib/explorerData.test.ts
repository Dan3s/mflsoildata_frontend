import { describe, expect, it } from "vitest";
import type { WideColumn } from "@/app/services";
import { DATE_KEY, YEAR_KEY, prepareDates } from "./explorerData";

const labels = { noDate: "(no date)", year: "Year" };
const columns: WideColumn[] = [
  { key: "site_code", label: "Site", role: "dimension", semantic: "nominal" },
  { key: DATE_KEY, label: "Date", role: "dimension", semantic: "temporal" },
  { key: "SOIL_PH", label: "pH", role: "measure", semantic: "quantitative" },
];

describe("prepareDates", () => {
  it("leaves the data alone when there is no date column", () => {
    const rows = [{ site_code: "S1" }];
    const plain = columns.filter((c) => c.key !== DATE_KEY);
    expect(prepareDates(rows, plain, labels)).toEqual({ rows, columns: plain });
  });

  it("keeps the date temporal when every sample has one, and adds a numeric year", () => {
    const rows = [
      { site_code: "S1", [DATE_KEY]: "2019-03-01" },
      { site_code: "S2", [DATE_KEY]: "2021-10-05" },
    ];
    const out = prepareDates(rows, columns, labels);
    expect(out.columns.find((c) => c.key === DATE_KEY)?.semantic).toBe("temporal");
    expect(out.rows.map((r) => r[YEAR_KEY])).toEqual([2019, 2021]);
  });

  it("turns the date into categories, naming the gap, when a sample has none", () => {
    // A null in a temporal column is what made Graphic Walker throw "reading 'getTime'".
    const rows = [
      { site_code: "S1", [DATE_KEY]: "2019-03-01" },
      { site_code: "S2", [DATE_KEY]: null },
      { site_code: "S3" },
    ];
    const out = prepareDates(rows, columns, labels);
    expect(out.columns.find((c) => c.key === DATE_KEY)?.semantic).toBe("nominal");
    expect(out.rows.map((r) => r[DATE_KEY])).toEqual(["2019-03-01", "(no date)", "(no date)"]);
    expect(out.rows.map((r) => r[YEAR_KEY])).toEqual([2019, "(no date)", "(no date)"]);
    expect(out.rows.some((r) => r[DATE_KEY] === null || r[DATE_KEY] === undefined)).toBe(false);
  });

  it("puts the Year column right after Date, as a dimension", () => {
    const out = prepareDates([{ [DATE_KEY]: "2020-01-01" }], columns, labels);
    const keys = out.columns.map((c) => c.key);
    expect(keys.indexOf(YEAR_KEY)).toBe(keys.indexOf(DATE_KEY) + 1);
    expect(out.columns.find((c) => c.key === YEAR_KEY)).toMatchObject({ role: "dimension", label: "Year" });
  });
});
