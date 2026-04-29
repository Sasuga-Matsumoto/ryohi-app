import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/supabase/admin-guard";
import { createClient } from "@/lib/supabase/server";
import AccountActions from "./AccountActions";
import { ArrowLeftIcon } from "@/components/Icon";

export default async function AccountDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const supabase = await createClient();

  const { data: account } = await supabase
    .from("accounts")
    .select(
      "id, email, name, company_name, role, status, suspended_at, suspended_reason, created_at"
    )
    .eq("id", id)
    .maybeSingle();

  if (!account) {
    redirect("/admin");
  }

  // 設定取得
  const { data: setting } = await supabase
    .from("account_settings")
    .select(
      "trip_definition_type, trip_threshold_hours, trip_threshold_km, business_hours_start, business_hours_end, include_holidays, include_weekends, work_lat, home_lat"
    )
    .eq("account_id", id)
    .maybeSingle();

  // 当月 Trip 件数
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const { count: monthTripCount } = await supabase
    .from("trips")
    .select("*", { count: "exact", head: true })
    .eq("account_id", id)
    .gte("date", monthStart.toISOString().slice(0, 10))
    .eq("is_excluded", false);

  // 累計
  const { count: totalTripCount } = await supabase
    .from("trips")
    .select("*", { count: "exact", head: true })
    .eq("account_id", id);

  const onboarded = setting?.work_lat != null && setting?.home_lat != null;

  const statusLabel = (s: string) => {
    if (s === "active") return "✓ アクティブ";
    if (s === "suspended") return "🔴 停止中";
    return "⚫ 削除済";
  };
  const statusColor = (s: string) => {
    if (s === "active") return "var(--success)";
    if (s === "suspended") return "var(--warning)";
    return "var(--gray)";
  };

  return (
    <main className="container page">
      <div className="breadcrumb">
        <a href="/admin">
          <ArrowLeftIcon size={12} style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }} />
          Admin Console
        </a>
      </div>
      <header className="page-header">
        <div>
          <h1 className="page-title">{account.name}</h1>
          <p className="page-subtitle">{account.email} / {account.company_name}</p>
        </div>
      </header>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "2fr 1fr",
          gap: 20,
        }}
      >
        {/* 左: 基本情報 + 利用状況 */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <section className="card">
            <h2 style={{ fontSize: "1rem", marginBottom: 12 }}>基本情報</h2>
            <dl
              style={{
                display: "grid",
                gridTemplateColumns: "120px 1fr",
                rowGap: 10,
                fontSize: "0.9rem",
              }}
            >
              <dt style={{ color: "var(--text-light)" }}>ID</dt>
              <dd style={{ fontFamily: "monospace", fontSize: "0.8rem" }}>
                {account.id}
              </dd>
              <dt style={{ color: "var(--text-light)" }}>氏名</dt>
              <dd>{account.name}</dd>
              <dt style={{ color: "var(--text-light)" }}>メール</dt>
              <dd>{account.email}</dd>
              <dt style={{ color: "var(--text-light)" }}>会社名</dt>
              <dd>{account.company_name}</dd>
              <dt style={{ color: "var(--text-light)" }}>ロール</dt>
              <dd>{account.role}</dd>
              <dt style={{ color: "var(--text-light)" }}>状態</dt>
              <dd style={{ color: statusColor(account.status), fontWeight: 600 }}>
                {statusLabel(account.status)}
                {account.status === "suspended" && account.suspended_at && (
                  <span
                    style={{
                      marginLeft: 8,
                      color: "var(--text-light)",
                      fontWeight: 400,
                      fontSize: "0.85rem",
                    }}
                  >
                    （{new Date(account.suspended_at).toLocaleDateString("ja-JP")}
                    {account.suspended_reason && ` / ${account.suspended_reason}`}）
                  </span>
                )}
              </dd>
              <dt style={{ color: "var(--text-light)" }}>利用開始</dt>
              <dd>{new Date(account.created_at).toLocaleDateString("ja-JP")}</dd>
            </dl>
          </section>

          <section className="card">
            <h2 style={{ fontSize: "1rem", marginBottom: 12 }}>利用状況</h2>
            <dl
              style={{
                display: "grid",
                gridTemplateColumns: "120px 1fr",
                rowGap: 10,
                fontSize: "0.9rem",
              }}
            >
              <dt style={{ color: "var(--text-light)" }}>オンボーディング</dt>
              <dd>{onboarded ? "✓ 完了" : "未完了"}</dd>
              <dt style={{ color: "var(--text-light)" }}>当月の出張</dt>
              <dd>{monthTripCount ?? 0} 件</dd>
              <dt style={{ color: "var(--text-light)" }}>累計の出張</dt>
              <dd>{totalTripCount ?? 0} 件</dd>
              {setting && (
                <>
                  <dt style={{ color: "var(--text-light)" }}>出張定義</dt>
                  <dd>
                    {setting.trip_definition_type === "hours"
                      ? `時間モード ${setting.trip_threshold_hours}h`
                      : `距離モード ${setting.trip_threshold_km}km`}
                  </dd>
                  <dt style={{ color: "var(--text-light)" }}>業務時間</dt>
                  <dd>
                    {setting.business_hours_start} - {setting.business_hours_end}
                  </dd>
                  <dt style={{ color: "var(--text-light)" }}>休日</dt>
                  <dd>
                    {setting.include_weekends ? "土日含む" : "土日除外"} /{" "}
                    {setting.include_holidays ? "祝日含む" : "祝日除外"}
                  </dd>
                </>
              )}
            </dl>
          </section>
        </div>

        {/* 右: 操作 */}
        <div className="card" style={{ alignSelf: "start" }}>
          <h2 style={{ fontSize: "1rem", marginBottom: 12 }}>操作</h2>
          <AccountActions
            accountId={account.id}
            accountName={account.name}
            status={account.status}
          />
        </div>
      </div>
    </main>
  );
}
