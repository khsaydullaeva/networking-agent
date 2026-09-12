import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { NetworkMap } from "@/components/NetworkMap";
import { listConnections } from "@/lib/api";
import { useStore } from "@/lib/store";
import type { Connection } from "@/lib/types";

export default function Map() {
  const router = useRouter();
  const { user } = useStore();
  const [connections, setConnections] = useState<Connection[]>([]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      listConnections(user.id).then((conns) => {
        if (!cancelled) setConnections(conns);
      });
      return () => {
        cancelled = true;
      };
    }, [user.id])
  );

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-row justify-between items-center px-6 pt-4">
        <Text className="text-2xl font-bold text-gray-900">Your network</Text>
        <View className="items-end">
          <Text className="text-orange-600 font-bold text-lg">{user.xp} XP</Text>
          <Text className="text-xs text-gray-400">🔥 {user.streak} streak</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingVertical: 24 }}>
        <NetworkMap connections={connections} />
      </ScrollView>

      <Pressable
        className="absolute bottom-8 self-center bg-orange-500 rounded-full px-8 py-4 shadow-lg"
        onPress={() => router.push("/connect")}
      >
        <Text className="text-white font-semibold text-base">Connect another</Text>
      </Pressable>
    </SafeAreaView>
  );
}
