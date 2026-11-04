import { apiClient } from "./api-client";
import type { AgrovocTerm } from "./api-types";

export const lookupsService = {
  /**
   * Keyword suggestions from FAO's AGROVOC thesaurus, proxied by our API.
   * Returns [] when AGROVOC is unreachable, so the field degrades to free text.
   */
  agrovoc: (q: string, lang: string) =>
    apiClient.get<AgrovocTerm[]>("lookups/agrovoc", { q, lang }),
};
