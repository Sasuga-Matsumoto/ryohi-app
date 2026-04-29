/**
 * PATCH /api/trips/[id]
 * 自分の Trip を編集する（purpose / is_excluded / excluded_reason のみ）
 *
 * body 例:
 *   { purpose: "渋谷で商談" }
 *   { is_excluded: true, excluded_reason: "私用だった" }
 *   { is_excluded: false }
 */
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

const ALLOWED_KEYS = ["purpose", "is_excluded", "excluded_reason"] as const;
type AllowedKey = (typeof ALLOWED_KEYS)[number];

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "未ログイン" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "不正なリクエスト" }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  for (const key of ALLOWED_KEYS) {
    if (key in body) updates[key as AllowedKey] = body[key];
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "更新項目がありません" }, { status: 400 });
  }

  // バリデーション
  if ("purpose" in updates) {
    const p = updates.purpose;
    if (typeof p !== "string" || p.trim().length === 0) {
      return NextResponse.json(
        { error: "purpose は1文字以上の文字列" },
        { status: 400 }
      );
    }
    updates.purpose = p.trim().slice(0, 200);
  }
  if ("is_excluded" in updates && typeof updates.is_excluded !== "boolean") {
    return NextResponse.json({ error: "is_excluded は boolean" }, { status: 400 });
  }
  if (
    "excluded_reason" in updates &&
    updates.excluded_reason != null &&
    typeof updates.excluded_reason !== "string"
  ) {
    return NextResponse.json(
      { error: "excluded_reason は文字列または null" },
      { status: 400 }
    );
  }
  // is_excluded=false にしたら excluded_reason もクリア
  if (updates.is_excluded === false) {
    updates.excluded_reason = null;
  }

  // RLS により本人の Trip しか update できない
  const { data, error } = await supabase
    .from("trips")
    .update(updates)
    .eq("id", id)
    .eq("account_id", user.id)
    .select()
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "出張が見つかりません" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, trip: data });
}
