import { describe, expect, it } from "vitest";
import { normalizeCode } from "./normalizeCode";

describe("normalizeCode", () => {
  it("uppercases, strips accents and turns symbols into underscores", () => {
    expect(normalizeCode("Humedad del suelo (%)")).toBe("HUMEDAD_DEL_SUELO");
    expect(normalizeCode("Año—Código")).toBe("ANO_CODIGO");
  });

  it("trims leading and trailing separators", () => {
    expect(normalizeCode("  --pH (Un)--  ")).toBe("PH_UN");
  });

  it("returns an empty string when nothing usable is left", () => {
    expect(normalizeCode("¿?!")).toBe("");
  });
});
