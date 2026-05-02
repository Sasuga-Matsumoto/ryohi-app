/**
 * GET /api/today-tracks
 * 自分の今日（JST）の location_tracks を返す
 * モバイルの「今日の経路」マップが、ローカル SQLite ではなくサーバを信頼ソースに使うため
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

  // 今日（JST）の範囲を ISO8601 で
  const todayJstStart = new Date();
  todayJstStart.setHours(0, 0, 0, 0);
  // JST 0:00 = UTC 前日 15:00 → JST → UTC は -9h
  const jstOffsetMs = 9 * 60 * 60 * 1000;
  const todayUtcMs =
    Math.floor(
      (todayJstStart.getTime() + jstOffsetMs) / (24 * 60 * 60 * 1000),
    ) *
      24 *
      60 *
      60 *
      1000 -
    jstOffsetMs;
  const startIso = new Date(todayUtcMs).toISOString();
  const endIso = new Date(todayUtcMs + 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("location_tracks")
    .select("ts, lat, lng")
    .eq("account_id", user.id)
    .gte("ts", startIso)
    .lt("ts", endIso)
    .order("ts", { ascending: true })
    .limit(2000);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ tracks: data ?? [] });
}
