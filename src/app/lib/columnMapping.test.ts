import { describe, expect, it } from "vitest";
import type { TemplateColumn } from "@/app/services";
import { looksLikeTemplate, suggestMapping, type FileColumn } from "./columnMapping";

const target = (id: string, label: string): TemplateColumn => ({ id, label, required: false, value_type: "text" });
const column = (index: number, header: string): FileColumn => ({ index, header, example: "" });
const labelOf = (c: TemplateColumn) => c.label;

const targets = [
  target("site_code", "Site Code"),
  target("latitude", "Site Latitude"),
  target("var:12", "pH (Un)"),
];

describe("suggestMapping", () => {
  it("matches a header to a field ignoring case, accents and symbols", () => {
    const result = suggestMapping([column(0, "SITE CODE"), column(1, "site_latitude"), column(2, "PH (un)")], targets, labelOf);
    expect(result).toEqual({ 0: "site_code", 1: "latitude", 2: "var:12" });
  });

  it("matches the technical id of a structural column", () => {
    expect(suggestMapping([column(0, "latitude")], targets, labelOf)).toEqual({ 0: "latitude" });
  });

  it("leaves unknown headers for the person to choose", () => {
    expect(suggestMapping([column(0, "Comentarios"), column(1, "")], targets, labelOf)).toEqual({});
  });

  it("assigns a field to only one column", () => {
    const result = suggestMapping([column(0, "Site Code"), column(1, "site-code")], targets, labelOf);
    expect(result).toEqual({ 0: "site_code" });
  });

  it("knows a field by its label in the other language too", () => {
    const es = (c: TemplateColumn) => ({ site_code: "Código del Sitio", latitude: "Latitud del Sitio" })[c.id as string];
    const result = suggestMapping([column(0, "Código del Sitio"), column(1, "Latitud del Sitio")], targets, labelOf, es);
    expect(result).toEqual({ 0: "site_code", 1: "latitude" });
  });

  it("matches the \"name — MATRIX\" heading our templates give a variable, telling matrices apart", () => {
    const vars = [
      { ...target("var:1", "Cd Total (mg/kg)"), matrix: "SOIL" },
      { ...target("var:2", "Cd Total (mg/kg)"), matrix: "LEAF" },
      { ...target("var:3", "Cd Total (mg/kg)"), matrix: "GRAIN" },
    ];
    const result = suggestMapping(
      [column(0, "Cd Total (mg/kg) — SOIL"), column(1, "Cd Total (mg/kg) — LEAF"), column(2, "Cd Total (mg/kg) — GRAIN")],
      vars,
      labelOf,
    );
    expect(result).toEqual({ 0: "var:1", 1: "var:2", 2: "var:3" });
    // and the bare name stays ambiguous, so nothing is guessed from it
    expect(suggestMapping([column(0, "Cd Total (mg/kg)")], vars, labelOf)).toEqual({});
  });

  it("does not guess when two fields share a name", () => {
    const ambiguous = [target("a", "Depth"), target("b", "depth")];
    expect(suggestMapping([column(0, "Depth")], ambiguous, labelOf)).toEqual({});
  });
});

describe("looksLikeTemplate", () => {
  const ids = new Set(["project_code", "site_code", "event_date", "latitude"]);

  it("recognises the technical-id row of the platform's template (visible headers first)", () => {
    const rows = [["Código de Proyecto", "Código del Sitio", "pH"], ["project_code", "site_code", "var:12"]];
    expect(looksLikeTemplate(rows, ids)).toBe(true);
  });

  it("recognises a template whose id row is the first one", () => {
    expect(looksLikeTemplate([["project_code", "site_code", "attr:3"], ["x"]], ids)).toBe(true);
  });

  it("does not take a file with its own headers for the template", () => {
    const rows = [["Proyecto", "Sitio", "Latitud", "pH"], ["P1", "S1", 8.2, 5.1]];
    expect(looksLikeTemplate(rows, ids)).toBe(false);
  });

  it("only looks at the first two rows and ignores empty ones", () => {
    expect(looksLikeTemplate([[], ["x"], ["project_code", "site_code"]], ids)).toBe(false);
    expect(looksLikeTemplate([], ids)).toBe(false);
  });

  it("needs at least half of the cells to be known ids", () => {
    expect(looksLikeTemplate([["site_code", "a", "b", "c", "d"]], ids)).toBe(false);
    expect(looksLikeTemplate([["site_code", "a"]], ids)).toBe(true);
  });
});
