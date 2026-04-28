"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Action = "suspend" | "resume" | "delete";

export default function AccountActions({
  accountId,
  accountName,
  status,
}: {
  accountId: string;
  accountName: string;
  status: "active" | "suspended" | "deleted";
}) {
  const router = useRouter();
  const [pendingAction, setPendingAction] = useState<Action | null>(null);
  const [reason, setReason] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!pendingAction) return;
    if (pendingAction === "delete" && confirmText !== "削除") {
      setError("確認のため「削除」と入力してください");
      return;
    }

    setLoading(true);
    setError(null);
    const res = await fetch(`/api/admin/accounts/${accountId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: pendingAction, reason: reason || undefined }),
    });
    setLoading(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? `失敗 (HTTP ${res.status})`);
      return;
    }

    setPendingAction(null);
    setReason("");
    setConfirmText("");
    router.refresh();
  };

  const cancel = () => {
    setPendingAction(null);
    setReason("");
    setConfirmText("");
    setError(null);
  };

  if (status === "deleted") {
    return (
      <p style={{ color: "var(--text-light)", fontSize: "0.85rem" }}>
        削除済みアカウントは復元できません。データは7年保持されます。
      </p>
    );
  }

  if (pendingAction) {
    const isDelete = pendingAction === "delete";
    const isSuspend = pendingAction === "suspend";
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <p style={{ fontSize: "0.9rem", lineHeight: 1.6 }}>
          <strong>{accountName}</strong> を
          {pendingAction === "suspend" && "利用停止"}
          {pendingAction === "resume" && "再開"}
          {pendingAction === "delete" && "削除"}
          しますか？
        </p>

        {isSuspend && (
          <p
            style={{
              fontSize: "0.8rem",
              color: "var(--text-light)",
              lineHeight: 1.6,
            }}
          >
            • 該当ユーザーは即時ログアウト
            <br />
            • アプリの GPS 送信が拒否されます
            <br />
            • データは保持・いつでも再開可能
          </p>
        )}

        {isDelete && (
          <p
            style={{
              fontSize: "0.8rem",
              color: "var(--danger)",
              lineHeight: 1.6,
            }}
          >
            ⚠ 復元できません
            <br />
            • status = deleted になりログイン不可
            <br />
            • データ自体は7年保持（証拠保管）
          </p>
        )}

        <div>
          <label style={{ fontSize: "0.85rem", fontWeight: 600 }}>
            理由{isDelete ? " *" : "（任意）"}
          </label>
          <input
            type="text"
            required={isDelete}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="input"
            disabled={loading}
            placeholder={isDelete ? "解約申請" : "契約期間終了"}
            style={{ marginTop: 6 }}
          />
        </div>

        {isDelete && (
          <div>
            <label style={{ fontSize: "0.85rem", fontWeight: 600 }}>
              確認のため「削除」と入力 *
            </label>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              className="input"
              disabled={loading}
              style={{ marginTop: 6 }}
            />
          </div>
        )}

        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={cancel}
            disabled={loading}
            style={{ flex: 1 }}
          >
            キャンセル
          </button>
          <button
            type="button"
            className={isDelete ? "btn btn-danger" : "btn btn-primary"}
            onClick={submit}
            disabled={
              loading ||
              (isDelete && (!reason || confirmText !== "削除"))
            }
            style={{ flex: 1 }}
          >
            {loading
              ? "処理中…"
              : isSuspend
                ? "停止する"
                : isDelete
                  ? "削除する"
                  : "再開する"}
          </button>
        </div>
        {error && (
          <p style={{ color: "var(--danger)", fontSize: "0.85rem" }}>{error}</p>
        )}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {status === "active" && (
        <button
          className="btn btn-secondary"
          onClick={() => setPendingAction("suspend")}
        >
          ⚠ 利用停止
        </button>
      )}
      {status === "suspended" && (
        <button
          className="btn btn-primary"
          onClick={() => setPendingAction("resume")}
        >
          ✓ 利用再開
        </button>
      )}
      <button
        className="btn btn-danger"
        onClick={() => setPendingAction("delete")}
      >
        ❌ 削除
      </button>
    </div>
  );
}
