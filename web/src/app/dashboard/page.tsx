import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: account } = await supabase
    .from("accounts")
    .select("name, company_name, role, status")
    .eq("id", user.id)
    .maybeSingle();

  if (!account) {
    return (
      <main className="container" style={{ padding: "60px 20px" }}>
        <div className="card" style={{ maxWidth: 560, margin: "0 auto" }}>
          <h1 style={{ fontSize: "1.3rem", color: "var(--dark-blue)" }}>
            アカウント情報がありません
          </h1>
          <p
            style={{
              color: "var(--text-light)",
              marginTop: 12,
              lineHeight: 1.7,
            }}
          >
            Auth でログインはできましたが、`accounts` テーブルにレコードがまだ作成されていません。
            運営者に連絡するか、SQL Editor で手動 insert してください。
          </p>
        </div>
      </main>
    );
  }

  if (account.status !== "active") {
    return (
      <main className="container" style={{ padding: "60px 20px" }}>
        <div className="card" style={{ maxWidth: 560, margin: "0 auto" }}>
          <h1 style={{ fontSize: "1.3rem", color: "var(--danger)" }}>
            利用停止中です
          </h1>
          <p style={{ color: "var(--text-light)", marginTop: 12 }}>
            運営者にお問い合わせください。
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="container" style={{ padding: "60px 20px" }}>
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: 32,
        }}
      >
        <div>
          <h1
            style={{
              fontSize: "1.6rem",
              color: "var(--dark-blue)",
              marginBottom: 4,
            }}
          >
            こんにちは、{account.name} さん
          </h1>
          <p style={{ color: "var(--text-light)", fontSize: "0.9rem" }}>
            {account.company_name}
          </p>
        </div>
        <nav style={{ display: "flex", gap: 12 }}>
          {account.role === "admin" && (
            <a href="/admin" className="btn btn-secondary">
              Admin Console
            </a>
          )}
          <form action="/auth/signout" method="post">
            <button type="submit" className="btn btn-secondary">
              ログアウト
            </button>
          </form>
        </nav>
      </header>

      <div className="card">
        <h2 style={{ fontSize: "1.1rem", marginBottom: 16 }}>
          🚧 ダッシュボード（実装中）
        </h2>
        <p style={{ color: "var(--text-light)", lineHeight: 1.7 }}>
          ここに今月の出張サマリ・最近の Trip・月次ログ DL ボタンを表示予定。
          現在は認証フローの動作確認用ページです。
        </p>
        <ul style={{ marginTop: 16, paddingLeft: 20, lineHeight: 2 }}>
          <li>ロール: <strong>{account.role}</strong></li>
          <li>ステータス: <strong>{account.status}</strong></li>
          <li>ユーザーID: <code style={{ fontSize: "0.85rem" }}>{user.id}</code></li>
        </ul>
      </div>
    </main>
  );
}
