"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  PowerIcon,
  RefreshIcon,
  TrashIcon,
  AlertTriangleIcon,
  CheckIcon,
} from "@/components/Icon";

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
      <div className="alert alert-info" style={{ marginTop: 0 }}>
        <AlertTriangleIcon size={16} style={{ flexShrink: 0, marginTop: 2 }} />
        <div>
          削除済みアカウントは復元できません。データは7年保持されます。
        </div>
      </div>
    );
  }

  if (pendingAction) {
    const isDelete = pendingAction === "delete";
    const isSuspend = pendingAction === "suspend";
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
        <p className="text-sm" style={{ lineHeight: 1.6 }}>
          <strong>{accountName}</strong> を
          {isSuspend && "利用停止"}
          {pendingAction === "resume" && "再開"}
          {isDelete && "削除"}
          しますか？
        </p>

        {isSuspend && (
          <ul
            className="text-xs text-muted"
            style={{ paddingLeft: 16, lineHeight: 1.7 }}
          >
            <li>該当ユーザーは即時ログアウト</li>
            <li>アプリの GPS 送信が拒否されます</li>
            <li>データは保持・いつでも再開可能</li>
          </ul>
        )}

        {isDelete && (
          <div
            className="alert alert-danger"
            style={{ padding: "var(--space-3)", margin: 0 }}
          >
            <AlertTriangleIcon size={16} style={{ flexShrink: 0, marginTop: 2 }} />
            <div>
              <strong>復元できません</strong>
              <ul
                className="text-xs"
                style={{ paddingLeft: 16, marginTop: 4, lineHeight: 1.7 }}
              >
                <li>status = deleted になりログイン不可</li>
                <li>データ自体は7年保持（証拠保管）</li>
              </ul>
            </div>
          </div>
        )}

        <div>
          <label htmlFor="action-reason" className="label">
            理由{isDelete ? " *" : "（任意）"}
          </label>
          <input
            id="action-reason"
            type="text"
            required={isDelete}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="input"
            disabled={loading}
            placeholder={isDelete ? "解約申請" : "契約期間終了"}
          />
        </div>

        {isDelete && (
          <div>
            <label htmlFor="action-confirm" className="label">
              確認のため「削除」と入力 *
            </label>
            <input
              id="action-confirm"
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              className="input"
              disabled={loading}
              placeholder="削除"
            />
          </div>
        )}

        <div style={{ display: "flex", gap: "var(--space-2)" }}>
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
              loading || (isDelete && (!reason || confirmText !== "削除"))
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
          <p className="text-sm text-danger" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="action-stack">
      {status === "active" && (
        <button
          className="btn btn-secondary"
          onClick={() => setPendingAction("suspend")}
        >
          <PowerIcon size={14} />
          利用停止
        </button>
      )}
      {status === "suspended" && (
        <button
          className="btn btn-primary"
          onClick={() => setPendingAction("resume")}
        >
          <CheckIcon size={14} />
          利用再開
        </button>
      )}
      <button
        className="btn btn-danger"
        onClick={() => setPendingAction("delete")}
      >
        <TrashIcon size={14} />
        削除
      </button>
      {status === "active" && (
        <p className="text-xs text-muted" style={{ marginTop: "var(--space-1)" }}>
          利用停止は即時ログアウト・データは保持されます
        </p>
      )}
    </div>
  );
}
