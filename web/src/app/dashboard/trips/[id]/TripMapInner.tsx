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

// Default Marker icon fix（青いデフォルト）
delete (L.Icon.Default.prototype as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl:
    "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl:
    "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// 赤いカスタム Pin（1km マイルストーン用）
const redPinIcon = new L.Icon({
  iconUrl:
    "data:image/svg+xml;base64," +
    btoa(`<svg xmlns="http://www.w3.org/2000/svg" width="25" height="41" viewBox="0 0 25 41">
      <path d="M12.5 0C5.6 0 0 5.6 0 12.5c0 9.4 12.5 28.5 12.5 28.5s12.5-19.1 12.5-28.5C25 5.6 19.4 0 12.5 0z" fill="#DC2626" stroke="#7F1D1D" stroke-width="1"/>
      <circle cx="12.5" cy="12.5" r="5" fill="#FFFFFF"/>
    </svg>`),
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

/**
 * 進行方向の矢印 DivIcon
 * 北向き (0deg) を基準に rotate する
 */
function makeArrowIcon(bearingDeg: number): L.DivIcon {
  return L.divIcon({
    className: "trip-arrow",
    html: `<div style="transform: rotate(${bearingDeg}deg); width: 22px; height: 22px; display: flex; align-items: center; justify-content: center;">
      <svg width="20" height="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 2 L20 18 L12 14 L4 18 Z" fill="#DC2626" stroke="#FFFFFF" stroke-width="1.5" stroke-linejoin="round"/>
      </svg>
    </div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
}

/**
 * 2点間の方位角 (北を0度、時計回りに 0-360)
 */
function bearingDeg(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;
  const phi1 = toRad(lat1);
  const phi2 = toRad(lat2);
  const dl = toRad(lng2 - lng1);
  const y = Math.sin(dl) * Math.cos(phi2);
  const x =
    Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(dl);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/**
 * tracks 配列から、累積距離 intervalKm ごとに矢印位置を抽出
 * 矢印は前後の点をもとに進行方向を計算
 */
function pickArrowMarkers(
  tracks: Array<{ ts: string; lat: number; lng: number }>,
  intervalKm: number = 0.5
): Array<{ lat: number; lng: number; bearing: number }> {
  if (tracks.length < 2) return [];
  const arrows: Array<{ lat: number; lng: number; bearing: number }> = [];
  let cumKm = 0;
  for (let i = 1; i < tracks.length; i++) {
    const seg = haversineKm(
      tracks[i - 1].lat,
      tracks[i - 1].lng,
      tracks[i].lat,
      tracks[i].lng
    );
    if (seg < 0.001) continue; // 同地点はスキップ
    cumKm += seg;
    if (cumKm >= intervalKm) {
      const b = bearingDeg(
        tracks[i - 1].lat,
        tracks[i - 1].lng,
        tracks[i].lat,
        tracks[i].lng
      );
      arrows.push({
        lat: (tracks[i - 1].lat + tracks[i].lat) / 2,
        lng: (tracks[i - 1].lng + tracks[i].lng) / 2,
        bearing: b,
      });
      cumKm = 0;
    }
  }
  return arrows;
}

const EARTH_RADIUS_KM = 6371;
function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

/**
 * tracks の中から 1km ごとのマイルストーン点を抽出
 * 累積距離が 1km を超えるたびに pin を立てる
 */
function pickKmMilestones(
  tracks: Array<{ ts: string; lat: number; lng: number }>
): Array<{ ts: string; lat: number; lng: number; km: number }> {
  if (tracks.length < 2) return [];
  const milestones: Array<{ ts: string; lat: number; lng: number; km: number }> = [];
  let cumKm = 0;
  let totalKm = 0;
  for (let i = 1; i < tracks.length; i++) {
    const seg = haversineKm(
      tracks[i - 1].lat,
      tracks[i - 1].lng,
      tracks[i].lat,
      tracks[i].lng
    );
    cumKm += seg;
    totalKm += seg;
    if (cumKm >= 1) {
      milestones.push({ ...tracks[i], km: Math.round(totalKm * 10) / 10 });
      cumKm = 0;
    }
  }
  return milestones;
}

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
  const kmMilestones = pickKmMilestones(tracks);
  const arrowMarkers = pickArrowMarkers(tracks, 0.5); // 0.5km ごとに矢印

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

        {/* 経路 Polyline（赤い線） */}
        {polylinePositions.length >= 2 && (
          <Polyline
            positions={polylinePositions}
            pathOptions={{
              color: "#DC2626",
              weight: 3,
              opacity: 0.5,
            }}
          />
        )}

        {/* 進行方向の矢印（0.5km ごと） */}
        {arrowMarkers.map((a, i) => (
          <Marker
            key={`arrow-${i}`}
            position={[a.lat, a.lng]}
            icon={makeArrowIcon(a.bearing)}
            interactive={false}
            keyboard={false}
          />
        ))}

        {/* 200m間隔の経路点（赤丸・小） */}
        {tracks.map((t, i) => (
          <CircleMarker
            key={`track-${i}`}
            center={[t.lat, t.lng]}
            radius={4}
            pathOptions={{
              color: "#DC2626",
              fillColor: "#DC2626",
              fillOpacity: 0.8,
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

        {/* 1km ごとのマイルストーン（赤ピン） */}
        {kmMilestones.map((m, i) => (
          <Marker
            key={`km-${i}`}
            position={[m.lat, m.lng]}
            icon={redPinIcon}
          >
            <Popup>
              <div style={{ fontSize: 13 }}>
                <strong>{m.km.toFixed(1)} km 地点</strong>
                <br />
                {formatHHMMSS(m.ts)}
                <br />
                {m.lat.toFixed(6)}, {m.lng.toFixed(6)}
              </div>
            </Popup>
          </Marker>
        ))}

        {/* 滞在ノード（OUT）= 大きめの赤丸 */}
        {visitedStays.map((s, i) => (
          <CircleMarker
            key={`stay-${i}`}
            center={[s.lat, s.lng]}
            radius={12}
            pathOptions={{
              color: "#7F1D1D",
              fillColor: "#DC2626",
              fillOpacity: 0.85,
              weight: 3,
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
