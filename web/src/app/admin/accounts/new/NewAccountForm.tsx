"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { InfoIcon, PlusIcon } from "@/components/Icon";

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
    <form onSubmit={handleSubmit} className="stack">
      <div>
        <label htmlFor="email" className="label label-required">メールアドレス</label>
        <input
          id="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="input"
          placeholder="user@example.com"
          disabled={loading}
        />
      </div>

      <div>
        <label htmlFor="name" className="label label-required">氏名</label>
        <input
          id="name"
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="input"
          placeholder="山田 太郎"
          disabled={loading}
        />
      </div>

      <div>
        <label htmlFor="company" className="label label-required">会社名</label>
        <input
          id="company"
          type="text"
          required
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
          className="input"
          placeholder="株式会社 XXX"
          disabled={loading}
        />
      </div>

      <div className="alert alert-info">
        <InfoIcon size={16} style={{ flexShrink: 0, marginTop: 2 }} />
        <div>
          <strong>発行後の挙動</strong>
          <ul style={{ marginTop: 4, paddingLeft: 18, lineHeight: 1.7 }}>
            <li>入力メアドに Magic Link 招待メールが自動送信されます</li>
            <li>受信者がリンクをタップするとログイン状態になります</li>
            <li>利用開始時にオンボーディングへ誘導されます</li>
          </ul>
        </div>
      </div>

      <button
        type="submit"
        className="btn btn-primary btn-lg"
        disabled={loading || !email || !name || !companyName}
      >
        <PlusIcon size={16} />
        {loading ? "発行中..." : "発行 → 招待メール送信"}
      </button>

      {error && (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
