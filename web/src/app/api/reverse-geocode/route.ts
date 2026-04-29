/**
 * GET /api/reverse-geocode?lat=&lng=
 *
 * Nominatim 逆ジオコーディング: 緯度経度 → 市区町村名
 */
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "未ログイン" }, { status: 401 });
  }

  const params = new URL(request.url).searchParams;
  const lat = parseFloat(params.get("lat") ?? "");
  const lng = parseFloat(params.get("lng") ?? "");
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: "lat/lng 必須" }, { status: 400 });
  }

  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.searchParams.set("format", "json");
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lng));
  url.searchParams.set("zoom", "17"); // 丁目レベル
  url.searchParams.set("accept-language", "ja");

  const res = await fetch(url.toString(), {
    headers: {
      "User-Agent": process.env.NOMINATIM_USER_AGENT ?? "ryohi-app/0.1",
    },
    next: { revalidate: 86400 },
  });

  if (!res.ok) {
    return NextResponse.json({ display_name: null });
  }

  const data = (await res.json()) as { display_name?: string; address?: Record<string, string> };
  return NextResponse.json({
    display_name: data.display_name ?? null,
    address: data.address ?? null,
  });
}
