"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NewAccountForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch("/api/admin/accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, name, company_name: companyName }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? `失敗しました (HTTP ${res.status})`);
      setLoading(false);
      return;
    }

    router.push("/admin");
    router.refresh();
  };

  return (
    <form
      onSubmit={handleSubmit}
      style={{ display: "flex", flexDirection: "column", gap: 16 }}
    >
      <div>
        <label style={{ fontSize: "0.85rem", fontWeight: 600 }}>
          メールアドレス *
        </label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="input"
          placeholder="user@example.com"
          disabled={loading}
          style={{ marginTop: 6 }}
        />
      </div>

      <div>
        <label style={{ fontSize: "0.85rem", fontWeight: 600 }}>氏名 *</label>
        <input
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="input"
          placeholder="山田 太郎"
          disabled={loading}
          style={{ marginTop: 6 }}
        />
      </div>

      <div>
        <label style={{ fontSize: "0.85rem", fontWeight: 600 }}>会社名 *</label>
        <input
          type="text"
          required
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
          className="input"
          placeholder="株式会社 XXX"
          disabled={loading}
          style={{ marginTop: 6 }}
        />
      </div>

      <div
        style={{
          padding: 12,
          background: "#F0F9FF",
          borderRadius: 8,
          fontSize: "0.85rem",
          color: "#0C4A6E",
          lineHeight: 1.7,
        }}
      >
        <strong>発行後の挙動:</strong>
        <br />
        • 入力メアドに Magic Link 招待メールが自動送信されます
        <br />
        • 受信者がリンクをタップするとログイン状態になります
        <br />
        • 利用開始時にオンボーディング（自宅・勤務地等の設定）に誘導されます
      </div>

      <button
        type="submit"
        className="btn btn-primary"
        disabled={loading || !email || !name || !companyName}
      >
        {loading ? "発行中…" : "発行 → 招待メール送信"}
      </button>

      {error && (
        <p style={{ color: "var(--danger)", fontSize: "0.85rem" }}>{error}</p>
      )}
    </form>
  );
}
