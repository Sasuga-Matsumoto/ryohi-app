/**
 * 蓄積データを 1時間毎にサーバ送信する
 */
import pako from "pako";
import { supabase } from "./supabase";
import { API_BASE_URL } from "./config";
import {
  fetchPendingTracks,
  fetchPendingStays,
  deleteTracksByIds,
  deleteStaysByIds,
} from "./queue";

const MAX_BATCH = 1000;

async function authHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

async function postJson(
  path: string,
  body: unknown
): Promise<{ ok: boolean; status: number }> {
  const auth = await authHeader();
  if (!auth.Authorization) return { ok: false, status: 401 };
  const json = JSON.stringify(body);
  const compressed = pako.gzip(json);
  // Buffer-like を Blob に
  const blob = new Blob([compressed], { type: "application/json" });
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Content-Encoding": "gzip",
      "X-Idempotency-Key": cryptoRandomId(),
      ...auth,
    },
    body: blob,
  });
  return { ok: res.ok, status: res.status };
}

function cryptoRandomId(): string {
  // 軽量 UUID 風（idempotency 用）
  return (
    Date.now().toString(36) +
    Math.random().toString(36).slice(2, 10)
  );
}

/**
 * 未送信のデータを batch で送信
 * 失敗時は次回再送（ローカルから消さない）
 */
export async function flushQueue(): Promise<{
  sentTracks: number;
  sentStays: number;
}> {
  let sentTracks = 0;
  let sentStays = 0;

  // 1. stays（重要なので先に送信）
  const stays = await fetchPendingStays(MAX_BATCH);
  if (stays.length > 0) {
    const res = await postJson("/api/ingest/stays", {
      stays: stays.map((s) => ({
        ts_start: s.ts_start,
        ts_end: s.ts_end,
        lat: s.lat,
        lng: s.lng,
        accuracy: s.accuracy ?? undefined,
      })),
    });
    if (res.ok) {
      await deleteStaysByIds(stays.map((s) => s.id));
      sentStays = stays.length;
    } else {
      console.warn(`[sync] stays send failed: ${res.status}`);
    }
  }

  // 2. tracks
  const tracks = await fetchPendingTracks(MAX_BATCH);
  if (tracks.length > 0) {
    const res = await postJson("/api/ingest/tracks", {
      tracks: tracks.map((t) => ({
        ts: t.ts,
        lat: t.lat,
        lng: t.lng,
        accuracy: t.accuracy ?? undefined,
      })),
    });
    if (res.ok) {
      await deleteTracksByIds(tracks.map((t) => t.id));
      sentTracks = tracks.length;
    } else {
      console.warn(`[sync] tracks send failed: ${res.status}`);
    }
  }

  return { sentTracks, sentStays };
}
