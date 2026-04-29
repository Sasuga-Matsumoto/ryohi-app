"use client";

import dynamic from "next/dynamic";
import { useState, useEffect, useCallback } from "react";

// react-leaflet は window 依存なので SSR 無効
const MapView = dynamic(() => import("./MapView"), {
  ssr: false,
  loading: () => (
    <div
      style={{
        height: 320,
        background: "#F1F5F9",
        borderRadius: 8,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "var(--text-light)",
      }}
    >
      地図を読み込み中…
    </div>
  ),
});

type SearchResult = {
  lat: number;
  lng: number;
  display_name: string;
};

const RADIUS_OPTIONS = [
  { value: 100, label: "100m（自宅・小規模オフィス向け）" },
  { value: 200, label: "200m" },
  { value: 500, label: "500m（中規模オフィスビル向け）" },
  { value: 1000, label: "1km（大規模拠点・駅前向け）" },
];

export default function LocationPicker({
  label,
  lat,
  lng,
  radiusM,
  onChange,
  onRadiusChange,
}: {
  label: string;
  lat: number | null;
  lng: number | null;
  radiusM: number;
  onChange: (lat: number, lng: number) => void;
  onRadiusChange?: (radiusM: number) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [resolvedAddress, setResolvedAddress] = useState<string | null>(null);

  const center = lat != null && lng != null ? { lat, lng } : null;

  // lat/lng が変わったら逆ジオコーディングで住所表示
  useEffect(() => {
    if (lat == null || lng == null) {
      setResolvedAddress(null);
      return;
    }
    let aborted = false;
    fetch(`/api/reverse-geocode?lat=${lat}&lng=${lng}`)
      .then((r) => r.json())
      .then((data: { display_name?: string }) => {
        if (!aborted) setResolvedAddress(data.display_name ?? null);
      })
      .catch(() => {});
    return () => {
      aborted = true;
    };
  }, [lat, lng]);

  const search = useCallback(async () => {
    if (query.trim().length < 2) return;
    setSearching(true);
    const res = await fetch(`/api/geocode?q=${encodeURIComponent(query.trim())}`);
    const data = (await res.json()) as { results?: SearchResult[] };
    setResults(data.results ?? []);
    setSearching(false);
  }, [query]);

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert("ブラウザが位置情報に非対応です");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => onChange(pos.coords.latitude, pos.coords.longitude),
      (err) => alert(`現在地取得失敗: ${err.message}`)
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* 住所検索 */}
      <div style={{ display: "flex", gap: 8 }}>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              search();
            }
          }}
          className="input"
          placeholder={`${label}の住所・施設名（例: 東京駅、渋谷区道玄坂2-X）`}
          style={{ flex: 1 }}
        />
        <button
          type="button"
          className="btn btn-secondary"
          onClick={search}
          disabled={searching || query.trim().length < 2}
        >
          {searching ? "…" : "検索"}
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={useCurrentLocation}
          title="現在地を取得"
        >
          📍 現在地
        </button>
      </div>

      {/* 検索結果 */}
      {results.length > 0 && (
        <div
          style={{
            border: "1px solid #E5E7EB",
            borderRadius: 8,
            maxHeight: 200,
            overflowY: "auto",
          }}
        >
          {results.map((r, i) => (
            <button
              key={i}
              type="button"
              style={{
                display: "block",
                width: "100%",
                padding: "10px 14px",
                textAlign: "left",
                background: "white",
                border: "none",
                borderTop: i > 0 ? "1px solid #E5E7EB" : "none",
                fontSize: "0.85rem",
                cursor: "pointer",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#F9FAFB")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "white")}
              onClick={() => {
                onChange(r.lat, r.lng);
                setResults([]);
                setQuery("");
              }}
            >
              {r.display_name}
            </button>
          ))}
        </div>
      )}

      {/* 半径選択 */}
      {onRadiusChange && (
        <div className="row" style={{ gap: "var(--space-2)" }}>
          <label className="text-sm text-light" htmlFor={`radius-${label}`}>
            {label}エリア半径:
          </label>
          <select
            id={`radius-${label}`}
            value={radiusM}
            onChange={(e) => onRadiusChange(parseInt(e.target.value))}
            className="select"
            style={{ maxWidth: 320 }}
          >
            {RADIUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* マップ */}
      <MapView
        center={center}
        radiusM={radiusM}
        onPickLocation={(la, ln) => onChange(la, ln)}
      />

      {/* 現在の選択 */}
      {center && (
        <div
          style={{
            padding: "10px 14px",
            background: "#F0F9FF",
            borderRadius: 8,
            fontSize: "0.85rem",
            lineHeight: 1.6,
          }}
        >
          <div>
            <strong>選択中:</strong>{" "}
            <span style={{ fontFamily: "monospace" }}>
              {center.lat.toFixed(6)}, {center.lng.toFixed(6)}
            </span>
          </div>
          {resolvedAddress && (
            <div style={{ color: "var(--text-light)", marginTop: 4 }}>
              {resolvedAddress}
            </div>
          )}
        </div>
      )}

      <p
        style={{
          fontSize: "0.75rem",
          color: "var(--text-light)",
          lineHeight: 1.6,
        }}
      >
        操作: ① 上の入力欄で住所検索 / ② 検索結果クリックで Pin 移動 / ③ 地図を直接クリックして Pin 移動 / ④ 「現在地」ボタンで現在地取得
        <br />
        円は半径 {radiusM >= 1000 ? `${(radiusM / 1000).toFixed(1)}km` : `${radiusM}m`} の{label}エリア（このエリア内移動は出張に含めません）
      </p>
    </div>
  );
}
