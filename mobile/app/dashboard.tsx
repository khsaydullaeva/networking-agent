import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { addPlan, linkQuestToPlan, listConnections, listQuests, updateLinks } from "@/lib/api";
import { useStore } from "@/lib/store";
import type { Connection, Quest } from "@/lib/types";

export default function Dashboard() {
  const router = useRouter();
  const { user, setUser } = useStore();
  const [quests, setQuests] = useState<Quest[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [newPlanTitle, setNewPlanTitle] = useState("");
  const [linkingQuestId, setLinkingQuestId] = useState<string | null>(null);
  const [linkedin, setLinkedin] = useState(user?.links.linkedin ?? "");
  const [instagram, setInstagram] = useState(user?.links.instagram ?? "");
  const [facebook, setFacebook] = useState(user?.links.facebook ?? "");
  const [savingLinks, setSavingLinks] = useState(false);

  useEffect(() => {
    setLinkedin(user?.links.linkedin ?? "");
    setInstagram(user?.links.instagram ?? "");
    setFacebook(user?.links.facebook ?? "");
  }, [user?.links.linkedin, user?.links.instagram, user?.links.facebook]);

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
    const plan = await addPlan(user.id, title);
    setUser({ ...user, plans: [...user.plans, plan] });
    setNewPlanTitle("");
  };

  const handleLink = async (questId: string, planId: string | null) => {
    const updated = await linkQuestToPlan(questId, planId);
    setQuests((prev) => prev.map((q) => (q.id === questId ? updated : q)));
    setLinkingQuestId(null);
  };

  const handleSaveLinks = async () => {
    setSavingLinks(true);
    try {
      const updatedUser = await updateLinks(user.id, {
        linkedin: linkedin.trim() || undefined,
        instagram: instagram.trim() || undefined,
        facebook: facebook.trim() || undefined,
      });
      setUser(updatedUser);
    } finally {
      setSavingLinks(false);
    }
  };

  const pending = quests.filter((q) => q.status === "pending");

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-row justify-between items-center px-6 pt-4">
        <Text className="text-2xl font-bold text-gray-900">Dashboard</Text>
        <Pressable onPress={() => router.push("/map")}>
          <Text className="text-orange-600">Map</Text>
        </Pressable>
      </View>

      <ScrollView className="px-6 pt-4" contentContainerStyle={{ paddingBottom: 32 }}>
        <Text className="text-lg font-bold text-gray-900 mb-3">Your links</Text>
        <Text className="text-xs text-gray-500 mb-2">
          Shown to people you connect with, and shared via your QR code.
        </Text>
        <TextInput
          value={linkedin}
          onChangeText={setLinkedin}
          placeholder="Your LinkedIn URL"
          autoCapitalize="none"
          keyboardType="url"
          className="border border-gray-300 rounded-xl px-4 py-2 mb-2 text-sm"
        />
        <TextInput
          value={instagram}
          onChangeText={setInstagram}
          placeholder="Your Instagram URL"
          autoCapitalize="none"
          keyboardType="url"
          className="border border-gray-300 rounded-xl px-4 py-2 mb-2 text-sm"
        />
        <TextInput
          value={facebook}
          onChangeText={setFacebook}
          placeholder="Your Facebook URL"
          autoCapitalize="none"
          keyboardType="url"
          className="border border-gray-300 rounded-xl px-4 py-2 mb-3 text-sm"
        />
        <Pressable
          disabled={savingLinks}
          onPress={handleSaveLinks}
          className="self-start px-4 py-2 rounded-xl bg-gray-800 mb-8"
        >
          <Text className="text-white text-sm font-medium">{savingLinks ? "Saving..." : "Save links"}</Text>
        </Pressable>

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

        <Text className="text-lg font-bold text-gray-900 mb-3">Follow-up tasks</Text>
        {pending.length === 0 && <Text className="text-gray-400">Nothing pending — go connect with someone.</Text>}
        {pending.map((q) => {
          const linkedPlan = user.plans.find((p) => p.id === q.plan_id);
          const isLinking = linkingQuestId === q.id;
          return (
            <Pressable
              key={q.id}
              onPress={() => router.push(`/connection/${q.connection_id}`)}
              className="border border-gray-200 rounded-2xl p-4 mb-3"
            >
              <Text className="text-xs text-gray-400 mb-1">{personNameFor(q.connection_id)}</Text>
              <Text className="text-base font-semibold text-gray-900 mb-2">{q.title}</Text>

              <Pressable
                onPress={(e) => {
                  e.stopPropagation();
                  setLinkingQuestId(isLinking ? null : q.id);
                }}
                className="self-start px-3 py-1 rounded-full bg-gray-100"
              >
                <Text className="text-xs text-gray-600">
                  {linkedPlan ? `Linked: ${linkedPlan.title}` : "Link to a plan"}
                </Text>
              </Pressable>

              {isLinking && (
                <View className="flex-row flex-wrap gap-2 mt-3">
                  {user.plans.map((p) => (
                    <Pressable
                      key={p.id}
                      onPress={(e) => {
                        e.stopPropagation();
                        handleLink(q.id, p.id);
                      }}
                      className={`px-3 py-1 rounded-full ${p.id === q.plan_id ? "bg-orange-500" : "bg-gray-200"}`}
                    >
                      <Text className={`text-xs ${p.id === q.plan_id ? "text-white" : "text-gray-700"}`}>{p.title}</Text>
                    </Pressable>
                  ))}
                  {q.plan_id && (
                    <Pressable
                      onPress={(e) => {
                        e.stopPropagation();
                        handleLink(q.id, null);
                      }}
                      className="px-3 py-1 rounded-full bg-gray-200"
                    >
                      <Text className="text-xs text-gray-700">Unlink</Text>
                    </Pressable>
                  )}
                </View>
              )}
            </Pressable>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}
