/**
 * Geofence / Location permission のセットアップ
 */
import * as Location from "expo-location";
import * as BackgroundFetch from "expo-background-fetch";
import { supabase } from "./supabase";
import {
  TASK_GEOFENCE,
  TASK_FLUSH_QUEUE,
  FLUSH_INTERVAL_SEC,
} from "./config";
import { defineTasks } from "./tasks";

export interface AccountSetting {
  account_id: string;
  work_lat: number | null;
  work_lng: number | null;
  work_radius_m: number;
  home_lat: number | null;
  home_lng: number | null;
  home_radius_m: number;
}

/**
 * 「常に許可」フォアグラウンド+バックグラウンド両方の許可を取得
 */
export async function requestLocationPermissions(): Promise<{
  foreground: boolean;
  background: boolean;
}> {
  const fg = await Location.requestForegroundPermissionsAsync();
  if (fg.status !== "granted") {
    return { foreground: false, background: false };
  }
  const bg = await Location.requestBackgroundPermissionsAsync();
  return {
    foreground: true,
    background: bg.status === "granted",
  };
}

/**
 * Supabase から自分の account_settings を取得
 */
export async function fetchMySettings(): Promise<AccountSetting | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("account_settings")
    .select(
      "account_id, work_lat, work_lng, work_radius_m, home_lat, home_lng, home_radius_m"
    )
    .eq("account_id", user.id)
    .maybeSingle();
  return data ?? null;
}

/**
 * 設定の自宅・勤務地に Geofence を張る
 */
export async function registerGeofence(setting: AccountSetting): Promise<boolean> {
  if (
    setting.work_lat == null ||
    setting.work_lng == null ||
    setting.home_lat == null ||
    setting.home_lng == null
  ) {
    console.log("[location] settings incomplete, skip geofence");
    return false;
  }

  defineTasks();

  // 既存 geofence があれば停止
  const has = await Location.hasStartedGeofencingAsync(TASK_GEOFENCE);
  if (has) {
    await Location.stopGeofencingAsync(TASK_GEOFENCE);
  }

  await Location.startGeofencingAsync(TASK_GEOFENCE, [
    {
      identifier: "home",
      latitude: setting.home_lat,
      longitude: setting.home_lng,
      radius: Math.max(setting.home_radius_m, 50), // OS の最小値配慮
      notifyOnEnter: true,
      notifyOnExit: true,
    },
    {
      identifier: "work",
      latitude: setting.work_lat,
      longitude: setting.work_lng,
      radius: Math.max(setting.work_radius_m, 50),
      notifyOnEnter: true,
      notifyOnExit: true,
    },
  ]);

  return true;
}

/**
 * 1時間毎の flush タスクを登録
 */
export async function registerFlushTask() {
  defineTasks();
  const status = await BackgroundFetch.getStatusAsync();
  if (
    status === BackgroundFetch.BackgroundFetchStatus.Restricted ||
    status === BackgroundFetch.BackgroundFetchStatus.Denied
  ) {
    console.warn("[location] BackgroundFetch unavailable");
    return false;
  }

  await BackgroundFetch.registerTaskAsync(TASK_FLUSH_QUEUE, {
    minimumInterval: FLUSH_INTERVAL_SEC,
    stopOnTerminate: false,
    startOnBoot: true,
  });
  return true;
}

/**
 * Geofence + flush task を一括解除
 */
export async function tearDownTracking() {
  if (await Location.hasStartedGeofencingAsync(TASK_GEOFENCE)) {
    await Location.stopGeofencingAsync(TASK_GEOFENCE);
  }
  // hf-gps の停止
  const { stopHighFrequencyGps } = await import("./tasks");
  await stopHighFrequencyGps();
  // flush task の停止
  try {
    await BackgroundFetch.unregisterTaskAsync(TASK_FLUSH_QUEUE);
  } catch {}
}
