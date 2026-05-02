import "react-native-url-polyfill/auto";
import { useEffect, useState, useCallback } from "react";
import { StatusBar } from "expo-status-bar";
import { StyleSheet, View, Text, ActivityIndicator } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as Linking from "expo-linking";
import * as SplashScreen from "expo-splash-screen";
import {
  useFonts,
  NotoSansJP_400Regular,
  NotoSansJP_500Medium,
  NotoSansJP_600SemiBold,
  NotoSansJP_700Bold,
} from "@expo-google-fonts/noto-sans-jp";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./src/lib/supabase";
import { defineTasks } from "./src/lib/tasks";
import { colors, typography, spacing } from "./src/lib/theme";
import LoginScreen from "./src/screens/LoginScreen";
import HomeScreen from "./src/screens/HomeScreen";

defineTasks();

// フォントが読み込まれるまでスプラッシュを保持
SplashScreen.preventAutoHideAsync().catch(() => {});

function parseTokensFromUrl(url: string): { access_token?: string; refresh_token?: string } {
  const result: { access_token?: string; refresh_token?: string } = {};
  const tail = url.split("?").slice(1).join("?") + "&" + url.split("#").slice(1).join("#");
  for (const pair of tail.split("&")) {
    const [k, v] = pair.split("=");
    if (k === "access_token") result.access_token = decodeURIComponent(v ?? "");
    if (k === "refresh_token") result.refresh_token = decodeURIComponent(v ?? "");
  }
  return result;
}

async function handleDeepLink(url: string) {
  if (!url) return;
  const { access_token, refresh_token } = parseTokensFromUrl(url);
  if (!access_token || !refresh_token) return;
  await supabase.auth.setSession({ access_token, refresh_token });
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const [fontsLoaded] = useFonts({
    NotoSansJP_400Regular,
    NotoSansJP_500Medium,
    NotoSansJP_600SemiBold,
    NotoSansJP_700Bold,
  });

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const { data: authSub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    const linkSub = Linking.addEventListener("url", ({ url }) => {
      handleDeepLink(url);
    });

    Linking.getInitialURL().then((url) => {
      if (url) handleDeepLink(url);
    });

    return () => {
      authSub.subscription.unsubscribe();
      linkSub.remove();
    };
  }, []);

  const onLayoutReady = useCallback(async () => {
    if (fontsLoaded) {
      await SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded]);

  if (!fontsLoaded || loading) {
    return (
      <SafeAreaProvider>
        <View style={styles.loading} onLayout={onLayoutReady}>
          {fontsLoaded && (
            <>
              <Text style={styles.loadingBrand}>Log</Text>
              <Text style={styles.loadingTagline}>Tracker</Text>
            </>
          )}
          <ActivityIndicator
            size="small"
            color={colors.primary}
            style={{ marginTop: spacing[6] }}
          />
          <StatusBar style="auto" />
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <View style={{ flex: 1 }} onLayout={onLayoutReady}>
        {session ? <HomeScreen session={session} /> : <LoginScreen />}
        <StatusBar style="auto" />
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingBrand: {
    ...typography.display,
    color: colors.brand,
    letterSpacing: 4,
  },
  loadingTagline: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing[1],
    letterSpacing: 1,
  },
});
