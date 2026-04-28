import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SettingsForm from "./SettingsForm";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: setting } = await supabase
    .from("account_settings")
    .select("*")
    .eq("account_id", user.id)
    .maybeSingle();

  return (
    <main className="container" style={{ padding: "40px 20px" }}>
      <header style={{ marginBottom: 24 }}>
        <a
          href="/dashboard"
          style={{ fontSize: "0.85rem", color: "var(--text-light)" }}
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
          設定
        </h1>
        <p
          style={{
            fontSize: "0.85rem",
            color: "var(--text-light)",
            marginTop: 4,
          }}
        >
          自宅・勤務地と出張判定のルールを設定します
        </p>
      </header>

      <SettingsForm initial={setting ?? null} />
    </main>
  );
}
