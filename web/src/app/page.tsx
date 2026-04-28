export default function HomePage() {
  return (
    <main className="container" style={{ padding: "80px 20px" }}>
      <div style={{ textAlign: "center", marginBottom: 40 }}>
        <h1 style={{ fontSize: "2rem", color: "var(--dark-blue)", marginBottom: 12 }}>
          PLEX 出張ログ
        </h1>
        <p style={{ color: "var(--text-light)" }}>
          GPS自動記録で月次出張ログを自動生成・証拠保管するサービス
        </p>
      </div>

      <div className="card" style={{ maxWidth: 480, margin: "0 auto" }}>
        <h2 style={{ fontSize: "1.2rem", marginBottom: 16 }}>セットアップ状況</h2>
        <ul style={{ paddingLeft: 20, lineHeight: 2 }}>
          <li>✅ Next.js + TypeScript 初期化済み</li>
          <li>✅ 出張判定アルゴリズム実装済み</li>
          <li>✅ アルゴリズム単体テスト書き済み</li>
          <li>⏳ Supabase / R2 / Inngest の接続設定待ち</li>
          <li>⏳ ログイン・管理画面・Admin Console 実装待ち</li>
        </ul>
        <p style={{ marginTop: 16, fontSize: "0.85rem", color: "var(--text-light)" }}>
          詳細は README.md とプラン文書を参照してください。
        </p>
      </div>
    </main>
  );
}
