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
  Platform,
  AppState,
  type AppStateStatus,
} from "react-native";
import * as Location from "expo-location";
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
import { pendingCount } from "../lib/queue";
import { defineTasks } from "../lib/tasks";

const WEB_BASE_URL = "https://ryohi-app.vercel.app";
const WEB_SETTINGS_PATH = "/dashboard/settings";

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
  const [refreshing, setRefreshing] = useState(false);

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

  const handleOpenLocationSettings = async () => {
    if (Platform.OS === "android") {
      try {
        await Linking.sendIntent("android.settings.LOCATION_SOURCE_SETTINGS");
        return;
      } catch (e) {
        console.warn("[home] sendIntent failed, falling back", e);
      }
    }
    await Linking.openSettings();
  };

  const handleOpenAppPermissionSettings = async () => {
    await Linking.openSettings();
  };

  const handleOpenWebSettings = async () => {
    // 自動ログインを通すため、現在の access/refresh トークンを hash 部に乗せる
    const { data: { session: cur } } = await supabase.auth.getSession();
    if (cur?.access_token && cur?.refresh_token) {
      const url =
        `${WEB_BASE_URL}/auth/from-mobile` +
        `#access_token=${encodeURIComponent(cur.access_token)}` +
        `&refresh_token=${encodeURIComponent(cur.refresh_token)}` +
        `&next=${encodeURIComponent(WEB_SETTINGS_PATH)}`;
      await Linking.openURL(url);
    } else {
      await Linking.openURL(`${WEB_BASE_URL}${WEB_SETTINGS_PATH}`);
    }
  };

  // 警告状態に遷移したら自動でポップアップを出す（同じ状態で連続表示は抑止）
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
        message:
          "設定画面を開き、「権限 → 位置情報 → 常に許可」を選んでください。",
        buttonText: "設定画面を開く",
        onPress: handleOpenAppPermissionSettings,
      },
      fg_only: {
        title: "「常に許可」が必要です",
        message:
          "「使用中のみ」では出張ログを記録できません。設定画面を開き、「権限 → 位置情報 → 常に許可」を選んでください。",
        buttonText: "設定画面を開く",
        onPress: handleOpenAppPermissionSettings,
      },
      no_setting: {
        title: "自宅・勤務地の設定が必要です",
        message:
          "Web の設定画面で自宅と勤務地のエリアを地図上で指定してください（半径100m）。",
        buttonText: "Web の設定画面を開く",
        onPress: handleOpenWebSettings,
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

  const onRefresh = async () => {
    setRefreshing(true);
    await init();
    setRefreshing(false);
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.header}>
        <Text style={styles.brand}>PLEX 出張ログ</Text>
        <Text style={styles.email}>{session?.user?.email ?? ""}</Text>
      </View>

      {status === "services_off" && (
        <View style={styles.warningCard}>
          <Text style={styles.warningTitle}>端末の位置情報が OFF です</Text>
          <Text style={styles.warningBody}>
            {Platform.OS === "android"
              ? "自動記録するには端末の位置情報を ON にしてください。"
              : "設定アプリ →「プライバシーとセキュリティ」→「位置情報サービス」を ON にしてください。"}
          </Text>
          <TouchableOpacity
            onPress={handleOpenLocationSettings}
            style={styles.warningButton}
          >
            <Text style={styles.warningButtonText}>
              {Platform.OS === "android"
                ? "位置情報設定を開く"
                : "設定アプリを開く"}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {status === "no_permission" && (
        <View style={styles.warningCard}>
          <Text style={styles.warningTitle}>位置情報の許可が必要です</Text>
          <Text style={styles.warningBody}>
            下のボタンから設定画面を開き、「権限 → 位置情報 → 常に許可」を選んでください。
          </Text>
          <TouchableOpacity
            onPress={() => Linking.openSettings()}
            style={styles.warningButton}
          >
            <Text style={styles.warningButtonText}>設定画面を開く</Text>
          </TouchableOpacity>
        </View>
      )}

      {status === "fg_only" && (
        <View style={styles.warningCard}>
          <Text style={styles.warningTitle}>「常に許可」が必要です</Text>
          <Text style={styles.warningBody}>
            「使用中のみ」では出張ログを記録できません。下のボタンから設定画面を開き、「権限 → 位置情報 → 常に許可」を選んでください。
          </Text>
          <TouchableOpacity
            onPress={() => Linking.openSettings()}
            style={styles.warningButton}
          >
            <Text style={styles.warningButtonText}>設定画面を開く</Text>
          </TouchableOpacity>
        </View>
      )}

      {status === "no_setting" && (
        <View style={styles.warningCard}>
          <Text style={styles.warningTitle}>自宅・勤務地の設定が必要です</Text>
          <Text style={styles.warningBody}>
            Web の設定画面で自宅と勤務地のエリアを地図上で指定してください（半径100m）。設定後、このアプリに戻ると自動で反映されます。
          </Text>
          <TouchableOpacity
            onPress={handleOpenWebSettings}
            style={styles.warningButton}
          >
            <Text style={styles.warningButtonText}>Web の設定画面を開く</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.statusCard}>
        <Text style={styles.statusLabel}>記録状態</Text>
        <Text style={styles.statusValue}>
          {status === "ready" ? "✓ 自動記録中" : "未開始"}
        </Text>
      </View>

      {status === "ready" && (
        <>
          <View style={styles.row}>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>未送信 tracks</Text>
              <Text style={styles.kpiValue}>{pending.tracks}</Text>
            </View>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>未送信 stays</Text>
              <Text style={styles.kpiValue}>{pending.stays}</Text>
            </View>
          </View>

          <TouchableOpacity
            onPress={handleOpenWebSettings}
            style={styles.settingsButton}
          >
            <Text style={styles.settingsButtonText}>Web の設定画面を開く</Text>
          </TouchableOpacity>
        </>
      )}

      <TouchableOpacity onPress={handleSignOut} style={styles.linkButton}>
        <Text style={styles.linkText}>ログアウト</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F4F6FB" },
  content: { padding: 20, paddingTop: 60 },
  header: { marginBottom: 24 },
  brand: { fontSize: 22, fontWeight: "700", color: "#1E3A8A" },
  email: { fontSize: 13, color: "#64748B", marginTop: 4 },
  warningCard: {
    backgroundColor: "#FFFBEB",
    borderColor: "#FCD34D",
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  warningTitle: { fontSize: 14, fontWeight: "700", color: "#92400E" },
  warningBody: {
    fontSize: 13,
    color: "#78350F",
    marginTop: 4,
    lineHeight: 19,
  },
  warningButton: {
    backgroundColor: "#3366FF",
    height: 40,
    borderRadius: 6,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 12,
  },
  warningButtonText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  statusCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 20,
    marginBottom: 12,
  },
  statusLabel: { fontSize: 12, color: "#64748B", textTransform: "uppercase" },
  statusValue: { fontSize: 24, fontWeight: "700", color: "#0F172A", marginTop: 4 },
  row: { flexDirection: "row", gap: 12, marginBottom: 16 },
  kpiCard: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
  },
  kpiLabel: { fontSize: 11, color: "#64748B" },
  kpiValue: { fontSize: 20, fontWeight: "700", color: "#0F172A", marginTop: 4 },
  settingsButton: {
    backgroundColor: "#fff",
    borderColor: "#D1D5DB",
    borderWidth: 1,
    borderRadius: 8,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  settingsButtonText: { color: "#1E3A8A", fontSize: 14, fontWeight: "500" },
  linkButton: { alignSelf: "center", paddingVertical: 8, marginTop: 8 },
  linkText: { color: "#64748B", fontSize: 13 },
});
