# PLEX 出張ログ

GPS自動記録で月次出張ログを自動生成・証拠保管するサービス。

設計の詳細はプラン文書を参照: `C:\Users\matsu\.claude\plans\https-log-track-com-service-parallel-sky.md`

## 構成

```
ryohi-app/
├── web/        Next.js 16 (顧客側 Web + Admin Console + API)
└── mobile/     Expo (React Native) - GPS記録アプリ（後で初期化）
```

## Step 1（今すぐ着手・端末不要）

### web/ のセットアップ

```bash
cd web
npm install
npm test                # アルゴリズムの単体テスト実行
npm run dev             # ローカル起動（要 .env.local）
```

### 外部サービスのアカウント作成（Step 1 完了に必要）

各サービスで無料プラン作成 → API キーを `.env.local` に記載:

| サービス | 用途 | 無料プラン上限 | URL |
|---|---|---|---|
| **Supabase** | DB + 認証 + Magic Link | DB 500MB、5万MAU | https://supabase.com |
| **Cloudflare R2** | 証拠保管（S3互換）| 10GB/月、エグレス無料 | https://dash.cloudflare.com |
| **Inngest** | cron バッチ | 5万ステップ/月 | https://www.inngest.com |
| **Vercel** | デプロイ（任意・dev時はローカル）| 100GB帯域/月 | https://vercel.com |

`web/.env.example` を `.env.local` にコピーして埋めてください。

### Supabase のスキーマ（実装時に追加）

`web/src/types/index.ts` のエンティティ定義を Postgres スキーマに変換する SQL を `supabase/migrations/` に配置予定。

## Step 2（実機検証・友人 Android 借用）

```bash
cd mobile
eas build --profile preview --platform android
# 完了後、URL から APK をダウンロードして友人の Android にインストール
```

## 開発タスクの進捗

プラン §9 開発タスク順序を参照。

| # | タスク | 状況 |
|---|---|---|
| 1 | Supabase プロジェクト作成・スキーマ反映 | 未（要アカウント）|
| 2 | Cloudflare R2 バケット作成 | 未（要アカウント）|
| 3 | Inngest プロジェクト作成 | 未（要アカウント）|
| 4 | Next.js 16 で web/ + api 立ち上げ | ✅ 雛形完了 |
| 5 | Magic Link 認証導入 | 未 |
| 6 | Admin Console 実装 | 未 |
| 7 | 出張判定アルゴリズム + テスト | ✅ |
| 8 | 月次出張ログ生成（PDF + CSV + ZIP）| 未 |
| 9 | 顧客側 Web 管理画面 | 未 |
| 10 | API モック投入エンドポイント | 未 |
| 11 | Expo App 雛型 | 未 |
| 12 | Android Emulator UI 検証 | 未 |
| 13 | EAS Build APK 出力 | 未 |

## 受入チェック

プラン §検証手順 の Step 1 受入チェック 24項目を順次クリアしていく。
