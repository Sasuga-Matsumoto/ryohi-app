"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function TripDetailActions({
  tripId,
  initialPurpose,
  initialIsExcluded,
  excludedReason,
}: {
  tripId: string;
  initialPurpose: string;
  initialIsExcluded: boolean;
  excludedReason: string | null;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [purposeDraft, setPurposeDraft] = useState(initialPurpose);
  const [excludeMode, setExcludeMode] = useState(false);
  const [excludeReasonDraft, setExcludeReasonDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const patch = async (updates: Record<string, unknown>) => {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/trips/${tripId}`, {
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
    if (trimmed === initialPurpose) {
      setEditing(false);
      return;
    }
    if (await patch({ purpose: trimmed })) setEditing(false);
  };

  const exclude = async () => {
    if (
      await patch({
        is_excluded: true,
        excluded_reason: excludeReasonDraft || null,
      })
    ) {
      setExcludeMode(false);
      setExcludeReasonDraft("");
    }
  };

  const restore = async () => {
    await patch({ is_excluded: false });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* 目的 */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: "0.85rem", color: "var(--text-light)", width: 60 }}>
          目的
        </span>
        {editing ? (
          <>
            <input
              type="text"
              value={purposeDraft}
              onChange={(e) => setPurposeDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") savePurpose();
                if (e.key === "Escape") {
                  setPurposeDraft(initialPurpose);
                  setEditing(false);
                }
              }}
              autoFocus
              disabled={busy}
              className="input"
              style={{ flex: 1, minHeight: 32, padding: "4px 8px" }}
            />
            <button
              type="button"
              onClick={savePurpose}
              disabled={busy}
              className="btn btn-primary"
              style={{ minHeight: 32, padding: "4px 12px", fontSize: "0.85rem" }}
            >
              保存
            </button>
            <button
              type="button"
              onClick={() => {
                setPurposeDraft(initialPurpose);
                setEditing(false);
              }}
              disabled={busy}
              className="btn btn-secondary"
              style={{ minHeight: 32, padding: "4px 12px", fontSize: "0.85rem" }}
            >
              ✕
            </button>
          </>
        ) : (
          <>
            <span style={{ flex: 1 }}>{initialPurpose}</span>
            {!initialIsExcluded && (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="btn btn-secondary"
                style={{ minHeight: 32, padding: "4px 12px", fontSize: "0.85rem" }}
              >
                ✎ 編集
              </button>
            )}
          </>
        )}
      </div>

      {/* 状態 */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: "0.85rem", color: "var(--text-light)", width: 60 }}>
          状態
        </span>
        {initialIsExcluded ? (
          <>
            <span className="badge badge-deleted">除外</span>
            {excludedReason && (
              <span style={{ color: "var(--text-light)", fontSize: "0.85rem" }}>
                理由: {excludedReason}
              </span>
            )}
            <button
              type="button"
              onClick={restore}
              disabled={busy}
              className="btn btn-secondary"
              style={{
                marginLeft: "auto",
                minHeight: 32,
                padding: "4px 12px",
                fontSize: "0.85rem",
              }}
            >
              ↩ 復元
            </button>
          </>
        ) : excludeMode ? (
          <div
            style={{
              flex: 1,
              display: "flex",
              gap: 8,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <input
              type="text"
              placeholder="除外理由（任意）"
              value={excludeReasonDraft}
              onChange={(e) => setExcludeReasonDraft(e.target.value)}
              disabled={busy}
              className="input"
              style={{ flex: 1, minHeight: 32, padding: "4px 8px" }}
            />
            <button
              type="button"
              onClick={exclude}
              disabled={busy}
              className="btn btn-danger"
              style={{ minHeight: 32, padding: "4px 12px", fontSize: "0.85rem" }}
            >
              除外する
            </button>
            <button
              type="button"
              onClick={() => {
                setExcludeMode(false);
                setExcludeReasonDraft("");
              }}
              disabled={busy}
              className="btn btn-secondary"
              style={{ minHeight: 32, padding: "4px 12px", fontSize: "0.85rem" }}
            >
              キャンセル
            </button>
          </div>
        ) : (
          <>
            <span className="badge badge-active">記録中</span>
            <button
              type="button"
              onClick={() => setExcludeMode(true)}
              className="btn btn-secondary"
              style={{
                marginLeft: "auto",
                minHeight: 32,
                padding: "4px 12px",
                fontSize: "0.85rem",
              }}
            >
              除外
            </button>
          </>
        )}
      </div>

      {error && (
        <p style={{ color: "var(--danger)", fontSize: "0.85rem" }}>{error}</p>
      )}
    </div>
  );
}
