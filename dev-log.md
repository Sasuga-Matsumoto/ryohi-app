# 開発履歴 / FBログ

ユーザー FB と対応の追跡記録。新しいセッションは下に追記する。

凡例: ✅ 完了 / ⏸ MVP 後回し / 🚧 残課題

---

## 2026-04-29

### モバイル

#### ✅ モバイル UI: 状態に応じた警告カード化

- **FB**: 「自動記録を開始」ボタンは違和感。Geofence は OS 側で永続するので普段は不要。「常に許可」前提なら、その状態を満たしていない時だけ催促を出したい。
- **対応**: HomeScreen に5状態（services_off / no_permission / fg_only / no_setting / ready）を判定。状態に応じた警告カードと CTA を出し分け。許可済み・設定済みなら「✓ 自動記録中」のみ表示。
- **実装**: `mobile/src/screens/HomeScreen.tsx`、`mobile/src/lib/location.ts` に `getCurrentLocationPermissions` / `loadLastRegisteredSetting` / `hasSettingChanged` 追加。Geofence は設定差分があった時だけ自動再登録。
- **commit**: 06b93ba

#### ✅ 手動送信ボタン削除

- **FB**: 1時間ごとに自動送信されるなら手動ボタンは不要。
- **対応**: HomeScreen から「未送信データを手動送信」ボタン + `handleManualFlush` を削除。`flushQueue` の import も削除。未送信件数の数字表示は情報パネルとして残す。
- **commit**: 06b93ba

#### ✅ アプリ→Web シームレスログイン（SSO）

- **FB**: Web 設定画面に飛ぶ時、再度メアド入力させたくない。
- **検討**: 案1（一回だけ Web ログイン・以降はブラウザ Cookie で記憶）／案2（hash 経由 token 渡し SSO）／案3（Magic Link 再送）。
- **判断**: 案2 を採用。
- **対応**:
  - Web: `web/src/app/auth/from-mobile/page.tsx` 新規。hash から `access_token` / `refresh_token` を抽出 → `supabase.auth.setSession` → `history.replaceState` で URL から消去 → `next=` に遷移。
  - Mobile: HomeScreen の `handleOpenWebSettings` で現在のセッションを取得し、URL hash に乗せて `Linking.openURL`。
  - セキュリティ: hash はサーバ送信されない／setSession 後 URL から即時消去。
- **commit**: 06b93ba

#### ⏸ アプリから自宅・勤務地を直接設定（地図 UI）

- **FB**: 自宅・勤務地を Web ではなくアプリから設定したい。
- **検討**: 案A（GPS 現在地ボタン）／案B（地図 UI・react-native-maps）／案C（ハイブリッド）。
- **一度実装**: 案B（react-native-maps + SettingsScreen.tsx + state-based ナビ）まで作成。
- **再 FB**: 「MVP では SKIP」
- **理由**: Google Maps API キー取得が必要・APK 5〜8MB 増加。Web 設定 + SSO 遷移で代替可能と判断。
- **対応**: SettingsScreen.tsx 削除、react-native-maps アンインストール、app.json から googleMaps 設定削除、App.tsx のルーティング解除。Web 誘導 + SSO で代替。
- **MVP 完了後の再検討候補**: ユーザー数・PR 拡大時に必要なら案A or 案C で再実装。

#### ✅ ローカル開発パスの日本語問題

- **症状**: `expo prebuild` がフォルダパスに「アウトプット」を含むため失敗（exit code 127・テンプレート tarball 展開で停止）。Windows + Node.js + 非 ASCII パスは相性最悪。
- **FB**: 「アウトプット → output に改名するのは？」
- **判断**: フォルダ名変更で根治。重複なし・1回限り。
- **対応**: `アウトプット/` → `output/` にリネーム。プロジェクト内10ファイル（`.claude/CLAUDE.md`、`.claude/specs/...`、`web/supabase/README.md`、`llmo-trial/...` 各種）でパス参照を一括置換。

#### ✅ Android 開発環境構築

- **症状**: gradle 9009 エラー（Java not found）／環境変数が VSCode に伝播しない／PowerShell 5.1 が UTF-8 を読めず日本語コメントで構文エラー。
- **対応**: `mobile/scripts/setup-env.ps1`（永続セット）と `mobile/scripts/run-android.ps1`（環境変数強制 + ビルド起動）作成。**コメントは英語**で書く。
- **commit**: 06b93ba

#### ✅ async-storage バージョン互換

- **症状**: gradle ビルドで `org.asyncstorage.shared_storage:storage-android:1.0.0` not found。
- **判断**: async-storage 3.0.2 は Expo SDK 54 と非互換。`npx expo install --check` で 2.2.0 が推奨と判明。
- **対応**: `npx expo install @react-native-async-storage/async-storage` で 2.2.0 に固定。
- **commit**: 06b93ba

#### ✅ Magic Link Deep Link 受け取り

- **症状**: Magic Link をタップしてアプリに戻っても「メールを送信しました」画面で止まる。Deep Link は届いていたが App.tsx で URL 解析 → setSession していなかった。
- **対応**: App.tsx に `parseTokensFromUrl` + `handleDeepLink` を実装。`Linking.addEventListener("url")` と `Linking.getInitialURL()` の両方で受け取り → `supabase.auth.setSession`。
- **追加要件**: Supabase の Authentication → URL Configuration に `ryohi://auth/callback` と `ryohi://**` を追加（手動）。
- **commit**: 06b93ba

### Web

#### ✅ 出張時間の計算ロジック修正（4.5h → 5h）

- **FB**: 「13:00 〜 19:00 なのに、4.5h になってる。本当は 5h のはず」
- **原因**: `total_minutes` を「出発〜帰着の総時間」で計算していて、移動時間が引かれていなかった。
- **対応**: 「OUT エリアでの累積滞在時間」に変更。さらに「10:00〜17:00 でも 5h と表示される」ケースは仕様（B案・移動含まず純滞在）として保持し、列名を「滞在時間」に変更。
- **commit**: a51b56b、e1f05a9

#### ✅ 経路の方向矢印 + 往路復路の曲線分離

- **FB**: 「経路に関しては矢印をつけてわかりやすくしたい」「デモで挿入する時、同じ行の経路と帰りの経路にせず、別の経路にしたい」
- **対応**: Polyline に方向矢印を追加。デモ投入時に往路と復路で逆方向に膨らむ曲線を生成。
- **commit**: 478b25e、4abc47a

#### ✅ 自宅・勤務地エリア半径を 100m に強制

- **FB**: 「勤務地エリアと自宅エリアは半径 100m に設定」「選択制ではなく強制で 100m にしたい」
- **対応**: デフォルト 1km → 100m に変更後、UI から半径選択 UI を削除しサーバ側でも 100m を強制。
- **commit**: 78d383c、5d3539d、641704a

#### ✅ 出張先・訪問地の地名粒度を市区町村+丁目まで

- **FB**: 「出張先、訪問地ですが若干粒度が荒い気もしなくもない」
- **対応**: Nominatim の zoom を 17 に上げ、市区町村 + 町 + 丁目まで取得。Trip 詳細マップは赤いドット/ピン+方向矢印に再デザイン。
- **commit**: 33f50d7、85a3de1

#### ✅ Trip → 出張 統一

- **FB**: 「Trip という表記を出張に揃えたい」
- **対応**: 顧客側 UI 全体（ダッシュボード・一覧・詳細・列名）で「出張」に統一。
- **commit**: 951001c

#### ✅ 地図のオートフィット

- **対応**: Trip 詳細マップで全経路を画面に収めるよう自動 fitBounds。
- **commit**: 7e0b5d2

#### ✅ Web ingest API（モバイル受け口）

- **対応**: `POST /api/ingest/tracks`（GPS 経路点）／`POST /api/ingest/stays`（30分以上の滞在）を新規。認証 + active 状態 + 件数上限チェック。
- **commit**: e9fe7cf

---

## 2026-04-28

### ✅ Web プロジェクト初期化

- **対応**: Next.js 16 + React 19 + Supabase + RLS + Magic Link 認証で web/ を立ち上げ。Admin Console（アカウント CRUD + 監査ログ）、ユーザーダッシュボード、設定画面、モック投入エンドポイント、出張判定トリガを順次実装。
- **commit**: 25790e1、d30a4b7、080f52b、5989d01、ff4617b

#### ✅ Supabase スキーマ実行エラー

- **FB**: 「Failed to run sql query: ERROR: 42601: syntax error at or near 'web'」
- **対応**: SQL ファイルから不要な接頭辞を除去し、Supabase Dashboard SQL Editor に再投入。
- **対応コミット**: 後続のスキーマ修正に統合

#### ✅ デモ投入の RLS エラー（❌ 投入失敗）

- **症状**: トリップ生成バッチで「投入失敗」が出る。Migration 0002 未適用 + RLS が trips 書き込みを弾く。
- **対応**: `run-judgment` で trips への upsert を service_role で行うよう変更。Migration 0002（location_tracks）も追加。
- **commit**: 90c9e03

#### ✅ Trip の編集機能（目的・除外・復元）

- **対応**: ダッシュボードからインライン編集で `Trip.purpose` を変更可能に。`is_excluded` トグルで月次出力から除外、復元も可能。
- **commit**: 5081367

#### ✅ 休日の扱い変更

- **FB**: 休日設定の挙動見直し
- **対応**: 休日もまず記録 → 自動で除外フラグ ON → 必要ならユーザーが復元できる形に変更。
- **commit**: f7eded0

#### ✅ UI/UX 全面刷新

- **対応**: デザイントークン整理、AppHeader 共通化、SVG アイコン化、SaaS プロダクト感のある見た目に刷新。
- **commit**: df8a1b2、b16bb5f

---

## 残課題（次セッション以降）

### 🚧 EAS Build による APK 配布

- 今は `npx expo run:android` でローカルビルド。実機（友人 Android）に配るためには EAS preview ビルド → APK URL → ダウンロード。
- 前提: Expo アカウント取得済み（プロジェクト ID `d3de8250-36a4-406d-933e-c626b05abf51`、owner `sasuga`）。
- 実行コマンド: `npx eas-cli@latest build --platform android --profile preview`

### 🚧 実機での Geofence / バックグラウンド GPS 動作検証

- emulator は仮想 GPS のため Geofence の発火が不安定。実機（友人 Android）で:
  - 勤務地・自宅エリアを離れた時に高頻度 GPS が起動するか
  - 1日通常使用してバッテリー消費が許容範囲（追加 5〜10% 以内）か
  - SQLite キューが 1時間毎に flush されるか
  - 機内モード→復帰でキュー再送が機能するか

### 🚧 Web 側の最適化（プラン §11 由来）

- geocode_cache テーブル追加（Nominatim 結果のサーバ側キャッシュ）
- BRIN index（時系列カラム）
- RLS ポリシーのサブクエリ最適化
- Sentry / 監視
- 月次 Evidence ZIP 生成（PDF / CSV / ZIP / R2 接続）
- Inngest cron で daily-judgment 自動化
