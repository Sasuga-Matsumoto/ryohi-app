"use client";

/**
 * 出張目的の入力フィールド
 * - HTML5 datalist でプリセット + ユーザーカスタム + 履歴をサジェスト
 * - 自由入力も可能
 */

export const DEFAULT_PURPOSE_PRESETS = [
  "顧客訪問",
  "商談",
  "視察",
  "展示会",
] as const;

export default function PurposeInput({
  id,
  value,
  onChange,
  customPresets = [],
  history = [],
  ...props
}: {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  customPresets?: string[];
  history?: string[];
} & Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "value" | "onChange" | "list"
>) {
  // 重複除去（プリセット → ユーザーカスタム → 履歴 の順で優先）
  const seen = new Set<string>();
  const merged: string[] = [];
  for (const v of [...DEFAULT_PURPOSE_PRESETS, ...customPresets, ...history]) {
    const trimmed = v.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    merged.push(trimmed);
  }

  const listId = id ? `${id}-list` : "purpose-list";

  return (
    <>
      <input
        {...props}
        type="text"
        id={id}
        list={listId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={props.className ?? "input"}
        autoComplete="off"
      />
      <datalist id={listId}>
        {merged.map((p) => (
          <option key={p} value={p} />
        ))}
      </datalist>
    </>
  );
}
