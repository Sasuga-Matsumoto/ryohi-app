"use client";

import { useState, useEffect, useMemo, useRef } from "react";
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
  business_hours_enabled: boolean;
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
  business_hours_enabled: false,
  business_hours_start: "09:00",
  business_hours_end: "18:00",
  include_holidays: true,
  include_weekends: true,
  default_purpose: "客先訪問",
};

export default function SettingsForm({ initial }: { initial: Setting | null }) {
  const router = useRouter();
  const initialState = useMemo<Setting>(
    () => ({
      ...DEFAULTS,
      ...(initial ?? {}),
      business_hours_start: (
        initial?.business_hours_start ?? DEFAULTS.business_hours_start
      ).slice(0, 5),
      business_hours_end: (
        initial?.business_hours_end ?? DEFAULTS.business_hours_end
      ).slice(0, 5),
    }),
    [initial],
  );
  const [s, setS] = useState<Setting>(initialState);
  const [savedSnapshot, setSavedSnapshot] = useState<Setting>(initialState);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showToast, setShowToast] = useState(false);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isDirty = useMemo(
    () => JSON.stringify(s) !== JSON.stringify(savedSnapshot),
    [s, savedSnapshot],
  );

  // 離脱時に未保存変更があれば確認
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (!isDirty) return;
      e.preventDefault();
      // Chrome 等は returnValue 必須
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  // toast 自動非表示
  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  const update = <K extends keyof Setting>(k: K, v: Setting[K]) =>
    setS((prev) => ({ ...prev, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isDirty || loading) return;
    setLoading(true);
    setErrorMsg(null);

    const res = await fetch("/api/account-settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(s),
    });

    setLoading(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setErrorMsg(body.error ?? "保存に失敗しました");
      return;
    }

    setSavedSnapshot(s);
    setShowToast(true);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setShowToast(false), 2400);
    router.refresh();
  };

  return (
    <>
      <form
        onSubmit={handleSubmit}
        className="settings-form stack-lg"
        aria-label="設定フォーム"
      >
        {/* スティッキー保存ツールバー（最上部） */}
        <div className="settings-toolbar" role="toolbar" aria-label="保存">
          <div className="settings-toolbar-left">
            <span className="settings-toolbar-status">
              {errorMsg ? (
                <span className="settings-toolbar-status-error">{errorMsg}</span>
              ) : isDirty ? (
                <span className="settings-toolbar-status-dirty">
                  未保存の変更があります
                </span>
              ) : (
                <span className="settings-toolbar-status-saved">
                  <CheckIcon size={14} />
                  すべて保存済み
                </span>
              )}
            </span>
          </div>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading || !isDirty}
            aria-disabled={loading || !isDirty}
          >
            {loading ? "保存中..." : "変更を保存"}
          </button>
        </div>

        {/* グループ 1: ベース設定（自宅・勤務地） */}
        <div className="settings-group-header" aria-label="Step 1">
          <span className="settings-group-step" aria-hidden="true">
            1
          </span>
          <div className="settings-group-text">
            <h2 className="settings-group-title">ベース設定</h2>
            <span className="settings-group-hint">
              自宅と勤務地のエリアを地図で指定
            </span>
          </div>
        </div>

        <section className="card" aria-labelledby="sec-home">
          <h3
            id="sec-home"
            className="section-title"
            style={{ display: "flex", alignItems: "center", gap: 8 }}
          >
            <HomeIcon size={18} /> 自宅
          </h3>
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

        <section className="card" aria-labelledby="sec-work">
          <h3
            id="sec-work"
            className="section-title"
            style={{ display: "flex", alignItems: "center", gap: 8 }}
          >
            <BuildingIcon size={18} /> 勤務地
          </h3>
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

        {/* グループ 2: 判定ルール（2 列グリッド） */}
        <div
          className="settings-group-header settings-group-divider"
          aria-label="Step 2"
        >
          <span className="settings-group-step" aria-hidden="true">
            2
          </span>
          <div className="settings-group-text">
            <h2 className="settings-group-title">判定ルール</h2>
            <span className="settings-group-hint">出張の自動判定方法を調整</span>
          </div>
        </div>

        <div className="settings-rules-grid">
          {/* 出張定義 */}
          <section className="card" aria-labelledby="sec-trip-def">
            <h3
              id="sec-trip-def"
              className="section-title"
              style={{ display: "flex", alignItems: "center", gap: 8 }}
            >
              <MapPinIcon size={18} /> 出張定義
            </h3>
            <p className="helper" style={{ marginBottom: "var(--space-4)" }}>
              どのような状態を「出張」とみなすか
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
                  background:
                    s.trip_definition_type === "hours"
                      ? "var(--info-bg)"
                      : "transparent",
                }}
              >
                <input
                  type="radio"
                  checked={s.trip_definition_type === "hours"}
                  onChange={() => update("trip_definition_type", "hours")}
                />
                <span style={{ flex: 1 }}>時間で判定</span>
                <span className="row" style={{ gap: "var(--space-2)" }}>
                  <input
                    type="number"
                    min={1}
                    value={s.trip_threshold_hours}
                    onChange={(e) =>
                      update(
                        "trip_threshold_hours",
                        parseInt(e.target.value) || 1,
                      )
                    }
                    className="input"
                    style={{ width: 72 }}
                    disabled={s.trip_definition_type !== "hours"}
                    aria-label="時間"
                  />
                  <span className="text-sm text-muted">時間以上</span>
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
                  background:
                    s.trip_definition_type === "km"
                      ? "var(--info-bg)"
                      : "transparent",
                }}
              >
                <input
                  type="radio"
                  checked={s.trip_definition_type === "km"}
                  onChange={() => update("trip_definition_type", "km")}
                />
                <span style={{ flex: 1 }}>距離で判定</span>
                <span className="row" style={{ gap: "var(--space-2)" }}>
                  <input
                    type="number"
                    min={1}
                    value={s.trip_threshold_km}
                    onChange={(e) =>
                      update("trip_threshold_km", parseInt(e.target.value) || 1)
                    }
                    className="input"
                    style={{ width: 72 }}
                    disabled={s.trip_definition_type !== "km"}
                    aria-label="距離（km）"
                  />
                  <span className="text-sm text-muted">km以上</span>
                </span>
              </label>
            </div>
          </section>

          {/* 業務時間 */}
          <section className="card" aria-labelledby="sec-hours">
            <h3
              id="sec-hours"
              className="section-title"
              style={{ display: "flex", alignItems: "center", gap: 8 }}
            >
              <ClockIcon size={18} /> 業務時間
            </h3>
            <p className="helper" style={{ marginBottom: "var(--space-3)" }}>
              設定するとその時間帯外の外出は出張に含めません。OFF=24時間扱い
            </p>
            <div className="stack-sm">
              <label
                className="row"
                style={{ gap: "var(--space-2)", cursor: "pointer" }}
              >
                <input
                  type="checkbox"
                  checked={s.business_hours_enabled}
                  onChange={(e) =>
                    update("business_hours_enabled", e.target.checked)
                  }
                />
                <span>業務時間を設定する</span>
              </label>
              {s.business_hours_enabled && (
                <div
                  className="row"
                  style={{ paddingLeft: "var(--space-5)", flexWrap: "nowrap" }}
                >
                  <input
                    type="time"
                    value={s.business_hours_start}
                    onChange={(e) =>
                      update("business_hours_start", e.target.value)
                    }
                    className="input"
                    style={{ width: 130 }}
                    aria-label="業務開始時刻"
                  />
                  <span className="text-muted">〜</span>
                  <input
                    type="time"
                    value={s.business_hours_end}
                    onChange={(e) =>
                      update("business_hours_end", e.target.value)
                    }
                    className="input"
                    style={{ width: 130 }}
                    aria-label="業務終了時刻"
                  />
                </div>
              )}
            </div>
          </section>

          {/* 休日設定 */}
          <section className="card" aria-labelledby="sec-holidays">
            <h3
              id="sec-holidays"
              className="section-title"
              style={{ display: "flex", alignItems: "center", gap: 8 }}
            >
              <CalendarIcon size={18} /> 休日設定
            </h3>
            <p className="helper" style={{ marginBottom: "var(--space-3)" }}>
              OFFにするとその日の出張は自動で除外（後から復元可能）
            </p>
            <div className="stack-sm">
              <label
                className="row"
                style={{ gap: "var(--space-2)", cursor: "pointer" }}
              >
                <input
                  type="checkbox"
                  checked={s.include_weekends}
                  onChange={(e) => update("include_weekends", e.target.checked)}
                />
                <span>土日も出張対象に含める</span>
              </label>
              <label
                className="row"
                style={{ gap: "var(--space-2)", cursor: "pointer" }}
              >
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
          <section className="card" aria-labelledby="sec-purpose">
            <h3
              id="sec-purpose"
              className="section-title"
              style={{ display: "flex", alignItems: "center", gap: 8 }}
            >
              <FileTextIcon size={18} /> デフォルト目的
            </h3>
            <p className="helper" style={{ marginBottom: "var(--space-3)" }}>
              自動判定された出張の「目的」列の初期値（個別編集可）
            </p>
            <input
              type="text"
              value={s.default_purpose}
              onChange={(e) => update("default_purpose", e.target.value)}
              className="input"
              placeholder="客先訪問"
              aria-label="デフォルト目的"
            />
          </section>
        </div>
      </form>

      {/* 保存成功トースト */}
      {showToast && (
        <div className="save-toast" role="status" aria-live="polite">
          <CheckIcon size={16} />
          設定を保存しました
        </div>
      )}
    </>
  );
}
