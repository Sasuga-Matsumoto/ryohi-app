/**
 * POST /api/dev/run-judgment
 * 開発用: 指定日の LocationStay を読み込んで judgeTrip を実行し trips に upsert
 *
 * body: { date: 'YYYY-MM-DD' }
 */
import { NextResponse, type NextRequest } from "next/server";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { judgeTrip } from "@/lib/judgment";
import type { AccountSetting, LocationStay } from "@/types";

export async function POST(request: NextRequest) {
  // ユーザー認証は通常クライアントで
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "未ログイン" }, { status: 401 });
  }

  // trips への書き込みは service_role 経由（RLS バイパス、システム生成扱い）
  const sysSupabase = createServiceRoleClient();

  let body: { date?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "不正なリクエスト" }, { status: 400 });
  }
  const date = body.date;
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "date は YYYY-MM-DD" }, { status: 400 });
  }

  // 設定取得
  const { data: settingRow, error: settingErr } = await supabase
    .from("account_settings")
    .select("*")
    .eq("account_id", user.id)
    .maybeSingle();
  if (settingErr || !settingRow) {
    return NextResponse.json(
      { error: "設定が見つかりません。先に /dashboard/settings で保存してください" },
      { status: 400 }
    );
  }
  if (settingRow.work_lat == null || settingRow.home_lat == null) {
    return NextResponse.json(
      { error: "自宅・勤務地の座標が未設定です" },
      { status: 400 }
    );
  }

  const setting: AccountSetting = {
    account_id: user.id,
    work_lat: settingRow.work_lat,
    work_lng: settingRow.work_lng,
    work_radius_m: settingRow.work_radius_m,
    home_lat: settingRow.home_lat,
    home_lng: settingRow.home_lng,
    home_radius_m: settingRow.home_radius_m,
    trip_definition_type: settingRow.trip_definition_type,
    trip_threshold_hours: settingRow.trip_threshold_hours,
    trip_threshold_km: settingRow.trip_threshold_km,
    business_hours_start: String(settingRow.business_hours_start).slice(0, 5),
    business_hours_end: String(settingRow.business_hours_end).slice(0, 5),
    include_holidays: settingRow.include_holidays,
    include_weekends: settingRow.include_weekends,
    default_purpose: settingRow.default_purpose,
  };

  // その日の滞在ノードを取得
  const dayStart = `${date}T00:00:00+09:00`;
  const dayEnd = `${date}T23:59:59+09:00`;
  const { data: staysRows, error: staysErr } = await supabase
    .from("location_stays")
    .select("ts_start, ts_end, lat, lng, accuracy, source")
    .eq("account_id", user.id)
    .gte("ts_start", dayStart)
    .lte("ts_start", dayEnd)
    .order("ts_start", { ascending: true });
  if (staysErr) {
    return NextResponse.json({ error: staysErr.message }, { status: 500 });
  }

  const stays: LocationStay[] = (staysRows ?? []).map((r) => ({
    account_id: user.id,
    ts_start: r.ts_start,
    ts_end: r.ts_end,
    lat: r.lat,
    lng: r.lng,
    accuracy: r.accuracy,
    source: r.source,
  }));

  // 判定
  const result = judgeTrip({ date, stays, setting });

  if (!result.trip) {
    // 既存 Trip があれば削除（再判定で出張じゃなくなったケース）
    await sysSupabase
      .from("trips")
      .delete()
      .eq("account_id", user.id)
      .eq("date", date);

    return NextResponse.json({
      ok: true,
      trip: null,
      skipReason: result.skipReason,
      staysCount: stays.length,
    });
  }

  // destination_label と visited_areas は逆ジオコーディング（Phase 2 で実装）
  // MVP では座標から仮ラベルを作る
  const longestStay = (result.longestOutSet ?? [])
    .slice()
    .sort(
      (a, b) =>
        new Date(b.ts_end).getTime() -
        new Date(b.ts_start).getTime() -
        (new Date(a.ts_end).getTime() - new Date(a.ts_start).getTime())
    )[0];
  const destinationLabel = longestStay
    ? `(${longestStay.lat.toFixed(3)}, ${longestStay.lng.toFixed(3)})`
    : null;
  const visitedAreas = (result.longestOutSet ?? []).map(
    (s) => `(${s.lat.toFixed(3)}, ${s.lng.toFixed(3)})`
  );
  const dedupVisited = Array.from(new Set(visitedAreas));

  // upsert (service_role)
  const { error: upsertErr } = await sysSupabase.from("trips").upsert(
    {
      account_id: user.id,
      date,
      depart_ts: result.trip.depart_ts,
      return_ts: result.trip.return_ts,
      destination_label: destinationLabel,
      visited_areas: dedupVisited,
      total_minutes: result.trip.total_minutes,
      max_distance_km: result.trip.max_distance_km,
      status: "auto_detected",
      purpose: setting.default_purpose,
      is_excluded: false,
      excluded_reason: null,
    },
    { onConflict: "account_id,date" }
  );

  if (upsertErr) {
    return NextResponse.json({ error: upsertErr.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    trip: {
      ...result.trip,
      destination_label: destinationLabel,
      visited_areas: dedupVisited,
    },
    staysCount: stays.length,
  });
}
