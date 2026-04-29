"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import LocationPicker from "@/components/LocationPicker";
import {
  HomeIcon,
  BuildingIcon,
  MapPinIcon,
  ClockIcon,
  CalendarIcon,
  FileTextIcon,
  CheckIcon,
} from "@/components/Icon";

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
  work_radius_m: 100,
  home_lat: 35.625,
  home_lng: 139.725,
  home_radius_m: 100,
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
      setMessage({ type: "error", text: body.error ?? "保存に失敗しました" });
      return;
    }

    setMessage({ type: "ok", text: "保存しました" });
    router.refresh();
  };

  return (
    <form onSubmit={handleSubmit} className="stack-lg" style={{ maxWidth: 760 }}>
      {/* 自宅 */}
      <section className="card">
        <h2 className="section-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <HomeIcon size={18} /> 自宅
        </h2>
        <LocationPicker
          label="自宅"
          lat={s.home_lat}
          lng={s.home_lng}
          radiusM={100}
          onChange={(lat, lng) => {
            update("home_lat", lat);
            update("home_lng", lng);
          }}
        />
      </section>

      {/* 勤務地 */}
      <section className="card">
        <h2 className="section-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <BuildingIcon size={18} /> 勤務地
        </h2>
        <LocationPicker
          label="勤務地"
          lat={s.work_lat}
          lng={s.work_lng}
          radiusM={100}
          onChange={(lat, lng) => {
            update("work_lat", lat);
            update("work_lng", lng);
          }}
        />
      </section>

      {/* 出張定義 */}
      <section className="card">
        <h2 className="section-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <MapPinIcon size={18} /> 出張定義
        </h2>
        <p className="helper" style={{ marginBottom: "var(--space-4)" }}>
          どのような状態を「出張」とみなすかを設定します
        </p>
        <div className="stack-sm">
          <label
            style={{
              display: "flex",
              gap: "var(--space-3)",
              alignItems: "center",
              padding: "var(--space-3)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-md)",
              cursor: "pointer",
              background: s.trip_definition_type === "hours" ? "var(--info-bg)" : "transparent",
            }}
          >
            <input
              type="radio"
              checked={s.trip_definition_type === "hours"}
              onChange={() => update("trip_definition_type", "hours")}
            />
            <span>時間で判定</span>
            <span className="row" style={{ marginLeft: "auto", gap: "var(--space-2)" }}>
              <input
                type="number"
                min={1}
                value={s.trip_threshold_hours}
                onChange={(e) => update("trip_threshold_hours", parseInt(e.target.value) || 1)}
                className="input"
                style={{ width: 80 }}
                disabled={s.trip_definition_type !== "hours"}
              />
              <span className="text-sm text-muted">時間以上勤務地から離れた</span>
            </span>
          </label>
          <label
            style={{
              display: "flex",
              gap: "var(--space-3)",
              alignItems: "center",
              padding: "var(--space-3)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-md)",
              cursor: "pointer",
              background: s.trip_definition_type === "km" ? "var(--info-bg)" : "transparent",
            }}
          >
            <input
              type="radio"
              checked={s.trip_definition_type === "km"}
              onChange={() => update("trip_definition_type", "km")}
            />
            <span>距離で判定</span>
            <span className="row" style={{ marginLeft: "auto", gap: "var(--space-2)" }}>
              <input
                type="number"
                min={1}
                value={s.trip_threshold_km}
                onChange={(e) => update("trip_threshold_km", parseInt(e.target.value) || 1)}
                className="input"
                style={{ width: 80 }}
                disabled={s.trip_definition_type !== "km"}
              />
              <span className="text-sm text-muted">km以上離れた</span>
            </span>
          </label>
        </div>
      </section>

      {/* 業務時間 */}
      <section className="card">
        <h2 className="section-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <ClockIcon size={18} /> 業務時間
        </h2>
        <p className="helper" style={{ marginBottom: "var(--space-3)" }}>
          この時間帯外の外出は出張に含めません
        </p>
        <div className="row">
          <input
            type="time"
            value={s.business_hours_start}
            onChange={(e) => update("business_hours_start", e.target.value)}
            className="input"
            style={{ width: 140 }}
          />
          <span className="text-muted">〜</span>
          <input
            type="time"
            value={s.business_hours_end}
            onChange={(e) => update("business_hours_end", e.target.value)}
            className="input"
            style={{ width: 140 }}
          />
        </div>
      </section>

      {/* 休日設定 */}
      <section className="card">
        <h2 className="section-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <CalendarIcon size={18} /> 休日設定
        </h2>
        <p className="helper" style={{ marginBottom: "var(--space-3)" }}>
          OFFのまま運用すると、休日の出張は自動で除外されます（後から復元可能）
        </p>
        <div className="stack-sm">
          <label className="row" style={{ gap: "var(--space-2)", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={s.include_weekends}
              onChange={(e) => update("include_weekends", e.target.checked)}
            />
            <span>土日も出張対象に含める</span>
          </label>
          <label className="row" style={{ gap: "var(--space-2)", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={s.include_holidays}
              onChange={(e) => update("include_holidays", e.target.checked)}
            />
            <span>日本の祝日も出張対象に含める</span>
          </label>
        </div>
      </section>

      {/* デフォルト目的 */}
      <section className="card">
        <h2 className="section-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <FileTextIcon size={18} /> デフォルト目的
        </h2>
        <p className="helper" style={{ marginBottom: "var(--space-3)" }}>
          自動判定された出張の「目的」列の初期値（後から個別編集できます）
        </p>
        <input
          type="text"
          value={s.default_purpose}
          onChange={(e) => update("default_purpose", e.target.value)}
          className="input"
          placeholder="客先訪問"
          style={{ maxWidth: 320 }}
        />
      </section>

      {/* 保存 */}
      <div
        className="row"
        style={{
          position: "sticky",
          bottom: 0,
          background: "var(--bg)",
          paddingTop: "var(--space-3)",
          paddingBottom: "var(--space-3)",
          borderTop: "1px solid var(--border)",
        }}
      >
        <button
          type="submit"
          className="btn btn-primary btn-lg"
          disabled={loading}
        >
          {loading ? "保存中..." : "設定を保存"}
        </button>
        {message && (
          <span
            className={`text-sm ${message.type === "ok" ? "text-success" : "text-danger"}`}
            style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
          >
            {message.type === "ok" && <CheckIcon size={14} />}
            {message.text}
          </span>
        )}
      </div>
    </form>
  );
}
