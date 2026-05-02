"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import PurposeInput from "@/components/PurposeInput";
import { usePurposeSuggestions } from "@/components/usePurposeSuggestions";

const JST_OFFSET = "+09:00";

function todayStr(): string {
  // JST の今日
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 3600 * 1000);
  return jst.toISOString().slice(0, 10);
}

export default function ManualTripForm() {
  const router = useRouter();
  const { presets, history } = usePurposeSuggestions();

  const [date, setDate] = useState<string>(todayStr());
  const [departTime, setDepartTime] = useState<string>("09:00");
  const [returnTime, setReturnTime] = useState<string>("18:00");
  const [destination, setDestination] = useState<string>("");
  const [visitedAreasText, setVisitedAreasText] = useState<string>("");
  const [purpose, setPurpose] = useState<string>("");
  const [maxDistanceKm, setMaxDistanceKm] = useState<string>("");
  const [overrideStay, setOverrideStay] = useState(false);
  const [stayMinutes, setStayMinutes] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const autoStayMinutes = useMemo(() => {
    if (!departTime || !returnTime) return 0;
    const [dh, dm] = departTime.split(":").map(Number);
    const [rh, rm] = returnTime.split(":").map(Number);
    return rh * 60 + rm - (dh * 60 + dm);
  }, [departTime, returnTime]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError(null);

    if (autoStayMinutes <= 0) {
      setError("帰着時刻は出発時刻より後にしてください");
      return;
    }
    if (!purpose.trim()) {
      setError("目的を入力してください");
      return;
    }

    const depart_ts = `${date}T${departTime}:00${JST_OFFSET}`;
    const return_ts = `${date}T${returnTime}:00${JST_OFFSET}`;

    const visited_areas = visitedAreasText
      .split(/[、,\n]+/)
      .map((s) => s.trim())
      .filter(Boolean);

    const total_minutes_value =
      overrideStay && stayMinutes
        ? Number(stayMinutes)
        : autoStayMinutes;

    const max_distance_km_value = maxDistanceKm
      ? parseFloat(maxDistanceKm)
      : undefined;

    setLoading(true);
    const res = await fetch("/api/trips", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date,
        depart_ts,
        return_ts,
        destination_label: destination,
        visited_areas,
        total_minutes: total_minutes_value,
        max_distance_km: max_distance_km_value,
        purpose: purpose.trim(),
      }),
    });
    setLoading(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? `保存失敗 (${res.status})`);
      return;
    }

    const { trip } = await res.json();
    router.push(`/dashboard/trips/${trip.id}`);
  };

  return (
    <form onSubmit={handleSubmit} className="stack">
      <div>
        <label htmlFor="date" className="label label-required">
          日付
        </label>
        <input
          id="date"
          type="date"
          required
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="input"
          disabled={loading}
        />
      </div>

      <div className="row" style={{ flexWrap: "wrap", gap: "var(--space-3)" }}>
        <div style={{ flex: "1 1 140px" }}>
          <label htmlFor="depart" className="label label-required">
            出発時刻
          </label>
          <input
            id="depart"
            type="time"
            required
            value={departTime}
            onChange={(e) => setDepartTime(e.target.value)}
            className="input"
            disabled={loading}
          />
        </div>
        <div style={{ flex: "1 1 140px" }}>
          <label htmlFor="return" className="label label-required">
            帰着時刻
          </label>
          <input
            id="return"
            type="time"
            required
            value={returnTime}
            onChange={(e) => setReturnTime(e.target.value)}
            className="input"
            disabled={loading}
          />
        </div>
      </div>

      <p className="helper" style={{ marginTop: -4 }}>
        現地滞在時間: <strong>{Math.max(0, autoStayMinutes)} 分</strong> が自動で記録されます
      </p>

      <div>
        <label
          className="row"
          style={{
            gap: "var(--space-2)",
            cursor: "pointer",
            fontSize: "var(--text-sm)",
          }}
        >
          <input
            type="checkbox"
            checked={overrideStay}
            onChange={(e) => setOverrideStay(e.target.checked)}
            disabled={loading}
          />
          滞在時間を手動で指定する
        </label>
        {overrideStay && (
          <div
            className="row"
            style={{
              marginTop: "var(--space-2)",
              gap: "var(--space-2)",
            }}
          >
            <input
              type="number"
              min={0}
              max={1440}
              value={stayMinutes}
              onChange={(e) => setStayMinutes(e.target.value)}
              className="input"
              style={{ width: 120 }}
              placeholder="分"
              disabled={loading}
            />
            <span className="text-muted text-sm">分</span>
          </div>
        )}
      </div>

      <div>
        <label htmlFor="destination" className="label">
          出張先
        </label>
        <input
          id="destination"
          type="text"
          value={destination}
          onChange={(e) => setDestination(e.target.value)}
          className="input"
          placeholder="例: 渋谷区"
          disabled={loading}
        />
      </div>

      <div>
        <label htmlFor="visited" className="label">
          訪問地（任意・カンマ区切り）
        </label>
        <input
          id="visited"
          type="text"
          value={visitedAreasText}
          onChange={(e) => setVisitedAreasText(e.target.value)}
          className="input"
          placeholder="例: 渋谷区, 新宿区"
          disabled={loading}
        />
      </div>

      <div>
        <label htmlFor="purpose" className="label label-required">
          目的
        </label>
        <PurposeInput
          id="purpose"
          value={purpose}
          onChange={setPurpose}
          customPresets={presets}
          history={history}
          placeholder="顧客訪問"
          disabled={loading}
        />
      </div>

      <div>
        <label htmlFor="distance" className="label">
          最大距離（任意・km）
        </label>
        <input
          id="distance"
          type="number"
          min={0}
          step={0.1}
          value={maxDistanceKm}
          onChange={(e) => setMaxDistanceKm(e.target.value)}
          className="input"
          style={{ width: 120 }}
          placeholder="km"
          disabled={loading}
        />
      </div>

      {error && (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      )}

      <div className="row" style={{ marginTop: "var(--space-3)" }}>
        <button
          type="submit"
          className="btn btn-primary btn-lg"
          disabled={loading || !purpose.trim()}
        >
          {loading ? "保存中..." : "出張を登録"}
        </button>
        <a
          href="/dashboard"
          className="btn btn-ghost"
          style={{ pointerEvents: loading ? "none" : "auto" }}
        >
          キャンセル
        </a>
      </div>
    </form>
  );
}
