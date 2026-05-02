import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Linking from "expo-linking";
import { Feather } from "@expo/vector-icons";
import { supabase } from "../lib/supabase";
import { colors, spacing, radius, typography, TOUCH_MIN } from "../lib/theme";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async () => {
    if (!email) return;
    setLoading(true);
    const redirectTo = Linking.createURL("auth/callback");
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo },
    });
    setLoading(false);
    if (error) {
      Alert.alert("送信失敗", error.message);
      return;
    }
    setSent(true);
  };

  if (sent) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <View style={styles.center}>
          <View style={styles.sentIconWrap}>
            <Feather name="mail" color={colors.primary} size={36} />
          </View>
          <Text style={styles.sentTitle}>メールを送信しました</Text>
          <Text style={styles.sentBody}>
            <Text style={styles.sentEmailHighlight}>{email}</Text>
            {"\n"}宛にログインリンクをお送りしました。{"\n"}
            メール内のリンクをタップしてログインしてください。
          </Text>
          <TouchableOpacity
            onPress={() => setSent(false)}
            style={styles.linkButton}
            activeOpacity={0.7}
          >
            <Feather name="chevron-left" color={colors.primary} size={16} />
            <Text style={styles.linkText}>別のメールアドレスで再送</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.center}>
          <View style={styles.brandWrap}>
            <View style={styles.brandIcon}>
              <Feather name="map-pin" color={colors.white} size={28} />
            </View>
            <Text style={styles.brand}>PLEX 出張ログ</Text>
            <Text style={styles.tagline}>
              GPSで自動記録・月次ログを自動生成
            </Text>
          </View>

          <View style={styles.formCard}>
            <Text style={styles.label}>メールアドレス</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor={colors.textDisabled}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!loading}
              style={styles.input}
            />
            <TouchableOpacity
              onPress={handleSubmit}
              disabled={loading || !email}
              activeOpacity={0.85}
              style={[
                styles.button,
                (!email || loading) && styles.buttonDisabled,
              ]}
            >
              {loading ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <>
                  <Text style={styles.buttonText}>ログインリンクを送信</Text>
                  <Feather name="arrow-right" color={colors.white} size={18} />
                </>
              )}
            </TouchableOpacity>
            <Text style={styles.note}>
              パスワード不要・メールリンク方式（Magic Link）でログインします
            </Text>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  center: {
    flex: 1,
    paddingHorizontal: spacing[6],
    justifyContent: "center",
  },
  brandWrap: {
    alignItems: "center",
    marginBottom: spacing[8],
  },
  brandIcon: {
    width: 64,
    height: 64,
    borderRadius: radius.xl,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing[4],
    shadowColor: colors.brand,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 4,
  },
  brand: {
    ...typography.title,
    color: colors.brand,
  },
  tagline: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing[2],
    textAlign: "center",
  },
  formCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing[5],
    borderWidth: 1,
    borderColor: colors.border,
  },
  label: {
    ...typography.captionStrong,
    color: colors.text,
    marginBottom: spacing[2],
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    paddingHorizontal: spacing[3],
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.surface,
    marginBottom: spacing[3],
  },
  button: {
    minHeight: TOUCH_MIN,
    height: 48,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: spacing[2],
  },
  buttonDisabled: { opacity: 0.4 },
  buttonText: {
    color: colors.white,
    fontWeight: "600",
    fontSize: 15,
  },
  note: {
    ...typography.caption,
    color: colors.textDisabled,
    textAlign: "center",
    marginTop: spacing[4],
    lineHeight: 17,
  },
  sentIconWrap: {
    width: 80,
    height: 80,
    borderRadius: radius.xl,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: spacing[5],
  },
  sentTitle: {
    ...typography.title,
    color: colors.text,
    textAlign: "center",
    marginBottom: spacing[3],
  },
  sentBody: {
    ...typography.body,
    color: colors.textLight,
    textAlign: "center",
    lineHeight: 22,
  },
  sentEmailHighlight: {
    color: colors.text,
    fontWeight: "600",
  },
  linkButton: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "center",
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    marginTop: spacing[6],
    gap: 4,
    minHeight: TOUCH_MIN,
  },
  linkText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: "600",
  },
});
