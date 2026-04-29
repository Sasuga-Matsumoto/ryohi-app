/**
 * バックグラウンドタスク定義 (TaskManager)
 *
 * - geofence-task: 勤務地/自宅の境界を OS が検知 → 高頻度 GPS の ON/OFF
 * - hf-gps-task:   高頻度 GPS の取得点を SQLite に蓄積
 * - flush-queue-task: 1時間毎に SQLite キューをサーバへ送信
 *
 * 定義は App 起動時に1度だけ呼ぶ
 */
import * as TaskManager from "expo-task-manager";
import * as Location from "expo-location";
import * as BackgroundFetch from "expo-background-fetch";
import {
  TASK_GEOFENCE,
  TASK_HF_GPS,
  TASK_FLUSH_QUEUE,
  HF_GPS_DISTANCE_INTERVAL_M,
  HF_GPS_TIME_INTERVAL_MS,
  HF_GPS_DEFERRED_INTERVAL_MS,
} from "./config";
import { enqueueTracks } from "./queue";
import { flushQueue } from "./sync";

let tasksDefined = false;

export function defineTasks() {
  if (tasksDefined) return;
  tasksDefined = true;

  // ===== Geofence event =====
  TaskManager.defineTask(TASK_GEOFENCE, async ({ data, error }) => {
    if (error) {
      console.warn("[geofence-task] error", error);
      return;
    }
    const { eventType, region } = data as {
      eventType: Location.GeofencingEventType;
      region: Location.LocationRegion;
    };
    console.log(`[geofence-task] ${eventType} ${region.identifier}`);

    if (eventType === Location.GeofencingEventType.Exit) {
      // エリアを出た → 高頻度 GPS 起動
      await startHighFrequencyGps();
    } else if (eventType === Location.GeofencingEventType.Enter) {
      // エリアに戻った → 高頻度 GPS 停止
      await stopHighFrequencyGps();
    }
  });

  // ===== High frequency GPS =====
  TaskManager.defineTask(TASK_HF_GPS, async ({ data, error }) => {
    if (error) {
      console.warn("[hf-gps-task] error", error);
      return;
    }
    const { locations } = data as { locations: Location.LocationObject[] };
    if (!locations || locations.length === 0) return;

    const tracks = locations
      .filter((l) => (l.coords.accuracy ?? Infinity) <= 50) // 精度フィルタ
      .map((l) => ({
        ts: new Date(l.timestamp).toISOString(),
        lat: l.coords.latitude,
        lng: l.coords.longitude,
        accuracy: l.coords.accuracy ?? null,
      }));
    if (tracks.length > 0) {
      await enqueueTracks(tracks);
    }
  });

  // ===== Flush queue (1h batch upload) =====
  TaskManager.defineTask(TASK_FLUSH_QUEUE, async () => {
    try {
      const result = await flushQueue();
      console.log(
        `[flush-queue-task] sent tracks=${result.sentTracks} stays=${result.sentStays}`
      );
      return result.sentTracks > 0 || result.sentStays > 0
        ? BackgroundFetch.BackgroundFetchResult.NewData
        : BackgroundFetch.BackgroundFetchResult.NoData;
    } catch (e) {
      console.warn("[flush-queue-task] error", e);
      return BackgroundFetch.BackgroundFetchResult.Failed;
    }
  });
}

export async function startHighFrequencyGps() {
  const isRunning = await Location.hasStartedLocationUpdatesAsync(TASK_HF_GPS);
  if (isRunning) return;

  await Location.startLocationUpdatesAsync(TASK_HF_GPS, {
    accuracy: Location.Accuracy.High,
    distanceInterval: HF_GPS_DISTANCE_INTERVAL_M,
    timeInterval: HF_GPS_TIME_INTERVAL_MS,
    deferredUpdatesInterval: HF_GPS_DEFERRED_INTERVAL_MS,
    pausesUpdatesAutomatically: true,
    activityType: Location.ActivityType.OtherNavigation,
    showsBackgroundLocationIndicator: false,
    foregroundService: {
      notificationTitle: "出張記録中",
      notificationBody: "勤務地・自宅エリア外の移動を記録中です",
      notificationColor: "#3366FF",
    },
  });
}

export async function stopHighFrequencyGps() {
  const isRunning = await Location.hasStartedLocationUpdatesAsync(TASK_HF_GPS);
  if (!isRunning) return;
  await Location.stopLocationUpdatesAsync(TASK_HF_GPS);
}
