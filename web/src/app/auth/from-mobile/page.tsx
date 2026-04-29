"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * モバイルアプリから渡された access_token / refresh_token を hash で受け取り、
 * ブラウザ側の Supabase セッションをセットしてから next= に遷移する。
 *
 * URL 形式:
 *   /auth/from-mobile#access_token=...&refresh_token=...&next=/dashboard/settings
 *
 * hash 部はサーバ送信されないので、トークン漏れリスクはサーバ側ログには出ない。
 */
export default function FromMobilePage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const raw = window.location.hash.startsWith("#")
          ? window.location.hash.slice(1)
          : window.location.hash;
        const params = new URLSearchParams(raw);
        const access_token = params.get("access_token");
        const refresh_token = params.get("refresh_token");
        const next = params.get("next") ?? "/dashboard";

        if (!access_token || !refresh_token) {
          setError("トークンが見つかりません。アプリから開き直してください。");
          return;
        }

        const supabase = createClient();
        const { error: setError_ } = await supabase.auth.setSession({
          access_token,
          refresh_token,
        });
        if (setError_) {
          setError(`ログインに失敗しました: ${setError_.message}`);
          return;
        }

        // hash を消してから遷移（URL バーから token を消す）
        window.history.replaceState(null, "", window.location.pathname);
        router.replace(next);
      } catch (e) {
        setError(`予期しないエラー: ${(e as Error).message}`);
      }
    })();
  }, [router]);

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#F4F6FB",
      }}
    >
      <div
        style={{
          maxWidth: 400,
          padding: 32,
          backgroundColor: "#fff",
          borderRadius: 12,
          textAlign: "center",
        }}
      >
        {error ? (
          <>
            <p
              style={{
                fontSize: 14,
                color: "#B91C1C",
                lineHeight: 1.6,
                marginBottom: 16,
              }}
            >
              {error}
            </p>
            <a
              href="/login"
              style={{
                fontSize: 13,
                color: "#3366FF",
                textDecoration: "underline",
              }}
            >
              ログインページへ
            </a>
          </>
        ) : (
          <p style={{ fontSize: 14, color: "#475569" }}>ログイン中...</p>
        )}
      </div>
    </main>
  );
}
