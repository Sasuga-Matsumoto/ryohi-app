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
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return;
    await fetch(`${API_BASE_URL}/api/health`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ status }),
    });
  } catch (e) {
    // 失敗は無視（次回 init() で再送される）
    console.warn("[health] report failed", e);
  }
}
