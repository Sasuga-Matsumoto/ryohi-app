import { redirect } from "next/navigation";
import { createClient } from "./server";

/**
 * Admin 専用ページのガード
 * Server Component の冒頭で await することで認証＋権限チェック
 */
export async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: account } = await supabase
    .from("accounts")
    .select("id, role, status, name")
    .eq("id", user.id)
    .maybeSingle();

  if (!account || account.role !== "admin" || account.status !== "active") {
    redirect("/dashboard");
  }

  return { user, account };
}
