import { requireAdmin } from "@/lib/supabase/admin-guard";
import { createClient } from "@/lib/supabase/server";
import { ArrowLeftIcon, ListIcon } from "@/components/Icon";
import AuditLogDetails from "./AuditLogDetails";

const ACTION_LABEL: Record<string, string> = {
  create: "作成",
  suspend: "停止",
  resume: "再開",
  delete: "削除",
  edit: "編集",
};

const ACTION_BADGE: Record<string, string> = {
  create: "badge-info",
  suspend: "badge-suspended",
  resume: "badge-active",
  delete: "badge-danger",
  edit: "badge-info",
};

export default async function AuditLogPage() {
  await requireAdmin();
  const supabase = await createClient();

  const { data: logs } = await supabase
    .from("admin_audit_log")
    .select(
      "id, action, target_account_id, ts, details, admin:accounts!admin_audit_log_admin_id_fkey(name), target:accounts!admin_audit_log_target_account_id_fkey(name, email)",
    )
    .order("ts", { ascending: false })
    .limit(200);

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
          <h1 className="page-title">監査ログ</h1>
          <p className="page-subtitle">
            直近 {logs?.length ?? 0} 件 / 最大 200 件まで表示
          </p>
        </div>
      </header>

      <section className="card" style={{ padding: 0 }}>
        <div className="card-header">
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <ListIcon size={16} /> 操作履歴
          </span>
        </div>

        {logs && logs.length > 0 ? (
          <>
            {/* Desktop: table */}
            <div
              className="audit-table-wrap"
              style={{ overflowX: "auto" }}
            >
              <table className="table">
                <thead>
                  <tr>
                    <th>日時</th>
                    <th>操作</th>
                    <th>管理者</th>
                    <th>対象</th>
                    <th>詳細</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => {
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
                    const target = Array.isArray(targetRel)
                      ? targetRel[0]
                      : targetRel;

                    return (
                      <tr key={log.id}>
                        <td
                          className="tabular text-sm"
                          style={{ whiteSpace: "nowrap" }}
                          title={new Date(log.ts).toISOString()}
                        >
                          {new Date(log.ts).toLocaleString("ja-JP")}
                        </td>
                        <td>
                          <span
                            className={`badge ${ACTION_BADGE[log.action] ?? "badge-info"}`}
                          >
                            {ACTION_LABEL[log.action] ?? log.action}
                          </span>
                        </td>
                        <td>{adminName ?? "—"}</td>
                        <td>
                          {target ? (
                            <a
                              href={`/admin/accounts/${log.target_account_id}`}
                              style={{ display: "inline-block" }}
                            >
                              <strong>{target.name}</strong>
                              <span
                                className="text-muted text-xs"
                                style={{ display: "block" }}
                              >
                                {target.email}
                              </span>
                            </a>
                          ) : (
                            <span className="font-mono text-xs">
                              {log.target_account_id}
                            </span>
                          )}
                        </td>
                        <td style={{ maxWidth: 320 }}>
                          <AuditLogDetails details={log.details} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile: cards */}
            <div className="audit-card-list">
              {logs.map((log) => {
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
                const target = Array.isArray(targetRel)
                  ? targetRel[0]
                  : targetRel;

                return (
                  <div key={log.id} className="audit-card">
                    <div className="audit-card-head">
                      <span
                        className={`badge ${ACTION_BADGE[log.action] ?? "badge-info"}`}
                      >
                        {ACTION_LABEL[log.action] ?? log.action}
                      </span>
                      <span
                        className="text-xs text-muted tabular"
                        title={new Date(log.ts).toISOString()}
                      >
                        {new Date(log.ts).toLocaleString("ja-JP", {
                          month: "numeric",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <div className="audit-card-body">
                      <div className="text-sm">
                        <strong>{adminName ?? "—"}</strong>
                        <span className="text-muted"> が </span>
                        {target ? (
                          <a
                            href={`/admin/accounts/${log.target_account_id}`}
                          >
                            <strong>{target.name}</strong>
                          </a>
                        ) : (
                          <span className="font-mono text-xs">
                            {log.target_account_id}
                          </span>
                        )}
                        <span className="text-muted"> を </span>
                        <strong>
                          {ACTION_LABEL[log.action] ?? log.action}
                        </strong>
                      </div>
                      <AuditLogDetails details={log.details} />
                    </div>
                  </div>
                );
              })}
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
            監査ログはまだありません
          </div>
        )}
      </section>
    </main>
  );
}
