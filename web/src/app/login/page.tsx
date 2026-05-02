"use client";

import { useState } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { CheckIcon } from "@/components/Icon";

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
    if (err) setError(err.message);
    else setSent(true);
  };

  return (
    <main
      style={{
        minHeight: "calc(100vh - 60px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "var(--space-6) var(--space-4)",
      }}
    >
      <div
        className="card card-elevated"
        style={{ width: "100%", maxWidth: 420 }}
      >
        <div style={{ textAlign: "center", marginBottom: "var(--space-6)" }}>
          <Image
            src="/logo.png"
            alt="PLEX"
            width={56}
            height={56}
            style={{ display: "inline-block" }}
            priority
          />
          <h1
            className="page-title"
            style={{
              marginTop: "var(--space-3)",
              fontSize: "var(--text-xl)",
            }}
          >
            PLEX Log
          </h1>
          <p
            className="text-sm text-muted"
            style={{ marginTop: "var(--space-1)" }}
          >
            メールアドレスを入力してください
          </p>
        </div>

        {sent ? (
          <div
            className="alert alert-success"
            style={{ flexDirection: "column", textAlign: "center", alignItems: "center" }}
          >
            <CheckIcon size={24} />
            <strong>メールを送信しました</strong>
            <p className="text-sm">
              <span className="text-muted">{email}</span> 宛のリンクをタップしてログインしてください。
              数分以内に届きます。
            </p>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="stack"
          >
            <div>
              <label htmlFor="email" className="label label-required">メールアドレス</label>
              <input
                id="email"
                type="email"
                required
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input"
                autoFocus
                disabled={loading}
              />
            </div>
            <button
              type="submit"
              className="btn btn-primary btn-lg"
              disabled={loading || !email}
              style={{ width: "100%" }}
            >
              {loading ? "送信中..." : "ログインリンクを送信"}
            </button>
            {error && (
              <p className="text-sm text-danger" role="alert">
                {error}
              </p>
            )}
          </form>
        )}

        <p
          className="text-xs text-muted"
          style={{
            marginTop: "var(--space-6)",
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
