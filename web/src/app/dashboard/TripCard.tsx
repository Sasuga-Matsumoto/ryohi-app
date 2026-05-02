"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  PencilIcon,
  CheckIcon,
  XIcon,
  RefreshIcon,
  ChevronRightIcon,
  TrashIcon,
} from "@/components/Icon";
import type { TripRowData } from "./TripRow";

/**
 * Mobile-friendly trip card (alternative to TripRow on small screens).
 * 同じデータ・同じ操作を、テーブル行ではなくカードで提供する。
 */
export default function TripCard({ trip }: { trip: TripRowData }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [purposeDraft, setPurposeDraft] = useState(trip.purpose);
  const [excludeMode, setExcludeMode] = useState(false);
  const [excludeReason, setExcludeReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const departTime = formatHHMM(trip.depart_ts);
  const returnTime = formatHHMM(trip.return_ts);

  const patch = async (updates: Record<string, unknown>) => {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/trips/${trip.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    setBusy(false);
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      setError(b.error ?? `失敗 (${res.status})`);
      return false;
    }
    router.refresh();
    return true;
  };

  const savePurpose = async () => {
    const trimmed = purposeDraft.trim();
    if (!trimmed) {
      setError("目的は空にできません");
      return;
    }
    if (trimmed === trip.purpose) {
      setEditing(false);
      return;
    }
    if (await patch({ purpose: trimmed })) {
      setEditing(false);
    }
  };

  const cancelEdit = () => {
    setPurposeDraft(trip.purpose);
    setEditing(false);
    setError(null);
  };

  const exclude = async () => {
    if (await patch({ is_excluded: true, excluded_reason: excludeReason || null })) {
      setExcludeMode(false);
      setExcludeReason("");
    }
  };

  const restore = async () => {
    await patch({ is_excluded: false });
  };

  return (
    <article className={`trip-card ${trip.is_excluded ? "trip-card-excluded" : ""}`}>
      <div className="trip-card-head">
        <span className="trip-card-date">
          {trip.date} ({jsDow(trip.date)})
        </span>
        <a
          href={`/dashboard/trips/${trip.id}`}
          className="btn btn-ghost btn-sm"
          aria-label="詳細"
          style={{ padding: "0 8px", minHeight: 32 }}
        >
          詳細
          <ChevronRightIcon size={12} />
        </a>
      </div>

      <div
        className="trip-card-dest"
        style={{ textDecoration: trip.is_excluded ? "line-through" : "none" }}
      >
        {trip.destination_label ?? "—"}
      </div>

      <div className="trip-card-meta">
        <span className="trip-card-meta-item">
          <strong>
            {departTime} – {returnTime}
          </strong>
        </span>
        <span className="trip-card-meta-item">
          滞在 <strong>{(trip.total_minutes / 60).toFixed(1)}h</strong>
        </span>
        <span className="trip-card-meta-item">
          最大{" "}
          <strong>
            {trip.max_distance_km != null
              ? `${trip.max_distance_km.toFixed(1)}km`
              : "—"}
          </strong>
        </span>
      </div>

      <div className="trip-card-purpose">
        {editing ? (
          <div style={{ display: "flex", gap: "var(--space-2)", flex: 1 }}>
            <input
              type="text"
              value={purposeDraft}
              onChange={(e) => setPurposeDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") savePurpose();
                if (e.key === "Escape") cancelEdit();
              }}
              autoFocus
              disabled={busy}
              className="input"
              style={{ minHeight: 36, fontSize: "var(--text-sm)" }}
            />
            <button
              type="button"
              onClick={savePurpose}
              disabled={busy}
              className="btn btn-primary btn-sm btn-icon"
              aria-label="保存"
            >
              <CheckIcon size={14} />
            </button>
            <button
              type="button"
              onClick={cancelEdit}
              disabled={busy}
              className="btn btn-ghost btn-sm btn-icon"
              aria-label="キャンセル"
            >
              <XIcon size={14} />
            </button>
          </div>
        ) : (
          <>
            <button
              type="button"
              onClick={() => !trip.is_excluded && setEditing(true)}
              disabled={trip.is_excluded}
              title={trip.is_excluded ? "除外中は編集できません" : "クリックで編集"}
              className="btn btn-ghost btn-sm"
              style={{
                background: "transparent",
                padding: "4px 8px",
                margin: "-4px -8px",
                color: trip.is_excluded ? "var(--text-disabled)" : "var(--text)",
                cursor: trip.is_excluded ? "not-allowed" : "pointer",
                textDecoration: trip.is_excluded ? "line-through" : "none",
                fontWeight: 400,
                gap: "var(--space-2)",
                flex: 1,
                justifyContent: "flex-start",
              }}
            >
              <span>{trip.purpose}</span>
              {!trip.is_excluded && (
                <PencilIcon size={12} style={{ color: "var(--text-disabled)" }} />
              )}
            </button>
            {trip.is_excluded ? (
              <button
                type="button"
                onClick={restore}
                disabled={busy}
                className="btn btn-ghost btn-sm"
              >
                <RefreshIcon size={12} />
                復元
              </button>
            ) : (
              !excludeMode && (
                <button
                  type="button"
                  onClick={() => setExcludeMode(true)}
                  disabled={busy}
                  className="btn btn-ghost btn-sm"
                >
                  <TrashIcon size={12} />
                  除外
                </button>
              )
            )}
          </>
        )}
      </div>

      {excludeMode && !trip.is_excluded && (
        <div
          style={{
            background: "var(--warning-bg)",
            border: "1px solid #FCD34D",
            borderRadius: "var(--radius-md)",
            padding: "var(--space-3)",
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-2)",
          }}
        >
          <span className="text-sm">この出張を除外しますか？</span>
          <input
            type="text"
            value={excludeReason}
            onChange={(e) => setExcludeReason(e.target.value)}
            placeholder="理由（任意）: 私用だった / 誤検知"
            disabled={busy}
            className="input"
            style={{ minHeight: 36 }}
          />
          <div style={{ display: "flex", gap: "var(--space-2)" }}>
            <button
              type="button"
              onClick={exclude}
              disabled={busy}
              className="btn btn-danger btn-sm"
              style={{ flex: 1 }}
            >
              除外する
            </button>
            <button
              type="button"
              onClick={() => {
                setExcludeMode(false);
                setExcludeReason("");
              }}
              disabled={busy}
              className="btn btn-ghost btn-sm"
              style={{ flex: 1 }}
            >
              キャンセル
            </button>
          </div>
        </div>
      )}

      {trip.is_excluded && trip.excluded_reason && (
        <div
          className="text-xs text-muted"
          style={{
            paddingTop: "var(--space-2)",
            borderTop: "1px dashed var(--border)",
          }}
        >
          除外理由: {trip.excluded_reason}
        </div>
      )}

      {error && (
        <div className="text-sm text-danger" role="alert">
          {error}
        </div>
      )}
    </article>
  );
}

function formatHHMM(iso: string): string {
  return new Date(iso).toLocaleTimeString("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Tokyo",
  });
}

function jsDow(yyyymmdd: string): string {
  const d = new Date(yyyymmdd + "T00:00:00+09:00");
  return ["日", "月", "火", "水", "木", "金", "土"][d.getDay()];
}
