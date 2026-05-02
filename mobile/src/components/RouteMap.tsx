/**
 * 今日の経路マップ
 * WebView + Leaflet + OpenStreetMap で実装
 * - 追加コスト 0（OSM タイル無料・API キー不要）
 * - Web 側の MapView と見た目同等
 */
import { View, StyleSheet, Text } from "react-native";
import { WebView } from "react-native-webview";
import { colors, radius, fonts } from "../lib/theme";

type LatLng = { lat: number; lng: number };

export default function RouteMap({
  tracks,
  height = 280,
}: {
  tracks: LatLng[];
  height?: number;
}) {
  if (tracks.length === 0) {
    return (
      <View style={[styles.empty, { height }]}>
        <Text style={styles.emptyText}>
          まだ今日の経路データがありません
        </Text>
        <Text style={styles.emptyHint}>
          自宅・勤務地エリアを出ると GPS 記録が始まります
        </Text>
      </View>
    );
  }

  const html = buildLeafletHtml(tracks);

  return (
    <View style={[styles.container, { height }]}>
      <WebView
        originWhitelist={["*"]}
        source={{ html }}
        style={styles.webview}
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        // ピンチズーム・パンを map に任せる
        scalesPageToFit={false}
        // タイル取得のため
        domStorageEnabled
        javaScriptEnabled
      />
    </View>
  );
}

function buildLeafletHtml(tracks: LatLng[]): string {
  const points = tracks.map((t) => [t.lat, t.lng]);
  return `<!doctype html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5" />
  <link
    rel="stylesheet"
    href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
    integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
    crossorigin=""
  />
  <style>
    html, body, #map { margin: 0; padding: 0; height: 100%; }
    body { background: #F4F6FB; }
    .leaflet-container { font-family: -apple-system, BlinkMacSystemFont, "Hiragino Sans", "Noto Sans JP", sans-serif; }
    .route-arrow { background: transparent !important; border: none !important; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script
    src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
    integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo="
    crossorigin=""
  ></script>
  <script>
    (function () {
      const points = ${JSON.stringify(points)};

      // ─── ヘルパー ───
      function haversineKm(la1, ln1, la2, ln2) {
        const toRad = (d) => (d * Math.PI) / 180;
        const dLat = toRad(la2 - la1);
        const dLng = toRad(ln2 - ln1);
        const a =
          Math.sin(dLat / 2) ** 2 +
          Math.cos(toRad(la1)) * Math.cos(toRad(la2)) * Math.sin(dLng / 2) ** 2;
        return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      }
      function bearingDeg(la1, ln1, la2, ln2) {
        const toRad = (d) => (d * Math.PI) / 180;
        const toDeg = (r) => (r * 180) / Math.PI;
        const phi1 = toRad(la1);
        const phi2 = toRad(la2);
        const dl = toRad(ln2 - ln1);
        const y = Math.sin(dl) * Math.cos(phi2);
        const x =
          Math.cos(phi1) * Math.sin(phi2) -
          Math.sin(phi1) * Math.cos(phi2) * Math.cos(dl);
        return (toDeg(Math.atan2(y, x)) + 360) % 360;
      }
      function pickArrows(pts, intervalKm) {
        if (pts.length < 2) return [];
        const arr = [];
        let cum = 0;
        for (let i = 1; i < pts.length; i++) {
          const seg = haversineKm(pts[i-1][0], pts[i-1][1], pts[i][0], pts[i][1]);
          if (seg < 0.001) continue;
          cum += seg;
          if (cum >= intervalKm) {
            const b = bearingDeg(pts[i-1][0], pts[i-1][1], pts[i][0], pts[i][1]);
            arr.push([
              (pts[i-1][0] + pts[i][0]) / 2,
              (pts[i-1][1] + pts[i][1]) / 2,
              b,
            ]);
            cum = 0;
          }
        }
        return arr;
      }
      function pickKmMilestones(pts) {
        if (pts.length < 2) return [];
        const ms = [];
        let cum = 0;
        let total = 0;
        for (let i = 1; i < pts.length; i++) {
          const seg = haversineKm(pts[i-1][0], pts[i-1][1], pts[i][0], pts[i][1]);
          cum += seg;
          total += seg;
          if (cum >= 1) {
            ms.push([pts[i][0], pts[i][1], Math.round(total * 10) / 10]);
            cum = 0;
          }
        }
        return ms;
      }
      function arrowIcon(bearing) {
        return L.divIcon({
          className: 'route-arrow',
          html: '<div style="transform: rotate(' + bearing + 'deg); width:11px;height:11px;display:flex;align-items:center;justify-content:center;">'
              + '<svg width="9" height="9" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">'
              + '<path d="M12 2 L20 18 L12 14 L4 18 Z" fill="#DC2626" stroke="#FFFFFF" stroke-width="1.5" stroke-linejoin="round"/>'
              + '</svg></div>',
          iconSize: [11, 11],
          iconAnchor: [5, 5],
        });
      }
      function kmPinIcon(km) {
        const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="13" height="21" viewBox="0 0 25 41">'
                  + '<path d="M12.5 0C5.6 0 0 5.6 0 12.5c0 9.4 12.5 28.5 12.5 28.5s12.5-19.1 12.5-28.5C25 5.6 19.4 0 12.5 0z" fill="#DC2626" stroke="#7F1D1D" stroke-width="1"/>'
                  + '<circle cx="12.5" cy="12.5" r="5" fill="#FFFFFF"/></svg>';
        return L.icon({
          iconUrl: 'data:image/svg+xml;base64,' + btoa(svg),
          iconSize: [13, 21],
          iconAnchor: [6, 21],
        });
      }

      // ─── マップ初期化 ───
      const map = L.map('map', { zoomControl: true, attributionControl: true });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
        maxZoom: 19,
      }).addTo(map);

      if (points.length > 0) {
        // 1. Polyline (青いルート)
        L.polyline(points, { color: '#3366FF', weight: 3, opacity: 0.7 }).addTo(map);

        // 2. 200m 間隔のドット（小さい赤丸）
        points.forEach((p) => {
          L.circleMarker(p, {
            radius: 1.5,
            color: '#DC2626',
            fillColor: '#DC2626',
            fillOpacity: 0.85,
            weight: 0.5,
          }).addTo(map);
        });

        // 3. 0.5km ごとに進行方向の矢印
        pickArrows(points, 0.5).forEach((a) => {
          L.marker([a[0], a[1]], { icon: arrowIcon(a[2]) }).addTo(map);
        });

        // 4. 1km ごとに赤ピン（ツールチップで距離表示）
        pickKmMilestones(points).forEach((m) => {
          L.marker([m[0], m[1]], { icon: kmPinIcon(m[2]) })
            .bindTooltip(m[2] + 'km', { permanent: false })
            .addTo(map);
        });

        if (points.length === 1) {
          map.setView(points[0], 14);
        } else {
          map.fitBounds(points, { padding: [20, 20] });
        }
      } else {
        map.setView([35.681, 139.766], 12);
      }
    })();
  </script>
</body>
</html>`;
}

const styles = StyleSheet.create({
  container: {
    borderRadius: radius.md,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
  },
  webview: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  empty: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  emptyText: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: "center",
    fontFamily: fonts.semibold,
  },
  emptyHint: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.textDisabled,
    textAlign: "center",
    marginTop: 4,
  },
});
