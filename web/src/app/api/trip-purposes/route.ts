/**
 * GET /api/trip-purposes
 * Trip 編集 UI のサジェスト用に
 * - presets: ユーザーがカスタム追加したプリセット
 * - history: 過去 90 日の出張目的の distinct（最大 20 件）
 * を返す
 */
import { NextResponse, type NextRequest } from "next/server";
import { getApiClient } from "@/lib/supabase/api-auth";

export async function GET(request: NextRequest) {
  const supabase = await getApiClient(request);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "未ログイン" }, { status: 401 });
  }

  // ユーザーカスタムプリセット（migration 0006 適用済み環境のみ列が存在）
  let presets: string[] = [];
  try {
    const { data: setting } = await supabase
      .from("account_settings")
      .select("purpose_presets")
      .eq("account_id", user.id)
      .maybeSingle();
    const raw = (setting as { purpose_presets?: string[] } | null)
      ?.purpose_presets;
    if (Array.isArray(raw)) presets = raw;
  } catch {
    // 列がまだ無い環境 → 空配列で fallback
  }

  // 過去 90 日の履歴
  const since = new Date();
  since.setDate(since.getDate() - 90);
  const sinceStr = since.toISOString().slice(0, 10);

  const { data: tripsRows } = await supabase
    .from("trips")
    .select("purpose")
    .eq("account_id", user.id)
    .gte("date", sinceStr);

  const seen = new Set<string>();
  const history: string[] = [];
  for (const r of tripsRows ?? []) {
    const p = r.purpose?.trim();
    if (!p || seen.has(p)) continue;
    seen.add(p);
    history.push(p);
    if (history.length >= 20) break;
  }

  return NextResponse.json({ presets, history });
}
