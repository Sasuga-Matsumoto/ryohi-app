import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ArrowLeftIcon, PlusIcon } from "@/components/Icon";
import ManualTripForm from "./ManualTripForm";

export const metadata = {
  title: "出張を手動追加 | Log Tracker",
};

export default async function NewTripPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <main className="container page" style={{ maxWidth: 720 }}>
      <div className="breadcrumb">
        <a href="/dashboard">
          <ArrowLeftIcon
            size={12}
            style={{
              display: "inline",
              verticalAlign: "middle",
              marginRight: 4,
            }}
          />
          ダッシュボード
        </a>
      </div>

      <header className="page-header">
        <div>
          <h1
            className="page-title"
            style={{ display: "flex", alignItems: "center", gap: 8 }}
          >
            <PlusIcon size={20} />
            出張を手動追加
          </h1>
          <p className="page-subtitle">
            自動判定で漏れた出張を手動で記録します
          </p>
        </div>
      </header>

      <div className="card">
        <ManualTripForm />
      </div>
    </main>
  );
}
