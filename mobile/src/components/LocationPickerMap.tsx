/**
 * 自宅・勤務地の位置を地図で選ぶインタラクティブピッカー
 * - Leaflet + OpenStreetMap (追加コスト 0)
 * - タップ = ピン配置 / ドラッグ = 微調整
 * - 100m 円表示
 * - WebView ↔ RN の双方向 postMessage
 */
import { useRef } from "react";
import { View, StyleSheet } from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import { colors, radius } from "../lib/theme";

export type LatLng = { lat: number; lng: number };

export default function LocationPickerMap({
  initial,
  radiusM = 100,
  height = 320,
  onChange,
}: {
  initial: LatLng | null;
  radiusM?: number;
  height?: number;
  onChange: (latlng: LatLng) => void;
}) {
  const ref = useRef<WebView | null>(null);
  const html = buildPickerHtml(initial, radiusM);

  const onMessage = (e: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(e.nativeEvent.data) as {
        type?: string;
        lat?: number;
        lng?: number;
      };
      if (
        data.type === "pick" &&
        typeof data.lat === "number" &&
        typeof data.lng === "number"
      ) {
        onChange({ lat: data.lat, lng: data.lng });
      }
    } catch {}
  };

  // 親から呼べる: 現在地を地図に反映
  const setCenter = (lat: number, lng: number) => {
    ref.current?.injectJavaScript(
      `try{window.__setPin && window.__setPin(${lat}, ${lng});}catch(e){};true;`,
    );
  };

  // ref の type 整合用に export （現在は使っていないが将来的に外から呼ぶ場合）
  void setCenter;

  return (
    <View style={[styles.container, { height }]}>
      <WebView
        ref={ref}
        originWhitelist={["*"]}
        source={{ html }}
        style={styles.webview}
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        scalesPageToFit={false}
        domStorageEnabled
        javaScriptEnabled
        onMessage={onMessage}
      />
    </View>
  );
}

function buildPickerHtml(initial: LatLng | null, radiusM: number): string {
  const init = initial ?? { lat: 35.681, lng: 139.766 }; // 未設定なら東京駅
  const initialZoom = initial ? 16 : 12;
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
      const map = L.map('map', { zoomControl: true, attributionControl: true }).setView(
        [${init.lat}, ${init.lng}],
        ${initialZoom}
      );
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
        maxZoom: 19,
      }).addTo(map);

      let marker = null;
      let circle = null;

      function emit(lat, lng) {
        if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
          window.ReactNativeWebView.postMessage(
            JSON.stringify({ type: 'pick', lat: lat, lng: lng })
          );
        }
      }

      function place(lat, lng) {
        if (!marker) {
          marker = L.marker([lat, lng], { draggable: true }).addTo(map);
          marker.on('dragend', function (e) {
            const ll = e.target.getLatLng();
            place(ll.lat, ll.lng);
            map.panTo([ll.lat, ll.lng]);
          });
        } else {
          marker.setLatLng([lat, lng]);
        }
        if (!circle) {
          circle = L.circle([lat, lng], {
            radius: ${radiusM},
            color: '#3366FF',
            fillColor: '#3366FF',
            fillOpacity: 0.12,
            weight: 2,
          }).addTo(map);
        } else {
          circle.setLatLng([lat, lng]);
        }
        emit(lat, lng);
      }

      // 外部から呼ぶ用: 現在地ボタンなどから
      window.__setPin = function (lat, lng) {
        map.setView([lat, lng], 16);
        place(lat, lng);
      };

      // 初期表示
      ${initial ? `place(${init.lat}, ${init.lng});` : ""}

      // タップ = 配置
      map.on('click', function (e) {
        place(e.latlng.lat, e.latlng.lng);
      });
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
});
