/**
 * GET /api/geocode?q=住所
 *
 * Nominatim (OpenStreetMap) のプロキシ。
 * - User-Agent ヘッダ必須（Nominatim ToS）
 * - レート制限 1 req/sec を超えないよう、フロントから連打されてもサーバ側で間引く想定
 *
 * レスポンス: [{ lat, lng, display_name }]
 */
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  // 認証必須（公開エンドポイントにしない）
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "未ログイン" }, { status: 401 });
  }

  const q = new URL(request.url).searchParams.get("q")?.trim();
  if (!q || q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("format", "json");
  url.searchParams.set("q", q);
  url.searchParams.set("limit", "5");
  url.searchParams.set("countrycodes", "jp");
  url.searchParams.set("accept-language", "ja");
  url.searchParams.set("addressdetails", "1");

  const res = await fetch(url.toString(), {
    headers: {
      "User-Agent": process.env.NOMINATIM_USER_AGENT ?? "ryohi-app/0.1",
    },
    // 24時間キャッシュ（同じクエリの連投を抑える）
    next: { revalidate: 86400 },
  });

  if (!res.ok) {
    return NextResponse.json(
      { error: `Nominatim error: ${res.status}` },
      { status: 502 }
    );
  }

  type NominatimItem = {
    lat: string;
    lon: string;
    display_name: string;
    address?: Record<string, string>;
  };

  const items = (await res.json()) as NominatimItem[];
  const results = items.map((it) => ({
    lat: parseFloat(it.lat),
    lng: parseFloat(it.lon),
    display_name: it.display_name,
  }));

  return NextResponse.json({ results });
}
