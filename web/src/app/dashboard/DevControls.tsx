"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  workLat: number;
  workLng: number;
  homeLat: number;
  homeLng: number;
};

const todayJst = () => {
  const now = new Date();
  // JST にシフトしてから YYYY-MM-DD
  const jst = new Date(now.getTime() + 9 * 3600 * 1000);
  return jst.toISOString().slice(0, 10);
};

export default function DevControls({ workLat, workLng, homeLat, homeLng }: Props) {
  const router = useRouter();
  const [date, setDate] = useState(todayJst());
  const [scenario, setScenario] = useState<"trip5h" | "trip3h" | "commute" | "tsukuba" | "weekend">(
    "trip5h"
  );
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const ts = (d: string, hhmm: string) => `${d}T${hhmm}:00+09:00`;

  const buildStays = () => {
    const SHIBUYA = { lat: 35.658, lng: 139.701 };
    const TSUKUBA = { lat: 36.083, lng: 140.111 };

    if (scenario === "trip5h") {
      // 平日5時間出張: WORK→OUT(渋谷5h)→WORK
      return [
        { ts_start: ts(date, "06:00"), ts_end: ts(date, "07:00"), lat: homeLat, lng: homeLng },
        { ts_start: ts(date, "09:00"), ts_end: ts(date, "13:00"), lat: workLat, lng: workLng },
        { ts_start: ts(date, "13:30"), ts_end: ts(date, "18:30"), lat: SHIBUYA.lat, lng: SHIBUYA.lng },
        { ts_start: ts(date, "19:00"), ts_end: ts(date, "20:00"), lat: workLat, lng: workLng },
        { ts_start: ts(date, "21:00"), ts_end: ts(date, "23:00"), lat: homeLat, lng: homeLng },
      ];
    }
    if (scenario === "trip3h") {
      // 3h は閾値未満で Trip 生成されない
      return [
        { ts_start: ts(date, "09:00"), ts_end: ts(date, "13:00"), lat: workLat, lng: workLng },
        { ts_start: ts(date, "13:30"), ts_end: ts(date, "16:30"), lat: SHIBUYA.lat, lng: SHIBUYA.lng },
        { ts_start: ts(date, "17:00"), ts_end: ts(date, "18:00"), lat: workLat, lng: workLng },
      ];
    }
    if (scenario === "commute") {
      // 通勤のみ
      return [
        { ts_start: ts(date, "06:00"), ts_end: ts(date, "07:30"), lat: homeLat, lng: homeLng },
        { ts_start: ts(date, "09:00"), ts_end: ts(date, "18:00"), lat: workLat, lng: workLng },
        { ts_start: ts(date, "19:00"), ts_end: ts(date, "23:00"), lat: homeLat, lng: homeLng },
      ];
    }
    if (scenario === "tsukuba") {
      // 距離モードでも引っかかる遠地（55km地点）
      return [
        { ts_start: ts(date, "09:00"), ts_end: ts(date, "10:00"), lat: workLat, lng: workLng },
        { ts_start: ts(date, "11:00"), ts_end: ts(date, "16:00"), lat: TSUKUBA.lat, lng: TSUKUBA.lng },
        { ts_start: ts(date, "17:00"), ts_end: ts(date, "18:00"), lat: workLat, lng: workLng },
      ];
    }
    if (scenario === "weekend") {
      // 休日扱いの祝日に出張（include_holidays=false なら除外）
      return [
        { ts_start: ts(date, "09:00"), ts_end: ts(date, "10:00"), lat: workLat, lng: workLng },
        { ts_start: ts(date, "11:00"), ts_end: ts(date, "17:00"), lat: SHIBUYA.lat, lng: SHIBUYA.lng },
      ];
    }
    return [];
  };

  const handleInject = async () => {
    setLoading(true);
    setMessage(null);

    // 1. inject stays
    const injectRes = await fetch("/api/dev/inject-stays", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        replaceForDay: date,
        stays: buildStays(),
      }),
    });
    if (!injectRes.ok) {
      const b = await injectRes.json().catch(() => ({}));
      setMessage(`❌ 投入失敗: ${b.error ?? injectRes.status}`);
      setLoading(false);
      return;
    }
    const injected = await injectRes.json();

    // 2. run judgment
    const judgeRes = await fetch("/api/dev/run-judgment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date }),
    });
    if (!judgeRes.ok) {
      const b = await judgeRes.json().catch(() => ({}));
      setMessage(`✓ 投入 ${injected.inserted} 件 / ❌ 判定失敗: ${b.error}`);
      setLoading(false);
      return;
    }
    const judged = await judgeRes.json();

    if (judged.trip) {
      setMessage(
        `✓ 投入 ${injected.inserted} 件 / Trip 生成 (${(judged.trip.total_minutes / 60).toFixed(1)}h, ${judged.trip.max_distance_km}km)`
      );
    } else {
      setMessage(`✓ 投入 ${injected.inserted} 件 / Trip 生成なし: ${judged.skipReason ?? "?"}`);
    }
    setLoading(false);
    router.refresh();
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: "0.85rem" }}>
          日付:
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="input"
            style={{ width: 160 }}
          />
        </label>
        <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: "0.85rem" }}>
          シナリオ:
          <select
            value={scenario}
            onChange={(e) => setScenario(e.target.value as typeof scenario)}
            className="input"
            style={{ width: 280 }}
          >
            <option value="trip5h">出張5h（渋谷 / Trip 生成想定）</option>
            <option value="trip3h">出張3h（閾値未満 / Trip なし想定）</option>
            <option value="commute">通勤のみ（Trip なし想定）</option>
            <option value="tsukuba">遠地55km（つくば / 距離モードで Trip）</option>
            <option value="weekend">休日外出（include_holidays=false で除外想定）</option>
          </select>
        </label>
      </div>
      <div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={handleInject}
          disabled={loading}
        >
          {loading ? "実行中…" : "モック投入 + 判定実行"}
        </button>
      </div>
      {message && (
        <p style={{ fontSize: "0.85rem", color: message.startsWith("❌") ? "var(--danger)" : "var(--success)" }}>
          {message}
        </p>
      )}
    </div>
  );
}
