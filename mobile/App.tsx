import "react-native-url-polyfill/auto";
import { useEffect, useState } from "react";
import { StatusBar } from "expo-status-bar";
import { StyleSheet, View, ActivityIndicator } from "react-native";
import * as Linking from "expo-linking";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./src/lib/supabase";
import { defineTasks } from "./src/lib/tasks";
import LoginScreen from "./src/screens/LoginScreen";
import HomeScreen from "./src/screens/HomeScreen";

defineTasks();

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

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#3366FF" />
        <StatusBar style="auto" />
      </View>
    );
  }

  return (
    <>
      {session ? <HomeScreen session={session} /> : <LoginScreen />}
      <StatusBar style="auto" />
    </>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    backgroundColor: "#F4F6FB",
    alignItems: "center",
    justifyContent: "center",
  },
});
