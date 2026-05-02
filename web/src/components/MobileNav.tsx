"use client";

import { useState, useEffect } from "react";
import { HomeIcon, ShieldIcon, LogOutIcon, SettingsIcon, UserIcon, MenuIcon, XIcon } from "@/components/Icon";

export default function MobileNav({
  role,
  name,
}: {
  role: "user" | "admin";
  name: string;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  // Close on route navigation (server-rendered links cause full reload, but for client nav)
  useEffect(() => {
    const onPop = () => setOpen(false);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  return (
    <>
      <button
        type="button"
        className="app-nav-toggle"
        onClick={() => setOpen(true)}
        aria-label="メニューを開く"
        aria-expanded={open}
      >
        <MenuIcon size={20} />
      </button>

      <div
        className={`app-nav-backdrop ${open ? "open" : ""}`}
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />

      <nav
        className={`app-nav-drawer ${open ? "open" : ""}`}
        aria-label="モバイルメニュー"
        aria-hidden={!open}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "var(--space-3)",
          }}
        >
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: "var(--text-sm)",
              color: "var(--text-light)",
            }}
          >
            <UserIcon size={14} />
            {name}
          </span>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="メニューを閉じる"
            style={{
              width: 36,
              height: 36,
              borderRadius: "var(--radius-md)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <XIcon size={18} />
          </button>
        </div>

        <span className="drawer-section-title">メニュー</span>
        <a href="/dashboard" onClick={() => setOpen(false)}>
          <HomeIcon size={18} />
          ダッシュボード
        </a>
        <a href="/dashboard/settings" onClick={() => setOpen(false)}>
          <SettingsIcon size={18} />
          設定
        </a>
        {role === "admin" && (
          <a href="/admin" onClick={() => setOpen(false)}>
            <ShieldIcon size={18} />
            Admin
          </a>
        )}

        <div className="drawer-divider" />

        <form action="/auth/signout" method="post" style={{ width: "100%" }}>
          <button type="submit" aria-label="ログアウト">
            <LogOutIcon size={18} />
            ログアウト
          </button>
        </form>
      </nav>
    </>
  );
}
