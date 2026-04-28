/**
 * POST /api/dev/inject-tracks
 * 開発用: 自分のアカウントに LocationTrack をモック投入する
 *
 * body:
 *   {
 *     tracks: [{ ts: ISO, lat: number, lng: number, accuracy?: number }],
 *     replaceForDay?: 'YYYY-MM-DD'  // 指定時、その日の MOCK tracks を削除して置き換え
 *   }
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

  let body: { tracks?: unknown; replaceForDay?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "不正なリクエスト" }, { status: 400 });
  }
  if (!Array.isArray(body.tracks)) {
    return NextResponse.json({ error: "tracks は配列必須" }, { status: 400 });
  }

  const tracks = body.tracks.map((t, i) => {
    const o = t as Record<string, unknown>;
    if (!o.ts || typeof o.lat !== "number" || typeof o.lng !== "number") {
      throw new Error(`tracks[${i}] 不正`);
    }
    return {
      account_id: user.id,
      ts: o.ts as string,
      lat: o.lat,
      lng: o.lng,
      accuracy: typeof o.accuracy === "number" ? o.accuracy : null,
      source: "MOCK" as const,
    };
  });

  if (body.replaceForDay) {
    const dayStart = `${body.replaceForDay}T00:00:00+09:00`;
    const dayEnd = `${body.replaceForDay}T23:59:59+09:00`;
    await supabase
      .from("location_tracks")
      .delete()
      .eq("account_id", user.id)
      .eq("source", "MOCK")
      .gte("ts", dayStart)
      .lte("ts", dayEnd);
  }

  const { error, count } = await supabase
    .from("location_tracks")
    .insert(tracks, { count: "exact" });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, inserted: count ?? tracks.length });
}
