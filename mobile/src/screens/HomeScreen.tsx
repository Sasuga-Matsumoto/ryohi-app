import { useEffect, useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  Alert,
  Linking,
  Modal,
  Platform,
  AppState,
  type AppStateStatus,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Location from "expo-location";
import { Feather } from "@expo/vector-icons";
import { supabase } from "../lib/supabase";
import {
  fetchMySettings,
  registerGeofence,
  registerFlushTask,
  getCurrentLocationPermissions,
  loadLastRegisteredSetting,
  hasSettingChanged,
  tearDownTracking,
  type AccountSetting,
} from "../lib/location";
import { pendingCount, fetchTodayTracks } from "../lib/queue";
import { defineTasks } from "../lib/tasks";
import {
  reportMobileStatus,
  fetchTodaySummaryFromServer,
  updateLocation,
} from "../lib/health";
import LocationPickerMap, {
  type LatLng,
} from "../components/LocationPickerMap";
import SettingsScreen from "./SettingsScreen";
import { getTodayStats, type TodayStats } from "../lib/todayStats";
import RouteMap from "../components/RouteMap";
import { colors, spacing, radius, typography, shadows, TOUCH_MIN } from "../lib/theme";

const WEB_BASE_URL = "https://ryohi-app.vercel.app";
const WEB_DASHBOARD_PATH = "/dashboard";

type Status =
  | "loading"
  | "services_off"
  | "no_permission"
  | "fg_only"
  | "no_setting"
  | "ready";

export default function HomeScreen({ session }: { session: any }) {
  const [status, setStatus] = useState<Status>("loading");
  const [setting, setSetting] = useState<AccountSetting | null>(null);
  const [pending, setPending] = useState({ tracks: 0, stays: 0 });
  const [todayStats, setTodayStats] = useState<TodayStats | null>(null);
  const [todayTracks, setTodayTracks] = useState<
    { lat: number; lng: number }[]
  >([]);
  const [refreshing, setRefreshing] = useState(false);
  // 自宅・勤務地ピッカー
  const [pickerKind, setPickerKind] = useState<"home" | "work" | null>(null);
  const [pickerSelection, setPickerSelection] = useState<LatLng | null>(null);
  const [pickerSaving, setPickerSaving] = useState(false);
  // 設定画面 Modal
  const [settingsOpen, setSettingsOpen] = useState(false);

  const init = useCallback(async () => {
    defineTasks();

    const servicesOn = await Location.hasServicesEnabledAsync();
    if (!servicesOn) {
      setStatus("services_off");
      return;
    }

    const perms = await getCurrentLocationPermissions();
    if (!perms.foreground) {
      setStatus("no_permission");
      return;
    }
    if (!perms.background) {
      setStatus("fg_only");
      return;
    }

    const s = await fetchMySettings();
    setSetting(s);
    if (!s || s.home_lat == null || s.work_lat == null) {
      setStatus("no_setting");
      return;
    }

    const cached = await loadLastRegisteredSetting();
    if (hasSettingChanged(s, cached)) {
      try {
        await registerGeofence(s);
        await registerFlushTask();
      } catch (e) {
        console.warn("[home] auto-register failed", e);
      }
    }

    const p = await pendingCount();
    setPending(p);

    // サーバを信頼ソースに：今日の記録（経路点・滞在件数・最終受信時刻）+ 経路マップ
    // オフライン時はローカル SQLite + AsyncStorage にフォールバック
    try {
      const summary = await fetchTodaySummaryFromServer();
      if (summary) {
        setTodayTracks(summary.tracks.map((r) => ({ lat: r.lat, lng: r.lng })));
        setTodayStats({
          date: new Date(Date.now() + 9 * 3600 * 1000)
            .toISOString()
            .slice(0, 10),
          trackCount: summary.tracks.length,
          stayCount: summary.staysCount,
          lastReceivedAt: summary.lastReceivedAt,
        });
      } else {
        // フォールバック: ローカル
        const local = await fetchTodayTracks();
        setTodayTracks(local.map((r) => ({ lat: r.lat, lng: r.lng })));
        const ts = await getTodayStats();
        setTodayStats(ts);
      }
    } catch (e) {
      console.warn("[home] fetchTodaySummary failed", e);
      const ts = await getTodayStats();
      setTodayStats(ts);
    }
    setStatus("ready");
  }, []);

  useEffect(() => {
    init();
  }, [init]);

  const appState = useRef(AppState.currentState);
  useEffect(() => {
    const sub = AppState.addEventListener("change", (next: AppStateStatus) => {
      if (
        appState.current.match(/inactive|background/) &&
        next === "active"
      ) {
        init();
      }
      appState.current = next;
    });
    return () => sub.remove();
  }, [init]);

  // status が変わるたびに Web に報告（Admin の「位置情報」KPI 用）
  const reportedStatusRef = useRef<Status | null>(null);
  useEffect(() => {
    if (status === "loading") return;
    if (reportedStatusRef.current === status) return;
    reportedStatusRef.current = status;
    void reportMobileStatus(status);
  }, [status]);

  // 連打や handler 並行実行を防ぐ
  const navBusyRef = useRef(false);

  const safeOpenSettings = async () => {
    try {
      await Linking.openSettings();
    } catch (e) {
      console.warn("[home] openSettings failed", e);
    }
  };

  const handleOpenLocationSettings = async () => {
    if (navBusyRef.current) return;
    navBusyRef.current = true;
    try {
      if (Platform.OS === "android") {
        try {
          await Linking.sendIntent("android.settings.LOCATION_SOURCE_SETTINGS");
          return;
        } catch (e) {
          console.warn("[home] sendIntent failed, falling back", e);
        }
      }
      await safeOpenSettings();
    } finally {
      setTimeout(() => {
        navBusyRef.current = false;
      }, 500);
    }
  };

  const handleOpenAppPermissionSettings = async () => {
    if (navBusyRef.current) return;
    navBusyRef.current = true;
    try {
      let fg;
      try {
        fg = await Location.getForegroundPermissionsAsync();
      } catch (e) {
        console.warn("[home] getFg failed", e);
        await safeOpenSettings();
        return;
      }
      if (fg.status !== "granted" && fg.canAskAgain) {
        try {
          const r = await Location.requestForegroundPermissionsAsync();
          if (r.status !== "granted") {
            await safeOpenSettings();
            return;
          }
        } catch (e) {
          console.warn("[home] requestFg failed", e);
          await safeOpenSettings();
          return;
        }
      }
      let bg;
      try {
        bg = await Location.getBackgroundPermissionsAsync();
      } catch (e) {
        console.warn("[home] getBg failed", e);
        await safeOpenSettings();
        return;
      }
      if (bg.status !== "granted" && bg.canAskAgain) {
        try {
          await Location.requestBackgroundPermissionsAsync();
        } catch (e) {
          console.warn("[home] requestBg failed", e);
        }
        await new Promise((res) => setTimeout(res, 400));
        if (AppState.currentState !== "active") return;
      }
      await safeOpenSettings();
    } finally {
      setTimeout(() => {
        navBusyRef.current = false;
      }, 500);
    }
  };

  const handleOpenWebDashboard = async () => {
    if (navBusyRef.current) return;
    navBusyRef.current = true;
    try {
      const { data: { session: cur } } = await supabase.auth.getSession();
      const fallbackUrl = `${WEB_BASE_URL}${WEB_DASHBOARD_PATH}`;
      const url =
        cur?.access_token && cur?.refresh_token
          ? `${WEB_BASE_URL}/auth/from-mobile` +
            `#access_token=${encodeURIComponent(cur.access_token)}` +
            `&refresh_token=${encodeURIComponent(cur.refresh_token)}` +
            `&next=${encodeURIComponent(WEB_DASHBOARD_PATH)}`
          : fallbackUrl;
      try {
        await Linking.openURL(url);
      } catch (e) {
        console.warn("[home] openURL failed", e);
      }
    } finally {
      setTimeout(() => {
        navBusyRef.current = false;
      }, 500);
    }
  };

  // 警告状態に遷移したら自動でポップアップ
  const popupShownForRef = useRef<Status | null>(null);
  useEffect(() => {
    const warnings: Status[] = [
      "services_off",
      "no_permission",
      "fg_only",
      "no_setting",
    ];
    if (!warnings.includes(status)) {
      popupShownForRef.current = null;
      return;
    }
    if (popupShownForRef.current === status) return;
    popupShownForRef.current = status;

    const popups: Record<
      "services_off" | "no_permission" | "fg_only" | "no_setting",
      { title: string; message: string; buttonText: string; onPress: () => void }
    > = {
      services_off: {
        title: "端末の位置情報が OFF です",
        message:
          Platform.OS === "android"
            ? "自動記録するには端末の位置情報を ON にしてください。"
            : "設定アプリ →「プライバシーとセキュリティ」→「位置情報サービス」を ON にしてください。",
        buttonText:
          Platform.OS === "android" ? "位置情報設定を開く" : "設定アプリを開く",
        onPress: handleOpenLocationSettings,
      },
      no_permission: {
        title: "位置情報の許可が必要です",
        message: "権限画面で「常に許可」を選んでください。",
        buttonText: "権限画面を開く",
        onPress: handleOpenAppPermissionSettings,
      },
      fg_only: {
        title: "「常に許可」が必要です",
        message:
          "「使用中のみ」では出張記録ができません。権限画面で「常に許可」を選んでください。",
        buttonText: "権限画面を開く",
        onPress: handleOpenAppPermissionSettings,
      },
      no_setting: {
        title: "自宅・勤務地の設定が必要です",
        message:
          "ホーム画面の「自宅エリアを設定」「勤務地エリアを設定」ボタンから地図で指定してください（半径100m）。",
        buttonText: "OK",
        onPress: () => {},
      },
    };

    const p = popups[status as keyof typeof popups];
    Alert.alert(p.title, p.message, [
      { text: "あとで", style: "cancel" },
      { text: p.buttonText, onPress: p.onPress },
    ]);
  }, [status]);

  const handleSignOut = async () => {
    await tearDownTracking();
    await supabase.auth.signOut();
  };

  const openPicker = (kind: "home" | "work") => {
    const initial =
      kind === "home"
        ? setting?.home_lat != null && setting?.home_lng != null
          ? { lat: setting.home_lat, lng: setting.home_lng }
          : null
        : setting?.work_lat != null && setting?.work_lng != null
          ? { lat: setting.work_lat, lng: setting.work_lng }
          : null;
    setPickerSelection(initial);
    setPickerKind(kind);
  };

  const closePicker = () => {
    setPickerKind(null);
    setPickerSelection(null);
  };

  const savePicker = async () => {
    if (!pickerKind || !pickerSelection) return;
    setPickerSaving(true);
    const r = await updateLocation(pickerKind, pickerSelection);
    setPickerSaving(false);
    if (!r.ok) {
      Alert.alert("保存失敗", r.error ?? "もう一度お試しください");
      return;
    }
    closePicker();
    await init();
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await init();
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {/* ヘッダー */}
        <View style={styles.header}>
          <View style={styles.brandRow}>
            <View style={styles.brandIcon}>
              <Feather name="map-pin" color={colors.white} size={18} />
            </View>
            <Text style={styles.brand}>Log Tracker</Text>
          </View>
          <Text style={styles.email}>{session?.user?.email ?? ""}</Text>
        </View>

        {/* ヒーロー: 記録状態 */}
        <StatusHero status={status} />

        {/* 警告カード（状態ごと） */}
        {status === "services_off" && (
          <WarningCard
            title="端末の位置情報が OFF です"
            body={
              Platform.OS === "android"
                ? "自動記録するには端末の位置情報を ON にしてください。"
                : "設定アプリ →「プライバシーとセキュリティ」→「位置情報サービス」を ON にしてください。"
            }
            buttonText={
              Platform.OS === "android" ? "位置情報設定を開く" : "設定アプリを開く"
            }
            onPress={handleOpenLocationSettings}
          />
        )}
        {status === "no_permission" && (
          <WarningCard
            title="位置情報の許可が必要です"
            body="下のボタンを押すと位置情報の権限画面に移動します。「常に許可」を選んでください。"
            buttonText="権限画面を開く"
            onPress={handleOpenAppPermissionSettings}
          />
        )}
        {status === "fg_only" && (
          <WarningCard
            title="「常に許可」が必要です"
            body="「使用中のみ」では出張記録ができません。下のボタンを押すと位置情報の権限画面に移動するので「常に許可」を選んでください。"
            buttonText="権限画面を開く"
            onPress={handleOpenAppPermissionSettings}
          />
        )}
        {status === "no_setting" && (
          <View style={styles.warningCard}>
            <View style={styles.warningHead}>
              <Feather
                name="alert-triangle"
                color={colors.warningText}
                size={18}
              />
              <Text style={styles.warningTitle}>
                自宅・勤務地の設定が必要です
              </Text>
            </View>
            <Text style={styles.warningBody}>
              地図でエリア（半径100m）を指定してください。Web 設定画面でも同じことができます。
            </Text>
            <TouchableOpacity
              onPress={() => openPicker("home")}
              style={[styles.warningButton, { marginBottom: spacing[2] }]}
              activeOpacity={0.85}
            >
              <Feather name="home" color={colors.white} size={16} />
              <Text style={styles.warningButtonText}>自宅エリアを設定</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => openPicker("work")}
              style={[styles.warningButton, { marginBottom: spacing[2] }]}
              activeOpacity={0.85}
            >
              <Feather name="briefcase" color={colors.white} size={16} />
              <Text style={styles.warningButtonText}>勤務地エリアを設定</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleOpenWebDashboard}
              style={[
                styles.warningButton,
                { backgroundColor: "transparent" },
              ]}
              activeOpacity={0.85}
            >
              <Text
                style={[
                  styles.warningButtonText,
                  { color: colors.warningText },
                ]}
              >
                Web でダッシュボードを開く
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* オンボーディングチェックリスト（未完了時のみ）*/}
        {status === "ready" && (
          <OnboardingChecklist
            homeSet={setting?.home_lat != null}
            workSet={setting?.work_lat != null}
            permissionGranted={true /* status='ready' = 全許可済 */}
            onSetHome={() => {
              setPickerSelection(null);
              setPickerKind("home");
            }}
            onSetWork={() => {
              setPickerSelection(null);
              setPickerKind("work");
            }}
          />
        )}

        {/* 設定 / Web ダッシュボード ショートカット */}
        {status === "ready" && (
          <View style={[styles.actionsCard, { marginBottom: spacing[3] }]}>
            <TouchableOpacity
              onPress={() => setSettingsOpen(true)}
              style={styles.actionRow}
              activeOpacity={0.6}
            >
              <View style={styles.actionRowInner}>
                <Feather name="settings" color={colors.text} size={18} />
                <Text style={styles.actionLabel}>設定</Text>
              </View>
              <Feather
                name="chevron-right"
                color={colors.textDisabled}
                size={18}
              />
            </TouchableOpacity>
            <View style={styles.actionDivider} />
            <TouchableOpacity
              onPress={handleOpenWebDashboard}
              style={styles.actionRow}
              activeOpacity={0.6}
            >
              <View style={styles.actionRowInner}>
                <Feather name="external-link" color={colors.text} size={18} />
                <Text style={styles.actionLabel}>Web でダッシュボードを開く</Text>
              </View>
              <Feather
                name="chevron-right"
                color={colors.textDisabled}
                size={18}
              />
            </TouchableOpacity>
          </View>
        )}

        {/* 今日の記録 + 送信状況 KPI（ready のみ） */}
        {status === "ready" && (
          <>
            {todayStats && (
              <TodayRecordCard
                trackCount={todayStats.trackCount}
                stayCount={todayStats.stayCount}
                lastReceivedAt={todayStats.lastReceivedAt}
              />
            )}
            {/* 今日の経路マップ */}
            <View style={styles.routeMapWrap}>
              <Text style={styles.routeMapTitle}>今日の経路</Text>
              <RouteMap tracks={todayTracks} height={240} />
            </View>
            <View style={styles.kpiRow}>
              <View style={styles.kpiCard}>
                <View style={styles.kpiHead}>
                  <Feather name="upload-cloud" color={colors.textMuted} size={14} />
                  <Text style={styles.kpiLabel}>未送信 tracks</Text>
                </View>
                <Text style={styles.kpiValue}>{pending.tracks}</Text>
              </View>
              <View style={styles.kpiCard}>
                <View style={styles.kpiHead}>
                  <Feather name="upload-cloud" color={colors.textMuted} size={14} />
                  <Text style={styles.kpiLabel}>未送信 stays</Text>
                </View>
                <Text style={styles.kpiValue}>{pending.stays}</Text>
              </View>
            </View>
          </>
        )}

        {/* ログアウト */}
        <View style={styles.actionsCard}>
          <TouchableOpacity
            onPress={handleSignOut}
            style={styles.actionRow}
            activeOpacity={0.6}
          >
            <View style={styles.actionRowInner}>
              <Feather name="log-out" color={colors.danger} size={18} />
              <Text style={[styles.actionLabel, { color: colors.danger }]}>
                ログアウト
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* 自宅・勤務地ピッカー Modal */}
      <Modal
        visible={pickerKind !== null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closePicker}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
          <View style={styles.pickerHeader}>
            <TouchableOpacity onPress={closePicker} hitSlop={12}>
              <Text style={styles.pickerCancel}>キャンセル</Text>
            </TouchableOpacity>
            <Text style={styles.pickerTitle}>
              {pickerKind === "home" ? "自宅エリアを設定" : "勤務地エリアを設定"}
            </Text>
            <TouchableOpacity
              onPress={savePicker}
              disabled={!pickerSelection || pickerSaving}
              hitSlop={12}
            >
              <Text
                style={[
                  styles.pickerSave,
                  (!pickerSelection || pickerSaving) && {
                    color: colors.textDisabled,
                  },
                ]}
              >
                {pickerSaving ? "保存中…" : "保存"}
              </Text>
            </TouchableOpacity>
          </View>
          <View style={styles.pickerBody}>
            <Text style={styles.pickerHint}>
              地図をタップしてピンを配置・ドラッグで微調整。半径100m が
              {pickerKind === "home" ? "自宅" : "勤務地"}エリアになります。
            </Text>
            <LocationPickerMap
              initial={pickerSelection}
              onChange={setPickerSelection}
              height={420}
            />
            {pickerSelection && (
              <Text style={styles.pickerSelected}>
                選択中: {pickerSelection.lat.toFixed(6)},{" "}
                {pickerSelection.lng.toFixed(6)}
              </Text>
            )}
          </View>
        </SafeAreaView>
      </Modal>

      {/* 設定画面 Modal */}
      <Modal
        visible={settingsOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setSettingsOpen(false)}
      >
        <SettingsScreen
          onClose={async () => {
            setSettingsOpen(false);
            await init();
          }}
        />
      </Modal>
    </SafeAreaView>
  );
}

// ─────────────────────────────────────
// サブコンポーネント
// ─────────────────────────────────────

function OnboardingChecklist({
  homeSet,
  workSet,
  permissionGranted,
  onSetHome,
  onSetWork,
}: {
  homeSet: boolean;
  workSet: boolean;
  permissionGranted: boolean;
  onSetHome: () => void;
  onSetWork: () => void;
}) {
  const items = [
    {
      label: "「常に許可」を設定",
      done: permissionGranted,
      onPress: undefined,
    },
    { label: "自宅エリアを設定", done: homeSet, onPress: onSetHome },
    { label: "勤務地エリアを設定", done: workSet, onPress: onSetWork },
  ];
  const completed = items.filter((i) => i.done).length;
  const total = items.length;
  if (completed === total) return null;
  return (
    <View style={styles.onbCard}>
      <View style={styles.onbHead}>
        <Text style={styles.onbTitle}>セットアップ進捗</Text>
        <Text style={styles.onbCounter}>
          {completed} <Text style={styles.onbCounterTotal}>/ {total}</Text>
        </Text>
      </View>
      <View style={styles.onbBarTrack}>
        <View
          style={[
            styles.onbBarFill,
            { width: `${(completed / total) * 100}%` },
          ]}
        />
      </View>
      {items.map((it, i) => (
        <TouchableOpacity
          key={i}
          onPress={it.onPress}
          disabled={!it.onPress || it.done}
          style={styles.onbItem}
          activeOpacity={0.7}
        >
          <View
            style={[
              styles.onbBullet,
              it.done && {
                backgroundColor: colors.success,
                borderColor: colors.success,
              },
            ]}
          >
            {it.done && (
              <Feather name="check" color={colors.white} size={12} />
            )}
          </View>
          <Text
            style={[
              styles.onbItemLabel,
              it.done && {
                color: colors.textMuted,
                textDecorationLine: "line-through",
              },
            ]}
          >
            {it.label}
          </Text>
          {it.onPress && !it.done && (
            <Feather name="chevron-right" color={colors.textDisabled} size={16} />
          )}
        </TouchableOpacity>
      ))}
    </View>
  );
}

function StatusHero({ status }: { status: Status }) {
  if (status === "ready") {
    return (
      <View style={[styles.hero, styles.heroReady]}>
        <View style={styles.heroIconReady}>
          <Feather name="check-circle" color={colors.success} size={28} />
        </View>
        <Text style={styles.heroTitleReady}>自動記録中</Text>
        <Text style={styles.heroSubtitle}>
          バックグラウンドで GPS と滞在を記録しています
        </Text>
      </View>
    );
  }
  if (status === "loading") {
    return (
      <View style={[styles.hero, styles.heroNeutral]}>
        <Text style={styles.heroTitleNeutral}>読み込み中…</Text>
      </View>
    );
  }
  // warning
  return (
    <View style={[styles.hero, styles.heroWarning]}>
      <View style={styles.heroIconWarning}>
        <Feather name="shield" color={colors.warningText} size={28} />
      </View>
      <Text style={styles.heroTitleWarning}>記録停止中</Text>
      <Text style={styles.heroSubtitle}>下記の設定を完了すると自動記録が始まります</Text>
    </View>
  );
}

function relativeJa(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return "1 分以内";
  if (min < 60) return `${min} 分前`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour} 時間 ${min % 60} 分前`;
  const day = Math.floor(hour / 24);
  return `${day} 日前`;
}

function TodayRecordCard({
  trackCount,
  stayCount,
  lastReceivedAt,
}: {
  trackCount: number;
  stayCount: number;
  lastReceivedAt: string | null;
}) {
  const isStale =
    lastReceivedAt
      ? Date.now() - new Date(lastReceivedAt).getTime() > 60 * 60 * 1000
      : false;
  return (
    <View style={styles.todayCard}>
      <Text style={styles.todayCardTitle}>今日の記録</Text>

      <View style={styles.todayRow}>
        <Feather name="radio" color={colors.textMuted} size={14} />
        <Text style={styles.todayLabel}>直近の GPS 受信</Text>
        <Text
          style={[
            styles.todayValue,
            isStale && { color: colors.warningText },
          ]}
        >
          {lastReceivedAt ? relativeJa(lastReceivedAt) : "—"}
          {isStale ? " ⚠" : ""}
        </Text>
      </View>

      <View style={styles.todayRow}>
        <Feather name="map" color={colors.textMuted} size={14} />
        <Text style={styles.todayLabel}>今日の経路点</Text>
        <Text style={styles.todayValue}>{trackCount} 件</Text>
      </View>

      <View style={[styles.todayRow, { borderBottomWidth: 0 }]}>
        <Feather name="map-pin" color={colors.textMuted} size={14} />
        <Text style={styles.todayLabel}>30分以上の滞在</Text>
        <Text style={styles.todayValue}>{stayCount} 件</Text>
      </View>
    </View>
  );
}

function WarningCard({
  title,
  body,
  buttonText,
  onPress,
}: {
  title: string;
  body: string;
  buttonText: string;
  onPress: () => void;
}) {
  return (
    <View style={styles.warningCard}>
      <View style={styles.warningHead}>
        <Feather name="alert-triangle" color={colors.warningText} size={18} />
        <Text style={styles.warningTitle}>{title}</Text>
      </View>
      <Text style={styles.warningBody}>{body}</Text>
      <TouchableOpacity
        onPress={onPress}
        style={styles.warningButton}
        activeOpacity={0.85}
      >
        <Text style={styles.warningButtonText}>{buttonText}</Text>
        <Feather name="chevron-right" color={colors.white} size={16} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  container: { flex: 1 },
  content: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[4],
    paddingBottom: spacing[10],
  },

  // header
  header: { marginBottom: spacing[5] },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
  },
  brandIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  brand: { ...typography.subtitle, color: colors.brand },
  email: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing[1],
    paddingLeft: 40,
  },

  // hero
  hero: {
    alignItems: "center",
    paddingVertical: spacing[6],
    paddingHorizontal: spacing[5],
    borderRadius: radius.lg,
    marginBottom: spacing[4],
    ...shadows.card,
  },
  heroReady: {
    backgroundColor: colors.successBg,
    borderWidth: 1,
    borderColor: colors.successBorder,
  },
  heroNeutral: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  heroWarning: {
    backgroundColor: colors.warningBg,
    borderWidth: 1,
    borderColor: colors.warningBorder,
  },
  heroIconReady: {
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    backgroundColor: "rgba(5, 150, 105, 0.1)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing[3],
  },
  heroIconWarning: {
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    backgroundColor: "rgba(146, 64, 14, 0.08)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing[3],
  },
  heroTitleReady: {
    ...typography.title,
    color: colors.successText,
  },
  heroTitleWarning: {
    ...typography.title,
    color: colors.warningText,
  },
  heroTitleNeutral: {
    ...typography.subtitle,
    color: colors.textMuted,
  },
  heroSubtitle: {
    ...typography.caption,
    color: colors.textLight,
    textAlign: "center",
    marginTop: spacing[1],
    paddingHorizontal: spacing[4],
    lineHeight: 17,
  },

  // warning card
  warningCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.warningBorder,
    padding: spacing[4],
    marginBottom: spacing[4],
  },
  warningHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
    marginBottom: spacing[2],
  },
  warningTitle: {
    ...typography.bodyStrong,
    color: colors.warningText,
    flex: 1,
  },
  warningBody: {
    ...typography.body,
    color: colors.textLight,
    lineHeight: 20,
    marginBottom: spacing[3],
  },
  warningButton: {
    minHeight: TOUCH_MIN,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: spacing[1],
  },
  warningButtonText: {
    color: colors.white,
    ...typography.bodyStrong,
  },

  // オンボーディングチェックリスト
  onbCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.primarySoft,
    padding: spacing[4],
    marginBottom: spacing[3],
  },
  onbHead: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    marginBottom: spacing[2],
  },
  onbTitle: { ...typography.bodyStrong, color: colors.brand },
  onbCounter: {
    ...typography.title,
    color: colors.primary,
    fontVariant: ["tabular-nums"],
  },
  onbCounterTotal: {
    ...typography.body,
    color: colors.textMuted,
    fontWeight: "500",
  },
  onbBarTrack: {
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.border,
    overflow: "hidden",
    marginBottom: spacing[3],
  },
  onbBarFill: {
    height: "100%",
    backgroundColor: colors.primary,
  },
  onbItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
    paddingVertical: spacing[2],
  },
  onbBullet: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  onbItemLabel: {
    flex: 1,
    ...typography.body,
    color: colors.text,
  },

  // 自宅・勤務地ピッカー Modal
  pickerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  pickerCancel: {
    ...typography.body,
    color: colors.textMuted,
  },
  pickerTitle: {
    ...typography.bodyStrong,
    color: colors.text,
  },
  pickerSave: {
    ...typography.bodyStrong,
    color: colors.primary,
  },
  pickerBody: {
    flex: 1,
    padding: spacing[4],
  },
  pickerHint: {
    ...typography.caption,
    color: colors.textLight,
    lineHeight: 18,
    marginBottom: spacing[3],
  },
  pickerSelected: {
    ...typography.caption,
    color: colors.text,
    marginTop: spacing[3],
    fontVariant: ["tabular-nums"],
  },

  // 今日の経路マップ
  routeMapWrap: {
    marginBottom: spacing[3],
  },
  routeMapTitle: {
    ...typography.bodyStrong,
    color: colors.text,
    marginBottom: spacing[2],
  },

  // 今日の記録
  todayCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing[4],
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing[3],
  },
  todayCardTitle: {
    ...typography.bodyStrong,
    color: colors.text,
    marginBottom: spacing[2],
  },
  todayRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
    paddingVertical: spacing[2],
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  todayLabel: {
    ...typography.caption,
    color: colors.textLight,
    flex: 1,
  },
  todayValue: {
    ...typography.bodyStrong,
    color: colors.text,
    fontVariant: ["tabular-nums"],
  },

  // KPI
  kpiRow: {
    flexDirection: "row",
    gap: spacing[3],
    marginBottom: spacing[4],
  },
  kpiCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing[4],
    borderWidth: 1,
    borderColor: colors.border,
  },
  kpiHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[1],
    marginBottom: spacing[2],
  },
  kpiLabel: {
    ...typography.caption,
    color: colors.textMuted,
  },
  kpiValue: {
    ...typography.kpi,
    color: colors.text,
  },

  // actions
  actionsCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  actionRow: {
    minHeight: TOUCH_MIN + 8,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  actionRowInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
    flex: 1,
  },
  actionLabel: {
    ...typography.body,
    color: colors.text,
  },
  actionDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginHorizontal: spacing[4],
  },
});
