# Supabase セットアップ手順

`migrations/0001_init.sql` を Supabase Dashboard で実行する手順。

## 前提

- Supabase プロジェクト作成済み（プロジェクト名: ryohi-app など）
- `web/.env.local` に URL / anon key / service_role key が入っている

## 手順

### Step 1: スキーマ作成（5分）

1. https://supabase.com/dashboard を開く
2. プロジェクトを選択
3. 左サイドバー **「SQL Editor」**（`</>` アイコン）
4. 右上 **「+ New query」**
5. `web/supabase/migrations/0001_init.sql` の **全内容をコピー** してエディタに貼り付け
6. 右下 **「Run」** または `Ctrl+Enter`
7. 成功すると下部に "PLEX 出張ログ 初期スキーマ作成完了" のメッセージ
8. 左サイドバー **「Table Editor」** で以下のテーブルが作成されたことを確認:
   - accounts
   - account_settings
   - location_stays
   - trips
   - evidence
   - admin_audit_log

### Step 2: Authentication 設定（3分）

1. 左サイドバー **「Authentication」** → **「URL Configuration」**
2. **Site URL**: `http://localhost:3000`
3. **Redirect URLs** に追加:
   - `http://localhost:3000/**`
4. 「Save changes」

### Step 3: 自分を Admin として登録（5分）

PLEX 運営側の Admin アカウントとして自分を登録する。

#### 3-1. auth.users に自分を作成
1. 左サイドバー **「Authentication」** → **「Users」**
2. 右上 **「Add user」** → **「Create new user」**
3. Email: 自分のメアド（例: `matsumotosasuga@gmail.com`）
4. **「Auto Confirm User」をチェック**（メール確認をスキップ）
5. パスワードは空でOK（Magic Link 方式なので不要）
6. **「Create user」**

#### 3-2. public.accounts に admin として挿入
1. 左サイドバー **「SQL Editor」**
2. 新しいクエリで以下を実行（メアドを自分のものに置き換え）:

```sql
insert into public.accounts (id, email, name, company_name, role, status)
values (
  (select id from auth.users where email = 'matsumotosasuga@gmail.com'),
  'matsumotosasuga@gmail.com',
  '松本 颯',
  'PLEX',
  'admin',
  'active'
);
```

3. 「Run」
4. 確認: Table Editor → accounts に1行入っていて role='admin' であること

### Step 4: Storage バケット作成（3分）

R2 を使わず Supabase Storage で証拠保管する。

1. 左サイドバー **「Storage」**
2. **「New bucket」**
3. Name: `evidence`
4. **Public bucket: OFF**（プライベート・署名付きURLでアクセス）
5. File size limit: 50 MB（月次ZIPを想定）
6. **「Save」**

#### Storage の RLS ポリシー設定
1. Storage → Policies タブ
2. evidence バケットの「New policy」
3. Template: **「Give users access to own folder」** を選択（または下記カスタム）

カスタム例（service_role が書く前提・ユーザーは自分のファイルだけ DL）:

```sql
-- ユーザーは自分の account_id 配下のオブジェクトのみ select 可能
create policy "Users can read own evidence"
  on storage.objects for select
  using (
    bucket_id = 'evidence'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
```

格納パス例: `evidence/<account_id>/<period>/log.pdf`

### Step 5: 動作確認

```bash
cd "C:\Users\matsu\plex\ryohi\output\ryohi-app\web"
npm run dev
```

`http://localhost:3000` を開いてセットアップ画面が表示されればOK。Supabase 接続のテスト UI は次のターンで実装します。

## トラブルシューティング

### スキーマ実行で「relation auth.users does not exist」
→ Supabase の auth スキーマが見えていない可能性。プロジェクトを再選択するか、SQL Editor で `select * from auth.users limit 1;` でアクセスできるか確認。

### accounts への insert で permission denied
→ SQL Editor は service_role で動作するので RLS 影響を受けないはずだが、もし出たら: `set role postgres;` を最初に実行してから insert。

### account_settings が自動作成されない
→ トリガが失敗している可能性。`select * from public.account_settings;` で確認。なければ手動 insert:
```sql
insert into public.account_settings (account_id) values ('<your-account-id>');
```

## ローテーション（service_role キーが漏洩した場合）

1. Settings → API
2. `service_role` の右側「Reset」ボタン
3. 新しいキーを `web/.env.local` に上書き
4. デプロイ済みなら Vercel 環境変数も更新
