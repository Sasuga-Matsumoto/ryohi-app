/**
 * Admin が各ユーザーのダッシュボード（KPI・出張一覧）を read-only で閲覧する画面
 * 操作は不可（編集/除外は本人のみ）
 */
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/supabase/admin-guard";
import { createClient } from "@/lib/supabase/server";
import {
  ArrowLeftIcon,
  EyeIcon,
  AlertTriangleIcon,
  ChevronRightIcon,
} from "@/components/Icon";
import StatusPill from "@/components/StatusPill";

type Trip = {
  id: string;
  date: string;
  destination_label: string | null;
  depart_ts: string;
  return_ts: string;
  total_minutes: number;
  max_distance_km: number | null;
  purpose: string;
  is_excluded: boolean;
  excluded_reason: string | null;
};

export default async function AdminAccountDashboardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const supabase = await createClient();

  const { data: account } = await supabase
    .from("accounts")
    .select("id, name, email, company_name, status")
    .eq("id", id)
    .maybeSingle();
  if (!account) redirect("/admin");

  const { data: setting } = await supabase
    .from("account_settings")
    .select(
      "work_lat, home_lat, trip_definition_type, trip_threshold_hours, trip_threshold_km, business_hours_enabled, business_hours_start, business_hours_end",
    )
    .eq("account_id", id)
    .maybeSingle();
  const onboarded = setting?.work_lat != null && setting?.home_lat != null;

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const monthStartStr = monthStart.toISOString().slice(0, 10);

  const { data: monthTrips } = await supabase
    .from("trips")
    .select(
      "id, date, destination_label, visited_areas, depart_ts, return_ts, total_minutes, max_distance_km, purpose, is_excluded, excluded_reason",
    )
    .eq("account_id", id)
    .gte("date", monthStartStr)
    .order("date", { ascending: false });

  const visibleTrips = (monthTrips ?? []).filter((t) => !t.is_excluded);
  const totalHours = visibleTrips.reduce(
    (sum, t) => sum + t.total_minutes / 60,
    0,
  );
  const totalMaxDist =
    visibleTrips.length > 0
      ? Math.max(...visibleTrips.map((t) => t.max_distance_km ?? 0))
      : 0;

  const ymLabel = `${new Date().getFullYear()}年${
    new Date().getMonth() + 1
  }月`;

  return (
    <main className="container page">
      <div className="breadcrumb">
        <a href={`/admin/accounts/${id}`}>
          <ArrowLeftIcon
            size={12}
            style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }}
          />
          {account.name} のアカウント詳細
        </a>
      </div>

      <header className="page-header">
        <div>
          <p
            className="text-xs"
            style={{
              color: "var(--bright-blue)",
              fontWeight: 700,
              letterSpacing: "0.08em",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              marginBottom: 4,
            }}
          >
            <EyeIcon size={12} /> 運営者として閲覧中
          </p>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--space-3)",
              flexWrap: "wrap",
            }}
          >
            <h1 className="page-title">{account.name} のダッシュボード</h1>
            <StatusPill status={account.status} />
          </div>
          <p className="page-subtitle">
            {account.email} ・ {account.company_name}
          </p>
        </div>
      </header>

      {/* 警告: 未オンボーディング */}
      {!onboarded && (
        <div
          className="alert alert-warning"
          style={{ marginBottom: "var(--space-6)" }}
        >
          <AlertTriangleIcon
            size={20}
            style={{ flexShrink: 0, marginTop: 2 }}
          />
          <div>
            <strong>このユーザーは初期設定が未完了です</strong>
            <p style={{ marginTop: 4, lineHeight: 1.7 }}>
              自宅 or 勤務地が未設定のため、自動判定が動いていません。
            </p>
          </div>
        </div>
      )}

      {/* KPI */}
      <section
        className="grid grid-3 kpi-grid"
        style={{ marginBottom: "var(--space-6)" }}
      >
        <div className="card">
          <p className="stat-label">{ymLabel}の出張回数</p>
          <p className="stat-value">
            {visibleTrips.length}
            <span className="stat-suffix">件</span>
          </p>
        </div>
        <div className="card">
          <p className="stat-label">{ymLabel}の累計滞在時間</p>
          <p className="stat-value">
            {totalHours.toFixed(1)}
            <span className="stat-suffix">h</span>
          </p>
        </div>
        <div className="card">
          <p className="stat-label">最大距離</p>
          <p className="stat-value">
            {totalMaxDist.toFixed(1)}
            <span className="stat-suffix">km</span>
          </p>
        </div>
      </section>

      {/* 設定サマリ */}
      {setting && (
        <div
          className="card card-flat setting-summary"
          style={{
            marginBottom: "var(--space-6)",
            padding: "var(--space-3) var(--space-5)",
            background: "var(--surface-muted)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "var(--space-4)",
          }}
        >
          <div
            className="text-sm text-light"
            style={{
              display: "flex",
              gap: "var(--space-5)",
              flexWrap: "wrap",
            }}
          >
            <span>
              判定:{" "}
              <strong className="text-strong">
                {setting.trip_definition_type === "hours"
                  ? `時間 ${setting.trip_threshold_hours}h`
                  : `距離 ${setting.trip_threshold_km}km`}
              </strong>
            </span>
            <span>
              業務時間:{" "}
              <strong className="text-strong">
                {setting.business_hours_enabled
                  ? `${String(setting.business_hours_start).slice(0, 5)} - ${String(setting.business_hours_end).slice(0, 5)}`
                  : "設定なし（24時間）"}
              </strong>
            </span>
          </div>
        </div>
      )}

      {/* Trip 一覧（read-only） */}
      <section className="card" style={{ padding: 0 }}>
        <div className="card-header">
          <span>{ymLabel}の出張一覧</span>
          <span className="text-muted text-xs">
            {monthTrips?.length ?? 0} 件（除外含む・閲覧のみ）
          </span>
        </div>
        {monthTrips && monthTrips.length > 0 ? (
          <>
            {/* Desktop */}
            <div className="trip-table-wrap" style={{ overflowX: "auto" }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>日付</th>
                    <th>出張先</th>
                    <th>出発</th>
                    <th>帰着</th>
                    <th
                      className="num"
                      title="現地での滞在時間（移動時間除く）"
                    >
                      滞在時間
                    </th>
                    <th className="num">最大距離</th>
                    <th>目的</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {monthTrips.map((t: Trip) => (
                    <ReadOnlyTripRow key={t.id} trip={t} />
                  ))}
                </tbody>
              </table>
            </div>
            {/* Mobile */}
            <div
              className="trip-card-list"
              style={{ padding: "var(--space-3)" }}
            >
              {monthTrips.map((t: Trip) => (
                <ReadOnlyTripCard key={t.id} trip={t} />
              ))}
            </div>
          </>
        ) : (
          <div
            style={{
              padding: "var(--space-12) var(--space-6)",
              textAlign: "center",
              color: "var(--text-muted)",
            }}
          >
            <p>{ymLabel}の出張はまだありません。</p>
          </div>
        )}
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

function jsDow(yyyymmdd: string): string {
  const d = new Date(yyyymmdd + "T00:00:00+09:00");
  return ["日", "月", "火", "水", "木", "金", "土"][d.getDay()];
}

function ReadOnlyTripRow({ trip }: { trip: Trip }) {
  const cellStyle: React.CSSProperties = {
    opacity: trip.is_excluded ? 0.5 : 1,
    textDecoration: trip.is_excluded ? "line-through" : "none",
  };
  return (
    <tr>
      <td style={cellStyle} className="tabular">
        {trip.date}
      </td>
      <td style={cellStyle}>{trip.destination_label ?? "—"}</td>
      <td style={cellStyle} className="tabular">
        {formatHHMM(trip.depart_ts)}
      </td>
      <td style={cellStyle} className="tabular">
        {formatHHMM(trip.return_ts)}
      </td>
      <td style={cellStyle} className="num">
        {(trip.total_minutes / 60).toFixed(1)}h
      </td>
      <td style={cellStyle} className="num">
        {trip.max_distance_km != null
          ? `${trip.max_distance_km.toFixed(1)}km`
          : "—"}
      </td>
      <td style={cellStyle}>{trip.purpose}</td>
      <td style={{ textAlign: "right" }}>
        <a
          href={`/dashboard/trips/${trip.id}`}
          className="btn btn-ghost btn-sm"
        >
          詳細
          <ChevronRightIcon size={12} />
        </a>
      </td>
    </tr>
  );
}

function ReadOnlyTripCard({ trip }: { trip: Trip }) {
  return (
    <article
      className={`trip-card ${trip.is_excluded ? "trip-card-excluded" : ""}`}
    >
      <div className="trip-card-head">
        <span className="trip-card-date">
          {trip.date} ({jsDow(trip.date)})
        </span>
        <a
          href={`/dashboard/trips/${trip.id}`}
          className="btn btn-ghost btn-sm"
          aria-label="詳細"
          style={{ padding: "0 8px", minHeight: 32 }}
        >
          詳細
          <ChevronRightIcon size={12} />
        </a>
      </div>
      <div
        className="trip-card-dest"
        style={{
          textDecoration: trip.is_excluded ? "line-through" : "none",
        }}
      >
        {trip.destination_label ?? "—"}
      </div>
      <div className="trip-card-meta">
        <span className="trip-card-meta-item">
          <strong>
            {formatHHMM(trip.depart_ts)} – {formatHHMM(trip.return_ts)}
          </strong>
        </span>
        <span className="trip-card-meta-item">
          滞在 <strong>{(trip.total_minutes / 60).toFixed(1)}h</strong>
        </span>
        <span className="trip-card-meta-item">
          最大{" "}
          <strong>
            {trip.max_distance_km != null
              ? `${trip.max_distance_km.toFixed(1)}km`
              : "—"}
          </strong>
        </span>
      </div>
      {trip.is_excluded && trip.excluded_reason && (
        <div
          className="text-xs text-muted"
          style={{
            paddingTop: "var(--space-2)",
            borderTop: "1px dashed var(--border)",
          }}
        >
          除外理由: {trip.excluded_reason}
        </div>
      )}
    </article>
  );
}
