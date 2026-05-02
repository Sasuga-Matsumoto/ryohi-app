/**
 * SQLite WAL queue: GPS 観測点をローカルに溜める
 *
 * track 行: pending_tracks
 * stay 行:  pending_stays（30分以上滞在確定時に挿入）
 */
import * as SQLite from "expo-sqlite";
import { recordTrack, recordStay } from "./todayStats";

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export function getDB(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync("ryohi-queue.db");
      await db.execAsync(`
        pragma journal_mode = WAL;
        create table if not exists pending_tracks (
          id integer primary key autoincrement,
          ts text not null,
          lat real not null,
          lng real not null,
          accuracy real,
          enqueued_at integer not null
        );
        create table if not exists pending_stays (
          id integer primary key autoincrement,
          ts_start text not null,
          ts_end text not null,
          lat real not null,
          lng real not null,
          accuracy real,
          enqueued_at integer not null
        );
        create index if not exists pending_tracks_ts on pending_tracks(ts);

        -- 「今日の経路マップ」用に、送信済みの点も日付単位で保持する
        -- pending_tracks は送信成功で削除されるため別テーブル
        create table if not exists daily_tracks (
          id integer primary key autoincrement,
          ts text not null,
          lat real not null,
          lng real not null,
          date_jst text not null
        );
        create index if not exists daily_tracks_date on daily_tracks(date_jst);
      `);
      return db;
    })();
  }
  return dbPromise;
}

export interface TrackPayload {
  ts: string;
  lat: number;
  lng: number;
  accuracy?: number | null;
}

export interface StayPayload {
  ts_start: string;
  ts_end: string;
  lat: number;
  lng: number;
  accuracy?: number | null;
}

function jstDateOfTs(ts: string): string {
  const d = new Date(ts);
  const jst = new Date(d.getTime() + 9 * 3600 * 1000);
  return jst.toISOString().slice(0, 10);
}

export async function enqueueTracks(tracks: TrackPayload[]): Promise<void> {
  if (tracks.length === 0) return;
  const db = await getDB();
  const now = Date.now();
  await db.withTransactionAsync(async () => {
    for (const t of tracks) {
      await db.runAsync(
        "insert into pending_tracks (ts, lat, lng, accuracy, enqueued_at) values (?, ?, ?, ?, ?)",
        [t.ts, t.lat, t.lng, t.accuracy ?? null, now],
      );
      // 経路マップ用の独立保存
      await db.runAsync(
        "insert into daily_tracks (ts, lat, lng, date_jst) values (?, ?, ?, ?)",
        [t.ts, t.lat, t.lng, jstDateOfTs(t.ts)],
      );
    }
  });
  // 「今日の記録」表示用の累積カウントを更新
  const latestTs = tracks[tracks.length - 1]?.ts;
  if (latestTs) {
    await recordTrack(tracks.length, latestTs).catch(() => {});
  }
}

/**
 * 今日（JST）の経路点を取得（経路マップ表示用）
 * 古い日付のデータは 3 日経過後に自動削除
 */
export async function fetchTodayTracks(): Promise<
  Array<{ ts: string; lat: number; lng: number }>
> {
  const db = await getDB();
  const today = new Date(Date.now() + 9 * 3600 * 1000)
    .toISOString()
    .slice(0, 10);
  const cutoff = new Date(Date.now() - 3 * 24 * 3600 * 1000 + 9 * 3600 * 1000)
    .toISOString()
    .slice(0, 10);
  // クリーンアップ
  await db.runAsync("delete from daily_tracks where date_jst < ?", [cutoff]);
  // 今日の点
  const rows = await db.getAllAsync<{
    ts: string;
    lat: number;
    lng: number;
  }>(
    "select ts, lat, lng from daily_tracks where date_jst = ? order by ts",
    [today],
  );
  return rows;
}

export async function enqueueStay(stay: StayPayload): Promise<void> {
  const db = await getDB();
  await db.runAsync(
    "insert into pending_stays (ts_start, ts_end, lat, lng, accuracy, enqueued_at) values (?, ?, ?, ?, ?, ?)",
    [stay.ts_start, stay.ts_end, stay.lat, stay.lng, stay.accuracy ?? null, Date.now()]
  );
  await recordStay().catch(() => {});
}

export async function fetchPendingTracks(limit = 1000): Promise<
  Array<TrackPayload & { id: number }>
> {
  const db = await getDB();
  const rows = await db.getAllAsync<{
    id: number;
    ts: string;
    lat: number;
    lng: number;
    accuracy: number | null;
  }>("select id, ts, lat, lng, accuracy from pending_tracks order by id limit ?", [limit]);
  return rows.map((r) => ({
    id: r.id,
    ts: r.ts,
    lat: r.lat,
    lng: r.lng,
    accuracy: r.accuracy,
  }));
}

export async function fetchPendingStays(limit = 200): Promise<
  Array<StayPayload & { id: number }>
> {
  const db = await getDB();
  const rows = await db.getAllAsync<{
    id: number;
    ts_start: string;
    ts_end: string;
    lat: number;
    lng: number;
    accuracy: number | null;
  }>(
    "select id, ts_start, ts_end, lat, lng, accuracy from pending_stays order by id limit ?",
    [limit]
  );
  return rows.map((r) => ({
    id: r.id,
    ts_start: r.ts_start,
    ts_end: r.ts_end,
    lat: r.lat,
    lng: r.lng,
    accuracy: r.accuracy,
  }));
}

export async function deleteTracksByIds(ids: number[]): Promise<void> {
  if (ids.length === 0) return;
  const db = await getDB();
  const placeholders = ids.map(() => "?").join(",");
  await db.runAsync(
    `delete from pending_tracks where id in (${placeholders})`,
    ids
  );
}

export async function deleteStaysByIds(ids: number[]): Promise<void> {
  if (ids.length === 0) return;
  const db = await getDB();
  const placeholders = ids.map(() => "?").join(",");
  await db.runAsync(
    `delete from pending_stays where id in (${placeholders})`,
    ids
  );
}

export async function pendingCount(): Promise<{
  tracks: number;
  stays: number;
}> {
  const db = await getDB();
  const t = await db.getFirstAsync<{ c: number }>(
    "select count(*) as c from pending_tracks"
  );
  const s = await db.getFirstAsync<{ c: number }>(
    "select count(*) as c from pending_stays"
  );
  return { tracks: t?.c ?? 0, stays: s?.c ?? 0 };
}
