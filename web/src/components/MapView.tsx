"use client";

import { useEffect } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Circle,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Leaflet のデフォルトアイコンが webpack バンドルで壊れる問題のフィックス
delete (L.Icon.Default.prototype as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl:
    "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl:
    "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const TOKYO = { lat: 35.681, lng: 139.766 };

function MapClickHandler({
  onPickLocation,
}: {
  onPickLocation: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click(e) {
      onPickLocation(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function Recenter({ center }: { center: { lat: number; lng: number } | null }) {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.setView([center.lat, center.lng], map.getZoom() < 14 ? 14 : map.getZoom(), {
        animate: true,
      });
    }
  }, [center, map]);
  return null;
}

export default function MapView({
  center,
  radiusM,
  onPickLocation,
}: {
  center: { lat: number; lng: number } | null;
  radiusM: number;
  onPickLocation: (lat: number, lng: number) => void;
}) {
  const initial = center ?? TOKYO;

  return (
    <div
      style={{
        height: "clamp(280px, 50vw, 360px)",
        borderRadius: 8,
        overflow: "hidden",
        border: "1px solid #E5E7EB",
      }}
    >
      <MapContainer
        center={[initial.lat, initial.lng]}
        zoom={center ? 14 : 12}
        scrollWheelZoom={true}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://osm.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapClickHandler onPickLocation={onPickLocation} />
        <Recenter center={center} />
        {center && (
          <>
            <Marker
              position={[center.lat, center.lng]}
              draggable={true}
              eventHandlers={{
                dragend: (e) => {
                  const m = e.target as L.Marker;
                  const ll = m.getLatLng();
                  onPickLocation(ll.lat, ll.lng);
                },
              }}
            />
            <Circle
              center={[center.lat, center.lng]}
              radius={radiusM}
              pathOptions={{
                color: "#3366FF",
                fillColor: "#3366FF",
                fillOpacity: 0.1,
                weight: 2,
              }}
            />
          </>
        )}
      </MapContainer>
    </div>
  );
}
