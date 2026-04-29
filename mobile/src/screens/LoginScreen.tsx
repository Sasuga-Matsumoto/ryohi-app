import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from "react-native";
import * as Linking from "expo-linking";
import { supabase } from "../lib/supabase";

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
      <View style={styles.container}>
        <Text style={styles.title}>📧 メールを送信しました</Text>
        <Text style={styles.body}>
          {email} 宛にログインリンクをお送りしました。
          メール内のリンクをタップしてログインしてください。
        </Text>
        <TouchableOpacity onPress={() => setSent(false)} style={styles.link}>
          <Text style={styles.linkText}>← 別のメールアドレスで再送</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.brand}>PLEX 出張ログ</Text>
      <Text style={styles.subtitle}>メールアドレスを入力してください</Text>
      <TextInput
        value={email}
        onChangeText={setEmail}
        placeholder="you@example.com"
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        editable={!loading}
        style={styles.input}
      />
      <TouchableOpacity
        onPress={handleSubmit}
        disabled={loading || !email}
        style={[styles.button, (!email || loading) && styles.buttonDisabled]}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>ログインリンクを送信</Text>
        )}
      </TouchableOpacity>
      <Text style={styles.note}>
        パスワードは不要です。Magic Link 方式でログインします。
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    justifyContent: "center",
    backgroundColor: "#F4F6FB",
  },
  brand: {
    fontSize: 24,
    fontWeight: "700",
    color: "#1E3A8A",
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: "#64748B",
    textAlign: "center",
    marginBottom: 28,
  },
  title: { fontSize: 18, fontWeight: "700", marginBottom: 12, textAlign: "center" },
  body: { fontSize: 14, color: "#475569", textAlign: "center", lineHeight: 22 },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 8,
    paddingHorizontal: 14,
    fontSize: 16,
    backgroundColor: "#fff",
    marginBottom: 12,
  },
  button: {
    height: 48,
    backgroundColor: "#3366FF",
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: "#fff", fontWeight: "600", fontSize: 16 },
  note: {
    marginTop: 24,
    fontSize: 12,
    color: "#94A3B8",
    textAlign: "center",
    lineHeight: 18,
  },
  link: { marginTop: 16, alignSelf: "center" },
  linkText: { color: "#3366FF", fontSize: 14 },
});
