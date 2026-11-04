import { describe, expect, it } from "vitest";
import type { TemplateColumn } from "@/app/services";
import { suggestMapping, type FileColumn } from "./columnMapping";

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

  it("does not guess when two fields share a name", () => {
    const ambiguous = [target("a", "Depth"), target("b", "depth")];
    expect(suggestMapping([column(0, "Depth")], ambiguous, labelOf)).toEqual({});
  });
});
