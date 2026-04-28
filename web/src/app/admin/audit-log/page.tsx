import { requireAdmin } from "@/lib/supabase/admin-guard";
import { createClient } from "@/lib/supabase/server";

const ACTION_LABEL: Record<string, string> = {
  create: "作成",
  suspend: "停止",
  resume: "再開",
  delete: "削除",
  edit: "編集",
};

export default async function AuditLogPage() {
  await requireAdmin();
  const supabase = await createClient();

  const { data: logs } = await supabase
    .from("admin_audit_log")
    .select(
      "id, action, target_account_id, ts, details, admin:accounts!admin_audit_log_admin_id_fkey(name), target:accounts!admin_audit_log_target_account_id_fkey(name, email)"
    )
    .order("ts", { ascending: false })
    .limit(200);

  return (
    <main className="container" style={{ padding: "40px 20px" }}>
      <header style={{ marginBottom: 24 }}>
        <a
          href="/admin"
          style={{ fontSize: "0.85rem", color: "var(--text-light)" }}
        >
          ← ダッシュボード
        </a>
        <h1
          style={{
            fontSize: "1.5rem",
            color: "var(--dark-blue)",
            marginTop: 8,
          }}
        >
          監査ログ
        </h1>
        <p
          style={{
            fontSize: "0.85rem",
            color: "var(--text-light)",
            marginTop: 4,
          }}
        >
          直近 200 件
        </p>
      </header>

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        {logs && logs.length > 0 ? (
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: "0.85rem",
            }}
          >
            <thead style={{ background: "#F9FAFB" }}>
              <tr>
                <th style={{ padding: 12, textAlign: "left" }}>日時</th>
                <th style={{ padding: 12, textAlign: "left" }}>操作</th>
                <th style={{ padding: 12, textAlign: "left" }}>管理者</th>
                <th style={{ padding: 12, textAlign: "left" }}>対象</th>
                <th style={{ padding: 12, textAlign: "left" }}>詳細</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => {
                // Supabase joins return arrays for nested relations
                const adminRel = log.admin as unknown as
                  | { name: string }
                  | { name: string }[]
                  | null;
                const targetRel = log.target as unknown as
                  | { name: string; email: string }
                  | { name: string; email: string }[]
                  | null;
                const adminName = Array.isArray(adminRel)
                  ? adminRel[0]?.name
                  : adminRel?.name;
                const target = Array.isArray(targetRel) ? targetRel[0] : targetRel;
                const details =
                  log.details && Object.keys(log.details).length > 0
                    ? JSON.stringify(log.details)
                    : "—";

                return (
                  <tr key={log.id} style={{ borderTop: "1px solid #E5E7EB" }}>
                    <td style={{ padding: 12, whiteSpace: "nowrap" }}>
                      {new Date(log.ts).toLocaleString("ja-JP")}
                    </td>
                    <td style={{ padding: 12 }}>
                      {ACTION_LABEL[log.action] ?? log.action}
                    </td>
                    <td style={{ padding: 12 }}>{adminName ?? "—"}</td>
                    <td style={{ padding: 12 }}>
                      {target ? (
                        <a
                          href={`/admin/accounts/${log.target_account_id}`}
                          style={{ color: "var(--bright-blue)" }}
                        >
                          {target.name} ({target.email})
                        </a>
                      ) : (
                        log.target_account_id
                      )}
                    </td>
                    <td
                      style={{
                        padding: 12,
                        fontFamily: "monospace",
                        fontSize: "0.8rem",
                        color: "var(--text-light)",
                      }}
                    >
                      {details}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <p style={{ padding: 24, color: "var(--text-light)" }}>
            監査ログはまだありません。
          </p>
        )}
      </div>
    </main>
  );
}
