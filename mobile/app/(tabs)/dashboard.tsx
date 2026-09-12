import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { Alert, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { QuestLogCard } from "@/components/QuestLogCard";
import { addPlan, isStaleSessionError, linkQuestToPlan, listConnections, listQuests } from "@/lib/api";
import { handleStaleSession } from "@/lib/session";
import { useStore } from "@/lib/store";
import type { Connection, Quest } from "@/lib/types";

export default function Dashboard() {
  const router = useRouter();
  const { user, setUser, logout } = useStore();
  const [quests, setQuests] = useState<Quest[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [newPlanTitle, setNewPlanTitle] = useState("");
  const [linkingQuestId, setLinkingQuestId] = useState<string | null>(null);

  const refresh = useCallback(() => {
    if (!user) return;
    listQuests(user.id).then(setQuests);
    listConnections(user.id).then(setConnections);
  }, [user]);

  useFocusEffect(refresh);

  if (!user) return null;

  const personNameFor = (connectionId: string) =>
    connections.find((c) => c.id === connectionId)?.person.name ?? "Someone";

  const handleAddPlan = async () => {
    const title = newPlanTitle.trim();
    if (!title) return;
    try {
      const plan = await addPlan(user.id, title);
      setUser({ ...user, plans: [...user.plans, plan] });
      setNewPlanTitle("");
    } catch (e) {
      if (isStaleSessionError(e)) await handleStaleSession(logout);
      else Alert.alert("Couldn't add plan", "Please try again.");
    }
  };

  const handleLink = async (questId: string, planId: string | null) => {
    try {
      const updated = await linkQuestToPlan(questId, planId);
      setQuests((prev) => prev.map((q) => (q.id === questId ? updated : q)));
      setLinkingQuestId(null);
    } catch (e) {
      if (isStaleSessionError(e)) await handleStaleSession(logout);
      else Alert.alert("Couldn't link task", "Please try again.");
    }
  };

  const pending = [...quests.filter((q) => q.status === "pending")].sort((a, b) => {
    if (!a.due_at && !b.due_at) return 0;
    if (!a.due_at) return 1;
    if (!b.due_at) return -1;
    return new Date(a.due_at).getTime() - new Date(b.due_at).getTime();
  });
  const totalXpAvailable = pending.reduce((sum, q) => sum + q.xp, 0);

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="px-6 pt-4">
        <Text className="text-2xl font-bold text-gray-900">Dashboard</Text>
      </View>

      <ScrollView className="px-6 pt-4" contentContainerStyle={{ paddingBottom: 32 }}>
        <Text className="text-lg font-bold text-gray-900 mb-3">Your plans</Text>
        {user.plans.length === 0 && <Text className="text-gray-400 mb-3">No plans yet.</Text>}
        <View className="flex-row flex-wrap gap-2 mb-3">
          {user.plans.map((p) => (
            <View key={p.id} className="px-3 py-2 rounded-full bg-orange-50 border border-orange-200">
              <Text className="text-orange-700 text-sm">{p.title}</Text>
            </View>
          ))}
        </View>
        <View className="flex-row gap-2 mb-8">
          <TextInput
            value={newPlanTitle}
            onChangeText={setNewPlanTitle}
            placeholder="Add a new plan..."
            className="flex-1 border border-gray-300 rounded-xl px-4 py-2 text-sm"
            onSubmitEditing={handleAddPlan}
          />
          <Pressable onPress={handleAddPlan} className="px-4 rounded-xl bg-gray-800 items-center justify-center">
            <Text className="text-white font-medium">Add</Text>
          </Pressable>
        </View>

        <View className="flex-row items-center justify-between mb-1">
          <View className="flex-row items-center">
            <Ionicons name="map" size={18} color="#111827" />
            <Text className="text-lg font-bold text-gray-900 ml-2">Quest Log</Text>
            {pending.length > 0 && (
              <View className="bg-gray-900 rounded-full w-5 h-5 items-center justify-center ml-2">
                <Text className="text-white text-[11px] font-bold">{pending.length}</Text>
              </View>
            )}
          </View>
          {totalXpAvailable > 0 && (
            <View className="flex-row items-center bg-amber-50 rounded-full px-2 py-1">
              <Ionicons name="star" size={12} color="#d97706" />
              <Text className="text-amber-700 text-xs font-bold ml-1">{totalXpAvailable} XP available</Text>
            </View>
          )}
        </View>
        <Text className="text-xs text-gray-400 mb-3">Complete quests to earn XP and grow your streak.</Text>

        {pending.length === 0 && (
          <View className="items-center py-10 mb-4 bg-gray-50 rounded-2xl">
            <Ionicons name="checkmark-done-circle" size={32} color="#9ca3af" />
            <Text className="text-gray-400 mt-2">Quest log clear — go connect with someone.</Text>
          </View>
        )}

        {pending.map((q) => (
          <QuestLogCard
            key={q.id}
            quest={q}
            personName={personNameFor(q.connection_id)}
            plans={user.plans}
            isLinking={linkingQuestId === q.id}
            onPress={() => router.push(`/connection/${q.connection_id}`)}
            onToggleLinking={() => setLinkingQuestId(linkingQuestId === q.id ? null : q.id)}
            onLinkPlan={(planId) => handleLink(q.id, planId)}
          />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
