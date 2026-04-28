# セットアップ手順

このドキュメントは、Step 1（端末不要・MVP）を完了させるために必要な外部サービスのセットアップ手順を順番に説明します。

## 1. Supabase（DB + 認証 + Magic Link）

1. https://supabase.com にサインアップ（GitHub 認証 OK）
2. New Project → 名前: `ryohi-app`、リージョン: `Northeast Asia (Tokyo)` を推奨
3. プロジェクト作成完了後、左メニュー Settings → API
4. 以下の3つの値を `web/.env.local` に貼り付け:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon / public` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` → `SUPABASE_SERVICE_ROLE_KEY`（**サーバ専用・公開しない**）

### スキーマ作成（あとで実装）

`web/supabase/migrations/` に SQL を置いて `supabase db push` で反映予定。
今は手動で SQL Editor から実行してもOK。

エンティティは `web/src/types/index.ts` の通り。

## 2. Cloudflare R2（証拠保管）

1. https://dash.cloudflare.com にサインアップ（無料）
2. 左メニュー R2 → R2 を有効化（クレジットカード登録は **無料枠だけなら不要** だが、念のため）
3. Create bucket → 名前: `ryohi-evidence`、リージョン: APAC
4. 右上 Manage R2 API tokens → Create API token →
   - Permissions: Object Read & Write
   - Bucket: `ryohi-evidence` のみ
   - 作成 → `Access Key ID` と `Secret Access Key` を表示。**1度しか見えないので保存**
5. `web/.env.local` に貼り付け:
   - `R2_ACCOUNT_ID`（dashboard 右上に表示されている）
   - `R2_ACCESS_KEY_ID`
   - `R2_SECRET_ACCESS_KEY`
   - `R2_BUCKET_NAME=ryohi-evidence`

### Object Lock 設定（証拠改ざん防止）

Bucket Settings → Object Lock を有効化 → Compliance Mode → 7 years。
※ Object Lock は無効化できないため、production で有効化前にテストすること。

## 3. Inngest（cron バッチ）

1. https://www.inngest.com にサインアップ（無料・GitHub 認証）
2. New App → 名前: `ryohi-app`
3. Settings → Event Keys / Signing Keys を取得
4. `web/.env.local` に貼り付け:
   - `INNGEST_EVENT_KEY`
   - `INNGEST_SIGNING_KEY`

## 4. ローカル起動確認

```bash
cd web
cp .env.example .env.local
# .env.local を編集して上記の値を入れる
npm run dev
```

http://localhost:3000 でセットアップ完了画面が表示されればOK。

## 5. 動作確認

```bash
cd web
npm test       # 21 件のアルゴリズムテスト
npm run build  # production ビルド
```

すべて通ればセットアップ完了。

---

## 6. 後続: Mobile (Expo)

Step 2 の友人 Android 検証フェーズに入るタイミングで `mobile/README.md` の手順で初期化。

## 7. 後続: Vercel デプロイ

ベータテスト時に Vercel にデプロイ。

```bash
npm i -g vercel
vercel login
vercel link
vercel env add NEXT_PUBLIC_SUPABASE_URL  # 順次 .env.local の項目を全部
vercel deploy --prod
```
