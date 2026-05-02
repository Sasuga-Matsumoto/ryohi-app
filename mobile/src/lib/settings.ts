/**
 * 全設定（出張定義・業務時間・休日・目的プリセット等）の取得・更新
 * Web の SettingsForm 相当を mobile で扱う
 */
import { supabase } from "./supabase";
import { API_BASE_URL } from "./config";

export interface FullSetting {
  account_id: string;
  work_lat: number | null;
  work_lng: number | null;
  work_radius_m: number;
  home_lat: number | null;
  home_lng: number | null;
  home_radius_m: number;
  trip_definition_type: "hours" | "km";
  trip_threshold_hours: number;
  trip_threshold_km: number;
  business_hours_enabled: boolean;
  business_hours_start: string; // HH:MM
  business_hours_end: string; // HH:MM
  include_holidays: boolean;
  include_weekends: boolean;
  default_purpose: string;
  purpose_presets: string[];
}

export const DEFAULT_SETTING: FullSetting = {
  account_id: "",
  work_lat: null,
  work_lng: null,
  work_radius_m: 100,
  home_lat: null,
  home_lng: null,
  home_radius_m: 100,
  trip_definition_type: "hours",
  trip_threshold_hours: 4,
  trip_threshold_km: 30,
  business_hours_enabled: false,
  business_hours_start: "09:00",
  business_hours_end: "18:00",
  include_holidays: true,
  include_weekends: true,
  default_purpose: "顧客訪問",
  purpose_presets: [],
};

export async function fetchFullSetting(): Promise<FullSetting | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // purpose_presets はマイグレーション 0006 で追加されたので別取得 + フォールバック
  const { data: base } = await supabase
    .from("account_settings")
    .select(
      "account_id, work_lat, work_lng, work_radius_m, home_lat, home_lng, home_radius_m, trip_definition_type, trip_threshold_hours, trip_threshold_km, business_hours_enabled, business_hours_start, business_hours_end, include_holidays, include_weekends, default_purpose",
    )
    .eq("account_id", user.id)
    .maybeSingle();

  if (!base) return null;

  let purpose_presets: string[] = [];
  try {
    const { data: ext } = await supabase
      .from("account_settings")
      .select("purpose_presets")
      .eq("account_id", user.id)
      .maybeSingle();
    const raw = (ext as { purpose_presets?: string[] } | null)?.purpose_presets;
    if (Array.isArray(raw)) purpose_presets = raw;
  } catch {
    // 0006 未適用環境
  }

  return {
    ...base,
    business_hours_start: String(base.business_hours_start ?? "09:00").slice(0, 5),
    business_hours_end: String(base.business_hours_end ?? "18:00").slice(0, 5),
    purpose_presets,
  } as FullSetting;
}

/**
 * 設定を一括更新（部分更新も可・与えたフィールドだけサーバ側で適用）
 */
export async function updateSetting(
  patch: Partial<FullSetting>,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return { ok: false, error: "未ログイン" };

    const res = await fetch(`${API_BASE_URL}/api/account-settings`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(patch),
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

export const DEFAULT_PURPOSE_PRESETS_MOBILE = [
  "顧客訪問",
  "商談",
  "視察",
  "展示会",
] as const;
