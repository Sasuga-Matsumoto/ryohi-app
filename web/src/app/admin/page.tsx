import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  PlusIcon,
  ListIcon,
  UsersIcon,
  ChevronRightIcon,
  ShieldIcon,
} from "@/components/Icon";

export default async function AdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: account } = await supabase
    .from("accounts")
    .select("role, status")
    .eq("id", user.id)
    .maybeSingle();

  if (!account || account.role !== "admin" || account.status !== "active") {
    return (
      <main className="container page">
        <div className="card" style={{ maxWidth: 560, margin: "0 auto" }}>
          <h1 className="page-title text-danger">アクセス権がありません</h1>
          <p className="text-light" style={{ marginTop: "var(--space-3)" }}>
            Admin Console は運営者専用です。
          </p>
        </div>
      </main>
    );
  }

  const { data: accounts } = await supabase
    .from("accounts")
    .select("id, email, name, company_name, role, status, created_at")
    .order("created_at", { ascending: false });

  const summary = {
    total: accounts?.length ?? 0,
    active: accounts?.filter((a) => a.status === "active").length ?? 0,
    suspended: accounts?.filter((a) => a.status === "suspended").length ?? 0,
    deleted: accounts?.filter((a) => a.status === "deleted").length ?? 0,
  };

  const statusBadge = (status: string) => {
    const cls =
      status === "active"
        ? "badge-active"
        : status === "suspended"
          ? "badge-suspended"
          : "badge-deleted";
    const label =
      status === "active" ? "アクティブ" : status === "suspended" ? "停止中" : "削除済";
    return <span className={`badge ${cls}`}>{label}</span>;
  };

  return (
    <main className="container page">
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
            <ShieldIcon size={12} /> ADMIN CONSOLE
          </p>
          <h1 className="page-title">運営ダッシュボード</h1>
          <p className="page-subtitle">アカウントの発行・停止・削除と監査ログ管理</p>
        </div>
        <nav className="row">
          <a href="/admin/audit-log" className="btn btn-secondary">
            <ListIcon size={14} />
            監査ログ
          </a>
          <a href="/admin/accounts/new" className="btn btn-primary">
            <PlusIcon size={14} />
            新規発行
          </a>
        </nav>
      </header>

      {/* サマリ */}
      <section className="grid grid-4" style={{ marginBottom: "var(--space-6)" }}>
        <div className="card">
          <p className="stat-label">全顧客</p>
          <p className="stat-value">{summary.total}</p>
        </div>
        <div className="card">
          <p className="stat-label">アクティブ</p>
          <p className="stat-value text-success">{summary.active}</p>
        </div>
        <div className="card">
          <p className="stat-label">停止中</p>
          <p className="stat-value text-warning">{summary.suspended}</p>
        </div>
        <div className="card">
          <p className="stat-label">削除済</p>
          <p className="stat-value text-muted">{summary.deleted}</p>
        </div>
      </section>

      {/* 一覧 */}
      <section className="card" style={{ padding: 0 }}>
        <div className="card-header">
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <UsersIcon size={16} /> アカウント一覧
          </span>
          <span className="text-muted text-xs">{summary.total} 件</span>
        </div>
        <div style={{ overflowX: "auto" }}>
          {accounts && accounts.length > 0 ? (
            <table className="table">
              <thead>
                <tr>
                  <th>氏名</th>
                  <th>メール</th>
                  <th>会社</th>
                  <th>ロール</th>
                  <th>状態</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((a) => (
                  <tr key={a.id}>
                    <td><strong>{a.name}</strong></td>
                    <td className="text-muted">{a.email}</td>
                    <td>{a.company_name}</td>
                    <td className="text-sm text-muted">{a.role}</td>
                    <td>{statusBadge(a.status)}</td>
                    <td style={{ textAlign: "right" }}>
                      <a href={`/admin/accounts/${a.id}`} className="btn btn-ghost btn-sm">
                        詳細
                        <ChevronRightIcon size={12} />
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div
              style={{
                padding: "var(--space-12) var(--space-6)",
                textAlign: "center",
                color: "var(--text-muted)",
              }}
            >
              <p>アカウントがまだありません</p>
              <a
                href="/admin/accounts/new"
                className="btn btn-primary"
                style={{ marginTop: "var(--space-4)" }}
              >
                <PlusIcon size={14} />
                最初のアカウントを発行
              </a>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
