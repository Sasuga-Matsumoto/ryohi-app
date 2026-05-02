/**
 * PATCH /api/trips/[id]
 * 自分の Trip を編集する
 *
 * 編集可能フィールド:
 * - purpose, is_excluded, excluded_reason
 * - date, depart_ts, return_ts, destination_label, visited_areas, total_minutes, max_distance_km
 *
 * 編集が発生した時点で edited_at = now() / edit_source = 'user_edit' を自動で書き込む
 * （ただし元から edit_source='manual_create' の場合はそのまま維持）
 */
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

const ALLOWED_KEYS = [
  "purpose",
  "is_excluded",
  "excluded_reason",
  "date",
  "depart_ts",
  "return_ts",
  "destination_label",
  "visited_areas",
  "total_minutes",
  "max_distance_km",
] as const;

const META_KEYS = new Set(["is_excluded", "excluded_reason"]);

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
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
  let hasContentEdit = false;
  for (const key of ALLOWED_KEYS) {
    if (key in body) {
      updates[key] = body[key];
      if (!META_KEYS.has(key)) hasContentEdit = true;
    }
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
        { status: 400 },
      );
    }
    updates.purpose = p.trim().slice(0, 200);
  }
  if ("destination_label" in updates) {
    const d = updates.destination_label;
    if (d != null && typeof d !== "string") {
      return NextResponse.json(
        { error: "destination_label は文字列または null" },
        { status: 400 },
      );
    }
    if (typeof d === "string") {
      updates.destination_label = d.trim().slice(0, 200) || null;
    }
  }
  if ("visited_areas" in updates) {
    const v = updates.visited_areas;
    if (!Array.isArray(v)) {
      return NextResponse.json(
        { error: "visited_areas は配列" },
        { status: 400 },
      );
    }
    updates.visited_areas = v
      .filter((s) => typeof s === "string")
      .map((s) => (s as string).trim())
      .filter(Boolean)
      .slice(0, 20);
  }
  if ("total_minutes" in updates) {
    const m = Number(updates.total_minutes);
    if (!Number.isFinite(m) || m < 0 || m > 24 * 60) {
      return NextResponse.json(
        { error: "total_minutes は 0〜1440 の数値" },
        { status: 400 },
      );
    }
    updates.total_minutes = Math.round(m);
  }
  if ("max_distance_km" in updates) {
    const km = updates.max_distance_km;
    if (km != null && (typeof km !== "number" || km < 0)) {
      return NextResponse.json(
        { error: "max_distance_km は 0 以上の数値または null" },
        { status: 400 },
      );
    }
  }
  if ("date" in updates) {
    const d = updates.date;
    if (typeof d !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(d)) {
      return NextResponse.json(
        { error: "date は YYYY-MM-DD 形式" },
        { status: 400 },
      );
    }
  }
  for (const ts of ["depart_ts", "return_ts"]) {
    if (ts in updates) {
      const v = updates[ts];
      if (typeof v !== "string" || isNaN(new Date(v).getTime())) {
        return NextResponse.json(
          { error: `${ts} は ISO8601 文字列` },
          { status: 400 },
        );
      }
    }
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
      { status: 400 },
    );
  }
  if (updates.is_excluded === false) {
    updates.excluded_reason = null;
  }

  // コンテンツ編集の場合は edited_at / edit_source を更新
  if (hasContentEdit) {
    // 既存 trip を取って status/edit_source を確認（manual_create を上書きしないため）
    const { data: existing } = await supabase
      .from("trips")
      .select("edit_source")
      .eq("id", id)
      .eq("account_id", user.id)
      .maybeSingle();
    updates.edited_at = new Date().toISOString();
    if (
      !existing ||
      (existing as { edit_source: string | null }).edit_source !==
        "manual_create"
    ) {
      updates.edit_source = "user_edit";
    }
  }

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
