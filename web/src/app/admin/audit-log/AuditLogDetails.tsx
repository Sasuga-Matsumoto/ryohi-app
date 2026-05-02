"use client";

import { useState } from "react";
import { ChevronRightIcon } from "@/components/Icon";

/**
 * 監査ログの details (jsonb) を整形表示
 * - 空 {} → 「—」
 * - 1〜2 項目 → key: value 形式でインライン
 * - 3 項目以上 → 折り畳み式
 */
export default function AuditLogDetails({
  details,
}: {
  details: Record<string, unknown> | null | undefined;
}) {
  const [open, setOpen] = useState(false);

  if (!details || typeof details !== "object" || Object.keys(details).length === 0) {
    return <span className="text-xs text-muted">—</span>;
  }

  const entries = Object.entries(details);

  if (entries.length <= 2) {
    return (
      <span className="text-xs">
        {entries.map(([k, v], i) => (
          <span key={k} style={{ marginRight: i < entries.length - 1 ? 12 : 0 }}>
            <span className="text-muted">{k}: </span>
            <span style={{ wordBreak: "break-word" }}>
              {typeof v === "string" ? v : JSON.stringify(v)}
            </span>
          </span>
        ))}
      </span>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="btn btn-link text-xs"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          padding: 0,
          minHeight: "auto",
        }}
        aria-expanded={open}
      >
        <ChevronRightIcon
          size={12}
          style={{
            transform: open ? "rotate(90deg)" : "none",
            transition: "transform 150ms ease",
          }}
        />
        {entries.length} 項目
      </button>
      {open && (
        <dl
          style={{
            marginTop: 6,
            display: "grid",
            gridTemplateColumns: "auto 1fr",
            columnGap: 8,
            rowGap: 2,
            fontSize: "var(--text-xs)",
            background: "var(--surface-muted)",
            padding: "var(--space-2) var(--space-3)",
            borderRadius: "var(--radius-sm)",
            border: "1px solid var(--border)",
          }}
        >
          {entries.map(([k, v]) => (
            <div key={k} style={{ display: "contents" }}>
              <dt className="text-muted">{k}:</dt>
              <dd
                className="font-mono"
                style={{ wordBreak: "break-all", lineHeight: 1.5 }}
              >
                {typeof v === "string" ? v : JSON.stringify(v)}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
