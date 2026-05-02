/**
 * 一貫したアカウント状態表示
 * active / suspended / deleted
 */

type Props = {
  status: "active" | "suspended" | "deleted";
};

const LABELS: Record<Props["status"], string> = {
  active: "アクティブ",
  suspended: "停止中",
  deleted: "削除済",
};

export default function StatusPill({ status }: Props) {
  return (
    <span className={`status-pill status-pill-${status}`}>
      {LABELS[status]}
    </span>
  );
}
