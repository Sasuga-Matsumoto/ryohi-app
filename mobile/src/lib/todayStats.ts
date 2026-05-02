/**
 * 今日の記録統計（HomeScreen 表示用）
 *
 * pending_tracks は送信後に削除されるため、累積件数は AsyncStorage で別管理する。
 * 日付（JST）が変わったら自動リセット。
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "today_stats_v1";

export interface TodayStats {
  date: string; // YYYY-MM-DD (JST)
  trackCount: number;
  stayCount: number;
  lastReceivedAt: string | null; // ISO8601
}

function todayJst(): string {
  const now = Date.now();
  const jst = new Date(now + 9 * 3600 * 1000);
  return jst.toISOString().slice(0, 10);
}

async function loadRaw(): Promise<TodayStats | null> {
  try {
    const v = await AsyncStorage.getItem(KEY);
    if (!v) return null;
    const parsed = JSON.parse(v) as TodayStats;
    if (
      typeof parsed.date !== "string" ||
      typeof parsed.trackCount !== "number" ||
      typeof parsed.stayCount !== "number"
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

async function save(s: TodayStats): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(s));
  } catch (e) {
    console.warn("[todayStats] save failed", e);
  }
}

/**
 * 今日の統計を取得（日付が変わってたらリセットして返す）
 */
export async function getTodayStats(): Promise<TodayStats> {
  const today = todayJst();
  const raw = await loadRaw();
  if (!raw || raw.date !== today) {
    const fresh: TodayStats = {
      date: today,
      trackCount: 0,
      stayCount: 0,
      lastReceivedAt: null,
    };
    await save(fresh);
    return fresh;
  }
  return raw;
}

export async function recordTrack(count: number, latestTs: string): Promise<void> {
  const cur = await getTodayStats();
  cur.trackCount += count;
  cur.lastReceivedAt = latestTs;
  await save(cur);
}

export async function recordStay(): Promise<void> {
  const cur = await getTodayStats();
  cur.stayCount += 1;
  await save(cur);
}
