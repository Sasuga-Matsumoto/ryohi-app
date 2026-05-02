import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/supabase/admin-guard";
import { createClient } from "@/lib/supabase/server";
import AccountActions from "./AccountActions";
import {
  ArrowLeftIcon,
  UserIcon,
  ListIcon,
  SettingsIcon,
} from "@/components/Icon";
import StatusPill from "@/components/StatusPill";

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
      "id, email, name, company_name, role, status, suspended_at, suspended_reason, created_at",
    )
    .eq("id", id)
    .maybeSingle();

  if (!account) {
    redirect("/admin");
  }

  const { data: setting } = await supabase
    .from("account_settings")
    .select(
      "trip_definition_type, trip_threshold_hours, trip_threshold_km, business_hours_enabled, business_hours_start, business_hours_end, include_holidays, include_weekends, work_lat, home_lat",
    )
    .eq("account_id", id)
    .maybeSingle();

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const { count: monthTripCount } = await supabase
    .from("trips")
    .select("*", { count: "exact", head: true })
    .eq("account_id", id)
    .gte("date", monthStart.toISOString().slice(0, 10))
    .eq("is_excluded", false);

  const { count: totalTripCount } = await supabase
    .from("trips")
    .select("*", { count: "exact", head: true })
    .eq("account_id", id);

  const onboarded = setting?.work_lat != null && setting?.home_lat != null;
  const createdLabel = new Date(account.created_at).toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <main className="container page">
      <div className="breadcrumb">
        <a href="/admin">
          <ArrowLeftIcon
            size={12}
            style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }}
          />
          Admin Console
        </a>
      </div>

      <header className="page-header">
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--space-3)",
              flexWrap: "wrap",
            }}
          >
            <h1 className="page-title">{account.name}</h1>
            <StatusPill status={account.status} />
          </div>
          <p className="page-subtitle">
            {account.email} ・ {account.company_name}
          </p>
        </div>
      </header>

      {/* 利用状況 KPI */}
      <section
        className="kpi-inline"
        style={{ marginBottom: "var(--space-6)" }}
      >
        <div className="kpi-inline-item">
          <p className="kpi-inline-label">オンボーディング</p>
          <p className="kpi-inline-value">
            {onboarded ? (
              <span style={{ color: "var(--success)" }}>完了</span>
            ) : (
              <span style={{ color: "var(--warning)" }}>未完了</span>
            )}
          </p>
        </div>
        <div className="kpi-inline-item">
          <p className="kpi-inline-label">当月の出張</p>
          <p className="kpi-inline-value">
            {monthTripCount ?? 0}
            <span className="kpi-inline-value-suffix">件</span>
          </p>
        </div>
        <div className="kpi-inline-item">
          <p className="kpi-inline-label">累計の出張</p>
          <p className="kpi-inline-value">
            {totalTripCount ?? 0}
            <span className="kpi-inline-value-suffix">件</span>
          </p>
        </div>
        <div className="kpi-inline-item">
          <p className="kpi-inline-label">利用開始</p>
          <p
            className="kpi-inline-value"
            style={{ fontSize: "var(--text-base)", fontWeight: 600 }}
          >
            {createdLabel}
          </p>
        </div>
      </section>

      <div className="page-cols page-cols-2-1">
        {/* 左: 基本情報 + 設定 */}
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          <section className="card">
            <h2
              className="section-title"
              style={{ display: "flex", alignItems: "center", gap: 8 }}
            >
              <UserIcon size={18} /> 基本情報
            </h2>
            <dl className="def-list">
              <dt>ID</dt>
              <dd>
                <span className="text-mono">{account.id}</span>
              </dd>
              <dt>氏名</dt>
              <dd>{account.name}</dd>
              <dt>メール</dt>
              <dd>{account.email}</dd>
              <dt>会社名</dt>
              <dd>{account.company_name}</dd>
              <dt>ロール</dt>
              <dd>{account.role}</dd>
              <dt>状態</dt>
              <dd>
                <StatusPill status={account.status} />
                {account.status === "suspended" && account.suspended_at && (
                  <span
                    className="text-xs text-muted"
                    style={{ display: "block", marginTop: 4 }}
                  >
                    {new Date(account.suspended_at).toLocaleDateString("ja-JP")}
                    {account.suspended_reason && ` ・ ${account.suspended_reason}`}
                  </span>
                )}
              </dd>
              <dt>利用開始</dt>
              <dd>{createdLabel}</dd>
            </dl>
          </section>

          {setting && (
            <section className="card">
              <h2
                className="section-title"
                style={{ display: "flex", alignItems: "center", gap: 8 }}
              >
                <SettingsIcon size={18} /> 判定設定
              </h2>
              <dl className="def-list">
                <dt>出張定義</dt>
                <dd>
                  {setting.trip_definition_type === "hours"
                    ? `時間モード ${setting.trip_threshold_hours}h 以上`
                    : `距離モード ${setting.trip_threshold_km}km 以上`}
                </dd>
                <dt>業務時間</dt>
                <dd>
                  {setting.business_hours_enabled
                    ? `${setting.business_hours_start} - ${setting.business_hours_end}`
                    : "設定なし（24時間）"}
                </dd>
                <dt>休日</dt>
                <dd>
                  {setting.include_weekends ? "土日含む" : "土日除外"}{" "}
                  ・{" "}
                  {setting.include_holidays ? "祝日含む" : "祝日除外"}
                </dd>
              </dl>
            </section>
          )}
        </div>

        {/* 右: 操作 */}
        <div className="card" style={{ alignSelf: "start" }}>
          <h2
            className="section-title"
            style={{ display: "flex", alignItems: "center", gap: 8 }}
          >
            <ListIcon size={18} /> 操作
          </h2>
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
