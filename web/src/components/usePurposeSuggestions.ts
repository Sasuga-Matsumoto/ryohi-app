"use client";

import { useEffect, useState } from "react";

/**
 * Trip 編集 UI 共通の purpose サジェストフック
 */
export function usePurposeSuggestions() {
  const [presets, setPresets] = useState<string[]>([]);
  const [history, setHistory] = useState<string[]>([]);

  useEffect(() => {
    let aborted = false;
    fetch("/api/trip-purposes")
      .then((r) => r.json())
      .then((d: { presets?: string[]; history?: string[] }) => {
        if (aborted) return;
        if (Array.isArray(d.presets)) setPresets(d.presets);
        if (Array.isArray(d.history)) setHistory(d.history);
      })
      .catch(() => {});
    return () => {
      aborted = true;
    };
  }, []);

  return { presets, history };
}
