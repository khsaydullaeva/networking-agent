import { useRouter } from "expo-router";
import React from "react";
import { ActivityIndicator, Pressable, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AUTH0_DOMAIN, USE_FIXTURES } from "@/lib/config";
import { useAuth0Login } from "@/lib/auth";
import { useStore } from "@/lib/store";

export default function Login() {
  const router = useRouter();
  const { login } = useStore();
  const { login: promptAuth0Login, loading, error, ready } = useAuth0Login();
  const [signingIn, setSigningIn] = React.useState(false);

  const afterLogin = (plansCount: number) => {
    router.replace(plansCount === 0 ? "/plans-setup" : "/map");
  };

  const handleAuth0Login = async () => {
    const idToken = await promptAuth0Login();
    if (!idToken) return;
    setSigningIn(true);
    try {
      const user = await login(idToken);
      afterLogin(user.plans.length);
    } finally {
      setSigningIn(false);
    }
  };

  // Dev/demo shortcut — USE_FIXTURES skips real Auth0 so the app is fully
  // testable without a live tenant.
  const handleDevLogin = async () => {
    setSigningIn(true);
    try {
      const user = await login("fixture-dev-token");
      afterLogin(user.plans.length);
    } finally {
      setSigningIn(false);
    }
  };

  const busy = loading || signingIn;

  return (
    <SafeAreaView className="flex-1 bg-white items-center justify-center px-8">
      <Text className="text-3xl font-bold text-gray-900 mb-2 text-center">Welcome 👋</Text>
      <Text className="text-base text-gray-500 mb-10 text-center">
        The score goes up when you leave the app.
      </Text>

      {!AUTH0_DOMAIN && !USE_FIXTURES && (
        <Text className="text-sm text-red-500 mb-4 text-center">
          AUTH0_DOMAIN isn't configured — set EXPO_PUBLIC_AUTH0_DOMAIN and EXPO_PUBLIC_AUTH0_CLIENT_ID.
        </Text>
      )}
      {!!error && <Text className="text-sm text-red-500 mb-4 text-center">{error}</Text>}

      <Pressable
        disabled={busy || (!ready && !USE_FIXTURES)}
        onPress={handleAuth0Login}
        className="w-full bg-gray-900 rounded-xl py-4 items-center mb-3"
      >
        {busy ? <ActivityIndicator color="white" /> : <Text className="text-white font-semibold text-base">Sign up / Log in</Text>}
      </Pressable>

      {USE_FIXTURES && (
        <Pressable disabled={busy} onPress={handleDevLogin} className="w-full bg-gray-800 rounded-xl py-4 items-center">
          <Text className="text-white font-semibold text-base">Continue as dev user (fixtures)</Text>
        </Pressable>
      )}
    </SafeAreaView>
  );
}
