# 開発履歴 / FBログ

ユーザー FB と対応の追跡記録。新しいセッションは下に追記する。

凡例: ✅ 完了 / ⏸ MVP 後回し / 🚧 残課題

---

## 2026-05-03

### モバイル

#### ✅ 自宅・勤務地表示を座標 → 構造化住所に

- **FB**: 「自宅と勤務地が座標表示になっているので、住所に変換するようにしてください」「神田白山線, 上野公園, 台東区, 東京都, 110-0007, 日本 こんな感じだけど 郵便番号 110-0007 / 住所 東京都 台東区 上野公園 12-8 にしてください」「自宅と勤務地に関しては詳細の住所まで記載」「勤務地の方が番地まで記載されていません」
- **対応**:
  - `/api/reverse-geocode` を Bearer 認証対応 (`getApiClient` 化) し、zoom 17 → 18 + `extratags=1&namedetails=1` で番地まで取得。
  - 共通 formatter (`web/lib/address-format.ts` / mobile `health.ts.formatJapaneseAddress`) を `{ postcode, line, buildingName }` に統一。Web の LocationPicker / Mobile PlaceCard で「郵便番号 / 住所 / 建物名」3 行表示に。
  - オフィスビル等で `house_number` が無いケース向けに `extratags["addr:housenumber"]` フォールバック + 建物名 (`name` / `building` / `office` / `amenity`) を補助表示。
- **commit**: 84cdfc5、e635e05、46b58c3

#### ✅ 「記録停止中」の検知

- **FB**: 「記録停止中ですが表示されていないようです」
- **原因**: ステータス判定が「権限 + 設定があれば ready」だけで、実際の geofence タスクが動いているかをチェックしておらず、OS が geofence を破棄しても「自動記録中」と嘘表示が続く。
- **対応**:
  - `Location.hasStartedGeofencingAsync` で実起動を確認。動いていなければ設定差分が無くても再登録を試行。それでも起動しなければ新ステータス `not_recording` に遷移。
  - StatusHero は `not_recording` で「記録停止中」、新 WarningCard が「記録を再開する」ボタン (`handleResumeRecording` で registerGeofence + registerFlushTask + init 再実行)。
  - Web 側 (`/api/health` VALID_STATUSES、Admin アカウント詳細、Dashboard オンボーディング ゲート) も `not_recording` を受け入れるように拡張。
- **commit**: 575e16c

#### ✅ 自宅 or 勤務地の片方未設定時のボタン重複

- **FB**: 「自宅のみ未設定の場合や、勤務地のみ未設定の場合でも両方の設定ボタンが表示されています」
- **対応**: `no_setting` 状態の警告カードで未設定の方だけボタンを描画。タイトルも分岐 (両方 / 自宅のみ / 勤務地のみ)。
- **commit**: 90591e6

#### ✅ Noto Sans JP モバイル全面適用

- **FB**: 「Mobile 側のフォントも全て Noto Sans JP にしてください」
- **対応**:
  - `@expo-google-fonts/noto-sans-jp` 導入 (400/500/600/700)、`expo-splash-screen` でフォントロード待ち。
  - `theme.ts` に `fonts` マップ追加、`typography` を `fontFamily` ベースに変更、各画面の inline `fontWeight` を `fontFamily` に置換。
- **派生 FB**: 「ベース設定の番号と円がズレている」
  - **原因**: Noto Sans JP の上下パディングで `1` が中心に来ない。
  - **対応**: `lineHeight: 14 / textAlign: "center" / includeFontPadding: false` で円中心に寄せる。
- **commit**: e883136、fa062b1

#### ✅ デフォルト目的の strict ドロップダウン化（Web 側）

- **FB**: 「Web 側の出張目的の部分がやはり入力形式になっている。ドロップダウンで入力不可で簡単に選ぶことができる形式に修正」
- **対応**: SettingsForm.tsx の `default_purpose` を `PurposeInput` (datalist + 自由入力可) から strict `<select>` に置き換え。`DEFAULT_PURPOSE_PRESETS` + `purpose_presets` のみ選択可、過去の自由入力値は先頭に表示して移行できるように。per-trip の目的入力 (TripCard / TripRow / ManualTripForm 等) は引き続き自由入力を許容。
- **commit**: e883136

### Web

#### ✅ Mobile レイアウト崩れの一掃

- **FB**: 「モバイルの Web ダッシュボードがやはり若干レイアウトが崩れている」
- **対応** (CSS のみ):
  - `.card-header` に `flex-wrap: wrap` + gap で「月の出張一覧 + 件数 + 手動追加」が窮屈にならないように。
  - KPI グリッド: `min-width: 0`、ラベル ellipsis、`tabular-nums`、480px 以下では `stat-value` を text-xl → text-lg。
  - `.trip-card-head / -meta / -purpose` を `flex-wrap` に。
  - `.setting-summary` の mobile padding を縮小。
  - DevControls の固定幅 input/select (160 / 280px) を CSS クラス化、640px 以下で 100% 幅縦積み。
- **commit**: fdf350e

---

## 2026-04-30 〜 05-02

### モバイル

#### ✅ Phase 1-4: 顧客体験フィーチャ

- **FB**: 「顧客体験を良くするために、他に何を修正・追加すべきか考えてください」→ 採択は 2,4,5,6,7
- **Phase 1**: ヘルスチェック 1h 自動再送 + Web ダッシュボードのオンボーディングチェックリスト + QR インストール導線。
- **Phase 2**: 出張目的のプリセット。`account_settings.purpose_presets` (Migration 0006) + ユーザー管理 UI。デフォルトは `顧客訪問 / 商談 / 視察 / 展示会`。
- **Phase 3**: 手動 Trip 追加 + 既存 Trip の編集（出発・帰着・出張先）。`trips.status` CHECK 緩和 + `edit_source` / `edited_at` 列追加 (Migration 0007) + INSERT RLS。
- **Phase 4**: モバイル ホーム画面に「今日の記録」パネル。直近 GPS 受信時刻・経路点数・滞在件数。
- **commit**: 4d8ae85、1b4a6e9、9b1b5a1、fe8f840

#### ✅ モバイル ネイティブ設定画面（Web parity）

- **FB**: 「これ、同じ仕組みを使ってアプリ側で自宅と勤務地の設定もできるのでは？」「モバイルにも設定画面を作ろう。Web と同様の項目をモバイルでも設定できるように」
- **対応**:
  - `SettingsScreen.tsx` を新規。判定ルール / 業務時間 / 出張目的プリセット / 自宅・勤務地ピッカーを Web SettingsForm と同等に。`updateSetting()` で 600ms debounce 自動保存。
  - 自宅・勤務地ピッカー: `LocationPickerMap.tsx` (WebView + Leaflet + OSM)。Google Maps API 不要で追加コスト 0。
- **派生 FB**: 「判定ルールの判の字が銃後くごっぽい表記」「数字が入力でしか変更できない、Web と同じように上下で増減」「プリセット → 出張目的の候補 等の適切な文言」「デフォルト目的はドロップダウン」
- **対応**: 判定ルールの絵文字削除、`NumberStepper` / `TimeStepper` / `PurposeDropdown` (modal-based) を実装、文言調整。
- **派生 FB**: 「出張目的がやはり入力形式」→ strict modal-based picker に再修正 (free input 完全禁止)。
- **派生 FB**: 「Web と同様に郵便番号や住所からマップを絞れるようにしたい」→ ピッカーに住所検索バー追加 (`/api/geocode` 経由 Nominatim プロキシ)。
- **commit**: 25e6c11、c0ecb5a、de88649、b7d802e、f1615de

#### ✅ 「今日の記録」サーバ単一情報源化

- **FB**: 「モバイル側の今日の記録ですが、今日の経路の情報と整合していません」
- **原因**: stats が AsyncStorage（ローカル）、経路がサーバ → モック投入時に乖離。
- **対応**: `/api/today-tracks` を `{ tracks, staysCount, lastReceivedAt }` に拡張。`fetchTodaySummaryFromServer` を信頼ソースに、オフライン時のみローカルへフォールバック。
- **commit**: b7d802e

#### ✅ 「今日の経路マップ」WebView + Leaflet 実装

- **FB**: 「今日の経路マップを簡単に実装するにあたって、何かいい方法はない？（コスト無し）」→ 案A (WebView + Leaflet) 採択。
- **対応**: `RouteMap.tsx` を実装。Web 側のデザインに揃え、200m ドット (radius 1.5) / 0.5km 矢印 (11x11) / 1km ピン (13x21)。
- **派生 FB**: 「ピンと矢印は 1/2 にしてください」「ドットも 1/2 にしよう」→ 段階的にサイズ縮小。
- **commit**: 371922d、e8b496d、ca849c9、54fca05

### Web

#### ✅ btn-soft tertiary CTA の追加と調整

- **対応**: ダッシュボードの「設定変更」「QR コード表示」「QR を閉じる」等を softer な見た目に。
- **派生 FB**: 「ちょっと candy blue っぽい」→ テキスト色を黒に → 「微妙」→ 背景を neutral gray + subtle shadow に変更。
- **commit**: f73288a、0550d42、f254c1f

#### ✅ Leaflet z-index がページヘッダーを覆うバグ

- **症状**: 地図の Leaflet pane (z-index 200-700) が document root に出てしまい、固定ヘッダーや警告カードを覆う。
- **対応**: `position: relative; z-index: 0; isolation: isolate` で地図コンテナ側に stacking context を閉じ込め。
- **commit**: 3ac0148

#### ✅ Web 設定画面の保存ボタン強化

- **対応**: 保存ボタンに専用アイコン + ボタンサイズ拡大 + sticky save toolbar + dirty state tracking。
- **commit**: 24e272e

---

## 2026-04-30

### Mobile / Web 共通

#### ✅ サービス名リブランド

- **FB**: 「PLEX 出張ログ → PLEX Log → Log Tracker に全面的に変更」
- **対応**: アプリ名 (`app.json`)、Web ヘッダー、メタタグ、ログイン画面ブランド表記、ローディング画面、`Co-Authored-By` 等を一括置換。`mobile/assets/icon.png` 系も PLEX ロゴ由来で再生成。
- **commit**: f202663、68d4845、02d1f8b

#### ✅ Magic Link モバイル受け取り (root cause 修正)

- **症状**: Linking.createURL が SDK 54 で `ryohi:///auth/callback`（triple slash）を返す版があり、Supabase 側 redirect URL とミスマッチ → ブラウザに着地。
- **対応**: `redirectTo` を `"ryohi://auth/callback"` でハードコード。
- **commit**: 06b93ba 系列の後段（直接修正）

#### ✅ /api/* で Bearer 認証が 401 になるバグ

- **症状**: モバイルから `/api/health` 等を叩くと 401。トークンは正しい。
- **原因**: `middleware.ts` が `/api/*` も `/login` リダイレクト対象にしていた + `createServerClient` がクッキーのみ参照していた。
- **対応**:
  - `middleware.ts` の `isPublic` 判定に `path.startsWith("/api/")` を追加。
  - `web/src/lib/supabase/api-auth.ts` に `getApiClient(request)` を新設。Bearer ヘッダがあれば JWT クライアント、無ければクッキークライアントを返す。
  - 全モバイル向け API ルート (`/api/health` / `/api/today-tracks` / `/api/account-settings` / `/api/geocode` / `/api/reverse-geocode` / ingest 系) を移行。
- **commit**: 9ffaf61

#### ✅ Migration 0003-0007

- **0003**: `business_hours_enabled` (業務時間外も常に記録するか)。
- **0004**: `accounts.last_mobile_status` / `last_health_check_at` (Admin KPI 用)。
- **0005**: 自宅・勤務地半径を 100m に強制（DB デフォルト）。
- **0006**: `account_settings.purpose_presets text[]` (出張目的の候補)。
- **0007**: `trips.status CHECK` 緩和 + `edit_source` / `edited_at` 列 + INSERT RLS。
- **commit**: f112f41 ほか各 Phase コミット

### Web

#### ✅ 致命的な CSS バグ ２連発

1. **viewport meta 不足**:
   - 症状: モバイルブラウザが論理 980px で描画 → media query が発火しない。
   - 対応: `layout.tsx` に `export const viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" }`。

2. **`.page` shorthand が `.container` の左右 padding を無音でゼロ化**:
   - 症状: 「皮ってなくない？」「ぎちぎちのまま」を何度も言われたが直らない。
   - 原因: `.page { padding: var(--space-8) 0 var(--space-12) }` の shorthand と `.container { padding-left/right }` が同 specificity で source order により上書きされていた。
   - 対応: `.page` を `padding-top` / `padding-bottom` longhand に分解。
- **commit**: fec9a43、6446f36、bdb53eb

#### ✅ Admin が他ユーザーのダッシュボードを read-only で閲覧

- **対応**: `/admin/accounts/[id]/dashboard` で service_role を使い、対象ユーザーの設定 + 月次 trip + 警告状態を閲覧可能に。Trip の編集アクションは admin ビューでは無効化。
- **commit**: 24991eb

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
