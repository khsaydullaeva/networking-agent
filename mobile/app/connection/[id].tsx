import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Linking, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { QuestCard } from "@/components/QuestCard";
import { completeQuest, getConnection } from "@/lib/api";
import { useStore } from "@/lib/store";
import type { Connection } from "@/lib/types";

export default function ConnectionDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user, setUser } = useStore();
  const [connection, setConnection] = useState<Connection | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    if (!id) return;
    const conn = await getConnection(id);
    setConnection(conn);
    return conn;
  }, [id]);

  useEffect(() => {
    refresh();
    // Poll every ~2s until enrichment arrives — no websockets for MVP.
    pollRef.current = setInterval(async () => {
      const conn = await refresh();
      if (conn?.enrichment) {
        if (pollRef.current) clearInterval(pollRef.current);
      }
    }, 2000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [refresh]);

  const handleCompleteQuest = async (questId: string) => {
    const { new_total_xp } = await completeQuest(questId);
    setUser({ ...user, xp: new_total_xp });
    await refresh();
  };

  if (!connection) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center">
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  const { person, enrichment } = connection;

  return (
    <SafeAreaView className="flex-1 bg-white">
      <ScrollView className="px-6 pt-6" contentContainerStyle={{ paddingBottom: 32 }}>
        <Pressable onPress={() => router.push("/map")} className="mb-4">
          <Text className="text-orange-600">{"< Map"}</Text>
        </Pressable>

        <Text className="text-2xl font-bold text-gray-900">{person?.name || "Unknown"}</Text>
        {!!person?.org && <Text className="text-base text-gray-500 mb-4">{person.org}</Text>}

        {!enrichment ? (
          <View className="flex-row items-center gap-2 mb-6">
            <ActivityIndicator size="small" />
            <Text className="text-gray-500">Enriching from the web...</Text>
          </View>
        ) : (
          <View className="mb-6">
            {!!enrichment.role && <Text className="text-base text-gray-800 mb-2">{enrichment.role}</Text>}
            {enrichment.interests.length > 0 && (
              <Text className="text-sm text-gray-500 mb-3">{enrichment.interests.join(" · ")}</Text>
            )}
            {enrichment.recent_activity.map((fact, i) => (
              <View key={i} className="mb-3">
                <Text className="text-sm text-gray-800">{fact.fact}</Text>
                <Pressable onPress={() => Linking.openURL(fact.source_url)}>
                  <Text className="text-xs text-blue-600 mt-1">{fact.source_url}</Text>
                </Pressable>
              </View>
            ))}
          </View>
        )}

        <Text className="text-lg font-bold text-gray-900 mb-3">Quests</Text>
        {(connection.quests ?? []).length === 0 && (
          <Text className="text-gray-400 mb-4">No quests yet.</Text>
        )}
        {(connection.quests ?? []).map((quest) => (
          <QuestCard key={quest.id} quest={quest} onComplete={handleCompleteQuest} />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
