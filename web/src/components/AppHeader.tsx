import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { HomeIcon, ShieldIcon, LogOutIcon, SettingsIcon, UserIcon } from "@/components/Icon";

/**
 * 全画面共通ヘッダー
 * ロゴ + ナビ + ユーザーメニュー
 */
export default async function AppHeader() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let role: "user" | "admin" = "user";
  let name = "";
  if (user) {
    const { data: account } = await supabase
      .from("accounts")
      .select("role, name")
      .eq("id", user.id)
      .maybeSingle();
    if (account) {
      role = account.role;
      name = account.name ?? "";
    }
  }

  return (
    <header className="app-header">
      <div className="app-header-inner">
        <a className="app-brand" href={user ? "/dashboard" : "/login"}>
          <Image src="/logo.png" alt="PLEX" width={28} height={28} priority />
          <span style={{ fontSize: "var(--text-base)" }}>PLEX 出張ログ</span>
        </a>

        {user ? (
          <nav className="app-nav" aria-label="メインナビゲーション">
            <a href="/dashboard">
              <HomeIcon size={16} />
              <span className="label">ダッシュボード</span>
            </a>
            <a href="/dashboard/settings">
              <SettingsIcon size={16} />
              <span className="label">設定</span>
            </a>
            {role === "admin" && (
              <a href="/admin">
                <ShieldIcon size={16} />
                <span className="label">Admin</span>
              </a>
            )}
            <span
              style={{
                width: 1,
                height: 24,
                background: "var(--border)",
                margin: "0 var(--space-2)",
              }}
              aria-hidden="true"
            />
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontSize: "var(--text-sm)",
                color: "var(--text-light)",
              }}
            >
              <UserIcon size={14} />
              {name}
            </span>
            <form action="/auth/signout" method="post">
              <button
                type="submit"
                className="btn btn-ghost btn-sm"
                aria-label="ログアウト"
              >
                <LogOutIcon size={14} />
                <span className="label">ログアウト</span>
              </button>
            </form>
          </nav>
        ) : null}
      </div>
    </header>
  );
}
