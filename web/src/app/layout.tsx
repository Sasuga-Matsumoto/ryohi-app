import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PLEX 出張ログ",
  description: "GPS自動記録で月次出張ログを自動生成・証拠保管するサービス",
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
      <body>{children}</body>
    </html>
  );
}
