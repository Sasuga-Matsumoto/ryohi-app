# PLEX 出張ログ - Mobile (Expo)

GPS バックグラウンド記録アプリ。Step 2（友人 Android 借用）の検証フェーズで使う。

## 初期セットアップ（未実施）

このフォルダはまだ空です。以下のコマンドで初期化してください:

```bash
cd "C:\Users\matsu\plex\ryohi\アウトプット\ryohi-app"
npx create-expo-app@latest mobile --template blank-typescript

cd mobile
npm install expo-location expo-task-manager expo-notifications expo-device @supabase/supabase-js
npm install -D @types/react
```

`npx create-expo-app` はインタラクティブに動くため、手動実行が必要です（Claude Code から非インタラクティブで動かすのは不安定）。

## 初期化後にやること

1. `app.json` の plugins に `expo-location` と `expo-task-manager` を追加し、
   バックグラウンド位置情報の権限文言を設定
2. `App.tsx` を Magic Link ログイン → オンボーディング 7ステップ → ホーム の構造に書き換え
3. `expo-task-manager` で bg location task を登録
4. EAS Build の設定: `npx eas-cli build:configure`

詳細は `アウトプット/ryohi-app/web` 側の同じデータモデル（`web/src/types/index.ts`）を参照。
モバイル側は基本的に **GPS 観測点を集約して滞在ノード化、サーバへ送信** するのが主仕事。
