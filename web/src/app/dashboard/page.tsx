import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import DevControls from "./DevControls";
import TripRow from "./TripRow";
import TripCard from "./TripCard";
import { AlertTriangleIcon, SettingsIcon, RefreshIcon } from "@/components/Icon";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: account } = await supabase
    .from("accounts")
    .select("name, company_name, role, status")
    .eq("id", user.id)
    .maybeSingle();

  if (!account) {
    return (
      <main className="container page">
        <div className="card" style={{ maxWidth: 560, margin: "0 auto" }}>
          <h1 className="page-title">アカウント情報がありません</h1>
          <p className="text-light" style={{ marginTop: "var(--space-3)" }}>
            運営者に連絡してください。
          </p>
        </div>
      </main>
    );
  }

  if (account.status !== "active") {
    return (
      <main className="container page">
        <div className="card" style={{ maxWidth: 560, margin: "0 auto" }}>
          <h1 className="page-title text-danger">利用停止中です</h1>
          <p className="text-light" style={{ marginTop: "var(--space-3)" }}>
            運営者にお問い合わせください。
          </p>
        </div>
      </main>
    );
  }

  // 設定取得
  const { data: setting } = await supabase
    .from("account_settings")
    .select(
      "work_lat, home_lat, trip_definition_type, trip_threshold_hours, trip_threshold_km, business_hours_enabled, business_hours_start, business_hours_end"
    )
    .eq("account_id", user.id)
    .maybeSingle();
  const onboarded = setting?.work_lat != null && setting?.home_lat != null;

  // 当月 Trip
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const monthStartStr = monthStart.toISOString().slice(0, 10);

  const { data: monthTrips } = await supabase
    .from("trips")
    .select(
      "id, date, destination_label, visited_areas, depart_ts, return_ts, total_minutes, max_distance_km, purpose, is_excluded, excluded_reason"
    )
    .eq("account_id", user.id)
    .gte("date", monthStartStr)
    .order("date", { ascending: false });

  const visibleTrips = monthTrips?.filter((t) => !t.is_excluded) ?? [];
  const totalHours = visibleTrips.reduce((sum, t) => sum + t.total_minutes / 60, 0);
  const totalMaxDist =
    visibleTrips.length > 0
      ? Math.max(...visibleTrips.map((t) => t.max_distance_km ?? 0))
      : 0;

  const ymLabel = `${new Date().getFullYear()}年${new Date().getMonth() + 1}月`;

  return (
    <main className="container page">
      <header className="page-header">
        <div>
          <h1 className="page-title">ダッシュボード</h1>
          <p className="page-subtitle">
            こんにちは、{account.name} さん（{account.company_name}）
          </p>
        </div>
      </header>

      {/* 設定未完了アラート */}
      {!onboarded && (
        <div className="alert alert-warning" style={{ marginBottom: "var(--space-6)" }}>
          <AlertTriangleIcon size={20} style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            <strong>初期設定が未完了です</strong>
            <p style={{ marginTop: 4, lineHeight: 1.7 }}>
              自動判定を始めるには、
              <a href="/dashboard/settings" style={{ fontWeight: 600 }}>
                設定ページ
              </a>
              で <strong>自宅と勤務地</strong>を登録してください。
            </p>
          </div>
        </div>
      )}

      {/* サマリ KPI */}
      <section className="grid grid-3 kpi-grid" style={{ marginBottom: "var(--space-6)" }}>
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

      {/* 設定サマリ（小） */}
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
          <div className="text-sm text-light" style={{ display: "flex", gap: "var(--space-5)", flexWrap: "wrap" }}>
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
          <a
            href="/dashboard/settings"
            className="btn btn-ghost btn-sm"
          >
            <SettingsIcon size={14} />
            設定を変更
          </a>
        </div>
      )}

      {/* Trip 一覧 */}
      <section style={{ marginBottom: "var(--space-6)" }}>
        <div className="card" style={{ padding: 0 }}>
          <div className="card-header">
            <span>{ymLabel}の出張一覧</span>
            <span className="text-muted text-xs">
              {monthTrips?.length ?? 0} 件（除外含む）
            </span>
          </div>
          <div>
            {monthTrips && monthTrips.length > 0 ? (
              <>
                {/* Desktop: table */}
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
                        <th>操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {monthTrips.map((t) => (
                        <TripRow key={t.id} trip={t} />
                      ))}
                    </tbody>
                  </table>
                </div>
                {/* Mobile: cards */}
                <div
                  className="trip-card-list"
                  style={{ padding: "var(--space-3)" }}
                >
                  {monthTrips.map((t) => (
                    <TripCard key={t.id} trip={t} />
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
                {!onboarded && (
                  <p style={{ marginTop: "var(--space-2)" }}>
                    先に
                    <a href="/dashboard/settings">設定</a>
                    を完了してください。
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 開発コントロール */}
      {onboarded && (
        <section className="card" style={{ background: "var(--info-bg)", borderColor: "var(--light-blue)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", marginBottom: "var(--space-3)" }}>
            <RefreshIcon size={18} />
            <h2 className="section-title" style={{ marginBottom: 0 }}>開発コントロール</h2>
          </div>
          <p className="text-sm text-muted" style={{ marginBottom: "var(--space-4)", lineHeight: 1.7 }}>
            実機 GPS の代わりにモック滞在ノードを投入して、判定を試せます。
            （モバイルアプリ実装前の動作確認用）
          </p>
          <DevControls
            workLat={setting?.work_lat ?? 35.681}
            workLng={(setting as { work_lng?: number })?.work_lng ?? 139.766}
            homeLat={setting?.home_lat ?? 35.625}
            homeLng={(setting as { home_lng?: number })?.home_lng ?? 139.725}
          />
        </section>
      )}
    </main>
  );
}
