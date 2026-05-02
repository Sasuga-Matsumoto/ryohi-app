/**
 * モバイルアプリの状態を Web 側に通知（Admin の「位置情報」KPI 用）
 */
import { supabase } from "./supabase";
import { API_BASE_URL } from "./config";

export type MobileStatus =
  | "services_off"
  | "no_permission"
  | "fg_only"
  | "no_setting"
  | "ready";

export async function reportMobileStatus(status: MobileStatus): Promise<void> {
  console.log(`[health] reporting status=${status} to ${API_BASE_URL}/api/health`);
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
