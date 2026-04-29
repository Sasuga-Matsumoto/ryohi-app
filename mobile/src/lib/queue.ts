/**
 * SQLite WAL queue: GPS 観測点をローカルに溜める
 *
 * track 行: pending_tracks
 * stay 行:  pending_stays（30分以上滞在確定時に挿入）
 */
import * as SQLite from "expo-sqlite";

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

export async function enqueueTracks(tracks: TrackPayload[]): Promise<void> {
  if (tracks.length === 0) return;
  const db = await getDB();
  const now = Date.now();
  await db.withTransactionAsync(async () => {
    for (const t of tracks) {
      await db.runAsync(
        "insert into pending_tracks (ts, lat, lng, accuracy, enqueued_at) values (?, ?, ?, ?, ?)",
        [t.ts, t.lat, t.lng, t.accuracy ?? null, now]
      );
    }
  });
}

export async function enqueueStay(stay: StayPayload): Promise<void> {
  const db = await getDB();
  await db.runAsync(
    "insert into pending_stays (ts_start, ts_end, lat, lng, accuracy, enqueued_at) values (?, ?, ?, ?, ?, ?)",
    [stay.ts_start, stay.ts_end, stay.lat, stay.lng, stay.accuracy ?? null, Date.now()]
  );
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
