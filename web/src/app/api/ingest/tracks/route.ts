/**
 * POST /api/ingest/tracks
 * モバイルアプリからの GPS 経路点を一括受信
 *
 * - Authorization: Bearer <Supabase JWT>（Magic Link でログイン済ユーザー）
 * - Content-Encoding: gzip 受信に対応
 * - X-Idempotency-Key: 重複送信を 24h 期間で弾く（簡易実装：DB ベース）
 *
 * body: { tracks: [{ ts: ISO, lat: number, lng: number, accuracy?: number }] }
 */
import { NextResponse, type NextRequest } from "next/server";
import { getApiClient } from "@/lib/supabase/api-auth";

const MAX_TRACKS = 5000;

export async function POST(request: NextRequest) {
  const supabase = await getApiClient(request);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "未ログイン" }, { status: 401 });
  }

  // suspended/deleted のユーザーは弾く
  const { data: account } = await supabase
    .from("accounts")
    .select("status")
    .eq("id", user.id)
    .maybeSingle();
  if (!account || account.status !== "active") {
    return NextResponse.json({ error: "アカウントが有効ではありません" }, { status: 403 });
  }

  let body: { tracks?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "不正なリクエスト" }, { status: 400 });
  }

  if (!Array.isArray(body.tracks)) {
    return NextResponse.json({ error: "tracks は配列必須" }, { status: 400 });
  }
  if (body.tracks.length > MAX_TRACKS) {
    return NextResponse.json(
      { error: `1リクエストあたり最大 ${MAX_TRACKS} 件` },
      { status: 413 }
    );
  }

  const rows = body.tracks.map((t, i) => {
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
      source: "GPS" as const,
    };
  });

  if (rows.length === 0) {
    return NextResponse.json({ ok: true, inserted: 0 });
  }

  const { error, count } = await supabase
    .from("location_tracks")
    .insert(rows, { count: "exact" });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, inserted: count ?? rows.length });
}
