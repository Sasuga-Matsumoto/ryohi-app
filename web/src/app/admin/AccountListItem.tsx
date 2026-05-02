/**
 * Admin アカウント一覧の 1 件（モバイル用カード表示）
 */
import { ChevronRightIcon } from "@/components/Icon";
import StatusPill from "@/components/StatusPill";

export default function AccountListItem({
  account,
}: {
  account: {
    id: string;
    name: string;
    email: string;
    company_name: string;
    role: string;
    status: "active" | "suspended" | "deleted";
  };
}) {
  return (
    <a
      href={`/admin/accounts/${account.id}`}
      className="account-card"
      style={{ textDecoration: "none", color: "inherit" }}
    >
      <div className="account-card-head">
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="account-card-name">{account.name}</div>
          <div className="account-card-email">{account.email}</div>
        </div>
        <StatusPill status={account.status} />
      </div>
      <div className="account-card-meta">
        <span>
          会社: <strong>{account.company_name}</strong>
        </span>
        <span>
          ロール: <strong>{account.role}</strong>
        </span>
      </div>
      <div className="account-card-foot">
        <span className="text-xs text-muted">タップで詳細</span>
        <ChevronRightIcon size={14} style={{ color: "var(--text-muted)" }} />
      </div>
    </a>
  );
}
