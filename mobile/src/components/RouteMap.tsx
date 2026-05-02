/**
 * 今日の経路マップ
 * WebView + Leaflet + OpenStreetMap で実装
 * - 追加コスト 0（OSM タイル無料・API キー不要）
 * - Web 側の MapView と見た目同等
 */
import { View, StyleSheet, Text } from "react-native";
import { WebView } from "react-native-webview";
import { colors, radius } from "../lib/theme";

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
      const map = L.map('map', { zoomControl: true, attributionControl: true });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
        maxZoom: 19,
      }).addTo(map);

      if (points.length > 0) {
        L.polyline(points, {
          color: '#3366FF',
          weight: 3,
          opacity: 0.8,
        }).addTo(map);
        // 始点・終点ハイライト
        L.circleMarker(points[0], {
          radius: 6,
          color: '#1E3A8A',
          fillColor: '#FFFFFF',
          fillOpacity: 1,
          weight: 2,
        }).bindTooltip('始点', { permanent: false }).addTo(map);
        if (points.length > 1) {
          L.circleMarker(points[points.length - 1], {
            radius: 6,
            color: '#3366FF',
            fillColor: '#3366FF',
            fillOpacity: 1,
            weight: 2,
          }).bindTooltip('現在地', { permanent: false }).addTo(map);
        }
        // 中間の通過点（軽量に）
        const step = Math.max(1, Math.floor(points.length / 50));
        for (let i = step; i < points.length - 1; i += step) {
          L.circleMarker(points[i], {
            radius: 2,
            color: '#3366FF',
            fillColor: '#3366FF',
            fillOpacity: 0.7,
            weight: 1,
          }).addTo(map);
        }

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
    fontWeight: "600",
  },
  emptyHint: {
    fontSize: 11,
    color: colors.textDisabled,
    textAlign: "center",
    marginTop: 4,
  },
});
