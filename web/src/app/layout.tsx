import type { Metadata } from "next";
import AppHeader from "@/components/AppHeader";
import "./globals.css";

export const metadata: Metadata = {
  title: "PLEX 出張ログ",
  description: "GPS自動記録で月次出張ログを自動生成・証拠保管するサービス",
  icons: {
    icon: [
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon.png", sizes: "180x180", type: "image/png" },
    ],
    apple: [{ url: "/favicon.png", sizes: "180x180" }],
  },
  other: {
    "theme-color": "#1E3A8A",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <AppHeader />
        {children}
      </body>
    </html>
  );
}
