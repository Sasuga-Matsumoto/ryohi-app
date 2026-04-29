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
  road?: string; // 街路名（出さない・参考）
  neighbourhood?: string; // 丁目 / 字
  quarter?: string; // 大字・町名（道玄坂等）
  suburb?: string; // 地区/町名（東京特別区では "渋谷区" 等が入ることもある）
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
  url.searchParams.set("zoom", "17"); // 丁目レベル（番地・建物名を含まないギリギリ）
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
 * Nominatim レスポンスから「区+町名+丁目」レベルの日本語ラベルを抽出
 *
 * 例:
 *   { neighbourhood: "二丁目", quarter: "道玄坂", suburb: "渋谷区", city: "東京都" }
 *     → "渋谷区道玄坂二丁目"
 *   { quarter: "南幸", suburb: "西区", city: "横浜市" }
 *     → "横浜市西区南幸"
 *   町名情報なし: { suburb: "渋谷区", city: "東京都" }
 *     → "渋谷区"
 *   一般市: { city: "つくば市", quarter: "竹園" }
 *     → "つくば市竹園"
 *
 * road・番地・建物名は **意図的に含めない**（プライバシー配慮）。
 */
function extractCityWardLabel(data: NominatimResponse): string | null {
  const a = data.address ?? {};

  // 町名候補
  const town = a.quarter || null;
  // 丁目候補（"二丁目" 等）
  const chome = a.neighbourhood && /丁目$/.test(a.neighbourhood) ? a.neighbourhood : null;
  // 区（複数フィールド優先順）
  const ward = a.ward || a.city_district || matchesWardSuffix(a.suburb);
  // 市町村
  const city = a.city || a.town || a.village;

  // 構成要素を結合
  const parts: string[] = [];
  // 政令指定都市は市+区
  if (city && /市$/.test(city)) {
    parts.push(city);
    if (ward && ward !== city) parts.push(ward);
  } else if (ward) {
    // 特別区
    parts.push(ward);
  } else if (city) {
    parts.push(city);
  }

  if (town) parts.push(town);
  if (chome) parts.push(chome);

  if (parts.length > 0) return parts.join("");

  // フォールバック
  if (a.suburb) return a.suburb;
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
