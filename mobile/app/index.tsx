import { Redirect } from "expo-router";
import React from "react";
import { ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useStore } from "@/lib/store";

export default function Index() {
  const { user, authLoading } = useStore();

  if (authLoading) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center">
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  if (!user) {
    return <Redirect href="/login" />;
  }

  return <Redirect href={user.plans.length === 0 ? "/plans-setup" : "/map"} />;
}
