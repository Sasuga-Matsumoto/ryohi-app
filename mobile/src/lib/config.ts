/**
 * 環境設定（.env / app.json の extra から読み込み）
 */
import Constants from "expo-constants";

const extra = Constants.expoConfig?.extra ?? {};

export const SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL ?? extra.supabaseUrl ?? "";
export const SUPABASE_ANON_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? extra.supabaseAnonKey ?? "";
export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ?? extra.apiBaseUrl ?? "https://ryohi-app.vercel.app";

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn(
    "[config] EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY が未設定。.env を確認してください。"
  );
}

// Task identifiers
export const TASK_GEOFENCE = "geofence-task";
export const TASK_HF_GPS = "hf-gps-task";
export const TASK_FLUSH_QUEUE = "flush-queue-task";

// 動作パラメータ
export const HF_GPS_DISTANCE_INTERVAL_M = 200;
export const HF_GPS_TIME_INTERVAL_MS = 5 * 60 * 1000;
export const HF_GPS_DEFERRED_INTERVAL_MS = 60 * 1000;
export const FLUSH_INTERVAL_SEC = 60 * 60; // 1h
export const STAY_RADIUS_M = 200;
export const STAY_MIN_MINUTES = 30;
