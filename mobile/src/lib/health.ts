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
