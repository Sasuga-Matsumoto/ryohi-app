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
import PurposeInput from "@/components/PurposeInput";
import { usePurposeSuggestions } from "@/components/usePurposeSuggestions";

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
  status?: "auto_detected" | "manual" | null;
  edit_source?: "manual_create" | "user_edit" | null;
};

export default function TripRow({ trip }: { trip: TripRowData }) {
  const router = useRouter();
  const { presets, history } = usePurposeSuggestions();
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
    opacity: trip.is_excluded ? 0.5 : 1,
    textDecoration: trip.is_excluded ? "line-through" : "none",
  };

  return (
    <>
      <tr>
        <td style={cellStyle} className="tabular">
          {trip.date}
          {trip.edit_source === "manual_create" && (
            <span
              className="badge badge-info"
              style={{ marginLeft: 4, fontSize: 10 }}
              title="手動追加"
            >
              手動
            </span>
          )}
          {trip.edit_source === "user_edit" && (
            <span
              className="badge badge-info"
              style={{ marginLeft: 4, fontSize: 10 }}
              title="修正済み"
            >
              修正済
            </span>
          )}
        </td>
        <td style={cellStyle}>{trip.destination_label ?? "—"}</td>
        <td style={cellStyle} className="tabular">{departTime}</td>
        <td style={cellStyle} className="tabular">{returnTime}</td>
        <td style={cellStyle} className="num">
          {(trip.total_minutes / 60).toFixed(1)}h
        </td>
        <td style={cellStyle} className="num">
          {trip.max_distance_km != null ? `${trip.max_distance_km.toFixed(1)}km` : "—"}
        </td>
        <td>
          {editing ? (
            <div style={{ display: "flex", gap: "var(--space-2)" }}>
              <PurposeInput
                id={`purpose-${trip.id}`}
                value={purposeDraft}
                onChange={setPurposeDraft}
                customPresets={presets}
                history={history}
                onKeyDown={(e) => {
                  if (e.key === "Enter") savePurpose();
                  if (e.key === "Escape") cancelPurposeEdit();
                }}
                autoFocus
                disabled={busy}
                style={{ minHeight: 32, fontSize: "var(--text-sm)" }}
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
                onClick={cancelPurposeEdit}
                disabled={busy}
                className="btn btn-ghost btn-sm btn-icon"
                aria-label="キャンセル"
              >
                <XIcon size={14} />
              </button>
            </div>
          ) : (
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
              }}
            >
              <span>{trip.purpose}</span>
              {!trip.is_excluded && (
                <PencilIcon size={12} style={{ color: "var(--text-disabled)" }} />
              )}
            </button>
          )}
        </td>
        <td>
          <div style={{ display: "flex", gap: "var(--space-1)", justifyContent: "flex-end" }}>
            <a
              href={`/dashboard/trips/${trip.id}`}
              className="btn btn-ghost btn-sm"
              aria-label="詳細"
            >
              詳細
              <ChevronRightIcon size={12} />
            </a>
            {trip.is_excluded ? (
              <button
                type="button"
                onClick={restore}
                disabled={busy}
                className="btn btn-ghost btn-sm"
                aria-label="復元"
              >
                <RefreshIcon size={12} />
                復元
              </button>
            ) : excludeMode ? null : (
              <button
                type="button"
                onClick={() => setExcludeMode(true)}
                disabled={busy}
                className="btn btn-ghost btn-sm"
                aria-label="除外"
              >
                <TrashIcon size={12} />
                除外
              </button>
            )}
          </div>
        </td>
      </tr>

      {/* 除外モード時の確認行 */}
      {excludeMode && !trip.is_excluded && (
        <tr style={{ background: "var(--warning-bg)" }}>
          <td colSpan={8}>
            <div className="row" style={{ gap: "var(--space-2)" }}>
              <span className="text-sm">
                この出張を除外しますか？理由（任意）:
              </span>
              <input
                type="text"
                value={excludeReason}
                onChange={(e) => setExcludeReason(e.target.value)}
                placeholder="私用だった / 誤検知"
                disabled={busy}
                className="input"
                style={{ flex: 1, minHeight: 32 }}
              />
              <button
                type="button"
                onClick={exclude}
                disabled={busy}
                className="btn btn-danger btn-sm"
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
              >
                キャンセル
              </button>
            </div>
          </td>
        </tr>
      )}

      {/* 除外済の理由表示 */}
      {trip.is_excluded && trip.excluded_reason && (
        <tr style={{ background: "var(--surface-muted)" }}>
          <td colSpan={8} className="text-xs text-muted" style={{ paddingTop: 4, paddingBottom: 8 }}>
            └ 除外理由: {trip.excluded_reason}
          </td>
        </tr>
      )}

      {error && (
        <tr>
          <td colSpan={8} className="text-sm text-danger">
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
