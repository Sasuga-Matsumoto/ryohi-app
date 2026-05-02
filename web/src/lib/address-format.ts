/**
 * Nominatim の address フィールドから日本住所を構造化する。
 *
 * 用途: 自宅・勤務地の確認表示など、番地まで含めた完全な住所を見せる場面。
 * トリップの滞在ノード表示用ラベル（市区町村レベル）には geocoding.ts を使う。
 */

export type NominatimAddress = Record<string, string | undefined>;

export interface ReverseGeocodePayload {
  display_name?: string | null;
  /** OSM の name タグ（建物名・施設名・店名など） */
  name?: string | null;
  address?: NominatimAddress | null;
  /** Nominatim の extratags（addr:housenumber 等が入る場合がある） */
  extratags?: Record<string, string> | null;
  namedetails?: Record<string, string> | null;
}

export interface FormattedAddress {
  postcode: string | null;
  /** 都道府県 + 市区町村 + 町名 + 番地 を半角スペース区切りで結合した表示用住所 */
  line: string | null;
  /** 建物名・施設名 (オフィスビル・店舗など、番地が無い場所の補助情報) */
  buildingName: string | null;
}

export function formatJapaneseAddressDetailed(
  payload: ReverseGeocodePayload | null | undefined,
): FormattedAddress {
  if (!payload) {
    return { postcode: null, line: null, buildingName: null };
  }
  const addr = payload.address ?? {};
  const extra = payload.extratags ?? {};
  const named = payload.namedetails ?? {};

  const postcode = addr.postcode ?? extra["addr:postcode"] ?? null;

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
  const block = addr.block ?? "";

  // 番地: address.house_number を最優先、無ければ extratags["addr:housenumber"]
  const houseNumber =
    addr.house_number ?? extra["addr:housenumber"] ?? "";

  // 建物名・施設名のフォールバック（オフィスビル等で house_number が無い場合の補助表示）
  const buildingName =
    named["name:ja"] ??
    payload.name ??
    addr.building ??
    addr.office ??
    addr.shop ??
    addr.amenity ??
    addr.tourism ??
    extra["name"] ??
    null;

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

  const line =
    dedup.length > 0 ? dedup.join(" ") : payload.display_name ?? null;
  return { postcode, line, buildingName };
}
