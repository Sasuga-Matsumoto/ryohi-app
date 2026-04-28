import { requireAdmin } from "@/lib/supabase/admin-guard";
import NewAccountForm from "./NewAccountForm";

export default async function NewAccountPage() {
  await requireAdmin();

  return (
    <main className="container" style={{ padding: "40px 20px" }}>
      <header style={{ marginBottom: 24 }}>
        <a
          href="/admin"
          style={{
            fontSize: "0.85rem",
            color: "var(--text-light)",
          }}
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
          新規アカウント発行
        </h1>
      </header>

      <div className="card" style={{ maxWidth: 480 }}>
        <NewAccountForm />
      </div>
    </main>
  );
}
