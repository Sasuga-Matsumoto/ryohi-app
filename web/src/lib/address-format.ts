/**
 * Nominatim の address フィールドから日本住所を構造化する。
 *
 * 用途: 自宅・勤務地の確認表示など、番地まで含めた完全な住所を見せる場面。
 * トリップの滞在ノード表示用ラベル（市区町村レベル）には geocoding.ts を使う。
 */

export type NominatimAddress = Record<string, string | undefined>;

export interface FormattedAddress {
  postcode: string | null;
  /** 都道府県 + 市区町村 + 町名 + 番地 を半角スペース区切りで結合した表示用住所 */
  line: string | null;
}

export function formatJapaneseAddressDetailed(
  addr: NominatimAddress | null | undefined,
  fallbackDisplayName?: string | null,
): FormattedAddress {
  if (!addr) {
    return {
      postcode: null,
      line: fallbackDisplayName ?? null,
    };
  }

  const postcode = addr.postcode ?? null;
  const prefecture = addr.province ?? addr.state ?? "";
  const city =
    addr.city ?? addr.town ?? addr.county ?? addr.municipality ?? "";
  const ward = addr.city_district ?? addr.ward ?? "";
  const suburb =
    addr.suburb ??
    addr.neighbourhood ??
    addr.quarter ??
    addr.hamlet ??
    "";
  const block = addr.block ?? addr.amenity ?? "";
  const houseNumber = addr.house_number ?? "";

  const parts = [prefecture, city, ward, suburb, block, houseNumber]
    .map((p) => (p ?? "").trim())
    .filter((p) => p.length > 0);

  // 重複削除（city と ward が同じ値で返るケースがある）
  const seen = new Set<string>();
  const dedup: string[] = [];
  for (const p of parts) {
    if (seen.has(p)) continue;
    seen.add(p);
    dedup.push(p);
  }

  const line = dedup.length > 0 ? dedup.join(" ") : fallbackDisplayName ?? null;
  return { postcode, line };
}
