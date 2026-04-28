import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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
      <main className="container" style={{ padding: "60px 20px" }}>
        <div className="card" style={{ maxWidth: 560, margin: "0 auto" }}>
          <h1 style={{ fontSize: "1.3rem", color: "var(--danger)" }}>
            アクセス権がありません
          </h1>
          <p style={{ color: "var(--text-light)", marginTop: 12 }}>
            Admin Console は運営者専用です。
          </p>
        </div>
      </main>
    );
  }

  // 全 Account を取得
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
    <main className="container" style={{ padding: "40px 20px" }}>
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 28,
        }}
      >
        <div>
          <p
            style={{
              fontSize: "0.8rem",
              color: "var(--text-light)",
              letterSpacing: "0.05em",
              marginBottom: 4,
            }}
          >
            ADMIN CONSOLE
          </p>
          <h1 style={{ fontSize: "1.5rem", color: "var(--dark-blue)" }}>
            運営ダッシュボード
          </h1>
        </div>
        <nav style={{ display: "flex", gap: 12 }}>
          <a href="/dashboard" className="btn btn-secondary">
            ダッシュボード
          </a>
          <a href="/admin/accounts/new" className="btn btn-primary">
            + 新規発行
          </a>
        </nav>
      </header>

      {/* サマリ */}
      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 16,
          marginBottom: 28,
        }}
      >
        {[
          { label: "全顧客", value: summary.total, color: "var(--dark-blue)" },
          { label: "アクティブ", value: summary.active, color: "#059669" },
          { label: "停止中", value: summary.suspended, color: "#D97706" },
          { label: "削除済", value: summary.deleted, color: "#6B7280" },
        ].map(({ label, value, color }) => (
          <div className="card" key={label}>
            <p style={{ fontSize: "0.85rem", color: "var(--text-light)" }}>
              {label}
            </p>
            <p
              style={{
                fontSize: "1.8rem",
                fontWeight: 700,
                color,
                marginTop: 4,
              }}
            >
              {value}
            </p>
          </div>
        ))}
      </section>

      {/* 一覧 */}
      <section className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div
          style={{
            padding: "16px 24px",
            borderBottom: "1px solid #E5E7EB",
            fontWeight: 600,
          }}
        >
          アカウント一覧
        </div>
        {accounts && accounts.length > 0 ? (
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: "0.9rem",
            }}
          >
            <thead style={{ background: "#F9FAFB" }}>
              <tr>
                <th style={{ padding: 12, textAlign: "left" }}>氏名</th>
                <th style={{ padding: 12, textAlign: "left" }}>メール</th>
                <th style={{ padding: 12, textAlign: "left" }}>会社</th>
                <th style={{ padding: 12, textAlign: "left" }}>ロール</th>
                <th style={{ padding: 12, textAlign: "left" }}>状態</th>
                <th style={{ padding: 12, textAlign: "right" }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((a) => (
                <tr key={a.id} style={{ borderTop: "1px solid #E5E7EB" }}>
                  <td style={{ padding: 12 }}>{a.name}</td>
                  <td style={{ padding: 12 }}>{a.email}</td>
                  <td style={{ padding: 12 }}>{a.company_name}</td>
                  <td style={{ padding: 12 }}>{a.role}</td>
                  <td style={{ padding: 12 }}>{statusBadge(a.status)}</td>
                  <td style={{ padding: 12, textAlign: "right" }}>
                    <a
                      href={`/admin/accounts/${a.id}`}
                      style={{
                        color: "var(--bright-blue)",
                        fontSize: "0.85rem",
                      }}
                    >
                      詳細
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p style={{ padding: 24, color: "var(--text-light)" }}>
            アカウントがまだありません。
          </p>
        )}
      </section>
    </main>
  );
}
