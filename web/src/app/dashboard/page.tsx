import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import DevControls from "./DevControls";
import TripRow from "./TripRow";

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
      <main className="container" style={{ padding: "60px 20px" }}>
        <div className="card" style={{ maxWidth: 560, margin: "0 auto" }}>
          <h1 style={{ fontSize: "1.3rem", color: "var(--dark-blue)" }}>
            アカウント情報がありません
          </h1>
          <p style={{ color: "var(--text-light)", marginTop: 12 }}>
            運営者に連絡してください。
          </p>
        </div>
      </main>
    );
  }

  if (account.status !== "active") {
    return (
      <main className="container" style={{ padding: "60px 20px" }}>
        <div className="card" style={{ maxWidth: 560, margin: "0 auto" }}>
          <h1 style={{ fontSize: "1.3rem", color: "var(--danger)" }}>
            利用停止中です
          </h1>
          <p style={{ color: "var(--text-light)", marginTop: 12 }}>
            運営者にお問い合わせください。
          </p>
        </div>
      </main>
    );
  }

  // 設定取得
  const { data: setting } = await supabase
    .from("account_settings")
    .select("work_lat, home_lat, trip_definition_type, trip_threshold_hours, trip_threshold_km, business_hours_start, business_hours_end")
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
    .select("id, date, destination_label, visited_areas, depart_ts, return_ts, total_minutes, max_distance_km, purpose, is_excluded, excluded_reason")
    .eq("account_id", user.id)
    .gte("date", monthStartStr)
    .order("date", { ascending: false });

  const visibleTrips = monthTrips?.filter((t) => !t.is_excluded) ?? [];
  const totalHours = visibleTrips.reduce((sum, t) => sum + t.total_minutes / 60, 0);

  return (
    <main className="container" style={{ padding: "40px 20px" }}>
      {/* ヘッダー */}
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: 28,
        }}
      >
        <div>
          <h1
            style={{
              fontSize: "1.6rem",
              color: "var(--dark-blue)",
              marginBottom: 4,
            }}
          >
            こんにちは、{account.name} さん
          </h1>
          <p style={{ color: "var(--text-light)", fontSize: "0.9rem" }}>
            {account.company_name}
          </p>
        </div>
        <nav style={{ display: "flex", gap: 12 }}>
          <a href="/dashboard/settings" className="btn btn-secondary">
            設定
          </a>
          {account.role === "admin" && (
            <a href="/admin" className="btn btn-secondary">
              Admin Console
            </a>
          )}
          <form action="/auth/signout" method="post">
            <button type="submit" className="btn btn-secondary">
              ログアウト
            </button>
          </form>
        </nav>
      </header>

      {/* 設定状態 */}
      {!onboarded && (
        <div
          className="card"
          style={{
            background: "#FEF3C7",
            border: "1px solid #FCD34D",
            marginBottom: 20,
          }}
        >
          <strong>⚠ 初期設定が未完了です</strong>
          <p style={{ marginTop: 8, fontSize: "0.9rem", lineHeight: 1.7 }}>
            自動判定を始めるには、<a href="/dashboard/settings">設定ページ</a>で
            <strong>自宅と勤務地の座標</strong>を登録してください。
          </p>
        </div>
      )}

      {/* サマリ */}
      <section
        className="card"
        style={{ marginBottom: 20 }}
      >
        <h2 style={{ fontSize: "1.05rem", marginBottom: 12 }}>今月の出張</h2>
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
          <div>
            <p style={{ fontSize: "0.85rem", color: "var(--text-light)" }}>
              出張回数
            </p>
            <p
              style={{
                fontSize: "2rem",
                fontWeight: 700,
                color: "var(--dark-blue)",
              }}
            >
              {visibleTrips.length}
              <span style={{ fontSize: "0.9rem", marginLeft: 4 }}>件</span>
            </p>
          </div>
          <div>
            <p style={{ fontSize: "0.85rem", color: "var(--text-light)" }}>
              累計時間
            </p>
            <p
              style={{
                fontSize: "2rem",
                fontWeight: 700,
                color: "var(--dark-blue)",
              }}
            >
              {totalHours.toFixed(1)}
              <span style={{ fontSize: "0.9rem", marginLeft: 4 }}>h</span>
            </p>
          </div>
          {setting && (
            <div style={{ marginLeft: "auto", fontSize: "0.85rem", color: "var(--text-light)" }}>
              <p>
                判定:{" "}
                {setting.trip_definition_type === "hours"
                  ? `時間 ${setting.trip_threshold_hours}h`
                  : `距離 ${setting.trip_threshold_km}km`}
              </p>
              <p>
                業務時間:{" "}
                {String(setting.business_hours_start).slice(0, 5)} -{" "}
                {String(setting.business_hours_end).slice(0, 5)}
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Trip 一覧 */}
      <section className="card" style={{ padding: 0, overflow: "hidden", marginBottom: 20 }}>
        <div style={{ padding: "16px 24px", borderBottom: "1px solid #E5E7EB", fontWeight: 600 }}>
          今月の Trip 一覧
        </div>
        {monthTrips && monthTrips.length > 0 ? (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
            <thead style={{ background: "#F9FAFB" }}>
              <tr>
                <th style={{ padding: 12, textAlign: "left" }}>日付</th>
                <th style={{ padding: 12, textAlign: "left" }}>出張先</th>
                <th style={{ padding: 12, textAlign: "left" }}>出発</th>
                <th style={{ padding: 12, textAlign: "left" }}>帰着</th>
                <th style={{ padding: 12, textAlign: "right" }}>時間</th>
                <th style={{ padding: 12, textAlign: "right" }}>最大距離</th>
                <th style={{ padding: 12, textAlign: "left" }}>目的</th>
                <th style={{ padding: 12, textAlign: "left" }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {monthTrips.map((t) => (
                <TripRow key={t.id} trip={t} />
              ))}
            </tbody>
          </table>
        ) : (
          <p style={{ padding: 24, color: "var(--text-light)" }}>
            今月の Trip はまだありません。
            {!onboarded && " 先に設定を完了してください。"}
          </p>
        )}
      </section>

      {/* 開発コントロール */}
      {onboarded && (
        <section className="card" style={{ background: "#F0F9FF" }}>
          <h2 style={{ fontSize: "1.05rem", marginBottom: 4 }}>🛠 開発コントロール</h2>
          <p
            style={{
              fontSize: "0.8rem",
              color: "var(--text-light)",
              marginBottom: 12,
              lineHeight: 1.6,
            }}
          >
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
