import { Redirect, useRouter } from "expo-router";
import React, { useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useStore } from "@/lib/store";

const SUGGESTIONS = ["ML internship", "Find a cofounder", "Make new friends", "Find a mentor"];

export default function PlansSetup() {
  const router = useRouter();
  const { user, addPlan } = useStore();
  const [title, setTitle] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!user) return <Redirect href="/login" />;

  const handleAdd = async (planTitle: string) => {
    const trimmed = planTitle.trim();
    if (!trimmed) return;
    setSubmitting(true);
    try {
      await addPlan(trimmed);
      setTitle("");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <ScrollView className="flex-1 px-6 pt-8" contentContainerStyle={{ paddingBottom: 32 }}>
        <Text className="text-3xl font-bold text-gray-900 mb-2">Hi {user.name.split(" ")[0]} 👋</Text>
        <Text className="text-base text-gray-500 mb-8">
          What are you working towards? Add a few improvement plans — every follow-up task you complete can
          link back to one of these.
        </Text>

        <View className="flex-row flex-wrap gap-2 mb-6">
          {SUGGESTIONS.map((s) => (
            <Pressable
              key={s}
              disabled={submitting}
              onPress={() => handleAdd(s)}
              className="px-4 py-2 rounded-full border border-gray-300 bg-white"
            >
              <Text className="text-gray-700">+ {s}</Text>
            </Pressable>
          ))}
        </View>

        <View className="flex-row gap-2 mb-6">
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Write your own..."
            className="flex-1 border border-gray-300 rounded-xl px-4 py-3 text-base"
            onSubmitEditing={() => handleAdd(title)}
          />
          <Pressable
            disabled={!title.trim() || submitting}
            onPress={() => handleAdd(title)}
            className={`px-5 rounded-xl items-center justify-center ${title.trim() ? "bg-orange-500" : "bg-gray-300"}`}
          >
            <Text className="text-white font-semibold">Add</Text>
          </Pressable>
        </View>

        {user.plans.length > 0 && (
          <View className="mb-8">
            <Text className="text-sm font-semibold text-gray-700 mb-2">Your plans</Text>
            {user.plans.map((p) => (
              <View key={p.id} className="bg-gray-50 rounded-xl px-4 py-3 mb-2">
                <Text className="text-gray-800">{p.title}</Text>
              </View>
            ))}
          </View>
        )}

        <Pressable
          disabled={user.plans.length === 0}
          onPress={() => router.replace("/map")}
          className={`rounded-xl py-4 items-center ${user.plans.length > 0 ? "bg-orange-500" : "bg-gray-300"}`}
        >
          <Text className="text-white font-semibold text-base">Continue</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
