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
  ward?: string; // 区
  city_district?: string; // 区
  suburb?: string; // 地区/区
  city?: string; // 市
  town?: string; // 町
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
  url.searchParams.set("zoom", "12"); // 市区町村レベル
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
 * Nominatim レスポンスから市区町村レベルの日本語ラベルを抽出
 * 例:
 *   渋谷区: { suburb: "渋谷区", city: "東京都", state: "東京都" }
 *     → "渋谷区"
 *   横浜市西区: { suburb: "西区", city: "横浜市", state: "神奈川県" }
 *     → "横浜市西区"
 *   千葉市中央区: { suburb: "中央区", city: "千葉市" }
 *     → "千葉市中央区"
 *   一般市: { city: "つくば市" }
 *     → "つくば市"
 */
function extractCityWardLabel(data: NominatimResponse): string | null {
  const a = data.address ?? {};

  // 区の抽出（複数フィールド優先順）
  const ward = a.ward || a.city_district || matchesWardSuffix(a.suburb);
  // 市町村
  const city = a.city || a.town || a.village;

  // 区がある場合
  if (ward) {
    // 政令指定都市: city が「横浜市」「千葉市」など末尾「市」 → 結合
    if (city && /市$/.test(city) && city !== ward) {
      return `${city}${ward}`;
    }
    // 東京都の特別区など、city が都道府県名の場合は ward 単独
    return ward;
  }

  if (city) return city;

  // フォールバック: display_name から雑に切り出し
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
