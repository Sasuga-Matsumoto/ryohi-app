/**
 * 出張判定アルゴリズム（純関数）
 * プラン §4 出張判定アルゴリズム の実装
 *
 * 入力: 1日分の LocationStay 配列 + AccountSetting
 * 出力: Trip 候補 1件（または null = 出張該当なし）
 */

import * as holidayJp from "@holiday-jp/holiday_jp";
import type {
  AccountSetting,
  AreaClass,
  ClassifiedStay,
  JudgmentInput,
  JudgmentResult,
  LocationStay,
} from "@/types";
import { haversineKm } from "./geo";

const JST_OFFSET = "+09:00";

export function judgeTrip(input: JudgmentInput): JudgmentResult {
  const { date, stays, setting } = input;

  // Step 1: 休日/祝日除外
  if (isExcludedDay(date, setting)) {
    return { trip: null, classifiedStays: [], skipReason: "holiday_excluded" };
  }

  // Step 2: エリア分類
  const classified = stays.map((s) => classifyStay(s, setting));

  // Step 3: 通勤区間 index を特定
  const commuteIndexes = computeCommuteIndexes(classified);

  // Step 4-5: 連続 OUT セットを構築（通勤除外＆業務時間内 overlap 0 のものは除外）
  const sets = buildOutSets(classified, commuteIndexes, setting);

  if (sets.length === 0) {
    return { trip: null, classifiedStays: classified, skipReason: "no_out_stays" };
  }

  // Step 5: 最長セットを採用（業務時間内 overlap 累積で比較）
  const longest = sets.reduce((a, b) => (a.totalMinutes >= b.totalMinutes ? a : b));

  // Step 6: モード分岐判定
  if (setting.trip_definition_type === "hours") {
    if (longest.totalMinutes / 60 < setting.trip_threshold_hours) {
      return {
        trip: null,
        classifiedStays: classified,
        longestOutSet: longest.set,
        skipReason: "below_hours_threshold",
      };
    }
  } else {
    if (longest.maxDistanceKm < setting.trip_threshold_km) {
      return {
        trip: null,
        classifiedStays: classified,
        longestOutSet: longest.set,
        skipReason: "below_km_threshold",
      };
    }
  }

  // Step 7-8: depart/return 時刻決定 + Trip 構築
  const { depart_ts, return_ts } = findBoundaryTimestamps(classified, longest.set);

  return {
    trip: {
      account_id: setting.account_id,
      date,
      depart_ts,
      return_ts,
      total_minutes: Math.round(longest.totalMinutes),
      max_distance_km: parseFloat(longest.maxDistanceKm.toFixed(2)),
      status: "auto_detected",
      is_excluded: false,
      excluded_reason: null,
    },
    classifiedStays: classified,
    longestOutSet: longest.set,
  };
}

// ─────────────────────────────────────────────────────────
// ヘルパー
// ─────────────────────────────────────────────────────────

function isExcludedDay(date: string, setting: AccountSetting): boolean {
  // 'YYYY-MM-DD' を timezone 非依存に解釈する
  // 正午 UTC を基準にすることで、ほとんどの timezone でローカル日付が同一日になる
  const [y, m, d] = date.split("-").map(Number);
  const checkDate = new Date(Date.UTC(y, m - 1, d, 12));
  const day = checkDate.getUTCDay();
  const isWeekend = day === 0 || day === 6;
  const isHoliday = holidayJp.isHoliday(checkDate);

  if (isWeekend && !setting.include_weekends) return true;
  if (isHoliday && !setting.include_holidays) return true;
  return false;
}

function classifyStay(stay: LocationStay, setting: AccountSetting): ClassifiedStay {
  const distWorkKm = haversineKm(stay.lat, stay.lng, setting.work_lat, setting.work_lng);
  const distHomeKm = haversineKm(stay.lat, stay.lng, setting.home_lat, setting.home_lng);

  let area: AreaClass;
  if (distWorkKm * 1000 <= setting.work_radius_m) {
    area = "WORK";
  } else if (distHomeKm * 1000 <= setting.home_radius_m) {
    area = "HOME";
  } else {
    area = "OUT";
  }

  return { ...stay, area, distance_from_work_km: distWorkKm };
}

interface CommuteIndexes {
  morningStart: number;
  morningEnd: number;
  eveningStart: number;
  eveningEnd: number;
}

function computeCommuteIndexes(classified: ClassifiedStay[]): CommuteIndexes {
  const areas = classified.map((c) => c.area);
  const firstHomeIdx = areas.indexOf("HOME");
  const firstWorkIdx = areas.indexOf("WORK");
  const lastHomeIdx = areas.lastIndexOf("HOME");
  const lastWorkIdx = areas.lastIndexOf("WORK");

  // 朝の通勤: 最初の HOME → 最初の WORK の間
  const morningStart =
    firstHomeIdx >= 0 && firstWorkIdx > firstHomeIdx ? firstHomeIdx + 1 : -1;
  const morningEnd = firstWorkIdx > firstHomeIdx ? firstWorkIdx - 1 : -1;

  // 夜の退勤: 最後の WORK → 最後の HOME の間
  const eveningStart =
    lastWorkIdx >= 0 && lastHomeIdx > lastWorkIdx ? lastWorkIdx + 1 : -1;
  const eveningEnd = lastHomeIdx > lastWorkIdx ? lastHomeIdx - 1 : -1;

  return { morningStart, morningEnd, eveningStart, eveningEnd };
}

function isCommuteIdx(idx: number, c: CommuteIndexes): boolean {
  return (
    (c.morningStart >= 0 && idx >= c.morningStart && idx <= c.morningEnd) ||
    (c.eveningStart >= 0 && idx >= c.eveningStart && idx <= c.eveningEnd)
  );
}

interface OutSet {
  set: ClassifiedStay[];
  totalMinutes: number; // 業務時間内 overlap 累積
  maxDistanceKm: number;
}

function buildOutSets(
  classified: ClassifiedStay[],
  commute: CommuteIndexes,
  setting: AccountSetting
): OutSet[] {
  const sets: ClassifiedStay[][] = [];
  let current: ClassifiedStay[] = [];

  for (let i = 0; i < classified.length; i++) {
    const c = classified[i];
    if (c.area === "WORK") {
      if (current.length > 0) {
        sets.push(current);
        current = [];
      }
      continue;
    }
    if (c.area === "OUT") {
      // 通勤区間に含まれる場合は除外
      if (isCommuteIdx(i, commute)) continue;
      // 業務時間内 overlap が 0 分なら除外
      if (overlapMinutesWithBusinessHours(c, setting) <= 0) continue;
      current.push(c);
    }
    // HOME は OUT セットを切らない（プラン §4 step 5 「WORK 滞在を挟まずに連続する」）
  }
  if (current.length > 0) sets.push(current);

  return sets.map((set) => ({
    set,
    totalMinutes: set.reduce(
      (sum, s) => sum + overlapMinutesWithBusinessHours(s, setting),
      0
    ),
    maxDistanceKm: Math.max(...set.map((s) => s.distance_from_work_km)),
  }));
}

/**
 * stay の ts_start〜ts_end と業務時間（business_hours_start〜end）との重複分(min)
 * 業務時間外の滞在は 0 が返る
 */
export function overlapMinutesWithBusinessHours(
  stay: LocationStay,
  setting: AccountSetting
): number {
  const dayStr = stay.ts_start.slice(0, 10); // 'YYYY-MM-DD'
  const businessStart = new Date(
    `${dayStr}T${setting.business_hours_start}:00${JST_OFFSET}`
  );
  const businessEnd = new Date(
    `${dayStr}T${setting.business_hours_end}:00${JST_OFFSET}`
  );
  const stayStart = new Date(stay.ts_start);
  const stayEnd = new Date(stay.ts_end);

  const overlapStart = stayStart.getTime() > businessStart.getTime()
    ? stayStart
    : businessStart;
  const overlapEnd = stayEnd.getTime() < businessEnd.getTime() ? stayEnd : businessEnd;

  const ms = overlapEnd.getTime() - overlapStart.getTime();
  return Math.max(0, ms / 60000);
}

function findBoundaryTimestamps(
  classified: ClassifiedStay[],
  set: ClassifiedStay[]
): { depart_ts: string; return_ts: string } {
  const firstOut = set[0];
  const lastOut = set[set.length - 1];
  const firstIdx = classified.indexOf(firstOut);
  const lastIdx = classified.indexOf(lastOut);

  // 直前の WORK or HOME → 退出時刻
  let depart_ts = firstOut.ts_start;
  for (let i = firstIdx - 1; i >= 0; i--) {
    if (classified[i].area === "WORK" || classified[i].area === "HOME") {
      depart_ts = classified[i].ts_end;
      break;
    }
  }

  // 直後の WORK or HOME → 到着時刻
  let return_ts = lastOut.ts_end;
  for (let i = lastIdx + 1; i < classified.length; i++) {
    if (classified[i].area === "WORK" || classified[i].area === "HOME") {
      return_ts = classified[i].ts_start;
      break;
    }
  }

  return { depart_ts, return_ts };
}
