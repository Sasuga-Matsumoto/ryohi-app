"use client";

import dynamic from "next/dynamic";

const TripMapInner = dynamic(() => import("./TripMapInner"), {
  ssr: false,
  loading: () => (
    <div
      style={{
        height: 480,
        background: "#F1F5F9",
        borderRadius: 8,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "var(--text-light)",
      }}
    >
      地図を読み込み中…
    </div>
  ),
});

export default TripMapInner;
