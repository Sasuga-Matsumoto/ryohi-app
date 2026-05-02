/**
 * Log Tracker - データモデル型定義
 * プラン §3 のエンティティに対応
 */

export type Role = "user" | "admin";
export type AccountStatus = "active" | "suspended" | "deleted";
export type TripDefinitionType = "hours" | "km";
export type TripStatus = "auto_detected" | "manual";
export type EditSource = "manual_create" | "user_edit";
export type LocationStaySource = "SLC" | "GF" | "MOCK";
export type LocationTrackSource = "GPS" | "MOCK";
export type AdminAction = "create" | "suspend" | "resume" | "delete" | "edit";

export interface Account {
  id: string;
  email: string;
  name: string;
  company_name: string;
  created_at: string; // ISO8601
  role: Role;
  status: AccountStatus;
  suspended_at: string | null;
  suspended_reason: string | null;
}

export interface AccountSetting {
  account_id: string;

  // 自宅・勤務地（半径100m に強制固定）
  work_lat: number;
  work_lng: number;
  work_radius_m: number; // default 100, API で 100 強制
  home_lat: number;
  home_lng: number;
  home_radius_m: number; // default 100, API で 100 強制

  // 出張定義
  trip_definition_type: TripDefinitionType; // default 'hours'
  trip_threshold_hours: number; // default 4
  trip_threshold_km: number; // default 30

  // 業務時間
  business_hours_enabled: boolean; // default false（false = 24時間扱い）
  business_hours_start: string; // 'HH:MM' default '09:00'（enabled=false時は無視）
  business_hours_end: string; // 'HH:MM' default '18:00'（enabled=false時は無視）

  // 休日設定
  include_holidays: boolean; // default true
  include_weekends: boolean; // default true

  // 目的のデフォルト値
  default_purpose: string; // default '客先訪問'
}

/**
 * 端末側で集約された滞在ノード（半径200m+30分以上）
 * サーバへ送信される単位
 */
export interface LocationStay {
  account_id: string;
  ts_start: string; // ISO8601
  ts_end: string; // ISO8601
  lat: number;
  lng: number;
  accuracy: number; // meters
  source: LocationStaySource;
}

/**
 * 移動経路の生 GPS 点
 * 200m移動 or 5分経過のどちらか早い方で記録
 * 判定には使わず、Trip 詳細ページの地図表示で使用
 */
export interface LocationTrack {
  id?: string;
  account_id: string;
  ts: string; // ISO8601
  lat: number;
  lng: number;
  accuracy: number | null;
  source: LocationTrackSource;
}

/**
 * 自動判定された出張1件
 */
export interface Trip {
  id?: string;
  account_id: string;
  date: string; // 'YYYY-MM-DD'
  depart_ts: string; // ISO8601
  return_ts: string; // ISO8601
  destination_label: string; // 最長滞在の市区町村
  visited_areas: string[]; // 訪問地リスト・市区町村（重複除く・滞在時間順）
  total_minutes: number; // OUT累積滞在分（移動時間除く）
  max_distance_km: number;
  status: TripStatus;
  purpose: string; // 自由テキスト
  is_excluded: boolean; // default false
  excluded_reason: string | null;
  updated_at: string;
  edited_at?: string | null;
  edit_source?: EditSource | null;
}

export interface Evidence {
  id?: string;
  account_id: string;
  period: string; // 'YYYYMM'
  kind:
    | "log_pdf"
    | "log_csv"
    | "trip_evidence_json"
    | "settings_snapshot_json"
    | "manifest_json"
    | "readme_txt"
    | "zip";
  r2_uri: string;
  sha256: string;
  retain_until: string; // ISO8601 +7年
}

export interface AdminAuditLog {
  id?: string;
  admin_id: string;
  action: AdminAction;
  target_account_id: string;
  ts: string;
  details: Record<string, unknown>;
}

/**
 * 判定アルゴリズムの入力
 */
export interface JudgmentInput {
  /** 当日（local time）の日付 'YYYY-MM-DD' */
  date: string;
  /** 当日 LocationStay の配列（時系列順） */
  stays: LocationStay[];
  /** アカウント設定 */
  setting: AccountSetting;
}

/**
 * 判定アルゴリズムの出力
 */
export interface JudgmentResult {
  /** 出張に該当する場合の Trip 候補（該当しない場合 null） */
  trip: Omit<Trip, "destination_label" | "visited_areas" | "purpose" | "id" | "updated_at"> | null;
  /** デバッグ用: エリア分類した滞在群 */
  classifiedStays: ClassifiedStay[];
  /** Trip 化の元になった OUT セット（destination_label / visited_areas のジオコーディングに使用） */
  longestOutSet?: ClassifiedStay[];
  /**
   * 休日/祝日 + 設定により、新規 Trip を auto-excluded として保存すべきか
   * （既存 Trip の is_excluded は run-judgment 側で保持される）
   */
  autoExcluded: boolean;
  /** auto-excluded の理由（祝日 / 休日）。autoExcluded=false のときは null */
  autoExcludeReason: string | null;
  /** デバッグ用: スキップ理由（trip=null のとき） */
  skipReason?:
    | "no_out_stays"
    | "below_hours_threshold"
    | "below_km_threshold";
}

export type AreaClass = "WORK" | "HOME" | "OUT";

export interface ClassifiedStay extends LocationStay {
  area: AreaClass;
  /** 勤務地中心からの距離(km) */
  distance_from_work_km: number;
}
