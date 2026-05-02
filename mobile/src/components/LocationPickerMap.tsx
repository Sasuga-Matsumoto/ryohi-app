/**
 * 自宅・勤務地の位置を地図で選ぶインタラクティブピッカー
 * - Leaflet + OpenStreetMap (追加コスト 0)
 * - タップ = ピン配置 / ドラッグ = 微調整
 * - 100m 円表示
 * - WebView ↔ RN の双方向 postMessage
 * - 検索（住所 / 郵便番号 / 施設名）→ Nominatim
 */
import { useEffect, useRef, useState } from "react";
import {
  View,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Text,
  ActivityIndicator,
} from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import { Feather } from "@expo/vector-icons";
import { colors, radius, spacing, typography, TOUCH_MIN } from "../lib/theme";
import { geocodeSearch, type GeocodeResult } from "../lib/health";

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

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // debounce 検索（300ms）
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      const r = await geocodeSearch(query);
      setSearching(false);
      setResults(r);
      setShowResults(true);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

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

  const setCenter = (lat: number, lng: number) => {
    ref.current?.injectJavaScript(
      `try{window.__setPin && window.__setPin(${lat}, ${lng});}catch(e){};true;`,
    );
  };

  const pickResult = (r: GeocodeResult) => {
    setCenter(r.lat, r.lng);
    onChange({ lat: r.lat, lng: r.lng });
    setShowResults(false);
    setQuery("");
    setResults([]);
  };

  return (
    <View>
      {/* 検索バー */}
      <View style={styles.searchWrap}>
        <Feather name="search" color={colors.textMuted} size={16} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          onFocus={() => results.length > 0 && setShowResults(true)}
          placeholder="住所 / 郵便番号 / 施設名 で検索"
          placeholderTextColor={colors.textDisabled}
          style={styles.searchInput}
          autoCorrect={false}
          autoCapitalize="none"
        />
        {searching && <ActivityIndicator size="small" color={colors.primary} />}
        {query.length > 0 && !searching && (
          <TouchableOpacity onPress={() => setQuery("")} hitSlop={8}>
            <Feather name="x" color={colors.textMuted} size={16} />
          </TouchableOpacity>
        )}
      </View>

      {/* 検索結果 */}
      {showResults && results.length > 0 && (
        <View style={styles.resultsBox}>
          {results.map((r, i) => (
            <TouchableOpacity
              key={i}
              onPress={() => pickResult(r)}
              style={[
                styles.resultRow,
                i > 0 && {
                  borderTopWidth: 1,
                  borderTopColor: colors.border,
                },
              ]}
              activeOpacity={0.7}
            >
              <Feather
                name="map-pin"
                color={colors.textMuted}
                size={14}
                style={{ marginTop: 3 }}
              />
              <Text style={styles.resultText} numberOfLines={2}>
                {r.display_name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
      {showResults && !searching && query.trim().length >= 2 && results.length === 0 && (
        <View style={styles.resultsBox}>
          <Text style={styles.noResult}>該当する場所が見つかりません</Text>
        </View>
      )}

      {/* マップ本体 */}
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
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: spacing[3],
    height: TOUCH_MIN,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    marginBottom: spacing[2],
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    paddingVertical: 0,
  },
  resultsBox: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing[2],
    overflow: "hidden",
  },
  resultRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    padding: spacing[3],
  },
  resultText: {
    flex: 1,
    ...typography.caption,
    color: colors.text,
    lineHeight: 18,
  },
  noResult: {
    padding: spacing[3],
    ...typography.caption,
    color: colors.textMuted,
    textAlign: "center",
  },
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
