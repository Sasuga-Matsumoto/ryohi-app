"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type TripRowData = {
  id: string;
  date: string;
  destination_label: string | null;
  depart_ts: string;
  return_ts: string;
  total_minutes: number;
  max_distance_km: number | null;
  purpose: string;
  is_excluded: boolean;
  excluded_reason?: string | null;
};

export default function TripRow({ trip }: { trip: TripRowData }) {
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

  const cancelPurposeEdit = () => {
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

  const cellStyle: React.CSSProperties = {
    padding: 12,
    opacity: trip.is_excluded ? 0.5 : 1,
  };

  return (
    <>
      <tr
        style={{
          borderTop: "1px solid #E5E7EB",
        }}
      >
        <td
          style={{
            ...cellStyle,
            textDecoration: trip.is_excluded ? "line-through" : "none",
          }}
        >
          {trip.date}
        </td>
        <td
          style={{
            ...cellStyle,
            textDecoration: trip.is_excluded ? "line-through" : "none",
          }}
        >
          {trip.destination_label ?? "—"}
        </td>
        <td
          style={{
            ...cellStyle,
            textDecoration: trip.is_excluded ? "line-through" : "none",
          }}
        >
          {departTime}
        </td>
        <td
          style={{
            ...cellStyle,
            textDecoration: trip.is_excluded ? "line-through" : "none",
          }}
        >
          {returnTime}
        </td>
        <td
          style={{
            ...cellStyle,
            textAlign: "right",
            textDecoration: trip.is_excluded ? "line-through" : "none",
          }}
        >
          {(trip.total_minutes / 60).toFixed(1)}h
        </td>
        <td
          style={{
            ...cellStyle,
            textAlign: "right",
            textDecoration: trip.is_excluded ? "line-through" : "none",
          }}
        >
          {trip.max_distance_km != null ? `${trip.max_distance_km.toFixed(1)}km` : "—"}
        </td>
        <td style={cellStyle}>
          {editing ? (
            <div style={{ display: "flex", gap: 6 }}>
              <input
                type="text"
                value={purposeDraft}
                onChange={(e) => setPurposeDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") savePurpose();
                  if (e.key === "Escape") cancelPurposeEdit();
                }}
                autoFocus
                disabled={busy}
                className="input"
                style={{ minHeight: 32, padding: "4px 8px", fontSize: "0.85rem" }}
              />
              <button
                type="button"
                onClick={savePurpose}
                disabled={busy}
                className="btn btn-primary"
                style={{ minHeight: 32, padding: "4px 10px", fontSize: "0.8rem" }}
              >
                保存
              </button>
              <button
                type="button"
                onClick={cancelPurposeEdit}
                disabled={busy}
                className="btn btn-secondary"
                style={{ minHeight: 32, padding: "4px 10px", fontSize: "0.8rem" }}
              >
                ✕
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => !trip.is_excluded && setEditing(true)}
              disabled={trip.is_excluded}
              title={trip.is_excluded ? "除外中の Trip は編集できません" : "クリックで編集"}
              style={{
                background: "none",
                border: "none",
                padding: 0,
                color: trip.is_excluded ? "var(--text-light)" : "var(--text)",
                cursor: trip.is_excluded ? "not-allowed" : "pointer",
                textAlign: "left",
                font: "inherit",
                textDecoration: trip.is_excluded ? "line-through" : "none",
              }}
            >
              {trip.purpose}{!trip.is_excluded && (
                <span style={{ color: "var(--text-light)", fontSize: "0.75rem", marginLeft: 6 }}>
                  ✎
                </span>
              )}
            </button>
          )}
        </td>
        <td style={cellStyle}>
          {trip.is_excluded ? (
            <button
              type="button"
              onClick={restore}
              disabled={busy}
              className="btn btn-secondary"
              style={{ minHeight: 30, padding: "4px 10px", fontSize: "0.8rem" }}
            >
              ↩ 復元
            </button>
          ) : excludeMode ? null : (
            <button
              type="button"
              onClick={() => setExcludeMode(true)}
              disabled={busy}
              className="btn btn-secondary"
              style={{ minHeight: 30, padding: "4px 10px", fontSize: "0.8rem" }}
            >
              除外
            </button>
          )}
        </td>
      </tr>

      {/* 除外モード時の確認行 */}
      {excludeMode && !trip.is_excluded && (
        <tr style={{ background: "#FEF3C7" }}>
          <td colSpan={8} style={{ padding: 12 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span style={{ fontSize: "0.85rem" }}>
                この Trip を出張から除外しますか？理由（任意）:
              </span>
              <input
                type="text"
                value={excludeReason}
                onChange={(e) => setExcludeReason(e.target.value)}
                placeholder="私用だった / 誤検知"
                disabled={busy}
                className="input"
                style={{
                  flex: 1,
                  minHeight: 32,
                  padding: "4px 8px",
                  fontSize: "0.85rem",
                }}
              />
              <button
                type="button"
                onClick={exclude}
                disabled={busy}
                className="btn btn-danger"
                style={{ minHeight: 32, padding: "4px 12px", fontSize: "0.8rem" }}
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
                className="btn btn-secondary"
                style={{ minHeight: 32, padding: "4px 12px", fontSize: "0.8rem" }}
              >
                キャンセル
              </button>
            </div>
          </td>
        </tr>
      )}

      {/* 除外済の理由表示 */}
      {trip.is_excluded && trip.excluded_reason && (
        <tr style={{ background: "#F9FAFB" }}>
          <td
            colSpan={8}
            style={{
              padding: "6px 12px 10px",
              fontSize: "0.8rem",
              color: "var(--text-light)",
            }}
          >
            └ 除外理由: {trip.excluded_reason}
          </td>
        </tr>
      )}

      {error && (
        <tr>
          <td colSpan={8} style={{ padding: "6px 12px", color: "var(--danger)", fontSize: "0.85rem" }}>
            {error}
          </td>
        </tr>
      )}
    </>
  );
}

function formatHHMM(iso: string): string {
  return new Date(iso).toLocaleTimeString("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Tokyo",
  });
}
