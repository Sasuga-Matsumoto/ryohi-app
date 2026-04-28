"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import LocationPicker from "@/components/LocationPicker";

type Setting = {
  work_lat: number | null;
  work_lng: number | null;
  work_radius_m: number;
  home_lat: number | null;
  home_lng: number | null;
  home_radius_m: number;
  trip_definition_type: "hours" | "km";
  trip_threshold_hours: number;
  trip_threshold_km: number;
  business_hours_start: string;
  business_hours_end: string;
  include_holidays: boolean;
  include_weekends: boolean;
  default_purpose: string;
};

const DEFAULTS: Setting = {
  work_lat: 35.681,
  work_lng: 139.766,
  work_radius_m: 1000,
  home_lat: 35.625,
  home_lng: 139.725,
  home_radius_m: 1000,
  trip_definition_type: "hours",
  trip_threshold_hours: 4,
  trip_threshold_km: 30,
  business_hours_start: "09:00",
  business_hours_end: "18:00",
  include_holidays: false,
  include_weekends: false,
  default_purpose: "客先訪問",
};

export default function SettingsForm({ initial }: { initial: Setting | null }) {
  const router = useRouter();
  const [s, setS] = useState<Setting>(() => ({
    ...DEFAULTS,
    ...(initial ?? {}),
    business_hours_start: (initial?.business_hours_start ?? DEFAULTS.business_hours_start).slice(0, 5),
    business_hours_end: (initial?.business_hours_end ?? DEFAULTS.business_hours_end).slice(0, 5),
  }));
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);

  const update = <K extends keyof Setting>(k: K, v: Setting[K]) =>
    setS((prev) => ({ ...prev, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const res = await fetch("/api/account-settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(s),
    });

    setLoading(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setMessage({ type: "error", text: body.error ?? "保存失敗" });
      return;
    }

    setMessage({ type: "ok", text: "✓ 保存しました" });
    router.refresh();
  };

  return (
    <form
      onSubmit={handleSubmit}
      style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 720 }}
    >
      {/* 自宅 */}
      <section className="card">
        <h2 style={{ fontSize: "1.05rem", marginBottom: 12 }}>📍 自宅</h2>
        <LocationPicker
          label="自宅"
          lat={s.home_lat}
          lng={s.home_lng}
          radiusM={s.home_radius_m}
          onChange={(lat, lng) => {
            update("home_lat", lat);
            update("home_lng", lng);
          }}
        />
      </section>

      {/* 勤務地 */}
      <section className="card">
        <h2 style={{ fontSize: "1.05rem", marginBottom: 12 }}>🏢 勤務地</h2>
        <LocationPicker
          label="勤務地"
          lat={s.work_lat}
          lng={s.work_lng}
          radiusM={s.work_radius_m}
          onChange={(lat, lng) => {
            update("work_lat", lat);
            update("work_lng", lng);
          }}
        />
      </section>

      {/* 出張定義 */}
      <section className="card">
        <h2 style={{ fontSize: "1.05rem", marginBottom: 12 }}>⚙ 出張定義</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <input
              type="radio"
              checked={s.trip_definition_type === "hours"}
              onChange={() => update("trip_definition_type", "hours")}
            />
            時間で判定:
            <input
              type="number"
              min={1}
              value={s.trip_threshold_hours}
              onChange={(e) => update("trip_threshold_hours", parseInt(e.target.value))}
              className="input"
              style={{ width: 80, marginLeft: 6 }}
              disabled={s.trip_definition_type !== "hours"}
            />
            時間以上勤務地から離れた
          </label>
          <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <input
              type="radio"
              checked={s.trip_definition_type === "km"}
              onChange={() => update("trip_definition_type", "km")}
            />
            距離で判定:
            <input
              type="number"
              min={1}
              value={s.trip_threshold_km}
              onChange={(e) => update("trip_threshold_km", parseInt(e.target.value))}
              className="input"
              style={{ width: 80, marginLeft: 6 }}
              disabled={s.trip_definition_type !== "km"}
            />
            km以上離れた
          </label>
        </div>
      </section>

      {/* 業務時間 */}
      <section className="card">
        <h2 style={{ fontSize: "1.05rem", marginBottom: 12 }}>🕐 業務時間</h2>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <input
            type="time"
            value={s.business_hours_start}
            onChange={(e) => update("business_hours_start", e.target.value)}
            className="input"
            style={{ width: 120 }}
          />
          〜
          <input
            type="time"
            value={s.business_hours_end}
            onChange={(e) => update("business_hours_end", e.target.value)}
            className="input"
            style={{ width: 120 }}
          />
        </div>
      </section>

      {/* 休日設定 */}
      <section className="card">
        <h2 style={{ fontSize: "1.05rem", marginBottom: 12 }}>📅 休日設定</h2>
        <p
          style={{
            fontSize: "0.8rem",
            color: "var(--text-light)",
            marginBottom: 12,
          }}
        >
          OFFにすると該当日の出張判定をスキップします（デフォルト推奨）
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              type="checkbox"
              checked={s.include_weekends}
              onChange={(e) => update("include_weekends", e.target.checked)}
            />
            土日も出張対象に含める
          </label>
          <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              type="checkbox"
              checked={s.include_holidays}
              onChange={(e) => update("include_holidays", e.target.checked)}
            />
            日本の祝日も出張対象に含める
          </label>
        </div>
      </section>

      {/* デフォルト目的 */}
      <section className="card">
        <h2 style={{ fontSize: "1.05rem", marginBottom: 12 }}>📝 デフォルト目的</h2>
        <p
          style={{
            fontSize: "0.8rem",
            color: "var(--text-light)",
            marginBottom: 12,
          }}
        >
          自動判定された Trip の「目的」列の初期値（後から個別編集できます）
        </p>
        <input
          type="text"
          value={s.default_purpose}
          onChange={(e) => update("default_purpose", e.target.value)}
          className="input"
          placeholder="客先訪問"
        />
      </section>

      {/* 保存 */}
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? "保存中…" : "保存"}
        </button>
        {message && (
          <span
            style={{
              color:
                message.type === "ok" ? "var(--success)" : "var(--danger)",
              fontSize: "0.9rem",
            }}
          >
            {message.text}
          </span>
        )}
      </div>
    </form>
  );
}

