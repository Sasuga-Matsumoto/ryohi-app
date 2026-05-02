"use client";

import dynamic from "next/dynamic";
import { useState, useEffect, useRef } from "react";

// react-leaflet は window 依存なので SSR 無効
const MapView = dynamic(() => import("./MapView"), {
  ssr: false,
  loading: () => (
    <div
      style={{
        height: 360,
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

export default function LocationPicker({
  label,
  lat,
  lng,
  radiusM,
  onChange,
}: {
  label: string;
  lat: number | null;
  lng: number | null;
  radiusM: number;
  onChange: (lat: number, lng: number) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const [resolvedAddress, setResolvedAddress] = useState<string | null>(null);
  const [acquiringLocation, setAcquiringLocation] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // debounced 検索（300ms）
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setLoadingSearch(true);
      try {
        const res = await fetch(
          `/api/geocode?q=${encodeURIComponent(query.trim())}`,
        );
        const data = (await res.json()) as { results?: SearchResult[] };
        setResults(data.results ?? []);
        setShowDropdown(true);
        setHighlightIndex(-1);
      } catch {
        // silent
      } finally {
        setLoadingSearch(false);
      }
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  const handleUseCurrent = () => {
    if (!navigator.geolocation) {
      setError("ブラウザが位置情報に非対応です");
      return;
    }
    setError(null);
    setAcquiringLocation(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onChange(pos.coords.latitude, pos.coords.longitude);
        setAcquiringLocation(false);
      },
      (err) => {
        setAcquiringLocation(false);
        setError(`現在地が取得できませんでした: ${err.message}`);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  };

  const pickResult = (r: SearchResult) => {
    onChange(r.lat, r.lng);
    setQuery("");
    setResults([]);
    setShowDropdown(false);
    setHighlightIndex(-1);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      setShowDropdown(false);
      return;
    }
    if (!showDropdown || results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIndex((i) => Math.max(i - 1, -1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (highlightIndex >= 0 && highlightIndex < results.length) {
        pickResult(results[highlightIndex]);
      }
    }
  };

  const radiusLabel =
    radiusM >= 1000 ? `${(radiusM / 1000).toFixed(1)}km` : `${radiusM}m`;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* 現在地を使う - 最大の CTA */}
      <div>
        <button
          type="button"
          onClick={handleUseCurrent}
          disabled={acquiringLocation}
          className="btn btn-primary btn-lg"
          style={{
            width: "100%",
            padding: "14px",
            fontSize: "1rem",
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
          }}
        >
          <span>📍</span>
          {acquiringLocation ? "取得中…" : "現在地を使う"}
        </button>
        <p
          style={{
            fontSize: "0.78rem",
            color: "var(--text-light)",
            textAlign: "center",
            marginTop: 6,
          }}
        >
          {label}にいる場合は 1 タップで完了します
        </p>
      </div>

      {/* 区切り */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          color: "var(--text-light)",
          fontSize: "0.85rem",
        }}
      >
        <div style={{ flex: 1, height: 1, background: "var(--border, #E5E7EB)" }} />
        <span>または</span>
        <div style={{ flex: 1, height: 1, background: "var(--border, #E5E7EB)" }} />
      </div>

      {/* 検索（autocomplete） */}
      <div style={{ position: "relative" }}>
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setShowDropdown(true);
          }}
          onFocus={() => {
            if (results.length > 0) setShowDropdown(true);
          }}
          onBlur={() => {
            // 候補クリック前に閉じないよう少し遅延
            setTimeout(() => setShowDropdown(false), 150);
          }}
          onKeyDown={onKeyDown}
          className="input"
          placeholder="住所・施設名・郵便番号で検索（例: 札幌駅 / 060-0061 / 渋谷区道玄坂）"
          style={{ width: "100%", paddingRight: loadingSearch ? 80 : 12 }}
          autoComplete="off"
        />
        {loadingSearch && (
          <span
            style={{
              position: "absolute",
              right: 12,
              top: "50%",
              transform: "translateY(-50%)",
              fontSize: "0.78rem",
              color: "var(--text-light)",
              pointerEvents: "none",
            }}
          >
            検索中…
          </span>
        )}

        {/* 候補リスト */}
        {showDropdown && results.length > 0 && (
          <div
            style={{
              position: "absolute",
              top: "calc(100% + 4px)",
              left: 0,
              right: 0,
              border: "1px solid #E5E7EB",
              borderRadius: 8,
              background: "white",
              boxShadow: "0 6px 16px rgba(0,0,0,0.08)",
              zIndex: 1000,
              maxHeight: 240,
              overflowY: "auto",
            }}
          >
            {results.map((r, i) => (
              <button
                key={i}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  pickResult(r);
                }}
                onMouseEnter={() => setHighlightIndex(i)}
                style={{
                  display: "block",
                  width: "100%",
                  padding: "10px 14px",
                  textAlign: "left",
                  background: highlightIndex === i ? "#F0F9FF" : "white",
                  border: "none",
                  borderTop: i > 0 ? "1px solid #F1F5F9" : "none",
                  fontSize: "0.85rem",
                  cursor: "pointer",
                  lineHeight: 1.4,
                }}
              >
                {r.display_name}
              </button>
            ))}
          </div>
        )}

        {/* 該当なし */}
        {showDropdown &&
          !loadingSearch &&
          query.trim().length >= 2 &&
          results.length === 0 && (
            <div
              style={{
                position: "absolute",
                top: "calc(100% + 4px)",
                left: 0,
                right: 0,
                padding: "10px 14px",
                border: "1px solid #E5E7EB",
                borderRadius: 8,
                background: "white",
                fontSize: "0.85rem",
                color: "var(--text-light)",
                zIndex: 1000,
              }}
            >
              該当する場所が見つかりませんでした。違うキーワードでお試しください。
            </div>
          )}
      </div>

      {/* エラー */}
      {error && (
        <div
          style={{
            padding: "10px 14px",
            background: "#FEF2F2",
            color: "#991B1B",
            borderRadius: 8,
            fontSize: "0.85rem",
            border: "1px solid #FECACA",
          }}
        >
          {error}
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
        Pin をドラッグまたは地図クリックで微調整できます。
        円は半径 {radiusLabel} の{label}エリア（このエリア内移動は出張に含めません）
      </p>
    </div>
  );
}
