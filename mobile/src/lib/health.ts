/**
 * モバイルアプリの状態を Web 側に通知（Admin の「位置情報」KPI 用）
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "./supabase";
import { API_BASE_URL } from "./config";

export type MobileStatus =
  | "services_off"
  | "no_permission"
  | "fg_only"
  | "no_setting"
  | "not_recording"
  | "ready";

const LAST_STATUS_KEY = "last_mobile_status";

export async function saveLastStatus(status: MobileStatus): Promise<void> {
  try {
    await AsyncStorage.setItem(LAST_STATUS_KEY, status);
  } catch (e) {
    console.warn("[health] saveLastStatus failed", e);
  }
}

export async function loadLastStatus(): Promise<MobileStatus | null> {
  try {
    const v = await AsyncStorage.getItem(LAST_STATUS_KEY);
    if (!v) return null;
    if (
      v === "services_off" ||
      v === "no_permission" ||
      v === "fg_only" ||
      v === "no_setting" ||
      v === "not_recording" ||
      v === "ready"
    ) {
      return v;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * account_settings の自宅 or 勤務地座標を更新する
 */
export async function updateLocation(
  kind: "home" | "work",
  latlng: { lat: number; lng: number },
): Promise<{ ok: boolean; error?: string }> {
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return { ok: false, error: "未ログイン" };
    const body =
      kind === "home"
        ? { home_lat: latlng.lat, home_lng: latlng.lng }
        : { work_lat: latlng.lat, work_lng: latlng.lng };
    const res = await fetch(`${API_BASE_URL}/api/account-settings`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      return { ok: false, error: b.error ?? `HTTP ${res.status}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

export interface TodaySummary {
  tracks: Array<{ ts: string; lat: number; lng: number }>;
  staysCount: number;
  lastReceivedAt: string | null;
}

export async function fetchTodaySummaryFromServer(): Promise<TodaySummary | null> {
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return null;
    const res = await fetch(`${API_BASE_URL}/api/today-tracks`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      console.warn(`[today-tracks] HTTP ${res.status}`);
      return null;
    }
    const body = (await res.json()) as {
      tracks?: Array<{ ts: string; lat: number; lng: number }>;
      staysCount?: number;
      lastReceivedAt?: string | null;
    };
    return {
      tracks: body.tracks ?? [],
      staysCount: body.staysCount ?? 0,
      lastReceivedAt: body.lastReceivedAt ?? null,
    };
  } catch (e) {
    console.warn("[today-tracks] fetch failed", e);
    return null;
  }
}

// 後方互換 alias
export const fetchTodayTracksFromServer = async () => {
  const s = await fetchTodaySummaryFromServer();
  return s?.tracks ?? null;
};

export interface GeocodeResult {
  lat: number;
  lng: number;
  display_name: string;
}

export interface ReverseGeocodeResult {
  display_name: string | null;
  name: string | null;
  address: Record<string, string> | null;
  extratags: Record<string, string> | null;
  namedetails: Record<string, string> | null;
}

/**
 * 緯度経度 → 住所
 * Nominatim の逆ジオコーディング。
 * 失敗時は null を返す（呼び出し側で座標フォールバックする想定）。
 */
export async function reverseGeocode(
  lat: number,
  lng: number,
): Promise<ReverseGeocodeResult | null> {
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return null;
    const res = await fetch(
      `${API_BASE_URL}/api/reverse-geocode?lat=${lat}&lng=${lng}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!res.ok) return null;
    return (await res.json()) as ReverseGeocodeResult;
  } catch {
    return null;
  }
}

export interface FormattedAddress {
  postcode: string | null;
  /** 都道府県 + 市区町村 + 町名 + 番地 を半角スペース区切りで結合 */
  line: string | null;
  /** 建物名・施設名（オフィスビル等で番地が無い場合の補助） */
  buildingName: string | null;
}

/**
 * Nominatim の reverse-geocode レスポンスから日本住所を構造化する。
 * 例:
 *   { postcode: "110-0007", line: "東京都 台東区 上野公園 12-8", buildingName: null }
 *   オフィスビル: { postcode: "100-0005", line: "東京都 千代田区 大手町", buildingName: "大手町ビル" }
 */
export function formatJapaneseAddress(
  payload: ReverseGeocodeResult | null | undefined,
): FormattedAddress {
  if (!payload) return { postcode: null, line: null, buildingName: null };
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
  const houseNumber = addr.house_number ?? extra["addr:housenumber"] ?? "";

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

  // 同じ要素の重複を削除（city と ward が同じ値で返るケースなど）
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

/**
 * 住所・郵便番号・施設名で検索（Web の /api/geocode を経由・Nominatim プロキシ）
 */
export async function geocodeSearch(
  query: string,
): Promise<GeocodeResult[]> {
  if (query.trim().length < 2) return [];
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return [];
    const res = await fetch(
      `${API_BASE_URL}/api/geocode?q=${encodeURIComponent(query.trim())}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!res.ok) return [];
    const body = (await res.json()) as { results?: GeocodeResult[] };
    return body.results ?? [];
  } catch {
    return [];
  }
}

export async function reportMobileStatus(status: MobileStatus): Promise<void> {
  console.log(`[health] reporting status=${status} to ${API_BASE_URL}/api/health`);
  // 後で flush task が再送信できるよう、最終 status を AsyncStorage に保存
  await saveLastStatus(status);
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
      console.warn("[health] no session token, skip");
      return;
    }
    const res = await fetch(`${API_BASE_URL}/api/health`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      console.log(`[health] OK: status=${status} reported`);
    } else {
      const body = await res.text().catch(() => "");
      console.warn(`[health] HTTP ${res.status}: ${body}`);
    }
  } catch (e) {
    console.warn("[health] report failed", e);
  }
}
