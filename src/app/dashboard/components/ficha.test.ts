import { describe, expect, it } from "vitest";
import { EMPTY_FICHA, fichaChanges, fichaFromMetadata, fichaMissing, fichaPayload } from "./UploadView";
import type { ProjectMetadata } from "@/app/services";

const COMPLETE = {
  ...EMPTY_FICHA,
  title: "Soils of Cauca",
  abstract: "What, where, when.",
  contact_email: "a@cgiar.org",
  access_level: "PUBLIC",
  authors: "Ruiz, Ana",
  temporal_coverage_start: "2024-01-01",
  temporal_coverage_end: "2024-12-31",
  data_source: "CIAT",
  sampling_type: "SINGLE_POINT",
};

describe("fichaMissing", () => {
  it("asks for everything on an empty form, keywords included", () => {
    expect(fichaMissing(EMPTY_FICHA)).toEqual([
      "title", "abstract", "contact_email", "access_level",
      "authors", "keywords", "temporal_coverage_start", "temporal_coverage_end",
      "data_source", "sampling_type",
    ]);
  });

  it("keywords live outside the flat form, so they are counted separately", () => {
    expect(fichaMissing(COMPLETE)).toEqual(["keywords"]);
    expect(fichaMissing(COMPLETE, [{ label: "soil", uri: null }])).toEqual([]);
  });

  it("does not accept whitespace as an answer", () => {
    expect(fichaMissing({ ...COMPLETE, sampling_type: "   " }, [{ label: "soil", uri: null }])).toEqual(["sampling_type"]);
  });

  it("does not make the research group or the version mandatory", () => {
    expect(fichaMissing(COMPLETE, [{ label: "soil", uri: null }])).not.toContain("research_group");
    expect(fichaMissing(COMPLETE, [{ label: "soil", uri: null }])).not.toContain("version");
  });
});

describe("fichaPayload", () => {
  it("sends the sampling type code and the research group, blanks as null", () => {
    const out = fichaPayload({ ...COMPLETE, research_group: "Soil Health" }, [], []);
    expect(out.sampling_type).toEqual(["SINGLE_POINT"]);
    expect(out.research_group).toBe("Soil Health");
    expect(fichaPayload(COMPLETE, [], []).research_group).toBeNull();
  });
});

describe("fichaPayload with both sampling types", () => {
  it("sends every ticked type as a list", () => {
    const out = fichaPayload({ ...COMPLETE, sampling_type: "FARM_COMPOSITE,SINGLE_POINT" }, [], []);
    expect(out.sampling_type).toEqual(["FARM_COMPOSITE", "SINGLE_POINT"]);
  });
});

const STORED = {
  id: 1,
  project_id: 7,
  title: "Soils of Cauca",
  abstract: "What, where, when.",
  contact_email: "a@cgiar.org",
  access_level: "RESTRICTED",
  authors: ["Ruiz, Ana", "Gómez, Carlos"],
  keywords: ["soil", { label: "carbon", uri: "http://aims.fao.org/aos/agrovoc/c_1" }],
  authorized_users: ["x@cgiar.org"],
  expected_matrices: ["SOIL", "LEAF"],
  sampling_type: ["FARM_COMPOSITE", "SINGLE_POINT"],
  version: "1.0",
  license: null,
} as unknown as ProjectMetadata;

describe("fichaFromMetadata", () => {
  it("turns a stored ficha back into the form's strings", () => {
    const { ficha, authorized, keywords } = fichaFromMetadata(STORED);
    expect(ficha.title).toBe("Soils of Cauca");
    expect(ficha.authors).toBe("Ruiz, Ana\nGómez, Carlos"); // one per line: a comma is part of a name
    expect(ficha.expected_matrices).toBe("SOIL, LEAF");
    expect(ficha.sampling_type).toBe("FARM_COMPOSITE, SINGLE_POINT");
    expect(ficha.license).toBe("");
    expect(authorized).toEqual(["x@cgiar.org"]);
    expect(keywords.map((k) => k.label)).toEqual(["soil", "carbon"]);
  });

  it("starts empty for a dataset that has no description yet", () => {
    expect(fichaFromMetadata(null)).toEqual({ ficha: EMPTY_FICHA, authorized: [], keywords: [] });
  });
});

describe("fichaChanges", () => {
  const load = () => {
    const { ficha, authorized, keywords } = fichaFromMetadata(STORED);
    return { ficha, authorized, keywords, baseline: fichaPayload(ficha, authorized, keywords) };
  };

  it("sends nothing when the form was not touched", () => {
    const { ficha, authorized, keywords, baseline } = load();
    expect(fichaChanges(fichaPayload(ficha, authorized, keywords), baseline)).toEqual({});
  });

  it("sends only the fields that were edited", () => {
    const { ficha, authorized, keywords, baseline } = load();
    const edited = fichaPayload({ ...ficha, version: "1.1", license: "CC-BY-4.0" }, authorized, keywords);
    expect(fichaChanges(edited, baseline)).toEqual({ version: "1.1", license: "CC-BY-4.0" });
  });

  it("sends everything for a new dataset, which has no baseline", () => {
    const current = fichaPayload(EMPTY_FICHA, [], []);
    expect(fichaChanges(current, null)).toBe(current);
  });
});
