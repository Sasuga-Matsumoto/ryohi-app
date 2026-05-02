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
      "id, email, name, company_name, role, status, suspended_at, suspended_reason, created_at, last_mobile_status, last_health_check_at",
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

  // 自宅・勤務地ステータス
  const homeSet = setting?.home_lat != null;
  const workSet = setting?.work_lat != null;
  const placeStatus: {
    label: string;
    tone: "success" | "warning" | "danger";
  } =
    homeSet && workSet
      ? { label: "設定済", tone: "success" }
      : !homeSet && !workSet
        ? { label: "自宅・勤務地未設定", tone: "danger" }
        : !homeSet
          ? { label: "自宅未設定", tone: "warning" }
          : { label: "勤務地未設定", tone: "warning" };

  // 位置情報ステータス（モバイル報告ベース）
  const lastStatus = account.last_mobile_status as
    | "services_off"
    | "no_permission"
    | "fg_only"
    | "no_setting"
    | "ready"
    | null;
  const permissionStatus: {
    label: string;
    tone: "success" | "warning" | "danger" | "muted";
  } = !lastStatus
    ? { label: "未報告", tone: "muted" }
    : lastStatus === "services_off"
      ? { label: "端末未許可", tone: "danger" }
      : lastStatus === "no_permission" || lastStatus === "fg_only"
        ? { label: "アプリ未許可", tone: "warning" }
        : { label: "許可済", tone: "success" };

  const toneColor = (
    t: "success" | "warning" | "danger" | "muted",
  ): string =>
    ({
      success: "var(--success)",
      warning: "var(--warning)",
      danger: "var(--danger)",
      muted: "var(--text-muted)",
    })[t];

  const lastCheckLabel = account.last_health_check_at
    ? formatRelative(account.last_health_check_at)
    : null;

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
          <p className="kpi-inline-label">自宅・勤務地</p>
          <p
            className="kpi-inline-value"
            style={{
              fontSize: "var(--text-base)",
              fontWeight: 700,
              color: toneColor(placeStatus.tone),
            }}
          >
            {placeStatus.label}
          </p>
        </div>
        <div className="kpi-inline-item">
          <p className="kpi-inline-label">位置情報</p>
          <p
            className="kpi-inline-value"
            style={{
              fontSize: "var(--text-base)",
              fontWeight: 700,
              color: toneColor(permissionStatus.tone),
            }}
          >
            {permissionStatus.label}
          </p>
          {lastCheckLabel && (
            <p
              className="text-xs text-muted"
              style={{ marginTop: 2 }}
              title={new Date(account.last_health_check_at!).toLocaleString("ja-JP")}
            >
              {lastCheckLabel}
            </p>
          )}
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

function formatRelative(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return "たった今";
  if (min < 60) return `${min} 分前`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour} 時間前`;
  const day = Math.floor(hour / 24);
  if (day < 30) return `${day} 日前`;
  const month = Math.floor(day / 30);
  if (month < 12) return `${month} ヶ月前`;
  return `${Math.floor(month / 12)} 年前`;
}
