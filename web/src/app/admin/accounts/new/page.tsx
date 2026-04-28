import { requireAdmin } from "@/lib/supabase/admin-guard";
import NewAccountForm from "./NewAccountForm";
import { ArrowLeftIcon } from "@/components/Icon";

export default async function NewAccountPage() {
  await requireAdmin();

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
          <h1 className="page-title">新規アカウント発行</h1>
          <p className="page-subtitle">招待メール（Magic Link）が自動送信されます</p>
        </div>
      </header>

      <div className="card" style={{ maxWidth: 520 }}>
        <NewAccountForm />
      </div>
    </main>
  );
}
