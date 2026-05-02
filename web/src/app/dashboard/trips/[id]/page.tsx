import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import TripDetailMap from "./TripDetailMap";
import TripDetailActions from "./TripDetailActions";
import { ArrowLeftIcon, MapPinIcon, RouteIcon, ListIcon } from "@/components/Icon";
import { reverseGeocodeStays } from "@/lib/geocoding";

export default async function TripDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Trip 取得
  const { data: trip } = await supabase
    .from("trips")
    .select(
      "id, account_id, date, depart_ts, return_ts, destination_label, visited_areas, total_minutes, max_distance_km, purpose, is_excluded, excluded_reason"
    )
    .eq("id", id)
    .maybeSingle();

  if (!trip) {
    return (
      <main className="container page">
        <div className="card" style={{ maxWidth: 560, margin: "0 auto" }}>
          <h1 className="page-title">出張が見つかりません</h1>
          <p className="text-light" style={{ marginTop: "var(--space-3)" }}>
            該当 ID の出張がないか、アクセス権がありません。
          </p>
          <a
            href="/dashboard"
            className="btn btn-secondary"
            style={{ marginTop: "var(--space-4)" }}
          >
            <ArrowLeftIcon size={14} />
            ダッシュボード
          </a>
        </div>
      </main>
    );
  }

  // 関連データは Trip の所有者で引く（admin が他ユーザーの Trip を見るケースに対応）
  const ownerId = trip.account_id;

  // 設定（勤務地・自宅エリア表示用）
  const { data: setting } = await supabase
    .from("account_settings")
    .select("work_lat, work_lng, work_radius_m, home_lat, home_lng, home_radius_m")
    .eq("account_id", ownerId)
    .maybeSingle();

  // この日のすべての滞在ノード
  const dayStart = `${trip.date}T00:00:00+09:00`;
  const dayEnd = `${trip.date}T23:59:59+09:00`;
  const { data: allStays } = await supabase
    .from("location_stays")
    .select("ts_start, ts_end, lat, lng, accuracy, source")
    .eq("account_id", ownerId)
    .gte("ts_start", dayStart)
    .lte("ts_start", dayEnd)
    .order("ts_start", { ascending: true });

  // Trip の時間範囲内の経路点
  const { data: tracks } = await supabase
    .from("location_tracks")
    .select("ts, lat, lng, accuracy")
    .eq("account_id", ownerId)
    .gte("ts", trip.depart_ts)
    .lte("ts", trip.return_ts)
    .order("ts", { ascending: true });

  // admin が他ユーザーの Trip を見ている場合は読み取り専用扱いにする
  const isOwner = user.id === ownerId;

  // 訪問先（OUT 滞在）= 勤務地・自宅エリア外の滞在
  const visitedStays = (allStays ?? []).filter((s) => {
    if (!setting?.work_lat || !setting?.home_lat) return false;
    const distWork = haversineKm(
      s.lat,
      s.lng,
      setting.work_lat,
      setting.work_lng
    );
    const distHome = haversineKm(
      s.lat,
      s.lng,
      setting.home_lat,
      setting.home_lng
    );
    const inWork = distWork * 1000 <= setting.work_radius_m;
    const inHome = distHome * 1000 <= setting.home_radius_m;
    return !inWork && !inHome;
  });

  // 滞在ノードを逆ジオコーディング（町名レベル）。Nominatim 1req/secのため数件想定
  const visitedLabels = await reverseGeocodeStays(
    visitedStays.map((s) => ({ lat: s.lat, lng: s.lng }))
  );

  const departTime = formatHHMM(trip.depart_ts);
  const returnTime = formatHHMM(trip.return_ts);

  return (
    <main className="container page">
      <div className="breadcrumb">
        <a href="/dashboard">
          <ArrowLeftIcon size={12} style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }} />
          ダッシュボード
        </a>
      </div>
      <header className="page-header">
        <div>
          <h1 className="page-title">
            出張詳細: {trip.date} ({weekdayJa(trip.date)})
          </h1>
          {trip.destination_label && (
            <p className="page-subtitle">
              <MapPinIcon size={14} style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }} />
              {trip.destination_label}
            </p>
          )}
        </div>
      </header>

      {/* KPI ヒーロー */}
      <section className="kpi-inline" style={{ marginBottom: "var(--space-5)" }}>
        <div className="kpi-inline-item">
          <p className="kpi-inline-label">出発 / 帰着</p>
          <p
            className="kpi-inline-value"
            style={{ fontSize: "var(--text-base)", fontWeight: 600 }}
          >
            {departTime}
            <span className="kpi-inline-value-suffix">〜</span>
            {returnTime}
          </p>
        </div>
        <div className="kpi-inline-item" title="現地での滞在時間（移動時間除く）">
          <p className="kpi-inline-label">滞在時間</p>
          <p className="kpi-inline-value">
            {(trip.total_minutes / 60).toFixed(1)}
            <span className="kpi-inline-value-suffix">h</span>
          </p>
        </div>
        <div className="kpi-inline-item">
          <p className="kpi-inline-label">最大距離</p>
          <p className="kpi-inline-value">
            {trip.max_distance_km != null
              ? trip.max_distance_km.toFixed(1)
              : "—"}
            {trip.max_distance_km != null && (
              <span className="kpi-inline-value-suffix">km</span>
            )}
          </p>
        </div>
      </section>

      {/* 基本情報 */}
      <section className="card" style={{ marginBottom: "var(--space-5)" }}>
        <h2 className="section-title">基本情報</h2>
        <dl className="def-list">
          <dt>出張先</dt>
          <dd>{trip.destination_label ?? "—"}</dd>
          <dt>訪問地</dt>
          <dd>{trip.visited_areas?.join(", ") ?? "—"}</dd>
        </dl>

        <div
          style={{
            marginTop: "var(--space-5)",
            borderTop: "1px solid var(--border)",
            paddingTop: "var(--space-4)",
          }}
        >
          {isOwner ? (
            <TripDetailActions
              tripId={trip.id}
              initialPurpose={trip.purpose}
              initialIsExcluded={trip.is_excluded}
              excludedReason={trip.excluded_reason}
            />
          ) : (
            <div className="text-sm text-muted">
              <strong>目的:</strong> {trip.purpose || "—"}
              {trip.is_excluded && (
                <span
                  className="badge badge-suspended"
                  style={{ marginLeft: 8 }}
                >
                  除外中
                  {trip.excluded_reason ? `（${trip.excluded_reason}）` : ""}
                </span>
              )}
              <p className="text-xs" style={{ marginTop: 8 }}>
                運営者として閲覧中のため編集できません
              </p>
            </div>
          )}
        </div>
      </section>

      {/* マップ */}
      <section className="card" style={{ marginBottom: "var(--space-5)" }}>
        <h2 className="section-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <RouteIcon size={18} /> 移動経路マップ
        </h2>
        <TripDetailMap
          work={
            setting?.work_lat != null && setting?.work_lng != null
              ? {
                  lat: setting.work_lat,
                  lng: setting.work_lng,
                  radius_m: setting.work_radius_m,
                }
              : null
          }
          home={
            setting?.home_lat != null && setting?.home_lng != null
              ? {
                  lat: setting.home_lat,
                  lng: setting.home_lng,
                  radius_m: setting.home_radius_m,
                }
              : null
          }
          visitedStays={visitedStays.map((s) => ({
            ts_start: s.ts_start,
            ts_end: s.ts_end,
            lat: s.lat,
            lng: s.lng,
          }))}
          tracks={(tracks ?? []).map((t) => ({
            ts: t.ts,
            lat: t.lat,
            lng: t.lng,
          }))}
        />
        <div className="map-legend" role="list" aria-label="地図凡例">
          <span className="map-legend-item" role="listitem">
            <span className="map-legend-swatch map-legend-swatch-circle-blue" aria-hidden="true" />
            勤務地エリア
          </span>
          <span className="map-legend-item" role="listitem">
            <span className="map-legend-swatch map-legend-swatch-circle-green" aria-hidden="true" />
            自宅エリア
          </span>
          <span className="map-legend-item" role="listitem">
            <span className="map-legend-swatch map-legend-swatch-dot-red" aria-hidden="true" />
            200m間隔の通過点
          </span>
          <span className="map-legend-item" role="listitem">
            <span className="map-legend-swatch map-legend-swatch-arrow" aria-hidden="true" />
            0.5kmごとの進行方向
          </span>
          <span className="map-legend-item" role="listitem">
            <span className="map-legend-swatch map-legend-swatch-pin-red" aria-hidden="true" />
            1kmごとの目印
          </span>
          <span className="map-legend-item" role="listitem">
            <span className="map-legend-swatch map-legend-swatch-stay" aria-hidden="true" />
            滞在ノード
          </span>
        </div>
      </section>

      {/* 滞在ノード */}
      <section className="card" style={{ marginBottom: "var(--space-5)" }}>
        <h2 className="section-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <MapPinIcon size={18} /> 滞在ノード（30分以上同地点）
        </h2>
        {visitedStays.length === 0 ? (
          <p className="text-light">該当する滞在ノードがありません</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0 }}>
            {visitedStays.map((s, i) => {
              const start = formatHHMM(s.ts_start);
              const end = formatHHMM(s.ts_end);
              const minutes =
                (new Date(s.ts_end).getTime() - new Date(s.ts_start).getTime()) /
                60000;
              const label = visitedLabels[i] ?? `(${s.lat.toFixed(4)}, ${s.lng.toFixed(4)})`;
              return (
                <li
                  key={i}
                  style={{
                    padding: "var(--space-3) 0",
                    borderTop: i > 0 ? "1px solid var(--border)" : "none",
                    display: "flex",
                    gap: "var(--space-3)",
                    alignItems: "baseline",
                    fontSize: "var(--text-sm)",
                  }}
                >
                  <span className="tabular text-muted" style={{ width: 90, flexShrink: 0 }}>
                    {start}-{end}
                  </span>
                  <span style={{ flex: 1 }}>
                    <strong>{label}</strong>
                    <span className="text-muted text-xs font-mono" style={{ marginLeft: 8 }}>
                      ({s.lat.toFixed(4)}, {s.lng.toFixed(4)})
                    </span>
                  </span>
                  <span className="text-muted text-xs" style={{ flexShrink: 0 }}>
                    {Math.round(minutes)}分
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* 移動ログ表 */}
      <section className="card">
        <details>
          <summary
            className="section-title"
            style={{
              cursor: "pointer",
              listStyle: "none",
              userSelect: "none",
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 0,
            }}
          >
            <ListIcon size={18} />
            移動ログ（200m間隔・全 {tracks?.length ?? 0} 点）
          </summary>
          <div style={{ marginTop: "var(--space-4)", maxHeight: 400, overflow: "auto" }}>
            {!tracks || tracks.length === 0 ? (
              <p className="text-light">移動ログがありません</p>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>時刻</th>
                    <th className="num">緯度</th>
                    <th className="num">経度</th>
                    <th className="num">精度(m)</th>
                  </tr>
                </thead>
                <tbody>
                  {tracks.map((t, i) => (
                    <tr key={i}>
                      <td className="tabular">{formatHHMMSS(t.ts)}</td>
                      <td className="num font-mono">{t.lat.toFixed(6)}</td>
                      <td className="num font-mono">{t.lng.toFixed(6)}</td>
                      <td className="num">
                        {t.accuracy != null ? Math.round(t.accuracy) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </details>
      </section>
    </main>
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

function weekdayJa(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12));
  return ["日", "月", "火", "水", "木", "金", "土"][dt.getUTCDay()];
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
