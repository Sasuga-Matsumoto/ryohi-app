/**
 * PUT /api/account-settings
 * 自分のアカウント設定を upsert する
 */
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function PUT(request: NextRequest) {
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

  const allowed = [
    "work_lat",
    "work_lng",
    "home_lat",
    "home_lng",
    "trip_definition_type",
    "trip_threshold_hours",
    "trip_threshold_km",
    "business_hours_enabled",
    "business_hours_start",
    "business_hours_end",
    "include_holidays",
    "include_weekends",
    "default_purpose",
  ] as const;

  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) updates[key] = body[key];
  }

  // 半径は強制で 100m（ユーザー編集不可）
  updates.work_radius_m = 100;
  updates.home_radius_m = 100;

  // upsert (account_id is primary key)
  const { error } = await supabase
    .from("account_settings")
    .upsert({ account_id: user.id, ...updates });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
