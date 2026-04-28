/**
 * POST /api/dev/inject-stays
 * 開発用: 自分のアカウントに LocationStay をモック投入する
 *
 * body:
 *  {
 *    stays: [
 *      { ts_start: ISO, ts_end: ISO, lat: number, lng: number, accuracy?: number }
 *    ],
 *    replaceForDay?: 'YYYY-MM-DD'      // その日の MOCK stays / tracks を削除して置き換え
 *    auto_interpolate_tracks?: boolean // true なら 200m 間隔で滞在間に track 点を補完して location_tracks にも投入
 *  }
 */
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { haversineKm } from "@/lib/geo";

interface StayInput {
  ts_start: string;
  ts_end: string;
  lat: number;
  lng: number;
  accuracy?: number;
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "未ログイン" }, { status: 401 });
  }

  let body: {
    stays?: unknown;
    replaceForDay?: string;
    auto_interpolate_tracks?: boolean;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "不正なリクエスト" }, { status: 400 });
  }

  if (!Array.isArray(body.stays)) {
    return NextResponse.json({ error: "stays は配列必須" }, { status: 400 });
  }

  const rawStays = body.stays.map((s, i) => {
    const o = s as Record<string, unknown>;
    if (!o.ts_start || !o.ts_end || typeof o.lat !== "number" || typeof o.lng !== "number") {
      throw new Error(`stays[${i}] 不正`);
    }
    return {
      ts_start: o.ts_start as string,
      ts_end: o.ts_end as string,
      lat: o.lat,
      lng: o.lng,
      accuracy: typeof o.accuracy === "number" ? o.accuracy : 20,
    };
  });

  const stays = rawStays.map((s) => ({
    account_id: user.id,
    ts_start: s.ts_start,
    ts_end: s.ts_end,
    lat: s.lat,
    lng: s.lng,
    accuracy: s.accuracy,
    source: "MOCK" as const,
  }));

  // 指定日の MOCK データを削除
  if (body.replaceForDay) {
    const dayStart = `${body.replaceForDay}T00:00:00+09:00`;
    const dayEnd = `${body.replaceForDay}T23:59:59+09:00`;
    await supabase
      .from("location_stays")
      .delete()
      .eq("account_id", user.id)
      .eq("source", "MOCK")
      .gte("ts_start", dayStart)
      .lte("ts_start", dayEnd);
    if (body.auto_interpolate_tracks) {
      await supabase
        .from("location_tracks")
        .delete()
        .eq("account_id", user.id)
        .eq("source", "MOCK")
        .gte("ts", dayStart)
        .lte("ts", dayEnd);
    }
  }

  const { error: stayErr, count: stayCount } = await supabase
    .from("location_stays")
    .insert(stays, { count: "exact" });

  if (stayErr) {
    return NextResponse.json({ error: stayErr.message }, { status: 500 });
  }

  let trackCount = 0;
  if (body.auto_interpolate_tracks) {
    const tracks = generateInterpolatedTracks(rawStays).map((t) => ({
      account_id: user.id,
      ts: t.ts,
      lat: t.lat,
      lng: t.lng,
      accuracy: 20,
      source: "MOCK" as const,
    }));
    if (tracks.length > 0) {
      const { error: trackErr, count: tc } = await supabase
        .from("location_tracks")
        .insert(tracks, { count: "exact" });
      if (trackErr) {
        return NextResponse.json(
          { error: `stays は投入したが tracks 失敗: ${trackErr.message}` },
          { status: 500 }
        );
      }
      trackCount = tc ?? tracks.length;
    }
  }

  return NextResponse.json({
    ok: true,
    inserted: stayCount ?? stays.length,
    interpolated_tracks: trackCount,
  });
}

/**
 * 滞在ノード列を受け取り、200m 間隔で経路点を生成する
 * 各滞在内: ts_start と ts_end の2点を打つ（中心座標）
 * 滞在間: 直線上を 200m 間隔で補間（時間も比例配分）
 */
function generateInterpolatedTracks(
  stays: StayInput[]
): Array<{ ts: string; lat: number; lng: number }> {
  const sorted = [...stays].sort(
    (a, b) => new Date(a.ts_start).getTime() - new Date(b.ts_start).getTime()
  );
  const out: Array<{ ts: string; lat: number; lng: number }> = [];

  for (let i = 0; i < sorted.length; i++) {
    const s = sorted[i];
    // 滞在の開始・終了に1点ずつ
    out.push({ ts: s.ts_start, lat: s.lat, lng: s.lng });
    out.push({ ts: s.ts_end, lat: s.lat, lng: s.lng });

    // 次の滞在まで補間
    if (i + 1 < sorted.length) {
      const next = sorted[i + 1];
      const distKm = haversineKm(s.lat, s.lng, next.lat, next.lng);
      // 200m間隔 → numPoints = Math.floor(distKm / 0.2) - 1（端点を除く中間点）
      const numPoints = Math.max(0, Math.floor(distKm / 0.2) - 1);
      const startTs = new Date(s.ts_end).getTime();
      const endTs = new Date(next.ts_start).getTime();

      for (let k = 1; k <= numPoints; k++) {
        const ratio = k / (numPoints + 1);
        const lat = s.lat + (next.lat - s.lat) * ratio;
        const lng = s.lng + (next.lng - s.lng) * ratio;
        const ts = new Date(startTs + (endTs - startTs) * ratio).toISOString();
        out.push({ ts, lat, lng });
      }
    }
  }
  return out;
}
