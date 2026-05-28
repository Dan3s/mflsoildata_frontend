"use client";

import { useEffect, useMemo } from "react";
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from "react-leaflet";
import type { MapSite } from "@/app/services";

type LeafletMapProps = {
  sites: MapSite[];
  selectedSiteId: number | null;
  onSelectSite: (siteId: number) => void;
};

const STATUS_COLORS: Record<string, string> = {
  activo: "#16a34a",
  active: "#16a34a",
  validado: "#0ea5e9",
  pendiente: "#f59e0b",
  inactivo: "#64748b",
  inactive: "#64748b",
};

const DEFAULT_COLOR = "#7c3aed";

const isRenderableCoordinate = (site: MapSite) =>
  typeof site.latitude === "number" && Number.isFinite(site.latitude) && typeof site.longitude === "number" && Number.isFinite(site.longitude);

const getColor = (status?: string | null) => STATUS_COLORS[status?.trim().toLowerCase() || ""] ?? DEFAULT_COLOR;

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

function FitBounds({ sites, selectedSiteId }: { sites: MapSite[]; selectedSiteId: number | null }) {
  const map = useMap();

  const bounds = useMemo(() => getBounds(sites), [sites]);

  useEffect(() => {
    if (!bounds) {
      return;
    }

    map.fitBounds(bounds, { padding: [36, 36], animate: false });
  }, [bounds, map, selectedSiteId]);

  return null;
}

export default function LeafletMap({ sites, selectedSiteId, onSelectSite }: LeafletMapProps) {
  const coordinates = sites.filter(isRenderableCoordinate);

  if (!coordinates.length) {
    return (
      <div className="flex h-full min-h-[30rem] items-center justify-center rounded-[1.5rem] border border-dashed border-white/20 bg-white/5 px-8 text-center text-sm text-slate-300">
        No hay coordenadas suficientes para dibujar el mapa.
      </div>
    );
  }

  return (
    <MapContainer className="h-[34rem] w-full rounded-[1.5rem]" preferCanvas scrollWheelZoom={false} zoomControl>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitBounds sites={coordinates} selectedSiteId={selectedSiteId} />
      {coordinates.map((site) => {
        const selected = site.id === selectedSiteId;
        const color = getColor(site.status);

        return (
          <CircleMarker
            key={site.id}
            center={[site.latitude as number, site.longitude as number]}
            radius={selected ? 10 : 7}
            pathOptions={{
              color: "#ffffff",
              weight: selected ? 3 : 2,
              fillColor: color,
              fillOpacity: selected ? 0.95 : 0.85,
            }}
            eventHandlers={{
              click: () => onSelectSite(site.id),
            }}
          >
            <Popup>
              <div className="min-w-[180px]">
                <p className="text-sm font-semibold text-gray-900">{site.site_code}</p>
                <p className="mt-1 text-xs text-gray-500">{site.project_name ?? `Proyecto ${site.project_id}`}</p>
                <div className="mt-2 space-y-1 text-xs text-gray-600">
                  <p>
                    <span className="font-medium">Estado:</span> {site.status ?? "Sin estado"}
                  </p>
                  <p>
                    <span className="font-medium">Coordenadas:</span> {site.latitude}, {site.longitude}
                  </p>
                  <p>
                    <span className="font-medium">Mediciones:</span> {site.measurement_count ?? 0}
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