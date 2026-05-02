/**
 * 出張判定アルゴリズムの単体テスト
 * プラン §検証手順 のテストケース 4-12 をカバー
 */

import { describe, expect, it } from "vitest";
import type { AccountSetting, LocationStay } from "@/types";
import { judgeTrip } from "./judgment";

// ─────────────────────────────────────────────────────────
// テスト用 fixtures
// ─────────────────────────────────────────────────────────

// 勤務地: 東京駅付近
const WORK = { lat: 35.681, lng: 139.766 };
// 自宅: 品川駅付近 (~7km from work)
const HOME = { lat: 35.625, lng: 139.725 };
// 渋谷: ~6km from work, OUT 扱い
const SHIBUYA = { lat: 35.658, lng: 139.701 };
// 横浜: ~30km from work
const YOKOHAMA = { lat: 35.466, lng: 139.622 };
// 千葉: ~40km from work
const CHIBA = { lat: 35.607, lng: 140.106 };
// つくば: ~55km from work
const TSUKUBA = { lat: 36.083, lng: 140.111 };

const baseSetting: AccountSetting = {
  account_id: "test-acc-1",
  work_lat: WORK.lat,
  work_lng: WORK.lng,
  work_radius_m: 1000,
  home_lat: HOME.lat,
  home_lng: HOME.lng,
  home_radius_m: 1000,
  trip_definition_type: "hours",
  trip_threshold_hours: 4,
  trip_threshold_km: 30,
  business_hours_enabled: true,
  business_hours_start: "09:00",
  business_hours_end: "18:00",
  include_holidays: false,
  include_weekends: false,
  default_purpose: "客先訪問",
};

// ヘルパー: ISO8601 (JST) 文字列生成
const ts = (date: string, hhmm: string) => `${date}T${hhmm}:00+09:00`;

const makeStay = (
  date: string,
  start: string,
  end: string,
  lat: number,
  lng: number
): LocationStay => ({
  account_id: "test-acc-1",
  ts_start: ts(date, start),
  ts_end: ts(date, end),
  lat,
  lng,
  accuracy: 20,
  source: "MOCK",
});

// ─────────────────────────────────────────────────────────
// テストケース
// ─────────────────────────────────────────────────────────

describe("時間モード平日テスト（5時間滞在 → Trip 1件）", () => {
  it("勤務地エリア外で5時間滞在すると Trip が auto_detected で生成される", () => {
    const date = "2026-04-13"; // 月曜日（平日）
    const stays = [
      makeStay(date, "06:00", "07:00", HOME.lat, HOME.lng),
      makeStay(date, "09:00", "13:00", WORK.lat, WORK.lng),
      makeStay(date, "13:30", "18:30", SHIBUYA.lat, SHIBUYA.lng), // 5h（業務時間と重なるので全時間カウント）
      makeStay(date, "19:00", "20:00", WORK.lat, WORK.lng),
      makeStay(date, "21:00", "23:00", HOME.lat, HOME.lng),
    ];

    const result = judgeTrip({ date, stays, setting: baseSetting });

    expect(result.trip).not.toBeNull();
    expect(result.trip?.status).toBe("auto_detected");
    expect(result.trip?.depart_ts).toBe(ts(date, "13:00")); // WORK 退出
    expect(result.trip?.return_ts).toBe(ts(date, "19:00")); // WORK 到着
    expect(result.trip?.total_minutes).toBe(300); // 5h = OUT 滞在 13:30-18:30
    expect(result.trip?.is_excluded).toBe(false);
  });
});

describe("時間モード閾値未満テスト（3時間滞在 → Trip 0件）", () => {
  it("勤務地エリア外で3時間しか滞在しないと Trip 生成なし", () => {
    const date = "2026-04-13";
    const stays = [
      makeStay(date, "09:00", "13:00", WORK.lat, WORK.lng),
      makeStay(date, "13:30", "16:30", SHIBUYA.lat, SHIBUYA.lng), // 3h
      makeStay(date, "17:00", "18:00", WORK.lat, WORK.lng),
    ];

    const result = judgeTrip({ date, stays, setting: baseSetting });
    expect(result.trip).toBeNull();
    expect(result.skipReason).toBe("below_hours_threshold");
  });
});

describe("距離モードテスト（30km設定で55km地点）→ Trip 1件", () => {
  it("距離モードで閾値超え地点に滞在すると Trip 生成", () => {
    const date = "2026-04-13";
    const setting = { ...baseSetting, trip_definition_type: "km" as const };
    const stays = [
      makeStay(date, "09:00", "10:00", WORK.lat, WORK.lng),
      makeStay(date, "11:00", "12:00", TSUKUBA.lat, TSUKUBA.lng), // ~55km
      makeStay(date, "14:00", "15:00", WORK.lat, WORK.lng),
    ];

    const result = judgeTrip({ date, stays, setting });
    expect(result.trip).not.toBeNull();
    expect(result.trip?.max_distance_km).toBeGreaterThan(50);
  });
});

describe("距離モード閾値未満テスト（30km設定で6km地点）→ Trip 0件", () => {
  it("距離モードで閾値未満なら Trip 生成なし", () => {
    const date = "2026-04-13";
    const setting = { ...baseSetting, trip_definition_type: "km" as const };
    const stays = [
      makeStay(date, "09:00", "10:00", WORK.lat, WORK.lng),
      makeStay(date, "11:00", "12:00", SHIBUYA.lat, SHIBUYA.lng), // ~6km
      makeStay(date, "14:00", "15:00", WORK.lat, WORK.lng),
    ];

    const result = judgeTrip({ date, stays, setting });
    expect(result.trip).toBeNull();
    expect(result.skipReason).toBe("below_km_threshold");
  });
});

describe("通勤除外テスト（自宅 → 勤務地 → 自宅）→ Trip 0件", () => {
  it("通勤のみの日は Trip 生成なし", () => {
    const date = "2026-04-13";
    const stays = [
      makeStay(date, "06:00", "07:30", HOME.lat, HOME.lng),
      makeStay(date, "09:00", "18:00", WORK.lat, WORK.lng),
      makeStay(date, "19:00", "23:00", HOME.lat, HOME.lng),
    ];

    const result = judgeTrip({ date, stays, setting: baseSetting });
    expect(result.trip).toBeNull();
  });

  it("通勤途中の OUT は除外される（HOME → OUT(駅前カフェ) → WORK → HOME）", () => {
    const date = "2026-04-13";
    const stays = [
      makeStay(date, "06:00", "07:00", HOME.lat, HOME.lng),
      // 通勤途中のカフェ滞在 (OUT) - 通勤区間に含まれるので除外されるべき
      makeStay(date, "07:30", "08:30", SHIBUYA.lat, SHIBUYA.lng),
      makeStay(date, "09:00", "18:00", WORK.lat, WORK.lng),
      makeStay(date, "19:00", "23:00", HOME.lat, HOME.lng),
    ];

    const result = judgeTrip({ date, stays, setting: baseSetting });
    expect(result.trip).toBeNull();
  });
});

describe("エリア内移動テスト（勤務地エリア内の複数地点）→ Trip 0件", () => {
  it("勤務地中心から1km以内の複数地点はすべて WORK 扱いで Trip 生成なし", () => {
    const date = "2026-04-13";
    // 全て勤務地半径1km 以内
    const nearby1 = { lat: WORK.lat + 0.005, lng: WORK.lng }; // ~0.5km
    const nearby2 = { lat: WORK.lat, lng: WORK.lng + 0.005 }; // ~0.5km

    const stays = [
      makeStay(date, "06:00", "07:00", HOME.lat, HOME.lng),
      makeStay(date, "09:00", "10:00", WORK.lat, WORK.lng),
      makeStay(date, "10:30", "12:00", nearby1.lat, nearby1.lng),
      makeStay(date, "13:00", "16:00", nearby2.lat, nearby2.lng),
      makeStay(date, "16:30", "18:00", WORK.lat, WORK.lng),
      makeStay(date, "19:00", "23:00", HOME.lat, HOME.lng),
    ];

    const result = judgeTrip({ date, stays, setting: baseSetting });
    expect(result.trip).toBeNull();
  });
});

describe("休日テスト（記録するが auto-excluded）", () => {
  it("祝日 + include_holidays=false なら Trip 生成 + is_excluded=true", () => {
    const date = "2026-04-29"; // 昭和の日（祝日）
    const stays = [
      makeStay(date, "09:00", "10:00", WORK.lat, WORK.lng),
      makeStay(date, "11:00", "17:00", SHIBUYA.lat, SHIBUYA.lng),
      makeStay(date, "18:00", "19:00", WORK.lat, WORK.lng),
    ];

    const result = judgeTrip({ date, stays, setting: baseSetting });
    expect(result.trip).not.toBeNull();
    expect(result.autoExcluded).toBe(true);
    expect(result.autoExcludeReason).toContain("祝日");
    expect(result.trip?.is_excluded).toBe(true);
    expect(result.trip?.excluded_reason).toContain("祝日");
  });

  it("祝日 + include_holidays=true なら通常判定 + is_excluded=false", () => {
    const date = "2026-04-29";
    const setting = { ...baseSetting, include_holidays: true };
    const stays = [
      makeStay(date, "09:00", "10:00", WORK.lat, WORK.lng),
      makeStay(date, "11:00", "17:00", SHIBUYA.lat, SHIBUYA.lng),
      makeStay(date, "18:00", "19:00", WORK.lat, WORK.lng),
    ];

    const result = judgeTrip({ date, stays, setting });
    expect(result.trip).not.toBeNull();
    expect(result.autoExcluded).toBe(false);
    expect(result.autoExcludeReason).toBeNull();
    expect(result.trip?.is_excluded).toBe(false);
  });

  it("土曜日 + include_weekends=false なら Trip 生成 + is_excluded=true", () => {
    const date = "2026-04-11"; // 土曜
    const stays = [
      makeStay(date, "09:00", "10:00", WORK.lat, WORK.lng),
      makeStay(date, "11:00", "17:00", SHIBUYA.lat, SHIBUYA.lng),
    ];

    const result = judgeTrip({ date, stays, setting: baseSetting });
    expect(result.trip).not.toBeNull();
    expect(result.autoExcluded).toBe(true);
    expect(result.autoExcludeReason).toContain("休日");
    expect(result.trip?.is_excluded).toBe(true);
  });

  it("土曜日 + include_weekends=true なら is_excluded=false", () => {
    const date = "2026-04-11";
    const setting = { ...baseSetting, include_weekends: true };
    const stays = [
      makeStay(date, "09:00", "10:00", WORK.lat, WORK.lng),
      makeStay(date, "11:00", "17:00", SHIBUYA.lat, SHIBUYA.lng),
    ];

    const result = judgeTrip({ date, stays, setting });
    expect(result.trip).not.toBeNull();
    expect(result.autoExcluded).toBe(false);
    expect(result.trip?.is_excluded).toBe(false);
  });
});

describe("業務時間設定なし（business_hours_enabled=false）", () => {
  it("業務時間外の OUT 滞在も対象になる（深夜23:00-翌5:00ではなく日中の話）", () => {
    const date = "2026-04-13";
    const setting = { ...baseSetting, business_hours_enabled: false };
    const stays = [
      makeStay(date, "09:00", "18:00", WORK.lat, WORK.lng),
      // 19:00以降の OUT 滞在 5h（業務時間内なら除外されるが、enabled=false なら対象）
      makeStay(date, "19:00", "23:59", SHIBUYA.lat, SHIBUYA.lng),
    ];

    const result = judgeTrip({ date, stays, setting });
    expect(result.trip).not.toBeNull();
    expect(result.trip?.depart_ts).toBe(ts(date, "18:00"));
    // OUT 滞在 19:00-23:59 = 4h59m = 299分
    expect(result.trip?.total_minutes).toBe(299);
  });

  it("業務時間と重なりゼロの OUT も対象（5:00-9:00の4h、WORK挟み）", () => {
    const date = "2026-04-13";
    const setting = { ...baseSetting, business_hours_enabled: false };
    const stays = [
      makeStay(date, "02:00", "04:00", WORK.lat, WORK.lng),
      // 5:00-9:00 の OUT 4h（業務時間 9-18 と重なり 0min → enabled=true なら除外）
      makeStay(date, "05:00", "09:00", SHIBUYA.lat, SHIBUYA.lng),
      makeStay(date, "10:00", "12:00", WORK.lat, WORK.lng),
    ];

    const result = judgeTrip({ date, stays, setting });
    expect(result.trip).not.toBeNull();
    expect(result.trip?.total_minutes).toBe(240); // 4h
  });
});

describe("業務時間フィルタ（完全業務時間外なら除外、少しでも重なれば全時間カウント）", () => {
  it("業務時間外（19:00-23:59）の OUT 滞在は完全に除外される（重なりゼロ）", () => {
    const date = "2026-04-13";
    const stays = [
      makeStay(date, "09:00", "18:00", WORK.lat, WORK.lng),
      makeStay(date, "19:00", "23:59", SHIBUYA.lat, SHIBUYA.lng),
    ];

    const result = judgeTrip({ date, stays, setting: baseSetting });
    expect(result.trip).toBeNull();
  });

  it("業務時間と少しでも重なれば OUT 滞在は対象に含まれる（16:00-22:00 → 滞在 6h）", () => {
    const date = "2026-04-13";
    const stays = [
      makeStay(date, "09:00", "15:00", WORK.lat, WORK.lng),
      makeStay(date, "16:00", "22:00", SHIBUYA.lat, SHIBUYA.lng), // 16:00-18:00 が業務時間と重なる
    ];

    const result = judgeTrip({ date, stays, setting: baseSetting });
    expect(result.trip).not.toBeNull();
    expect(result.trip?.depart_ts).toBe(ts(date, "15:00"));
    expect(result.trip?.return_ts).toBe(ts(date, "22:00"));
    expect(result.trip?.total_minutes).toBe(360); // 6h = OUT 滞在 16:00-22:00
  });
});

describe("複数訪問先テスト（同一セット内）", () => {
  it("WORK を挟まずに連続する複数 OUT を1セットに集約する", () => {
    const date = "2026-04-13";
    const stays = [
      makeStay(date, "09:00", "12:00", WORK.lat, WORK.lng),
      // 渋谷 2h
      makeStay(date, "13:00", "15:00", SHIBUYA.lat, SHIBUYA.lng),
      // 新宿 2h（WORK を挟まないので同じセット）
      makeStay(date, "16:00", "18:00", 35.690, 139.700),
      makeStay(date, "19:00", "20:00", WORK.lat, WORK.lng),
    ];

    const result = judgeTrip({ date, stays, setting: baseSetting });

    expect(result.trip).not.toBeNull();
    expect(result.trip?.total_minutes).toBe(240); // 2h + 2h = 4h（OUT 滞在累積）
    expect(result.longestOutSet?.length).toBe(2);
    expect(result.trip?.depart_ts).toBe(ts(date, "12:00"));
    expect(result.trip?.return_ts).toBe(ts(date, "19:00"));
  });

  it("WORK を挟むと別セットになり、最長セットが採用される", () => {
    const date = "2026-04-13";
    const stays = [
      makeStay(date, "09:00", "09:30", WORK.lat, WORK.lng),
      makeStay(date, "10:00", "15:00", SHIBUYA.lat, SHIBUYA.lng), // セット1: 5h
      makeStay(date, "15:30", "16:30", WORK.lat, WORK.lng), // セット切る
      makeStay(date, "17:00", "17:30", YOKOHAMA.lat, YOKOHAMA.lng), // セット2: 0.5h
      makeStay(date, "18:00", "19:00", WORK.lat, WORK.lng),
    ];

    const result = judgeTrip({ date, stays, setting: baseSetting });
    expect(result.trip).not.toBeNull();
    // 最長セット = セット1（5h、Shibuya 1点）
    expect(result.trip?.total_minutes).toBe(300);
    expect(result.longestOutSet?.length).toBe(1);
    expect(result.trip?.depart_ts).toBe(ts(date, "09:30"));
    expect(result.trip?.return_ts).toBe(ts(date, "15:30"));
  });
});

describe("空配列・全 HOME・全 OUT エッジケース", () => {
  it("stays が空配列なら Trip 生成なし", () => {
    const result = judgeTrip({
      date: "2026-04-13",
      stays: [],
      setting: baseSetting,
    });
    expect(result.trip).toBeNull();
  });

  it("全 HOME（自宅で1日中）なら Trip 生成なし", () => {
    const date = "2026-04-13";
    const stays = [makeStay(date, "00:00", "23:59", HOME.lat, HOME.lng)];
    const result = judgeTrip({ date, stays, setting: baseSetting });
    expect(result.trip).toBeNull();
  });

  it("WORK が無く OUT 7h（直行直帰の出張日）→ Trip 1件", () => {
    const date = "2026-04-13";
    const stays = [
      makeStay(date, "07:00", "08:00", HOME.lat, HOME.lng),
      makeStay(date, "09:30", "16:30", YOKOHAMA.lat, YOKOHAMA.lng), // 7h
      makeStay(date, "18:00", "23:00", HOME.lat, HOME.lng),
    ];

    const result = judgeTrip({ date, stays, setting: baseSetting });
    expect(result.trip).not.toBeNull();
    expect(result.trip?.total_minutes).toBe(420); // 7h = OUT 滞在 09:30-16:30
    expect(result.trip?.depart_ts).toBe(ts(date, "08:00")); // HOME 退出
    expect(result.trip?.return_ts).toBe(ts(date, "18:00")); // HOME 到着
  });
});
