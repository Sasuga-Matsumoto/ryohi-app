"use client";

import {
  MapContainer,
  TileLayer,
  Marker,
  Circle,
  CircleMarker,
  Polyline,
  Popup,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Default Marker icon fix
delete (L.Icon.Default.prototype as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl:
    "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl:
    "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/images/marker-shadow.png",
});

type LatLng = { lat: number; lng: number };

type Props = {
  work: (LatLng & { radius_m: number }) | null;
  home: (LatLng & { radius_m: number }) | null;
  visitedStays: Array<{ ts_start: string; ts_end: string; lat: number; lng: number }>;
  tracks: Array<{ ts: string; lat: number; lng: number }>;
};

export default function TripMapInner({ work, home, visitedStays, tracks }: Props) {
  const allPoints: LatLng[] = [
    ...(work ? [{ lat: work.lat, lng: work.lng }] : []),
    ...(home ? [{ lat: home.lat, lng: home.lng }] : []),
    ...visitedStays,
    ...tracks,
  ];

  const center =
    allPoints.length > 0
      ? {
          lat:
            allPoints.reduce((sum, p) => sum + p.lat, 0) / allPoints.length,
          lng:
            allPoints.reduce((sum, p) => sum + p.lng, 0) / allPoints.length,
        }
      : { lat: 35.681, lng: 139.766 };

  const polylinePositions: [number, number][] = tracks.map((t) => [t.lat, t.lng]);

  return (
    <div
      style={{
        height: 480,
        borderRadius: 8,
        overflow: "hidden",
        border: "1px solid #E5E7EB",
      }}
    >
      <MapContainer
        center={[center.lat, center.lng]}
        zoom={11}
        scrollWheelZoom={true}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://osm.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* 経路 Polyline */}
        {polylinePositions.length >= 2 && (
          <Polyline
            positions={polylinePositions}
            pathOptions={{
              color: "#3366FF",
              weight: 3,
              opacity: 0.7,
            }}
          />
        )}

        {/* 200m間隔の経路点 */}
        {tracks.map((t, i) => (
          <CircleMarker
            key={`track-${i}`}
            center={[t.lat, t.lng]}
            radius={4}
            pathOptions={{
              color: "#3366FF",
              fillColor: "#3366FF",
              fillOpacity: 0.7,
              weight: 1,
            }}
          >
            <Popup>
              <div style={{ fontSize: 12 }}>
                <strong>{formatHHMMSS(t.ts)}</strong>
                <br />
                {t.lat.toFixed(6)}, {t.lng.toFixed(6)}
              </div>
            </Popup>
          </CircleMarker>
        ))}

        {/* 滞在ノード（OUT） */}
        {visitedStays.map((s, i) => (
          <CircleMarker
            key={`stay-${i}`}
            center={[s.lat, s.lng]}
            radius={10}
            pathOptions={{
              color: "#DC2626",
              fillColor: "#DC2626",
              fillOpacity: 0.6,
              weight: 2,
            }}
          >
            <Popup>
              <div style={{ fontSize: 13 }}>
                <strong>滞在ノード</strong>
                <br />
                {formatHHMM(s.ts_start)} - {formatHHMM(s.ts_end)}
                <br />
                {s.lat.toFixed(6)}, {s.lng.toFixed(6)}
              </div>
            </Popup>
          </CircleMarker>
        ))}

        {/* 勤務地 */}
        {work && (
          <>
            <Marker position={[work.lat, work.lng]}>
              <Popup>勤務地</Popup>
            </Marker>
            <Circle
              center={[work.lat, work.lng]}
              radius={work.radius_m}
              pathOptions={{
                color: "#3366FF",
                fillColor: "#3366FF",
                fillOpacity: 0.08,
                weight: 2,
              }}
            />
          </>
        )}

        {/* 自宅 */}
        {home && (
          <>
            <Marker position={[home.lat, home.lng]}>
              <Popup>自宅</Popup>
            </Marker>
            <Circle
              center={[home.lat, home.lng]}
              radius={home.radius_m}
              pathOptions={{
                color: "#059669",
                fillColor: "#059669",
                fillOpacity: 0.08,
                weight: 2,
              }}
            />
          </>
        )}
      </MapContainer>
    </div>
  );
}

function formatHHMM(iso: string): string {
  return new Date(iso).toLocaleTimeString("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Tokyo",
  });
}

function formatHHMMSS(iso: string): string {
  return new Date(iso).toLocaleTimeString("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "Asia/Tokyo",
  });
}
