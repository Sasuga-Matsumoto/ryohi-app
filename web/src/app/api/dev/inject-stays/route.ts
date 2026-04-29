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
 * 滞在ノード列を受け取り、200m 間隔で経路点を生成する（デモ用に往復で異なる経路）
 *
 * - 各滞在内: ts_start と ts_end の2点を打つ（中心座標）
 * - 滞在間: 200m 間隔で補間しつつ、進行方向の左側へ正弦曲線でずらす
 *
 * 仕組み: 「進行方向の左側」（perp = (-dLng, dLat)）に常に膨らませる。
 *   行き (A→B) と帰り (B→A) では進行方向が逆になり、左側も逆向きになるため、
 *   同じ A-B 区間でも自動的に左右反対側に膨らみ、別経路として可視化される。
 *
 * 例: 勤務地 → 渋谷 → 勤務地 の場合、
 *   行き（勤務地→渋谷）: 進行方向の左 = 北西側に膨らむ
 *   帰り（渋谷→勤務地）: 進行方向の左 = 南東側に膨らむ
 */
function generateInterpolatedTracks(
  stays: StayInput[]
): Array<{ ts: string; lat: number; lng: number }> {
  const sorted = [...stays].sort(
    (a, b) => new Date(a.ts_start).getTime() - new Date(b.ts_start).getTime()
  );
  const out: Array<{ ts: string; lat: number; lng: number }> = [];

  // 曲線の最大ずれ（度）。約 300m 相当
  const CURVE_PEAK_DEG = 0.003;

  for (let i = 0; i < sorted.length; i++) {
    const s = sorted[i];
    // 滞在の開始・終了に1点ずつ
    out.push({ ts: s.ts_start, lat: s.lat, lng: s.lng });
    out.push({ ts: s.ts_end, lat: s.lat, lng: s.lng });

    // 次の滞在まで補間
    if (i + 1 < sorted.length) {
      const next = sorted[i + 1];
      const dLat = next.lat - s.lat;
      const dLng = next.lng - s.lng;
      const segLenDeg = Math.sqrt(dLat * dLat + dLng * dLng);
      const distKm = haversineKm(s.lat, s.lng, next.lat, next.lng);
      const numPoints = Math.max(0, Math.floor(distKm / 0.2) - 1);
      const startTs = new Date(s.ts_end).getTime();
      const endTs = new Date(next.ts_start).getTime();

      // 進行方向に対する左側ベクトル（正規化）: (dLat, dLng) を反時計回りに 90度回す = (-dLng, dLat)
      const perpLat = segLenDeg > 0 ? -dLng / segLenDeg : 0;
      const perpLng = segLenDeg > 0 ? dLat / segLenDeg : 0;

      for (let k = 1; k <= numPoints; k++) {
        const ratio = k / (numPoints + 1);
        // 中点で最大の正弦曲線オフセット（常に進行方向の左側）
        const offsetDeg = CURVE_PEAK_DEG * Math.sin(Math.PI * ratio);
        const lat = s.lat + dLat * ratio + perpLat * offsetDeg;
        const lng = s.lng + dLng * ratio + perpLng * offsetDeg;
        const ts = new Date(startTs + (endTs - startTs) * ratio).toISOString();
        out.push({ ts, lat, lng });
      }
    }
  }
  return out;
}
