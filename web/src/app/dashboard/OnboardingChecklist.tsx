"use client";

import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  CheckIcon,
  ChevronRightIcon,
  HomeIcon,
  BuildingIcon,
  UserIcon,
  ShieldIcon,
  MapPinIcon,
} from "@/components/Icon";

type Step = {
  id: string;
  title: string;
  done: boolean;
  icon: React.ReactNode;
  detail?: React.ReactNode;
};

export default function OnboardingChecklist({
  homeSet,
  workSet,
  mobileLaunched,
  permissionGranted,
  installUrl,
}: {
  homeSet: boolean;
  workSet: boolean;
  mobileLaunched: boolean;
  permissionGranted: boolean;
  installUrl: string;
}) {
  const [showQr, setShowQr] = useState(false);

  const steps: Step[] = [
    {
      id: "account",
      title: "アカウント作成",
      done: true,
      icon: <UserIcon size={16} />,
    },
    {
      id: "home",
      title: "自宅エリアを設定",
      done: homeSet,
      icon: <HomeIcon size={16} />,
      detail: !homeSet && (
        <a
          href="/dashboard/settings#sec-home"
          className="btn btn-soft btn-sm"
        >
          設定する
          <ChevronRightIcon size={12} />
        </a>
      ),
    },
    {
      id: "work",
      title: "勤務地エリアを設定",
      done: workSet,
      icon: <BuildingIcon size={16} />,
      detail: !workSet && (
        <a
          href="/dashboard/settings#sec-work"
          className="btn btn-soft btn-sm"
        >
          設定する
          <ChevronRightIcon size={12} />
        </a>
      ),
    },
    {
      id: "mobile",
      title: "モバイルアプリを起動",
      done: mobileLaunched,
      icon: <MapPinIcon size={16} />,
      detail: !mobileLaunched && (
        <button
          type="button"
          onClick={() => setShowQr((v) => !v)}
          className="btn btn-soft btn-sm"
        >
          {showQr ? "QR を閉じる" : "QR コードを表示"}
          <ChevronRightIcon size={12} />
        </button>
      ),
    },
    {
      id: "permission",
      title: "位置情報を「常に許可」に設定",
      done: permissionGranted,
      icon: <ShieldIcon size={16} />,
      detail: !permissionGranted && (
        <a
          href="/help/install"
          className="btn btn-soft btn-sm"
        >
          手順を見る
          <ChevronRightIcon size={12} />
        </a>
      ),
    },
  ];

  const completedCount = steps.filter((s) => s.done).length;
  const totalCount = steps.length;
  const allDone = completedCount === totalCount;

  if (allDone) return null;

  return (
    <section
      className="card"
      style={{
        marginBottom: "var(--space-6)",
        background:
          "linear-gradient(135deg, var(--info-bg) 0%, var(--surface) 60%)",
        borderColor: "var(--light-blue)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "var(--space-3)",
          flexWrap: "wrap",
          marginBottom: "var(--space-4)",
        }}
      >
        <div>
          <h2
            className="section-title"
            style={{ marginBottom: 4, color: "var(--dark-blue)" }}
          >
            セットアップ進捗
          </h2>
          <p className="text-sm text-muted" style={{ margin: 0 }}>
            自動記録を始めるためにあと {totalCount - completedCount} ステップ
          </p>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--space-2)",
          }}
        >
          <span
            className="text-strong"
            style={{
              fontSize: "var(--text-2xl)",
              fontWeight: 700,
              fontVariantNumeric: "tabular-nums",
              color: "var(--bright-blue)",
            }}
          >
            {completedCount}
            <span
              className="text-light"
              style={{ fontSize: "var(--text-base)", fontWeight: 500 }}
            >
              {" "}
              / {totalCount}
            </span>
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <div
        style={{
          height: 6,
          borderRadius: 3,
          background: "var(--border)",
          overflow: "hidden",
          marginBottom: "var(--space-4)",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${(completedCount / totalCount) * 100}%`,
            background: "var(--bright-blue)",
            transition: "width 320ms ease",
          }}
        />
      </div>

      {/* Steps */}
      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {steps.map((s, i) => (
          <li
            key={s.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--space-3)",
              padding: "var(--space-3) 0",
              borderTop: i > 0 ? "1px solid var(--border)" : "none",
              flexWrap: "wrap",
            }}
          >
            <span
              style={{
                width: 28,
                height: 28,
                borderRadius: "50%",
                background: s.done ? "var(--success)" : "var(--surface)",
                border: s.done
                  ? "2px solid var(--success)"
                  : "2px solid var(--border-strong)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                color: s.done ? "white" : "var(--text-muted)",
                flexShrink: 0,
              }}
            >
              {s.done ? <CheckIcon size={14} /> : s.icon}
            </span>
            <span
              style={{
                flex: 1,
                minWidth: 0,
                fontWeight: s.done ? 400 : 600,
                color: s.done ? "var(--text-muted)" : "var(--text)",
                textDecoration: s.done ? "line-through" : "none",
              }}
            >
              {s.title}
            </span>
            {s.detail && <span style={{ flexShrink: 0 }}>{s.detail}</span>}
          </li>
        ))}
      </ul>

      {/* QR display when expanded */}
      {showQr && !mobileLaunched && (
        <div
          style={{
            marginTop: "var(--space-4)",
            padding: "var(--space-4)",
            background: "var(--surface)",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--border)",
            display: "flex",
            gap: "var(--space-4)",
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <div
            style={{
              padding: 8,
              background: "white",
              borderRadius: "var(--radius-sm)",
              flexShrink: 0,
            }}
          >
            <QRCodeSVG
              value={installUrl}
              size={140}
              level="M"
              fgColor="#1E3A8A"
            />
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <h3
              style={{
                fontSize: "var(--text-base)",
                fontWeight: 700,
                margin: 0,
                marginBottom: 6,
              }}
            >
              スマホでこの QR をスキャン
            </h3>
            <p
              className="text-sm text-light"
              style={{ margin: 0, lineHeight: 1.6 }}
            >
              スマホのカメラで読み取ると、インストール手順ページが開きます。
              アプリ準備中のため、手順は順次更新されます。
            </p>
            <a
              href={installUrl}
              className="btn btn-link btn-sm"
              style={{ marginTop: 8, padding: 0 }}
            >
              手順ページを開く →
            </a>
          </div>
        </div>
      )}
    </section>
  );
}
