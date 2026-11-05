"use client";

import { useEffect, useMemo } from "react";
import { useTranslations } from "next-intl";
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from "react-leaflet";
import type { MapSite } from "@/app/services";

type LeafletMapProps = {
  sites: MapSite[];
  selectedSiteId: number | null;
  onSelectSite: (siteId: number) => void;
  projectColors?: Record<number, string>;
  /** Per-site color (by variable). Overrides projectColors when a site has one. */
  siteColors?: Record<number, string>;
};

const DEFAULT_COLOR = "#16a34a";

const isRenderableCoordinate = (site: MapSite) =>
  typeof site.latitude === "number" && Number.isFinite(site.latitude) && typeof site.longitude === "number" && Number.isFinite(site.longitude);

const getBounds = (sites: MapSite[]) => {
  const coordinates = sites.filter(isRenderableCoordinate);

  if (!coordinates.length) {
    return null;
  }

  const latitudes = coordinates.map((site) => site.latitude as number);
  const longitudes = coordinates.map((site) => site.longitude as number);

  const latPadding = Math.max((Math.max(...latitudes) - Math.min(...latitudes)) * 0.15, 0.75);
  const lngPadding = Math.max((Math.max(...longitudes) - Math.min(...longitudes)) * 0.15, 0.75);

  return [
    [Math.min(...latitudes) - latPadding, Math.min(...longitudes) - lngPadding],
    [Math.max(...latitudes) + latPadding, Math.max(...longitudes) + lngPadding],
  ] as [[number, number], [number, number]];
};

/**
 * Frames the map around the sites, but only when the *set of sites* changes. `sites`
 * is a fresh array on every render of the parent, so the effect keys on the bounds'
 * values: selecting a point must not reset the user's zoom.
 */
function FitBounds({ sites }: { sites: MapSite[] }) {
  const map = useMap();

  const bounds = useMemo(() => getBounds(sites), [sites]);
  const boundsKey = bounds ? bounds.flat().join(",") : "";

  useEffect(() => {
    if (!bounds) {
      return;
    }

    map.fitBounds(bounds, { padding: [36, 36], animate: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- boundsKey stands in for bounds
  }, [boundsKey, map]);

  return null;
}

/** Keeps the selected point in view (from the list, or off-screen) without touching the zoom. */
function FollowSelection({ sites, selectedSiteId }: { sites: MapSite[]; selectedSiteId: number | null }) {
  const map = useMap();

  useEffect(() => {
    const site = sites.find((s) => s.id === selectedSiteId);
    if (!site) {
      return;
    }

    map.panInside([site.latitude as number, site.longitude as number], { padding: [60, 60] });
    // Only react to the selection itself, not to every new `sites` array.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSiteId, map]);

  return null;
}

/**
 * Wheel zoom would trap the page scroll while the pointer crosses the map, so it only
 * turns on once the user clicks the map and off again when the pointer leaves it.
 */
function ScrollZoomOnClick() {
  const map = useMap();

  useEffect(() => {
    const container = map.getContainer();
    const enable = () => map.scrollWheelZoom.enable();
    const disable = () => map.scrollWheelZoom.disable();

    map.scrollWheelZoom.disable();
    container.addEventListener("mousedown", enable);
    container.addEventListener("mouseleave", disable);

    return () => {
      container.removeEventListener("mousedown", enable);
      container.removeEventListener("mouseleave", disable);
    };
  }, [map]);

  return null;
}

export default function LeafletMap({ sites, selectedSiteId, onSelectSite, projectColors, siteColors }: LeafletMapProps) {
  const t = useTranslations("map");
  const coordinates = sites.filter(isRenderableCoordinate);

  if (!coordinates.length) {
    return (
      <div className="flex h-full min-h-[30rem] items-center justify-center rounded-[1.5rem] border border-dashed border-white/20 bg-white/5 px-8 text-center text-sm text-slate-300">
        {t("noCoordinates")}
      </div>
    );
  }

  return (
    <MapContainer className="h-[34rem] w-full rounded-[1.5rem]" preferCanvas scrollWheelZoom={false} zoomControl>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <ScrollZoomOnClick />
      <FitBounds sites={coordinates} />
      <FollowSelection sites={coordinates} selectedSiteId={selectedSiteId} />
      {coordinates.map((site) => {
        const selected = site.id === selectedSiteId;
        const fillColor = siteColors?.[site.id] ?? projectColors?.[site.project_id] ?? DEFAULT_COLOR;

        return (
          <CircleMarker
            key={site.id}
            center={[site.latitude as number, site.longitude as number]}
            radius={selected ? 10 : 7}
            pathOptions={{
              color: selected ? "#0f172a" : "#ffffff",
              weight: selected ? 3 : 2,
              fillColor,
              fillOpacity: selected ? 0.95 : 0.85,
            }}
            eventHandlers={{
              click: () => onSelectSite(site.id),
            }}
          >
            <Popup>
              <div className="min-w-[180px]">
                <p className="text-sm font-semibold text-gray-900">{site.site_code}</p>
                <p className="mt-1 text-xs text-gray-500">{site.project_name ?? t("projectFallback", { id: site.project_id })}</p>
                <div className="mt-2 space-y-1 text-xs text-gray-600">
                  <p>
                    <span className="font-medium">{t("popup.coordinates")}</span> {site.latitude}, {site.longitude}
                  </p>
                  <p>
                    <span className="font-medium">{t("popup.measurements")}</span> {site.measurement_count ?? 0}
                  </p>
                </div>
              </div>
            </Popup>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}