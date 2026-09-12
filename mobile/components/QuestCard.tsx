import * as Clipboard from "expo-clipboard";
import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";

import type { Quest } from "@/lib/types";

const ACTION_LABEL: Record<Quest["type"], string> = {
  message: "Mark sent",
  read: "Mark read",
  meet: "Mark done",
  share: "Mark done",
};

export function QuestCard({ quest, onComplete }: { quest: Quest; onComplete: (id: string) => Promise<void> }) {
  const [completing, setCompleting] = useState(false);
  const done = quest.status === "completed";

  const handleComplete = async () => {
    setCompleting(true);
    try {
      await onComplete(quest.id);
    } finally {
      setCompleting(false);
    }
  };

  return (
    <View className={`rounded-2xl p-4 mb-3 border ${done ? "bg-gray-100 border-gray-200" : "bg-white border-orange-200"}`}>
      <Text className="text-xs uppercase tracking-wide text-orange-600 font-semibold mb-1">{quest.type}</Text>
      <Text className="text-base font-bold text-gray-900 mb-1">{quest.title}</Text>
      <Text className="text-sm text-gray-600 mb-3">{quest.why_now}</Text>

      {quest.type === "message" && quest.draft_message && (
        <View className="bg-gray-50 rounded-xl p-3 mb-3">
          <Text className="text-sm text-gray-800">{quest.draft_message}</Text>
        </View>
      )}
      {quest.type === "read" && (
        <Text className="text-sm text-blue-600 mb-3">Open the source in the connection detail above.</Text>
      )}

      <View className="flex-row gap-2">
        {quest.type === "message" && quest.draft_message && (
          <Pressable
            className="px-4 py-2 rounded-xl bg-gray-200"
            onPress={() => Clipboard.setStringAsync(quest.draft_message ?? "")}
          >
            <Text className="text-gray-800 font-medium">Copy</Text>
          </Pressable>
        )}
        <Pressable
          disabled={done || completing}
          onPress={handleComplete}
          className={`px-4 py-2 rounded-xl ${done ? "bg-gray-300" : "bg-orange-500"}`}
        >
          <Text className="text-white font-semibold">{done ? "Completed" : ACTION_LABEL[quest.type]}</Text>
        </Pressable>
      </View>
    </View>
  );
}
