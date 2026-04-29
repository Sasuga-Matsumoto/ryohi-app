import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  Alert,
} from "react-native";
import { supabase } from "../lib/supabase";
import {
  fetchMySettings,
  registerGeofence,
  registerFlushTask,
  requestLocationPermissions,
  tearDownTracking,
  type AccountSetting,
} from "../lib/location";
import { pendingCount } from "../lib/queue";
import { flushQueue } from "../lib/sync";
import { defineTasks } from "../lib/tasks";

export default function HomeScreen({ session }: { session: any }) {
  const [setting, setSetting] = useState<AccountSetting | null>(null);
  const [permGranted, setPermGranted] = useState({ foreground: false, background: false });
  const [pending, setPending] = useState({ tracks: 0, stays: 0 });
  const [refreshing, setRefreshing] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string>("");

  const loadStatus = useCallback(async () => {
    const s = await fetchMySettings();
    setSetting(s);
    const p = await pendingCount();
    setPending(p);
  }, []);

  useEffect(() => {
    defineTasks();
    loadStatus();
  }, [loadStatus]);

  const handleSetup = async () => {
    setStatusMsg("位置情報の許可を要求中...");
    const perm = await requestLocationPermissions();
    setPermGranted(perm);
    if (!perm.foreground) {
      setStatusMsg("");
      Alert.alert("許可が必要", "位置情報の許可を端末設定から有効にしてください。");
      return;
    }

    const s = await fetchMySettings();
    if (!s) {
      setStatusMsg("");
      Alert.alert(
        "設定が必要",
        "Web から自宅・勤務地の設定を完了してから、このアプリを再度開いてください。\n\nhttps://ryohi-app.vercel.app/dashboard/settings"
      );
      return;
    }

    if (s.work_lat == null || s.home_lat == null) {
      setStatusMsg("");
      Alert.alert(
        "設定が未完了",
        "Web で自宅・勤務地の Pin を設定してから再度開いてください。"
      );
      return;
    }

    setStatusMsg("Geofence を登録中...");
    const ok = await registerGeofence(s);
    if (!ok) {
      setStatusMsg("");
      Alert.alert("エラー", "Geofence 登録に失敗しました。");
      return;
    }

    setStatusMsg("送信タスクを登録中...");
    await registerFlushTask();

    setStatusMsg("");
    setSetting(s);
    Alert.alert("✓ 自動記録を開始しました", "勤務地・自宅エリアを出ると自動でGPS記録が始まります。");
  };

  const handleManualFlush = async () => {
    setStatusMsg("送信中...");
    const r = await flushQueue();
    setStatusMsg("");
    Alert.alert("送信完了", `tracks ${r.sentTracks} 件 / stays ${r.sentStays} 件`);
    loadStatus();
  };

  const handleSignOut = async () => {
    await tearDownTracking();
    await supabase.auth.signOut();
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadStatus();
    setRefreshing(false);
  };

  const onboarded = setting?.work_lat != null && setting?.home_lat != null;

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

      {!onboarded && (
        <View style={styles.warningCard}>
          <Text style={styles.warningTitle}>⚠ 初期設定が未完了です</Text>
          <Text style={styles.warningBody}>
            Web で自宅・勤務地・出張定義を設定してください。
          </Text>
          <Text style={styles.warningLink}>
            https://ryohi-app.vercel.app/dashboard/settings
          </Text>
        </View>
      )}

      <View style={styles.statusCard}>
        <Text style={styles.statusLabel}>記録状態</Text>
        <Text style={styles.statusValue}>
          {permGranted.background ? "✓ 自動記録中" : "未開始"}
        </Text>
      </View>

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

      <TouchableOpacity onPress={handleSetup} style={styles.primaryButton}>
        <Text style={styles.primaryButtonText}>
          {permGranted.background ? "Geofence を再登録" : "自動記録を開始"}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={handleManualFlush} style={styles.secondaryButton}>
        <Text style={styles.secondaryButtonText}>未送信データを手動送信</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={handleSignOut} style={styles.linkButton}>
        <Text style={styles.linkText}>ログアウト</Text>
      </TouchableOpacity>

      {statusMsg ? <Text style={styles.statusMsg}>{statusMsg}</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F4F6FB" },
  content: { padding: 20 },
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
  warningBody: { fontSize: 13, color: "#78350F", marginTop: 4 },
  warningLink: { fontSize: 12, color: "#3366FF", marginTop: 6 },
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
  primaryButton: {
    backgroundColor: "#3366FF",
    borderRadius: 8,
    height: 48,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  primaryButtonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  secondaryButton: {
    backgroundColor: "#fff",
    borderColor: "#D1D5DB",
    borderWidth: 1,
    borderRadius: 8,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  secondaryButtonText: { color: "#1E3A8A", fontSize: 14, fontWeight: "500" },
  linkButton: { alignSelf: "center", paddingVertical: 8 },
  linkText: { color: "#64748B", fontSize: 13 },
  statusMsg: {
    marginTop: 16,
    textAlign: "center",
    color: "#3366FF",
    fontSize: 13,
  },
});
