/**
 * POST /api/trips
 * 手動で Trip を追加する
 *
 * body: {
 *   date: 'YYYY-MM-DD',
 *   depart_ts: ISO8601,
 *   return_ts: ISO8601,
 *   destination_label?: string,
 *   visited_areas?: string[],
 *   total_minutes?: number,  // 省略時は depart_ts/return_ts から自動算出
 *   max_distance_km?: number,
 *   purpose: string,
 * }
 */
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
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

  const date = body.date;
  const depart_ts = body.depart_ts;
  const return_ts = body.return_ts;
  const purpose =
    typeof body.purpose === "string" ? body.purpose.trim() : "";

  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json(
      { error: "date は YYYY-MM-DD 形式" },
      { status: 400 },
    );
  }
  if (
    typeof depart_ts !== "string" ||
    isNaN(new Date(depart_ts).getTime())
  ) {
    return NextResponse.json(
      { error: "depart_ts は ISO8601 文字列" },
      { status: 400 },
    );
  }
  if (
    typeof return_ts !== "string" ||
    isNaN(new Date(return_ts).getTime())
  ) {
    return NextResponse.json(
      { error: "return_ts は ISO8601 文字列" },
      { status: 400 },
    );
  }
  if (new Date(return_ts).getTime() <= new Date(depart_ts).getTime()) {
    return NextResponse.json(
      { error: "return_ts は depart_ts より後の時刻" },
      { status: 400 },
    );
  }
  if (!purpose) {
    return NextResponse.json(
      { error: "purpose は必須" },
      { status: 400 },
    );
  }

  const destination_label =
    typeof body.destination_label === "string"
      ? body.destination_label.trim().slice(0, 200) || null
      : null;
  const visited_areas = Array.isArray(body.visited_areas)
    ? (body.visited_areas as unknown[])
        .filter((s) => typeof s === "string")
        .map((s) => (s as string).trim())
        .filter(Boolean)
        .slice(0, 20)
    : [];
  const max_distance_km =
    typeof body.max_distance_km === "number" && body.max_distance_km >= 0
      ? body.max_distance_km
      : null;

  const autoMinutes = Math.round(
    (new Date(return_ts).getTime() - new Date(depart_ts).getTime()) / 60000,
  );
  const total_minutes =
    typeof body.total_minutes === "number" &&
    body.total_minutes >= 0 &&
    body.total_minutes <= 24 * 60
      ? Math.round(body.total_minutes)
      : autoMinutes;

  const insertRow = {
    account_id: user.id,
    date,
    depart_ts,
    return_ts,
    destination_label,
    visited_areas,
    total_minutes,
    max_distance_km,
    purpose: purpose.slice(0, 200),
    status: "manual" as const,
    is_excluded: false,
    edited_at: new Date().toISOString(),
    edit_source: "manual_create" as const,
  };

  const { data, error } = await supabase
    .from("trips")
    .insert(insertRow)
    .select()
    .maybeSingle();

  if (error) {
    // (account_id, date) UNIQUE 制約に引っかかる場合
    if (error.code === "23505") {
      return NextResponse.json(
        {
          error:
            "その日付の出張は既に登録されています。詳細ページから編集してください",
        },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, trip: data });
}
