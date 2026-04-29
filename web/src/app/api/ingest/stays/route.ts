/**
 * POST /api/ingest/stays
 * モバイルアプリからの滞在ノード（30分以上）を一括受信
 *
 * body: { stays: [{ ts_start: ISO, ts_end: ISO, lat: number, lng: number, accuracy?: number }] }
 */
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

const MAX_STAYS = 1000;

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "未ログイン" }, { status: 401 });
  }

  const { data: account } = await supabase
    .from("accounts")
    .select("status")
    .eq("id", user.id)
    .maybeSingle();
  if (!account || account.status !== "active") {
    return NextResponse.json({ error: "アカウントが有効ではありません" }, { status: 403 });
  }

  let body: { stays?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "不正なリクエスト" }, { status: 400 });
  }

  if (!Array.isArray(body.stays)) {
    return NextResponse.json({ error: "stays は配列必須" }, { status: 400 });
  }
  if (body.stays.length > MAX_STAYS) {
    return NextResponse.json(
      { error: `1リクエストあたり最大 ${MAX_STAYS} 件` },
      { status: 413 }
    );
  }

  const rows = body.stays.map((s, i) => {
    const o = s as Record<string, unknown>;
    if (
      !o.ts_start ||
      !o.ts_end ||
      typeof o.lat !== "number" ||
      typeof o.lng !== "number"
    ) {
      throw new Error(`stays[${i}] 不正`);
    }
    return {
      account_id: user.id,
      ts_start: o.ts_start as string,
      ts_end: o.ts_end as string,
      lat: o.lat,
      lng: o.lng,
      accuracy: typeof o.accuracy === "number" ? o.accuracy : 20,
      source: "GF" as const, // Geofence 由来
    };
  });

  if (rows.length === 0) {
    return NextResponse.json({ ok: true, inserted: 0 });
  }

  const { error, count } = await supabase
    .from("location_stays")
    .insert(rows, { count: "exact" });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, inserted: count ?? rows.length });
}
