/**
 * 逆ジオコーディング: 座標 → 市区町村名
 *
 * Nominatim (OpenStreetMap) を使用。
 * - User-Agent 必須（ToS）
 * - レート制限 1 req/sec → 同一プロセス内では sequential に間引く
 * - In-memory + Next.js fetch キャッシュで重複呼び出し抑制
 */

type NominatimAddress = {
  // Japan address fields. Nominatim でデータによりキーが揺れる
  // 細かい順
  neighbourhood?: string; // 字・小字
  quarter?: string; // 大字・町域（道玄坂等）
  suburb?: string; // 地区/区
  ward?: string; // 区
  city_district?: string; // 区
  town?: string; // 町
  city?: string; // 市
  village?: string; // 村
  state?: string; // 都道府県
  country?: string;
};

type NominatimResponse = {
  display_name?: string;
  address?: NominatimAddress;
};

const memCache = new Map<string, string | null>();

const RATE_LIMIT_MS = 1100; // 1 req/sec + 余裕
let lastCallTs = 0;

async function waitForRateLimit() {
  const now = Date.now();
  const wait = lastCallTs + RATE_LIMIT_MS - now;
  if (wait > 0) {
    await new Promise((r) => setTimeout(r, wait));
  }
  lastCallTs = Date.now();
}

/**
 * 緯度経度を市区町村名に変換
 * 失敗時は null を返す（呼び出し側でフォールバック）
 */
export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  // ~100m 精度でキャッシュキー化
  const key = `${lat.toFixed(3)},${lng.toFixed(3)}`;
  if (memCache.has(key)) return memCache.get(key) ?? null;

  await waitForRateLimit();

  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.searchParams.set("format", "json");
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lng));
  url.searchParams.set("zoom", "16"); // 町名レベル
  url.searchParams.set("accept-language", "ja");
  url.searchParams.set("addressdetails", "1");

  try {
    const res = await fetch(url.toString(), {
      headers: {
        "User-Agent": process.env.NOMINATIM_USER_AGENT ?? "ryohi-app/0.1",
      },
      // 30日キャッシュ（市区町村は不変）
      next: { revalidate: 86400 * 30 },
    });
    if (!res.ok) {
      memCache.set(key, null);
      return null;
    }
    const data = (await res.json()) as NominatimResponse;
    const label = extractCityWardLabel(data);
    memCache.set(key, label);
    return label;
  } catch {
    memCache.set(key, null);
    return null;
  }
}

/**
 * Nominatim レスポンスから町名レベルの日本語ラベルを抽出
 * 例:
 *   渋谷区道玄坂: { quarter: "道玄坂", suburb: "渋谷区", city: "東京都" }
 *     → "渋谷区道玄坂"
 *   横浜市西区南幸: { quarter: "南幸", suburb: "西区", city: "横浜市" }
 *     → "横浜市西区南幸"
 *   町名情報なし: { suburb: "渋谷区", city: "東京都" }
 *     → "渋谷区"
 *   一般市: { city: "つくば市", neighbourhood: "竹園" }
 *     → "つくば市竹園"
 */
function extractCityWardLabel(data: NominatimResponse): string | null {
  const a = data.address ?? {};

  // 町名（細かい順に拾う）
  const neighborhood = a.quarter || a.neighbourhood || null;
  // 区（複数フィールド優先順）
  const ward = a.ward || a.city_district || matchesWardSuffix(a.suburb);
  // 市町村
  const city = a.city || a.town || a.village;

  // 政令指定都市（横浜市・千葉市等）: 市+区+町名
  if (city && /市$/.test(city) && ward) {
    return neighborhood ? `${city}${ward}${neighborhood}` : `${city}${ward}`;
  }

  // 東京都特別区: 区+町名（city は都道府県名なので使わない）
  if (ward) {
    return neighborhood ? `${ward}${neighborhood}` : ward;
  }

  // 一般市町村: 市+町名
  if (city) {
    return neighborhood ? `${city}${neighborhood}` : city;
  }

  // フォールバック
  if (neighborhood) return neighborhood;
  if (data.display_name) {
    return data.display_name.split(",")[0]?.trim() ?? null;
  }
  return null;
}

function matchesWardSuffix(s?: string): string | undefined {
  if (s && /区$/.test(s)) return s;
  return undefined;
}

/**
 * 滞在ノード配列を逐次的に逆ジオコーディング
 * Nominatim のレート制限を尊重するため Promise.all は使わず for ループ
 */
export async function reverseGeocodeStays(
  stays: Array<{ lat: number; lng: number }>
): Promise<string[]> {
  const labels: string[] = [];
  for (const s of stays) {
    const label = await reverseGeocode(s.lat, s.lng);
    labels.push(label ?? `(${s.lat.toFixed(3)}, ${s.lng.toFixed(3)})`);
  }
  return labels;
}
