import { apiClient } from "./api-client";
import type {
  AttributeDefinition,
  AttributeDefinitionCreate,
  AttributeValue,
  SampleAttributeValueCreate,
  SiteAttributeValueCreate,
  SoilProfile,
  SoilProfileAttributeValueCreate,
  SoilProfileCreate,
} from "./api-types";

/** Dynamic attributes (EAV) and soil-profile registration (RF04–RF12). */
export const eavService = {
  // ── Site attributes ──────────────────────────────────────────────────────
  listSiteAttributes: () => apiClient.get<AttributeDefinition[]>("site-attributes"),
  createSiteAttribute: (payload: AttributeDefinitionCreate) =>
    apiClient.post<AttributeDefinition, AttributeDefinitionCreate>("site-attributes", payload),
  listSiteAttributeValues: (siteId: number) =>
    apiClient.get<AttributeValue[]>("site-attribute-values", { site_id: siteId }),
  createSiteAttributeValue: (payload: SiteAttributeValueCreate) =>
    apiClient.post<AttributeValue, SiteAttributeValueCreate>("site-attribute-values", payload),

  // ── Sample attributes ────────────────────────────────────────────────────
  listSampleAttributes: () => apiClient.get<AttributeDefinition[]>("sample-attributes"),
  createSampleAttribute: (payload: AttributeDefinitionCreate) =>
    apiClient.post<AttributeDefinition, AttributeDefinitionCreate>("sample-attributes", payload),
  createSampleAttributeValue: (payload: SampleAttributeValueCreate) =>
    apiClient.post<AttributeValue, SampleAttributeValueCreate>("sample-attribute-values", payload),

  // ── Soil profiles ────────────────────────────────────────────────────────
  listSoilProfiles: (projectId?: number) =>
    apiClient.get<SoilProfile[]>("soil-profiles", { project_id: projectId }),
  createSoilProfile: (payload: SoilProfileCreate) =>
    apiClient.post<SoilProfile, SoilProfileCreate>("soil-profiles", payload),
  listSoilProfileAttributes: () => apiClient.get<AttributeDefinition[]>("soil-profile-attributes"),
  createSoilProfileAttribute: (payload: AttributeDefinitionCreate) =>
    apiClient.post<AttributeDefinition, AttributeDefinitionCreate>("soil-profile-attributes", payload),
  createSoilProfileAttributeValue: (payload: SoilProfileAttributeValueCreate) =>
    apiClient.post<AttributeValue, SoilProfileAttributeValueCreate>(
      "soil-profile-attribute-values",
      payload,
    ),
};
