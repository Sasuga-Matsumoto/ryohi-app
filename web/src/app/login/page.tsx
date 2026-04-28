"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error: err } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    setLoading(false);

    if (err) {
      setError(err.message);
    } else {
      setSent(true);
    }
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
      }}
    >
      <div className="card" style={{ width: "100%", maxWidth: 420 }}>
        <h1
          style={{
            fontSize: "1.5rem",
            color: "var(--dark-blue)",
            marginBottom: 8,
            textAlign: "center",
          }}
        >
          PLEX 出張ログ
        </h1>
        <p
          style={{
            color: "var(--text-light)",
            fontSize: "0.9rem",
            textAlign: "center",
            marginBottom: 28,
          }}
        >
          メールアドレスを入力してください
        </p>

        {sent ? (
          <div
            style={{
              padding: "16px",
              background: "#ECFDF5",
              borderRadius: 8,
              color: "#065F46",
              fontSize: "0.9rem",
              lineHeight: 1.7,
            }}
          >
            <strong>✓ メールを送信しました</strong>
            <br />
            <span style={{ color: "var(--text-light)" }}>
              {email} 宛のリンクをタップしてログインしてください。
              数分以内に届きます。
            </span>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            style={{ display: "flex", flexDirection: "column", gap: 12 }}
          >
            <input
              type="email"
              required
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input"
              autoFocus
              disabled={loading}
            />
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading || !email}
            >
              {loading ? "送信中…" : "ログインリンクを送信"}
            </button>
            {error && (
              <p style={{ color: "var(--danger)", fontSize: "0.85rem" }}>
                {error}
              </p>
            )}
          </form>
        )}

        <p
          style={{
            marginTop: 24,
            color: "var(--text-light)",
            fontSize: "0.75rem",
            textAlign: "center",
            lineHeight: 1.7,
          }}
        >
          パスワードは不要です。Magic Link 方式でログインします。
          <br />
          アカウントは運営者が発行します。
        </p>
      </div>
    </main>
  );
}
