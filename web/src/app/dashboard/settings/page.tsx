import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SettingsForm from "./SettingsForm";
import { ArrowLeftIcon } from "@/components/Icon";

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
    <main className="container page">
      <div className="breadcrumb">
        <a href="/dashboard">
          <ArrowLeftIcon size={12} style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }} />
          ダッシュボード
        </a>
      </div>
      <header className="page-header">
        <div>
          <h1 className="page-title">設定</h1>
          <p className="page-subtitle">
            自宅・勤務地と出張判定のルールを設定します
          </p>
        </div>
      </header>

      <SettingsForm initial={setting ?? null} />
    </main>
  );
}
