/**
 * POST /api/dev/inject-stays
 * 開発用: 自分のアカウントに LocationStay をモック投入する
 *
 * body:
 *  {
 *    stays: [
 *      { ts_start: ISO, ts_end: ISO, lat: number, lng: number, accuracy?: number }
 *    ],
 *    replaceForDay?: string  // 'YYYY-MM-DD' 指定時、その日の既存 MOCK stays を削除して置き換え
 *  }
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

  let body: { stays?: unknown; replaceForDay?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "不正なリクエスト" }, { status: 400 });
  }

  if (!Array.isArray(body.stays)) {
    return NextResponse.json({ error: "stays は配列必須" }, { status: 400 });
  }

  const stays = body.stays.map((s, i) => {
    const o = s as Record<string, unknown>;
    if (!o.ts_start || !o.ts_end || typeof o.lat !== "number" || typeof o.lng !== "number") {
      throw new Error(`stays[${i}] 不正`);
    }
    return {
      account_id: user.id,
      ts_start: o.ts_start as string,
      ts_end: o.ts_end as string,
      lat: o.lat,
      lng: o.lng,
      accuracy: typeof o.accuracy === "number" ? o.accuracy : 20,
      source: "MOCK" as const,
    };
  });

  // 指定日の MOCK 滞在を削除
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
  }

  const { error, count } = await supabase
    .from("location_stays")
    .insert(stays, { count: "exact" });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, inserted: count ?? stays.length });
}
