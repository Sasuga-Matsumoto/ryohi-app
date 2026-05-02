import {
  ArrowLeftIcon,
  MapPinIcon,
  ShieldIcon,
  CheckIcon,
  AlertTriangleIcon,
} from "@/components/Icon";

export const metadata = {
  title: "モバイルアプリのインストール | Log Tracker",
};

export default function InstallGuidePage() {
  return (
    <main className="container page" style={{ maxWidth: 720 }}>
      <div className="breadcrumb">
        <a href="/dashboard">
          <ArrowLeftIcon
            size={12}
            style={{
              display: "inline",
              verticalAlign: "middle",
              marginRight: 4,
            }}
          />
          ダッシュボード
        </a>
      </div>

      <header className="page-header">
        <div>
          <h1 className="page-title">モバイルアプリのインストール</h1>
          <p className="page-subtitle">
            自動 GPS 記録を開始するためのセットアップ手順
          </p>
        </div>
      </header>

      {/* 準備中のお知らせ */}
      <div className="alert alert-info" style={{ marginBottom: "var(--space-6)" }}>
        <AlertTriangleIcon
          size={20}
          style={{ flexShrink: 0, marginTop: 2 }}
        />
        <div>
          <strong>現在、モバイルアプリは公開準備中です</strong>
          <p style={{ marginTop: 4, lineHeight: 1.7 }}>
            一般公開後、こちらに Google Play / App Store のリンクが掲載されます。
            ベータ版にご参加いただいている方には別途ご案内します。
          </p>
        </div>
      </div>

      {/* 手順 */}
      <ol style={{ listStyle: "none", padding: 0, margin: 0 }}>
        <li className="card" style={{ marginBottom: "var(--space-4)" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--space-3)",
              marginBottom: "var(--space-3)",
            }}
          >
            <span
              style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                background: "var(--bright-blue)",
                color: "white",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              1
            </span>
            <h2
              className="section-title"
              style={{ marginBottom: 0, flex: 1 }}
            >
              アプリをインストール
            </h2>
          </div>
          <p style={{ lineHeight: 1.7 }}>
            App Store / Google Play からインストールしてください。
          </p>
          <p
            className="text-sm text-muted"
            style={{
              marginTop: "var(--space-3)",
              padding: "var(--space-3)",
              background: "var(--surface-muted)",
              borderRadius: "var(--radius-md)",
              fontStyle: "italic",
            }}
          >
            🚧 公開準備中
          </p>
        </li>

        <li className="card" style={{ marginBottom: "var(--space-4)" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--space-3)",
              marginBottom: "var(--space-3)",
            }}
          >
            <span
              style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                background: "var(--bright-blue)",
                color: "white",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              2
            </span>
            <h2
              className="section-title"
              style={{ marginBottom: 0, flex: 1 }}
            >
              アプリでログイン
            </h2>
          </div>
          <p style={{ lineHeight: 1.7 }}>
            アプリ起動後、Web ログインと **同じメールアドレス** を入力。
            メールに届くリンクをタップすれば自動でログイン完了です（パスワード不要）。
          </p>
        </li>

        <li className="card" style={{ marginBottom: "var(--space-4)" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--space-3)",
              marginBottom: "var(--space-3)",
            }}
          >
            <span
              style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                background: "var(--bright-blue)",
                color: "white",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              3
            </span>
            <h2
              className="section-title"
              style={{
                marginBottom: 0,
                flex: 1,
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <ShieldIcon size={18} />
              位置情報を「常に許可」に設定
            </h2>
          </div>
          <p style={{ lineHeight: 1.7, marginBottom: "var(--space-3)" }}>
            このアプリは <strong>勤務地・自宅エリアを離れた時だけ</strong>
            GPS を起動する省電力設計です。バックグラウンドでも動作させるため、
            位置情報は「常に許可」が必要です。
          </p>

          <h3
            style={{
              fontSize: "var(--text-sm)",
              fontWeight: 700,
              marginTop: "var(--space-4)",
              marginBottom: "var(--space-2)",
            }}
          >
            Android の場合
          </h3>
          <ol
            style={{
              paddingLeft: "var(--space-5)",
              lineHeight: 1.8,
              fontSize: "var(--text-sm)",
            }}
          >
            <li>アプリの警告から「権限画面を開く」をタップ</li>
            <li>「権限」→「位置情報」</li>
            <li>「常に許可」を選択</li>
          </ol>

          <h3
            style={{
              fontSize: "var(--text-sm)",
              fontWeight: 700,
              marginTop: "var(--space-4)",
              marginBottom: "var(--space-2)",
            }}
          >
            iOS の場合
          </h3>
          <ol
            style={{
              paddingLeft: "var(--space-5)",
              lineHeight: 1.8,
              fontSize: "var(--text-sm)",
            }}
          >
            <li>設定アプリを開く</li>
            <li>下にスクロール → Log Tracker</li>
            <li>「位置情報」→「常に」を選択</li>
            <li>「正確な位置情報」を ON</li>
          </ol>
        </li>

        <li className="card" style={{ marginBottom: "var(--space-4)" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--space-3)",
              marginBottom: "var(--space-3)",
            }}
          >
            <span
              style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                background: "var(--success)",
                color: "white",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              <CheckIcon size={18} />
            </span>
            <h2
              className="section-title"
              style={{ marginBottom: 0, flex: 1 }}
            >
              完了
            </h2>
          </div>
          <p style={{ lineHeight: 1.7 }}>
            アプリのホーム画面に「✓ 自動記録中」と表示されれば設定完了です。
            あとは普段通りアプリを閉じて生活してください。出張時の経路が自動で記録されます。
          </p>
        </li>
      </ol>

      <h2
        className="section-title"
        style={{
          marginTop: "var(--space-8)",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <MapPinIcon size={18} />
        よくある質問
      </h2>

      <div className="card" style={{ marginBottom: "var(--space-3)" }}>
        <details>
          <summary
            style={{
              cursor: "pointer",
              fontWeight: 600,
              padding: "var(--space-2) 0",
            }}
          >
            バッテリーへの影響は？
          </summary>
          <p
            style={{
              marginTop: "var(--space-2)",
              lineHeight: 1.7,
              color: "var(--text-light)",
            }}
          >
            通常時は GPS チップを停止し、Geofence
            （半径100m）の境界検知だけが動いています。出張時のみ高精度 GPS
            が起動するため、追加バッテリー消費は 1 日あたり 5〜10% 以内が目安です。
          </p>
        </details>
      </div>

      <div className="card" style={{ marginBottom: "var(--space-3)" }}>
        <details>
          <summary
            style={{
              cursor: "pointer",
              fontWeight: 600,
              padding: "var(--space-2) 0",
            }}
          >
            私的な移動も記録されてしまう？
          </summary>
          <p
            style={{
              marginTop: "var(--space-2)",
              lineHeight: 1.7,
              color: "var(--text-light)",
            }}
          >
            自宅エリアと勤務地エリアの行き来は通勤として自動除外されます。
            業務時間外や休日（設定により）の移動も自動的に除外フラグが付き、
            月次レポートには含まれません（後から復元も可能）。
          </p>
        </details>
      </div>

      <div className="card" style={{ marginBottom: "var(--space-3)" }}>
        <details>
          <summary
            style={{
              cursor: "pointer",
              fontWeight: 600,
              padding: "var(--space-2) 0",
            }}
          >
            アプリを閉じても動作する？
          </summary>
          <p
            style={{
              marginTop: "var(--space-2)",
              lineHeight: 1.7,
              color: "var(--text-light)",
            }}
          >
            動作します。OS のジオフェンス機能を使うため、アプリを完全終了しても
            自宅・勤務地エリアを出ると自動でアプリが起動して GPS を記録します。
          </p>
        </details>
      </div>
    </main>
  );
}
