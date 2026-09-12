import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useStore } from "@/lib/store";

const GOAL_CHIPS = ["internship", "cofounder", "friendship", "mentor"];

export default function Onboarding() {
  const router = useRouter();
  const { onboard } = useStore();
  const [name, setName] = useState("");
  const [selectedGoals, setSelectedGoals] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const toggleGoal = (goal: string) => {
    setSelectedGoals((prev) => (prev.includes(goal) ? prev.filter((g) => g !== goal) : [...prev, goal]));
  };

  const handleContinue = async () => {
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      await onboard(name.trim(), selectedGoals);
      router.replace("/map");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <ScrollView className="flex-1 px-6 pt-8" contentContainerStyle={{ paddingBottom: 32 }}>
        <Text className="text-3xl font-bold text-gray-900 mb-2">Welcome 👋</Text>
        <Text className="text-base text-gray-500 mb-8">
          The score goes up when you leave the app.
        </Text>

        <Text className="text-sm font-semibold text-gray-700 mb-2">Your name</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Jordan Lee"
          className="border border-gray-300 rounded-xl px-4 py-3 mb-6 text-base"
        />

        <Text className="text-sm font-semibold text-gray-700 mb-2">What are you here for?</Text>
        <View className="flex-row flex-wrap gap-2 mb-8">
          {GOAL_CHIPS.map((goal) => {
            const selected = selectedGoals.includes(goal);
            return (
              <Pressable
                key={goal}
                onPress={() => toggleGoal(goal)}
                className={`px-4 py-2 rounded-full border ${
                  selected ? "bg-orange-500 border-orange-500" : "bg-white border-gray-300"
                }`}
              >
                <Text className={selected ? "text-white font-medium" : "text-gray-700"}>{goal}</Text>
              </Pressable>
            );
          })}
        </View>

        <Pressable
          disabled={!name.trim() || submitting}
          onPress={handleContinue}
          className={`rounded-xl py-4 items-center ${name.trim() ? "bg-orange-500" : "bg-gray-300"}`}
        >
          <Text className="text-white font-semibold text-base">Continue</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
