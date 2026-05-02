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
