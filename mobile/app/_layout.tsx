import "@/global.css";

import { Stack } from "expo-router";
import React from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { StoreProvider } from "@/lib/store";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StoreProvider>
        <Stack screenOptions={{ headerShown: false }} />
      </StoreProvider>
    </SafeAreaProvider>
  );
}
