import { apiClient } from "./api-client";
import type { MapFilters, MapSiteDetail, MapSitesResponse, MapSummary } from "./api-types";

type MapSitesPayload = MapSitesResponse | MapSiteDetail[] | { items?: MapSiteDetail[]; total?: number; skip?: number; limit?: number };
type MapSitePayload = MapSiteDetail | { item?: MapSiteDetail; site?: MapSiteDetail };

const normalizeSitesResponse = (payload: MapSitesPayload): MapSitesResponse => {
  if (Array.isArray(payload)) {
    return { items: payload };
  }

  if ("items" in payload && Array.isArray(payload.items)) {
    return {
      items: payload.items,
      total: payload.total,
      skip: payload.skip,
      limit: payload.limit,
    };
  }

  return { items: [] };
};

const normalizeSiteDetail = (payload: MapSitePayload): MapSiteDetail => {
  if (payload && typeof payload === "object" && ("item" in payload || "site" in payload)) {
    return (payload.item ?? payload.site ?? {}) as MapSiteDetail;
  }

  return payload as MapSiteDetail;
};

export const mapService = {
  getSummary: (filters?: MapFilters) => apiClient.get<MapSummary>("map/summary", filters),
  getSites: async (filters?: MapFilters) => normalizeSitesResponse(await apiClient.get<MapSitesPayload>("map/sites", filters)),
  getSiteById: async (siteId: number) => normalizeSiteDetail(await apiClient.get<MapSitePayload>(`map/sites/${siteId}`)),
  exportSites: (filters?: MapFilters) => apiClient.buildUrl("map/export", filters),
};